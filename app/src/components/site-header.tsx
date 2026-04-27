import Link from "next/link";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="font-bold text-lg tracking-tight">
          HANEI
        </Link>
        <nav className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">ログイン</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/signup">無料ではじめる</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
