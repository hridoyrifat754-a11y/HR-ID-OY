import React, { useState } from 'react';
import { Lock, Unlock, Key, ShieldCheck, X, Check, AlertCircle } from 'lucide-react';

interface AdminPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUnlockSuccess: () => void;
  verifyPin: (pin: string) => Promise<boolean>;
  changeAdminPin: (oldPin: string, newPin: string) => Promise<{ success: boolean; error?: string }>;
}

export const AdminPinModal: React.FC<AdminPinModalProps> = ({
  isOpen,
  onClose,
  onUnlockSuccess,
  verifyPin,
  changeAdminPin,
}) => {
  const [mode, setMode] = useState<'unlock' | 'change'>('unlock');
  const [pinInput, setPinInput] = useState('');
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    const ok = await verifyPin(pinInput);
    setLoading(false);
    if (ok) {
      setSuccessMsg('কর্তৃপক্ষ হৃদয় হিসেবে সফলভাবে আনলক হয়েছে!');
      setTimeout(() => {
        onUnlockSuccess();
        onClose();
      }, 700);
    } else {
      setErrorMsg('ভুল পিন কোড! শুধুমাত্র অনুমোদিত কর্তৃপক্ষ হৃদয় এই পিন দিয়ে অ্যাক্সেস করতে পারবেন।');
    }
  };

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (newPin.length < 4) {
      setErrorMsg('নতুন পিন কমপক্ষে ৪ সংখ্যার হতে হবে।');
      return;
    }
    if (newPin !== confirmPin) {
      setErrorMsg('নতুন পিন এবং নিশ্চিতকরণ পিন মিলছে না!');
      return;
    }

    setLoading(true);
    const result = await changeAdminPin(oldPin, newPin);
    setLoading(false);

    if (result.success) {
      setSuccessMsg('পিন কোড সফলভাবে পরিবর্তন করা হয়েছে!');
      setOldPin('');
      setNewPin('');
      setConfirmPin('');
      setTimeout(() => {
        setMode('unlock');
        onClose();
      }, 1200);
    } else {
      setErrorMsg(result.error || 'পিন পরিবর্তন ব্যর্থ হয়েছে।');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base leading-tight">
                {mode === 'unlock' ? 'কর্তৃপক্ষ ভেরিফিকেশন' : 'সিকিউরিটি পিন পরিবর্তন'}
              </h3>
              <p className="text-[11px] text-slate-300">
                আলম খান বিল্ডিং · কর্তৃপক্ষ: হৃদয়
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Switch Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-semibold">
          <button
            onClick={() => {
              setMode('unlock');
              setErrorMsg('');
              setSuccessMsg('');
            }}
            className={`flex-1 py-3 text-center border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
              mode === 'unlock'
                ? 'border-blue-600 text-blue-700 bg-white font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Unlock className="w-3.5 h-3.5" />
            <span>কর্তৃপক্ষ আনলক</span>
          </button>
          <button
            onClick={() => {
              setMode('change');
              setErrorMsg('');
              setSuccessMsg('');
            }}
            className={`flex-1 py-3 text-center border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
              mode === 'change'
                ? 'border-blue-600 text-blue-700 bg-white font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>পিন পরিবর্তন</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {errorMsg && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {mode === 'unlock' ? (
            <form onSubmit={handleUnlock} className="space-y-4">
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-slate-700 space-y-1">
                <p className="font-semibold text-blue-900">
                  🔒 মালিকানা নিরাপত্তা ব্যবস্থা:
                </p>
                <p className="text-slate-600">
                  অনলাইন শেয়ার করা লিংকে সাধারণ দর্শকরা শুধুমাত্র তথ্য দেখতে পারবেন। যেকোনো ভাড়া, বিল বা মিটার রিডিং আপডেট ও সেভ করার জন্য কর্তৃপক্ষ হৃদয়-এর ৪ সংখ্যার গোপন পিন দিন।
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  কর্তৃপক্ষের গোপন পিন কোড:
                </label>
                <input
                  type="password"
                  maxLength={10}
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="৪ সংখ্যার পিন লিখুন"
                  autoFocus
                  required
                  className="w-full px-3.5 py-2.5 text-center text-lg tracking-widest font-mono font-bold border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                />
                <span className="block text-[11px] text-slate-500 mt-1 text-center">
                  (প্রাথমিক ডিফল্ট পিন: <strong>7540</strong> বা ৭৫৪০)
                </span>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading || !pinInput}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 shadow-xs"
                >
                  <Unlock className="w-4 h-4" />
                  <span>{loading ? 'যাচাই করা হচ্ছে...' : 'মালিক হিসেবে আনলক করুন'}</span>
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleChangePin} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  বর্তমান পিন:
                </label>
                <input
                  type="password"
                  value={oldPin}
                  onChange={(e) => setOldPin(e.target.value)}
                  placeholder="বর্তমান পিন"
                  required
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  নতুন ৪ সংখ্যার পিন:
                </label>
                <input
                  type="password"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  placeholder="নতুন গোপন পিন"
                  required
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  নতুন পিন নিশ্চিত করুন:
                </label>
                <input
                  type="password"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                  placeholder="পুনরায় নতুন পিন দিন"
                  required
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading || !oldPin || !newPin || !confirmPin}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 shadow-xs"
                >
                  <Key className="w-4 h-4" />
                  <span>{loading ? 'সংরক্ষণ করা হচ্ছে...' : 'নতুন পিন সংরক্ষণ করুন'}</span>
                </button>
              </div>
            </form>
          )}

        </div>

      </div>
    </div>
  );
};
