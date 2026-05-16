import type { PrismaClient } from "@prisma/client";
import type {
  DashboardSnapshotRecord,
  DashboardRepository,
} from "../../domain/subscribers/DashboardService.js";

/**
 * PrismaDashboardRepository — Prisma implementation of DashboardRepository
 *
 * Upserts dashboard snapshots by intersection name for live UI state.
 */
export class PrismaDashboardRepository implements DashboardRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async upsertByIntersection(
    snapshot: DashboardSnapshotRecord
  ): Promise<void> {
    // Try to find existing snapshot for this intersection
    const existing = await this.prisma.dashboardSnapshot.findFirst({
      where: { intersectionName: snapshot.intersection_name },
    });

    if (existing) {
      await this.prisma.dashboardSnapshot.update({
        where: { id: existing.id },
        data: {
          congestionLevel: snapshot.congestion_level,
          activeVehicleCount: snapshot.active_vehicle_count,
          lastEventId: snapshot.last_event_id,
        },
      });
    } else {
      await this.prisma.dashboardSnapshot.create({
        data: {
          id: snapshot.id,
          intersectionName: snapshot.intersection_name,
          congestionLevel: snapshot.congestion_level,
          activeVehicleCount: snapshot.active_vehicle_count,
          lastEventId: snapshot.last_event_id,
        },
      });
    }
  }

  async findAll(): Promise<DashboardSnapshotRecord[]> {
    const records = await this.prisma.dashboardSnapshot.findMany({
      orderBy: { updatedAt: "desc" },
    });

    return records.map((r) => ({
      id: r.id,
      intersection_name: r.intersectionName,
      congestion_level: r.congestionLevel as DashboardSnapshotRecord["congestion_level"],
      active_vehicle_count: r.activeVehicleCount,
      last_event_id: r.lastEventId,
      updated_at: r.updatedAt.toISOString(),
    }));
  }
}
