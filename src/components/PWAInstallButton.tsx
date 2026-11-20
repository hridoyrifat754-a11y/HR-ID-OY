import React, { useState } from 'react';
import { Download, Smartphone, Share, PlusSquare, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { APP_NAME } from '../constants';

interface PWAInstallButtonProps {
  onOpenInstallModal?: () => void;
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  onOpenInstallModal,
  compact = false,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running inside installed Android/iOS standalone app, hide the install button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android native 1-click install prompt
  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => install()}
        className={`inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-xs transition-colors whitespace-nowrap shrink-0 ${
          compact ? 'px-2.5 py-1 text-[11px]' : 'px-2.5 py-1.5 text-xs'
        }`}
        title="ফোনে সরাসরি অ্যাপ ইনস্টল করুন"
      >
        <Download className="w-3.5 h-3.5" />
        <span>ইনস্টল অ্যাপ</span>
      </button>
    );
  }

  // iOS Safari (no beforeinstallprompt)
  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={`inline-flex items-center gap-1.5 rounded-lg bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-200 font-semibold transition-colors whitespace-nowrap shrink-0 ${
            compact ? 'px-2.5 py-1 text-[11px]' : 'px-2.5 py-1.5 text-xs'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
          <span>iPhone ইনস্টল</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 text-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">
                  iPhone / iPad-এ "{APP_NAME}" ইনস্টল
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ol className="text-xs text-slate-600 space-y-2 leading-relaxed">
                <li className="flex items-center gap-2">
                  <Share className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>১. Safari-র নিচের <strong>Share</strong> বাটনে ট্যাপ করুন।</span>
                </li>
                <li className="flex items-center gap-2">
                  <PlusSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>২. নিচে গিয়ে <strong>"Add to Home Screen"</strong> নির্বাচন করুন।</span>
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition-colors"
              >
                ঠিক আছে
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Desktop / Fallback Android browser guide button
  if (onOpenInstallModal) {
    return (
      <button
        type="button"
        onClick={onOpenInstallModal}
        className={`inline-flex items-center gap-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-500/30 text-emerald-300 hover:text-white font-semibold transition-colors whitespace-nowrap shrink-0 ${
          compact ? 'px-2.5 py-1 text-[11px]' : 'px-2.5 py-1.5 text-xs'
        }`}
        title="Android ফোনে ইনস্টল করুন"
      >
        <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
        <span>অ্যাপ ইনস্টল</span>
      </button>
    );
  }

  return null;
};
