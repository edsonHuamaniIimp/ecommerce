import { z } from "zod";
import { CUOTAS_PORCENTAJE_PASO, CUOTAS_SUMA_TOLERANCIA, IDIOMAS_DISPONIBLES, MAX_CUOTAS_PAGO, type Idioma } from "@/lib/shared/constants";
import { fechasCuotasEnRango, fechasCuotasValidas } from "@/lib/shared/utils/cuotas";

const fechaISO = /^\d{4}-\d{2}-\d{2}$/;

const cuotaSchema = z.object({
  porcentaje: z
    .number({ message: "Porcentaje invalido" })
    .gt(0, "Cada cuota debe tener un porcentaje mayor a 0")
    .lte(100, "El porcentaje no puede superar 100")
    .multipleOf(CUOTAS_PORCENTAJE_PASO, { message: "El porcentaje admite hasta 2 decimales" }),
  fechaVencimiento: z.string().regex(fechaISO, "Fecha invalida (usa yyyy-mm-dd)"),
});

const cuotasContratoSchema = z
  .array(cuotaSchema)
  .min(1, "Configura al menos una cuota")
  .max(MAX_CUOTAS_PAGO, `Maximo ${MAX_CUOTAS_PAGO} cuotas`)
  .refine(
    (cuotas) => Math.abs(cuotas.reduce((s, c) => s + c.porcentaje, 0) - 100) < CUOTAS_SUMA_TOLERANCIA,
    { message: "Las cuotas deben sumar 100%" },
  )
  .refine((cuotas) => fechasCuotasValidas(cuotas.map((c) => c.fechaVencimiento)), {
    message: "Las fechas no pueden ser pasadas y deben ir en orden",
  })
  .refine((cuotas) => fechasCuotasEnRango(cuotas.map((c) => c.fechaVencimiento)), {
    message: "Las cuotas superan el maximo permitido (1ra: 1 mes, 2da: 2 meses, 3ra: 3 meses desde la solicitud; tope 15/07/2027)",
  });

/** Datos del exhibidor para el cuerpo del contrato (paso Cuotas del wizard). */
const contratoDatosSchema = z.object({
  razonSocial: z.string().trim().max(200).optional(),
  ruc: z.string().trim().max(20).optional(),
  direccion: z.string().trim().max(250).optional(),
  representante: z.string().trim().max(200).optional(),
  representanteDni: z.string().trim().max(15).optional(),
  partidaElectronica: z.string().trim().max(50).optional(),
});

/**
 * Cuerpo de POST `/api/contratos/generar`.
 * El cliente configura porcentajes y **fechas** (1..3 cuotas; los porcentajes suman 100%,
 * las fechas no son pasadas y van en orden ascendente). Los MONTOS NO se reciben:
 * se calculan en el servidor desde el precio del stand. Las imagenes del Anexo 1
 * (recortes por pabellon con version/fecha) tambien se generan en el servidor.
 */
export const generarContratoSchema = z.object({
  solicitudId: z.string().uuid("solicitudId invalido"),
  /** Idioma del documento (F3); si falta se resuelve el del cliente. */
  idioma: z.enum(IDIOMAS_DISPONIBLES as [Idioma, ...Idioma[]]).optional(),
  cuotas: cuotasContratoSchema,
  /** Datos del exhibidor capturados en el wizard (cuerpo del contrato). */
  contrato: contratoDatosSchema.optional(),
});

/**
 * Cuerpo de POST `/api/contratos/borrador` y `/api/contratos/firmar-borrador`
 * (paso Contrato del wizard): genera el contrato con los stands seleccionados
 * **sin crear la solicitud** (se crea recien al enviar la reserva).
 */
export const borradorContratoSchema = z.object({
  standIds: z.array(z.string().uuid("standId invalido")).min(1, "Selecciona al menos un stand").max(50, "Demasiados stands"),
  /** Idioma del documento (F3); si falta se resuelve el del cliente. */
  idioma: z.enum(IDIOMAS_DISPONIBLES as [Idioma, ...Idioma[]]).optional(),
  cuotas: cuotasContratoSchema,
  /** Datos del exhibidor capturados en el wizard (cuerpo del contrato). */
  contrato: contratoDatosSchema.optional(),
});

/**
 * Cuerpo de POST `/api/contratos/firmar` (RF-12): firma digital del cliente con la
 * imagen cargada en su perfil. No recibe archivos: el servidor estampa la firma.
 */
export const firmarContratoSchema = z.object({
  solicitudId: z.string().uuid("solicitudId invalido"),
  /** Idioma del documento (F3); si falta se resuelve el del cliente. */
  idioma: z.enum(IDIOMAS_DISPONIBLES as [Idioma, ...Idioma[]]).optional(),
  /** Datos del exhibidor capturados en el wizard (cuerpo del contrato). */
  contrato: contratoDatosSchema.optional(),
});
