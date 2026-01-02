#!/usr/bin/env node

const { execSync } = require('child_process');
const process = require('process');

// Only run migrations if DATABASE_URL is set
if (process.env.DATABASE_URL) {
  console.log('Running database migrations...');
  try {
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  }
} else {
  console.log('DATABASE_URL not set, skipping migrations...');
}

// Always build
console.log('Building Next.js app...');
try {
  execSync('next build', { stdio: 'inherit' });
} catch (error) {
  console.error('Build failed:', error.message);
  process.exit(1);
}

