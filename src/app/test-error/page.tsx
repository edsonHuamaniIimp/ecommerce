// Página de prueba del error boundary: lanza un error a propósito.
// force-dynamic evita que Next la pre-renderice durante el build (debe fallar en runtime, no en build).
export const dynamic = "force-dynamic";

export default function TestError() {
  throw new Error("SIMULACIÓN: Fallo en la Casa de Fuerza — GEN-04 colapsó.");
}

