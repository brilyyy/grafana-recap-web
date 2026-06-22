import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt)

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const derived = (await scryptAsync(password, salt, 64)) as Buffer
  return `scrypt:${salt.toString('base64')}:${derived.toString('base64')}`
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  if (!hash.startsWith('scrypt:')) return false
  const [, saltB64, keyB64] = hash.split(':')
  const salt = Buffer.from(saltB64, 'base64')
  const key = Buffer.from(keyB64, 'base64')
  const derived = (await scryptAsync(password, salt, 64)) as Buffer
  return timingSafeEqual(derived, key)
}
