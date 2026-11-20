import express, { Request, Response } from 'express';
import http from 'http';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = http.createServer(app);
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Ensure data directory exists
const DATA_DIR = path.resolve(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_FILE = path.join(DATA_DIR, 'database.json');
const SECURITY_FILE = path.join(DATA_DIR, 'security.json');

// Default initial database for Alam Khan Building (35 rooms)
const ROOM_FLOOR_MAP: Record<number, number> = {
  1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 34: 2, 35: 2,
  6: 3, 7: 3, 8: 3,
  9: 4, 10: 4, 11: 4, 12: 4, 13: 4, 14: 4, 15: 4, 16: 4,
  17: 5, 18: 5, 19: 5, 20: 5, 21: 5, 22: 5, 23: 5, 24: 5,
  25: 6, 26: 6, 27: 6, 28: 6, 29: 6, 30: 6, 31: 6, 32: 6,
  33: 7
};

function getFreshEmptyDatabase() {
  const rooms = [];
  for (let i = 1; i <= 35; i++) {
    const floor = ROOM_FLOOR_MAP[i] || 2;
    rooms.push({
      id: `room-${i}`,
      no: i,
      floor,
      name: '',
      phone: '',
      rent: 0,
      rate: 12,
      isOccupied: false,
      notes: '',
    });
  }

  return {
    rooms,
    shared: [],
    bills: [],
    payments: [],
    loginApprovals: [],
    complaints: [],
    settings: {
      buildingName: 'আলম খান বিল্ডিং',
      buildingAddress: 'ঢাকা, বাংলাদেশ',
      landlordName: 'হৃদয়',
      landlordTitle: 'কর্তৃপক্ষ',
      landlordPhone: '01939022271 / 09638194963',
      defaultUnitRate: 12,
      useBengaliDigits: true,
    },
    lastUpdated: new Date().toISOString(),
  };
}

// Load or initialize security settings (Default Owner PIN: 7540 on first seed only)
function getSecuritySettings() {
  if (fs.existsSync(SECURITY_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(SECURITY_FILE, 'utf-8'));
      if (!data.sessionSecret) {
        data.sessionSecret = crypto.randomBytes(32).toString('hex');
        fs.writeFileSync(SECURITY_FILE, JSON.stringify(data, null, 2), 'utf-8');
      }
      if (!data.role || String(data.role).includes('পরিচালক')) {
        data.role = 'কর্তৃপক্ষ';
      }
      return data;
    } catch (e) {
      console.error('Error reading security file:', e);
    }
  }
  const defaultSecurity = {
    adminPin: '7540', // Initial PIN for Authority Hridoy until changed
    ownerName: 'হৃদয়',
    role: 'কর্তৃপক্ষ',
    sessionSecret: crypto.randomBytes(32).toString('hex'),
    lastPinChange: new Date().toISOString(),
  };
  fs.writeFileSync(SECURITY_FILE, JSON.stringify(defaultSecurity, null, 2), 'utf-8');
  return defaultSecurity;
}

// Load or initialize database
function getDatabase() {
  if (fs.existsSync(DB_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
      // Ensure building name is Alam Khan Building and director Hridoy
      if (data && data.settings) {
        if (!data.settings.buildingName || data.settings.buildingName.includes('৩৫ রুম বাড়ি')) {
          data.settings.buildingName = 'আলম খান বিল্ডিং';
        }
        if (!data.settings.landlordName) {
          data.settings.landlordName = 'হৃদয়';
        }
        if (!data.settings.landlordTitle || String(data.settings.landlordTitle).includes('পরিচালক')) {
          data.settings.landlordTitle = 'কর্তৃপক্ষ';
        }
        if (!data.settings.landlordPhone || data.settings.landlordPhone === '০১৭১১-০০০০০০') {
          data.settings.landlordPhone = '01939022271 / 09638194963';
        }
      }
      const existingRooms = Array.isArray(data.rooms) ? data.rooms : [];
      const roomMap = new Map<number, any>();
      for (const r of existingRooms) {
        if (r && r.no) {
          roomMap.set(Number(r.no), {
            ...r,
            floor: Number(r.floor) || ROOM_FLOOR_MAP[Number(r.no)] || 2,
          });
        }
      }
      const fullRooms: any[] = [];
      for (let i = 1; i <= 35; i++) {
        fullRooms.push(
          roomMap.get(i) || {
            id: `room-${i}`,
            no: i,
            floor: ROOM_FLOOR_MAP[i] || 2,
            name: '',
            phone: '',
            rent: 0,
            rate: 12,
            isOccupied: false,
            notes: '',
          }
        );
      }
      data.rooms = fullRooms;

      if (!Array.isArray(data.loginApprovals)) {
        data.loginApprovals = [];
      }
      if (!Array.isArray(data.payments)) {
        data.payments = [];
      }
      if (!Array.isArray(data.complaints)) {
        data.complaints = [];
      }
      return data;
    } catch (e) {
      console.error('Error reading database file:', e);
    }
  }
  const freshDb = getFreshEmptyDatabase();
  fs.writeFileSync(DB_FILE, JSON.stringify(freshDb, null, 2), 'utf-8');
  return freshDb;
}

