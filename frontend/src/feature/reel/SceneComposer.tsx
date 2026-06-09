import { useEffect, useRef, useState } from 'react';
import { Loader2, RotateCcw, Trash2, X } from 'lucide-react';
import { getAssets } from '../../lib/api';
import { SCENE_PALETTES, defaultScene, type SceneAsset, type UserScene } from './userScene';

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const gradientCss = (colors: string[]) =>
  `linear-gradient(135deg, ${(colors.length ? colors : ['#f4ebe1']).join(', ')})`;

export function SceneComposer({
  cardImageUrl,
  initial,
  onSave,
  onClose,
}: {
  cardImageUrl: string;
  initial: UserScene | null;
  onSave: (s: UserScene) => void;
  onClose: () => void;
}) {
  const [scene, setScene] = useState<UserScene>(initial ?? defaultScene());
  const [selected, setSelected] = useState<number | null>(null);
  const [gallery, setGallery] = useState<{ name: string; url: string }[] | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getAssets().then(setGallery).catch(() => setGallery([]));
  }, []);

  const patchAsset = (idx: number, patch: Partial<SceneAsset>) =>
    setScene((p) => ({ ...p, assets: p.assets.map((a, i) => (i === idx ? { ...a, ...patch } : a)) }));

  const addAsset = (url: string) => {
    setScene((p) => ({ ...p, assets: [...p.assets, { url, xPct: 0.36, yPct: 0.36, widthPct: 0.26, anim: 'sway' }] }));
    setSelected(scene.assets.length);
  };

  const removeAsset = (idx: number) => {
    setScene((p) => ({ ...p, assets: p.assets.filter((_, i) => i !== idx) }));
    setSelected(null);
  };

  // Pointer drag / resize — closures share state so listeners stay consistent.
  const startDrag = (e: React.PointerEvent, idx: number, mode: 'move' | 'resize') => {
    e.preventDefault();
    e.stopPropagation();
    setSelected(idx);
    const stage = stageRef.current;
    if (!stage) return;
    const r = stage.getBoundingClientRect();
    const a = scene.assets[idx];
    const s = { x: e.clientX, y: e.clientY, ox: a.xPct, oy: a.yPct, ow: a.widthPct };
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - s.x) / r.width;
      const dy = (ev.clientY - s.y) / r.height;
      if (mode === 'move') patchAsset(idx, { xPct: clamp(s.ox + dx, 0, 1), yPct: clamp(s.oy + dy, 0, 1) });
      else patchAsset(idx, { widthPct: clamp(s.ow + dx, 0.05, 1) });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const sel = selected != null ? scene.assets[selected] : null;

  return (
    <div className="fixed inset-0 z-[70] flex bg-zinc-950/95 backdrop-blur-sm font-ui">
      {/* stage */}
      <div className="flex-1 grid place-items-center p-6 overflow-hidden">
        <div
          ref={stageRef}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) setSelected(null);
          }}
          className="relative h-full max-h-[88vh] rounded-2xl overflow-hidden shadow-2xl"
          style={{ aspectRatio: '9 / 16', background: gradientCss(scene.palette), touchAction: 'none' }}
        >
          <img
            src={cardImageUrl}
            alt="card"
            draggable={false}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{ width: '78%', filter: 'drop-shadow(0 20px 50px rgba(0,0,0,0.45))' }}
          />
          {scene.assets.map((a, idx) => (
            <div
              key={idx}
              onPointerDown={(e) => startDrag(e, idx, 'move')}
              className="absolute"
              style={{
                left: `${a.xPct * 100}%`,
                top: `${a.yPct * 100}%`,
                width: `${a.widthPct * 100}%`,
                cursor: 'move',
                touchAction: 'none',
                outline: selected === idx ? '2px solid #6d5efc' : 'none',
                outlineOffset: 2,
              }}
            >
              <img src={a.url} draggable={false} className="w-full block pointer-events-none select-none" alt="" />
              {selected === idx && (
                <div
                  onPointerDown={(e) => startDrag(e, idx, 'resize')}
                  className="absolute -right-1.5 -bottom-1.5 w-3.5 h-3.5 rounded-sm bg-accent"
                  style={{ cursor: 'nwse-resize' }}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* panel */}
      <aside className="w-[340px] shrink-0 h-full bg-white flex flex-col">
        <div className="h-14 shrink-0 flex items-center justify-between px-5 border-b border-zinc-100">
          <span className="font-bold text-[15px] text-zinc-900">Compose scene</span>
          <button onClick={onClose} className="text-zinc-300 hover:text-zinc-500 transition">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6 text-zinc-900">
          {/* gallery */}
          <div>
            <Label>Decorations</Label>
            {gallery === null ? (
              <div className="py-6 grid place-items-center text-zinc-400"><Loader2 size={18} className="animate-spin" /></div>
            ) : gallery.length === 0 ? (
              <p className="text-[12px] text-zinc-400">No assets available yet.</p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {gallery.map((g) => (
                  <button
                    key={g.name}
                    onClick={() => addAsset(g.url)}
                    title={`Add ${g.name}`}
                    className="aspect-square rounded-lg border border-zinc-200 bg-zinc-50 p-1.5 hover:border-accent transition"
                  >
                    <img src={g.url} alt="" className="w-full h-full object-contain" />
                  </button>
                ))}
              </div>
            )}
            {sel && (
              <div className="mt-3 rounded-xl border border-zinc-200 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[12px] font-semibold text-zinc-600">Selected decoration</span>
                  <button onClick={() => removeAsset(selected!)} className="text-zinc-400 hover:text-red-600">
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['sway', 'float', 'none'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => patchAsset(selected!, { anim: m })}
                      className={
                        'h-8 rounded-lg text-[12px] font-semibold border capitalize transition ' +
                        (sel.anim === m ? 'border-accent bg-accent-soft text-accent' : 'border-zinc-200 text-zinc-600')
                      }
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* background palette */}
          <div>
            <Label>Background</Label>
            <div className="flex flex-wrap gap-2">
              {SCENE_PALETTES.map((p) => {
                const active = p.colors.join() === scene.palette.join();
                return (
                  <button
                    key={p.name}
                    onClick={() => setScene((s) => ({ ...s, palette: p.colors }))}
                    title={p.name}
                    className={'w-10 h-10 rounded-full ring-2 transition ' + (active ? 'ring-accent' : 'ring-transparent')}
                    style={{ background: gradientCss(p.colors) }}
                  />
                );
              })}
            </div>
          </div>

          {/* sliders */}
          <div>
            <Label>Duration · {(scene.durationMs / 1000).toFixed(0)}s</Label>
            <input
              type="range"
              min={4000}
              max={12000}
              step={500}
              value={scene.durationMs}
              onChange={(e) => setScene((s) => ({ ...s, durationMs: Number(e.target.value) }))}
              className="w-full accent-[#6d5efc]"
            />
          </div>
          <div>
            <Label>Animation intensity · {Math.round(scene.intensity * 100)}%</Label>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(scene.intensity * 100)}
              onChange={(e) => setScene((s) => ({ ...s, intensity: Number(e.target.value) / 100 }))}
              className="w-full accent-[#6d5efc]"
            />
          </div>

          <button
            onClick={() => {
              setScene(defaultScene());
              setSelected(null);
            }}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-zinc-500 hover:text-zinc-800 transition"
          >
            <RotateCcw size={14} /> Restore defaults
          </button>
        </div>

        <div className="shrink-0 p-4 border-t border-zinc-100 flex gap-2">
          <button onClick={onClose} className="flex-1 h-11 rounded-xl border border-zinc-200 text-[13.5px] font-semibold">
            Cancel
          </button>
          <button
            onClick={() => {
              onSave(scene);
              onClose();
            }}
            className="flex-1 h-11 rounded-xl bg-zinc-900 text-white text-[13.5px] font-semibold hover:bg-zinc-800 transition"
          >
            Done
          </button>
        </div>
      </aside>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[12px] font-bold uppercase tracking-wide text-zinc-400 mb-2">{children}</div>;
}
