import type { Request, Response } from "express";
import {
  generateVolunteerId,
  createVolunteer,
  getVolunteerById,
  getAllVolunteers,
} from "../services/Volunteer.service.js";
import { generateVolunteerIdCard } from "../utils/Idcard.util.js";
import { buildS3Key, uploadBufferToS3, getBufferFromS3 } from "../utils/S3.util.js";
import { resizeForIdCard } from "../utils/Image.util.js";

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

    let parsedContributions: string[] = [];
    if (contributions) {
      try {
        parsedContributions = JSON.parse(contributions);
      } catch {
        return res.status(400).json({ success: false, message: "Invalid contributions payload" });
      }
    }

    // Resize once, up front, and reuse the same small buffer for both the
    // S3 upload and the PDF — a phone photo can be 3-8MB; the card only
    // ever displays it at postage-stamp size, and the smaller buffer
    // makes everything downstream faster too.
    let photoBuffer: Buffer | undefined;
    let photoKey: string | undefined;
    if (req.file) {
      photoBuffer = await resizeForIdCard(req.file.buffer);
      photoKey = buildS3Key(req.file.originalname);
    }

    // The only step that has to happen first: the running-count query
    // that assigns the human-facing volunteerId. Everything after this —
    // the S3 upload, the Mongo insert, and the PDF render — runs at the
    // same time instead of waiting on each other in sequence.
    const volunteerId = await generateVolunteerId();

    const [volunteer, , pdfBuffer] = await Promise.all([
      createVolunteer({
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
        volunteerId,
      }),
      photoBuffer && photoKey
        ? uploadBufferToS3(photoKey, photoBuffer, "image/jpeg")
        : Promise.resolve(),
      generateVolunteerIdCard({
        volunteerId,
        name,
        email,
        mobile,
        village,
        district,
        profession,
        age: numericAge,
        interestArea,
        contributions: parsedContributions,
        photoBuffer,
        issueDate: new Date(),
      }),
    ]);

    // The response IS the PDF — no second request from the frontend to
    // fetch it, and no re-download of the photo from S3 to build it.
    // volunteerId / the Mongo _id ride along as headers instead of a
    // JSON body (remember to expose these via CORS — see notes below).
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Volunteer-ID-${volunteerId}.pdf"`
    );
    res.setHeader("X-Volunteer-Id", volunteerId);
    res.setHeader("X-Volunteer-Record-Id", String(volunteer._id));
    res.setHeader(
      "Access-Control-Expose-Headers",
      "Content-Disposition, X-Volunteer-Id, X-Volunteer-Record-Id"
    );
    return res.send(pdfBuffer);
  } catch (error) {
    console.error("Create volunteer error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

// Re-generates a volunteer's ID card on demand (e.g. from an admin
// dashboard), fetching the photo back out of S3. This is intentionally
// the slower path — the main submit flow above never calls it.
export const getVolunteerIdCardController = async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const volunteer = await getVolunteerById(id);

    if (!volunteer) {
      return res.status(404).json({ success: false, message: "Volunteer not found" });
    }

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

