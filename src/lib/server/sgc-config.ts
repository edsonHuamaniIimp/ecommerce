import 'server-only';

import { SGC_MODES } from "@/lib/shared/constants";
import type { SgcMode } from "@/lib/shared/constants";

const DEFAULT_TIMEOUT_MS = 10000;

export function isSgcEnabled(): boolean {
  return process.env.SGC_ENABLED === "1";
}

export function getSgcMode(): SgcMode {
  return process.env.SGC_MODE === SGC_MODES.REAL ? SGC_MODES.REAL : SGC_MODES.MOCK;
}

export function getSgcApiUrl(): string {
  const url = process.env.SGC_API_URL;
  if (!url) throw new Error("SGC_API_URL no definida en .env");
  return url;
}

export function getSgcApiKey(): string {
  const key = process.env.SGC_API_KEY;
  if (!key) throw new Error("SGC_API_KEY no definida en .env");
  return key;
}

export function getSgcAreaCode(): string {
  const code = process.env.SGC_AREA_CODE;
  if (!code) throw new Error("SGC_AREA_CODE no definida en .env");
  return code;
}

export function getSgcContractTypeCode(): string {
  const code = process.env.SGC_CONTRACT_TYPE_CODE;
  if (!code) throw new Error("SGC_CONTRACT_TYPE_CODE no definida en .env");
  return code;
}

export function getSgcWebhookSecret(): string | null {
  return process.env.SGC_WEBHOOK_SECRET ?? null;
}

export function getCronSecret(): string | null {
  return process.env.CRON_SECRET ?? null;
}

export function getSgcTimeoutMs(): number {
  const raw = Number(process.env.SGC_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TIMEOUT_MS;
}

export interface SgcIntegracionConfig {
  enabled: boolean;
  mode: SgcMode;
  areaCode: string;
  contractTypeCode: string;
}

export function getSgcConfig(): SgcIntegracionConfig {
  return {
    enabled: isSgcEnabled(),
    mode: getSgcMode(),
    areaCode: process.env.SGC_AREA_CODE ?? "",
    contractTypeCode: process.env.SGC_CONTRACT_TYPE_CODE ?? "",
  };
}
