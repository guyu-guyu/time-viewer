"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { views } from "@/lib/views/registry";

export function SidebarNav() {
  const pathname = usePathname();
  const sp = useSearchParams();

  // 只携带共享参数（category/q），视图主参数不跨视图
  const shared = new URLSearchParams();
  if (sp.get("category")) shared.set("category", sp.get("category")!);
  if (sp.get("q")) shared.set("q", sp.get("q")!);
  const qs = shared.toString();

  const link = (href: string) => `${href}${qs ? `?${qs}` : ""}`;
  const cls = (active: boolean) =>
    `flex items-center gap-2 rounded px-3 py-2 text-sm hover:bg-accent ${active ? "bg-accent font-medium" : "text-muted-foreground"}`;

  return (
    <nav className="flex flex-col gap-1">
      <Link href={link("/")} className={cls(pathname === "/")}>
        总览
      </Link>
      {views.map((v) => (
        <Link
          key={v.id}
          href={link(`/views/${v.id}`)}
          className={cls(pathname === `/views/${v.id}`)}
        >
          <v.icon className="size-4" />
          {v.title}
        </Link>
      ))}
    </nav>
  );
}
