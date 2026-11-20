import React from 'react';
import {
  Room,
  BillRecord,
  JointMeterRecord,
  BuildingSettings,
  AuthSession,
  TenantLoginApproval,
  canViewRoomFinancials,
} from '../types';
import {
  ROOM_FLOOR_MAP,
  FLOORS_LIST,
  FLOOR_NAMES_BN,
  ROOM_UNIT_GROUPS,
  getRoomUnitGroup,
  formatCurrency,
  formatNum,
  formatMonthName,
  HRIDOY_HELP_MESSAGE,
  SUPPORT_PHONES,
  APP_LOGO,
} from '../constants';
import {
  Building2,
  Users,
  Receipt,
  CheckCircle2,
  AlertCircle,
  Zap,
  ChevronLeft,
  ChevronRight,
  Plus,
  Printer,
  FileSpreadsheet,
  PhoneCall,
  Clock,
  ArrowUpRight,
  SlidersHorizontal,
  Edit2,
  Smartphone,
  RotateCcw,
  Share2,
  Lock,
  Cloud,
  LogOut,
  User,
  ShieldCheck,
  FileText,
  CreditCard,
  Sparkles,
  EyeOff,
  Check,
  XCircle,
  Phone,
  Headphones
} from 'lucide-react';
const RevenueTrendsChart = React.lazy(() =>
  import('./RevenueTrendsChart').then((m) => ({ default: m.RevenueTrendsChart }))
);

