import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import firebaseConfigFallback from '../../firebase-applet-config.json';
import { getOAuthToken } from 'ais-api/client';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfigFallback.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigFallback.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfigFallback.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfigFallback.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigFallback.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfigFallback.appId,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || firebaseConfigFallback.measurementId
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

export const getAccessToken = async (): Promise<string | null> => {
  try {
    return await getOAuthToken();
  } catch(e) {
    console.error("Failed to get OAuth token", e);
    return null;
  }
};

export const auth = {
  currentUser: {
    displayName: "User",
    email: "user@example.com",
    uid: "mock-user-123"
  }
};

export const logout = async () => {
  window.location.reload();
};
