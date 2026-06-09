import { BadgeCheck, Star, User } from 'lucide-react';
import { PlatformIcon } from '../lib/platformIcon';
import type { CardData, CardStyleId, PlatformDisplay } from '../types';

interface StyleTheme {
  card: string;
  text: string;
  sub: string;
  star: string;
  starEmpty: string;
  pill: string;
  avatar: string;
  quoteMark: string;
  divider: string;
}

const THEMES: Record<CardStyleId, StyleTheme> = {
  glass: {
    card: 'backdrop-blur-2xl bg-white/15 border border-white/35 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.4)] rounded-[28px]',
    text: '#ffffff',
    sub: 'rgba(255,255,255,0.72)',
    star: '#ffd66e',
    starEmpty: 'rgba(255,255,255,0.35)',
    pill: 'bg-white/20 border border-white/30 text-white',
    avatar: 'bg-white/25 text-white border border-white/40',
    quoteMark: 'rgba(255,255,255,0.35)',
    divider: 'rgba(255,255,255,0.22)',
  },
  minimal: {
    card: 'bg-white border border-zinc-200/80 shadow-[0_24px_70px_-24px_rgba(0,0,0,0.28)] rounded-[26px]',
    text: '#18181b',
    sub: '#71717a',
    star: '#f5a623',
    starEmpty: '#e4e4e7',
    pill: 'bg-zinc-100 text-zinc-700',
    avatar: 'bg-zinc-900 text-white',
    quoteMark: '#e4e4e7',
    divider: '#f1f1f3',
  },
  dark: {
    card: 'bg-zinc-900/92 backdrop-blur-md border border-white/10 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] rounded-[26px]',
    text: '#f4f4f5',
    sub: '#a1a1aa',
    star: '#fbbf24',
    starEmpty: '#3f3f46',
    pill: 'bg-white/8 border border-white/12 text-zinc-200',
    avatar: 'bg-accent text-white',
    quoteMark: 'rgba(255,255,255,0.14)',
    divider: 'rgba(255,255,255,0.10)',
  },
  brutal: {
    card: 'bg-[#fdfcf7] border-[3px] border-black rounded-[6px]',
    text: '#0a0a0a',
    sub: '#3f3f46',
    star: '#111111',
    starEmpty: '#d4d4d8',
    pill: 'bg-[#ffe14d] border-2 border-black text-black',
    avatar: 'bg-black text-[#ffe14d] border-2 border-black',
    quoteMark: '#0a0a0a',
    divider: '#0a0a0a',
  },
};

/** When set, renders only part of the card (for layered video animation). Other
 *  parts keep their space via visibility:hidden so all layers stay pixel-aligned. */
export type CardLayer = 'full' | 'base' | 'stars' | 'text';

