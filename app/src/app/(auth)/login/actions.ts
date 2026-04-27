"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth/auth";
import { LoginSchema } from "./schema";

export async function loginAction(formData: FormData): Promise<void> {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    remember: formData.get("remember") ?? undefined,
    redirect_to: formData.get("redirect_to") ?? undefined,
  });

  if (!parsed.success) {
    redirect("/login?error=invalid_input");
  }

  const { email, password, redirect_to } = parsed.data;

  try {
    await auth.api.signInEmail({
      body: {
        email,
        password,
      },
      headers: await headers(),
      asResponse: false,
    });
  } catch {
    redirect("/login?error=invalid_credentials");
  }

  // ログイン成功 → home (or redirect param)
  const safeRedirect =
    redirect_to && redirect_to.startsWith("/") && !redirect_to.startsWith("//")
      ? redirect_to
      : "/home";
  redirect(safeRedirect);
}
