import React, { useState } from 'react';
import { JointMeterRecord, BuildingSettings } from '../types';
import {
  JOINT_GROUPS,
  FLOOR_NAMES_BN,
  formatCurrency,
  formatNum,
  formatMonthName,
} from '../constants';
import { Zap, Trash2, CheckCircle2, AlertTriangle, Search, Lock } from 'lucide-react';

interface JointMeterManagerProps {
  shared: JointMeterRecord[];
  settings: BuildingSettings;
  selectedMonth: string;
  onSaveShared: (record: JointMeterRecord) => void;
  onDeleteShared: (id: string) => void;
  isOwner?: boolean;
  onOpenAdminPin?: () => void;
}

export const JointMeterManager: React.FC<JointMeterManagerProps> = ({
  shared,
  settings,
  selectedMonth,
  onSaveShared,
  onDeleteShared,
  isOwner = true,
  onOpenAdminPin,
}) => {
  const useBn = settings.useBengaliDigits;

  const [groupIndex, setGroupIndex] = useState<number>(JOINT_GROUPS[0]?.index ?? 1);
  const [month, setMonth] = useState<string>(selectedMonth);
  const [prev, setPrev] = useState<number>(0);
  const [now, setNow] = useState<number>(0);
  const [rate, setRate] = useState<number>(settings.defaultUnitRate || 12);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [inlineNotice, setInlineNotice] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [pendingOverwriteId, setPendingOverwriteId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const showNotice = (msg: string, type: 'success' | 'error' = 'success') => {
    setInlineNotice({ msg, type });
    setTimeout(() => setInlineNotice(null), 4500);
  };

  const selectedGroup = JOINT_GROUPS.find((g) => g.index === groupIndex) || JOINT_GROUPS[0];

  // Auto-fill previous reading when group or month changes
  const handleGroupChange = (idx: number) => {
    setGroupIndex(idx);
    setPendingOverwriteId(null);

    // Look for previous month's reading for this group
    const [y, m] = month.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    const prevMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    const prevRecord = shared.find((s) => s.groupIndex === idx && s.month === prevMonthStr);
    if (prevRecord) {
      setPrev(prevRecord.now);
      setNow(prevRecord.now);
    } else {
      // Find latest record for this group
      const latest = [...shared]
        .filter((s) => s.groupIndex === idx)
        .sort((a, b) => b.month.localeCompare(a.month))[0];
      if (latest) {
        setPrev(latest.now);
        setNow(latest.now);
      } else {
        setPrev(0);
        setNow(0);
      }
    }
  };

  // Calculations
  const units = Math.max(0, now - prev);
  const totalAmount = Math.round(units * rate * 100) / 100;
  const roomCount = selectedGroup.rooms.length;
  const perRoomShare = Math.round((totalAmount / roomCount) * 100) / 100;

  const commitSave = (overwriteId?: string) => {
    const record: JointMeterRecord = {
      id: overwriteId || editingId || `shared-${month}-${groupIndex}-${Date.now()}`,
      groupIndex,
      groupName: selectedGroup.label,
      rooms: selectedGroup.rooms,
      month,
      prev,
      now,
      units,
      rate,
      amount: totalAmount,
      perRoomShare,
      createdAt: new Date().toISOString(),
    };

    onSaveShared(record);
    setEditingId(null);
    setPendingOverwriteId(null);
    showNotice(
      `${selectedGroup.label}-এর ${formatMonthName(month, useBn)} মাসের বিল (প্রতি রুম ${formatCurrency(perRoomShare, useBn)}) সংরক্ষিত হয়েছে!`,
      'success'
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner) {
      onOpenAdminPin?.();
      return;
    }
    if (now < prev) {
      showNotice('বর্তমান রিডিং পূর্বের রিডিংয়ের চেয়ে কম হতে পারে না!', 'error');
      return;
    }

    // Check duplicate in same month
    const existing = shared.find((s) => s.groupIndex === groupIndex && s.month === month && s.id !== editingId);
    if (existing && pendingOverwriteId !== existing.id) {
      setPendingOverwriteId(existing.id);
      return;
    }

    commitSave(existing?.id);
  };

  const handleEdit = (rec: JointMeterRecord) => {
    setEditingId(rec.id);
    setPendingOverwriteId(null);
    setGroupIndex(rec.groupIndex);
    setMonth(rec.month);
    setPrev(rec.prev);
    setNow(rec.now);
    setRate(rec.rate);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Filter records
  const filteredShared = shared.filter((s) => {
    const matchesMonth = searchQuery ? true : (s.month === selectedMonth || selectedMonth === 'all');
    const matchesSearch =
      s.groupName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.rooms.some((r) => r.toString().includes(searchQuery));
    return matchesMonth && matchesSearch;
  });

  return (
    <div className="space-y-6">
      
      {/* Inline Notice Banner */}
      {inlineNotice && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-bold flex items-center gap-2 shadow-xs ${
            inlineNotice.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          {inlineNotice.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{inlineNotice.msg}</span>
        </div>
      )}

      {/* Sub-Meter Structure Guide Card */}
      <div className="bg-gradient-to-r from-amber-50 via-orange-50/60 to-sky-50 border border-amber-200 rounded-xl p-4 text-xs space-y-2">
        <div className="font-bold text-amber-950 flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-600 shrink-0" />
          <span>বিল্ডিং ডাইনিং ও ইউনিট সাব-মিটার কাঠামো ({formatNum(JOINT_GROUPS.length, useBn)}টি ডাইনিং সাব-মিটার)</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-[11px] text-slate-700">
          <div className="bg-white/90 border border-amber-200/80 rounded-lg px-3 py-2">
            <span className="font-bold text-slate-900 block">২য় তলা ডাইনিং (রুম ১–২):</span>
            <span>১টি ডাইনিং সাব-মিটার · ২ রুমে সমান ভাগ</span>
          </div>
          <div className="bg-white/90 border border-amber-200/80 rounded-lg px-3 py-2">
            <span className="font-bold text-slate-900 block">২য় তলা ডাইনিং (রুম ৩–৪–৫):</span>
            <span>১টি ডাইনিং সাব-মিটার · ৩ রুমে সমান ভাগ</span>
          </div>
          <div className="bg-white/90 border border-amber-200/80 rounded-lg px-3 py-2">
            <span className="font-bold text-slate-900 block">৩য় তলা ডাইনিং (রুম ৬–৭):</span>
            <span>১টি ডাইনিং সাব-মিটার · ২ রুমে সমান ভাগ</span>
          </div>
          <div className="bg-white/90 border border-indigo-200/80 rounded-lg px-3 py-2">
            <span className="font-bold text-indigo-950 block">প্রতি জোড়া ইউনিট (৯–৩২ ও ৩৪–৩৫):</span>
            <span>৩টি সাব-মিটার (২ রুমের ২টি + ১টি ডাইনিং)</span>
          </div>
        </div>
      </div>

      {/* Form Card */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="px-5 py-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <Zap className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-base">
              {editingId ? 'ডাইনিং সাব-মিটার রিডিং সম্পাদনা' : 'ডাইনিং সাব-মিটার রিডিং এন্ট্রি'}
            </h3>
          </div>
          <span className="text-xs text-slate-300">
            রুম ১–২, ৩–৪–৫, ৬–৭, ৩৪–৩৫ এবং প্রতি জোড়া ইউনিটের ডাইনিং সাব-মিটার
          </span>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            
            <div className="lg:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                মিটার গ্রুপ নির্বাচন করুন
              </label>
              <select
                value={groupIndex}
                onChange={(e) => handleGroupChange(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white font-semibold"
                required
              >
                {JOINT_GROUPS.map((g) => (
                  <option key={g.index} value={g.index}>
                    {FLOOR_NAMES_BN[g.floor]} · {g.label} ({g.rooms.map((r) => `রুম ${formatNum(r, useBn)}`).join(', ')})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                হিসাবের মাস
              </label>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                আগের রিডিং
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={prev}
                onChange={(e) => setPrev(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                বর্তমান রিডিং
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={now}
                onChange={(e) => setNow(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono"
                required
              />
            </div>

          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                প্রতি ইউনিট দর (টাকা)
              </label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={rate}
                onChange={(e) => setRate(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono"
                required
              />
            </div>

            {/* Realtime Live calculation summary */}
            <div className="sm:col-span-2 bg-amber-50/80 border border-amber-200 rounded-lg p-3 flex flex-col justify-center">
              <span className="text-xs font-semibold text-amber-900">
                হিসাবের সারসংক্ষেপ:
              </span>
              <div className="text-xs text-amber-800 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                <span>সংশ্লিষ্ট রুম: <strong>{selectedGroup.rooms.map((r) => `রুম ${r}`).join(', ')}</strong></span>
                <span>· ব্যবহৃত ইউনিট: <strong className="font-mono">{formatNum(units, useBn)}</strong></span>
                <span>· মোট বিদ্যুৎ বিল: <strong className="font-mono">{formatCurrency(totalAmount, useBn)}</strong></span>
                <span className="text-blue-900 font-bold">
                  · প্রতি রুমে সমান ভাগ ({roomCount} ভাগে): <span className="font-mono underline">{formatCurrency(perRoomShare, useBn)}</span>
                </span>
              </div>
            </div>
          </div>

          {pendingOverwriteId && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-amber-950">
                এই মাসে ({formatMonthName(month, useBn)}) {selectedGroup.label}-এর হিসাব আগে থেকেই আছে। আপনি কি নতুন রিডিং দিয়ে আপডেট করতে চান?
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => commitSave(pendingOverwriteId)}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg"
                >
                  হ্যাঁ, আপডেট করুন
                </button>
                <button
                  type="button"
                  onClick={() => setPendingOverwriteId(null)}
                  className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 font-semibold rounded-lg"
                >
                  বাতিল
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            {!isOwner ? (
              <button
                type="button"
                onClick={onOpenAdminPin}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>রিডিং এন্ট্রি করতে কর্তৃপক্ষ পিন আনলক করুন</span>
              </button>
            ) : (
              <>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors"
                >
                  {editingId ? 'আপডেট সংরক্ষণ করুন' : 'ডাইনিং বিল সংরক্ষণ করুন'}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(null);
                      setPendingOverwriteId(null);
                      setPrev(0);
                      setNow(0);
                    }}
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-medium transition-colors"
                  >
                    বাতিল
                  </button>
                )}
              </>
            )}
          </div>
        </form>
      </div>

      {/* Shared Meters List Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="px-5 py-3.5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-sm sm:text-base text-slate-900">
              ডাইনিং সাব-মিটার রেজিস্টার ({formatNum(filteredShared.length, useBn)}টি রেকর্ড)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              এই হিসাব সংশ্লিষ্ট রুমের মাসিক বিলে স্বয়ংক্রিয়ভাবে সমানভাবে যোগ হবে
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="মিটার বা রুম খুঁজুন..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
              <tr>
                <th className="py-2.5 px-3">মিটার গ্রুপ</th>
                <th className="py-2.5 px-3">সংশ্লিষ্ট রুম</th>
                <th className="py-2.5 px-3">মাস</th>
                <th className="py-2.5 px-3 text-right">আগের রিডিং</th>
                <th className="py-2.5 px-3 text-right">বর্তমান রিডিং</th>
                <th className="py-2.5 px-3 text-right">ব্যবহৃত ইউনিট</th>
                <th className="py-2.5 px-3 text-right">মোট বিল</th>
                <th className="py-2.5 px-3 text-right font-bold text-blue-900">রুম প্রতি ভাগ</th>
                <th className="py-2.5 px-3 text-center">কাজ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredShared.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    কোনো ডাইনিং সাব-মিটারের রেকর্ড পাওয়া যায়নি। উপরের ফরম থেকে রিডিং এন্ট্রি করুন।
                  </td>
                </tr>
              ) : (
                filteredShared.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3 text-slate-900 font-semibold">
                      {rec.groupName}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex flex-wrap gap-1">
                        {rec.rooms.map((r) => (
                          <span
                            key={r}
                            className="text-[10px] font-mono font-semibold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded"
                          >
                            রুম {formatNum(r, useBn)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">
                      {formatMonthName(rec.month, useBn)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600">
                      {formatNum(rec.prev, useBn)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-900">
                      {formatNum(rec.now, useBn)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {formatNum(rec.units, useBn)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {formatCurrency(rec.amount, useBn)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-blue-700 text-sm">
                      {formatCurrency(rec.perRoomShare, useBn)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {isOwner ? (
                          <>
                            <button
                              onClick={() => handleEdit(rec)}
                              className="px-2 py-1 text-[11px] text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            >
                              এডিট
                            </button>
                            {confirmDeleteId === rec.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => {
                                    onDeleteShared(rec.id);
                                    setConfirmDeleteId(null);
                                    showNotice('ডাইনিং মিটারের রেকর্ডটি মুছে ফেলা হয়েছে।', 'success');
                                  }}
                                  className="px-1.5 py-0.5 bg-red-600 text-white rounded text-[10px] font-bold"
                                >
                                  নিশ্চিত
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded text-[10px]"
                                >
                                  না
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmDeleteId(rec.id)}
                                className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                                title="মুছুন"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </>
                        ) : (
                          <button
                            onClick={onOpenAdminPin}
                            className="px-2 py-1 text-[11px] text-slate-400 hover:text-amber-600 rounded flex items-center gap-1"
                            title="রিডিং এডিট করতে কর্তৃপক্ষ পিন প্রয়োজন"
                          >
                            <Lock className="w-3 h-3 text-amber-500" />
                            <span>লকড</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
