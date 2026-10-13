import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    // Los skills/agentes instalados no son codigo del proyecto.
    exclude: ["**/node_modules/**", "**/.next/**", "**/.agents/**", "**/.opencode/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      /* `server-only` lanza al importarse fuera de RSC: en tests se resuelve a un stub vacio. */
      "server-only": path.resolve(__dirname, "./src/test/stubs/server-only.ts"),
    },
  },
});
