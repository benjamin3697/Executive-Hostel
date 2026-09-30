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

  let uploadRequest: Awaited<ReturnType<typeof api.createStorageUploadUrl>>;
  try {
    uploadRequest = await api.createStorageUploadUrl({
      purpose,
      contentType: fileToUpload.type,
      contentLength: fileToUpload.size,
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error("Could not reach the API to prepare the upload. Check the API URL and Render CORS_ORIGINS settings.");
    }
    throw error;
  }
  const { key, url, contentType, maxBytes } = uploadRequest;
  if (fileToUpload.size > maxBytes) {
    throw new Error(`File is too large. Maximum size is ${Math.floor(maxBytes / 1024 / 1024)} MB.`);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: fileToUpload,
    });
  } catch {
    throw new Error(`Could not reach Backblaze B2. Configure the bucket CORS rule to allow PUT from ${window.location.origin} with the Content-Type header.`);
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Backblaze B2 rejected the upload (${response.status}). Check the bucket CORS rule, application key permissions, and signed headers. ${detail.slice(0, 240)}`);
  }
  return key;
}