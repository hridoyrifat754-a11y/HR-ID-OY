import React, { useState, useEffect, useMemo } from 'react';
import {
  Room,
  BillRecord,
  JointMeterRecord,
  BuildingSettings,
  AuthSession,
  canViewRoomFinancials,
} from '../types';
import {
  formatCurrency,
  formatNum,
  formatMonthName,
  FLOOR_NAMES_BN,
  ROOM_UNIT_GROUPS,
  RoomUnitGroup,
  getRoomUnitGroup,
} from '../constants';
import {
  Receipt,
  Printer,
  Check,
  Search,
  Trash2,
  Share2,
  AlertCircle,
  Lock,
  Layers,
  Home,
  Zap,
  CheckCircle2,
} from 'lucide-react';

interface BillingManagerProps {
  rooms: Room[];
  bills: BillRecord[];
  shared: JointMeterRecord[];
  settings: BuildingSettings;
  selectedMonth: string;
  defaultRoomNo?: number;
  onSaveBill: (bill: BillRecord) => void;
  onSaveBillsBatch?: (bills: BillRecord[]) => void;
  onDeleteBill: (billId: string) => void;
  onViewReceipt: (bill: BillRecord) => void;
  isOwner?: boolean;
  onOpenAdminPin?: () => void;
  authSession?: AuthSession;
}

const ALL_BILLING_UNITS: RoomUnitGroup[] = [
  ...ROOM_UNIT_GROUPS.filter((g) => g.type === 'unit'),
  {
    id: 'unit-34-35',
    label: '৩৪–৩৫ ইউনিট (২য় তলা)',
    shortLabel: 'রুম ৩৪–৩৫',
    type: 'unit',
    rooms: [34, 35],
    floor: 2,
  },
  ...ROOM_UNIT_GROUPS.filter((g) => g.type === 'single'),
];

interface UnitRoomDraft {
  roomNo: number;
  prev: number;
  now: number;
  other: number;
  note: string;
  paid: number;
}

