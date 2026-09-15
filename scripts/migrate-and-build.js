#!/usr/bin/env node

const { execSync } = require('child_process')
const process = require('process')

// Vercel builds every environment with NODE_ENV=production, previews included,
// so when it names the environment itself that is the only answer worth
// reading: otherwise a preview whose database is missing or unreachable fails
// the build as if it were shipping to production.
const isProductionDeploy = process.env.VERCEL_ENV
  ? process.env.VERCEL_ENV === 'production'
  : process.env.NODE_ENV === 'production'
const migrationsFailOpen = process.env.MIGRATIONS_FAIL_OPEN === 'true'

// Prisma Migrate takes a postgres advisory lock for the length of its run, and
// a pooled connection is the wrong place to hold one: Neon's `-pooler` host,
// and PgBouncer generally, can leave the lock call waiting until Prisma gives
// up with P1002. Hosts that pool publish a direct connection string to the
// same database alongside the pooled one, which is what migrations want. Only
// this command is moved onto it; the app still connects through DATABASE_URL.
const DIRECT_URL_NAMES = [
  'MIGRATE_DATABASE_URL',
  'DATABASE_URL_UNPOOLED',
  'POSTGRES_URL_NON_POOLING',
  'DIRECT_URL',
]

// A lock that timed out, or a serverless database that was still waking up,
// says nothing about whether the migrations apply, so ask again before taking
// a deploy down over it.
const RETRY_DELAYS_MS = [5000, 15000]

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function migrate(urlName) {
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      execSync('npx prisma migrate deploy', {
        stdio: 'inherit',
        env: { ...process.env, DATABASE_URL: process.env[urlName] },
      })
      console.log('Migrations completed successfully')
      return true
    } catch (error) {
      console.error('Migration failed:', error.message)
      const delay = RETRY_DELAYS_MS[attempt]
      if (delay === undefined) return false
      console.log(
        `Retrying in ${delay / 1000}s (attempt ${attempt + 2} of ${RETRY_DELAYS_MS.length + 1}).`,
      )
      await sleep(delay)
    }
  }
  return false
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set.')
    if (isProductionDeploy) {
      console.error('Production deploys require DATABASE_URL. Failing build.')
      process.exit(1)
    }
    console.log('Skipping migrations in non-production environment.')
  } else {
    const urlName = DIRECT_URL_NAMES.find((name) => process.env[name]) ?? 'DATABASE_URL'
    console.log(`${urlName} found, running database migrations...`)

    if (!await migrate(urlName)) {
      if (isProductionDeploy && !migrationsFailOpen) {
        console.error('Failing production build because migrations did not apply.')
        console.error('Set MIGRATIONS_FAIL_OPEN=true only as a temporary emergency bypass.')
        process.exit(1)
      }
      console.error(
        'Continuing build due to non-production environment or MIGRATIONS_FAIL_OPEN=true.',
      )
    }
  }

  // Always build
  console.log('Building Next.js app...')
  try {
    execSync('next build', { stdio: 'inherit' })
  } catch (error) {
    console.error('Build failed:', error.message)
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('Build script failed:', error)
  process.exit(1)
})
