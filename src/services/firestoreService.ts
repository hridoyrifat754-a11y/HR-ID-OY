import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  writeBatch,
  Unsubscribe,
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import {
  db,
  auth,
  ADMIN_GOOGLE_EMAIL,
  BUILDING_DOC_ID,
  OperationType,
  handleFirestoreError,
} from '../firebase';
import {
  AppDatabase,
  BillRecord,
  BuildingSettings,
  ComplaintRecord,
  JointMeterRecord,
  PaymentRecord,
  Room,
  TenantLoginApproval,
} from '../types';
import { DEFAULT_SETTINGS, ROOM_FLOOR_MAP, getFresh35Rooms } from '../constants';

export interface TenantUserProfile {
  uid: string;
  email: string;
  displayName: string;
  roomNo: number;
  phone?: string;
  approved: boolean;
  status: 'pending' | 'approved' | 'rejected';
  updatedAt: string;
}

export interface CloudBackupMetadata {
  id: string;
  label: string;
  createdByUid: string;
  createdAt: string;
  roomsCount: number;
  billsCount: number;
  sharedCount: number;
  snapshot: AppDatabase;
}

function clampStr(val: unknown, maxLen: number): string {
  return String(val ?? '').trim().slice(0, maxLen);
}

function safeId(val: unknown, fallback: string): string {
  const cleaned = String(val ?? '')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .slice(0, 128);
  return cleaned.length >= 1 ? cleaned : fallback;
}

function safeInt(val: unknown, min: number, max: number, fallback: number): number {
  const num = Math.round(Number(val));
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, num));
}

function safeNum(val: unknown, min = 0): number {
  const num = Number(val);
  if (!Number.isFinite(num)) return min;
  return Math.max(min, num);
}

function safeMonth(val: unknown): string {
  const str = String(val ?? '');
  if (/^[0-9]{4}-[0-9]{2}$/.test(str)) return str;
  return new Date().toISOString().slice(0, 7);
}

function safeIso(val?: unknown): string {
  const str = clampStr(val, 40);
  return str || new Date().toISOString();
}

export function sanitizeBuildingPayload(settings: BuildingSettings) {
  return {
    id: BUILDING_DOC_ID,
    buildingName: clampStr(settings.buildingName || DEFAULT_SETTINGS.buildingName, 120),
    buildingAddress: clampStr(settings.buildingAddress || DEFAULT_SETTINGS.buildingAddress, 200),
    landlordName: clampStr(settings.landlordName || 'হৃদয়', 80),
    landlordTitle: clampStr(
      settings.landlordTitle && !settings.landlordTitle.includes('পরিচালক')
        ? settings.landlordTitle
        : 'কর্তৃপক্ষ',
      60
    ),
    landlordPhone: clampStr(settings.landlordPhone || DEFAULT_SETTINGS.landlordPhone, 60),
    bkashNumber: clampStr(settings.bkashNumber || '', 40),
    nagadNumber: clampStr(settings.nagadNumber || '', 40),
    defaultUnitRate: safeNum(settings.defaultUnitRate ?? 12, 0),
    useBengaliDigits: Boolean(settings.useBengaliDigits ?? true),
    ownerEmail: ADMIN_GOOGLE_EMAIL,
    updatedAt: new Date().toISOString(),
  };
}

export function sanitizeRoomPayload(room: Room, tenantUid?: string) {
  const no = safeInt(room.no, 1, 35, 1);
  const floor = safeInt(room.floor || ROOM_FLOOR_MAP[no] || 2, 1, 20, ROOM_FLOOR_MAP[no] || 2);
  const payload: Record<string, unknown> = {
    id: `room-${no}`,
    no,
    floor,
    name: clampStr(room.name, 120),
    phone: clampStr(room.phone, 40),
    rent: safeNum(room.rent, 0),
    rate: safeNum(room.rate ?? 12, 0),
    isOccupied: Boolean(room.isOccupied),
    notes: clampStr(room.notes || '', 500),
    updatedAt: new Date().toISOString(),
  };
  if (tenantUid) {
    payload.tenantUid = clampStr(tenantUid, 128);
  }
  return payload;
}

