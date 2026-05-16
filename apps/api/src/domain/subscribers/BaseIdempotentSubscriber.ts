import type { EventEnvelope } from "../events/EventEnvelope.js";
import type { IEventSubscriber } from "./IEventSubscriber.js";

/**
 * BaseIdempotentSubscriber — CEP Part A Task 4 (10 marks)
 *
 * Abstract base class implementing the Idempotent Receiver Pattern.
 * Each subscriber checks whether it has already processed an event_id.
 * If yes, it skips the event. If no, it processes it and records the ID.
 *
 * Duplicate detection is per-subscriber: AlertService and LoggingService
 * each track their own processed event IDs independently.
 *
 * Why this pattern matters (viva answer):
 *   A network glitch can deliver the same event twice. Without protection,
 *   AlertService might create two penalty notices for one speeding vehicle.
 *   The Idempotent Receiver prevents this by remembering processed event_ids.
 */

/**
 * Repository interface for tracking processed events.
 * Phase 3 uses an in-memory implementation for testing.
 * Phase 4 replaces it with a Prisma-backed implementation.
 */
export interface ProcessedEventRepository {
  /** Check if this subscriber already processed this event */
  exists(eventId: string, subscriberName: string): Promise<boolean>;

  /** Mark an event as processed by this subscriber */
  markProcessed(eventId: string, subscriberName: string): Promise<void>;
}

export abstract class BaseIdempotentSubscriber<TPayload = unknown>
  implements IEventSubscriber<TPayload>
{
  abstract readonly name: string;
  abstract readonly supportedEventTypes: string[];

  /** Count of duplicate events that were ignored (useful for UI display) */
  private _duplicateIgnoredCount = 0;
  /** Count of unique events processed by this subscriber. */
  private _processedCount = 0;

  constructor(protected readonly processedRepo: ProcessedEventRepository) {}

  /**
   * Template Method: checks idempotency before delegating to process().
   * If the event_id was already processed by this subscriber, it is silently skipped.
   */
  async handle(envelope: EventEnvelope<TPayload>): Promise<void> {
    const alreadyProcessed = await this.processedRepo.exists(
      envelope.event_id,
      this.name
    );

    if (alreadyProcessed) {
      this._duplicateIgnoredCount++;
      return;
    }

    await this.process(envelope);
    await this.processedRepo.markProcessed(envelope.event_id, this.name);
    this._processedCount++;
  }

  /** Subclasses implement their specific business logic here */
  protected abstract process(
    envelope: EventEnvelope<TPayload>
  ): Promise<void>;

  /** Number of duplicate events that were silently ignored */
  get duplicateIgnoredCount(): number {
    return this._duplicateIgnoredCount;
  }

  /** Number of unique events processed by this subscriber (post idempotency check) */
  get processedCount(): number {
    return this._processedCount;
  }
}
