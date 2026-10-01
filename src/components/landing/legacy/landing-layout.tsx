import { LandingHeader } from "@/components/layout/landing-header";

/** Layout del landing: header propio (Swiss) en lugar del Header global de la app. */
export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-white text-[#000000]">
      <LandingHeader />
      {children}
    </div>
  );
}
