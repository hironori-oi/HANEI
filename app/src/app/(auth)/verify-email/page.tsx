import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { verifyEmailAction, resendVerificationAction } from "./actions";

export const metadata = {
  title: "メールアドレスの確認",
};

const ERROR_MESSAGES: Record<string, string> = {
  invalid_code: "コードが正しくありません。もう一度お試しください。",
  expired: "コードの有効期限が切れています。再送してください。",
  unknown: "確認に失敗しました。時間をおいてお試しください。",
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const params = await searchParams;
  const errorMsg = params.error ? ERROR_MESSAGES[params.error] : null;
  const sent = params.sent === "1";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <Card>
        <CardHeader>
          <CardTitle>メールアドレスの確認</CardTitle>
          <CardDescription>
            ご登録いただいたメールアドレス宛に、6桁の確認コードを送信しました。
            メール本文のコードを入力してください。
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
          {sent && (
            <div
              role="status"
              className="mb-4 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success"
            >
              確認コードを再送しました。メールをご確認ください。
            </div>
          )}

          <form action={verifyEmailAction} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="code">確認コード(6桁)</Label>
              <Input
                id="code"
                name="code"
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                required
                placeholder="123456"
                className="min-h-tap-normal text-center text-lg tracking-widest"
              />
            </div>
            <Button type="submit" size="lg" className="min-h-tap-cta w-full">
              確認する
            </Button>
          </form>

          <form action={resendVerificationAction} className="mt-6">
            <Button type="submit" variant="ghost" size="sm" className="w-full">
              コードが届かない場合は再送する
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            <Link href="/login" className="underline">
              ログイン画面に戻る
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
