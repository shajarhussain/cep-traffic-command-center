import { BaseIdempotentSubscriber } from "./BaseIdempotentSubscriber.js";
import type { ProcessedEventRepository } from "./BaseIdempotentSubscriber.js";
import type { EventEnvelope } from "../events/EventEnvelope.js";
import { EVENT_TYPES } from "../events/EventTypes.js";
import type { BoundedEventQueue } from "../bus/BoundedEventQueue.js";

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
 *
 * NOW WIRED to BoundedEventQueue (CLO 4 Scenario 2):
 * Rather than processing synchronously and potentially causing backpressure,
 * it queues incoming events and processes them at a controlled rate via a background interval.
 */
export class DashboardService extends BaseIdempotentSubscriber {
  readonly name = "DashboardService";
  readonly supportedEventTypes = [
    EVENT_TYPES.VehicleDetected,
    EVENT_TYPES.CongestionAlert,
    EVENT_TYPES.TrafficCleared,
  ];

  private processorTimer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    processedRepo: ProcessedEventRepository,
    private readonly dashboardRepo: DashboardRepository,
    public readonly boundedQueue?: import("../bus/BoundedEventQueue.js").BoundedEventQueue
  ) {
    super(processedRepo);
  }

  /**
   * Overrides base process().
   * If a boundedQueue is provided, enqueues the event for background processing.
   * If no queue is provided (e.g. in tests), processes it synchronously.
   */
  protected async process(envelope: EventEnvelope): Promise<void> {
    if (this.boundedQueue) {
      this.boundedQueue.enqueue(envelope);
    } else {
      await this.processSynchronously(envelope);
    }
  }

  /**
   * Starts the background processor that drains the BoundedEventQueue.
   */
  public start(intervalMs = 50): void {
    if (this.running || !this.boundedQueue) return;
    this.running = true;
    this.processorTimer = setInterval(() => {
      void this.tick();
    }, intervalMs);
  }

  public stop(): void {
    if (this.processorTimer) clearInterval(this.processorTimer);
    this.processorTimer = null;
    this.running = false;
  }

  private async tick(): Promise<void> {
    if (!this.boundedQueue) return;
    const envelope = this.boundedQueue.dequeue();
    if (envelope) {
      try {
        await this.processSynchronously(envelope);
      } catch (e) {
        console.error("[DashboardService] Error processing queued event:", e);
      }
    }
  }

  private async processSynchronously(envelope: EventEnvelope): Promise<void> {
    const payload = envelope.payload as Record<string, unknown>;
    const intersectionName = (payload["intersection_name"] as string) ?? "Unknown";

    let congestionLevel: DashboardSnapshotRecord["congestion_level"] = "LOW";
    let vehicleCount = 0;

    if (envelope.event_type === EVENT_TYPES.CongestionAlert) {
      congestionLevel = (payload["congestion_level"] as "HIGH" | "CRITICAL") ?? "HIGH";
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
