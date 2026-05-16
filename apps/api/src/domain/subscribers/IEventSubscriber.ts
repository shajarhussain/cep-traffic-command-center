import type { EventEnvelope } from "../events/EventEnvelope.js";

/**
 * IEventSubscriber — CEP Part A Task 2 (5 marks) — Observer Pattern
 *
 * Every subscriber must implement this common interface.
 * The EventBus stores a list of IEventSubscriber references,
 * never a reference to the concrete class (AlertService, LoggingService, etc.).
 *
 * This is the Observer Pattern: the bus is the subject/publisher,
 * and services are the observers/subscribers. The bus depends on this
 * interface, not on specific subscriber implementations.
 */
export interface IEventSubscriber<TPayload = unknown> {
  /** Human-readable name for this subscriber (e.g. "AlertService") */
  readonly name: string;

  /** Which event types this subscriber is interested in */
  readonly supportedEventTypes: string[];

  /** Process an incoming event envelope */
  handle(envelope: EventEnvelope<TPayload>): Promise<void>;
}
