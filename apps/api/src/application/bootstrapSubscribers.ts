import type { EventBus } from "../domain/bus/EventBus.js";
import type { IEventSubscriber } from "../domain/subscribers/IEventSubscriber.js";

/**
 * bootstrapSubscribers — Wires all subscribers to the EventBus
 *
 * This function registers each subscriber for its supported event types.
 * It is the single place where the subscriber-to-event-type mapping is configured.
 *
 * Subscriber → Event Type mapping (from CEP PDF):
 *   VehicleDetectedEvent  → DashboardService, ReportingService
 *   SpeedViolationEvent   → AlertService, LoggingService, ReportingService
 *   CongestionAlertEvent  → DashboardService, LoggingService
 *   TrafficClearedEvent   → DashboardService
 */
export function bootstrapSubscribers(
  bus: EventBus,
  subscribers: IEventSubscriber[]
): void {
  for (const subscriber of subscribers) {
    for (const eventType of subscriber.supportedEventTypes) {
      bus.subscribe(eventType, subscriber);
    }
  }
}
