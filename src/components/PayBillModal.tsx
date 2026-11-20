import React, { useState } from 'react';
import {
  Zap,
  CreditCard,
  Copy,
  Check,
  Building2,
  X,
  ShieldCheck,
  Clock,
  ArrowRight,
  Phone,
  FileCheck
} from 'lucide-react';
import { BillRecord, Room, BuildingSettings, PaymentRecord } from '../types';
import { formatCurrency, formatNum, formatMonthName, FLOOR_NAMES_BN } from '../constants';

interface PayBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: Room;
  bill?: BillRecord | null;
  settings: BuildingSettings;
  selectedMonth: string;
  onSubmitPayment: (payment: PaymentRecord) => void;
}

export const PayBillModal: React.FC<PayBillModalProps> = ({
  isOpen,
  onClose,
  room,
  bill,
  settings,
  selectedMonth,
  onSubmitPayment,
}) => {
  const useBn = settings.useBengaliDigits;

  const electricityDue = bill ? bill.electricityCost + bill.sharedElectricity : 0;
  const totalDue = bill ? bill.due : room.rent;

  const [paymentType, setPaymentType] = useState<'electricity' | 'both' | 'custom'>('electricity');
  const [method, setMethod] = useState<'bkash' | 'nagad' | 'rocket' | 'cash'>('bkash');
  const [amount, setAmount] = useState<number>(electricityDue > 0 ? electricityDue : totalDue);
  const [trxId, setTrxId] = useState('');
  const [senderPhone, setSenderPhone] = useState(room.phone || '');
  const [note, setNote] = useState('');
  const [copiedNumber, setCopiedNumber] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  if (!isOpen) return null;

  const directorPhone = settings.landlordPhone || '০১৭১১-০০০০০০';
  const bkashNumber = settings.bkashNumber || directorPhone;
  const nagadNumber = settings.nagadNumber || directorPhone;

  const handleCopyNumber = (num: string, label: string) => {
    navigator.clipboard.writeText(num);
    setCopiedNumber(label);
    setTimeout(() => setCopiedNumber(null), 2000);
  };

  const handleTypeChange = (type: 'electricity' | 'both' | 'custom') => {
    setPaymentType(type);
    if (type === 'electricity') {
      setAmount(electricityDue > 0 ? electricityDue : 0);
    } else if (type === 'both') {
      setAmount(totalDue > 0 ? totalDue : room.rent);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText(null);
    if (amount <= 0) {
      setErrorText('সঠিক জমার পরিমাণ উল্লেখ করুন!');
      return;
    }

    setIsSubmitting(true);

    const record: PaymentRecord = {
      id: `pay-${Date.now()}`,
      roomNo: room.no,
      roomId: room.id,
      tenantName: room.name || `রুম ${room.no}`,
      month: selectedMonth,
      amount: Number(amount),
      paymentType,
      method,
      trxId: trxId.trim(),
      senderPhone: senderPhone.trim(),
      note: note.trim(),
      createdAt: new Date().toISOString(),
      status: 'pending',
    };

    onSubmitPayment(record);
    setIsSubmitting(false);
    setSubmittedSuccess(true);
    setTimeout(() => {
      setSubmittedSuccess(false);
      onClose();
    }, 1800);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 font-sans">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6">
        
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-xs">
              <Zap className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base leading-tight">
                কারেন্ট বিল ও ঘর ভাড়া পরিশোধ
              </h3>
              <p className="text-[11px] text-slate-300">
                রুম নম্বর {formatNum(room.no, useBn)} ({FLOOR_NAMES_BN[room.floor]}) · {formatMonthName(selectedMonth, useBn)}
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

        {submittedSuccess ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
              <Check className="w-8 h-8" />
            </div>
            <h4 className="text-base font-bold text-slate-900">
              পেমেন্ট সফলভাবে জমা নেওয়া হয়েছে!
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed max-w-sm mx-auto">
              আপনার <strong>{formatCurrency(amount, useBn)}</strong> টাকার পেমেন্ট স্লিপ কর্তৃপক্ষ হৃদয়-এর নিকট পাঠানো হয়েছে এবং রসিদে জমা আপডেট করা হয়েছে।
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
            {errorText && (
              <div className="px-3.5 py-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
                {errorText}
              </div>
            )}

            {/* Bill Overview Card */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-200/80">
                <span className="text-slate-600">ভাড়াটিয়া:</span>
                <span className="font-bold text-slate-900">{room.name || 'রুম ' + room.no}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[11px] text-slate-500 block">কারেন্ট বিল (নিজস্ব + ডাইনিং)</span>
                  <span className="font-bold text-slate-900 font-mono text-sm">
                    {formatCurrency(electricityDue, useBn)}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">ঘর ভাড়া</span>
                  <span className="font-bold text-slate-900 font-mono text-sm">
                    {formatCurrency(room.rent, useBn)}
                  </span>
                </div>
              </div>

              {bill && (
                <div className="flex items-center justify-between pt-2 border-t border-slate-200/80 text-xs">
                  <span className="font-semibold text-slate-700">বর্তমান অবশিষ্ট বকেয়া:</span>
                  <span className={`font-mono font-bold text-sm ${bill.due > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {bill.due > 0 ? formatCurrency(bill.due, useBn) : 'পরিশোধিত (৳০)'}
                  </span>
                </div>
              )}
            </div>

            {/* Payment Category Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                কী পরিশোধ করতে চান নির্বাচন করুন:
              </label>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => handleTypeChange('electricity')}
                  className={`py-2 px-2.5 rounded-lg border text-center transition-colors font-medium flex flex-col items-center gap-0.5 ${
                    paymentType === 'electricity'
                      ? 'bg-blue-50 border-blue-600 text-blue-900 font-bold shadow-2xs'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-[11px]">শুধুমাত্র বিদ্যুৎ</span>
                  <span className="text-xs font-mono font-bold text-blue-700">
                    {formatCurrency(electricityDue, useBn)}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTypeChange('both')}
                  className={`py-2 px-2.5 rounded-lg border text-center transition-colors font-medium flex flex-col items-center gap-0.5 ${
                    paymentType === 'both'
                      ? 'bg-blue-50 border-blue-600 text-blue-900 font-bold shadow-2xs'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-[11px]">ভাড়া + বিদ্যুৎ</span>
                  <span className="text-xs font-mono font-bold text-blue-700">
                    {formatCurrency(totalDue, useBn)}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTypeChange('custom')}
                  className={`py-2 px-2.5 rounded-lg border text-center transition-colors font-medium flex flex-col items-center justify-center ${
                    paymentType === 'custom'
                      ? 'bg-blue-50 border-blue-600 text-blue-900 font-bold shadow-2xs'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-xs">অন্যান্য পরিমাণ</span>
                </button>
              </div>
            </div>

            {/* Official Payment Accounts Info Box */}
            <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2 text-xs">
              <span className="font-bold text-indigo-950 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-indigo-700" />
                <span>কর্তৃপক্ষ হৃদয়-এর অফিশিয়াল নম্বরসমূহ:</span>
              </span>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-indigo-100">
                  <div>
                    <span className="text-pink-700 font-bold block">বিকাশ (Personal)</span>
                    <span className="font-mono font-semibold text-slate-800">{bkashNumber}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyNumber(bkashNumber, 'bkash')}
                    className="p-1 text-slate-500 hover:text-indigo-700"
                    title="নম্বর কপি করুন"
                  >
                    {copiedNumber === 'bkash' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-indigo-100">
                  <div>
                    <span className="text-orange-700 font-bold block">নগদ (Personal)</span>
                    <span className="font-mono font-semibold text-slate-800">{nagadNumber}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyNumber(nagadNumber, 'nagad')}
                    className="p-1 text-slate-500 hover:text-indigo-700"
                    title="নম্বর কপি করুন"
                  >
                    {copiedNumber === 'nagad' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Form Fields: Method, Amount, TrxID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  পেমেন্ট মাধ্যম:
                </label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="bkash">বিকাশ (bKash)</option>
                  <option value="nagad">নগদ (Nagad)</option>
                  <option value="rocket">রকেট (Rocket)</option>
                  <option value="cash">সরাসরি ক্যাশ প্রদান</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  পরিশোধের পরিমাণ (৳):
                </label>
                <input
                  type="number"
                  min={1}
                  value={amount || ''}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  placeholder="টাকার পরিমাণ লিখুন"
                  required
                  className="w-full px-3 py-2 text-sm font-mono font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  প্রেরকের মোবাইল নম্বর:
                </label>
                <input
                  type="tel"
                  value={senderPhone}
                  onChange={(e) => setSenderPhone(e.target.value)}
                  placeholder="যে নম্বর থেকে টাকা পাঠিয়েছেন"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ট্রানজ্যাকশন আইডি (TrxID) / নোট:
                </label>
                <input
                  type="text"
                  value={trxId}
                  onChange={(e) => setTrxId(e.target.value)}
                  placeholder="যেমন: BL72X99P বা ক্যাশ"
                  className="w-full px-3 py-2 font-mono uppercase border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting || amount <= 0}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl text-xs sm:text-sm font-bold transition-colors flex items-center justify-center gap-2 shadow-xs"
              >
                <FileCheck className="w-4 h-4" />
                <span>বিল পরিশোধের স্লিপ জমা দিন</span>
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
};
