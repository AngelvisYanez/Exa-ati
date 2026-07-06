// Re-export the Neon pool adapter from sri-api for consistency.
// This file exists as a convenience alias; all logic uses the `db` utility directly.
export { dbPrisma as prisma } from '@/lib/sri-api/db-prisma'
