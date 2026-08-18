import DocumentRecord from "../models/Document.model.js";
import type { IDocumentRecord } from "../models/Document.model.js";

export const getAllDocuments = async (): Promise<IDocumentRecord[]> => {
  return await DocumentRecord.find().sort({ order: 1, createdAt: 1 });
};

export const getDocumentById = async (id: string): Promise<IDocumentRecord | null> => {
  return await DocumentRecord.findById(id);
};

interface CreateDocumentData {
  group: string;
  ta: string;
  en: string;
  icon: string;
  fileKey: string;
  fileUrl: string;
}

// New documents go to the end of the list — order is just "creation
// sequence" for now, no manual reordering yet.
export const createDocument = async (data: CreateDocumentData): Promise<IDocumentRecord> => {
  const count = await DocumentRecord.countDocuments();
  return await DocumentRecord.create({ ...data, order: count });
};

interface UpdateDocumentData {
  group?: string;
  ta?: string;
  en?: string;
  icon?: string;
  fileKey?: string;
  fileUrl?: string;
}

export const updateDocument = async (
  id: string,
  data: UpdateDocumentData
): Promise<IDocumentRecord | null> => {
  return await DocumentRecord.findByIdAndUpdate(id, { $set: data }, { new: true });
};

export const deleteDocument = async (id: string): Promise<IDocumentRecord | null> => {
  return await DocumentRecord.findByIdAndDelete(id);
};