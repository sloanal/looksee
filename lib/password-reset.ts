import crypto from 'crypto'

const RESET_TOKEN_BYTES = 32
const RESET_TOKEN_TTL_MS = 1000 * 60 * 60 // 1 hour

export function createPasswordResetToken() {
  const token = crypto.randomBytes(RESET_TOKEN_BYTES).toString('hex')
  return {
    token,
    tokenHash: hashPasswordResetToken(token),
    expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
  }
}

export function hashPasswordResetToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex')
}
