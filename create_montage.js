import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const screenshotDir = path.join(__dirname, 'docs/evidence/screenshots');
const artifactsDir = path.join(__dirname, 'artifacts');
if (!fs.existsSync(artifactsDir)) {
  fs.mkdirSync(artifactsDir, { recursive: true });
}

const images = [
  { file: '01-command-center.png', title: 'Command Center' },
  { file: '02-alert-simulator.png', title: 'Alert Simulator' },
  { file: '03-duplicate-alert-safety.png', title: 'Duplicate Alert Safety' },
  { file: '04-live-alert-stream-metadata.png', title: 'Live Alert Stream' },
  { file: '05-service-processing-monitor.png', title: 'Processing Services' },
  { file: '06-enforcement.png', title: 'Enforcement' },
  { file: '07-audit-trail.png', title: 'Audit Trail' },
  { file: '08-traffic-reports.png', title: 'Traffic Reports' },
  { file: '09-intersection-status.png', title: 'Intersection Status' },
  { file: '10-system-health.png', title: 'System Health' },
  { file: '11-capacity-monitor.png', title: 'Capacity Monitor' }
];

const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { background: #0f172a; color: white; font-family: sans-serif; margin: 0; padding: 40px; }
    h1 { text-align: center; margin-bottom: 40px; color: #38bdf8; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 40px; }
    .item { background: #1e293b; padding: 20px; border-radius: 12px; border: 1px solid #334155; }
    .item h2 { margin-top: 0; font-size: 18px; color: #cbd5e1; text-align: center; }
    .item img { width: 100%; border-radius: 6px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); }
  </style>
</head>
<body>
  <h1>Phase 10 UI Review Montage</h1>
  <div class="grid">
    ${images.map(img => `
      <div class="item">
        <h2>${img.title}</h2>
        <img src="file:///${path.join(screenshotDir, img.file).replace(/\\/g, '/')}" />
      </div>
    `).join('')}
  </div>
</body>
</html>
`;

const htmlFile = path.join(__dirname, 'montage_temp.html');
fs.writeFileSync(htmlFile, htmlContent);

async function run() {
  const browser = await puppeteer.launch({ defaultViewport: { width: 1920, height: 1080 } });
  const page = await browser.newPage();
  
  await page.goto('file:///' + htmlFile.replace(/\\/g, '/'), { waitUntil: 'networkidle0' });
  
  await page.screenshot({ 
    path: path.join(artifactsDir, 'phase10-ui-review-montage.png'),
    fullPage: true 
  });
  
  await browser.close();
  fs.unlinkSync(htmlFile);
  console.log('Montage created at artifacts/phase10-ui-review-montage.png');
}

run().catch(console.error);
