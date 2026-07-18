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
  isLocalMode: boolean;
  enableLocalMode: (name?: string, role?: 'admin' | 'technician') => void;
  disableLocalMode: () => void;
}

const CRMContext = createContext<CRMContextType | null>(null);

function generateId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).substring(2, 9)}`;
}

export const CRMProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLocalMode, setIsLocalMode] = useState<boolean>(() => {
    return typeof window !== 'undefined' ? localStorage.getItem('CRM_LOCAL_MODE') === 'true' : false;
  });

  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
  
  const [sheetCsvUrl, setSheetCsvUrlState] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState(false);

  // Load local data helper
  const loadLocalData = () => {
    if (typeof window === 'undefined') return;
    
    // Set local mock user
    const savedName = localStorage.getItem('CRM_LOCAL_USER_NAME') || 'Demo Owner';
    const savedRole = (localStorage.getItem('CRM_LOCAL_USER_ROLE') as 'admin' | 'technician') || 'admin';
    setUser({
      id: 'local_user',
      email: 'demo@crowndetailing.com',
      name: savedName,
      role: savedRole,
      sheetCsvUrl: localStorage.getItem('CRM_LOCAL_SHEET_CSV_URL') || ''
    });

    // Load Collections
    try {
      const localCusts = JSON.parse(localStorage.getItem('CRM_LOCAL_CUSTOMERS') || '[]');
      localCusts.sort((a: Customer, b: Customer) => a.fullName.localeCompare(b.fullName));
      setCustomers(localCusts);
    } catch {
      setCustomers([]);
    }

    try {
      const localBgs = JSON.parse(localStorage.getItem('CRM_LOCAL_BOOKINGS') || '[]');
      localBgs.sort((a: Booking, b: Booking) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setBookings(localBgs);
    } catch {
      setBookings([]);
    }

    try {
      const localReqs = JSON.parse(localStorage.getItem('CRM_LOCAL_REQUESTS') || '[]');
      localReqs.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setIncomingRequests(localReqs);
    } catch {
      setIncomingRequests([]);
    }

    setSheetCsvUrlState(localStorage.getItem('CRM_LOCAL_SHEET_CSV_URL') || '');
    setLoading(false);
  };

  // 1. Listen for Auth Changes / Mode changes
  useEffect(() => {
    if (isLocalMode) {
      loadLocalData();
      return;
    }

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
  }, [isLocalMode]);

  // 2. Fetch/Listen for User Profile and Collections once signed in (Firebase only)
  useEffect(() => {
    if (isLocalMode || !firebaseUser) return;

    setLoading(true);
    const userId = firebaseUser.uid;

    // Listen to User document
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
      bgs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setBookings(bgs);
    }, (error) => {
      console.error("Bookings subscription error:", error);
    });

    // Listen to Incoming Requests
    const unsubRequests = onSnapshot(collection(db, 'users', userId, 'incomingRequests'), (snap) => {
      const reqs: any[] = [];
      snap.forEach((d) => {
        reqs.push({ id: d.id, ...d.data() });
      });
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
  }, [firebaseUser, isLocalMode]);

  // Auth Operations
  const loginWithEmail = async (email: string, password: string) => {
    if (isLocalMode) {
      toast.success("Signed in (Local Mode)!");
      return;
    }
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
    if (isLocalMode) {
      localStorage.setItem('CRM_LOCAL_USER_NAME', name);
      localStorage.setItem('CRM_LOCAL_USER_ROLE', role);
      setUser(prev => prev ? { ...prev, name, role } : null);
      toast.success("Account registered (Local Mode)!");
      return;
    }
    setAuthError(null);
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      const userId = credential.user.uid;
      
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
    if (isLocalMode) {
      toast.success("Signed in (Local Mode)!");
      return;
    }
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
    if (isLocalMode) {
      disableLocalMode();
      toast.success("Signed out of Local Demo Mode.");
      return;
    }
    try {
      await signOut(auth);
      toast.success("Signed out safely.");
    } catch (e: any) {
      toast.error("Logout failed");
    }
  };

  // Switch to Local Offline Fallback Mode
  const enableLocalMode = (name?: string, role?: 'admin' | 'technician') => {
    localStorage.setItem('CRM_LOCAL_MODE', 'true');
    localStorage.setItem('CRM_LOCAL_USER_NAME', name || 'Demo Owner');
    localStorage.setItem('CRM_LOCAL_USER_ROLE', role || 'admin');
    setIsLocalMode(true);
  };

  const disableLocalMode = () => {
    localStorage.removeItem('CRM_LOCAL_MODE');
    localStorage.removeItem('CRM_LOCAL_USER_NAME');
    localStorage.removeItem('CRM_LOCAL_USER_ROLE');
    setIsLocalMode(false);
    setUser(null);
    setCustomers([]);
    setBookings([]);
    setIncomingRequests([]);
    setSheetCsvUrlState('');
  };

  // Google Sheet Link Update
  const setSheetCsvUrl = async (url: string) => {
    if (isLocalMode) {
      localStorage.setItem('CRM_LOCAL_SHEET_CSV_URL', url);
      setSheetCsvUrlState(url);
      toast.success("Google Sheets link saved locally!");
      return;
    }

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
          
          if (isLocalMode) {
            const updatedReqs = [...toAdd, ...incomingRequests];
            updatedReqs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            localStorage.setItem('CRM_LOCAL_REQUESTS', JSON.stringify(updatedReqs));
            setIncomingRequests(updatedReqs);
            toast.success(`Successfully imported ${toAdd.length} new request(s) locally!`);
            setIsSyncing(false);
          } else {
            if (!firebaseUser) return;
            const batch = writeBatch(db);
            toAdd.forEach((req) => {
              const docRef = doc(db, 'users', firebaseUser.uid, 'incomingRequests', req.id);
              batch.set(docRef, req);
            });
            await batch.commit();
            toast.success(`Successfully imported ${toAdd.length} new request(s)!`);
            setIsSyncing(false);
          }
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

  // Customer CRUD Operations
  const addCustomer = async (data: Omit<Customer, 'id' | 'createdAt'>) => {
    const newId = generateId('cus');
    const now = new Date().toISOString();
    const customer = { ...data, userId: user?.id || 'local', id: newId, createdAt: now, updatedAt: now } as Customer;

    if (isLocalMode) {
      const updated = [customer, ...customers];
      updated.sort((a, b) => a.fullName.localeCompare(b.fullName));
      localStorage.setItem('CRM_LOCAL_CUSTOMERS', JSON.stringify(updated));
      setCustomers(updated);
      return customer;
    } else {
      if (!firebaseUser) throw new Error("User not authenticated");
      await setDoc(doc(db, 'users', firebaseUser.uid, 'customers', newId), customer);
      return customer;
    }
  };

  const updateCustomer = async (id: string, updates: Partial<Customer>) => {
    const now = new Date().toISOString();

    if (isLocalMode) {
      const updated = customers.map(c => c.id === id ? { ...c, ...updates, updatedAt: now } : c);
      updated.sort((a, b) => a.fullName.localeCompare(b.fullName));
      localStorage.setItem('CRM_LOCAL_CUSTOMERS', JSON.stringify(updated));
      setCustomers(updated);
    } else {
      if (!firebaseUser) throw new Error("User not authenticated");
      await updateDoc(doc(db, 'users', firebaseUser.uid, 'customers', id), {
        ...updates,
        updatedAt: now
      });
    }
  };

  const deleteCustomer = async (id: string) => {
    if (isLocalMode) {
      const updated = customers.filter(c => c.id !== id);
      localStorage.setItem('CRM_LOCAL_CUSTOMERS', JSON.stringify(updated));
      setCustomers(updated);
    } else {
      if (!firebaseUser) throw new Error("User not authenticated");
      await deleteDoc(doc(db, 'users', firebaseUser.uid, 'customers', id));
    }
  };

  // Bookings CRUD Operations
  const addBooking = async (data: Omit<Booking, 'id' | 'createdAt'>) => {
    const newId = generateId('bkg');
    const now = new Date().toISOString();
    const booking = { ...data, userId: user?.id || 'local', id: newId, createdAt: now, updatedAt: now } as Booking;

    if (isLocalMode) {
      const updated = [booking, ...bookings];
      updated.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      localStorage.setItem('CRM_LOCAL_BOOKINGS', JSON.stringify(updated));
      setBookings(updated);
      return booking;
    } else {
      if (!firebaseUser) throw new Error("User not authenticated");
      await setDoc(doc(db, 'users', firebaseUser.uid, 'bookings', newId), booking);
      return booking;
    }
  };

  const updateBooking = async (id: string, updates: Partial<Booking>) => {
    const now = new Date().toISOString();

    if (isLocalMode) {
      const updated = bookings.map(b => b.id === id ? { ...b, ...updates, updatedAt: now } : b);
      updated.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      localStorage.setItem('CRM_LOCAL_BOOKINGS', JSON.stringify(updated));
      setBookings(updated);
    } else {
      if (!firebaseUser) throw new Error("User not authenticated");
      await updateDoc(doc(db, 'users', firebaseUser.uid, 'bookings', id), {
        ...updates,
        updatedAt: now
      });
    }
  };

  const deleteBooking = async (id: string) => {
    if (isLocalMode) {
      const updated = bookings.filter(b => b.id !== id);
      localStorage.setItem('CRM_LOCAL_BOOKINGS', JSON.stringify(updated));
      setBookings(updated);
    } else {
      if (!firebaseUser) throw new Error("User not authenticated");
      await deleteDoc(doc(db, 'users', firebaseUser.uid, 'bookings', id));
    }
  };

  // Vehicles CRUD (Local State)
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

  // Sync Google Forms requests status mutation
  const updateIncomingRequest = async (id: string, status: string) => {
    if (isLocalMode) {
      const updated = incomingRequests.map(r => r.id === id ? { ...r, status } : r);
      localStorage.setItem('CRM_LOCAL_REQUESTS', JSON.stringify(updated));
      setIncomingRequests(updated);
    } else {
      if (!firebaseUser) return;
      await updateDoc(doc(db, 'users', firebaseUser.uid, 'incomingRequests', id), {
        status
      });
    }
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
      isSyncing,
      isLocalMode,
      enableLocalMode,
      disableLocalMode
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
