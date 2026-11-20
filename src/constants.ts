import { Room, BuildingSettings, AppDatabase } from './types';

export const STORAGE_KEY = 'house35_joint_meter_hridoy_v1';
export const APP_NAME = 'আলম খান';
export const APP_LOGO = '/assets/aistudio/Gemini_Generated_Image_dh5p3odh5p3odh5p_10534da2.jpeg';
export const SUPPORT_PHONES = ['01939022271', '09638194963'];
export const SUPPORT_PHONES_DISPLAY = '01939022271/09638194963';
export const HRIDOY_HELP_MESSAGE =
  'হ্যালো আমি হৃদয় আমি আপনাকে সাহায্য করতে পারি আপনি আপনার রুমের সকল তথ্য খুব সহজেই আমার কাছ থেকে জানতে পারবেন';

// Convert Bengali digits to ASCII English digits
export function toEnDigits(value: string | number): string {
  const bnMap: Record<string, string> = {
    '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
    '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9',
  };
  return String(value).replace(/[০-৯]/g, (d) => bnMap[d] ?? d);
}

// Build 100% functional WhatsApp link (normalizes BD numbers like 01XXXXXXXXX -> 8801XXXXXXXXX)
export function normalizePhoneForWhatsApp(phone?: string): string {
  if (!phone) return '';
  const digits = toEnDigits(phone).replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (digits.startsWith('880') && digits.length >= 13) return digits;
  if (digits.startsWith('01') && digits.length === 11) return `88${digits}`;
  if (digits.startsWith('1') && digits.length === 10) return `880${digits}`;
  return digits.length >= 10 ? digits : '';
}

export function buildWhatsAppUrl(phone: string | undefined, message: string): string {
  const cleanPhone = normalizePhoneForWhatsApp(phone);
  const encodedText = encodeURIComponent(message);
  if (cleanPhone) {
    return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
  }
  return `https://api.whatsapp.com/send?text=${encodedText}`;
}

// 35 Rooms Floor Mapping
// ২য় তলা: ১, ২, ৩, ৪, ৫, ৩৪, ৩৫
// ৩য় তলা: ৬, ৭, ৮
// ৪র্থ তলা: ৯ থেকে ১৬
// ৫ম তলা: ১৭ থেকে ২৪
// ৬ষ্ঠ তলা: ২৫ থেকে ৩২
// ৭ম তলা: ৩৩
export const ROOM_FLOOR_MAP: Record<number, number> = {
  1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 34: 2, 35: 2,
  6: 3, 7: 3, 8: 3,
  9: 4, 10: 4, 11: 4, 12: 4, 13: 4, 14: 4, 15: 4, 16: 4,
  17: 5, 18: 5, 19: 5, 20: 5, 21: 5, 22: 5, 23: 5, 24: 5,
  25: 6, 26: 6, 27: 6, 28: 6, 29: 6, 30: 6, 31: 6, 32: 6,
  33: 7,
};

export const FLOORS_LIST = [2, 3, 4, 5, 6, 7];

export const FLOOR_NAMES_BN: Record<number, string> = {
  2: '২য় তলা',
  3: '৩য় তলা',
  4: '৪র্থ তলা',
  5: '৫ম তলা',
  6: '৬ষ্ঠ তলা',
  7: '৭ম তলা',
};

export interface RoomUnitGroup {
  id: string;
  label: string;
  shortLabel: string;
  type: 'unit' | 'single';
  rooms: number[];
  floor: number;
}

