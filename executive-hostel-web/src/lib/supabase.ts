import { createClient } from "@supabase/supabase-js";
import imageCompression from "browser-image-compression";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Uploads a file to Supabase Storage with optional image compression.
 * Returns the public URL of the uploaded file.
 */
export async function uploadFileToSupabase(
  file: File,
  bucketName: string = "payment-evidence",
  compressionOptions?: {
    maxSizeMB?: number;
    maxWidthOrHeight?: number;
    useWebWorker?: boolean;
  }
): Promise<string> {
  try {
    let fileToUpload = file;

    // Compress image if it's an image file
    if (file.type.startsWith("image/")) {
      const options = {
        maxSizeMB: compressionOptions?.maxSizeMB ?? 1,
        maxWidthOrHeight: compressionOptions?.maxWidthOrHeight ?? 1920,
        useWebWorker: compressionOptions?.useWebWorker ?? true,
      };

      try {
        fileToUpload = await imageCompression(file, options);
        console.log(`Image compressed: ${(file.size / 1024 / 1024).toFixed(2)}MB → ${(fileToUpload.size / 1024 / 1024).toFixed(2)}MB`);
      } catch (compressionErr) {
        console.warn("Image compression failed, using original file:", compressionErr);
        // Continue with original file if compression fails
      }
    }

    // Generate unique file path
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 9);
    const originalName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filePath = `evidence/${timestamp}-${randomId}-${originalName}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage.from(bucketName).upload(filePath, fileToUpload, {
      cacheControl: "3600",
      upsert: false,
    });

    if (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(data.path);

    if (!publicUrlData?.publicUrl) {
      throw new Error("Could not generate public URL for uploaded file");
    }

    console.log("✅ File uploaded successfully to Supabase:", publicUrlData.publicUrl);
    return publicUrlData.publicUrl;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error during upload";
    throw new Error(`File upload failed: ${message}`);
  }
}
