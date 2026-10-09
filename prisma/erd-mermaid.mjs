// Config de Mermaid para el ERD (prisma-erd-generator).
// `useMaxWidth: false` fuerza el tamano natural del diagrama (sin escalar al viewport),
// de modo que el PNG/SVG salga con el texto legible.
const config = {
  er: { useMaxWidth: false, layoutDirection: "LR" },
  themeVariables: { fontSize: "16px" },
};

export default config;
