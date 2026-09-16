import 'server-only';

import { NextResponse } from "next/server";
import { error } from "./api-response";
import { API_ERROR_CODES } from "../shared/constants";
import { ZodError } from "zod";

type NextRouteHandler = (request: Request, context: { params: Promise<Record<string, string>> }) => Promise<NextResponse>;

export function handler(fn: (request: Request) => Promise<NextResponse>): NextRouteHandler {
  return async (req: Request) => {
    try {
      return await fn(req);
    } catch (err) {
      if (err instanceof ZodError) {
        const messages = err.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
        return error(API_ERROR_CODES.VALIDATION, messages, 400);
      }
      const message = err instanceof Error ? err.message : "Error interno";
      return error(API_ERROR_CODES.INTERNAL, message, 500);
    }
  };
}
