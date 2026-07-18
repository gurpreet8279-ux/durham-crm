import React, { createContext, useContext, useState, useEffect } from 'react';
import { Customer, Booking, Vehicle } from '../types';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  onSnapshot, 
  deleteDoc,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import Papa from 'papaparse';
import toast from 'react-hot-toast';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'technician';
  sheetCsvUrl?: string;
}

interface CRMContextType {
  user: User | null;
  loading: boolean;
  authError: string | null;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string, name: string, role: 'admin' | 'technician') => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  customers: Customer[];
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt'>) => Promise<Customer>;
  updateCustomer: (id: string, updates: Partial<Customer>) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
  bookings: Booking[];
  addBooking: (booking: Omit<Booking, 'id' | 'createdAt'>) => Promise<Booking>;
  updateBooking: (id: string, updates: Partial<Booking>) => Promise<void>;
  deleteBooking: (id: string) => Promise<void>;
  vehicles: Vehicle[];
  addVehicle: (vehicle: Omit<Vehicle, 'id' | 'createdAt'>) => Promise<Vehicle>;
  updateVehicle: (id: string, updates: Partial<Vehicle>) => Promise<void>;
  deleteVehicle: (id: string) => Promise<void>;
  incomingRequests: any[];
  updateIncomingRequest: (id: string, status: string) => Promise<void>;
  refreshRequests: () => Promise<void>;
  sheetCsvUrl: string;
  setSheetCsvUrl: (url: string) => void;
  syncFromGoogleForm: () => Promise<void>;
  isSyncing: boolean;
}

const CRMContext = createContext<CRMContextType | null>(null);

