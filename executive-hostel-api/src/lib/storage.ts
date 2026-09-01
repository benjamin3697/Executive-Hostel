import { S3Client, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
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
 * Generates a presigned POST policy so the student's browser uploads
 * directly to the bucket - the file's bytes never touch our API server.
 * The policy itself enforces the content-type and size limit; a request
 * that doesn't match gets rejected by the bucket, not by our code, so
 * there's no way to bypass the limit by calling the API differently.
 *
 * Returns the object key (store this on PaymentEvidence.fileUrl) plus the
 * { url, fields } the client POSTs the multipart form to.
 */
export async function createEvidenceUploadPost(params: { studentId: string; fileType: EvidenceFileType }) {
  const { studentId, fileType } = params;
  const allowedContentTypes = ALLOWED_EVIDENCE_TYPES[fileType];
  const extension = fileType === "pdf" ? "pdf" : "jpg";
  const key = `payment-evidence/${studentId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;

  const { url, fields } = await createPresignedPost(s3, {
    Bucket: env.s3Bucket,
    Key: key,
    Conditions: [
      ["content-length-range", 1, env.s3MaxUploadBytes],
      ["starts-with", "$Content-Type", fileType === "pdf" ? "application/pdf" : "image/"],
    ],
    Fields: {
      // Client must set this Content-Type field to one of allowedContentTypes;
      // the condition above only checks the prefix, so the client-facing docs
      // should still tell the student which exact types are accepted.
    },
    Expires: 300, // presigned policy is valid for 5 minutes
  });

  return { key, url, fields, allowedContentTypes, maxBytes: env.s3MaxUploadBytes };
}

/**
 * Short-lived signed GET URL to view a private evidence file. Generated
 * fresh per request (not cached/stored) so access can't outlive the
 * caller's authorization check - see payments.routes.ts, which only calls
 * this after confirming the requester is the submitting student, a
 * verifying admin, or the landlady (docs Section 58).
 */
export async function getEvidenceDownloadUrl(key: string): Promise<string> {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: env.s3Bucket, Key: key }), { expiresIn: 120 });
}

export async function deleteEvidenceObject(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: env.s3Bucket, Key: key }));
}
