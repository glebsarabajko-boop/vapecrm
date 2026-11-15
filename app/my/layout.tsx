import Link from "next/link";
import type { ReactNode } from "react";
import { requireClient } from "@/lib/cabinet-auth";
import { logoutClientAction } from "@/app/actions/auth";
import { btnGhost } from "@/components/ui";

export default async function MyLayout({ children }: { children: ReactNode }) {
  const client = await requireClient();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-zinc-800 bg-zinc-900/60">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/my" className="font-semibold text-emerald-400">
            VapeCRM · кабинет
          </Link>
          <div className="flex items-center gap-3 text-sm text-zinc-400">
            <span>{client.name}</span>
            <form action={logoutClientAction}>
              <button type="submit" className={btnGhost}>
                Выйти
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
