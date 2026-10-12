import mongoose, { Document, Schema } from "mongoose";

// Default copy = exactly what the About page showed when it was hardcoded,
// so the page looks identical until an admin edits something.
export const DEFAULT_ABOUT_CONTENT = {
  heroEyebrow: "09 / எங்களைப் பற்றி",
  heroTitle: "நல்லதங்காள் அணை மறுசீரமைப்பு — ஒரு மக்கள் இயக்கம்",
  heroDescription:
    "எங்கள் தன்னார்வலர்கள் கிராமங்கள் மற்றும் மாவட்டங்கள் முழுவதும் இந்த இயக்கத்தை முன்னெடுத்துச் செல்கிறார்கள். பதிவு செய்து, சுயவிவரத்தை நிறைவு செய்த ஒவ்வொரு தன்னார்வலரும் கீழே காட்டப்படுகிறார்கள்.",
  leadersTitle: "Leadership",
  leadersSubtitle: "The people guiding this movement",
  leaderLabel: "Leader",
  coLeaderLabel: "Co-Leaders",
  representativeLabel: "Representatives",
  volunteersTitle: "Volunteers",
  volunteersSubtitle: "The people carrying this movement forward",
};

export type AboutContentFields = typeof DEFAULT_ABOUT_CONTENT;

// Whitelist of editable keys — the controller only ever copies these
// from the request body, so nothing else can be written to the document.
export const ABOUT_CONTENT_KEYS = Object.keys(
  DEFAULT_ABOUT_CONTENT
) as Array<keyof AboutContentFields>;

export interface IAboutContent extends Document, AboutContentFields {
  createdAt: Date;
  updatedAt: Date;
}

const textField = (def: string) => ({ type: String, default: def, trim: true });

// Singleton: the app only ever reads/writes the first document.
const aboutContentSchema = new Schema<IAboutContent>(
  {
    heroEyebrow: textField(DEFAULT_ABOUT_CONTENT.heroEyebrow),
    heroTitle: textField(DEFAULT_ABOUT_CONTENT.heroTitle),
    heroDescription: textField(DEFAULT_ABOUT_CONTENT.heroDescription),
    leadersTitle: textField(DEFAULT_ABOUT_CONTENT.leadersTitle),
    leadersSubtitle: textField(DEFAULT_ABOUT_CONTENT.leadersSubtitle),
    leaderLabel: textField(DEFAULT_ABOUT_CONTENT.leaderLabel),
    coLeaderLabel: textField(DEFAULT_ABOUT_CONTENT.coLeaderLabel),
    representativeLabel: textField(DEFAULT_ABOUT_CONTENT.representativeLabel),
    volunteersTitle: textField(DEFAULT_ABOUT_CONTENT.volunteersTitle),
    volunteersSubtitle: textField(DEFAULT_ABOUT_CONTENT.volunteersSubtitle),
  },
  { timestamps: true }
);

export default mongoose.model<IAboutContent>("AboutContent", aboutContentSchema);