export type CommonFilter = { category: string | null; q: string | null };

export type EntryDTO = {
  id: number;
  startedAt: Date;
  endedAt: Date;
  durationMinutes: number;
  category: string;
  activity: string;
  note: string | null;
};

export type DailyTotal = {
  date: string;
  totalMinutes: number;
  byCategory: Record<string, number>;
};

export type CategoryTotal = { category: string; minutes: number };

export type ActivityTotal = { activity: string; category: string; minutes: number };
