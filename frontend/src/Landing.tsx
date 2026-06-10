import { useEffect, useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Check,
  ClipboardPaste,
  Download,
  Images,
  Palette,
  Quote,
  Smartphone,
  Star,
  Type,
  Wand2,
} from 'lucide-react';
import { CardCanvas } from './components/Preview';
import {
  BACKGROUNDS,
  CARD_STYLES,
  DEFAULT_PLATFORMS,
  NOISE,
  RATIOS,
  resolvePlatform,
} from './lib/config';
import {
  getBillingPlans,
  getConfig,
  getFounderCount,
  type FounderCount,
  type PublicBillingPlan,
  type PublicConfig,
} from './lib/api';
import type { CardData } from './types';

/* ----------------------------- demo cards ----------------------------- */
type Demo = CardData & { bgId: string };

const HERO_MAIN: Demo = { review: "These earrings completely exceeded my expectations — the craftsmanship is stunning and they arrived beautifully wrapped. I've already ordered two more as gifts!", name: '@bloom.and.willow', platform: 'Amazon', rating: 5, avatar: 'initials', cardStyle: 'brutal', font: 'serif', ratio: 'story', bgId: 'sunset' };
const HERO_BACK: Demo = { review: 'The quality of this wallet is outstanding. The leather feels premium and the stitching is flawless. Highly recommended!', name: '@oak.leather.co', platform: 'Etsy', rating: 5, avatar: 'initials', cardStyle: 'dark', font: 'serif', ratio: 'story', bgId: 'obsidian' };

const GALLERY: Demo[] = [
  { review: "These wireless headphones completely exceeded my expectations — the sound is crystal clear and the battery lasts all day. One of the best purchases I've made this year!", name: '@audio.haus', platform: 'Shopify', rating: 5, avatar: 'initials', cardStyle: 'minimal', font: 'serif', ratio: 'story', bgId: 'sunset' },
  { review: "I absolutely love this candle. The scent fills the whole room and lasts for hours. It's become part of my evening ritual.", name: '@ember.studio', platform: 'Etsy', rating: 5, avatar: 'initials', cardStyle: 'glass', font: 'sans', ratio: 'story', bgId: 'aurora' },
  { review: 'The quality of this wallet is outstanding. The leather feels premium, the stitching is flawless. Highly recommended!', name: '@oak.leather.co', platform: 'Etsy', rating: 5, avatar: 'initials', cardStyle: 'dark', font: 'serif', ratio: 'story', bgId: 'obsidian' },
  { review: "This smartwatch offers incredible value. The fitness tracking is accurate and the battery life is impressive. Couldn't be happier.", name: '@move.daily', platform: 'Amazon', rating: 5, avatar: 'initials', cardStyle: 'brutal', font: 'sans', ratio: 'story', bgId: 'oceanic' },
];

