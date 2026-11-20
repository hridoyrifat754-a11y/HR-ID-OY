import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  User,
  Lock,
  Unlock,
  Key,
  X,
  Check,
  AlertCircle,
  Home,
  Phone,
  LogOut,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Wifi,
  WifiOff,
  Sparkles,
  Headphones,
} from 'lucide-react';
import { AuthSession, Room, TenantLoginApproval } from '../types';
import {
  ROOM_FLOOR_MAP,
  FLOOR_NAMES_BN,
  HRIDOY_HELP_MESSAGE,
  SUPPORT_PHONES,
  formatNum,
  APP_LOGO,
} from '../constants';
import { TenantLoginResult } from '../hooks/useCloudSync';
import { ADMIN_GOOGLE_EMAIL } from '../firebase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  authSession: AuthSession;
  rooms: Room[];
  loginApprovals: TenantLoginApproval[];
  isOnline: boolean;
  isFirebaseAdmin?: boolean;
  firebaseUserEmail?: string | null;
  loginAdminWithGoogle?: () => Promise<{ success: boolean; error?: string; email?: string }>;
  loginTenantWithGoogle?: (
    roomNo: number,
    phone?: string,
    tenantName?: string
  ) => Promise<TenantLoginResult>;
  loginAdmin: (pin: string) => Promise<{ success: boolean; error?: string; offline?: boolean }>;
  logoutAdmin: () => void;
  loginTenant: (
    roomNo: number,
    phone?: string,
    tenantName?: string,
    localRooms?: Room[],
    localApprovals?: TenantLoginApproval[]
  ) => Promise<TenantLoginResult>;
  loginUser: (name: string) => Promise<{ success: boolean; error?: string; offline?: boolean }>;
  logoutUser: () => void;
  changeAdminPin: (oldPin: string, newPin: string) => Promise<{ success: boolean; error?: string }>;
  onApproveTenant: (
    roomNo: number,
    status: 'approved' | 'rejected' | 'pending',
    tenantName?: string,
    phone?: string
  ) => Promise<void>;
  onUpdateApprovalsLocal?: (approvals: TenantLoginApproval[]) => void;
  initialTab?: 'admin' | 'user' | 'approvals';
  onSuccessToast?: (msg: string) => void;
  onOpenHelp?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  authSession,
  rooms,
  loginApprovals,
  isOnline,
  isFirebaseAdmin = false,
  firebaseUserEmail,
  loginAdminWithGoogle,
  loginTenantWithGoogle,
  loginAdmin,
  logoutAdmin,
  loginTenant,
  loginUser,
  logoutUser,
  changeAdminPin,
  onApproveTenant,
  onUpdateApprovalsLocal,
  initialTab = 'admin',
  onSuccessToast,
  onOpenHelp,
}) => {
  const [activeTab, setActiveTab] = useState<'admin' | 'user' | 'approvals' | 'pin-change'>(initialTab);

  // Admin form
  const [adminPin, setAdminPin] = useState('');

  // Tenant/User form
  const [userLoginType, setUserLoginType] = useState<'tenant' | 'general'>('tenant');
  const [roomNoInput, setRoomNoInput] = useState<number>(1);
  const [tenantNameInput, setTenantNameInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [generalName, setGeneralName] = useState('');

  // Pin change form
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  // Pre-approve room selector in Approvals tab
  const [quickApproveRoom, setQuickApproveRoom] = useState<number>(1);

  // States
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [pendingState, setPendingState] = useState<{ roomNo: number; message: string } | null>(null);
  const [welcomeSuccess, setWelcomeSuccess] = useState<{
    name: string;
    subtitle: string;
    offline?: boolean;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setErrorMsg('');
      setPendingState(null);
      setWelcomeSuccess(null);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const selectedRoomObj = rooms.find((r) => r.no === Number(roomNoInput));
  const selectedRoomApproval = loginApprovals.find((a) => Number(a.roomNo) === Number(roomNoInput));
  const pendingApprovals = loginApprovals.filter((a) => a.status === 'pending');

  // Preview welcome name on the login form for everyone
  const previewWelcomeName =
    activeTab === 'admin'
      ? 'হৃদয় (এডমিন)'
      : userLoginType === 'tenant'
      ? tenantNameInput.trim() || selectedRoomObj?.name?.trim() || `রুম ${formatNum(roomNoInput, true)} ভাড়াটিয়া`
      : generalName.trim() || 'সম্মানিত ইউজার';

  // Handler: Firebase Google Admin Login
  const handleGoogleAdminLogin = async () => {
    if (!loginAdminWithGoogle) return;
    setErrorMsg('');
    setPendingState(null);
    setLoading(true);
    const res = await loginAdminWithGoogle();
    setLoading(false);
    if (res.success) {
      onSuccessToast?.(`Firebase Auth (${res.email || ADMIN_GOOGLE_EMAIL}) এডমিন লগইন সফল!`);
      setWelcomeSuccess({
        name: 'হৃদয় (Firebase এডমিন)',
        subtitle: `Cloud Firestore নিরাপদ সিঙ্ক সক্রিয় (${res.email || ADMIN_GOOGLE_EMAIL})`,
        offline: false,
      });
    } else {
      setErrorMsg(res.error || 'Google এডমিন লগইন ব্যর্থ হয়েছে।');
    }
  };

  // Handler: Admin PIN Login (Online + Offline)
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setPendingState(null);
    setLoading(true);

    const res = await loginAdmin(adminPin);
    setLoading(false);

    if (res.success) {
      const msg = res.offline
        ? 'অফলাইন মোডে এডমিন (হৃদয়) লগইন সফল!'
        : 'কর্তৃপক্ষ হৃদয় (এডমিন) হিসেবে লগইন সফল!';
      onSuccessToast?.(msg);
      setAdminPin('');
      setWelcomeSuccess({
        name: 'হৃদয় (এডমিন)',
        subtitle: res.offline ? 'অফলাইন এডমিন সেশন চালু হয়েছে' : 'অনলাইন এডমিন সেশন চালু হয়েছে',
        offline: res.offline,
      });
    } else {
      setErrorMsg(res.error || 'ভুল পিন কোড! এডমিন লগইন ব্যর্থ।');
    }
  };

  // Handler: Tenant or General User Login (Online + Offline + Admin Approval)
  const handleUserLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    setPendingState(null);
    setLoading(true);

    if (userLoginType === 'tenant') {
      if (!roomNoInput) {
        setErrorMsg('অনুগ্রহ করে রুম নম্বর নির্বাচন করুন।');
        setLoading(false);
        return;
      }

      const res = await loginTenant(
        Number(roomNoInput),
        phoneInput,
        tenantNameInput.trim() || selectedRoomObj?.name,
        rooms,
        loginApprovals
      );
      setLoading(false);

      if (res.updatedApprovals && onUpdateApprovalsLocal) {
        onUpdateApprovalsLocal(res.updatedApprovals);
      }

      if (res.success) {
        const displayName =
          res.user?.name || tenantNameInput.trim() || selectedRoomObj?.name || `রুম ${roomNoInput} ভাড়াটিয়া`;
        const toastMsg = res.offline
          ? `ওয়েলকাম ${displayName}! অফলাইন লগইন সফল হয়েছে।`
          : `ওয়েলকাম ${displayName}! লগইন সফল হয়েছে।`;
        onSuccessToast?.(toastMsg);
        setWelcomeSuccess({
          name: displayName,
          subtitle: `রুম নম্বর ${formatNum(roomNoInput, true)} (${FLOOR_NAMES_BN[ROOM_FLOOR_MAP[roomNoInput] || 2]})`,
          offline: res.offline,
        });
      } else if (res.pendingApproval) {
        setPendingState({
          roomNo: Number(roomNoInput),
          message:
            res.error ||
            'লগইন করার জন্য এডমিন (হৃদয়)-এর অনুমতি প্রয়োজন। আপনার অনুরোধ পাঠানো হয়েছে।',
        });
      } else {
        setErrorMsg(res.error || 'ভাড়াটিয়া লগইন ব্যর্থ।');
      }
    } else {
      if (!generalName.trim()) {
        setErrorMsg('অনুগ্রহ করে আপনার নাম লিখুন।');
        setLoading(false);
        return;
      }
      const res = await loginUser(generalName);
      setLoading(false);
      if (res.success) {
        onSuccessToast?.(`ওয়েলকাম ${generalName.trim()}! ইউজার লগইন সফল।`);
        setWelcomeSuccess({
          name: generalName.trim(),
          subtitle: res.offline ? 'অফলাইন ইউজার সেশন' : 'সাধারণ ইউজার সেশন',
          offline: res.offline,
        });
      } else {
        setErrorMsg(res.error || 'ইউজার লগইন ব্যর্থ।');
      }
    }
  };

  // Handler: Admin PIN Change
  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (newPin.length < 4) {
      setErrorMsg('নতুন পিন কমপক্ষে ৪ সংখ্যার হতে হবে।');
      return;
    }
    if (newPin !== confirmPin) {
      setErrorMsg('নতুন পিন এবং নিশ্চিতকরণ পিন মিলছে না!');
      return;
    }

    setLoading(true);
    const result = await changeAdminPin(oldPin, newPin);
    setLoading(false);

    if (result.success) {
      onSuccessToast?.('এডমিন পিন সফলভাবে পরিবর্তন হয়েছে!');
      setOldPin('');
      setNewPin('');
      setConfirmPin('');
      setActiveTab('admin');
    } else {
      setErrorMsg(result.error || 'পিন পরিবর্তন ব্যর্থ হয়েছে।');
    }
  };

  // Handler: Logout
  const handleLogout = () => {
    if (authSession.role === 'admin') {
      logoutAdmin();
      onSuccessToast?.('এডমিন সফলভাবে লগআউট হয়েছেন।');
    } else {
      logoutUser();
      onSuccessToast?.('ইউজার সফলভাবে লগআউট হয়েছেন।');
    }
    onClose();
  };

  // Reusable Personalized Welcome & Hridoy Support Card (Shown for everyone!)
  const renderWelcomeSupportCard = (targetName: string, isPostLogin = false) => (
    <div
      className={`rounded-xl border p-3.5 text-xs transition-all ${
        isPostLogin
          ? 'bg-gradient-to-br from-emerald-50 via-teal-50 to-sky-50 border-emerald-300 shadow-sm'
          : 'bg-gradient-to-br from-indigo-50 via-sky-50/70 to-emerald-50/60 border-indigo-200'
      }`}
    >
      <div className="flex items-start gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
          <Sparkles className="w-4 h-4" />
        </div>
        <div className="space-y-1.5 flex-1">
          <div className="font-bold text-sm text-indigo-950">
            ওয়েলকাম {targetName}
          </div>
          <p className="text-slate-700 leading-relaxed text-[11.5px]">
            {HRIDOY_HELP_MESSAGE}
          </p>
          <div className="pt-1 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-600">ফোন নাম্বার:</span>
            {SUPPORT_PHONES.map((num, idx) => (
              <React.Fragment key={num}>
                <a
                  href={`tel:${num}`}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-md font-mono font-bold text-[11px] transition-colors shadow-2xs"
                >
                  <Phone className="w-3 h-3 text-emerald-600" />
                  <span>{num}</span>
                </a>
                {idx === 0 && <span className="text-slate-400 font-bold">/</span>}
              </React.Fragment>
            ))}
            {onOpenHelp && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenHelp();
                }}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-bold text-[11px] transition-colors shadow-2xs ml-auto"
              >
                <Headphones className="w-3 h-3" />
                <span>২৪/৭ হেল্প / অভিযোগ</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#f9f9f9] border border-amber-300/70 overflow-hidden shrink-0 shadow-xs flex items-center justify-center">
              <img
                src={APP_LOGO}
                alt="আলম খান বিল্ডিং"
                className="w-full h-full object-contain scale-[1.38]"
              />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base leading-tight">
                {activeTab === 'admin'
                  ? 'এডমিন লগইন (কর্তৃপক্ষ)'
                  : activeTab === 'user'
                  ? 'ভাড়াটিয়া ও ইউজার লগইন'
                  : activeTab === 'approvals'
                  ? 'ভাড়াটিয়া লগইন অনুমতি প্যানেল'
                  : 'এডমিন পিন কোড পরিবর্তন'}
              </h3>
              <p className="text-[11px] text-slate-300 flex items-center gap-2">
                <span>আলম খান বিল্ডিং · হৃদয়</span>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-slate-800 text-[10px]">
                  {isOnline ? (
                    <>
                      <Wifi className="w-2.5 h-2.5 text-emerald-400" />
                      <span className="text-emerald-300">অনলাইন ও অফলাইন</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="w-2.5 h-2.5 text-amber-400" />
                      <span className="text-amber-300">অফলাইন মোড সচল</span>
                    </>
                  )}
                </span>
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

        {/* Current Active Session Status Strip */}
        <div className="px-5 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 truncate">
            <span className="text-slate-500 shrink-0">বর্তমান অবস্থা:</span>
            {authSession.isLoggedIn ? (
              <span
                className={`px-2 py-0.5 rounded-full font-bold text-[11px] truncate ${
                  authSession.role === 'admin'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-blue-100 text-blue-800 border border-blue-300'
                }`}
              >
                {authSession.role === 'admin' ? '👑 এডমিন' : '👤 ইউজার'} ({authSession.name})
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full font-bold text-[11px] bg-slate-200 text-slate-700">
                🔒 লগইন করা নেই
              </span>
            )}
          </div>

          {authSession.isLoggedIn && (
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-bold transition-colors shadow-2xs shrink-0"
            >
              <LogOut className="w-3 h-3" />
              <span>লগআউট</span>
            </button>
          )}
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-semibold overflow-x-auto">
          <button
            onClick={() => {
              setActiveTab('admin');
              setErrorMsg('');
              setPendingState(null);
              setWelcomeSuccess(null);
            }}
            className={`flex-1 py-2.5 px-2 text-center border-b-2 transition-colors flex items-center justify-center gap-1 whitespace-nowrap ${
              activeTab === 'admin'
                ? 'border-blue-600 text-blue-700 bg-white font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>এডমিন</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('user');
              setErrorMsg('');
              setPendingState(null);
              setWelcomeSuccess(null);
            }}
            className={`flex-1 py-2.5 px-2 text-center border-b-2 transition-colors flex items-center justify-center gap-1 whitespace-nowrap ${
              activeTab === 'user'
                ? 'border-blue-600 text-blue-700 bg-white font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>ভাড়াটিয়া / ইউজার</span>
          </button>

          {authSession.role === 'admin' && authSession.isLoggedIn && (
            <>
              <button
                onClick={() => {
                  setActiveTab('approvals');
                  setErrorMsg('');
                  setPendingState(null);
                  setWelcomeSuccess(null);
                }}
                className={`flex-1 py-2.5 px-2 text-center border-b-2 transition-colors flex items-center justify-center gap-1 whitespace-nowrap ${
                  activeTab === 'approvals'
                    ? 'border-blue-600 text-blue-700 bg-white font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>অনুমতি ({formatNum(pendingApprovals.length, true)})</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('pin-change');
                  setErrorMsg('');
                  setPendingState(null);
                  setWelcomeSuccess(null);
                }}
                className={`flex-1 py-2.5 px-2 text-center border-b-2 transition-colors flex items-center justify-center gap-1 whitespace-nowrap ${
                  activeTab === 'pin-change'
                    ? 'border-blue-600 text-blue-700 bg-white font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Key className="w-3.5 h-3.5" />
                <span>পিন</span>
              </button>
            </>
          )}
        </div>

        {/* Content Area */}
        <div className="p-5 space-y-4">
          {/* Post-login Success Welcome Screen */}
          {welcomeSuccess ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <div>লগইন সফলভাবে সম্পন্ন হয়েছে!</div>
                  <div className="text-[11px] font-normal text-emerald-700">
                    {welcomeSuccess.subtitle}
                  </div>
                </div>
              </div>

              {renderWelcomeSupportCard(welcomeSuccess.name, true)}

              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
              >
                ড্যাশবোর্ডে প্রবেশ করুন
              </button>
            </div>
          ) : (
            <>
              {/* Always show personalized Welcome & Hridoy Help Message during login */}
              {activeTab !== 'approvals' && activeTab !== 'pin-change' && (
                renderWelcomeSupportCard(previewWelcomeName, false)
              )}

              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{errorMsg}</span>
                </div>
              )}

              {pendingState && (
                <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-950 space-y-2.5">
                  <div className="flex items-start gap-2">
                    <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="font-bold text-amber-900">
                        এডমিন অনুমতির জন্য অপেক্ষমাণ (রুম {formatNum(pendingState.roomNo, true)})
                      </div>
                      <p className="text-amber-800 leading-relaxed text-[11px]">
                        {pendingState.message}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleUserLogin()}
                      disabled={loading}
                      className="flex-1 py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[11px] flex items-center justify-center gap-1.5"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                      <span>অনুমতি হয়েছে কিনা চেক ও লগইন করুন</span>
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 1: ADMIN LOGIN */}
              {activeTab === 'admin' && (
                <div className="space-y-4">
                  {/* Firebase Google Admin Sign-In Card */}
                  <div className="p-3.5 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-xl border border-slate-700 space-y-2.5 shadow-xs">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-cyan-300">
                        <ShieldCheck className="w-4 h-4 text-cyan-400" />
                        <span>Firebase Auth — নিরাপদ এডমিন লগইন</span>
                      </div>
                      {isFirebaseAdmin && (
                        <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 rounded text-[10px] font-bold">
                          ✓ সংযুক্ত
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      অনলাইন Cloud Firestore-এ স্থায়ী সংরক্ষণ, সিকিউরিটি রুলস সুরক্ষা ও ক্লাউড ব্যাকআপের জন্য অনুমোদিত Google অ্যাকাউন্ট (<strong>{ADMIN_GOOGLE_EMAIL}</strong>) দিয়ে সাইন-ইন করুন।
                    </p>
                    {isFirebaseAdmin ? (
                      <div className="text-[11px] bg-emerald-950/60 border border-emerald-500/30 rounded-lg px-3 py-2 text-emerald-200 font-medium">
                        সংযুক্ত একাউন্ট: {firebaseUserEmail || ADMIN_GOOGLE_EMAIL}
                      </div>
                    ) : (
                      loginAdminWithGoogle && (
                        <button
                          type="button"
                          onClick={handleGoogleAdminLogin}
                          disabled={loading || !isOnline}
                          className="w-full py-2.5 bg-white hover:bg-slate-100 disabled:bg-slate-600 disabled:text-slate-300 text-slate-900 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 shadow-xs"
                        >
                          <ShieldCheck className="w-4 h-4 text-blue-600" />
                          <span>
                            {!isOnline
                              ? 'অফলাইন: Google লগইন অনলাইনে পাওয়া যাবে'
                              : loading
                              ? 'Google যাচাই চলছে...'
                              : 'Google দিয়ে নিরাপদ এডমিন লগইন'}
                          </span>
                        </button>
                      )
                    )}
                  </div>

                  {/* Classic Online + Offline PIN Form */}
                  <form onSubmit={handleAdminLogin} className="space-y-3 pt-1">
                    <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-slate-700 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-blue-900">
                        <Lock className="w-3.5 h-3.5 text-blue-600" />
                        <span>অফলাইন ও দ্রুত এডমিন পিন লগইন (হৃদয়)</span>
                      </div>
                      <p className="text-slate-600 text-[11px] leading-relaxed">
                        ইন্টারনেট না থাকলেও এডমিন পিন দিয়ে রুম এডিট ও হিসাব করতে পারবেন।
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        এডমিন গোপন পিন কোড:
                      </label>
                      <div className="relative">
                        <input
                          type="password"
                          maxLength={10}
                          value={adminPin}
                          onChange={(e) => setAdminPin(e.target.value)}
                          placeholder="৪ সংখ্যার গোপন পিন দিন"
                          required
                          className="w-full px-4 py-3 text-center text-xl tracking-widest font-mono font-bold border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        <div className="absolute right-3 top-3.5 text-slate-400">
                          <Lock className="w-4 h-4" />
                        </div>
                      </div>
                      <span className="block text-[11px] text-slate-500 mt-1.5 text-center">
                        (ডিফল্ট পিন: <strong>7540</strong> · অনলাইন/অফলাইন উভয় ক্ষেত্রে কাজ করে)
                      </span>
                    </div>

                    <button
                      type="submit"
                      disabled={loading || !adminPin}
                      className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 shadow-xs"
                    >
                      <Unlock className="w-4 h-4" />
                      <span>{loading ? 'যাচাই করা হচ্ছে...' : 'পিন দিয়ে এডমিন লগইন করুন'}</span>
                    </button>
                  </form>
                </div>
              )}

              {/* TAB 2: USER / TENANT LOGIN */}
              {activeTab === 'user' && (
                <form onSubmit={handleUserLogin} className="space-y-3.5">
                  <div className="flex bg-slate-100 p-1 rounded-xl gap-1 text-xs font-medium">
                    <button
                      type="button"
                      onClick={() => {
                        setUserLoginType('tenant');
                        setErrorMsg('');
                        setPendingState(null);
                      }}
                      className={`flex-1 py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                        userLoginType === 'tenant'
                          ? 'bg-white text-blue-700 font-bold shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Home className="w-3.5 h-3.5" />
                      <span>ভাড়াটিয়া লগইন (অনুমতিসহ)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setUserLoginType('general');
                        setErrorMsg('');
                        setPendingState(null);
                      }}
                      className={`flex-1 py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                        userLoginType === 'general'
                          ? 'bg-white text-blue-700 font-bold shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>সাধারণ ইউজার</span>
                    </button>
                  </div>

                  {userLoginType === 'tenant' ? (
                    <>
                      <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 flex items-center justify-between gap-2">
                        <span>ভাড়াটিয়া লগইনের জন্য এডমিনের অনুমতি প্রয়োজন।</span>
                        {selectedRoomApproval?.status === 'approved' ? (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold shrink-0">
                            ✓ অনুমোদিত
                          </span>
                        ) : selectedRoomApproval?.status === 'pending' ? (
                          <span className="px-2 py-0.5 bg-amber-200 text-amber-900 rounded font-bold shrink-0">
                            ⏳ অপেক্ষমাণ
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded font-bold shrink-0">
                            অনুমতি প্রয়োজন
                          </span>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          আপনার রুম নম্বর নির্বাচন করুন (১ হতে ৩৫):
                        </label>
                        <select
                          value={roomNoInput}
                          onChange={(e) => {
                            setRoomNoInput(Number(e.target.value));
                            setPendingState(null);
                            setErrorMsg('');
                          }}
                          className="w-full px-3 py-2.5 text-xs font-bold border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                          {Array.from({ length: 35 }, (_, i) => i + 1).map((no) => {
                            const fl = ROOM_FLOOR_MAP[no] || 2;
                            const rm = rooms.find((r) => r.no === no);
                            return (
                              <option key={no} value={no}>
                                রুম {formatNum(no, true)} ({FLOOR_NAMES_BN[fl]})
                                {rm?.name ? ` — ${rm.name}` : ''}
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            ভাড়াটিয়ার নাম:
                          </label>
                          <input
                            type="text"
                            value={tenantNameInput}
                            onChange={(e) => setTenantNameInput(e.target.value)}
                            placeholder={selectedRoomObj?.name || 'আপনার নাম লিখুন'}
                            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            মোবাইল নম্বর (যাচাই):
                          </label>
                          <input
                            type="tel"
                            value={phoneInput}
                            onChange={(e) => setPhoneInput(e.target.value)}
                            placeholder="01XXXXXXXXX"
                            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        আপনার নাম:
                      </label>
                      <input
                        type="text"
                        value={generalName}
                        onChange={(e) => setGeneralName(e.target.value)}
                        placeholder="আপনার নাম লিখুন"
                        className="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 shadow-xs"
                  >
                    <User className="w-4 h-4" />
                    <span>
                      {loading
                        ? 'যাচাই করা হচ্ছে...'
                        : userLoginType === 'tenant'
                        ? selectedRoomApproval?.status === 'approved'
                          ? 'ভাড়াটিয়া হিসেবে প্রবেশ করুন'
                          : 'লগইন / এডমিনের অনুমতি নিন'
                        : 'ইউজার হিসেবে প্রবেশ করুন'}
                    </span>
                  </button>

                  {userLoginType === 'tenant' && loginTenantWithGoogle && isOnline && (
                    <button
                      type="button"
                      disabled={loading}
                      onClick={async () => {
                        setErrorMsg('');
                        setPendingState(null);
                        setLoading(true);
                        const res = await loginTenantWithGoogle(
                          Number(roomNoInput),
                          phoneInput,
                          tenantNameInput.trim() || selectedRoomObj?.name
                        );
                        setLoading(false);
                        if (res.success) {
                          const displayName =
                            res.user?.name ||
                            tenantNameInput.trim() ||
                            selectedRoomObj?.name ||
                            `রুম ${roomNoInput} ভাড়াটিয়া`;
                          onSuccessToast?.(`ওয়েলকাম ${displayName}! Google ভাড়াটিয়া লগইন সফল।`);
                          setWelcomeSuccess({
                            name: displayName,
                            subtitle: `রুম নম্বর ${formatNum(roomNoInput, true)} (${FLOOR_NAMES_BN[ROOM_FLOOR_MAP[roomNoInput] || 2]})`,
                            offline: false,
                          });
                        } else if (res.pendingApproval) {
                          setPendingState({
                            roomNo: Number(roomNoInput),
                            message:
                              res.error ||
                              'Google অ্যাকাউন্ট নিবন্ধিত হয়েছে! এডমিন অনুমতি দিলেই প্রবেশ করতে পারবেন।',
                          });
                        } else {
                          setErrorMsg(res.error || 'Google ভাড়াটিয়া লগইন ব্যর্থ।');
                        }
                      }}
                      className="w-full py-2.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 shadow-2xs"
                    >
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>Google দিয়ে নিরাপদ ভাড়াটিয়া লগইন (Firebase Auth)</span>
                    </button>
                  )}
                </form>
              )}

              {/* TAB 3: ADMIN TENANT APPROVAL MANAGEMENT */}
              {activeTab === 'approvals' && authSession.role === 'admin' && (
                <div className="space-y-4">
                  <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs space-y-2">
                    <div className="font-bold text-indigo-950">
                      সরাসরি যেকোনো রুমের লগইন অনুমতি দিন:
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={quickApproveRoom}
                        onChange={(e) => setQuickApproveRoom(Number(e.target.value))}
                        className="flex-1 px-2.5 py-2 text-xs font-semibold border border-indigo-300 rounded-lg bg-white"
                      >
                        {Array.from({ length: 35 }, (_, i) => i + 1).map((no) => {
                          const rm = rooms.find((r) => r.no === no);
                          return (
                            <option key={no} value={no}>
                              রুম {formatNum(no, true)} ({FLOOR_NAMES_BN[ROOM_FLOOR_MAP[no] || 2]})
                              {rm?.name ? ` — ${rm.name}` : ''}
                            </option>
                          );
                        })}
                      </select>
                      <button
                        type="button"
                        onClick={async () => {
                          const rm = rooms.find((r) => r.no === quickApproveRoom);
                          await onApproveTenant(quickApproveRoom, 'approved', rm?.name, rm?.phone);
                          onSuccessToast?.(`রুম ${quickApproveRoom} লগইন অনুমোদিত হয়েছে!`);
                        }}
                        className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shrink-0"
                      >
                        ✓ অনুমতি দিন
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {loginApprovals.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                        এখনও কোনো ভাড়াটিয়া লগইন অনুরোধ বা অনুমোদন নেই।
                      </div>
                    ) : (
                      loginApprovals.map((req) => (
                        <div
                          key={req.roomNo}
                          className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                            req.status === 'pending'
                              ? 'bg-amber-50 border-amber-300'
                              : req.status === 'approved'
                              ? 'bg-emerald-50/70 border-emerald-200'
                              : 'bg-rose-50/70 border-rose-200'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <span>রুম {formatNum(req.roomNo, true)}</span>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                  req.status === 'approved'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : req.status === 'pending'
                                    ? 'bg-amber-200 text-amber-900'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {req.status === 'approved'
                                  ? 'অনুমোদিত'
                                  : req.status === 'pending'
                                  ? 'অনুমতি চাইছে'
                                  : 'বাতিল'}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-600 truncate">
                              {req.tenantName} {req.phone ? `· ${req.phone}` : ''}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {req.status !== 'approved' && (
                              <button
                                type="button"
                                onClick={() =>
                                  onApproveTenant(req.roomNo, 'approved', req.tenantName, req.phone)
                                }
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1"
                              >
                                <Check className="w-3 h-3" />
                                <span>অনুমোদন</span>
                              </button>
                            )}
                            {req.status !== 'rejected' && (
                              <button
                                type="button"
                                onClick={() =>
                                  onApproveTenant(req.roomNo, 'rejected', req.tenantName, req.phone)
                                }
                                className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1"
                              >
                                <XCircle className="w-3 h-3" />
                                <span>বাতিল</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: CHANGE PIN */}
              {activeTab === 'pin-change' && (
                <form onSubmit={handleChangePin} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      বর্তমান এডমিন পিন:
                    </label>
                    <input
                      type="password"
                      value={oldPin}
                      onChange={(e) => setOldPin(e.target.value)}
                      placeholder="বর্তমান পিন কোড"
                      required
                      className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      নতুন গোপন পিন (কমপক্ষে ৪ সংখ্যা):
                    </label>
                    <input
                      type="password"
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value)}
                      placeholder="নতুন গোপন পিন"
                      required
                      className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      নতুন পিন নিশ্চিত করুন:
                    </label>
                    <input
                      type="password"
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value)}
                      placeholder="পুনরায় নতুন পিন দিন"
                      required
                      className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !oldPin || !newPin || !confirmPin}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 shadow-xs"
                  >
                    <Key className="w-4 h-4" />
                    <span>{loading ? 'সংরক্ষণ করা হচ্ছে...' : 'নতুন পিন সংরক্ষণ করুন'}</span>
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
