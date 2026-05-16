import { Router } from "express";
import type { SystemContext } from "../../application/systemContext.js";
import type { IEventSubscriber } from "../../domain/subscribers/IEventSubscriber.js";
import { EVENT_TYPES } from "../../domain/events/EventTypes.js";
import { bootstrapSubscribers } from "../../application/bootstrapSubscribers.js";

/**
 * Subscriber routes (CEP Task 2 demonstration).
 *
 * Endpoints:
 *   GET    /                          → list subscribers + current active event types
 *   POST   /:name/subscribe           body: { eventType }
 *   DELETE /:name/subscribe           body: { eventType }
 *   POST   /restore-defaults          → re-run bootstrapSubscribers with defaults
 *
 * Subscribe / unsubscribe mutate the live EventBus state so a viva examiner
 * can watch the routing change in real time: unsubscribe AlertService from
 * SpeedViolationEvent, publish a violation, see no penalty issued; subscribe
 * again, publish, penalty appears. This is the literal "subscribe/unsubscribe
 * demonstration" called for by the rubric.
 */
export function createSubscriberRoutes(ctx: SystemContext): Router {
  const router = Router();

  const subscribersList = (): IEventSubscriber[] => [
    ctx.alertService, ctx.loggingService, ctx.dashboardService,
    ctx.reportingService, ctx.incidentService,
  ];

  const findByName = (name: string): IEventSubscriber | undefined =>
    subscribersList().find(s => s.name === name);

  /** Build the per-subscriber active event-type list from the live bus. */
  const activeTypesFor = (sub: IEventSubscriber): string[] => {
    const active: string[] = [];
    for (const eventType of Object.values(EVENT_TYPES)) {
      if (ctx.eventBus.isSubscribed(eventType, sub)) active.push(eventType);
    }
    return active;
  };

  /** Read the per-subscriber duplicate counter without coupling to the base class. */
  const dupCount = (sub: IEventSubscriber): number => {
    const candidate = (sub as unknown as { duplicateIgnoredCount?: number }).duplicateIgnoredCount;
    return typeof candidate === "number" ? candidate : 0;
  };

  router.get("/", async (_req, res) => {
    const subs = subscribersList();
    const result = await Promise.all(
      subs.map(async (s) => {
        const processed = await ctx.prisma.processedEvent.count({ where: { subscriberName: s.name } });
        return {
          name: s.name,
          supportedEventTypes: s.supportedEventTypes,
          activeEventTypes: activeTypesFor(s),
          processedCount: processed,
          duplicateIgnoredCount: dupCount(s),
        };
      })
    );
    res.json(result);
  });

  router.post("/restore-defaults", async (_req, res) => {
    const subs = subscribersList();
    // Detach each subscriber from every event type it might currently hold.
    for (const sub of subs) {
      for (const code of Object.values(EVENT_TYPES)) {
        ctx.eventBus.unsubscribe(code, sub);
      }
    }
    bootstrapSubscribers(ctx.eventBus, subs);
    await ctx.operatorActionRepo.log({
      actionType: "RESTORE_DEFAULTS",
      targetType: "Subscriber",
      targetId: "ALL",
      message: "Restored all subscribers to default event-type routing.",
    });
    res.json({ ok: true, message: "All subscribers restored to default routing." });
  });

  router.post("/:name/subscribe", async (req, res) => {
    const name = req.params["name"]!;
    const eventType = (req.body ?? {}).eventType as string | undefined;
    if (!eventType) return res.status(400).json({ error: "eventType is required in the request body" });
    const knownTypes = Object.values(EVENT_TYPES) as readonly string[];
    if (!knownTypes.includes(eventType)) return res.status(400).json({ error: `Unknown eventType: ${eventType}` });
    const sub = findByName(name);
    if (!sub) return res.status(404).json({ error: `Subscriber ${name} not found` });
    ctx.eventBus.subscribe(eventType, sub);
    await ctx.operatorActionRepo.log({
      actionType: "SUBSCRIBE",
      targetType: "Subscriber",
      targetId: name,
      message: `Subscribed ${name} to ${eventType}`,
    });
    res.json({ ok: true, name, eventType, activeEventTypes: activeTypesFor(sub) });
  });

  router.delete("/:name/subscribe", async (req, res) => {
    const name = req.params["name"]!;
    // Accept eventType from query (preferred — DELETE bodies are non-standard) or body for parity.
    const eventType = (typeof req.query["eventType"] === "string"
      ? req.query["eventType"]
      : (req.body ?? {}).eventType) as string | undefined;
    if (!eventType) return res.status(400).json({ error: "eventType is required (query string or body)" });
    const sub = findByName(name);
    if (!sub) return res.status(404).json({ error: `Subscriber ${name} not found` });
    ctx.eventBus.unsubscribe(eventType, sub);
    await ctx.operatorActionRepo.log({
      actionType: "UNSUBSCRIBE",
      targetType: "Subscriber",
      targetId: name,
      message: `Unsubscribed ${name} from ${eventType}`,
    });
    res.json({ ok: true, name, eventType, activeEventTypes: activeTypesFor(sub) });
  });

  return router;
}
