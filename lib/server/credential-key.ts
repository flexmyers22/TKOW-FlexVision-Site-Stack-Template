import { createHash, randomBytes, randomInt } from 'node:crypto'

const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const DIGITS = '23456789'
const ALPHABET = `${LETTERS}${DIGITS}`
export const CREDENTIAL_KEY_LENGTH = 12

export function createCredentialKey(input: string) {
  const mixed = createHash('sha256').update(Buffer.concat([Buffer.from(input, 'utf8'), randomBytes(32)])).digest()
  const chars = [
    LETTERS[indexIn(LETTERS, mixed[0])],
    DIGITS[indexIn(DIGITS, mixed[1])],
  ]
  for (let position = 2; position < CREDENTIAL_KEY_LENGTH; position += 1) {
    chars.push(ALPHABET[indexIn(ALPHABET, mixed[position])])
  }
  for (let position = chars.length - 1; position > 0; position -= 1) {
    const swap = randomInt(position + 1)
    const current = chars[position]
    chars[position] = chars[swap]
    chars[swap] = current
  }
  return chars.join('')
}

function indexIn(pool: string, byte: number) {
  const span = Math.floor(256 / pool.length) * pool.length
  if (byte < span) return byte % pool.length
  return randomInt(pool.length)
}