// --- Real-Time SSE Broadcast Hub ---
const sseClients = new Set<Response>();

function broadcastRealtimeEvent(eventName: string, data: any) {
  const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

function saveDatabase(data: any) {
  const payload = {
    ...data,
    lastUpdated: new Date().toISOString(),
  };
  fs.writeFileSync(DB_FILE, JSON.stringify(payload, null, 2), 'utf-8');
  return payload;
}

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ ok: true, mode: isProduction ? 'production' : 'development' });
});

// --- Firebase & Tenant Token Helpers ---
const ADMIN_GOOGLE_EMAIL = 'hridoyrifat754@gmail.com';
const firebaseTokenCache = new Map<string, { email: string; emailVerified: boolean; expiresAt: number }>();

function getFirebaseWebApiKey(): string {
  try {
    const cfgPath = path.resolve(__dirname, 'firebase-applet-config.json');
    if (fs.existsSync(cfgPath)) {
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
      return cfg.apiKey || '';
    }
  } catch {}
  return '';
}

async function verifyFirebaseIdTokenHeader(req: Request): Promise<{ email: string; emailVerified: boolean } | null> {
  const token = String(req.headers['x-firebase-id-token'] || '').trim();
  if (!token || token.length < 20) return null;

  const cached = firebaseTokenCache.get(token);
  if (cached && cached.expiresAt > Date.now()) {
    return { email: cached.email, emailVerified: cached.emailVerified };
  }

  const apiKey = getFirebaseWebApiKey();
  if (!apiKey) return null;

  try {
    const resp = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token }),
    });
    if (!resp.ok) return null;
    const data: any = await resp.json();
    const user = Array.isArray(data?.users) ? data.users[0] : null;
    if (!user || !user.email) return null;
    const info = {
      email: String(user.email),
      emailVerified: Boolean(user.emailVerified),
    };
    firebaseTokenCache.set(token, { ...info, expiresAt: Date.now() + 5 * 60 * 1000 });
    return info;
  } catch {
    return null;
  }
}

function signTenantToken(roomNo: number): string {
  const security = getSecuritySettings();
  const exp = Date.now() + 30 * 24 * 60 * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({ roomNo, exp })).toString('base64url');
  const sig = crypto
    .createHmac('sha256', String(security.sessionSecret || security.adminPin))
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

function verifyTenantToken(req: Request): number | null {
  const raw = String(req.headers['x-tenant-token'] || '').trim();
  if (!raw || !raw.includes('.')) return null;
  const [payload, sig] = raw.split('.');
  if (!payload || !sig) return null;
  try {
    const security = getSecuritySettings();
    const expected = crypto
      .createHmac('sha256', String(security.sessionSecret || security.adminPin))
      .update(payload)
      .digest('base64url');
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    if (!parsed || typeof parsed.roomNo !== 'number' || !parsed.exp || parsed.exp < Date.now()) {
      return null;
    }
    const db = getDatabase();
    const approval = (db.loginApprovals || []).find((a: any) => Number(a.roomNo) === parsed.roomNo);
    if (!approval || approval.status !== 'approved') {
      return null;
    }
    return parsed.roomNo;
  } catch {
    return null;
  }
}

// Helper to check if request is authenticated as Director Hridoy
async function isOwnerRequestAsync(req: Request, bodyPin?: string): Promise<boolean> {
  const pinHeader = req.headers['x-admin-pin'] as string;
  const authHeader = req.headers['authorization'];
  let bearerPin = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    bearerPin = authHeader.slice(7).trim();
  }
  const providedPin = String(pinHeader || bearerPin || bodyPin || '').trim();
  const security = getSecuritySettings();
  if (providedPin && providedPin === security.adminPin) {
    return true;
  }
  const fbUser = await verifyFirebaseIdTokenHeader(req);
  return Boolean(fbUser && fbUser.email === ADMIN_GOOGLE_EMAIL && fbUser.emailVerified);
}

