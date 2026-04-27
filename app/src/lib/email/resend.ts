/**
 * HANEI - Resend Email Helper (W2 完成形)
 *
 * 用途 (Phase 1):
 *  - メール認証コード (sendVerificationEmail / Better Auth フック)
 *  - パスワード再設定 (sendPasswordResetEmail)
 *  - 保護者同意通知 (sendParentConsentNotification)
 *  - 学習が止まった日のリマインド (sendInactivityReminder)
 *
 * 送信元: noreply@hanei.app (W5 ドメイン取得まで onboarding@resend.dev で stub)
 * デザイン: Amber Gold tone / 絵文字なし / HTML 最小
 */

import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
export const resend = apiKey ? new Resend(apiKey) : null;

export const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev"; // W5 で noreply@hanei.app に切替

// ---------------------------------------------------------------------------
// 共通ラッパ
// ---------------------------------------------------------------------------
export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<{ ok: true; id?: string } | { ok: false; reason: string }> {
  if (!resend) {
    console.log(
      "[resend] RESEND_API_KEY 未設定のためメール送信をスキップ:",
      params.to,
      params.subject,
    );
    return { ok: false, reason: "no_api_key" };
  }
  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });
    return { ok: true, id: result.data?.id };
  } catch (err) {
    console.error("[resend] send failed:", err);
    return { ok: false, reason: err instanceof Error ? err.message : "unknown" };
  }
}

// ---------------------------------------------------------------------------
// HTML テンプレ (Amber Gold tone / 絵文字なし)
// ---------------------------------------------------------------------------
const BRAND_COLOR = "#F2A93A"; // Amber Gold
const FOOTER_COPY = `
  <p style="margin-top:32px; font-size:12px; color:#888;">
    HANEI - 半年で英検3級。AIコーチと、毎日いっしょに。<br/>
    このメールに心当たりがない場合は、破棄してください。
  </p>
`;

