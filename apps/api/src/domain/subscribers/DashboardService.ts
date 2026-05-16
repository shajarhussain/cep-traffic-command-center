import { BaseIdempotentSubscriber } from "./BaseIdempotentSubscriber.js";
import type { ProcessedEventRepository } from "./BaseIdempotentSubscriber.js";
import type { EventEnvelope } from "../events/EventEnvelope.js";
import { EVENT_TYPES } from "../events/EventTypes.js";

/**
 * Dashboard snapshot record updated by DashboardService.
 * In Phase 4, this is persisted to the DashboardSnapshot database table.
 */
export interface DashboardSnapshotRecord {
  id: string;
  intersection_name: string;
  congestion_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "CLEARED";
  active_vehicle_count: number;
  last_event_id: string;
  updated_at: string;
}

/**
 * Repository interface for dashboard state storage.
 * Phase 3 uses an in-memory implementation. Phase 4 replaces with Prisma.
 */
export interface DashboardRepository {
  upsertByIntersection(snapshot: DashboardSnapshotRecord): Promise<void>;
  findAll(): Promise<DashboardSnapshotRecord[]>;
}

/**
 * DashboardService — Concrete subscriber for VehicleDetected, CongestionAlert, TrafficCleared
 *
 * Updates live dashboard state based on events. Extends BaseIdempotentSubscriber
 * so the same event does not cause duplicate state updates.
 */
export class DashboardService extends BaseIdempotentSubscriber {
  readonly name = "DashboardService";
  readonly supportedEventTypes = [
    EVENT_TYPES.VehicleDetected,
    EVENT_TYPES.CongestionAlert,
    EVENT_TYPES.TrafficCleared,
  ];

  constructor(
    processedRepo: ProcessedEventRepository,
    private readonly dashboardRepo: DashboardRepository
  ) {
    super(processedRepo);
  }

  protected async process(envelope: EventEnvelope): Promise<void> {
    const payload = envelope.payload as Record<string, unknown>;
    const intersectionName =
      (payload["intersection_name"] as string) ?? "Unknown";

    let congestionLevel: DashboardSnapshotRecord["congestion_level"] = "LOW";
    let vehicleCount = 0;

    if (envelope.event_type === EVENT_TYPES.CongestionAlert) {
      congestionLevel =
        (payload["congestion_level"] as "HIGH" | "CRITICAL") ?? "HIGH";
      vehicleCount = (payload["vehicle_count"] as number) ?? 0;
    } else if (envelope.event_type === EVENT_TYPES.TrafficCleared) {
      congestionLevel = "CLEARED";
      vehicleCount = 0;
    } else if (envelope.event_type === EVENT_TYPES.VehicleDetected) {
      congestionLevel = "LOW";
      vehicleCount = 1;
    }

    await this.dashboardRepo.upsertByIntersection({
      id: crypto.randomUUID(),
      intersection_name: intersectionName,
      congestion_level: congestionLevel,
      active_vehicle_count: vehicleCount,
      last_event_id: envelope.event_id,
      updated_at: new Date().toISOString(),
    });
  }
}
