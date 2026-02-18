#!/usr/bin/env node

const { execSync } = require('child_process');
const process = require('process');

const isProductionDeploy = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
const migrationsFailOpen = process.env.MIGRATIONS_FAIL_OPEN === 'true';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set.');
  if (isProductionDeploy) {
    console.error('Production deploys require DATABASE_URL. Failing build.');
    process.exit(1);
  }
  console.log('Skipping migrations in non-production environment.');
} else {
  console.log('DATABASE_URL found, running database migrations...');
  try {
    execSync('npx prisma migrate deploy', {
      stdio: 'inherit',
      env: { ...process.env }
    });
    console.log('Migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error.message);
    if (isProductionDeploy && !migrationsFailOpen) {
      console.error('Failing production build because migrations did not apply.');
      console.error('Set MIGRATIONS_FAIL_OPEN=true only as a temporary emergency bypass.');
      process.exit(1);
    }
    console.error('Continuing build due to non-production environment or MIGRATIONS_FAIL_OPEN=true.');
  }
}

// Always build
console.log('Building Next.js app...');
try {
  execSync('next build', { stdio: 'inherit' });
} catch (error) {
  console.error('Build failed:', error.message);
  process.exit(1);
}

