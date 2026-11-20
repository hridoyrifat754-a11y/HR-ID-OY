import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { AppDatabase, BillRecord, ComplaintRecord, JointMeterRecord, Room, BuildingSettings, PaymentRecord } from './types';
import { STORAGE_KEY, DEFAULT_SETTINGS, ROOM_FLOOR_MAP, getFreshEmptyDatabase, getFresh35Rooms } from './constants';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { OfflineSyncBanner } from './components/OfflineSyncBanner';
import { useCloudSync } from './hooks/useCloudSync';
import { Check, AlertCircle, RefreshCw, AlertTriangle } from 'lucide-react';

// Lazy-load secondary tabs and heavy modals (splits jspdf, html2canvas, qrcode, etc. out of initial load)
const RoomManager = lazy(() => import('./components/RoomManager').then((m) => ({ default: m.RoomManager })));
const JointMeterManager = lazy(() => import('./components/JointMeterManager').then((m) => ({ default: m.JointMeterManager })));
const BillingManager = lazy(() => import('./components/BillingManager').then((m) => ({ default: m.BillingManager })));
const ReceiptModal = lazy(() => import('./components/ReceiptModal').then((m) => ({ default: m.ReceiptModal })));
const BatchPrintModal = lazy(() => import('./components/BatchPrintModal').then((m) => ({ default: m.BatchPrintModal })));
const BackupModal = lazy(() => import('./components/BackupModal').then((m) => ({ default: m.BackupModal })));
const BulkRoomUpdateModal = lazy(() => import('./components/BulkRoomUpdateModal').then((m) => ({ default: m.BulkRoomUpdateModal })));
const QuickRoomEditModal = lazy(() => import('./components/QuickRoomEditModal').then((m) => ({ default: m.QuickRoomEditModal })));
const InstallAppModal = lazy(() => import('./components/InstallAppModal').then((m) => ({ default: m.InstallAppModal })));
const ShareAppModal = lazy(() => import('./components/ShareAppModal').then((m) => ({ default: m.ShareAppModal })));
const AuthModal = lazy(() => import('./components/AuthModal').then((m) => ({ default: m.AuthModal })));
const PayBillModal = lazy(() => import('./components/PayBillModal').then((m) => ({ default: m.PayBillModal })));
const HelpComplaintModal = lazy(() => import('./components/HelpComplaintModal').then((m) => ({ default: m.HelpComplaintModal })));

const TabLoadingFallback = () => (
  <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-xs text-slate-500 flex items-center justify-center gap-2 shadow-2xs">
    <RefreshCw className="w-4 h-4 text-emerald-600 animate-spin" />
    <span>লোড হচ্ছে...</span>
  </div>
);

const ModalLoadingFallback = () => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 backdrop-blur-xs">
    <div className="bg-white px-5 py-3.5 rounded-xl shadow-xl border border-slate-200 flex items-center gap-2.5 text-xs font-semibold text-slate-700">
      <RefreshCw className="w-4 h-4 text-emerald-600 animate-spin" />
      <span>উইন্ডো চালু হচ্ছে...</span>
    </div>
  </div>
);

