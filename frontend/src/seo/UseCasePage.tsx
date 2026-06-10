import { ArrowRight, Check, Download, Quote, ScanText, Wand2 } from 'lucide-react';
import { CardCanvas } from '../components/Preview';
import { BACKGROUNDS, DEFAULT_PLATFORMS, RATIOS, resolvePlatform } from '../lib/config';
import { USE_CASES, type UseCaseDef } from './useCases';

const CTA = '/app';

/** Scaled live card render — same approach as the landing's DemoCard. */
function Demo({ def }: { def: UseCaseDef }) {
  const { bgId, ...card } = def.demo;
  const bg = BACKGROUNDS.find((b) => b.id === bgId) ?? BACKGROUNDS[0];
  const plat = resolvePlatform(card.platform, DEFAULT_PLATFORMS);
  const r = RATIOS[card.ratio];
  const scale = card.ratio === 'story' ? 0.56 : 0.52;
  return (
    <div style={{ width: r.w * scale, height: r.h * scale }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        <CardCanvas data={card} bg={bg} grain platform={plat} watermark={null} />
      </div>
    </div>
  );
}

/**
 * One programmatic-SEO landing: "{Platform} review → {format}". Prerendered to
 * static HTML at build time (see prerender.mjs) so crawlers get full content.
 */
export function UseCasePage({ def }: { def: UseCaseDef }) {
  const steps = [
    { Icon: ScanText, title: 'Drop in a screenshot', body: def.step1 },
    { Icon: Wand2, title: 'Style it your way', body: 'Four designer card styles, five backgrounds, serif or sans — the preview updates live as you tweak.' },
    { Icon: Download, title: `Export your ${def.formatName}`, body: `Download a crisp ${def.formatDims} PNG ready to post — or turn it into an animated video with Pro.` },
  ];
  const others = USE_CASES.filter((u) => u.slug !== def.slug);

  return (
    <div className="bg-cream text-ink font-jakarta min-h-screen">
      {/* FAQ rich-result schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: def.faq.map((f) => ({
              '@type': 'Question',
              name: f.q,
              acceptedAnswer: { '@type': 'Answer', text: f.a },
            })),
          }),
        }}
      />

      {/* nav */}
      <header className="border-b border-line bg-cream/85 backdrop-blur-xl">
        <div className="mx-auto max-w-[1080px] px-6 h-[64px] flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5">
            <span className="grid place-items-center w-8 h-8 rounded-[10px] bg-ink text-cream"><Quote size={16} strokeWidth={2.2} /></span>
            <span className="font-bold text-[15.5px] tracking-tight">SocialReviewCard</span>
          </a>
          <a href={CTA} className="inline-flex items-center gap-1.5 rounded-full bg-ink text-cream px-4 h-9 text-[13.5px] font-semibold transition-all hover:gap-2.5 active:scale-[.98]">
            Start free <ArrowRight size={15} strokeWidth={2.4} />
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-[1080px] px-6">
        {/* hero */}
        <section className="grid lg:grid-cols-[1.1fr_0.9fr] gap-10 items-center pt-14 pb-16 lg:pt-20 lg:pb-20">
          <div>
            <h1 className="font-serif leading-[1.02] tracking-[-0.02em]" style={{ fontSize: 'clamp(34px, 4.8vw, 56px)', fontWeight: 500 }}>
              {def.h1}
            </h1>
            <p className="mt-5 text-[17px] leading-relaxed text-ink-soft max-w-[480px]">{def.intro}</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href={CTA} className="group inline-flex items-center gap-2 rounded-full bg-ink text-cream px-6 h-[50px] text-[15px] font-semibold transition-all hover:gap-3 active:scale-[.98]">
                Make your first card <ArrowRight size={17} strokeWidth={2.4} />
              </a>
            </div>
            <div className="mt-6 flex items-center gap-5 text-[13px] text-ink-soft">
              <span className="inline-flex items-center gap-1.5"><Check size={15} strokeWidth={2.6} className="text-emerald-600" /> Free to start</span>
              <span className="inline-flex items-center gap-1.5"><Check size={15} strokeWidth={2.6} className="text-emerald-600" /> No retyping — AI reads the screenshot</span>
            </div>
          </div>
          <div className="justify-self-center lg:justify-self-end">
            <Demo def={def} />
          </div>
        </section>

        {/* why */}
        <section className="pb-14 lg:pb-16 max-w-[720px]">
          <h2 className="font-serif tracking-[-0.02em]" style={{ fontSize: 'clamp(24px, 3vw, 34px)', fontWeight: 500 }}>
            Your {def.platformName} reviews deserve a bigger audience
          </h2>
          <p className="mt-4 text-[16px] leading-relaxed text-ink-soft">{def.pain}</p>
          <p className="mt-3 text-[16px] leading-relaxed text-ink-soft">
            SocialReviewCard turns each review into a designed, on-brand {def.formatName} in under 30 seconds — so posting social proof becomes a habit instead of a chore.
          </p>
        </section>

        {/* steps */}
        <section className="pb-16 lg:pb-20">
          <div className="grid md:grid-cols-3 gap-5">
            {steps.map((s, i) => (
              <div key={s.title} className="rounded-3xl bg-white border border-line p-7">
                <div className="flex items-center justify-between mb-5">
                  <span className="grid place-items-center w-11 h-11 rounded-2xl bg-ink text-cream"><s.Icon size={20} strokeWidth={2} /></span>
                  <span className="font-serif text-[34px] text-ink/12 leading-none" style={{ fontWeight: 600 }}>0{i + 1}</span>
                </div>
                <h3 className="font-bold text-[17px] tracking-tight">{s.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="pb-16 lg:pb-20 max-w-[720px]">
          <h2 className="font-serif tracking-[-0.02em] mb-7" style={{ fontSize: 'clamp(24px, 3vw, 34px)', fontWeight: 500 }}>
            Frequently asked questions
          </h2>
          <div className="space-y-5">
            {def.faq.map((f) => (
              <div key={f.q} className="rounded-2xl bg-white border border-line p-6">
                <h3 className="font-bold text-[15.5px] tracking-tight">{f.q}</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-ink-soft">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA band */}
        <section className="pb-16 lg:pb-20">
          <div className="rounded-[28px] px-8 py-14 text-center" style={{ background: 'linear-gradient(135deg,#ffdca8 0%,#ff9aa2 45%,#c8a2e0 100%)' }}>
            <h2 className="font-serif text-ink tracking-[-0.02em] mx-auto max-w-2xl" style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 500 }}>
              Post your first {def.platformName} review today.
            </h2>
            <a href={CTA} className="group mt-8 inline-flex items-center gap-2 rounded-full bg-ink text-cream px-8 h-[52px] text-[15.5px] font-semibold transition-all hover:gap-3 active:scale-[.98]">
              Create your first card <ArrowRight size={17} strokeWidth={2.4} />
            </a>
          </div>
        </section>
      </main>

      {/* footer with cross-links (internal linking between use cases) */}
      <footer className="border-t border-line bg-white/40">
        <div className="mx-auto max-w-[1080px] px-6 py-12">
          <div className="font-semibold text-[12px] uppercase tracking-wider text-ink-soft/70 mb-4">More ways to use SocialReviewCard</div>
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2 mb-10">
            {others.map((u) => (
              <li key={u.slug}>
                <a href={`/${u.slug}`} className="text-[13.5px] text-ink hover:text-ink-soft transition">{u.h1}</a>
              </li>
            ))}
          </ul>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-line pt-6">
            <a href="/" className="text-[13px] text-ink-soft hover:text-ink transition">← SocialReviewCard home</a>
            <p className="text-[13px] text-ink-soft">© {new Date().getFullYear()} SocialReviewCard</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