function sanitizeDatabaseForGuest(db: any) {
  const defaultRate = db?.settings?.defaultUnitRate ?? 12;
  return {
    rooms: (db.rooms || []).map((r: any) => ({
      id: r.id,
      no: Number(r.no),
      floor: Number(r.floor) || ROOM_FLOOR_MAP[Number(r.no)] || 2,
      name: '',
      phone: '',
      rent: 0,
      rate: defaultRate,
      isOccupied: Boolean(r.isOccupied),
      notes: '',
    })),
    shared: [],
    bills: [],
    payments: [],
    loginApprovals: [],
    complaints: [],
    settings: {
      buildingName: db?.settings?.buildingName || 'আলম খান বিল্ডিং',
      buildingAddress: db?.settings?.buildingAddress || 'ঢাকা, বাংলাদেশ',
      landlordName: db?.settings?.landlordName || 'হৃদয়',
      landlordTitle:
        db?.settings?.landlordTitle && !String(db.settings.landlordTitle).includes('পরিচালক')
          ? db.settings.landlordTitle
          : 'কর্তৃপক্ষ',
      landlordPhone: db?.settings?.landlordPhone || '01939022271 / 09638194963',
      defaultUnitRate: defaultRate,
      useBengaliDigits: Boolean(db?.settings?.useBengaliDigits ?? true),
    },
    lastUpdated: db.lastUpdated,
  };
}

function sanitizeDatabaseForTenant(db: any, roomNo: number) {
  const defaultRate = db?.settings?.defaultUnitRate ?? 12;
  return {
    rooms: (db.rooms || []).map((r: any) => {
      if (Number(r.no) === roomNo) {
        return r;
      }
      return {
        id: r.id,
        no: Number(r.no),
        floor: Number(r.floor) || ROOM_FLOOR_MAP[Number(r.no)] || 2,
        name: r.isOccupied ? (r.name || `রুম ${r.no}`) : '',
        phone: '',
        rent: 0,
        rate: defaultRate,
        isOccupied: Boolean(r.isOccupied),
        notes: '',
      };
    }),
    shared: db.shared || [],
    bills: (db.bills || []).filter((b: any) => Number(b.roomNo) === roomNo),
    payments: (db.payments || []).filter((p: any) => Number(p.roomNo) === roomNo),
    loginApprovals: (db.loginApprovals || []).filter((a: any) => Number(a.roomNo) === roomNo),
    complaints: (db.complaints || []).filter((c: any) => Number(c.roomNo) === roomNo),
    settings: db.settings,
    lastUpdated: db.lastUpdated,
  };
}

// --- API Endpoints ---

// 0. Real-Time SSE Subscription (Emits lightweight sync signal only - NO PII over unauthenticated SSE!)
app.get('/api/events', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  sseClients.add(res);
  const db = getDatabase();
  res.write(`event: connected\ndata: ${JSON.stringify({ lastUpdated: db.lastUpdated || new Date().toISOString() })}\n\n`);

  const heartbeat = setInterval(() => {
    try {
      res.write(`: ping ${Date.now()}\n\n`);
    } catch {
      clearInterval(heartbeat);
      sseClients.delete(res);
    }
  }, 20000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
});

// 1. Get Live Database (strictly scoped by role: Full for Admin, Room-scoped for Approved Tenant, Non-PII for Guest)
app.get('/api/database', async (req: Request, res: Response) => {
  const db = getDatabase();
  const isOwner = await isOwnerRequestAsync(req);
  if (isOwner) {
    return res.json({
      database: db,
      isOwner: true,
      accessScope: 'admin',
      lastUpdated: db.lastUpdated || new Date().toISOString(),
      ownerName: 'হৃদয়',
      role: 'কর্তৃপক্ষ',
    });
  }

  const tenantRoomNo = verifyTenantToken(req);
  if (tenantRoomNo) {
    return res.json({
      database: sanitizeDatabaseForTenant(db, tenantRoomNo),
      isOwner: false,
      accessScope: 'tenant',
      roomNo: tenantRoomNo,
      lastUpdated: db.lastUpdated || new Date().toISOString(),
      ownerName: 'হৃদয়',
      role: 'কর্তৃপক্ষ',
    });
  }

  return res.json({
    database: sanitizeDatabaseForGuest(db),
    isOwner: false,
    accessScope: 'guest',
    lastUpdated: db.lastUpdated || new Date().toISOString(),
    ownerName: 'হৃদয়',
    role: 'কর্তৃপক্ষ',
  });
});