export function sanitizeRoomDirectoryPayload(room: Room) {
  const no = safeInt(room.no, 1, 35, 1);
  const floor = safeInt(room.floor || ROOM_FLOOR_MAP[no] || 2, 1, 20, ROOM_FLOOR_MAP[no] || 2);
  return {
    id: `room-${no}`,
    no,
    floor,
    displayName: clampStr(room.name || (room.isOccupied ? `রুম ${no} ভাড়াটিয়া` : ''), 120),
    isOccupied: Boolean(room.isOccupied),
    updatedAt: new Date().toISOString(),
  };
}

export function sanitizeSharedMeterPayload(rec: JointMeterRecord) {
  const rooms = Array.isArray(rec.rooms) && rec.rooms.length > 0
    ? rec.rooms.slice(0, 35).map((r) => safeInt(r, 1, 35, 1))
    : [1];
  return {
    id: safeId(rec.id, `shared-${Date.now()}`),
    groupIndex: safeInt(rec.groupIndex, 1, 50, 1),
    groupName: clampStr(rec.groupName || 'ডাইনিং সাব-মিটার', 120),
    rooms,
    month: safeMonth(rec.month),
    prev: safeNum(rec.prev, 0),
    now: safeNum(rec.now, 0),
    units: safeNum(rec.units, 0),
    rate: safeNum(rec.rate, 0),
    amount: safeNum(rec.amount, 0),
    perRoomShare: safeNum(rec.perRoomShare, 0),
    createdAt: safeIso(rec.createdAt),
    updatedAt: new Date().toISOString(),
  };
}

export function sanitizeBillPayload(bill: BillRecord, tenantUid?: string) {
  const roomNo = safeInt(bill.roomNo, 1, 35, 1);
  const floor = safeInt(bill.floor || ROOM_FLOOR_MAP[roomNo] || 2, 1, 20, ROOM_FLOOR_MAP[roomNo] || 2);
  const payload: Record<string, unknown> = {
    id: safeId(bill.id, `bill-${Date.now()}`),
    roomId: clampStr(bill.roomId || `room-${roomNo}`, 32),
    roomNo,
    floor,
    tenantName: clampStr(bill.tenantName || '', 120),
    tenantPhone: clampStr(bill.tenantPhone || '', 40),
    month: safeMonth(bill.month),
    prev: safeNum(bill.prev, 0),
    now: safeNum(bill.now, 0),
    units: safeNum(bill.units, 0),
    rate: safeNum(bill.rate, 0),
    electricityCost: safeNum(bill.electricityCost, 0),
    rent: safeNum(bill.rent, 0),
    sharedElectricity: safeNum(bill.sharedElectricity, 0),
    other: safeNum(bill.other, 0),
    note: clampStr(bill.note || '', 200),
    total: safeNum(bill.total, 0),
    paid: safeNum(bill.paid, 0),
    due: safeNum(bill.due, 0),
    createdAt: safeIso(bill.createdAt),
    updatedAt: new Date().toISOString(),
  };
  if (tenantUid) payload.tenantUid = clampStr(tenantUid, 128);
  if (bill.paymentMethod) payload.paymentMethod = clampStr(bill.paymentMethod, 40);
  if (bill.trxId) payload.trxId = clampStr(bill.trxId, 80);
  if (bill.unitGroupId) payload.unitGroupId = clampStr(bill.unitGroupId, 40);
  return payload;
}