export const ROOM_UNIT_GROUPS: RoomUnitGroup[] = [
  // সিঙ্গেল রুমসমূহ (১, ২, ৩, ৪, ৫, ৬, ৭, ৮, ৩৩)
  { id: 'single-1', label: '১ সিঙ্গেল', shortLabel: 'সিঙ্গেল', type: 'single', rooms: [1], floor: 2 },
  { id: 'single-2', label: '২ সিঙ্গেল', shortLabel: 'সিঙ্গেল', type: 'single', rooms: [2], floor: 2 },
  { id: 'single-3', label: '৩ সিঙ্গেল', shortLabel: 'সিঙ্গেল', type: 'single', rooms: [3], floor: 2 },
  { id: 'single-4', label: '৪ সিঙ্গেল', shortLabel: 'সিঙ্গেল', type: 'single', rooms: [4], floor: 2 },
  { id: 'single-5', label: '৫ সিঙ্গেল', shortLabel: 'সিঙ্গেল', type: 'single', rooms: [5], floor: 2 },
  { id: 'single-6', label: '৬ সিঙ্গেল', shortLabel: 'সিঙ্গেল', type: 'single', rooms: [6], floor: 3 },
  { id: 'single-7', label: '৭ সিঙ্গেল', shortLabel: 'সিঙ্গেল', type: 'single', rooms: [7], floor: 3 },
  { id: 'single-8', label: '৮ সিঙ্গেল', shortLabel: 'সিঙ্গেল', type: 'single', rooms: [8], floor: 3 },
  { id: 'single-33', label: '৩৩ সিঙ্গেল', shortLabel: 'সিঙ্গেল', type: 'single', rooms: [33], floor: 7 },
  // ইউনিট / জোড়া রুমসমূহ (৯–১০ থেকে ৩১–৩২)
  { id: 'unit-9-10', label: '৯–১০ ইউনিট/জোড়া', shortLabel: 'জোড়া ৯–১০', type: 'unit', rooms: [9, 10], floor: 4 },
  { id: 'unit-11-12', label: '১১–১২ ইউনিট/জোড়া', shortLabel: 'জোড়া ১১–১২', type: 'unit', rooms: [11, 12], floor: 4 },
  { id: 'unit-13-14', label: '১৩–১৪ ইউনিট/জোড়া', shortLabel: 'জোড়া ১৩–১৪', type: 'unit', rooms: [13, 14], floor: 4 },
  { id: 'unit-15-16', label: '১৫–১৬ ইউনিট/জোড়া', shortLabel: 'জোড়া ১৫–১৬', type: 'unit', rooms: [15, 16], floor: 4 },
  { id: 'unit-17-18', label: '১৭–১৮ ইউনিট/জোড়া', shortLabel: 'জোড়া ১৭–১৮', type: 'unit', rooms: [17, 18], floor: 5 },
  { id: 'unit-19-20', label: '১৯–২০ ইউনিট/জোড়া', shortLabel: 'জোড়া ১৯–২০', type: 'unit', rooms: [19, 20], floor: 5 },
  { id: 'unit-21-22', label: '২১–২২ ইউনিট/জোড়া', shortLabel: 'জোড়া ২১–২২', type: 'unit', rooms: [21, 22], floor: 5 },
  { id: 'unit-23-24', label: '২৩–২৪ ইউনিট/জোড়া', shortLabel: 'জোড়া ২৩–২৪', type: 'unit', rooms: [23, 24], floor: 5 },
  { id: 'unit-25-26', label: '২৫–২৬ ইউনিট/জোড়া', shortLabel: 'জোড়া ২৫–২৬', type: 'unit', rooms: [25, 26], floor: 6 },
  { id: 'unit-27-28', label: '২৭–২৮ ইউনিট/জোড়া', shortLabel: 'জোড়া ২৭–২৮', type: 'unit', rooms: [27, 28], floor: 6 },
  { id: 'unit-29-30', label: '২৯–৩০ ইউনিট/জোড়া', shortLabel: 'জোড়া ২৯–৩০', type: 'unit', rooms: [29, 30], floor: 6 },
  { id: 'unit-31-32', label: '৩১–৩২ ইউনিট/জোড়া', shortLabel: 'জোড়া ৩১–৩২', type: 'unit', rooms: [31, 32], floor: 6 },
];

export function getRoomUnitGroup(roomNo: number): RoomUnitGroup | undefined {
  return ROOM_UNIT_GROUPS.find((g) => g.rooms.includes(roomNo));
}

export interface JointGroupMeta {
  index: number;
  label: string;
  category: 'dining' | 'joint';
  rooms: number[];
  floor: number;
}

