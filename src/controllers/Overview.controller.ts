import type { Request, Response } from "express";
import {
  getOverview,
  updateOverview,
  getOverviewImageKeys,
} from "../services/Overview.service.js";
import {
  buildS3Key,
  uploadBufferToS3,
  deleteFromS3,
  getPublicS3Url,
} from "../utils/S3.util.js";
import { resizeForContentImage } from "../utils/Image.util.js";

export const getOverviewController = async (req: Request, res: Response) => {
  try {
    const overview = await getOverview();
    return res.status(200).json({ success: true, data: overview });
  } catch (error) {
    console.error("Get overview error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

// Multipart PUT — every field is optional and only what's sent gets
// updated. goals / checklist arrive as JSON strings (multipart bodies
// can't carry nested arrays directly); beforePhoto / afterPhoto are
// optional image files.
export const updateOverviewController = async (req: Request, res: Response) => {
  try {
    const {
      sectionTitle,
      sectionSubtitle,
      goals,
      transformationBadge,
      beforeLabel,
      beforeCaption,
      afterLabel,
      checklistTitle,
      checklist,
    } = req.body;

    const updateData: Record<string, unknown> = {};

    if (sectionTitle !== undefined) updateData.sectionTitle = sectionTitle;
    if (sectionSubtitle !== undefined) updateData.sectionSubtitle = sectionSubtitle;
    if (transformationBadge !== undefined) updateData.transformationBadge = transformationBadge;
    if (beforeLabel !== undefined) updateData.beforeLabel = beforeLabel;
    if (beforeCaption !== undefined) updateData.beforeCaption = beforeCaption;
    if (afterLabel !== undefined) updateData.afterLabel = afterLabel;
    if (checklistTitle !== undefined) updateData.checklistTitle = checklistTitle;

    if (goals !== undefined) {
      try {
        updateData.goals = JSON.parse(goals);
      } catch {
        return res.status(400).json({ success: false, message: "Invalid goals payload" });
      }
    }

    if (checklist !== undefined) {
      try {
        updateData.checklist = JSON.parse(checklist);
      } catch {
        return res.status(400).json({ success: false, message: "Invalid checklist payload" });
      }
    }

    const files = req.files as { [field: string]: Express.Multer.File[] } | undefined;
    const beforeFile = files?.beforePhoto?.[0];
    const afterFile = files?.afterPhoto?.[0];

    // Snapshot the current image keys before overwriting, so the old S3
    // objects can be cleaned up once the new ones are safely saved.
    const existingKeys =
      beforeFile || afterFile ? await getOverviewImageKeys() : {};

    if (beforeFile) {
      const resized = await resizeForContentImage(beforeFile.buffer);
      const key = buildS3Key(beforeFile.originalname, "overview");
      await uploadBufferToS3(key, resized, "image/jpeg");
      updateData.beforeImageKey = key;
      updateData.beforeImageUrl = getPublicS3Url(key);
    }

    if (afterFile) {
      const resized = await resizeForContentImage(afterFile.buffer);
      const key = buildS3Key(afterFile.originalname, "overview");
      await uploadBufferToS3(key, resized, "image/jpeg");
      updateData.afterImageKey = key;
      updateData.afterImageUrl = getPublicS3Url(key);
    }

    const overview = await updateOverview(updateData);

    // Best-effort cleanup of replaced images — a failure here shouldn't
    // fail the request; the new image is already saved and live.
    if (beforeFile && existingKeys.beforeImageKey) {
      deleteFromS3(existingKeys.beforeImageKey).catch((err) =>
        console.error("Failed to delete old before-image from S3:", err)
      );
    }
    if (afterFile && existingKeys.afterImageKey) {
      deleteFromS3(existingKeys.afterImageKey).catch((err) =>
        console.error("Failed to delete old after-image from S3:", err)
      );
    }

    return res.status(200).json({
      success: true,
      message: "Overview section updated",
      data: overview,
    });
  } catch (error) {
    console.error("Update overview error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};