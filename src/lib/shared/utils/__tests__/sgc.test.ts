import { describe, it, expect } from "vitest";
import {
  comparacionTiempoConstante,
  construirIdempotencyKey,
  debeNotificarDevolucionSgc,
  diagnosticarFirmaSgc,
  ordenarParaReconciliar,
  hmacSha256Hex,
  mimeDesdeNombre,
  nombreArchivoSgc,
  normalizarObservacionesSgc,
  parsearFirmaSgc,
  tituloSgcDocumento,
  sha256Hex,
  verificarFirmaSgc,
} from "../sgc";
import { SGC_IDEMPOTENCY_PREFIX, SGC_LIFECYCLE_STATUSES, SGC_MIME_TYPE_DEFAULT, SGC_OBSERVACION_ESTADOS } from "@/lib/shared/constants";

const SECRETO = "sgc_webhook_secret";

describe("construirIdempotencyKey", () => {
  it("deberia usar el prefijo y el id de la solicitud", () => {
    expect(construirIdempotencyKey("sol-123")).toBe(`${SGC_IDEMPOTENCY_PREFIX}/sol-123`);
  });

  it("deberia ser determinista para el mismo id", () => {
    expect(construirIdempotencyKey("sol-123")).toBe(construirIdempotencyKey("sol-123"));
  });

  it("deberia lanzar error cuando el id esta vacio", () => {
    expect(() => construirIdempotencyKey("   ")).toThrow();
  });
});

