import imageCompression from "browser-image-compression";
import { api } from "./api";

export type UploadPurpose = "payment-evidence" | "maintenance-photos";

export async function uploadFileToB2(file: File, purpose: UploadPurpose): Promise<string> {
  let fileToUpload = file;
  if (file.type.startsWith("image/")) {
    try {
      fileToUpload = await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      });
    } catch (error) {
      console.warn("Image compression failed; uploading the original file.", error);
    }
  }

  const { key, url, contentType, maxBytes } = await api.createStorageUploadUrl({
    purpose,
    contentType: fileToUpload.type,
    contentLength: fileToUpload.size,
  });
  if (fileToUpload.size > maxBytes) {
    throw new Error(`File is too large. Maximum size is ${Math.floor(maxBytes / 1024 / 1024)} MB.`);
  }

  const response = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: fileToUpload,
  });
  if (!response.ok) {
    throw new Error(`Upload to storage failed (${response.status}). Check the B2 bucket CORS settings and try again.`);
  }
  return key;
}