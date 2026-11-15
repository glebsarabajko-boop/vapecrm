import { redirect } from "next/navigation";

// Главный экран мастера — активные ремонты
export default function HomePage() {
  redirect("/repairs");
}
