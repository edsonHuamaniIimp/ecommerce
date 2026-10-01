import { EmpresasManager } from "@/components/empresas/empresas-manager";

export default function EmpresasPage() {
  return (
    <main className="flex-1 py-6">
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Empresas</h1>
          <p className="text-sm text-muted-foreground">
            Registra empresas y habilita su acceso al Portal del Cliente. Al crear la cuenta se envian sus
            credenciales y la empresa valida sus datos en el primer ingreso.
          </p>
        </div>
        <EmpresasManager />
      </div>
    </main>
  );
}
