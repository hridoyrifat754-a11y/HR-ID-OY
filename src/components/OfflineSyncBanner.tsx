import React, { useEffect, useState } from 'react';
import { WifiOff, Cloud, RefreshCw, Sparkles, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { ADMIN_GOOGLE_EMAIL } from '../firebase';

interface OfflineSyncBannerProps {
  isOnline: boolean;
  isSyncing: boolean;
  firebaseConnected: boolean;
  isFirebaseAdmin: boolean;
  firebaseUserEmail?: string | null;
  pendingSyncCount: number;
  firebaseQuotaError?: string | null;
  isOwner: boolean;
  onSyncNow: () => Promise<{ success: boolean; message: string }>;
  onOpenAdminGoogleLogin: () => void;
}

export const OfflineSyncBanner: React.FC<OfflineSyncBannerProps> = ({
  isOnline,
  isSyncing,
  firebaseConnected,
  isFirebaseAdmin,
  firebaseUserEmail,
  pendingSyncCount,
  firebaseQuotaError,
  isOwner,
  onSyncNow,
  onOpenAdminGoogleLogin,
}) => {
  const [swUpdateAvailable, setSwUpdateAvailable] = useState(false);
  const [syncResultMsg, setSyncResultMsg] = useState<string | null>(null);

  useEffect(() => {
    const onSwUpdate = () => setSwUpdateAvailable(true);
    window.addEventListener('alam-khan-sw-update', onSwUpdate);
    return () => window.removeEventListener('alam-khan-sw-update', onSwUpdate);
  }, []);

  const handleApplySwUpdate = () => {
    const applyFn = (window as unknown as { __applyAlamKhanUpdate?: () => void })
      .__applyAlamKhanUpdate;
    if (applyFn) {
      applyFn();
    } else {
      window.location.reload();
    }
  };

  const handleManualSync = async () => {
    const res = await onSyncNow();
    setSyncResultMsg(res.message);
    setTimeout(() => setSyncResultMsg(null), 3500);
  };

  return (
    <div className="no-print space-y-2 max-w-7xl mx-auto px-4 sm:px-6 pt-3 w-full">
      {/* 1. PWA App Update Available Banner (updates WebAPK without APK reinstall) */}
      {swUpdateAvailable && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs shadow-sm">
          <div className="flex items-center gap-2 font-semibold">
            <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
            <span>
              অ্যাপটির নতুন আপডেট তৈরি! APK পুনরায় ইনস্টল ছাড়াই নতুন ফিচার পেতে আপডেট করুন।
            </span>
          </div>
          <button
            type="button"
            onClick={handleApplySwUpdate}
            className="px-3 py-1.5 bg-white text-indigo-700 hover:bg-indigo-50 rounded-lg font-bold text-xs shrink-0 self-end sm:self-auto"
          >
            এখনই আপডেট করুন
          </button>
        </div>
      )}

      {/* 2. Offline Cached State Banner */}
      {!isOnline && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs shadow-2xs">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-amber-600 shrink-0" />
            <div>
              <span className="font-bold">অফলাইন মোড সচল — সংরক্ষিত তথ্যের অবস্থা দেখানো হচ্ছে।</span>
              {pendingSyncCount > 0 && (
                <span className="ml-1.5 text-amber-800 font-medium">
                  ({pendingSyncCount}টি পরিবর্তন অপেক্ষমাণ — ইন্টারনেট এলে স্বয়ংক্রিয়ভাবে সিঙ্ক হবে)
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. Online Pending Sync Recovery Banner */}
      {isOnline && pendingSyncCount > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-2.5 rounded-xl bg-sky-50 border border-sky-300 text-sky-950 text-xs">
          <div className="flex items-center gap-2">
            <RefreshCw className={`w-4 h-4 text-sky-600 shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>
              <strong>পুনরায় ইন্টারনেট পাওয়া গেছে!</strong> অফলাইনে করা {pendingSyncCount}টি পরিবর্তন অনলাইনে সিঙ্ক করার জন্য প্রস্তুত।
            </span>
          </div>
          <button
            type="button"
            onClick={handleManualSync}
            disabled={isSyncing}
            className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-bold text-xs shrink-0 self-end sm:self-auto"
          >
            {isSyncing ? 'সিঙ্ক হচ্ছে...' : 'এখনই নিরাপদে সিঙ্ক করুন'}
          </button>
        </div>
      )}

      {/* 4. Firestore Cloud Auth Prompt for Admin (if signed in via local PIN only while online) */}
      {isOnline && isOwner && !isFirebaseAdmin && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-2 rounded-xl bg-slate-900 text-slate-100 border border-slate-700 text-xs">
          <div className="flex items-center gap-2">
            <Cloud className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>
              <strong>Firebase Cloud Firestore:</strong> সকল তথ্য স্থায়ীভাবে ক্লাউডে সংরক্ষণ ও রিয়েল-টাইম সিঙ্ক চালু করতে আপনার Google এডমিন ({ADMIN_GOOGLE_EMAIL}) অ্যাকাউন্ট দিয়ে লগইন করুন।
            </span>
          </div>
          <button
            type="button"
            onClick={onOpenAdminGoogleLogin}
            className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-lg font-bold text-xs shrink-0 self-end sm:self-auto"
          >
            Google এডমিন কানেক্ট
          </button>
        </div>
      )}

      {/* 5. Connected Confirmation Bar for Firebase Admin */}
      {isOnline && isFirebaseAdmin && (
        <div className="flex items-center justify-between gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px]">
          <div className="flex items-center gap-1.5 font-medium truncate">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="truncate">
              <strong>Firebase Cloud সংযুক্ত:</strong> {firebaseUserEmail || ADMIN_GOOGLE_EMAIL} — সব তথ্য রিয়েল-টাইম ও নিরাপদ রুলে সংরক্ষিত হচ্ছে
            </span>
          </div>
          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold shrink-0">
            {firebaseConnected ? 'Cloud Live' : 'Cached'}
          </span>
        </div>
      )}

      {/* 6. Quota Warning if encountered */}
      {firebaseQuotaError && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-xs">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>
            Firestore দৈনিক ফ্রি কোটা সীমা পূর্ণ হয়েছে (আগামীকাল রিসেট হবে)। লোকাল অফলাইন ব্যাকআপ স্বাভাবিকভাবে সচল আছে।
          </span>
        </div>
      )}

      {syncResultMsg && (
        <div className="px-4 py-2 rounded-xl bg-emerald-900 text-emerald-100 text-xs font-semibold">
          {syncResultMsg}
        </div>
      )}
    </div>
  );
};