export const JOINT_GROUPS: JointGroupMeta[] = [
  { index: 14, label: 'ডাইনিং সাব-মিটার (রুম ১–২)', category: 'dining', rooms: [1, 2], floor: 2 },
  { index: 15, label: 'ডাইনিং সাব-মিটার (রুম ৩–৪–৫)', category: 'dining', rooms: [3, 4, 5], floor: 2 },
  { index: 16, label: 'ডাইনিং সাব-মিটার (রুম ৬–৭)', category: 'dining', rooms: [6, 7], floor: 3 },
  { index: 13, label: 'ডাইনিং সাব-মিটার (রুম ৩৪–৩৫)', category: 'dining', rooms: [34, 35], floor: 2 },
  { index: 1, label: 'ডাইনিং সাব-মিটার (৯–১০ ইউনিট/জোড়া)', category: 'dining', rooms: [9, 10], floor: 4 },
  { index: 2, label: 'ডাইনিং সাব-মিটার (১১–১২ ইউনিট/জোড়া)', category: 'dining', rooms: [11, 12], floor: 4 },
  { index: 3, label: 'ডাইনিং সাব-মিটার (১৩–১৪ ইউনিট/জোড়া)', category: 'dining', rooms: [13, 14], floor: 4 },
  { index: 4, label: 'ডাইনিং সাব-মিটার (১৫–১৬ ইউনিট/জোড়া)', category: 'dining', rooms: [15, 16], floor: 4 },
  { index: 5, label: 'ডাইনিং সাব-মিটার (১৭–১৮ ইউনিট/জোড়া)', category: 'dining', rooms: [17, 18], floor: 5 },
  { index: 6, label: 'ডাইনিং সাব-মিটার (১৯–২০ ইউনিট/জোড়া)', category: 'dining', rooms: [19, 20], floor: 5 },
  { index: 7, label: 'ডাইনিং সাব-মিটার (২১–২২ ইউনিট/জোড়া)', category: 'dining', rooms: [21, 22], floor: 5 },
  { index: 8, label: 'ডাইনিং সাব-মিটার (২৩–২৪ ইউনিট/জোড়া)', category: 'dining', rooms: [23, 24], floor: 5 },
  { index: 9, label: 'ডাইনিং সাব-মিটার (২৫–২৬ ইউনিট/জোড়া)', category: 'dining', rooms: [25, 26], floor: 6 },
  { index: 10, label: 'ডাইনিং সাব-মিটার (২৭–২৮ ইউনিট/জোড়া)', category: 'dining', rooms: [27, 28], floor: 6 },
  { index: 11, label: 'ডাইনিং সাব-মিটার (২৯–৩০ ইউনিট/জোড়া)', category: 'dining', rooms: [29, 30], floor: 6 },
  { index: 12, label: 'ডাইনিং সাব-মিটার (৩১–৩২ ইউনিট/জোড়া)', category: 'dining', rooms: [31, 32], floor: 6 },
];

export const DEFAULT_SETTINGS: BuildingSettings = {
  buildingName: 'আলম খান বিল্ডিং',
  buildingAddress: 'ঢাকা, বাংলাদেশ',
  landlordName: 'হৃদয়',
  landlordTitle: 'কর্তৃপক্ষ',
  landlordPhone: '01939022271 / 09638194963',
  defaultUnitRate: 12,
  useBengaliDigits: true,
};

// Helper: Convert English digits to Bengali numerals
export function toBnDigits(value: string | number): string {
  const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(value).replace(/[0-9]/g, (d) => bnDigits[parseInt(d, 10)]);
}

// Format numbers according to preference
export function formatNum(val: number | string, useBn: boolean = true): string {
  const numStr = Number(val || 0).toLocaleString('en-US');
  return useBn ? toBnDigits(numStr) : numStr;
}

// Format Currency
export function formatCurrency(amount: number, useBn: boolean = true): string {
  const formatted = Math.round(amount || 0).toLocaleString('en-US');
  const str = `৳${formatted}`;
  return useBn ? toBnDigits(str) : str;
}

// Format Month YYYY-MM to Bengali string (e.g. 2026-11 -> নভেম্বর ২০২৬)
const MONTHS_BN = [
  'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
  'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
];

