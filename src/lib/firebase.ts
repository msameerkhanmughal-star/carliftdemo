import { initializeApp } from 'firebase/app';
import { getAuth, browserSessionPersistence, setPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyCqUHzo4ceBolB0mK3A5nhbX8-7stSay5I",
  authDomain: "car-lift-98b84.firebaseapp.com",
  projectId: "car-lift-98b84",
  storageBucket: "car-lift-98b84.firebasestorage.app",
  messagingSenderId: "536354127386",
  appId: "1:536354127386:web:3efd32efb30f184a919ba3"
};

let app: any;
let authInstance: any;
let dbInstance: any;
let storageInstance: any;

try {
  app = initializeApp(firebaseConfig);
  authInstance = getAuth(app);
  dbInstance = getFirestore(app);
  storageInstance = getStorage(app);

  setPersistence(authInstance, browserSessionPersistence).catch((error) => {
    console.warn('Failed to set persistence:', error);
  });
} catch (error) {
  console.error('Firebase initialization failed:', error);
}

export const auth = authInstance;
export const db = dbInstance;
export const storage = storageInstance;

export const ADMIN_EMAILS: string[] = [
  '777carcare@gmail.com',
];

export default app;
