import { PrismaClient } from '@prisma/client'
import path from 'path'

function normalizeSqliteUrl(value: string | undefined) {
  if (!value) return value
  const normalized = value.replace(/\\/g, '/')
  if (normalized.startsWith('file:./') || normalized.startsWith('file:.')) {
    const relative = normalized.replace(/^file:\.\/?/, '')
    const absolutePath = path.resolve(process.cwd(), relative)
    return `file:${absolutePath.replace(/\\/g, '/')}`
  }
  return value
}

const nextDbUrl = normalizeSqliteUrl(process.env.DATABASE_URL)
const nextMigrationUrl = normalizeSqliteUrl(process.env.DATABASE_MIGRATION_URL)
if (nextDbUrl && nextDbUrl !== process.env.DATABASE_URL) {
  process.env.DATABASE_URL = nextDbUrl
}
if (nextMigrationUrl && nextMigrationUrl !== process.env.DATABASE_MIGRATION_URL) {
  process.env.DATABASE_MIGRATION_URL = nextMigrationUrl
}

const globalForPrisma = global as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
