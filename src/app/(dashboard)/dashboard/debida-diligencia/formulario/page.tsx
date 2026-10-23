"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, Skeleton } from "@nrivera-iimp/ui-kit-iimp";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { DdWizard } from "@/components/debida-diligencia/dd-wizard";
import { DdAccesoDenegado } from "@/components/debida-diligencia/dd-acceso-denegado";
import { SinEvento } from "@/components/dashboard/sin-evento";
import { useSesion } from "@/hooks/use-sesion";
import { debidaDiligenciaService } from "@/lib/client/api/services/debida-diligencia-service";
import { DD_ESTADOS, DD_RUTAS, PERMISSIONS, DD_VIGENCIA_MESES } from "@/lib/shared/constants";
import { DD_VIGENCIAS, ddUtils } from "@/lib/shared/utils/debida-diligencia";
import { dateUtils } from "@/lib/shared/utils/date";
import { tienePermiso } from "@/lib/shared/utils/permisos";
import type { DdMiExpedienteDTO } from "@/types/dto/debida-diligencia";

function FormularioShell({ children }: { children: ReactNode }) {
  return (
    <main className="flex-1 py-6">
      <div className="mx-auto w-full max-w-7xl space-y-4">{children}</div>
    </main>
  );
}

export default function DebidaDiligenciaFormularioPage() {
  const { session, cargando } = useSesion();
  const router = useRouter();
  const eventoId = session?.eventoId ?? "";
  const permitido = tienePermiso(session, PERMISSIONS.DD_FORMULARIO);
  const [data, setData] = useState<DdMiExpedienteDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [iniciandoNueva, setIniciandoNueva] = useState(false);

  useEffect(() => {
    if (!eventoId || !permitido) return;
    let activo = true;
    debidaDiligenciaService
      .miExpediente({ soloEvento: true })
      .then((r) => { if (activo) setData(r); })
      .catch((e) => { if (activo) setError(e instanceof Error ? e.message : "No se pudo cargar el formulario"); })
      .finally(() => { if (activo) setLoading(false); });
    return () => { activo = false; };
  }, [eventoId, permitido]);

  const ddVencida =
    data?.expediente?.estado === DD_ESTADOS.APROBADA &&
    ddUtils.estadoVigencia(
      data.expediente.estado,
      data.expediente.fechaVencimiento,
      undefined,
      data.expediente.fechaAprobacion,
    ) === DD_VIGENCIAS.VENCIDA;
  const puedeIniciarNueva =
    Boolean(data?.expediente) &&
    (data?.expediente?.estado === DD_ESTADOS.RECHAZADA || ddVencida);

  const iniciarNueva = async () => {
    setIniciandoNueva(true);
    try {
      const nuevo = await debidaDiligenciaService.iniciarNueva();
      setData((prev) => (prev ? { ...prev, expediente: nuevo } : prev));
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo iniciar una nueva debida diligencia");
      setIniciandoNueva(false);
    }
  };

  let contenido: ReactNode;

  if (cargando || loading) {
    contenido = <Skeleton className="h-[540px] w-full rounded-xl" />;
  } else if (!permitido) {
    contenido = <DdAccesoDenegado mensaje="Solo la cuenta de la empresa puede completar su debida diligencia." />;
  } else if (!eventoId) {
    contenido = <SinEvento />;
  } else if (error) {
    contenido = (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
          <ShieldCheck className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button asChild variant="outline" size="sm">
            <Link href={DD_RUTAS.BASE}>Volver a Mi debida diligencia</Link>
          </Button>
        </CardContent>
      </Card>
    );
  } else if (!data?.empresa) {
    contenido = (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
          <ShieldCheck className="h-8 w-8 text-muted-foreground" />
          <div className="max-w-md">
            <p className="text-sm font-semibold text-foreground">Tu cuenta no está vinculada a una empresa</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Completa los datos de tu empresa en el perfil para poder iniciar la debida diligencia.
            </p>
          </div>
          <Button asChild size="sm">
            <Link href="/dashboard/perfil">Completar mi perfil</Link>
          </Button>
        </CardContent>
      </Card>
    );
  } else if (data.expediente && !ddUtils.puedeEditar(data.expediente.estado)) {
    contenido = (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
          <ShieldCheck className="h-8 w-8 text-muted-foreground" />
          <div className="max-w-md">
            <p className="text-sm font-semibold text-foreground">
              {data.expediente.estado === DD_ESTADOS.EN_REVISION
                ? "Tu debida diligencia está en revisión"
                : data.expediente.estado === DD_ESTADOS.APROBADA
                  ? "Tu debida diligencia ya está aprobada"
                  : "Tu debida diligencia fue rechazada"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {data.expediente.estado === DD_ESTADOS.EN_REVISION
                ? "Logística está revisando los documentos. Te avisaremos si hay observaciones."
                : data.expediente.estado === DD_ESTADOS.APROBADA
                  ? `La aprobación tiene una vigencia de ${DD_VIGENCIA_MESES} meses. Su fecha de cese es ${dateUtils.format(data.expediente.fechaVencimiento)}.`
                  : "El rechazo definitivo se comunica mediante informe legal."}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {puedeIniciarNueva ? (
              <Button
                type="button"
                size="sm"
                className="gap-1.5"
                disabled={iniciandoNueva}
                onClick={() => void iniciarNueva()}
              >
                {iniciandoNueva ? "Iniciando..." : "Iniciar nueva debida diligencia"}
              </Button>
            ) : null}
            <Button asChild variant="outline" size="sm">
              <Link href={DD_RUTAS.BASE}>Ver el estado de mi debida diligencia</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  } else {
    contenido = (
      <DdWizard
        empresa={data.empresa}
        expediente={data.expediente}
        requiereDeclaracionVigencia={data.requiereDeclaracionVigencia}
      />
    );
  }

  return <FormularioShell>{contenido}</FormularioShell>;
}
