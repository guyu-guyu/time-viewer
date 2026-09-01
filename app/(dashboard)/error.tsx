"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // 生产环境 error.message 不下发（只有 digest），所以统一展示通用提示
  return (
    <div className="flex flex-col items-center gap-4 py-20 text-center">
      <h2 className="text-lg font-semibold">出错了</h2>
      <p className="text-sm text-muted-foreground">
        可能是登录状态失效或数据服务暂时不可用，请重试或重新登录。
      </p>
      <div className="flex gap-2">
        <Button onClick={reset}>重试</Button>
        <Button variant="outline" render={<Link href="/login" />}>
          重新登录
        </Button>
      </div>
    </div>
  );
}
