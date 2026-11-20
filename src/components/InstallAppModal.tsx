import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { usePWAInstall } from '../hooks/usePWAInstall';
import {
  Smartphone,
  Download,
  CheckCircle2,
  Share2,
  Copy,
  ExternalLink,
  X,
  ShieldCheck,
  Zap,
  Globe,
  Check,
  QrCode,
  MessageCircle,
  FileCode,
  Package
} from 'lucide-react';
import { APP_NAME, APP_LOGO } from '../constants';

interface InstallAppModalProps {
  onClose: () => void;
}

export const InstallAppModal: React.FC<InstallAppModalProps> = ({ onClose }) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [copiedLink, setCopiedLink] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'qr' | 'chrome' | 'apk' | 'offline'>('qr');

  // Detect runtime origin vs Firebase Hosting public origin for PWABuilder APK generation
  const currentOrigin =
    typeof window !== 'undefined' ? window.location.origin : 'https://gen-lang-client-0368614825.web.app';
  const isAiStudioOrLocal =
    currentOrigin.includes('ais-dev-') ||
    currentOrigin.includes('ais-pre-') ||
    currentOrigin.includes('localhost') ||
    currentOrigin.includes('127.0.0.1');
  const firebaseHostingUrl = 'https://gen-lang-client-0368614825.web.app';
  const appUrl = isAiStudioOrLocal
    ? 'https://ais-pre-fysp4awf72t2ffyfbo7tnv-812149070244.asia-southeast1.run.app'
    : currentOrigin;

  const [apkSiteUrl, setApkSiteUrl] = useState<string>(
    isAiStudioOrLocal ? firebaseHostingUrl : currentOrigin
  );

  useEffect(() => {
    QRCode.toDataURL(appUrl, {
      width: 240,
      margin: 1.5,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((url) => setQrCodeDataUrl(url))
      .catch((err) => console.error('QR code generation failed:', err));
  }, [appUrl]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(appUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleInstallClick = async () => {
    if (isInstallable) {
      await install();
    }
  };

  // WhatsApp share link to easily send to phone
  const whatsappShareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(
    `${APP_NAME} (কর্তৃপক্ষ: হৃদয়) অ্যাপ লিংক:\n${appUrl}\n\n(এই লিংকে ঢুকে Chrome-এর থ্রি-ডট মেনু থেকে 'Install app' বা 'Add to Home Screen' চাপলেই আপনার ফোনে সরাসরি '${APP_NAME}' লোগোসহ আসল অ্যান্ড্রয়েড অ্যাপ হিসেবে ইনস্টল হয়ে যাবে!)`
  )}`;

  // PWABuilder direct link for generating raw Android APK package
  const cleanApkSiteUrl = apkSiteUrl.trim() || firebaseHostingUrl;
  const pwaBuilderUrl = `https://www.pwabuilder.com/reportcard?site=${encodeURIComponent(cleanApkSiteUrl)}`;

  // Download Standalone Offline HTML File directly to phone
  const handleDownloadOfflineHtml = () => {
    const htmlContent = `<!doctype html>
<html lang="bn">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${APP_NAME} — কর্তৃপক্ষ: হৃদয়</title>
<style>
body{font-family:system-ui,"Noto Sans Bengali",sans-serif;background:#f8fafc;color:#0f172a;margin:0;padding:16px}
header{background:#0f172a;color:#fff;padding:20px;border-radius:12px;margin-bottom:16px}
h1{margin:0;font-size:20px}
.card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:12px}
.btn{background:#2563eb;color:#fff;border:none;padding:10px 16px;border-radius:8px;font-weight:bold;cursor:pointer}
.online-link{display:inline-block;background:#059669;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:10px}
</style>
</head>
<body>
<header>
  <h1>${APP_NAME} — অফলাইন ফাইল</h1>
  <p style="margin:5px 0 0;font-size:13px;opacity:0.8">কর্তৃপক্ষ: হৃদয় · ২য়–৭ম তলার ভাড়া ও বিদ্যুৎ হিসাব</p>
</header>
<div class="card">
  <h3>মোবাইল সংস্করণ ওপেন করুন</h3>
  <p>সম্পূর্ণ আধুনিক ফ্লোর প্ল্যান, ৬ মাসের চার্ট, রশিদ প্রিন্ট ও বাল্ক আপডেটের জন্য নিচের বোতামে চাপ দিন:</p>
  <a class="online-link" href="${appUrl}" target="_blank">🌐 সম্পূর্ণ অ্যাপ চালু করুন</a>
</div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Alam_Khan_App.html';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-4 max-h-[95vh] flex flex-col font-sans">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#f9f9f9] border-2 border-amber-300/70 overflow-hidden shrink-0 shadow-xs flex items-center justify-center">
              <img
                src={APP_LOGO}
                alt={APP_NAME}
                className="w-full h-full object-contain scale-[1.38]"
              />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg">
                "{APP_NAME}" মোবাইল অ্যাপ ও APK ইনস্টল
              </h3>
              <p className="text-xs text-slate-300">
                কর্তৃপক্ষ: হৃদয় · আপনার অ্যান্ড্রয়েড ফোনে সরাসরি অ্যাপ ইনস্টল করুন
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs for Methods */}
        <div className="px-6 pt-3 bg-slate-100/80 border-b border-slate-200 flex flex-wrap gap-1 text-xs font-semibold shrink-0">
          <button
            onClick={() => setActiveTab('qr')}
            className={`px-3 py-2 rounded-t-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'qr'
                ? 'bg-white text-blue-700 border-t-2 border-blue-600 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <QrCode className="w-3.5 h-3.5 text-blue-600" />
            <span>১. QR কোড স্ক্যান (সবচেয়ে সহজ)</span>
          </button>
          
          <button
            onClick={() => setActiveTab('chrome')}
            className={`px-3 py-2 rounded-t-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'chrome'
                ? 'bg-white text-emerald-700 border-t-2 border-emerald-600 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
            <span>২. Chrome দিয়ে ইনস্টল</span>
          </button>

          <button
            onClick={() => setActiveTab('apk')}
            className={`px-3 py-2 rounded-t-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'apk'
                ? 'bg-white text-indigo-700 border-t-2 border-indigo-600 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Package className="w-3.5 h-3.5 text-indigo-600" />
            <span>৩. সরাসরি APK ফাইল</span>
          </button>

          <button
            onClick={() => setActiveTab('offline')}
            className={`px-3 py-2 rounded-t-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'offline'
                ? 'bg-white text-amber-700 border-t-2 border-amber-600 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileCode className="w-3.5 h-3.5 text-amber-600" />
            <span>৪. অফলাইন ফাইল</span>
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 text-slate-800">

          {/* TAB 1: QR CODE (Instant Scan) */}
          {activeTab === 'qr' && (
            <div className="space-y-4 text-center">
              <div className="max-w-md mx-auto p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col items-center">
                <span className="text-xs font-bold text-slate-500 mb-2">
                  মোবাইলের ক্যামেরা বা Google Lens দিয়ে নিচের QR কোডটি স্ক্যান করুন:
                </span>
                {qrCodeDataUrl ? (
                  <div className="p-3 bg-white rounded-xl shadow-xs border border-slate-200">
                    <img
                      src={qrCodeDataUrl}
                      alt="App QR Code"
                      className="w-48 h-48 rounded-lg"
                    />
                  </div>
                ) : (
                  <div className="w-48 h-48 bg-slate-200 animate-pulse rounded-lg flex items-center justify-center text-xs text-slate-400">
                    QR কোড তৈরি হচ্ছে...
                  </div>
                )}
                <div className="mt-3 text-xs text-slate-600 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>স্ক্যান করলেই সাথে সাথে আপনার মোবাইলে অ্যাপটি চালু হবে!</span>
                </div>
              </div>

              {/* Share via WhatsApp */}
              <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-white shrink-0">
                    <MessageCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <strong className="block text-xs sm:text-sm text-emerald-950">
                      হোয়াটসঅ্যাপে নিজের ফোনে লিংকটি পাঠিয়ে দিন
                    </strong>
                    <span className="text-[11px] text-emerald-700">
                      নিচের বাটনে চাপ দিলে সরাসরি হোয়াটসঅ্যাপে নিজের বা পরিবারের নম্বরে লিংক সেন্ড হবে।
                    </span>
                  </div>
                </div>
                <a
                  href={whatsappShareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold whitespace-nowrap shadow-xs transition-colors shrink-0"
                >
                  হোয়াটসঅ্যাপে পাঠান
                </a>
              </div>
            </div>
          )}

          {/* TAB 2: CHROME 1-CLICK / ADD TO HOME SCREEN */}
          {activeTab === 'chrome' && (
            <div className="space-y-4">
              {isInstallable && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-center space-y-2">
                  <strong className="block text-sm text-blue-900">
                    আপনার ব্রাউজারে সরাসরি ১-ক্লিক ইনস্টল সুবিধা সক্রিয় আছে!
                  </strong>
                  <button
                    onClick={handleInstallClick}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>ফোনে অ্যাপ ইনস্টল করুন (Install App)</span>
                  </button>
                </div>
              )}

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-xs space-y-3.5">
                <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <span>🤖 Android (Chrome) ও 🍎 Apple (iPhone/iPad Safari) ইনস্টল গাইড:</span>
                </h4>
                
                <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
                  <div className="font-bold text-emerald-800">Android ফোনে (Chrome ব্রাউজার):</div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center shrink-0 text-[11px]">১</span>
                    <span>Chrome-এ লিংকটি ওপেন করে উপরে ডানদিকে <strong>⋮ মেনু</strong> থেকে <strong>"Install app"</strong> বা <strong>"Add to Home screen"</strong> ট্যাপ করুন।</span>
                  </div>
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
                  <div className="font-bold text-slate-900">Apple iPhone / iPad-এ (Safari ব্রাউজার):</div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center shrink-0 text-[11px]">১</span>
                    <span>Safari ব্রাউজারে লিংকটি ওপেন করে নিচের <strong>Share (⬆️)</strong> আইকনে ট্যাপ করুন।</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center shrink-0 text-[11px]">২</span>
                    <span>নিচে স্ক্রল করে <strong>"Add to Home Screen"</strong> নির্বাচন করে <strong>"Add"</strong> চাপুন—লোগোসহ "{APP_NAME}" অ্যাপ ইনস্টল হয়ে যাবে!</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PWABuilder DIRECT APK GENERATOR */}
          {activeTab === 'apk' && (
            <div className="space-y-4">
              <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl space-y-3 text-xs">
                <div className="flex items-center gap-3 text-indigo-950 font-bold text-sm">
                  <div className="w-11 h-11 rounded-xl bg-[#f9f9f9] border border-indigo-300 overflow-hidden shrink-0 flex items-center justify-center">
                    <img
                      src={APP_LOGO}
                      alt={APP_NAME}
                      className="w-full h-full object-contain scale-[1.38]"
                    />
                  </div>
                  <div>
                    <span className="block">"{APP_NAME}" অফিসিয়াল Android APK প্যাকেজ তৈরি ও ডাউনলোড</span>
                    <span className="text-[11px] font-normal text-indigo-700">লোগো, নাম ও অফলাইন ক্যাশ স্বয়ংক্রিয়ভাবে যুক্ত থাকবে</span>
                  </div>
                </div>

                {isInstallable && (
                  <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-emerald-950 font-semibold">
                      সরাসরি ব্রাউজার থেকে ১-ক্লিক WebAPK ইনস্টল সক্রিয় আছে:
                    </span>
                    <button
                      type="button"
                      onClick={handleInstallClick}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold inline-flex items-center justify-center gap-1.5 shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>এখনই ইনস্টল করুন</span>
                    </button>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="block font-bold text-indigo-950">
                    PWABuilder-এর জন্য পাবলিক ওয়েবসাইট লিংক:
                  </label>
                  <input
                    type="url"
                    value={apkSiteUrl}
                    onChange={(e) => setApkSiteUrl(e.target.value)}
                    placeholder={firebaseHostingUrl}
                    className="w-full px-3 py-2 bg-white border border-indigo-300 rounded-lg font-mono text-[11px] text-slate-800"
                  />
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setApkSiteUrl(firebaseHostingUrl)}
                      className="px-2 py-1 rounded bg-white border border-indigo-200 hover:bg-indigo-100 text-[10px] font-semibold text-indigo-800"
                    >
                      Firebase Hosting (সুপারিশকৃত)
                    </button>
                    {!isAiStudioOrLocal && (
                      <button
                        type="button"
                        onClick={() => setApkSiteUrl(currentOrigin)}
                        className="px-2 py-1 rounded bg-white border border-indigo-200 hover:bg-indigo-100 text-[10px] font-semibold text-indigo-800"
                      >
                        বর্তমান ডোমেইন
                      </button>
                    )}
                  </div>
                </div>

                <div className="pt-1 flex flex-wrap items-center gap-2">
                  <a
                    href={pwaBuilderUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition-colors shadow-xs"
                  >
                    <span>PWABuilder থেকে APK ডাউনলোড করুন</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                <div className="p-3 bg-white border border-indigo-200 rounded-lg text-[11px] text-slate-700 space-y-1.5 leading-relaxed">
                  <div className="font-bold text-indigo-900">APK ফাইল তৈরির সহজ ধাপসমূহ:</div>
                  <p>
                    ১. অ্যাপটি যেকোনো ফ্রি পাবলিক হোস্টিংয়ে (<strong>Vercel</strong>, <strong>Netlify</strong> বা <strong>Firebase Hosting</strong> — <code>{firebaseHostingUrl}</code>) পাবলিশ করুন।
                  </p>
                  <p>
                    ২. উপরের নীল বাটনে ক্লিক করে PWABuilder-এ গিয়ে <strong>Package For Stores → Android → Generate</strong> চাপলেই <strong>.apk + .aab</strong> জিপ ফাইল ডাউনলোড হয়ে যাবে।
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: OFFLINE SINGLE-FILE HTML */}
          {activeTab === 'offline' && (
            <div className="space-y-4 text-xs">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-amber-950 font-bold text-sm">
                  <FileCode className="w-4 h-4 text-amber-600" />
                  <span>অফলাইন সিঙ্গেল ফাইল ডাউনলোড (.html)</span>
                </div>
                <p className="text-amber-900 leading-relaxed">
                  আপনি চাইলে অ্যাপটির একটি সিঙ্গেল ফাইল ডাউনলোড করে সরাসরি আপনার ফোনের ফাইল ম্যানেজারে রাখতে পারেন। কোনো অ্যাপ স্টোর বা ইনস্টলেশন ছাড়াই ফাইলটি টাচ করলেই কাজ করবে।
                </p>
                <button
                  onClick={handleDownloadOfflineHtml}
                  className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold transition-colors flex items-center gap-2 shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>অফলাইন ফাইল (.html) ডাউনলোড করুন</span>
                </button>
              </div>
            </div>
          )}

          {/* Permanent Copy Link Box (Always visible at bottom) */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
            <span className="font-bold text-slate-700 block">
              সরাসরি ফোনের ব্রাউজারে পেস্ট করার লিংক:
            </span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={appUrl}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-mono text-slate-700 select-all"
              />
              <button
                onClick={handleCopyLink}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold whitespace-nowrap flex items-center gap-1.5 transition-colors shrink-0"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'কপি হয়েছে!' : 'কপি লিংক'}</span>
              </button>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs shrink-0">
          <span className="text-slate-500 font-medium">
            যেকোনো অ্যান্ড্রয়েড ফোন ও ট্যাবলেটে শতভাগ কাজ করবে
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg transition-colors"
          >
            বন্ধ করুন
          </button>
        </div>

      </div>
    </div>
  );
};