// 2. Save / Update Database (Permanent persistence ONLY for Authenticated Director Hridoy)
app.post('/api/database', async (req: Request, res: Response) => {
  const { database, adminPin, allowFullRoomUpdate } = req.body;
  const isAuthorizedAdmin = await isOwnerRequestAsync(req, adminPin);

  if (!isAuthorizedAdmin) {
    return res.status(401).json({
      success: false,
      error: 'ডাটাবেজ সংরক্ষণ করার জন্য বৈধ এডমিন অনুমোদন প্রয়োজন।',
    });
  }

  if (!database || !Array.isArray(database.rooms)) {
    return res.status(400).json({
      success: false,
      error: 'অপ্রত্যাশিত বা ভুল ডেটা ফরম্যাট।',
    });
  }

  // When Admin explicitly updates/edits/vacates rooms, allow updating ALL room fields (even clearing name/phone/rent).
  // Otherwise protect existing populated room names against accidental blank device payloads.
  const currentDb = getDatabase();
  const canExplicitlyClearOrEditRooms = Boolean(allowFullRoomUpdate && isAuthorizedAdmin);

  const mergedRooms = database.rooms.map((incomingRoom: any) => {
    const existing = currentDb.rooms?.find((r: any) => Number(r.no) === Number(incomingRoom.no));
    if (canExplicitlyClearOrEditRooms) {
      return {
        ...(existing || {}),
        ...incomingRoom,
        no: Number(incomingRoom.no),
        floor: Number(incomingRoom.floor) || existing?.floor || ROOM_FLOOR_MAP[Number(incomingRoom.no)] || 2,
        name: incomingRoom.name !== undefined ? String(incomingRoom.name) : '',
        phone: incomingRoom.phone !== undefined ? String(incomingRoom.phone) : '',
        rent: Number(incomingRoom.rent) || 0,
        rate: incomingRoom.rate !== undefined ? Number(incomingRoom.rate) : (existing?.rate ?? 12),
        isOccupied: Boolean(incomingRoom.isOccupied),
        notes: incomingRoom.notes !== undefined ? String(incomingRoom.notes) : '',
      };
    }

    // If incoming has a name, use incoming
    if (incomingRoom.name && incomingRoom.name.trim() !== '') {
      return {
        ...incomingRoom,
        floor: Number(incomingRoom.floor) || existing?.floor || ROOM_FLOOR_MAP[Number(incomingRoom.no)] || 2,
      };
    }
    // If incoming has empty name but existing on server had a name, preserve existing tenant info
    if (existing && existing.name && existing.name.trim() !== '') {
      return {
        ...incomingRoom,
        name: existing.name,
        phone: incomingRoom.phone || existing.phone,
        rent: incomingRoom.rent || existing.rent,
        floor: Number(incomingRoom.floor) || existing.floor || ROOM_FLOOR_MAP[Number(incomingRoom.no)] || 2,
        isOccupied: existing.isOccupied,
      };
    }
    return incomingRoom;
  });

  // Merge loginApprovals safely keeping latest updatedAt per roomNo
  const approvalMap = new Map<number, any>();
  for (const a of currentDb.loginApprovals || []) {
    if (a && a.roomNo) approvalMap.set(Number(a.roomNo), a);
  }
  for (const a of database.loginApprovals || []) {
    if (a && a.roomNo) {
      const existing = approvalMap.get(Number(a.roomNo));
      if (!existing || (a.updatedAt && (!existing.updatedAt || a.updatedAt >= existing.updatedAt))) {
        approvalMap.set(Number(a.roomNo), a);
      }
    }
  }

  // Merge complaints safely keeping latest updatedAt per id
  const complaintMap = new Map<string, any>();
  for (const c of currentDb.complaints || []) {
    if (c && c.id) complaintMap.set(c.id, c);
  }
  for (const c of database.complaints || []) {
    if (c && c.id) {
      const existing = complaintMap.get(c.id);
      if (!existing || (c.updatedAt && (!existing.updatedAt || c.updatedAt >= existing.updatedAt))) {
        complaintMap.set(c.id, c);
      }
    }
  }

  const saved = saveDatabase({
    ...database,
    rooms: mergedRooms,
    loginApprovals: Array.from(approvalMap.values()).sort((a, b) => a.roomNo - b.roomNo),
    complaints: Array.from(complaintMap.values()).sort((a, b) =>
      String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
    ),
    settings: {
      buildingName: 'আলম খান বিল্ডিং',
      buildingAddress: 'ঢাকা, বাংলাদেশ',
      landlordName: 'হৃদয়',
      landlordTitle: 'কর্তৃপক্ষ',
      landlordPhone: '01939022271 / 09638194963',
      defaultUnitRate: 12,
      useBengaliDigits: true,
      ...(database.settings || {}),
    },
  });

  // Broadcast lightweight sync signal (clients fetch role-authorized data via /api/database)
  broadcastRealtimeEvent('database_updated', {
    lastUpdated: saved.lastUpdated,
  });

  res.json({
    success: true,
    message: 'আলম খান বিল্ডিং-এর সকল তথ্য অনলাইনে সফলভাবে সংরক্ষিত হয়েছে!',
    lastUpdated: saved.lastUpdated,
  });
});

// 3. Admin Login & PIN Verification
app.post('/api/auth/verify-pin', (req: Request, res: Response) => {
  const { pin } = req.body;
  const security = getSecuritySettings();
  const isValid = Boolean(pin && pin.trim() === security.adminPin);
  res.json({
    valid: isValid,
    isOwner: isValid,
    ownerName: security.ownerName || 'হৃদয়',
    role: security.role || 'কর্তৃপক্ষ',
  });
});

