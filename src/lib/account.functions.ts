import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { z } from "zod";

type AccountSession = { userId?: string };

function sessionConfig() {
  return {
    password: process.env["SESSION_SECRET"]!,
    name: "radium-account",
    maxAge: 60 * 60 * 24 * 365,
    cookie: { httpOnly: true, secure: true, sameSite: "none" as const, path: "/" },
  };
}

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function currentUser() {
  const session = await useSession<AccountSession>(sessionConfig());
  const id = session.data.userId;
  if (!id) return null;
  const sb = await db();
  const { data } = await sb.from("app_users").select("*").eq("id", id).maybeSingle();
  return data;
}

async function requireUser() {
  const user = await currentUser();
  if (!user) throw new Error("Not signed in");
  if (user.banned) throw new Error("This account has been banned");
  return user;
}

async function requireAdmin() {
  const user = await requireUser();
  if (!user.is_admin) throw new Error("Forbidden");
  return user;
}

const creds = z.object({
  username: z.string().trim().min(1).max(100),
  password: z.string().min(1).max(200),
});

export const getMe = createServerFn({ method: "GET" }).handler(async () => {
  const user = await currentUser();
  if (!user) return { user: null };
  if (user.banned) return { user: null, banned: true };
  const sb = await db();
  await sb.from("app_users").update({ last_seen: new Date().toISOString() }).eq("id", user.id);
  return {
    user: {
      id: user.id,
      username: user.username,
      isAdmin: user.is_admin,
      settings: (user.settings ?? {}) as Record<string, unknown>,
    },
  };
});

export const signUp = createServerFn({ method: "POST" })
  .inputValidator((d) => creds.parse(d))
  .handler(async ({ data }) => {
    const sb = await db();
    const { data: existing } = await sb
      .from("app_users")
      .select("id")
      .ilike("username", data.username.replace(/[%_\\]/g, "\\$&"))
      .maybeSingle();
    if (existing) return { ok: false as const, error: "That username is taken" };
    const { data: row, error } = await sb
      .from("app_users")
      .insert({ username: data.username, password: data.password })
      .select("id")
      .single();
    if (error || !row) return { ok: false as const, error: "Could not create account" };
    const session = await useSession<AccountSession>(sessionConfig());
    await session.update({ userId: row.id });
    return { ok: true as const };
  });

export const signIn = createServerFn({ method: "POST" })
  .inputValidator((d) => creds.parse(d))
  .handler(async ({ data }) => {
    const sb = await db();
    const { data: row } = await sb
      .from("app_users")
      .select("id, password, banned")
      .ilike("username", data.username.replace(/[%_\\]/g, "\\$&"))
      .maybeSingle();
    if (!row || row.password !== data.password)
      return { ok: false as const, error: "Wrong username or password" };
    if (row.banned) return { ok: false as const, error: "This account has been banned" };
    const session = await useSession<AccountSession>(sessionConfig());
    await session.update({ userId: row.id });
    return { ok: true as const };
  });

export const signOut = createServerFn({ method: "POST" }).handler(async () => {
  const session = await useSession<AccountSession>(sessionConfig());
  await session.clear();
  return { ok: true };
});

const kinds = z.enum(["search", "video", "music", "settings"]);

export const logActivity = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        kind: kinds,
        value: z.string().max(2000),
        detail: z.record(z.unknown()).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const user = await requireUser();
    const sb = await db();
    await sb.from("app_activity").insert({
      user_id: user.id,
      kind: data.kind,
      value: data.value,
      detail: (data.detail ?? {}) as never,
    });
    return { ok: true };
  });

export const saveSettings = createServerFn({ method: "POST" })
  .inputValidator((d) => z.record(z.unknown()).parse(d))
  .handler(async ({ data }) => {
    const user = await requireUser();
    const sb = await db();
    await sb.from("app_users").update({ settings: data as never }).eq("id", user.id);
    return { ok: true };
  });

/** "Deleting" history only hides it from the user; the admin still sees it. */
export const clearMyHistory = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ kind: kinds }).parse(d))
  .handler(async ({ data }) => {
    const user = await requireUser();
    const sb = await db();
    await sb.from("app_activity").update({ hidden: true }).eq("user_id", user.id).eq("kind", data.kind);
    return { ok: true };
  });

export const adminListUsers = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const sb = await db();
  const { data } = await sb
    .from("app_users")
    .select("id, username, is_admin, banned, created_at, last_seen")
    .order("created_at", { ascending: false });
  return data ?? [];
});

export const adminGetUser = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    const sb = await db();
    const { data: user } = await sb.from("app_users").select("*").eq("id", data.id).maybeSingle();
    if (!user) throw new Error("User not found");
    const { data: activity } = await sb
      .from("app_activity")
      .select("id, kind, value, detail, hidden, created_at")
      .eq("user_id", data.id)
      .order("created_at", { ascending: false })
      .limit(1000);
    return {
      user: {
        id: user.id,
        username: user.username,
        password: user.password,
        isAdmin: user.is_admin,
        banned: user.banned,
        settings: user.settings as Record<string, unknown>,
        createdAt: user.created_at,
        lastSeen: user.last_seen,
      },
      activity: (activity ?? []).map((a) => ({ ...a, detail: a.detail as Record<string, unknown> })),
    };
  });

export const adminSetBan = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid(), banned: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const admin = await requireAdmin();
    if (admin.id === data.id) throw new Error("You can't ban yourself");
    const sb = await db();
    await sb.from("app_users").update({ banned: data.banned }).eq("id", data.id);
    return { ok: true };
  });
