import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("[seed] Seeding V2 configuration layer...");

  // ─── Operation Zone ──────────────────────────────────────────
  const zone = await prisma.operationZone.upsert({
    where: { id: "zone-isb-01" },
    update: {},
    create: {
      id: "zone-isb-01",
      name: "Islamabad Traffic Zone",
      city: "Islamabad",
      country: "Pakistan",
      centerLatitude: 33.6844,
      centerLongitude: 73.0479,
      bboxMinLatitude: 33.60,
      bboxMinLongitude: 72.95,
      bboxMaxLatitude: 33.78,
      bboxMaxLongitude: 73.15,
      externalProviderEnabled: false,
    },
  });
  console.log(`  ✓ Zone: ${zone.name}`);

  // ─── Intersections ───────────────────────────────────────────
  const intersections = [
    { id: "int-001", name: "Jinnah Avenue / Stadium Road", roadName: "Jinnah Avenue", latitude: 33.7215, longitude: 73.0433, defaultSpeedLimit: 60, congestionThreshold: 20 },
    { id: "int-002", name: "Blue Area / Faisal Avenue", roadName: "Faisal Avenue", latitude: 33.7100, longitude: 73.0551, defaultSpeedLimit: 50, congestionThreshold: 15 },
    { id: "int-003", name: "F-8 Markaz / Nazimuddin Road", roadName: "Nazimuddin Road", latitude: 33.7050, longitude: 73.0400, defaultSpeedLimit: 40, congestionThreshold: 25 },
  ];
  for (const inter of intersections) {
    await prisma.intersection.upsert({
      where: { id: inter.id },
      update: {},
      create: { ...inter, zoneId: zone.id, status: "ACTIVE" },
    });
    console.log(`  ✓ Intersection: ${inter.name}`);
  }

  // ─── Cameras ─────────────────────────────────────────────────
  const cameras = [
    { cameraCode: "CAM-ISB-001", name: "Stadium Road Camera", intersectionName: "Jinnah Avenue / Stadium Road", intersectionId: "int-001", latitude: 33.7215, longitude: 73.0433, speedLimitKmh: 60 },
    { cameraCode: "CAM-ISB-002", name: "Blue Area Camera", intersectionName: "Blue Area / Faisal Avenue", intersectionId: "int-002", latitude: 33.7100, longitude: 73.0551, speedLimitKmh: 50 },
    { cameraCode: "CAM-ISB-003", name: "F-8 Markaz Camera", intersectionName: "F-8 Markaz / Nazimuddin Road", intersectionId: "int-003", latitude: 33.7050, longitude: 73.0400, speedLimitKmh: 40 },
  ];
  for (const camera of cameras) {
    await prisma.trafficCamera.upsert({
      where: { cameraCode: camera.cameraCode },
      update: { name: camera.name, intersectionId: camera.intersectionId },
      create: { ...camera, status: "ACTIVE" },
    });
    console.log(`  ✓ Camera: ${camera.cameraCode} — ${camera.name}`);
  }

  // ─── Alert Templates ─────────────────────────────────────────
  const templates = [
    { id: "tpl-001", name: "Routine Vehicle Detection", eventType: "VehicleDetectedEvent", description: "Standard vehicle passing through intersection", defaultPayload: JSON.stringify({ vehicle_plate: "ISB-1234", vehicle_type: "sedan" }), severityHint: "LOW" },
    { id: "tpl-002", name: "Minor Speed Violation", eventType: "SpeedViolationEvent", description: "Vehicle exceeding speed limit by small margin", defaultPayload: JSON.stringify({ vehicle_plate: "LHR-5678", speed_kmh: 70, speed_limit_kmh: 60 }), severityHint: "LOW" },
    { id: "tpl-003", name: "Heavy Speed Violation", eventType: "SpeedViolationEvent", description: "Vehicle significantly exceeding speed limit", defaultPayload: JSON.stringify({ vehicle_plate: "RWP-9012", speed_kmh: 120, speed_limit_kmh: 60 }), severityHint: "HIGH" },
    { id: "tpl-004", name: "Congestion Alert", eventType: "CongestionAlertEvent", description: "Moderate traffic congestion detected", defaultPayload: JSON.stringify({ congestion_level: "MODERATE", vehicle_count: 45 }), severityHint: "MEDIUM" },
    { id: "tpl-005", name: "Critical Congestion", eventType: "CongestionAlertEvent", description: "Severe traffic jam or road blockage", defaultPayload: JSON.stringify({ congestion_level: "CRITICAL", vehicle_count: 120 }), severityHint: "CRITICAL" },
    { id: "tpl-006", name: "Traffic Cleared", eventType: "TrafficClearedEvent", description: "Normal traffic flow restored at intersection", defaultPayload: JSON.stringify({ reason: "Natural dissipation" }), severityHint: "INFO" },
  ];
  for (const tpl of templates) {
    await prisma.alertTemplate.upsert({
      where: { id: tpl.id },
      update: {},
      create: { ...tpl, active: true },
    });
    console.log(`  ✓ Template: ${tpl.name}`);
  }

  // ─── Severity Policies ───────────────────────────────────────
  const severityPolicies = [
    { id: "sev-001", name: "Speed Violation Severity", eventType: "SpeedViolationEvent", payloadField: "speed_excess", lowThreshold: 1, mediumThreshold: 10, highThreshold: 25, criticalThreshold: 50 },
    { id: "sev-002", name: "Congestion Severity", eventType: "CongestionAlertEvent", payloadField: "congestion_level", lowThreshold: null, mediumThreshold: null, highThreshold: null, criticalThreshold: null },
  ];
  for (const sp of severityPolicies) {
    await prisma.severityPolicy.upsert({
      where: { id: sp.id },
      update: {},
      create: { ...sp, active: true },
    });
    console.log(`  ✓ Severity Policy: ${sp.name}`);
  }

  // ─── Incident Rules ──────────────────────────────────────────
  const incidentRules = [
    { id: "rule-001", name: "Speed Violation Incident", incidentType: "SPEED_INCIDENT", eventType: "SpeedViolationEvent", groupingWindowMinutes: 30, minimumEvents: 1, escalationThreshold: 5 },
    { id: "rule-002", name: "Congestion Incident", incidentType: "CONGESTION_INCIDENT", eventType: "CongestionAlertEvent", groupingWindowMinutes: 60, minimumEvents: 1, escalationThreshold: 3, autoClearEventType: "TrafficClearedEvent" },
  ];
  for (const rule of incidentRules) {
    await prisma.incidentRule.upsert({
      where: { id: rule.id },
      update: {},
      create: { ...rule, active: true },
    });
    console.log(`  ✓ Incident Rule: ${rule.name}`);
  }

  // ─── Queue Policy ────────────────────────────────────────────
  await prisma.queuePolicy.upsert({
    where: { id: "qp-001" },
    update: {},
    create: {
      id: "qp-001",
      name: "Default Capacity Scenario",
      incomingRate: 500,
      processingRate: 80,
      queueLimit: 10000,
      evictionPolicy: "Drop least important first; if same priority, drop oldest",
      active: true,
    },
  });
  console.log("  ✓ Queue Policy: Default Capacity Scenario (500/80/10000 → 23.81s)");

  // ─── External Provider Config ────────────────────────────────
  await prisma.externalProviderConfig.upsert({
    where: { id: "ext-001" },
    update: {},
    create: {
      id: "ext-001",
      provider: "TOMTOM",
      enabled: false,
      zoneId: zone.id,
      lastStatus: "NOT_CONFIGURED",
    },
  });
  console.log("  ✓ External Provider: TomTom (disabled by default)");

  // ─── Fine Policy (replaces hardcoded fines in AlertService) ──
  const finePolicies = [
    { id: "fp-001", name: "Severe Speed Excess (>30 km/h)", eventType: "SpeedViolationEvent", excessThresholdKmh: 30, fineAmount: 5000, active: true },
    { id: "fp-002", name: "Moderate Speed Excess (>15 km/h)", eventType: "SpeedViolationEvent", excessThresholdKmh: 15, fineAmount: 3000, active: true },
    { id: "fp-003", name: "Minor Speed Excess",              eventType: "SpeedViolationEvent", excessThresholdKmh: 0,  fineAmount: 1500, active: true },
  ];
  for (const fp of finePolicies) {
    await prisma.finePolicy.upsert({ where: { id: fp.id }, update: fp, create: fp });
    console.log(`  ✓ Fine Policy: ${fp.name} → Rs ${fp.fineAmount}`);
  }

  const totalCameras = await prisma.trafficCamera.count();
  const totalIntersections = await prisma.intersection.count();
  const totalTemplates = await prisma.alertTemplate.count();
  console.log(`\n[seed] Done. ${totalCameras} cameras, ${totalIntersections} intersections, ${totalTemplates} templates.`);
}

main()
  .catch((e) => {
    console.error("[seed] Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
