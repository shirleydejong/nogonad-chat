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

function buildGeminiInstruction(input: {
  mode: "generate" | "edit";
  prompt: string;
  aspectRatio: ImageAspectRatio;
  imageSize: ImageSizeChoice;
  hasMask: boolean;
}) {
  const lines = [
    `Task: ${input.mode === "edit" ? "edit an image" : "generate an image"}.`,
    `Prompt: ${input.prompt}`,
    `Target aspect ratio: ${input.aspectRatio}.`,
    `Target size hint: ${input.imageSize}.`,
    "Return an image result.",
  ];

  if (input.mode === "edit") {
    lines.push("Use uploaded reference images as source context for the edit.");
  }

  if (input.hasMask) {
    lines.push("The final uploaded image is an edit mask. Prefer edits inside the masked region.");
  }

  return lines.join("\n");
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const mode = getFormValue(formData, "mode") === "edit" ? "edit" : "generate";
    const model = getFormValue(formData, "model");
    const prompt = getFormValue(formData, "prompt");
    const aspectRatio = normalizeRatio(getFormValue(formData, "aspectRatio"));
    const imageSize = normalizeSize(getFormValue(formData, "imageSize"));
    const baseImage = formData.get("baseImage");
    const referenceFiles = formData
      .getAll("references")
      .filter((entry): entry is File => entry instanceof File && isImageFile(entry));
    const maskFile = formData.get("mask");

    if (!model) {
      return Response.json({ error: "Select a model first." }, { status: 400 });
    }

    if (!prompt.trim()) {
      return Response.json({ error: "Prompt is required." }, { status: 400 });
    }

    if (mode === "edit" && !(baseImage instanceof File && isImageFile(baseImage))) {
      return Response.json({ error: "Add a valid base image for edit mode." }, { status: 400 });
    }

    const ai = getImageClient();
    const referenceCount =
      (baseImage instanceof File ? 1 : 0) +
      referenceFiles.length +
      (maskFile instanceof File ? 1 : 0);

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
        text: buildGeminiInstruction({
          mode,
          prompt,
          aspectRatio,
          imageSize,
          hasMask: maskFile instanceof File,
        }),
      },
    ];

    if (mode === "edit" && baseImage instanceof File) {
      const baseBytes = await toBase64(baseImage);
      parts.push({
        inlineData: {
          data: baseBytes,
          mimeType: baseImage.type || "image/png",
        },
      });
    }

    for (const referenceFile of referenceFiles) {
      const bytes = await toBase64(referenceFile);
      parts.push({
        inlineData: {
          data: bytes,
          mimeType: referenceFile.type || "image/png",
        },
      });
    }

    if (maskFile instanceof File) {
      const maskBytes = await toBase64(maskFile);
      parts.push({
        inlineData: {
          data: maskBytes,
          mimeType: maskFile.type || "image/png",
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