app.post('/api/auth/admin-login', (req: Request, res: Response) => {
  const { pin } = req.body;
  const security = getSecuritySettings();
  if (pin && pin.trim() === security.adminPin) {
    return res.json({
      success: true,
      role: 'admin',
      name: security.ownerName || 'হৃদয়',
      title: security.role || 'কর্তৃপক্ষ',
      token: security.adminPin,
    });
  }
  return res.status(401).json({
    success: false,
    error: 'ভুল পিন কোড! শুধুমাত্র কর্তৃপক্ষ হৃদয় সঠিক পিন দিয়ে এডমিন লগইন করতে পারবেন।',
  });
});

// Helper to normalize digits (Bengali -> English)
function normalizeDigits(str: string): string {
  const map: Record<string, string> = {
    '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
    '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9',
  };
  return String(str || '').replace(/[০-৯]/g, (d) => map[d] || d).replace(/[^0-9]/g, '');
}

// 4. Tenant / User Login (Requires Admin Approval)
app.post('/api/auth/tenant-login', (req: Request, res: Response) => {
  const { roomNo, phone, tenantName } = req.body;
  const num = parseInt(roomNo, 10);
  if (isNaN(num) || num < 1 || num > 35) {
    return res.status(400).json({
      success: false,
      error: 'অনুগ্রহ করে ১ থেকে ৩৫ এর মধ্যে সঠিক রুম নম্বর দিন।',
    });
  }

  const db = getDatabase();
  const room = db.rooms.find((r: any) => Number(r.no) === num) || {
    id: `room-${num}`,
    no: num,
    floor: ROOM_FLOOR_MAP[num] || 2,
    name: '',
    phone: '',
    rent: 0,
    rate: 12,
    isOccupied: false,
  };

  // If phone is provided, check matching (if room has phone recorded)
  if (phone && room.phone && room.phone.trim()) {
    const cleanPhone = normalizeDigits(phone);
    const cleanRoomPhone = normalizeDigits(room.phone);
    if (cleanPhone && cleanRoomPhone && !cleanRoomPhone.includes(cleanPhone) && !cleanPhone.includes(cleanRoomPhone)) {
      return res.status(401).json({
        success: false,
        error: `রুম ${num}-এর জন্য প্রদত্ত মোবাইল নম্বরটি মিলছে না!`,
      });
    }
  }

  const approvals: any[] = Array.isArray(db.loginApprovals) ? db.loginApprovals : [];
  const existingIdx = approvals.findIndex((a: any) => Number(a.roomNo) === num);
  const existingApproval = existingIdx >= 0 ? approvals[existingIdx] : null;
  const resolvedName = (tenantName && String(tenantName).trim()) || room.name || `রুম ${room.no}-এর ভাড়াটিয়া`;
  const resolvedPhone = (phone && String(phone).trim()) || room.phone || '';

  if (existingApproval && existingApproval.status === 'approved') {
    return res.json({
      success: true,
      role: 'tenant',
      approvalStatus: 'approved',
      tenantToken: signTenantToken(room.no),
      user: {
        roomNo: room.no,
        roomId: room.id,
        floor: room.floor,
        name: resolvedName,
        phone: resolvedPhone,
        rent: room.rent,
        isOccupied: room.isOccupied,
      },
    });
  }

  if (existingApproval && existingApproval.status === 'rejected') {
    return res.status(403).json({
      success: false,
      rejected: true,
      approvalStatus: 'rejected',
      error: 'আপনার লগইন অনুরোধ এডমিন (হৃদয়) কর্তৃক অনুমোদিত হয়নি। অনুগ্রহ করে 01939022271 / 09638194963 নম্বরে যোগাযোগ করুন।',
    });
  }

  // Create or refresh pending request
  const nowIso = new Date().toISOString();
  const pendingEntry = {
    id: existingApproval?.id || `approval-room-${num}`,
    roomNo: num,
    tenantName: resolvedName,
    phone: resolvedPhone,
    status: 'pending',
    requestedAt: existingApproval?.requestedAt || nowIso,
    updatedAt: nowIso,
  };

  const nextApprovals = [...approvals];
  if (existingIdx >= 0) {
    nextApprovals[existingIdx] = pendingEntry;
  } else {
    nextApprovals.push(pendingEntry);
  }
  db.loginApprovals = nextApprovals;
  const savedDb = saveDatabase(db);
  broadcastRealtimeEvent('database_updated', { lastUpdated: savedDb.lastUpdated });

  return res.status(403).json({
    success: false,
    pendingApproval: true,
    approvalStatus: 'pending',
    error: `রুম ${num}-এ লগইন করার জন্য কর্তৃপক্ষ হৃদয় (এডমিন)-এর অনুমতি প্রয়োজন। আপনার অনুরোধ পাঠানো হয়েছে—অনুমতি পাওয়া মাত্রই লগইন সম্পন্ন হবে।`,
  });
});

