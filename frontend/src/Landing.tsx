import {
  ArrowRight,
  Check,
  Download,
  Image as ImageIcon,
  Quote,
  Share2,
  Sparkles,
  Star,
} from 'lucide-react';

/**
 * Static marketing landing at "/" — keyword-rich content for SEO and conversion.
 * The interactive editor lives at /app. Plain anchors trigger a normal navigation
 * (nginx serves index.html → main.tsx mounts the right view).
 */
export default function Landing() {
  return (
    <div className="min-h-screen bg-white text-zinc-900 font-ui">
      {/* ---------- Nav ---------- */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-zinc-100">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5">
            <span className="grid place-items-center w-9 h-9 rounded-xl bg-zinc-900 text-white">
              <Quote size={18} strokeWidth={2.2} />
            </span>
            <span className="font-bold text-[16px] tracking-tight">SocialReviewCard</span>
          </a>
          <a
            href="/app"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-accent text-white text-[13px] font-semibold hover:bg-accent-hover transition"
          >
            Open the studio <ArrowRight size={15} />
          </a>
        </div>
      </header>

      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 -z-10 opacity-60"
          style={{ background: 'radial-gradient(60% 50% at 50% 0%, #efedff 0%, transparent 70%)' }}
        />
        <div className="max-w-3xl mx-auto px-5 pt-20 pb-16 text-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent-soft text-accent text-[12.5px] font-semibold mb-5">
            <Sparkles size={13} /> Turn reviews into shareable art
          </span>
          <h1 className="text-[40px] sm:text-[52px] font-extrabold tracking-tight leading-[1.05]">
            Turn customer reviews into scroll-stopping images
          </h1>
          <p className="mt-5 text-[17px] text-zinc-600 max-w-2xl mx-auto leading-relaxed">
            SocialReviewCard turns your best customer reviews and testimonials into beautiful,
            branded images for Instagram Stories, Etsy, Shopify and more — in seconds, with no design
            skills.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <a
              href="/app"
              className="inline-flex items-center gap-2 px-6 h-12 rounded-xl bg-zinc-900 text-white text-[15px] font-semibold hover:bg-zinc-800 transition shadow-[0_10px_24px_-10px_rgba(0,0,0,0.5)]"
            >
              Create your first card <ArrowRight size={17} />
            </a>
            <span className="text-[13px] text-zinc-400">Free to start · no credit card</span>
          </div>
        </div>
      </section>

      {/* ---------- Platforms strip ---------- */}
      <section className="border-y border-zinc-100 bg-zinc-50/60">
        <div className="max-w-5xl mx-auto px-5 py-7 text-center">
          <p className="text-[12.5px] font-semibold uppercase tracking-wider text-zinc-400 mb-3">
            Perfect for sellers on
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-[15px] font-semibold text-zinc-500">
            <span>Etsy</span>
            <span>Shopify</span>
            <span>Instagram</span>
            <span>Amazon</span>
            <span>Google Reviews</span>
            <span>TikTok Shop</span>
          </div>
        </div>
      </section>

      {/* ---------- Features ---------- */}
      <section className="max-w-6xl mx-auto px-5 py-20">
        <h2 className="text-[30px] font-bold tracking-tight text-center">
          Everything you need to share social proof
        </h2>
        <p className="text-center text-zinc-500 mt-3 max-w-2xl mx-auto">
          Build trust and attract more customers by turning real reviews into content your audience
          actually stops to read.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-12">
          {[
            { Icon: ImageIcon, title: 'Beautiful templates', desc: 'Glass, minimal, dark and bold styles with curated gradients — designer-grade out of the box.' },
            { Icon: Share2, title: 'Share in seconds', desc: 'Post straight to Instagram Stories, WhatsApp and more from your phone with one tap.' },
            { Icon: Download, title: 'High-resolution export', desc: 'Download crisp 2× PNGs sized perfectly for Stories (9:16) and feed posts (1:1).' },
            { Icon: Star, title: 'No design skills', desc: 'Paste a review, pick a style, done. No Photoshop, no templates to wrangle.' },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border border-zinc-200 p-6">
              <span className="grid place-items-center w-11 h-11 rounded-xl bg-accent-soft text-accent mb-4">
                <f.Icon size={20} strokeWidth={2.1} />
              </span>
              <h3 className="font-bold text-[15.5px]">{f.title}</h3>
              <p className="text-[13.5px] text-zinc-500 mt-1.5 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- How it works ---------- */}
      <section className="bg-zinc-50/60 border-y border-zinc-100">
        <div className="max-w-5xl mx-auto px-5 py-20">
          <h2 className="text-[30px] font-bold tracking-tight text-center">How it works</h2>
          <div className="grid sm:grid-cols-3 gap-8 mt-12">
            {[
              { n: '1', title: 'Paste your review', desc: 'Drop in a customer review or testimonial, the reviewer’s name and the source platform.' },
              { n: '2', title: 'Pick a style', desc: 'Choose a template, background and aspect ratio. Watch the live preview update instantly.' },
              { n: '3', title: 'Export & share', desc: 'Download the image or share it straight to your social network and start attracting customers.' },
            ].map((s) => (
              <div key={s.n} className="text-center">
                <span className="grid place-items-center w-11 h-11 rounded-full bg-zinc-900 text-white font-bold mx-auto mb-4">
                  {s.n}
                </span>
                <h3 className="font-bold text-[16px]">{s.title}</h3>
                <p className="text-[13.5px] text-zinc-500 mt-1.5 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- FAQ ---------- */}
      <section className="max-w-3xl mx-auto px-5 py-20">
        <h2 className="text-[30px] font-bold tracking-tight text-center mb-10">
          Frequently asked questions
        </h2>
        <div className="space-y-3">
          {FAQ.map((f) => (
            <details key={f.q} className="group rounded-xl border border-zinc-200 p-5 open:bg-zinc-50/60">
              <summary className="flex items-center justify-between cursor-pointer list-none font-semibold text-[15px]">
                {f.q}
                <span className="text-accent transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-[14px] text-zinc-600 leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ---------- Final CTA ---------- */}
      <section className="max-w-5xl mx-auto px-5 pb-24">
        <div className="rounded-3xl bg-zinc-900 text-white text-center px-6 py-16">
          <h2 className="text-[30px] font-bold tracking-tight">Make your reviews work for you</h2>
          <p className="text-zinc-300 mt-3 max-w-xl mx-auto">
            Create your first shareable review card free — it takes less than a minute.
          </p>
          <a
            href="/app"
            className="inline-flex items-center gap-2 mt-8 px-6 h-12 rounded-xl bg-accent text-white text-[15px] font-semibold hover:bg-accent-hover transition"
          >
            Open the studio <ArrowRight size={17} />
          </a>
        </div>
      </section>

      {/* ---------- Footer ---------- */}
      <footer className="border-t border-zinc-100">
        <div className="max-w-6xl mx-auto px-5 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-[13px] text-zinc-400">
          <div className="flex items-center gap-2">
            <Check size={14} className="text-accent" /> SocialReviewCard.com
          </div>
          <div>© {new Date().getFullYear()} SocialReviewCard · Turn reviews into shareable art</div>
        </div>
      </footer>
    </div>
  );
}

const FAQ = [
  {
    q: 'What is SocialReviewCard?',
    a: 'SocialReviewCard is a free online tool that turns customer reviews and testimonials into beautiful, shareable images for social media, your store and marketing.',
  },
  {
    q: 'Which platforms is it for?',
    a: 'It works great for Etsy, Shopify, Amazon, Instagram, Google Reviews, TikTok Shop and any business that wants to showcase customer feedback as eye-catching graphics.',
  },
  {
    q: 'Do I need design skills?',
    a: 'No. Paste your review, pick a template and background, and export. The live preview shows exactly what you’ll get.',
  },
  {
    q: 'Is it free?',
    a: 'Yes — you can create and export images for free. A Pro plan removes the watermark and unlocks unlimited high-resolution exports.',
  },
  {
    q: 'What sizes can I export?',
    a: 'High-resolution PNGs sized for Instagram Stories (9:16) and feed posts (1:1), ready to post anywhere.',
  },
];
