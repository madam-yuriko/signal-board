"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Building2,
  Cpu,
  Fish,
  Film,
  Gamepad2,
  LoaderCircle,
  Swords,
  TriangleAlert,
} from "lucide-react";
import FontScale from "@/components/FontScale";

const NAV = [
  { href: "/", label: "CPU&GPU&APU", icon: Cpu },
  { href: "/redevelopment", label: "再開発", icon: Building2 },
  { href: "/movies", label: "映画", icon: Film },
  { href: "/indie-games", label: "インディーゲーム", icon: Gamepad2 },
  { href: "/aquarium", label: "アクアリウム", icon: Fish },
  { href: "/boxing", label: "ボクシング", icon: Swords },
  { href: "/disasters", label: "災害", icon: TriangleAlert },
];

const NAVIGATION_START_EVENT = "signal-board:navigation-start";

export default function Header() {
  const pathname = usePathname();
  const [pendingPath, setPendingPath] = useState<string>();
  const navigationPath = pendingPath ?? pathname;

  useEffect(() => {
    const timer = window.setTimeout(() => setPendingPath(undefined), 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  function startPageNavigation(href: string) {
    setPendingPath(href);
    window.dispatchEvent(new Event(NAVIGATION_START_EVENT));
  }

  return (
    <header className="glass-panel sticky top-0 z-50 border-b border-white/10">
      <div className="mx-auto w-full max-w-[2200px] px-3 sm:px-4 lg:px-6 2xl:px-8">
        <div className="flex h-11 items-center justify-between gap-3">
          <Link
            href="/"
            onClick={pathname === "/" ? undefined : () => startPageNavigation("/")}
            className="flex min-w-0 items-center gap-2"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/8 text-cyan-300">
              <Activity className="h-4 w-4" />
            </span>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-sm font-bold tracking-tight text-white">
                Signal Board
              </div>
              <div className="hidden text-[10px] text-gray-500 sm:block">
                情報を対象単位で追跡する
              </div>
            </div>
          </Link>
          <FontScale />
        </div>

        <nav aria-label="情報カテゴリー" className="flex gap-0.5 overflow-x-auto pb-2 sm:gap-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const atTarget = pathname === href;
            const active =
              href === "/"
                ? navigationPath === "/"
                : href === "/boxing"
                  ? navigationPath.startsWith("/boxing") || navigationPath.startsWith("/world-titles")
                  : navigationPath.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                onClick={atTarget ? undefined : () => startPageNavigation(href)}
                className={`flex h-8 min-w-[72px] shrink-0 items-center justify-center gap-1 rounded-md border px-0.5 text-[10px] font-semibold leading-none transition-colors sm:min-w-0 sm:flex-1 sm:shrink sm:gap-1.5 sm:px-1 sm:text-xs ${
                  active
                    ? "border-white/15 bg-white/10 text-white"
                    : "border-transparent text-gray-500 hover:bg-white/5 hover:text-gray-200"
                }`}
              >
                <Icon className="hidden h-3.5 w-3.5 shrink-0 sm:block" />
                <span className="whitespace-nowrap">{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
      {pendingPath && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-3 right-3 z-50 flex items-center gap-2 rounded-lg border border-white/10 bg-[#15161d]/95 px-3 py-2 text-[11px] font-semibold text-gray-200 shadow-2xl"
        >
          <LoaderCircle className="h-3.5 w-3.5 animate-spin text-cyan-300" />
          タブを切り替えています
        </div>
      )}
    </header>
  );
}
