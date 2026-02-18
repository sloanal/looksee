import { NextRequest, NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { timingSafeEqual } from 'crypto'

const runtimeMigrationsEnabled = process.env.ALLOW_RUNTIME_MIGRATIONS === 'true'
const isProd = process.env.NODE_ENV === 'production'

function tokensMatch(providedToken: string, expectedToken: string) {
  const providedBuffer = Buffer.from(providedToken)
  const expectedBuffer = Buffer.from(expectedToken)
  if (providedBuffer.length !== expectedBuffer.length) {
    return false
  }
  return timingSafeEqual(providedBuffer, expectedBuffer)
}

// POST /api/admin/migrate - Run database migrations
// This is a one-time setup endpoint to run migrations after database is created
export async function POST(request: NextRequest) {
  if (isProd && !runtimeMigrationsEnabled) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const expectedToken = process.env.MIGRATION_TOKEN
  if (!expectedToken) {
    console.error('MIGRATION_TOKEN is not configured')
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  if (expectedToken.length < 24) {
    console.error('MIGRATION_TOKEN must be at least 24 characters')
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const authHeader = request.headers.get('authorization') ?? ''
  const providedToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''

  if (!providedToken || !tokensMatch(providedToken, expectedToken)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    console.log('Running database migrations...')
    execSync('npx prisma migrate deploy', { 
      stdio: 'inherit',
      env: process.env 
    })
    
    return NextResponse.json({ 
      success: true, 
      message: 'Migrations completed successfully' 
    })
  } catch (error: any) {
    console.error('Migration error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Migration failed',
        details: isProd ? undefined : error.message || error.toString(),
      },
      { status: 500 }
    )
  }
}

