"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addDay, addMonth } from "@/lib/time";

type Props = {
  categories: string[];
  mode: "date" | "month" | "range";
  defaults: { date?: string; month?: string; from?: string; to?: string };
};

export function FilterBar({ categories, mode, defaults }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");

  const date = sp.get("date") ?? defaults.date!;
  const month = sp.get("month") ?? defaults.month!;
  const from = sp.get("from") ?? defaults.from!;
  const to = sp.get("to") ?? defaults.to!;

  function update(mutate: (p: URLSearchParams) => void) {
    const params = new URLSearchParams(sp.toString());
    mutate(params);
    params.delete("page"); // 筛选变更后回到第 1 页
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {mode === "date" && (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => update((p) => p.set("date", addDay(date, -1)))}
          >
            前一天
          </Button>
          <Input
            type="date"
            className="w-40"
            value={date}
            onChange={(e) => e.target.value && update((p) => p.set("date", e.target.value))}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => update((p) => p.set("date", addDay(date, 1)))}
          >
            后一天
          </Button>
        </>
      )}
      {mode === "month" && (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => update((p) => p.set("month", addMonth(month, -1)))}
          >
            上月
          </Button>
          <Input
            type="month"
            className="w-36"
            value={month}
            onChange={(e) => e.target.value && update((p) => p.set("month", e.target.value))}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => update((p) => p.set("month", addMonth(month, 1)))}
          >
            下月
          </Button>
        </>
      )}
      {mode === "range" && (
        <>
          <Input
            type="date"
            className="w-40"
            value={from}
            onChange={(e) => e.target.value && update((p) => p.set("from", e.target.value))}
          />
          <span className="text-sm text-muted-foreground">至</span>
          <Input
            type="date"
            className="w-40"
            value={to}
            onChange={(e) => e.target.value && update((p) => p.set("to", e.target.value))}
          />
        </>
      )}

      <Select
        value={sp.get("category") ?? "all"}
        onValueChange={(v) =>
          update((p) => (v && v !== "all" ? p.set("category", v) : p.delete("category")))
        }
      >
        <SelectTrigger className="w-32">
          <SelectValue placeholder="全部分类" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部分类</SelectItem>
          {categories.map((c) => (
            <SelectItem key={c} value={c}>
              {c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          update((p) => (q ? p.set("q", q) : p.delete("q")));
        }}
      >
        <Input
          className="w-44"
          placeholder="关键词：活动/备注"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Button type="submit" variant="outline" size="sm">
          搜索
        </Button>
      </form>
    </div>
  );
}
