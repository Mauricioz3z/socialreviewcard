import { useEffect, useState } from 'react';
import {
  Activity,
  BarChart3,
  Code2,
  Check,
  Clapperboard,
  Crown,
  Droplet,
  Loader2,
  LogOut,
  MessageCircle,
  Plus,
  RefreshCw,
  Save,
  Search,
  Shield,
  Store,
  Trash2,
  Users,
} from 'lucide-react';
import { ApiError } from './lib/api';
import { PlatformIcon, ICON_CHOICES } from './lib/platformIcon';
import {
  adminDeleteUser,
  adminGetAudit,
  adminGetFeedback,
  adminGetMetrics,
  adminGetSettings,
  adminListUsers,
  adminLogin,
  adminListPlatforms,
  adminCreatePlatform,
  adminUpdatePlatform,
  adminDeletePlatform,
  adminListReelThemes,
  adminCreateReelTheme,
  adminUpdateReelTheme,
  adminDeleteReelTheme,
  adminMarkFeedback,
  adminPutSettings,
  adminRefresh,
  adminUpdateUser,
  loadAdminSession,
  saveAdminSession,
  type AdminMetrics,
  type AdminPlatform,
  type AdminReelTheme,
  type AdminSession,
  type AdminSettings,
  type AdminUser,
  type AuditLogItem,
  type FeedbackItem,
} from './lib/adminApi';

type Tab =
  | 'dashboard'
  | 'users'
  | 'platforms'
  | 'reel-themes'
  | 'monetization'
  | 'watermark'
  | 'scripts'
  | 'feedback'
  | 'audit';

export default function AdminApp() {
  const [session, setSession] = useState<AdminSession | null>(() => loadAdminSession());

  useEffect(() => {
    saveAdminSession(session);
  }, [session]);

  if (!session) return <AdminLogin onLogin={setSession} />;
  return <AdminShell session={session} setSession={setSession} onLogout={() => setSession(null)} />;
}