export function formatMonthName(monthStr: string, useBn: boolean = true): string {
  if (!monthStr || !monthStr.includes('-')) return monthStr;
  const [year, month] = monthStr.split('-');
  const monthIdx = parseInt(month, 10) - 1;
  const mName = MONTHS_BN[monthIdx] || month;
  return `${mName} ${useBn ? toBnDigits(year) : year}`;
}

// Convert amount in Taka to Bengali Words
export function amountInBengaliWords(num: number): string {
  const ones = ['', 'এক', 'দুই', 'তিন', 'চার', 'পাঁচ', 'ছয়', 'সাত', 'আট', 'নয়', 'দশ',
    'এগারো', 'বারো', 'তেরো', 'চৌদ্দ', 'পনেরো', 'ষোল', 'সতেরো', 'আঠারো', 'উনিশ'];
  const tens = ['', '', 'বিশ', 'ত্রিশ', 'চল্লিশ', 'পঞ্চাশ', 'ষাট', 'সত্তর', 'আশি', 'নব্বই'];

  const n = Math.floor(Math.abs(num));
  if (n === 0) return 'শূন্য টাকা মাত্র';
  
  // Simple converter up to 99,99,999
  function convertBelowHundred(val: number): string {
    if (val < 20) return ones[val];
    const t = Math.floor(val / 10);
    const o = val % 10;
    return `${tens[t]} ${ones[o]}`.trim();
  }

  let words = '';
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const hundred = Math.floor((n % 1000) / 100);
  const rest = n % 100;

  if (crore > 0) words += `${convertBelowHundred(crore)} কোটি `;
  if (lakh > 0) words += `${convertBelowHundred(lakh)} লাখ `;
  if (thousand > 0) words += `${convertBelowHundred(thousand)} হাজার `;
  if (hundred > 0) words += `${ones[hundred]} শত `;
  if (rest > 0) words += `${convertBelowHundred(rest)} `;

  return `${words.trim()} টাকা মাত্র`;
}

// Generate complete 35-room initial data (all pre-mapped with realistic default rents)
export function getInitial35Rooms(): Room[] {
  const sampleNames = [
    'মোঃ রফিকুল ইসলাম', 'মোছাঃ নাজমিন বেগম', 'তানভীর আহমেদ', 'মোঃ ফারুক হোসেন',
    'মাহমুদুর রহমান', 'আব্দুল করিম', 'নাজিম উদ্দিন', 'মোঃ সাইদুল হক',
    'মোঃ জাহাঙ্গীর আলম', 'আফরোজা খাতুন', 'মোঃ আনোয়ার হোসেন', 'সোহেল রানা',
    'মোঃ মিজানুর রহমান', 'মুশফিকুর রহিম', 'মোঃ কামরুল হাসান', 'রেহানা পারভীন',
    'মোস্তফা কামাল', 'মোঃ শাহাদাত হোসেন', 'আসমা আক্তার', 'মোঃ শফিকুল ইসলাম',
    'জয়নাল আবেদীন', 'মোছাঃ সাবিনা ইয়াসমিন', 'মোঃ হারুনুর রশিদ', 'রাশেদুল হাসান',
    'মোঃ আলাউদ্দিন', 'নুরুন্নাহার বেগম', 'মোঃ জহিরুল ইসলাম', 'তারেক মাহমুদ',
    'মোঃ মোজাম্মেল হক', 'সালমা বেগম', 'মোঃ ইমরান হোসেন', 'ফরিদুল আলম',
    'মোঃ রিয়াজ উদ্দিন', 'মোঃ আবুল হোসেন', 'মোঃ আব্দুল্লাহ আল মামুন'
  ];

  const rooms: Room[] = [];
  for (let i = 1; i <= 35; i++) {
    const floor = ROOM_FLOOR_MAP[i] || 2;
    // Rents differ slightly by floor/room size (e.g. 4500 to 7500 Tk)
    let rent = 5000;
    if (floor === 2) rent = (i === 1 || i === 2) ? 6500 : 5500;
    else if (floor === 3) rent = 6000;
    else if (floor === 4) rent = 5500;
    else if (floor === 5) rent = 5000;
    else if (floor === 6) rent = 4800;
    else if (floor === 7) rent = 7000;

    rooms.push({
      id: `room-${i}`,
      no: i,
      floor,
      name: sampleNames[i - 1] || `ভাড়াটিয়া (রুম ${i})`,
      phone: `017${String(10000000 + i * 23145).slice(0, 8)}`,
      rent,
      rate: 12,
      isOccupied: true,
      notes: '',
    });
  }
  return rooms;
}

