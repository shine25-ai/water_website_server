import mongoose, { Document, Schema } from "mongoose";

export interface IVolunteer extends Document {
  name: string;
  email: string;
  mobile: string;
  village: string;
  district: string;
  profession?: string;
  age: number;
  interestArea?: string;
  contributions: string[];
  photoKey?: string;
  volunteerId: string;
  createdAt: Date;
  updatedAt: Date;
}

const volunteerSchema = new Schema<IVolunteer>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    mobile: { type: String, required: true, trim: true },
    village: { type: String, required: true, trim: true },
    district: { type: String, required: true, trim: true },
    profession: { type: String, trim: true },
    age: { type: Number, required: true },
    interestArea: { type: String, trim: true },
    contributions: { type: [String], default: [] },
    // S3 object key (e.g. "volunteers/<uuid>.jpg") — not a public URL.
    // The bucket stays private; the key is resolved back into bytes or a
    // signed URL on demand, server-side.
    photoKey: { type: String },
    // Human-facing unique ID printed on the card, e.g. NWRT-VOL-2026-000123
    volunteerId: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

export default mongoose.model<IVolunteer>("Volunteer", volunteerSchema);