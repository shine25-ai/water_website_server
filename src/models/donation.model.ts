import mongoose, { Document, Schema } from "mongoose";

export type DonorType = "CSR" | "Public" | "Party";

export interface IDonation extends Document {
  firstName: string;
  email: string;
  mobileNumber: string;
  donorType: DonorType;
  panOrGstNumber?: string;
  address: string;
  amount: number;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  paymentStatus: "pending" | "paid" | "failed";
  invoiceNumber?: string;
  invoiceEmailSent: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const donationSchema = new Schema<IDonation>(
  {
    firstName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    mobileNumber: { type: String, required: true, trim: true },
    donorType: {
      type: String,
      enum: ["CSR", "Public", "Party"],
      required: true,
    },
    panOrGstNumber: { type: String, required: false, trim: true, uppercase: true },
    address: { type: String, required: true, trim: true },
    amount: { type: Number, required: true },
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
    },
    invoiceNumber: { type: String },
    invoiceEmailSent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model<IDonation>("Donation", donationSchema);