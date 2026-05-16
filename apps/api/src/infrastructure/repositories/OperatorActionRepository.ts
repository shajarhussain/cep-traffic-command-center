import type { PrismaClient } from "@prisma/client";

/**
 * OperatorActionRepository — audits operator actions that mutate live state.
 *
 * The Prisma model `OperatorActionLog` was previously orphaned. This repo wires
 * it in: every high-signal write (subscribe/unsubscribe a service, edit a fine
 * policy, ack/close an incident, toggle the external provider) leaves a row
 * here. The Audit Trail page renders the rows in a third sub-tab so an
 * examiner can trace every operator action back to its actor and timestamp.
 */
export interface OperatorActionRecord {
  id: string;
  actionType: string;     // e.g. "SUBSCRIBE" / "UNSUBSCRIBE" / "TOGGLE_PROVIDER"
  targetType: string;     // e.g. "Subscriber" / "FinePolicy" / "Incident"
  targetId: string;       // entity id, name, or composite
  message: string;
  createdAt: string;
}

export interface LogInput {
  actionType: string;
  targetType: string;
  targetId: string;
  message: string;
}

export class PrismaOperatorActionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Persist an operator action. Best-effort — errors are swallowed and logged
   * so an audit-write failure cannot break the main route's response.
   */
  async log(input: LogInput): Promise<void> {
    try {
      await this.prisma.operatorActionLog.create({ data: input });
    } catch (err) {
      console.error("[operator-action] failed to write audit row", err);
    }
  }

  async list(limit = 200): Promise<OperatorActionRecord[]> {
    const rows = await this.prisma.operatorActionLog.findMany({
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(1, limit), 1000),
    });
    return rows.map(r => ({
      id: r.id,
      actionType: r.actionType,
      targetType: r.targetType,
      targetId: r.targetId,
      message: r.message,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async count(): Promise<number> {
    return this.prisma.operatorActionLog.count();
  }
}
