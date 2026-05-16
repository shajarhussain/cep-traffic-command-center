import type { EventEnvelope } from "../events/EventEnvelope.js";
import type { IEventSubscriber } from "../subscribers/IEventSubscriber.js";

/**
 * EventBus — CEP Part A Task 1 (10 marks)
 *
 * Sits between cameras and services. Cameras call bus.publish(envelope),
 * services call bus.subscribe(). The bus delivers the event to every
 * subscriber registered for that event type.
 *
 * Key design decisions (all defensible in viva):
 *   - Stores IEventSubscriber interface references, not concrete classes.
 *   - Uses a Map<string, Set<IEventSubscriber>> for O(1) lookup by event type.
 *   - publish() is async so subscribers can do async work (e.g. DB writes).
 *   - The bus does NOT know about AlertService, LoggingService, etc. directly.
 *   - Adding a 5th event type requires zero changes to this class.
 */
export class EventBus {
  /** Subscribers grouped by event type. The bus only holds interface references. */
  private subscribers = new Map<string, Set<IEventSubscriber>>();

  /**
   * Register a subscriber to receive events of a specific type.
   * The same subscriber can be registered for multiple event types.
   */
  subscribe(eventType: string, subscriber: IEventSubscriber): void {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set());
    }
    this.subscribers.get(eventType)!.add(subscriber);
  }

  /**
   * Remove a subscriber from a specific event type.
   * After unsubscribe, the subscriber will no longer receive events of this type.
   */
  unsubscribe(eventType: string, subscriber: IEventSubscriber): void {
    this.subscribers.get(eventType)?.delete(subscriber);
  }

  /**
   * Publish an event envelope to all subscribers registered for the event's type.
   * Cameras call this method — they do not know which services will receive the event.
   */
  async publish(envelope: EventEnvelope): Promise<void> {
    const targets = this.subscribers.get(envelope.event_type);
    if (!targets) return;

    for (const subscriber of targets) {
      await subscriber.handle(envelope);
    }
  }

  /**
   * Get the count of subscribers for a specific event type.
   * Useful for debugging and the subscriber monitor UI.
   */
  getSubscriberCount(eventType: string): number {
    return this.subscribers.get(eventType)?.size ?? 0;
  }

  /**
   * Get all registered event types that have at least one subscriber.
   */
  getRegisteredEventTypes(): string[] {
    return Array.from(this.subscribers.keys()).filter(
      (eventType) => (this.subscribers.get(eventType)?.size ?? 0) > 0
    );
  }

  /**
   * Is this subscriber currently registered for this event type?
   * Used by the Subscribers Monitor UI to render per-subscriber chips.
   */
  isSubscribed(eventType: string, subscriber: IEventSubscriber): boolean {
    return this.subscribers.get(eventType)?.has(subscriber) ?? false;
  }
}