interface DashboardViewProps {
  rooms: Room[];
  bills: BillRecord[];
  shared: JointMeterRecord[];
  settings: BuildingSettings;
  selectedMonth: string;
  onSelectMonth: (month: string) => void;
  onOpenNewBill: (roomNo?: number) => void;
  onOpenNewShared: () => void;
  onViewReceipt: (bill: BillRecord) => void;
  onOpenBatchPrint: () => void;
  onNavigateTab: (tab: string) => void;
  onOpenBulkRoomUpdate: (targetRoomNo?: number) => void;
  onQuickEditRoom: (room: Room) => void;
  onOpenInstall?: () => void;
  onResetAllToZero?: () => void;
  isOwner?: boolean;
  onOpenShare?: () => void;
  onOpenAdminLogin?: () => void;
  onOpenUserLogin?: () => void;
  onLogoutAdmin?: () => void;
  onLogoutUser?: () => void;
  authSession?: AuthSession;
  onOpenPayBill?: (room: Room, bill?: BillRecord | null) => void;
  loginApprovals?: TenantLoginApproval[];
  onApproveTenant?: (
    roomNo: number,
    status: 'approved' | 'rejected' | 'pending',
    tenantName?: string,
    phone?: string
  ) => Promise<void>;
  onOpenApprovalsPanel?: () => void;
  onOpenHelp?: () => void;
  onOpenSettings?: () => void;
  pendingComplaintsCount?: number;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  rooms,
  bills,
  shared,
  settings,
  selectedMonth,
  onSelectMonth,
  onOpenNewBill,
  onOpenNewShared,
  onViewReceipt,
  onOpenBatchPrint,
  onNavigateTab,
  onOpenBulkRoomUpdate,
  onQuickEditRoom,
  onOpenInstall,
  onResetAllToZero,
  isOwner = true,
  onOpenShare,
  onOpenAdminLogin,
  onOpenUserLogin,
  onLogoutAdmin,
  onLogoutUser,
  authSession,
  onOpenPayBill,
  loginApprovals = [],
  onApproveTenant,
  onOpenApprovalsPanel,
  onOpenHelp,
  onOpenSettings,
  pendingComplaintsCount = 0,
}) => {
  const useBn = settings.useBengaliDigits;

  // Month navigation helper
  const changeMonth = (delta: number) => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const date = new Date(y, m - 1 + delta, 1);
    const newMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    onSelectMonth(newMonth);
  };

  // Filter bills for selected month
  const monthBills = bills.filter((b) => b.month === selectedMonth);
  const monthShared = shared.filter((s) => s.month === selectedMonth);

  // Stats calculation
  const totalRooms = 35;
  const occupiedRooms = rooms.filter((r) => r.isOccupied).length;
  const vacantRooms = totalRooms - occupiedRooms;

  const totalBilled = monthBills.reduce((acc, b) => acc + b.total, 0);
  const totalCollected = monthBills.reduce((acc, b) => acc + b.paid, 0);
  const totalDue = monthBills.reduce((acc, b) => acc + b.due, 0);
  const totalSharedAmount = monthShared.reduce((acc, s) => acc + s.amount, 0);

  // Quick lookup of bill by room ID for the selected month
  const billByRoomId = new Map<string, BillRecord>();
  monthBills.forEach((b) => billByRoomId.set(b.roomId, b));

  // Outstanding due list for this month
  const unpaidBills = monthBills.filter((b) => b.due > 0).sort((a, b) => b.due - a.due);

  // Tenant personalized room info if logged in as tenant
  const tenantRoom = authSession?.role === 'tenant' && authSession.roomNo
    ? rooms.find((r) => r.no === authSession.roomNo)
    : null;
  const tenantBill = tenantRoom ? billByRoomId.get(tenantRoom.id) : null;
  const pendingApprovals = loginApprovals.filter((a) => a.status === 'pending');
  const welcomePersonName =
    authSession?.isLoggedIn && authSession?.name
      ? authSession.role === 'tenant' && tenantRoom?.name
        ? tenantRoom.name
        : authSession.name
      : 'সম্মানিত ভাড়াটিয়া';

  return (
    <div className="space-y-6">

      {/* Personalized Welcome & Hridoy Support Card (Shown for everyone) */}
      <div className="bg-gradient-to-r from-emerald-50 via-teal-50/70 to-sky-50 border border-emerald-200/90 rounded-2xl p-4 sm:p-5 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-[#f9f9f9] border border-emerald-300/80 overflow-hidden shrink-0 shadow-xs flex items-center justify-center mt-0.5">
            <img
              src={APP_LOGO}
              alt={settings.buildingName || 'আলম খান বিল্ডিং'}
              className="w-full h-full object-contain scale-[1.38]"
            />
          </div>
          <div className="space-y-1">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              ওয়েলকাম {welcomePersonName}
            </h2>
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
              {HRIDOY_HELP_MESSAGE}
            </p>
            <div className="pt-1 flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-slate-600">ফোন নাম্বার:</span>
              {SUPPORT_PHONES.map((num, idx) => (
                <React.Fragment key={num}>
                  <a
                    href={`tel:${num}`}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg font-mono font-bold transition-colors shadow-2xs"
                  >
                    <Phone className="w-3 h-3 text-emerald-600" />
                    <span>{num}</span>
                  </a>
                  {idx === 0 && <span className="text-slate-400 font-bold">/</span>}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {onOpenHelp && (
            <button
              onClick={onOpenHelp}
              className="px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shrink-0 transition-colors shadow-xs border bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-500"
            >
              <Headphones className="w-4 h-4" />
              <span>২৪/৭ হেল্প ও অভিযোগ করুন</span>
              {isOwner && pendingComplaintsCount > 0 && (
                <span className="px-1.5 py-0.2 bg-amber-300 text-slate-950 rounded-full text-[10px] font-extrabold">
                  {formatNum(pendingComplaintsCount, useBn)}
                </span>
              )}
            </button>
          )}

          {isOwner && onOpenApprovalsPanel && (
            <button
              onClick={onOpenApprovalsPanel}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shrink-0 transition-colors shadow-xs border ${
                pendingApprovals.length > 0
                  ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 border-amber-400 animate-pulse'
                  : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>
                লগইন অনুমতি ({formatNum(pendingApprovals.length, useBn)})
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Admin Pending Login Approvals Banner (Visible only to Admin when requests exist) */}
      {isOwner && pendingApprovals.length > 0 && onApproveTenant && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-700" />
              <span className="font-bold text-sm text-amber-950">
                নতুন ভাড়াটিয়া লগইন অনুমতির অনুরোধ ({formatNum(pendingApprovals.length, useBn)} জন)
              </span>
            </div>
            {onOpenApprovalsPanel && (
              <button
                onClick={onOpenApprovalsPanel}
                className="text-xs font-bold text-indigo-700 hover:underline"
              >
                সকল অনুমতি পরিচালনা করুন →
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {pendingApprovals.map((req) => (
              <div
                key={req.roomNo}
                className="bg-white border border-amber-200 rounded-xl p-3 flex items-center justify-between gap-2 text-xs shadow-2xs"
              >
                <div className="min-w-0">
                  <div className="font-bold text-slate-900">
                    রুম {formatNum(req.roomNo, useBn)} ({FLOOR_NAMES_BN[ROOM_FLOOR_MAP[req.roomNo] || 2]})
                  </div>
                  <div className="text-[11px] text-slate-600 truncate">
                    {req.tenantName} {req.phone ? `· ${req.phone}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => onApproveTenant(req.roomNo, 'approved', req.tenantName, req.phone)}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] flex items-center gap-1"
                  >
                    <Check className="w-3 h-3" />
                    <span>অনুমতি</span>
                  </button>
                  <button
                    onClick={() => onApproveTenant(req.roomNo, 'rejected', req.tenantName, req.phone)}
                    className="p-1.5 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-lg"
                    title="বাতিল করুন"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Personalized Tenant Welcome & Bill Card if logged in as tenant */}
      {authSession?.role === 'tenant' && tenantRoom && (
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 rounded-2xl shadow-xl border border-indigo-700/40 relative overflow-hidden">
          <div className="absolute right-0 top-0 w-80 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-indigo-800/60">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold tracking-wider text-amber-300 uppercase px-2 py-0.5 bg-amber-400/10 border border-amber-400/20 rounded-md">
                  আমার রুম ড্যাশবোর্ড
                </span>
                <span className="text-xs text-indigo-300">
                  {settings.buildingName}
                </span>
              </div>
              <h2 className="text-lg sm:text-2xl font-bold flex items-center gap-2.5">
                <span>রুম নম্বর {formatNum(tenantRoom.no, useBn)}</span>
                <span className="text-xs px-2.5 py-0.5 bg-blue-600/80 rounded-full font-medium text-blue-100">
                  {FLOOR_NAMES_BN[tenantRoom.floor]}
                </span>
              </h2>
              <p className="text-xs text-slate-300 mt-1 flex items-center gap-2">
                <span>ভাড়াটিয়া: <strong className="text-white">{tenantRoom.name || authSession.name}</strong></span>
                <span>·</span>
                <span className="font-mono">{tenantRoom.phone || authSession.phone || 'মোবাইল নম্বর নেই'}</span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {onOpenPayBill && (
                <button
                  onClick={() => onOpenPayBill(tenantRoom, tenantBill)}
                  className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md hover:shadow-lg active:scale-95"
                >
                  <Zap className="w-4 h-4 fill-slate-950 text-slate-950" />
                  <span>কারেন্ট ও রুম বিল দিন</span>
                </button>
              )}

              {tenantBill && (
                <button
                  onClick={() => onViewReceipt(tenantBill)}
                  className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <Receipt className="w-4 h-4" />
                  <span>মানি রসিদ</span>
                </button>
              )}

              {onLogoutUser && (
                <button
                  onClick={onLogoutUser}
                  className="px-3 py-2 bg-slate-800 hover:bg-rose-900/60 text-slate-300 hover:text-white rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 border border-slate-700"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>লগআউট</span>
                </button>
              )}
            </div>
          </div>

          <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 text-xs">
            <div className="p-3 bg-slate-900/80 rounded-xl border border-indigo-900/50">
              <span className="text-indigo-300 block text-[11px] mb-0.5">মাসিক রুম ভাড়া</span>
              <span className="text-base sm:text-lg font-bold text-white font-mono tabular-nums">
                {formatCurrency(tenantRoom.rent, useBn)}
              </span>
            </div>

            <div className="p-3 bg-slate-900/80 rounded-xl border border-indigo-900/50">
              <span className="text-indigo-300 block text-[11px] mb-0.5">
                বিদ্যুৎ বিল ({formatMonthName(selectedMonth, useBn)})
              </span>
              <span className="text-base sm:text-lg font-bold text-amber-300 font-mono tabular-nums">
                {tenantBill ? formatCurrency(tenantBill.electricityCost + tenantBill.sharedElectricity, useBn) : '৳০'}
              </span>
              {tenantBill && (
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  নিজস্ব {formatNum(tenantBill.units, useBn)} u + ডাইনিং
                </span>
              )}
            </div>

            <div className="p-3 bg-slate-900/80 rounded-xl border border-indigo-900/50">
              <span className="text-indigo-300 block text-[11px] mb-0.5">মোট দাবি</span>
              <span className="text-base sm:text-lg font-bold text-white font-mono tabular-nums">
                {tenantBill ? formatCurrency(tenantBill.total, useBn) : formatCurrency(tenantRoom.rent, useBn)}
              </span>
            </div>

            <div className={`p-3 rounded-xl border ${
              tenantBill && tenantBill.due > 0
                ? 'bg-rose-950/60 border-rose-500/50 text-rose-200'
                : 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
            }`}>
              <span className="block text-[11px] mb-0.5">
                {tenantBill && tenantBill.due > 0 ? 'বকেয়া রয়েছে' : 'বিল পরিশোধ অবস্থা'}
              </span>
              <span className="text-base sm:text-lg font-bold font-mono tabular-nums">
                {tenantBill
                  ? tenantBill.due > 0
                    ? formatCurrency(tenantBill.due, useBn)
                    : 'পরিশোধিত (৳০ বকেয়া)'
                  : 'হিসাব প্রস্তুত'}
              </span>
            </div>
          </div>
        </div>
      )}
      
      {/* Month Selector & Quick Actions Strip */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200">
        <div className="flex items-center gap-2">
          <button
            onClick={() => changeMonth(-1)}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
            title="পূর্ববর্তী মাস"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <div className="px-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-center min-w-[160px]">
            <span className="text-xs text-slate-500 block">হিসাবের মাস</span>
            <span className="font-bold text-slate-900 text-sm sm:text-base">
              {formatMonthName(selectedMonth, useBn)}
            </span>
          </div>

          <button
            onClick={() => changeMonth(1)}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
            title="পরবর্তী মাস"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          <button
            onClick={() => onSelectMonth(new Date().toISOString().slice(0, 7))}
            className="text-xs px-2.5 py-2 text-blue-700 hover:bg-blue-50 font-medium rounded-lg transition-colors border border-blue-200 ml-1"
          >
            চলতি মাস
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-300 text-xs font-semibold rounded-lg shadow-xs transition-colors"
              title="নিজস্ব Gemini API Key ও সেটিংস ম্যানেজ করুন"
            >
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>AI Key ও সেটিংস</span>
            </button>
          )}
          {onOpenShare && (
            <button
              onClick={onOpenShare}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
              title="অ্যাপের লাইভ আপডেট লিংক শেয়ার করুন"
            >
              <Share2 className="w-4 h-4" />
              <span>শেয়ার করুন</span>
            </button>
          )}

          {/* Dedicated Login/Logout Actions in Dashboard Strip */}
          {authSession?.role === 'admin' && authSession.isLoggedIn ? (
            <button
              onClick={onLogoutAdmin}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 text-xs font-semibold rounded-lg shadow-xs transition-colors"
              title="এডমিন মোড থেকে লগআউট করুন"
            >
              <LogOut className="w-4 h-4 text-rose-600" />
              <span>এডমিন লগআউট</span>
            </button>
          ) : authSession?.isLoggedIn ? (
            <button
              onClick={onLogoutUser}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 text-xs font-semibold rounded-lg shadow-xs transition-colors"
              title="ইউজার লগআউট করুন"
            >
              <LogOut className="w-4 h-4 text-rose-600" />
              <span>ইউজার লগআউট</span>
            </button>
          ) : (
            <>
              {onOpenAdminLogin && (
                <button
                  onClick={onOpenAdminLogin}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-semibold rounded-lg shadow-xs transition-colors"
                >
                  <Lock className="w-4 h-4 text-amber-600" />
                  <span>এডমিন লগইন</span>
                </button>
              )}
              {onOpenUserLogin && (
                <button
                  onClick={onOpenUserLogin}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-300 text-xs font-semibold rounded-lg shadow-xs transition-colors"
                >
                  <User className="w-4 h-4 text-indigo-600" />
                  <span>ইউজার লগইন</span>
                </button>
              )}
            </>
          )}

          {isOwner ? (
            <>
              <button
                onClick={() => onOpenBulkRoomUpdate()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
                title="সকল রুমের ভাড়া, বিদ্যুৎ দর ও ভাড়াটিয়া একসাথে আপডেট করুন"
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span>সকল রুম আপডেট (৩৫)</span>
              </button>
              <button
                onClick={() => onOpenNewBill()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>নতুন বিল তৈরি</span>
              </button>
              <button
                onClick={onOpenNewShared}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
              >
                <Zap className="w-4 h-4" />
                <span>ডাইনিং মিটার রিডিং</span>
              </button>
            </>
          ) : (
            onOpenAdminLogin && (
              <button
                onClick={onOpenAdminLogin}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-semibold rounded-lg shadow-xs transition-colors"
                title="কর্তৃপক্ষ হিসেবে আনলক করুন"
              >
                <Lock className="w-4 h-4 text-amber-400" />
                <span>কর্তৃপক্ষ আনলক (এডিট করতে)</span>
              </button>
            )
          )}

          {isOwner && (
            <button
              onClick={onOpenBatchPrint}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
              title="শুধুমাত্র এডমিন: একটি A4 পেজে ৪টি A6 বিল গ্যালারিতে ছবি সেভ, PDF ডাউনলোড ও প্রিন্ট"
            >
              <Printer className="w-4 h-4" />
              <span>সকল রসিদ A4 (৪×A6) ({formatNum(monthBills.length, useBn)})</span>
            </button>
          )}
          {onOpenInstall && (
            <button
              onClick={onOpenInstall}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
              title="অ্যান্ড্রয়েড ফোনে সরাসরি অ্যাপ (APK) ইনস্টল করুন"
            >
              <Smartphone className="w-4 h-4" />
              <span>মোবাইল অ্যাপ</span>
            </button>
          )}
          {isOwner && onResetAllToZero && (
            <button
              onClick={onResetAllToZero}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-lg shadow-xs transition-colors"
              title="সকল হিসাব শূন্য (০) করুন ও সম্পূর্ণ নতুন করে শুরু করুন"
            >
              <RotateCcw className="w-4 h-4 text-rose-600" />
              <span>হিসাব ০ করুন</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">মোট রুম</span>
            <Building2 className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {formatNum(totalRooms, useBn)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            ভাড়াকৃত {formatNum(occupiedRooms, useBn)} · খালি {formatNum(vacantRooms, useBn)}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">বিল সম্পন্ন</span>
            <Receipt className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-blue-700 font-mono tabular-nums">
            {formatNum(monthBills.length, useBn)} <span className="text-xs text-slate-400 font-sans">/ {formatNum(totalRooms, useBn)}</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            বাকি {formatNum(Math.max(0, totalRooms - monthBills.length), useBn)} রুম
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">মোট বিল দাবি</span>
            <Clock className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {formatCurrency(totalBilled, useBn)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            ভাড়া + বিদ্যুৎ + অন্যান্য
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">মোট আদায়</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-emerald-700 font-mono tabular-nums">
            {formatCurrency(totalCollected, useBn)}
          </div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1">
            {totalBilled > 0 ? `${Math.round((totalCollected / totalBilled) * 100)}% আদায় সম্পন্ন` : '—'}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">বকেয়া বাকি</span>
            <AlertCircle className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-red-600 font-mono tabular-nums">
            {formatCurrency(totalDue, useBn)}
          </div>
          <div className="text-[11px] text-red-600 font-medium mt-1">
            {unpaidBills.length > 0 ? `${formatNum(unpaidBills.length, useBn)} জনের বকেয়া` : 'কোনো বকেয়া নেই'}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">ডাইনিং বিদ্যুৎ বিল</span>
            <Zap className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-amber-700 font-mono tabular-nums">
            {formatCurrency(totalSharedAmount, useBn)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {formatNum(monthShared.length, useBn)}টি মিটার এন্ট্রি
          </div>
        </div>
      </div>

      {/* 6-Month Revenue, Collection & Due Trends Chart (Lazy Loaded) */}
      <React.Suspense
        fallback={
          <div className="bg-white rounded-xl border border-slate-200 p-6 h-80 flex items-center justify-center text-xs text-slate-400">
            চার্ট লোড হচ্ছে...
          </div>
        }
      >
        <RevenueTrendsChart
          bills={bills}
          selectedMonth={selectedMonth}
          useBn={useBn}
        />
      </React.Suspense>

      {/* Main Floor-by-Floor Interactive Matrix */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              বিল্ডিং ফ্লোর প্ল্যান ও রুম স্ট্যাটাস ({formatMonthName(selectedMonth, useBn)})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              ২য় থেকে ৭ম তলার ৩৫টি রুমের লাইভ ভাড়া ও বিল অবস্থা। সরাসরি রসিদ বা বিল তৈরি করতে রুমে ক্লিক করুন।
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {isOwner && (
              <button
                onClick={() => onOpenBulkRoomUpdate()}
                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>সকল ৩৫ রুম একসাথেই আপডেট</span>
              </button>
            )}
            <div className="flex items-center gap-3 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span>পরিশোধিত</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <span>বকেয়া আছে</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300"></span>
                <span>বিল তৈরি হয়নি</span>
              </span>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Unit/Pair & Single Room Structure Summary on Dashboard */}
          <div className="border border-indigo-200/80 rounded-xl p-4 bg-gradient-to-br from-indigo-50/50 via-white to-slate-50 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-indigo-100">
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  রুম ইউনিট/জোড়া, সিঙ্গেল ও ডাইনিং সাব-মিটার কাঠামো
                </h4>
                <p className="text-[11px] text-slate-600">
                  প্রতিটি জোড়া ইউনিটে ৩টি সাব-মিটার (২টি রুম মিটার + ১টি ডাইনিং) · ডাইনিং মিটার: রুম ১–২ (÷২), রুম ৩–৪–৫ (÷৩), রুম ৬–৭ (÷২), ৩৪–৩৫ (÷২) এবং ৯–৩২ জোড়া
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded">
                  ইউনিট/জোড়া: {formatNum(ROOM_UNIT_GROUPS.filter((g) => g.type === 'unit').length, useBn)}টি
                </span>
                <span className="px-2 py-0.5 bg-sky-100 text-sky-800 rounded">
                  সিঙ্গেল: {formatNum(ROOM_UNIT_GROUPS.filter((g) => g.type === 'single').length, useBn)}টি (+৩৪, ৩৫)
                </span>
                <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded">
                  ডাইনিং: ১–২ · ৩–৪–৫ · ৬–৭
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-xs">
              {/* Unit / Pair List */}
              <div className="bg-white border border-slate-200/80 rounded-lg p-3 space-y-2">
                <div className="text-[11px] font-bold text-indigo-900 flex items-center justify-between">
                  <span>ইউনিট / জোড়া রুমসমূহ</span>
                  <span className="text-slate-400 font-normal">৯–১০ থেকে ৩১–৩২</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {ROOM_UNIT_GROUPS.filter((g) => g.type === 'unit').map((g) => {
                    const pairRooms = g.rooms.map((n) => rooms.find((r) => r.no === n));
                    const occupiedCount = pairRooms.filter((r) => r?.isOccupied).length;
                    return (
                      <div
                        key={g.id}
                        className="px-2.5 py-1.5 rounded-md border border-slate-200 bg-slate-50/70 flex flex-col justify-between"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold text-slate-800 text-[11px]">
                            {g.label}
                          </span>
                          <span className="text-[9px] text-slate-500">
                            {FLOOR_NAMES_BN[g.floor]}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 truncate mt-0.5">
                          {pairRooms.map((pr) => pr?.name || `রুম ${formatNum(pr?.no || 0, useBn)}`).join(' · ')}
                        </div>
                        <div className="text-[9px] text-indigo-700 font-medium mt-0.5">
                          {occupiedCount === 2 ? '২ রুম ভাড়াকৃত' : occupiedCount === 1 ? '১ রুম ভাড়াকৃত' : 'খালি'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Single Rooms List */}
              <div className="bg-white border border-slate-200/80 rounded-lg p-3 space-y-2">
                <div className="text-[11px] font-bold text-sky-900 flex items-center justify-between">
                  <span>সিঙ্গেল রুমসমূহ (১–৮ ও ৩৩)</span>
                  <span className="text-slate-400 font-normal">২য়, ৩য় ও ৭ম তলা</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {ROOM_UNIT_GROUPS.filter((g) => g.type === 'single').map((g) => {
                    const rm = rooms.find((r) => r.no === g.rooms[0]);
                    return (
                      <div
                        key={g.id}
                        className="px-2.5 py-1.5 rounded-md border border-sky-200/80 bg-sky-50/40 flex flex-col justify-between"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold text-sky-950 text-[11px]">
                            {g.label}
                          </span>
                          <span className="text-[9px] text-sky-700 font-semibold">
                            {FLOOR_NAMES_BN[g.floor]}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-600 truncate mt-0.5">
                          {rm?.name || 'খালি রুম'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {FLOORS_LIST.map((floor) => {
            // Find all rooms on this floor
            const floorRooms = rooms
              .filter((r) => r.floor === floor)
              .sort((a, b) => a.no - b.no);

            if (!floorRooms.length) return null;

            return (
              <div key={floor} className="border border-slate-200 rounded-lg p-3 bg-slate-50/50">
                <div className="flex items-center justify-between mb-2.5 px-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900">
                      {FLOOR_NAMES_BN[floor]}
                    </span>
                    <span className="text-xs text-slate-500">
                      ({formatNum(floorRooms.length, useBn)}টি রুম)
                    </span>
                  </div>
                  {isOwner && (
                    <button
                      onClick={() => onOpenBulkRoomUpdate(floorRooms[0]?.no)}
                      className="text-[11px] text-indigo-700 hover:text-indigo-900 font-semibold hover:underline flex items-center gap-1"
                      title="এই তলার সকল রুমের তথ্য একসাথে আপডেট করুন"
                    >
                      <SlidersHorizontal className="w-3 h-3" />
                      <span>এই তলার রুমসমূহ আপডেট</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2.5">
                  {floorRooms.map((r) => {
                    const bill = billByRoomId.get(r.id);
                    const isBilled = !!bill;
                    const isFullyPaid = isBilled && bill.due <= 0;
                    const hasDue = isBilled && bill.due > 0;
                    const canView = canViewRoomFinancials(r.no, authSession, isOwner);
                    const isMyRoom = authSession?.isLoggedIn && authSession.role === 'tenant' && authSession.roomNo === r.no;
                    const unitMeta = getRoomUnitGroup(r.no);

                    // If NOT allowed to view financials (i.e. other room member):
                    // ONLY the name is visible. Phone number, bill, and room rent are hidden!
                    if (!canView) {
                      return (
                        <div
                          key={r.id}
                          className="p-3 rounded-lg border border-slate-200/90 bg-slate-50/60 text-left transition-all hover:border-slate-300 hover:bg-white"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-mono font-bold text-sm text-slate-800">
                              রুম {formatNum(r.no, useBn)}
                            </span>
                            {unitMeta ? (
                              <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${
                                unitMeta.type === 'unit'
                                  ? 'bg-indigo-100 text-indigo-800'
                                  : 'bg-sky-100 text-sky-800'
                              }`}>
                                {unitMeta.shortLabel}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                <EyeOff className="w-2.5 h-2.5 text-slate-400" />
                                <span>সংরক্ষিত</span>
                              </span>
                            )}
                          </div>

                          <div className="mt-2">
                            {/* Member name IS visible per user specification */}
                            <div className="text-xs font-semibold text-slate-800 truncate" title={r.name || 'খালি রুম'}>
                              {r.name || 'খালি রুম'}
                            </div>
                            {/* Number, bill, and room rent are HIDDEN */}
                            <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1 font-sans">
                              <span>ভাড়া ও বিল:</span>
                              <span className="text-slate-400">🔒 গোপনীয়</span>
                            </div>
                          </div>

                          <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-400">
                            <span className="text-[10px] text-slate-400 italic">অন্যান্য রুমের তথ্য</span>
                            <span className="text-[10px] text-slate-400">🔒 লকড</span>
                          </div>
                        </div>
                      );
                    }

                    // For the user's OWN room OR for Director Hridoy (Admin):
                    return (
                      <div
                        key={r.id}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          isMyRoom
                            ? 'ring-2 ring-indigo-500 bg-gradient-to-br from-indigo-50/80 via-white to-blue-50/50 border-indigo-300 shadow-sm'
                            : isFullyPaid
                            ? 'bg-emerald-50/70 border-emerald-200 hover:border-emerald-400'
                            : hasDue
                            ? 'bg-amber-50/70 border-amber-300 hover:border-amber-500'
                            : 'bg-white border-slate-200 hover:border-slate-400'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-mono font-bold text-sm text-slate-900 flex items-center gap-1">
                            <span>রুম {formatNum(r.no, useBn)}</span>
                            {isMyRoom && (
                              <span className="text-[9px] font-bold text-indigo-700 bg-indigo-100 px-1 py-0.2 rounded">
                                আমার
                              </span>
                            )}
                          </span>
                          {isFullyPaid ? (
                            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded">
                              পরিশোধিত
                            </span>
                          ) : hasDue ? (
                            <span className="text-[10px] font-bold text-red-600 bg-red-100/80 px-1.5 py-0.5 rounded font-mono">
                              বকেয়া ৳{formatNum(bill.due, useBn)}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                              বিল বাকি
                            </span>
                          )}
                        </div>

                        {unitMeta && (
                          <div className="mt-1">
                            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded inline-block ${
                              unitMeta.type === 'unit'
                                ? 'bg-indigo-100 text-indigo-800'
                                : 'bg-sky-100 text-sky-800'
                            }`}>
                              {unitMeta.label}
                            </span>
                          </div>
                        )}

                        <div className="mt-1.5">
                          <div className="text-xs font-semibold text-slate-800 truncate" title={r.name}>
                            {r.name || 'খালি রুম'}
                          </div>
                          <div className="text-[11px] text-slate-600 font-mono mt-0.5 tabular-nums">
                            ভাড়া: {formatCurrency(r.rent, useBn)}
                          </div>
                          {bill && (
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5 tabular-nums">
                              কারেন্ট: {formatCurrency(bill.electricityCost + bill.sharedElectricity, useBn)}
                            </div>
                          )}
                        </div>

                        <div className="mt-2.5 pt-2 border-t border-slate-200/80 flex items-center justify-between gap-1">
                          {isBilled ? (
                            <button
                              onClick={() => onViewReceipt(bill)}
                              className="text-xs text-blue-700 hover:text-blue-900 font-semibold inline-flex items-center gap-0.5"
                            >
                              <span>রসিদ</span>
                              <ArrowUpRight className="w-3 h-3" />
                            </button>
                          ) : isOwner ? (
                            <button
                              onClick={() => onOpenNewBill(r.no)}
                              className="text-xs text-emerald-700 hover:text-emerald-900 font-semibold inline-flex items-center gap-0.5"
                            >
                              <span>+ বিল</span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400">বিল প্রস্তুত নয়</span>
                          )}

                          {/* If it's my room, give quick pay button */}
                          {isMyRoom && onOpenPayBill && (
                            <button
                              onClick={() => onOpenPayBill(r, bill)}
                              className="text-[10px] px-2 py-0.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded flex items-center gap-0.5 shadow-2xs"
                              title="কারেন্ট ও রুম বিল পরিশোধ করুন"
                            >
                              <Zap className="w-3 h-3 fill-slate-950" />
                              <span>বিল দিন</span>
                            </button>
                          )}

                          {isOwner && (
                            <button
                              onClick={() => onQuickEditRoom(r)}
                              className="text-[11px] text-slate-500 hover:text-indigo-700 font-medium px-1.5 py-0.5 rounded hover:bg-indigo-50 transition-colors flex items-center gap-0.5"
                              title="রুম ও ভাড়াটিয়ার তথ্য আপডেট করুন"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>আপডেট</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Due Alert & Reminders Section — PRIVACY RESTRICTION: Only Owner/Admin can see other tenants' debts */}
      {isOwner && unpaidBills.length > 0 && (
        <div className="bg-white rounded-xl border border-red-200 overflow-hidden shadow-xs">
          <div className="px-5 py-3.5 bg-red-50/70 border-b border-red-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <span className="font-bold text-sm text-red-900">
                কর্তৃপক্ষ এডমিন: চলতি মাসের বকেয়া তালিকা ({formatNum(unpaidBills.length, useBn)} জন ভাড়াটিয়া)
              </span>
            </div>
            <span className="font-mono font-bold text-sm text-red-700">
              মোট বকেয়া: {formatCurrency(totalDue, useBn)}
            </span>
          </div>

          <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
            {unpaidBills.map((b) => (
              <div key={b.id} className="p-3.5 flex flex-wrap items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center font-mono font-bold text-red-800 text-sm">
                    {formatNum(b.roomNo, useBn)}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900">
                      {b.tenantName} <span className="text-xs font-normal text-slate-500">({FLOOR_NAMES_BN[b.floor]})</span>
                    </div>
                    <div className="text-xs text-slate-500 font-mono">
                      ফোন: {b.tenantPhone || '—'} · মোট বিল: {formatCurrency(b.total, useBn)} · জমা: {formatCurrency(b.paid, useBn)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-xs text-slate-500 block">বকেয়া পরিমাণ</span>
                    <span className="text-base font-bold text-red-600 font-mono tabular-nums">
                      {formatCurrency(b.due, useBn)}
                    </span>
                  </div>
                  <button
                    onClick={() => onViewReceipt(b)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-medium transition-colors"
                  >
                    রসিদ
                  </button>
                  {b.tenantPhone && (
                    <a
                      href={`tel:${b.tenantPhone}`}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-200 transition-colors"
                      title="কল করুন"
                    >
                      <PhoneCall className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