// Generate realistic initial joint meters & sample bills for the last 6 months
export function getInitialDemoDatabase(): AppDatabase {
  const rooms = getInitial35Rooms();
  
  // Generate the last 6 months list (from 5 months ago to current)
  const nowObj = new Date();
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(nowObj.getFullYear(), nowObj.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const currentMonth = months[months.length - 1];
  const shared: AppDatabase['shared'] = [];
  const bills: AppDatabase['bills'] = [];

  // Generate joint meter and room bills for each of the 6 months
  months.forEach((mStr, mIdx) => {
    // 1. Joint meters for month
    JOINT_GROUPS.forEach((jg, idx) => {
      const prev = 1000 + mIdx * 120 + idx * 75;
      const units = 40 + ((idx + mIdx) % 5) * 8; // 40-75 units
      const now = prev + units;
      const rate = 12;
      const amount = units * rate;
      const perRoomShare = Math.round((amount / jg.rooms.length) * 100) / 100;
      shared.push({
        id: `shared-${mStr}-${idx}`,
        groupIndex: jg.index,
        groupName: jg.label,
        rooms: jg.rooms,
        month: mStr,
        prev,
        now,
        units,
        rate,
        amount,
        perRoomShare,
        createdAt: new Date().toISOString(),
      });
    });

    // 2. Room bills for this month
    // In past months: higher payment rate; in current month: some pending/due
    const roomCountToBill = mIdx === 5 ? 24 : 35; // past months fully billed, current month 24 billed
    rooms.slice(0, roomCountToBill).forEach((r, i) => {
      const prev = 300 + mIdx * 50 + i * 35;
      const units = 28 + ((i + mIdx) % 7) * 4; // 28-52 units
      const now = prev + units;
      const rate = r.rate;
      const electricityCost = units * rate;

      // Find shared electricity for this room in this month
      const roomShared = shared.filter(s => s.month === mStr && s.rooms.includes(r.no));
      const sharedTotal = roomShared.reduce((acc, s) => acc + s.perRoomShare, 0);

      const other = (i + mIdx) % 3 === 0 ? 150 : 0;
      const note = other > 0 ? 'পানির বিল / পরিচ্ছন্নতা' : '';
      const total = r.rent + electricityCost + sharedTotal + other;

      let paid = total;
      if (mIdx === 5) {
        // Current month: some dues
        if (i === 1 || i === 4 || i === 12) paid = total - 1500;
        else if (i === 2 || i === 7 || i === 18) paid = 0;
      } else if (mIdx === 4) {
        // Last month: 1 partial
        if (i === 5) paid = total - 800;
      }

      const due = Math.max(0, total - paid);

      bills.push({
        id: `bill-${mStr}-${r.id}`,
        roomId: r.id,
        roomNo: r.no,
        floor: r.floor,
        tenantName: r.name,
        tenantPhone: r.phone,
        month: mStr,
        prev,
        now,
        units,
        rate,
        electricityCost,
        rent: r.rent,
        sharedElectricity: sharedTotal,
        other,
        note,
        total,
        paid,
        due,
        paymentMethod: paid > 0 ? (i % 2 === 0 ? 'Cash' : 'bKash') : undefined,
        createdAt: new Date().toISOString(),
      });
    });
  });

  return {
    rooms,
    shared,
    bills,
    settings: DEFAULT_SETTINGS,
  };
}

// Clean 35-room setup ready for fresh input with 0 balances
export function getFresh35Rooms(): Room[] {
  const rooms: Room[] = [];
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
  return rooms;
}

// Clean fresh database with 0 balances for all 35 rooms
export function getFreshEmptyDatabase(): AppDatabase {
  return {
    rooms: getFresh35Rooms(),
    shared: [],
    bills: [],
    settings: DEFAULT_SETTINGS,
  };
}

