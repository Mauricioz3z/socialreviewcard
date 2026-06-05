import { useEffect, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import {
  AtSign,
  Check,
  CircleUser,
  CaseUpper,
  Crown,
  Download,
  Eye,
  Frame,
  LayoutPanelTop,
  Loader2,
  LogOut,
  MessageSquareQuote,
  Palette,
  Quote,
  Save,
  Smartphone,
  Sparkle,
  Square,
  Trash2,
  Type,
  User,
  X,
} from 'lucide-react';

import { Preview, CardCanvas } from './components/Preview';
import { Field, Section, Segmented, StyleSwatch, Toggle } from './components/ui';
import { AuthModal } from './components/AuthModal';
import { BACKGROUNDS, CARD_STYLES, PLATFORMS, RATIOS } from './lib/config';
import {
  ApiError,
  claimExport,
  deleteCard,
  getCards,
  getUsage,
  loadSession,
  refresh,
  saveCard,
  saveSession,
  startCheckout,
  type UsageInfo,
} from './lib/api';
import type {
  AuthSession,
  AvatarMode,
  CardData,
  CardStyleId,
  FontId,
  PlatformKey,
  RatioId,
  SavedCard,
} from './types';

interface ToastState {
  id: number;
  title: string;
  desc: string;
  tone: 'success' | 'error';
}

export default function App() {
  // ---- card content + styling state ----
  const [review, setReview] = useState(
    "These earrings completely exceeded my expectations — the craftsmanship is stunning and they arrived beautifully wrapped. I've already ordered two more as gifts!",
  );
  const [name, setName] = useState('@bloom.and.willow');
  const [platform, setPlatform] = useState<PlatformKey>('Etsy');
  const [rating, setRating] = useState(5);
  const [hoverStar, setHoverStar] = useState(0);
  const [avatar, setAvatar] = useState<AvatarMode>('initials');
  const [ratio, setRatio] = useState<RatioId>('story');
  const [cardStyle, setCardStyle] = useState<CardStyleId>('glass');
  const [bgId, setBgId] = useState('sunset');
  const [grain, setGrain] = useState(true);
  const [font, setFont] = useState<FontId>('serif');

  // ---- app state ----
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [session, setSession] = useState<AuthSession | null>(() => loadSession());
  const [showAuth, setShowAuth] = useState(false);
  const [showCards, setShowCards] = useState(false);
  const [cards, setCards] = useState<SavedCard[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [usage, setUsage] = useState<UsageInfo | null>(null);

  const captureRef = useRef<HTMLDivElement>(null);

  const subscription: 'free' | 'pro' = usage?.isPro ? 'pro' : 'free';
  const bg = BACKGROUNDS.find((b) => b.id === bgId)!;
  const data: CardData = { review, name, platform, rating, avatar, cardStyle, font, ratio };
  const styles = { avatar, cardStyle, font, ratio, background: bgId, grain };

  const showToast = (title: string, desc: string, tone: 'success' | 'error' = 'success') =>
    setToast({ id: Date.now(), title, desc, tone });

  /* ----------------------------- session sync ----------------------------- */
  useEffect(() => {
    saveSession(session);
  }, [session]);

  // Detect a return from Stripe Checkout and confirm Pro state by polling the
  // backend (the webhook that flips the subscription may land a moment later).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!(params.get('session_id') || params.get('checkout') === 'success')) return;
    window.history.replaceState({}, '', window.location.pathname);
    showToast('Confirming payment', 'Activating your subscription…');

    let tries = 0;
    let cancelled = false;
    const poll = async () => {
      tries++;
      let pro = false;
      try {
        const u = await withAuth(getUsage);
        setUsage(u);
        pro = u.isPro;
      } catch {
        /* not signed in or transient error — retry below */
      }
      if (cancelled) return;
      if (pro) {
        showToast('Subscription active', 'Welcome to ReviewCraft Pro — unlimited exports.');
      } else if (tries < 6) {
        setTimeout(poll, 1500);
      }
    };
    void poll();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ----------------------------- toast timeout ----------------------------- */
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3600);
    return () => clearTimeout(t);
  }, [toast]);

  /* ----------------------------- auth helpers ----------------------------- */
  // Wraps an authenticated call, transparently refreshing the token once on 401.
  async function withAuth<T>(fn: (token: string) => Promise<T>): Promise<T> {
    if (!session) throw new ApiError('Not signed in', 401);
    try {
      return await fn(session.accessToken);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401 && session.refreshToken) {
        const next = await refresh(session.refreshToken, session.email);
        setSession(next);
        return fn(next.accessToken);
      }
      throw err;
    }
  }

  const onAuthed = (next: AuthSession) => {
    setSession(next);
    setShowAuth(false);
    showToast('Signed in', `Welcome back, ${next.email}`);
  };

  const signOut = () => {
    setSession(null);
    setCards([]);
    setEditingId(null);
    setUsage(null);
    setShowCards(false);
  };

  /* ----------------------------- cards ----------------------------- */
  const refreshCards = async () => {
    if (!session) return;
    setLoadingCards(true);
    try {
      const list = await withAuth(getCards);
      setCards(list);
    } catch {
      showToast('Could not load cards', 'Please try again in a moment.', 'error');
    } finally {
      setLoadingCards(false);
    }
  };

  const refreshUsage = async (): Promise<UsageInfo | null> => {
    if (!session) return null;
    try {
      const u = await withAuth(getUsage);
      setUsage(u);
      return u;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    if (session) {
      void refreshCards();
      void refreshUsage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.accessToken]);

  const onSave = async () => {
    if (!session) {
      setShowAuth(true);
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      const saved = await withAuth((token) => saveCard(token, data, styles, editingId ?? undefined));
      setEditingId(saved.id);
      await refreshCards();
      showToast('Card saved', 'Your configuration is synced to the cloud.');
    } catch {
      showToast('Save failed', 'We could not save your card. Try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const loadCard = (c: SavedCard) => {
    setReview(c.reviewText);
    setName(c.reviewerName);
    setRating(c.rating);
    setPlatform((c.platform as PlatformKey) in PLATFORMS ? (c.platform as PlatformKey) : 'Custom');
    setEditingId(c.id);
    try {
      const s = JSON.parse(c.stylesJson);
      if (s.avatar) setAvatar(s.avatar);
      if (s.cardStyle) setCardStyle(s.cardStyle);
      if (s.font) setFont(s.font);
      if (s.ratio) setRatio(s.ratio);
      if (s.background && BACKGROUNDS.some((b) => b.id === s.background)) setBgId(s.background);
      if (typeof s.grain === 'boolean') setGrain(s.grain);
    } catch {
      /* styling JSON malformed — keep current styling */
    }
    setShowCards(false);
    showToast('Card loaded', 'Editing your saved card.');
  };

  const removeCard = async (id: string) => {
    try {
      await withAuth((token) => deleteCard(token, id));
      setCards((prev) => prev.filter((c) => c.id !== id));
      if (editingId === id) setEditingId(null);
    } catch {
      showToast('Delete failed', 'Could not remove that card.', 'error');
    }
  };

  /* ----------------------------- billing ----------------------------- */
  const onUpgrade = async () => {
    if (!session) {
      setShowAuth(true);
      return;
    }
    if (upgrading) return;
    setUpgrading(true);
    try {
      const url = await withAuth(startCheckout);
      window.location.href = url;
    } catch {
      showToast('Checkout unavailable', 'Could not start checkout. Try again later.', 'error');
      setUpgrading(false);
    }
  };

  /* ----------------------------- export ----------------------------- */
  const doExport = async () => {
    if (exporting) return;
    if (!session) {
      setShowAuth(true);
      showToast('Sign in to export', 'Use your Google account — you get 3 free exports.', 'error');
      return;
    }
    // Already known to be out of free exports — go straight to the upgrade popup.
    if (usage && !usage.isPro && usage.remaining !== null && usage.remaining <= 0) {
      setShowUpgrade(true);
      return;
    }
    setExporting(true);
    try {
      // Claim a quota slot first — the backend enforces the free limit.
      const { ok, usage: u } = await withAuth(claimExport);
      setUsage(u);
      if (!ok) {
        // No free exports left — open the upgrade popup instead of just a toast.
        setShowUpgrade(true);
        return;
      }

      const node = captureRef.current;
      if (!node) throw new Error('Nothing to export');

      // Make sure the web fonts (Plus Jakarta Sans / Newsreader) are fully
      // loaded before capturing — otherwise the export can fall back to a wider
      // system font, which reflows the text and gets clipped by the card.
      if (document.fonts) {
        await Promise.all([
          document.fonts.load('600 31px "Plus Jakarta Sans"'),
          document.fonts.load('700 16.5px "Plus Jakarta Sans"'),
          document.fonts.load('500 31px "Newsreader"'),
        ]).catch(() => {});
        await document.fonts.ready;
      }

      // Render with the browser's own engine (SVG foreignObject) so fonts,
      // letter-spacing and line-wrapping match the on-screen preview exactly.
      const dataUrl = await toPng(node, {
        pixelRatio: 2,
        cacheBust: true,
        width: node.offsetWidth,
        height: node.offsetHeight,
      });
      const link = document.createElement('a');
      const safeName = (name || 'review').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
      link.download = `reviewcraft-${safeName || 'card'}-${RATIOS[ratio].dims.replace(':', 'x')}.png`;
      link.href = dataUrl;
      link.click();
      const left = u.isPro ? 'Unlimited exports' : `${u.remaining} free export(s) left`;
      showToast(`${RATIOS[ratio].label} image exported`, `Saved to downloads · ${left}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setShowAuth(true);
        showToast('Session expired', 'Sign in again to export.', 'error');
      } else {
        showToast('Export failed', 'We could not generate the image. Try again.', 'error');
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="h-full flex font-ui text-zinc-900">
      {/* ============ LEFT: CONTROL PANEL ============ */}
      <aside className="w-[396px] shrink-0 h-full bg-white border-r border-zinc-200 flex flex-col">
        {/* brand header */}
        <div className="px-5 h-[68px] shrink-0 flex items-center gap-3 border-b border-zinc-100">
          <div className="grid place-items-center w-9 h-9 rounded-xl bg-zinc-900 text-white">
            <Quote size={18} strokeWidth={2.2} />
          </div>
          <div>
            <div className="font-bold text-[16px] tracking-tight leading-none">ReviewCraft</div>
            <div className="text-[11.5px] text-zinc-400 mt-0.5">Turn reviews into shareable art</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto sidebar-scroll">
          {/* ---- Review data ---- */}
          <Section Icon={MessageSquareQuote} title="Review">
            <Field label="Review text">
              <textarea
                value={review}
                onChange={(e) => setReview(e.target.value)}
                rows={4}
                maxLength={260}
                placeholder="Paste your customer's review here…"
                className="w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50/60 px-3.5 py-3 text-[13.5px] leading-relaxed text-zinc-800 placeholder-zinc-400 outline-none transition focus:border-accent focus:bg-white focus:ring-4 focus:ring-accent/10"
              />
              <div className="mt-1 text-right text-[11px] text-zinc-400">{review.length}/260</div>
            </Field>

            <Field label="Customer name / handle">
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400">
                  <AtSign size={15} />
                </span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="@yourcustomer"
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50/60 pl-9 pr-3.5 py-2.5 text-[13.5px] text-zinc-800 placeholder-zinc-400 outline-none transition focus:border-accent focus:bg-white focus:ring-4 focus:ring-accent/10"
                />
              </div>
            </Field>

            <Field label="Source platform">
              <div className="grid grid-cols-5 gap-1.5">
                {(Object.entries(PLATFORMS) as [PlatformKey, (typeof PLATFORMS)[PlatformKey]][]).map(
                  ([key, p]) => {
                    const active = platform === key;
                    const PIcon = p.Icon;
                    return (
                      <button
                        key={key}
                        onClick={() => setPlatform(key)}
                        title={p.label}
                        className={
                          'flex flex-col items-center gap-1.5 py-2.5 rounded-xl border transition-all ' +
                          (active
                            ? 'border-accent bg-accent-soft'
                            : 'border-zinc-200 hover:border-zinc-300 bg-white')
                        }
                      >
                        <span
                          className="grid place-items-center w-7 h-7 rounded-lg"
                          style={{
                            background: active ? p.color : '#f4f4f5',
                            color: active ? '#fff' : '#71717a',
                          }}
                        >
                          <PIcon size={15} strokeWidth={2.2} />
                        </span>
                        <span
                          className={
                            'text-[10px] font-medium leading-none ' +
                            (active ? 'text-accent' : 'text-zinc-500')
                          }
                        >
                          {p.label}
                        </span>
                      </button>
                    );
                  },
                )}
              </div>
            </Field>

            <Field label="Rating">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1" onMouseLeave={() => setHoverStar(0)}>
                  {[1, 2, 3, 4, 5].map((i) => {
                    const lit = i <= (hoverStar || rating);
                    return (
                      <button
                        key={i}
                        onClick={() => setRating(i)}
                        onMouseEnter={() => setHoverStar(i)}
                        className="p-0.5 transition-transform hover:scale-110"
                      >
                        <StarGlyph lit={lit} />
                      </button>
                    );
                  })}
                </div>
                <span className="ml-1 text-[13px] font-semibold text-zinc-500 tabular-nums">
                  {rating}.0
                </span>
              </div>
            </Field>

            <Field label="Avatar">
              <Segmented<AvatarMode>
                value={avatar}
                onChange={setAvatar}
                options={[
                  { value: 'initials', label: 'Initials', Icon: CaseUpper },
                  { value: 'icon', label: 'Icon', Icon: CircleUser },
                ]}
              />
            </Field>
          </Section>

          {/* ---- Format ---- */}
          <Section Icon={Frame} title="Format">
            <Segmented<RatioId>
              value={ratio}
              onChange={setRatio}
              options={[
                { value: 'story', label: 'Story', Icon: Smartphone, hint: '9:16' },
                { value: 'square', label: 'Post', Icon: Square, hint: '1:1' },
              ]}
            />
          </Section>

          {/* ---- Card style ---- */}
          <Section Icon={LayoutPanelTop} title="Card style">
            <div className="grid grid-cols-2 gap-2">
              {CARD_STYLES.map((s) => {
                const active = cardStyle === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setCardStyle(s.id)}
                    className={
                      'text-left p-3 rounded-xl border transition-all ' +
                      (active
                        ? 'border-accent ring-2 ring-accent/15 bg-accent-soft'
                        : 'border-zinc-200 hover:border-zinc-300 bg-white')
                    }
                  >
                    <StyleSwatch id={s.id} />
                    <div
                      className={
                        'mt-2.5 text-[13px] font-semibold leading-none ' +
                        (active ? 'text-accent' : 'text-zinc-800')
                      }
                    >
                      {s.name}
                    </div>
                    <div className="text-[11px] text-zinc-400 mt-1 leading-none">{s.sub}</div>
                  </button>
                );
              })}
            </div>
          </Section>

          {/* ---- Background ---- */}
          <Section Icon={Palette} title="Background">
            <div className="grid grid-cols-5 gap-2 mb-4">
              {BACKGROUNDS.map((b) => {
                const active = bgId === b.id;
                return (
                  <button
                    key={b.id}
                    onClick={() => setBgId(b.id)}
                    title={b.name}
                    className={
                      'relative aspect-square rounded-xl transition-all ' +
                      (active
                        ? 'ring-2 ring-accent ring-offset-2 ring-offset-white'
                        : 'ring-1 ring-black/5 hover:ring-black/15')
                    }
                    style={{ background: b.css }}
                  >
                    {active && (
                      <span className="absolute inset-0 grid place-items-center">
                        <span className="grid place-items-center w-5 h-5 rounded-full bg-white shadow text-accent">
                          <Check size={13} strokeWidth={3} />
                        </span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-1 mb-4 -mt-1">
              {BACKGROUNDS.map((b) => (
                <span
                  key={b.id}
                  className={
                    'text-[10px] px-1.5 py-0.5 rounded ' +
                    (bgId === b.id ? 'text-accent font-semibold' : 'text-zinc-300')
                  }
                >
                  {bgId === b.id ? b.name : '·'}
                </span>
              ))}
            </div>
            <Toggle
              label="Grain texture"
              desc="Subtle film noise overlay"
              checked={grain}
              onChange={setGrain}
              Icon={Sparkle}
            />
          </Section>

          {/* ---- Typography ---- */}
          <Section Icon={Type} title="Typography">
            <Segmented<FontId>
              value={font}
              onChange={setFont}
              options={[
                { value: 'serif', label: 'Elegant serif' },
                { value: 'sans', label: 'Clean sans' },
              ]}
            />
          </Section>

          <div className="h-4" />
        </div>

        {/* sticky export */}
        <div className="shrink-0 p-4 border-t border-zinc-100 bg-white space-y-2">
          <button
            onClick={doExport}
            disabled={exporting}
            className="w-full flex items-center justify-center gap-2 h-12 rounded-xl bg-zinc-900 text-white text-[14.5px] font-semibold transition-all hover:bg-zinc-800 active:scale-[0.99] disabled:opacity-90 shadow-[0_8px_20px_-8px_rgba(0,0,0,0.5)]"
          >
            {exporting ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Rendering image…
              </>
            ) : (
              <>
                <Download size={18} strokeWidth={2.2} /> Export {RATIOS[ratio].dims} image
              </>
            )}
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 h-11 rounded-xl border border-zinc-200 bg-white text-zinc-800 text-[13.5px] font-semibold transition-all hover:border-zinc-300 active:scale-[0.99] disabled:opacity-70"
          >
            {saving ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Saving…
              </>
            ) : (
              <>
                <Save size={16} strokeWidth={2.2} /> {editingId ? 'Update saved card' : 'Save to cloud'}
              </>
            )}
          </button>
          <div className="text-center text-[11px] text-zinc-400">
            {!session ? (
              <>Sign in with Google to export · {RATIOS[ratio].w}×{RATIOS[ratio].h}</>
            ) : usage?.isPro ? (
              <span className="text-accent font-medium">Unlimited exports · Pro</span>
            ) : usage ? (
              <>
                <span className={usage.remaining === 0 ? 'text-red-500 font-semibold' : 'font-medium text-zinc-500'}>
                  {usage.remaining} of {usage.freeLimit} free exports
                </span>{' '}
                · {RATIOS[ratio].w}×{RATIOS[ratio].h}
              </>
            ) : (
              <>High-resolution PNG · {RATIOS[ratio].w}×{RATIOS[ratio].h}</>
            )}
          </div>
        </div>
      </aside>

      {/* ============ RIGHT: PREVIEW ============ */}
      <main className="flex-1 h-full flex flex-col bg-zinc-950 relative">
        <div className="h-[68px] shrink-0 flex items-center justify-between px-7 border-b border-white/5">
          <div className="flex items-center gap-2.5 text-zinc-300">
            <Eye size={16} strokeWidth={2} />
            <span className="text-[13px] font-medium">Live preview</span>
          </div>
          <div className="flex items-center gap-2 text-[12px]">
            <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/5 text-zinc-300 font-medium">
              {RATIOS[ratio].label} · {RATIOS[ratio].dims}
            </span>
            <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/5 text-zinc-300 font-medium">
              {CARD_STYLES.find((c) => c.id === cardStyle)!.name}
            </span>

            {/* account / billing */}
            {session ? (
              <AccountMenu
                email={session.email}
                subscription={subscription}
                onUpgrade={onUpgrade}
                upgrading={upgrading}
                onSignOut={signOut}
                onMyCards={() => setShowCards(true)}
              />
            ) : (
              <button
                onClick={() => setShowAuth(true)}
                className="ml-1 px-3 py-1.5 rounded-full bg-white text-zinc-900 text-[12px] font-semibold hover:bg-zinc-100 transition"
              >
                Sign in
              </button>
            )}
          </div>
        </div>

        {/* dotted texture */}
        <div
          className="absolute inset-0 top-[68px] opacity-[0.5] pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)',
            backgroundSize: '22px 22px',
          }}
        />

        <Preview data={data} bg={bg} grain={grain} />
      </main>

      {/* hidden full-res node used purely for the image export */}
      <div style={{ position: 'fixed', left: -100000, top: 0, pointerEvents: 'none' }} aria-hidden>
        <CardCanvas ref={captureRef} data={data} bg={bg} grain={grain} />
      </div>

      {/* ============ SAVED CARDS DRAWER ============ */}
      {showCards && (
        <SavedCardsDrawer
          cards={cards}
          loading={loadingCards}
          editingId={editingId}
          onClose={() => setShowCards(false)}
          onLoad={loadCard}
          onDelete={removeCard}
        />
      )}

      {/* ============ UPGRADE MODAL ============ */}
      {showUpgrade && (
        <UpgradeModal
          onClose={() => setShowUpgrade(false)}
          onUpgrade={onUpgrade}
          upgrading={upgrading}
        />
      )}

      {/* ============ AUTH MODAL ============ */}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} onAuthed={onAuthed} />}

      {/* ============ TOAST ============ */}
      {toast && (
        <div key={toast.id} className="fixed bottom-6 right-6 z-50 animate-toastIn">
          <div className="flex items-center gap-3 bg-white rounded-2xl shadow-2xl ring-1 ring-black/5 pl-3 pr-4 py-3 max-w-[340px]">
            <span
              className={
                'grid place-items-center w-9 h-9 rounded-xl shrink-0 ' +
                (toast.tone === 'success'
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'bg-red-50 text-red-600')
              }
            >
              {toast.tone === 'success' ? <Check size={18} strokeWidth={2.6} /> : <X size={18} strokeWidth={2.6} />}
            </span>
            <div className="min-w-0">
              <div className="text-[13.5px] font-semibold text-zinc-900 leading-tight">{toast.title}</div>
              <div className="text-[12px] text-zinc-500 leading-tight mt-0.5">{toast.desc}</div>
            </div>
            <button
              onClick={() => setToast(null)}
              className="ml-1 text-zinc-300 hover:text-zinc-500 transition"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Rating star glyph (control panel)                                 */
/* ------------------------------------------------------------------ */
function StarGlyph({ lit }: { lit: boolean }) {
  return (
    <svg
      width={26}
      height={26}
      viewBox="0 0 24 24"
      fill={lit ? '#f5a623' : 'none'}
      stroke={lit ? '#f5a623' : '#d4d4d8'}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Upgrade modal (shown when free exports run out)                   */
/* ------------------------------------------------------------------ */
function UpgradeModal({
  onClose,
  onUpgrade,
  upgrading,
}: {
  onClose: () => void;
  onUpgrade: () => void;
  upgrading: boolean;
}) {
  const perks = [
    'Unlimited high-resolution exports',
    'No watermark on your cards',
    'Every premium template & background',
  ];
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-[400px] bg-white rounded-2xl shadow-2xl ring-1 ring-black/5 overflow-hidden font-ui">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <div className="flex items-center gap-2.5">
            <span className="grid place-items-center w-8 h-8 rounded-lg bg-amber-400 text-white">
              <Crown size={15} strokeWidth={2.2} />
            </span>
            <div>
              <div className="font-bold text-[15px] tracking-tight leading-none">
                You're out of free exports
              </div>
              <div className="text-[12px] text-zinc-400 mt-1">
                Upgrade to ReviewCraft Pro to keep exporting
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-300 hover:text-zinc-500 transition">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-6">
          <ul className="space-y-2.5 mb-6">
            {perks.map((f) => (
              <li key={f} className="flex items-center gap-2.5 text-[13px] text-zinc-700">
                <span className="grid place-items-center w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 shrink-0">
                  <Check size={13} strokeWidth={3} />
                </span>
                {f}
              </li>
            ))}
          </ul>
          <button
            onClick={onUpgrade}
            disabled={upgrading}
            className="w-full flex items-center justify-center gap-2 h-12 rounded-xl bg-zinc-900 text-white text-[14.5px] font-semibold transition-all hover:bg-zinc-800 active:scale-[0.99] disabled:opacity-70"
          >
            {upgrading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Crown size={18} strokeWidth={2.2} />
            )}
            Upgrade to Pro · $1.99/mo
          </button>
          <button
            onClick={onClose}
            className="w-full mt-2 h-10 text-[13px] text-zinc-400 hover:text-zinc-600 transition"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Account menu (preview header)                                     */
/* ------------------------------------------------------------------ */
function AccountMenu({
  email,
  subscription,
  onUpgrade,
  upgrading,
  onSignOut,
  onMyCards,
}: {
  email: string;
  subscription: 'free' | 'pro';
  onUpgrade: () => void;
  upgrading: boolean;
  onSignOut: () => void;
  onMyCards: () => void;
}) {
  const [open, setOpen] = useState(false);
  const initials = email.slice(0, 2).toUpperCase();
  return (
    <div className="relative ml-1">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition"
      >
        <span className="grid place-items-center w-6 h-6 rounded-full bg-accent text-white text-[10px] font-bold">
          {initials}
        </span>
        <span className="text-[12px] text-zinc-200 font-medium max-w-[120px] truncate">{email}</span>
        {subscription === 'pro' && <Crown size={13} className="text-amber-400" />}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-60 bg-white rounded-xl shadow-2xl ring-1 ring-black/5 z-50 overflow-hidden font-ui">
            <div className="px-4 py-3 border-b border-zinc-100">
              <div className="text-[12px] text-zinc-400">Signed in as</div>
              <div className="text-[13px] font-semibold text-zinc-900 truncate">{email}</div>
              <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium">
                {subscription === 'pro' ? (
                  <span className="inline-flex items-center gap-1 text-amber-600">
                    <Crown size={12} /> Pro plan
                  </span>
                ) : (
                  <span className="text-zinc-400">Free plan</span>
                )}
              </div>
            </div>
            <div className="p-1.5">
              <button
                onClick={() => {
                  setOpen(false);
                  onMyCards();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-zinc-700 hover:bg-zinc-100 transition text-left"
              >
                <LayoutPanelTop size={15} /> My saved cards
              </button>
              {subscription === 'free' && (
                <button
                  onClick={() => {
                    setOpen(false);
                    onUpgrade();
                  }}
                  disabled={upgrading}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-semibold text-accent hover:bg-accent-soft transition text-left disabled:opacity-60"
                >
                  {upgrading ? <Loader2 size={15} className="animate-spin" /> : <Crown size={15} />} Upgrade to Pro · $1.99/mo
                </button>
              )}
              <button
                onClick={() => {
                  setOpen(false);
                  onSignOut();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-zinc-700 hover:bg-zinc-100 transition text-left"
              >
                <LogOut size={15} /> Sign out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Saved cards drawer                                                */
/* ------------------------------------------------------------------ */
function SavedCardsDrawer({
  cards,
  loading,
  editingId,
  onClose,
  onLoad,
  onDelete,
}: {
  cards: SavedCard[];
  loading: boolean;
  editingId: string | null;
  onClose: () => void;
  onLoad: (c: SavedCard) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-[55]">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-[380px] bg-white shadow-2xl flex flex-col font-ui animate-fadeUp">
        <div className="h-[68px] shrink-0 flex items-center justify-between px-5 border-b border-zinc-100">
          <div>
            <div className="font-bold text-[15px] tracking-tight leading-none">Saved cards</div>
            <div className="text-[11.5px] text-zinc-400 mt-1">{cards.length} card{cards.length === 1 ? '' : 's'}</div>
          </div>
          <button onClick={onClose} className="text-zinc-300 hover:text-zinc-500 transition">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto sidebar-scroll p-4 space-y-2.5">
          {loading ? (
            <div className="grid place-items-center py-16 text-zinc-400">
              <Loader2 size={22} className="animate-spin" />
            </div>
          ) : cards.length === 0 ? (
            <div className="grid place-items-center py-16 text-center text-zinc-400">
              <User size={26} className="mb-2 opacity-50" />
              <div className="text-[13px]">No saved cards yet</div>
              <div className="text-[11.5px] mt-1">Hit “Save to cloud” to keep your designs.</div>
            </div>
          ) : (
            cards.map((c) => {
              const plat = (c.platform as PlatformKey) in PLATFORMS ? PLATFORMS[c.platform as PlatformKey] : PLATFORMS.Custom;
              const PIcon = plat.Icon;
              const editing = editingId === c.id;
              return (
                <div
                  key={c.id}
                  className={
                    'group rounded-xl border p-3 transition-all ' +
                    (editing ? 'border-accent ring-2 ring-accent/15 bg-accent-soft' : 'border-zinc-200 hover:border-zinc-300')
                  }
                >
                  <div className="flex items-start gap-2.5">
                    <span
                      className="grid place-items-center w-8 h-8 rounded-lg shrink-0 text-white"
                      style={{ background: plat.color }}
                    >
                      <PIcon size={15} strokeWidth={2.2} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold text-zinc-800 truncate">{c.reviewerName || 'Customer'}</div>
                      <div className="text-[12px] text-zinc-500 line-clamp-2 mt-0.5">{c.reviewText}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2.5">
                    <button
                      onClick={() => onLoad(c)}
                      className="flex-1 h-8 rounded-lg bg-zinc-900 text-white text-[12px] font-semibold hover:bg-zinc-800 transition"
                    >
                      {editing ? 'Editing' : 'Load'}
                    </button>
                    <button
                      onClick={() => onDelete(c.id)}
                      className="grid place-items-center w-8 h-8 rounded-lg border border-zinc-200 text-zinc-400 hover:text-red-600 hover:border-red-200 transition"
                      title="Delete card"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
