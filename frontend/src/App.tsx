import { useEffect, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import {
  AtSign,
  Check,
  Clapperboard,
  CircleUser,
  CaseUpper,
  Crown,
  Download,
  Eye,
  Frame,
  LayoutPanelTop,
  Loader2,
  LogOut,
  MessageCircle,
  MessageSquareQuote,
  Palette,
  Quote,
  Save,
  Share2,
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
import { ReelModal } from './feature/reel/ReelModal';
import { BACKGROUNDS, CARD_STYLES, DEFAULT_PLATFORMS, resolvePlatform, RATIOS } from './lib/config';
import { PlatformIcon } from './lib/platformIcon';
import {
  ApiError,
  claimExport,
  deleteCard,
  getCards,
  getConfig,
  getUsage,
  loadSession,
  refresh,
  saveCard,
  saveSession,
  startCheckout,
  submitFeedback,
  type FeedbackType,
  type PublicConfig,
  type UsageInfo,
} from './lib/api';
import type {
  AuthSession,
  AvatarMode,
  CardData,
  CardStyleId,
  FontId,
  PlatformDisplay,
  RatioId,
  SavedCard,
} from './types';

interface ToastState {
  id: number;
  title: string;
  desc: string;
  tone: 'success' | 'error';
}

/**
 * Injects operator-supplied HTML/JS (GTM, GA, Meta Pixel, Hotjar, …) into the
 * <head> or <body>. <script> tags set via innerHTML don't execute, so they're
 * recreated as real script elements. Guarded against double-injection.
 */
function injectScripts(slot: 'head' | 'body', html: string) {
  if (!html || !html.trim()) return;
  const marker = `data-injected-${slot}`;
  if (document.querySelector(`[${marker}]`)) return;

  const holder = document.createElement('div');
  holder.innerHTML = html;
  const target = slot === 'head' ? document.head : document.body;

  Array.from(holder.childNodes).forEach((node) => {
    if (node.nodeName === 'SCRIPT') {
      const orig = node as HTMLScriptElement;
      const s = document.createElement('script');
      Array.from(orig.attributes).forEach((a) => s.setAttribute(a.name, a.value));
      s.text = orig.text;
      s.setAttribute(marker, '');
      target.appendChild(s);
    } else {
      const el = node.cloneNode(true);
      if (el instanceof HTMLElement) el.setAttribute(marker, '');
      target.appendChild(el);
    }
  });
}

export default function App() {
  // ---- card content + styling state ----
  const [review, setReview] = useState(
    "These earrings completely exceeded my expectations — the craftsmanship is stunning and they arrived beautifully wrapped. I've already ordered two more as gifts!",
  );
  const [name, setName] = useState('@bloom.and.willow');
  const [platform, setPlatform] = useState<string>('Etsy');
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
  const [sharing, setSharing] = useState(false);
  // Whether the browser can share image files (true on mobile, usually false on desktop).
  const [canShareFiles, setCanShareFiles] = useState(true);
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
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [showMobilePreview, setShowMobilePreview] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [reelLayers, setReelLayers] = useState<{
    base: string;
    stars: string;
    text: string;
    wordRects: { x: number; y: number; w: number; h: number }[];
  } | null>(null);

  const captureRef = useRef<HTMLDivElement>(null);
  const reelBaseRef = useRef<HTMLDivElement>(null);
  const reelStarsRef = useRef<HTMLDivElement>(null);
  const reelTextRef = useRef<HTMLDivElement>(null);

  const subscription: 'free' | 'pro' = usage?.isPro ? 'pro' : 'free';
  const bg = BACKGROUNDS.find((b) => b.id === bgId)!;
  const data: CardData = { review, name, platform, rating, avatar, cardStyle, font, ratio };
  const styles = { avatar, cardStyle, font, ratio, background: bgId, grain };

  // Free-plan exports get a watermark; Pro accounts never do.
  const watermark =
    config?.watermarkEnabled && !usage?.isPro ? config.watermarkText : null;

  // Platforms come from the admin-managed config, falling back to built-ins
  // until /api/config loads. Unknown/typed labels resolve to a "Custom" source.
  const platforms: PlatformDisplay[] =
    config?.platforms && config.platforms.length > 0
      ? config.platforms.map((p) => ({ label: p.label, color: p.color, icon: p.icon }))
      : DEFAULT_PLATFORMS;
  const isCustomPlatform = !platforms.some((p) => p.label.toLowerCase() === platform.toLowerCase());
  const platformDisplay = resolvePlatform(platform, platforms);

  const showToast = (title: string, desc: string, tone: 'success' | 'error' = 'success') =>
    setToast({ id: Date.now(), title, desc, tone });

  /* ----------------------------- session sync ----------------------------- */
  useEffect(() => {
    saveSession(session);
  }, [session]);

  // Detect native file-share support once (drives the "mobile only" hint).
  useEffect(() => {
    try {
      const probe = new File([new Blob([''], { type: 'image/png' })], 'p.png', { type: 'image/png' });
      setCanShareFiles(!!navigator.canShare && navigator.canShare({ files: [probe] }));
    } catch {
      setCanShareFiles(false);
    }
  }, []);

  /* ----------------- runtime config + third-party scripts ----------------- */
  useEffect(() => {
    let cancelled = false;
    getConfig()
      .then((c) => {
        if (cancelled) return;
        setConfig(c);
        injectScripts('head', c.headScripts);
        injectScripts('body', c.bodyScripts);
      })
      .catch(() => {
        /* config is best-effort; the app works with built-in defaults */
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
    setPlatform(c.platform);
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

  /* ----------------------------- export / share ----------------------------- */

  const fileName = () => {
    const safeName = (name || 'review').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
    return `reviewcraft-${safeName || 'card'}-${RATIOS[ratio].dims.replace(':', 'x')}.png`;
  };

  // Rasterizes the hidden full-res node with the browser's own engine (SVG
  // foreignObject) so fonts, letter-spacing and wrapping match the preview.
  // Web fonts are awaited first or the export falls back to a wider system font.
  const renderNode = async (node: HTMLElement | null): Promise<string> => {
    if (!node) throw new Error('Nothing to export');
    if (document.fonts) {
      await Promise.all([
        document.fonts.load('600 31px "Plus Jakarta Sans"'),
        document.fonts.load('700 16.5px "Plus Jakarta Sans"'),
        document.fonts.load('500 31px "Newsreader"'),
      ]).catch(() => {});
      await document.fonts.ready;
    }
    return toPng(node, { pixelRatio: 2, cacheBust: true, width: node.offsetWidth, height: node.offsetHeight });
  };

  const renderPng = () => renderNode(captureRef.current);

  const downloadPng = (dataUrl: string) => {
    const link = document.createElement('a');
    link.download = fileName();
    link.href = dataUrl;
    link.click();
  };

  // True once the user is signed in but out of free exports. Callers open the
  // upgrade popup instead of proceeding.
  const outOfQuota = () =>
    !!usage && !usage.isPro && usage.remaining !== null && usage.remaining <= 0;

  const doExport = async () => {
    if (exporting) return;
    if (!session) {
      setShowAuth(true);
      showToast('Sign in to export', 'Use your Google account — you get 3 free exports.', 'error');
      return;
    }
    if (outOfQuota()) {
      setShowUpgrade(true);
      return;
    }
    setExporting(true);
    try {
      // Claim a quota slot first — the backend enforces the free limit.
      const { ok, usage: u } = await withAuth(claimExport);
      setUsage(u);
      if (!ok) {
        setShowUpgrade(true);
        return;
      }
      downloadPng(await renderPng());
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

  // Shares the image via the native share sheet (mobile → Instagram/Story,
  // WhatsApp, etc.). On unsupported browsers (most desktops) it downloads the
  // image so the user can upload it manually. The quota slot is only claimed on
  // a completed action, so dismissing the share sheet doesn't burn a free export.
  const doShare = async () => {
    if (sharing) return;
    if (!session) {
      setShowAuth(true);
      showToast('Sign in to share', 'Use your Google account — you get 3 free exports.', 'error');
      return;
    }
    if (outOfQuota()) {
      setShowUpgrade(true);
      return;
    }
    setSharing(true);
    try {
      const dataUrl = await renderPng();
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], fileName(), { type: 'image/png' });

      const canShareFiles =
        typeof navigator !== 'undefined' && !!navigator.canShare && navigator.canShare({ files: [file] });

      if (canShareFiles) {
        // Resolves once the user picks an app (or rejects with AbortError if they cancel).
        await navigator.share({
          files: [file],
          title: 'My review card',
          text: `${name || 'A customer'} review · made with SocialReviewCard.com`,
        });
        const { usage: u } = await withAuth(claimExport);
        setUsage(u);
        const left = u.isPro ? 'Unlimited exports' : `${u.remaining} free export(s) left`;
        showToast('Ready to share', `Pick where to post · ${left}`);
      } else {
        // Desktop fallback: claim + download so they can upload it themselves.
        const { ok, usage: u } = await withAuth(claimExport);
        setUsage(u);
        if (!ok) {
          setShowUpgrade(true);
          return;
        }
        downloadPng(dataUrl);
        showToast('Saved for sharing', "This browser can't share files — image downloaded so you can upload it.");
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // User dismissed the native share sheet — no quota consumed, no error.
      } else if (err instanceof ApiError && err.status === 401) {
        setShowAuth(true);
        showToast('Session expired', 'Sign in again to share.', 'error');
      } else {
        showToast('Share failed', 'We could not share the image. Try again.', 'error');
      }
    } finally {
      setSharing(false);
    }
  };

  // Rasterize the current card and open the animated-video (Reel) studio.
  const openReel = async () => {
    if (!session) {
      setShowAuth(true);
      showToast('Sign in to animate', 'Use your Google account to export a video.', 'error');
      return;
    }
    try {
      const [base, stars, text] = await Promise.all([
        renderNode(reelBaseRef.current),
        renderNode(reelStarsRef.current),
        renderNode(reelTextRef.current),
      ]);
      // Measure each word's box (normalized to the card) for per-word reveal.
      const root = reelTextRef.current;
      let wordRects: { x: number; y: number; w: number; h: number }[] = [];
      if (root) {
        const rb = root.getBoundingClientRect();
        if (rb.width && rb.height) {
          wordRects = Array.from(root.querySelectorAll('.reel-word')).map((el) => {
            const r = (el as HTMLElement).getBoundingClientRect();
            return {
              x: (r.left - rb.left) / rb.width,
              y: (r.top - rb.top) / rb.height,
              w: r.width / rb.width,
              h: r.height / rb.height,
            };
          });
        }
      }
      setReelLayers({ base, stars, text, wordRects });
    } catch {
      showToast('Could not prepare', 'We could not render the card. Try again.', 'error');
    }
  };

  return (
    <div className="h-full flex font-ui text-zinc-900">
      {/* ============ LEFT: CONTROL PANEL ============ */}
      <aside className="w-full lg:w-[396px] lg:shrink-0 h-full bg-white border-r border-zinc-200 flex flex-col">
        {/* brand header */}
        <div className="px-5 h-[68px] shrink-0 flex items-center justify-between gap-3 border-b border-zinc-100">
          <div className="flex items-center gap-3 min-w-0">
            <div className="grid place-items-center w-9 h-9 rounded-xl bg-zinc-900 text-white shrink-0">
              <Quote size={18} strokeWidth={2.2} />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-[16px] tracking-tight leading-none">ReviewCraft</div>
              <div className="text-[11.5px] text-zinc-400 mt-0.5 truncate">Turn reviews into shareable art</div>
            </div>
          </div>
          {/* account control — mobile only (desktop has it in the preview header) */}
          <div className="lg:hidden shrink-0">
            {session ? (
              <AccountMenu
                email={session.email}
                subscription={subscription}
                onUpgrade={onUpgrade}
                upgrading={upgrading}
                onSignOut={signOut}
                onMyCards={() => setShowCards(true)}
                dark={false}
              />
            ) : (
              <button
                onClick={() => setShowAuth(true)}
                className="px-3 py-1.5 rounded-full bg-zinc-900 text-white text-[12px] font-semibold hover:bg-zinc-800 transition"
              >
                Sign in
              </button>
            )}
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
                {platforms.map((p) => {
                  const active = !isCustomPlatform && platform.toLowerCase() === p.label.toLowerCase();
                  return (
                    <button
                      key={p.label}
                      onClick={() => setPlatform(p.label)}
                      title={p.label}
                      className={
                        'flex flex-col items-center gap-1.5 py-2.5 rounded-xl border transition-all ' +
                        (active ? 'border-accent bg-accent-soft' : 'border-zinc-200 hover:border-zinc-300 bg-white')
                      }
                    >
                      <span
                        className="grid place-items-center w-7 h-7 rounded-lg"
                        style={{ background: active ? p.color : '#f4f4f5', color: active ? '#fff' : '#71717a' }}
                      >
                        <PlatformIcon token={p.icon} size={14} />
                      </span>
                      <span
                        className={
                          'text-[10px] font-medium leading-none truncate max-w-full ' +
                          (active ? 'text-accent' : 'text-zinc-500')
                        }
                      >
                        {p.label}
                      </span>
                    </button>
                  );
                })}
                {/* Custom = free-text source */}
                <button
                  onClick={() => setPlatform('')}
                  title="Custom"
                  className={
                    'flex flex-col items-center gap-1.5 py-2.5 rounded-xl border transition-all ' +
                    (isCustomPlatform ? 'border-accent bg-accent-soft' : 'border-zinc-200 hover:border-zinc-300 bg-white')
                  }
                >
                  <span
                    className="grid place-items-center w-7 h-7 rounded-lg"
                    style={{ background: isCustomPlatform ? '#6d5efc' : '#f4f4f5', color: isCustomPlatform ? '#fff' : '#71717a' }}
                  >
                    <PlatformIcon token="fas:store" size={14} />
                  </span>
                  <span
                    className={
                      'text-[10px] font-medium leading-none ' + (isCustomPlatform ? 'text-accent' : 'text-zinc-500')
                    }
                  >
                    Custom
                  </span>
                </button>
              </div>
              {isCustomPlatform && (
                <input
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value.slice(0, 40))}
                  placeholder="Source name (e.g. Trustpilot)"
                  className="w-full mt-2 rounded-xl border border-zinc-200 bg-zinc-50/60 px-3.5 py-2.5 text-[13.5px] text-zinc-800 placeholder-zinc-400 outline-none transition focus:border-accent focus:bg-white focus:ring-4 focus:ring-accent/10"
                />
              )}
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
          {/* mobile-only: open the preview (no room for a side-by-side pane) */}
          <button
            onClick={() => setShowMobilePreview(true)}
            className="lg:hidden w-full flex items-center justify-center gap-2 h-11 rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-800 text-[13.5px] font-semibold transition-all hover:border-zinc-300 active:scale-[0.99]"
          >
            <Eye size={16} strokeWidth={2.2} /> Preview card
          </button>
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
            onClick={doShare}
            disabled={sharing}
            className="w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-accent text-white text-[13.5px] font-semibold transition-all hover:bg-accent-hover active:scale-[0.99] disabled:opacity-80"
          >
            {sharing ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Preparing…
              </>
            ) : (
              <>
                <Share2 size={16} strokeWidth={2.2} /> Share to social
              </>
            )}
          </button>
          {!canShareFiles && (
            <p className="text-center text-[11px] text-zinc-400 -mt-0.5 leading-snug">
              Direct sharing is mobile-only — on desktop the image downloads so you can upload it.
            </p>
          )}
          <button
            onClick={openReel}
            className="w-full flex items-center justify-center gap-2 h-11 rounded-xl border border-accent/40 bg-accent-soft text-accent text-[13.5px] font-semibold transition-all hover:border-accent active:scale-[0.99]"
          >
            <Clapperboard size={16} strokeWidth={2.2} /> Animate to video
            <span className="text-[10px] font-bold uppercase tracking-wide bg-accent text-white px-1.5 py-0.5 rounded">Beta</span>
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

      {/* ============ RIGHT: PREVIEW (desktop only) ============ */}
      <main className="hidden lg:flex flex-1 h-full flex-col bg-zinc-950 relative">
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
                dark
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

        <Preview data={data} bg={bg} grain={grain} platform={platformDisplay} watermark={watermark} />
      </main>

      {/* hidden full-res node used purely for the image export */}
      <div style={{ position: 'fixed', left: -100000, top: 0, pointerEvents: 'none' }} aria-hidden>
        <CardCanvas ref={captureRef} data={data} bg={bg} grain={grain} platform={platformDisplay} watermark={watermark} />
      </div>

      {/* hidden layered nodes for the animated-video export (base / stars / text) */}
      <div style={{ position: 'fixed', left: -100000, top: 0, pointerEvents: 'none' }} aria-hidden>
        <CardCanvas ref={reelBaseRef} data={data} bg={bg} grain={grain} platform={platformDisplay} watermark={null} layer="base" />
        <CardCanvas ref={reelStarsRef} data={data} bg={bg} grain={grain} platform={platformDisplay} watermark={null} layer="stars" />
        <CardCanvas ref={reelTextRef} data={data} bg={bg} grain={grain} platform={platformDisplay} watermark={null} layer="text" />
      </div>

      {/* ============ SAVED CARDS DRAWER ============ */}
      {showCards && (
        <SavedCardsDrawer
          cards={cards}
          loading={loadingCards}
          editingId={editingId}
          platforms={platforms}
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
          config={config}
        />
      )}

      {/* ============ AUTH MODAL ============ */}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} onAuthed={onAuthed} />}

      {/* ============ MOBILE PREVIEW MODAL ============ */}
      {showMobilePreview && (
        <div className="lg:hidden fixed inset-0 z-[58] flex flex-col bg-zinc-950">
          <div className="h-14 shrink-0 flex items-center justify-between px-4 border-b border-white/5">
            <div className="flex items-center gap-2 text-zinc-300">
              <Eye size={16} strokeWidth={2} />
              <span className="text-[13px] font-medium">
                Preview · {RATIOS[ratio].label} {RATIOS[ratio].dims}
              </span>
            </div>
            <button
              onClick={() => setShowMobilePreview(false)}
              className="grid place-items-center w-9 h-9 rounded-full bg-white/10 text-white hover:bg-white/20 transition"
            >
              <X size={18} />
            </button>
          </div>
          <Preview data={data} bg={bg} grain={grain} platform={platformDisplay} watermark={watermark} />
        </div>
      )}

      {/* ============ FEEDBACK ============ */}
      <button
        onClick={() => setShowFeedback(true)}
        title="Send feedback or get support"
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 h-11 pl-3.5 pr-4 rounded-full bg-accent text-white shadow-lg hover:bg-accent-hover active:scale-95 transition"
      >
        <MessageCircle size={18} strokeWidth={2.2} />
        <span className="hidden sm:inline text-[13px] font-semibold">Feedback</span>
      </button>
      {showFeedback && (
        <FeedbackModal session={session} onClose={() => setShowFeedback(false)} showToast={showToast} />
      )}

      {/* ============ REEL (animated video) ============ */}
      {reelLayers && <ReelModal layers={reelLayers} onClose={() => setReelLayers(null)} />}

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
  config,
}: {
  onClose: () => void;
  onUpgrade: () => void;
  upgrading: boolean;
  config: PublicConfig | null;
}) {
  const title = config?.upgradeTitle || "You're out of free exports";
  const subtitle = config?.upgradeSubtitle || 'Upgrade to ReviewCraft Pro to keep exporting';
  const priceLabel = config?.proPriceLabel || '$1.99/mo';
  const perks =
    config?.proFeatures && config.proFeatures.length > 0
      ? config.proFeatures
      : [
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
                {title}
              </div>
              <div className="text-[12px] text-zinc-400 mt-1">
                {subtitle}
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
            Upgrade to Pro · {priceLabel}
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
  dark = false,
}: {
  email: string;
  subscription: 'free' | 'pro';
  onUpgrade: () => void;
  upgrading: boolean;
  onSignOut: () => void;
  onMyCards: () => void;
  dark?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const initials = email.slice(0, 2).toUpperCase();
  return (
    <div className="relative ml-1">
      <button
        onClick={() => setOpen((v) => !v)}
        className={
          'flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full border transition ' +
          (dark
            ? 'bg-white/5 border-white/10 hover:bg-white/10'
            : 'bg-zinc-50 border-zinc-200 hover:bg-zinc-100')
        }
      >
        <span className="grid place-items-center w-6 h-6 rounded-full bg-accent text-white text-[10px] font-bold">
          {initials}
        </span>
        <span
          className={
            'text-[12px] font-medium max-w-[120px] truncate ' + (dark ? 'text-zinc-200' : 'text-zinc-700')
          }
        >
          {email}
        </span>
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
  platforms,
  onClose,
  onLoad,
  onDelete,
}: {
  cards: SavedCard[];
  loading: boolean;
  editingId: string | null;
  platforms: PlatformDisplay[];
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
              const plat = resolvePlatform(c.platform, platforms);
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
                      <PlatformIcon token={plat.icon} size={14} color="#fff" />
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

/* ------------------------------------------------------------------ */
/*  Feedback / support modal                                          */
/* ------------------------------------------------------------------ */
function FeedbackModal({
  session,
  onClose,
  showToast,
}: {
  session: AuthSession | null;
  onClose: () => void;
  showToast: (title: string, desc: string, tone?: 'success' | 'error') => void;
}) {
  const [type, setType] = useState<FeedbackType>('suggestion');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState(session?.email ?? '');
  const [busy, setBusy] = useState(false);

  const types: { id: FeedbackType; label: string }[] = [
    { id: 'suggestion', label: 'Suggestion' },
    { id: 'criticism', label: 'Criticism' },
    { id: 'support', label: 'Support' },
  ];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim().length < 3 || busy) return;
    setBusy(true);
    try {
      await submitFeedback(
        { type, message: message.trim(), email: email.trim() || undefined },
        session?.accessToken,
      );
      showToast('Thanks for the feedback', 'We received your message.');
      onClose();
    } catch {
      showToast('Could not send', 'Please try again in a moment.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-[420px] bg-white rounded-2xl shadow-2xl ring-1 ring-black/5 overflow-hidden font-ui"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <div className="flex items-center gap-2.5">
            <span className="grid place-items-center w-8 h-8 rounded-lg bg-accent text-white">
              <MessageCircle size={16} strokeWidth={2.2} />
            </span>
            <div>
              <div className="font-bold text-[15px] leading-none">Send feedback</div>
              <div className="text-[12px] text-zinc-400 mt-1">Ideas, problems or support — we read everything</div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-zinc-300 hover:text-zinc-500 transition">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-5">
          <div className="grid grid-cols-3 gap-1.5 mb-3">
            {types.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setType(t.id)}
                className={
                  'h-9 rounded-lg text-[12.5px] font-semibold border transition ' +
                  (type === t.id
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-zinc-200 text-zinc-600 hover:border-zinc-300')
                }
              >
                {t.label}
              </button>
            ))}
          </div>

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            maxLength={4000}
            autoFocus
            placeholder="Tell us what's on your mind…"
            className="w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50/60 px-3.5 py-3 text-[13.5px] text-zinc-800 placeholder-zinc-400 outline-none transition focus:border-accent focus:bg-white"
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="Email (optional, so we can reply)"
            className="w-full mt-2 rounded-xl border border-zinc-200 bg-zinc-50/60 px-3.5 py-2.5 text-[13px] text-zinc-800 placeholder-zinc-400 outline-none transition focus:border-accent focus:bg-white"
          />

          <button
            type="submit"
            disabled={busy || message.trim().length < 3}
            className="w-full mt-4 h-11 rounded-xl bg-zinc-900 text-white text-[14px] font-semibold flex items-center justify-center gap-2 transition hover:bg-zinc-800 disabled:opacity-50"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <MessageCircle size={16} />} Send
          </button>
        </div>
      </form>
    </div>
  );
}
