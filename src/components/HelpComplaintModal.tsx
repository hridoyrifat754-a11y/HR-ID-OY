import React, { useState } from 'react';
import {
  Phone,
  MessageCircle,
  Send,
  X,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Wrench,
  Zap,
  Droplets,
  Receipt,
  Sparkles,
  MessageSquare,
  Headphones,
  ShieldCheck,
  LogIn,
} from 'lucide-react';
import { AuthSession, BuildingSettings, ComplaintRecord, Room } from '../types';
import {
  HRIDOY_HELP_MESSAGE,
  SUPPORT_PHONES,
  buildWhatsAppUrl,
  ROOM_FLOOR_MAP,
  FLOOR_NAMES_BN,
  formatNum,
} from '../constants';

interface HelpComplaintModalProps {
  isOpen: boolean;
  onClose: () => void;
  authSession: AuthSession;
  isOwner: boolean;
  rooms: Room[];
  complaints: ComplaintRecord[];
  settings: BuildingSettings;
  onSubmitComplaint: (
    payload: Omit<ComplaintRecord, 'id' | 'status' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onReplyComplaint: (
    id: string,
    status: 'pending' | 'in_progress' | 'resolved',
    adminReply?: string
  ) => Promise<void>;
  onOpenUserLogin: () => void;
}

const CATEGORY_LABELS: Record<ComplaintRecord['category'], string> = {
  electricity: 'বিদ্যুৎ / মিটার সমস্যা',
  water: 'পানি / প্লাম্বিং সমস্যা',
  repair: 'রুম মেরামত / তালা-দরজা',
  billing: 'ভাড়া / বিল সংক্রান্ত',
  cleanliness: 'পরিষ্কার-পরিচ্ছন্নতা',
  other: 'অন্যান্য সমস্যা / প্রশ্ন',
};

export const HelpComplaintModal: React.FC<HelpComplaintModalProps> = ({
  isOpen,
  onClose,
  authSession,
  isOwner,
  rooms,
  complaints,
  settings,
  onSubmitComplaint,
  onReplyComplaint,
  onOpenUserLogin,
}) => {
  const useBn = settings.useBengaliDigits;
  const [activeView, setActiveView] = useState<'new' | 'history'>(
    isOwner ? 'history' : 'new'
  );

  // Complaint Form State
  const defaultRoomNo =
    authSession.role === 'tenant' && authSession.roomNo ? authSession.roomNo : 1;
  const [roomNo, setRoomNo] = useState<number>(defaultRoomNo);
  const [tenantName, setTenantName] = useState<string>(
    authSession.isLoggedIn && authSession.role === 'tenant' ? authSession.name : ''
  );
  const [phone, setPhone] = useState<string>(
    authSession.isLoggedIn && authSession.phone ? authSession.phone : ''
  );
  const [category, setCategory] = useState<ComplaintRecord['category']>('electricity');
  const [priority, setPriority] = useState<ComplaintRecord['priority']>('normal');
  const [subject, setSubject] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submittedNotice, setSubmittedNotice] = useState<boolean>(false);

