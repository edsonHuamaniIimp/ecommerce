/** Declaraciones de modulos sin tipos propios usados por el motor de contratos. */

declare module "pizzip" {
  class PizZip {
    constructor(data?: unknown, options?: unknown);
    files: Record<string, { asText(): string; asUint8Array(): Uint8Array }>;
    file(name: string, content?: string): { asText(): string; asUint8Array(): Uint8Array } | null;
    generate(options: { type: "nodebuffer"; compression?: string }): Buffer;
    generate(options: { type: "uint8array" | "base64" | "blob" | "string"; compression?: string }): unknown;
    static load(data: unknown, options?: unknown): PizZip;
  }
  export = PizZip;
}

declare module "docxtemplater-image-module-free" {
  interface ImageModuleOptions {
    centered?: boolean;
    fileType?: "docx" | "pptx";
    getImage: (tagValue: unknown, tagName: string) => Buffer;
    getSize?: (img: Buffer, tagValue: unknown, tagName: string) => [number, number];
  }
  class ImageModule {
    constructor(options: ImageModuleOptions);
  }
  export = ImageModule;
}
