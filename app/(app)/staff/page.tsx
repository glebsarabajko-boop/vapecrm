import { db } from "@/lib/db";
import { hashPassword, requireAdmin } from "@/lib/auth";
import {
  changePasswordAction,
  createStaffAction,
  toggleActiveAction,
} from "@/app/actions/staff";
import {
  Badge,
  btnGhost,
  btnPrimary,
  Card,
  Field,
  inputClass,
  PageTitle,
} from "@/components/ui";

const ERRORS: Record<string, string> = {
  "1": "Логин, имя и пароль (минимум 6 символов) обязательны",
  login: "Такой логин уже занят",
  short: "Пароль должен быть минимум 6 символов",
};

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdmin();
  const { error } = await searchParams;

  const staff = await db.user.findMany({ orderBy: [{ role: "asc" }, { name: "asc" }] });

  return (
    <div className="space-y-5">
      <PageTitle>Сотрудники</PageTitle>

      {error && (
        <p className="rounded-lg bg-red-950 px-4 py-2 text-sm text-red-300">
          {ERRORS[error] ?? "Ошибка"}
        </p>
      )}

      <div className="overflow-x-auto rounded-2xl border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">Сотрудник</th>
              <th className="px-4 py-3">Роль</th>
              <th className="px-4 py-3">Доступ</th>
              <th className="px-4 py-3">Смена пароля</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {staff.map((u) => (
              <tr key={u.id} className="hover:bg-zinc-900/60">
                <td className="px-4 py-3">
                  <div className="text-zinc-100">{u.name}</div>
                  <div className="text-xs text-zinc-500">{u.login}</div>
                </td>
                <td className="px-4 py-3">
                  <Badge
                    className={
                      u.role === "ADMIN" ? "bg-amber-950 text-amber-300" : "bg-sky-950 text-sky-300"
                    }
                  >
                    {u.role === "ADMIN" ? "админ" : "мастер"}
                  </Badge>
                  {u.masterPercent > 0 && u.role === "MASTER" && (
                    <span className="ml-2 text-xs text-zinc-500">процент {u.masterPercent}%</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <form action={toggleActiveAction}>
                    <input type="hidden" name="userId" value={u.id} />
                    <button
                      type="submit"
                      disabled={u.role === "ADMIN"}
                      title={u.role === "ADMIN" ? "Единственного админа отключить нельзя" : ""}
                      className={btnGhost}
                    >
                      {u.isActive ? "Отключить" : "Включить"}
                    </button>
                  </form>
                  {u.role === "ADMIN" && (
                    <span className="mt-1 block text-xs text-zinc-500">защищён</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <form action={changePasswordAction} className="flex items-center gap-2">
                    <input type="hidden" name="userId" value={u.id} />
                    <input
                      name="password"
                      type="password"
                      placeholder="новый пароль"
                      className={`${inputClass} w-36`}
                    />
                    <button type="submit" className={btnGhost}>
                      Сменить
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="bg-zinc-900/70 px-4 py-2 text-xs text-zinc-500">
          «Отключить» — доступ закрыт мгновенно, все сессии сотрудника сбрасываются.
        </p>
      </div>

      <Card>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Новый сотрудник
        </h2>
        <form action={createStaffAction} className="grid gap-3 sm:grid-cols-2">
          <Field label="Логин">
            <input name="login" className={inputClass} required />
          </Field>
          <Field label="Имя">
            <input name="name" className={inputClass} required />
          </Field>
          <Field label="Роль">
            <select name="role" className={inputClass} defaultValue="MASTER">
              <option value="MASTER">Мастер</option>
              <option value="ADMIN">Админ</option>
            </select>
          </Field>
          <Field label="Пароль (минимум 6 символов)">
            <input name="password" type="password" className={inputClass} required />
          </Field>
          <div className="sm:col-span-2">
            <button type="submit" className={btnPrimary}>
              Добавить сотрудника
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
