"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const variantStyles = {
  primary:
    "from-white to-blue-50/50 border-blue-100 text-blue-600",
  secondary:
    "from-white to-slate-50 border-slate-200 text-slate-600",
  success:
    "from-white to-emerald-50/50 border-emerald-100 text-emerald-600",
  warning:
    "from-white to-amber-50/50 border-amber-100 text-amber-600",
} as const;

interface StatsCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon?: ReactNode;
  variant?: keyof typeof variantStyles;
}

export function StatsCard({
  title,
  value,
  subtitle,
  icon,
  variant = "secondary",
}: StatsCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className={cn(
        "relative overflow-hidden rounded-[1.75rem] border bg-gradient-to-br p-6 shadow-sm transition-shadow hover:shadow-lg",
        variantStyles[variant],
      )}
    >
      <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-current opacity-5 blur-2xl" />
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-current opacity-60">
            {title}
          </p>
          <p className="text-4xl font-bold text-slate-900">{value}</p>
          {subtitle && (
            <p className="text-xs font-semibold text-current opacity-70">
              {subtitle}
            </p>
          )}
        </div>
        {icon && (
          <div className="rounded-xl bg-current/10 p-2.5 text-current">
            {icon}
          </div>
        )}
      </div>
    </motion.div>
  );
}
