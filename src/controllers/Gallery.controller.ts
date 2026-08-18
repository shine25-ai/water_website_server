import type { Request, Response } from "express";
import {
  getGallery,
  createGalleryPhoto,
  deleteGalleryPhoto,
} from "../services/Gallery.service.js";
import type { GallerySection, GalleryStage } from "../models/Gallery.model.js";
import {
  buildS3Key,
  uploadBufferToS3,
  getPublicS3Url,
  deleteFromS3,
  keyFromS3Url,
} from "../utils/S3.util.js";

export const getGalleryController = async (req: Request, res: Response) => {
  try {
    const gallery = await getGallery();
    return res.status(200).json({ success: true, data: gallery });
  } catch (error) {
    console.error("Get gallery error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

// Multipart POST — one photo file per request via the "photo" field,
// plus section/stage/category/caption as regular form fields. The
// upload middleware uses multer's memoryStorage, so req.file arrives
// as an in-memory buffer instead of being written to local disk —
// it's streamed straight to S3 from here, and only the resulting S3
// URL is persisted.
export const addGalleryPhotoController = async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, message: "photo file is required" });
    }

    const { section, stage, category, caption } = req.body as {
      section?: string;
      stage?: string;
      category?: string;
      caption?: string;
    };

    if (section !== "nallathangal1" && section !== "nallathangal2") {
      return res.status(400).json({
        success: false,
        message: "section must be 'nallathangal1' or 'nallathangal2'",
      });
    }

    // buildS3Key generates the key up front, uploadBufferToS3 just
    // PUTs to it and returns void — the public URL is a pure function
    // of the key (getPublicS3Url), not something the upload call hands back.
    const key = buildS3Key(file.originalname, "gallery");
    await uploadBufferToS3(key, file.buffer, file.mimetype);
    const imageUrl = getPublicS3Url(key);

    const photo = await createGalleryPhoto({
      section: section as GallerySection,
      stage: stage as GalleryStage | undefined,
      category,
      imageUrl,
      caption,
    });

    return res.status(201).json({ success: true, message: "Photo added", data: photo });
  } catch (error) {
    console.error("Add gallery photo error:", error);
    const message = error instanceof Error ? error.message : "Something went wrong";
    // Validation errors (missing stage/category) are the caller's fault — 400, not 500.
    return res.status(400).json({ success: false, message });
  }
};

export const deleteGalleryPhotoController = async (req: Request, res: Response) => {
  try {
    // req.params values can type as string | string[] depending on the
    // Express/qs typings in this project — a route param is always a
    // single string at runtime, so narrow it explicitly rather than
    // trusting the inferred type.
    const idParam = req.params.id;
    const id = Array.isArray(idParam) ? idParam[0] : idParam;

    if (!id) {
      return res.status(400).json({ success: false, message: "Photo id is required" });
    }

    const photo = await deleteGalleryPhoto(id);
    if (!photo) {
      return res.status(404).json({ success: false, message: "Photo not found" });
    }

    // Best-effort S3 cleanup — the DB record is already gone at this
    // point, so an S3 failure gets logged rather than failing the
    // whole request (the object would just become an orphan to clean
    // up later, which beats leaving a broken DB record around).
    // Assumes deleteGalleryPhoto returns the deleted document with its
    // imageUrl — adjust if your service returns something narrower.
    const key = keyFromS3Url((photo as { imageUrl: string }).imageUrl);
    if (key) {
      try {
        await deleteFromS3(key);
      } catch (s3Error) {
        console.error("Failed to delete S3 object for photo", id, s3Error);
      }
    }

    return res.status(200).json({ success: true, message: "Photo removed" });
  } catch (error) {
    console.error("Delete gallery photo error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};