/**
 * Automated screenshot capture for V2 Traffic Operations Command Center.
 * Usage: node take_screenshots.js
 * Requires: puppeteer
 */
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const PAGES = [
  { hash: "#/overview/home",          name: "01-command-center.png" },
  { hash: "#/incidents/open",         name: "02-incident-operations.png" },
  { 
    hash: "#/cameras/simulator",     
    name: "03-alert-simulator.png",
    action: async (page) => {
      await page.waitForSelector('#sim-template-select', { timeout: 5000 });
      // The option value is the template ID. 
      // SpeedViolationEvent is one of the active templates. 
      // But wait! Is the value 'SpeedViolationEvent' or a UUID?
      // "const tpl = templates.find(t => t.id === id);" => The value is t.id.
      // So selecting by 'SpeedViolationEvent' will fail because the value is a UUID.
      // We can just set the payload manually if we can't select the template.
      // Or we can evaluate in browser to find the option with text 'SpeedViolationEvent'.
      await page.evaluate(() => {
        const select = document.querySelector('#sim-template-select');
        const option = Array.from(select.options).find(o => o.text.includes('Speed Violation'));
        if (option) {
          select.value = option.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
      await new Promise(r => setTimeout(r, 500));
      await page.click('#sim-publish-btn');
      await new Promise(r => setTimeout(r, 2000));
    }
  },
  { hash: "#/system/idempotency",     name: "04-duplicate-alert-safety.png" },
  { hash: "#/incidents/stream",       name: "05-live-alert-stream.png" },
  { hash: "#/enforcement/penalties",  name: "06-enforcement.png" },
  { hash: "#/cameras/intersections",  name: "07-intersection-intelligence.png" },
  { hash: "#/analytics/reports",      name: "08-traffic-analytics.png" },
  { hash: "#/enforcement/audit",      name: "09-audit-trail.png" },
  { hash: "#/system/capacity",        name: "10-capacity-monitor.png" },
  { hash: "#/system/reliability",     name: "11-system-reliability.png" },
  { hash: "#/system/config",          name: "12-configuration-center.png" },
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

  for (const item of PAGES) {
    try {
      await page.goto(`http://localhost:5173/${item.hash}`, { waitUntil: "networkidle2" });
      await new Promise(r => setTimeout(r, 1000));
      
      if (item.action) {
        await item.action(page);
      }
      
      await page.screenshot({ path: path.join(outDir, item.name), fullPage: false });
      console.log(`  ✓ ${item.name}`);
    } catch (e) {
      console.error(`  ✗ ${item.name}: ${e.message}`);
    }
  }

  await browser.close();
  console.log(`\nDone. ${PAGES.length} screenshots saved to ${outDir}`);
})();