// 4b. Admin Approval Action for Tenant Login
app.post('/api/auth/approval-action', async (req: Request, res: Response) => {
  const { roomNo, status, tenantName, phone, adminPin } = req.body;
  const isAuthorized = await isOwnerRequestAsync(req, adminPin);

  if (!isAuthorized) {
    return res.status(401).json({
      success: false,
      error: 'অনুমোদনের জন্য সঠিক এডমিন অনুমোদন প্রয়োজন।',
    });
  }

  const num = parseInt(roomNo, 10);
  if (isNaN(num) || num < 1 || num > 35) {
    return res.status(400).json({ success: false, error: 'সঠিক রুম নম্বর দিন (১-৩৫)।' });
  }

  if (!['approved', 'rejected', 'pending'].includes(status)) {
    return res.status(400).json({ success: false, error: 'অবৈধ স্ট্যাটাস।' });
  }

  const db = getDatabase();
  const room = db.rooms.find((r: any) => r.no === num);
  const approvals: any[] = Array.isArray(db.loginApprovals) ? db.loginApprovals : [];
  const idx = approvals.findIndex((a: any) => Number(a.roomNo) === num);
  const nowIso = new Date().toISOString();

  const updatedEntry = {
    id: idx >= 0 ? approvals[idx].id : `approval-room-${num}`,
    roomNo: num,
    tenantName: (tenantName && String(tenantName).trim()) || (idx >= 0 ? approvals[idx].tenantName : '') || room?.name || `রুম ${num} ভাড়াটিয়া`,
    phone: (phone && String(phone).trim()) || (idx >= 0 ? approvals[idx].phone : '') || room?.phone || '',
    status,
    requestedAt: idx >= 0 ? approvals[idx].requestedAt : nowIso,
    updatedAt: nowIso,
    approvedBy: 'হৃদয় (এডমিন)',
  };

  if (idx >= 0) {
    approvals[idx] = updatedEntry;
  } else {
    approvals.push(updatedEntry);
  }
  db.loginApprovals = approvals.sort((a: any, b: any) => a.roomNo - b.roomNo);
  const savedDb = saveDatabase(db);
  broadcastRealtimeEvent('database_updated', { lastUpdated: savedDb.lastUpdated });

  return res.json({
    success: true,
    approval: updatedEntry,
    loginApprovals: db.loginApprovals,
  });
});

// 4b-2. Approved Tenant or Admin Payment Slip Submission
app.post('/api/payments', async (req: Request, res: Response) => {
  const payment = req.body?.payment || req.body;
  const roomNo = parseInt(payment?.roomNo, 10);
  if (isNaN(roomNo) || roomNo < 1 || roomNo > 35 || !(Number(payment?.amount) > 0)) {
    return res.status(400).json({ success: false, error: 'সঠিক পেমেন্ট তথ্য ও রুম নম্বর দিন।' });
  }

  const isOwner = await isOwnerRequestAsync(req);
  const tenantRoomNo = verifyTenantToken(req);
  if (!isOwner && tenantRoomNo !== roomNo) {
    return res.status(401).json({ success: false, error: 'পেমেন্ট জমা দিতে অনুমোদিত রুম লগইন প্রয়োজন।' });
  }

  const db = getDatabase();
  const cleanPayment = {
    id: String(payment.id || `pay-${Date.now()}`).slice(0, 128),
    roomNo,
    roomId: String(payment.roomId || `room-${roomNo}`),
    tenantName: String(payment.tenantName || `রুম ${roomNo}`).slice(0, 120),
    month: String(payment.month || new Date().toISOString().slice(0, 7)),
    amount: Number(payment.amount),
    paymentType: ['electricity', 'rent', 'both', 'custom'].includes(payment.paymentType) ? payment.paymentType : 'both',
    method: ['bkash', 'nagad', 'rocket', 'bank', 'cash'].includes(payment.method) ? payment.method : 'bkash',
    trxId: payment.trxId ? String(payment.trxId).slice(0, 80) : '',
    senderPhone: payment.senderPhone ? String(payment.senderPhone).slice(0, 40) : '',
    note: payment.note ? String(payment.note).slice(0, 300) : '',
    createdAt: payment.createdAt || new Date().toISOString(),
    status: isOwner && payment.status === 'approved' ? 'approved' : 'pending',
  };

  const existingPayments: any[] = Array.isArray(db.payments) ? db.payments : [];
  db.payments = [cleanPayment, ...existingPayments.filter((p: any) => p.id !== cleanPayment.id)];
  db.bills = (db.bills || []).map((b: any) => {
    if (b.roomId === cleanPayment.roomId && b.month === cleanPayment.month) {
      const newPaid = Number(b.paid || 0) + cleanPayment.amount;
      const newDue = Math.max(0, Number(b.total || 0) - newPaid);
      return {
        ...b,
        paid: newPaid,
        due: newDue,
        paymentMethod: cleanPayment.method,
        trxId: cleanPayment.trxId || b.trxId,
      };
    }
    return b;
  });

  const savedDb = saveDatabase(db);
  broadcastRealtimeEvent('database_updated', { lastUpdated: savedDb.lastUpdated });

  return res.json({
    success: true,
    payment: cleanPayment,
    lastUpdated: savedDb.lastUpdated,
  });
});

