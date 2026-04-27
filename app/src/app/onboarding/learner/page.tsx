import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createLearnerAction } from "./actions";

export const metadata = {
  title: "お子さまのプロフィール",
};

export default function LearnerOnboardingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-12">
      <Card>
        <CardHeader>
          <CardTitle>お子さまのプロフィールを作成</CardTitle>
          <CardDescription>
            学習プランを立てるために、お子さまの情報を入力してください。本名は不要です。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createLearnerAction} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="nickname">ニックネーム</Label>
              <Input
                id="nickname"
                name="nickname"
                required
                maxLength={20}
                placeholder="例: たろう / さくら"
                className="min-h-tap-normal"
              />
              <p className="text-xs text-muted-foreground">
                ※本名は使わず、お子さまの好きなニックネームを入力してください。
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="avatar_id">アバター(仮)</Label>
              <select
                id="avatar_id"
                name="avatar_id"
                required
                className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-base"
                defaultValue="kotodama_tori"
              >
                <option value="kotodama_tori">ことだまトリ(おすすめ)</option>
                <option value="kotodama_inu">ことだまイヌ</option>
                <option value="kotodama_usagi">ことだまウサギ</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="current_level">現在のレベル</Label>
              <select
                id="current_level"
                name="current_level"
                required
                className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-base"
                defaultValue="beginner"
              >
                <option value="beginner">はじめて(英検未取得)</option>
                <option value="eiken5">英検5級レベル</option>
                <option value="eiken4">英検4級レベル</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="target_level">目標の級</Label>
              <select
                id="target_level"
                name="target_level"
                required
                className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-base"
                defaultValue="3"
              >
                <option value="5">英検5級</option>
                <option value="4">英検4級</option>
                <option value="3">英検3級</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="exam_date">受験予定日</Label>
              <Input
                id="exam_date"
                name="exam_date"
                type="date"
                required
                className="min-h-tap-normal"
              />
              <p className="text-xs text-muted-foreground">
                ※受験日から逆算して、毎日の学習プランを自動で組みます。
              </p>
            </div>

            <Button type="submit" size="lg" className="min-h-tap-cta w-full">
              この内容で進める
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
