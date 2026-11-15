import Link from "next/link";
import { loginAction } from "@/app/actions/auth";
import { btnPrimary, inputClass } from "@/components/ui";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
        <h1 className="text-center text-lg font-semibold text-emerald-400">VapeCRM</h1>
        <p className="mt-1 text-center text-xs text-zinc-500">Мастерская и касса</p>

        <form action={loginAction} className="mt-6 space-y-3">
          <input
            name="login"
            placeholder="Логин или телефон"
            autoComplete="username"
            className={inputClass}
            required
          />
          <input
            name="password"
            type="password"
            placeholder="Пароль"
            autoComplete="current-password"
            className={inputClass}
            required
          />
          {error && <p className="text-sm text-red-400">Неверные данные для входа</p>}
          <button type="submit" className={`${btnPrimary} w-full`}>
            Войти
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-zinc-500">
          Сотрудник входит своим логином, клиент — своим телефоном.
        </p>
        <p className="mt-3 text-center text-xs text-zinc-600">
          Клиент без пароля?{" "}
          <Link href="/cabinet/register" className="underline hover:text-zinc-400">
            создай личный кабинет
          </Link>
        </p>
      </div>
    </div>
  );
}
