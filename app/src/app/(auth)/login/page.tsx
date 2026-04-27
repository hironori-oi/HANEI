import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction } from "./actions";

export const metadata = {
  title: "ログイン",
};

const ERROR_MESSAGES: Record<string, string> = {
  invalid_input: "入力内容を確認してください。",
  invalid_credentials: "メールアドレスまたはパスワードが違います。",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; redirect?: string }>;
}) {
  const params = await searchParams;
  const errorMsg = params.error ? ERROR_MESSAGES[params.error] : null;
  const redirectTo = params.redirect ?? "";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <Card>
        <CardHeader>
          <CardTitle>ログイン</CardTitle>
          <CardDescription>
            保護者の方は登録済みのメールアドレスとパスワードでログインしてください。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {errorMsg && (
            <div
              role="alert"
              className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {errorMsg}
            </div>
          )}

          <form action={loginAction} className="space-y-5">
            <input type="hidden" name="redirect_to" value={redirectTo} />

            <div className="space-y-2">
              <Label htmlFor="email">メールアドレス</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="min-h-tap-normal"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">パスワード</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="min-h-tap-normal"
              />
            </div>

            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                name="remember"
                defaultChecked
                className="size-4"
              />
              <span>このブラウザで30日間ログインを保持する</span>
            </label>

            <Button type="submit" size="lg" className="min-h-tap-cta w-full">
              ログイン
            </Button>
          </form>

          <div className="mt-6 flex flex-col gap-2 text-center text-sm">
            <Link href="/forgot-password" className="text-muted-foreground underline">
              パスワードを忘れた方はこちら
            </Link>
            <p className="text-muted-foreground">
              アカウントをお持ちでない方は{" "}
              <Link href="/signup" className="text-primary underline">
                新規登録
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