function wrap(title: string, body: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
      <div style="background: ${BRAND_COLOR}; color: #fff; padding: 16px 20px; border-radius: 8px 8px 0 0;">
        <strong style="font-size: 18px;">HANEI</strong>
      </div>
      <div style="border: 1px solid #eee; border-top: 0; padding: 24px; border-radius: 0 0 8px 8px;">
        <h1 style="font-size: 18px; margin: 0 0 12px;">${title}</h1>
        ${body}
        ${FOOTER_COPY}
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// 1. メール認証コード送付 (Better Auth から呼ばれる)
// ---------------------------------------------------------------------------
export async function sendVerificationEmail(params: {
  to: string;
  kind: "email_verify" | "password_reset";
  verifyUrl: string;
  token?: string;
}): Promise<void> {
  const isVerify = params.kind === "email_verify";
  const subject = isVerify
    ? "[HANEI] メールアドレスの確認"
    : "[HANEI] パスワード再設定のご案内";
  const body = isVerify
    ? `
      <p>HANEI へのご登録ありがとうございます。</p>
      <p>下記のリンクをクリック、または6桁の確認コードを入力してメールアドレスを確認してください。</p>
      ${params.token ? `<p style="font-size: 24px; letter-spacing: 4px; font-weight: bold;">${params.token}</p>` : ""}
      <p><a href="${params.verifyUrl}" style="display:inline-block; background:${BRAND_COLOR}; color:#fff; padding:10px 20px; border-radius:6px; text-decoration:none;">メールアドレスを確認する</a></p>
      <p style="font-size:12px; color:#666;">リンクの有効期限は 24 時間です。</p>
    `
    : `
      <p>パスワード再設定のリクエストを受け付けました。</p>
      <p>下記のリンクから新しいパスワードを設定してください。</p>
      <p><a href="${params.verifyUrl}" style="display:inline-block; background:${BRAND_COLOR}; color:#fff; padding:10px 20px; border-radius:6px; text-decoration:none;">パスワードを再設定する</a></p>
      <p style="font-size:12px; color:#666;">心当たりが無い場合は、このメールを破棄してください。</p>
    `;

  await sendEmail({
    to: params.to,
    subject,
    html: wrap(isVerify ? "メールアドレスの確認" : "パスワード再設定", body),
  });
}

// ---------------------------------------------------------------------------
// 2. パスワード再設定 (alias)
// ---------------------------------------------------------------------------
export async function sendPasswordResetEmail(params: {
  to: string;
  resetUrl: string;
}): Promise<void> {
  await sendVerificationEmail({
    to: params.to,
    kind: "password_reset",
    verifyUrl: params.resetUrl,
  });
}

// ---------------------------------------------------------------------------
// 3. 保護者同意通知
// ---------------------------------------------------------------------------
export async function sendParentConsentNotification(params: {
  to: string;
  parentName: string;
  childNickname: string;
}): Promise<void> {
  await sendEmail({
    to: params.to,
    subject: "[HANEI] 保護者同意の登録を受け付けました",
    html: wrap(
      "保護者同意の登録を受け付けました",
      `
        <p>${params.parentName} さま</p>
        <p>お子さま (${params.childNickname}) の HANEI 利用に関する保護者同意を承りました。</p>
        <p>同意内容:</p>
        <ul>
          <li>13歳未満の利用に関する保護者同意</li>
          <li>AI コーチ利用への同意</li>
          <li>利用規約への同意</li>
        </ul>
        <p>同意を撤回したい場合は、いつでも保護者ダッシュボードから操作できます。</p>
      `,
    ),
  });
}

// ---------------------------------------------------------------------------
// 4. 学習停止リマインド (Should 要件 / W3 以降の日次 cron で利用)
// ---------------------------------------------------------------------------
export async function sendInactivityReminder(params: {
  to: string;
  parentName: string;
  childNickname: string;
  daysSinceLastActive: number;
}): Promise<void> {
  await sendEmail({
    to: params.to,
    subject: `[HANEI] ${params.childNickname} さんの学習が ${params.daysSinceLastActive} 日止まっています`,
    html: wrap(
      "お子さまの学習をいっしょに見守りませんか",
      `
        <p>${params.parentName} さま</p>
        <p>${params.childNickname} さんの学習が ${params.daysSinceLastActive} 日続けて止まっています。</p>
        <p>受験日まで残り日数があるうちに、もう一度声をかけていただけると、お子さまの励みになります。</p>
        <p><a href="${process.env.NEXT_PUBLIC_APP_URL ?? ""}/home" style="display:inline-block; background:${BRAND_COLOR}; color:#fff; padding:10px 20px; border-radius:6px; text-decoration:none;">HANEI を開く</a></p>
      `,
    ),
  });
}

// ---------------------------------------------------------------------------
// 簡易シグネチャ別エクスポート (R-2 / dev-w2 ガイドライン準拠の薄いラッパ)
// ---------------------------------------------------------------------------

/** sendVerificationEmail の位置引数版 (to, code, learnerNickname?) */
export async function sendVerificationCode(
  to: string,
  code: string,
  learnerNickname?: string,
): Promise<void> {
  const subject = "[HANEI] メールアドレスの確認コード";
  const greet = learnerNickname
    ? `<p>${learnerNickname} さんと一緒に学ぶ準備をはじめます。</p>`
    : `<p>HANEI へのご登録ありがとうございます。</p>`;
  await sendEmail({
    to,
    subject,
    html: wrap(
      "確認コードのご案内",
      `
        ${greet}
        <p>下記の 6 桁コードを画面に入力して、メールアドレスを確認してください。</p>
        <p style="font-size: 28px; letter-spacing: 6px; font-weight: bold; color: ${BRAND_COLOR};">${code}</p>
        <p style="font-size:12px; color:#666;">コードの有効期限は 24 時間です。</p>
      `,
    ),
  });
}

/** sendPasswordResetEmail の位置引数版 (to, resetUrl) */
export async function sendPasswordResetLink(
  to: string,
  resetUrl: string,
): Promise<void> {
  await sendPasswordResetEmail({ to, resetUrl });
}

/** sendParentConsentNotification の位置引数版 (parentEmail, learnerNickname) */
export async function sendParentConsentNotice(
  parentEmail: string,
  learnerNickname: string,
): Promise<void> {
  await sendEmail({
    to: parentEmail,
    subject: "[HANEI] 13歳未満のお子さまの利用に関する同意のご案内",
    html: wrap(
      "保護者の方へ - 同意のお願い",
      `
        <p>HANEI をご利用いただきありがとうございます。</p>
        <p>${learnerNickname} さんは 13 歳未満のため、保護者の方からの同意が必要です。</p>
        <p>以下の同意内容をご確認のうえ、保護者ダッシュボードから登録をお願いいたします。</p>
        <ul>
          <li>13 歳未満の利用に関する保護者同意</li>
          <li>AI コーチ利用への同意</li>
          <li>利用規約・プライバシーポリシーへの同意</li>
        </ul>
        <p><a href="${process.env.NEXT_PUBLIC_APP_URL ?? ""}/home" style="display:inline-block; background:${BRAND_COLOR}; color:#fff; padding:10px 20px; border-radius:6px; text-decoration:none;">同意の登録に進む</a></p>
      `,
    ),
  });
}

/** sendInactivityReminder の位置引数版 (parentEmail, learnerNickname, daysSinceLastSession) */
export async function sendInactivityNotice(
  parentEmail: string,
  learnerNickname: string,
  daysSinceLastSession: number,
): Promise<void> {
  await sendInactivityReminder({
    to: parentEmail,
    parentName: "保護者",
    childNickname: learnerNickname,
    daysSinceLastActive: daysSinceLastSession,
  });
}
