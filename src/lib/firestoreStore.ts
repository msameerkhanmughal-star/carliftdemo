import {
  collection, doc, setDoc, onSnapshot,
  query, orderBy, where, deleteDoc, updateDoc, addDoc,
  serverTimestamp, getDoc
} from 'firebase/firestore';
import { ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from './firebase';
import type { Booking, Notification, RouteData, PaymentInfo, CompanyInfo, DriverInfo } from './store';

// ─── Bookings ───────────────────────────────────────────────────────────────

export async function saveBookingToFirestore(booking: Booking): Promise<void> {
  try {
    await setDoc(doc(db, 'bookings', String(booking.id)), {
      ...booking,
      createdAt: booking.createdAt || new Date().toISOString(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.error('Firestore save booking error:', err);
  }
}

export function subscribeToBookings(callback: (bookings: Booking[]) => void): () => void {
  const q = query(collection(db, 'bookings'), orderBy('createdAt', 'desc'));
  const unsub = onSnapshot(q, (snap) => {
    const bookings: Booking[] = snap.docs.map(d => ({ ...d.data() } as Booking));
    callback(bookings);
  }, (err) => {
    console.error('Firestore bookings subscription error:', err);
  });
  return unsub;
}

export function subscribeToUserBookings(userId: string, callback: (bookings: Booking[]) => void): () => void {
  const q = query(
    collection(db, 'bookings'),
    where('userId', '==', userId)
  );
  const unsub = onSnapshot(q, (snap) => {
    const bookings: Booking[] = snap.docs.map(d => ({ ...d.data() } as Booking));
    bookings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    callback(bookings);
  }, (err) => {
    console.error('Firestore user bookings error:', err);
  });
  return unsub;
}

export async function updateBookingInFirestore(id: number, data: Partial<Booking>): Promise<void> {
  try {
    await updateDoc(doc(db, 'bookings', String(id)), { ...data, updatedAt: serverTimestamp() });
  } catch (err) {
    console.error('Firestore update booking error:', err);
  }
}

export async function deleteBookingFromFirestore(id: number): Promise<void> {
  try {
    await deleteDoc(doc(db, 'bookings', String(id)));
  } catch (err) {
    console.error('Firestore delete booking error:', err);
  }
}

// ─── Admin Notifications ─────────────────────────────────────────────────────

export async function addNotificationToFirestore(message: string, bookingId: number): Promise<void> {
  try {
    const stableId = Date.now();
    await addDoc(collection(db, 'adminNotifications'), {
      id: stableId,
      message,
      bookingId,
      read: false,
      createdAt: new Date().toISOString(),
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    console.error('Firestore add notification error:', err);
  }
}

export function subscribeToNotifications(callback: (notifications: Notification[]) => void): () => void {
  const q = query(collection(db, 'adminNotifications'), orderBy('createdAt', 'desc'));
  const unsub = onSnapshot(q, (snap) => {
    const notifications: Notification[] = snap.docs.map(d => {
      const data = d.data();
      // Use stored numeric id if available; otherwise derive a stable id from the doc ID
      const stableId: number = typeof data.id === 'number' && !isNaN(data.id)
        ? data.id
        : Math.abs(d.id.split('').reduce((h, c) => (Math.imul(31, h) + c.charCodeAt(0)) | 0, 0));
      return {
        ...data,
        id: stableId,
        _docId: d.id,
      } as Notification & { _docId: string };
    });
    callback(notifications);
  }, (err) => {
    console.error('Firestore notifications subscription error:', err);
  });
  return unsub;
}

export async function markNotificationReadInFirestore(docId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'adminNotifications', docId), { read: true });
  } catch (err) {
    console.error('Firestore mark notification read error:', err);
  }
}

// ─── Users ───────────────────────────────────────────────────────────────────

export async function saveUserToFirestore(uid: string, data: {
  name: string; email: string; phone: string; role: 'user' | 'admin';
}): Promise<void> {
  try {
    await setDoc(doc(db, 'users', uid), { ...data, createdAt: new Date().toISOString() });
  } catch (err) {
    console.error('Firestore save user error:', err);
  }
}

export async function getUserRoleFromFirestore(uid: string): Promise<'user' | 'admin'> {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) return snap.data().role || 'user';
    return 'user';
  } catch {
    return 'user';
  }
}

export async function isAdminInFirestore(uid: string): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) return snap.data().role === 'admin';
    return false;
  } catch {
    return false;
  }
}