export default function App() {
  const remoteMergeRef = useRef<(remoteDb: AppDatabase) => void>(() => {});
  const lastForegroundSyncRef = useRef<number>(0);

  // Cloud sync & Authority security hook with complete Auth + Firestore + SSE Real-Time features
  const {
    authSession,
    isOwner,
    isSyncing,
    isOnline,
    lastUpdated,
    syncError,
    firebaseUser,
    isFirebaseAdmin,
    firebaseConnected,
    firebaseQuotaError,
    pendingSyncCount,
    loginAdminWithGoogle,
    loginTenantWithGoogle,
    loginAdmin,
    logoutAdmin,
    loginTenant,
    loginUser,
    approveTenantLogin,
    submitComplaint,
    replyComplaint,
    recordPaymentInFirestore,
    removeBillFromFirestore,
    removeSharedFromFirestore,
    clearFirestoreTransactions,
    syncPendingNow,
    logoutUser,
    logoutAll,
    verifyPin,
    fetchLatestDatabase,
    saveDatabaseOnline,
    changeAdminPin,
  } = useCloudSync((remoteDb) => {
    remoteMergeRef.current(remoteDb);
  });

  // Load database with multi-layer persistence fallback ONLY for verified Admin or Tenant sessions
  const [database, setDatabase] = useState<AppDatabase>(() => {
    if (!authSession.isLoggedIn || (authSession.role !== 'admin' && authSession.role !== 'tenant')) {
      return getFreshEmptyDatabase();
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('alam_khan_permanent_db');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.rooms && parsed.rooms.length > 0) {
          const userSettings = parsed.settings || {};
          const baseRooms = getFresh35Rooms();
          const normalizedRooms = baseRooms.map((base) => {
            const found = parsed.rooms.find((r: Room) => Number(r.no) === base.no);
            return found ? { ...base, ...found, floor: ROOM_FLOOR_MAP[base.no] || found.floor } : base;
          });
          return {
            rooms: normalizedRooms,
            shared: parsed.shared || [],
            bills: parsed.bills || [],
            payments: parsed.payments || [],
            loginApprovals: parsed.loginApprovals || [],
            complaints: parsed.complaints || [],
            lastUpdated: parsed.lastUpdated,
            settings: {
              ...DEFAULT_SETTINGS,
              ...userSettings,
              landlordName: 'হৃদয়',
              landlordTitle:
                userSettings.landlordTitle && !String(userSettings.landlordTitle).includes('পরিচালক')
                  ? userSettings.landlordTitle
                  : 'কর্তৃপক্ষ',
              landlordPhone:
                !userSettings.landlordPhone || userSettings.landlordPhone === '০১৭১১-০০০০০০'
                  ? '01939022271 / 09638194963'
                  : userSettings.landlordPhone,
              buildingName:
                userSettings.buildingName &&
                userSettings.buildingName !== '৩৫ রুম বাড়ি (হৃদয়)' &&
                userSettings.buildingName !== '৩৫ রুম বাড়ি হিসাব'
                  ? userSettings.buildingName
                  : 'আলম খান বিল্ডিং',
            },
          };
        }
      }
    } catch (e) {
      console.error('Failed to parse stored data:', e);
    }
    return getFreshEmptyDatabase();
  });

  // Active tab state
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  
  // Selected month filter (e.g. "2026-11")
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    return new Date().toISOString().slice(0, 7);
  });

  // Modal states
  const [activeReceiptBill, setActiveReceiptBill] = useState<BillRecord | null>(null);
  const [showBatchPrint, setShowBatchPrint] = useState(false);
  const [showSettingsBackup, setShowSettingsBackup] = useState(false);
  const [defaultBillingRoomNo, setDefaultBillingRoomNo] = useState<number | undefined>(undefined);
  const [showBulkRoomModal, setShowBulkRoomModal] = useState(false);
  const [targetBulkRoomNo, setTargetBulkRoomNo] = useState<number | undefined>(undefined);
  const [quickEditRoom, setQuickEditRoom] = useState<Room | null>(null);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<'admin' | 'user' | 'approvals'>('admin');
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
  const [syncToast, setSyncToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Bill payment modal state
  const [showPayModal, setShowPayModal] = useState(false);
  const [payModalRoom, setPayModalRoom] = useState<Room | null>(null);
  const [payModalBill, setPayModalBill] = useState<BillRecord | null>(null);

  const pendingComplaintsCount = (database.complaints || []).filter(
    (c) => c.status !== 'resolved'
  ).length;

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setSyncToast({ message, type });
    setTimeout(() => {
      setSyncToast(null);
    }, 3500);
  };

  const handleOpenAdminLogin = () => {
    setAuthModalTab('admin');
    setShowAuthModal(true);
  };

  const handleOpenUserLogin = () => {
    setAuthModalTab('user');
    setShowAuthModal(true);
  };

  const handleOpenApprovalsPanel = () => {
    setAuthModalTab('approvals');
    setShowAuthModal(true);
  };

  const handleApproveTenant = async (
    roomNo: number,
    status: 'approved' | 'rejected' | 'pending',
    tenantName?: string,
    phone?: string
  ) => {
    const res = await approveTenantLogin(
      roomNo,
      status,
      tenantName,
      phone,
      database.loginApprovals || []
    );
    if (res.loginApprovals) {
      setDatabase((prev) => ({
        ...prev,
        loginApprovals: res.loginApprovals,
      }));
      showToast(
        status === 'approved'
          ? `রুম ${roomNo} এর লগইন অনুমতি প্রদান করা হয়েছে!`
          : status === 'rejected'
          ? `রুম ${roomNo} এর লগইন অনুরোধ বাতিল করা হয়েছে।`
          : `রুম ${roomNo} অপেক্ষমাণ রাখা হয়েছে।`,
        status === 'rejected' ? 'info' : 'success'
      );
    } else if (res.error) {
      showToast(res.error, 'error');
    }
  };

  const handleOpenPayBill = (room: Room, bill?: BillRecord | null) => {
    setPayModalRoom(room);
    setPayModalBill(bill || null);
    setShowPayModal(true);
  };

  const handlePaymentSubmit = (payment: PaymentRecord) => {
    recordPaymentInFirestore(payment);
    commitAndSync((prev) => {
      const existingPayments = prev.payments || [];
      const updatedPayments = [payment, ...existingPayments];

      // Update the monthly bill record's paid and due balances if it exists for this month
      const updatedBills = prev.bills.map((b) => {
        if (b.roomId === payment.roomId && b.month === payment.month) {
          const newPaid = b.paid + payment.amount;
          const newDue = Math.max(0, b.total - newPaid);
          return {
            ...b,
            paid: newPaid,
            due: newDue,
            paymentMethod: payment.method,
            trxId: payment.trxId || b.trxId,
          };
        }
        return b;
      });

      return {
        ...prev,
        payments: updatedPayments,
        bills: updatedBills,
      };
    }, `রুম ${payment.roomNo} এর বিল পেমেন্ট`);

    showToast(`রুম ${payment.roomNo}-এর বিল পেমেন্ট স্লিপ সফলভাবে জমা দেওয়া হয়েছে!`, 'success');
  };

  // Safe merge algorithm:
  // - When authoritativeRemote = true (live SSE / online cloud pull): server data updates all logged-in devices immediately!
  // - Never wipe populated tenant data with completely empty server rooms if local has offline data.
  const mergeDatabaseSafely = useCallback(
    (current: AppDatabase, remote: AppDatabase | null, authoritativeRemote = false): AppDatabase => {
      if (!remote || !remote.rooms || remote.rooms.length === 0) {
        return current;
      }

      const remoteIsNewer = Boolean(
        authoritativeRemote &&
          remote.lastUpdated &&
          (!current.lastUpdated || remote.lastUpdated > current.lastUpdated)
      );

      const baseRooms = getFresh35Rooms();
      const mergedRooms = baseRooms.map((base) => {
        const currRoom = current.rooms.find((r) => r.no === base.no || r.id === base.id) || base;
        const remoteRoom = remote.rooms.find((r) => r.no === base.no || r.id === base.id);
        if (!remoteRoom) return currRoom;

        const resolvedRemoteFloor = Number(remoteRoom.floor) || Number(currRoom.floor) || ROOM_FLOOR_MAP[base.no] || 2;

        // If SSE / server update is strictly newer, apply Admin's full room update (including name, phone, rent, rate, floor, notes, status)
        if (remoteIsNewer) {
          return {
            ...currRoom,
            ...remoteRoom,
            floor: resolvedRemoteFloor,
          };
        }

        const currHasData = Boolean(
          (currRoom.name && currRoom.name.trim() !== '') ||
            (currRoom.phone && currRoom.phone.trim() !== '') ||
            currRoom.isOccupied
        );
        const remoteHasData = Boolean(
          (remoteRoom.name && remoteRoom.name.trim() !== '') ||
            (remoteRoom.phone && remoteRoom.phone.trim() !== '') ||
            remoteRoom.isOccupied
        );

        if (currHasData && !remoteHasData) {
          return { ...currRoom, floor: Number(currRoom.floor) || ROOM_FLOOR_MAP[currRoom.no] || 2 };
        }
        if (!currHasData && remoteHasData) {
          return { ...remoteRoom, floor: resolvedRemoteFloor };
        }
        if (currHasData && remoteHasData) {
          if (authoritativeRemote) {
            return {
              ...currRoom,
              ...remoteRoom,
              floor: resolvedRemoteFloor,
              name: remoteRoom.name || currRoom.name,
              phone: remoteRoom.phone !== undefined ? remoteRoom.phone : currRoom.phone,
              rent: remoteRoom.rent ?? currRoom.rent,
              rate: remoteRoom.rate ?? currRoom.rate,
            };
          }
          return {
            ...remoteRoom,
            floor: Number(currRoom.floor) || resolvedRemoteFloor,
            name: currRoom.name || remoteRoom.name,
            phone: currRoom.phone || remoteRoom.phone,
            rent: currRoom.rent || remoteRoom.rent,
            rate: currRoom.rate || remoteRoom.rate,
            isOccupied: currRoom.isOccupied || remoteRoom.isOccupied,
            notes: currRoom.notes || remoteRoom.notes,
          };
        }
        if (authoritativeRemote) {
          return {
            ...currRoom,
            ...remoteRoom,
            floor: resolvedRemoteFloor,
          };
        }
        return {
          ...remoteRoom,
          floor: Number(currRoom.floor) || resolvedRemoteFloor,
          rent: currRoom.rent || remoteRoom.rent,
          rate: currRoom.rate || remoteRoom.rate,
        };
      });

      const billMap = new Map<string, BillRecord>();
      if (authoritativeRemote) {
        (current.bills || []).forEach((b) => billMap.set(b.id, b));
        (remote.bills || []).forEach((b) => billMap.set(b.id, b));
      } else {
        (remote.bills || []).forEach((b) => billMap.set(b.id, b));
        (current.bills || []).forEach((b) => billMap.set(b.id, b));
      }

      const sharedMap = new Map<string, JointMeterRecord>();
      if (authoritativeRemote) {
        (current.shared || []).forEach((s) => sharedMap.set(s.id, s));
        (remote.shared || []).forEach((s) => sharedMap.set(s.id, s));
      } else {
        (remote.shared || []).forEach((s) => sharedMap.set(s.id, s));
        (current.shared || []).forEach((s) => sharedMap.set(s.id, s));
      }

      const approvalMap = new Map<number, any>();
      (remote.loginApprovals || []).forEach((a) => approvalMap.set(Number(a.roomNo), a));
      (current.loginApprovals || []).forEach((a) => {
        const existing = approvalMap.get(Number(a.roomNo));
        if (!existing || (a.updatedAt && (!existing.updatedAt || a.updatedAt > existing.updatedAt))) {
          approvalMap.set(Number(a.roomNo), a);
        }
      });

      const paymentMap = new Map<string, PaymentRecord>();
      if (authoritativeRemote) {
        (current.payments || []).forEach((p) => paymentMap.set(p.id, p));
        (remote.payments || []).forEach((p) => paymentMap.set(p.id, p));
      } else {
        (remote.payments || []).forEach((p) => paymentMap.set(p.id, p));
        (current.payments || []).forEach((p) => paymentMap.set(p.id, p));
      }

      const complaintMap = new Map<string, ComplaintRecord>();
      (current.complaints || []).forEach((c) => complaintMap.set(c.id, c));
      (remote.complaints || []).forEach((c) => {
        const existing = complaintMap.get(c.id);
        if (!existing || (c.updatedAt && (!existing.updatedAt || c.updatedAt >= existing.updatedAt))) {
          complaintMap.set(c.id, c);
        }
      });
      const mergedComplaints = Array.from(complaintMap.values()).sort((a, b) =>
        (b.createdAt || '').localeCompare(a.createdAt || '')
      );

      return {
        rooms: mergedRooms,
        bills: Array.from(billMap.values()),
        shared: Array.from(sharedMap.values()),
        payments: Array.from(paymentMap.values()),
        loginApprovals: Array.from(approvalMap.values()).sort((a, b) => a.roomNo - b.roomNo),
        complaints: mergedComplaints,
        lastUpdated: remote.lastUpdated || current.lastUpdated,
        settings: authoritativeRemote
          ? {
              ...DEFAULT_SETTINGS,
              ...(current.settings || {}),
              ...(remote.settings || {}),
              buildingName: remote.settings?.buildingName || 'আলম খান বিল্ডিং',
              landlordName: 'হৃদয়',
              landlordTitle:
                remote.settings?.landlordTitle && !String(remote.settings.landlordTitle).includes('পরিচালক')
                  ? remote.settings.landlordTitle
                  : 'কর্তৃপক্ষ',
            }
          : {
              ...DEFAULT_SETTINGS,
              ...(remote.settings || {}),
              ...(current.settings || {}),
              buildingName: 'আলম খান বিল্ডিং',
              landlordName: 'হৃদয়',
              landlordTitle: 'কর্তৃপক্ষ',
            },
      };
    },
    []
  );

  // Instant Real-Time SSE/Firestore Broadcast Applier
  const applyRemoteDatabaseUpdate = useCallback(
    (remoteDb: AppDatabase) => {
      setDatabase((prev) => {
        const merged = mergeDatabaseSafely(prev, remoteDb, true);
        if (authSession.isLoggedIn && (authSession.role === 'admin' || authSession.role === 'tenant')) {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
            localStorage.setItem('alam_khan_permanent_db', JSON.stringify(merged));
            localStorage.setItem('alam_khan_permanent_rooms', JSON.stringify(merged.rooms));
          } catch {}
        }
        return merged;
      });
    },
    [mergeDatabaseSafely, authSession.isLoggedIn, authSession.role]
  );

  useEffect(() => {
    remoteMergeRef.current = applyRemoteDatabaseUpdate;
  }, [applyRemoteDatabaseUpdate]);

  // Initial cloud fetch on mount (authoritative merge + push local if admin and cloud empty)
  useEffect(() => {
    let isMounted = true;
    lastForegroundSyncRef.current = Date.now();
    fetchLatestDatabase().then((cloudDb) => {
      if (isMounted && cloudDb) {
        setDatabase((prev) => {
          const merged = mergeDatabaseSafely(prev, cloudDb, true);
          if (authSession.isLoggedIn && (authSession.role === 'admin' || authSession.role === 'tenant')) {
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
              localStorage.setItem('alam_khan_permanent_db', JSON.stringify(merged));
              localStorage.setItem('alam_khan_permanent_rooms', JSON.stringify(merged.rooms));
            } catch {}
          }

          const localHasNames = prev.rooms.some((r) => r.name && r.name.trim());
          const cloudHasNames = cloudDb.rooms?.some((r) => r.name && r.name.trim());
          if (isOwner && localHasNames && !cloudHasNames) {
            saveDatabaseOnline(merged);
          }
          return merged;
        });
      }
    });

    return () => {
      isMounted = false;
    };
  }, [fetchLatestDatabase, mergeDatabaseSafely, saveDatabaseOnline, isOwner, authSession.isLoggedIn, authSession.role]);

  // Sync on app foreground / focus / network reconnect (throttled to prevent redundant startup storms)
  useEffect(() => {
    const syncNow = (force = false) => {
      const nowMs = Date.now();
      if (!force && nowMs - lastForegroundSyncRef.current < 8000) return;
      lastForegroundSyncRef.current = nowMs;
      fetchLatestDatabase().then((cloudDb) => {
        if (cloudDb && cloudDb.rooms && cloudDb.rooms.length > 0) {
          applyRemoteDatabaseUpdate(cloudDb);
        }
      });
    };

    const handleFocus = () => syncNow(false);
    const handleOnline = () => syncNow(true);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncNow(false);
      }
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibility);
    const interval = setInterval(() => syncNow(false), 45000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(interval);
    };
  }, [fetchLatestDatabase, applyRemoteDatabaseUpdate]);

  // Save to localStorage immediately on any database change (only for authenticated admin/tenant)
  useEffect(() => {
    if (!authSession.isLoggedIn || (authSession.role !== 'admin' && authSession.role !== 'tenant')) {
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(database));
      localStorage.setItem('alam_khan_permanent_db', JSON.stringify(database));
      localStorage.setItem('alam_khan_permanent_rooms', JSON.stringify(database.rooms));
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }
  }, [database, authSession.isLoggedIn, authSession.role]);

  // Helper to commit changes locally and push to online cloud storage
  // GUARANTEE: Admin updates propagate immediately & permanently without losing local changes!
  const commitAndSync = async (updater: (prev: AppDatabase) => AppDatabase, actionName?: string) => {
    const baseNext = updater(database);
    const nextDb: AppDatabase = {
      ...baseNext,
      lastUpdated: new Date().toISOString(),
    };

    // 1. Synchronously update state
    setDatabase(nextDb);

    // 2. Synchronously write to localStorage backup keys ONLY for authenticated Admin or Tenant
    if (authSession.isLoggedIn && (authSession.role === 'admin' || authSession.role === 'tenant')) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextDb));
        localStorage.setItem('alam_khan_permanent_db', JSON.stringify(nextDb));
        localStorage.setItem('alam_khan_permanent_rooms', JSON.stringify(nextDb.rooms));
      } catch (e) {
        console.error('LocalStorage write error:', e);
      }
    }

    // 3. Asynchronously push to server (Admin gets allowFullRoomUpdate: true)
    saveDatabaseOnline(nextDb, { allowFullRoomUpdate: isOwner }).then((res) => {
      if (res.success) {
        if (actionName) {
          showToast(`${actionName} সংরক্ষিত হয়েছে!`, 'success');
        }
      }
    });
  };

  // Handler: Save or Update Single Room
  const handleSaveRoom = (updatedRoom: Room) => {
    commitAndSync((prev) => {
      const exists = prev.rooms.some((r) => r.id === updatedRoom.id || r.no === updatedRoom.no);
      let newRooms: Room[];
      if (exists) {
        newRooms = prev.rooms.map((r) =>
          r.id === updatedRoom.id || r.no === updatedRoom.no ? updatedRoom : r
        );
      } else {
        newRooms = [...prev.rooms, updatedRoom];
      }
      return { ...prev, rooms: newRooms };
    }, `রুম ${updatedRoom.no} আপডেট`);
  };

  // Handler: Batch Save All Rooms
  const handleBatchSaveRooms = (updatedRooms: Room[]) => {
    commitAndSync((prev) => ({
      ...prev,
      rooms: updatedRooms,
    }), 'সকল রুম সফলভাবে আপডেট');
  };

  // Handler: Delete/Clear Room Tenant
  const handleDeleteRoomTenant = (roomId: string) => {
    const room = database.rooms.find((r) => r.id === roomId);
    commitAndSync((prev) => ({
      ...prev,
      rooms: prev.rooms.map((r) =>
        r.id === roomId
          ? { ...r, name: '', phone: '', isOccupied: false, notes: '' }
          : r
      ),
    }), room ? `রুম ${room.no} এর ভাড়াটিয়া তথ্য অপসারণ` : 'ভাড়াটিয়া তথ্য অপসারিত');
  };

  // Handler: Save Dining Sub-Meter Record
  const handleSaveShared = (record: JointMeterRecord) => {
    commitAndSync((prev) => {
      const idx = prev.shared.findIndex((s) => s.id === record.id);
      let newShared: JointMeterRecord[];
      if (idx >= 0) {
        newShared = [...prev.shared];
        newShared[idx] = record;
      } else {
        newShared = [record, ...prev.shared];
      }
      return { ...prev, shared: newShared };
    }, 'ডাইনিং সাব-মিটার রিডিং');
  };

  // Handler: Delete Dining Sub-Meter Record
  const handleDeleteShared = (id: string) => {
    removeSharedFromFirestore(id);
    commitAndSync((prev) => ({
      ...prev,
      shared: prev.shared.filter((s) => s.id !== id),
    }), 'ডাইনিং মিটার রেকর্ড অপসারিত');
  };

  // Handler: Save or Update Monthly Bill
  const handleSaveBill = (bill: BillRecord) => {
    commitAndSync((prev) => {
      const idx = prev.bills.findIndex((b) => b.id === bill.id);
      let newBills: BillRecord[];
      if (idx >= 0) {
        newBills = [...prev.bills];
        newBills[idx] = bill;
      } else {
        newBills = [bill, ...prev.bills];
      }
      return { ...prev, bills: newBills };
    }, `রুম ${bill.roomNo} এর বিল`);
  };

  // Handler: Unit-Wise Separate Billing Batch Save (Admin)
  const handleSaveBillsBatch = (newBills: BillRecord[]) => {
    commitAndSync((prev) => {
      const billMap = new Map<string, BillRecord>();
      prev.bills.forEach((b) => billMap.set(b.id, b));
      newBills.forEach((b) => billMap.set(b.id, b));
      return { ...prev, bills: Array.from(billMap.values()) };
    }, `ইউনিট ভিত্তিক ${newBills.length}টি আলাদা বিল`);
  };

  // Handler: Delete Monthly Bill
  const handleDeleteBill = (billId: string) => {
    removeBillFromFirestore(billId);
    commitAndSync((prev) => ({
      ...prev,
      bills: prev.bills.filter((b) => b.id !== billId),
    }), 'বিল অপসারিত');
  };

  // Handler: Submit Tenant Complaint / Help Desk Message
  const handleSubmitComplaint = async (
    payload: Omit<ComplaintRecord, 'id' | 'status' | 'createdAt' | 'updatedAt'>
  ) => {
    const res = await submitComplaint(payload);
    if (res.success) {
      setDatabase((prev) => ({
        ...prev,
        complaints: res.complaints || [res.complaint!, ...(prev.complaints || [])],
      }));
      showToast(
        res.offline
          ? 'অফলাইন মোডে অভিযোগ সংরক্ষিত হয়েছে।'
          : 'আপনার অভিযোগ / বার্তা এডমিন (হৃদয়)-এর কাছে পাঠানো হয়েছে!',
        'success'
      );
    }
  };

  // Handler: Admin Reply / Status Update on Complaint
  const handleReplyComplaint = async (
    id: string,
    status: 'pending' | 'in_progress' | 'resolved',
    adminReply?: string
  ) => {
    const res = await replyComplaint(id, status, adminReply);
    if (res.success && res.complaints) {
      setDatabase((prev) => ({
        ...prev,
        complaints: res.complaints,
      }));
      showToast('অভিযোগের উত্তর ও অবস্থা আপডেট হয়েছে!', 'success');
    } else if (res.error) {
      showToast(res.error, 'error');
    }
  };

  // Handler: Update Payment in Receipt modal
  const handleUpdatePayment = (billId: string, paidAmount: number) => {
    commitAndSync((prev) => ({
      ...prev,
      bills: prev.bills.map((b) => {
        if (b.id === billId) {
          const newPaid = Math.max(0, paidAmount);
          const newDue = Math.max(0, b.total - newPaid);
          const updated = { ...b, paid: newPaid, due: newDue };
          if (activeReceiptBill && activeReceiptBill.id === billId) {
            setActiveReceiptBill(updated);
          }
          return updated;
        }
        return b;
      }),
    }), 'জমা টাকা আপডেট');
  };

  // Handler: Reset All Balances & Bills to 0 for a fresh start (opens inline confirmation modal)
  const handleResetAllToZero = () => {
    if (!isOwner) {
      handleOpenAdminLogin();
      showToast('শুধুমাত্র কর্তৃপক্ষ হৃদয় ডাটাবেজ রিসেট করতে পারবেন।', 'error');
      return;
    }
    setShowResetConfirmModal(true);
  };

  const confirmExecuteResetAllToZero = async () => {
    const fresh = getFreshEmptyDatabase();
    await clearFirestoreTransactions();
    commitAndSync(() => fresh, 'সকল টাকার অংক শূন্য (০)');
    try {
      localStorage.removeItem('house35_joint_meter_v2');
      localStorage.removeItem('house35_joint_meter_v1');
    } catch {}
    setShowResetConfirmModal(false);
  };

  // Handler: Quick action to open new bill
  const handleOpenNewBill = (roomNo?: number) => {
    if (roomNo) {
      setDefaultBillingRoomNo(roomNo);
    }
    setActiveTab('bills');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 flex flex-col font-sans">
      
      {/* Top Bar Header */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenNewBill={() => handleOpenNewBill()}
        onOpenSettings={() => setShowSettingsBackup(true)}
        onOpenInstall={() => setShowInstallModal(true)}
        onOpenShare={() => setShowShareModal(true)}
        onOpenHelp={() => setShowHelpModal(true)}
        pendingComplaintsCount={pendingComplaintsCount}
        onOpenAdminLogin={handleOpenAdminLogin}
        onOpenUserLogin={handleOpenUserLogin}
        onLogoutAdmin={() => {
          logoutAdmin();
          setDatabase(getFreshEmptyDatabase());
        }}
        onLogoutUser={() => {
          logoutUser();
          setDatabase(getFreshEmptyDatabase());
        }}
        authSession={authSession}
        buildingName={database.settings.buildingName}
        landlordName={database.settings.landlordName}
        landlordTitle={
          database.settings.landlordTitle && !database.settings.landlordTitle.includes('পরিচালক')
            ? database.settings.landlordTitle
            : 'কর্তৃপক্ষ'
        }
        isOwner={isOwner}
        isSyncing={isSyncing}
      />

      {/* Sync Toast Notification */}
      {syncToast && (
        <div className="fixed bottom-5 right-5 z-50 animate-bounce">
          <div
            className={`px-4 py-2.5 rounded-xl shadow-lg border text-xs font-semibold flex items-center gap-2 ${
              syncToast.type === 'success'
                ? 'bg-emerald-900 text-emerald-100 border-emerald-600'
                : syncToast.type === 'error'
                ? 'bg-rose-900 text-rose-100 border-rose-600'
                : 'bg-slate-900 text-slate-100 border-slate-700'
            }`}
          >
            {syncToast.type === 'success' ? (
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : syncToast.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <RefreshCw className="w-4 h-4 text-sky-400 animate-spin shrink-0" />
            )}
            <span>{syncToast.message}</span>
          </div>
        </div>
      )}

      {/* Offline / Cloud Sync / App Update Indicator Banner */}
      <OfflineSyncBanner
        isOnline={isOnline}
        isSyncing={isSyncing}
        firebaseConnected={firebaseConnected}
        isFirebaseAdmin={isFirebaseAdmin}
        firebaseUserEmail={firebaseUser?.email}
        pendingSyncCount={pendingSyncCount}
        firebaseQuotaError={firebaseQuotaError}
        isOwner={isOwner}
        onSyncNow={syncPendingNow}
        onOpenAdminGoogleLogin={handleOpenAdminLogin}
      />

      {/* Main Viewport */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full no-print">
        {activeTab === 'dashboard' && (
          <DashboardView
            rooms={database.rooms}
            bills={database.bills}
            shared={database.shared}
            settings={database.settings}
            selectedMonth={selectedMonth}
            onSelectMonth={setSelectedMonth}
            onOpenNewBill={handleOpenNewBill}
            onOpenNewShared={() => {
              setActiveTab('shared');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onViewReceipt={(b) => setActiveReceiptBill(b)}
            onOpenBatchPrint={() => setShowBatchPrint(true)}
            onNavigateTab={setActiveTab}
            onOpenBulkRoomUpdate={(targetNo) => {
              setTargetBulkRoomNo(targetNo);
              setShowBulkRoomModal(true);
            }}
            onQuickEditRoom={(room) => setQuickEditRoom(room)}
            onOpenInstall={() => setShowInstallModal(true)}
            onResetAllToZero={handleResetAllToZero}
            isOwner={isOwner}
            onOpenShare={() => setShowShareModal(true)}
            onOpenAdminLogin={handleOpenAdminLogin}
            onOpenUserLogin={handleOpenUserLogin}
            onLogoutAdmin={() => {
              logoutAdmin();
              setDatabase(getFreshEmptyDatabase());
            }}
            onLogoutUser={() => {
              logoutUser();
              setDatabase(getFreshEmptyDatabase());
            }}
            authSession={authSession}
            onOpenPayBill={handleOpenPayBill}
            loginApprovals={database.loginApprovals || []}
            onApproveTenant={handleApproveTenant}
            onOpenApprovalsPanel={handleOpenApprovalsPanel}
            onOpenHelp={() => setShowHelpModal(true)}
            onOpenSettings={() => setShowSettingsBackup(true)}
            pendingComplaintsCount={pendingComplaintsCount}
          />
        )}

        {activeTab === 'rooms' && (
          <Suspense fallback={<TabLoadingFallback />}>
            <RoomManager
              rooms={database.rooms}
              bills={database.bills}
              settings={database.settings}
              onSaveRoom={handleSaveRoom}
              onDeleteRoomTenant={handleDeleteRoomTenant}
              onOpenNewBill={handleOpenNewBill}
              isOwner={isOwner}
              onOpenAdminPin={handleOpenAdminLogin}
              authSession={authSession}
            />
          </Suspense>
        )}

        {activeTab === 'shared' && (
          <Suspense fallback={<TabLoadingFallback />}>
            <JointMeterManager
              shared={database.shared}
              settings={database.settings}
              selectedMonth={selectedMonth}
              onSaveShared={handleSaveShared}
              onDeleteShared={handleDeleteShared}
              isOwner={isOwner}
              onOpenAdminPin={handleOpenAdminLogin}
            />
          </Suspense>
        )}

        {activeTab === 'bills' && (
          <Suspense fallback={<TabLoadingFallback />}>
            <BillingManager
              rooms={database.rooms}
              bills={database.bills}
              shared={database.shared}
              settings={database.settings}
              selectedMonth={selectedMonth}
              defaultRoomNo={defaultBillingRoomNo}
              onSaveBill={handleSaveBill}
              onSaveBillsBatch={handleSaveBillsBatch}
              onDeleteBill={handleDeleteBill}
              onViewReceipt={(b) => setActiveReceiptBill(b)}
              isOwner={isOwner}
              onOpenAdminPin={handleOpenAdminLogin}
              authSession={authSession}
            />
          </Suspense>
        )}
      </main>

      {/* Modals */}
      <Suspense fallback={<ModalLoadingFallback />}>
        {showBulkRoomModal && (
          <BulkRoomUpdateModal
            rooms={database.rooms}
            settings={database.settings}
            initialSelectedRoomNo={targetBulkRoomNo}
            onSaveRooms={handleBatchSaveRooms}
            onClose={() => {
              setShowBulkRoomModal(false);
              setTargetBulkRoomNo(undefined);
            }}
          />
        )}

        {quickEditRoom && (
          <QuickRoomEditModal
            room={quickEditRoom}
            settings={database.settings}
            onSaveRoom={handleSaveRoom}
            onClose={() => setQuickEditRoom(null)}
          />
        )}

        {activeReceiptBill && (
          <ReceiptModal
            bill={activeReceiptBill}
            room={database.rooms.find((r) => r.id === activeReceiptBill.roomId)}
            settings={database.settings}
            onClose={() => setActiveReceiptBill(null)}
            onUpdatePayment={handleUpdatePayment}
            isOwner={isOwner}
          />
        )}

        {showBatchPrint && isOwner && (
          <BatchPrintModal
            bills={database.bills}
            settings={database.settings}
            selectedMonth={selectedMonth}
            isOwner={isOwner}
            onClose={() => setShowBatchPrint(false)}
          />
        )}

        {showSettingsBackup && (
          <BackupModal
            database={database}
            onRestoreDatabase={(newDb) => {
              commitAndSync(() => newDb, 'ডাটাবেজ রিস্টোর');
            }}
            onUpdateSettings={(newSettings) => {
              commitAndSync((prev) => ({ ...prev, settings: newSettings }), 'সেটিংস আপডেট');
            }}
            onClose={() => setShowSettingsBackup(false)}
            onResetAllToZero={handleResetAllToZero}
            isOwner={isOwner}
            isFirebaseAdmin={isFirebaseAdmin}
            onSyncNow={syncPendingNow}
            onOpenAdminPin={handleOpenAdminLogin}
          />
        )}
      </Suspense>

      {showResetConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-rose-200 p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-sm text-slate-900">
                  সকল হিসাব শূন্য (০) করবেন?
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  আপনি কি নিশ্চিত যে সকল বিল, মিটার রিডিং ও টাকার হিসাব শূন্য (০) করে সম্পূর্ণ নতুন করে শুরু করতে চান? চাইলে আগে একটি ব্যাকআপ সেভ করে নিতে পারেন।
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowResetConfirmModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={confirmExecuteResetAllToZero}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold"
              >
                হ্যাঁ, শূন্য (০) করুন
              </button>
            </div>
          </div>
        </div>
      )}

      <Suspense fallback={<ModalLoadingFallback />}>
        {showInstallModal && (
          <InstallAppModal onClose={() => setShowInstallModal(false)} />
        )}

        {showShareModal && (
          <ShareAppModal
            isOpen={showShareModal}
            onClose={() => setShowShareModal(false)}
            buildingName={database.settings.buildingName}
            landlordName={database.settings.landlordName}
            landlordTitle={
              database.settings.landlordTitle && !database.settings.landlordTitle.includes('পরিচালক')
                ? database.settings.landlordTitle
                : 'কর্তৃপক্ষ'
            }
          />
        )}

        {showAuthModal && (
          <AuthModal
            isOpen={showAuthModal}
            onClose={() => setShowAuthModal(false)}
            authSession={authSession}
            rooms={database.rooms}
            loginApprovals={database.loginApprovals || []}
            isOnline={isOnline}
            isFirebaseAdmin={isFirebaseAdmin}
            firebaseUserEmail={firebaseUser?.email}
            loginAdminWithGoogle={loginAdminWithGoogle}
            loginTenantWithGoogle={loginTenantWithGoogle}
            loginAdmin={loginAdmin}
            logoutAdmin={() => {
              logoutAdmin();
              setDatabase(getFreshEmptyDatabase());
            }}
            loginTenant={loginTenant}
            loginUser={loginUser}
            logoutUser={() => {
              logoutUser();
              setDatabase(getFreshEmptyDatabase());
            }}
            changeAdminPin={changeAdminPin}
            onApproveTenant={handleApproveTenant}
            onUpdateApprovalsLocal={(approvals) =>
              setDatabase((prev) => ({ ...prev, loginApprovals: approvals }))
            }
            initialTab={authModalTab}
            onSuccessToast={(msg) => showToast(msg, 'success')}
            onOpenHelp={() => setShowHelpModal(true)}
          />
        )}

        {showHelpModal && (
          <HelpComplaintModal
            isOpen={showHelpModal}
            onClose={() => setShowHelpModal(false)}
            authSession={authSession}
            isOwner={isOwner}
            rooms={database.rooms}
            complaints={database.complaints || []}
            settings={database.settings}
            onSubmitComplaint={handleSubmitComplaint}
            onReplyComplaint={handleReplyComplaint}
            onOpenUserLogin={() => {
              setShowHelpModal(false);
              handleOpenUserLogin();
            }}
          />
        )}

        {showPayModal && payModalRoom && (
          <PayBillModal
            isOpen={showPayModal}
            onClose={() => {
              setShowPayModal(false);
              setPayModalRoom(null);
              setPayModalBill(null);
            }}
            room={payModalRoom}
            bill={payModalBill}
            settings={database.settings}
            selectedMonth={selectedMonth}
            onSubmitPayment={handlePaymentSubmit}
          />
        )}
      </Suspense>

      {/* Footer */}
      <footer className="no-print mt-auto py-5 border-t border-slate-200 bg-white text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700">{database.settings.buildingName}</span>
            <span>·</span>
            <span>
              {database.settings.landlordTitle && !database.settings.landlordTitle.includes('পরিচালক')
                ? database.settings.landlordTitle
                : 'কর্তৃপক্ষ'}: {database.settings.landlordName}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span>২য়–৭ম তলার ৩৫টি রুমের লাইভ ভাড়া ও ডাইনিং বিদ্যুৎ সফটওয়্যার</span>
            <button
              onClick={() => setShowHelpModal(true)}
              className="text-emerald-700 hover:underline font-bold"
            >
              ২৪/৭ হেল্প ও অভিযোগ
            </button>
            <span>·</span>
            <button
              onClick={() => setShowShareModal(true)}
              className="text-sky-700 hover:underline font-semibold"
            >
              লাইভ শেয়ার
            </button>
            <span>·</span>
            <button
              onClick={() => setShowSettingsBackup(true)}
              className="text-blue-700 hover:underline font-medium"
            >
              ব্যাকআপ ডাউনলোড
            </button>
          </div>
        </div>
      </footer>

    </div>
  );
}

