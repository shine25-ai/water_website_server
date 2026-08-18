import NewsUpdate from "../models/Newsupdate.model.js";
import type { INewsUpdate } from "../models/Newsupdate.model.js";

// Mirrors what NewsUpdates.tsx currently has hardcoded — seeds the
// collection the first time it's read, so the site looks unchanged
// before anyone edits anything from the admin. Order 3 = top of the
// list, matching the original array's first-to-last order.
const DEFAULT_UPDATES = [
  { date: "10 Aug 2026", title: "நல்லதங்காள் 2.0 – திட்ட அறிமுகம்", order: 3 },
  { date: "XX Aug 2026", title: "விவசாயிகள் மற்றும் கிராம மக்களுடன் ஆலோசனை", order: 2 },
  { date: "XX Sep 2026", title: "சீமைக்கருவேல் அகற்றும் பணி தொடக்கம்", order: 1 },
  { date: "XX Oct 2026", title: "தூர்வாரும் பணி தொடக்கம்", order: 0 },
];

export const getAllNewsUpdates = async (): Promise<INewsUpdate[]> => {
  const existing = await NewsUpdate.find().sort({ order: -1, createdAt: -1 });
  if (existing.length > 0) return existing;

  await NewsUpdate.insertMany(DEFAULT_UPDATES);
  return await NewsUpdate.find().sort({ order: -1, createdAt: -1 });
};

const getNextOrder = async (): Promise<number> => {
  const top = await NewsUpdate.findOne().sort({ order: -1 });
  return (top?.order ?? -1) + 1;
};

interface CreateNewsUpdateData {
  date: string;
  title: string;
  order?: number;
}

export const createNewsUpdate = async (
  data: CreateNewsUpdateData
): Promise<INewsUpdate> => {
  const order = data.order ?? (await getNextOrder());
  return await NewsUpdate.create({ date: data.date, title: data.title, order });
};

interface UpdateNewsUpdateData {
  date?: string;
  title?: string;
  order?: number;
}

export const updateNewsUpdate = async (
  id: string,
  data: UpdateNewsUpdateData
): Promise<INewsUpdate | null> => {
  return await NewsUpdate.findByIdAndUpdate(id, { $set: data }, { new: true });
};

export const deleteNewsUpdate = async (id: string): Promise<INewsUpdate | null> => {
  return await NewsUpdate.findByIdAndDelete(id);
};