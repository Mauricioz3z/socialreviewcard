import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export function Section({
  Icon,
  title,
  children,
}: {
  Icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="px-5 py-5 border-b border-zinc-100">
      <div className="flex items-center gap-2 mb-4">
        <Icon size={15} className="text-accent" strokeWidth={2.2} />
        <h3 className="text-[11px] font-semibold tracking-[0.13em] uppercase text-zinc-400 font-ui">
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-4 last:mb-0">
      <label className="block text-[12.5px] font-medium text-zinc-600 mb-1.5 font-ui">{label}</label>
      {children}
    </div>
  );
}

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  Icon?: LucideIcon;
  hint?: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1 p-1 bg-zinc-100 rounded-xl">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={
              'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-medium font-ui transition-all ' +
              (active
                ? 'bg-white text-zinc-900 shadow-sm ring-1 ring-black/5'
                : 'text-zinc-500 hover:text-zinc-800')
            }
          >
            {o.Icon && <o.Icon size={15} strokeWidth={2.1} />}
            {o.label}
            {o.hint && <span className="text-[10px] text-zinc-400">{o.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Mini swatch preview for the card-style picker. */
export function StyleSwatch({ id }: { id: string }) {
  const base = 'h-12 rounded-lg w-full flex items-center px-2 gap-1.5 overflow-hidden';
  if (id === 'glass')
    return (
      <div className={base} style={{ background: 'linear-gradient(135deg,#ff9aa2,#c8a2e0)' }}>
        <div className="w-full h-7 rounded-md bg-white/25 backdrop-blur border border-white/40" />
      </div>
    );
  if (id === 'minimal')
    return (
      <div className={base} style={{ background: '#e9e7e1' }}>
        <div className="w-full h-7 rounded-md bg-white border border-zinc-200 shadow-sm" />
      </div>
    );
  if (id === 'dark')
    return (
      <div className={base} style={{ background: '#1c4b52' }}>
        <div className="w-full h-7 rounded-md bg-zinc-900 border border-white/10" />
      </div>
    );
  return (
    <div className={base} style={{ background: '#13f1a8' }}>
      <div
        className="w-full h-7 rounded-[3px] bg-[#fdfcf7] border-2 border-black"
        style={{ boxShadow: '2.5px 2.5px 0 #000' }}
      />
    </div>
  );
}

/** Toggle switch with label + description. */
export function Toggle({
  label,
  desc,
  checked,
  onChange,
  Icon,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  Icon: LucideIcon;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="w-full flex items-center gap-3 p-3 rounded-xl border border-zinc-200 bg-white hover:border-zinc-300 transition text-left"
    >
      <span
        className={
          'grid place-items-center w-8 h-8 rounded-lg shrink-0 ' +
          (checked ? 'bg-accent-soft text-accent' : 'bg-zinc-100 text-zinc-400')
        }
      >
        <Icon size={16} strokeWidth={2.1} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[13px] font-medium text-zinc-800 leading-none">{label}</span>
        <span className="block text-[11.5px] text-zinc-400 mt-1 leading-none">{desc}</span>
      </span>
      <span
        className={
          'relative w-10 h-6 rounded-full transition-colors shrink-0 ' +
          (checked ? 'bg-accent' : 'bg-zinc-200')
        }
      >
        <span
          className={
            'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ' +
            (checked ? 'left-[18px]' : 'left-0.5')
          }
        />
      </span>
    </button>
  );
}
