import type { Request, Response } from "express";
import {
  getAllDocuments,
  getDocumentById,
  createDocument,
  updateDocument,
  deleteDocument,
} from "../services/Document.service.js";
import { buildS3Key, uploadBufferToS3, deleteFromS3, getPublicS3Url } from "../utils/S3.util.js";

export const getAllDocumentsController = async (req: Request, res: Response) => {
  try {
    const documents = await getAllDocuments();
    return res.status(200).json({ success: true, data: documents });
  } catch (error) {
    console.error("Get documents error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

export const createDocumentController = async (req: Request, res: Response) => {
  try {
    const { group, ta, en, icon } = req.body;
    const file = req.file as Express.Multer.File | undefined;

    if (!group || !ta || !en || !file) {
      return res.status(400).json({
        success: false,
        message: "group, ta, en and a file are required",
      });
    }

    const key = buildS3Key(file.originalname, "documents");
    await uploadBufferToS3(key, file.buffer, file.mimetype);

    const document = await createDocument({
      group,
      ta,
      en,
      icon: icon || "file-text",
      fileKey: key,
      fileUrl: getPublicS3Url(key),
    });

    return res.status(201).json({ success: true, message: "Document added", data: document });
  } catch (error) {
    console.error("Create document error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

// Every field optional except the id in the URL — only what's sent gets
// updated. A new file replaces the old one; the old S3 object is cleaned
// up afterward.
export const updateDocumentController = async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { group, ta, en, icon } = req.body;
    const file = req.file as Express.Multer.File | undefined;

    const existing = await getDocumentById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Document not found" });
    }

    const updateData: Record<string, unknown> = {};
    if (group !== undefined) updateData.group = group;
    if (ta !== undefined) updateData.ta = ta;
    if (en !== undefined) updateData.en = en;
    if (icon !== undefined) updateData.icon = icon;

    if (file) {
      const key = buildS3Key(file.originalname, "documents");
      await uploadBufferToS3(key, file.buffer, file.mimetype);
      updateData.fileKey = key;
      updateData.fileUrl = getPublicS3Url(key);
    }

    const document = await updateDocument(id, updateData);

    // Best-effort cleanup of the replaced file — a failure here shouldn't
    // fail the request; the new file is already saved and live.
    if (file && existing.fileKey) {
      deleteFromS3(existing.fileKey).catch((err) =>
        console.error("Failed to delete old document file from S3:", err)
      );
    }

    return res.status(200).json({ success: true, message: "Document updated", data: document });
  } catch (error) {
    console.error("Update document error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

export const deleteDocumentController = async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const existing = await getDocumentById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Document not found" });
    }

    await deleteDocument(id);

    deleteFromS3(existing.fileKey).catch((err) =>
      console.error("Failed to delete document file from S3:", err)
    );

    return res.status(200).json({ success: true, message: "Document deleted" });
  } catch (error) {
    console.error("Delete document error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

// Streams the PDF back with Content-Disposition: attachment so the browser
// downloads it instead of navigating to it — plain `download` attributes on
// an <a> tag don't work across origins (S3's domain vs. the site's), which
// is why linking straight to fileUrl just opened the PDF in a new tab.
export const downloadDocumentController = async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const document = await getDocumentById(id);

    if (!document) {
      return res.status(404).json({ success: false, message: "Document not found" });
    }

    const s3Response = await fetch(document.fileUrl);
    if (!s3Response.ok || !s3Response.body) {
      return res.status(502).json({ success: false, message: "Couldn't fetch the file from storage" });
    }

    const buffer = Buffer.from(await s3Response.arrayBuffer());

    // Build a readable filename from the document's English label rather
    // than exposing the raw S3 key.
    const safeName = document.en.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "document";

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}.pdf"`);
    return res.send(buffer);
  } catch (error) {
    console.error("Download document error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};