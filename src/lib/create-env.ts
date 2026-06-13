import type { ZodType, ZodError, ZodIssue, infer as ZodInfer } from "zod";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Both server and client schemas must produce plain objects so we can spread,
 * iterate keys, and wrap in a Proxy. Constraining to `ZodType<Record<string,
 * unknown>>` keeps `z.object({...})` calls assignable while locking out unions,
 * primitives, and other schema kinds that would break the merge logic.
 */
type EnvSchema = ZodType<Record<string, unknown>>;

/** Raised instead of bare Error so callers can `instanceof EnvValidationError`. */
export class EnvValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvValidationError";
  }
}

// ─── prettifyZodError ─────────────────────────────────────────────────────────

/**
 * Format a ZodError into a readable console-friendly string.
 *
 * Updated for zod v4: `invalid_type` issues no longer carry a `received` field
 * (it was removed); the discriminated union codes and field names have changed.
 * Uses `issue.origin` on `too_small`/`too_big` and drops any field references
 * that no longer exist on the v4 issue shapes.
 *
 * @param error  - The ZodError to format.
 * @param label  - Optional context label for the header (e.g. "server", "client").
 */
export function prettifyZodError(error: ZodError, label?: string): string {
  const header = label
    ? `❌ Environment validation failed (${label}):\n`
    : "❌ Environment validation failed:\n";
  const lines: string[] = [header];

  for (const issue of error.issues as ZodIssue[]) {
    const path = issue.path.join(".") || "(root)";
    let hint = "";

    switch (issue.code) {
      case "invalid_type":
        // zod v4: `received` field removed; only `expected` is present.
        hint = ` (expected: ${issue.expected})`;
        break;
      case "too_small": {
        const origin =
          "origin" in issue ? (issue as { origin: string }).origin : "";
        const qualifier = origin === "string" ? " length" : "";
        const min =
          "minimum" in issue
            ? (issue as { minimum: number | bigint }).minimum
            : "";
        hint = ` (minimum${qualifier}: ${min})`;
        break;
      }
      case "too_big": {
        const origin =
          "origin" in issue ? (issue as { origin: string }).origin : "";
        const qualifier = origin === "string" ? " length" : "";
        const max =
          "maximum" in issue
            ? (issue as { maximum: number | bigint }).maximum
            : "";
        hint = ` (maximum${qualifier}: ${max})`;
        break;
      }
      case "unrecognized_keys": {
        const keys = "keys" in issue ? (issue as { keys: string[] }).keys : [];
        hint = ` (unrecognized keys: ${keys.join(", ")})`;
        break;
      }
      case "invalid_format": {
        const fmt =
          "format" in issue ? (issue as { format: string }).format : "";
        hint = fmt ? ` (format: ${fmt})` : "";
        break;
      }
      default:
        break;
    }

    lines.push(`  • ${path}: ${issue.message}${hint}`);
  }

  const isDev =
    typeof process !== "undefined" && process.env?.NODE_ENV === "development";

  lines.push("\n💡 Hint: Check your .env file or environment variables.");
  if (isDev) {
    lines.push(
      "   Run with SKIP_ENV_VALIDATION=true to bypass this check temporarily.",
    );
  }

  return lines.join("\n");
}

// ─── Options ──────────────────────────────────────────────────────────────────

export interface CreateEnvOptions<
  TServerSchema extends EnvSchema,
  TClientSchema extends EnvSchema,
> {
  /** Zod schema for server-only environment variables. */
  server: TServerSchema;
  /** Zod schema for client-safe environment variables (must be prefixed with `clientPrefix`). */
  client: TClientSchema;
  /**
   * Required prefix for client variables (e.g., `'VITE_'`).
   * Keys without this prefix in the client source are ignored.
   * The prefix is stripped before validation, so schemas use unprefixed names.
   */
  clientPrefix: string;
  /**
   * Override the parse sources.
   * Defaults: `{ server: process.env, client: import.meta.env }`.
   */
  parseFrom?: {
    server?: Record<string, unknown>;
    client?: Record<string, unknown>;
  };
  /** Skip validation entirely and return raw values. Never use in production. */
  skipValidation?: boolean;
  /** Called when validation fails before the error is thrown. */
  onValidationError?: (error: ZodError) => void;
  /** Transform the server source before validation. Default: identity. */
  transformServer?: (data: Record<string, unknown>) => Record<string, unknown>;
  /** Transform the client source before validation. Default: identity. */
  transformClient?: (data: Record<string, unknown>) => Record<string, unknown>;
  /**
   * Throw when a server-only variable is accessed from client code.
   * Default: `true`.
   */
  runtimeCheckServerAccess?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Treat empty strings as `undefined` so `z.string().min(1)` correctly rejects
 * them and `.default()` applies when a var is unset.
 */
function withoutEmptyStrings(
  source: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    out[key] = value === "" ? undefined : value;
  }
  return out;
}

/**
 * Strip `prefix` from keys and drop keys that don't start with it.
 * Example: `{ VITE_API_URL: 'x' }` + prefix `'VITE_'` → `{ API_URL: 'x' }`.
 */
