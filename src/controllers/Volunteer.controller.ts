import type { Request, Response } from "express";
import {
  generateVolunteerId,
  registerVolunteerSelf,
  findVolunteerByEmailOrMobile,
  getVolunteerById,
  getAllVolunteers,
  setVolunteerPassword,
  authenticateVolunteer,
  updateVolunteerProfile,
  updateVolunteerPhoto,
  removeVolunteerPhoto,
} from "../services/Volunteer.service.js";
import { generateVolunteerIdCard } from "../utils/Idcard.util.js";
import {
  buildS3Key,
  uploadBufferToS3,
  getBufferFromS3,
  getSignedPhotoUrl,
  deleteFromS3,
} from "../utils/S3.util.js";
import { resizeForIdCard } from "../utils/Image.util.js";
import { sendVolunteerWelcomeEmail } from "../utils/send.util.js";
import { signVolunteerToken } from "../utils/volunteerAuth.util.js";
import type { AuthenticatedVolunteerRequest } from "../middleware/volunteerAuth.middleware.js";

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

    // Scenario 2: someone fills the volunteer form directly. If they're
    // already a volunteer (self-registered earlier, or auto-created from
    // a past donation — same check the donation flow uses), don't create
    // a duplicate record or re-send an invitation. Tell them plainly and
    // point at login instead of generating a second ID card silently.
    const existingVolunteer = await findVolunteerByEmailOrMobile(email, mobile);
    if (existingVolunteer) {
      return res.status(409).json({
        success: false,
        alreadyVolunteer: true,
        message: "You're already registered as a volunteer. Please log in to view or update your details.",
        data: { volunteerId: existingVolunteer.volunteerId },
      });
    }

    let parsedContributions: string[] = [];
    if (contributions) {
      try {
        parsedContributions = JSON.parse(contributions);
      } catch {
        return res.status(400).json({ success: false, message: "Invalid contributions payload" });
      }
    }

    let photoBuffer: Buffer | undefined;
    let photoKey: string | undefined;
    if (req.file) {
      photoBuffer = await resizeForIdCard(req.file.buffer);
      photoKey = buildS3Key(req.file.originalname, "volunteers");
    }

    const volunteerId = await generateVolunteerId();

    const [{ volunteer, rawToken }, , pdfBuffer] = await Promise.all([
      registerVolunteerSelf({
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

    // Same invitation email as the donation flow, fired in the
    // background — the PDF response below is what the volunteer is
    // actually waiting on, so an email hiccup shouldn't hold that up or
    // turn a successful signup into an error.
    if (!process.env.FRONTEND_URL) {
      console.error("FRONTEND_URL is not set — cannot build volunteer set-password link");
    } else {
      const setPasswordUrl = `${process.env.FRONTEND_URL}/volunteer/set-password?token=${rawToken}`;
      sendVolunteerWelcomeEmail({
        volunteerEmail: volunteer.email,
        volunteerName: volunteer.name,
        setPasswordUrl,
      })
        .then((result) =>
          console.log("Volunteer welcome email sent:", {
            messageId: result.messageId,
            accepted: result.accepted,
            rejected: result.rejected,
          })
        )
        .catch((err) => console.error("Volunteer welcome email failed:", err.message));
    }

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
      // Village/district/age are optional now (donation-created volunteers
      // may not have filled these in yet) but IdCardData still requires
      // them — fall back to a placeholder rather than loosening that type,
      // since every other card-printing call site still has real values.
      village: volunteer.village || "Not specified",
      district: volunteer.district || "Not specified",
      profession: volunteer.profession,
      age: volunteer.age ?? 0,
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

// Consumes the token from the "set your password" email link (sent
// either after self-registration or after a donation auto-created the
// account), activates the account, and logs the volunteer straight in.
export const setVolunteerPasswordController = async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ success: false, message: "Token and password are required" });
    }

    if (String(password).length < 8) {
      return res.status(400).json({ success: false, message: "Password must be at least 8 characters" });
    }

    const volunteer = await setVolunteerPassword(token, password);

    if (!volunteer) {
      return res.status(400).json({ success: false, message: "This link is invalid or has expired" });
    }

    const authToken = signVolunteerToken(String(volunteer._id));

    return res.status(200).json({
      success: true,
      message: "Password set successfully",
      token: authToken,
      data: {
        id: volunteer._id,
        name: volunteer.name,
        email: volunteer.email,
        volunteerId: volunteer.volunteerId,
        isProfileComplete: volunteer.isProfileComplete,
      },
    });
  } catch (error) {
    console.error("Set volunteer password error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

export const volunteerLoginController = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    const volunteer = await authenticateVolunteer(email, password);

    if (!volunteer) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    const authToken = signVolunteerToken(String(volunteer._id));

    return res.status(200).json({
      success: true,
      token: authToken,
      data: {
        id: volunteer._id,
        name: volunteer.name,
        email: volunteer.email,
        volunteerId: volunteer.volunteerId,
        isProfileComplete: volunteer.isProfileComplete,
      },
    });
  } catch (error) {
    console.error("Volunteer login error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

// Returns the full profile plus a fresh signed URL for the photo (if
// one exists) — the frontend never sees or stores the raw S3 key.
export const getVolunteerProfileController = async (
  req: AuthenticatedVolunteerRequest,
  res: Response
) => {
  try {
    const volunteer = await getVolunteerById(req.volunteerId as string);

    if (!volunteer) {
      return res.status(404).json({ success: false, message: "Volunteer not found" });
    }

    const photoUrl = volunteer.photoKey
      ? await getSignedPhotoUrl(volunteer.photoKey)
      : undefined;

    return res.status(200).json({
      success: true,
      data: { ...volunteer.toObject(), photoUrl },
    });
  } catch (error) {
    console.error("Get volunteer profile error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

// Lets a volunteer (including one auto-created from a donation) fill in
// the sections that weren't captured at creation time — village,
// district, age, profession, interest area, contributions.
export const updateVolunteerProfileController = async (
  req: AuthenticatedVolunteerRequest,
  res: Response
) => {
  try {
    const { village, district, profession, age, interestArea, contributions } = req.body;

    const volunteer = await updateVolunteerProfile(req.volunteerId as string, {
      village,
      district,
      profession,
      age: age !== undefined ? Number(age) : undefined,
      interestArea,
      contributions,
    });

    if (!volunteer) {
      return res.status(404).json({ success: false, message: "Volunteer not found" });
    }

    return res.status(200).json({ success: true, data: volunteer });
  } catch (error) {
    console.error("Update volunteer profile error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

// Uploads a new profile photo, replacing any existing one. The old S3
// object is deleted in the background after the response is prepared —
// its failure is logged but never surfaces to the volunteer, since the
// new photo has already taken effect either way.
export const uploadVolunteerPhotoController = async (
  req: AuthenticatedVolunteerRequest,
  res: Response
) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Photo file is required" });
    }

    const resizedBuffer = await resizeForIdCard(req.file.buffer);
    const photoKey = buildS3Key(req.file.originalname, "volunteers");

    await uploadBufferToS3(photoKey, resizedBuffer, "image/jpeg");

    const { volunteer, oldPhotoKey } = await updateVolunteerPhoto(
      req.volunteerId as string,
      photoKey
    );

    if (!volunteer) {
      return res.status(404).json({ success: false, message: "Volunteer not found" });
    }

    if (oldPhotoKey) {
      deleteFromS3(oldPhotoKey).catch((err) =>
        console.error("Failed to delete old volunteer photo:", err)
      );
    }

    const photoUrl = await getSignedPhotoUrl(photoKey);

    return res.status(200).json({
      success: true,
      data: { ...volunteer.toObject(), photoUrl },
    });
  } catch (error) {
    console.error("Upload volunteer photo error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

// Removes the current profile photo. Idempotent — calling it when
// there's no photo simply returns the profile unchanged.
export const removeVolunteerPhotoController = async (
  req: AuthenticatedVolunteerRequest,
  res: Response
) => {
  try {
    const { volunteer, removedPhotoKey } = await removeVolunteerPhoto(req.volunteerId as string);

    if (!volunteer) {
      return res.status(404).json({ success: false, message: "Volunteer not found" });
    }

    if (removedPhotoKey) {
      deleteFromS3(removedPhotoKey).catch((err) =>
        console.error("Failed to delete volunteer photo:", err)
      );
    }

    return res.status(200).json({ success: true, data: volunteer.toObject() });
  } catch (error) {
    console.error("Remove volunteer photo error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

// Standalone endpoint for re-fetching just a fresh signed URL (e.g. once
// the one returned by /me has expired) without refetching the whole
// profile.
export const getVolunteerPhotoController = async (
  req: AuthenticatedVolunteerRequest,
  res: Response
) => {
  try {
    const volunteer = await getVolunteerById(req.volunteerId as string);

    if (!volunteer || !volunteer.photoKey) {
      return res.status(404).json({ success: false, message: "No photo uploaded" });
    }

    const photoUrl = await getSignedPhotoUrl(volunteer.photoKey);
    return res.status(200).json({ success: true, data: { photoUrl } });
  } catch (error) {
    console.error("Get volunteer photo error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};