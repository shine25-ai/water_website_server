import type { Request, Response } from "express";
import {
  createVolunteer,
  getVolunteerById,
  getAllVolunteers,
} from "../services/Volunteer.service.js";
import { generateVolunteerIdCard } from "../utils/Idcard.util.js";
import { uploadBufferToS3, getBufferFromS3 } from "../utils/S3.util.js";

export const createVolunteerController = async (req: Request, res: Response) => {
  try {
    const {
      name,
      email,
      mobile,
      village,
      district,
      profession,
      age,
      interestArea,
      contributions,
    } = req.body;

    if (!name || !email || !mobile || !village || !district || !age) {
      return res.status(400).json({
        success: false,
        message: "Name, email, mobile, village, district and age are required",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: "Please enter a valid email address" });
    }

    const mobileRegex = /^[0-9]{10}$/;
    if (!mobileRegex.test(mobile)) {
      return res.status(400).json({ success: false, message: "Please enter a valid 10-digit mobile number" });
    }

    const numericAge = Number(age);
    if (isNaN(numericAge) || numericAge <= 0) {
      return res.status(400).json({ success: false, message: "Please enter a valid age" });
    }

    // "contributions" arrives as a JSON string inside the multipart body
    // (multer only gives us plain string fields, not nested arrays).
    let parsedContributions: string[] = [];
    if (contributions) {
      try {
        parsedContributions = JSON.parse(contributions);
      } catch {
        return res.status(400).json({ success: false, message: "Invalid contributions payload" });
      }
    }

    // multer.memoryStorage() gives us the raw file bytes on req.file.buffer
    // — upload straight to S3, no temp file on disk at any point.
    let photoKey: string | undefined;
    if (req.file) {
      const uploadResult = await uploadBufferToS3(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );
      photoKey = uploadResult.key;
    }

    const volunteer = await createVolunteer({
      name,
      email,
      mobile,
      village,
      district,
      profession,
      age: numericAge,
      interestArea,
      contributions: parsedContributions,
      photoKey,
    });

    return res.status(201).json({
      success: true,
      message: "Volunteer registered successfully",
      data: volunteer,
    });
  } catch (error) {
    console.error("Create volunteer error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

// Generates and streams the volunteer's ID card as a downloadable PDF.
export const getVolunteerIdCardController = async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const volunteer = await getVolunteerById(id);

    if (!volunteer) {
      return res.status(404).json({ success: false, message: "Volunteer not found" });
    }

    // Pull the photo bytes back from S3. If this fails for any reason
    // (object missing, transient S3 error), fall back to the initial-letter
    // placeholder rather than failing the whole card.
    let photoBuffer: Buffer | undefined;
    if (volunteer.photoKey) {
      try {
        photoBuffer = await getBufferFromS3(volunteer.photoKey);
      } catch (photoErr) {
        console.error("Failed to fetch volunteer photo from S3:", photoErr);
      }
    }

    const pdfBuffer = await generateVolunteerIdCard({
      volunteerId: volunteer.volunteerId,
      name: volunteer.name,
      email: volunteer.email,
      mobile: volunteer.mobile,
      village: volunteer.village,
      district: volunteer.district,
      profession: volunteer.profession,
      age: volunteer.age,
      interestArea: volunteer.interestArea,
      contributions: volunteer.contributions,
      photoBuffer,
      issueDate: volunteer.createdAt,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Volunteer-ID-${volunteer.volunteerId}.pdf"`
    );
    return res.send(pdfBuffer);
  } catch (error) {
    console.error("Generate volunteer ID card error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

export const getAllVolunteersController = async (req: Request, res: Response) => {
  try {
    const volunteers = await getAllVolunteers();
    return res.status(200).json({ success: true, data: volunteers });
  } catch (error) {
    console.error("Get volunteers error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};