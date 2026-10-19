import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error("Missing Supabase config. Copy apps/dashboard/.env.example to .env.local and fill it in.");
}

// Read before the client consumes the link: a password-reset email lands on /login with
// "type=recovery" in the address, already signed in, and the user must choose a new password.
export const resetLink = {
  pending: typeof window !== "undefined" && /type=recovery/.test(window.location.hash + window.location.search),
};

export const supabase = createClient(url, key);

/** Calls a database function and throws its error message, so pages can show it. */
export async function rpc<T = void>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

/** Throws the error of a Supabase query, if any, and returns its data. */
export async function must<T>(q: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data;
}
