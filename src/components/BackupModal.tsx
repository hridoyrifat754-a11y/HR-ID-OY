import React, { useState, useEffect, useCallback } from 'react';
import { AppDatabase, BuildingSettings } from '../types';
import { getInitialDemoDatabase } from '../constants';
import {
  CloudBackupMetadata,
  saveCloudBackupSnapshot,
  listCloudBackupSnapshots,
  deleteCloudBackupSnapshot,
} from '../services/firestoreService';
import { auth } from '../firebase';
import {
  Download,
  Upload,
  RefreshCw,
  Settings as SettingsIcon,
  X,
  FileSpreadsheet,
  Check,
  AlertTriangle,
  Building,
  Save,
  RotateCcw,
  Lock,
  Cloud,
  Trash2,
  Key,
  Eye,
  EyeOff,
  Sparkles,
  ExternalLink,
  Copy,
  CheckCircle2,
  Send,
} from 'lucide-react';
import {
  getStoredGeminiApiKey,
  saveStoredGeminiApiKey,
  clearStoredGeminiApiKey,
  maskGeminiApiKey,
  validateGeminiApiKey,
  generateBuildingAiAssistantResponse,
} from '../services/geminiService';
import { formatCurrency, formatNum, formatMonthName } from '../constants';

interface BackupModalProps {
  database: AppDatabase;
  onRestoreDatabase: (db: AppDatabase) => void;
  onUpdateSettings: (settings: BuildingSettings) => void;
  onClose: () => void;
  onResetAllToZero?: () => void;
  isOwner?: boolean;
  isFirebaseAdmin?: boolean;
  onSyncNow?: () => Promise<{ success: boolean; message: string }>;
  onOpenAdminPin?: () => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({
  database,
  onRestoreDatabase,
  onUpdateSettings,
  onClose,
  onResetAllToZero,
  isOwner = true,
  isFirebaseAdmin = false,
  onSyncNow,
  onOpenAdminPin,
}) => {
  const [settingsForm, setSettingsForm] = useState<BuildingSettings>({
    ...database.settings,
  });
  const [savedSettings, setSavedSettings] = useState(false);

  // Inline feedback & confirmation states (zero window.alert / window.confirm)
  const [statusNotice, setStatusNotice] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [pendingJsonRestore, setPendingJsonRestore] = useState<AppDatabase | null>(null);
  const [confirmDemoReset, setConfirmDemoReset] = useState(false);

  // Cloud Firestore Snapshot Backups
  const [cloudBackups, setCloudBackups] = useState<CloudBackupMetadata[]>([]);
  const [cloudLabel, setCloudLabel] = useState('');
  const [loadingCloudBackups, setLoadingCloudBackups] = useState(false);
  const [savingCloudBackup, setSavingCloudBackup] = useState(false);
  const [pendingCloudRestore, setPendingCloudRestore] = useState<CloudBackupMetadata | null>(null);

  // User's Own Gemini API Key (stored strictly in browser localStorage)
  const [storedApiKey, setStoredApiKey] = useState<string>(() => getStoredGeminiApiKey());
  const [apiKeyInput, setApiKeyInput] = useState<string>(() => getStoredGeminiApiKey());
  const [isEditingKey, setIsEditingKey] = useState<boolean>(() => !getStoredGeminiApiKey());
  const [showApiKeyText, setShowApiKeyText] = useState<boolean>(false);
  const [testingKey, setTestingKey] = useState<boolean>(false);
  const [keyFeedback, setKeyFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Smart AI Assistant state
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiResponse, setAiResponse] = useState<string>('');
  const [aiError, setAiError] = useState<string>('');
  const [copiedAiReply, setCopiedAiReply] = useState<boolean>(false);

  const showNotice = (text: string, type: 'success' | 'error' = 'success') => {
    setStatusNotice({ text, type });
    setTimeout(() => setStatusNotice(null), 4000);
  };

  const loadCloudBackups = useCallback(async () => {
    if (!isFirebaseAdmin) return;
    setLoadingCloudBackups(true);
    try {
      const list = await listCloudBackupSnapshots();
      setCloudBackups(list);
    } catch (err: any) {
      showNotice(err?.message || 'ক্লাউড ব্যাকআপ তালিকা লোড করতে সমস্যা হয়েছে।', 'error');
    } finally {
      setLoadingCloudBackups(false);
    }
  }, [isFirebaseAdmin]);

  useEffect(() => {
    loadCloudBackups();
  }, [loadCloudBackups]);

  // Save new Cloud Backup Snapshot to Firestore
  const handleSaveCloudBackup = async () => {
    if (!isFirebaseAdmin || !auth.currentUser) {
      onOpenAdminPin?.();
      return;
    }
    setSavingCloudBackup(true);
    try {
      const defaultLabel = `স্ন্যাপশট ${new Date().toLocaleDateString('bn-BD')} (${database.bills.length} বিল)`;
      const created = await saveCloudBackupSnapshot(
        cloudLabel.trim() || defaultLabel,
        database,
        auth.currentUser.uid
      );
      setCloudBackups((prev) => [created, ...prev]);
      setCloudLabel('');
      showNotice('Firebase Cloud Firestore-এ ব্যাকআপ সফলভাবে সংরক্ষিত হয়েছে!', 'success');
    } catch (err: any) {
      showNotice(err?.message || 'ক্লাউড ব্যাকআপ সংরক্ষণ ব্যর্থ হয়েছে।', 'error');
    } finally {
      setSavingCloudBackup(false);
    }
  };

  // Delete Cloud Backup Snapshot
  const handleDeleteCloudBackup = async (id: string) => {
    try {
      await deleteCloudBackupSnapshot(id);
      setCloudBackups((prev) => prev.filter((b) => b.id !== id));
      showNotice('ক্লাউড ব্যাকআপ মুছে ফেলা হয়েছে।', 'success');
    } catch (err: any) {
      showNotice(err?.message || 'মুছে ফেলতে সমস্যা হয়েছে।', 'error');
    }
  };

  // Backup JSON download
  const handleDownloadBackup = () => {
    const dataStr = JSON.stringify(database, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alam-khan-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotice('JSON ব্যাকআপ ফাইল ডাউনলোড শুরু হয়েছে!', 'success');
  };

  // Restore JSON upload (staged with inline confirmation)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!Array.isArray(parsed.rooms) || !Array.isArray(parsed.bills) || !Array.isArray(parsed.shared)) {
          showNotice('ব্যাকআপ ফাইলটি সঠিক নয়! rooms, bills, অথবা shared ডেটা অনুপস্থিত।', 'error');
          return;
        }
        setPendingJsonRestore({
          rooms: parsed.rooms,
          bills: parsed.bills,
          shared: parsed.shared,
          payments: parsed.payments || [],
          loginApprovals: parsed.loginApprovals || [],
          complaints: parsed.complaints || [],
          settings: parsed.settings || database.settings,
        });
      } catch {
        showNotice('ফাইলটি পড়া সম্ভব হয়নি। সঠিক JSON ফাইল দিন।', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Export CSV for Excel
  const handleExportCSV = () => {
    const headers = [
      'Room No',
      'Floor',
      'Tenant Name',
      'Phone',
      'Rent',
      'Month',
      'Prev Reading',
      'Now Reading',
      'Own Units',
      'Own Electricity Cost',
      'Shared Electricity',
      'Other Charges',
      'Total Bill',
      'Paid',
      'Due',
    ];

    const rows = database.bills.map((b) => [
      b.roomNo,
      b.floor,
      `"${b.tenantName}"`,
      `"${b.tenantPhone || ''}"`,
      b.rent,
      b.month,
      b.prev,
      b.now,
      b.units,
      b.electricityCost,
      b.sharedElectricity,
      b.other,
      b.total,
      b.paid,
      b.due,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `alam-khan-bills-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotice('এক্সেল (CSV) ডাউনলোড সম্পন্ন হয়েছে!', 'success');
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings(settingsForm);
    setSavedSettings(true);
    setTimeout(() => setSavedSettings(false), 2000);
  };

  const handleSaveApiKey = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = apiKeyInput.trim();
    if (!clean) {
      setKeyFeedback({
        text: 'অনুগ্রহ করে আপনার Gemini API Key পেস্ট করুন।',
        type: 'error',
      });
      return;
    }
    const ok = saveStoredGeminiApiKey(clean);
    if (!ok) {
      setKeyFeedback({
        text: 'ব্রাউজার localStorage-এ সংরক্ষণ করা যায়নি (Private Mode বা Storage বন্ধ থাকতে পারে)।',
        type: 'error',
      });
      return;
    }
    setStoredApiKey(clean);
    setIsEditingKey(false);
    setShowApiKeyText(false);
    setAiError('');
    setKeyFeedback({
      text: 'আপনার Gemini API Key ব্রাউজারে সফলভাবে সেভ হয়েছে!',
      type: 'success',
    });
  };

  const handleTestApiKey = async () => {
    const candidate = (isEditingKey ? apiKeyInput : storedApiKey).trim();
    if (!candidate) {
      setKeyFeedback({
        text: 'প্রথমে আপনার Gemini API Key বক্সে লিখুন।',
        type: 'error',
      });
      return;
    }
    setTestingKey(true);
    setKeyFeedback(null);
    const res = await validateGeminiApiKey(candidate);
    setTestingKey(false);
    if (res.ok) {
      saveStoredGeminiApiKey(candidate);
      setStoredApiKey(candidate);
      setApiKeyInput(candidate);
      setIsEditingKey(false);
      setAiError('');
      setKeyFeedback({
        text: 'API Key যাচাই সফল! Gemini AI সংযোগ সক্রিয় রয়েছে।',
        type: 'success',
      });
    } else {
      setKeyFeedback({
        text: res.error || 'API Key যাচাই করা যায়নি।',
        type: 'error',
      });
    }
  };

  const handleDeleteApiKey = () => {
    clearStoredGeminiApiKey();
    setStoredApiKey('');
    setApiKeyInput('');
    setIsEditingKey(true);
    setAiResponse('');
    setAiError('');
    setKeyFeedback({
      text: 'সংরক্ষিত Gemini API Key ব্রাউজার থেকে মুছে ফেলা হয়েছে।',
      type: 'success',
    });
  };

  const buildSafeAiContextSummary = () => {
    const useBn = database.settings.useBengaliDigits;
    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthBills = database.bills.filter((b) => b.month === currentMonth);
    const monthShared = database.shared.filter((s) => s.month === currentMonth);

    const lines = [
      `ভবন: ${database.settings.buildingName}`,
      `কর্তৃপক্ষ: ${database.settings.landlordName} (${database.settings.landlordPhone})`,
      `মাস: ${formatMonthName(currentMonth, useBn)}`,
      `মোট রুম সংখ্যা: ${formatNum(35, useBn)} (২য় হতে ৭ম তলা)`,
      `ডিফল্ট বিদ্যুৎ দর: ${formatNum(database.settings.defaultUnitRate, useBn)} টাকা/ইউনিট`,
      `যৌথ ডাইনিং ও বাথরুম সাব-মিটার নিয়ম: রুম ৭ হতে ৩৪ (২৮টি রুম) অনুযায়ী সমানভাগে বণ্টিত।`,
    ];

    if (isOwner) {
      const occupied = database.rooms.filter((r) => r.isOccupied).length;
      const totalBilled = monthBills.reduce((s, b) => s + b.total, 0);
      const totalPaid = monthBills.reduce((s, b) => s + b.paid, 0);
      const totalDue = monthBills.reduce((s, b) => s + b.due, 0);
      const sharedTotal = monthShared.reduce((s, x) => s + x.amount, 0);
      lines.push(
        `ভাড়াটিয়া রুম: ${formatNum(occupied, useBn)}টি সক্রিয়, ${formatNum(35 - occupied, useBn)}টি খালি`,
        `চলতি মাসের মোট বিল: ${formatCurrency(totalBilled, useBn)}`,
        `মোট আদায়: ${formatCurrency(totalPaid, useBn)}, মোট বকেয়া: ${formatCurrency(totalDue, useBn)}`,
        `চলতি মাসের যৌথ ডাইনিং মিটার খরচ: ${formatCurrency(sharedTotal, useBn)}`
      );
    } else {
      lines.push('নোট: সাধারণ দর্শক মোডে ব্যক্তিগত ভাড়াটিয়ার তথ্য গোপন রাখা হয়েছে।');
    }

    return lines.join('\n');
  };

  const handleRunAiAssistant = async (overridePrompt?: string) => {
    const query = (overridePrompt ?? aiPrompt).trim();
    if (!query) {
      setAiError('অনুগ্রহ করে আপনার প্রশ্ন বা কাজের নির্দেশনা লিখুন।');
      return;
    }
    if (!storedApiKey) {
      setIsEditingKey(true);
      setAiError('AI সহায়তা ব্যবহার করতে প্রথমে উপরে আপনার নিজের ফ্রি Gemini API Key সেভ করুন।');
      return;
    }
    if (overridePrompt) setAiPrompt(overridePrompt);
    setAiLoading(true);
    setAiError('');
    const res = await generateBuildingAiAssistantResponse({
      prompt: query,
      contextSummary: buildSafeAiContextSummary(),
      apiKeyOverride: storedApiKey,
    });
    setAiLoading(false);
    if (res.ok && res.text) {
      setAiResponse(res.text);
    } else {
      if (res.needsKey) setIsEditingKey(true);
      setAiError(res.error || 'AI উত্তর তৈরি করা যায়নি।');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4">
      <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-4 sm:my-6 max-h-[94dvh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 sm:py-4 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <SettingsIcon className="w-5 h-5 text-blue-400 shrink-0" />
            <h3 className="font-bold text-sm sm:text-base truncate">সেটিংস, Gemini API Key ও ব্যাকআপ</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors shrink-0"
            aria-label="বন্ধ করুন"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-6 overflow-y-auto flex-1">
          
          {statusNotice && (
            <div
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold border ${
                statusNotice.type === 'success'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-rose-50 border-rose-300 text-rose-900'
              }`}
            >
              {statusNotice.text}
            </div>
          )}

          {/* User's Own Gemini API Key (BYO Key in localStorage) + Smart Assistant */}
          <div className="p-4 bg-gradient-to-br from-indigo-50/90 via-white to-sky-50/80 border border-indigo-200 rounded-xl space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-bold text-indigo-950">
                <Key className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>ব্যক্তিগত Gemini API Key (নিজস্ব ব্যবহার)</span>
              </div>
              {storedApiKey ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-md text-[11px] font-bold">
                  <CheckCircle2 className="w-3 h-3" />
                  সংযুক্ত ({maskGeminiApiKey(storedApiKey)})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-md text-[11px] font-bold">
                  API Key সেট করা নেই
                </span>
              )}
            </div>

            {!storedApiKey && (
              <div className="p-3 bg-white border border-indigo-200/80 rounded-lg text-xs text-slate-700 space-y-1.5 leading-relaxed">
                <div className="font-bold text-indigo-900">
                  ফ্রি Gemini API Key কীভাবে পাবেন ও ব্যবহার করবেন:
                </div>
                <p>
                  ১.{' '}
                  <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-700 hover:underline font-bold"
                  >
                    <span>Google AI Studio (aistudio.google.com/apikey)</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>{' '}
                  থেকে সম্পূর্ণ বিনামূল্যে আপনার নিজের API Key তৈরি করে কপি করুন।
                </p>
                <p>
                  ২. নিচের বক্সে Key-টি বসিয়ে <strong>সংরক্ষণ করুন</strong> চাপুন। আপনার Key কেবল আপনার ব্রাউজারের <code className="px-1 bg-slate-100 rounded">localStorage</code>-এ সেভ থাকবে।
                </p>
              </div>
            )}

            {keyFeedback && (
              <div
                className={`px-3 py-2 rounded-lg text-xs font-semibold border ${
                  keyFeedback.type === 'success'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : 'bg-rose-50 border-rose-300 text-rose-900'
                }`}
              >
                {keyFeedback.text}
              </div>
            )}

            {isEditingKey || !storedApiKey ? (
              <form onSubmit={handleSaveApiKey} className="space-y-2.5">
                <div className="relative">
                  <input
                    type={showApiKeyText ? 'text' : 'password'}
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="AIzaSy... আপনার Gemini API Key এখানে পেস্ট করুন"
                    autoComplete="off"
                    spellCheck={false}
                    className="w-full pr-10 pl-3 py-2.5 text-xs font-mono bg-white border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKeyText((v) => !v)}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-700 p-1"
                    title={showApiKeyText ? 'লুকান' : 'দেখুন'}
                  >
                    {showApiKeyText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>API Key সংরক্ষণ করুন</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleTestApiKey}
                    disabled={testingKey}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-indigo-800 border border-indigo-300 rounded-lg text-xs font-bold transition-colors disabled:opacity-60"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${testingKey ? 'animate-spin' : ''}`} />
                    <span>{testingKey ? 'যাচাই হচ্ছে...' : 'সংযোগ যাচাই (Test)'}</span>
                  </button>
                  {storedApiKey && (
                    <button
                      type="button"
                      onClick={() => {
                        setApiKeyInput(storedApiKey);
                        setIsEditingKey(false);
                        setKeyFeedback(null);
                      }}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
                    >
                      বাতিল
                    </button>
                  )}
                </div>
              </form>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-white border border-indigo-200 rounded-lg text-xs">
                <div className="font-mono text-slate-700 truncate">
                  {showApiKeyText ? storedApiKey : maskGeminiApiKey(storedApiKey)}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowApiKeyText((v) => !v)}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold inline-flex items-center gap-1"
                  >
                    {showApiKeyText ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    <span>{showApiKeyText ? 'লুকান' : 'দেখুন'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleTestApiKey}
                    disabled={testingKey}
                    className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded font-semibold"
                  >
                    {testingKey ? 'যাচাই হচ্ছে...' : 'Test'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setApiKeyInput(storedApiKey);
                      setIsEditingKey(true);
                      setKeyFeedback(null);
                    }}
                    className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded font-semibold"
                  >
                    পরিবর্তন
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteApiKey}
                    className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded font-semibold inline-flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>মুছুন</span>
                  </button>
                </div>
              </div>
            )}

            <p className="text-[11px] text-slate-500 leading-relaxed">
              নিরাপত্তা নোট: আপনার API Key শুধুমাত্র এই ডিভাইসের ব্রাউজারে সেভ থাকে এবং সরাসরি আপনার ব্রাউজার থেকে Gemini API-তে ব্যবহৃত হয়। তাই পাবলিক বা অন্যের কম্পিউটারে ব্যবহার করলে কাজ শেষে "মুছুন" চাপুন। (API Key ছাড়াও অ্যাপের সব মূল ভাড়া ও বিলিং ফিচার সম্পূর্ণ চালু থাকবে।)
            </p>

            {/* Optional Smart Bengali Assistant powered by user's key */}
            <div className="pt-2.5 border-t border-indigo-200/70 space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>স্মার্ট বাংলা AI সহায়ক (নোটিশ ও বিল সারাংশ)</span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {[
                  'এই মাসের ভাড়া ও বিদ্যুৎ বিল জমা দেওয়ার একটি ভদ্র নোটিশ লিখে দাও।',
                  'বকেয়া বিল পরিশোধের জন্য সংক্ষিপ্ত হোয়াটসঅ্যাপ রিমাইন্ডার মেসেজ লিখে দাও।',
                  'রুম ৭–৩৪ যৌথ ডাইনিং সাব-মিটারের হিসাবের নিয়ম সহজভাবে ব্যাখ্যা করে দাও।',
                ].map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    disabled={aiLoading}
                    onClick={() => handleRunAiAssistant(preset)}
                    className="px-2.5 py-1 bg-white hover:bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-lg text-[11px] font-medium transition-colors text-left"
                  >
                    {idx === 0
                      ? '📝 মাসিক ভাড়ার নোটিশ'
                      : idx === 1
                      ? '💬 বকেয়া রিমাইন্ডার'
                      : '⚡ ডাইনিং মিটার নিয়ম'}
                  </button>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleRunAiAssistant();
                    }
                  }}
                  placeholder="যেকোনো প্রশ্ন বা বাংলা নোটিশ লেখার নির্দেশ দিন..."
                  className="flex-1 px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleRunAiAssistant()}
                  disabled={aiLoading}
                  className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded-lg text-xs font-bold inline-flex items-center justify-center gap-1.5 shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{aiLoading ? 'লিখছে...' : 'AI-কে বলুন'}</span>
                </button>
              </div>

              {aiError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 font-medium">
                  {aiError}
                </div>
              )}

              {aiResponse && (
                <div className="p-3 bg-white border border-indigo-200 rounded-lg space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-indigo-900">AI উত্তর:</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(aiResponse);
                        setCopiedAiReply(true);
                        setTimeout(() => setCopiedAiReply(false), 2000);
                      }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 rounded text-[11px] font-semibold"
                    >
                      {copiedAiReply ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedAiReply ? 'কপি হয়েছে' : 'কপি'}</span>
                    </button>
                  </div>
                  <div className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                    {aiResponse}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Staged JSON File Restore Confirmation */}
          {pendingJsonRestore && (
            <div className="p-4 bg-blue-50 border border-blue-300 rounded-xl space-y-2.5 text-xs">
              <div className="font-bold text-blue-950">
                ব্যাকআপ ফাইল রিস্টোর নিশ্চিত করুন ({pendingJsonRestore.rooms.length} রুম · {pendingJsonRestore.bills.length} বিল)
              </div>
              <p className="text-blue-900">
                বর্তমান সমস্ত ডেটার পরিবর্তে নির্বাচিত ব্যাকআপ ফাইলের তথ্য রিস্টোর ও ক্লাউডে সিঙ্ক হবে।
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onRestoreDatabase(pendingJsonRestore);
                    setPendingJsonRestore(null);
                    showNotice('ব্যাকআপ থেকে ডেটা সফলভাবে রিস্টোর ও সিঙ্ক হয়েছে!', 'success');
                  }}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold"
                >
                  হ্যাঁ, রিস্টোর করুন
                </button>
                <button
                  type="button"
                  onClick={() => setPendingJsonRestore(null)}
                  className="px-3.5 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg font-semibold"
                >
                  বাতিল
                </button>
              </div>
            </div>
          )}

          {/* Firebase Cloud Backup & Point-in-Time Restore */}
          {isOwner && (
            <div className="p-4 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-xl border border-slate-700 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-bold text-cyan-300">
                  <Cloud className="w-4 h-4 text-cyan-400" />
                  <span>Firebase Cloud Firestore ব্যাকআপ ও রিস্টোর</span>
                </div>
                {onSyncNow && (
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await onSyncNow();
                      showNotice(res.message, res.success ? 'success' : 'error');
                    }}
                    className="px-2.5 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border border-cyan-400/40 rounded-lg text-[11px] font-bold"
                  >
                    এখনই সিঙ্ক করুন
                  </button>
                )}
              </div>

              {!isFirebaseAdmin ? (
                <div className="p-3 bg-slate-800/80 border border-slate-600 rounded-lg text-xs text-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span>অনলাইন ক্লাউড স্ন্যাপশট সেভ ও রিস্টোর করতে Google এডমিন অ্যাকাউন্ট কানেক্ট করুন।</span>
                  {onOpenAdminPin && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenAdminPin();
                      }}
                      className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-lg font-bold text-[11px] shrink-0"
                    >
                      Google এডমিন লগইন
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={cloudLabel}
                      onChange={(e) => setCloudLabel(e.target.value)}
                      placeholder="ব্যাকআপের নাম (যেমন: নভেম্বর ২০২৬ মাসিক ব্যাকআপ)"
                      className="flex-1 px-3 py-2 text-xs bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 outline-none focus:border-cyan-400"
                    />
                    <button
                      type="button"
                      onClick={handleSaveCloudBackup}
                      disabled={savingCloudBackup}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shrink-0"
                    >
                      <Cloud className="w-3.5 h-3.5" />
                      <span>{savingCloudBackup ? 'সংরক্ষণ হচ্ছে...' : 'নতুন ক্লাউড ব্যাকআপ'}</span>
                    </button>
                  </div>

                  {pendingCloudRestore && (
                    <div className="p-3 bg-amber-950/80 border border-amber-500/50 rounded-lg text-xs space-y-2">
                      <div className="font-bold text-amber-200">
                        "{pendingCloudRestore.label}" থেকে সম্পূর্ণ ডাটাবেজ রিস্টোর করবেন?
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            onRestoreDatabase(pendingCloudRestore.snapshot);
                            setPendingCloudRestore(null);
                            showNotice('ক্লাউড স্ন্যাপশট থেকে ডেটা সফলভাবে রিস্টোর হয়েছে!', 'success');
                          }}
                          className="px-3 py-1 bg-amber-500 text-slate-950 rounded font-bold"
                        >
                          হ্যাঁ, রিস্টোর করুন
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingCloudRestore(null)}
                          className="px-3 py-1 bg-slate-700 text-slate-200 rounded font-semibold"
                        >
                          বাতিল
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {loadingCloudBackups ? (
                      <div className="text-[11px] text-slate-400 py-2">ক্লাউড ব্যাকআপ লোড হচ্ছে...</div>
                    ) : cloudBackups.length === 0 ? (
                      <div className="text-[11px] text-slate-400 py-1">
                        এখনও কোনো ক্লাউড ব্যাকআপ সেভ করা হয়নি।
                      </div>
                    ) : (
                      cloudBackups.map((b) => (
                        <div
                          key={b.id}
                          className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-800/90 border border-slate-700 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="font-bold text-slate-100 truncate">{b.label}</div>
                            <div className="text-[10px] text-slate-400">
                              {new Date(b.createdAt).toLocaleString('bn-BD')} · {b.roomsCount} রুম · {b.billsCount} বিল
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => setPendingCloudRestore(b)}
                              className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-[11px] font-bold"
                            >
                              রিস্টোর
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCloudBackup(b.id)}
                              className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-950/60 rounded"
                              title="মুছুন"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Building & Landlord Settings Form */}
          <form onSubmit={handleSaveSettings} className="space-y-4">
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-2">
              <Building className="w-4 h-4 text-blue-600" />
              <span>বাড়ি ও বাড়িওয়ালার বিবরণ (রসিদে প্রদর্শিত হবে)</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  বাড়ির নাম / টাইটেল
                </label>
                <input
                  type="text"
                  value={settingsForm.buildingName}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, buildingName: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  বাড়ির ঠিকানা
                </label>
                <input
                  type="text"
                  value={settingsForm.buildingAddress}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, buildingAddress: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  বাড়িওয়ালার নাম
                </label>
                <input
                  type="text"
                  value={settingsForm.landlordName}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, landlordName: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  বাড়িওয়ালার মোবাইল
                </label>
                <input
                  type="text"
                  value={settingsForm.landlordPhone}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, landlordPhone: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ডিফল্ট বিদ্যুৎ দর (প্রতি ইউনিট ৳)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={settingsForm.defaultUnitRate}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      defaultUnitRate: parseFloat(e.target.value) || 12,
                    })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  সংখ্যার ধরণ (Numeral Format)
                </label>
                <select
                  value={settingsForm.useBengaliDigits ? 'bn' : 'en'}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      useBengaliDigits: e.target.value === 'bn',
                    })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white font-medium"
                >
                  <option value="bn">বাংলা সংখ্যা (যেমন: ১২৩৪৫ ৳)</option>
                  <option value="en">English Digits (e.g. 12345 ৳)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              {isOwner ? (
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
                >
                  {savedSettings ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                  <span>{savedSettings ? 'সংরক্ষিত হয়েছে!' : 'সেটিংস সংরক্ষণ'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onOpenAdminPin}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg text-xs font-semibold transition-colors shadow-xs"
                >
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>সেটিংস এডিট করতে কর্তৃপক্ষ পিন আনলক করুন</span>
                </button>
              )}
            </div>
          </form>

          {/* Local JSON Backup & Export Section */}
          <div className="space-y-3 pt-3 border-t border-slate-200">
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Download className="w-4 h-4 text-emerald-600" />
              <span>ফাইল ব্যাকআপ ও এক্সেল এক্সপোর্ট</span>
            </h4>
            <p className="text-xs text-slate-500">
              আপনার সমস্ত রুম, ভাড়াটিয়া, মিটার রিডিং এবং বিলসমূহ নিরাপদে JSON ব্যাকআপ ফাইল হিসেবে সংরক্ষণ বা রিস্টোর করুন।
            </p>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                onClick={handleDownloadBackup}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>JSON ব্যাকআপ ডাউনলোড</span>
              </button>

              <label className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-lg text-xs font-medium transition-colors cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>ব্যাকআপ রিস্টোর করুন</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              <button
                onClick={handleExportCSV}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-medium transition-colors"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>এক্সেল (CSV) ডাউনলোড</span>
              </button>
            </div>
          </div>

          {/* Mobile App (Android APK / PWA) Information */}
          <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2 text-xs">
            <div className="flex items-center gap-2 text-blue-900 font-bold">
              <span>📱 মোবাইল অ্যাপ (Android PWA / Standalone App):</span>
            </div>
            <p className="text-slate-600">
              এই অ্যাপটি অ্যান্ড্রয়েড ফোনে Standalone অ্যাপ হিসেবে চলার জন্য প্রস্তুত। ভবিষ্যতে নতুন কোনো ফিচার যোগ হলে APK পুনরায় ইনস্টল না করেই স্বয়ংক্রিয়ভাবে আপডেট হয়ে যাবে।
            </p>
          </div>

          {/* Reset All Balances to Zero for Fresh Start */}
          {isOwner && onResetAllToZero && (
            <div className="p-3.5 bg-rose-50/70 border border-rose-200 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-rose-900 font-bold text-xs">
                <RotateCcw className="w-4 h-4 text-rose-600 shrink-0" />
                <span>সকল টাকার অংক শূন্য (০) করুন — নতুন শুরু</span>
              </div>
              <p className="text-[11px] text-rose-800">
                পূর্বের সকল টেস্ট বা নমুনা বিল ও টাকার হিসাব মুছে ব্যালেন্স শূন্য (০) করুন।
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onResetAllToZero();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>সকল হিসাব শূন্য (০) করুন</span>
              </button>
            </div>
          )}

          {/* Reset Demo Data Section (inline confirmation) */}
          {isOwner && (
            <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>ডেমো ডেটা রিলোড (Reset to Default Demo)</span>
              </div>
              <p className="text-[11px] text-amber-800">
                আপনি যদি প্রাথমিক ৩৫ রুমের নমুনা ভাড়াটিয়া ও মিটার হিসাব দেখতে চান, তবে এটি রিলোড করতে পারেন।
              </p>
              {confirmDemoReset ? (
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const demo = getInitialDemoDatabase();
                      onRestoreDatabase(demo);
                      setConfirmDemoReset(false);
                      showNotice('নমুনা ডেমো ডেটা সফলভাবে লোড হয়েছে!', 'success');
                    }}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold"
                  >
                    নিশ্চিত করুন (ডেমো লোড)
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDemoReset(false)}
                    className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold"
                  >
                    বাতিল
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDemoReset(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>নমুনা ৩৫ রুম ডেমো রিলোড</span>
                </button>
              )}
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
