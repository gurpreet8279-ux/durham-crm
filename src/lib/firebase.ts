import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import defaultFirebaseConfig from '../../firebase-applet-config.json';

let firebaseConfig = defaultFirebaseConfig;

const customConfigStr = typeof window !== 'undefined' ? localStorage.getItem('CUSTOM_FIREBASE_CONFIG') : null;
if (customConfigStr) {
  try {
    firebaseConfig = JSON.parse(customConfigStr);
    console.log("Using custom user Firebase configuration.");
  } catch (e) {
    console.error("Failed to parse custom firebase config from localStorage", e);
  }
}

// Initialize Firebase App
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firebase Auth
export const auth = getAuth(app);

// Initialize Firestore using the specific database ID as the third argument
export const db = initializeFirestore(
  app,
  {},
  firebaseConfig.firestoreDatabaseId || '(default)'
);

export function setCustomFirebaseConfig(config: any) {
  if (config) {
    localStorage.setItem('CUSTOM_FIREBASE_CONFIG', typeof config === 'string' ? config : JSON.stringify(config));
  } else {
    localStorage.removeItem('CUSTOM_FIREBASE_CONFIG');
  }
  if (typeof window !== 'undefined') {
    window.location.reload();
  }
}

export function resetToDefaultFirebaseConfig() {
  localStorage.removeItem('CUSTOM_FIREBASE_CONFIG');
  if (typeof window !== 'undefined') {
    window.location.reload();
  }
}

