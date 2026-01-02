#!/usr/bin/env node

const { execSync } = require('child_process');
const process = require('process');

// Only run migrations if DATABASE_URL is set
if (process.env.DATABASE_URL) {
  console.log('DATABASE_URL found, running database migrations...');
  try {
    execSync('npx prisma migrate deploy', { 
      stdio: 'inherit',
      env: { ...process.env }
    });
    console.log('✓ Migrations completed successfully');
  } catch (error) {
    console.error('✗ Migration failed:', error.message);
    console.error('Note: If this is the first deployment, you may need to run migrations manually.');
    console.error('See README.md for instructions on running migrations via API endpoint.');
    // Don't fail the build if migrations fail - allow manual migration
    // process.exit(1);
  }
} else {
  console.log('⚠ DATABASE_URL not set, skipping migrations...');
  console.log('Note: After creating your Postgres database in Vercel, migrations will run automatically on the next deployment.');
}

// Always build
console.log('Building Next.js app...');
try {
  execSync('next build', { stdio: 'inherit' });
} catch (error) {
  console.error('Build failed:', error.message);
  process.exit(1);
}

