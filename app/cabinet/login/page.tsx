import { redirect } from "next/navigation";

// Старый адрес входа клиента: теперь вход единый на /login
export default function CabinetLoginPage() {
  redirect("/login");
}
