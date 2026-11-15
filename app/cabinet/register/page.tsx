import Link from "next/link";
import { registerClientAction } from "@/app/actions/cabinet";
import { btnPrimary, inputClass } from "@/components/ui";

const ERRORS: Record<string, string> = {
  not_found: "Такого номера в базе нет — сначала запишись на ремонт или купи что-нибудь в кассе",
  already_registered: "На этот номер аккаунт уже создан — войди по паролю",
  "1": "Телефон и пароль (минимум 6 символов) обязательны",
};

export default async function CabinetRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; phone?: string }>;
}) {
  const { error, phone: prefilled } = await searchParams;
  // из /book приходит номер с «+» в начале (encodeURIComponent); вернём как есть
  const phone = prefilled;

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
        <h1 className="text-center text-lg font-semibold text-emerald-400">Создать кабинет</h1>
        <p className="mt-1 text-center text-xs text-zinc-500">
          Телефон, по которому ты уже записывался или покупал
        </p>

        <form action={registerClientAction} className="mt-6 space-y-3">
          <input
            name="phone"
            defaultValue={phone ?? ""}
            placeholder="Телефон: +375 25/29/33/44 …"
            autoComplete="username"
            className={inputClass}
            required
          />
          <input name="name" placeholder="Как тебя зовут (необязательно)" className={inputClass} />
          <input
            name="password"
            type="password"
            placeholder="Пароль (минимум 6 символов)"
            autoComplete="new-password"
            className={inputClass}
            required
          />
          {error && <p className="text-sm text-red-400">{ERRORS[error] ?? "Ошибка регистрации"}</p>}
          <button type="submit" className={`${btnPrimary} w-full`}>
            Создать кабинет
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-zinc-500">
          Уже есть пароль?{" "}
          <Link href="/cabinet/login" className="text-emerald-300 hover:underline">
            Войти
          </Link>
        </p>
      </div>
    </div>
  );
}
