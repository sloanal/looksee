import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createPasswordResetToken } from '@/lib/password-reset'

const GENERIC_SUCCESS_MESSAGE = 'If an account exists for that email, we sent a reset link.'
const isDev = process.env.NODE_ENV !== 'production'

// POST /api/auth/password-reset/request - Request a password reset email
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const email = typeof body?.email === 'string' ? body.email.toLowerCase().trim() : ''

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    })

    if (!user) {
      // Don't reveal whether an account exists for this email
      return NextResponse.json({ message: GENERIC_SUCCESS_MESSAGE })
    }

    const { token, tokenHash, expiresAt } = createPasswordResetToken()

    // Invalidate active tokens before issuing a new one.
    await prisma.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { usedAt: new Date() },
    })

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    })

    const baseUrl = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? ''
    const resetPath = `/auth/reset-password?token=${encodeURIComponent(token)}`
    const resetUrl = baseUrl ? new URL(resetPath, baseUrl).toString() : resetPath

    // This app does not yet have an email provider configured.
    // For local/dev use, we expose the URL and log it to server output.
    if (isDev) {
      console.info('[AUTH] Password reset link generated:', resetUrl)
      return NextResponse.json({
        message: GENERIC_SUCCESS_MESSAGE,
        resetUrl,
      })
    }

    return NextResponse.json({ message: GENERIC_SUCCESS_MESSAGE })
  } catch (error) {
    console.error('Password reset request error:', error)
    return NextResponse.json({ error: 'Failed to process password reset request' }, { status: 500 })
  }
}
