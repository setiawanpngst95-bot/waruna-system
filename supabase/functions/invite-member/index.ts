import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "Metode tidak didukung." });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const caller = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: u } = await caller.auth.getUser();
    if (!u?.user) return json(401, { error: "Silakan masuk dulu." });

    const admin = createClient(url, svc);
    const { data: me } = await admin.from("members").select("role,status").eq("user_id", u.user.id).maybeSingle();
    if (!me || me.role !== "founder" || me.status !== "active") return json(403, { error: "Hanya Founder yang boleh menambah pengguna." });

    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const name = String(body.name ?? "").trim();
    const role = String(body.role ?? "");
    const redirectTo = typeof body.redirectTo === "string" ? body.redirectTo : undefined;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(400, { error: "Format email tidak valid." });
    if (!name) return json(400, { error: "Isi nama lengkap." });
    if (!["pm", "staf", "viewer"].includes(role)) return json(400, { error: "Peran tidak valid." });

    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo, data: { name } });
    if (error || !data?.user) return json(400, { error: error?.message ?? "Gagal mengirim undangan." });

    const { error: e2 } = await admin.from("members").upsert({ user_id: data.user.id, email, name, role, status: "active" });
    if (e2) return json(500, { error: e2.message });
    return json(200, { ok: true });
  } catch (e) {
    return json(500, { error: String((e as Error)?.message ?? e) });
  }
});
