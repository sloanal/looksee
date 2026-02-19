import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { prisma } from '@/lib/prisma'
import { createPasswordResetToken } from '@/lib/password-reset'

const GENERIC_SUCCESS_MESSAGE = 'If an account exists for that email, we sent a reset link.'
const isDev = process.env.NODE_ENV !== 'production'
const resendApiKey = process.env.RESEND_API_KEY
const emailFrom = process.env.EMAIL_FROM

const resend = resendApiKey ? new Resend(resendApiKey) : null

function getResetUrl(request: NextRequest, token: string) {
  const configuredBaseUrl = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL
  const baseUrl = configuredBaseUrl && configuredBaseUrl.trim().length > 0 ? configuredBaseUrl : request.nextUrl.origin
  return new URL(`/auth/reset-password?token=${encodeURIComponent(token)}`, baseUrl).toString()
}

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

    let resetUrl = ''
    try {
      resetUrl = getResetUrl(request, token)
    } catch (error) {
      console.error('[AUTH] Failed to build password reset URL:', error)
      // Keep response generic so this route does not leak user existence.
      return NextResponse.json({ message: GENERIC_SUCCESS_MESSAGE })
    }

    if (resend && emailFrom) {
      try {
        const sendResult = await resend.emails.send({
          from: emailFrom,
          to: user.email,
          subject: 'Reset your Looksee password',
          text: `We received a request to reset your Looksee password.\n\nReset it here: ${resetUrl}\n\nThis link expires in 1 hour. If you did not request this, you can ignore this email.`,
          html: `
            <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
              <h2 style="margin-bottom: 8px;">Reset your Looksee password</h2>
              <p>We received a request to reset your password.</p>
              <p>
                <a href="${resetUrl}" style="display: inline-block; background: #111827; color: #ffffff; text-decoration: none; padding: 10px 14px; border-radius: 6px;">
                  Reset password
                </a>
              </p>
              <p style="margin-top: 16px;">This link expires in 1 hour. If you did not request this, you can ignore this email.</p>
            </div>
          `,
        })

        if (sendResult.error) {
          console.error('[AUTH] Resend rejected password reset email:', {
            userId: user.id,
            toDomain: user.email.split('@')[1] ?? 'unknown',
            fromDomain: emailFrom.split('@')[1] ?? 'unknown',
            error: sendResult.error,
          })
        } else {
          console.info('[AUTH] Password reset email queued:', {
            userId: user.id,
            messageId: sendResult.data?.id ?? null,
          })
        }
      } catch (error) {
        // Keep response generic so this route does not leak user existence.
        console.error('[AUTH] Failed to send password reset email:', error)
      }
    } else {
      console.warn('[AUTH] Password reset email provider not configured. Set RESEND_API_KEY and EMAIL_FROM.', {
        hasResendApiKey: Boolean(resendApiKey),
        hasEmailFrom: Boolean(emailFrom),
        nodeVersion: process.version,
      })
    }

    // For local/dev use, we also expose the URL and log it to server output.
    if (isDev) {
      console.info('[AUTH] Password reset link generated:', resetUrl)
      return NextResponse.json({ message: GENERIC_SUCCESS_MESSAGE, resetUrl })
    }

    return NextResponse.json({ message: GENERIC_SUCCESS_MESSAGE })
  } catch (error) {
    console.error('Password reset request error:', error)
    return NextResponse.json({ error: 'Failed to process password reset request' }, { status: 500 })
  }
}
