import { NextResponse } from "next/server";
import { success, error } from "@/lib/api-response";
import { API_ERROR_CODES } from "@/lib/constants";

const TOKEN = process.env.SUNAT_API_TOKEN as string;
if (!TOKEN) throw new Error("SUNAT_API_TOKEN no definida");

export const sunatController = {
  async consultarRuc(request: Request): Promise<NextResponse> {
    const { searchParams } = new URL(request.url);
    const numero = searchParams.get("numero");
    if (!numero || !/^\d{11}$/.test(numero)) {
      return error(API_ERROR_CODES.VALIDATION, "RUC invalido — 11 digitos requeridos", 400);
    }
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    const res = await fetch(`https://api.apis.net.pe/v2/sunat/ruc/full?numero=${encodeURIComponent(numero)}`, {
      headers: { Authorization: `Bearer ${TOKEN}` }, cache: "no-store",
    });
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "1";
    if (!res.ok) {
      return error(API_ERROR_CODES.BAD_GATEWAY, res.status === 422 ? "RUC no valido" : "No se pudo consultar", 502);
    }
    return success(await res.json());
  },
};

export const reniecController = {
  async consultarDni(request: Request): Promise<NextResponse> {
    const { searchParams } = new URL(request.url);
    const numero = searchParams.get("numero");
    if (!numero || !/^\d{8}$/.test(numero)) {
      return error(API_ERROR_CODES.VALIDATION, "DNI invalido — 8 digitos requeridos", 400);
    }
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    const res = await fetch(`https://api.apis.net.pe/v2/reniec/dni?numero=${encodeURIComponent(numero)}`, {
      headers: { Authorization: `Bearer ${TOKEN}` }, cache: "no-store",
    });
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "1";
    if (!res.ok) {
      return error(API_ERROR_CODES.BAD_GATEWAY, res.status === 404 ? "DNI no encontrado" : "No se pudo consultar", 502);
    }
    return success(await res.json());
  },
};
