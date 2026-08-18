import type { Request, Response } from "express";
import {
  getAllNewsUpdates,
  createNewsUpdate,
  updateNewsUpdate,
  deleteNewsUpdate,
} from "../services/Newsupdate.service.js";

export const getNewsUpdatesController = async (req: Request, res: Response) => {
  try {
    const updates = await getAllNewsUpdates();
    return res.status(200).json({ success: true, data: updates });
  } catch (error) {
    console.error("Get news updates error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

export const createNewsUpdateController = async (req: Request, res: Response) => {
  try {
    const { date, title, order } = req.body;

    if (!date || !title) {
      return res.status(400).json({ success: false, message: "Date and title are required" });
    }

    let numericOrder: number | undefined;
    if (order !== undefined) {
      numericOrder = Number(order);
      if (isNaN(numericOrder)) {
        return res.status(400).json({ success: false, message: "Order must be a number" });
      }
    }

    const update = await createNewsUpdate({ date, title, order: numericOrder });
    return res.status(201).json({ success: true, message: "Update added", data: update });
  } catch (error) {
    console.error("Create news update error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

export const updateNewsUpdateController = async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { date, title, order } = req.body;

    const data: { date?: string; title?: string; order?: number } = {};
    if (date !== undefined) data.date = date;
    if (title !== undefined) data.title = title;
    if (order !== undefined) {
      const numericOrder = Number(order);
      if (isNaN(numericOrder)) {
        return res.status(400).json({ success: false, message: "Order must be a number" });
      }
      data.order = numericOrder;
    }

    const update = await updateNewsUpdate(id, data);
    if (!update) {
      return res.status(404).json({ success: false, message: "Update not found" });
    }

    return res.status(200).json({ success: true, message: "Update saved", data: update });
  } catch (error) {
    console.error("Update news update error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

export const deleteNewsUpdateController = async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const deleted = await deleteNewsUpdate(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Update not found" });
    }
    return res.status(200).json({ success: true, message: "Update deleted" });
  } catch (error) {
    console.error("Delete news update error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};