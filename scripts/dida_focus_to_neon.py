#!/usr/bin/env python3
"""滴答清单专注记录 → Neon Postgres (time-viewer entries 表) 校准同步脚本。

用法:
    python3 dida_focus_to_neon.py --from 2026-09-01 --to 2026-09-06 \
        [--database-url postgres://...] [--dry-run]

核心逻辑(以滴答清单为权威,不做去重):
1. 调用 dida-cli 拉取指定时间范围的专注记录(pomodoro + timing,自动 28 天切片)
2. **先删除**库内该时间范围内(start_time 落在范围内)的所有记录
3. **再全量写入**滴答数据——滴答删了记录→库同步删;滴答改了时间→库同步改

字段映射(与 time-viewer 新结构 1:1,直接透传滴答原始值):
  type          ← type (0=番茄钟, 1=正计时)
  start_time    ← startTime (UTC)
  end_time      ← endTime (UTC)
  duration      ← duration (毫秒)
  pause_duration← pauseDuration (毫秒)
  note          ← note
  task_title    ← tasks[0].title (无任务则 NULL)
  project_name  ← tasks[0].projectName (无项目则 NULL)
  source        = 'dida'
"""

import argparse
import datetime as dt
import json
import subprocess
import sys
from pathlib import Path

import psycopg2
from psycopg2.extras import execute_values

DIDA = "/usr/local/bin/dida"
BJT = dt.timezone(dt.timedelta(hours=8))
SOURCE_TAG = "dida"

DEFAULT_ENV = Path("/root/time-viewer/repo/.env")


