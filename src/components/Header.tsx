import React from 'react';
import { Building2, Plus, Settings, Smartphone, Share2, Lock, ShieldCheck, User, LogOut, LogIn, Sparkles, Headphones } from 'lucide-react';
import { AuthSession } from '../types';
import { APP_NAME, APP_LOGO } from '../constants';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOpenNewBill: () => void;
  onOpenSettings: () => void;
  onOpenInstall: () => void;
  onOpenShare: () => void;
  onOpenHelp: () => void;
  pendingComplaintsCount?: number;
  onOpenAdminLogin: () => void;
  onOpenUserLogin: () => void;
  onLogoutAdmin: () => void;
  onLogoutUser: () => void;
  authSession: AuthSession;
  buildingName: string;
  landlordName?: string;
  landlordTitle?: string;
  isOwner?: boolean;
  isSyncing?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  onOpenNewBill,
  onOpenSettings,
  onOpenInstall,
  onOpenShare,
  onOpenHelp,
  pendingComplaintsCount = 0,
  onOpenAdminLogin,
  onOpenUserLogin,
  onLogoutAdmin,
  onLogoutUser,
  authSession,
  buildingName,
  landlordName,
  landlordTitle,
  isOwner = true,
  isSyncing = false,
}) => {
  return (
    <header className="no-print bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-4 h-16">
        
        {/* Zone 1: Uploaded logo + App Name wordmark */}
        <button
          onClick={() => onTabChange('dashboard')}
          className="flex items-center gap-2.5 text-left text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0 hover:opacity-90 transition-opacity"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#f9f9f9] border border-amber-300/70 overflow-hidden shrink-0 shadow-xs flex items-center justify-center">
            <img
              src={APP_LOGO}
              alt={APP_NAME}
              className="w-full h-full object-contain scale-[1.38]"
            />
          </div>
          <div className="flex flex-col text-left">
            <span className="font-sans font-bold text-sm sm:text-base leading-tight">
              {APP_NAME}
            </span>
            <span className="text-[10px] sm:text-[11px] font-normal text-blue-300">
              {buildingName || 'আলম খান বিল্ডিং'} · {landlordTitle || 'কর্তৃপক্ষ'}: {landlordName || 'হৃদয়'}
            </span>
          </div>
        </button>

        {/* Zone 2: Clean single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-1 sm:gap-2 text-xs lg:text-sm font-medium">
          <button
            onClick={() => onTabChange('dashboard')}
            className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'dashboard'
                ? 'bg-slate-800 text-white font-bold'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            ড্যাশবোর্ড
          </button>
          
          <button
            onClick={() => onTabChange('rooms')}
            className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'rooms'
                ? 'bg-slate-800 text-white font-bold'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            রুম ও ভাড়াটিয়া (৩৫)
          </button>

          <button
            onClick={() => onTabChange('shared')}
            className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'shared'
                ? 'bg-slate-800 text-white font-bold'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            ডাইনিং সাব-মিটার
          </button>

          <button
            onClick={() => onTabChange('bills')}
            className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'bills'
                ? 'bg-slate-800 text-white font-bold'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            মাসিক বিল রেজিস্টার
          </button>

          <button
            onClick={onOpenSettings}
            className="px-3 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
            title="সেটিংস, Gemini API Key ও ক্লাউড ব্যাকআপ"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>সেটিংস ও AI Key</span>
          </button>
        </nav>

        {/* Zone 3: Primary action + Auth buttons (Admin/User Login/Logout) */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          
          {/* 24/7 Help & Complaint Button */}
          <button
            onClick={onOpenHelp}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-emerald-200 hover:text-white bg-emerald-950/80 hover:bg-emerald-800 border border-emerald-500/40 rounded-lg transition-colors whitespace-nowrap shrink-0 shadow-2xs relative"
            title="২৪/৭ হেল্প ডেস্ক, এডমিন যোগাযোগ ও অভিযোগ"
          >
            <Headphones className="w-3.5 h-3.5 text-emerald-400" />
            <span>২৪/৭ হেল্প</span>
            {isOwner && pendingComplaintsCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 bg-amber-400 text-slate-950 rounded-full text-[10px] font-extrabold animate-pulse">
                {pendingComplaintsCount}
              </span>
            )}
          </button>

          {/* Share Button */}
          <button
            onClick={onOpenShare}
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-sky-200 hover:text-white bg-sky-950/70 hover:bg-sky-900 border border-sky-500/40 rounded-lg transition-colors whitespace-nowrap shrink-0 shadow-2xs"
            title="লাইভ অ্যাপ লিংক শেয়ার করুন"
          >
            <Share2 className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden md:inline">শেয়ার</span>
          </button>

          {/* Responsive PWA Install Button (hidden automatically in standalone app) */}
          <div className="hidden sm:inline-flex">
            <PWAInstallButton onOpenInstallModal={onOpenInstall} />
          </div>

          {/* AUTH SECTION 1: Admin is Logged In */}
          {authSession.role === 'admin' && authSession.isLoggedIn ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={onOpenAdminLogin}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-300 bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-500/50 rounded-lg transition-colors shadow-2xs"
                title="কর্তৃপক্ষ হৃদয় (এডমিন সক্রিয়)"
              >
                <span className={`w-2 h-2 rounded-full ${isSyncing ? 'bg-amber-400 animate-ping' : 'bg-emerald-400 animate-pulse'}`} />
                <span className="font-bold">👑 এডমিন</span>
              </button>

              <button
                onClick={onLogoutAdmin}
                className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-semibold text-rose-300 hover:text-white bg-rose-950/80 hover:bg-rose-900 border border-rose-500/40 rounded-lg transition-colors shadow-2xs"
                title="এডমিন লগআউট করুন"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-400" />
                <span className="hidden sm:inline">লগআউট</span>
              </button>
            </div>
          ) : authSession.role === 'tenant' && authSession.isLoggedIn ? (
            /* AUTH SECTION 2: Tenant is Logged In */
            <div className="flex items-center gap-1.5">
              <button
                onClick={onOpenUserLogin}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-indigo-300 bg-indigo-950/90 hover:bg-indigo-900 border border-indigo-500/50 rounded-lg transition-colors shadow-2xs"
                title={`রুম ${authSession.roomNo} এর ইউজার`}
              >
                <User className="w-3.5 h-3.5 text-indigo-400" />
                <span>রুম {authSession.roomNo}</span>
              </button>

              <button
                onClick={onLogoutUser}
                className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-semibold text-rose-300 hover:text-white bg-rose-950/80 hover:bg-rose-900 border border-rose-500/40 rounded-lg transition-colors shadow-2xs"
                title="ইউজার লগআউট করুন"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-400" />
                <span className="hidden sm:inline">লগআউট</span>
              </button>
            </div>
          ) : authSession.role === 'user' && authSession.isLoggedIn ? (
            /* AUTH SECTION 3: General User is Logged In */
            <div className="flex items-center gap-1.5">
              <button
                onClick={onOpenUserLogin}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-indigo-300 bg-indigo-950/90 hover:bg-indigo-900 border border-indigo-500/50 rounded-lg transition-colors shadow-2xs"
                title={`ইউজার: ${authSession.name}`}
              >
                <User className="w-3.5 h-3.5 text-indigo-400" />
                <span>{authSession.name.slice(0, 8)}</span>
              </button>

              <button
                onClick={onLogoutUser}
                className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-semibold text-rose-300 hover:text-white bg-rose-950/80 hover:bg-rose-900 border border-rose-500/40 rounded-lg transition-colors shadow-2xs"
                title="ইউজার লগআউট করুন"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-400" />
                <span className="hidden sm:inline">লগআউট</span>
              </button>
            </div>
          ) : (
            /* AUTH SECTION 4: Logged Out (Guest Mode) */
            <div className="flex items-center gap-1.5">
              <button
                onClick={onOpenAdminLogin}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-amber-200 hover:text-white bg-amber-950/80 hover:bg-amber-900 border border-amber-500/40 rounded-lg transition-colors shadow-2xs"
                title="কর্তৃপক্ষ এডমিন লগইন"
              >
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>এডমিন লগইন</span>
              </button>

              <button
                onClick={onOpenUserLogin}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-sky-200 hover:text-white bg-sky-950/80 hover:bg-sky-900 border border-sky-500/40 rounded-lg transition-colors shadow-2xs"
                title="ভাড়াটিয়া / সাধারণ ইউজার লগইন"
              >
                <LogIn className="w-3.5 h-3.5 text-sky-400" />
                <span>ইউজার লগইন</span>
              </button>
            </div>
          )}

          {/* New Bill Button for Admin */}
          {isOwner && (
            <button
              onClick={onOpenNewBill}
              className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">+ নতুন বিল</span>
              <span className="sm:hidden">বিল</span>
            </button>
          )}

        </div>

      </div>

      {/* Top Session Notice Banner */}
      {!isOwner && (
        <div className="bg-amber-400 text-slate-950 px-4 py-2 text-xs font-semibold flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-xs border-b border-amber-500">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-slate-950 shrink-0" />
            {authSession.role === 'tenant' && authSession.isLoggedIn ? (
              <span>
                🏠 আপনি <strong>রুম {authSession.roomNo} ({authSession.name})</strong>-এর ইউজার হিসেবে লগইন আছেন। আপনার রুমের হিসাব ও রসিদ দেখতে পারবেন।
              </span>
            ) : authSession.role === 'user' && authSession.isLoggedIn ? (
              <span>
                👤 আপনি <strong>{authSession.name}</strong> হিসেবে সাধারণ ইউজার মোডে আছেন (শুধু দর্শন মোড)।
              </span>
            ) : (
              <span>
                🔒 শুধু দর্শন মোড সক্রিয়: আপনি কর্তৃপক্ষ হৃদয়-এর লাইভ হিসাব দেখছেন। পরিবর্তন করতে এডমিন লগইন করুন।
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            {authSession.isLoggedIn ? (
              <button
                onClick={onLogoutUser}
                className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-[11px] font-bold transition-colors flex items-center gap-1"
              >
                <LogOut className="w-3 h-3 text-red-400" />
                <span>ইউজার লগআউট</span>
              </button>
            ) : (
              <>
                <button
                  onClick={onOpenUserLogin}
                  className="px-2.5 py-1 bg-indigo-700 hover:bg-indigo-800 text-white rounded text-[11px] font-bold transition-colors"
                >
                  ইউজার লগইন
                </button>
                <button
                  onClick={onOpenAdminLogin}
                  className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-[11px] font-bold transition-colors"
                >
                  এডমিন লগইন
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Mobile Sub-Navigation Bar */}
      <div className="md:hidden flex items-center gap-1.5 px-3 py-2 bg-slate-950 overflow-x-auto no-scrollbar text-xs border-t border-slate-800/80">
        <button
          onClick={() => onTabChange('dashboard')}
          className={`px-2.5 py-1.5 rounded whitespace-nowrap ${
            activeTab === 'dashboard' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400'
          }`}
        >
          ড্যাশবোর্ড
        </button>
        <button
          onClick={() => onTabChange('rooms')}
          className={`px-2.5 py-1.5 rounded whitespace-nowrap ${
            activeTab === 'rooms' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400'
          }`}
        >
          রুম (৩৫)
        </button>
        <button
          onClick={() => onTabChange('shared')}
          className={`px-2.5 py-1.5 rounded whitespace-nowrap ${
            activeTab === 'shared' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400'
          }`}
        >
          ডাইনিং মিটার
        </button>
        <button
          onClick={() => onTabChange('bills')}
          className={`px-2.5 py-1.5 rounded whitespace-nowrap ${
            activeTab === 'bills' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400'
          }`}
        >
          বিলসমূহ
        </button>
        <button
          onClick={onOpenSettings}
          className="px-2.5 py-1.5 rounded whitespace-nowrap text-indigo-300 font-semibold bg-indigo-950/60 border border-indigo-700/40"
        >
          সেটিংস / AI Key
        </button>
        
        {/* Auth in Mobile bar */}
        {authSession.role === 'admin' && authSession.isLoggedIn ? (
          <button
            onClick={onLogoutAdmin}
            className="px-2 py-1 rounded whitespace-nowrap text-rose-400 font-bold bg-rose-950/80 border border-rose-800/50 flex items-center gap-1"
          >
            <LogOut className="w-3 h-3" />
            <span>এডমিন লগআউট</span>
          </button>
        ) : authSession.isLoggedIn ? (
          <button
            onClick={onLogoutUser}
            className="px-2 py-1 rounded whitespace-nowrap text-rose-400 font-bold bg-rose-950/80 border border-rose-800/50 flex items-center gap-1"
          >
            <LogOut className="w-3 h-3" />
            <span>ইউজার লগআউট</span>
          </button>
        ) : (
          <>
            <button
              onClick={onOpenAdminLogin}
              className="px-2 py-1 rounded whitespace-nowrap text-amber-300 font-bold bg-amber-950/80 border border-amber-800/50"
            >
              এডমিন লগইন
            </button>
            <button
              onClick={onOpenUserLogin}
              className="px-2 py-1 rounded whitespace-nowrap text-sky-300 font-bold bg-sky-950/80 border border-sky-800/50"
            >
              ইউজার লগইন
            </button>
          </>
        )}

        <button
          onClick={onOpenHelp}
          className="px-2.5 py-1 rounded whitespace-nowrap text-emerald-300 font-bold bg-emerald-950/80 border border-emerald-700/50 flex items-center gap-1"
        >
          <Headphones className="w-3 h-3" />
          <span>২৪/৭ হেল্প{isOwner && pendingComplaintsCount > 0 ? ` (${pendingComplaintsCount})` : ''}</span>
        </button>

        <PWAInstallButton onOpenInstallModal={onOpenInstall} compact />

        <button
          onClick={onOpenShare}
          className="px-2.5 py-1 rounded whitespace-nowrap text-sky-300 font-bold bg-sky-950/60 border border-sky-800/50"
        >
          শেয়ার
        </button>
      </div>
    </header>
  );
};

