import 'server-only';

import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

export interface StorageAdapter {
  upload(buffer: Buffer, filename: string, contentType: string): Promise<string>;
}

const localAdapter: StorageAdapter = {
  async upload(buffer, filename) {
    const dir = join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    const filepath = join(dir, filename);
    await writeFile(filepath, buffer);
    return `/uploads/${filename}`;
  },
};

const s3Adapter: StorageAdapter = {
  async upload(buffer, filename, contentType) {
    const bucket = process.env.S3_BUCKET ?? "";
    const region = process.env.S3_REGION ?? "us-east-1";
    const endpoint = process.env.S3_ENDPOINT ?? "";

    if (!bucket || !endpoint) {
      throw new Error("S3_BUCKET y S3_ENDPOINT son requeridos en produccion");
    }

    const url = endpoint.includes("amazonaws")
      ? `https://${bucket}.s3.${region}.amazonaws.com/${filename}`
      : `${endpoint}/${bucket}/${filename}`;

    const res = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
        "x-amz-acl": "public-read",
      },
      body: new Uint8Array(buffer) as BodyInit,
    });

    if (!res.ok) {
      throw new Error(`S3 upload failed: ${res.status}`);
    }

    return url;
  },
};

export function getStorage(): StorageAdapter {
  if (process.env.STORAGE_PROVIDER === "s3") {
    return s3Adapter;
  }
  return localAdapter;
}
