import type { PrismaClient } from "@prisma/client";
import type {
  AuditLogRecord,
  AuditLogRepository,
} from "../../domain/subscribers/LoggingService.js";

/**
 * PrismaAuditLogRepository — Prisma implementation of AuditLogRepository
 *
 * Stores audit logs for legal traceability of events.
 */
export class PrismaAuditLogRepository implements AuditLogRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(log: AuditLogRecord): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        id: log.id,
        eventId: log.event_id,
        eventType: log.event_type,
        message: log.message,
        payloadSnapshot: log.payload_snapshot,
        createdAt: new Date(log.created_at),
      },
    });
  }

  async findAll(): Promise<AuditLogRecord[]> {
    const records = await this.prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
    });

    return records.map((r) => ({
      id: r.id,
      event_id: r.eventId,
      event_type: r.eventType,
      message: r.message,
      payload_snapshot: r.payloadSnapshot,
      created_at: r.createdAt.toISOString(),
    }));
  }

  async count(): Promise<number> {
    return this.prisma.auditLog.count();
  }
}
