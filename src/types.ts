export interface Room {
  id: string;
  no: number;
  floor: number;
  name: string;
  phone: string;
  rent: number;
  rate: number; // Tk per unit for own meter (default 12)
  isOccupied: boolean;
  notes?: string;
}

export interface JointMeterRecord {
  id: string;
  groupIndex: number;
  groupName: string;
  rooms: number[];
  month: string; // YYYY-MM
  prev: number;
  now: number;
  units: number;
  rate: number;
  amount: number;
  perRoomShare: number;
  createdAt: string;
}

export interface BillRecord {
  id: string;
  roomId: string;
  roomNo: number;
  floor: number;
  tenantName: string;
  tenantPhone: string;
  month: string; // YYYY-MM
  prev: number;
  now: number;
  units: number;
  rate: number;
  electricityCost: number;
  rent: number;
  sharedElectricity: number;
  other: number;
  note: string;
  total: number;
  paid: number;
  due: number;
  paymentMethod?: string;
  trxId?: string;
  unitGroupId?: string;
  createdAt: string;
}

export interface BuildingSettings {
  buildingName: string;
  buildingAddress: string;
  landlordName: string;
  landlordTitle?: string; // e.g. 'কর্তৃপক্ষ'
  landlordPhone: string;
  bkashNumber?: string;
  nagadNumber?: string;
  defaultUnitRate: number;
  useBengaliDigits: boolean;
}

export interface PaymentRecord {
  id: string;
  roomNo: number;
  roomId: string;
  tenantName: string;
  month: string;
  amount: number;
  paymentType: 'electricity' | 'rent' | 'both' | 'custom';
  method: 'bkash' | 'nagad' | 'rocket' | 'bank' | 'cash';
  trxId?: string;
  senderPhone?: string;
  note?: string;
  createdAt: string;
  status: 'pending' | 'approved';
}

export interface TenantLoginApproval {
  id: string;
  roomNo: number;
  tenantName: string;
  phone: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  updatedAt: string;
  approvedBy?: string;
}

export interface ComplaintRecord {
  id: string;
  roomNo: number;
  tenantName: string;
  phone: string;
  category: 'electricity' | 'water' | 'repair' | 'billing' | 'cleanliness' | 'other';
  priority: 'normal' | 'urgent';
  subject: string;
  message: string;
  status: 'pending' | 'in_progress' | 'resolved';
  adminReply?: string;
  repliedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppDatabase {
  rooms: Room[];
  shared: JointMeterRecord[];
  bills: BillRecord[];
  settings: BuildingSettings;
  payments?: PaymentRecord[];
  loginApprovals?: TenantLoginApproval[];
  complaints?: ComplaintRecord[];
  lastUpdated?: string;
}

export type UserRole = 'admin' | 'tenant' | 'user' | 'guest';

export interface AuthSession {
  isLoggedIn: boolean;
  role: UserRole;
  name: string;
  title?: string;
  roomNo?: number;
  roomId?: string;
  floor?: number;
  phone?: string;
}

/**
 * Privacy Rule Helper:
 * - Admin (কর্তৃপক্ষ হৃদয়) can view ALL financials.
 * - Logged-in Tenant of room X can view ONLY room X's financials.
 * - For all other rooms, other tenants can only see the member's name;
 *   phone number, rent amount, and electricity bill/due are hidden/masked.
 */
export function canViewRoomFinancials(
  roomNo: number,
  authSession?: AuthSession | null,
  isOwner?: boolean
): boolean {
  if (isOwner || (authSession?.role === 'admin' && authSession?.isLoggedIn)) {
    return true;
  }
  if (
    authSession?.isLoggedIn &&
    authSession.role === 'tenant' &&
    authSession.roomNo === roomNo
  ) {
    return true;
  }
  return false;
}

