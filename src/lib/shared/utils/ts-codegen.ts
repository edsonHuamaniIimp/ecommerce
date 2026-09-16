/** Utilidades de generacion de codigo TypeScript (contrato de planos 3D) */
export const tsCodegenUtils = {
  toConstName(codigo: string): string {
    return codigo.toUpperCase().replace(/-/g, "_");
  },

  toUnionType(codigos: string[], fallback = "string"): string {
    return codigos.length > 0 ? codigos.map((c) => `"${c}"`).join(" | ") : fallback;
  },

  toLabel(codigo: string): string {
    return codigo.toUpperCase();
  },
};
