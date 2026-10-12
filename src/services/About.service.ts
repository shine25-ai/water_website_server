import AboutContent from "../models/AboutContent.model.js";
import type {
  IAboutContent,
  AboutContentFields,
} from "../models/AboutContent.model.js";
import Leader from "../models/Leader.model.js";
import type { ILeader, LeaderRole } from "../models/Leader.model.js";

export interface LeaderInput {
  name?: string;
  role?: LeaderRole;
  designation?: string;
  location?: string;
  bio?: string;
  order?: number;
}

// Creates the singleton with schema defaults on first read.
export const getAboutContent = async (): Promise<IAboutContent> => {
  let doc = await AboutContent.findOne();
  if (!doc) doc = await AboutContent.create({});
  return doc;
};

export const updateAboutContent = async (
  patch: Partial<AboutContentFields>
): Promise<IAboutContent> => {
  const doc = await getAboutContent();
  Object.assign(doc, patch);
  await doc.save();
  return doc;
};

export const listLeaders = async (): Promise<ILeader[]> => {
  return await Leader.find().sort({ order: 1, createdAt: 1 });
};

export const createLeader = async (
  data: LeaderInput & { name: string; role: LeaderRole; photoKey?: string }
): Promise<ILeader> => {
  return await Leader.create(data);
};

// Swaps/removes the photo key and hands back the previous one so the
// caller can delete the old S3 object AFTER the DB write succeeds — a
// failed cleanup never blocks the edit itself.
export const updateLeader = async (
  id: string,
  data: LeaderInput,
  photo: { newKey?: string; remove?: boolean }
): Promise<{ leader: ILeader | null; oldPhotoKey?: string }> => {
  const leader = await Leader.findById(id);
  if (!leader) return { leader: null };

  let oldPhotoKey: string | undefined;
  Object.assign(leader, data);

  if (photo.newKey) {
    oldPhotoKey = leader.photoKey;
    leader.photoKey = photo.newKey;
  } else if (photo.remove && leader.photoKey) {
    oldPhotoKey = leader.photoKey;
    leader.photoKey = undefined;
  }

  await leader.save();
  return { leader, oldPhotoKey };
};

export const deleteLeader = async (id: string): Promise<ILeader | null> => {
  return await Leader.findByIdAndDelete(id);
};