"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // TODO(W2): Sentry に送信
    console.error("[error.tsx]", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-3xl font-bold">エラーが発生しました</h1>
      <p className="text-muted-foreground">
        申し訳ありません。少し時間をおいてからもう一度お試しください。
      </p>
      <Button onClick={reset}>もう一度試す</Button>
    </main>
  );
}
