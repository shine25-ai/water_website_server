import DashboardContent from "../models/Dashboard.model.js";
import type { IDashboardContent } from "../models/Dashboard.model.js";

// Mirrors what ProjectDashboard.tsx currently has hardcoded — seeds the
// document the first time it's read, so the site looks the same before
// anyone touches the admin editor.
const DEFAULT_DASHBOARD = {
  slug: "dashboard",
  targetAmount: "₹25 Cr",
  collectedAmount: "₹0",
  percentCompleted: 0,
  acresCleared: "0",
  tonnesDesilted: "0",
  volunteersJoined: "0",
};

export const getDashboard = async (): Promise<IDashboardContent> => {
  const existing = await DashboardContent.findOne({ slug: "dashboard" });
  if (existing) return existing;
  return await DashboardContent.create(DEFAULT_DASHBOARD);
};

interface UpdateDashboardData {
  targetAmount?: string;
  collectedAmount?: string;
  percentCompleted?: number;
  acresCleared?: string;
  tonnesDesilted?: string;
  volunteersJoined?: string;
}

export const updateDashboard = async (
  data: UpdateDashboardData
): Promise<IDashboardContent> => {
  return (await DashboardContent.findOneAndUpdate(
    { slug: "dashboard" },
    { $set: data },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  )) as IDashboardContent;
};