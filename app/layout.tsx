import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import PwaRegister from "@/components/PwaRegister";
import "./globals.css";

export const metadata: Metadata = {
  title: "VapeCRM — мастерская и касса",
  description: "Учёт ремонтов, склада и продаж для мастерской",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-180.png",
  },
  appleWebApp: {
    capable: true,
    title: "VapeCRM",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
