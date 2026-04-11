// Car Lift shared data store using localStorage

export interface Booking {
  id: number;
  userId: string;
  name: string;
  whatsapp: string;
  pickup: string;
  dropoff: string;
  timing: string;
  class: string;
  startDate: string;
  payment: string;
  fare: string;
  status: 'pending' | 'approved';
  assignedCar: string;
  assignedDriver?: string;
  createdAt: string;
}

export interface DriverInfo {
  id: string;
  name: string;
  phone: string;
}

export interface Notification {
  id: number;
  message: string;
  bookingId: number;
  read: boolean;
  createdAt: string;
}

export interface User {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: 'user' | 'admin';
}

export interface CarImage {
  carName: string;
  imageUrl: string;
}

export interface RouteData {
  id: string;
  title: string;
  timings: string[];
  morningSlots?: string[];
  eveningSlots?: string[];
}

export interface PaymentMethodInfo {
  accName: string;
  accNumber: string;
}

export interface PaymentInfo {
  easypaisa: PaymentMethodInfo;
  jazzcash: PaymentMethodInfo;
  bankTransfer: PaymentMethodInfo;
}

export interface CompanyInfo {
  name: string;
  tagline: string;
  phone: string;
  email: string;
  address: string;
  address2: string;
}

export const DEFAULT_COMPANY_INFO: CompanyInfo = {
  name: 'Car Lift',
  tagline: 'Premium Monthly Car Service',
  phone: '03089926777',
  email: '777carcare@gmail.com',
  address: 'Plot 1/2, 9/7B North Nazimabad Block R, Karachi',
  address2: 'Workshop: Gulistan-e-Johar, near Kamran Chowrangi',
};

export const CARS_LIST = [
  "Suzuki Alto 2019 Silver BSB 179",
  "Suzuki Alto 2020 White BVG 830",
  "Suzuki Alto 2022 White BVF 238",
  "Suzuki Alto 2024 Grey CCD 522",
  "Suzuki Alto 2025 White CCK 873",
  "Suzuki Alto 2026 White CCK 874",
  "Suzuki Alto 2024 Grey BXQ 818",
  "Suzuki Alto 2022 White BXU 220",
  "Suzuki Every White 2025 SA 9775",
];

export const DEFAULT_PICKUPS = ["Gulistan-e-Johar", "PECHS", "DHA / Clifton", "Gulshan-e-Iqbal"];

export const DEFAULT_DROPOFF_MAP: Record<string, string[]> = {
  "Gulistan-e-Johar": ["PECHS"],
  "PECHS": ["DHA / Clifton"],
  "DHA / Clifton": ["PECHS"],
  "Gulshan-e-Iqbal": ["PECHS", "I.I. Chundrigar", "DHA / Clifton"],
};

export const ROUTE_TIMINGS: Record<string, string[]> = {
  "Gulistan-e-Johar→PECHS": ["7:30 AM – 1:45 PM"],
  "PECHS→DHA / Clifton": ["7:30 AM – 1:45 PM"],
  "DHA / Clifton→PECHS": ["7:30 AM – 1:45 PM", "10:00 AM – 6:00 PM"],
  "Gulshan-e-Iqbal→PECHS": ["7:30 AM – 1:45 PM"],
  "Gulshan-e-Iqbal→I.I. Chundrigar": ["10:00 AM – 6:00 PM"],
  "Gulshan-e-Iqbal→DHA / Clifton": ["8:30 AM – 4:30 PM", "10:00 AM – 6:00 PM"],
};

export const DISTANCE_DB: Record<string, number> = {
  "Gulistan-e-Johar-PECHS": 18.2,
  "PECHS-DHA / Clifton": 9.1,
  "DHA / Clifton-PECHS": 9.1,
  "Gulshan-e-Iqbal-PECHS": 10.5,
  "Gulshan-e-Iqbal-I.I. Chundrigar": 12.8,
  "Gulshan-e-Iqbal-DHA / Clifton": 15.6,
};

