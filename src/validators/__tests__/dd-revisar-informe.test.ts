import { describe, expect, it } from "vitest";
import { ddRevisarSchema } from "../debida-diligencia.validator";

const base = { expedienteId: "e1", accion: "rechazar", motivo: "Requiere revisión legal" };

describe("ddRevisarSchema - derivar a Legal", () => {
  it("el link del informe de Logística es opcional", () => {
    const sinLink = ddRevisarSchema.safeParse(base);
    expect(sinLink.success).toBe(true);
    if (sinLink.success) expect(sinLink.data.informeLogisticaUrl).toBeNull();
    expect(ddRevisarSchema.safeParse({ ...base, informeLogisticaUrl: null }).success).toBe(true);
  });

  it("acepta un link http o https", () => {
    expect(ddRevisarSchema.safeParse({ ...base, informeLogisticaUrl: "https://drive.google.com/informe" }).success).toBe(true);
    expect(ddRevisarSchema.safeParse({ ...base, informeLogisticaUrl: "http://intranet/informe.pdf" }).success).toBe(true);
  });

  it("rechaza esquemas que no son web (javascript, data, file, ftp)", () => {
    for (const url of ["javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "file:///etc/passwd", "ftp://servidor/x.pdf", "no-es-un-link"]) {
      expect(ddRevisarSchema.safeParse({ ...base, informeLogisticaUrl: url }).success, url).toBe(false);
    }
  });

  it("el motivo sigue siendo obligatorio", () => {
    expect(ddRevisarSchema.safeParse({ ...base, motivo: "  " }).success).toBe(false);
  });
});
