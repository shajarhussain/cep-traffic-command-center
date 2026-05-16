import { createApp } from "./app.js";
import { createSystemContext } from "./application/systemContext.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Load .env from repo root (Node 22+ built-in). Falls through silently if file is absent.
try {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, "../../..");
  process.loadEnvFile(path.join(repoRoot, ".env"));
} catch {
  // .env is optional — fallback modes activate when keys are missing.
}

const PORT = parseInt(process.env["PORT"] ?? "4000", 10);

const ctx = createSystemContext();
const app = createApp(ctx);

const server = app.listen(PORT, () => {
  console.log(`[traffic-alert-cep] API server running on http://localhost:${PORT}`);
  ctx.startBackgroundWorkers();
  console.log(`[traffic-alert-cep] Outbox relay started (polling for PENDING events)`);
});

function shutdown(signal: string) {
  console.log(`[traffic-alert-cep] received ${signal}, stopping background workers`);
  ctx.stopBackgroundWorkers();
  server.close(() => process.exit(0));
}

process.on("SIGINT",  () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
