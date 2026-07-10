import type {
  EventoPadreDTO,
  EventoDTO,
  PlanoStandDTO,
  ReservaDTO,
} from "@/types/dto/models";

export const eventoPadreDTO: EventoPadreDTO = {
  id: "ep-perumin",
  codigo: "PERUMIN",
  vertical: "perumin",
  nombre: "PERUMIN",
};

export const eventoDTO: EventoDTO = {
  id: "ev-perumin38",
  evento_padre_id: "ep-perumin",
  tipo_evento: 14,
  codigo_evento: 1,
  anio: "2026",
  estado: "active",
};

export const planoTiposDTO = [
  { id: "ts-estandar", nombre: "Estándar", medidas: "3x3 m", montoBase: 5000, moneda: "USD" },
  { id: "ts-isla", nombre: "Isla", medidas: "6x6 m", montoBase: 12000, moneda: "USD" },
  { id: "ts-preferencial", nombre: "Preferencial", medidas: "4x4 m", montoBase: 8000, moneda: "USD" },
  { id: "ts-esquina", nombre: "Esquina", medidas: "3x3 m", montoBase: 6500, moneda: "USD" },
] as const;

function s(
  id: string, num: string, tsId: string, x: number, y: number, ancho: number, alto: number,
  estado: "disponible" | "en_evaluacion" | "reservado", empresa: string | null = null,
): PlanoStandDTO {
  const ts = planoTiposDTO.find((t) => t.id === tsId)!;
  return { id, numero: num, tipo_stand: ts.nombre, tipo_stand_id: ts.id, monto: ts.montoBase, moneda: ts.moneda, medidas: ts.medidas, x, y, ancho, alto, estado, empresa, tipo_camara: null, numero_camara: null };
}

export const planoDTO: PlanoStandDTO[] = [
  s("st-01","01","ts-isla",40,50,80,60,"disponible"),
  s("st-02","02","ts-isla",140,50,80,60,"disponible"),
  s("st-03","03","ts-preferencial",240,50,70,55,"en_evaluacion"),
  s("st-04","04","ts-estandar",40,130,65,55,"reservado","Corporación Minera S.A."),
  s("st-05","05","ts-estandar",120,130,65,55,"disponible"),
  s("st-06","06","ts-esquina",200,130,70,55,"disponible"),
  s("st-07","07","ts-preferencial",40,210,70,55,"disponible"),
  s("st-08","08","ts-preferencial",130,210,70,55,"disponible"),
  s("st-09","09","ts-estandar",220,210,65,55,"disponible"),
  s("st-10","10","ts-isla",40,290,80,60,"reservado","Ingeniería & Construcción S.A.C."),
  s("st-11","11","ts-estandar",140,290,65,55,"en_evaluacion"),
  s("st-12","12","ts-esquina",220,290,70,55,"disponible"),
];

