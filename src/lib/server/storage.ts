import 'server-only';

import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname, join, resolve, sep } from "path";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

/** Contenido leido de un archivo almacenado. */
export interface ArchivoAlmacenado {
  bytes: Buffer;
  /** Content-Type con el que se guardo (S3); null si el backend no lo conoce. */
  contentType: string | null;
}

/**
 * Puerto de almacenamiento de archivos subidos (adaptador local/EFS o S3).
 * La URL publica SIEMPRE usa el esquema `/uploads/<filename>`: los renderizadores,
 * la BD y los lectores no saben ni les importa donde vive el archivo.
 */
export interface StorageAdapter {
  upload(buffer: Buffer, filename: string, contentType: string): Promise<string>;
  /** Lee un archivo por su clave relativa (sin `/uploads/`); null si no existe. */
  read(filename: string): Promise<ArchivoAlmacenado | null>;
}

const UPLOADS_DIR = join(process.cwd(), "public", "uploads");

/** Resuelve una clave dentro de uploads evitando escapes de ruta; null si es invalida. */
function rutaLocalSegura(filename: string): string | null {
  const base = resolve(UPLOADS_DIR);
  const filepath = resolve(base, filename);
  if (filepath !== base && !filepath.startsWith(base + sep)) return null;
  return filepath;
}

const localAdapter: StorageAdapter = {
  async upload(buffer, filename) {
    const filepath = rutaLocalSegura(filename);
    if (!filepath) throw new Error("Ruta de archivo invalida");
    await mkdir(dirname(filepath), { recursive: true });
    await writeFile(filepath, buffer);
    return `/uploads/${filename}`;
  },
  async read(filename) {
    const filepath = rutaLocalSegura(filename);
    if (!filepath) return null;
    try {
      return { bytes: await readFile(filepath), contentType: null };
    } catch {
      return null;
    }
  },
};

/* Cliente S3 perezoso: credenciales por el chain por defecto (task role en ECS;
 * variables de entorno en local). Bucket privado: sin ACL y con firma (SDK v3). */
let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (s3Client) return s3Client;
  const endpoint = process.env.S3_ENDPOINT?.trim();
  s3Client = new S3Client({
    region: process.env.S3_REGION ?? "us-east-1",
    ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
  });
  return s3Client;
}

function bucketS3(): string {
  const bucket = process.env.S3_BUCKET ?? "";
  if (!bucket) throw new Error("S3_BUCKET es requerido con STORAGE_PROVIDER=s3");
  return bucket;
}

const s3Adapter: StorageAdapter = {
  async upload(buffer, filename, contentType) {
    await getS3Client().send(
      new PutObjectCommand({
        Bucket: bucketS3(),
        Key: filename,
        Body: buffer,
        ContentType: contentType || undefined,
      }),
    );
    return `/uploads/${filename}`;
  },
  async read(filename) {
    try {
      const res = await getS3Client().send(new GetObjectCommand({ Bucket: bucketS3(), Key: filename }));
      const bytes = Buffer.from(await res.Body!.transformToByteArray());
      return { bytes, contentType: res.ContentType ?? null };
    } catch (error) {
      const nombre = (error as { name?: string }).name;
      if (nombre === "NoSuchKey" || nombre === "NotFound") return null;
      throw error;
    }
  },
};

export function getStorage(): StorageAdapter {
  if (process.env.STORAGE_PROVIDER === "s3") {
    return s3Adapter;
  }
  return localAdapter;
}