export const LOCATION_COORDS: Record<string, { lat: number; lng: number }> = {
  "Gulistan-e-Johar":   { lat: 24.9195, lng: 67.1300 },
  "PECHS":              { lat: 24.8697, lng: 67.0617 },
  "DHA / Clifton":      { lat: 24.8139, lng: 67.0363 },
  "Gulshan-e-Iqbal":    { lat: 24.9222, lng: 67.0939 },
  "I.I. Chundrigar":    { lat: 24.8627, lng: 67.0099 },
  "I.I. Chundrigar Road": { lat: 24.8627, lng: 67.0099 },
  "North Karachi":      { lat: 24.9746, lng: 67.0600 },
  "Shahr-e-Faisal":     { lat: 24.8540, lng: 67.0850 },
  "Nazimabad":          { lat: 24.9108, lng: 67.0308 },
  "North Nazimabad":    { lat: 24.9329, lng: 67.0400 },
  "NIPA":               { lat: 24.9166, lng: 67.0933 },
  "Saffora":            { lat: 24.9627, lng: 67.1500 },
  "Scheme 33":          { lat: 24.9540, lng: 67.1400 },
};

export async function getDistanceFromOSRM(pickup: string, dropoff: string): Promise<number | null> {
  const from = LOCATION_COORDS[pickup];
  const to = LOCATION_COORDS[dropoff];
  if (!from || !to) return DISTANCE_DB[`${pickup}-${dropoff}`] || null;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error('OSRM fetch failed');
    const data = await res.json();
    if (data.code === 'Ok' && data.routes?.[0]) {
      return Math.round((data.routes[0].distance / 1000) * 10) / 10;
    }
    return DISTANCE_DB[`${pickup}-${dropoff}`] || null;
  } catch {
    clearTimeout(timeoutId);
    return DISTANCE_DB[`${pickup}-${dropoff}`] || null;
  }
}

