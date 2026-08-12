import type { Request, Response } from "express";
import { getDbStatus } from "../config/db.js";

export const getHealth = (req: Request, res: Response): void => {
  const dbStatus = getDbStatus();
  const memoryUsage = process.memoryUsage();

  const healthData = {
    status: dbStatus.isConnected ? "OK" : "DEGRADED",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || "development",
    database: dbStatus,
    system: {
      nodeVersion: process.version,
      platform: process.platform,
      memory: {
        rssMB: Math.round((memoryUsage.rss / 1024 / 1024) * 100) / 100,
        heapTotalMB: Math.round((memoryUsage.heapTotal / 1024 / 1024) * 100) / 100,
        heapUsedMB: Math.round((memoryUsage.heapUsed / 1024 / 1024) * 100) / 100,
      },
    },
  };

  const statusCode = dbStatus.isConnected ? 200 : 200; // Return 200 with DEGRADED state if DB not reachable yet
  res.status(statusCode).json(healthData);
};
