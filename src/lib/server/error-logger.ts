import 'server-only';

import { prisma } from "@/lib/server/db";
import type { Prisma } from "@prisma/client";

export const errorLogger = {
  async log(data: {
    message: string;
    stack?: string;
    digest?: string;
    url?: string;
    userId?: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    try {
      await prisma.errorLog.create({ data });
    } catch {
      // Never let logging failure crash the app
    }
  },
};
