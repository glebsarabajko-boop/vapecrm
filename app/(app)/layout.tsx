import type { ReactNode } from "react";
import NavLink from "@/components/NavLink";
import { btnGhost } from "@/components/ui";
import { logoutAction } from "@/app/actions/auth";
import { requireUser } from "@/lib/auth";

const NAV_LINKS = [
  { href: "/pos", label: "Касса" },
  { href: "/inventory", label: "Склад" },
  { href: "/repairs", label: "Ремонты" },
  { href: "/clients", label: "Клиенты" },
  { href: "/payroll", label: "Зарплата" },
  { href: "/compatibility", label: "Совместимость" },
];

// пункт только для админа добавляется после списка
const ADMIN_LINKS = [{ href: "/staff", label: "Сотрудники" }];

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const roleLabel = user.role === "ADMIN" ? "админ" : "мастер";
  const links = user.role === "ADMIN" ? [...NAV_LINKS, ...ADMIN_LINKS] : NAV_LINKS;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-zinc-800 bg-zinc-900/60">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-1 px-4 py-3">
          <span className="mr-4 font-semibold text-emerald-400">VapeCRM</span>
          <nav className="flex items-center gap-1">
            {links.map((link) => (
              <NavLink key={link.href} href={link.href} label={link.label} />
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm text-zinc-400">
            <span>
              {user.name} · {roleLabel}
            </span>
            <form action={logoutAction}>
              <button type="submit" className={btnGhost}>
                Выйти
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
