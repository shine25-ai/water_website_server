import mongoose, { Document, Schema } from "mongoose";

export interface IFundUsageItem {
  label: string;
  percent: number;
  color: string; // hex color used for the donut slice + legend swatch
}

export interface IFundraisingContent extends Document {
  slug: string;
  targetCrore: number;
  daysGoal: number;
  campaignStartDate: Date;
  goalQuote: string;
  bannerImageKey?: string;
  bannerImageUrl?: string;
  fundUsage: IFundUsageItem[];
  createdAt: Date;
  updatedAt: Date;
}

const fundUsageSchema = new Schema<IFundUsageItem>(
  {
    label: { type: String, required: true, trim: true },
    percent: { type: Number, required: true, min: 0, max: 100 },
    color: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const fundraisingContentSchema = new Schema<IFundraisingContent>(
  {
    // Singleton document, same pattern as OverviewContent.
    slug: { type: String, required: true, unique: true, default: "fundraising" },
    targetCrore: { type: Number, required: true, default: 25 },
    daysGoal: { type: Number, required: true, default: 300 },
    // Day 1 of the "300-day mission" countdown — days elapsed is computed
    // from this on the frontend, so no separate "current day" field needs
    // updating by hand.
    campaignStartDate: { type: Date, required: true, default: Date.now },
    goalQuote: { type: String, trim: true },
    bannerImageKey: { type: String },
    bannerImageUrl: { type: String },
    fundUsage: { type: [fundUsageSchema], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model<IFundraisingContent>(
  "FundraisingContent",
  fundraisingContentSchema
);