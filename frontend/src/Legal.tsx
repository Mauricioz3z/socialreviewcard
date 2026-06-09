import { ArrowLeft, Quote } from 'lucide-react';

/** Simple static Privacy Policy / Terms pages (routed by path in main.tsx). */
export default function Legal({ kind }: { kind: 'privacy' | 'terms' }) {
  const updated = 'June 2026';
  return (
    <div className="bg-cream text-ink font-jakarta min-h-screen">
      <header className="border-b border-line">
        <div className="mx-auto max-w-[760px] px-6 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5">
            <span className="grid place-items-center w-9 h-9 rounded-[11px] bg-ink text-cream">
              <Quote size={18} strokeWidth={2.2} />
            </span>
            <span className="font-bold text-[16px] tracking-tight">SocialReviewCard</span>
          </a>
          <a href="/" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-soft hover:text-ink transition">
            <ArrowLeft size={15} /> Home
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-[760px] px-6 py-14">
        <h1 className="font-serif tracking-[-0.02em]" style={{ fontSize: 'clamp(32px,5vw,46px)', fontWeight: 500 }}>
          {kind === 'privacy' ? 'Privacy Policy' : 'Terms of Service'}
        </h1>
        <p className="mt-2 text-[13.5px] text-ink-soft">Last updated: {updated}</p>

        <div className="mt-8 space-y-7 text-[15px] leading-relaxed text-ink/90">
          {kind === 'privacy' ? <Privacy /> : <Terms />}
        </div>

        <p className="mt-12 text-[14px] text-ink-soft">
          Questions? Use the in-app feedback button or reach out and we'll get back to you.
        </p>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-ui font-bold text-[18px] tracking-tight mb-2">{title}</h2>
      <div className="space-y-3 text-ink-soft">{children}</div>
    </section>
  );
}

function Privacy() {
  return (
    <>
      <p className="text-ink-soft">
        This policy explains what SocialReviewCard collects and how it's used. We keep it minimal on purpose.
      </p>
      <Section title="What we collect">
        <p>
          <strong>Account:</strong> when you sign in with Google we store your email address to identify your account and
          your saved cards. We never see your Google password.
        </p>
        <p>
          <strong>Your cards:</strong> the review text, names and styling you save are stored so you can edit them later.
        </p>
        <p>
          <strong>Billing:</strong> payments are processed by Stripe. We don't store your card details — Stripe does.
        </p>
        <p>
          <strong>Usage:</strong> we keep a simple count of exports to enforce free-plan limits.
        </p>
      </Section>
      <Section title="Third-party services">
        <p>We rely on Google (sign-in) and Stripe (payments). The site may load analytics scripts configured by the operator.</p>
      </Section>
      <Section title="Images you create">
        <p>Images are rendered in your browser and downloaded to your device. We don't upload or keep copies of exported images.</p>
      </Section>
      <Section title="Your choices">
        <p>You can delete your saved cards at any time, and you can request deletion of your account by contacting us.</p>
      </Section>
    </>
  );
}

function Terms() {
  return (
    <>
      <p className="text-ink-soft">By using SocialReviewCard you agree to these terms.</p>
      <Section title="Using the service">
        <p>You may use SocialReviewCard to create and share images from reviews you have the right to use. Don't use it for unlawful, misleading or infringing content.</p>
      </Section>
      <Section title="Your content">
        <p>You keep ownership of the content you create. You're responsible for having the rights to the reviews and names you publish.</p>
      </Section>
      <Section title="Plans & billing">
        <p>
          The free plan includes a monthly export allowance. Pro is a paid subscription billed via Stripe; you can cancel
          anytime and keep access until the end of the period.
        </p>
      </Section>
      <Section title="Availability">
        <p>The service is provided “as is”, without warranties. We may change or discontinue features as the product evolves.</p>
      </Section>
      <Section title="Liability">
        <p>To the extent permitted by law, SocialReviewCard is not liable for indirect or incidental damages arising from use of the service.</p>
      </Section>
    </>
  );
}
