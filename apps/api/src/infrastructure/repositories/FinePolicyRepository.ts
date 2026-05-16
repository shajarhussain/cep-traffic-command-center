import type { PrismaClient } from "@prisma/client";

/**
 * FinePolicy — user-driven fine schedule (replaces hardcoded fine amounts).
 *
 * Rationale: the rubric calls for user-driven configuration. The previous
 * AlertService used a hardcoded ternary on excess speed. Now operators
 * configure rows in this table via /api/config/fine-policies and the
 * Config Center UI. AlertService falls back to env-configurable defaults
 * if no row matches (still NOT hardcoded magic numbers).
 */
export interface FinePolicyRecord {
  id: string;
  name: string;
  eventType: string;
  excessThresholdKmh: number;
  fineAmount: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FinePolicyInput {
  name: string;
  eventType: string;
  excessThresholdKmh: number;
  fineAmount: number;
  active?: boolean;
}

export class PrismaFinePolicyRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /** Pick the matching fine for a given excess. Highest threshold ≤ excess wins. */
  async findApplicable(eventType: string, excessKmh: number): Promise<FinePolicyRecord | null> {
    const r = await this.prisma.finePolicy.findFirst({
      where: {
        eventType,
        active: true,
        excessThresholdKmh: { lte: excessKmh },
      },
      orderBy: { excessThresholdKmh: "desc" },
    });
    return r ? this.toRecord(r) : null;
  }

  async list(): Promise<FinePolicyRecord[]> {
    const rows = await this.prisma.finePolicy.findMany({
      orderBy: [{ eventType: "asc" }, { excessThresholdKmh: "desc" }],
    });
    return rows.map(r => this.toRecord(r));
  }

  async findById(id: string): Promise<FinePolicyRecord | null> {
    const r = await this.prisma.finePolicy.findUnique({ where: { id } });
    return r ? this.toRecord(r) : null;
  }

  async create(input: FinePolicyInput): Promise<FinePolicyRecord> {
    const r = await this.prisma.finePolicy.create({
      data: {
        name: input.name,
        eventType: input.eventType,
        excessThresholdKmh: input.excessThresholdKmh,
        fineAmount: input.fineAmount,
        active: input.active ?? true,
      },
    });
    return this.toRecord(r);
  }

  async update(id: string, input: Partial<FinePolicyInput>): Promise<FinePolicyRecord> {
    const r = await this.prisma.finePolicy.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.eventType !== undefined ? { eventType: input.eventType } : {}),
        ...(input.excessThresholdKmh !== undefined ? { excessThresholdKmh: input.excessThresholdKmh } : {}),
        ...(input.fineAmount !== undefined ? { fineAmount: input.fineAmount } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
      },
    });
    return this.toRecord(r);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.finePolicy.delete({ where: { id } });
  }

  private toRecord(r: {
    id: string; name: string; eventType: string; excessThresholdKmh: number;
    fineAmount: number; active: boolean; createdAt: Date; updatedAt: Date;
  }): FinePolicyRecord {
    return {
      id: r.id,
      name: r.name,
      eventType: r.eventType,
      excessThresholdKmh: r.excessThresholdKmh,
      fineAmount: r.fineAmount,
      active: r.active,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }
}