function generateId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).substring(2, 9)}`;
}

export const CRMProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]); // Keeps sync or empty if unused
  const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
  
  const [sheetCsvUrl, setSheetCsvUrlState] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState(false);

  // 1. Listen for Auth Changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (fUser) => {
      setFirebaseUser(fUser);
      if (!fUser) {
        setUser(null);
        setCustomers([]);
        setBookings([]);
        setIncomingRequests([]);
        setSheetCsvUrlState('');
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  // 2. Fetch/Listen for User Profile and Collections once signed in
  useEffect(() => {
    if (!firebaseUser) return;

    setLoading(true);
    const userId = firebaseUser.uid;

    // Listen to User document (holds name, role, sheetCsvUrl)
    const unsubUser = onSnapshot(doc(db, 'users', userId), async (userSnap) => {
      if (userSnap.exists()) {
        const uData = userSnap.data();
        setUser({
          id: userId,
          email: firebaseUser.email || '',
          name: uData.name || 'User',
          role: uData.role || 'admin',
          sheetCsvUrl: uData.sheetCsvUrl || ''
        });
        setSheetCsvUrlState(uData.sheetCsvUrl || '');
      } else {
        // Fallback or lazy create profile if sign-in succeeded but document isn't there yet (e.g. Google Sign-In)
        const defaultProfile = {
          uid: userId,
          email: firebaseUser.email || '',
          name: firebaseUser.displayName || 'Crown User',
          role: 'admin' as const,
          sheetCsvUrl: '',
          createdAt: new Date().toISOString()
        };
        await setDoc(doc(db, 'users', userId), defaultProfile);
        setUser({
          id: userId,
          email: firebaseUser.email || '',
          name: defaultProfile.name,
          role: defaultProfile.role,
          sheetCsvUrl: ''
        });
      }
    }, (error) => {
      console.error("User snapshot subscription error:", error);
    });

    // Listen to Customers
    const unsubCustomers = onSnapshot(collection(db, 'users', userId, 'customers'), (snap) => {
      const custs: Customer[] = [];
      snap.forEach((d) => {
        custs.push({ id: d.id, ...d.data() } as Customer);
      });
      // Sort customers alphabetically by fullName
      custs.sort((a, b) => a.fullName.localeCompare(b.fullName));
      setCustomers(custs);
    }, (error) => {
      console.error("Customers subscription error:", error);
    });

    // Listen to Bookings
    const unsubBookings = onSnapshot(collection(db, 'users', userId, 'bookings'), (snap) => {
      const bgs: Booking[] = [];
      snap.forEach((d) => {
        bgs.push({ id: d.id, ...d.data() } as Booking);
      });
      // Sort bookings: newest first
      bgs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setBookings(bgs);
    }, (error) => {
      console.error("Bookings subscription error:", error);
    });

    // Listen to Incoming Google Form Requests
    const unsubRequests = onSnapshot(collection(db, 'users', userId, 'incomingRequests'), (snap) => {
      const reqs: any[] = [];
      snap.forEach((d) => {
        reqs.push({ id: d.id, ...d.data() });
      });
      // Sort requests: newest first
      reqs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setIncomingRequests(reqs);
      setLoading(false);
    }, (error) => {
      console.error("IncomingRequests subscription error:", error);
      setLoading(false);
    });

    return () => {
      unsubUser();
      unsubCustomers();
      unsubBookings();
      unsubRequests();
    };
  }, [firebaseUser]);

  // Auth Operations
  const loginWithEmail = async (email: string, password: string) => {
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast.success("Welcome back!");
    } catch (e: any) {
      setAuthError(e.message || "Failed to log in");
      toast.error(e.message || "Login failed");
      throw e;
    }
  };

  const registerWithEmail = async (email: string, password: string, name: string, role: 'admin' | 'technician') => {
    setAuthError(null);
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      const userId = credential.user.uid;
      
      // Save profile immediately
      await setDoc(doc(db, 'users', userId), {
        uid: userId,
        email,
        name,
        role,
        sheetCsvUrl: '',
        createdAt: new Date().toISOString()
      });
      
      toast.success("Account registered successfully!");
    } catch (e: any) {
      setAuthError(e.message || "Registration failed");
      toast.error(e.message || "Registration failed");
      throw e;
    }
  };

  const loginWithGoogle = async () => {
    setAuthError(null);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      toast.success("Signed in with Google!");
    } catch (e: any) {
      setAuthError(e.message || "Google login failed");
      toast.error(e.message || "Google login failed");
      throw e;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      toast.success("Signed out safely.");
    } catch (e: any) {
      toast.error("Logout failed");
    }
  };

  // Google Sheet Link Update
  const setSheetCsvUrl = async (url: string) => {
    if (!firebaseUser) return;
    try {
      await updateDoc(doc(db, 'users', firebaseUser.uid), {
        sheetCsvUrl: url
      });
      setSheetCsvUrlState(url);
      toast.success("Google Sheets link saved!");
    } catch (e: any) {
      console.error("Failed to update sheet CSV URL", e);
      toast.error("Failed to save settings");
    }
  };

  // Google Forms responses CSV sync
  const syncFromGoogleForm = async () => {
    if (!firebaseUser) return;
    if (!sheetCsvUrl) {
      toast.error("Please enter a Google Sheet CSV URL in the Admin tab.");
      return;
    }
    
    setIsSyncing(true);
    try {
      const urlWithCacheBuster = sheetCsvUrl.includes('?') 
        ? `${sheetCsvUrl}&_t=${new Date().getTime()}`
        : `${sheetCsvUrl}?_t=${new Date().getTime()}`;
        
      const response = await fetch(urlWithCacheBuster, { cache: 'no-store' });
      if (!response.ok) throw new Error("Failed to fetch CSV");
      
      const csvText = await response.text();
      
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          const newRequests: any[] = [];
          
          results.data.forEach((row: any) => {
            const keys = Object.keys(row);
            const getVal = (keywords: string[]) => {
               const key = keys.find(k => keywords.some(kw => k.toLowerCase().includes(kw)));
               return key ? row[key] : '';
            };
            
            const timestamp = getVal(['timestamp', 'date', 'time']) || new Date().toISOString();
            const fullName = getVal(['name', 'first', 'last', 'customer', 'client']) || getVal(['who']) || 'Unknown Customer';
            const phoneNumber = getVal(['phone', 'mobile', 'cell', 'number', 'contact']) || '';
            const email = getVal(['email', 'mail']) || '';
            const address = getVal(['address', 'location', 'where']) || '';
            const city = getVal(['city', 'town', 'zip']) || '';
            const vehicleMakeModel = getVal(['vehicle', 'make', 'model', 'car', 'auto', 'truck']) || '';
            const serviceRequested = getVal(['service', 'package', 'detail', 'type', 'what']) || '';
            const preferredDate = getVal(['date', 'when']) || '';
            const preferredTime = getVal(['time']) || '';
            const notes = getVal(['notes', 'message', 'additional', 'anything']) || '';
            
            const hasData = Object.values(row).some(v => typeof v === 'string' && v.trim() !== '');
            
            if (hasData) {
              const id = `req_${btoa(timestamp + fullName + phoneNumber).replace(/[^a-zA-Z0-9]/g, '').substring(0, 15)}`;
              
              newRequests.push({
                id,
                timestamp,
                fullName,
                phoneNumber,
                email,
                address,
                city,
                vehicleMakeModel,
                serviceRequested,
                preferredDate,
                preferredTime,
                notes,
                status: 'pending'
              });
            }
          });
          
          const existingIds = new Set(incomingRequests.map(r => r.id));
          const toAdd = newRequests.filter(r => !existingIds.has(r.id));
          
          if (toAdd.length === 0) {
            toast.success("No new requests found. You're all caught up!");
            setIsSyncing(false);
            return;
          }
          
          // Write batch to Firestore
          const batch = writeBatch(db);
          toAdd.forEach((req) => {
            const docRef = doc(db, 'users', firebaseUser.uid, 'incomingRequests', req.id);
            batch.set(docRef, req);
          });
          await batch.commit();
          toast.success(`Successfully imported ${toAdd.length} new request(s)!`);
          setIsSyncing(false);
        },
        error: (error) => {
          console.error("CSV Parse Error:", error);
          toast.error("Error parsing the Google Form data.");
          setIsSyncing(false);
        }
      });
    } catch (error) {
      console.error("Sync Error:", error);
      toast.error("Failed to sync from Google Forms.");
      setIsSyncing(false);
    }
  };

  // Firestore Customer CRUD
  const addCustomer = async (data: Omit<Customer, 'id' | 'createdAt'>) => {
    if (!firebaseUser) throw new Error("User not authenticated");
    const newId = generateId('cus');
    const now = new Date().toISOString();
    const customer = { ...data, userId: firebaseUser.uid, id: newId, createdAt: now, updatedAt: now } as Customer;
    
    await setDoc(doc(db, 'users', firebaseUser.uid, 'customers', newId), customer);
    return customer;
  };

  const updateCustomer = async (id: string, updates: Partial<Customer>) => {
    if (!firebaseUser) throw new Error("User not authenticated");
    const now = new Date().toISOString();
    await updateDoc(doc(db, 'users', firebaseUser.uid, 'customers', id), {
      ...updates,
      updatedAt: now
    });
  };

  const deleteCustomer = async (id: string) => {
    if (!firebaseUser) throw new Error("User not authenticated");
    await deleteDoc(doc(db, 'users', firebaseUser.uid, 'customers', id));
  };

  // Firestore Bookings CRUD
  const addBooking = async (data: Omit<Booking, 'id' | 'createdAt'>) => {
    if (!firebaseUser) throw new Error("User not authenticated");
    const newId = generateId('bkg');
    const now = new Date().toISOString();
    const booking = { ...data, userId: firebaseUser.uid, id: newId, createdAt: now, updatedAt: now } as Booking;
    
    await setDoc(doc(db, 'users', firebaseUser.uid, 'bookings', newId), booking);
    return booking;
  };

  const updateBooking = async (id: string, updates: Partial<Booking>) => {
    if (!firebaseUser) throw new Error("User not authenticated");
    const now = new Date().toISOString();
    await updateDoc(doc(db, 'users', firebaseUser.uid, 'bookings', id), {
      ...updates,
      updatedAt: now
    });
  };

  const deleteBooking = async (id: string) => {
    if (!firebaseUser) throw new Error("User not authenticated");
    await deleteDoc(doc(db, 'users', firebaseUser.uid, 'bookings', id));
  };

  // Local Vehicles CRUD (remains backward compatible but local-only or unsaved if top-level, vehicles are stored as string lists inside customer docs mostly)
  const addVehicle = async (data: Omit<Vehicle, 'id' | 'createdAt'>) => {
    const newId = generateId('veh');
    const now = new Date().toISOString();
    const vehicle = { ...data, id: newId, createdAt: now } as Vehicle;
    setVehicles(prev => [...prev, vehicle]);
    return vehicle;
  };

  const updateVehicle = async (id: string, updates: Partial<Vehicle>) => {
    setVehicles(prev => prev.map(v => v.id === id ? { ...v, ...updates } : v));
  };

  const deleteVehicle = async (id: string) => {
    setVehicles(prev => prev.filter(v => v.id !== id));
  };

  // Sync Google Forms requests state mutation
  const updateIncomingRequest = async (id: string, status: string) => {
    if (!firebaseUser) return;
    await updateDoc(doc(db, 'users', firebaseUser.uid, 'incomingRequests', id), {
      status
    });
  };

  const refreshRequests = async () => {
    await syncFromGoogleForm();
  };

  return (
    <CRMContext.Provider value={{
      user,
      loading,
      authError,
      loginWithEmail,
      registerWithEmail,
      loginWithGoogle,
      logout,
      customers,
      addCustomer,
      updateCustomer,
      deleteCustomer,
      bookings,
      addBooking,
      updateBooking,
      deleteBooking,
      vehicles,
      addVehicle,
      updateVehicle,
      deleteVehicle,
      incomingRequests,
      updateIncomingRequest,
      refreshRequests,
      sheetCsvUrl,
      setSheetCsvUrl,
      syncFromGoogleForm,
      isSyncing
    }}>
      {children}
    </CRMContext.Provider>
  );
};

export const useCRM = () => {
  const context = useContext(CRMContext);
  if (!context) throw new Error("useCRM must be used within CRMProvider");
  return context;
};
