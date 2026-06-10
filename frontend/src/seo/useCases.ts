import type { CardData } from '../types';

/* ------------------------------------------------------------------ */
/*  Programmatic-SEO use cases: {platform} review → {format}.          */
/*  Each page gets genuinely platform-specific copy — never the same   */
/*  paragraph with a swapped noun (doorway pages get penalized).       */
/* ------------------------------------------------------------------ */

export interface UseCaseFaq {
  q: string;
  a: string;
}

export interface UseCaseDef {
  slug: string;
  platformName: string;
  formatName: string; // "Instagram Story" | "Instagram post"
  formatDims: string; // real exported pixels
  title: string;
  description: string;
  h1: string;
  intro: string;
  pain: string;
  step1: string;
  demo: CardData & { bgId: string };
  faq: UseCaseFaq[];
}

interface PlatformCopy {
  id: string;
  name: string;
  cardLabel: string; // label printed on the demo card
  pain: string;
  step1: string;
  faq: UseCaseFaq;
  demoReview: string;
  demoName: string;
  bgId: string;
  cardStyle: CardData['cardStyle'];
  font: CardData['font'];
}

const PLATFORMS: PlatformCopy[] = [
  {
    id: 'google',
    name: 'Google',
    cardLabel: 'Google',
    pain: 'Your happiest customers leave five-star reviews on Google Maps — and then those reviews just sit there, visible only to people who already found you. Meanwhile your Instagram followers, the ones deciding whether to book or visit, never see them.',
    step1: 'Open your Google Business Profile (web or app), screenshot the review and paste it — AI reads the text, the customer’s name and the star rating for you.',
    faq: {
      q: 'How do I get a Google review into SocialReviewCard?',
      a: 'Screenshot it from Google Maps or your Google Business Profile and paste it into the editor — the AI import fills in the text, reviewer name and stars automatically. You can also type it in manually.',
    },
    demoReview: "Best haircut I've had in years. The team really listens and the salon feels so welcoming. I won't go anywhere else now!",
    demoName: 'Camila R.',
    bgId: 'sunset',
    cardStyle: 'minimal',
    font: 'serif',
  },
  {
    id: 'etsy',
    name: 'Etsy',
    cardLabel: 'Etsy',
    pain: 'Etsy reviews live at the bottom of your listing, where only the most determined shoppers scroll. Your Instagram audience — the people you are trying to turn into shop visitors — never sees the love your products already get.',
    step1: 'Screenshot the review from your Etsy shop (Seller app or web) and paste it — AI fills in the text, the buyer’s name and the stars.',
    faq: {
      q: 'Does it work with reviews from the Etsy app?',
      a: 'Yes. Screenshot the review in the Etsy Seller app or on the website, paste it into the editor, and the AI reads everything — no retyping.',
    },
    demoReview: 'The ceramic mug is even more beautiful in person. Carefully packaged, fast shipping, and you can feel the craftsmanship. Already eyeing my next order!',
    demoName: '@claye.and.co',
    bgId: 'aurora',
    cardStyle: 'glass',
    font: 'serif',
  },
  {
    id: 'amazon',
    name: 'Amazon',
    cardLabel: 'Amazon',
    pain: 'Amazon reviews build trust on Amazon — but you can’t take them with you. When you promote your products on social media, all that hard-earned social proof stays locked on the listing page.',
    step1: 'Screenshot the review from your product page, paste it, and AI extracts the text, reviewer name and star rating.',
    faq: {
      q: 'Is it okay to share my Amazon reviews on social media?',
      a: 'Sharing genuine reviews of your own products as social proof is common practice — just reproduce them accurately and check the seller guidelines that apply to your marketplace.',
    },
    demoReview: 'Exactly as described and the battery lasts for days. This is my second purchase from this brand and the quality is consistently great.',
    demoName: 'Daniel M.',
    bgId: 'oceanic',
    cardStyle: 'brutal',
    font: 'sans',
  },
  {
    id: 'shopify',
    name: 'Shopify',
    cardLabel: 'Shopify',
    pain: 'Your store collects reviews through apps like Judge.me, Loox or Okendo — but they’re trapped in a widget at the bottom of the product page. The shopper scrolling Instagram never sees them.',
    step1: 'Screenshot a review from your store (any review app works), paste it, and AI fills in the editor for you.',
    faq: {
      q: 'Which Shopify review apps does this work with?',
      a: 'All of them — Judge.me, Loox, Okendo, Yotpo, Stamped and the rest. If you can screenshot the review, the AI can read it.',
    },
    demoReview: 'Ordered on Monday, wearing it by Thursday. The fabric is so soft and the fit is exactly like the size guide promised. 10/10.',
    demoName: '@wearbloom',
    bgId: 'sunset',
    cardStyle: 'minimal',
    font: 'sans',
  },
  {
    id: 'trustpilot',
    name: 'Trustpilot',
    cardLabel: 'Trustpilot',
    pain: 'A strong Trustpilot profile convinces the people who go looking for it. But most of your audience isn’t on Trustpilot — they’re on Instagram, where your rating is invisible.',
    step1: 'Screenshot the review from your Trustpilot profile, paste it, and AI extracts the text, name and star rating.',
    faq: {
      q: 'Will the card show where the review came from?',
      a: 'Yes — the card carries a source label (Trustpilot, in this case) plus the star rating you set, so the review is always represented accurately.',
    },
    demoReview: 'Support replied within minutes and solved my issue on the first try. Rare to see a company this responsive. Highly recommend.',
    demoName: 'Sofia L.',
    bgId: 'obsidian',
    cardStyle: 'dark',
    font: 'serif',
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    cardLabel: 'WhatsApp',
    pain: 'Some of your best testimonials aren’t “reviews” at all — they’re WhatsApp messages from happy customers. Until now they lived and died inside your chat history, where no future customer could see them.',
    step1: 'Screenshot the message (hide anything private first), paste it, and AI turns the chat into clean review text with the customer’s name.',
    faq: {
      q: 'Can it really read a WhatsApp conversation?',
      a: 'Yes — the AI import was built for exactly this. It pulls the testimonial text and the sender’s name out of the chat screenshot; you adjust anything you like before exporting.',
    },
    demoReview: "Just received the cake — it's STUNNING! Everyone at the party is asking who made it. Thank you so much!",
    demoName: 'Juliana',
    bgId: 'aurora',
    cardStyle: 'glass',
    font: 'sans',
  },
];

