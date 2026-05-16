import type { EventEnvelope } from "../events/EventEnvelope.js";

/**
 * BoundedEventQueue — CEP Part A Task 5 / CLO 4 Scenario 2
 *
 * A fixed-capacity FIFO queue that holds EventEnvelopes for a slow subscriber
 * (e.g. DashboardService at 80 events/sec when incoming rate is 500/sec).
 *
 * DESIGN RATIONALE (viva-ready):
 * ─────────────────────────────────────────────────────────────────────────────
 * When the queue is full, we must evict one event before accepting the next.
 * Two strategies exist:
 *   1. Drop oldest  — simple, but may discard a critical congestion alert.
 *   2. Drop least important — safer for traffic enforcement.
 *
 * We choose priority-aware eviction:
 *   - Priority is NOT stored in the EventEnvelope (no 8th field).
 *   - Priority is derived from event_type via EVENT_PRIORITY map (separation
 *     of concerns: the envelope stays a pure data carrier).
 *   - If two events share the same priority, we drop the oldest among them.
 *
 * PRIORITY MAP:
 *   CongestionAlertEvent  → 4  (CRITICAL — drop last)
 *   SpeedViolationEvent   → 3  (HIGH)
 *   TrafficClearedEvent   → 2  (MEDIUM)
 *   VehicleDetectedEvent  → 1  (LOW  — drop first)
 *   (unknown)             → 0  (LOWEST)
 *
 * CAPACITY CALCULATION (CLO 4 Scenario 2):
 *   Incoming rate        = 500 events/sec
 *   Processing rate      = 80  events/sec  (DashboardService)
 *   Backlog growth       = 420 events/sec
 *   Queue limit          = 10,000
 *   Seconds until full   = 10,000 / 420 ≈ 23.81 seconds
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── Priority ─────────────────────────────────────────────────────────────────

export const EVENT_PRIORITY: Readonly<Record<string, number>> = {
  CongestionAlertEvent:  4, // CRITICAL — preserve at all costs
  SpeedViolationEvent:   3, // HIGH
  TrafficClearedEvent:   2, // MEDIUM
  VehicleDetectedEvent:  1, // LOW — routine; evict first
};

/** Returns the numeric priority for an event type. Unknown types get 0. */
export function getEventPriority(eventType: string): number {
  return EVENT_PRIORITY[eventType] ?? 0;
}

// ─── Queue Item ────────────────────────────────────────────────────────────────

/** Internal queue entry that adds a monotonic sequence number for age-based tie-breaking. */
export interface QueueItem {
  readonly envelope:  EventEnvelope;
  readonly priority:  number;
  readonly sequence:  number; // monotonically increasing; lower = older
}

// ─── Capacity Analysis ─────────────────────────────────────────────────────────

export interface QueueCapacityAnalysis {
  /** Events arriving per second (Scenario 2: 500) */
  incomingRate: number;
  /** Events processed per second by the slow subscriber (Scenario 2: 80) */
  processingRate: number;
  /** Net growth rate = incomingRate − processingRate */
  backlogGrowthPerSecond: number;
  /** Maximum queue depth before eviction kicks in */
  queueLimit: number;
  /**
   * How many seconds until the queue reaches queueLimit.
   * Formula: queueLimit / backlogGrowthPerSecond
   * For 500 in, 80 out, 10 000 limit → 10000 / 420 ≈ 23.81 seconds
   */
  secondsUntilFull: number;
  /** Human-readable description of the eviction strategy */
  evictionPolicy: string;
}

/**
 * Calculate how long before the bounded queue fills up.
 *
 * @param incomingRate    events arriving per second
 * @param processingRate  events consumed per second
 * @param queueLimit      maximum queue capacity
 * @returns               seconds until the queue reaches queueLimit
 */
export function calculateSecondsUntilFull(
  incomingRate: number,
  processingRate: number,
  queueLimit: number
): number {
  const backlog = incomingRate - processingRate;
  if (backlog <= 0) return Infinity; // consumer keeps up — queue never fills
  return queueLimit / backlog;
}

// ─── BoundedEventQueue ────────────────────────────────────────────────────────

export class BoundedEventQueue {
  private readonly items: QueueItem[] = [];
  private sequenceCounter = 0;

  /**
   * @param maxSize Maximum number of events the queue will hold.
   *                Must be a positive integer.
   */
  constructor(readonly maxSize: number) {
    if (!Number.isInteger(maxSize) || maxSize < 1) {
      throw new Error(`BoundedEventQueue: maxSize must be a positive integer, got ${maxSize}`);
    }
  }

  // ─── Public API ─────────────────────────────────────────────────

  /** Current number of items in the queue. */
  get size(): number {
    return this.items.length;
  }

