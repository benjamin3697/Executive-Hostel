import { S3Client, GetObjectCommand, DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";
import { env } from "./env";

/**
 * Any S3-compatible provider works here unchanged - only .env values differ.
 * Configured by default for Backblaze B2's free tier (10GB storage + 1GB/day
 * download, no card required). Swapping to DigitalOcean Spaces or AWS S3
 * later is a credentials/endpoint change, not a code change.
 */
export const s3 = new S3Client({
  endpoint: env.s3Endpoint,
  region: env.s3Region,
  credentials: { accessKeyId: env.s3AccessKeyId, secretAccessKey: env.s3SecretAccessKey },
  forcePathStyle: true, // required by B2 and most non-AWS S3-compatible providers
});

const ALLOWED_EVIDENCE_TYPES = {
  image: ["image/jpeg", "image/png", "image/webp", "image/heic"],
  pdf: ["application/pdf"],
} as const;

export type EvidenceFileType = keyof typeof ALLOWED_EVIDENCE_TYPES;

/**
 * Generates a short-lived upload URL for files owned by the authenticated student.
 */
export async function createStorageUploadUrl(params: {
  studentId: string;
  purpose: "payment-evidence" | "maintenance-photos";
  contentType: string;
  contentLength: number;
}) {
  const { studentId, purpose, contentType, contentLength } = params;
  const fileType: EvidenceFileType = contentType === "application/pdf" ? "pdf" : "image";
  const allowedContentTypes = ALLOWED_EVIDENCE_TYPES[fileType];
  if (!allowedContentTypes.includes(contentType as never) || (purpose === "maintenance-photos" && fileType !== "image")) {
    throw new Error("Unsupported file type.");
  }
  const extensionByContentType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "application/pdf": "pdf",
  };
  const key = `${purpose}/${studentId}/${Date.now()}-${crypto.randomUUID()}.${extensionByContentType[contentType]}`;

  const url = await getSignedUrl(s3, 
    new PutObjectCommand({
      Bucket: env.s3Bucket,
      Key: key,
      ContentType: contentType,
      ContentLength: contentLength,
    }),
    { expiresIn: 300 } // presigned URL valid for 5 minutes
  );

  return { key, url, contentType, maxBytes: env.s3MaxUploadBytes };
}

/**
 * Short-lived signed GET URL to view a private evidence file. Generated
 * fresh per request (not cached/stored) so access can't outlive the
 * caller's authorization check - see payments.routes.ts, which only calls
 * this after confirming the requester is the submitting student, a
 * verifying admin, or the landlady (docs Section 58).
 *
 * Existing Supabase URLs are returned as-is so historical records keep working.
 */
export async function getEvidenceDownloadUrl(key: string): Promise<string> {
  // Already a full URL (e.g. Supabase public URL) — return as-is.
  if (key.startsWith("http://") || key.startsWith("https://")) {
    return key;
  }
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: env.s3Bucket, Key: key }), { expiresIn: 120 });
}

export async function deleteEvidenceObject(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: env.s3Bucket, Key: key }));
}
