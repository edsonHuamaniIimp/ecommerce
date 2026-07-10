import { PlanoIsometrico } from "@/components/plano/plano-isometrico";

export default function PlanoIsometricoPage() {
  return (
    <main className="flex flex-1 flex-col px-4 py-6 sm:px-6">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4">
        <PlanoIsometrico />
      </div>
    </main>
  );
}