export const ROUTES_DATA: RouteData[] = [
  {
    id: "r1", title: "Gulistan-e-Johar → PECHS",
    timings: ["7:30 AM – 1:45 PM"],
    morningSlots: ["07:30 AM"], eveningSlots: ["01:45 PM"],
  },
  {
    id: "r2", title: "PECHS → DHA / Clifton",
    timings: ["7:30 AM – 1:45 PM"],
    morningSlots: ["07:30 AM"], eveningSlots: ["01:45 PM"],
  },
  {
    id: "r3", title: "DHA / Clifton → PECHS",
    timings: ["7:30 AM – 1:45 PM"],
    morningSlots: ["07:30 AM"], eveningSlots: ["01:45 PM"],
  },
  {
    id: "r4", title: "Gulshan-e-Iqbal → PECHS",
    timings: ["7:30 AM – 1:45 PM"],
    morningSlots: ["07:30 AM"], eveningSlots: ["01:45 PM"],
  },
  {
    id: "r5", title: "Gulshan-e-Iqbal → I.I. Chundrigar",
    timings: ["10:00 AM – 6:00 PM", "11:00 AM – 7:00 PM", "12:00 PM – 8:00 PM"],
    morningSlots: ["10:00 AM", "11:00 AM", "12:00 PM"], eveningSlots: ["06:00 PM", "07:00 PM", "08:00 PM"],
  },
  {
    id: "r6", title: "DHA / Clifton → PECHS",
    timings: ["10:00 AM – 6:00 PM", "11:00 AM – 7:00 PM", "12:00 PM – 8:00 PM"],
    morningSlots: ["10:00 AM", "11:00 AM", "12:00 PM"], eveningSlots: ["06:00 PM", "07:00 PM", "08:00 PM"],
  },
  {
    id: "r7", title: "DHA / Clifton → I.I. Chundrigar",
    timings: ["10:00 AM – 6:00 PM", "11:00 AM – 7:00 PM", "12:00 PM – 8:00 PM"],
    morningSlots: ["10:00 AM", "11:00 AM", "12:00 PM"], eveningSlots: ["06:00 PM", "07:00 PM", "08:00 PM"],
  },
  {
    id: "r8", title: "Gulshan-e-Iqbal → DHA / Clifton",
    timings: ["8:30 AM – 4:30 PM", "10:00 AM – 6:00 PM", "11:00 AM – 7:00 PM", "12:00 PM – 8:00 PM"],
    morningSlots: ["08:30 AM", "10:00 AM", "11:00 AM", "12:00 PM"],
    eveningSlots: ["04:30 PM", "06:00 PM", "07:00 PM", "08:00 PM"],
  },
  {
    id: "r9", title: "North Karachi → DHA / Clifton",
    timings: ["8:00 AM – 4:00 PM", "9:00 AM – 5:00 PM", "10:00 AM – 6:00 PM", "11:00 AM – 7:00 PM"],
    morningSlots: ["08:00 AM", "09:00 AM", "10:00 AM", "11:00 AM"],
    eveningSlots: ["04:00 PM", "05:00 PM", "06:00 PM", "07:00 PM"],
  },
  {
    id: "r10", title: "DHA / Clifton → Shahr-e-Faisal",
    timings: ["8:00 AM – 4:00 PM", "9:00 AM – 5:00 PM", "10:00 AM – 6:00 PM", "11:00 AM – 7:00 PM"],
    morningSlots: ["08:00 AM", "09:00 AM", "10:00 AM", "11:00 AM"],
    eveningSlots: ["04:00 PM", "05:00 PM", "06:00 PM", "07:00 PM", "08:00 PM"],
  },
  {
    id: "r11", title: "Nazimabad → DHA / Clifton",
    timings: ["8:00 AM – 4:00 PM", "9:00 AM – 5:00 PM", "10:00 AM – 6:00 PM", "11:00 AM – 7:00 PM"],
    morningSlots: ["08:00 AM", "09:00 AM", "10:00 AM", "11:00 AM"],
    eveningSlots: ["04:00 PM", "05:00 PM", "06:00 PM", "07:00 PM", "08:00 PM"],
  },
  {
    id: "r12", title: "North Nazimabad → DHA / Clifton",
    timings: ["8:00 AM – 4:00 PM", "9:00 AM – 5:00 PM", "10:00 AM – 6:00 PM", "11:00 AM – 7:00 PM"],
    morningSlots: ["08:00 AM", "09:00 AM", "10:00 AM", "11:00 AM"],
    eveningSlots: ["05:00 PM", "06:00 PM", "07:00 PM", "08:00 PM"],
  },
  {
    id: "r13", title: "NIPA → I.I. Chundrigar Road",
    timings: ["9:00 AM – 6:00 PM", "10:00 AM – 7:00 PM", "11:00 AM – 7:00 PM"],
    morningSlots: ["09:00 AM", "10:00 AM", "11:00 AM"],
    eveningSlots: ["06:00 PM", "07:00 PM"],
  },
  {
    id: "r14", title: "Saffora → DHA / Clifton",
    timings: ["8:00 AM – 4:00 PM", "9:00 AM – 5:00 PM", "10:00 AM – 6:00 PM", "11:00 AM – 7:00 PM"],
    morningSlots: ["08:00 AM", "09:00 AM", "10:00 AM", "11:00 AM"],
    eveningSlots: ["04:00 PM", "05:00 PM", "06:00 PM", "07:00 PM"],
  },
  {
    id: "r15", title: "Scheme 33 → DHA / Clifton",
    timings: ["8:00 AM – 4:00 PM", "9:00 AM – 5:00 PM", "10:00 AM – 6:00 PM", "11:00 AM – 7:00 PM"],
    morningSlots: ["08:00 AM", "09:00 AM", "10:00 AM", "11:00 AM"],
    eveningSlots: ["05:00 PM", "06:00 PM", "07:00 PM", "08:00 PM"],
  },
];

export const DEFAULT_FARE_PER_KM = 59;
export const DEFAULT_WORKING_DAYS = 22;
const SRB_TAX = 0.11;

export type WeekendOption = 'none' | 'saturday' | 'both';

export function weekendExtraDays(option: WeekendOption): number {
  if (option === 'saturday') return 4;
  if (option === 'both') return 8;
  return 0;
}

export function calculateFare(
  pickup: string,
  dropoff: string,
  farePerKm?: number,
  distanceKm?: number,
  totalDays?: number
) {
  if (!pickup || !dropoff) return null;
  const km = distanceKm ?? DISTANCE_DB[`${pickup}-${dropoff}`] ?? 12;
  const rate = farePerKm ?? DEFAULT_FARE_PER_KM;
  const days = totalDays ?? DEFAULT_WORKING_DAYS;
  const base = km * rate * days;
  const tax = base * SRB_TAX;
  const total = Math.round(base + tax);
  return { km, total, days, base: Math.round(base), tax: Math.round(tax) };
}

export function getFarePerKmLocal(): number {
  const stored = localStorage.getItem('carlift_fare_per_km');
  return stored ? parseFloat(stored) : DEFAULT_FARE_PER_KM;
}