function filterAndStripPrefix(
  source: Record<string, unknown>,
  prefix: string,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (key.startsWith(prefix)) {
      result[key.slice(prefix.length)] = value;
    }
  }
  return result;
}

/**
 * Parse the top-level keys out of a schema's `.shape` so they can be used
 * in the Proxy guard even when the server schema is never parsed on the client.
 */
function getSchemaKeys(schema: EnvSchema): Set<string> {
  const shape = (schema as unknown as { shape?: Record<string, unknown> })
    .shape;
  return new Set(shape ? Object.keys(shape) : []);
}

/**
 * Parse `source` against `schema`, throwing an `EnvValidationError` on failure.
 */
export function parseEnv<TSchema extends EnvSchema>(
  schema: TSchema,
  source: Record<string, unknown>,
  label: string,
  onError?: (err: ZodError) => void,
): ZodInfer<TSchema> {
  const result = schema.safeParse(withoutEmptyStrings(source));
  if (!result.success) {
    onError?.(result.error);
    throw new EnvValidationError(prettifyZodError(result.error, label));
  }
  return result.data;
}

// ─── createEnv ────────────────────────────────────────────────────────────────

/**
 * Parse and validate environment variables using Zod schemas.
 *
 * Returns a merged, read-only proxy of server + client vars.
 * - Server vars are validated only on the server (`typeof window === 'undefined'`).
 * - On the client, accessing a server-only key throws immediately (unless
 *   `runtimeCheckServerAccess` is set to `false`).
 * - Empty strings are coerced to `undefined` before validation.
 * - Client vars are filtered+stripped of `clientPrefix` before validation.
 */
export function createEnv<
  TServerSchema extends EnvSchema,
  TClientSchema extends EnvSchema,
>(
  options: CreateEnvOptions<TServerSchema, TClientSchema>,
): ZodInfer<TServerSchema> & ZodInfer<TClientSchema> {
  const {
    server: serverSchema,
    client: clientSchema,
    clientPrefix,
    parseFrom = {},
    skipValidation = false,
    onValidationError,
    transformServer = (d) => d,
    transformClient = (d) => d,
    runtimeCheckServerAccess = true,
  } = options;

  const isServer = typeof window === "undefined";

  const rawServerSource: Record<string, unknown> =
    parseFrom.server ??
    (typeof process !== "undefined"
      ? (process.env as Record<string, unknown>)
      : {});
  const rawClientSource: Record<string, unknown> =
    parseFrom.client ??
    (typeof import.meta.env !== "undefined"
      ? (import.meta.env as Record<string, unknown>)
      : {});

  const filteredClientSource = filterAndStripPrefix(
    rawClientSource,
    clientPrefix,
  );

  // Derive schema keys from the shape — used by the Proxy guard on the client
  // even when the server schema is never parsed there.
  const serverSchemaKeys = getSchemaKeys(serverSchema);
  const clientSchemaKeys = getSchemaKeys(clientSchema);

  let serverEnv: ZodInfer<TServerSchema>;
  let clientEnv: ZodInfer<TClientSchema>;

  if (skipValidation) {
    serverEnv = rawServerSource as unknown as ZodInfer<TServerSchema>;
    clientEnv = filteredClientSource as unknown as ZodInfer<TClientSchema>;
  } else if (!isServer) {
    // On the client: skip server parse (no DB_* etc. available in the browser).
    serverEnv = {} as ZodInfer<TServerSchema>;
    clientEnv = parseEnv(
      clientSchema,
      transformClient(filteredClientSource),
      "client",
      onValidationError,
    );
  } else {
    serverEnv = parseEnv(
      serverSchema,
      transformServer(rawServerSource),
      "server",
      onValidationError,
    );
    clientEnv = parseEnv(
      clientSchema,
      transformClient(filteredClientSource),
      "client",
      onValidationError,
    );
  }

  const merged = { ...serverEnv, ...clientEnv } as ZodInfer<TServerSchema> &
    ZodInfer<TClientSchema>;

  const isDev =
    typeof process !== "undefined" && process.env?.NODE_ENV === "development";

  const handler: ProxyHandler<typeof merged> = {
    get(target, prop, receiver) {
      const key = String(prop);

      // Server-on-client guard runs BEFORE the existence check: on the client
      // the server vars are not in `merged` (parse was skipped), so hasOwnProperty
      // would return false and the guard would never fire if ordered after it.
      if (
        !isServer &&
        runtimeCheckServerAccess &&
        serverSchemaKeys.has(key) &&
        !clientSchemaKeys.has(key)
      ) {
        throw new Error(
          `❌ Server-only environment variable "${key}" was accessed from client code.\n` +
            `   Either move this logic to a server function or prefix with ${clientPrefix} for client exposure.`,
        );
      }

      if (!Object.prototype.hasOwnProperty.call(target, key)) return undefined;
      return Reflect.get(target, prop, receiver);
    },
    set() {
      if (isDev) {
        console.warn(
          "[env] Attempted to set environment variable — ignored (read-only).",
        );
      }
      return true;
    },
    ownKeys(target) {
      return Reflect.ownKeys(target);
    },
    getOwnPropertyDescriptor(target, prop) {
      return Reflect.getOwnPropertyDescriptor(target, prop);
    },
  };

  return new Proxy(merged, handler);
}
