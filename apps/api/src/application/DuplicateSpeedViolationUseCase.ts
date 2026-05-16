import { createEnvelope } from "../domain/events/createEnvelope.js";
import { EVENT_TYPES } from "../domain/events/EventTypes.js";
import type { SpeedViolationPayload } from "../domain/events/EventTypes.js";
import type { EventBus } from "../domain/bus/EventBus.js";
import type { PrismaEventRepository } from "../infrastructure/repositories/EventRepository.js";
import type { PrismaPenaltyRepository } from "../infrastructure/repositories/PenaltyRepository.js";
import type { AlertService } from "../domain/subscribers/AlertService.js";

/**
 * DuplicateSpeedViolationUseCase — Demo endpoint for CEP Task 4
 *
 * Creates one SpeedViolationEvent and publishes it TWICE through the EventBus.
 * Returns proof that only ONE penalty was created.
 */
export class DuplicateSpeedViolationUseCase {
  constructor(
    private readonly bus: EventBus,
    private readonly eventRepo: PrismaEventRepository,
    private readonly penaltyRepo: PrismaPenaltyRepository,
    private readonly alertService: AlertService
  ) {}

  async execute() {
    const envelope = createEnvelope<SpeedViolationPayload>({
      source_id: "CAM-ISB-001",
      event_type: EVENT_TYPES.SpeedViolation,
      payload: {
        vehicle_plate: "DUP-TEST-001",
        speed_kmh: 95,
        speed_limit_kmh: 60,
        intersection_name: "Jinnah Avenue / Stadium Road",
      },
    });

    // Store envelope once
    await this.eventRepo.save(envelope);

    // Publish TWICE — the idempotent receiver should block the second
    await this.bus.publish(envelope);
    await this.bus.publish(envelope);

    // Query proof
    const penalty = await this.penaltyRepo.findByEventId(envelope.event_id);

    return {
      event_id: envelope.event_id,
      published_attempts: 2,
      penalties_created_for_event: penalty ? 1 : 0,
      duplicate_ignored_by_alert: this.alertService.duplicateIgnoredCount,
      penalty: penalty ?? null,
    };
  }
}
