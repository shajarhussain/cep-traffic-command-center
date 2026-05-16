import type { EventBus } from "../domain/bus/EventBus.js";
import type { PrismaOutboxRepository } from "../infrastructure/repositories/OutboxRepository.js";
import type { EventEnvelope } from "../domain/events/EventEnvelope.js";

/**
 * OutboxRelay — Background poller for the Outbox Pattern (CLO 4 Scenario 3).
 *
 * Reads PENDING rows from the EventOutbox table on a configurable interval
 * and republishes each envelope to the EventBus. On success the row is
 * marked PUBLISHED; on failure it is marked FAILED so a human (or a retry
 * pass) can investigate. This guarantees the dual-write problem cannot
 * lose events: the camera's only persistence step is the transactional
 * write to EventOutbox; bus delivery happens here, separately, with
 * retry-on-failure semantics.
 */
export interface OutboxRelayOptions {
  intervalMs?: number;     // poll frequency
  batchSize?: number;      // rows per tick
  maxAttempts?: number;    // give up after this many tries
}

export class OutboxRelay {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private inFlight = false;
  private readonly intervalMs: number;
  private readonly batchSize: number;
  private readonly maxAttempts: number;

  // Lightweight stats for the metrics endpoint / tests.
  public publishedCount = 0;
  public failedCount = 0;
  public lastTickAt: string | null = null;

  constructor(
    private readonly outboxRepo: PrismaOutboxRepository,
    private readonly bus: EventBus,
    opts: OutboxRelayOptions = {}
  ) {
    this.intervalMs  = opts.intervalMs  ?? 1000;
    this.batchSize   = opts.batchSize   ?? 50;
    this.maxAttempts = opts.maxAttempts ?? 5;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.timer = setInterval(() => { void this.tick(); }, this.intervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.running = false;
  }

  /** Process one batch of pending outbox rows. Public so tests can drive it. */
  async tick(): Promise<{ published: number; failed: number; skipped: number }> {
    if (this.inFlight) return { published: 0, failed: 0, skipped: 0 };
    this.inFlight = true;
    let published = 0;
    let failed = 0;
    let skipped = 0;

    try {
      const pending = await this.outboxRepo.findPending();
      const batch = pending.slice(0, this.batchSize);

      for (const row of batch) {
        if (row.attempt_count >= this.maxAttempts) {
          skipped++;
          continue;
        }

        let envelope: EventEnvelope;
        try {
          envelope = JSON.parse(row.envelope_json) as EventEnvelope;
        } catch (err) {
          await this.outboxRepo.markFailed(
            row.event_id,
            `Malformed envelopeJson: ${(err as Error).message}`
          );
          failed++;
          continue;
        }

        try {
          await this.bus.publish(envelope);
          await this.outboxRepo.markPublished(row.event_id);
          published++;
          this.publishedCount++;
        } catch (err) {
          await this.outboxRepo.recordFailure(
            row.event_id,
            err instanceof Error ? err.message : String(err),
            this.maxAttempts
          );
          failed++;
          this.failedCount++;
        }
      }

      this.lastTickAt = new Date().toISOString();
      return { published, failed, skipped };
    } finally {
      this.inFlight = false;
    }
  }

  isRunning(): boolean {
    return this.running;
  }
}
