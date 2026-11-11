import { describe, expect, it } from "vitest";
import { ESTADOS_REVISION, ESTADOS_SOLICITUD, SGC_LIFECYCLE_STATUSES } from "@/lib/shared/constants";
import { estadoSolicitudConSgc } from "../estado-solicitud";

describe("estadoSolicitudConSgc", () => {
  it("calcula aprobado aunque la columna persistida sea null", () => {
    expect(
      estadoSolicitudConSgc(
        null,
        [{ area: "asociado", estado: ESTADOS_REVISION.APROBADO }],
        null,
        true,
      ),
    ).toBe(ESTADOS_SOLICITUD.APROBADO);
  });

  it("calcula pendiente cuando la revision aun no fue respondida", () => {
    expect(
      estadoSolicitudConSgc(
        null,
        [{ area: "asociado", estado: ESTADOS_REVISION.PENDIENTE }],
        null,
        true,
      ),
    ).toBe(ESTADOS_SOLICITUD.PENDIENTE);
  });

  it("respeta el estado persistido de pago", () => {
    expect(
      estadoSolicitudConSgc(
        ESTADOS_SOLICITUD.PENDIENTE_PAGO,
        [{ area: "asociado", estado: ESTADOS_REVISION.APROBADO }],
        null,
        true,
      ),
    ).toBe(ESTADOS_SOLICITUD.PENDIENTE_PAGO);
  });

  it("prioriza una devolucion del SGC sobre el estado calculado", () => {
    expect(
      estadoSolicitudConSgc(
        null,
        [{ area: "asociado", estado: ESTADOS_REVISION.APROBADO }],
        { lifecycleStatus: SGC_LIFECYCLE_STATUSES.OBSERVED, devolucionRequiereCambio: true },
        true,
      ),
    ).toBe(ESTADOS_SOLICITUD.OBSERVADO);
  });
});
