import { randomUUID } from "crypto";
import {
  getImageClient,
  type ImageAspectRatio,
  type ImageSizeChoice,
} from "@/lib/google-genai";
import { saveLibraryImage } from "@/lib/library-store";

function getFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function toBase64(file: File) {
  return file.arrayBuffer().then((buffer) => Buffer.from(buffer).toString("base64"));
}

function isImageFile(file: File) {
  return file.type.startsWith("image/") || file.name.toLowerCase().endsWith(".png");
}

function normalizeSize(value: string): ImageSizeChoice {
  return value === "512" || value === "1K" || value === "2K" || value === "4K" ? value : "1K";
}

function normalizeRatio(value: string): ImageAspectRatio {
  const allowed: ImageAspectRatio[] = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"];
  return allowed.includes(value as ImageAspectRatio) ? (value as ImageAspectRatio) : "1:1";
}

type GeminiInlineResponse = {
  data?: string;
  candidates?: Array<{
    content?: {
      parts?: Array<{
        inlineData?: {
          data?: string;
          mimeType?: string;
        };
      }>;
    };
  }>;
};

function extractGeminiInlineImage(response: GeminiInlineResponse) {
  const parts = response.candidates?.flatMap((candidate) => candidate.content?.parts ?? []) ?? [];
  const firstImagePart = parts.find((part) => part.inlineData?.data && part.inlineData?.mimeType?.startsWith("image/"));

  if (firstImagePart?.inlineData?.data) {
    return {
      bytes: Buffer.from(firstImagePart.inlineData.data, "base64"),
      mimeType: firstImagePart.inlineData.mimeType ?? "image/png",
    };
  }

  if (response.data) {
    return {
      bytes: Buffer.from(response.data, "base64"),
      mimeType: "image/png",
    };
  }

  throw new Error("The Gemini image model returned no image bytes.");
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const model = getFormValue(formData, "model");
    const prompt = getFormValue(formData, "prompt");
    const aspectRatio = normalizeRatio(getFormValue(formData, "aspectRatio"));
    const imageSize = normalizeSize(getFormValue(formData, "imageSize"));
    const uploadFiles = formData
      .getAll("uploads")
      .filter((entry): entry is File => entry instanceof File && isImageFile(entry));
    const mode: "generate" | "edit" = uploadFiles.length > 0 ? "edit" : "generate";

    if (!model) {
      return Response.json({ error: "Select a model first." }, { status: 400 });
    }

    if (!prompt.trim()) {
      return Response.json({ error: "Prompt is required." }, { status: 400 });
    }

    const ai = getImageClient();
    const referenceCount = uploadFiles.length;

    const parts: Array<
      | { text: string }
      | {
          inlineData: {
            data: string;
            mimeType: string;
          };
        }
    > = [
      {
        text: prompt,
      },
    ];

    for (const uploadFile of uploadFiles) {
      const bytes = await toBase64(uploadFile);
      parts.push({
        inlineData: {
          data: bytes,
          mimeType: uploadFile.type || "image/png",
        },
      });
    }

    const response = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts }],
      config: {
        responseModalities: ["IMAGE", "TEXT"],
        imageConfig: {
          aspectRatio,
          imageSize,
        },
      },
    });

    const imageData = extractGeminiInlineImage(response as GeminiInlineResponse);
    const id = randomUUID();
    const savedItem = await saveLibraryImage({
      id,
      prompt,
      model,
      mode,
      aspectRatio,
      imageSize,
      bytes: imageData.bytes,
      referenceCount,
      mimeType: imageData.mimeType,
    });

    return Response.json({
      item: savedItem,
      previewUrl: `/api/library/${savedItem.id}/image`,
    });
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "Image generation failed.";
    const lower = rawMessage.toLowerCase();
    const message =
      lower.includes("not found") || lower.includes("not supported for predict")
        ? `${rawMessage} Select one of the fixed Nano Banana models from the dropdown.`
        : rawMessage;
    return Response.json({ error: message }, { status: 500 });
  }
}