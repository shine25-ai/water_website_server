import mongoose, { Document, Schema } from "mongoose";

export type VolunteerAccountStatus = "pending" | "active";
export type VolunteerSource = "self" | "donation";

export interface IVolunteer extends Document {
  name: string;
  email: string;
  mobile: string;
  village?: string;
  district?: string;
  profession?: string;
  age?: number;
  interestArea?: string;
  contributions: string[];
  photoKey?: string;
  volunteerId: string;

  // Auth
  password?: string;
  passwordSetToken?: string;
  passwordSetTokenExpires?: Date;
  accountStatus: VolunteerAccountStatus;

  // Profile completeness / provenance
  isProfileComplete: boolean;
  source: VolunteerSource;

  createdAt: Date;
  updatedAt: Date;
}

const volunteerSchema = new Schema<IVolunteer>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    mobile: { type: String, required: true, trim: true },

    // Optional at creation time — a volunteer auto-created from a donation
    // won't have these yet. isProfileComplete tracks whether they've since
    // filled the rest of the profile in.
    village: { type: String, trim: true },
    district: { type: String, trim: true },
    profession: { type: String, trim: true },
    age: { type: Number },
    interestArea: { type: String, trim: true },
    contributions: { type: [String], default: [] },

    // S3 object key (e.g. "volunteers/<uuid>.jpg") — not a public URL.
    photoKey: { type: String },

    // Human-facing unique ID printed on the card, e.g. NWRT-VOL-2026-000123
    volunteerId: { type: String, required: true, unique: true },

    // Auth — password/tokens are never returned by default; pull them in
    // explicitly with .select("+password") etc. when actually needed.
    password: { type: String, select: false },
    passwordSetToken: { type: String, select: false },
    passwordSetTokenExpires: { type: Date, select: false },
    accountStatus: {
      type: String,
      enum: ["pending", "active"],
      default: "pending",
    },

    isProfileComplete: { type: Boolean, default: false },
    source: {
      type: String,
      enum: ["self", "donation"],
      default: "self",
    },
  },
  { timestamps: true }
);

export default mongoose.model<IVolunteer>("Volunteer", volunteerSchema);