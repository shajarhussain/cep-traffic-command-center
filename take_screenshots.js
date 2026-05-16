/**
 * Automated screenshot capture for V2 Traffic Operations Command Center.
 * Usage: node take_screenshots.js
 * Requires: puppeteer
 */
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const PAGES = [
  { nav: "nav-command",       name: "01-command-center.png" },
  { nav: "nav-incidents",     name: "02-incident-operations.png" },
  { nav: "nav-simulator",     name: "03-alert-simulator.png" },
  { nav: "nav-idempotency",   name: "04-duplicate-alert-safety.png" },
  { nav: "nav-alerts",        name: "05-live-alert-stream.png" },
  { nav: "nav-enforcement",   name: "06-enforcement.png" },
  { nav: "nav-intersections", name: "07-intersection-intelligence.png" },
  { nav: "nav-analytics",     name: "08-traffic-analytics.png" },
  { nav: "nav-audit",         name: "09-audit-trail.png" },
  { nav: "nav-capacity",      name: "10-capacity-monitor.png" },
  { nav: "nav-reliability",   name: "11-system-reliability.png" },
  { nav: "nav-config",        name: "12-configuration-center.png" },
];

(async () => {
  const outDir = path.join(__dirname, "docs", "evidence", "screenshots");
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto("http://localhost:5173", { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 3000));

  for (const { nav, name } of PAGES) {
    try {
      await page.click(`#${nav}`);
      await new Promise(r => setTimeout(r, 2000));
      await page.screenshot({ path: path.join(outDir, name), fullPage: false });
      console.log(`  ✓ ${name}`);
    } catch (e) {
      console.error(`  ✗ ${name}: ${e.message}`);
    }
  }

  await browser.close();
  console.log(`\nDone. ${PAGES.length} screenshots saved to ${outDir}`);
})();
