import { Router } from "express";
import type { SystemContext } from "../../application/systemContext.js";

export function createCameraRoutes(ctx: SystemContext): Router {
  const router = Router();

  router.get("/", async (_req, res) => {
    try {
      const cameras = await ctx.prisma.trafficCamera.findMany({
        include: { intersection: true },
        orderBy: { cameraCode: "asc" },
      });
      const mapped = cameras.map((c) => ({
        id: c.id,
        cameraCode: c.cameraCode,
        name: c.name || c.cameraCode,
        location: c.intersectionName,
        intersectionId: c.intersectionId,
        latitude: c.latitude,
        longitude: c.longitude,
        speedLimitKmh: c.speedLimitKmh,
        status: c.status,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      }));
      res.json(mapped);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to load cameras" });
    }
  });

  router.post("/", async (req, res) => {
    try {
      const camera = await ctx.prisma.trafficCamera.create({ data: req.body });
      res.status(201).json(camera);
    } catch (err) {
      console.error(err);
      res.status(400).json({ error: "Failed to create camera" });
    }
  });

  router.put("/:id", async (req, res) => {
    try {
      const camera = await ctx.prisma.trafficCamera.update({
        where: { id: req.params["id"] },
        data: req.body,
      });
      res.json(camera);
    } catch (err) {
      console.error(err);
      res.status(400).json({ error: "Failed to update camera" });
    }
  });

  return router;
}
