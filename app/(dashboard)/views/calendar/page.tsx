import { FilterBar } from "@/components/filter-bar";
import { getDailyTotals, getProjects } from "@/lib/dal";
import { parseCommon, parseMonthParam } from "@/lib/filters";
import { currentMonthStr, monthRange } from "@/lib/time";

import { CalendarHeatmap } from "./calendar-view";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = { title: "月历 · time-viewer" };

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const month = parseMonthParam(sp, currentMonthStr());
  const range = monthRange(month);
  const filter = parseCommon(sp);
  const [totals, projects] = await Promise.all([
    getDailyTotals(range, filter),
    getProjects(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">月历 · {month}</h1>
      <FilterBar mode="month" projects={projects} defaults={{ month }} />
      <CalendarHeatmap month={month} totals={totals} />
    </div>
  );
}
