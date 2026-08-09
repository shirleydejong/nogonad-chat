import { GoogleGenAI, MaskReferenceImage, MaskReferenceMode, RawReferenceImage, StyleReferenceImage, SubjectReferenceImage, type Image, type Model, type ReferenceImage } from "@google/genai";

export type ImageStudioMode = "generate" | "edit";

export type ImageAspectRatio = "1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "4:5" | "5:4" | "9:16" | "16:9" | "21:9";
export type ImageSizeChoice = "512" | "1K" | "2K" | "4K";

export type AvailableImageModel = {
  id: string;
  displayName: string;
  description?: string;
};

const FIXED_NANO_BANANA_MODELS: AvailableImageModel[] = [
  {
    id: "gemini-3.1-flash-lite-image",
    displayName: "Nano Banana 2 Lite",
    description: "gemini-3.1-flash-lite-image",
  },
  {
    id: "gemini-3.1-flash-image",
    displayName: "Nano Banana 2",
    description: "gemini-3.1-flash-image",
  },
  {
    id: "gemini-3-pro-image",
    displayName: "Nano Banana Pro",
    description: "gemini-3-pro-image",
  },
];

function getApiKey() {
  return process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENAI_API_KEY;
}

function createClient() {
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new Error("Set GOOGLE_API_KEY or GEMINI_API_KEY to use Google image generation.");
  }

  return new GoogleGenAI({ apiKey });
}

export async function getAvailableImageModels() {
  return { models: FIXED_NANO_BANANA_MODELS };
}

type BaseReferenceFile = {
  bytes: string;
  mimeType: string;
};

function createImage(file: BaseReferenceFile): Image {
  return {
    imageBytes: file.bytes,
    mimeType: file.mimeType,
  };
}

export function createRawReferenceImage(file: BaseReferenceFile) {
  const reference = new RawReferenceImage();
  reference.referenceImage = createImage(file);
  return reference;
}

export function createMaskReferenceImage(file: BaseReferenceFile) {
  const reference = new MaskReferenceImage();
  reference.referenceImage = createImage(file);
  reference.config = {
    maskMode: MaskReferenceMode.MASK_MODE_USER_PROVIDED,
  };
  return reference;
}

export function createStyleReferenceImage(file: BaseReferenceFile) {
  const reference = new StyleReferenceImage();
  reference.referenceImage = createImage(file);
  return reference;
}

export function createSubjectReferenceImage(file: BaseReferenceFile) {
  const reference = new SubjectReferenceImage();
  reference.referenceImage = createImage(file);
  return reference;
}

export function getImageClient() {
  return createClient();
}

export type { Model, ReferenceImage };