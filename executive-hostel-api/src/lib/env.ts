import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. Copy .env.example to .env and fill it in.`
    );
  }
  return value;
}

export const env = {
  databaseUrl: required("DATABASE_URL"),
  jwtAccessSecret: required("JWT_ACCESS_SECRET"),
  jwtRefreshSecret: required("JWT_REFRESH_SECRET"),
  jwtAccessTtl: process.env.JWT_ACCESS_TTL || "15m",
  jwtRefreshTtlDays: Number(process.env.JWT_REFRESH_TTL_DAYS || 30),
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || "development",
  corsOrigins: (process.env.CORS_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean),
  s3Endpoint: required("S3_ENDPOINT"),
  s3Region: required("S3_REGION"),
  s3Bucket: required("S3_BUCKET"),
  s3AccessKeyId: required("S3_ACCESS_KEY_ID"),
  s3SecretAccessKey: required("S3_SECRET_ACCESS_KEY"),
  s3MaxUploadBytes: Number(process.env.S3_MAX_UPLOAD_BYTES || 8 * 1024 * 1024),
  // Optional - deliberately NOT using required() here. The app should still
  // boot and be testable without email configured; sendEmail() falls back
  // to console logging when resendApiKey is empty (see lib/mailer.ts).
  resendApiKey: process.env.RESEND_API_KEY || "",
  emailFrom: process.env.EMAIL_FROM || "Executive Hostel <noreply@example.com>",
  appUrl: process.env.APP_URL || "http://localhost:5173",
  // Also optional, same reasoning as resendApiKey - falls back to console
  // logging in lib/sms.ts when unconfigured.
  atApiKey: process.env.AT_API_KEY || "",
  atUsername: process.env.AT_USERNAME || "sandbox",
};
