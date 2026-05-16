import { PrismaClient } from "@prisma/client";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../../../..");
const TEST_DB_URL = `file:${path.join(rootDir, "prisma", "test.db")}`;

let _prisma: PrismaClient | null = null;

export function getTestPrisma(): PrismaClient {
  if (!_prisma) {
    execSync("npx prisma db push --schema=prisma/schema.prisma --skip-generate --accept-data-loss", {
      cwd: rootDir,
      env: { ...process.env, DATABASE_URL: TEST_DB_URL },
      stdio: "pipe",
    });
    _prisma = new PrismaClient({ datasourceUrl: TEST_DB_URL });
  }
  return _prisma;
}

/** Clean all test-relevant tables (including V2 tables) */
export async function cleanTestDb(prisma: PrismaClient): Promise<void> {
  await prisma.incidentEvent.deleteMany();
  await prisma.trafficIncident.deleteMany();
  await prisma.penalty.deleteMany();
  await prisma.processedEvent.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.dashboardSnapshot.deleteMany();
  await prisma.reportAggregate.deleteMany();
  await prisma.eventEnvelopeRecord.deleteMany();
  await prisma.eventOutbox.deleteMany();
  await prisma.operatorActionLog.deleteMany();
  await prisma.externalTrafficSnapshot.deleteMany();
  await prisma.externalProviderConfig.deleteMany();
  await prisma.trafficCamera.deleteMany();
  await prisma.intersection.deleteMany();
  await prisma.operationZone.deleteMany();
  await prisma.alertTemplate.deleteMany();
  await prisma.severityPolicy.deleteMany();
  await prisma.incidentRule.deleteMany();
  await prisma.queuePolicy.deleteMany();
  await prisma.finePolicy.deleteMany();
}

export async function disconnectTestPrisma(): Promise<void> {
  if (_prisma) {
    await _prisma.$disconnect();
    _prisma = null;
  }
}
