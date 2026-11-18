import { describe, expect, it } from "vitest";
import { isValidHttpUrl } from "../form-validator";

describe("isValidHttpUrl", () => {
  it("acepta URLs absolutas http y https", () => {
    expect(isValidHttpUrl("https://drive.google.com/file/d/123")).toBe(true);
    expect(isValidHttpUrl("http://ejemplo.pe/fuente")).toBe(true);
  });

  it("rechaza URLs relativas o con otro protocolo", () => {
    expect(isValidHttpUrl("asdasdasd")).toBe(false);
    expect(isValidHttpUrl("www.ejemplo.pe")).toBe(false);
    expect(isValidHttpUrl("mailto:legal@iimp.org.pe")).toBe(false);
  });
});
