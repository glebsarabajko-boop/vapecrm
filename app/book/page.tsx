import Link from "next/link";
import { createBookingAction } from "@/app/actions/booking";
import { btnPrimary, inputClass } from "@/components/ui";

// Публичная запись на ремонт: клиент оставляет заявку сам, без входа в систему.
// Заявка попадает в общий список ремонтов со статусом «Принят».
export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; phone?: string }>;
}) {
  const { ok, error, phone } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <h1 className="text-center text-lg font-semibold text-emerald-400">VapeCRM</h1>
        <p className="mt-1 text-center text-xs text-zinc-500">Запись на ремонт</p>

        {ok ? (
          <div className="mt-6 rounded-2xl border border-emerald-900 bg-emerald-950/40 p-5 text-center">
            <p className="text-sm text-emerald-300">Заявка принята!</p>
            <p className="mt-2 text-lg font-semibold">{ok.startsWith("R-") ? ok : `R-${ok}`}</p>
            <p className="mt-1 text-sm text-zinc-400">
              Сохрани номер — по нему можно проверять статус. Мы свяжемся с тобой, чтобы
              подтвердить детали.
            </p>
            <Link
              href={`/status?n=${ok.startsWith("R-") ? ok : `R-${ok}`}`}
              className={`${btnPrimary} mt-4 inline-block`}
            >
              Проверить статус
            </Link>
            <p className="mt-4 text-xs text-zinc-600">
              Личный кабинет уже готов —{" "}
              <Link href="/login" className="text-emerald-300 underline hover:text-emerald-200">
                войди
              </Link>{" "}
              своим телефоном и паролем из заявки
              {" · "}
              <Link href="/book" className="underline hover:text-zinc-400">
                записать ещё одно устройство
              </Link>
            </p>
          </div>
        ) : (
          <>
            {error && (
              <p className="mt-5 rounded-xl bg-red-950 px-4 py-3 text-sm text-red-300">
                Заполни телефон и модель устройства
              </p>
            )}
            <form action={createBookingAction} className="mt-6 space-y-3">
              {/* honeypot для ботов: человек это поле не видит */}
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                className="hidden"
                aria-hidden="true"
              />
              <input
                name="phone"
                placeholder="Телефон: +375 25/29/33/44 123-45-67 или +7 916 123-45-67"
                className={inputClass}
                required
              />
              <input name="name" placeholder="Как тебя зовут" className={inputClass} />
              <input
                name="deviceModel"
                placeholder="Модель устройства, например Vaporesso XROS 3"
                className={inputClass}
                required
              />
              <textarea
                name="problem"
                rows={3}
                placeholder="Что случилось (не обязательно)"
                className={inputClass}
              />
              <label className="block">
                <span className="text-xs text-zinc-500">
                  Желаемые дата и время визита (необязательно — подтвердим звонком)
                </span>
                <input name="preferredAt" type="datetime-local" className={`${inputClass} mt-1.5`} />
              </label>
              <label className="block">
                <span className="text-xs text-zinc-500">
                  Пароль для личного кабинета (необязательно, минимум 6 символов) —
                  потом входишь этим телефоном и паролем на главной странице
                </span>
                <input
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  className={`${inputClass} mt-1.5`}
                />
              </label>
              <button type="submit" className={`${btnPrimary} w-full`}>
                Записаться на ремонт
              </button>
            </form>
            <p className="mt-4 text-xs text-zinc-600">
              Уже в ремонте?{" "}
              <Link href="/status" className="underline hover:text-zinc-400">
                проверь статус по номеру
              </Link>
              {" · "}
              <Link href="/login" className="underline hover:text-zinc-400">
                личный кабинет
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
