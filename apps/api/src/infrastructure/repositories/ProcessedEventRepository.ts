import type { PrismaClient } from "@prisma/client";
import type { ProcessedEventRepository } from "../../domain/subscribers/BaseIdempotentSubscriber.js";

/**
 * PrismaProcessedEventRepository — Prisma implementation of ProcessedEventRepository
 *
 * Implements the interface required by BaseIdempotentSubscriber.
 * Uses the @@unique([eventId, subscriberName]) constraint to ensure:
 *   - Same event CAN be processed by different subscribers
 *   - Same subscriber CANNOT process the same event twice
 *
 * This is the database backbone of the Idempotent Receiver Pattern (Task 4).
 */
export class PrismaProcessedEventRepository implements ProcessedEventRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async exists(eventId: string, subscriberName: string): Promise<boolean> {
    const record = await this.prisma.processedEvent.findUnique({
      where: {
        eventId_subscriberName: {
          eventId,
          subscriberName,
        },
      },
    });
    return record !== null;
  }

  async markProcessed(eventId: string, subscriberName: string): Promise<void> {
    await this.prisma.processedEvent.create({
      data: {
        eventId,
        subscriberName,
      },
    });
  }
}
