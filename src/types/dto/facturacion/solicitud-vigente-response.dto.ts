/**
 * Response de `GET /api/integracion/solicitud` (M2M, solo lectura): el MISMO body de
 * `POST /stands/reserva` (PascalCase: NumeroSolicitud, Stands, TipoFacturacion, Pais, Contactos,
 * Comercial, StandsDetalle, Cuotas, ...) con los datos VIGENTES de la solicitud, mas `Version`
 * (huella que cambia solo si cambia algo). No incluye `Archivos`, `Requisitos` ni `Origen`.
 * Permite que el SIE actualice su registro sin que la plataforma regenere ni reenvie la reserva.
 */
export type SolicitudVigenteResponseDTO = { Version: string } & Record<string, unknown>;