export function sanitizePaymentPayload(payment: PaymentRecord, tenantUid?: string) {
  const roomNo = safeInt(payment.roomNo, 1, 35, 1);
  const payload: Record<string, unknown> = {
    id: safeId(payment.id, `pay-${Date.now()}`),
    roomNo,
    roomId: clampStr(payment.roomId || `room-${roomNo}`, 32),
    tenantName: clampStr(payment.tenantName || '', 120),
    month: safeMonth(payment.month),
    amount: Math.max(1, safeNum(payment.amount, 1)),
    paymentType: ['electricity', 'rent', 'both', 'custom'].includes(payment.paymentType)
      ? payment.paymentType
      : 'both',
    method: ['bkash', 'nagad', 'rocket', 'bank', 'cash'].includes(payment.method)
      ? payment.method
      : 'bkash',
    status: payment.status === 'approved' ? 'approved' : 'pending',
    createdAt: safeIso(payment.createdAt),
  };
  if (tenantUid) payload.tenantUid = clampStr(tenantUid, 128);
  if (payment.trxId) payload.trxId = clampStr(payment.trxId, 80);
  if (payment.senderPhone) payload.senderPhone = clampStr(payment.senderPhone, 40);
  if (payment.note) payload.note = clampStr(payment.note, 300);
  return payload;
}

export function sanitizeComplaintPayload(c: ComplaintRecord, tenantUid?: string) {
  const payload: Record<string, unknown> = {
    id: safeId(c.id, `cmp-${Date.now()}`),
    roomNo: safeInt(c.roomNo, 0, 35, 0),
    tenantName: clampStr(c.tenantName || 'অতিথি', 120),
    phone: clampStr(c.phone || '', 40),
    category: ['electricity', 'water', 'repair', 'billing', 'cleanliness', 'other'].includes(c.category)
      ? c.category
      : 'other',
    priority: c.priority === 'urgent' ? 'urgent' : 'normal',
    subject: clampStr(c.subject || 'অভিযোগ', 150),
    message: clampStr(c.message || 'তথ্য প্রয়োজন', 1000) || 'তথ্য প্রয়োজন',
    status: ['pending', 'in_progress', 'resolved'].includes(c.status) ? c.status : 'pending',
    createdAt: safeIso(c.createdAt),
    updatedAt: safeIso(c.updatedAt),
  };
  if (tenantUid) payload.tenantUid = clampStr(tenantUid, 128);
  if (c.adminReply !== undefined) payload.adminReply = clampStr(c.adminReply, 1000);
  if (c.repliedAt) payload.repliedAt = safeIso(c.repliedAt);
  return payload;
}

export function sanitizeLoginApprovalPayload(
  a: TenantLoginApproval,
  extra?: { tenantUid?: string; email?: string }
) {
  const roomNo = safeInt(a.roomNo, 1, 35, 1);
  const payload: Record<string, unknown> = {
    id: safeId(a.id, `approval-room-${roomNo}`),
    roomNo,
    tenantName: clampStr(a.tenantName || `রুম ${roomNo} ভাড়াটিয়া`, 120),
    phone: clampStr(a.phone || '', 40),
    status: ['pending', 'approved', 'rejected'].includes(a.status) ? a.status : 'pending',
    requestedAt: safeIso(a.requestedAt),
    updatedAt: safeIso(a.updatedAt),
  };
  if (extra?.tenantUid) payload.tenantUid = clampStr(extra.tenantUid, 128);
  if (extra?.email) payload.email = clampStr(extra.email, 120);
  if (a.approvedBy) payload.approvedBy = clampStr(a.approvedBy, 100);
  return payload;
}

