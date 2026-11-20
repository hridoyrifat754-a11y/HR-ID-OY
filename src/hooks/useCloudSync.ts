import { useState, useEffect, useCallback, useRef } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { AppDatabase, AuthSession, ComplaintRecord, PaymentRecord, Room, TenantLoginApproval } from '../types';
import { STORAGE_KEY, ROOM_FLOOR_MAP, toEnDigits, getFreshEmptyDatabase } from '../constants';
import {
  auth,
  googleProvider,
  ADMIN_GOOGLE_EMAIL,
  testFirestoreConnection,
} from '../firebase';
import {
  verifyAdminAccount,
  fetchTenantUserProfile,
  registerOrRequestTenantAccess,
  fetchAllFirestoreDatabaseForAdmin,
  syncFullDatabaseToFirestore,
  updateTenantApprovalInFirestore,
  saveComplaintToFirestore,
  savePaymentToFirestore,
  deleteBillFromFirestore,
  deleteSharedMeterFromFirestore,
  clearAllFirestoreTransactionalDocs,
  subscribeAdminFirestoreRealtime,
  subscribeTenantFirestoreRealtime,
  TenantUserProfile,
} from '../services/firestoreService';

const ADMIN_PIN_STORAGE_KEY = 'alam_khan_admin_pin';
const VERIFIED_ADMIN_PIN_KEY = 'alam_khan_verified_admin_pin';
const FIREBASE_ADMIN_HINT_KEY = 'alam_khan_firebase_admin_hint';
const TENANT_TOKEN_STORAGE_KEY = 'alam_khan_tenant_token';
const AUTH_SESSION_STORAGE_KEY = 'alam_khan_auth_session';
const APPROVALS_STORAGE_KEY = 'alam_khan_login_approvals';
const PENDING_SYNC_KEY = 'alam_khan_pending_firestore_sync';

function isJsonResponse(res: Response): boolean {
  const ct = res.headers.get('content-type') || '';
  return ct.toLowerCase().includes('application/json');
}

function isKnownStaticHost(): boolean {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname.toLowerCase();
  return (
    h.endsWith('.web.app') ||
    h.endsWith('.firebaseapp.com') ||
    h.endsWith('.vercel.app') ||
    h.endsWith('.netlify.app') ||
    h.endsWith('.pages.dev') ||
    h.endsWith('.github.io')
  );
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 5000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function clearSensitiveLocalCache() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('alam_khan_permanent_db');
    localStorage.removeItem('alam_khan_permanent_rooms');
    localStorage.removeItem(APPROVALS_STORAGE_KEY);
  } catch {}
}

function normalizeDigits(str?: string): string {
  return toEnDigits(str || '').replace(/[^0-9]/g, '');
}

function readCachedDb(): AppDatabase | null {
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) ||
      localStorage.getItem('alam_khan_permanent_db');
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return null;
}

function readCachedApprovals(passed?: TenantLoginApproval[]): TenantLoginApproval[] {
  if (Array.isArray(passed) && passed.length > 0) return passed;
  try {
    const raw = localStorage.getItem(APPROVALS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  const db = readCachedDb();
  return Array.isArray(db?.loginApprovals) ? db.loginApprovals : [];
}

function writeCachedApprovals(approvals: TenantLoginApproval[]) {
  try {
    localStorage.setItem(APPROVALS_STORAGE_KEY, JSON.stringify(approvals));
    const db = readCachedDb();
    if (db) {
      const nextDb = { ...db, loginApprovals: approvals };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextDb));
      localStorage.setItem('alam_khan_permanent_db', JSON.stringify(nextDb));
    }
  } catch {}
}

