import type { Request, Response } from "express";
import { getDashboard, updateDashboard } from "../services/Dashboard.service.js";

export const getDashboardController = async (req: Request, res: Response) => {
  try {
    const dashboard = await getDashboard();
    return res.status(200).json({ success: true, data: dashboard });
  } catch (error) {
    console.error("Get dashboard error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

// Plain JSON PUT — every field optional, only what's sent gets updated.
// No file upload involved (unlike Overview/Fundraising), so this stays a
// simple JSON body rather than multipart.
export const updateDashboardController = async (req: Request, res: Response) => {
  try {
    const {
      targetAmount,
      collectedAmount,
      percentCompleted,
      acresCleared,
      tonnesDesilted,
      volunteersJoined,
    } = req.body;

    const updateData: Record<string, unknown> = {};

    if (targetAmount !== undefined) updateData.targetAmount = targetAmount;
    if (collectedAmount !== undefined) updateData.collectedAmount = collectedAmount;
    if (acresCleared !== undefined) updateData.acresCleared = acresCleared;
    if (tonnesDesilted !== undefined) updateData.tonnesDesilted = tonnesDesilted;
    if (volunteersJoined !== undefined) updateData.volunteersJoined = volunteersJoined;

    if (percentCompleted !== undefined) {
      const numericPercent = Number(percentCompleted);
      if (isNaN(numericPercent) || numericPercent < 0 || numericPercent > 100) {
        return res.status(400).json({
          success: false,
          message: "percentCompleted must be a number between 0 and 100",
        });
      }
      updateData.percentCompleted = numericPercent;
    }

    const dashboard = await updateDashboard(updateData);

    return res.status(200).json({
      success: true,
      message: "Project dashboard updated",
      data: dashboard,
    });
  } catch (error) {
    console.error("Update dashboard error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