// ─── Car Images — Firebase Storage ───────────────────────────────────────────

export async function uploadCarImageToStorage(carName: string, base64DataUrl: string): Promise<string> {
  const safeName = carName.replace(/[^a-zA-Z0-9]/g, '_');
  const storageRef = ref(storage, `car-images/${safeName}`);
  await uploadString(storageRef, base64DataUrl, 'data_url');
  const downloadUrl = await getDownloadURL(storageRef);
  return downloadUrl;
}

export async function deleteCarImageFromStorage(carName: string): Promise<void> {
  try {
    const safeName = carName.replace(/[^a-zA-Z0-9]/g, '_');
    const storageRef = ref(storage, `car-images/${safeName}`);
    await deleteObject(storageRef);
  } catch {
    // Ignore if file doesn't exist
  }
}

export async function saveCarImagesToFirestore(images: Record<string, string>): Promise<void> {
  try {
    await setDoc(doc(db, 'settings', 'carImages'), { images, updatedAt: serverTimestamp() });
  } catch (err) {
    console.error('Firestore save car images error:', err);
  }
}

export async function getCarImagesFromFirestore(): Promise<Record<string, string>> {
  try {
    const snap = await getDoc(doc(db, 'settings', 'carImages'));
    if (snap.exists()) return snap.data().images || {};
    return {};
  } catch {
    return {};
  }
}

// ─── Cars List ───────────────────────────────────────────────────────────────

export async function saveCarsListToFirestore(cars: string[]): Promise<void> {
  try {
    await setDoc(doc(db, 'settings', 'carsList'), { cars, updatedAt: serverTimestamp() });
  } catch (err) {
    console.error('Firestore save cars list error:', err);
  }
}

export function subscribeToCarsListFromFirestore(callback: (cars: string[]) => void): () => void {
  const unsub = onSnapshot(doc(db, 'settings', 'carsList'), (snap) => {
    if (snap.exists() && snap.data().cars) callback(snap.data().cars as string[]);
  }, (err) => {
    console.error('Firestore cars list subscription error:', err);
  });
  return unsub;
}

// ─── Locations (Pickups + Dropoffs) ──────────────────────────────────────────

export async function saveLocationsToFirestore(pickups: string[], dropMap: Record<string, string[]>): Promise<void> {
  try {
    await setDoc(doc(db, 'settings', 'locations'), { pickups, dropMap, updatedAt: serverTimestamp() });
  } catch (err) {
    console.error('Firestore save locations error:', err);
  }
}

export function subscribeToLocations(callback: (pickups: string[], dropMap: Record<string, string[]>) => void): () => void {
  const unsub = onSnapshot(doc(db, 'settings', 'locations'), (snap) => {
    if (snap.exists()) {
      callback(snap.data().pickups || [], snap.data().dropMap || {});
    }
  }, (err) => {
    console.error('Firestore locations subscription error:', err);
  });
  return unsub;
}

// ─── Company Info ─────────────────────────────────────────────────────────────

export async function saveCompanyInfoToFirestore(info: CompanyInfo): Promise<void> {
  try {
    await setDoc(doc(db, 'settings', 'companyInfo'), { ...info, updatedAt: serverTimestamp() });
  } catch (err) {
    console.error('Firestore save company info error:', err);
  }
}

export function subscribeToCompanyInfo(callback: (info: CompanyInfo) => void): () => void {
  const unsub = onSnapshot(doc(db, 'settings', 'companyInfo'), (snap) => {
    if (snap.exists()) callback(snap.data() as CompanyInfo);
  }, (err) => {
    console.error('Firestore company info subscription error:', err);
  });
  return unsub;
}

// ─── Routes ──────────────────────────────────────────────────────────────────

export async function saveRoutesToFirestore(routes: RouteData[]): Promise<void> {
  try {
    await setDoc(doc(db, 'settings', 'routes'), { routes, updatedAt: serverTimestamp() });
  } catch (err) {
    console.error('Firestore save routes error:', err);
  }
}

export function subscribeToRoutes(callback: (routes: RouteData[]) => void): () => void {
  const unsub = onSnapshot(doc(db, 'settings', 'routes'), (snap) => {
    if (snap.exists()) callback(snap.data().routes || []);
    else callback([]);
  }, (err) => {
    console.error('Firestore routes subscription error:', err);
  });
  return unsub;
}

