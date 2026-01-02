import { NextRequest, NextResponse } from 'next/server'
import { execSync } from 'child_process'

// POST /api/admin/migrate - Run database migrations
// This is a one-time setup endpoint to run migrations after database is created
export async function POST(request: NextRequest) {
  // Simple security check - in production, you might want to add authentication
  const authHeader = request.headers.get('authorization')
  const expectedToken = process.env.MIGRATION_TOKEN || 'setup-migration-2024'
  
  if (authHeader !== `Bearer ${expectedToken}`) {
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
        error: error.message || 'Migration failed',
        details: error.toString()
      },
      { status: 500 }
    )
  }
}