export const reservasDTO: ReservaDTO[] = [
  {
    id: "res-001", evento_id: "ev-perumin38", empresa_ref: "emp-001", empresa_nombre: "Corporación Minera S.A.",
    stand_ids: ["st-04"], stands: [{ id: "st-04", numero: "04", tipo_stand: "Estándar", monto: 5000, moneda: "USD" }],
    monto_total: 5000, moneda: "USD",
    facturacion: { tipo_comprobante: "factura", razon_social: "Corporación Minera S.A.", ruc: "20123456789", nombre: "", numero_documento: "", direccion: "Av. Principal 123, Lima", correo: "facturacion@corpminera.pe" },
    cuotas: [{ numero: 1, porcentaje: 100, monto: 5000, fecha_pago: "2026-03-15" }],
    aprobaciones: [
      { area: "legal", estado: "aprobado", responsable: "María Torres", comentario: "Contrato revisado", fecha: "2026-02-10T10:00:00Z" },
      { area: "logistica", estado: "aprobado", responsable: "Carlos Vega", comentario: "Empresa homologada", fecha: "2026-02-12T09:00:00Z" },
      { area: "eventos", estado: "aprobado", responsable: "Diana Ruiz", comentario: null, fecha: "2026-02-14T11:30:00Z" },
    ],
    estado: "facturada", creado_en: "2026-02-05T14:00:00Z",
  },
  {
    id: "res-002", evento_id: "ev-perumin38", empresa_ref: "emp-002", empresa_nombre: "Ingeniería & Construcción S.A.C.",
    stand_ids: ["st-10"], stands: [{ id: "st-10", numero: "10", tipo_stand: "Isla", monto: 12000, moneda: "USD" }],
    monto_total: 12000, moneda: "USD",
    facturacion: { tipo_comprobante: "factura", razon_social: "Ingeniería & Construcción S.A.C.", ruc: "20987654321", nombre: "", numero_documento: "", direccion: "Jr. Las Palmeras 456, Arequipa", correo: "admin@ingconstruccion.pe" },
    cuotas: [
      { numero: 1, porcentaje: 50, monto: 6000, fecha_pago: "2026-04-01" },
      { numero: 2, porcentaje: 50, monto: 6000, fecha_pago: "2026-05-01" },
    ],
    aprobaciones: [
      { area: "legal", estado: "aprobado", responsable: "María Torres", comentario: null, fecha: "2026-03-01T10:00:00Z" },
      { area: "logistica", estado: "aprobado", responsable: "Carlos Vega", comentario: null, fecha: "2026-03-03T08:00:00Z" },
      { area: "eventos", estado: "pendiente", responsable: null, comentario: null, fecha: null },
    ],
    estado: "en_aprobacion", creado_en: "2026-02-28T09:30:00Z",
  },
  {
    id: "res-003", evento_id: "ev-perumin38", empresa_ref: "emp-003", empresa_nombre: "Servicios Logísticos del Sur E.I.R.L.",
    stand_ids: ["st-03","st-11"], stands: [
      { id: "st-03", numero: "03", tipo_stand: "Preferencial", monto: 8000, moneda: "USD" },
      { id: "st-11", numero: "11", tipo_stand: "Estándar", monto: 5000, moneda: "USD" },
    ],
    monto_total: 13000, moneda: "USD",
    facturacion: { tipo_comprobante: "boleta", razon_social: "", ruc: "", nombre: "Juan Pérez López", numero_documento: "10456789", direccion: "Mz. B Lt. 5, Cusco", correo: "jperez@email.com" },
    cuotas: [
      { numero: 1, porcentaje: 40, monto: 5200, fecha_pago: "2026-03-20" },
      { numero: 2, porcentaje: 30, monto: 3900, fecha_pago: "2026-04-20" },
      { numero: 3, porcentaje: 30, monto: 3900, fecha_pago: "2026-05-20" },
    ],
    aprobaciones: [
      { area: "legal", estado: "aprobado", responsable: "Roberto Campos", comentario: null, fecha: "2026-03-10T09:00:00Z" },
      { area: "logistica", estado: "pendiente", responsable: null, comentario: null, fecha: null },
      { area: "eventos", estado: "pendiente", responsable: null, comentario: null, fecha: null },
    ],
    estado: "en_aprobacion", creado_en: "2026-03-07T16:15:00Z",
  },
  {
    id: "res-004", evento_id: "ev-perumin38", empresa_ref: "emp-004", empresa_nombre: "Tecnología Minera Digital S.A.",
    stand_ids: ["st-06"], stands: [{ id: "st-06", numero: "06", tipo_stand: "Esquina", monto: 6500, moneda: "USD" }],
    monto_total: 6500, moneda: "USD",
    facturacion: { tipo_comprobante: "factura", razon_social: "Tecnología Minera Digital S.A.", ruc: "20789123456", nombre: "", numero_documento: "", direccion: "Av. Tecnológica 789, Lima", correo: "ventas@tecmin.pe" },
    cuotas: [{ numero: 1, porcentaje: 100, monto: 6500, fecha_pago: "2026-03-25" }],
    aprobaciones: [
      { area: "legal", estado: "aprobado", responsable: "María Torres", comentario: null, fecha: "2026-03-18T10:00:00Z" },
      { area: "logistica", estado: "rechazado", responsable: "Carlos Vega", comentario: "RUC con estado no habido", fecha: "2026-03-19T09:00:00Z" },
      { area: "eventos", estado: "pendiente", responsable: null, comentario: null, fecha: null },
    ],
    estado: "rechazada", creado_en: "2026-03-16T11:00:00Z",
  },
];
