import { useEffect, useRef, useState } from 'react';
import { FlipHorizontal2, Loader2, Play, RotateCcw, Square, Trash2, X } from 'lucide-react';
import { getAssets } from '../../lib/api';
import { SCENE_PALETTES, defaultScene, userSceneToTheme, type SceneAsset, type UserScene } from './userScene';
import { createThemeScene, loadThemeAssets } from './theme/themeScene';

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
  const [playing, setPlaying] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const playCanvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef(scene);
  sceneRef.current = scene;

  // Snapshot of the scene as opened — the dirty check compares against this.
  const baselineRef = useRef(JSON.stringify(initial ?? defaultScene()));
  const dirty = JSON.stringify(scene) !== baselineRef.current;

  // X / Cancel: ask before throwing away unsaved edits.
  const requestClose = () => {
    if (dirty) setConfirmExit(true);
    else onClose();
  };

  // Page reload / tab close with unsaved edits → native browser confirmation.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  useEffect(() => {
    getAssets().then(setGallery).catch(() => setGallery([]));
  }, []);

  // Live preview: run the real engine on a canvas (single-layer card + assets).
  useEffect(() => {
    if (!playing) return;
    let cancelled = false;
    let raf = 0;
    (async () => {
      try {
        const bmp = await fetch(cardImageUrl)
          .then((r) => r.blob())
          .then((b) => createImageBitmap(b));
        const assets = await loadThemeAssets(userSceneToTheme(sceneRef.current));
        if (cancelled) return;
        const ctx = playCanvasRef.current?.getContext('2d');
        if (!ctx) return;
        const start = performance.now();
        const loop = (now: number) => {
          const theme = userSceneToTheme(sceneRef.current);
          createThemeScene(ctx, theme, { base: bmp }, assets)((now - start) % theme.totalDurationMs);
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [playing, cardImageUrl]);

  const patchAsset = (idx: number, patch: Partial<SceneAsset>) =>
    setScene((p) => ({ ...p, assets: p.assets.map((a, i) => (i === idx ? { ...a, ...patch } : a)) }));

  const addAsset = (url: string) => {
    setScene((p) => ({
      ...p,
      assets: [...p.assets, { url, xPct: 0.36, yPct: 0.36, widthPct: 0.26, anim: 'sway', rotation: 0, flipX: false, layer: 'front' }],
    }));
    setSelected(scene.assets.length);
  };

  const removeAsset = (idx: number) => {
    setScene((p) => ({ ...p, assets: p.assets.filter((_, i) => i !== idx) }));
    setSelected(null);
  };

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
      if (mode === 'move') patchAsset(idx, { xPct: clamp(s.ox + dx, -1, 1), yPct: clamp(s.oy + dy, -1, 1) });
      else patchAsset(idx, { widthPct: clamp(s.ow + dx, 0.05, 1) });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const renderAsset = (idx: number) => {
    const a = scene.assets[idx];
    return (
      <div
        key={idx}
        onPointerDown={(e) => startDrag(e, idx, 'move')}
        className="absolute"
        style={{
          left: `${a.xPct * 100}%`,
          top: `${a.yPct * 100}%`,
          width: `${a.widthPct * 100}%`,
          transform: `rotate(${a.rotation ?? 0}deg) scaleX(${a.flipX ? -1 : 1})`,
          transformOrigin: 'center',
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
            className="absolute -right-2.5 -bottom-2.5 w-6 h-6 rounded-full bg-accent ring-2 ring-white shadow"
            style={{ cursor: 'nwse-resize', touchAction: 'none' }}
          />
        )}
      </div>
    );
  };

  const sel = selected != null ? scene.assets[selected] : null;
  const layerOf = (a: SceneAsset) => a.layer ?? 'front';

  return (
    <div className="fixed inset-0 z-[70] flex flex-col lg:flex-row bg-zinc-950/95 backdrop-blur-sm font-ui">
      {/* stage */}
      <div className="relative flex-1 min-h-0 grid place-items-center p-3 lg:p-6 overflow-hidden">
        <button
          onClick={() => setPlaying((p) => !p)}
          className="absolute top-3 left-1/2 -translate-x-1/2 z-10 inline-flex items-center gap-2 px-4 h-9 rounded-full bg-white/90 text-zinc-900 text-[13px] font-semibold shadow-lg hover:bg-white transition"
        >
          {playing ? (
            <>
              <Square size={14} /> Stop
            </>
          ) : (
            <>
              <Play size={14} /> Play preview
            </>
          )}
        </button>

        {playing ? (
          <div className="relative h-full w-auto" style={{ aspectRatio: '9 / 16', maxHeight: '100%' }}>
            <canvas
              ref={playCanvasRef}
              width={1080}
              height={1920}
              className="block w-full h-full rounded-2xl shadow-2xl"
            />
          </div>
        ) : (
          <div
            ref={stageRef}
            onPointerDown={(e) => {
              if (e.target === e.currentTarget) setSelected(null);
            }}
            className="relative h-full w-auto rounded-2xl overflow-hidden shadow-2xl"
            style={{ aspectRatio: '9 / 16', maxHeight: '100%', background: gradientCss(scene.palette), touchAction: 'none' }}
          >
            {scene.assets.map((_, i) => (layerOf(scene.assets[i]) === 'behind' ? renderAsset(i) : null))}
            <img
              src={cardImageUrl}
              alt="card"
              draggable={false}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
              style={{ width: '78%', filter: 'drop-shadow(0 20px 50px rgba(0,0,0,0.45))' }}
            />
            {scene.assets.map((_, i) => (layerOf(scene.assets[i]) !== 'behind' ? renderAsset(i) : null))}
          </div>
        )}
      </div>

      {/* panel — hidden while the preview plays so the animation gets the full
          screen; it comes back on Stop. */}
      <aside
        className={
          (playing ? 'hidden ' : '') +
          'w-full lg:w-[340px] shrink-0 lg:h-full bg-white flex flex-col max-h-[46vh] lg:max-h-none'
        }
      >
        <div className="h-14 shrink-0 flex items-center justify-between px-5 border-b border-zinc-100">
          <span className="font-bold text-[15px] text-zinc-900">Compose scene</span>
          <button onClick={requestClose} className="text-zinc-300 hover:text-zinc-500 transition">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6 text-zinc-900">
          {/* gallery */}
          <div>
            <Label>Decorations</Label>
            {gallery === null ? (
              <div className="py-6 grid place-items-center text-zinc-400">
                <Loader2 size={18} className="animate-spin" />
              </div>
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

            {sel && selected != null && (
              <div className="mt-3 rounded-xl border border-zinc-200 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-zinc-600">Selected decoration</span>
                  <button onClick={() => removeAsset(selected)} className="text-zinc-400 hover:text-red-600">
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* animation */}
                <div className="grid grid-cols-3 gap-1.5">
                  {(['sway', 'float', 'none'] as const).map((m) => (
                    <Chip key={m} active={sel.anim === m} onClick={() => patchAsset(selected, { anim: m })}>
                      {m}
                    </Chip>
                  ))}
                </div>

                {/* rotation */}
                <div>
                  <div className="text-[11.5px] text-zinc-500 mb-1">Rotation · {Math.round(sel.rotation ?? 0)}°</div>
                  <input
                    type="range"
                    min={0}
                    max={360}
                    value={Math.round(sel.rotation ?? 0)}
                    onChange={(e) => patchAsset(selected, { rotation: Number(e.target.value) })}
                    className="w-full accent-[#6d5efc]"
                  />
                </div>

                {/* flip + layer */}
                <div className="grid grid-cols-3 gap-1.5">
                  <Chip active={!!sel.flipX} onClick={() => patchAsset(selected, { flipX: !sel.flipX })}>
                    <FlipHorizontal2 size={13} className="inline -mt-0.5 mr-1" />
                    Flip
                  </Chip>
                  <Chip active={layerOf(sel) === 'front'} onClick={() => patchAsset(selected, { layer: 'front' })}>
                    Front
                  </Chip>
                  <Chip active={layerOf(sel) === 'behind'} onClick={() => patchAsset(selected, { layer: 'behind' })}>
                    Back
                  </Chip>
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
          <button onClick={requestClose} className="flex-1 h-11 rounded-xl border border-zinc-200 text-[13.5px] font-semibold">
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

      {/* unsaved-changes confirmation */}
      {confirmExit && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-[340px] bg-white rounded-2xl shadow-2xl p-5">
            <div className="font-bold text-[15px] text-zinc-900">Discard changes?</div>
            <p className="mt-1.5 text-[13px] text-zinc-500 leading-relaxed">
              You have unsaved changes to this scene. If you leave now they will be lost.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setConfirmExit(false)}
                className="flex-1 h-10 rounded-xl bg-zinc-900 text-white text-[13px] font-semibold hover:bg-zinc-800 transition"
              >
                Keep editing
              </button>
              <button
                onClick={() => {
                  setConfirmExit(false);
                  onClose();
                }}
                className="flex-1 h-10 rounded-xl border border-zinc-200 text-[13px] font-semibold text-red-600 hover:bg-red-50 transition"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[12px] font-bold uppercase tracking-wide text-zinc-400 mb-2">{children}</div>;
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={
        'h-8 rounded-lg text-[12px] font-semibold border capitalize transition ' +
        (active ? 'border-accent bg-accent-soft text-accent' : 'border-zinc-200 text-zinc-600 hover:border-zinc-300')
      }
    >
      {children}
    </button>
  );
}