describe("sha256Hex", () => {
  it("deberia calcular el hash conocido de un arreglo vacio", async () => {
    expect(await sha256Hex(new Uint8Array())).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });

  it("deberia calcular el hash de 'abc' en hexadecimal minuscula", async () => {
    const bytes = new TextEncoder().encode("abc");
    expect(await sha256Hex(bytes)).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("mimeDesdeNombre", () => {
  it("deberia mapear extensiones admitidas", () => {
    expect(mimeDesdeNombre("contrato.pdf")).toBe("application/pdf");
    expect(mimeDesdeNombre("anexo.PNG")).toBe("image/png");
    expect(mimeDesdeNombre("foto.jpeg")).toBe("image/jpeg");
  });

  it("deberia devolver el mime por defecto para extensiones desconocidas", () => {
    expect(mimeDesdeNombre("archivo.exe")).toBe(SGC_MIME_TYPE_DEFAULT);
  });
});

describe("nombres de anexos SGC", () => {
  it("deberia usar la etiqueta legible del requisito como titulo", () => {
    expect(tituloSgcDocumento("a8f3.pdf", "ficha-ruc")).toContain("Ficha RUC");
  });

  it("deberia conservar el nombre original sin extension como titulo alternativo", () => {
    expect(tituloSgcDocumento("Contrato adicional.pdf", null)).toBe("Contrato adicional");
  });

  it("deberia generar un nombre unico, legible y con la extension original", () => {
    expect(nombreArchivoSgc({
      titulo: "Ficha RUC",
      nombreOriginal: "a8f3.PDF",
      requisito: "ficha-ruc",
      identificador: "A-01",
      hash: "abc123",
    })).toBe("ficha-ruc-a-01-abc123.pdf");
  });
});

describe("hmacSha256Hex", () => {
  it("deberia calcular el HMAC conocido de un mensaje", async () => {
    const firma = await hmacSha256Hex("key", "The quick brown fox jumps over the lazy dog");
    expect(firma).toBe("f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8");
  });
});

describe("comparacionTiempoConstante", () => {
  it("deberia ser verdadero solo si ambos strings coinciden", () => {
    expect(comparacionTiempoConstante("abc", "abc")).toBe(true);
    expect(comparacionTiempoConstante("abc", "abd")).toBe(false);
    expect(comparacionTiempoConstante("abc", "ab")).toBe(false);
  });
});

describe("parsearFirmaSgc", () => {
  it("deberia extraer timestamp y firma", () => {
    expect(parsearFirmaSgc("t=1757894400,v1=abcdef")).toEqual({ timestamp: 1757894400, firma: "abcdef" });
  });

  it("deberia devolver null si falta alguna parte", () => {
    expect(parsearFirmaSgc("v1=abcdef")).toBeNull();
    expect(parsearFirmaSgc("t=1757894400")).toBeNull();
    expect(parsearFirmaSgc("")).toBeNull();
  });
});

describe("verificarFirmaSgc", () => {
  it("deberia aceptar una firma valida dentro de la ventana de tolerancia", async () => {
    const payload = '{"eventId":"e1"}';
    const firma = await hmacSha256Hex(SECRETO, `1000.${payload}`);
    const ok = await verificarFirmaSgc({ secret: SECRETO, header: `t=1000,v1=${firma}`, payload, ahoraSegundos: 1000 });
    expect(ok).toBe(true);
  });

  it("deberia rechazar una firma con secreto distinto", async () => {
    const payload = "{}";
    const firma = await hmacSha256Hex("otro", `1000.${payload}`);
    const ok = await verificarFirmaSgc({ secret: SECRETO, header: `t=1000,v1=${firma}`, payload, ahoraSegundos: 1000 });
    expect(ok).toBe(false);
  });

  it("deberia rechazar un timestamp fuera de la tolerancia", async () => {
    const payload = "{}";
    const firma = await hmacSha256Hex(SECRETO, `1000.${payload}`);
    const ok = await verificarFirmaSgc({ secret: SECRETO, header: `t=1000,v1=${firma}`, payload, ahoraSegundos: 1400 });
    expect(ok).toBe(false);
  });

  it("deberia rechazar si no hay header o secreto", async () => {
    expect(await verificarFirmaSgc({ secret: SECRETO, header: null, payload: "{}", ahoraSegundos: 1000 })).toBe(false);
    expect(await verificarFirmaSgc({ secret: "", header: "t=1000,v1=x", payload: "{}", ahoraSegundos: 1000 })).toBe(false);
  });
});

describe("normalizarObservacionesSgc (campo OPCIONAL del SGC)", () => {
  it("devuelve null cuando el campo no viene (compatibilidad con versiones previas)", () => {
    expect(normalizarObservacionesSgc(undefined)).toBeNull();
    expect(normalizarObservacionesSgc({})).toBeNull();
  });

  it("normaliza una observacion por documento", () => {
    const r = normalizarObservacionesSgc([
      {
        observationId: "obs-1",
        documentId: "doc-9",
        versionId: "ver-3",
        versionNumber: 3,
        category: "annex",
        message: "  Adjuntar Vigencia de Poder actualizada.  ",
        severity: "blocking",
        requiresDocumentChange: true,
        status: "open",
        createdBy: { name: "Matias Freundt", email: "m@iimp.org.pe" },
        createdAt: "2026-11-02T21:23:00Z",
      },
    ]);
    expect(r).toEqual([
      {
        observationId: "obs-1",
        documentId: "doc-9",
        versionId: "ver-3",
        versionNumber: 3,
        category: "annex",
        title: null,
        severity: "blocking",
        message: "Adjuntar Vigencia de Poder actualizada.",
        requiresDocumentChange: true,
        requiresNewDocument: null,
        resolvedAt: null,
        status: "open",
        createdBy: "Matias Freundt",
        createdAt: "2026-11-02T21:23:00Z",
      },
    ]);
  });

  it("descarta items sin mensaje", () => {
    expect(normalizarObservacionesSgc([{ documentId: "x" }, { message: "   " }])).toEqual([]);
  });

  it("devuelve arreglo vacio si viene como arreglo sin observaciones validas", () => {
    expect(normalizarObservacionesSgc([])).toEqual([]);
  });
});

describe("ordenarParaReconciliar", () => {
  const ahora = Date.parse("2026-11-23T20:00:00.000Z");
  const exp = (id: string, lifecycleStatus: string | null, sync: string | null) => ({
    id,
    lifecycleStatus,
    lastSyncedAt: sync ? new Date(sync) : null,
  });

  it("prioriza expedientes en curso y solo incluye terminales con mas de 24 h sin consultar", () => {
    const orden = ordenarParaReconciliar([
      exp("terminal-reciente", SGC_LIFECYCLE_STATUSES.FINALIZED, "2026-11-23T10:00:00.000Z"),
      exp("terminal-viejo", SGC_LIFECYCLE_STATUSES.ACTIVE, "2026-11-20T10:00:00.000Z"),
      exp("observado", SGC_LIFECYCLE_STATUSES.OBSERVED, "2026-11-23T19:00:00.000Z"),
      exp("nunca", null, null),
      exp("revision", "legal-review", "2026-11-22T11:54:00.000Z"),
    ], ahora);
    expect(orden.map((e) => e.id)).toEqual(["nunca", "revision", "observado", "terminal-viejo"]);
  });
});

describe("debeNotificarDevolucionSgc", () => {
  const obs = (id: string, message = "Corrige el contrato") => ({
    observationId: id,
    message,
    status: SGC_OBSERVACION_ESTADOS.OPEN,
    requiresDocumentChange: true,
  });
  const base = { preservar: false, esDevolucion: true, estabaDevuelto: true };

  it("no reenvia el aviso en cada sincronizacion de la misma devolucion", () => {
    expect(debeNotificarDevolucionSgc({ ...base, observacionesAbiertas: [obs("a")], observacionesPrevias: [obs("a")] })).toBe(false);
  });

  it("avisa al entrar en devolucion y cuando aparecen observaciones nuevas", () => {
    expect(debeNotificarDevolucionSgc({ ...base, estabaDevuelto: false, observacionesAbiertas: [obs("a")], observacionesPrevias: [] })).toBe(true);
    expect(debeNotificarDevolucionSgc({ ...base, observacionesAbiertas: [obs("a"), obs("b")], observacionesPrevias: [obs("a")] })).toBe(true);
  });

  it("no avisa con bypass ni cuando la devolucion no exige cambio documental", () => {
    expect(debeNotificarDevolucionSgc({ ...base, preservar: true, estabaDevuelto: false, observacionesAbiertas: [], observacionesPrevias: [] })).toBe(false);
    expect(debeNotificarDevolucionSgc({
      ...base,
      estabaDevuelto: false,
      observacionesAbiertas: [{ ...obs("a"), requiresDocumentChange: false }],
      observacionesPrevias: [],
    })).toBe(false);
  });
});

describe("diagnosticarFirmaSgc", () => {
  it("informa el motivo del rechazo sin exponer el secreto", async () => {
    const ahora = 1_800_000_000;
    const payload = '{"eventId":"e1"}';
    const firma = await hmacSha256Hex(SECRETO, `${ahora}.${payload}`);
    const header = `t=${ahora},v1=${firma}`;
    expect(await diagnosticarFirmaSgc({ secret: SECRETO, header, payload, ahoraSegundos: ahora })).toBeNull();
    expect(await diagnosticarFirmaSgc({ secret: "", header, payload, ahoraSegundos: ahora })).toBe("sin_secreto");
    expect(await diagnosticarFirmaSgc({ secret: SECRETO, header: null, payload, ahoraSegundos: ahora })).toBe("sin_header");
    expect(await diagnosticarFirmaSgc({ secret: SECRETO, header: "basura", payload, ahoraSegundos: ahora })).toBe("header_invalido");
    expect(await diagnosticarFirmaSgc({ secret: SECRETO, header, payload, ahoraSegundos: ahora + 3600 })).toBe("fuera_de_ventana");
    expect(await diagnosticarFirmaSgc({ secret: "otro", header, payload, ahoraSegundos: ahora })).toBe("firma_no_coincide");
  });
});
