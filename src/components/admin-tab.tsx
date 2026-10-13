import { useCallback, useEffect, useState } from "react";
import { Ban, RefreshCw, ShieldCheck } from "lucide-react";
import { adminGetUser, adminListUsers, adminSetBan } from "@/lib/account.functions";

type UserRow = Awaited<ReturnType<typeof adminListUsers>>[number];
type Detail = Awaited<ReturnType<typeof adminGetUser>>;
type Filter = "search" | "video" | "music" | "settings";

const fmt = (d: string) => new Date(d).toLocaleString("en-SG", { timeZone: "Asia/Singapore" });

export function AdminTab() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [filter, setFilter] = useState<Filter>("search");
  const [busy, setBusy] = useState(false);

  const loadUsers = useCallback(async () => setUsers(await adminListUsers()), []);
  const loadDetail = useCallback(async (id: string) => {
    setDetail(null);
    setDetail(await adminGetUser({ data: { id } }));
  }, []);

  useEffect(() => { void loadUsers(); }, [loadUsers]);
  useEffect(() => { if (selected) void loadDetail(selected); }, [selected, loadDetail]);

  const toggleBan = async () => {
    if (!detail) return;
    setBusy(true);
    try {
      await adminSetBan({ data: { id: detail.user.id, banned: !detail.user.banned } });
      await Promise.all([loadUsers(), loadDetail(detail.user.id)]);
    } finally { setBusy(false); }
  };

  const panel = { background: "var(--rd-surface)", border: "1px solid var(--rd-line)" };
  const items = detail?.activity.filter((a) => a.kind === filter) ?? [];

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-auto p-4 md:flex-row">
      <aside className="flex min-h-0 shrink-0 flex-col rounded-sm md:w-72" style={panel}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--rd-line)" }}>
          <span className="font-mono text-[10px] tracking-[0.2em]" style={{ color: "var(--rd-muted)" }}>USERS · {users.length}</span>
          <button onClick={() => void loadUsers()} aria-label="Refresh users" style={{ color: "var(--rd-accent)" }}><RefreshCw size={13} /></button>
        </div>
        <ul className="max-h-72 overflow-auto md:max-h-none md:flex-1">
          {users.map((u) => (
            <li key={u.id}>
              <button onClick={() => setSelected(u.id)} className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm"
                style={{ background: selected === u.id ? "var(--rd-bg)" : "transparent", borderLeft: `2px solid ${selected === u.id ? "var(--rd-accent-alt)" : "transparent"}` }}>
                <span className="truncate">{u.username}</span>
                <span className="font-mono text-[9px] tracking-[0.15em]" style={{ color: u.banned ? "var(--rd-accent)" : "var(--rd-muted)" }}>
                  {u.is_admin ? "ADMIN" : u.banned ? "BANNED" : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="min-h-0 flex-1 rounded-sm p-5" style={panel}>
        {!selected && <p className="text-sm" style={{ color: "var(--rd-muted)" }}>Select a user to see their details.</p>}
        {selected && !detail && <p className="text-sm" style={{ color: "var(--rd-muted)" }}>Loading…</p>}
        {detail && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                <span className="font-mono text-[10px] tracking-[0.2em]" style={{ color: "var(--rd-muted)" }}>USERNAME</span>
                <span className="font-semibold">{detail.user.username}</span>
                <span className="font-mono text-[10px] tracking-[0.2em]" style={{ color: "var(--rd-muted)" }}>PASSWORD</span>
                <span className="font-mono">{detail.user.password}</span>
                <span className="font-mono text-[10px] tracking-[0.2em]" style={{ color: "var(--rd-muted)" }}>JOINED</span>
                <span className="text-xs">{fmt(detail.user.createdAt)}</span>
                <span className="font-mono text-[10px] tracking-[0.2em]" style={{ color: "var(--rd-muted)" }}>LAST SEEN</span>
                <span className="text-xs">{fmt(detail.user.lastSeen)}</span>
                <span className="font-mono text-[10px] tracking-[0.2em]" style={{ color: "var(--rd-muted)" }}>STATUS</span>
                <span className="text-xs" style={{ color: detail.user.banned ? "var(--rd-accent)" : "var(--rd-accent-alt)" }}>{detail.user.banned ? "Banned" : "Active"}</span>
              </div>
              {!detail.user.isAdmin && (
                <button disabled={busy} onClick={() => void toggleBan()} className="flex items-center gap-2 rounded-sm px-4 py-2 text-xs font-semibold disabled:opacity-60"
                  style={detail.user.banned ? { background: "var(--rd-button)", color: "var(--rd-accent-alt)" } : { background: "var(--rd-accent)", color: "var(--rd-bg)" }}>
                  {detail.user.banned ? <ShieldCheck size={13} /> : <Ban size={13} />}
                  {detail.user.banned ? "Unban user" : "Ban user"}
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-1" style={{ borderBottom: "1px solid var(--rd-line)" }}>
              {([["search", "Search history"], ["video", "Video history"], ["music", "Music history"], ["settings", "Settings"]] as [Filter, string][]).map(([k, l]) => (
                <button key={k} onClick={() => setFilter(k)} className="px-3 py-2 text-xs"
                  style={{ color: filter === k ? "var(--rd-text)" : "var(--rd-muted)", borderBottom: `2px solid ${filter === k ? "var(--rd-accent-alt)" : "transparent"}` }}>
                  {l} ({detail.activity.filter((a) => a.kind === k).length})
                </button>
              ))}
            </div>

            {filter === "settings" && (
              <pre className="max-h-48 overflow-auto rounded-sm p-3 font-mono text-[11px]" style={{ background: "var(--rd-bg)" }}>
                {JSON.stringify(detail.user.settings, null, 2)}
              </pre>
            )}

            <ul className="flex flex-col">
              {items.length === 0 && <li className="text-xs" style={{ color: "var(--rd-muted)" }}>Nothing yet.</li>}
              {items.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-4 py-2 text-sm" style={{ borderBottom: "1px solid var(--rd-line)" }}>
                  <span className="min-w-0 break-all">
                    {a.value}
                    {typeof a.detail["source"] === "string" && <span className="ml-2 font-mono text-[10px]" style={{ color: "var(--rd-muted)" }}>{a.detail["source"]}</span>}
                    {a.hidden && <span className="ml-2 font-mono text-[10px]" style={{ color: "var(--rd-accent)" }}>DELETED BY USER</span>}
                  </span>
                  <span className="shrink-0 font-mono text-[10px]" style={{ color: "var(--rd-muted)" }}>{fmt(a.created_at)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
