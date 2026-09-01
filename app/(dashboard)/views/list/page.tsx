import Link from "next/link";

import { FilterBar } from "@/components/filter-bar";
import { buttonVariants } from "@/components/ui/button";
import { countEntries, getCategories, listEntries } from "@/lib/dal";
import { parseCommon, parsePage, parseRange } from "@/lib/filters";
import { lastNDays } from "@/lib/time";

import { TableView } from "./table-view";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = { title: "明细 · time-viewer" };

const PAGE_SIZE = 50;

export default async function ListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const range = parseRange(sp, lastNDays(7));
  const filter = parseCommon(sp);
  const { page, offset } = parsePage(sp, PAGE_SIZE);
  const [rows, total, categories] = await Promise.all([
    listEntries(range, filter, { limit: PAGE_SIZE, offset }),
    countEntries(range, filter),
    getCategories(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function pageHref(target: number) {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (v && k !== "page") p.set(k, v);
    p.set("page", String(target));
    return `/views/list?${p.toString()}`;
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">明细</h1>
      <FilterBar mode="range" categories={categories} defaults={range} />
      <p className="text-sm text-muted-foreground">
        {range.from} ~ {range.to} · 共 {total} 条 · 第 {page}/{totalPages} 页
      </p>
      <TableView rows={rows} />
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link
            href={pageHref(page - 1)}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            上一页
          </Link>
        ) : (
          <span
            className={
              buttonVariants({ variant: "outline", size: "sm" }) +
              " pointer-events-none opacity-50"
            }
          >
            上一页
          </span>
        )}
        {page < totalPages ? (
          <Link
            href={pageHref(page + 1)}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            下一页
          </Link>
        ) : (
          <span
            className={
              buttonVariants({ variant: "outline", size: "sm" }) +
              " pointer-events-none opacity-50"
            }
          >
            下一页
          </span>
        )}
      </div>
    </div>
  );
}