  // Admin Reply Draft State
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replySavingId, setReplySavingId] = useState<string | null>(null);

  if (!isOpen) return null;

  const selectedRoomObj = rooms.find((r) => r.no === Number(roomNo));
  const resolvedRoomNo =
    authSession.role === 'tenant' && authSession.roomNo ? authSession.roomNo : roomNo;
  const resolvedTenantName =
    tenantName.trim() ||
    (authSession.role === 'tenant' ? authSession.name : '') ||
    selectedRoomObj?.name ||
    `রুম ${resolvedRoomNo} ভাড়াটিয়া`;
  const resolvedPhone =
    phone.trim() ||
    (authSession.role === 'tenant' ? authSession.phone || '' : '') ||
    selectedRoomObj?.phone ||
    '';

  const whatsappDirectUrl = buildWhatsAppUrl(
    SUPPORT_PHONES[0],
    `আসসালামু আলাইকুম হৃদয় ভাই,\nআমি ${settings.buildingName}-এর ${
      authSession.role === 'tenant' && authSession.roomNo
        ? `রুম ${authSession.roomNo} (${resolvedTenantName})`
        : resolvedTenantName
    } বলছি। আমার একটি জরুরি তথ্য/সহায়তা প্রয়োজন।`
  );

  // Filter complaints based on role: Admin sees all, Tenant sees own room's complaints
  const visibleComplaints = isOwner
    ? complaints
    : authSession.role === 'tenant' && authSession.roomNo
    ? complaints.filter((c) => Number(c.roomNo) === Number(authSession.roomNo))
    : [];

  const pendingCount = complaints.filter((c) => c.status !== 'resolved').length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setSubmitting(true);
    await onSubmitComplaint({
      roomNo: Number(resolvedRoomNo) || 0,
      tenantName: resolvedTenantName,
      phone: resolvedPhone,
      category,
      priority,
      subject: subject.trim() || CATEGORY_LABELS[category],
      message: message.trim(),
    });
    setSubmitting(false);
    setSubject('');
    setMessage('');
    setSubmittedNotice(true);
    setTimeout(() => {
      setSubmittedNotice(false);
      setActiveView('history');
    }, 1200);
  };

  const handleAdminReply = async (
    c: ComplaintRecord,
    status: 'pending' | 'in_progress' | 'resolved'
  ) => {
    setReplySavingId(c.id);
    const replyText = replyDrafts[c.id] !== undefined ? replyDrafts[c.id] : c.adminReply;
    await onReplyComplaint(c.id, status, replyText);
    setReplySavingId(null);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-4 max-h-[94vh] flex flex-col font-sans">

        {/* Top Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center shrink-0 shadow-xs">
              <Headphones className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base flex items-center gap-2">
                <span>২৪/৭ হেল্প ও সরাসরি অভিযোগ কেন্দ্র</span>
                <span className="text-[10px] px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 rounded-full">
                  24/7 Active
                </span>
              </h3>
              <p className="text-[11px] text-slate-300">
                এডমিন: <strong className="text-white">{settings.landlordName} ({settings.landlordTitle && !settings.landlordTitle.includes('পরিচালক') ? settings.landlordTitle : 'কর্তৃপক্ষ'})</strong> · মোবাইল: 01939022271 / 09638194963
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

        {/* 24/7 Admin Direct Contact Strip */}
        <div className="p-4 bg-gradient-to-br from-emerald-50 via-teal-50/70 to-sky-50 border-b border-emerald-200 shrink-0 space-y-2.5">
          <div className="flex items-start gap-2.5 text-xs">
            <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-slate-900 text-sm">
                এডমিনের নাম: {settings.landlordName} ({settings.landlordTitle && !settings.landlordTitle.includes('পরিচালক') ? settings.landlordTitle : 'কর্তৃপক্ষ'})
              </div>
              <p className="text-slate-700 leading-relaxed text-[11.5px] mt-0.5">
                {HRIDOY_HELP_MESSAGE}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {SUPPORT_PHONES.map((num) => (
              <a
                key={num}
                href={`tel:${num}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-xl font-mono font-bold text-xs shadow-2xs transition-colors"
              >
                <Phone className="w-3.5 h-3.5 text-emerald-600" />
                <span>কল করুন: {num}</span>
              </a>
            ))}
            <a
              href={whatsappDirectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#25D366] hover:bg-[#1fb857] text-slate-950 rounded-xl font-bold text-xs shadow-xs transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>WhatsApp-এ সরাসরি মেসেজ</span>
            </a>
          </div>
        </div>

        {/* View Switcher */}
        <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-semibold shrink-0">
          <button
            onClick={() => setActiveView('new')}
            className={`flex-1 py-2.5 text-center border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
              activeView === 'new'
                ? 'border-indigo-600 text-indigo-700 bg-white font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>নতুন অভিযোগ / বার্তা পাঠান</span>
          </button>
          <button
            onClick={() => setActiveView('history')}
            className={`flex-1 py-2.5 text-center border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
              activeView === 'history'
                ? 'border-indigo-600 text-indigo-700 bg-white font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>
              {isOwner
                ? `সকল অভিযোগ তালিকা (${formatNum(pendingCount, useBn)} চলমান)`
                : `আমার অভিযোগ ও উত্তর (${formatNum(visibleComplaints.length, useBn)})`}
            </span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {activeView === 'new' ? (
            <form onSubmit={handleSubmit} className="space-y-3.5">
              {!authSession.isLoggedIn && (
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs flex flex-wrap items-center justify-between gap-2">
                  <span className="text-indigo-900">
                    আপনি চাইলে আপনার রুম নম্বর দিয়ে ১-ক্লিকে লগইন করেও অভিযোগ করতে পারেন:
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenUserLogin();
                    }}
                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-[11px] flex items-center gap-1"
                  >
                    <LogIn className="w-3 h-3" />
                    <span>ভাড়াটিয়া লগইন</span>
                  </button>
                </div>
              )}

              {submittedNotice && (
                <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-800 font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>আপনার অভিযোগ/বার্তা সরাসরি কর্তৃপক্ষ হৃদয়-এর কাছে পাঠানো হয়েছে!</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    রুম নম্বর:
                  </label>
                  <select
                    value={resolvedRoomNo}
                    onChange={(e) => setRoomNo(Number(e.target.value))}
                    disabled={authSession.role === 'tenant' && Boolean(authSession.roomNo)}
                    className="w-full px-3 py-2 text-xs font-bold border border-slate-300 rounded-xl bg-white disabled:bg-slate-100"
                  >
                    {Array.from({ length: 35 }, (_, i) => i + 1).map((no) => (
                      <option key={no} value={no}>
                        রুম {formatNum(no, useBn)} ({FLOOR_NAMES_BN[ROOM_FLOOR_MAP[no] || 2]})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    আপনার নাম:
                  </label>
                  <input
                    type="text"
                    value={resolvedTenantName}
                    onChange={(e) => setTenantName(e.target.value)}
                    placeholder="ভাড়াটিয়ার নাম"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    মোবাইল নম্বর:
                  </label>
                  <input
                    type="tel"
                    value={resolvedPhone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="01XXXXXXXXX"
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    সমস্যার ধরন:
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ComplaintRecord['category'])}
                    className="w-full px-3 py-2 text-xs font-semibold border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="electricity">⚡ বিদ্যুৎ / মিটার সমস্যা</option>
                    <option value="water">💧 পানি / প্লাম্বিং সমস্যা</option>
                    <option value="repair">🔧 রুম মেরামত / তালা-দরজা</option>
                    <option value="billing">🧾 ভাড়া / বিল সংক্রান্ত</option>
                    <option value="cleanliness">🧹 পরিষ্কার-পরিচ্ছন্নতা</option>
                    <option value="other">💬 অন্যান্য সমস্যা / প্রশ্ন</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    জরুরি অবস্থা:
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPriority('normal')}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors ${
                        priority === 'normal'
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-slate-700 border-slate-300'
                      }`}
                    >
                      সাধারণ
                    </button>
                    <button
                      type="button"
                      onClick={() => setPriority('urgent')}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center gap-1 ${
                        priority === 'urgent'
                          ? 'bg-rose-600 text-white border-rose-600'
                          : 'bg-white text-rose-700 border-rose-300'
                      }`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>জরুরি</span>
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  বিষয় (সংক্ষেপে):
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="যেমন: রুমের লাইট/পানির লাইনে সমস্যা অথবা বিল সংক্রান্ত প্রশ্ন"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  বিস্তারিত অভিযোগ বা বার্তা:
                </label>
                <textarea
                  rows={3}
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="আপনার সমস্যা বা প্রশ্ন বিস্তারিত এখানে লিখুন..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <button
                type="submit"
                disabled={submitting || !message.trim()}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                <Send className="w-4 h-4" />
                <span>{submitting ? 'পাঠানো হচ্ছে...' : 'এডমিনের কাছে অভিযোগ/বার্তা পাঠান'}</span>
              </button>
            </form>
          ) : (
            <div className="space-y-3">
              {visibleComplaints.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                  {isOwner
                    ? 'এখনও কোনো ভাড়াটিয়া অভিযোগ বা বার্তা পাঠায়নি।'
                    : authSession.role === 'tenant'
                    ? 'আপনার রুম থেকে এখনও কোনো অভিযোগ করা হয়নি।'
                    : 'আপনার অভিযোগগুলো দেখতে অনুগ্রহ করে ভাড়াটিয়া হিসেবে লগইন করুন।'}
                </div>
              ) : (
                visibleComplaints.map((c) => (
                  <div
                    key={c.id}
                    className={`p-4 rounded-xl border text-xs space-y-2.5 ${
                      c.status === 'resolved'
                        ? 'bg-emerald-50/40 border-emerald-200'
                        : c.priority === 'urgent'
                        ? 'bg-rose-50/50 border-rose-300'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-slate-900 text-white rounded font-mono font-bold text-[11px]">
                          রুম {formatNum(c.roomNo, useBn)}
                        </span>
                        <span className="font-bold text-slate-900">{c.tenantName}</span>
                        {c.priority === 'urgent' && (
                          <span className="px-1.5 py-0.5 bg-rose-100 text-rose-800 rounded font-bold text-[10px]">
                            জরুরি
                          </span>
                        )}
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          c.status === 'resolved'
                            ? 'bg-emerald-100 text-emerald-800'
                            : c.status === 'in_progress'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {c.status === 'resolved'
                          ? '✓ সমাধান হয়েছে'
                          : c.status === 'in_progress'
                          ? '⚙ কাজ চলছে'
                          : '⏳ অপেক্ষমাণ'}
                      </span>
                    </div>

                    <div>
                      <div className="font-bold text-slate-800">
                        [{CATEGORY_LABELS[c.category]}] {c.subject}
                      </div>
                      <p className="text-slate-700 mt-1 whitespace-pre-wrap leading-relaxed">
                        {c.message}
                      </p>
                      <div className="text-[10px] text-slate-400 mt-1">
                        {new Date(c.createdAt).toLocaleString('bn-BD')}
                        {c.phone ? ` · ফোন: ${c.phone}` : ''}
                      </div>
                    </div>

                    {c.adminReply && (
                      <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-lg text-[11px] text-indigo-950">
                        <span className="font-bold block text-indigo-800">
                          কর্তৃপক্ষ হৃদয়-এর উত্তর:
                        </span>
                        <p className="mt-0.5">{c.adminReply}</p>
                      </div>
                    )}

                    {/* Admin Controls to Reply & Change Status */}
                    {isOwner && (
                      <div className="pt-2 border-t border-slate-200/80 space-y-2">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={
                              replyDrafts[c.id] !== undefined
                                ? replyDrafts[c.id]
                                : c.adminReply || ''
                            }
                            onChange={(e) =>
                              setReplyDrafts((prev) => ({ ...prev, [c.id]: e.target.value }))
                            }
                            placeholder="ভাড়াটিয়াকে উত্তর লিখুন..."
                            className="flex-1 px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                          />
                          {c.phone && (
                            <a
                              href={`tel:${c.phone}`}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-semibold flex items-center gap-1"
                            >
                              <Phone className="w-3 h-3" />
                              <span>কল</span>
                            </a>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            disabled={replySavingId === c.id}
                            onClick={() => handleAdminReply(c, 'in_progress')}
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold"
                          >
                            ⚙ কাজ চলছে + উত্তর পাঠান
                          </button>
                          <button
                            type="button"
                            disabled={replySavingId === c.id}
                            onClick={() => handleAdminReply(c, 'resolved')}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold"
                          >
                            ✓ সমাধান হয়েছে
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs shrink-0">
          <span className="text-slate-500">
            যেকোনো Android ও Apple (iPhone/iPad)-এ ২৪/৭ সচল
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-lg"
          >
            বন্ধ করুন
          </button>
        </div>

      </div>
    </div>
  );
};