// 4c. Submit Tenant Complaint / Help Message (Available 24/7 to tenants & users)
app.post('/api/complaints', async (req: Request, res: Response) => {
  const { id, roomNo, tenantName, phone, category, priority, subject, message } = req.body;
  if (!message || !String(message).trim()) {
    return res.status(400).json({ success: false, error: 'অনুগ্রহ করে আপনার অভিযোগ বা বার্তা লিখুন।' });
  }

  const db = getDatabase();
  const num = parseInt(roomNo, 10) || 0;
  const nowIso = new Date().toISOString();

  const complaint = {
    id: id || `cmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    roomNo: num,
    tenantName: (tenantName && String(tenantName).trim()) || (num ? `রুম ${num} ভাড়াটিয়া` : 'অ্যাপ ইউজার'),
    phone: (phone && String(phone).trim()) || '',
    category: category || 'other',
    priority: priority === 'urgent' ? 'urgent' : 'normal',
    subject: (subject && String(subject).trim()) || 'সাধারণ সহায়তা / অভিযোগ',
    message: String(message).trim(),
    status: 'pending',
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const existing: any[] = Array.isArray(db.complaints) ? db.complaints : [];
  db.complaints = [complaint, ...existing.filter((c: any) => c.id !== complaint.id)];
  const savedDb = saveDatabase(db);
  broadcastRealtimeEvent('database_updated', { lastUpdated: savedDb.lastUpdated });

  const isOwner = await isOwnerRequestAsync(req);
  const tenantRoom = verifyTenantToken(req);
  const scopedComplaints = isOwner
    ? db.complaints
    : tenantRoom
    ? db.complaints.filter((c: any) => Number(c.roomNo) === tenantRoom)
    : [complaint];

  return res.json({
    success: true,
    complaint,
    complaints: scopedComplaints,
  });
});

// 4d. Admin Reply / Status Update on Complaint
app.post('/api/complaints/reply', async (req: Request, res: Response) => {
  const { id, status, adminReply, adminPin } = req.body;
  const isAuthorized = await isOwnerRequestAsync(req, adminPin);

  if (!isAuthorized) {
    return res.status(401).json({ success: false, error: 'উত্তর দেওয়ার জন্য এডমিন অনুমোদন প্রয়োজন।' });
  }

  const db = getDatabase();
  const list: any[] = Array.isArray(db.complaints) ? db.complaints : [];
  const idx = list.findIndex((c: any) => c.id === id);
  if (idx < 0) {
    return res.status(404).json({ success: false, error: 'অভিযোগটি খুঁজে পাওয়া যায়নি।' });
  }

  const nowIso = new Date().toISOString();
  list[idx] = {
    ...list[idx],
    status: ['pending', 'in_progress', 'resolved'].includes(status) ? status : list[idx].status,
    adminReply: adminReply !== undefined ? String(adminReply).trim() : list[idx].adminReply,
    repliedAt: adminReply ? nowIso : list[idx].repliedAt,
    updatedAt: nowIso,
  };

  db.complaints = list;
  const savedDb = saveDatabase(db);
  broadcastRealtimeEvent('database_updated', { lastUpdated: savedDb.lastUpdated });

  return res.json({
    success: true,
    complaint: list[idx],
    complaints: db.complaints,
  });
});

// 5. General User Login
app.post('/api/auth/user-login', (req: Request, res: Response) => {
  const { name } = req.body;
  const userName = (name && name.trim()) || 'সাধারণ ইউজার';
  res.json({
    success: true,
    role: 'user',
    user: {
      name: userName,
    },
  });
});

// 6. Change Admin PIN
app.post('/api/auth/change-pin', (req: Request, res: Response) => {
  const { currentPin, newPin } = req.body;
  const security = getSecuritySettings();

  if (!currentPin || currentPin.trim() !== security.adminPin) {
    return res.status(401).json({
      success: false,
      error: 'বর্তমান পিনটি সঠিক নয়!',
    });
  }

  if (!newPin || newPin.trim().length < 4) {
    return res.status(400).json({
      success: false,
      error: 'নতুন পিন কমপক্ষে ৪ সংখ্যার হতে হবে!',
    });
  }

  security.adminPin = newPin.trim();
  security.lastPinChange = new Date().toISOString();
  fs.writeFileSync(SECURITY_FILE, JSON.stringify(security, null, 2), 'utf-8');

  res.json({
    success: true,
    message: 'কর্তৃপক্ষের পিন সফলভাবে পরিবর্তন করা হয়েছে।',
  });
});

// 5. Share Info
app.get('/api/share-info', (req: Request, res: Response) => {
  const host = req.get('host') || 'localhost:3000';
  const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
  const fullAppUrl = process.env.APP_URL || `${protocol}://${host}`;

  res.json({
    appUrl: fullAppUrl,
    buildingName: 'আলম খান বিল্ডিং',
    directorName: 'হৃদয়',
    role: 'কর্তৃপক্ষ',
    shareText: `🏢 *আলম খান বিল্ডিং — ভাড়া ও ডাইনিং বিদ্যুৎ হিসাব*\nকর্তৃপক্ষ: হৃদয়\n\nঅনলাইনে লাইভ হিসাব ও রসিদ দেখতে নিচের লিংকে প্রবেশ করুন:\n${fullAppUrl}`,
  });
});

// --- Public PWA Manifest, Service Worker, Icons & TWA AssetLinks (PWABuilder-ready) ---
const PUBLIC_DIR = path.resolve(__dirname, 'public');
const DIST_DIR = path.resolve(__dirname, 'dist');
const DEV_DIST_DIR = path.resolve(__dirname, 'dev-dist');

function setPublicPwaCors(res: Response) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, Content-Type, Accept, User-Agent');
}