export const BillingManager: React.FC<BillingManagerProps> = ({
  rooms,
  bills,
  shared,
  settings,
  selectedMonth,
  defaultRoomNo,
  onSaveBill,
  onSaveBillsBatch,
  onDeleteBill,
  onViewReceipt,
  isOwner = true,
  onOpenAdminPin,
  authSession,
}) => {
  const useBn = settings.useBengaliDigits;

  // Mode toggle: Single room OR Admin Unit-wise separate billing
  const [billingMode, setBillingMode] = useState<'room' | 'unit'>('room');

  // Single Room billing state
  const [selectedRoomNo, setSelectedRoomNo] = useState<number>(defaultRoomNo || 1);
  const [month, setMonth] = useState<string>(selectedMonth);
  const [prev, setPrev] = useState<number>(0);
  const [now, setNow] = useState<number>(0);
  const [other, setOther] = useState<number>(0);
  const [note, setNote] = useState<string>('');
  const [paid, setPaid] = useState<number>(0);

  // Unit-wise billing state (Admin only)
  const [selectedUnitId, setSelectedUnitId] = useState<string>(ALL_BILLING_UNITS[0]?.id || 'unit-9-10');
  const [unitMeterType, setUnitMeterType] = useState<'separate' | 'shared_meter'>('separate');
  const [combinedPrev, setCombinedPrev] = useState<number>(0);
  const [combinedNow, setCombinedNow] = useState<number>(0);
  const [unitDrafts, setUnitDrafts] = useState<Record<number, UnitRoomDraft>>({});

  // Inline notices & confirm-delete state (no window.alert / window.confirm)
  const [inlineNotice, setInlineNotice] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Registry filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'due' | 'paid'>('all');
  const [filterUnitId, setFilterUnitId] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const showNotice = (msg: string, type: 'success' | 'error' = 'success') => {
    setInlineNotice({ msg, type });
    setTimeout(() => setInlineNotice(null), 4000);
  };

  useEffect(() => {
    setMonth(selectedMonth);
  }, [selectedMonth]);

  // Update room when defaultRoomNo changes from parent
  useEffect(() => {
    if (defaultRoomNo) {
      setSelectedRoomNo(defaultRoomNo);
      const grp = getRoomUnitGroup(defaultRoomNo);
      if (grp) setSelectedUnitId(grp.id);
    }
  }, [defaultRoomNo]);

  // Helper: get dining shared electricity for a given room & month
  const getRoomSharedElectricity = (roomNo: number, targetMonth: string) => {
    const records = shared.filter((s) => s.month === targetMonth && s.rooms.includes(roomNo));
    return {
      amount: records.reduce((sum, s) => sum + s.perRoomShare, 0),
      count: records.length,
    };
  };

  // Current selected room object (single mode)
  const currentRoom = rooms.find((r) => r.no === selectedRoomNo);
  const roomSharedMeta = getRoomSharedElectricity(selectedRoomNo, month);
  const sharedElectricity = roomSharedMeta.amount;

  // Auto-fill previous meter reading from prior bill of this room (single mode)
  useEffect(() => {
    if (!currentRoom) return;

    const existingBillThisMonth = bills.find(
      (b) => b.roomId === currentRoom.id && b.month === month
    );

    if (existingBillThisMonth) {
      setPrev(existingBillThisMonth.prev);
      setNow(existingBillThisMonth.now);
      setOther(existingBillThisMonth.other);
      setNote(existingBillThisMonth.note || '');
      setPaid(existingBillThisMonth.paid);
      return;
    }

    const pastBills = bills
      .filter((b) => b.roomId === currentRoom.id && b.month < month)
      .sort((a, b) => b.month.localeCompare(a.month));

    if (pastBills.length > 0) {
      setPrev(pastBills[0].now);
      setNow(pastBills[0].now);
    } else {
      setPrev(0);
      setNow(0);
    }

    setOther(0);
    setNote('');
    setPaid(0);
  }, [selectedRoomNo, month, bills, currentRoom]);

  // Current selected unit object (unit mode)
  const currentUnit = useMemo(
    () => ALL_BILLING_UNITS.find((u) => u.id === selectedUnitId) || ALL_BILLING_UNITS[0],
    [selectedUnitId]
  );

  // Initialize drafts for each room inside the selected unit
  useEffect(() => {
    if (!currentUnit) return;
    const nextDrafts: Record<number, UnitRoomDraft> = {};
    let totalPrevSum = 0;
    let totalNowSum = 0;

    currentUnit.rooms.forEach((rNo) => {
      const rm = rooms.find((r) => r.no === rNo);
      const existingThisMonth = rm
        ? bills.find((b) => b.roomId === rm.id && b.month === month)
        : undefined;

      if (existingThisMonth) {
        nextDrafts[rNo] = {
          roomNo: rNo,
          prev: existingThisMonth.prev,
          now: existingThisMonth.now,
          other: existingThisMonth.other,
          note: existingThisMonth.note || '',
          paid: existingThisMonth.paid,
        };
        totalPrevSum += existingThisMonth.prev;
        totalNowSum += existingThisMonth.now;
      } else {
        const pastBills = rm
          ? bills
              .filter((b) => b.roomId === rm.id && b.month < month)
              .sort((a, b) => b.month.localeCompare(a.month))
          : [];
        const carriedPrev = pastBills.length > 0 ? pastBills[0].now : 0;
        nextDrafts[rNo] = {
          roomNo: rNo,
          prev: carriedPrev,
          now: carriedPrev,
          other: 0,
          note: '',
          paid: 0,
        };
        totalPrevSum += carriedPrev;
        totalNowSum += carriedPrev;
      }
    });

    setUnitDrafts(nextDrafts);
    setCombinedPrev(totalPrevSum);
    setCombinedNow(totalNowSum);
  }, [currentUnit, month, bills, rooms]);

  // Single-room calculations
  const units = Math.max(0, now - prev);
  const rate = currentRoom?.rate || settings.defaultUnitRate || 12;
  const rent = currentRoom?.rent || 0;
  const electricityCost = Math.round(units * rate * 100) / 100;
  const total = rent + electricityCost + sharedElectricity + other;
  const due = Math.max(0, total - paid);

  // Save single-room bill
  const handleSubmitSingle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner) {
      onOpenAdminPin?.();
      return;
    }
    if (!currentRoom) {
      showNotice('অনুগ্রহ করে একটি সঠিক রুম নির্বাচন করুন!', 'error');
      return;
    }
    if (now < prev) {
      showNotice('বর্তমান মিটার রিডিং পূর্বের রিডিংয়ের চেয়ে কম হতে পারে না!', 'error');
      return;
    }

    const existing = bills.find((b) => b.roomId === currentRoom.id && b.month === month);
    const unitMeta = getRoomUnitGroup(currentRoom.no);

    const billObj: BillRecord = {
      id: existing?.id || `bill-${month}-${currentRoom.id}-${Date.now()}`,
      roomId: currentRoom.id,
      roomNo: currentRoom.no,
      floor: currentRoom.floor,
      tenantName: currentRoom.name || `ভাড়াটিয়া (রুম ${currentRoom.no})`,
      tenantPhone: currentRoom.phone,
      month,
      prev,
      now,
      units,
      rate,
      electricityCost,
      rent,
      sharedElectricity,
      other,
      note,
      total,
      paid,
      due,
      paymentMethod: paid > 0 ? 'Cash' : undefined,
      unitGroupId: unitMeta?.id,
      createdAt: new Date().toISOString(),
    };

    onSaveBill(billObj);
    showNotice(
      `রুম ${formatNum(currentRoom.no, useBn)}-এর ${formatMonthName(month, useBn)} মাসের বিল সংরক্ষিত হয়েছে!`,
      'success'
    );
  };

  // Compute unit-wise separate room bills preview
  const unitRoomPreviews = useMemo(() => {
    if (!currentUnit) return [];
    const roomCount = currentUnit.rooms.length;
    const isSharedMode = unitMeterType === 'shared_meter' && roomCount > 1;
    const sharedTotalUnits = Math.max(0, combinedNow - combinedPrev);
    const splitUnitsPerRoom = isSharedMode
      ? Math.round((sharedTotalUnits / roomCount) * 100) / 100
      : 0;

    return currentUnit.rooms.map((rNo, idx) => {
      const rm = rooms.find((r) => r.no === rNo);
      const draft = unitDrafts[rNo] || {
        roomNo: rNo,
        prev: 0,
        now: 0,
        other: 0,
        note: '',
        paid: 0,
      };
      const rmRate = rm?.rate || settings.defaultUnitRate || 12;
      const rmRent = rm?.rent || 0;
      const rmShared = getRoomSharedElectricity(rNo, month).amount;

      const rmPrev = isSharedMode ? combinedPrev : draft.prev;
      const rmNow = isSharedMode ? combinedNow : draft.now;
      const rmUnits = isSharedMode ? splitUnitsPerRoom : Math.max(0, draft.now - draft.prev);
      const rmElecCost = Math.round(rmUnits * rmRate * 100) / 100;
      const rmTotal = rmRent + rmElecCost + rmShared + draft.other;
      const rmDue = Math.max(0, rmTotal - draft.paid);

      const existing = rm ? bills.find((b) => b.roomId === rm.id && b.month === month) : undefined;

      return {
        roomNo: rNo,
        room: rm,
        draft,
        prev: rmPrev,
        now: rmNow,
        units: rmUnits,
        rate: rmRate,
        electricityCost: rmElecCost,
        rent: rmRent,
        sharedElectricity: rmShared,
        other: draft.other,
        note: isSharedMode
          ? `${draft.note ? draft.note + ' · ' : ''}ইউনিট মিটার ৫০/৫০ ভাগ (${idx + 1}/${roomCount})`
          : draft.note,
        total: rmTotal,
        paid: draft.paid,
        due: rmDue,
        existingBillId: existing?.id,
        invalidMeter: !isSharedMode && draft.now < draft.prev,
      };
    });
  }, [currentUnit, unitMeterType, combinedPrev, combinedNow, unitDrafts, rooms, bills, month, shared, settings.defaultUnitRate]);

  const updateUnitDraft = (roomNo: number, patch: Partial<UnitRoomDraft>) => {
    setUnitDrafts((prevMap) => ({
      ...prevMap,
      [roomNo]: {
        ...(prevMap[roomNo] || { roomNo, prev: 0, now: 0, other: 0, note: '', paid: 0 }),
        ...patch,
      },
    }));
  };

  // Save all separate room bills for the chosen unit
  const handleSaveUnitBills = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner) {
      onOpenAdminPin?.();
      return;
    }
    if (!currentUnit) return;

    if (unitMeterType === 'shared_meter' && currentUnit.rooms.length > 1 && combinedNow < combinedPrev) {
      showNotice('ইউনিটের বর্তমান মিটার রিডিং পূর্বের রিডিংয়ের চেয়ে কম হতে পারে না!', 'error');
      return;
    }

    const invalidRoom = unitRoomPreviews.find((p) => p.invalidMeter);
    if (invalidRoom) {
      showNotice(
        `রুম ${formatNum(invalidRoom.roomNo, useBn)}-এর বর্তমান রিডিং পূর্বের রিডিংয়ের চেয়ে কম হতে পারে না!`,
        'error'
      );
      return;
    }

    const timestamp = Date.now();
    const generatedBills: BillRecord[] = unitRoomPreviews
      .filter((p) => p.room)
      .map((p, i) => ({
        id: p.existingBillId || `bill-${month}-${p.room!.id}-${timestamp + i}`,
        roomId: p.room!.id,
        roomNo: p.room!.no,
        floor: p.room!.floor,
        tenantName: p.room!.name || `ভাড়াটিয়া (রুম ${p.room!.no})`,
        tenantPhone: p.room!.phone || '',
        month,
        prev: p.prev,
        now: p.now,
        units: p.units,
        rate: p.rate,
        electricityCost: p.electricityCost,
        rent: p.rent,
        sharedElectricity: p.sharedElectricity,
        other: p.other,
        note: p.note,
        total: p.total,
        paid: p.paid,
        due: p.due,
        paymentMethod: p.paid > 0 ? 'Cash' : undefined,
        unitGroupId: currentUnit.id,
        createdAt: new Date().toISOString(),
      }));

    if (generatedBills.length === 0) return;

    if (onSaveBillsBatch) {
      onSaveBillsBatch(generatedBills);
    } else {
      generatedBills.forEach((b) => onSaveBill(b));
    }

    showNotice(
      `${currentUnit.label}-এর ${formatNum(generatedBills.length, useBn)}টি আলাদা রুমের বিল (${formatMonthName(month, useBn)}) সংরক্ষিত হয়েছে!`,
      'success'
    );
  };

  // WhatsApp quick text copy
  const handleCopyMemo = (b: BillRecord) => {
    const text = `*বাড়ি ভাড়া ও বিদ্যুৎ বিলের রশিদ*
${settings.buildingName}
------------------------------------
রুম: ${b.roomNo} (${FLOOR_NAMES_BN[b.floor]})
ভাড়াটিয়া: ${b.tenantName}
মাস: ${formatMonthName(b.month, useBn)}

১. ঘর ভাড়া: ${formatCurrency(b.rent, useBn)}
২. নিজস্ব বিদ্যুৎ (${b.units} ইউনিট): ${formatCurrency(b.electricityCost, useBn)}
৩. ডাইনিং মিটার ভাগ: ${formatCurrency(b.sharedElectricity, useBn)}
${b.other > 0 ? `৪. অন্যান্য: ${formatCurrency(b.other, useBn)}\n` : ''}
------------------------------------
*সর্বমোট বিল: ${formatCurrency(b.total, useBn)}*
*পরিশোধিত জমা: ${formatCurrency(b.paid, useBn)}*
*বর্তমান বকেয়া: ${formatCurrency(b.due, useBn)}*
------------------------------------
ধন্যবাদ,
${settings.landlordName} (${settings.landlordTitle && !settings.landlordTitle.includes('পরিচালক') ? settings.landlordTitle : 'কর্তৃপক্ষ'})`;

    navigator.clipboard.writeText(text);
    setCopiedId(b.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filter bills
  const selectedFilterUnit = ALL_BILLING_UNITS.find((u) => u.id === filterUnitId);
  const filteredBills = bills
    .filter((b) => {
      const matchMonth = b.month === month;
      const matchStatus =
        filterStatus === 'all'
          ? true
          : filterStatus === 'due'
          ? b.due > 0
          : b.due <= 0;
      const matchUnit =
        filterUnitId === 'all' || !selectedFilterUnit
          ? true
          : b.unitGroupId === filterUnitId || selectedFilterUnit.rooms.includes(b.roomNo);
      const matchQuery =
        b.roomNo.toString().includes(searchQuery) ||
        b.tenantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (b.tenantPhone || '').includes(searchQuery);
      return matchMonth && matchStatus && matchUnit && matchQuery;
    })
    .sort((a, b) => a.roomNo - b.roomNo);

  return (
    <div className="space-y-6">
      {/* Inline Notification Banner */}
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
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{inlineNotice.msg}</span>
        </div>
      )}

      {/* Bill Creation Form Container */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="px-5 py-4 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Receipt className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <h3 className="font-bold text-base leading-tight">
                মাসিক বাড়ি ভাড়া ও বিদ্যুৎ বিল তৈরি
              </h3>
              <span className="text-[11px] text-slate-300">
                রুম বা ইউনিট সিলেক্ট করলে স্বয়ংক্রিয়ভাবে আগের রিডিং ও ডাইনিং মিটার অংশ যুক্ত হবে
              </span>
            </div>
          </div>

          {/* Billing Mode Switcher (Admin gets Unit-Wise Separate Billing tab!) */}
          <div className="flex items-center bg-slate-800 p-1 rounded-xl gap-1 text-xs shrink-0">
            <button
              type="button"
              onClick={() => setBillingMode('room')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-colors flex items-center gap-1.5 ${
                billingMode === 'room'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Home className="w-3.5 h-3.5" />
              <span>একক রুম বিল</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (!isOwner) {
                  onOpenAdminPin?.();
                  return;
                }
                setBillingMode('unit');
              }}
              className={`px-3 py-1.5 rounded-lg font-bold transition-colors flex items-center gap-1.5 ${
                billingMode === 'unit'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>ইউনিট অনুযায়ী আলাদা বিল</span>
              {!isOwner && <Lock className="w-3 h-3 text-amber-400" />}
            </button>
          </div>
        </div>

        {/* MODE A: SINGLE ROOM BILLING FORM */}
        {billingMode === 'room' && (
          <form onSubmit={handleSubmitSingle} className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  রুম নির্বাচন করুন (১–৩৫)
                </label>
                <select
                  value={selectedRoomNo}
                  onChange={(e) => setSelectedRoomNo(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-bold bg-white"
                  required
                >
                  {rooms.map((r) => (
                    <option key={r.id} value={r.no}>
                      রুম {r.no} — {r.name || 'খালি'} ({FLOOR_NAMES_BN[r.floor]})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  বিলের মাস
                </label>
                <input
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ভাড়াটিয়ার নাম
                </label>
                <input
                  type="text"
                  value={currentRoom?.name || 'খালি রুম'}
                  readOnly
                  className="w-full px-3 py-2 text-sm bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-medium cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  মাসিক ঘর ভাড়া (৳)
                </label>
                <input
                  type="text"
                  value={formatCurrency(rent, useBn)}
                  readOnly
                  className="w-full px-3 py-2 text-sm bg-slate-100 border border-slate-200 rounded-lg font-mono font-bold text-slate-900 cursor-not-allowed"
                />
              </div>
            </div>

            {/* Meter Readings & Electricity Breakdown */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  নিজস্ব মিটারের আগের রিডিং
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={prev}
                  onChange={(e) => setPrev(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  নিজস্ব মিটারের বর্তমান রিডিং
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={now}
                  onChange={(e) => setNow(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ব্যবহৃত ইউনিট ও খরচ
                </label>
                <div className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg font-mono font-bold text-blue-700">
                  {formatNum(units, useBn)} ইউনিট = {formatCurrency(electricityCost, useBn)}
                </div>
                <span className="text-[10px] text-slate-500 font-mono">
                  দর: {formatCurrency(rate, useBn)} / ইউনিট
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ডাইনিং সাব-মিটার ভাগ
                </label>
                <div className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg font-mono font-bold text-amber-700">
                  {formatCurrency(sharedElectricity, useBn)}
                </div>
                <span className="text-[10px] text-slate-500">
                  {roomSharedMeta.count > 0
                    ? `${roomSharedMeta.count}টি ডাইনিং মিটারের অংশ`
                    : 'এই মাসে ডাইনিং রিডিং নেই'}
                </span>
              </div>
            </div>

            {/* Other charges and payment entry */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  অন্যান্য চার্জ (টাকা)
                </label>
                <input
                  type="number"
                  min="0"
                  step="10"
                  value={other}
                  onChange={(e) => setOther(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  অন্যান্য চার্জের বিবরণ
                </label>
                <input
                  type="text"
                  placeholder="যেমন: পানির বিল / ময়লা বিল"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    জমা / পরিশোধ (৳)
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPaid(total)}
                      className="text-[10px] text-emerald-700 hover:underline font-semibold"
                    >
                      ফুল পরিশোধ
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setPaid(0)}
                      className="text-[10px] text-red-600 hover:underline font-semibold"
                    >
                      বাকি ০
                    </button>
                  </div>
                </div>
                <input
                  type="number"
                  min="0"
                  max={total + 50000}
                  step="10"
                  value={paid}
                  onChange={(e) => setPaid(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono font-bold text-emerald-700"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  বর্তমান বকেয়া
                </label>
                <div
                  className={`px-3 py-2 text-sm border rounded-lg font-mono font-bold ${
                    due > 0
                      ? 'bg-red-50 border-red-200 text-red-600'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  }`}
                >
                  {formatCurrency(due, useBn)}
                </div>
              </div>
            </div>

            {/* Live Calculation Preview Banner */}
            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="text-slate-700 flex flex-wrap items-center gap-2">
                <span>ভাড়া {formatCurrency(rent, useBn)}</span>
                <span>+</span>
                <span>নিজস্ব বিদ্যুৎ {formatCurrency(electricityCost, useBn)}</span>
                <span>+</span>
                <span>ডাইনিং মিটার {formatCurrency(sharedElectricity, useBn)}</span>
                {other > 0 && (
                  <>
                    <span>+</span>
                    <span>অন্যান্য {formatCurrency(other, useBn)}</span>
                  </>
                )}
                <span>=</span>
                <span className="font-bold text-slate-900 text-sm">
                  সর্বমোট প্রদেয় {formatCurrency(total, useBn)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {!isOwner ? (
                  <button
                    type="button"
                    onClick={onOpenAdminPin}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold rounded-lg text-xs shadow-xs transition-colors flex items-center gap-1.5"
                  >
                    <Lock className="w-4 h-4 text-amber-400" />
                    <span>বিল তৈরি করতে এডমিন আনলক করুন</span>
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs shadow-xs transition-colors flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>বিল সংরক্ষণ করুন</span>
                  </button>
                )}
              </div>
            </div>
          </form>
        )}

        {/* MODE B: ADMIN UNIT-WISE SEPARATE BILLING */}
        {billingMode === 'unit' && isOwner && currentUnit && (
          <form onSubmit={handleSaveUnitBills} className="p-5 space-y-4">
            <div className="p-3.5 bg-indigo-50/80 border border-indigo-200 rounded-xl flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
                <div>
                  <label className="block text-xs font-bold text-indigo-950 mb-1">
                    ইউনিট / জোড়া অথবা সিঙ্গেল নির্বাচন করুন:
                  </label>
                  <select
                    value={selectedUnitId}
                    onChange={(e) => setSelectedUnitId(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold border border-indigo-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500"
                  >
                    <optgroup label="ইউনিট / জোড়া (২টি রুম আলাদা বিল)">
                      {ALL_BILLING_UNITS.filter((u) => u.type === 'unit').map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.label} ({FLOOR_NAMES_BN[u.floor]})
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="সিঙ্গেল রুম ইউনিট">
                      {ALL_BILLING_UNITS.filter((u) => u.type === 'single').map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.label} ({FLOOR_NAMES_BN[u.floor]})
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-indigo-950 mb-1">
                    বিলের মাস:
                  </label>
                  <input
                    type="month"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono font-bold border border-indigo-300 rounded-lg bg-white"
                    required
                  />
                </div>
              </div>

              {currentUnit.rooms.length > 1 && (
                <div className="space-y-1 shrink-0">
                  <span className="block text-[11px] font-bold text-indigo-900">
                    বিদ্যুৎ মিটার হিসাব ধরন:
                  </span>
                  <div className="flex bg-white p-1 rounded-lg border border-indigo-200 gap-1 text-xs">
                    <button
                      type="button"
                      onClick={() => setUnitMeterType('separate')}
                      className={`px-2.5 py-1 rounded font-semibold transition-colors ${
                        unitMeterType === 'separate'
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      আলাদা রুম মিটার
                    </button>
                    <button
                      type="button"
                      onClick={() => setUnitMeterType('shared_meter')}
                      className={`px-2.5 py-1 rounded font-semibold transition-colors ${
                        unitMeterType === 'shared_meter'
                          ? 'bg-amber-500 text-slate-950'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      একই ইউনিট মিটার (৫০/৫০)
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Combined Unit Meter bar when 50/50 mode is selected */}
            {unitMeterType === 'shared_meter' && currentUnit.rooms.length > 1 && (
              <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-amber-950 mb-1">
                    ইউনিট মিটারের আগের রিডিং:
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={combinedPrev}
                    onChange={(e) => setCombinedPrev(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-amber-300 rounded-lg font-mono bg-white font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-amber-950 mb-1">
                    ইউনিট মিটারের বর্তমান রিডিং:
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={combinedNow}
                    onChange={(e) => setCombinedNow(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-amber-300 rounded-lg font-mono bg-white font-bold"
                  />
                </div>
                <div className="flex flex-col justify-center bg-white px-3 py-2 rounded-lg border border-amber-200">
                  <span className="text-[11px] text-slate-500">মোট ইউনিট · প্রতি রুম (৫০%):</span>
                  <span className="font-mono font-bold text-amber-800 text-sm">
                    {formatNum(Math.max(0, combinedNow - combinedPrev), useBn)} u ÷ {formatNum(currentUnit.rooms.length, useBn)} ={' '}
                    {formatNum(
                      Math.round((Math.max(0, combinedNow - combinedPrev) / currentUnit.rooms.length) * 100) / 100,
                      useBn
                    )}{' '}
                    u/রুম
                  </span>
                </div>
              </div>
            )}

            {/* Separate Cards for Each Room in the Selected Unit */}
            <div className={`grid grid-cols-1 ${currentUnit.rooms.length > 1 ? 'lg:grid-cols-2' : ''} gap-4`}>
              {unitRoomPreviews.map((p) => (
                <div
                  key={p.roomNo}
                  className="border-2 border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200">
                    <div>
                      <span className="text-sm font-bold text-slate-900">
                        রুম {formatNum(p.roomNo, useBn)} ({FLOOR_NAMES_BN[p.room?.floor || currentUnit.floor]})
                      </span>
                      <div className="text-xs text-slate-600 font-medium">
                        ভাড়াটিয়া: <strong>{p.room?.name || 'খালি রুম'}</strong> · ভাড়া:{' '}
                        <strong className="font-mono">{formatCurrency(p.rent, useBn)}</strong>
                      </div>
                    </div>
                    {p.existingBillId && (
                      <span className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-bold">
                        আপডেট মোড
                      </span>
                    )}
                  </div>

                  {unitMeterType === 'separate' || currentUnit.rooms.length === 1 ? (
                    <div className="grid grid-cols-2 gap-2.5 text-xs">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          আগের রিডিং:
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={p.draft.prev}
                          onChange={(e) =>
                            updateUnitDraft(p.roomNo, { prev: parseFloat(e.target.value) || 0 })
                          }
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono bg-white"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          বর্তমান রিডিং:
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={p.draft.now}
                          onChange={(e) =>
                            updateUnitDraft(p.roomNo, { now: parseFloat(e.target.value) || 0 })
                          }
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono bg-white"
                        />
                      </div>
                    </div>
                  ) : null}

                  <div className="grid grid-cols-2 gap-2.5 text-xs">
                    <div className="p-2 bg-white border border-slate-200 rounded-lg">
                      <span className="text-[10px] text-slate-500 block">নিজস্ব বিদ্যুৎ ({formatNum(p.units, useBn)} u):</span>
                      <span className="font-mono font-bold text-blue-700">
                        {formatCurrency(p.electricityCost, useBn)}
                      </span>
                    </div>
                    <div className="p-2 bg-white border border-slate-200 rounded-lg">
                      <span className="text-[10px] text-slate-500 block">ডাইনিং মিটার ভাগ:</span>
                      <span className="font-mono font-bold text-amber-700">
                        {formatCurrency(p.sharedElectricity, useBn)}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">অন্যান্য (৳):</label>
                      <input
                        type="number"
                        min="0"
                        step="10"
                        value={p.draft.other}
                        onChange={(e) =>
                          updateUnitDraft(p.roomNo, { other: parseFloat(e.target.value) || 0 })
                        }
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono bg-white"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">বিবরণ:</label>
                      <input
                        type="text"
                        placeholder="পানি/ময়লা..."
                        value={p.draft.note}
                        onChange={(e) => updateUnitDraft(p.roomNo, { note: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-semibold text-slate-700">জমা (৳):</label>
                        <button
                          type="button"
                          onClick={() => updateUnitDraft(p.roomNo, { paid: p.total })}
                          className="text-[10px] text-emerald-700 font-bold hover:underline"
                        >
                          ফুল
                        </button>
                      </div>
                      <input
                        type="number"
                        min="0"
                        step="10"
                        value={p.draft.paid}
                        onChange={(e) =>
                          updateUnitDraft(p.roomNo, { paid: parseFloat(e.target.value) || 0 })
                        }
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono font-bold text-emerald-700 bg-white"
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-slate-500">রুম {formatNum(p.roomNo, useBn)} মোট বিল: </span>
                      <strong className="font-mono text-slate-900 text-sm">
                        {formatCurrency(p.total, useBn)}
                      </strong>
                    </div>
                    <div className={`font-mono font-bold ${p.due > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                      বকেয়া: {formatCurrency(p.due, useBn)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Save Unit Separate Bills Footer */}
            <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="text-indigo-950 font-semibold">
                <Zap className="w-4 h-4 inline mr-1 text-indigo-600" />
                <span>
                  {currentUnit.label} — মোট {formatNum(unitRoomPreviews.length, useBn)}টি আলাদা রুমের বিল:{' '}
                </span>
                <strong className="font-mono text-sm">
                  {formatCurrency(
                    unitRoomPreviews.reduce((sum, p) => sum + p.total, 0),
                    useBn
                  )}
                </strong>
              </div>

              <button
                type="submit"
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-sm transition-colors flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>এই ইউনিটের আলাদা বিল সংরক্ষণ করুন</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Bill Registry Table for Month */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="px-5 py-3.5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-sm sm:text-base text-slate-900">
              {formatMonthName(month, useBn)}-এর সকল বিল রেজিস্টার ({formatNum(filteredBills.length, useBn)}টি রুম)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              মোট বিল: {formatCurrency(filteredBills.reduce((acc, b) => acc + b.total, 0), useBn)} · মোট আদায়:{' '}
              {formatCurrency(filteredBills.reduce((acc, b) => acc + b.paid, 0), useBn)} · বকেয়া:{' '}
              {formatCurrency(filteredBills.reduce((acc, b) => acc + b.due, 0), useBn)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Unit Filter Dropdown */}
            <select
              value={filterUnitId}
              onChange={(e) => setFilterUnitId(e.target.value)}
              className="px-2.5 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg bg-white text-slate-800"
              title="ইউনিট অনুযায়ী ফিল্টার"
            >
              <option value="all">সকল ইউনিট ও রুম</option>
              {ALL_BILLING_UNITS.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  filterStatus === 'all' ? 'bg-white font-bold text-slate-900 shadow-2xs' : 'text-slate-600'
                }`}
              >
                সকল ({formatNum(bills.filter((b) => b.month === month).length, useBn)})
              </button>
              <button
                onClick={() => setFilterStatus('due')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  filterStatus === 'due' ? 'bg-white font-bold text-red-600 shadow-2xs' : 'text-slate-600'
                }`}
              >
                বকেয়া ({formatNum(bills.filter((b) => b.month === month && b.due > 0).length, useBn)})
              </button>
              <button
                onClick={() => setFilterStatus('paid')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  filterStatus === 'paid' ? 'bg-white font-bold text-emerald-700 shadow-2xs' : 'text-slate-600'
                }`}
              >
                পরিশোধিত
              </button>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="রুম / নাম খুঁজুন..."
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
                <th className="py-2.5 px-3">রুম / ইউনিট</th>
                <th className="py-2.5 px-3">ভাড়াটিয়ার নাম</th>
                <th className="py-2.5 px-3 text-right">ঘর ভাড়া</th>
                <th className="py-2.5 px-3 text-right">নিজস্ব বিদ্যুৎ</th>
                <th className="py-2.5 px-3 text-right">ডাইনিং মিটার</th>
                <th className="py-2.5 px-3 text-right">অন্যান্য</th>
                <th className="py-2.5 px-3 text-right font-bold text-slate-900">মোট বিল</th>
                <th className="py-2.5 px-3 text-right text-emerald-700 font-semibold">জমা</th>
                <th className="py-2.5 px-3 text-right text-red-600 font-bold">বকেয়া</th>
                <th className="py-2.5 px-3 text-center">রসিদ ও একশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredBills.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-500">
                    {formatMonthName(month, useBn)} মাসে নির্বাচিত ফিল্টারে কোনো বিল পাওয়া যায়নি।
                  </td>
                </tr>
              ) : (
                filteredBills.map((b) => {
                  const canView = canViewRoomFinancials(b.roomNo, authSession, isOwner);
                  const isMyRoom =
                    authSession?.isLoggedIn &&
                    authSession.role === 'tenant' &&
                    authSession.roomNo === b.roomNo;
                  const unitMeta = getRoomUnitGroup(b.roomNo);

                  return (
                    <tr
                      key={b.id}
                      className={`hover:bg-slate-50 transition-colors ${
                        isMyRoom ? 'bg-indigo-50/50 font-semibold' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                        <div className="flex items-center gap-1 flex-wrap">
                          <span>রুম {formatNum(b.roomNo, useBn)}</span>
                          {isMyRoom && (
                            <span className="text-[9px] px-1 py-0.2 bg-indigo-100 text-indigo-700 rounded font-bold">
                              আমার
                            </span>
                          )}
                          {unitMeta && (
                            <span
                              className={`text-[9px] px-1 py-0.2 rounded font-sans font-semibold ${
                                unitMeta.type === 'unit'
                                  ? 'bg-indigo-100 text-indigo-800'
                                  : 'bg-sky-100 text-sky-800'
                              }`}
                            >
                              {unitMeta.shortLabel}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 block font-normal font-sans">
                          {FLOOR_NAMES_BN[b.floor]}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-slate-900 font-semibold">
                        {b.tenantName}
                        <span className="text-[10px] text-slate-500 block font-mono font-normal">
                          {canView ? b.tenantPhone || 'মোবাইল নেই' : '🔒 ব্যক্তিগত'}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                        {canView ? (
                          formatCurrency(b.rent, useBn)
                        ) : (
                          <span className="text-slate-400 font-sans">🔒 গোপনীয়</span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                        {canView ? (
                          <>
                            <div>{formatCurrency(b.electricityCost, useBn)}</div>
                            <div className="text-[10px] text-slate-400">
                              ({formatNum(b.units, useBn)} u)
                            </div>
                          </>
                        ) : (
                          <span className="text-slate-400 font-sans">🔒 গোপনীয়</span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                        {canView ? (
                          formatCurrency(b.sharedElectricity, useBn)
                        ) : (
                          <span className="text-slate-400 font-sans">🔒 গোপনীয়</span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600">
                        {canView ? (
                          b.other > 0 ? (
                            formatCurrency(b.other, useBn)
                          ) : (
                            '—'
                          )
                        ) : (
                          <span className="text-slate-400 font-sans">🔒</span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-slate-900 text-sm">
                        {canView ? (
                          formatCurrency(b.total, useBn)
                        ) : (
                          <span className="text-slate-400 font-sans font-normal text-xs">
                            🔒 গোপনীয়
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-emerald-700">
                        {canView ? (
                          formatCurrency(b.paid, useBn)
                        ) : (
                          <span className="text-slate-400 font-sans font-normal text-xs">🔒</span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold">
                        {canView ? (
                          b.due > 0 ? (
                            <span className="text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                              {formatCurrency(b.due, useBn)}
                            </span>
                          ) : (
                            <span className="text-emerald-700 text-[11px]">পরিশোধিত</span>
                          )
                        ) : (
                          <span className="text-slate-400 font-sans font-normal text-xs">
                            🔒 সংরক্ষিত
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {canView ? (
                            <>
                              <button
                                onClick={() => onViewReceipt(b)}
                                className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-[11px] font-semibold transition-colors flex items-center gap-1"
                                title="মানি রসিদ ও A6 PDF ডাউনলোড"
                              >
                                <Printer className="w-3 h-3" />
                                <span>রশিদ</span>
                              </button>
                              <button
                                onClick={() => handleCopyMemo(b)}
                                className="p-1 text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                                title="হোয়াটসঅ্যাপে পাঠানোর মেসেজ কপি করুন"
                              >
                                {copiedId === b.id ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Share2 className="w-3.5 h-3.5" />
                                )}
                              </button>
                              {isOwner && (
                                confirmDeleteId === b.id ? (
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => {
                                        onDeleteBill(b.id);
                                        setConfirmDeleteId(null);
                                        showNotice(`রুম ${formatNum(b.roomNo, useBn)}-এর বিল মুছে ফেলা হয়েছে।`);
                                      }}
                                      className="px-1.5 py-0.5 bg-red-600 text-white rounded text-[10px] font-bold"
                                    >
                                      হ্যাঁ
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
                                    onClick={() => setConfirmDeleteId(b.id)}
                                    className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                    title="বিল মুছুন"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )
                              )}
                            </>
                          ) : (
                            <span className="text-[11px] text-slate-400 flex items-center gap-1">
                              <Lock className="w-3 h-3 text-slate-400" />
                              <span>লকড</span>
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
