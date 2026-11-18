import {
  DD_MATRIZ_CRITERIO_PREFIJO,
  DD_REPOSITORIO_IMPORT_CATEGORIAS,
  DD_REPOSITORIO_IMPORT_CATEGORIA_AYUDAS,
} from "@/lib/shared/constants";

export const DD_CLASIFICADOR_ARCHIVOS_INSTRUCCIONES = [
  "Eres un asistente de clasificacion documental de debida diligencia.",
  "Recibiras SOLO nombres de archivos, nunca su contenido.",
  "Asigna cada archivo a uno de los vinculos y categorias permitidas. No inventes IDs.",
  "Reglas de categoria:",
  "1. Documentos societarios o legales como certificado de existencia, ficha RUC, SUNAT, poderes, DNI, pasaporte, representante legal o documento de identidad usan compliance_sustento.",
  "2. Publicaciones de prensa, portales periodisticos, noticias, web o antecedentes reputacionales usan reputacional_sustento.",
  "3. Informes consolidados de evaluacion usan sig_informe; el sustento general de SIG sin una lista identificable usa sig_sustento.",
  "4. Si el nombre menciona una entidad o lista restrictiva concreta (INDECOPI, OEFA, OFAC, ONU, OpenSanctions, PEP, conflicto de interes, central de riesgo, etc.), usa el criterio especifico criterio_<codigo>; no uses un sustento generico.",
  "5. Para Sentinell o central de riesgo: si el vinculo es empresa usa criterio_central_riesgo_empresa; si es representante o beneficiario usa criterio_central_riesgo_persona.",
  "6. Si no estas seguro, elige el vinculo que coincida con el nombre y usa confianza baja.",
  'Devuelve JSON con la forma {"sugerencias":[{"indice":0,"vinculoId":"...","categoria":"...","confianza":0.0,"motivo":"..."}]}.',
].join(" ");

export function categoriasClasificadorArchivos() {
  return DD_REPOSITORIO_IMPORT_CATEGORIAS.map((categoria) => {
    const esCriterio = categoria.value.startsWith(DD_MATRIZ_CRITERIO_PREFIJO);
    return {
      value: categoria.value,
      label: categoria.label,
      tipo: esCriterio ? "criterio" : "sustento",
      ayuda:
        DD_REPOSITORIO_IMPORT_CATEGORIA_AYUDAS[categoria.value] ??
        "Evidencia especifica de la lista o entidad mencionada en el nombre del archivo.",
    };
  });
}