export function saveFarePerKmLocal(rate: number) {
  localStorage.setItem('carlift_fare_per_km', String(rate));
}

export function getWorkingDaysLocal(): number {
  const stored = localStorage.getItem('carlift_working_days');
  return stored ? parseInt(stored, 10) : DEFAULT_WORKING_DAYS;
}

export function saveWorkingDaysLocal(days: number) {
  localStorage.setItem('carlift_working_days', String(days));
}

export function parseFareAmount(fare: string): number {
  const match = fare.match(/Rs\s*([\d,]+)/);
  if (match) return parseInt(match[1].replace(/,/g, ''), 10);
  const firstNum = fare.match(/[\d,]+/);
  if (firstNum) return parseInt(firstNum[0].replace(/,/g, ''), 10);
  return 0;
}

export function getBookings(): Booking[] {
  return JSON.parse(localStorage.getItem('carLiftBookings') || '[]');
}

export function saveBookings(bookings: Booking[]) {
  localStorage.setItem('carLiftBookings', JSON.stringify(bookings));
}

export function getUsers(): User[] {
  return JSON.parse(localStorage.getItem('carLiftUsers') || '[]');
}

export function saveUsers(users: User[]) {
  localStorage.setItem('carLiftUsers', JSON.stringify(users));
}

export function getCurrentUser(): User | null {
  return JSON.parse(localStorage.getItem('carLiftCurrentUser') || 'null');
}

export function setCurrentUser(user: User | null) {
  localStorage.setItem('carLiftCurrentUser', JSON.stringify(user));
}

export function getPickupLocations(): string[] {
  const stored = localStorage.getItem('carlift_pickups');
  if (stored) return JSON.parse(stored);
  localStorage.setItem('carlift_pickups', JSON.stringify(DEFAULT_PICKUPS));
  return [...DEFAULT_PICKUPS];
}

export function getDropoffMapping(): Record<string, string[]> {
  const stored = localStorage.getItem('carlift_dropmap');
  if (stored) return JSON.parse(stored);
  localStorage.setItem('carlift_dropmap', JSON.stringify(DEFAULT_DROPOFF_MAP));
  return { ...DEFAULT_DROPOFF_MAP };
}

export function savePickupLocations(pickups: string[]) {
  localStorage.setItem('carlift_pickups', JSON.stringify(pickups));
}

export function saveDropoffMapping(mapping: Record<string, string[]>) {
  localStorage.setItem('carlift_dropmap', JSON.stringify(mapping));
}

export function getCarImages(): Record<string, string> {
  return JSON.parse(localStorage.getItem('carlift_car_images') || '{}');
}

export function saveCarImages(images: Record<string, string>) {
  localStorage.setItem('carlift_car_images', JSON.stringify(images));
}

export function getCompanyInfoLocal(): CompanyInfo {
  const stored = localStorage.getItem('carlift_company_info');
  if (stored) return JSON.parse(stored);
  return { ...DEFAULT_COMPANY_INFO };
}

export function saveCompanyInfoLocal(info: CompanyInfo) {
  localStorage.setItem('carlift_company_info', JSON.stringify(info));
}

export function getNotifications(): Notification[] {
  return JSON.parse(localStorage.getItem('carLiftNotifications') || '[]');
}

export function saveNotifications(notifications: Notification[]) {
  localStorage.setItem('carLiftNotifications', JSON.stringify(notifications));
}

export function addNotification(message: string, bookingId: number) {
  const notifications = getNotifications();
  notifications.unshift({
    id: Date.now(),
    message,
    bookingId,
    read: false,
    createdAt: new Date().toISOString(),
  });
  saveNotifications(notifications);
}

export function markNotificationRead(id: number) {
  const notifications = getNotifications();
  const updated = notifications.map(n => n.id === id ? { ...n, read: true } : n);
  saveNotifications(updated);
}

export function markAllNotificationsRead() {
  const notifications = getNotifications();
  const updated = notifications.map(n => ({ ...n, read: true }));
  saveNotifications(updated);
}

export function getDaysUntilDeadline(startDate: string): number | null {
  try {
    const parsed = new Date(startDate);
    if (isNaN(parsed.getTime())) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    parsed.setHours(0, 0, 0, 0);
    return Math.ceil((parsed.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}
