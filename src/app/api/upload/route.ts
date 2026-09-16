import { NextResponse } from "next/server";
import { getStorage } from "@/lib/server/storage";
import { ok, err } from "@/lib/server/api-response";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(err("VALIDATION", "Archivo requerido"), { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const ext = file.name.split(".").pop() ?? "bin";
    const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const contentType = file.type || "application/octet-stream";

    const storage = getStorage();
    const url = await storage.upload(buffer, filename, contentType);

    return NextResponse.json(ok({ url, filename, originalName: file.name }));
  } catch (error) {
    return NextResponse.json(
      err("INTERNAL", error instanceof Error ? error.message : "Error al subir"),
      { status: 500 },
    );
  }
}