/* ====================================================================== */
/*  Login                                                                 */
/* ====================================================================== */
function AdminLogin({ onLogin }: { onLogin: (s: AdminSession) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onLogin(await adminLogin(email.trim(), password));
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? 'Invalid credentials.' : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-zinc-950 text-zinc-100 p-4 font-ui">
      <form onSubmit={submit} className="w-full max-w-[360px] bg-zinc-900 border border-white/10 rounded-2xl p-7 shadow-2xl">
        <div className="flex items-center gap-2.5 mb-6">
          <span className="grid place-items-center w-9 h-9 rounded-xl bg-accent text-white">
            <Shield size={18} strokeWidth={2.2} />
          </span>
          <div>
            <div className="font-bold text-[15px] leading-none">Admin backoffice</div>
            <div className="text-[11.5px] text-zinc-500 mt-1">SocialReviewCard</div>
          </div>
        </div>

        <label className="block text-[12px] text-zinc-400 mb-1">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
          required
          className="w-full mb-3 rounded-lg bg-zinc-800 border border-white/10 px-3 py-2.5 text-[13.5px] outline-none focus:border-accent"
        />
        <label className="block text-[12px] text-zinc-400 mb-1">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full mb-4 rounded-lg bg-zinc-800 border border-white/10 px-3 py-2.5 text-[13.5px] outline-none focus:border-accent"
        />

        {error && (
          <div className="mb-4 text-[12.5px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full flex items-center justify-center gap-2 h-11 rounded-lg bg-accent text-white text-[14px] font-semibold hover:opacity-90 transition disabled:opacity-60"
        >
          {busy ? <Loader2 size={17} className="animate-spin" /> : <Shield size={17} />} Sign in
        </button>
      </form>
    </div>
  );
}

/* ====================================================================== */
/*  Shell                                                                 */
/* ====================================================================== */
function AdminShell({
  session,
  setSession,
  onLogout,
}: {
  session: AdminSession;
  setSession: (s: AdminSession) => void;
  onLogout: () => void;
}) {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [toast, setToast] = useState<{ msg: string; tone: 'ok' | 'err' } | null>(null);

  const flash = (msg: string, tone: 'ok' | 'err' = 'ok') => {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 3200);
  };

  // Runs an authenticated admin call, refreshing the token once on 401. A
  // failed refresh logs the admin out.
  async function call<T>(fn: (token: string) => Promise<T>): Promise<T> {
    try {
      return await fn(session.accessToken);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401 && session.refreshToken) {
        try {
          const next = await adminRefresh(session.refreshToken, session.email);
          setSession(next);
          return await fn(next.accessToken);
        } catch {
          onLogout();
        }
      }
      throw err;
    }
  }

  const NAV: { id: Tab; label: string; Icon: typeof BarChart3 }[] = [
    { id: 'dashboard', label: 'Dashboard', Icon: BarChart3 },
    { id: 'users', label: 'Users', Icon: Users },
    { id: 'platforms', label: 'Platforms', Icon: Store },
    { id: 'reel-themes', label: 'Reel Themes', Icon: Clapperboard },
    { id: 'monetization', label: 'Monetization', Icon: Crown },
    { id: 'watermark', label: 'Watermark', Icon: Droplet },
    { id: 'scripts', label: 'Scripts', Icon: Code2 },
    { id: 'feedback', label: 'Feedback', Icon: MessageCircle },
    { id: 'audit', label: 'Audit log', Icon: Activity },
  ];

  return (
    <div className="min-h-screen flex bg-zinc-100 text-zinc-900 font-ui">
      {/* sidebar */}
      <aside className="w-60 shrink-0 bg-zinc-950 text-zinc-300 flex flex-col">
        <div className="h-16 flex items-center gap-2.5 px-5 border-b border-white/5">
          <span className="grid place-items-center w-8 h-8 rounded-lg bg-accent text-white">
            <Shield size={16} strokeWidth={2.2} />
          </span>
          <span className="font-bold text-[14px] text-white">Backoffice</span>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={
                'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition text-left ' +
                (tab === id ? 'bg-accent text-white font-semibold' : 'hover:bg-white/5')
              }
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-white/5">
          <div className="px-3 pb-2 text-[11px] text-zinc-500 truncate">{session.email}</div>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-zinc-300 hover:bg-white/5 transition text-left"
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>

      {/* content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-7">
          {tab === 'dashboard' && <DashboardTab call={call} />}
          {tab === 'users' && <UsersTab call={call} flash={flash} />}
          {tab === 'platforms' && <PlatformsTab call={call} flash={flash} />}
          {tab === 'reel-themes' && <ReelThemesTab call={call} flash={flash} />}
          {tab === 'monetization' && <MonetizationTab call={call} flash={flash} />}
          {tab === 'watermark' && <WatermarkTab call={call} flash={flash} />}
          {tab === 'scripts' && <ScriptsTab call={call} flash={flash} />}
          {tab === 'feedback' && <FeedbackTab call={call} flash={flash} />}
          {tab === 'audit' && <AuditTab call={call} />}
        </div>
      </main>

      {toast && (
        <div
          className={
            'fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-2xl text-[13px] font-medium text-white ' +
            (toast.tone === 'ok' ? 'bg-emerald-600' : 'bg-red-600')
          }
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}

type Caller = <T>(fn: (token: string) => Promise<T>) => Promise<T>;
type Flash = (msg: string, tone?: 'ok' | 'err') => void;

/* ====================================================================== */
/*  Dashboard                                                             */
/* ====================================================================== */
function DashboardTab({ call }: { call: Caller }) {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    call(adminGetMetrics)
      .then(setMetrics)
      .catch(() => setMetrics(null))
      .finally(() => setLoading(false));
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cards = metrics
    ? [
        { label: 'Total users', value: metrics.totalUsers },
        { label: 'Pro subscribers', value: metrics.proUsers },
        { label: 'Free users', value: metrics.freeUsers },
        { label: 'New (7 days)', value: metrics.newUsers7d },
        { label: 'New (30 days)', value: metrics.newUsers30d },
        { label: 'Saved cards', value: metrics.totalCards },
        { label: 'Total exports', value: metrics.totalExports },
        { label: 'Free exports used', value: metrics.freeExportsUsed },
      ]
    : [];

  return (
    <div>
      <Header title="Dashboard" subtitle="Usage at a glance" onRefresh={load} />
      {loading ? (
        <Spinner />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {cards.map((c) => (
            <div key={c.label} className="bg-white rounded-xl border border-zinc-200 p-5">
              <div className="text-[12px] text-zinc-500">{c.label}</div>
              <div className="text-[26px] font-bold tracking-tight mt-1 tabular-nums">{c.value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ====================================================================== */
/*  Users                                                                 */
/* ====================================================================== */
const STATUSES = ['free', 'active', 'canceled', 'past_due'];

function UsersTab({ call, flash }: { call: Caller; flash: Flash }) {
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const take = 25;

  const load = () => {
    setLoading(true);
    call((t) => adminListUsers(t, search, skip, take))
      .then((r) => {
        setItems(r.items);
        setTotal(r.total);
      })
      .catch(() => flash('Could not load users', 'err'))
      .finally(() => setLoading(false));
  };
  useEffect(load, [skip]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSkip(0);
    load();
  };

  const remove = async (u: AdminUser) => {
    if (!confirm(`Delete ${u.email}? This cannot be undone.`)) return;
    try {
      await call((t) => adminDeleteUser(t, u.id));
      flash('User deleted');
      load();
    } catch (err) {
      flash(err instanceof ApiError ? err.message : 'Delete failed', 'err');
    }
  };

  return (
    <div>
      <Header title="Users" subtitle={`${total} total`} onRefresh={load} />

      <form onSubmit={onSearch} className="flex gap-2 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email…"
            className="w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-3 py-2 text-[13px] outline-none focus:border-accent"
          />
        </div>
        <button className="px-4 rounded-lg bg-zinc-900 text-white text-[13px] font-semibold">Search</button>
      </form>

      {loading ? (
        <Spinner />
      ) : (
        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-zinc-50 text-zinc-500 text-[11.5px] uppercase tracking-wide">
              <tr>
                <th className="text-left font-semibold px-4 py-2.5">Email</th>
                <th className="text-left font-semibold px-4 py-2.5">Plan</th>
                <th className="text-right font-semibold px-4 py-2.5">Free used</th>
                <th className="text-right font-semibold px-4 py-2.5">Exports</th>
                <th className="text-left font-semibold px-4 py-2.5">Joined</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <tr key={u.id} className="border-t border-zinc-100">
                  <td className="px-4 py-2.5">
                    <span className="font-medium">{u.email}</span>
                    {u.isAdmin && <span className="ml-2 text-[10px] text-accent font-bold">ADMIN</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <PlanBadge status={u.subscriptionStatus} />
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{u.freeExportsUsed}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{u.totalExports}</td>
                  <td className="px-4 py-2.5 text-zinc-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <button
                      onClick={() => setEditing(u)}
                      className="text-[12px] font-semibold text-accent hover:underline mr-3"
                    >
                      Edit
                    </button>
                    {!u.isAdmin && (
                      <button onClick={() => remove(u)} className="text-zinc-400 hover:text-red-600">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-zinc-400">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {total > take && (
        <div className="flex items-center justify-between mt-3 text-[12.5px] text-zinc-500">
          <span>
            {skip + 1}–{Math.min(skip + take, total)} of {total}
          </span>
          <div className="flex gap-2">
            <button
              disabled={skip === 0}
              onClick={() => setSkip(Math.max(0, skip - take))}
              className="px-3 py-1.5 rounded-lg border border-zinc-200 bg-white disabled:opacity-40"
            >
              Prev
            </button>
            <button
              disabled={skip + take >= total}
              onClick={() => setSkip(skip + take)}
              className="px-3 py-1.5 rounded-lg border border-zinc-200 bg-white disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {editing && (
        <EditUserModal
          user={editing}
          call={call}
          flash={flash}
          onClose={() => setEditing(null)}
          onSaved={(u) => {
            setItems((prev) => prev.map((x) => (x.id === u.id ? u : x)));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function PlanBadge({ status }: { status: string }) {
  const pro = status === 'active';
  return (
    <span
      className={
        'inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ' +
        (pro ? 'bg-amber-100 text-amber-700' : 'bg-zinc-100 text-zinc-600')
      }
    >
      {status}
    </span>
  );
}

function EditUserModal({
  user,
  call,
  flash,
  onClose,
  onSaved,
}: {
  user: AdminUser;
  call: Caller;
  flash: Flash;
  onClose: () => void;
  onSaved: (u: AdminUser) => void;
}) {
  const [status, setStatus] = useState(user.subscriptionStatus);
  const [freeUsed, setFreeUsed] = useState(user.freeExportsUsed);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const updated = await call((t) =>
        adminUpdateUser(t, user.id, { subscriptionStatus: status, freeExportsUsed: freeUsed }),
      );
      flash('User updated');
      onSaved(updated);
    } catch {
      flash('Update failed', 'err');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-[380px] bg-white rounded-2xl shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="font-bold text-[15px] mb-1">Edit user</div>
        <div className="text-[12.5px] text-zinc-500 mb-5 truncate">{user.email}</div>

        <label className="block text-[12px] text-zinc-500 mb-1">Subscription status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full mb-4 rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-accent"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <label className="block text-[12px] text-zinc-500 mb-1">Free exports used</label>
        <input
          type="number"
          min={0}
          value={freeUsed}
          onChange={(e) => setFreeUsed(Math.max(0, Number(e.target.value)))}
          className="w-full mb-2 rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-accent"
        />
        <button onClick={() => setFreeUsed(0)} className="text-[12px] text-accent hover:underline mb-5">
          Reset to 0
        </button>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 h-10 rounded-lg border border-zinc-200 text-[13px] font-semibold">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 h-10 rounded-lg bg-zinc-900 text-white text-[13px] font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save
          </button>
        </div>
      </div>
    </div>
  );
}

/* ====================================================================== */
/*  Platforms                                                             */
/* ====================================================================== */
function PlatformsTab({ call, flash }: { call: Caller; flash: Flash }) {
  const [items, setItems] = useState<AdminPlatform[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AdminPlatform | 'new' | null>(null);

  const load = () => {
    setLoading(true);
    call(adminListPlatforms)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const remove = async (p: AdminPlatform) => {
    if (!confirm(`Delete platform "${p.label}"? Existing cards keep the label as plain text.`)) return;
    try {
      await call((t) => adminDeletePlatform(t, p.id));
      flash('Platform deleted');
      setItems((prev) => prev.filter((x) => x.id !== p.id));
    } catch {
      flash('Delete failed', 'err');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[20px] font-bold tracking-tight">Platforms</h1>
          <p className="text-[13px] text-zinc-500 mt-0.5">Review sources shown in the card picker</p>
        </div>
        <button
          onClick={() => setEditing('new')}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-900 text-white text-[12.5px] font-semibold"
        >
          <Plus size={15} /> Add platform
        </button>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-zinc-50 text-zinc-500 text-[11.5px] uppercase tracking-wide">
              <tr>
                <th className="text-left font-semibold px-4 py-2.5">Platform</th>
                <th className="text-left font-semibold px-4 py-2.5">Icon</th>
                <th className="text-right font-semibold px-4 py-2.5">Order</th>
                <th className="text-left font-semibold px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className="border-t border-zinc-100">
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="grid place-items-center w-7 h-7 rounded-lg text-white"
                        style={{ background: p.color }}
                      >
                        <PlatformIcon token={p.icon} size={13} color="#fff" />
                      </span>
                      <span className="font-medium">{p.label}</span>
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[12px] text-zinc-500">{p.icon}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{p.sortOrder}</td>
                  <td className="px-4 py-2.5">
                    {p.enabled ? (
                      <span className="text-emerald-600 text-[12px] font-semibold">Enabled</span>
                    ) : (
                      <span className="text-zinc-400 text-[12px]">Hidden</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <button
                      onClick={() => setEditing(p)}
                      className="text-[12px] font-semibold text-accent hover:underline mr-3"
                    >
                      Edit
                    </button>
                    <button onClick={() => remove(p)} className="text-zinc-400 hover:text-red-600">
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-zinc-400">
                    No platforms yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <PlatformEditModal
          platform={editing === 'new' ? null : editing}
          call={call}
          flash={flash}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function PlatformEditModal({
  platform,
  call,
  flash,
  onClose,
  onSaved,
}: {
  platform: AdminPlatform | null;
  call: Caller;
  flash: Flash;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [label, setLabel] = useState(platform?.label ?? '');
  const [color, setColor] = useState(platform?.color ?? '#6d5efc');
  const [icon, setIcon] = useState(platform?.icon ?? 'fab:etsy');
  const [sortOrder, setSortOrder] = useState(platform?.sortOrder ?? 0);
  const [enabled, setEnabled] = useState(platform?.enabled ?? true);
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim() || saving) return;
    setSaving(true);
    const body = { label: label.trim(), color, icon, sortOrder, enabled };
    try {
      if (platform) await call((t) => adminUpdatePlatform(t, platform.id, body));
      else await call((t) => adminCreatePlatform(t, body));
      flash('Platform saved');
      onSaved();
    } catch {
      flash('Save failed', 'err');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={save}
        className="w-full max-w-[400px] bg-white rounded-2xl shadow-2xl p-6"
      >
        <div className="flex items-center gap-2.5 mb-5">
          <span className="grid place-items-center w-9 h-9 rounded-lg text-white" style={{ background: color }}>
            <PlatformIcon token={icon} size={16} color="#fff" />
          </span>
          <div className="font-bold text-[15px]">{platform ? 'Edit platform' : 'New platform'}</div>
        </div>

        <label className="block text-[12px] text-zinc-500 mb-1">Label</label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          autoFocus
          maxLength={40}
          className="w-full mb-3 rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-accent"
        />

        <label className="block text-[12px] text-zinc-500 mb-1">Icon</label>
        <select
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          className="w-full mb-3 rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-accent"
        >
          {ICON_CHOICES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <div className="flex gap-3 mb-3">
          <div className="flex-1">
            <label className="block text-[12px] text-zinc-500 mb-1">Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-9 h-9 rounded border border-zinc-200 p-0.5 shrink-0"
              />
              <input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="flex-1 min-w-0 rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-accent"
              />
            </div>
          </div>
          <div className="w-24">
            <label className="block text-[12px] text-zinc-500 mb-1">Order</label>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-accent"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 mb-5 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="w-4 h-4 accent-[#6d5efc]"
          />
          <span className="text-[13px]">Show in picker</span>
        </label>

        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 h-10 rounded-lg border border-zinc-200 text-[13px] font-semibold">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 h-10 rounded-lg bg-zinc-900 text-white text-[13px] font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save
          </button>
        </div>
      </form>
    </div>
  );
}

/* ====================================================================== */
/*  Reel themes                                                           */
/* ====================================================================== */
function ReelThemesTab({ call, flash }: { call: Caller; flash: Flash }) {
  const [items, setItems] = useState<AdminReelTheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AdminReelTheme | 'new' | null>(null);

  const load = () => {
    setLoading(true);
    call(adminListReelThemes)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const remove = async (t: AdminReelTheme) => {
    if (!confirm(`Delete theme "${t.name}"?`)) return;
    try {
      await call((tok) => adminDeleteReelTheme(tok, t.id));
      flash('Theme deleted');
      setItems((prev) => prev.filter((x) => x.id !== t.id));
    } catch {
      flash('Delete failed', 'err');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[20px] font-bold tracking-tight">Reel Themes</h1>
          <p className="text-[13px] text-zinc-500 mt-0.5">Animation templates for the video export (stored as JSON)</p>
        </div>
        <button
          onClick={() => setEditing('new')}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-900 text-white text-[12.5px] font-semibold"
        >
          <Plus size={15} /> Add theme
        </button>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-zinc-50 text-zinc-500 text-[11.5px] uppercase tracking-wide">
              <tr>
                <th className="text-left font-semibold px-4 py-2.5">Name</th>
                <th className="text-right font-semibold px-4 py-2.5">Order</th>
                <th className="text-left font-semibold px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.id} className="border-t border-zinc-100">
                  <td className="px-4 py-2.5 font-medium">{t.name}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{t.sortOrder}</td>
                  <td className="px-4 py-2.5">
                    {t.enabled ? (
                      <span className="text-emerald-600 text-[12px] font-semibold">Enabled</span>
                    ) : (
                      <span className="text-zinc-400 text-[12px]">Hidden</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <button onClick={() => setEditing(t)} className="text-[12px] font-semibold text-accent hover:underline mr-3">
                      Edit
                    </button>
                    <button onClick={() => remove(t)} className="text-zinc-400 hover:text-red-600">
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-zinc-400">
                    No themes yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <ReelThemeEditModal
          theme={editing === 'new' ? null : editing}
          call={call}
          flash={flash}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function ReelThemeEditModal({
  theme,
  call,
  flash,
  onClose,
  onSaved,
}: {
  theme: AdminReelTheme | null;
  call: Caller;
  flash: Flash;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(theme?.name ?? '');
  const [json, setJson] = useState(theme ? prettyJson(theme.json) : '{\n  \n}');
  const [enabled, setEnabled] = useState(theme?.enabled ?? true);
  const [sortOrder, setSortOrder] = useState(theme?.sortOrder ?? 0);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || saving) return;
    let compact: string;
    try {
      compact = JSON.stringify(JSON.parse(json));
    } catch {
      setJsonError('Invalid JSON — fix it before saving.');
      return;
    }
    setJsonError(null);
    setSaving(true);
    const body = { name: name.trim(), json: compact, enabled, sortOrder };
    try {
      if (theme) await call((t) => adminUpdateReelTheme(t, theme.id, body));
      else await call((t) => adminCreateReelTheme(t, body));
      flash('Theme saved');
      onSaved();
    } catch {
      flash('Save failed', 'err');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={save}
        className="w-full max-w-[640px] bg-white rounded-2xl shadow-2xl p-6 max-h-[92vh] flex flex-col"
      >
        <div className="font-bold text-[15px] mb-4">{theme ? 'Edit theme' : 'New theme'}</div>

        <div className="flex gap-3 mb-3">
          <div className="flex-1">
            <label className="block text-[12px] text-zinc-500 mb-1">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-accent"
            />
          </div>
          <div className="w-24">
            <label className="block text-[12px] text-zinc-500 mb-1">Order</label>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-accent"
            />
          </div>
        </div>

        <label className="block text-[12px] text-zinc-500 mb-1">Theme JSON</label>
        <textarea
          value={json}
          onChange={(e) => setJson(e.target.value)}
          spellCheck={false}
          className="flex-1 min-h-[260px] w-full rounded-lg border border-zinc-200 px-3 py-2 font-mono text-[12px] outline-none focus:border-accent resize-y"
        />
        {jsonError && <div className="mt-2 text-[12.5px] text-red-600">{jsonError}</div>}

        <label className="flex items-center gap-2 mt-3 mb-5 cursor-pointer">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="w-4 h-4 accent-[#6d5efc]" />
          <span className="text-[13px]">Available in the editor</span>
        </label>

        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 h-10 rounded-lg border border-zinc-200 text-[13px] font-semibold">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 h-10 rounded-lg bg-zinc-900 text-white text-[13px] font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save
          </button>
        </div>
      </form>
    </div>
  );
}

function prettyJson(s: string): string {
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
}

/* ====================================================================== */
/*  Settings (shared loader for monetization / watermark / scripts)       */
/* ====================================================================== */
function useSettings(call: Caller) {
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    call(adminGetSettings)
      .then(setSettings)
      .catch(() => setSettings(null))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { settings, setSettings, loading };
}

async function persist(
  call: Caller,
  flash: Flash,
  next: AdminSettings,
  setSettings: (s: AdminSettings) => void,
  setSaving: (b: boolean) => void,
) {
  setSaving(true);
  try {
    const saved = await call((t) => adminPutSettings(t, next));
    setSettings(saved);
    flash('Settings saved');
  } catch {
    flash('Save failed', 'err');
  } finally {
    setSaving(false);
  }
}

function MonetizationTab({ call, flash }: { call: Caller; flash: Flash }) {
  const { settings, setSettings, loading } = useSettings(call);
  const [saving, setSaving] = useState(false);
  if (loading || !settings) return loading ? <Spinner /> : <LoadError />;

  const set = (patch: Partial<AdminSettings>) => setSettings({ ...settings, ...patch });

  return (
    <div>
      <Header title="Monetization" subtitle="Plans, limits, pricing & upgrade copy" />
      <Panel>
        <NumberField
          label="Free export limit"
          hint="Lifetime free exports per account before the upgrade prompt."
          value={settings.freeExportLimit}
          onChange={(v) => set({ freeExportLimit: v })}
        />
        <TextField
          label="Pro price label"
          hint="Displayed on the upgrade button (cosmetic; actual price is in Stripe)."
          value={settings.proPriceLabel}
          onChange={(v) => set({ proPriceLabel: v })}
        />
        <TextField
          label="Upgrade title"
          value={settings.upgradeTitle}
          onChange={(v) => set({ upgradeTitle: v })}
        />
        <TextField
          label="Upgrade subtitle"
          value={settings.upgradeSubtitle}
          onChange={(v) => set({ upgradeSubtitle: v })}
        />
        <TextAreaField
          label="Pro features (one per line)"
          value={settings.proFeatures.join('\n')}
          rows={4}
          onChange={(v) => set({ proFeatures: v.split('\n').map((s) => s.trim()).filter(Boolean) })}
        />
        <SaveBar saving={saving} onSave={() => persist(call, flash, settings, setSettings, setSaving)} />
      </Panel>
    </div>
  );
}

function WatermarkTab({ call, flash }: { call: Caller; flash: Flash }) {
  const { settings, setSettings, loading } = useSettings(call);
  const [saving, setSaving] = useState(false);
  if (loading || !settings) return loading ? <Spinner /> : <LoadError />;

  const set = (patch: Partial<AdminSettings>) => setSettings({ ...settings, ...patch });

  return (
    <div>
      <Header title="Watermark" subtitle="Applied to free-plan exports only" />
      <Panel>
        <label className="flex items-center gap-3 mb-5 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.watermarkEnabled}
            onChange={(e) => set({ watermarkEnabled: e.target.checked })}
            className="w-4 h-4 accent-[#6d5efc]"
          />
          <span className="text-[13px] font-medium">Enable watermark on free-plan images</span>
        </label>
        <TextField
          label="Watermark text"
          value={settings.watermarkText}
          onChange={(v) => set({ watermarkText: v })}
        />
        <SaveBar saving={saving} onSave={() => persist(call, flash, settings, setSettings, setSaving)} />
      </Panel>
    </div>
  );
}

function ScriptsTab({ call, flash }: { call: Caller; flash: Flash }) {
  const { settings, setSettings, loading } = useSettings(call);
  const [saving, setSaving] = useState(false);
  if (loading || !settings) return loading ? <Spinner /> : <LoadError />;

  const set = (patch: Partial<AdminSettings>) => setSettings({ ...settings, ...patch });

  return (
    <div>
      <Header title="Scripts" subtitle="Third-party tags (GTM, GA, Meta Pixel, Hotjar, …)" />
      <Panel>
        <div className="mb-4 text-[12px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          These are injected verbatim into every page. Only paste code from sources you trust.
        </div>
        <TextAreaField
          label="<head> scripts"
          hint="Injected into the document head."
          value={settings.headScripts}
          rows={6}
          mono
          onChange={(v) => set({ headScripts: v })}
        />
        <TextAreaField
          label="end of <body> scripts"
          hint="Injected just before </body>."
          value={settings.bodyScripts}
          rows={6}
          mono
          onChange={(v) => set({ bodyScripts: v })}
        />
        <SaveBar saving={saving} onSave={() => persist(call, flash, settings, setSettings, setSaving)} />
      </Panel>
    </div>
  );
}

/* ====================================================================== */
/*  Feedback                                                              */
/* ====================================================================== */
function FeedbackTab({ call, flash }: { call: Caller; flash: Flash }) {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [unhandled, setUnhandled] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    call((t) => adminGetFeedback(t, 0, 100))
      .then((r) => {
        setItems(r.items);
        setUnhandled(r.unhandled);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = async (f: FeedbackItem) => {
    try {
      await call((t) => adminMarkFeedback(t, f.id, !f.handled));
      setItems((prev) => prev.map((x) => (x.id === f.id ? { ...x, handled: !x.handled } : x)));
      setUnhandled((n) => n + (f.handled ? 1 : -1));
    } catch {
      flash('Could not update', 'err');
    }
  };

  const TYPE_COLOR: Record<string, string> = {
    suggestion: 'bg-blue-100 text-blue-700',
    criticism: 'bg-amber-100 text-amber-700',
    support: 'bg-red-100 text-red-700',
  };

  return (
    <div>
      <Header title="Feedback" subtitle={`${unhandled} unread`} onRefresh={load} />
      {loading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl border border-zinc-200 py-16 text-center text-zinc-400 text-[13px]">
          No messages yet.
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map((f) => (
            <div
              key={f.id}
              className={
                'bg-white rounded-xl border p-4 ' + (f.handled ? 'border-zinc-200 opacity-60' : 'border-zinc-300')
              }
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={
                      'px-2 py-0.5 rounded-full text-[11px] font-semibold ' +
                      (TYPE_COLOR[f.type] ?? 'bg-zinc-100 text-zinc-600')
                    }
                  >
                    {f.type}
                  </span>
                  <span className="text-[12px] text-zinc-400">{new Date(f.createdAt).toLocaleString()}</span>
                </div>
                <button
                  onClick={() => toggle(f)}
                  className={
                    'flex items-center gap-1.5 text-[12px] font-semibold transition ' +
                    (f.handled ? 'text-zinc-400 hover:text-zinc-600' : 'text-emerald-600 hover:text-emerald-700')
                  }
                >
                  <Check size={14} /> {f.handled ? 'Handled' : 'Mark handled'}
                </button>
              </div>
              <p className="text-[13.5px] text-zinc-800 whitespace-pre-wrap">{f.message}</p>
              {f.email && (
                <a
                  href={`mailto:${f.email}`}
                  className="inline-block mt-2 text-[12.5px] text-accent hover:underline"
                >
                  {f.email}
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ====================================================================== */
/*  Audit                                                                 */
/* ====================================================================== */
function AuditTab({ call }: { call: Caller }) {
  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    call((t) => adminGetAudit(t, 0, 100))
      .then((r) => setItems(r.items))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <Header title="Audit log" subtitle="Recent backoffice activity" onRefresh={load} />
      {loading ? (
        <Spinner />
      ) : (
        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-zinc-50 text-zinc-500 text-[11.5px] uppercase tracking-wide">
              <tr>
                <th className="text-left font-semibold px-4 py-2.5">When</th>
                <th className="text-left font-semibold px-4 py-2.5">Actor</th>
                <th className="text-left font-semibold px-4 py-2.5">Action</th>
                <th className="text-left font-semibold px-4 py-2.5">Details</th>
                <th className="text-left font-semibold px-4 py-2.5">IP</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id} className="border-t border-zinc-100">
                  <td className="px-4 py-2.5 text-zinc-500 whitespace-nowrap">
                    {new Date(a.timestampUtc).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5">{a.actorEmail}</td>
                  <td className="px-4 py-2.5 font-mono text-[12px]">{a.action}</td>
                  <td className="px-4 py-2.5 text-zinc-600">{a.details}</td>
                  <td className="px-4 py-2.5 text-zinc-400 font-mono text-[12px]">{a.ipAddress}</td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-zinc-400">
                    No activity yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ====================================================================== */
/*  Shared UI bits                                                        */
/* ====================================================================== */
function Header({ title, subtitle, onRefresh }: { title: string; subtitle?: string; onRefresh?: () => void }) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div>
        <h1 className="text-[20px] font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-[13px] text-zinc-500 mt-0.5">{subtitle}</p>}
      </div>
      {onRefresh && (
        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 bg-white text-[12.5px] font-medium hover:border-zinc-300"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      )}
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="bg-white rounded-xl border border-zinc-200 p-6 max-w-2xl">{children}</div>;
}

function Spinner() {
  return (
    <div className="grid place-items-center py-20 text-zinc-400">
      <Loader2 size={24} className="animate-spin" />
    </div>
  );
}

function LoadError() {
  return <div className="text-[13px] text-red-600 py-10">Could not load settings.</div>;
}

function SaveBar({ saving, onSave }: { saving: boolean; onSave: () => void }) {
  return (
    <div className="mt-6 pt-5 border-t border-zinc-100">
      <button
        onClick={onSave}
        disabled={saving}
        className="flex items-center gap-2 px-5 h-11 rounded-lg bg-zinc-900 text-white text-[13.5px] font-semibold disabled:opacity-60"
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save changes
      </button>
    </div>
  );
}

function TextField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="mb-4">
      <label className="block text-[12.5px] font-medium text-zinc-700 mb-1">{label}</label>
      {hint && <p className="text-[11.5px] text-zinc-400 mb-1.5">{hint}</p>}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-accent"
      />
    </div>
  );
}

function NumberField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="mb-4">
      <label className="block text-[12.5px] font-medium text-zinc-700 mb-1">{label}</label>
      {hint && <p className="text-[11.5px] text-zinc-400 mb-1.5">{hint}</p>}
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value)))}
        className="w-40 rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-accent"
      />
    </div>
  );
}

function TextAreaField({
  label,
  hint,
  value,
  rows,
  mono,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  rows: number;
  mono?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div className="mb-4">
      <label className="block text-[12.5px] font-medium text-zinc-700 mb-1">{label}</label>
      {hint && <p className="text-[11.5px] text-zinc-400 mb-1.5">{hint}</p>}
      <textarea
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        className={
          'w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-accent resize-y ' +
          (mono ? 'font-mono text-[12px]' : '')
        }
      />
    </div>
  );
}