// ─── Working Days ────────────────────────────────────────────────────────────

export async function saveWorkingDaysToFirestore(days: number): Promise<void> {
  try {
    await setDoc(doc(db, 'settings', 'fareRate'), { workingDays: days, updatedAt: serverTimestamp() }, { merge: true });
  } catch (err) {
    console.error('Firestore save working days error:', err);
  }
}

export function subscribeToWorkingDays(callback: (days: number) => void): () => void {
  const unsub = onSnapshot(doc(db, 'settings', 'fareRate'), (snap) => {
    if (snap.exists() && snap.data().workingDays) callback(snap.data().workingDays as number);
  }, (err) => {
    console.error('Firestore working days subscription error:', err);
  });
  return unsub;
}

// ─── Fare Per KM ─────────────────────────────────────────────────────────────

export async function saveFarePerKmToFirestore(rate: number): Promise<void> {
  try {
    await setDoc(doc(db, 'settings', 'fareRate'), { farePerKm: rate, updatedAt: serverTimestamp() }, { merge: true });
  } catch (err) {
    console.error('Firestore save fare rate error:', err);
  }
}

export function subscribeToFarePerKm(callback: (rate: number) => void): () => void {
  const unsub = onSnapshot(doc(db, 'settings', 'fareRate'), (snap) => {
    if (snap.exists() && snap.data().farePerKm) callback(snap.data().farePerKm as number);
  }, (err) => {
    console.error('Firestore fare rate subscription error:', err);
  });
  return unsub;
}

// ─── Payment Info ─────────────────────────────────────────────────────────────

export async function savePaymentInfoToFirestore(info: PaymentInfo): Promise<void> {
  try {
    await setDoc(doc(db, 'settings', 'paymentInfo'), { ...info, updatedAt: serverTimestamp() });
  } catch (err) {
    console.error('Firestore save payment info error:', err);
  }
}

export function subscribeToPaymentInfo(callback: (info: PaymentInfo) => void): () => void {
  const unsub = onSnapshot(doc(db, 'settings', 'paymentInfo'), (snap) => {
    if (snap.exists()) callback(snap.data() as PaymentInfo);
  }, (err) => {
    console.error('Firestore payment info subscription error:', err);
  });
  return unsub;
}

// ─── Drivers ─────────────────────────────────────────────────────────────────

export async function uploadDriverImageToStorage(driverName: string, base64DataUrl: string): Promise<string> {
  const safeName = driverName.replace(/[^a-zA-Z0-9]/g, '_');
  const storageRef = ref(storage, `driver-images/${safeName}`);
  await uploadString(storageRef, base64DataUrl, 'data_url');
  return await getDownloadURL(storageRef);
}

export async function deleteDriverImageFromStorage(driverName: string): Promise<void> {
  try {
    const safeName = driverName.replace(/[^a-zA-Z0-9]/g, '_');
    const storageRef = ref(storage, `driver-images/${safeName}`);
    await deleteObject(storageRef);
  } catch {
    // Ignore if file doesn't exist
  }
}

export async function saveDriversListToFirestore(drivers: DriverInfo[]): Promise<void> {
  try {
    await setDoc(doc(db, 'settings', 'driversList'), { drivers, updatedAt: serverTimestamp() });
  } catch (err) {
    console.error('Firestore save drivers list error:', err);
  }
}

export function subscribeToDriversList(callback: (drivers: DriverInfo[]) => void): () => void {
  const unsub = onSnapshot(doc(db, 'settings', 'driversList'), (snap) => {
    if (snap.exists() && snap.data().drivers) callback(snap.data().drivers as DriverInfo[]);
  }, (err) => {
    console.error('Firestore drivers list subscription error:', err);
  });
  return unsub;
}

export async function saveDriverImagesToFirestore(images: Record<string, string>): Promise<void> {
  try {
    await setDoc(doc(db, 'settings', 'driverImages'), { images, updatedAt: serverTimestamp() });
  } catch (err) {
    console.error('Firestore save driver images error:', err);
  }
}

export async function getDriverImagesFromFirestore(): Promise<Record<string, string>> {
  try {
    const snap = await getDoc(doc(db, 'settings', 'driverImages'));
    if (snap.exists()) return snap.data().images || {};
    return {};
  } catch {
    return {};
  }
}

