import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isBetaInviteRequired } from "@/lib/beta/invite-codes";
import { signupAction } from "./actions";

export const metadata = {
  title: "保護者アカウント新規登録",
};

/**
 * W12-T3-A (DEC-069): β 招待コード関連エラー文言は中立 (DEC-024 罰則ゼロ).
 *  - invite_invalid    : 形式不正 (空 / 長さ違い / 許可外文字)
 *  - invite_not_found  : DB に存在しない code
 *  - invite_disabled   : 運営側で無効化済 (disabledAt set)
 *  - invite_expired    : 期限切れ (expiresAt < now)
 *  - invite_full       : 既に上限回数 redeem 済 / race で先取られ
 */
const ERROR_MESSAGES: Record<string, string> = {
  invalid_input: "入力内容を確認してください。",
  email_exists: "このメールアドレスはすでに登録されています。",
  signup_failed: "登録に失敗しました。時間をおいてもう一度お試しください。",
  invite_invalid: "招待コードを確認してください。",
  invite_not_found: "招待コードが見つかりませんでした。コードを確認してください。",
  invite_disabled: "この招待コードは現在ご利用いただけません。",
  invite_expired: "この招待コードの有効期限が切れています。",
  invite_full: "この招待コードはすでに利用上限に達しています。",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const errorMsg = params.error ? ERROR_MESSAGES[params.error] : null;
  // W12-T3-A (DEC-069): server-side env flag で invite_code Input の出し分け.
  // BETA_INVITE_REQUIRED 未設定 (default false) のとき = 既存挙動完全互換 (regression 0).
  const inviteRequired = isBetaInviteRequired();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <Card>
        <CardHeader>
          <CardTitle>保護者の方へ - アカウント作成</CardTitle>
          <CardDescription>
            HANEI は13歳未満のお子さま向けサービスのため、まず保護者の方にアカウントを作成いただきます。
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

          <form action={signupAction} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">メールアドレス</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="parent@example.com"
                className="min-h-tap-normal"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">パスワード(8文字以上)</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                className="min-h-tap-normal"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="parent_name">保護者の方のお名前</Label>
              <Input
                id="parent_name"
                name="parent_name"
                type="text"
                autoComplete="name"
                required
                className="min-h-tap-normal"
              />
            </div>

            {inviteRequired && (
              <div className="space-y-2">
                <Label htmlFor="invite_code">β 招待コード</Label>
                <Input
                  id="invite_code"
                  name="invite_code"
                  type="text"
                  autoComplete="off"
                  required
                  inputMode="text"
                  placeholder="ABCD2345"
                  className="min-h-tap-normal uppercase tracking-widest"
                  data-testid="invite-code-input"
                />
                <p className="text-xs text-muted-foreground">
                  運営からお渡しした 8 文字の招待コードをご入力ください。
                </p>
              </div>
            )}

            <fieldset className="space-y-3 rounded-md border bg-muted/40 p-4">
              <legend className="px-2 text-sm font-medium">
                同意事項(必須)
              </legend>

              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  name="consent_coppa"
                  required
                  className="mt-1 size-5"
                />
                <span>
                  <strong>13歳未満の利用に関する保護者同意:</strong>
                  HANEI が学習データ(ニックネーム / 学習履歴 / 受験日)を
                  <Link href="/legal/privacy" className="underline">
                    プライバシーポリシー
                  </Link>
                  に基づき取り扱うことに同意します。
                </span>
              </label>

              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  name="consent_ai_chat"
                  required
                  className="mt-1 size-5"
                />
                <span>
                  <strong>AIコーチ利用への同意:</strong>
                  お子さまが AI コーチ(OpenAI 利用)に質問できることに同意します。
                  会話内容は安全のため記録され、保護者の方が閲覧できます。
                </span>
              </label>

              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  name="consent_terms"
                  required
                  className="mt-1 size-5"
                />
                <span>
                  <Link href="/legal/terms" className="underline">
                    利用規約
                  </Link>
                  に同意します。
                </span>
              </label>
            </fieldset>

            <Button
              type="submit"
              size="lg"
              className="min-h-tap-cta w-full"
            >
              アカウントを作成する
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            すでにアカウントをお持ちですか?{" "}
            <Link href="/login" className="text-primary underline">
              ログイン
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
