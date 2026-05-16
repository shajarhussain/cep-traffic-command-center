import type { PrismaClient } from "@prisma/client";
import type { EventEnvelope } from "../../domain/events/EventEnvelope.js";

/**
 * EventRepository — Prisma implementation
 *
 * Stores every published EventEnvelope for audit and replay.
 * This is not directly required by any subscriber interface but supports
 * the Event Envelope Inspector UI and viva evidence.
 */
type PrismaTxClient = PrismaClient | { eventEnvelopeRecord: PrismaClient["eventEnvelopeRecord"] };

export class PrismaEventRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /** Persist an envelope. Optionally on a passed transaction client for atomic dual-writes. */
  async save(envelope: EventEnvelope, priority = "NORMAL", tx?: PrismaTxClient): Promise<void> {
    const client = tx ?? this.prisma;
    await client.eventEnvelopeRecord.create({
      data: {
        eventId: envelope.event_id,
        correlationId: envelope.correlation_id,
        schemaVersion: envelope.schema_version,
        sourceId: envelope.source_id,
        timestamp: new Date(envelope.timestamp),
        eventType: envelope.event_type,
        payloadJson: JSON.stringify(envelope.payload),
        priority,
      },
    });
  }

  async findAll(): Promise<EventEnvelope[]> {
    const records = await this.prisma.eventEnvelopeRecord.findMany({
      orderBy: { createdAt: "desc" },
    });

    return records.map((r) => ({
      event_id: r.eventId,
      correlation_id: r.correlationId,
      schema_version: r.schemaVersion,
      source_id: r.sourceId,
      timestamp: r.timestamp.toISOString(),
      event_type: r.eventType,
      payload: JSON.parse(r.payloadJson),
    }));
  }

  async findById(eventId: string): Promise<EventEnvelope | null> {
    const r = await this.prisma.eventEnvelopeRecord.findUnique({
      where: { eventId },
    });
    if (!r) return null;

    return {
      event_id: r.eventId,
      correlation_id: r.correlationId,
      schema_version: r.schemaVersion,
      source_id: r.sourceId,
      timestamp: r.timestamp.toISOString(),
      event_type: r.eventType,
      payload: JSON.parse(r.payloadJson),
    };
  }

  async count(): Promise<number> {
    return this.prisma.eventEnvelopeRecord.count();
  }
}
