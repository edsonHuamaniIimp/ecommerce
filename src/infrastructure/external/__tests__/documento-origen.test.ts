import { describe, it, expect, vi, afterEach } from "vitest";
import { DocumentoOrigen } from "../documento-origen";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DocumentoOrigen", () => {
  it("deberia rechazar un origen con esquema no soportado", async () => {
    const origen = new DocumentoOrigen();
    await expect(origen.leer("ftp://servidor/doc.pdf")).rejects.toThrow(/no soportado/);
  });

  it("deberia rechazar una ruta local fuera de uploads (path traversal)", async () => {
    const origen = new DocumentoOrigen();
    await expect(origen.leer("/uploads/../../secreto.txt")).rejects.toThrow(/invalida/);
  });

  it("deberia leer un documento remoto y usar el content-type de la respuesta", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: () => "application/pdf" },
        arrayBuffer: async () => new Uint8Array([9, 8, 7]).buffer,
      }),
    );
    const origen = new DocumentoOrigen();

    const contenido = await origen.leer("https://cdn.iimp.org/docs/contrato.pdf");

    expect(contenido.mimeType).toBe("application/pdf");
    expect(contenido.fileName).toBe("contrato.pdf");
    expect(contenido.bytes).toHaveLength(3);
  });
});
