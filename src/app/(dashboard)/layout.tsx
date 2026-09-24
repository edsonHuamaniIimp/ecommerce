"use client";

import { useState } from "react";
import { Button } from "@nrivera-iimp/ui-kit-iimp";
import { Menu } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { Sidebar } from "@/components/dashboard/sidebar";

export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        open={sidebarOpen}
        collapsed={collapsed}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex flex-1 flex-col min-w-0">
        <header className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b border-border bg-card px-4 sm:px-6 lg:px-10">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0 lg:hidden" onClick={() => setSidebarOpen((p) => !p)}>
            <Menu className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0 hidden lg:inline-flex" onClick={() => setCollapsed((p) => !p)}>
            <Menu className="h-4 w-4" />
          </Button>
          <DashboardHeader />
        </header>
        <div className="flex-1 min-w-0 px-3 sm:px-6 lg:px-10 py-4 sm:py-6">{children}</div>
      </div>
    </div>
  );
}
