import { cn } from "@/lib/shared/utils";

interface Props {
  selected: boolean;
  className?: string;
}

/** Indicador visual limpio para radio cards (el RadioGroupItem real queda accesible y oculto). */
export function DdRadioIndicator({ selected, className }: Props) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
        selected ? "border-primary bg-primary" : "border-border bg-card",
        className,
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full bg-primary-foreground transition-transform",
          selected ? "scale-100" : "scale-0",
        )}
      />
    </span>
  );
}
