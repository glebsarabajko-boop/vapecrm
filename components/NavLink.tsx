"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
        active
          ? "bg-emerald-600/20 text-emerald-300"
          : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
      }`}
    >
      {label}
    </Link>
  );
}
