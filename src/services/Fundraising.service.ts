import FundraisingContent from "../models/Fundraising.model.js";
import type { IFundraisingContent, IFundUsageItem } from "../models/Fundraising.model.js";

// Mirrors what FundraisingSection.tsx currently has hardcoded — seeds the
// document the first time it's read, so the site looks the same before
// anyone touches the admin editor.
const DEFAULT_FUNDRAISING = {
  slug: "fundraising",
  targetCrore: 25,
  daysGoal: 300,
  goalQuote: "நினைத்ததை செய்து முடிப்போம்!",
  fundUsage: [
    { label: "சீமைக்கருவேல் அகற்றுதல்", percent: 30, color: "#f5a623" },
    { label: "தூர்வாருதல்", percent: 40, color: "#2f7fd6" },
    { label: "சமைப்பு பணிகள்", percent: 15, color: "#3fae4e" },
    { label: "பராமரிப்பு", percent: 10, color: "#29a3c9" },
    { label: "தரவு / ஆய்வு & நிர்வாகம்", percent: 5, color: "#8e44ad" },
  ] as IFundUsageItem[],
};

export const getFundraising = async (): Promise<IFundraisingContent> => {
  const existing = await FundraisingContent.findOne({ slug: "fundraising" });
  if (existing) return existing;
  return await FundraisingContent.create(DEFAULT_FUNDRAISING);
};

interface UpdateFundraisingData {
  targetCrore?: number;
  daysGoal?: number;
  campaignStartDate?: Date;
  goalQuote?: string;
  fundUsage?: IFundUsageItem[];
  bannerImageKey?: string;
  bannerImageUrl?: string;
}

export const updateFundraising = async (
  data: UpdateFundraisingData
): Promise<IFundraisingContent> => {
  return (await FundraisingContent.findOneAndUpdate(
    { slug: "fundraising" },
    { $set: data },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  )) as IFundraisingContent;
};

// Used before a banner replace, to know what old S3 key needs cleaning up.
export const getFundraisingImageKey = async (): Promise<{ bannerImageKey?: string }> => {
  const doc = await FundraisingContent.findOne({ slug: "fundraising" }, "bannerImageKey");
  return { bannerImageKey: doc?.bannerImageKey };
};