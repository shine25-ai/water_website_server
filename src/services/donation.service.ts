import Donation from "../models/donation.model.js";
import type { IDonation, DonorType } from "../models/donation.model.js";

interface CreateDonationData {
  firstName: string;
  email: string;
  mobileNumber: string;
  donorType: DonorType;
  panOrGstNumber?: string;
  address: string;
  amount: number;
}

export const createDonation = async (
  data: CreateDonationData
): Promise<IDonation> => {
  return await Donation.create({ ...data, paymentStatus: "pending" });
};

export const getAllDonations = async (): Promise<IDonation[]> => {
  return await Donation.find().sort({ createdAt: -1 });
};

export const getDonationById = async (
  id: string
): Promise<IDonation | null> => {
  return await Donation.findById(id);
};

export const attachRazorpayOrder = async (
  donationId: string,
  razorpayOrderId: string
) => {
  return await Donation.findByIdAndUpdate(
    donationId,
    { razorpayOrderId },
    { new: true }
  );
};

export const markDonationPaid = async (
  donationId: string,
  razorpayPaymentId: string
) => {
  return await Donation.findByIdAndUpdate(
    donationId,
    { razorpayPaymentId, paymentStatus: "paid" },
    { new: true }
  );
};

// Invoice numbers look like NWRT-2026-000123 — year plus a running count of
// paid donations that year, so numbers stay short but still ordered and
// collision-free without a separate counters collection.
export const generateInvoiceNumber = async (): Promise<string> => {
  const year = new Date().getFullYear();
  const startOfYear = new Date(`${year}-01-01T00:00:00.000Z`);

  const countThisYear = await Donation.countDocuments({
    paymentStatus: "paid",
    createdAt: { $gte: startOfYear },
  });

  const sequence = String(countThisYear + 1).padStart(6, "0");
  return `NWRT-${year}-${sequence}`;
};

export const attachInvoiceNumber = async (
  donationId: string,
  invoiceNumber: string
) => {
  return await Donation.findByIdAndUpdate(
    donationId,
    { invoiceNumber },
    { new: true }
  );
};

export const markInvoiceEmailSent = async (donationId: string) => {
  return await Donation.findByIdAndUpdate(
    donationId,
    { invoiceEmailSent: true },
    { new: true }
  );
};

export const markDonationFailed = async (donationId: string) => {
  return await Donation.findByIdAndUpdate(
    donationId,
    { paymentStatus: "failed" },
    { new: true }
  );
};

// Sums the amount field (in rupees) across all successfully paid donations.
// Uses an aggregation pipeline so the total is computed in the DB, not
// pulled into Node and summed in JS (cheap now, but scales badly later).
export const getTotalRaisedAmount = async (): Promise<{
  totalAmount: number;
  donorCount: number;
}> => {
  const result = await Donation.aggregate([
    { $match: { paymentStatus: "paid" } },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: "$amount" },
        donorCount: { $sum: 1 },
      },
    },
  ]);

  if (result.length === 0) {
    return { totalAmount: 0, donorCount: 0 };
  }

  return {
    totalAmount: result[0].totalAmount,
    donorCount: result[0].donorCount,
  };
};