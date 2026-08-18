import type { Request, Response } from "express";
import {
  getFundraising,
  updateFundraising,
  getFundraisingImageKey,
} from "../services/Fundraising.service.js";
import {
  buildS3Key,
  uploadBufferToS3,
  deleteFromS3,
  getPublicS3Url,
} from "../utils/S3.util.js";
import { resizeForContentImage } from "../utils/Image.util.js";

export const getFundraisingController = async (req: Request, res: Response) => {
  try {
    const fundraising = await getFundraising();
    return res.status(200).json({ success: true, data: fundraising });
  } catch (error) {
    console.error("Get fundraising error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

// Multipart PUT — every field optional, only what's sent gets updated.
// fundUsage arrives as a JSON string (multipart can't carry nested arrays
// directly); bannerPhoto is an optional single image file.
export const updateFundraisingController = async (req: Request, res: Response) => {
  try {
    const { targetCrore, daysGoal, campaignStartDate, goalQuote, fundUsage } = req.body;

    const updateData: Record<string, unknown> = {};

    if (targetCrore !== undefined) {
      const numericTarget = Number(targetCrore);
      if (isNaN(numericTarget) || numericTarget <= 0) {
        return res.status(400).json({ success: false, message: "Invalid targetCrore value" });
      }
      updateData.targetCrore = numericTarget;
    }

    if (daysGoal !== undefined) {
      const numericDays = Number(daysGoal);
      if (isNaN(numericDays) || numericDays <= 0) {
        return res.status(400).json({ success: false, message: "Invalid daysGoal value" });
      }
      updateData.daysGoal = numericDays;
    }

    if (campaignStartDate !== undefined) {
      const parsedDate = new Date(campaignStartDate);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({ success: false, message: "Invalid campaignStartDate value" });
      }
      updateData.campaignStartDate = parsedDate;
    }

    if (goalQuote !== undefined) updateData.goalQuote = goalQuote;

    if (fundUsage !== undefined) {
      let parsed: { label: string; percent: number; color: string }[];
      try {
        parsed = JSON.parse(fundUsage);
      } catch {
        return res.status(400).json({ success: false, message: "Invalid fundUsage payload" });
      }

      const total = parsed.reduce((sum, item) => sum + Number(item.percent || 0), 0);
      if (total > 100) {
        return res.status(400).json({
          success: false,
          message: `Fund usage percentages add up to ${total}%, which is over 100%.`,
        });
      }

      updateData.fundUsage = parsed;
    }

    const file = req.file as Express.Multer.File | undefined;
    const existingKeys = file ? await getFundraisingImageKey() : {};

    if (file) {
      const resized = await resizeForContentImage(file.buffer);
      const key = buildS3Key(file.originalname, "fundraising");
      await uploadBufferToS3(key, resized, "image/jpeg");
      updateData.bannerImageKey = key;
      updateData.bannerImageUrl = getPublicS3Url(key);
    }

    const fundraising = await updateFundraising(updateData);

    // Best-effort cleanup of the replaced banner — a failure here shouldn't
    // fail the request; the new image is already saved and live.
    if (file && existingKeys.bannerImageKey) {
      deleteFromS3(existingKeys.bannerImageKey).catch((err) =>
        console.error("Failed to delete old fundraising banner from S3:", err)
      );
    }

    return res.status(200).json({
      success: true,
      message: "Fundraising section updated",
      data: fundraising,
    });
  } catch (error) {
    console.error("Update fundraising error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};