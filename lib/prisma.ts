import { PrismaClient } from '@prisma/client'

if (process.env.NODE_ENV !== 'production') {
  const url = process.env.DATABASE_URL ?? ''
  if (!url.startsWith('postgres://') && !url.startsWith('postgresql://')) {
    console.warn(
      '[PRISMA] DATABASE_URL must start with postgres:// or postgresql:// for local dev.'
    )
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

