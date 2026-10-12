import type { Request, Response } from "express";
import mongoose from "mongoose";
import {
  getAboutContent,
  updateAboutContent,
  listLeaders,
  createLeader,
  updateLeader,
  deleteLeader,
} from "../services/About.service.js";
import type { LeaderInput } from "../services/About.service.js";
import { ABOUT_CONTENT_KEYS } from "../models/AboutContent.model.js";
import type {
  IAboutContent,
  AboutContentFields,
} from "../models/AboutContent.model.js";
import type { ILeader, LeaderRole } from "../models/Leader.model.js";
import {
  buildS3Key,
  uploadBufferToS3,
  getSignedPhotoUrl,
  deleteFromS3,
} from "../utils/S3.util.js";

// Signed URLs are resolved fresh on every page load, so a few hours is
// plenty — and the bucket can stay private (no public-read policy needed).
const PHOTO_URL_TTL_SECONDS = 6 * 60 * 60;

const TEXT_LIMITS = { name: 80, designation: 100, location: 100, bio: 400 } as const;
const MAX_ROLE_LENGTH = 60;
const MAX_CONTENT_LENGTH = 1000;

const serializeContent = (doc: IAboutContent): AboutContentFields => {
  const out = {} as AboutContentFields;
  for (const key of ABOUT_CONTENT_KEYS) out[key] = doc[key];
  return out;
};

const serializeLeader = async (l: ILeader) => ({
  id: String(l._id),
  name: l.name,
  role: l.role,
  designation: l.designation ?? "",
  location: l.location ?? "",
  bio: l.bio ?? "",
  order: l.order,
  photoUrl: l.photoKey
    ? await getSignedPhotoUrl(l.photoKey, PHOTO_URL_TTL_SECONDS)
    : null,
});

// Only copies fields that were actually sent, so a PUT can change one
// field without wiping the rest. Returns an error string on bad input.
const parseLeaderBody = (
  body: Record<string, unknown>
): { data: LeaderInput; error?: string } => {
  const data: LeaderInput = {};

  for (const key of ["name", "designation", "location", "bio"] as const) {
    const raw = body[key];
    if (raw === undefined) continue;
    if (typeof raw !== "string") return { data, error: `${key} must be text` };
    const value = raw.trim();
    if (value.length > TEXT_LIMITS[key]) {
      return { data, error: `${key} must be at most ${TEXT_LIMITS[key]} characters` };
    }
    data[key] = value;
  }

  // Role is free text now (no fixed list of allowed values).
  if (body.role !== undefined) {
    if (typeof body.role !== "string") {
      return { data, error: "Role must be text" };
    }
    const role = body.role.trim();
    if (!role) return { data, error: "Role can't be empty" };
    if (role.length > MAX_ROLE_LENGTH) {
      return { data, error: `Role must be at most ${MAX_ROLE_LENGTH} characters` };
    }
    data.role = role as LeaderRole;
  }

  if (body.order !== undefined && body.order !== "") {
    const n = Number(body.order);
    if (!Number.isFinite(n)) return { data, error: "Order must be a number" };
    data.order = Math.trunc(n);
  }

  return { data };
};

// Public — powers the About page (text + leaders in one request).
export const getAboutPublicController = async (_req: Request, res: Response) => {
  try {
    const [content, leaders] = await Promise.all([getAboutContent(), listLeaders()]);
    const leaderData = await Promise.all(leaders.map(serializeLeader));

    return res.status(200).json({
      success: true,
      data: { content: serializeContent(content), leaders: leaderData },
    });
  } catch (error) {
    console.error("Get about page error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

export const updateAboutContentController = async (req: Request, res: Response) => {
  try {
    const patch: Partial<AboutContentFields> = {};

    for (const key of ABOUT_CONTENT_KEYS) {
      const raw = req.body?.[key];
      if (raw === undefined) continue;
      if (typeof raw !== "string") {
        return res.status(400).json({ success: false, message: `${key} must be text` });
      }
      const value = raw.trim();
      if (value.length > MAX_CONTENT_LENGTH) {
        return res.status(400).json({
          success: false,
          message: `${key} must be at most ${MAX_CONTENT_LENGTH} characters`,
        });
      }
      patch[key] = value;
    }

    if (patch.heroTitle !== undefined && !patch.heroTitle) {
      return res.status(400).json({ success: false, message: "The page heading can't be empty" });
    }

    const updated = await updateAboutContent(patch);
    return res.status(200).json({ success: true, data: serializeContent(updated) });
  } catch (error) {
    console.error("Update about content error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

export const createLeaderController = async (req: Request, res: Response) => {
  try {
    const { data, error } = parseLeaderBody(req.body ?? {});
    if (error) return res.status(400).json({ success: false, message: error });
    if (!data.name) return res.status(400).json({ success: false, message: "Name is required" });
    if (!data.role) return res.status(400).json({ success: false, message: "Role is required" });

    let photoKey: string | undefined;
    if (req.file) {
      photoKey = buildS3Key(req.file.originalname, "leaders");
      await uploadBufferToS3(photoKey, req.file.buffer, req.file.mimetype);
    }

    try {
      const leader = await createLeader({
        ...data,
        name: data.name,
        role: data.role,
        photoKey,
      });
      return res.status(201).json({ success: true, data: await serializeLeader(leader) });
    } catch (dbError) {
      // Don't leave an orphaned upload behind if the DB write failed.
      if (photoKey) {
        deleteFromS3(photoKey).catch((err) =>
          console.error("Failed to clean up leader photo:", err)
        );
      }
      throw dbError;
    }
  } catch (error) {
    console.error("Create leader error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

export const updateLeaderController = async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ success: false, message: "Leader not found" });
    }

    const { data, error } = parseLeaderBody(req.body ?? {});
    if (error) return res.status(400).json({ success: false, message: error });
    if (data.name !== undefined && !data.name) {
      return res.status(400).json({ success: false, message: "Name can't be empty" });
    }

    let newKey: string | undefined;
    if (req.file) {
      newKey = buildS3Key(req.file.originalname, "leaders");
      await uploadBufferToS3(newKey, req.file.buffer, req.file.mimetype);
    }

    const removePhoto = req.body?.removePhoto === "true";

    try {
      const { leader, oldPhotoKey } = await updateLeader(id, data, {
        newKey,
        remove: removePhoto,
      });

      if (!leader) {
        if (newKey) {
          deleteFromS3(newKey).catch((err) =>
            console.error("Failed to clean up leader photo:", err)
          );
        }
        return res.status(404).json({ success: false, message: "Leader not found" });
      }

      if (oldPhotoKey) {
        deleteFromS3(oldPhotoKey).catch((err) =>
          console.error("Failed to delete old leader photo:", err)
        );
      }

      return res.status(200).json({ success: true, data: await serializeLeader(leader) });
    } catch (dbError) {
      if (newKey) {
        deleteFromS3(newKey).catch((err) =>
          console.error("Failed to clean up leader photo:", err)
        );
      }
      throw dbError;
    }
  } catch (error) {
    console.error("Update leader error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

export const deleteLeaderController = async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ success: false, message: "Leader not found" });
    }

    const leader = await deleteLeader(id);
    if (!leader) {
      return res.status(404).json({ success: false, message: "Leader not found" });
    }

    if (leader.photoKey) {
      deleteFromS3(leader.photoKey).catch((err) =>
        console.error("Failed to delete leader photo:", err)
      );
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Delete leader error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};