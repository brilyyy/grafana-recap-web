import { relations } from "drizzle-orm";
import {
  integer,
  pgTable,
  serial,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/pg-core";
import { appIdentifier } from "./applications";
import { errorTypeEnum } from "./enums";

// ─── Tables ───────────────────────────────────────────────────────────────────

export const responseCodeDictionary = pgTable(
  "response_code_dictionary",
  {
    id: serial("id").primaryKey(),
    idAppIdentifier: integer("id_app_identifier")
      .notNull()
      .references(() => appIdentifier.id, { onDelete: "cascade" }),
    jenisTransaksi: varchar("jenis_transaksi", { length: 255 }),
    rc: varchar("rc", { length: 255 }),
    rcDescription: varchar("rc_description", { length: 500 }),
    errorType: errorTypeEnum("error_type").notNull(),
  },
  (t) => ({
    uniqueEntry: unique("unique_dictionary_entry").on(
      t.idAppIdentifier,
      t.jenisTransaksi,
      t.rc,
    ),
  }),
);

export const unmappedRc = pgTable(
  "unmapped_rc",
  {
    id: serial("id").primaryKey(),
    idAppIdentifier: integer("id_app_identifier")
      .notNull()
      .references(() => appIdentifier.id, { onDelete: "cascade" }),
    jenisTransaksi: varchar("jenis_transaksi", { length: 255 }),
    rc: varchar("rc", { length: 255 }),
    rcDescription: varchar("rc_description", { length: 500 }),
    statusTransaksi: varchar("status_transaksi", { length: 255 }),
    errorType: errorTypeEnum("error_type"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    uniqueEntry: unique("unique_unmapped_rc_entry").on(
      t.idAppIdentifier,
      t.jenisTransaksi,
      t.rc,
    ),
  }),
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const responseCodeDictionaryRelations = relations(
  responseCodeDictionary,
  ({ one }) => ({
    app: one(appIdentifier, {
      fields: [responseCodeDictionary.idAppIdentifier],
      references: [appIdentifier.id],
    }),
  }),
);

export const unmappedRcRelations = relations(unmappedRc, ({ one }) => ({
  app: one(appIdentifier, {
    fields: [unmappedRc.idAppIdentifier],
    references: [appIdentifier.id],
  }),
}));

// ─── Types ────────────────────────────────────────────────────────────────────

export type ResponseCodeDictionary = typeof responseCodeDictionary.$inferSelect;
export type NewResponseCodeDictionary =
  typeof responseCodeDictionary.$inferInsert;
export type UnmappedRc = typeof unmappedRc.$inferSelect;
export type NewUnmappedRc = typeof unmappedRc.$inferInsert;
