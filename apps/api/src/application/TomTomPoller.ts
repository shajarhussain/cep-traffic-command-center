import type { PrismaClient } from "@prisma/client";
import { fetchTomTomCorroboration } from "../infrastructure/tomtom.js";

/**
 * TomTomPoller — periodic external-context refresh.
 *
 * Every `intervalMs` (default 5 min) the poller fetches flow + incidents from
 * TomTom for the active zone and persists the resulting snapshots. This means
 * the Command Center's "Recent Snapshots" mini-list grows without a user
 * opening it, and the risk calculator's TomTom signal is fresh even between
 * page views.
 *
 * The actual fetch + persistence is in `fetchTomTomCorroboration()` — this
 * class is purely a timer + on/off switch + light stats.
 */
export interface TomTomPollerOptions {
  intervalMs?: number;
}

export class TomTomPoller {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private inFlight = false;
  private readonly intervalMs: number;

  // Stats for /api/metrics-style surfaces.
  public successCount = 0;
  public skipCount = 0;
  public failureCount = 0;
  public lastTickAt: string | null = null;
  public lastSummary: string | null = null;

  constructor(
    private readonly prisma: PrismaClient,
    opts: TomTomPollerOptions = {}
  ) {
    this.intervalMs = opts.intervalMs ?? 5 * 60 * 1000;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.timer = setInterval(() => { void this.tick(); }, this.intervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.running = false;
  }

  isRunning(): boolean { return this.running; }

  /**
   * One poll cycle. Public so tests can drive it deterministically.
   * Skips silently when the provider is disabled or no key is set.
   */
  async tick(): Promise<{ skipped: boolean; success: boolean; summary: string | null }> {
    if (this.inFlight) return { skipped: true, success: false, summary: "tick already in flight" };
    this.inFlight = true;
    try {
      const config = await this.prisma.externalProviderConfig.findFirst();
      if (!config?.enabled || !process.env["TOMTOM_API_KEY"]) {
        this.skipCount++;
        this.lastTickAt = new Date().toISOString();
        this.lastSummary = "TomTom poll skipped (provider disabled or key missing)";
        return { skipped: true, success: false, summary: this.lastSummary };
      }

      const corr = await fetchTomTomCorroboration(this.prisma);
      this.lastTickAt = new Date().toISOString();
      this.lastSummary = corr.summary;
      if (corr.available) {
        this.successCount++;
        return { skipped: false, success: true, summary: corr.summary };
      }
      this.failureCount++;
      return { skipped: false, success: false, summary: corr.summary };
    } finally {
      this.inFlight = false;
    }
  }
}