interface FormatCopy {
  id: 'story' | 'square';
  name: string;
  slugPart: string;
  dims: string;
  benefit: string;
}

const FORMATS: FormatCopy[] = [
  {
    id: 'story',
    name: 'Instagram Story',
    slugPart: 'instagram-story',
    dims: '1080×1920',
    benefit: 'Stories are the easiest place to post social proof daily — full-screen, tappable, gone in 24h so you can never over-post.',
  },
  {
    id: 'square',
    name: 'Instagram post',
    slugPart: 'instagram-post',
    dims: '1200×1200',
    benefit: 'A square card sits beautifully in your feed and grid — perfect for a recurring “what customers say” slot or a testimonial carousel.',
  },
];

const GENERAL_FAQ: UseCaseFaq[] = [
  {
    q: 'Is SocialReviewCard free?',
    a: 'Yes — the free plan includes monthly image exports with a discreet badge, all card styles and backgrounds. Pro removes the badge and unlocks animated video exports.',
  },
  {
    q: 'Do I need design skills?',
    a: 'No. Pick one of four designer-made styles, choose a background, and the card composes itself. Every export looks like a brand made it.',
  },
];

function buildUseCase(p: PlatformCopy, f: FormatCopy): UseCaseDef {
  const slug = `${p.id}-review-to-${f.slugPart}`;
  return {
    slug,
    platformName: p.name,
    formatName: f.name,
    formatDims: f.dims,
    title: `Turn ${p.name} Reviews into ${f.name === 'Instagram Story' ? 'Instagram Stories' : 'Instagram Posts'} — Free Maker`,
    description: `Paste a screenshot of a ${p.name} review and AI turns it into a beautiful ${f.name} (${f.dims}) in seconds. Free to start, no design skills needed.`,
    h1: `Turn ${p.name} reviews into ${f.name === 'Instagram Story' ? 'Instagram Stories' : 'Instagram posts'}`,
    intro: `Screenshot a ${p.name} review, paste it, and export a scroll-stopping ${f.name} — AI reads the text, name and stars so you never retype a word.`,
    pain: p.pain,
    step1: p.step1,
    demo: {
      review: p.demoReview,
      name: p.demoName,
      platform: p.cardLabel,
      rating: 5,
      avatar: 'initials',
      cardStyle: p.cardStyle,
      font: p.font,
      ratio: f.id,
      bgId: p.bgId,
    },
    faq: [
      p.faq,
      {
        q: `What size is the exported ${f.name}?`,
        a: `${f.dims} pixels — ${f.id === 'story' ? 'exactly Instagram’s native Story resolution, so it’s always crisp' : 'high-resolution and feed-ready'}. ${f.benefit}`,
      },
      ...GENERAL_FAQ,
    ],
  };
}

export const USE_CASES: UseCaseDef[] = PLATFORMS.flatMap((p) => FORMATS.map((f) => buildUseCase(p, f)));

/** Looks up a use case from a URL path like "/google-review-to-instagram-story". */
export function findUseCase(path: string): UseCaseDef | undefined {
  const slug = path.replace(/^\/+|\/+$/g, '');
  return USE_CASES.find((u) => u.slug === slug);
}
