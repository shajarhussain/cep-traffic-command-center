import type { PrismaClient } from "@prisma/client";
import type {
  PenaltyRecord,
  PenaltyRepository,
} from "../../domain/subscribers/AlertService.js";

/**
 * PrismaPenaltyRepository — Prisma implementation of PenaltyRepository
 *
 * The Penalty model has @unique on eventId, providing a second layer of
 * duplicate protection beyond ProcessedEvent. Even if the idempotent check
 * were somehow bypassed, the database would reject a duplicate penalty.
 */
export class PrismaPenaltyRepository implements PenaltyRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(penalty: PenaltyRecord): Promise<void> {
    await this.prisma.penalty.create({
      data: {
        id: penalty.id,
        eventId: penalty.event_id,
        cameraId: penalty.camera_id,
        vehiclePlate: penalty.vehicle_plate,
        speedKmh: penalty.speed_kmh,
        speedLimitKmh: penalty.speed_limit_kmh,
        fineAmount: penalty.fine_amount,
        status: penalty.status,
        issuedAt: new Date(penalty.issued_at),
      },
    });
  }

  async findByEventId(eventId: string): Promise<PenaltyRecord | null> {
    const r = await this.prisma.penalty.findUnique({
      where: { eventId },
    });
    if (!r) return null;

    return {
      id: r.id,
      event_id: r.eventId,
      camera_id: r.cameraId,
      vehicle_plate: r.vehiclePlate,
      speed_kmh: r.speedKmh,
      speed_limit_kmh: r.speedLimitKmh,
      fine_amount: r.fineAmount,
      status: r.status as PenaltyRecord["status"],
      issued_at: r.issuedAt.toISOString(),
    };
  }

  async findAll(): Promise<PenaltyRecord[]> {
    const records = await this.prisma.penalty.findMany({
      orderBy: { issuedAt: "desc" },
    });

    return records.map((r) => ({
      id: r.id,
      event_id: r.eventId,
      camera_id: r.cameraId,
      vehicle_plate: r.vehiclePlate,
      speed_kmh: r.speedKmh,
      speed_limit_kmh: r.speedLimitKmh,
      fine_amount: r.fineAmount,
      status: r.status as PenaltyRecord["status"],
      issued_at: r.issuedAt.toISOString(),
    }));
  }

  async count(): Promise<number> {
    return this.prisma.penalty.count();
  }
}
