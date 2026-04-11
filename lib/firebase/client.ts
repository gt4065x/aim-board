import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getAuth, browserLocalPersistence, inMemoryPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const isServer = typeof window === 'undefined';

let app: ReturnType<typeof initializeApp>;
let auth: ReturnType<typeof getAuth>;

if (!getApps().length) {
  app = initializeApp(firebaseConfig);
  // SSR 환경에서 localStorage 접근 방지: in-memory persistence 사용
  auth = initializeAuth(app, {
    persistence: isServer ? inMemoryPersistence : browserLocalPersistence
  });
} else {
  app = getApp();
  auth = getAuth(app);
}

const db = getFirestore(app);
const rtdb = getDatabase(app);
const storage = getStorage(app);

export { app, auth, db, rtdb, storage };
