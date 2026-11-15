import { NextRequest, NextResponse } from "next/server";

// Быстрая проверка cookie на входе (валидность сессии проверяется в БД в requireUser/requireClient):
//  - /cabinet, /status, /book, /login, /api — публичные зоны;
//  - /my — личный кабинет клиента: нужна клиентская cookie «client_session»;
//  - всё остальное — рабочий интерфейс сотрудника: нужна cookie «session».
export function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;

  if (/^\/(login|status|book|cabinet)\b/.test(path) || /^\/api\//.test(path)) {
    return NextResponse.next();
  }

  if (path === "/my" || path.startsWith("/my/")) {
    if (!req.cookies.get("client_session")?.value) {
      return NextResponse.redirect(new URL("/cabinet/login", req.url));
    }
    return NextResponse.next();
  }

  if (!req.cookies.get("session")?.value) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|sw.js).*)",
  ],
};
