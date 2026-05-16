import type { PrismaClient } from "@prisma/client";
import type { EventEnvelope } from "../../domain/events/EventEnvelope.js";

/**
 * Outbox record shape for CLO 4 Scenario 3.
 */
export interface OutboxRecord {
  id: string;
  event_id: string;
  envelope_json: string;
  status: "PENDING" | "PUBLISHED" | "FAILED";
  attempt_count: number;
  last_error: string | null;
  created_at: string;
  published_at: string | null;
}

/**
 * PrismaOutboxRepository — Outbox Pattern (CLO 4 Scenario 3).
 *
 * Cameras transactionally enqueue events here as part of PublishEventUseCase;
 * OutboxRelay polls this table on a background timer and republishes each
 * row to the EventBus. Successful relay → PUBLISHED. Failed relay below the
 * retry cap → still PENDING with an incremented attemptCount + lastError.
 * Failed relay at or above the cap → FAILED (terminal; visible in the UI).
 */
export class PrismaOutboxRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /** Transactionally write an event to the outbox. Optionally on a transaction client. */
  async enqueue(envelope: EventEnvelope, tx?: PrismaClient | { eventOutbox: PrismaClient["eventOutbox"] }): Promise<void> {
    const client = tx ?? this.prisma;
    await client.eventOutbox.create({
      data: {
        eventId: envelope.event_id,
        envelopeJson: JSON.stringify(envelope),
        status: "PENDING",
        attemptCount: 0,
      },
    });
  }

  /** Mark an outbox entry as PUBLISHED (success path). */
  async markPublished(eventId: string): Promise<void> {
    await this.prisma.eventOutbox.update({
      where: { eventId },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    });
  }

  /**
   * Record a failed publish attempt. Stays PENDING (eligible for retry) until
   * attemptCount reaches maxAttempts, then flips to FAILED.
   */
  async recordFailure(eventId: string, error: string, maxAttempts: number): Promise<void> {
    const existing = await this.prisma.eventOutbox.findUnique({ where: { eventId } });
    if (!existing) return;
    const nextAttempts = existing.attemptCount + 1;
    await this.prisma.eventOutbox.update({
      where: { eventId },
      data: {
        attemptCount: nextAttempts,
        lastError: error,
        status: nextAttempts >= maxAttempts ? "FAILED" : "PENDING",
      },
    });
  }

  /** Force a terminal FAILED status (used for malformed JSON or admin actions). */
  async markFailed(eventId: string, error: string): Promise<void> {
    const existing = await this.prisma.eventOutbox.findUnique({ where: { eventId } });
    if (!existing) return;
    await this.prisma.eventOutbox.update({
      where: { eventId },
      data: {
        status: "FAILED",
        attemptCount: existing.attemptCount + 1,
        lastError: error,
      },
    });
  }

  /** Reset a row to PENDING — used by the "Replay" admin action on FAILED rows. */
  async resetToPending(eventId: string): Promise<void> {
    await this.prisma.eventOutbox.update({
      where: { eventId },
      data: { status: "PENDING", lastError: null },
    });
  }

  async findById(id: string): Promise<OutboxRecord | null> {
    const r = await this.prisma.eventOutbox.findUnique({ where: { id } });
    if (!r) return null;
    return {
      id: r.id,
      event_id: r.eventId,
      envelope_json: r.envelopeJson,
      status: r.status as OutboxRecord["status"],
      attempt_count: r.attemptCount,
      last_error: r.lastError,
      created_at: r.createdAt.toISOString(),
      published_at: r.publishedAt?.toISOString() ?? null,
    };
  }

  async countByStatus(status: OutboxRecord["status"]): Promise<number> {
    return this.prisma.eventOutbox.count({ where: { status } });
  }

  /** Get all pending outbox entries (for a background publisher) */
  async findPending(): Promise<OutboxRecord[]> {
    const records = await this.prisma.eventOutbox.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
    });

    return records.map((r) => ({
      id: r.id,
      event_id: r.eventId,
      envelope_json: r.envelopeJson,
      status: r.status as OutboxRecord["status"],
      attempt_count: r.attemptCount,
      last_error: r.lastError,
      created_at: r.createdAt.toISOString(),
      published_at: r.publishedAt?.toISOString() ?? null,
    }));
  }

  async findAll(): Promise<OutboxRecord[]> {
    const records = await this.prisma.eventOutbox.findMany({
      orderBy: { createdAt: "desc" },
    });

    return records.map((r) => ({
      id: r.id,
      event_id: r.eventId,
      envelope_json: r.envelopeJson,
      status: r.status as OutboxRecord["status"],
      attempt_count: r.attemptCount,
      last_error: r.lastError,
      created_at: r.createdAt.toISOString(),
      published_at: r.publishedAt?.toISOString() ?? null,
    }));
  }
}
