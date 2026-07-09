import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/calendar.events');
provider.addScope('https://www.googleapis.com/auth/calendar.readonly');
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/drive.file');

// Custom parameters to prompt for consent to get refresh token potentially
provider.setCustomParameters({
  prompt: 'consent'
});

export const initAuth = (
  onAuthSuccess?: (user: User, token: string | null) => void,
  onAuthFailure?: (error?: any) => void
) => {
  // First, check redirect result in case we are returning from signInWithRedirect
  getRedirectResult(auth).then(async (result) => {
    if (result) {
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        sessionStorage.setItem('google_access_token', credential.accessToken);
      }
      
      // Update user doc
      if (result.user) {
        await setDoc(doc(db, 'users', result.user.uid), {
          email: result.user.email,
          displayName: result.user.displayName,
          lastLogin: new Date().toISOString()
        }, { merge: true });
      }
    }
  }).catch((error) => {
    console.error("Redirect error", error);
    if (onAuthFailure) onAuthFailure(error);
  });

  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      const token = sessionStorage.getItem('google_access_token');
      if (onAuthSuccess) onAuthSuccess(user, token);
    } else {
      sessionStorage.removeItem('google_access_token');
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }
    sessionStorage.setItem('google_access_token', credential.accessToken);
    
    // Update user doc
    if (result.user) {
      await setDoc(doc(db, 'users', result.user.uid), {
        email: result.user.email,
        displayName: result.user.displayName,
        lastLogin: new Date().toISOString()
      }, { merge: true });
    }
    
    return { user: result.user, accessToken: credential.accessToken };
  } catch (error: any) {
    console.error('Popup sign in error:', error);
    if (error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
      console.log('Falling back to redirect...');
      await signInWithRedirect(auth, provider);
      return null; // Will redirect
    }
    throw error;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return sessionStorage.getItem('google_access_token');
};

export const logout = async () => {
  await auth.signOut();
  sessionStorage.removeItem('google_access_token');
};
