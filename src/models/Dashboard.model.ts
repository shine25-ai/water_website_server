import mongoose, { Document, Schema } from "mongoose";

export interface IDashboardContent extends Document {
  slug: string;
  targetAmount: string;
  collectedAmount: string;
  percentCompleted: number;
  acresCleared: string;
  tonnesDesilted: string;
  volunteersJoined: string;
  createdAt: Date;
  updatedAt: Date;
}

const dashboardContentSchema = new Schema<IDashboardContent>(
  {
    // Singleton document, same pattern as OverviewContent / FundraisingContent.
    slug: { type: String, required: true, unique: true, default: "dashboard" },
    targetAmount: { type: String, required: true, trim: true, default: "₹25 Cr" },
    collectedAmount: { type: String, required: true, trim: true, default: "₹0" },
    percentCompleted: { type: Number, required: true, min: 0, max: 100, default: 0 },
    acresCleared: { type: String, required: true, trim: true, default: "0" },
    tonnesDesilted: { type: String, required: true, trim: true, default: "0" },
    volunteersJoined: { type: String, required: true, trim: true, default: "0" },
  },
  { timestamps: true }
);

export default mongoose.model<IDashboardContent>(
  "DashboardContent",
  dashboardContentSchema
);