  /** True when the queue has reached its maximum capacity. */
  get isFull(): boolean {
    return this.items.length >= this.maxSize;
  }

  /**
   * Enqueue an event envelope.
   *
   * If the queue is not full: add the event immediately.
   * If the queue is full:    evict the lowest-priority event (oldest wins
   *                          the tiebreak) and then add the new event — UNLESS
   *                          the incoming event has lower priority than all
   *                          existing events, in which case it is discarded.
   *
   * @returns true if the event was accepted, false if it was discarded.
   */
  enqueue(envelope: EventEnvelope): boolean {
    const incoming = this.makeItem(envelope);

    if (!this.isFull) {
      this.items.push(incoming);
      return true;
    }

    // Find the item with the lowest priority; break ties by oldest (lowest sequence)
    const evictIdx = this.findEvictionCandidate();
    const evictCandidate = this.items[evictIdx]!;

    // Incoming is strictly less important than the weakest item → discard incoming
    if (incoming.priority < evictCandidate.priority) {
      return false;
    }

    // Same priority: evict the oldest (lower sequence = older) and accept the newer incoming.
    // If for some reason incoming IS the oldest (sequence wrapped), still evict the candidate.
    // Evict the candidate and insert the incoming event.
    this.items.splice(evictIdx, 1);
    this.items.push(incoming);
    return true;
  }

  /**
   * Dequeue (consume) the next event — FIFO order based on sequence number.
   * Returns undefined if the queue is empty.
   */
  dequeue(): EventEnvelope | undefined {
    if (this.items.length === 0) return undefined;
    // Return oldest item (lowest sequence)
    const oldestIdx = this.items.reduce(
      (minIdx, item, idx) =>
        item.sequence < this.items[minIdx]!.sequence ? idx : minIdx,
      0
    );
    const [removed] = this.items.splice(oldestIdx, 1);
    return removed!.envelope;
  }

  /**
   * Peek at the next event without removing it.
   * Returns undefined if the queue is empty.
   */
  peek(): EventEnvelope | undefined {
    if (this.items.length === 0) return undefined;
    const oldestIdx = this.items.reduce(
      (minIdx, item, idx) =>
        item.sequence < this.items[minIdx]!.sequence ? idx : minIdx,
      0
    );
    return this.items[oldestIdx]!.envelope;
  }

  /** Drain all items and return them ordered oldest-first. */
  drain(): EventEnvelope[] {
    const sorted = [...this.items].sort((a, b) => a.sequence - b.sequence);
    this.items.length = 0;
    return sorted.map((i) => i.envelope);
  }

  /** Remove all items from the queue. */
  clear(): void {
    this.items.length = 0;
  }

  /**
   * Return a snapshot of the current queue items sorted by priority (high→low)
   * and then by age (oldest first within the same priority).
   * Useful for the analysis API endpoint.
   */
  snapshot(): readonly QueueItem[] {
    return [...this.items].sort((a, b) =>
      b.priority !== a.priority ? b.priority - a.priority : a.sequence - b.sequence
    );
  }

  /**
   * Produce a capacity analysis report for this queue instance.
   * Uses the CLO 4 Scenario 2 rates by default.
   */
  analyzeCapacity(
    incomingRate = 500,
    processingRate = 80
  ): QueueCapacityAnalysis {
    const backlog = Math.max(0, incomingRate - processingRate);
    const secondsUntilFull = calculateSecondsUntilFull(
      incomingRate,
      processingRate,
      this.maxSize
    );
    return {
      incomingRate,
      processingRate,
      backlogGrowthPerSecond: backlog,
      queueLimit: this.maxSize,
      secondsUntilFull: Math.round(secondsUntilFull * 100) / 100,
      evictionPolicy:
        "Drop least important first; if same priority, drop oldest",
    };
  }

  // ─── Private Helpers ─────────────────────────────────────────────

  private makeItem(envelope: EventEnvelope): QueueItem {
    return {
      envelope,
      priority: getEventPriority(envelope.event_type),
      sequence: this.sequenceCounter++,
    };
  }

  /**
   * Find the index of the item that should be evicted:
   *   1. Lowest priority.
   *   2. Tiebreak: oldest (lowest sequence).
   */
  private findEvictionCandidate(): number {
    let candidateIdx = 0;
    for (let i = 1; i < this.items.length; i++) {
      const candidate = this.items[candidateIdx]!;
      const current   = this.items[i]!;
      if (
        current.priority < candidate.priority ||
        (current.priority === candidate.priority &&
          current.sequence < candidate.sequence)
      ) {
        candidateIdx = i;
      }
    }
    return candidateIdx;
  }
}
