import Volunteer from "../models/Volunteer.model.js";
import type { IVolunteer } from "../models/Volunteer.model.js";
import {
  hashPassword,
  comparePassword,
  generatePasswordSetToken,
  hashRawToken,
} from "../utils/volunteerAuth.util.js";

interface CreateVolunteerData {
  name: string;
  email: string;
  mobile: string;
  village?: string;
  district?: string;
  profession?: string;
  age?: number;
  interestArea?: string;
  contributions?: string[];
  photoKey?: string;
  volunteerId: string;
}

// Volunteer IDs look like NWRT-VOL-2026-000123 — year plus a running count
// of volunteers registered that year, mirroring the donation invoice
// numbering scheme so both stay consistent and collision-free without a
// separate counters collection.
export const generateVolunteerId = async (): Promise<string> => {
  const year = new Date().getFullYear();
  const startOfYear = new Date(`${year}-01-01T00:00:00.000Z`);

  const countThisYear = await Volunteer.countDocuments({
    createdAt: { $gte: startOfYear },
  });

  const sequence = String(countThisYear + 1).padStart(6, "0");
  return `NWRT-VOL-${year}-${sequence}`;
};

export const createVolunteer = async (
  data: CreateVolunteerData
): Promise<IVolunteer> => {
  return await Volunteer.create(data);
};

export const getVolunteerById = async (
  id: string
): Promise<IVolunteer | null> => {
  return await Volunteer.findById(id);
};

export const getAllVolunteers = async (): Promise<IVolunteer[]> => {
  return await Volunteer.find().sort({ createdAt: -1 });
};

// Used by the donation flow to check whether a donor is already a
// registered volunteer, matching on either email or mobile since donors
// sometimes reuse a family member's phone but their own email, or vice
// versa.
export const findVolunteerByEmailOrMobile = async (
  email: string,
  mobile: string
): Promise<IVolunteer | null> => {
  return await Volunteer.findOne({
    $or: [{ email: email.toLowerCase().trim() }, { mobile: mobile.trim() }],
  });
};

// Auto-creates a volunteer record from donation details when a donor
// isn't already one. Village/district/age aren't known yet, so
// isProfileComplete stays false until the donor fills those in later.
// Returns the raw password-set token so the caller can email it — only
// the hashed version is ever persisted.
export const createVolunteerFromDonation = async (data: {
  name: string;
  email: string;
  mobile: string;
}): Promise<{ volunteer: IVolunteer; rawToken: string }> => {
  const volunteerId = await generateVolunteerId();
  const { rawToken, hashedToken, expires } = generatePasswordSetToken();

  const volunteer = await Volunteer.create({
    name: data.name,
    email: data.email,
    mobile: data.mobile,
    volunteerId,
    source: "donation",
    accountStatus: "pending",
    isProfileComplete: false,
    passwordSetToken: hashedToken,
    passwordSetTokenExpires: expires,
  });

  return { volunteer, rawToken };
};

// Consumes a password-set token (from the welcome/reset email link),
// hashes and stores the new password, activates the account, and clears
// the token so it can't be reused.
export const setVolunteerPassword = async (
  rawToken: string,
  newPassword: string
): Promise<IVolunteer | null> => {
  const hashedToken = hashRawToken(rawToken);

  const volunteer = await Volunteer.findOne({
    passwordSetToken: hashedToken,
    passwordSetTokenExpires: { $gt: new Date() },
  }).select("+passwordSetToken +passwordSetTokenExpires");

  if (!volunteer) {
    return null;
  }

  volunteer.password = await hashPassword(newPassword);
  volunteer.accountStatus = "active";
  volunteer.passwordSetToken = undefined;
  volunteer.passwordSetTokenExpires = undefined;
  await volunteer.save();

  return volunteer;
};

// Verifies email + password for volunteer login. Returns null on any
// mismatch (unknown email, no password set yet, wrong password) — the
// controller gives one generic "invalid credentials" response either
// way, so this never leaks which part failed.
export const authenticateVolunteer = async (
  email: string,
  password: string
): Promise<IVolunteer | null> => {
  const volunteer = await Volunteer.findOne({
    email: email.toLowerCase().trim(),
  }).select("+password");

  if (!volunteer || !volunteer.password) {
    return null;
  }

  const isMatch = await comparePassword(password, volunteer.password);
  return isMatch ? volunteer : null;
};

interface UpdateVolunteerProfileData {
  village?: string;
  district?: string;
  profession?: string;
  age?: number;
  interestArea?: string;
  contributions?: string[];
}

// A profile counts as "complete" once the fields the original volunteer
// form required are filled in — village, district and age. Everything
// else stays optional.
export const updateVolunteerProfile = async (
  volunteerId: string,
  data: UpdateVolunteerProfileData
): Promise<IVolunteer | null> => {
  const volunteer = await Volunteer.findById(volunteerId);
  if (!volunteer) return null;

  Object.assign(volunteer, data);

  volunteer.isProfileComplete = Boolean(
    volunteer.village && volunteer.district && volunteer.age
  );

  await volunteer.save();
  return volunteer;
};

// Swaps in a new photo key and hands back the previous one so the
// caller can clean it up from S3 after the DB write succeeds — cleanup
// happening after, not before, means a failed old-photo delete never
// blocks the new photo from taking effect.
export const updateVolunteerPhoto = async (
  volunteerId: string,
  photoKey: string
): Promise<{ volunteer: IVolunteer | null; oldPhotoKey?: string }> => {
  const volunteer = await Volunteer.findById(volunteerId);
  if (!volunteer) return { volunteer: null };

  const oldPhotoKey = volunteer.photoKey;
  volunteer.photoKey = photoKey;
  await volunteer.save();

  return { volunteer, oldPhotoKey };
};

// Clears the photo reference entirely (used by the "remove photo"
// action). Returns the removed key so the caller can delete the S3
// object; returns null if there was nothing to remove.
export const removeVolunteerPhoto = async (
  volunteerId: string
): Promise<{ volunteer: IVolunteer | null; removedPhotoKey: string | null }> => {
  const volunteer = await Volunteer.findById(volunteerId);
  if (!volunteer) return { volunteer: null, removedPhotoKey: null };

  const removedPhotoKey = volunteer.photoKey ?? null;
  volunteer.photoKey = undefined;
  await volunteer.save();

  return { volunteer, removedPhotoKey };
};


// Self-signup path, mirroring createVolunteerFromDonation but using the
// full details the volunteer actually typed in (not just name/email/
// mobile) — so a self-registered volunteer's profile is already
// complete on day one instead of needing a later PUT /me. Sends back
// the raw token so the caller can email the same "set your password"
// invitation the donation flow uses.
export const registerVolunteerSelf = async (
  data: CreateVolunteerData
): Promise<{ volunteer: IVolunteer; rawToken: string }> => {
  const { rawToken, hashedToken, expires } = generatePasswordSetToken();

  const volunteer = await Volunteer.create({
    ...data,
    source: "self",
    accountStatus: "pending",
    isProfileComplete: Boolean(data.village && data.district && data.age),
    passwordSetToken: hashedToken,
    passwordSetTokenExpires: expires,
  });

  return { volunteer, rawToken };
};