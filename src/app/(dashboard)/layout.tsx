import { DashboardHeader } from "@/components/dashboard/dashboard-header";

export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <DashboardHeader />
      <div className="flex-1">{children}</div>
    </div>
  );
}