export async function verifyAdminAccount(user: User | null): Promise<boolean> {
  if (!user || !user.emailVerified) return false;
  if (user.email === ADMIN_GOOGLE_EMAIL) {
    // Ensure bootstrapped admin record exists in /admins/{uid}
    const adminPath = `admins/${user.uid}`;
    try {
      const snap = await getDoc(doc(db, 'admins', user.uid));
      if (!snap.exists()) {
        await setDoc(doc(db, 'admins', user.uid), {
          uid: clampStr(user.uid, 128),
          email: clampStr(user.email, 120),
          name: clampStr(user.displayName || 'হৃদয়', 80),
          role: 'admin',
          createdAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, adminPath);
    }
    return true;
  }

  const adminPath = `admins/${user.uid}`;
  try {
    const snap = await getDoc(doc(db, 'admins', user.uid));
    return snap.exists() && snap.data()?.role === 'admin';
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, adminPath);
  }
}

export async function fetchTenantUserProfile(uid: string): Promise<TenantUserProfile | null> {
  const path = `tenantUsers/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'tenantUsers', uid));
    if (!snap.exists()) return null;
    return snap.data() as TenantUserProfile;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function registerOrRequestTenantAccess(
  user: User,
  roomNo: number,
  phone?: string,
  displayName?: string
): Promise<TenantUserProfile> {
  const cleanRoomNo = safeInt(roomNo, 1, 35, 1);
  const nowIso = new Date().toISOString();
  const profilePath = `tenantUsers/${user.uid}`;

  let existing: TenantUserProfile | null = null;
  try {
    const snap = await getDoc(doc(db, 'tenantUsers', user.uid));
    if (snap.exists()) {
      existing = snap.data() as TenantUserProfile;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, profilePath);
  }

  if (existing) {
    const nextProfile: TenantUserProfile = {
      ...existing,
      displayName: clampStr(displayName || existing.displayName || user.displayName || `রুম ${cleanRoomNo}`, 120),
      phone: clampStr(phone || existing.phone || '', 40),
      updatedAt: nowIso,
    };
    try {
      await setDoc(doc(db, 'tenantUsers', user.uid), nextProfile);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, profilePath);
    }
    return nextProfile;
  }

  const newProfile: TenantUserProfile = {
    uid: clampStr(user.uid, 128),
    email: clampStr(user.email || '', 120),
    displayName: clampStr(displayName || user.displayName || `রুম ${cleanRoomNo} ভাড়াটিয়া`, 120),
    roomNo: cleanRoomNo,
    phone: clampStr(phone || '', 40),
    approved: false,
    status: 'pending',
    updatedAt: nowIso,
  };

  try {
    await setDoc(doc(db, 'tenantUsers', user.uid), newProfile);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, profilePath);
  }

  const approvalId = `approval-room-${cleanRoomNo}`;
  const approvalPath = `loginApprovals/${approvalId}`;
  try {
    await setDoc(
      doc(db, 'loginApprovals', approvalId),
      sanitizeLoginApprovalPayload(
        {
          id: approvalId,
          roomNo: cleanRoomNo,
          tenantName: newProfile.displayName,
          phone: newProfile.phone || '',
          status: 'pending',
          requestedAt: nowIso,
          updatedAt: nowIso,
        },
        { tenantUid: user.uid, email: newProfile.email }
      )
    );
  } catch {
    // Approval request document may already exist from another attempt or admin pre-approval;
    // ignore secondary approval upsert failure if profile creation succeeded.
  }

  return newProfile;
}

export async function fetchAllFirestoreDatabaseForAdmin(): Promise<AppDatabase | null> {
  try {
    const [buildingSnap, roomsSnap, sharedSnap, billsSnap, paymentsSnap, complaintsSnap, approvalsSnap] =
      await Promise.all([
        getDoc(doc(db, 'buildings', BUILDING_DOC_ID)),
        getDocs(collection(db, 'rooms')),
        getDocs(collection(db, 'sharedMeters')),
        getDocs(collection(db, 'bills')),
        getDocs(collection(db, 'payments')),
        getDocs(collection(db, 'complaints')),
        getDocs(collection(db, 'loginApprovals')),
      ]);

    const hasAnyDocs =
      buildingSnap.exists() ||
      !roomsSnap.empty ||
      !billsSnap.empty ||
      !sharedSnap.empty;

    if (!hasAnyDocs) return null;

    const baseRooms = getFresh35Rooms();
    const roomByNo = new Map<number, Room>();
    roomsSnap.forEach((d) => {
      const r = d.data() as Room;
      roomByNo.set(Number(r.no), r);
    });

    const rooms: Room[] = baseRooms.map((base) => {
      const remoteRoom = roomByNo.get(base.no);
      return remoteRoom
        ? {
            id: `room-${base.no}`,
            no: base.no,
            floor: Number(remoteRoom.floor) || ROOM_FLOOR_MAP[base.no] || 2,
            name: remoteRoom.name || '',
            phone: remoteRoom.phone || '',
            rent: Number(remoteRoom.rent) || 0,
            rate: Number(remoteRoom.rate ?? 12),
            isOccupied: Boolean(remoteRoom.isOccupied),
            notes: remoteRoom.notes || '',
          }
        : base;
    });

    const buildingData = buildingSnap.exists() ? (buildingSnap.data() as BuildingSettings) : DEFAULT_SETTINGS;

    return {
      rooms,
      shared: sharedSnap.docs.map((d) => d.data() as JointMeterRecord),
      bills: billsSnap.docs.map((d) => d.data() as BillRecord),
      payments: paymentsSnap.docs.map((d) => d.data() as PaymentRecord),
      complaints: complaintsSnap.docs.map((d) => d.data() as ComplaintRecord),
      loginApprovals: approvalsSnap.docs.map((d) => d.data() as TenantLoginApproval),
      settings: {
        ...DEFAULT_SETTINGS,
        ...buildingData,
      },
      lastUpdated: (buildingSnap.data()?.updatedAt as string) || new Date().toISOString(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'rooms');
  }
}

export async function syncFullDatabaseToFirestore(database: AppDatabase): Promise<void> {
  if (!auth.currentUser) return;

  // Map known approved tenantUids by roomNo if present
  const roomTenantUidMap = new Map<number, string>();
  try {
    const tUsersSnap = await getDocs(collection(db, 'tenantUsers'));
    tUsersSnap.forEach((d) => {
      const tu = d.data() as TenantUserProfile;
      if (tu.approved && tu.roomNo) {
        roomTenantUidMap.set(Number(tu.roomNo), tu.uid);
      }
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'tenantUsers');
  }

  const operations: Array<{ refPath: [string, string]; data: Record<string, unknown> }> = [];

  operations.push({
    refPath: ['buildings', BUILDING_DOC_ID],
    data: sanitizeBuildingPayload(database.settings),
  });

  (database.rooms || []).forEach((room) => {
    const tenantUid = roomTenantUidMap.get(Number(room.no));
    operations.push({
      refPath: ['rooms', `room-${safeInt(room.no, 1, 35, 1)}`],
      data: sanitizeRoomPayload(room, tenantUid),
    });
    operations.push({
      refPath: ['roomDirectory', `room-${safeInt(room.no, 1, 35, 1)}`],
      data: sanitizeRoomDirectoryPayload(room),
    });
  });

  (database.shared || []).forEach((s) => {
    const clean = sanitizeSharedMeterPayload(s);
    operations.push({
      refPath: ['sharedMeters', clean.id],
      data: clean,
    });
  });

  (database.bills || []).forEach((b) => {
    const tenantUid = roomTenantUidMap.get(Number(b.roomNo));
    const clean = sanitizeBillPayload(b, tenantUid);
    operations.push({
      refPath: ['bills', String(clean.id)],
      data: clean,
    });
  });

  (database.payments || []).forEach((p) => {
    const tenantUid = roomTenantUidMap.get(Number(p.roomNo));
    const clean = sanitizePaymentPayload(p, tenantUid);
    operations.push({
      refPath: ['payments', String(clean.id)],
      data: clean,
    });
  });

  (database.complaints || []).forEach((c) => {
    const tenantUid = roomTenantUidMap.get(Number(c.roomNo));
    const clean = sanitizeComplaintPayload(c, tenantUid);
    operations.push({
      refPath: ['complaints', String(clean.id)],
      data: clean,
    });
  });

  (database.loginApprovals || []).forEach((a) => {
    const tenantUid = roomTenantUidMap.get(Number(a.roomNo));
    const clean = sanitizeLoginApprovalPayload(a, tenantUid ? { tenantUid } : undefined);
    operations.push({
      refPath: ['loginApprovals', String(clean.id)],
      data: clean,
    });
  });

  // Chunk into batches of 350 to stay well below Firestore 500-op batch limit
  const CHUNK_SIZE = 350;
  for (let i = 0; i < operations.length; i += CHUNK_SIZE) {
    const chunk = operations.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    chunk.forEach((op) => {
      batch.set(doc(db, op.refPath[0], op.refPath[1]), op.data);
    });
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `${chunk[0]?.refPath[0]}/${chunk[0]?.refPath[1]}`);
    }
  }
}

export async function updateTenantApprovalInFirestore(
  approval: TenantLoginApproval
): Promise<void> {
  const id = safeId(approval.id || `approval-room-${approval.roomNo}`, `approval-room-${approval.roomNo}`);
  const path = `loginApprovals/${id}`;
  let existingUid: string | undefined;
  let existingEmail: string | undefined;
  try {
    const snap = await getDoc(doc(db, 'loginApprovals', id));
    if (snap.exists()) {
      existingUid = snap.data()?.tenantUid;
      existingEmail = snap.data()?.email;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }

  try {
    await setDoc(
      doc(db, 'loginApprovals', id),
      sanitizeLoginApprovalPayload(approval, {
        tenantUid: existingUid,
        email: existingEmail,
      })
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }

  if (existingUid) {
    const tuPath = `tenantUsers/${existingUid}`;
    try {
      const tuSnap = await getDoc(doc(db, 'tenantUsers', existingUid));
      if (tuSnap.exists()) {
        const cur = tuSnap.data() as TenantUserProfile;
        await setDoc(doc(db, 'tenantUsers', existingUid), {
          ...cur,
          approved: approval.status === 'approved',
          status: approval.status,
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, tuPath);
    }

    if (approval.status === 'approved') {
      const roomDocId = `room-${safeInt(approval.roomNo, 1, 35, 1)}`;
      try {
        const roomSnap = await getDoc(doc(db, 'rooms', roomDocId));
        if (roomSnap.exists()) {
          await setDoc(doc(db, 'rooms', roomDocId), {
            ...roomSnap.data(),
            tenantUid: existingUid,
            updatedAt: new Date().toISOString(),
          });
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `rooms/${roomDocId}`);
      }
    }
  }
}

export async function saveComplaintToFirestore(
  complaint: ComplaintRecord,
  tenantUid?: string
): Promise<void> {
  const clean = sanitizeComplaintPayload(complaint, tenantUid || auth.currentUser?.uid);
  const path = `complaints/${String(clean.id)}`;
  try {
    await setDoc(doc(db, 'complaints', String(clean.id)), clean);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function savePaymentToFirestore(
  payment: PaymentRecord,
  tenantUid?: string
): Promise<void> {
  const clean = sanitizePaymentPayload(payment, tenantUid || auth.currentUser?.uid);
  const path = `payments/${String(clean.id)}`;
  try {
    await setDoc(doc(db, 'payments', String(clean.id)), clean);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteBillFromFirestore(billId: string): Promise<void> {
  const cleanId = safeId(billId, '');
  if (!cleanId) return;
  const path = `bills/${cleanId}`;
  try {
    await deleteDoc(doc(db, 'bills', cleanId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function deleteSharedMeterFromFirestore(sharedId: string): Promise<void> {
  const cleanId = safeId(sharedId, '');
  if (!cleanId) return;
  const path = `sharedMeters/${cleanId}`;
  try {
    await deleteDoc(doc(db, 'sharedMeters', cleanId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function clearAllFirestoreTransactionalDocs(): Promise<void> {
  if (!auth.currentUser) return;
  const targets = ['bills', 'sharedMeters', 'payments', 'complaints'] as const;
  for (const colName of targets) {
    try {
      const snap = await getDocs(collection(db, colName));
      if (snap.empty) continue;
      for (let i = 0; i < snap.docs.length; i += 350) {
        const batch = writeBatch(db);
        snap.docs.slice(i, i + 350).forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, colName);
    }
  }
}

export function subscribeAdminFirestoreRealtime(
  onUpdate: (partial: Partial<AppDatabase>) => void
): Unsubscribe {
  const state: {
    settings?: BuildingSettings;
    rooms?: Room[];
    shared?: JointMeterRecord[];
    bills?: BillRecord[];
    payments?: PaymentRecord[];
    complaints?: ComplaintRecord[];
    loginApprovals?: TenantLoginApproval[];
  } = {};

  const emit = () => {
    onUpdate({ ...state });
  };

  const unsubs: Unsubscribe[] = [];

  unsubs.push(
    onSnapshot(
      doc(db, 'buildings', BUILDING_DOC_ID),
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          state.settings = {
            ...DEFAULT_SETTINGS,
            buildingName: d.buildingName || DEFAULT_SETTINGS.buildingName,
            buildingAddress: d.buildingAddress || DEFAULT_SETTINGS.buildingAddress,
            landlordName: d.landlordName || 'হৃদয়',
            landlordTitle:
              d.landlordTitle && !String(d.landlordTitle).includes('পরিচালক')
                ? d.landlordTitle
                : 'কর্তৃপক্ষ',
            landlordPhone: d.landlordPhone || DEFAULT_SETTINGS.landlordPhone,
            bkashNumber: d.bkashNumber,
            nagadNumber: d.nagadNumber,
            defaultUnitRate: Number(d.defaultUnitRate ?? 12),
            useBengaliDigits: Boolean(d.useBengaliDigits ?? true),
          };
          emit();
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, `buildings/${BUILDING_DOC_ID}`);
      }
    )
  );

  unsubs.push(
    onSnapshot(
      collection(db, 'rooms'),
      (snap) => {
        if (!snap.empty) {
          const base = getFresh35Rooms();
          const map = new Map<number, Room>();
          snap.forEach((d) => {
            const r = d.data() as Room;
            map.set(Number(r.no), r);
          });
          state.rooms = base.map((b) => map.get(b.no) || b);
          emit();
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'rooms');
      }
    )
  );

  unsubs.push(
    onSnapshot(
      collection(db, 'sharedMeters'),
      (snap) => {
        state.shared = snap.docs.map((d) => d.data() as JointMeterRecord);
        emit();
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'sharedMeters');
      }
    )
  );

  unsubs.push(
    onSnapshot(
      collection(db, 'bills'),
      (snap) => {
        state.bills = snap.docs.map((d) => d.data() as BillRecord);
        emit();
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'bills');
      }
    )
  );

  unsubs.push(
    onSnapshot(
      collection(db, 'payments'),
      (snap) => {
        state.payments = snap.docs.map((d) => d.data() as PaymentRecord);
        emit();
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'payments');
      }
    )
  );

  unsubs.push(
    onSnapshot(
      collection(db, 'complaints'),
      (snap) => {
        state.complaints = snap.docs.map((d) => d.data() as ComplaintRecord);
        emit();
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'complaints');
      }
    )
  );

  unsubs.push(
    onSnapshot(
      collection(db, 'loginApprovals'),
      (snap) => {
        state.loginApprovals = snap.docs.map((d) => d.data() as TenantLoginApproval);
        emit();
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'loginApprovals');
      }
    )
  );

  return () => {
    unsubs.forEach((u) => u());
  };
}

export function subscribeTenantFirestoreRealtime(
  uid: string,
  roomNo: number,
  onUpdate: (partial: Partial<AppDatabase>) => void
): Unsubscribe {
  const unsubs: Unsubscribe[] = [];
  const cleanRoomNo = safeInt(roomNo, 1, 35, 1);
  let currentRooms: Room[] = getFresh35Rooms();
  let ownRoomSnapshotData: Room | null = null;

  // Load de-identified neighbor display names in one fast query (no phone/rent PII)
  getDocs(collection(db, 'roomDirectory'))
    .then((snap) => {
      if (snap.empty) return;
      const dirMap = new Map<number, { displayName?: string; isOccupied?: boolean }>();
      snap.forEach((d) => {
        const data = d.data();
        dirMap.set(Number(data.no), data);
      });
      currentRooms = getFresh35Rooms().map((base) => {
        if (ownRoomSnapshotData && base.no === cleanRoomNo) {
          return ownRoomSnapshotData;
        }
        const entry = dirMap.get(base.no);
        if (entry) {
          return {
            ...base,
            name: entry.displayName || '',
            isOccupied: Boolean(entry.isOccupied),
          };
        }
        return base;
      });
      onUpdate({ rooms: [...currentRooms] });
    })
    .catch(() => {
      // Directory entries may not have been seeded yet; fail silently in tenant view
    });

  unsubs.push(
    onSnapshot(
      doc(db, 'buildings', BUILDING_DOC_ID),
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          onUpdate({
            settings: {
              ...DEFAULT_SETTINGS,
              buildingName: d.buildingName || DEFAULT_SETTINGS.buildingName,
              buildingAddress: d.buildingAddress || DEFAULT_SETTINGS.buildingAddress,
              landlordName: d.landlordName || 'হৃদয়',
              landlordTitle:
                d.landlordTitle && !String(d.landlordTitle).includes('পরিচালক')
                  ? d.landlordTitle
                  : 'কর্তৃপক্ষ',
              landlordPhone: d.landlordPhone || DEFAULT_SETTINGS.landlordPhone,
              bkashNumber: d.bkashNumber,
              nagadNumber: d.nagadNumber,
              defaultUnitRate: Number(d.defaultUnitRate ?? 12),
              useBengaliDigits: Boolean(d.useBengaliDigits ?? true),
            },
          });
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, `buildings/${BUILDING_DOC_ID}`);
      }
    )
  );

  unsubs.push(
    onSnapshot(
      doc(db, 'rooms', `room-${cleanRoomNo}`),
      (snap) => {
        if (snap.exists()) {
          ownRoomSnapshotData = snap.data() as Room;
          currentRooms = currentRooms.map((r) =>
            r.no === cleanRoomNo ? ownRoomSnapshotData! : r
          );
          onUpdate({ rooms: [...currentRooms] });
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, `rooms/room-${cleanRoomNo}`);
      }
    )
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'bills'), where('tenantUid', '==', uid)),
      (snap) => {
        onUpdate({ bills: snap.docs.map((d) => d.data() as BillRecord) });
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'bills');
      }
    )
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'payments'), where('tenantUid', '==', uid)),
      (snap) => {
        onUpdate({ payments: snap.docs.map((d) => d.data() as PaymentRecord) });
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'payments');
      }
    )
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'complaints'), where('tenantUid', '==', uid)),
      (snap) => {
        onUpdate({ complaints: snap.docs.map((d) => d.data() as ComplaintRecord) });
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'complaints');
      }
    )
  );

  return () => {
    unsubs.forEach((u) => u());
  };
}

export async function saveCloudBackupSnapshot(
  label: string,
  database: AppDatabase,
  createdByUid: string
): Promise<CloudBackupMetadata> {
  const id = `bkp-${Date.now()}`;
  const createdAt = new Date().toISOString();
  const cleanSnapshot: AppDatabase = {
    rooms: database.rooms || [],
    shared: database.shared || [],
    bills: database.bills || [],
    payments: database.payments || [],
    loginApprovals: database.loginApprovals || [],
    complaints: database.complaints || [],
    settings: database.settings || DEFAULT_SETTINGS,
    lastUpdated: createdAt,
  };

  const docPayload: CloudBackupMetadata = {
    id,
    label: clampStr(label || `ব্যাকআপ ${createdAt.slice(0, 10)}`, 120),
    createdByUid: clampStr(createdByUid, 128),
    createdAt,
    roomsCount: safeInt(cleanSnapshot.rooms.length, 0, 100, 35),
    billsCount: Math.max(0, Math.round(cleanSnapshot.bills.length)),
    sharedCount: Math.max(0, Math.round(cleanSnapshot.shared.length)),
    snapshot: cleanSnapshot,
  };

  const path = `backups/${id}`;
  try {
    await setDoc(doc(db, 'backups', id), docPayload);
    return docPayload;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function listCloudBackupSnapshots(): Promise<CloudBackupMetadata[]> {
  try {
    const q = query(collection(db, 'backups'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as CloudBackupMetadata);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'backups');
  }
}

export async function deleteCloudBackupSnapshot(id: string): Promise<void> {
  const cleanId = safeId(id, '');
  if (!cleanId) return;
  const path = `backups/${cleanId}`;
  try {
    await deleteDoc(doc(db, 'backups', cleanId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
