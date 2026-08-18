import OverviewContent from "../models/Overview.model.js";
import type { IOverviewContent, IGoal } from "../models/Overview.model.js";

// Mirrors what OverviewSection.tsx currently has hardcoded — used to
// seed the document the very first time this is read, so the site keeps
// looking exactly the same before anyone has touched the admin editor.
const DEFAULT_OVERVIEW = {
  slug: "overview",
  sectionTitle: "எங்கள் நோக்கம்",
  sectionSubtitle: "நல்லதங்காள் 2.0 – நீர்வளம் புதுப்பொலிவு",
  goals: [
    { icon: "tree-pine", label: "சீமைக்கருவேல் அகற்றுதல்" },
    { icon: "construction", label: "அணை தூர்வாருதல்" },
    { icon: "waves", label: "நீர்வரத்து வாய்க்கால் சீரமைப்பு" },
    { icon: "wheat", label: "பாசனப் பயன்பாடு மேம்படுதல்" },
    { icon: "droplet", label: "நிலத்தடி நீர் உயர்வு" },
    { icon: "users", label: "மக்கள் பங்கேற்பு" },
  ] as IGoal[],
  transformationBadge: "நல்லதங்காள் 1.0 → 2.0",
  beforeLabel: "Before (1.0)",
  beforeCaption: "வறண்டு மேடான அணை",
  afterLabel: "After (2.0)",
  checklistTitle: "நல்லதங்காள் 2.0 – முழுமையான மறுசீரமைப்பு",
  checklist: [
    "முழு அணை பகுதி சீமைக்கருவேல் அகற்றுதல்",
    "வண்டல் மண் அகற்றுதல் (தூர்வாருதல்)",
    "கரை பாதுகாப்பு & நீர்த்தேக்க திறன் மேம்பாடு",
    "நீர்பிடிப்பு பகுதிகளில் பசுமை வளர்ப்பு",
  ],
};

export const getOverview = async (): Promise<IOverviewContent> => {
  const existing = await OverviewContent.findOne({ slug: "overview" });
  if (existing) return existing;
  return await OverviewContent.create(DEFAULT_OVERVIEW);
};

interface UpdateOverviewData {
  sectionTitle?: string;
  sectionSubtitle?: string;
  goals?: IGoal[];
  transformationBadge?: string;
  beforeLabel?: string;
  beforeCaption?: string;
  beforeImageKey?: string;
  beforeImageUrl?: string;
  afterLabel?: string;
  afterImageKey?: string;
  afterImageUrl?: string;
  checklistTitle?: string;
  checklist?: string[];
}

export const updateOverview = async (
  data: UpdateOverviewData
): Promise<IOverviewContent> => {
  return (await OverviewContent.findOneAndUpdate(
    { slug: "overview" },
    { $set: data },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  )) as IOverviewContent;
};

// Used before an image replace, to know what old S3 keys need cleaning
// up afterwards — a lightweight read that doesn't pull the whole doc.
export const getOverviewImageKeys = async (): Promise<{
  beforeImageKey?: string;
  afterImageKey?: string;
}> => {
  const doc = await OverviewContent.findOne(
    { slug: "overview" },
    "beforeImageKey afterImageKey"
  );
  return {
    beforeImageKey: doc?.beforeImageKey,
    afterImageKey: doc?.afterImageKey,
  };
};