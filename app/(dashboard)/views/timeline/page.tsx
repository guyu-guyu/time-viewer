import { FilterBar } from "@/components/filter-bar";
import { getCategories, getDayEntries } from "@/lib/dal";
import { parseCommon, parseDateParam } from "@/lib/filters";
import { getDisplayTz, todayStr } from "@/lib/time";

import { TimelineView } from "./timeline-view";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = { title: "时间轴 · time-viewer" };

export default async function TimelinePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const date = parseDateParam(sp, todayStr());
  const filter = parseCommon(sp);
  const [rows, categories] = await Promise.all([getDayEntries(date, filter), getCategories()]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">时间轴 · {date}</h1>
      <FilterBar mode="date" categories={categories} defaults={{ date }} />
      <TimelineView date={date} entries={rows} tz={getDisplayTz()} />
    </div>
  );
}
