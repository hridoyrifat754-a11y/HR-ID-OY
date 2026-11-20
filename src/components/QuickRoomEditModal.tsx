import React, { useState } from 'react';
import { Room, BuildingSettings } from '../types';
import { FLOORS_LIST, FLOOR_NAMES_BN, formatNum } from '../constants';
import { X, Check, Edit, Trash2 } from 'lucide-react';

interface QuickRoomEditModalProps {
  room: Room;
  settings: BuildingSettings;
  onSaveRoom: (updatedRoom: Room) => void;
  onClose: () => void;
}

export const QuickRoomEditModal: React.FC<QuickRoomEditModalProps> = ({
  room,
  settings,
  onSaveRoom,
  onClose,
}) => {
  const useBn = settings.useBengaliDigits;
  const [floor, setFloor] = useState<number>(room.floor || 2);
  const [name, setName] = useState(room.name || '');
  const [phone, setPhone] = useState(room.phone || '');
  const [rent, setRent] = useState(room.rent || 0);
  const [rate, setRate] = useState(room.rate ?? 12);
  const [isOccupied, setIsOccupied] = useState(room.isOccupied);
  const [notes, setNotes] = useState(room.notes || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    onSaveRoom({
      ...room,
      floor: Number(floor) || room.floor,
      name: trimmedName,
      phone: trimmedPhone,
      rent: Number(rent) || 0,
      rate: Number(rate) || 0,
      isOccupied,
      notes: notes.trim(),
    });
    onClose();
  };

  const handleClearRoomTenant = () => {
    setName('');
    setPhone('');
    setNotes('');
    setIsOccupied(false);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-6 font-sans">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Edit className="w-5 h-5 text-blue-400" />
            <div>
              <h3 className="font-bold text-base">
                রুম {formatNum(room.no, useBn)} আপডেট ({FLOOR_NAMES_BN[floor] || `${floor} তলা`})
              </h3>
              <span className="text-xs text-slate-300">
                এডমিন: রুমের যেকোনো তথ্য পরিবর্তন বা খালি করুন
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                তলা (Floor)
              </label>
              <select
                value={floor}
                onChange={(e) => setFloor(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white font-semibold"
              >
                {FLOORS_LIST.map((f) => (
                  <option key={f} value={f}>
                    {FLOOR_NAMES_BN[f]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                রুম স্ট্যাটাস
              </label>
              <select
                value={isOccupied ? 'yes' : 'no'}
                onChange={(e) => setIsOccupied(e.target.value === 'yes')}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white font-medium"
              >
                <option value="yes">ভাড়াকৃত (Occupied)</option>
                <option value="no">খালি রুম (Vacant)</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  ভাড়াটিয়ার পুরো নাম
                </label>
                <button
                  type="button"
                  onClick={handleClearRoomTenant}
                  className="text-[11px] text-rose-600 hover:underline font-semibold flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>ভাড়াটিয়া তথ্য খালি করুন</span>
                </button>
              </div>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  const v = e.target.value;
                  setName(v);
                  if (v.trim() && !isOccupied) setIsOccupied(true);
                }}
                placeholder="ভাড়াটিয়ার নাম লিখুন (খালি রাখতে চাইলে ফাঁকা রাখুন)"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                মোবাইল নম্বর
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="017XXXXXXXX"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                মাসিক ঘর ভাড়া (৳)
              </label>
              <input
                type="number"
                min="0"
                step="50"
                value={rent}
                onChange={(e) => setRent(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                বিদ্যুৎ দর প্রতি ইউনিট (৳)
              </label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={rate}
                onChange={(e) => setRate(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-blue-700 font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                মন্তব্য / অতিরিক্ত বিবরণ
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="যেমন: ৩ সদস্যের পরিবার / মিটার নং"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-xs"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors"
            >
              বাতিল
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>আপডেট সংরক্ষণ করুন</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
