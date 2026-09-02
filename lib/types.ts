export const ENTRY_TYPE_LABELS = {
  0: "番茄",
  1: "正计时",
} as const;

export const UNASSIGNED_PROJECT = "未关联项目";
export const UNASSIGNED_PROJECT_FILTER = "__unassigned__";
export const UNASSIGNED_TASK = "未关联任务";

export type EntryType = keyof typeof ENTRY_TYPE_LABELS;

export type CommonFilter = { projectName: string | null; q: string | null };

export type EntryDTO = {
  id: number;
  type: EntryType;
  note: string | null;
  taskTitle: string | null;
  projectName: string | null;
  startTime: Date;
  endTime: Date;
  duration: number;
  pauseDuration: number;
  source: string;
  createdAt: Date;
};

export type DailyTotal = {
  date: string;
  totalMinutes: number;
  byProject: Record<string, number>;
};

export type ProjectTotal = { projectName: string; minutes: number };

export type TaskTotal = {
  taskTitle: string;
  projectName: string;
  minutes: number;
};