export function ReviewCard({
  data,
  platform: plat,
  layer = 'full',
}: {
  data: CardData;
  platform: PlatformDisplay;
  layer?: CardLayer;
}) {
  const { review, name, rating, avatar, cardStyle, font, ratio } = data;
  const compact = ratio === 'square';
  const fontFamily = font === 'serif' ? 'Newsreader, serif' : '"Plus Jakarta Sans", sans-serif';

  const showRest = layer === 'full' || layer === 'base';
  const showStars = layer === 'full' || layer === 'stars';
  const showText = layer === 'full' || layer === 'text';
  const transparent = layer === 'stars' || layer === 'text';
  const hide = (visible: boolean) => (visible ? {} : { visibility: 'hidden' as const });

  const initials =
    (name || '')
      .replace(/[@_.]/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'U';

  const S = THEMES[cardStyle];

  const brutalShadow = cardStyle === 'brutal' ? { boxShadow: '9px 9px 0 0 #0a0a0a' } : {};
  const pad = compact ? 'p-9' : 'px-9 py-11';
  const quoteSize = compact
    ? review.length > 150
      ? 25
      : 29
    : review.length > 150
      ? 26
      : 31;

  return (
    <div
      className={'relative flex flex-col ' + (transparent ? '' : S.card) + ' ' + pad}
      style={{ width: '100%', height: '100%', fontFamily, ...(transparent ? {} : brutalShadow) }}
    >
      {/* Header: platform pill */}
      <div className="flex items-center justify-between" style={hide(showRest)}>
        <div
          className={
            'inline-flex items-center gap-2 rounded-full pl-2 pr-3.5 py-1.5 text-[13px] font-semibold ' +
            S.pill
          }
          style={cardStyle === 'brutal' ? { fontFamily: '"Plus Jakarta Sans", sans-serif' } : {}}
        >
          <span
            className="grid place-items-center rounded-full w-6 h-6"
            style={{ background: cardStyle === 'brutal' ? '#000' : plat.color, color: '#fff' }}
          >
            <PlatformIcon token={plat.icon} size={12} color="#fff" />
          </span>
          {plat.label}
        </div>
        {cardStyle !== 'brutal' && (
          <div
            className="inline-flex items-center gap-1 text-[11.5px] font-medium"
            style={{ color: S.sub }}
          >
            <BadgeCheck size={15} strokeWidth={2} style={{ color: S.star }} />
            Verified
          </div>
        )}
      </div>

      {/* Middle: stars + quote */}
      <div className="flex-1 flex flex-col justify-center py-6">
        <div className="flex items-center gap-1 mb-5" style={hide(showStars)}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Star
              key={i}
              size={compact ? 24 : 27}
              strokeWidth={cardStyle === 'brutal' ? 2.4 : 1.5}
              style={{ color: i <= rating ? S.star : S.starEmpty }}
              fill={i <= rating ? S.star : 'none'}
            />
          ))}
        </div>

        <div className="relative" style={hide(showText)}>
          {font === 'serif' && (
            <span
              className="reel-word absolute -top-6 -left-1 leading-none select-none"
              style={{ fontFamily: 'Newsreader, serif', fontSize: 72, color: S.quoteMark }}
            >
              &ldquo;
            </span>
          )}
          <p
            style={{
              color: S.text,
              fontSize: quoteSize,
              lineHeight: 1.4,
              fontWeight: font === 'serif' ? 500 : 600,
              letterSpacing: font === 'serif' ? '0' : '-0.01em',
            }}
          >
            {layer === 'text'
              ? (font === 'serif' ? review : '“' + review + '”')
                  .split(/(\s+)/)
                  .map((tok, i) => (/^\s+$/.test(tok) ? tok : <span key={i} className="reel-word">{tok}</span>))
              : font === 'serif'
                ? review
                : '“' + review + '”'}
          </p>
        </div>
      </div>

      {/* Footer: avatar + name */}
      <div
        className="flex items-center gap-3 pt-5"
        style={{
          borderTop:
            cardStyle === 'brutal' ? '3px solid ' + S.divider : '1px solid ' + S.divider,
          ...hide(showRest),
        }}
      >
        <div
          className={'grid place-items-center rounded-full font-bold overflow-hidden ' + S.avatar}
          style={{ width: 46, height: 46, fontSize: 16, fontFamily: '"Plus Jakarta Sans", sans-serif' }}
        >
          {avatar === 'initials' ? initials : <User size={22} strokeWidth={2} />}
        </div>
        <div className="min-w-0">
          <div
            className="font-bold truncate"
            style={{
              color: S.text,
              fontSize: 16.5,
              fontFamily: '"Plus Jakarta Sans", sans-serif',
              letterSpacing: '-0.01em',
            }}
          >
            {name || 'Customer'}
          </div>
          <div
            className="truncate"
            style={{ color: S.sub, fontSize: 13, fontFamily: '"Plus Jakarta Sans", sans-serif' }}
          >
            Verified customer · {plat.label}
          </div>
        </div>
      </div>
    </div>
  );
}
