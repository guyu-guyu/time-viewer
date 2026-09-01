import { FilterBar } from "@/components/filter-bar";
import {
  getActivityBreakdown,
  getCategories,
  getCategoryBreakdown,
  getDailyTotals,
} from "@/lib/dal";
import { parseCommon, parseRange } from "@/lib/filters";
import { lastNDays } from "@/lib/time";

import { ChartsView } from "./charts-view";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = { title: "图表 · time-viewer" };

export default async function ChartsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const range = parseRange(sp, lastNDays(30));
  const filter = parseCommon(sp);
  const [daily, categoryTotals, activities, categoryOptions] = await Promise.all([
    getDailyTotals(range, filter),
    getCategoryBreakdown(range, filter),
    getActivityBreakdown(range, filter),
    getCategories(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">
        图表 · {range.from} ~ {range.to}
      </h1>
      <FilterBar mode="range" categories={categoryOptions} defaults={range} />
      <ChartsView daily={daily} categoryTotals={categoryTotals} activities={activities} />
    </div>
  );
}
