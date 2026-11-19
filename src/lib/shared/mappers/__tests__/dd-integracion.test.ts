import { describe, expect, it } from "vitest";
import { mapDdIntegracionDocumentosToDTO } from "@/lib/shared/mappers/dd-integracion";
import {
  DD_DOCUMENTO_ADICIONAL,
  DD_DOCUMENTO_VIGENCIA,
  DD_DOCUMENTOS,
} from "@/lib/shared/constants";
import type { DdIntegracionBusquedaResult } from "@/domain/models/dd-integracion";

const fecha = new Date("2026-11-19T12:00:00.000Z");

function resultado(tipos: string[]): DdIntegracionBusquedaResult {
  return {
    data: [
      {
        id: "emp-1",
        ruc: "20609385023",
        tipoDocumento: "RUC",
        razonSocial: "CORPORACIÓN AIREX S.A.C.",
        nombreComercial: "CORP. AIREX SAC",
        pais: "PE",
        estado: "activa",
        expedientes: [
          {
            id: "exp-1",
            codigo: "DD-2026-0497",
            estado: "aprobada",
            origen: "flujo_regular",
            evento: { id: "evento-1", nombre: "PERUMIN 2027", anio: "2027" },
            fechaEnvio: fecha,
            fechaRevision: fecha,
            fechaAprobacion: fecha,
            fechaVencimiento: fecha,
            documentos: tipos.map((tipo, indice) => ({
              id: `doc-${indice}`,
              tipo,
              nombre: `${tipo}.pdf`,
              url: `/uploads/${tipo}.pdf`,
              estado: "aprobado",
              observacion: null,
              updatedAt: fecha,
              versionActual: 1,
              versiones: [
                {
                  id: `version-${indice}`,
                  version: 1,
                  nombre: `${tipo}.pdf`,
                  url: `/uploads/${tipo}.pdf`,
                  creadoPor: "cliente@empresa.pe",
                  createdAt: fecha,
                },
              ],
            })),
          },
        ],
      },
    ],
    total: 1,
    page: 1,
    perPage: 20,
    totalPages: 1,
  };
}

describe("mapDdIntegracionDocumentosToDTO", () => {
  it("envía el título legible y conserva el tipo y la URL", () => {
    const dto = mapDdIntegracionDocumentosToDTO(resultado([DD_DOCUMENTOS.FICHA_RUC]));
    const documento = dto.empresas[0]?.expedientes[0]?.documentos[0];

    expect(documento?.tipo).toBe(DD_DOCUMENTOS.FICHA_RUC);
    expect(documento?.titulo).toBe("Ficha RUC o identificación fiscal");
    expect(documento?.url).toBe("/uploads/ficha_ruc.pdf");
  });

  it("resuelve también los títulos de vigencia y adjunto", () => {
    const dto = mapDdIntegracionDocumentosToDTO(
      resultado([DD_DOCUMENTOS.DECLARACION_VIGENCIA, DD_DOCUMENTOS.ADICIONAL]),
    );
    const documentos = dto.empresas[0]?.expedientes[0]?.documentos ?? [];

    expect(documentos[0]?.titulo).toBe(DD_DOCUMENTO_VIGENCIA.titulo);
    expect(documentos[1]?.titulo).toBe(DD_DOCUMENTO_ADICIONAL.titulo);
  });
});
