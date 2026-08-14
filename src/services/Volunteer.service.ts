import Volunteer from "../models/Volunteer.model.js";
import type { IVolunteer } from "../models/Volunteer.model.js";

interface CreateVolunteerData {
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
  const volunteerId = await generateVolunteerId();
  return await Volunteer.create({ ...data, volunteerId });
};

export const getVolunteerById = async (
  id: string
): Promise<IVolunteer | null> => {
  return await Volunteer.findById(id);
};

export const getAllVolunteers = async (): Promise<IVolunteer[]> => {
  return await Volunteer.find().sort({ createdAt: -1 });
};