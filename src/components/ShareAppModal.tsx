import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Share2, Copy, Check, ExternalLink, QrCode, Shield, Users, Smartphone, X } from 'lucide-react';
import { APP_NAME, APP_LOGO } from '../constants';

interface ShareAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  buildingName: string;
  landlordName: string;
  landlordTitle: string;
}

export const ShareAppModal: React.FC<ShareAppModalProps> = ({
  isOpen,
  onClose,
  buildingName,
  landlordName,
  landlordTitle,
}) => {
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';

  useEffect(() => {
    if (appUrl) {
      QRCode.toDataURL(appUrl, {
        width: 240,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('QR generation failed:', err));
    }
  }, [appUrl]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(appUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const whatsappText = `🏢 *${buildingName} — লাইভ ভাড়া ও ডাইনিং বিদ্যুৎ হিসাব*
${landlordTitle}: ${landlordName}

অনলাইনে লাইভ আপডেট, রুমের ভাড়ার বিবরণ ও বিলের রশিদ দেখতে নিচের লিংকে প্রবেশ করুন:
${appUrl}

(বি.দ্র. এটি লাইভ সংরক্ষিত লিংক। কর্তৃপক্ষ হৃদয় ছাড়া কেউ কোনো তথ্য পরিবর্তন করতে পারবে না।)`;

  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(whatsappText)}`;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#f9f9f9] border border-amber-300/70 overflow-hidden shrink-0 flex items-center justify-center">
              <img
                src={APP_LOGO}
                alt={APP_NAME}
                className="w-full h-full object-contain scale-[1.38]"
              />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base leading-tight">
                "{APP_NAME}" অ্যাপ শেয়ার করুন (লাইভ আপডেট লিংক)
              </h3>
              <p className="text-[11px] text-slate-300">
                {buildingName} · {landlordTitle}: {landlordName}
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

        <div className="p-5 sm:p-6 space-y-5">
          
          {/* Security Notice */}
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-emerald-900">
              <Shield className="w-4 h-4 text-emerald-600" />
              <span>১০০% সুরক্ষিত লাইভ শেয়ারিং:</span>
            </div>
            <p className="text-emerald-800 leading-relaxed">
              আপনি যখনই কোনো ভাড়া, ডাইনিং মিটার বা বিল আপডেট করবেন, এই লিংকে প্রবেশ করা সবাই ঠিক সেই আপডেট সেম টু সেম দেখতে পাবে। কিন্তু <strong>কর্তৃপক্ষ হৃদয় ছাড়া আর কেউ কোনো তথ্য পরিবর্তন, এডিট বা ডিলিট করতে পারবে না</strong>।
            </p>
          </div>

          {/* Share Link Box */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              আপনার লাইভ অ্যাপ লিংক:
            </label>
            <div className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-xl">
              <input
                type="text"
                readOnly
                value={appUrl}
                className="flex-1 bg-transparent text-xs font-mono text-slate-700 outline-none select-all px-2"
              />
              <button
                onClick={handleCopyLink}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 shrink-0 shadow-xs"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'কপি হয়েছে!' : 'লিংক কপি'}</span>
              </button>
            </div>
          </div>

          {/* WhatsApp Share Button */}
          <div>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 shadow-xs"
            >
              <span>হোয়াটসঅ্যাপে সরাসরি শেয়ার করুন</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* QR Code Section */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
            {qrDataUrl ? (
              <div className="p-2 bg-white rounded-lg border border-slate-200 shadow-2xs shrink-0">
                <img src={qrDataUrl} alt="App QR Code" className="w-28 h-28" />
              </div>
            ) : (
              <div className="w-28 h-28 bg-slate-200 rounded-lg animate-pulse shrink-0" />
            )}
            <div className="space-y-1 text-xs text-slate-600">
              <div className="flex items-center justify-center sm:justify-start gap-1.5 font-bold text-slate-800">
                <QrCode className="w-4 h-4 text-blue-600" />
                <span>মোবাইল স্ক্যানার:</span>
              </div>
              <p>
                যে কোনো স্মার্টফোনের ক্যামেরা বা কিউআর স্ক্যানার দিয়ে স্ক্যান করলেই সরাসরি অ্যাপ ওপেন হবে।
              </p>
              <div className="text-[11px] text-slate-500 pt-1">
                ভাড়াটিয়ারা তাদের রুমের বিল ও রসিদ সরাসরি চেক করতে পারবেন।
              </div>
            </div>
          </div>

          {/* Permission Comparison */}
          <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
            <div className="p-2.5 bg-blue-50/80 border border-blue-200 rounded-lg">
              <strong className="text-blue-900 block font-semibold mb-0.5">👑 কর্তৃপক্ষ হৃদয়</strong>
              <span className="text-blue-700">সম্পূর্ণ এডিট, ডিলিট, বিল তৈরি ও অনলাইন আপডেট সেভ করার ক্ষমতা।</span>
            </div>
            <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-lg">
              <strong className="text-slate-800 block font-semibold mb-0.5">👀 শেয়ার করা দর্শক</strong>
              <span className="text-slate-600">শুধুমাত্র লাইভ দেখার, রশিদ প্রিন্ট ও PDF করার সুযোগ (এডিট ব্লকড)।</span>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
