import { randomInt } from 'node:crypto'

export const PROFILE_ENTRY_CSV_HEADER = 'UUID,EMAIL,Password,created_at_utc'
export const SIGNUP_ENTRY_CSV_HEADER = 'UUID,EMAIL,created_at_utc'
const ENTRY_UUID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

export type ProfileEntry = {
  UUID: string
  EMAIL: string
  Password: string
  created_at_utc: string
}

export type SignupEntry = {
  UUID: string
  EMAIL: string
  created_at_utc: string
}

export function createEntryUuid(used: ReadonlySet<string>) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    let value = ''
    for (let index = 0; index < 7; index += 1) value += ENTRY_UUID_ALPHABET[randomInt(ENTRY_UUID_ALPHABET.length)]
    if (!used.has(value) && /[A-Za-z]/.test(value) && /[0-9]/.test(value)) return value
  }
  throw new Error('A profile entry id could not be created.')
}
