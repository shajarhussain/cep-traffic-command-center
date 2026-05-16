import type { PrismaClient } from "@prisma/client";
import type { PublishEventUseCase } from "./PublishEventUseCase.js";
import { EVENT_TYPES } from "../domain/events/EventTypes.js";

/**
 * CameraSimulator — generates random traffic events for demo/viva.
 */
export class CameraSimulator {
  constructor(
    private readonly publishUseCase: PublishEventUseCase,
    private readonly prisma: PrismaClient
  ) {}

  async simulateRandomEvent() {
    const cameras = await this.prisma.trafficCamera.findMany({ where: { status: "ACTIVE" } });
    if (cameras.length === 0) throw new Error("No active cameras found");
    const camera = cameras[Math.floor(Math.random() * cameras.length)];
    const types = Object.values(EVENT_TYPES);
    const eventType = types[Math.floor(Math.random() * types.length)];
    const payload = this.buildPayload(eventType, camera.intersectionName, camera.speedLimitKmh);
    return this.publishUseCase.execute({ source_id: camera.cameraCode, event_type: eventType, payload });
  }

  private buildPayload(eventType: string, intersection: string, speedLimit: number): Record<string, unknown> {
    const plates = ["ABC-123", "XYZ-789", "DEF-456", "GHI-101", "JKL-202"];
    const plate = plates[Math.floor(Math.random() * plates.length)];
    switch (eventType) {
      case EVENT_TYPES.VehicleDetected:
        return { vehicle_plate: plate, intersection, detected_at: new Date().toISOString() };
      case EVENT_TYPES.SpeedViolation: {
        const speed = speedLimit + Math.floor(Math.random() * 40) + 10;
        return { vehicle_plate: plate, intersection, speed, speed_limit: speedLimit, detected_at: new Date().toISOString() };
      }
      case EVENT_TYPES.CongestionAlert:
        return { intersection, vehicle_count: Math.floor(Math.random() * 50) + 20, congestion_level: Math.random() > 0.5 ? "CRITICAL" : "HIGH", detected_at: new Date().toISOString() };
      case EVENT_TYPES.TrafficCleared:
        return { intersection, cleared_at: new Date().toISOString() };
      default:
        return { intersection };
    }
  }
}
