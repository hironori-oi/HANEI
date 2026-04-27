/**
 * Better Auth Route Handler (catch-all)
 * https://www.better-auth.com/docs/installation
 */

import { auth } from "@/lib/auth/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth.handler);