/** Renders a scaled real card preview from demo data. */
function DemoCard({ data, scale, watermark = false }: { data: Demo; scale: number; watermark?: boolean }) {
  const { bgId, ...card } = data;
  const bg = BACKGROUNDS.find((b) => b.id === bgId) ?? BACKGROUNDS[0];
  const plat = resolvePlatform(card.platform, DEFAULT_PLATFORMS);
  const r = RATIOS[card.ratio];
  return (
    <div style={{ width: r.w * scale, height: r.h * scale }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        <CardCanvas
          data={card}
          bg={bg}
          grain
          platform={plat}
          watermark={watermark ? 'SocialReviewCard.com' : null}
        />
      </div>
    </div>
  );
}

function SectionLabel({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <span className={'inline-flex items-center gap-2 font-jakarta text-[12px] font-bold uppercase tracking-[0.16em] ' + (dark ? 'text-cream/55' : 'text-ink-soft/70')}>
      <span className="w-5 h-px" style={{ background: dark ? 'rgba(247,243,236,0.4)' : 'rgba(107,99,87,0.5)' }} />
      {children}
    </span>
  );
}

const CTA = '/app';

/* ============================ Landing ============================ */
export default function Landing() {
  const [solid, setSolid] = useState(false);
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [plans, setPlans] = useState<PublicBillingPlan[]>([]);
  const [founder, setFounder] = useState<FounderCount | null>(null);
  const [yearly, setYearly] = useState(false);

  useEffect(() => {
    getConfig().then(setConfig).catch(() => {});
    getBillingPlans().then(setPlans).catch(() => {});
    getFounderCount().then(setFounder).catch(() => {});
    const onScroll = () => setSolid(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });

    const els = document.querySelectorAll('.reveal');
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }),
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    );
    els.forEach((e) => io.observe(e));
    const fallback = setTimeout(() => els.forEach((e) => e.classList.add('in')), 1800);
    return () => { window.removeEventListener('scroll', onScroll); io.disconnect(); clearTimeout(fallback); };
  }, []);

  // Reveal elements that mount only after async data loads (pricing toggle,
  // founder band) — the initial observer never saw them.
  useEffect(() => {
    const els = document.querySelectorAll('.reveal:not(.in)');
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }),
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    );
    els.forEach((e) => io.observe(e));
    const fallback = setTimeout(() => els.forEach((e) => e.classList.add('in')), 500);
    return () => { io.disconnect(); clearTimeout(fallback); };
  }, [plans, founder]);

  const proFeats = config?.proFeatures && config.proFeatures.length > 0
    ? config.proFeatures
    : ['Animated video exports (MP4) for Reels & TikTok', 'No watermark — 100% your brand', 'Unlimited high-resolution exports', 'Bulk export multiple cards', 'New styles & animations every month', 'Priority support'];

  const subs = plans.filter((p) => p.kind === 'subscription');
  const monthly = subs.find((p) => p.interval === 'month') ?? subs[0];
  const annual = subs.find((p) => p.interval === 'year');
  const lifetime = plans.find((p) => p.kind === 'lifetime');
  const activePro = yearly && annual ? annual : monthly;
  const proPrice = activePro?.priceLabel || config?.proPriceLabel || '$1.99/mo';
  const proHref = (id?: number) => (id != null ? `${CTA}?checkout=${id}` : CTA);

  const navLinks: [string, string][] = [['How it works', '#how'], ['Styles', '#styles'], ['Features', '#features'], ['Pricing', '#pricing']];

  return (
    <div className="bg-cream text-ink font-jakarta min-h-screen">
      {/* ---- Nav ---- */}
      <header className={'fixed top-0 inset-x-0 z-50 transition-all duration-300 ' + (solid ? 'bg-cream/85 backdrop-blur-xl border-b border-line' : 'border-b border-transparent')}>
        <div className="mx-auto max-w-[1200px] px-6 h-[68px] flex items-center justify-between">
          <a href="#top" className="flex items-center gap-2.5">
            <span className="grid place-items-center w-9 h-9 rounded-[11px] bg-ink text-cream shadow-sm"><Quote size={18} strokeWidth={2.2} /></span>
            <span className="font-bold text-[16.5px] tracking-tight">SocialReviewCard</span>
          </a>
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map(([l, h]) => <a key={l} href={h} className="text-[14px] font-medium text-ink-soft hover:text-ink transition-colors">{l}</a>)}
          </nav>
          <div className="flex items-center gap-3">
            <a href={CTA} className="hidden sm:block text-[14px] font-semibold text-ink hover:opacity-70 transition">Sign in</a>
            <a href={CTA} className="group inline-flex items-center gap-1.5 rounded-full bg-ink text-cream px-4 sm:px-5 h-10 text-[14px] font-semibold transition-all hover:gap-2.5 active:scale-[.98] shadow-[0_6px_20px_-8px_rgba(26,22,19,0.6)]">
              Start free <ArrowRight size={16} strokeWidth={2.4} />
            </a>
          </div>
        </div>
      </header>

      <main>
        {/* ---- Hero ---- */}
        <section id="top" className="relative overflow-hidden pt-[68px]">
          <div className="pointer-events-none absolute -top-40 -right-40 w-[680px] h-[680px] rounded-full opacity-50 blur-[90px]" style={{ background: 'radial-gradient(circle, #ffd0a8, transparent 62%)' }} />
          <div className="pointer-events-none absolute top-20 -left-52 w-[560px] h-[560px] rounded-full opacity-40 blur-[90px]" style={{ background: 'radial-gradient(circle, #d3b6ef, transparent 62%)' }} />
          <div className="relative mx-auto max-w-[1200px] px-6 grid lg:grid-cols-[1.05fr_0.95fr] gap-12 lg:gap-6 items-center pt-12 pb-20 lg:pt-20 lg:pb-28">
            <div className="reveal">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/70 border border-line pl-1.5 pr-3.5 py-1.5 mb-7 backdrop-blur">
                <span className="inline-flex items-center gap-0.5 rounded-full bg-ink text-[#ffd66e] px-2 py-0.5">
                  {[0, 1, 2, 3, 4].map((i) => <Star key={i} size={11} fill="#ffd66e" strokeWidth={0} />)}
                </span>
                <span className="text-[12.5px] font-semibold text-ink-soft">Early access — be one of the first 100 sellers</span>
              </div>
              <h1 className="font-serif leading-[0.98] tracking-[-0.02em]" style={{ fontSize: 'clamp(44px, 6.2vw, 76px)', fontWeight: 500 }}>
                Turn five-star reviews into{' '}
                <em className="not-italic relative whitespace-nowrap">scroll-stopping
                  <svg className="absolute left-0 -bottom-2 w-full" height="14" viewBox="0 0 300 14" fill="none" preserveAspectRatio="none"><path d="M2 9C60 3 140 3 298 7" stroke="url(#g)" strokeWidth="5" strokeLinecap="round" /><defs><linearGradient id="g" x1="0" x2="300"><stop stopColor="#ff9aa2" /><stop offset="1" stopColor="#c8a2e0" /></linearGradient></defs></svg>
                </em> art.
              </h1>
              <p className="mt-7 text-[18px] leading-relaxed text-ink-soft max-w-[460px]">
                Paste a customer review, pick a style, and export a gorgeous card for Instagram Stories or Posts — in seconds. No design skills required.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <a href={CTA} className="group inline-flex items-center gap-2 rounded-full bg-ink text-cream px-7 h-[54px] text-[16px] font-semibold transition-all hover:gap-3 active:scale-[.98] shadow-[0_14px_34px_-12px_rgba(26,22,19,0.7)]">
                  Create your first card <ArrowRight size={18} strokeWidth={2.4} />
                </a>
                <a href="#styles" className="inline-flex items-center gap-2 rounded-full bg-white border border-line px-6 h-[54px] text-[16px] font-semibold text-ink hover:bg-white/60 transition">
                  <Images size={18} strokeWidth={2} /> See examples
                </a>
              </div>
              <div className="mt-7 flex items-center gap-5 text-[13.5px] text-ink-soft">
                <span className="inline-flex items-center gap-1.5"><Check size={16} strokeWidth={2.6} className="text-emerald-600" /> Free to start</span>
                <span className="inline-flex items-center gap-1.5"><Check size={16} strokeWidth={2.6} className="text-emerald-600" /> No card required</span>
              </div>
            </div>
            <div className="reveal relative h-[440px] sm:h-[540px] lg:h-[560px]">
              <div className="absolute right-[8%] sm:right-[14%] top-6 rotate-[7deg] opacity-95 hover:rotate-[5deg] transition-transform duration-500">
                <DemoCard data={HERO_BACK} scale={0.5} />
              </div>
              <div className="absolute left-[2%] sm:left-[6%] top-0 -rotate-[5deg] hover:-rotate-[3deg] transition-transform duration-500" style={{ animation: 'floaty 7s ease-in-out infinite' }}>
                <DemoCard data={HERO_MAIN} scale={0.62} watermark />
              </div>
            </div>
          </div>
        </section>

        {/* ---- Trust marquee ---- */}
        <section className="border-y border-line bg-white/40 py-7 overflow-hidden">
          <p className="text-center text-[12px] font-semibold uppercase tracking-[0.18em] text-ink-soft/70 mb-5">Bring in reviews from anywhere you sell</p>
          <div className="relative">
            <div className="flex gap-12 w-max" style={{ animation: 'marquee 28s linear infinite' }}>
              {['Etsy', 'Shopify', 'Amazon', 'Instagram', 'Google', 'Trustpilot', 'Yelp', 'App Store', 'Gumroad', 'TikTok Shop', 'Etsy', 'Shopify', 'Amazon', 'Instagram', 'Google', 'Trustpilot', 'Yelp', 'App Store', 'Gumroad', 'TikTok Shop'].map((it, i) => (
                <span key={i} className="text-[22px] font-serif text-ink/45 whitespace-nowrap" style={{ fontWeight: 500 }}>{it}</span>
              ))}
            </div>
            <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-cream to-transparent" />
            <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-cream to-transparent" />
          </div>
        </section>

        {/* ---- How it works ---- */}
        <section id="how" className="mx-auto max-w-[1200px] px-6 py-24 lg:py-32">
          <div className="reveal max-w-2xl">
            <SectionLabel>How it works</SectionLabel>
            <h2 className="font-serif leading-[1.02] tracking-[-0.02em] mt-4" style={{ fontSize: 'clamp(32px, 4.4vw, 52px)', fontWeight: 500 }}>From plain text to shareable in three steps.</h2>
          </div>
          <div className="mt-14 grid md:grid-cols-3 gap-6">
            {[
              { n: '01', Icon: ClipboardPaste, title: 'Paste any review', body: 'Drop in the text, the customer’s name, the platform and a star rating. That’s the whole setup.' },
              { n: '02', Icon: Wand2, title: 'Style it your way', body: 'Pick a card design, a background, serif or sans — watch it update live as you go.' },
              { n: '03', Icon: Download, title: 'Export & share', body: 'Download a crisp PNG sized for Stories (9:16) or Posts (1:1) and post it everywhere.' },
            ].map((s, i) => (
              <div key={s.n} className="reveal relative rounded-3xl bg-white border border-line p-8 hover:shadow-[0_30px_60px_-30px_rgba(26,22,19,0.25)] transition-shadow" style={{ transitionDelay: i * 70 + 'ms' }}>
                <div className="flex items-center justify-between mb-7">
                  <span className="grid place-items-center w-12 h-12 rounded-2xl bg-ink text-cream"><s.Icon size={22} strokeWidth={2} /></span>
                  <span className="font-serif text-[40px] text-ink/12 leading-none" style={{ fontWeight: 600 }}>{s.n}</span>
                </div>
                <h3 className="font-bold text-[20px] tracking-tight">{s.title}</h3>
                <p className="mt-2.5 text-[15px] leading-relaxed text-ink-soft">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---- Style gallery ---- */}
        <section id="styles" className="relative py-24 lg:py-32 bg-ink text-cream overflow-hidden">
          <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[420px] opacity-30 blur-[100px]" style={{ background: 'radial-gradient(circle, #ff9aa2, transparent 60%)' }} />
          <div className="relative mx-auto max-w-[1200px] px-6">
            <div className="reveal text-center max-w-2xl mx-auto">
              <SectionLabel dark>One review, infinite looks</SectionLabel>
              <h2 className="font-serif leading-[1.03] tracking-[-0.02em] mt-4" style={{ fontSize: 'clamp(32px, 4.4vw, 52px)', fontWeight: 500 }}>Four designer styles. Five backgrounds. Endlessly remixable.</h2>
              <p className="mt-5 text-[17px] leading-relaxed text-cream/60">Glassmorphism, Stark White, Dark Sleek, Neo-Brutalism — every card is built to stop the scroll and match your brand.</p>
            </div>
            <div className="reveal mt-16 flex gap-6 overflow-x-auto pb-6 px-1 snap-x justify-start lg:justify-center" style={{ scrollbarWidth: 'none' }}>
              {GALLERY.map((d, i) => (
                <div key={i} className="snap-center shrink-0 group">
                  <div className="transition-transform duration-500 group-hover:-translate-y-2"><DemoCard data={d} scale={0.46} /></div>
                  <div className="mt-3 text-center">
                    <div className="font-semibold text-[14px] text-cream">{CARD_STYLES.find((c) => c.id === d.cardStyle)?.name}</div>
                    <div className="text-[12.5px] text-cream/45">{BACKGROUNDS.find((b) => b.id === d.bgId)?.name}</div>
                  </div>
                </div>
              ))}
            </div>
            <p className="reveal text-center text-[13px] text-cream/40 mt-2">Scroll to explore →</p>
          </div>
        </section>

        {/* ---- Features ---- */}
        <section id="features" className="mx-auto max-w-[1200px] px-6 py-24 lg:py-32">
          <div className="grid lg:grid-cols-[0.8fr_1.2fr] gap-12 lg:gap-16 items-start">
            <div className="reveal lg:sticky lg:top-28">
              <SectionLabel>Everything you need</SectionLabel>
              <h2 className="font-serif leading-[1.03] tracking-[-0.02em] mt-4" style={{ fontSize: 'clamp(32px, 4.2vw, 50px)', fontWeight: 500 }}>Small details that make it look expensive.</h2>
              <p className="mt-5 text-[16.5px] leading-relaxed text-ink-soft max-w-md">Every control is tuned so even a quick card looks like a brand designed it. No templates that scream “made in five minutes.”</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-5">
              {[
                { Icon: Smartphone, title: 'Stories & Posts', body: 'Toggle between 9:16 and 1:1 instantly — your card recomposes to fit each format perfectly.' },
                { Icon: Palette, title: 'Trendy backgrounds', body: 'Pastel Sunset, Aurora, Deep Oceanic gradients plus clean solids — with optional film grain.' },
                { Icon: Type, title: 'Elegant or clean type', body: 'Switch between a refined serif and a crisp sans to match the voice of your brand.' },
                { Icon: BadgeCheck, title: 'Verified badges', body: 'Platform marks and a “verified customer” line add instant, authentic credibility.' },
                { Icon: Star, title: 'Live star ratings', body: 'Click to set 1–5 stars. Everything on the card updates in real time as you tweak.' },
                { Icon: Download, title: 'One-click export', body: 'Download a high-resolution PNG ready to post — or remove the watermark on Pro.' },
              ].map((f, i) => (
                <div key={f.title} className="reveal rounded-3xl bg-white border border-line p-7 hover:border-ink/20 transition-colors" style={{ transitionDelay: ((i % 2) * 60) + 'ms' }}>
                  <span className="grid place-items-center w-11 h-11 rounded-xl bg-cream border border-line text-ink mb-5"><f.Icon size={20} strokeWidth={2} /></span>
                  <h3 className="font-bold text-[17.5px] tracking-tight">{f.title}</h3>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-ink-soft">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---- Why sellers switch (honest comparison) ---- */}
        <section className="mx-auto max-w-[1200px] px-6 pb-16 lg:pb-20">
          <div className="reveal text-center max-w-xl mx-auto mb-14">
            <SectionLabel>Why sellers switch</SectionLabel>
            <h2 className="font-serif leading-[1.03] tracking-[-0.02em] mt-4" style={{ fontSize: 'clamp(30px, 4vw, 48px)', fontWeight: 500 }}>The math is simple.</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { t: 'The old way', body: 'Open Canva → hunt for a template → paste the review → fix the font → align the stars → resize for Stories → export.', em: '~15 minutes per post.' },
              { t: 'With SocialReviewCard', body: 'Paste the review, pick a style, export.', em: 'Under 30 seconds — and it looks like a brand designed it.' },
              { t: 'What that buys you', body: 'A week of reviews becomes a month of Stories in one sitting.', em: 'More social proof posted = more trust = more sales.' },
            ].map((c, i) => (
              <div key={c.t} className="reveal rounded-3xl bg-white border border-line p-8 flex flex-col" style={{ transitionDelay: i * 70 + 'ms' }}>
                <h3 className="font-ui font-bold text-[17px] tracking-tight">{c.t}</h3>
                <p className="mt-3 text-[14.5px] leading-relaxed text-ink-soft flex-1">{c.body}</p>
                <p className="mt-4 font-serif text-[18px] text-ink" style={{ fontWeight: 500 }}>{c.em}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---- A note from the founder ---- */}
        <section className="mx-auto max-w-[760px] px-6 pb-24 lg:pb-32">
          <div className="reveal rounded-3xl bg-white border border-line p-8 lg:p-10">
            <div className="font-ui font-bold text-[13px] uppercase tracking-wider text-ink-soft/70 mb-4">A note from the founder</div>
            <div className="space-y-4 font-serif text-[18px] leading-[1.5] text-ink" style={{ fontWeight: 500 }}>
              <p>Hi — I'm Mauricio. I built SocialReviewCard because turning a great review into a great post shouldn't take 15 minutes in Canva.</p>
              <p>
                It's early days: no fake testimonials, no inflated numbers — just a tool I'm improving every week based on
                what real sellers tell me. If something feels off, tell me and I'll fix it. If you love it, a screenshot of
                your card on Instagram makes my day.
              </p>
            </div>
            <div className="mt-5 font-ui text-[14px] text-ink-soft">— Mauricio, indie maker</div>
          </div>
        </section>

        {/* ---- Pricing ---- */}
        <section id="pricing" className="mx-auto max-w-[1080px] px-6 py-24 lg:py-32">
          <div className="reveal text-center max-w-2xl mx-auto mb-10">
            <SectionLabel>Pricing</SectionLabel>
            <h2 className="font-serif leading-[1.03] tracking-[-0.02em] mt-4" style={{ fontSize: 'clamp(32px, 4.4vw, 52px)', fontWeight: 500 }}>Start free. Upgrade when your reviews deserve motion.</h2>
            <p className="mt-4 text-[16px] text-ink-soft">Every plan includes all 4 styles and backgrounds. Pro removes the badge and turns your cards into animated videos.</p>
          </div>

          {/* monthly / yearly toggle */}
          {annual && (
            <div className="reveal flex items-center justify-center gap-2 mb-10">
              <div className="inline-flex items-center rounded-full border border-line bg-white p-1">
                {([['Monthly', false], ['Yearly', true]] as [string, boolean][]).map(([l, v]) => (
                  <button
                    key={l}
                    onClick={() => setYearly(v)}
                    className={'px-4 h-9 rounded-full text-[13.5px] font-semibold transition ' + (yearly === v ? 'bg-ink text-cream' : 'text-ink-soft hover:text-ink')}
                  >
                    {l}
                  </button>
                ))}
              </div>
              {yearly && <span className="text-[12.5px] font-semibold text-emerald-600">2 months free</span>}
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-6 items-stretch">
            {/* Free */}
            <div className="reveal relative rounded-[28px] p-9 flex flex-col bg-white border border-line">
              <div className="font-bold text-[15px] tracking-tight text-ink-soft">Free</div>
              <div className="mt-3 flex items-end gap-2">
                <span className="font-serif leading-none" style={{ fontSize: 60, fontWeight: 500 }}>$0</span>
                <span className="text-[15px] mb-2 text-ink-soft">forever</span>
              </div>
              <ul className="mt-8 space-y-3.5 flex-1">
                {['10 image exports / month', 'All 4 card styles', '5 backgrounds + film grain', 'Stories (9:16) & Posts (1:1)', 'Discreet “Made with” badge'].map((f) => (
                  <li key={f} className="flex items-start gap-3">
                    <span className="grid place-items-center w-5 h-5 rounded-full mt-0.5 shrink-0 bg-emerald-50 text-emerald-600"><Check size={13} strokeWidth={3} /></span>
                    <span className="text-[15px] text-ink">{f}</span>
                  </li>
                ))}
              </ul>
              <a href={CTA} className="mt-9 inline-flex items-center justify-center gap-2 rounded-full h-[52px] text-[15.5px] font-semibold transition-all active:scale-[.98] bg-ink text-cream hover:gap-3">Start creating <ArrowRight size={17} strokeWidth={2.4} /></a>
            </div>
            {/* Pro */}
            <div className="reveal relative rounded-[28px] p-9 flex flex-col bg-ink text-cream shadow-[0_40px_80px_-30px_rgba(26,22,19,0.6)]">
              <span className="absolute top-7 right-7 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider" style={{ background: 'linear-gradient(120deg,#ffdca8,#ff9aa2,#c8a2e0)', color: '#1a1613' }}>Most popular</span>
              <div className="font-bold text-[15px] tracking-tight text-cream/70">Pro</div>
              <div className="mt-3 flex items-end gap-2">
                <span className="font-serif leading-none" style={{ fontSize: 60, fontWeight: 500 }}>{proPrice}</span>
              </div>
              <ul className="mt-8 space-y-3.5 flex-1">
                {proFeats.map((f) => (
                  <li key={f} className="flex items-start gap-3">
                    <span className="grid place-items-center w-5 h-5 rounded-full mt-0.5 shrink-0 bg-cream/15 text-cream"><Check size={13} strokeWidth={3} /></span>
                    <span className="text-[15px] text-cream/90">{f}</span>
                  </li>
                ))}
              </ul>
              <a href={proHref(activePro?.id)} className="mt-9 inline-flex items-center justify-center gap-2 rounded-full h-[52px] text-[15.5px] font-semibold transition-all active:scale-[.98] bg-cream text-ink hover:gap-3">Go Pro <ArrowRight size={17} strokeWidth={2.4} /></a>
              <p className="mt-3 text-center text-[12.5px] text-cream/55">Cancel anytime. No questions asked.</p>
            </div>
          </div>

          {/* Founder's Deal band */}
          {lifetime && (
            <div className="reveal mt-6 rounded-[28px] p-7 lg:p-8 flex flex-col md:flex-row md:items-center gap-5 justify-between" style={{ background: 'linear-gradient(120deg,#ffdca8,#ff9aa2,#c8a2e0)' }}>
              <div className="text-ink">
                <div className="font-ui font-bold text-[12px] uppercase tracking-wider mb-1">🚀 Founder's Deal</div>
                <div className="font-serif text-[24px] leading-tight" style={{ fontWeight: 500 }}>Lifetime Pro for {lifetime.priceLabel}, one time.</div>
                <div className="mt-1 text-[14px] text-ink/80">
                  Lock in every Pro feature — including everything we ship next — forever.
                  {founder && founder.limit != null && (
                    <span className="font-semibold"> {founder.claimed}/{founder.limit} claimed.</span>
                  )}
                </div>
              </div>
              {founder && !founder.available ? (
                <span className="shrink-0 inline-flex items-center justify-center rounded-full bg-ink/20 text-ink px-6 h-[52px] text-[15px] font-semibold">Sold out</span>
              ) : (
                <a href={proHref(lifetime.id)} className="shrink-0 inline-flex items-center justify-center gap-2 rounded-full bg-ink text-cream px-7 h-[52px] text-[15px] font-semibold hover:gap-3 transition-all active:scale-[.98]">
                  Claim lifetime access <ArrowRight size={17} strokeWidth={2.4} />
                </a>
              )}
            </div>
          )}
        </section>

        {/* ---- Final CTA ---- */}
        <section className="mx-auto max-w-[1200px] px-6 pb-24 lg:pb-32">
          <div className="reveal relative overflow-hidden rounded-[36px] px-8 py-20 lg:py-28 text-center" style={{ background: 'linear-gradient(135deg,#ffdca8 0%,#ff9aa2 45%,#c8a2e0 100%)' }}>
            <div className="absolute inset-0 pointer-events-none opacity-[0.18]" style={{ backgroundImage: NOISE, backgroundSize: '200px', mixBlendMode: 'multiply' }} />
            <div className="relative">
              <h2 className="font-serif text-ink leading-[1.0] tracking-[-0.02em] mx-auto max-w-3xl" style={{ fontSize: 'clamp(36px, 5.4vw, 68px)', fontWeight: 500 }}>Your best reviews deserve a better stage.</h2>
              <p className="mt-6 text-[18px] text-ink/75 max-w-md mx-auto">Make your first card free in under a minute. No sign-up wall, no design skills.</p>
              <a href={CTA} className="group mt-10 inline-flex items-center gap-2 rounded-full bg-ink text-cream px-9 h-[58px] text-[17px] font-semibold transition-all hover:gap-3.5 active:scale-[.98] shadow-[0_18px_40px_-14px_rgba(26,22,19,0.6)]">Create your first card <ArrowRight size={19} strokeWidth={2.4} /></a>
            </div>
          </div>
        </section>
      </main>

      {/* ---- Footer ---- */}
      <footer className="border-t border-line bg-white/40">
        <div className="mx-auto max-w-[1200px] px-6 py-16 grid md:grid-cols-[1.6fr_1fr_1fr] gap-10">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="grid place-items-center w-9 h-9 rounded-[11px] bg-ink text-cream"><Quote size={18} strokeWidth={2.2} /></span>
              <span className="font-bold text-[16px] tracking-tight">SocialReviewCard</span>
            </div>
            <p className="mt-4 text-[14px] text-ink-soft max-w-xs leading-relaxed">Beautiful, shareable review cards for indie sellers — built in seconds.</p>
          </div>
          {(
            [
              ['Product', [['How it works', '#how'], ['Styles', '#styles'], ['Features', '#features'], ['Pricing', '#pricing']]],
              ['Legal', [['Privacy', '/privacy'], ['Terms', '/terms']]],
            ] as [string, [string, string][]][]
          ).map(([h, links]) => (
            <div key={h}>
              <div className="font-semibold text-[13px] uppercase tracking-wider text-ink-soft/70 mb-4">{h}</div>
              <ul className="space-y-2.5">
                {links.map(([l, href]) => (
                  <li key={l}>
                    <a href={href} className="text-[14.5px] text-ink hover:text-ink-soft transition">
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-line"><div className="mx-auto max-w-[1200px] px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[13px] text-ink-soft">© {new Date().getFullYear()} SocialReviewCard. All rights reserved.</p>
          <p className="text-[13px] text-ink-soft">Made with care for small shops everywhere.</p>
        </div></div>
      </footer>
    </div>
  );
}
