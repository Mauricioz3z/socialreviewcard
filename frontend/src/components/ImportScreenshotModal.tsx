import { useCallback, useEffect, useRef, useState } from 'react';
import { ClipboardPaste, ImageUp, Loader2, ScanText, X } from 'lucide-react';
import { ApiError, type ScanReviewResult } from '../lib/api';

/** Longest edge sent to the vision API — its optimal max; keeps uploads small. */
const MAX_EDGE = 1568;
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/**
 * Downscales / re-encodes a screenshot to JPEG before upload so a 4K capture
 * doesn't blow the size cap (and costs less to process). Falls back to the
 * original file if decoding fails — the backend still enforces its own caps.
 */
async function prepareImage(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.85),
    );
    return blob ?? file;
  } catch {
    return file;
  }
}

export function ImportScreenshotModal({
  onClose,
  onScan,
  onApply,
}: {
  onClose: () => void;
  /** Authenticated upload + extraction call (wrapped in withAuth by the parent). */
  onScan: (image: Blob) => Promise<ScanReviewResult>;
  onApply: (result: ScanReviewResult) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [image, setImage] = useState<Blob | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const acceptFile = useCallback(async (file: File | null | undefined) => {
    if (!file || !file.type.startsWith('image/')) {
      setError('That file is not an image.');
      return;
    }
    setError(null);
    const prepared = await prepareImage(file);
    if (prepared.size > MAX_UPLOAD_BYTES) {
      setError('Image is too large (max 4 MB).');
      return;
    }
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(prepared);
    });
    setImage(prepared);
  }, []);

  // Ctrl+V anywhere while the modal is open.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith('image/'));
      if (item) {
        e.preventDefault();
        void acceptFile(item.getAsFile());
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [acceptFile]);

  // Revoke the preview URL on unmount.
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const doScan = async () => {
    if (!image || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await onScan(image);
      if (!result.found || !result.review.trim()) {
        setError("We couldn't find a customer review in that image. Try a closer crop.");
        return;
      }
      onApply(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-[440px] bg-white rounded-2xl shadow-2xl ring-1 ring-black/5 overflow-hidden font-ui"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <div className="flex items-center gap-2.5">
            <span className="grid place-items-center w-8 h-8 rounded-lg bg-zinc-900 text-white">
              <ScanText size={15} strokeWidth={2.2} />
            </span>
            <div>
              <div className="font-bold text-[15px] tracking-tight leading-none">Import from screenshot</div>
              <div className="text-[12px] text-zinc-400 mt-1">We read the review, name and stars for you</div>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-300 hover:text-zinc-500 transition">
            <X size={18} />
          </button>
        </div>

        <div className="p-5">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void acceptFile(e.dataTransfer.files?.[0]);
            }}
            onClick={() => fileRef.current?.click()}
            className={
              'relative grid place-items-center rounded-xl border-2 border-dashed cursor-pointer transition min-h-[180px] overflow-hidden ' +
              (dragging ? 'border-accent bg-accent-soft' : 'border-zinc-200 hover:border-zinc-300 bg-zinc-50/60')
            }
          >
            {preview ? (
              <img src={preview} alt="Screenshot preview" className="max-h-[260px] w-full object-contain" />
            ) : (
              <div className="flex flex-col items-center gap-2 py-8 px-4 text-center">
                <span className="grid place-items-center w-11 h-11 rounded-xl bg-white border border-zinc-200 text-zinc-500">
                  <ImageUp size={20} strokeWidth={2} />
                </span>
                <div className="text-[13.5px] font-semibold text-zinc-700">Drop a screenshot here</div>
                <div className="text-[12px] text-zinc-400 inline-flex items-center gap-1.5">
                  <ClipboardPaste size={13} /> or paste (Ctrl+V) · or click to browse
                </div>
              </div>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              void acceptFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />

          {error && (
            <div className="mt-3 text-[12.5px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            onClick={doScan}
            disabled={!image || busy}
            className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl h-[46px] text-[14px] font-semibold transition bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Reading your screenshot…
              </>
            ) : (
              <>
                <ScanText size={16} /> Extract review
              </>
            )}
          </button>

          <p className="mt-3 text-[11px] text-zinc-400 text-center">
            Works with screenshots from Google, Etsy, Amazon, WhatsApp, DMs and more.
          </p>
        </div>
      </div>
    </div>
  );
}
