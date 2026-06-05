import { useEffect, useRef, useState } from 'react';
import { Loader2, Quote, X } from 'lucide-react';
import { ApiError, googleLogin } from '../lib/api';
import type { AuthSession } from '../types';

declare global {
  interface Window {
    // Google Identity Services global, loaded on demand.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    google?: any;
  }
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

export function AuthModal({
  onClose,
  onAuthed,
}: {
  onClose: () => void;
  onAuthed: (session: AuthSession) => void;
}) {
  const btnRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      setError("Google sign-in isn't configured (set VITE_GOOGLE_CLIENT_ID).");
      return;
    }

    let cancelled = false;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleCredential = async (resp: any) => {
      if (!resp?.credential) return;
      setBusy(true);
      setError(null);
      try {
        const session = await googleLogin(resp.credential);
        if (!cancelled) onAuthed(session);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof ApiError ? 'Could not sign you in. Please try again.' : 'Unexpected error.');
      } finally {
        if (!cancelled) setBusy(false);
      }
    };

    const init = () => {
      const g = window.google;
      if (!g?.accounts?.id || !btnRef.current) return;
      g.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleCredential });
      g.accounts.id.renderButton(btnRef.current, {
        theme: 'outline',
        size: 'large',
        width: 300,
        text: 'continue_with',
        shape: 'pill',
      });
    };

    if (window.google?.accounts?.id) {
      init();
    } else {
      let s = document.getElementById('gis-script') as HTMLScriptElement | null;
      if (!s) {
        s = document.createElement('script');
        s.src = 'https://accounts.google.com/gsi/client';
        s.async = true;
        s.defer = true;
        s.id = 'gis-script';
        document.body.appendChild(s);
      }
      s.addEventListener('load', init);
    }

    return () => {
      cancelled = true;
    };
  }, [onAuthed]);

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-[400px] bg-white rounded-2xl shadow-2xl ring-1 ring-black/5 overflow-hidden font-ui">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <div className="flex items-center gap-2.5">
            <span className="grid place-items-center w-8 h-8 rounded-lg bg-zinc-900 text-white">
              <Quote size={15} strokeWidth={2.2} />
            </span>
            <div>
              <div className="font-bold text-[15px] tracking-tight leading-none">Sign in to ReviewCraft</div>
              <div className="text-[12px] text-zinc-400 mt-1">Save your cards and export images</div>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-300 hover:text-zinc-500 transition">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-7 flex flex-col items-center">
          <p className="text-[13px] text-zinc-500 text-center mb-5 max-w-[280px]">
            Use your Google account to get started. You get{' '}
            <span className="font-semibold text-zinc-700">3 free exports</span>.
          </p>

          {/* Google renders its official button into this node. */}
          <div ref={btnRef} className="min-h-[44px] grid place-items-center">
            {busy && <Loader2 size={22} className="animate-spin text-zinc-400" />}
          </div>

          {error && (
            <div className="mt-4 text-[12.5px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-center">
              {error}
            </div>
          )}

          <p className="mt-6 text-[11px] text-zinc-400 text-center max-w-[280px]">
            By continuing you agree to the Terms and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}
