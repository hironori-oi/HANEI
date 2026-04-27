import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-5xl font-bold">404</h1>
      <p className="text-lg text-muted-foreground">
        ページが見つかりませんでした。
      </p>
      <Button asChild>
        <Link href="/">トップに戻る</Link>
      </Button>
    </main>
  );
}
