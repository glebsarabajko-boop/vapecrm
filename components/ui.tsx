// Простые UI-хелперы — единые классы в тёмной теме

import type { ReactNode } from "react";

export const inputClass =
  "w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-emerald-500";

export const btnPrimary =
  "rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50";

export const btnGhost =
  "rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800";

export const btnDanger =
  "rounded-lg border border-red-900 px-3 py-1.5 text-xs text-red-300 hover:bg-red-950";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 ${className}`}>
      {children}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs text-zinc-400">{label}</span>
      {children}
    </label>
  );
}

export function Badge({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}

export function PageTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-5 flex items-center justify-between gap-4">
      <h1 className="text-xl font-semibold text-zinc-100">{children}</h1>
      {right}
    </div>
  );
}
