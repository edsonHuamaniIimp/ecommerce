import { UsuariosManager } from "@/components/usuarios/usuarios-manager";

export default function UsuariosPage() {
  return (
    <main className="flex-1 py-6">
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Usuarios</h1>
          <p className="text-sm text-muted-foreground">
            Alta de usuarios del Portal del Cliente y su empresa (individual o por lote).
          </p>
        </div>
        <UsuariosManager />
      </div>
    </main>
  );
}