function sendManifest(res: Response) {
  setPublicPwaCors(res);
  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');

  const candidates = [
    path.join(DIST_DIR, 'manifest.json'),
    path.join(PUBLIC_DIR, 'manifest.json'),
  ];
  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) {
      return res.sendFile(filePath);
    }
  }

  return res.json({
    id: '/',
    name: 'আলম খান',
    short_name: 'আলম খান',
    description: 'আলম খান · কর্তৃপক্ষ: হৃদয় · ২য়–৭ম তলার ৩৫টি রুমের ভাড়া ও ডাইনিং সাব-মিটার বিদ্যুৎ হিসাব',
    lang: 'bn',
    dir: 'ltr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#ffffff',
    theme_color: '#064e3b',
    icons: [
      { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  });
}

app.options(['/manifest.json', '/manifest.webmanifest', '/sw.js', '/.well-known/assetlinks.json'], (_req: Request, res: Response) => {
  setPublicPwaCors(res);
  res.status(204).end();
});

app.get('/manifest.json', (_req: Request, res: Response) => sendManifest(res));
app.get('/manifest.webmanifest', (_req: Request, res: Response) => sendManifest(res));

app.get('/sw.js', (_req: Request, res: Response) => {
  setPublicPwaCors(res);
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Service-Worker-Allowed', '/');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  const prodSw = path.join(DIST_DIR, 'sw.js');
  const devSw = path.join(DEV_DIST_DIR, 'sw.js');
  if (fs.existsSync(prodSw)) {
    return res.sendFile(prodSw);
  }
  if (fs.existsSync(devSw)) {
    return res.sendFile(devSw);
  }
  return res.send(`self.addEventListener('install', () => self.skipWaiting());\nself.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));`);
});

app.get(['/pwa-192x192.png', '/pwa-512x512.png', '/pwa-maskable-512x512.png', '/apple-touch-icon.png', '/icon.svg'], (req: Request, res: Response, next) => {
  setPublicPwaCors(res);
  const fileName = req.path.replace(/^\/+/, '');
  const distFile = path.join(DIST_DIR, fileName);
  const publicFile = path.join(PUBLIC_DIR, fileName);
  if (isProduction && fs.existsSync(distFile)) {
    return res.sendFile(distFile);
  }
  if (fs.existsSync(publicFile)) {
    return res.sendFile(publicFile);
  }
  next();
});

app.get('/.well-known/assetlinks.json', (_req: Request, res: Response) => {
  setPublicPwaCors(res);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const pkg = process.env.TWA_PACKAGE_NAME || 'com.alamkhan.building.twa';
  const sha = process.env.TWA_SHA256_FINGERPRINT || '';
  if (!sha) {
    return res.json([]);
  }
  return res.json([
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: pkg,
        sha256_cert_fingerprints: [sha],
      },
    },
  ]);
});

// Initialize Vite in Dev or Serve Static in Prod
async function startServer() {
  if (!isProduction) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        hmr: false,
        ws: { server: httpServer },
        watch: null,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(
      express.static(DIST_DIR, {
        maxAge: '7d',
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('index.html') || filePath.endsWith('sw.js')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        },
      })
    );
    app.get('*', (_req: Request, res: Response) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(path.join(DIST_DIR, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
