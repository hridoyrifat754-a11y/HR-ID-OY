import React, { useState } from 'react';
import { Room, BuildingSettings } from '../types';
import {
  ROOM_FLOOR_MAP,
  FLOORS_LIST,
  FLOOR_NAMES_BN,
  formatCurrency,
  formatNum,
} from '../constants';
import {
  X,
  Check,
  Building2,
  Users,
  Search,
  Zap,
  DollarSign,
  RotateCcw,
  Save,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';

interface BulkRoomUpdateModalProps {
  rooms: Room[];
  settings: BuildingSettings;
  initialSelectedRoomNo?: number;
  onSaveRooms: (updatedRooms: Room[]) => void;
  onClose: () => void;
}

export const BulkRoomUpdateModal: React.FC<BulkRoomUpdateModalProps> = ({
  rooms,
  settings,
  initialSelectedRoomNo,
  onSaveRooms,
  onClose,
}) => {
  const useBn = settings.useBengaliDigits;

  // Local copy of all 35 rooms for batch editing
  const [editableRooms, setEditableRooms] = useState<Room[]>(() => {
    // Clone all rooms
    return rooms.map((r) => ({ ...r })).sort((a, b) => a.no - b.no);
  });

  const [filterFloor, setFilterFloor] = useState<number | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  // Quick batch tools state
  const [batchRate, setBatchRate] = useState<number>(settings.defaultUnitRate || 12);
  const [batchRentDelta, setBatchRentDelta] = useState<number>(500);

  // Handler for single field change in a room row
  const handleRoomChange = (roomNo: number, field: keyof Room, value: any) => {
    setEditableRooms((prev) =>
      prev.map((r) => {
        if (r.no === roomNo) {
          return { ...r, [field]: value };
        }
        return r;
      })
    );
    setHasChanges(true);
  };

  // Batch tool: Set electricity rate across all rooms or selected floor
  const handleApplyBatchRate = () => {
    if (batchRate < 0 || Number.isNaN(batchRate)) return;
    setEditableRooms((prev) =>
      prev.map((r) => {
        if (filterFloor === 'all' || r.floor === filterFloor) {
          return { ...r, rate: batchRate };
        }
        return r;
      })
    );
    setHasChanges(true);
  };

  // Batch tool: Increase/Decrease rent across selected floor or all rooms
  const handleApplyBatchRentAdjustment = (multiplier: 1 | -1) => {
    const delta = batchRentDelta * multiplier;
    setEditableRooms((prev) =>
      prev.map((r) => {
        if (filterFloor === 'all' || r.floor === filterFloor) {
          const newRent = Math.max(0, r.rent + delta);
          return { ...r, rent: newRent };
        }
        return r;
      })
    );
    setHasChanges(true);
  };

  // Quick clear tenant
  const handleClearTenant = (roomNo: number) => {
    setEditableRooms((prev) =>
      prev.map((r) => {
        if (r.no === roomNo) {
          return { ...r, name: '', phone: '', isOccupied: false, notes: '' };
        }
        return r;
      })
    );
    setHasChanges(true);
  };

  // Reset to original
  const handleResetAll = () => {
    setEditableRooms(rooms.map((r) => ({ ...r })).sort((a, b) => a.no - b.no));
    setHasChanges(false);
  };

  // Save all
  const handleSaveAll = () => {
    onSaveRooms(editableRooms);
    setHasChanges(false);
    onClose();
  };

  // Filtered rooms for display
  const filteredRooms = editableRooms.filter((r) => {
    const matchesFloor = filterFloor === 'all' || r.floor === filterFloor;
    const matchesSearch =
      r.no.toString().includes(searchQuery) ||
      (r.name && r.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (r.phone && r.phone.includes(searchQuery));
    return matchesFloor && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="relative w-full max-w-5xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-4 max-h-[92vh] flex flex-col font-sans">
        
        {/* Top Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <Building2 className="w-5 h-5 text-blue-400" />
            <div>
              <h3 className="font-bold text-sm sm:text-base">
                সকল রুম ও ভাড়াটিয়া আপডেট (৩৫ রুম বাল্ক ম্যানেজার)
              </h3>
              <span className="text-[11px] text-slate-300">
                ড্যাশবোর্ড থেকেই সরাসরি যেকোনো রুমের ভাড়া, বিদ্যুৎ দর, ভাড়াটিয়া নাম ও স্ট্যাটাস দ্রুত পরিবর্তন করুন
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasChanges && (
              <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded font-medium">
                অসংরক্ষিত পরিবর্তন আছে
              </span>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick Batch Actions & Filter Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3 shrink-0">
          
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Floor Tabs */}
            <div className="flex flex-wrap items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setFilterFloor('all')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  filterFloor === 'all'
                    ? 'bg-slate-900 font-bold text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                সব তলা (৩৫)
              </button>
              {FLOORS_LIST.map((f) => {
                const count = editableRooms.filter((r) => r.floor === f).length;
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFilterFloor(f)}
                    className={`px-2 py-1 rounded-md transition-colors ${
                      filterFloor === f
                        ? 'bg-slate-900 font-bold text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {FLOOR_NAMES_BN[f]} ({count})
                  </button>
                );
              })}
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="রুম / নাম / ফোন খুঁজুন..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 w-52"
              />
            </div>
          </div>

          {/* Quick Bulk Setting Strip */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 text-xs">
            
            {/* Batch Rate Setter */}
            <div className="p-2.5 bg-white border border-slate-200 rounded-lg flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                <Zap className="w-4 h-4 text-amber-500" />
                <span>বিদ্যুৎ দর সেট ({filterFloor === 'all' ? 'সব তলা' : `${filterFloor} তলা`}):</span>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={batchRate}
                  onChange={(e) => setBatchRate(parseFloat(e.target.value) || 0)}
                  className="w-16 px-2 py-1 text-xs border border-slate-300 rounded font-mono font-bold text-center"
                />
                <span className="text-slate-500">৳</span>
                <button
                  type="button"
                  onClick={handleApplyBatchRate}
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-semibold transition-colors"
                >
                  প্রয়োগ
                </button>
              </div>
            </div>

            {/* Batch Rent Increase */}
            <div className="p-2.5 bg-white border border-slate-200 rounded-lg flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span>ভাড়া পরিবর্তন ({filterFloor === 'all' ? 'সব তলা' : `${filterFloor} তলা`}):</span>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={batchRentDelta}
                  onChange={(e) => setBatchRentDelta(parseFloat(e.target.value) || 0)}
                  className="w-20 px-2 py-1 text-xs border border-slate-300 rounded font-mono font-bold text-center"
                />
                <span className="text-slate-500">৳</span>
                <button
                  type="button"
                  onClick={() => handleApplyBatchRentAdjustment(1)}
                  className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold transition-colors"
                  title="ভাড়া বাড়ান"
                >
                  + বৃদ্ধি
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyBatchRentAdjustment(-1)}
                  className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-semibold transition-colors"
                  title="ভাড়া কমান"
                >
                  - হ্রাস
                </button>
              </div>
            </div>

          </div>

        </div>

        {/* Scrollable Editable Table */}
        <div className="overflow-y-auto flex-1 p-4 bg-slate-100">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold sticky top-0 z-10">
                <tr>
                  <th className="py-2.5 px-3 w-16">রুম নং</th>
                  <th className="py-2.5 px-2.5 w-24">তলা</th>
                  <th className="py-2.5 px-3">ভাড়াটিয়ার নাম ও নোট</th>
                  <th className="py-2.5 px-3 w-36">মোবাইল নম্বর</th>
                  <th className="py-2.5 px-3 w-32 text-right">মাসিক ভাড়া (৳)</th>
                  <th className="py-2.5 px-3 w-28 text-right">বিদ্যুৎ দর/ইউনিট</th>
                  <th className="py-2.5 px-3 w-32 text-center">স্ট্যাটাস</th>
                  <th className="py-2.5 px-2 text-center w-16">একশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredRooms.map((r) => {
                  const isHighlighted = initialSelectedRoomNo === r.no;

                  return (
                    <tr
                      key={r.id}
                      className={`hover:bg-blue-50/40 transition-colors ${
                        isHighlighted ? 'bg-blue-50/80 font-bold' : ''
                      }`}
                    >
                      {/* Room No */}
                      <td className="py-2 px-3 font-mono font-bold text-slate-900">
                        রুম {formatNum(r.no, useBn)}
                      </td>

                      {/* Editable Floor */}
                      <td className="py-1.5 px-2">
                        <select
                          value={r.floor}
                          onChange={(e) => handleRoomChange(r.no, 'floor', Number(e.target.value))}
                          className="w-full px-1.5 py-1 text-xs border border-slate-200 rounded bg-slate-50/60 focus:border-blue-500 font-medium"
                        >
                          {FLOORS_LIST.map((f) => (
                            <option key={f} value={f}>
                              {FLOOR_NAMES_BN[f]}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Tenant Name + Notes */}
                      <td className="py-1.5 px-3 space-y-1">
                        <input
                          type="text"
                          value={r.name}
                          onChange={(e) => handleRoomChange(r.no, 'name', e.target.value)}
                          placeholder="ভাড়াটিয়ার নাম লিখুন"
                          className="w-full px-2.5 py-1 text-xs border border-slate-200 rounded focus:border-blue-500 focus:bg-white focus:outline-hidden bg-slate-50/60"
                        />
                        <input
                          type="text"
                          value={r.notes || ''}
                          onChange={(e) => handleRoomChange(r.no, 'notes', e.target.value)}
                          placeholder="মন্তব্য / বিবরণ (ঐচ্ছিক)"
                          className="w-full px-2.5 py-0.5 text-[11px] border border-slate-200/80 rounded focus:border-blue-500 focus:bg-white focus:outline-hidden bg-white text-slate-600"
                        />
                      </td>

                      {/* Phone */}
                      <td className="py-1.5 px-3">
                        <input
                          type="text"
                          value={r.phone}
                          onChange={(e) => handleRoomChange(r.no, 'phone', e.target.value)}
                          placeholder="017XXXXXXXX"
                          className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:border-blue-500 font-mono bg-slate-50/60"
                        />
                      </td>

                      {/* Rent */}
                      <td className="py-1.5 px-3 text-right">
                        <input
                          type="number"
                          min="0"
                          step="50"
                          value={r.rent}
                          onChange={(e) =>
                            handleRoomChange(r.no, 'rent', parseFloat(e.target.value) || 0)
                          }
                          className="w-24 px-2 py-1 text-xs border border-slate-200 rounded focus:border-blue-500 font-mono font-bold text-right text-slate-900 bg-slate-50/60"
                        />
                      </td>

                      {/* Electricity Rate */}
                      <td className="py-1.5 px-3 text-right">
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={r.rate}
                          onChange={(e) =>
                            handleRoomChange(r.no, 'rate', parseFloat(e.target.value) || 0)
                          }
                          className="w-20 px-2 py-1 text-xs border border-slate-200 rounded focus:border-blue-500 font-mono text-right text-blue-700 font-bold bg-slate-50/60"
                        />
                      </td>

                      {/* Status */}
                      <td className="py-1.5 px-3 text-center">
                        <select
                          value={r.isOccupied ? 'occupied' : 'vacant'}
                          onChange={(e) =>
                            handleRoomChange(r.no, 'isOccupied', e.target.value === 'occupied')
                          }
                          className={`w-full px-2 py-1 text-xs border rounded font-semibold ${
                            r.isOccupied
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : 'bg-slate-100 text-slate-600 border-slate-300'
                          }`}
                        >
                          <option value="occupied">ভাড়াকৃত</option>
                          <option value="vacant">খালি রুম</option>
                        </select>
                      </td>

                      {/* Action */}
                      <td className="py-1.5 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleClearTenant(r.no)}
                          className="text-[10px] text-slate-400 hover:text-rose-600 px-1 py-0.5 rounded hover:bg-rose-50"
                          title="ভাড়াটিয়া মুছে খালি করুন"
                        >
                          খালি
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom Save & Cancel Bar */}
        <div className="p-4 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span>প্রদর্শিত রুম: <strong>{filteredRooms.length}টি</strong> (মোট ৩৫টি)</span>
            <span>·</span>
            <span>মোট ভাড়া: <strong>{formatCurrency(filteredRooms.reduce((acc, r) => acc + r.rent, 0), useBn)}</strong></span>
          </div>

          <div className="flex items-center gap-2">
            {hasChanges && (
              <button
                type="button"
                onClick={handleResetAll}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>রিসেট</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
            >
              বাতিল
            </button>

            <button
              type="button"
              onClick={handleSaveAll}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>সকল রুম সংরক্ষণ করুন</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