def load_database_url(explicit: str | None) -> str:
    if explicit:
        return explicit
    env_path = DEFAULT_ENV
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if line.startswith("DATABASE_URL=") and len(line) > len("DATABASE_URL="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit("错误: 未找到 DATABASE_URL(--database-url 或 repo/.env)")


def parse_args():
    p = argparse.ArgumentParser(description="滴答专注 → Neon entries 校准同步(先清后写)")
    p.add_argument("--from", dest="from_date", required=True, help="开始日期 YYYY-MM-DD(北京时区)")
    p.add_argument("--to", dest="to_date", required=True, help="结束日期 YYYY-MM-DD(北京时区)")
    p.add_argument("--database-url", help="Neon 连接串(默认读 repo/.env 的 DATABASE_URL)")
    p.add_argument("--dry-run", action="store_true", help="只统计不执行删除/写入")
    args = p.parse_args()
    try:
        args.from_dt = dt.date.fromisoformat(args.from_date)
        args.to_dt = dt.date.fromisoformat(args.to_date)
    except ValueError as e:
        sys.exit(f"错误: 日期格式应为 YYYY-MM-DD ({e})")
    if args.from_dt > args.to_dt:
        sys.exit("错误: --from 晚于 --to")
    return args


def range_bounds(from_date: dt.date, to_date: dt.date):
    """返回 [from 00:00, to 23:59:59] 的 UTC 边界。"""
    start_bjt = dt.datetime.combine(from_date, dt.time.min, tzinfo=BJT)
    end_bjt = dt.datetime.combine(to_date, dt.time.max, tzinfo=BJT)
    return start_bjt.astimezone(dt.timezone.utc), end_bjt.astimezone(dt.timezone.utc)


# ── dida 拉取 ────────────────────────────────────────────────────────────────

def month_windows(from_date: dt.date, to_date: dt.date, max_days: int = 28):
    cur = from_date
    while cur <= to_date:
        end = min(cur + dt.timedelta(days=max_days - 1), to_date)
        yield cur, end
        cur = end + dt.timedelta(days=1)


def fetch_focus(type_key: str, from_date: dt.date, to_date: dt.date) -> list:
    records, seen = [], set()
    for d_from, d_to in month_windows(from_date, to_date):
        cmd = [DIDA, "focus", "list",
               "--from", f"{d_from.isoformat()}T00:00:00+08:00",
               "--to", f"{d_to.isoformat()}T23:59:59+08:00",
               "--type", type_key, "--json"]
        try:
            out = subprocess.run(cmd, capture_output=True, text=True,
                                 timeout=120, check=True).stdout
            data = json.loads(out)
        except subprocess.CalledProcessError as e:
            sys.exit(f"错误: dida 调用失败 ({d_from}~{d_to}): {(e.stderr or '')[:200]}")
        except json.JSONDecodeError:
            sys.exit(f"错误: dida 输出非 JSON ({d_from}~{d_to})")
        for rec in data if isinstance(data, list) else []:
            rid = rec.get("id")
            if rid and rid not in seen:
                seen.add(rid)
                records.append(rec)
    return records


def iso_to_utc(iso_str: str) -> dt.datetime:
    return dt.datetime.fromisoformat(iso_str.replace("Z", "+00:00")).astimezone(dt.timezone.utc)


def map_records(records: list) -> list:
    """映射为 entries 新结构行。type/note/tasks 直接对应滴答原始数据。"""
    rows = []
    for r in records:
        try:
            start_time = iso_to_utc(r["startTime"])
            end_time = iso_to_utc(r["endTime"])
        except (KeyError, ValueError):
            continue
        tasks = r.get("tasks") or []
        task = tasks[0] if tasks else {}
        row_type = r.get("type", 0)
        if row_type is None:
            row_type = 0
        rows.append((
            int(row_type),               # type: 0=番茄钟 1=正计时
            start_time,                  # start_time
            end_time,                    # end_time
            int(r.get("duration") or 0),       # duration (毫秒)
            int(r.get("pauseDuration") or 0),  # pause_duration (毫秒)
            r.get("note") or None,       # note
            task.get("title") or None,   # task_title
            task.get("projectName") or None,   # project_name
            SOURCE_TAG,                  # source
        ))
    return rows


# ── Neon 操作 ────────────────────────────────────────────────────────────────

def delete_range(conn, start_utc, end_utc) -> int:
    """删除库内 start_time 落在 [start_utc, end_utc] 的所有记录。"""
    with conn.cursor() as cur:
        cur.execute(
            "DELETE FROM entries WHERE start_time >= %s AND start_time <= %s",
            (start_utc, end_utc),
        )
        return cur.rowcount


def insert_rows(conn, rows: list) -> int:
    if not rows:
        return 0
    with conn.cursor() as cur:
        execute_values(
            cur,
            """INSERT INTO entries
                 (type, start_time, end_time, duration, pause_duration,
                  note, task_title, project_name, source)
               VALUES %s""",
            rows,
        )
    conn.commit()
    return len(rows)


def main():
    args = parse_args()
    database_url = load_database_url(args.database_url)
    start_utc, end_utc = range_bounds(args.from_dt, args.to_dt)

    # 1. 拉取滴答数据(两种类型),映射
    all_rows = []
    for t in ("pomodoro", "timing"):
        recs = fetch_focus(t, args.from_dt, args.to_dt)
        mapped = map_records(recs)
        print(f"[{t}] 拉取 {len(recs)} 条, 映射 {len(mapped)} 条")
        all_rows.extend(mapped)
    all_rows.sort(key=lambda r: r[1])

    # 2. 数据库操作(先清后写)
    conn = psycopg2.connect(database_url)
    try:
        print(f"时间范围: {args.from_dt} ~ {args.to_dt} (北京时区)")
        print(f"滴答数据合计: {len(all_rows)} 条 | source 标记: {SOURCE_TAG}")

        if args.dry_run:
            cur = conn.cursor()
            cur.execute(
                "SELECT count(*) FROM entries WHERE start_time >= %s AND start_time <= %s",
                (start_utc, end_utc),
            )
            existing = cur.fetchone()[0]
            print(f"(dry-run) 将删除库内该范围记录: {existing} 条 | 将写入: {len(all_rows)} 条")
            for r in all_rows[:8]:
                print("  示例:", ("番茄" if r[0] == 0 else "正计时"),
                      r[1].astimezone(BJT).strftime("%m-%d %H:%M"), "→",
                      r[2].astimezone(BJT).strftime("%H:%M"),
                      f"{round((r[2]-r[1]).total_seconds()/60)}分钟",
                      "|", r[7] or "(无项目)", "|", r[6] or "(无任务)")
            return

        deleted = delete_range(conn, start_utc, end_utc)
        conn.commit()
        inserted = insert_rows(conn, all_rows)
        print(f"✅ 已删除库内 {deleted} 条 → 写入 {inserted} 条 (source={SOURCE_TAG})")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
