"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Building2, Swords, TriangleAlert } from "lucide-react";
import FontScale from "@/components/FontScale";

const NAV = [
  { href: "/", label: "ボクシング", icon: Swords },
  { href: "/redevelopment", label: "再開発", icon: Building2 },
  { href: "/disasters", label: "災害情報", icon: TriangleAlert },
];

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="glass-panel sticky top-0 z-50 border-b border-white/10">
      <div className="mx-auto w-full max-w-6xl px-3 sm:px-4 lg:px-6">
        <div className="flex h-11 items-center justify-between gap-3">
          <Link href="/" className="flex min-w-0 items-center gap-2">
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

        <nav aria-label="情報カテゴリー" className="grid grid-cols-3 gap-1 pb-2">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/"
                ? pathname === "/" || pathname.startsWith("/world-titles")
                : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex h-8 items-center justify-center gap-1.5 rounded-md border text-xs font-semibold transition-colors ${
                  active
                    ? "border-white/15 bg-white/10 text-white"
                    : "border-transparent text-gray-500 hover:bg-white/5 hover:text-gray-200"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}