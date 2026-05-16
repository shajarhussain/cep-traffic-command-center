import { PrismaClient } from "@prisma/client";

/**
 * Prisma client singleton.
 *
 * A single PrismaClient instance is shared across the application
 * to avoid exhausting database connections. This is the standard
 * pattern recommended by Prisma documentation.
 */
const prisma = new PrismaClient();

export default prisma;
