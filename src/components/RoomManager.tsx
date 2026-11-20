import React, { useState } from 'react';
import { Room, BuildingSettings, BillRecord, AuthSession, canViewRoomFinancials } from '../types';
import {
  ROOM_FLOOR_MAP,
  FLOORS_LIST,
  FLOOR_NAMES_BN,
  formatCurrency,
  formatNum,
} from '../constants';
import { Users, Phone, Edit2, Trash2, Search, Filter, CheckCircle, XCircle, PlusCircle, Building, Lock, EyeOff } from 'lucide-react';

interface RoomManagerProps {
  rooms: Room[];
  bills: BillRecord[];
  settings: BuildingSettings;
  onSaveRoom: (room: Room) => void;
  onDeleteRoomTenant: (roomId: string) => void;
  onOpenNewBill: (roomNo: number) => void;
  isOwner?: boolean;
  onOpenAdminPin?: () => void;
  authSession?: AuthSession;
}

export const RoomManager: React.FC<RoomManagerProps> = ({
  rooms,
  bills,
  settings,
  onSaveRoom,
  onDeleteRoomTenant,
  onOpenNewBill,
  isOwner = true,
  onOpenAdminPin,
  authSession,
}) => {
  const useBn = settings.useBengaliDigits;

  const [selectedRoomNo, setSelectedRoomNo] = useState<number>(1);
  
  // Find currently selected room
  const selectedRoomData = rooms.find((r) => r.no === selectedRoomNo);

  const [floor, setFloor] = useState<number>(selectedRoomData?.floor || ROOM_FLOOR_MAP[1] || 2);
  const [editingId, setEditingId] = useState<string | null>(selectedRoomData?.id || null);
  const [name, setName] = useState(selectedRoomData?.name || '');
  const [phone, setPhone] = useState(selectedRoomData?.phone || '');
  const [rent, setRent] = useState<number>(selectedRoomData?.rent || 0);
  const [rate, setRate] = useState<number>(selectedRoomData?.rate || settings.defaultUnitRate || 12);
  const [isOccupied, setIsOccupied] = useState(selectedRoomData ? selectedRoomData.isOccupied : false);
  const [notes, setNotes] = useState(selectedRoomData?.notes || '');
  const [inlineNotice, setInlineNotice] = useState<string | null>(null);
  const [confirmClearId, setConfirmClearId] = useState<string | null>(null);

  // Keep form fields synced whenever selected room or rooms array updates
  React.useEffect(() => {
    const existing = rooms.find((r) => r.no === selectedRoomNo);
    if (existing) {
      setEditingId(existing.id);
      setFloor(existing.floor || ROOM_FLOOR_MAP[selectedRoomNo] || 2);
      setName(existing.name || '');
      setPhone(existing.phone || '');
      setRent(existing.rent || 0);
      setRate(existing.rate ?? settings.defaultUnitRate ?? 12);
      setIsOccupied(existing.isOccupied);
      setNotes(existing.notes || '');
    }
  }, [selectedRoomNo, rooms, settings.defaultUnitRate]);

  // Filtering state
  const [filterFloor, setFilterFloor] = useState<number | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const handleSelectRoomNo = (rNo: number) => {
    setSelectedRoomNo(rNo);
    const existing = rooms.find((r) => r.no === rNo);
    if (existing) {
      setEditingId(existing.id);
      setFloor(existing.floor || ROOM_FLOOR_MAP[rNo] || 2);
      setName(existing.name || '');
      setPhone(existing.phone || '');
      setRent(existing.rent || 0);
      setRate(existing.rate ?? settings.defaultUnitRate ?? 12);
      setIsOccupied(existing.isOccupied);
      setNotes(existing.notes || '');
    } else {
      setEditingId(null);
      setFloor(ROOM_FLOOR_MAP[rNo] || 2);
      setName('');
      setPhone('');
      setRent(0);
      setRate(settings.defaultUnitRate || 12);
      setIsOccupied(false);
      setNotes('');
    }
  };

  const handleEditClick = (r: Room) => {
    setSelectedRoomNo(r.no);
    setEditingId(r.id);
    setFloor(r.floor || ROOM_FLOOR_MAP[r.no] || 2);
    setName(r.name);
    setPhone(r.phone);
    setRent(r.rent);
    setRate(r.rate);
    setIsOccupied(r.isOccupied);
    setNotes(r.notes || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner) {
      onOpenAdminPin?.();
      return;
    }
    const roomObj: Room = {
      id: editingId || `room-${selectedRoomNo}`,
      no: selectedRoomNo,
      floor: Number(floor) || ROOM_FLOOR_MAP[selectedRoomNo] || 2,
      name: name.trim(),
      phone: phone.trim(),
      rent: Number(rent) || 0,
      rate: Number(rate) || 0,
      isOccupied,
      notes: notes.trim(),
    };

    onSaveRoom(roomObj);
    setInlineNotice(`রুম ${formatNum(selectedRoomNo, useBn)}-এর সকল তথ্য সফলভাবে সংরক্ষিত হয়েছে!`);
    setTimeout(() => setInlineNotice(null), 3500);
  };

  // Filtered rooms
  const filteredRooms = rooms
    .filter((r) => {
      const matchFloor = filterFloor === 'all' || r.floor === filterFloor;
      const matchQuery =
        r.no.toString().includes(searchQuery) ||
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.phone.includes(searchQuery);
      return matchFloor && matchQuery;
    })
    .sort((a, b) => a.no - b.no);

  const selectedFloor = ROOM_FLOOR_MAP[selectedRoomNo] || 2;

  return (
    <div className="space-y-6">
      
      {/* Room & Tenant Edit / Register Form */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            <h3 className="font-bold text-base">
              রুম ও ভাড়াটিয়া নিবন্ধন / সম্পাদনা
            </h3>
          </div>
          <span className="text-xs text-slate-300">
            রুম নম্বর নির্বাচন করে ভাড়া ও ভাড়াটিয়ার তথ্য আপডেট করুন
          </span>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5">
            
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                রুম নম্বর (১–৩৫)
              </label>
              <select
                value={selectedRoomNo}
                onChange={(e) => handleSelectRoomNo(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono font-bold bg-white"
                required
              >
                {Array.from({ length: 35 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    রুম {n} ({FLOOR_NAMES_BN[ROOM_FLOOR_MAP[n]] || 'তলা'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                তলা (Floor)
              </label>
              <select
                value={floor}
                onChange={(e) => setFloor(Number(e.target.value))}
                disabled={!isOwner}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium disabled:bg-slate-100"
              >
                {FLOORS_LIST.map((f) => (
                  <option key={f} value={f}>
                    {FLOOR_NAMES_BN[f]} ({f} তলা)
                  </option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ভাড়াটিয়ার পুরো নাম
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  const v = e.target.value;
                  setName(v);
                  if (v.trim() && !isOccupied) setIsOccupied(true);
                }}
                placeholder="ভাড়াটিয়ার নাম লিখুন (খালি রাখতে চাইলে ফাঁকা রাখুন)"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                মোবাইল নম্বর
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01711XXXXXX"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                রুমের স্ট্যাটাস
              </label>
              <select
                value={isOccupied ? 'yes' : 'no'}
                onChange={(e) => setIsOccupied(e.target.value === 'yes')}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="yes">ভাড়াকৃত (Occupied)</option>
                <option value="no">খালি (Vacant)</option>
              </select>
            </div>

          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                মাসিক ঘর ভাড়া (৳ টাকা)
              </label>
              <input
                type="number"
                min="0"
                step="50"
                value={rent}
                onChange={(e) => setRent(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono font-bold"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                নিজস্ব মিটার প্রতি ইউনিট দর (৳ টাকা)
              </label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={rate}
                onChange={(e) => setRate(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                মন্তব্য বা পেশা (ঐচ্ছিক)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="যেমন: পরিবারসহ থাকেন / চাকরিজীবী"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <div className="flex items-center gap-2">
              {!isOwner ? (
                <button
                  type="button"
                  onClick={onOpenAdminPin}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>তথ্য পরিবর্তন করতে কর্তৃপক্ষ পিন আনলক করুন</span>
                </button>
              ) : (
                <>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors"
                  >
                    আপডেট সংরক্ষণ করুন
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setName('');
                      setPhone('');
                      setNotes('');
                      setIsOccupied(false);
                    }}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors"
                  >
                    ফর্ম পরিষ্কার (খালি)
                  </button>
                </>
              )}
            </div>

            {inlineNotice && (
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                <span>{inlineNotice}</span>
              </span>
            )}
          </div>
        </form>
      </div>

      {/* 35 Rooms Directory Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="px-5 py-3.5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-sm sm:text-base text-slate-900">
              বিল্ডিংয়ের ৩৫টি রুমের পূর্ণাঙ্গ তালিকা
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              মোট রুম: ৩৫টি · ভাড়া দেওয়া: {rooms.filter((r) => r.isOccupied).length}টি · খালি: {35 - rooms.filter((r) => r.isOccupied).length}টি
            </p>
          </div>

          {/* Floor & Search Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs">
              <button
                onClick={() => setFilterFloor('all')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  filterFloor === 'all' ? 'bg-white font-bold text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                সব তলা
              </button>
              {FLOORS_LIST.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilterFloor(f)}
                  className={`px-2 py-1 rounded-md transition-colors ${
                    filterFloor === f ? 'bg-white font-bold text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {f} তলা
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="রুম / ভাড়াটিয়া খুঁজুন..."
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
                <th className="py-2.5 px-3">রুম</th>
                <th className="py-2.5 px-3">তলা</th>
                <th className="py-2.5 px-3">ভাড়াটিয়ার নাম</th>
                <th className="py-2.5 px-3">মোবাইল নম্বর</th>
                <th className="py-2.5 px-3 text-right">মাসিক ভাড়া</th>
                <th className="py-2.5 px-3 text-right">বিদ্যুৎ দর/ইউনিট</th>
                <th className="py-2.5 px-3 text-center">স্ট্যাটাস</th>
                <th className="py-2.5 px-3 text-center">কাজ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredRooms.map((r) => {
                const canView = canViewRoomFinancials(r.no, authSession, isOwner);
                const isMyRoom = authSession?.isLoggedIn && authSession.role === 'tenant' && authSession.roomNo === r.no;

                return (
                  <tr
                    key={r.id}
                    className={`hover:bg-slate-50 transition-colors ${
                      isMyRoom ? 'bg-indigo-50/40 font-semibold' : ''
                    }`}
                  >
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                      <span>রুম {formatNum(r.no, useBn)}</span>
                      {isMyRoom && (
                        <span className="ml-1.5 text-[9px] px-1 py-0.2 bg-indigo-100 text-indigo-700 rounded font-bold">
                          আমার
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {FLOOR_NAMES_BN[r.floor]}
                    </td>
                    {/* Tenant name IS visible */}
                    <td className="py-2.5 px-3 text-slate-900 font-semibold">
                      {r.name || <span className="text-slate-400 italic">খালি রুম</span>}
                      {canView && r.notes && (
                        <span className="text-[10px] text-slate-500 block font-normal">{r.notes}</span>
                      )}
                    </td>
                    {/* Mobile number: ONLY visible to owner or own room */}
                    <td className="py-2.5 px-3 font-mono text-slate-600">
                      {canView ? (
                        r.phone ? (
                          <a href={`tel:${r.phone}`} className="text-blue-700 hover:underline">
                            {r.phone}
                          </a>
                        ) : (
                          '—'
                        )
                      ) : (
                        <span className="text-slate-400 font-sans text-[11px] flex items-center gap-1">
                          <EyeOff className="w-3 h-3 text-slate-400" />
                          <span>🔒 ব্যক্তিগত</span>
                        </span>
                      )}
                    </td>
                    {/* Monthly rent: ONLY visible to owner or own room */}
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-slate-900">
                      {canView ? (
                        formatCurrency(r.rent, useBn)
                      ) : (
                        <span className="text-slate-400 font-sans font-normal text-[11px]">
                          🔒 গোপনীয়
                        </span>
                      )}
                    </td>
                    {/* Electricity rate: ONLY visible to owner or own room */}
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                      {canView ? (
                        formatCurrency(r.rate, useBn)
                      ) : (
                        <span className="text-slate-400 font-sans font-normal text-[11px]">
                          🔒 সংরক্ষিত
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {r.isOccupied ? (
                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                          ভাড়াকৃত
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                          খালি
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {isOwner ? (
                          <>
                            <button
                              onClick={() => handleEditClick(r)}
                              className="px-2 py-1 text-[11px] text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            >
                              এডিট
                            </button>
                            <button
                              onClick={() => onOpenNewBill(r.no)}
                              className="px-2 py-1 text-[11px] text-emerald-700 hover:bg-emerald-50 rounded font-semibold transition-colors"
                            >
                              বিল তৈরি
                            </button>
                            {confirmClearId === r.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => {
                                    onDeleteRoomTenant(r.id);
                                    setConfirmClearId(null);
                                  }}
                                  className="px-1.5 py-0.5 bg-red-600 text-white rounded text-[10px] font-bold"
                                >
                                  হ্যাঁ
                                </button>
                                <button
                                  onClick={() => setConfirmClearId(null)}
                                  className="px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded text-[10px]"
                                >
                                  না
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmClearId(r.id)}
                                className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="ভাড়াটিয়া মুছে খালি করুন"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </>
                        ) : isMyRoom ? (
                          <button
                            onClick={() => handleEditClick(r)}
                            className="px-2.5 py-1 text-[11px] bg-indigo-600 text-white rounded font-medium hover:bg-indigo-700 transition-colors"
                          >
                            আমার তথ্য
                          </button>
                        ) : (
                          <span
                            className="px-2 py-1 text-[11px] text-slate-400 flex items-center gap-1 justify-center"
                            title="অন্যান্য ভাড়াটিয়ার ব্যক্তিগত তথ্য লুকানো"
                          >
                            <Lock className="w-3 h-3 text-slate-400" />
                            <span>লকড</span>
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
