import type { PrismaClient } from "@prisma/client";
import type {
  ReportAggregateRecord,
  ReportRepository,
} from "../../domain/subscribers/ReportingService.js";

/**
 * PrismaReportRepository — Prisma implementation of ReportRepository
 *
 * Increments event counts by type and camera for reporting.
 * Uses a daily window for aggregation.
 */
export class PrismaReportRepository implements ReportRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async incrementCount(eventType: string, cameraId: string): Promise<void> {
    // Use a daily window for aggregation
    const now = new Date();
    const windowStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    const windowEnd = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1
    );

    // Try to find existing aggregate for this type+camera+window
    const existing = await this.prisma.reportAggregate.findFirst({
      where: {
        eventType,
        cameraId,
        windowStart,
      },
    });

    if (existing) {
      await this.prisma.reportAggregate.update({
        where: { id: existing.id },
        data: { count: existing.count + 1 },
      });
    } else {
      await this.prisma.reportAggregate.create({
        data: {
          eventType,
          cameraId,
          count: 1,
          windowStart,
          windowEnd,
        },
      });
    }
  }

  async findAll(): Promise<ReportAggregateRecord[]> {
    const records = await this.prisma.reportAggregate.findMany({
      orderBy: { windowStart: "desc" },
    });

    return records.map((r) => ({
      id: r.id,
      event_type: r.eventType,
      camera_id: r.cameraId,
      count: r.count,
      window_start: r.windowStart.toISOString(),
      window_end: r.windowEnd.toISOString(),
    }));
  }
}