function readPendingSyncCount(): number {
  try {
    const raw = localStorage.getItem(PENDING_SYNC_KEY);
    const n = Number(raw || 0);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

function writePendingSyncCount(count: number) {
  try {
    localStorage.setItem(PENDING_SYNC_KEY, String(Math.max(0, count)));
  } catch {}
}

export interface TenantLoginResult {
  success: boolean;
  error?: string;
  user?: any;
  pendingApproval?: boolean;
  rejected?: boolean;
  offline?: boolean;
  updatedApprovals?: TenantLoginApproval[];
}

export function useCloudSync(onRealtimeUpdate?: (remoteDb: AppDatabase) => void) {
  // Stored PIN (only populated when explicitly logged in as director via PIN)
  const [adminPin, setAdminPin] = useState<string>(() => {
    try {
      return localStorage.getItem(ADMIN_PIN_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });

  // Auth Session State (strictly defaults to guest unless explicitly logged in)
  const [authSession, setAuthSession] = useState<AuthSession>(() => {
    try {
      const storedSession = localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
      const hasPinLogin = Boolean(
        localStorage.getItem(ADMIN_PIN_STORAGE_KEY) && localStorage.getItem(VERIFIED_ADMIN_PIN_KEY)
      );
      const hasFirebaseHint = localStorage.getItem(FIREBASE_ADMIN_HINT_KEY) === '1';

      if (storedSession) {
        const parsed = JSON.parse(storedSession) as AuthSession;
        if (parsed && parsed.isLoggedIn) {
          if (parsed.role === 'admin' && !hasPinLogin && !hasFirebaseHint) {
            // Do not auto-elevate unverified visitor to admin
            localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
          } else {
            return parsed;
          }
        }
      }
      if (hasPinLogin) {
        return {
          isLoggedIn: true,
          role: 'admin',
          name: 'হৃদয়',
          title: 'কর্তৃপক্ষ',
        };
      }
    } catch (e) {
      console.error('Failed to parse auth session:', e);
    }
    return {
      isLoggedIn: false,
      role: 'guest',
      name: 'অতিথি দর্শক',
    };
  });

  const [isOwner, setIsOwner] = useState<boolean>(authSession.role === 'admin' && authSession.isLoggedIn);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Firebase Auth & Firestore States
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [firebaseAuthReady, setFirebaseAuthReady] = useState<boolean>(false);
  const [isFirebaseAdmin, setIsFirebaseAdmin] = useState<boolean>(false);
  const [firebaseTenantProfile, setFirebaseTenantProfile] = useState<TenantUserProfile | null>(null);
  const [firebaseConnected, setFirebaseConnected] = useState<boolean>(false);
  const [firebaseQuotaError, setFirebaseQuotaError] = useState<string | null>(null);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(() => readPendingSyncCount());

  const isSavingRef = useRef(false);
  const expressAvailableRef = useRef<boolean | null>(isKnownStaticHost() ? false : null);
  const inFlightFetchRef = useRef<Promise<AppDatabase | null> | null>(null);
  const lastFetchAtRef = useRef<number>(0);
  const fetchLatestRef = useRef<(() => Promise<AppDatabase | null>) | null>(null);
  const realtimeCallbackRef = useRef(onRealtimeUpdate);
  useEffect(() => {
    realtimeCallbackRef.current = onRealtimeUpdate;
  }, [onRealtimeUpdate]);

  const updatePendingCount = useCallback((next: number | ((prev: number) => number)) => {
    setPendingSyncCount((prev) => {
      const val = typeof next === 'function' ? next(prev) : next;
      const clamped = Math.max(0, val);
      writePendingSyncCount(clamped);
      return clamped;
    });
  }, []);

  // Helper to persist auth session
  const saveSession = useCallback((session: AuthSession) => {
    setAuthSession(session);
    try {
      localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch {}
  }, []);

  // Sync isOwner with authSession OR Firebase Admin
  useEffect(() => {
    setIsOwner((authSession.isLoggedIn && authSession.role === 'admin') || isFirebaseAdmin);
  }, [authSession, isFirebaseAdmin]);

  // 0. Boot Connection Test to Firebase Firestore
  useEffect(() => {
    let active = true;
    testFirestoreConnection().then((res) => {
      if (!active) return;
      setFirebaseConnected(res.connected);
      if (res.quotaExceeded && res.error) {
        setFirebaseQuotaError(res.error);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  // 1. Firebase Auth State Listener (resolves Admin & Tenant Firestore roles + attaches scoped onSnapshot listeners)
  useEffect(() => {
    let unsubFirestore: (() => void) | null = null;
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      setFirebaseAuthReady(true);

      if (unsubFirestore) {
        unsubFirestore();
        unsubFirestore = null;
      }

      if (!user) {
        setIsFirebaseAdmin(false);
        setFirebaseTenantProfile(null);
        return;
      }

      try {
        const isAdminVerified = await verifyAdminAccount(user);
        setIsFirebaseAdmin(isAdminVerified);

        if (isAdminVerified) {
          setFirebaseConnected(true);
          try {
            localStorage.setItem(FIREBASE_ADMIN_HINT_KEY, '1');
          } catch {}
          saveSession({
            isLoggedIn: true,
            role: 'admin',
            name: user.displayName || 'হৃদয়',
            title: 'কর্তৃপক্ষ (Firebase Auth)',
          });

          // Attach Admin real-time listeners immediately (serves IndexedDB cache instantly in <50ms + live deltas)
          let emptyCheckHandled = false;
          unsubFirestore = subscribeAdminFirestoreRealtime((partial) => {
            const base = readCachedDb() || getFreshEmptyDatabase();
            const nextDb: AppDatabase = {
              ...base,
              ...partial,
              lastUpdated: new Date().toISOString(),
            };
            setFirebaseConnected(true);
            setLastUpdated(nextDb.lastUpdated || null);
            realtimeCallbackRef.current?.(nextDb);

            if (!emptyCheckHandled && partial.rooms) {
              emptyCheckHandled = true;
              const remoteHasNames = partial.rooms.some((r) => r.name && r.name.trim());
              const localCached = readCachedDb();
              if (!remoteHasNames && localCached && localCached.rooms?.some((r) => r.name && r.name.trim())) {
                syncFullDatabaseToFirestore(localCached)
                  .then(() => updatePendingCount(0))
                  .catch(() => {});
              } else if (readPendingSyncCount() > 0 && localCached) {
                syncFullDatabaseToFirestore(localCached)
                  .then(() => updatePendingCount(0))
                  .catch(() => {});
              }
            }
          });
        } else {
          // Check Tenant Profile in Firestore
          const profile = await fetchTenantUserProfile(user.uid);
          setFirebaseTenantProfile(profile);
          if (profile && profile.approved) {
            setFirebaseConnected(true);
            saveSession({
              isLoggedIn: true,
              role: 'tenant',
              name: profile.displayName || user.displayName || `ভাড়াটিয়া (রুম ${profile.roomNo})`,
              roomNo: profile.roomNo,
              roomId: `room-${profile.roomNo}`,
              floor: ROOM_FLOOR_MAP[profile.roomNo] || 2,
              phone: profile.phone,
            });
            unsubFirestore = subscribeTenantFirestoreRealtime(
              user.uid,
              profile.roomNo,
              (partial) => {
                const base = readCachedDb() || getFreshEmptyDatabase();
                const nextDb: AppDatabase = {
                  ...base,
                  ...partial,
                  lastUpdated: new Date().toISOString(),
                };
                realtimeCallbackRef.current?.(nextDb);
              }
            );
          }
        }
      } catch (err: any) {
        const msg = err?.message || String(err);
        if (msg.includes('Quota exceeded')) {
          setFirebaseQuotaError(msg);
        } else {
          setSyncError(msg);
        }
      }
    });

    return () => {
      unsubAuth();
      if (unsubFirestore) unsubFirestore();
    };
  }, [saveSession, updatePendingCount]);

  // Browser online/offline listener + Auto-sync pending offline queue when online returns
  useEffect(() => {
    const onOnline = async () => {
      setIsOnline(true);
      const res = await testFirestoreConnection();
      setFirebaseConnected(res.connected);
      const pending = readPendingSyncCount();
      if (pending > 0 && auth.currentUser) {
        const cached = readCachedDb();
        if (cached) {
          setIsSyncing(true);
          try {
            const adminOk = await verifyAdminAccount(auth.currentUser);
            if (adminOk) {
              await syncFullDatabaseToFirestore(cached);
              updatePendingCount(0);
              setLastUpdated(new Date().toISOString());
            }
          } catch (e: any) {
            setSyncError(e?.message || 'অটো-সিঙ্ক ব্যর্থ');
          } finally {
            setIsSyncing(false);
          }
        }
      }
    };
    const onOffline = () => {
      setIsOnline(false);
      setFirebaseConnected(false);
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [updatePendingCount]);

  // Real-time Server-Sent Events (SSE) subscription ONLY when Express backend is confirmed
  useEffect(() => {
    if (typeof EventSource === 'undefined' || expressAvailableRef.current === false) return;
    let es: EventSource | null = null;
    let closed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (closed || expressAvailableRef.current === false) return;
      try {
        es = new EventSource('/api/events');
        es.addEventListener('connected', () => {
          expressAvailableRef.current = true;
          setIsOnline(true);
        });
        es.addEventListener('database_updated', () => {
          if (isSavingRef.current) return;
          fetchLatestRef.current?.();
        });
        es.onerror = () => {
          es?.close();
          if (!closed && expressAvailableRef.current === true) {
            reconnectTimer = setTimeout(connect, 8000);
          }
        };
      } catch {}
    };

    const verifyAndConnect = async () => {
      if (expressAvailableRef.current === true) {
        connect();
        return;
      }
      try {
        const res = await fetchWithTimeout('/api/health', {}, 2500);
        if (closed) return;
        if (res.ok && isJsonResponse(res)) {
          expressAvailableRef.current = true;
          connect();
        } else {
          expressAvailableRef.current = false;
        }
      } catch {
        // Retry once later only if not on static Firebase Hosting
        expressAvailableRef.current = null;
      }
    };

    verifyAndConnect();

    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      es?.close();
    };
  }, []);

  // Firebase Admin Google Sign-In (Popup)
  const loginAdminWithGoogle = useCallback(async (): Promise<{
    success: boolean;
    error?: string;
    email?: string;
  }> => {
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const user = cred.user;
      const adminOk = await verifyAdminAccount(user);
      if (!adminOk) {
        await signOut(auth);
        return {
          success: false,
          error: `দুঃখিত, শুধুমাত্র অনুমোদিত এডমিন ইমেইল (${ADMIN_GOOGLE_EMAIL}) দিয়ে এডমিন লগইন করা যাবে।`,
        };
      }
      setIsFirebaseAdmin(true);
      setFirebaseConnected(true);
      setIsOwner(true);
      try {
        localStorage.setItem(FIREBASE_ADMIN_HINT_KEY, '1');
      } catch {}
      const session: AuthSession = {
        isLoggedIn: true,
        role: 'admin',
        name: user.displayName || 'হৃদয়',
        title: 'কর্তৃপক্ষ (Firebase Auth)',
      };
      saveSession(session);
      return { success: true, email: user.email || ADMIN_GOOGLE_EMAIL };
    } catch (error: any) {
      const code = error?.code || '';
      const msg =
        code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request'
          ? 'Google লগইন উইন্ডোটি বন্ধ করা হয়েছে।'
          : code === 'auth/popup-blocked'
          ? 'ব্রাউজার লগইন পপআপ ব্লক করেছে। ব্রাউজার থেকে পপআপ অনুমতি দিয়ে আবার চেষ্টা করুন।'
          : code === 'auth/unauthorized-domain'
          ? `এই ওয়েবসাইট ডোমেইন (${typeof window !== 'undefined' ? window.location.hostname : ''}) Firebase Console → Authentication → Authorized domains-এ যুক্ত করুন।`
          : code === 'auth/network-request-failed'
          ? 'ইন্টারনেট সংযোগ সমস্যার কারণে Google লগইন সম্পন্ন হয়নি।'
          : error?.message || 'Firebase Google এডমিন লগইন ব্যর্থ হয়েছে।';
      return { success: false, error: msg };
    }
  }, [saveSession]);

  // Firebase Tenant Google Sign-In (with Admin Approval)
  const loginTenantWithGoogle = useCallback(
    async (roomNo: number, phone?: string, tenantName?: string): Promise<TenantLoginResult> => {
      try {
        const cred = await signInWithPopup(auth, googleProvider);
        const user = cred.user;
        const adminOk = await verifyAdminAccount(user);
        if (adminOk) {
          return {
            success: false,
            error: 'এটি এডমিন একাউন্ট! অনুগ্রহ করে "এডমিন" ট্যাব থেকে লগইন করুন।',
          };
        }

        const profile = await registerOrRequestTenantAccess(user, roomNo, phone, tenantName);
        setFirebaseTenantProfile(profile);

        if (profile.approved && profile.status === 'approved') {
          const session: AuthSession = {
            isLoggedIn: true,
            role: 'tenant',
            name: profile.displayName || `ভাড়াটিয়া (রুম ${profile.roomNo})`,
            roomNo: profile.roomNo,
            roomId: `room-${profile.roomNo}`,
            floor: ROOM_FLOOR_MAP[profile.roomNo] || 2,
            phone: profile.phone,
          };
          saveSession(session);
          setIsOwner(false);
          return {
            success: true,
            user: {
              roomNo: profile.roomNo,
              roomId: `room-${profile.roomNo}`,
              floor: ROOM_FLOOR_MAP[profile.roomNo] || 2,
              name: profile.displayName,
              phone: profile.phone,
            },
          };
        }

        if (profile.status === 'rejected') {
          return {
            success: false,
            rejected: true,
            error: 'আপনার রুমের লগইন অনুরোধ এডমিন কর্তৃক বাতিল করা হয়েছে। হৃদয় (01939022271) এর সাথে যোগাযোগ করুন।',
          };
        }

        return {
          success: false,
          pendingApproval: true,
          error: `রুম ${profile.roomNo}-এর Google একাউন্ট নিবন্ধিত হয়েছে! এডমিন হৃদয় অনুমতি দিলেই প্রবেশ করতে পারবেন।`,
        };
      } catch (error: any) {
        const code = error?.code || '';
        const msg =
          code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request'
            ? 'Google লগইন পপআপ বন্ধ করা হয়েছে।'
            : code === 'auth/popup-blocked'
            ? 'ব্রাউজার লগইন পপআপ ব্লক করেছে। পপআপ অনুমতি দিয়ে আবার চেষ্টা করুন।'
            : code === 'auth/unauthorized-domain'
            ? `এই ডোমেইনটি (${typeof window !== 'undefined' ? window.location.hostname : ''}) Firebase Authorized Domains-এ যুক্ত করা হয়নি।`
            : code === 'auth/network-request-failed'
            ? 'নেটওয়ার্ক সমস্যার কারণে লগইন করা যায়নি। ইন্টারনেট সংযোগ চেক করুন।'
            : error?.message || 'Google ভাড়াটিয়া লগইন ব্যর্থ।';
        return {
          success: false,
          error: msg,
        };
      }
    },
    [saveSession]
  );

  // 1. Admin PIN Login (Express Server verified Online + verified-session Offline fallback)
  const loginAdmin = useCallback(
    async (pin: string): Promise<{ success: boolean; error?: string; offline?: boolean }> => {
      const cleanPin = pin.trim();
      try {
        const res = await fetch('/api/auth/admin-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: cleanPin }),
        });
        if (!isJsonResponse(res)) {
          expressAvailableRef.current = false;
          return {
            success: false,
            error: 'ক্লাউড হোস্টিং মোডে এডমিন পিনের বদলে Google এডমিন লগইন ব্যবহার করুন।',
          };
        }
        expressAvailableRef.current = true;
        const data = await res.json();
        if (res.ok && data.success) {
          setIsOnline(true);
          setAdminPin(cleanPin);
          try {
            localStorage.setItem(ADMIN_PIN_STORAGE_KEY, cleanPin);
            localStorage.setItem(VERIFIED_ADMIN_PIN_KEY, cleanPin);
          } catch {}
          const session: AuthSession = {
            isLoggedIn: true,
            role: 'admin',
            name: data.name || 'হৃদয়',
            title: data.title && !String(data.title).includes('পরিচালক') ? data.title : 'কর্তৃপক্ষ',
          };
          saveSession(session);
          setIsOwner(true);
          return { success: true, offline: false };
        } else {
          return { success: false, error: data.error || 'ভুল পিন কোড! এডমিন লগইন ব্যর্থ।' };
        }
      } catch {
        setIsOnline(false);
        let expectedPin = '';
        try {
          expectedPin = localStorage.getItem(VERIFIED_ADMIN_PIN_KEY) || '';
        } catch {}

        if (expectedPin && cleanPin === expectedPin) {
          setAdminPin(cleanPin);
          try {
            localStorage.setItem(ADMIN_PIN_STORAGE_KEY, cleanPin);
          } catch {}
          const session: AuthSession = {
            isLoggedIn: true,
            role: 'admin',
            name: 'হৃদয়',
            title: 'কর্তৃপক্ষ',
          };
          saveSession(session);
          setIsOwner(true);
          return { success: true, offline: true };
        }
        return {
          success: false,
          error: expectedPin
            ? 'অফলাইন লগইন: ভুল পিন কোড! সঠিক এডমিন পিন দিন।'
            : 'অফলাইন অবস্থায় প্রথমবার পিন যাচাই করা সম্ভব নয়; অনলাইনে এসে Google বা এডমিন পিন দিয়ে লগইন করুন।',
        };
      }
    },
    [saveSession]
  );

  // 2. Admin Logout (also signs out Firebase Auth & clears cached PII)
  const logoutAdmin = useCallback(() => {
    setAdminPin('');
    setIsOwner(false);
    setIsFirebaseAdmin(false);
    if (auth.currentUser) {
      signOut(auth).catch(() => {});
    }
    try {
      localStorage.removeItem(ADMIN_PIN_STORAGE_KEY);
      localStorage.removeItem(FIREBASE_ADMIN_HINT_KEY);
      localStorage.removeItem(TENANT_TOKEN_STORAGE_KEY);
    } catch {}
    clearSensitiveLocalCache();
    const session: AuthSession = {
      isLoggedIn: false,
      role: 'guest',
      name: 'অতিথি দর্শক',
    };
    saveSession(session);
  }, [saveSession]);

  // 3. Tenant Login with Admin Approval (Works BOTH Online & Offline)
  const loginTenant = useCallback(
    async (
      roomNo: number,
      phone?: string,
      tenantName?: string,
      localRooms?: Room[],
      localApprovals?: TenantLoginApproval[]
    ): Promise<TenantLoginResult> => {
      const num = Number(roomNo);
      try {
        const res = await fetch('/api/auth/tenant-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomNo: num, phone, tenantName }),
        });
        if (!isJsonResponse(res)) {
          throw new Error('EXPRESS_UNAVAILABLE');
        }
        const data = await res.json();
        expressAvailableRef.current = true;
        setIsOnline(true);

        if (Array.isArray(data.loginApprovals)) {
          writeCachedApprovals(data.loginApprovals);
        }

        if (res.ok && data.success) {
          const session: AuthSession = {
            isLoggedIn: true,
            role: 'tenant',
            name: data.user.name || `ভাড়াটিয়া (রুম ${num})`,
            roomNo: data.user.roomNo,
            roomId: data.user.roomId,
            floor: data.user.floor,
            phone: data.user.phone,
          };
          setAdminPin('');
          setIsOwner(false);
          try {
            localStorage.removeItem(ADMIN_PIN_STORAGE_KEY);
            localStorage.removeItem(FIREBASE_ADMIN_HINT_KEY);
            if (data.tenantToken) {
              localStorage.setItem(TENANT_TOKEN_STORAGE_KEY, data.tenantToken);
            }
          } catch {}
          saveSession(session);
          return { success: true, user: data.user, offline: false };
        } else {
          return {
            success: false,
            error: data.error || 'ভাড়াটিয়া লগইন ব্যর্থ।',
            pendingApproval: Boolean(data.pendingApproval),
            rejected: Boolean(data.rejected),
            updatedApprovals: data.loginApprovals,
          };
        }
      } catch {
        setIsOnline(false);
        const cachedDb = readCachedDb();
        const roomsList = localRooms && localRooms.length > 0 ? localRooms : cachedDb?.rooms || [];
        const room = roomsList.find((r) => r.no === num) || {
          id: `room-${num}`,
          no: num,
          floor: ROOM_FLOOR_MAP[num] || 2,
          name: tenantName || `রুম ${num}-এর ভাড়াটিয়া`,
          phone: phone || '',
          rent: 0,
          rate: 12,
          isOccupied: false,
        };

        if (phone && room.phone && room.phone.trim()) {
          const cleanInput = normalizeDigits(phone);
          const cleanRoomPhone = normalizeDigits(room.phone);
          if (
            cleanInput &&
            cleanRoomPhone &&
            !cleanRoomPhone.includes(cleanInput) &&
            !cleanInput.includes(cleanRoomPhone)
          ) {
            return {
              success: false,
              offline: true,
              error: `রুম ${num}-এর জন্য প্রদত্ত মোবাইল নম্বরটি মিলছে না!`,
            };
          }
        }

        const approvals = readCachedApprovals(localApprovals);
        const existingIdx = approvals.findIndex((a) => Number(a.roomNo) === num);
        const existing = existingIdx >= 0 ? approvals[existingIdx] : null;
        const resolvedName = (tenantName && tenantName.trim()) || room.name || `রুম ${num}-এর ভাড়াটিয়া`;
        const resolvedPhone = (phone && phone.trim()) || room.phone || '';

        if (existing && existing.status === 'approved') {
          const session: AuthSession = {
            isLoggedIn: true,
            role: 'tenant',
            name: resolvedName,
            roomNo: room.no,
            roomId: room.id,
            floor: room.floor,
            phone: resolvedPhone,
          };
          setAdminPin('');
          setIsOwner(false);
          try {
            localStorage.removeItem(ADMIN_PIN_STORAGE_KEY);
          } catch {}
          saveSession(session);
          return {
            success: true,
            offline: true,
            user: {
              roomNo: room.no,
              roomId: room.id,
              floor: room.floor,
              name: resolvedName,
              phone: resolvedPhone,
              rent: room.rent,
            },
          };
        }

        if (existing && existing.status === 'rejected') {
          return {
            success: false,
            rejected: true,
            offline: true,
            error:
              'আপনার লগইন অনুরোধ এডমিন (হৃদয়) কর্তৃক অনুমোদিত হয়নি। অনুগ্রহ করে 01939022271 / 09638194963 নম্বরে যোগাযোগ করুন।',
          };
        }

        const nowIso = new Date().toISOString();
        const pendingEntry: TenantLoginApproval = {
          id: existing?.id || `approval-room-${num}`,
          roomNo: num,
          tenantName: resolvedName,
          phone: resolvedPhone,
          status: 'pending',
          requestedAt: existing?.requestedAt || nowIso,
          updatedAt: nowIso,
        };
        const nextApprovals = [...approvals];
        if (existingIdx >= 0) nextApprovals[existingIdx] = pendingEntry;
        else nextApprovals.push(pendingEntry);
        writeCachedApprovals(nextApprovals);

        return {
          success: false,
          pendingApproval: true,
          offline: true,
          updatedApprovals: nextApprovals,
          error: `অফলাইন মোড: রুম ${num}-এ লগইনের অনুরোধ সংরক্ষিত হয়েছে। কর্তৃপক্ষ হৃদয় (এডমিন) অনুমতি দিলে লগইন সম্পন্ন হবে।`,
        };
      }
    },
    [saveSession]
  );

  // 4. General User Login (Works BOTH Online & Offline)
  const loginUser = useCallback(
    async (name: string): Promise<{ success: boolean; error?: string; offline?: boolean }> => {
      const cleanName = (name && name.trim()) || 'সাধারণ ইউজার';
      try {
        if (expressAvailableRef.current !== false) {
          const res = await fetch('/api/auth/user-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: cleanName }),
          });
          if (isJsonResponse(res)) {
            expressAvailableRef.current = true;
            const data = await res.json();
            setIsOnline(true);
            if (res.ok && data.success) {
              const session: AuthSession = {
                isLoggedIn: true,
                role: 'user',
                name: data.user.name || cleanName,
              };
              setAdminPin('');
              setIsOwner(false);
              try {
                localStorage.removeItem(ADMIN_PIN_STORAGE_KEY);
                localStorage.removeItem(FIREBASE_ADMIN_HINT_KEY);
              } catch {}
              saveSession(session);
              return { success: true, offline: false };
            } else {
              return { success: false, error: data.error || 'ইউজার লগইন ব্যর্থ।' };
            }
          } else {
            expressAvailableRef.current = false;
          }
        }
        const session: AuthSession = {
          isLoggedIn: true,
          role: 'user',
          name: cleanName,
        };
        setAdminPin('');
        setIsOwner(false);
        try {
          localStorage.removeItem(ADMIN_PIN_STORAGE_KEY);
          localStorage.removeItem(FIREBASE_ADMIN_HINT_KEY);
        } catch {}
        saveSession(session);
        return { success: true, offline: !navigator.onLine };
      } catch {
        setIsOnline(false);
        const session: AuthSession = {
          isLoggedIn: true,
          role: 'user',
          name: cleanName,
        };
        setAdminPin('');
        setIsOwner(false);
        try {
          localStorage.removeItem(ADMIN_PIN_STORAGE_KEY);
          localStorage.removeItem(FIREBASE_ADMIN_HINT_KEY);
        } catch {}
        saveSession(session);
        return { success: true, offline: true };
      }
    },
    [saveSession]
  );

  // 5. Admin Approval Action (Syncs to Local, Server AND Firestore)
  const approveTenantLogin = useCallback(
    async (
      roomNo: number,
      status: 'approved' | 'rejected' | 'pending',
      tenantName?: string,
      phone?: string,
      currentApprovals?: TenantLoginApproval[]
    ): Promise<{ success: boolean; loginApprovals?: TenantLoginApproval[]; offline?: boolean; error?: string }> => {
      const activePin = adminPin || '';
      const nowIso = new Date().toISOString();

      const existingList = readCachedApprovals(currentApprovals);
      const idx = existingList.findIndex((a) => Number(a.roomNo) === roomNo);
      const localEntry: TenantLoginApproval = {
        id: idx >= 0 ? existingList[idx].id : `approval-room-${roomNo}`,
        roomNo,
        tenantName: (tenantName && tenantName.trim()) || (idx >= 0 ? existingList[idx].tenantName : '') || `রুম ${roomNo} ভাড়াটিয়া`,
        phone: (phone && phone.trim()) || (idx >= 0 ? existingList[idx].phone : '') || '',
        status,
        requestedAt: idx >= 0 ? existingList[idx].requestedAt : nowIso,
        updatedAt: nowIso,
        approvedBy: 'হৃদয় (এডমিন)',
      };
      const localNext = [...existingList];
      if (idx >= 0) localNext[idx] = localEntry;
      else localNext.push(localEntry);
      localNext.sort((a, b) => a.roomNo - b.roomNo);
      writeCachedApprovals(localNext);

      if (isFirebaseAdmin && navigator.onLine) {
        updateTenantApprovalInFirestore(localEntry).catch((e) => {
          console.error('Firestore approval sync error:', e);
        });
      }

      if (expressAvailableRef.current === false) {
        return { success: true, loginApprovals: localNext, offline: false };
      }

      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (activePin) headers['x-admin-pin'] = activePin;
        if (isFirebaseAdmin && auth.currentUser) {
          try {
            headers['x-firebase-id-token'] = await auth.currentUser.getIdToken();
          } catch {}
        }
        const res = await fetch('/api/auth/approval-action', {
          method: 'POST',
          headers,
          body: JSON.stringify({ roomNo, status, tenantName, phone, adminPin: activePin }),
        });
        if (!isJsonResponse(res)) {
          expressAvailableRef.current = false;
          return { success: true, loginApprovals: localNext, offline: false };
        }
        const data = await res.json();
        if (res.ok && data.success) {
          setIsOnline(true);
          if (Array.isArray(data.loginApprovals)) {
            writeCachedApprovals(data.loginApprovals);
            return { success: true, loginApprovals: data.loginApprovals, offline: false };
          }
          return { success: true, loginApprovals: localNext, offline: false };
        }
        return { success: false, error: data.error || 'অনুমোদন আপডেট ব্যর্থ।', loginApprovals: localNext };
      } catch {
        if (!isFirebaseAdmin) {
          setIsOnline(false);
          updatePendingCount((c) => c + 1);
        }
        return { success: true, loginApprovals: localNext, offline: !navigator.onLine };
      }
    },
    [adminPin, isFirebaseAdmin, updatePendingCount]
  );

  // 6. User / Tenant Logout
  const logoutUser = useCallback(() => {
    setFirebaseTenantProfile(null);
    if (auth.currentUser) {
      signOut(auth).catch(() => {});
    }
    try {
      localStorage.removeItem(TENANT_TOKEN_STORAGE_KEY);
      localStorage.removeItem(FIREBASE_ADMIN_HINT_KEY);
    } catch {}
    clearSensitiveLocalCache();
    const session: AuthSession = {
      isLoggedIn: false,
      role: 'guest',
      name: 'অতিথি দর্শক',
    };
    saveSession(session);
  }, [saveSession]);

  const logoutAll = useCallback(() => {
    logoutAdmin();
  }, [logoutAdmin]);

  const verifyPin = useCallback(
    async (pinToTest: string): Promise<boolean> => {
      const res = await loginAdmin(pinToTest);
      return res.success;
    },
    [loginAdmin]
  );

  // Fetch latest database from Firestore (if signed in as Firebase Admin) OR Express server
  // Deduplicated and guarded with AbortController timeout so slow connections never hang the UI
  const fetchLatestDatabase = useCallback(async (): Promise<AppDatabase | null> => {
    if (inFlightFetchRef.current) {
      return inFlightFetchRef.current;
    }

    const run = (async (): Promise<AppDatabase | null> => {
      try {
        if (isFirebaseAdmin && navigator.onLine) {
          const fsDb = await fetchAllFirestoreDatabaseForAdmin();
          if (fsDb) {
            setFirebaseConnected(true);
            setIsOnline(true);
            setLastUpdated(fsDb.lastUpdated || null);
            lastFetchAtRef.current = Date.now();
            return fsDb;
          }
        }

        if (expressAvailableRef.current === false) {
          setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
          return null;
        }

        const headers: Record<string, string> = {};
        if (adminPin) {
          headers['x-admin-pin'] = adminPin;
        }
        if (isFirebaseAdmin && auth.currentUser) {
          try {
            headers['x-firebase-id-token'] = await auth.currentUser.getIdToken();
          } catch {}
        }
        try {
          const tToken = localStorage.getItem(TENANT_TOKEN_STORAGE_KEY);
          if (tToken) headers['x-tenant-token'] = tToken;
        } catch {}

        const res = await fetchWithTimeout('/api/database', { headers }, 5000);

        if (!isJsonResponse(res)) {
          // Static hosting (e.g., Firebase Hosting Spark) returns index.html / non-JSON for /api/*
          expressAvailableRef.current = false;
          setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
          return null;
        }

        expressAvailableRef.current = true;
        if (res.ok) {
          const json = await res.json();
          setIsOnline(true);
          lastFetchAtRef.current = Date.now();
          if (json.isOwner || (authSession.role === 'admin' && authSession.isLoggedIn)) {
            setIsOwner(true);
          }
          setLastUpdated(json.lastUpdated || null);
          setSyncError(null);

          if (json.database && Array.isArray(json.database.rooms)) {
            if (Array.isArray(json.database.loginApprovals)) {
              writeCachedApprovals(json.database.loginApprovals);
            }
            return json.database;
          }
        } else {
          setIsOnline(false);
        }
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          console.warn('Could not fetch cloud database, using offline local:', err);
        }
        setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : false);
      }
      return null;
    })();

    inFlightFetchRef.current = run;
    try {
      return await run;
    } finally {
      inFlightFetchRef.current = null;
    }
  }, [adminPin, authSession.role, authSession.isLoggedIn, isFirebaseAdmin]);

  useEffect(() => {
    fetchLatestRef.current = fetchLatestDatabase;
  }, [fetchLatestDatabase]);

  // Save database to LocalStorage + Express Server + Firebase Cloud Firestore
  const saveDatabaseOnline = useCallback(
    async (
      database: AppDatabase,
      options?: { allowFullRoomUpdate?: boolean }
    ): Promise<{ success: boolean; lastUpdated?: string; error?: string }> => {
      const nowStamp = new Date().toISOString();
      const dbWithTimestamp: AppDatabase = {
        ...database,
        lastUpdated: nowStamp,
      };

      // 1. Synchronous Offline Cache ONLY when signed in (never persist guest view)
      if (isOwner || isFirebaseAdmin || authSession.role === 'tenant') {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(dbWithTimestamp));
          localStorage.setItem('alam_khan_permanent_db', JSON.stringify(dbWithTimestamp));
          localStorage.setItem('alam_khan_permanent_rooms', JSON.stringify(dbWithTimestamp.rooms));
          if (Array.isArray(dbWithTimestamp.loginApprovals)) {
            localStorage.setItem(APPROVALS_STORAGE_KEY, JSON.stringify(dbWithTimestamp.loginApprovals));
          }
        } catch (e) {
          console.error('LocalStorage write error:', e);
        }
      }

      setIsSyncing(true);
      isSavingRef.current = true;

      let firestoreSynced = false;
      try {
        // 2. If offline, queue pending sync count immediately
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          updatePendingCount((c) => c + 1);
          setIsOnline(false);
          return { success: true };
        }

        // 3. Push to Firebase Cloud Firestore if authenticated as Firebase Admin
        if (isFirebaseAdmin && auth.currentUser) {
          try {
            await syncFullDatabaseToFirestore(dbWithTimestamp);
            firestoreSynced = true;
            setFirebaseConnected(true);
            setLastUpdated(nowStamp);
            setSyncError(null);
            updatePendingCount(0);
          } catch (fsErr: any) {
            const msg = fsErr?.message || '';
            if (msg.includes('Quota exceeded')) {
              setFirebaseQuotaError(msg);
            } else {
              setSyncError(msg);
            }
          }
        }

        // 4. Push to local Express persistence backend if available and Admin authorized
        if (expressAvailableRef.current === false) {
          setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
          return { success: true, lastUpdated: nowStamp };
        }

        const activePin = adminPin || '';
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (activePin) headers['x-admin-pin'] = activePin;
        if (isFirebaseAdmin && auth.currentUser) {
          try {
            headers['x-firebase-id-token'] = await auth.currentUser.getIdToken();
          } catch {}
        }

        const allowFullRoomUpdate = Boolean(
          options?.allowFullRoomUpdate && (isOwner || isFirebaseAdmin || authSession.role === 'admin')
        );
        const res = await fetch('/api/database', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            database: dbWithTimestamp,
            adminPin: activePin,
            allowFullRoomUpdate,
          }),
        });

        if (!isJsonResponse(res)) {
          expressAvailableRef.current = false;
          setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
          return { success: true, lastUpdated: nowStamp };
        }

        const data = await res.json();
        if (res.ok && data.success) {
          setIsOnline(true);
          setLastUpdated(data.lastUpdated || nowStamp);
          if (!isFirebaseAdmin || firestoreSynced) {
            setSyncError(null);
            updatePendingCount(0);
          }
          return { success: true, lastUpdated: data.lastUpdated || nowStamp };
        } else {
          return { success: true, error: data.error };
        }
      } catch {
        if (!firestoreSynced) {
          updatePendingCount((c) => c + 1);
          setIsOnline(false);
        }
        return { success: true };
      } finally {
        setIsSyncing(false);
        isSavingRef.current = false;
      }
    },
    [adminPin, authSession.role, isOwner, isFirebaseAdmin, updatePendingCount]
  );

  // Manual Force Sync Trigger (used by OfflineSyncBanner)
  const syncPendingNow = useCallback(async (): Promise<{ success: boolean; message: string }> => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { success: false, message: 'ইন্টারনেট সংযোগ নেই। সংযোগ এলে স্বয়ংক্রিয়ভাবে সিঙ্ক হবে।' };
    }
    const cached = readCachedDb();
    if (!cached) {
      return { success: false, message: 'সিঙ্ক করার মতো কোনো সংরক্ষিত ডেটা নেই।' };
    }
    setIsSyncing(true);
    try {
      await saveDatabaseOnline(cached, { allowFullRoomUpdate: isOwner });
      updatePendingCount(0);
      return { success: true, message: 'সকল ডেটা ক্লাউডে নিরাপদে সিঙ্ক হয়েছে!' };
    } catch {
      return { success: false, message: 'সিঙ্ক করার সময় সমস্যা হয়েছে।' };
    } finally {
      setIsSyncing(false);
    }
  }, [saveDatabaseOnline, isOwner, updatePendingCount]);

  // Change PIN
  const changeAdminPin = useCallback(
    async (currentPin: string, newPin: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const res = await fetch('/api/auth/change-pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentPin, newPin }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setAdminPin(newPin);
          setIsOwner(true);
          try {
            localStorage.setItem(ADMIN_PIN_STORAGE_KEY, newPin);
            localStorage.setItem(VERIFIED_ADMIN_PIN_KEY, newPin);
          } catch {}
          return { success: true };
        } else {
          return { success: false, error: data.error || 'পিন পরিবর্তন ব্যর্থ হয়েছে।' };
        }
      } catch {
        return { success: false, error: 'পিন পরিবর্তন করতে ইন্টারনেট সংযোগ প্রয়োজন।' };
      }
    },
    []
  );

  // 7. Submit Tenant Complaint / Help Message (Online + Offline + Firestore)
  const submitComplaint = useCallback(
    async (
      payload: Omit<ComplaintRecord, 'id' | 'status' | 'createdAt' | 'updatedAt'>
    ): Promise<{ success: boolean; complaint?: ComplaintRecord; complaints?: ComplaintRecord[]; offline?: boolean }> => {
      const nowIso = new Date().toISOString();
      const tempId = `cmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const localComplaint: ComplaintRecord = {
        ...payload,
        id: tempId,
        status: 'pending',
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      let savedToFirestore = false;
      if (auth.currentUser && navigator.onLine) {
        try {
          await saveComplaintToFirestore(localComplaint, auth.currentUser.uid);
          savedToFirestore = true;
        } catch (e) {
          console.error('Firestore complaint error:', e);
        }
      }

      if (expressAvailableRef.current !== false) {
        try {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (adminPin) headers['x-admin-pin'] = adminPin;
          const tToken = localStorage.getItem(TENANT_TOKEN_STORAGE_KEY);
          if (tToken) headers['x-tenant-token'] = tToken;

          const res = await fetch('/api/complaints', {
            method: 'POST',
            headers,
            body: JSON.stringify(localComplaint),
          });
          if (isJsonResponse(res)) {
            expressAvailableRef.current = true;
            const data = await res.json();
            if (res.ok && data.success) {
              setIsOnline(true);
              return {
                success: true,
                complaint: data.complaint || localComplaint,
                complaints: data.complaints,
                offline: false,
              };
            }
          } else {
            expressAvailableRef.current = false;
          }
        } catch {
          if (!savedToFirestore) setIsOnline(false);
        }
      }

      const cached = readCachedDb();
      const nextComplaints = [localComplaint, ...(cached?.complaints || [])];
      if (cached) {
        try {
          const nextDb = { ...cached, complaints: nextComplaints };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(nextDb));
          localStorage.setItem('alam_khan_permanent_db', JSON.stringify(nextDb));
        } catch {}
      }
      if (savedToFirestore) {
        return {
          success: true,
          complaint: localComplaint,
          complaints: nextComplaints,
          offline: false,
        };
      }
      updatePendingCount((c) => c + 1);
      return {
        success: true,
        complaint: localComplaint,
        complaints: nextComplaints,
        offline: true,
      };
    },
    [adminPin, updatePendingCount]
  );

  // 8. Admin Reply / Update Status on Complaint (Online + Offline + Firestore)
  const replyComplaint = useCallback(
    async (
      id: string,
      status: 'pending' | 'in_progress' | 'resolved',
      adminReply?: string
    ): Promise<{ success: boolean; complaints?: ComplaintRecord[]; offline?: boolean; error?: string }> => {
      const activePin = adminPin || '';
      const nowIso = new Date().toISOString();

      let savedToFirestore = false;
      if (isFirebaseAdmin && navigator.onLine) {
        const cached = readCachedDb();
        const existing = cached?.complaints?.find((c) => c.id === id);
        if (existing) {
          try {
            await saveComplaintToFirestore({
              ...existing,
              status,
              adminReply: adminReply !== undefined ? adminReply : existing.adminReply,
              repliedAt: adminReply ? nowIso : existing.repliedAt,
              updatedAt: nowIso,
            });
            savedToFirestore = true;
          } catch {}
        }
      }

      if (expressAvailableRef.current !== false) {
        try {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (activePin) headers['x-admin-pin'] = activePin;
          if (isFirebaseAdmin && auth.currentUser) {
            try {
              headers['x-firebase-id-token'] = await auth.currentUser.getIdToken();
            } catch {}
          }
          const res = await fetch('/api/complaints/reply', {
            method: 'POST',
            headers,
            body: JSON.stringify({ id, status, adminReply, adminPin: activePin }),
          });
          if (isJsonResponse(res)) {
            expressAvailableRef.current = true;
            const data = await res.json();
            if (res.ok && data.success) {
              setIsOnline(true);
              return { success: true, complaints: data.complaints, offline: false };
            }
            return { success: false, error: data.error || 'উত্তর সংরক্ষণ ব্যর্থ।' };
          } else {
            expressAvailableRef.current = false;
          }
        } catch {
          if (!savedToFirestore) setIsOnline(false);
        }
      }

      const cached = readCachedDb();
      const nextComplaints = (cached?.complaints || []).map((c) =>
        c.id === id
          ? {
              ...c,
              status,
              adminReply: adminReply !== undefined ? adminReply : c.adminReply,
              repliedAt: adminReply ? nowIso : c.repliedAt,
              updatedAt: nowIso,
            }
          : c
      );
      if (cached) {
        try {
          const nextDb = { ...cached, complaints: nextComplaints };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(nextDb));
          localStorage.setItem('alam_khan_permanent_db', JSON.stringify(nextDb));
        } catch {}
      }
      if (savedToFirestore) {
        return { success: true, complaints: nextComplaints, offline: false };
      }
      updatePendingCount((c) => c + 1);
      return { success: true, complaints: nextComplaints, offline: true };
    },
    [adminPin, isFirebaseAdmin, updatePendingCount]
  );

  // Helper to sync a newly submitted payment slip directly to Firestore AND Express
  const recordPaymentInFirestore = useCallback(
    async (payment: PaymentRecord) => {
      if (auth.currentUser && navigator.onLine) {
        try {
          await savePaymentToFirestore(payment, auth.currentUser.uid);
        } catch {}
      }
      if (expressAvailableRef.current !== false && navigator.onLine) {
        try {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (adminPin) headers['x-admin-pin'] = adminPin;
          const tToken = localStorage.getItem(TENANT_TOKEN_STORAGE_KEY);
          if (tToken) headers['x-tenant-token'] = tToken;
          if (isFirebaseAdmin && auth.currentUser) {
            headers['x-firebase-id-token'] = await auth.currentUser.getIdToken();
          }
          const res = await fetch('/api/payments', {
            method: 'POST',
            headers,
            body: JSON.stringify({ payment }),
          });
          if (!isJsonResponse(res)) {
            expressAvailableRef.current = false;
          }
        } catch {}
      }
    },
    [adminPin, isFirebaseAdmin]
  );

  const removeBillFromFirestore = useCallback(
    async (billId: string) => {
      if (isFirebaseAdmin && navigator.onLine) {
        await deleteBillFromFirestore(billId).catch(() => {});
      }
    },
    [isFirebaseAdmin]
  );

  const removeSharedFromFirestore = useCallback(
    async (sharedId: string) => {
      if (isFirebaseAdmin && navigator.onLine) {
        await deleteSharedMeterFromFirestore(sharedId).catch(() => {});
      }
    },
    [isFirebaseAdmin]
  );

  const clearFirestoreTransactions = useCallback(async () => {
    if (isFirebaseAdmin && navigator.onLine) {
      await clearAllFirestoreTransactionalDocs().catch(() => {});
    }
  }, [isFirebaseAdmin]);

  return {
    authSession,
    isOwner,
    setIsOwner,
    adminPin,
    isSyncing,
    isOnline,
    lastUpdated,
    syncError,
    firebaseUser,
    firebaseAuthReady,
    isFirebaseAdmin,
    firebaseTenantProfile,
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
  };
}
