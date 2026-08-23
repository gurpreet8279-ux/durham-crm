import React, { createContext, useContext, useState, useEffect } from 'react';
import { Customer, Booking, Vehicle, IncomingRequest } from '../types';
import Papa from 'papaparse';
import toast from 'react-hot-toast';
import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { 
  db, 
  defaultDb,
  handleFirestoreError, 
  OperationType, 
  FIRESTORE_DATABASE_ID,
  FIRESTORE_PROJECT_ID,
  testFirestoreConnection 
} from '../lib/firebase';

export interface User {
  id: string;
  email: string;
  name: string;
}

interface CRMContextType {
  user: User | null;
  loading: boolean;
  authError: string | null;
  login: () => Promise<void>;
  customers: Customer[];
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt'>) => Promise<Customer>;
  updateCustomer: (id: string, updates: Partial<Customer>) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
  bookings: Booking[];
  addBooking: (booking: Omit<Booking, 'id' | 'createdAt'>) => Promise<Booking>;
  updateBooking: (id: string, updates: Partial<Booking>) => Promise<void>;
  deleteBooking: (id: string) => Promise<void>;
  purgeAllBookings: () => Promise<void>;
  purgeAllCustomers: () => Promise<void>;
  purgeAllIncomingLeads: () => Promise<void>;
  vehicles: Vehicle[];
  addVehicle: (vehicle: Omit<Vehicle, 'id' | 'createdAt'>) => Promise<Vehicle>;
  updateVehicle: (id: string, updates: Partial<Vehicle>) => Promise<void>;
  deleteVehicle: (id: string) => Promise<void>;
  incomingRequests: IncomingRequest[];
  updateIncomingRequest: (id: string, status: string) => Promise<void>;
  clearIncomingRequests: () => void;
  refreshRequests: () => Promise<void>;
  sheetCsvUrl: string;
  setSheetCsvUrl: (url: string) => void;
  syncFromGoogleForm: () => Promise<void>;
  syncFromFirestore: () => Promise<void>;
  isSyncing: boolean;
  firestoreConnected: boolean;
  firestoreDatabaseId: string;
  firestoreProjectId: string;
}

const CRMContext = createContext<CRMContextType | null>(null);

function generateId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).substring(2, 9)}`;
}

function generateDeterministicRequestId(rawInput: string): string {
  let hash1 = 5381;
  let hash2 = 52711;
  for (let i = 0; i < rawInput.length; i++) {
    const code = rawInput.charCodeAt(i);
    hash1 = ((hash1 << 5) + hash1) ^ code;
    hash2 = ((hash2 << 5) + hash2) ^ code;
  }
  const cleanPrefix = rawInput.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10);
  const hashHex = Math.abs(hash1).toString(36) + Math.abs(hash2).toString(36);
  return `req_${cleanPrefix}_${hashHex}`;
}

interface StoredCRMData {
  customers?: Customer[];
  bookings?: Booking[];
  vehicles?: Vehicle[];
  sheetCsvUrl?: string;
}

const getStoredData = (): StoredCRMData => {
  try {
    const raw = localStorage.getItem('crown_crm_data');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.incomingRequests) {
        delete parsed.incomingRequests;
        localStorage.setItem('crown_crm_data', JSON.stringify(parsed));
      }
      return parsed;
    }
  } catch (e) {
    console.error("Failed to load local CRM data", e);
  }
  return {};
};

function parseLeadDoc(docId: string, data: any): IncomingRequest {
  const dateStr = data.date || data.preferredDate || data.bookingDate || (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  const timeStr = data.time || data.preferredTime || data.bookingTime || '';
  const fullName = data.fullName || data.name || data.customerName || data.client || 'Online Customer';
  const phone = data.phoneNumber || data.phone || data.mobile || data.contact || '';
  const email = data.email || data.mail || '';
  const vehicle = data.vehicle || data.vehicleMakeModel || data.car || '';
  const service = data.service || data.serviceRequested || data.package || 'Detailing Service';
  const address = data.address || data.location || '';
  const city = data.city || '';
  const notes = data.notes || data.message || '';
  const status = data.status || 'Pending';
  const createdAt = data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (data.createdAt || data.timestamp || new Date().toISOString());

  return {
    id: docId,
    timestamp: createdAt,
    fullName,
    phoneNumber: phone,
    email,
    address,
    city,
    vehicleMakeModel: vehicle,
    serviceRequested: service,
    preferredDate: dateStr,
    preferredTime: timeStr,
    notes,
    status: status === 'Approved' ? 'Approved' : status === 'Dismissed' ? 'Dismissed' : 'Pending'
  };
}

export const CRMProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user] = useState<User | null>({ id: 'admin', email: 'admin@crown', name: 'Admin' });
  const [loading] = useState(false);
  const [authError] = useState<string | null>(null);
  
  const [customers, setCustomers] = useState<Customer[]>(() => getStoredData().customers || []);
  const [bookings, setBookings] = useState<Booking[]>(() => getStoredData().bookings || []);
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => getStoredData().vehicles || []);
  const [incomingRequests, setIncomingRequests] = useState<IncomingRequest[]>([]);
  const [sheetCsvUrl, setSheetCsvUrlState] = useState<string>(() => getStoredData().sheetCsvUrl || '');
  const [isSyncing, setIsSyncing] = useState(false);
  const [firestoreConnected, setFirestoreConnected] = useState(false);

  // 1. Clean up any lingering localStorage cached requests on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem('crown_crm_data');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.incomingRequests) {
          delete parsed.incomingRequests;
          localStorage.setItem('crown_crm_data', JSON.stringify(parsed));
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // 2. Initial connection check
  useEffect(() => {
    testFirestoreConnection().then((connected) => {
      setFirestoreConnected(connected);
    });
  }, []);

  // 3. Real-time Firestore Listeners
  useEffect(() => {
    // Helper to process public_bookings documents strictly
    const handlePublicBookingsSnapshot = (snapshot: any) => {
      setFirestoreConnected(true);
      const liveLeads: IncomingRequest[] = [];
      if (!snapshot.empty) {
        snapshot.forEach((docSnap: any) => {
          const lead = parseLeadDoc(docSnap.id, docSnap.data());
          if (lead.status === 'Pending') {
            liveLeads.push(lead);
          }
        });
      }
      setIncomingRequests(liveLeads);
    };

    // A. Listener for 'public_bookings' on primary named DB
    const unsubscribePublic = onSnapshot(collection(db, 'public_bookings'), handlePublicBookingsSnapshot, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'public_bookings');
    });

    // B. Listener for 'public_bookings' on default DB (in case external client uses default db)
    let unsubscribeDefaultPublic: (() => void) | null = null;
    if (defaultDb !== db) {
      try {
        unsubscribeDefaultPublic = onSnapshot(collection(defaultDb, 'public_bookings'), handlePublicBookingsSnapshot, () => {});
      } catch (e) {
        console.warn("Could not listen to defaultDb public_bookings", e);
      }
    }

    // C. Listener for 'bookings' collection -> strictly scheduled CRM jobs
    const unsubscribeBookings = onSnapshot(collection(db, 'bookings'), (snapshot) => {
      setFirestoreConnected(true);
      const firestoreBookings: Booking[] = [];
      if (!snapshot.empty) {
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const docId = docSnap.id;

          const dateStr = data.date || data.preferredDate || data.bookingDate || (() => {
            const d = new Date();
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          })();

          const timeStr = data.time || data.preferredTime || data.bookingTime || '';
          const vehicle = data.vehicle || data.vehicleMakeModel || data.car || '';
          const service = data.service || data.serviceRequested || data.package || 'Detailing Service';
          const notes = data.notes || data.message || '';
          const status = data.status || 'New';
          const price = typeof data.price === 'number' ? data.price : parseFloat(data.price || 0) || 0;
          const paymentStatus = data.paymentStatus === 'Paid' ? 'Paid' : 'Unpaid';
          const createdAt = data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (data.createdAt || data.timestamp || new Date().toISOString());

          firestoreBookings.push({
            id: docId,
            customerId: data.customerId || docId,
            vehicleId: data.vehicleId || '',
            vehicle,
            date: dateStr,
            time: timeStr,
            duration: data.duration || 120,
            service,
            price,
            paymentStatus,
            status: status as any,
            notes,
            createdAt,
            calendarEventId: data.calendarEventId || ''
          });
        });
      }
      setBookings(firestoreBookings);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'bookings');
    });

    // D. Listener for 'customers' collection
    const unsubscribeCustomers = onSnapshot(collection(db, 'customers'), (snapshot) => {
      const firestoreCustomers: Customer[] = [];
      if (!snapshot.empty) {
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          firestoreCustomers.push({
            id: docSnap.id,
            fullName: data.fullName || data.name || 'Unnamed',
            phoneNumber: data.phoneNumber || data.phone || '',
            email: data.email || '',
            vehicles: Array.isArray(data.vehicles) ? data.vehicles : (data.vehicle ? [data.vehicle] : []),
            address: data.address || '',
            city: data.city || '',
            notes: data.notes || '',
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (data.createdAt || new Date().toISOString()),
            lastServiceDate: data.lastServiceDate || ''
          });
        });
      }
      setCustomers(firestoreCustomers);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'customers');
    });

    return () => {
      unsubscribePublic();
      if (unsubscribeDefaultPublic) unsubscribeDefaultPublic();
      unsubscribeBookings();
      unsubscribeCustomers();
    };
  }, []);

  // Sync state to local storage
  useEffect(() => {
    try {
      localStorage.setItem('crown_crm_data', JSON.stringify({
        customers,
        bookings,
        vehicles,
        sheetCsvUrl
      }));
    } catch (e) {
      console.error("Failed to sync CRM data to local storage", e);
    }
  }, [customers, bookings, vehicles, sheetCsvUrl]);
  
  const setSheetCsvUrl = (url: string) => {
    setSheetCsvUrlState(url);
  };

  const login = async () => {};

  const clearIncomingRequests = () => {
    setIncomingRequests([]);
    try {
      const stored = getStoredData();
      delete (stored as any).incomingRequests;
      localStorage.setItem('crown_crm_data', JSON.stringify(stored));
      toast.success('Cleared inbox view.');
    } catch (e) {
      console.error("Error clearing requests", e);
    }
  };

  // Bulk Purge Handlers to wipe old test data completely from Firestore & Local
  const purgeAllBookings = async () => {
    setIsSyncing(true);
    try {
      const snap = await getDocs(collection(db, 'bookings'));
      const batch = writeBatch(db);
      snap.docs.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
      await batch.commit();

      setBookings([]);
      const stored = getStoredData();
      stored.bookings = [];
      localStorage.setItem('crown_crm_data', JSON.stringify(stored));
      toast.success(`Successfully purged ${snap.size} old booking(s) from database.`);
    } catch (error) {
      console.error("Error purging bookings:", error);
      toast.error("Failed to purge bookings from Firestore.");
    } finally {
      setIsSyncing(false);
    }
  };

  const purgeAllCustomers = async () => {
    setIsSyncing(true);
    try {
      const snap = await getDocs(collection(db, 'customers'));
      const batch = writeBatch(db);
      snap.docs.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
      await batch.commit();

      setCustomers([]);
      const stored = getStoredData();
      stored.customers = [];
      localStorage.setItem('crown_crm_data', JSON.stringify(stored));
      toast.success(`Successfully purged ${snap.size} old customer(s) from database.`);
    } catch (error) {
      console.error("Error purging customers:", error);
      toast.error("Failed to purge customers from Firestore.");
    } finally {
      setIsSyncing(false);
    }
  };

  const purgeAllIncomingLeads = async () => {
    setIsSyncing(true);
    try {
      const snap = await getDocs(collection(db, 'public_bookings'));
      const batch = writeBatch(db);
      snap.docs.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
      await batch.commit();

      setIncomingRequests([]);
      toast.success(`Cleared all incoming lead records from database.`);
    } catch (error) {
      console.error("Error purging incoming leads:", error);
      toast.error("Failed to purge incoming leads.");
    } finally {
      setIsSyncing(false);
    }
  };

  // Manual Firestore sync trigger
  const syncFromFirestore = async () => {
    setIsSyncing(true);
    try {
      const snapPublic = await getDocs(collection(db, 'public_bookings'));
      let defaultPublicDocs: any[] = [];
      if (defaultDb !== db) {
        try {
          const snapDef = await getDocs(collection(defaultDb, 'public_bookings'));
          defaultPublicDocs = snapDef.docs;
        } catch {
          // ignore
        }
      }

      const snapBookings = await getDocs(collection(db, 'bookings'));
      setFirestoreConnected(true);

      const allPublicDocs = [...snapPublic.docs, ...defaultPublicDocs];
      const liveLeads = allPublicDocs
        .map(d => parseLeadDoc(d.id, d.data()))
        .filter(r => r.status === 'Pending');

      setIncomingRequests(liveLeads);

      if (liveLeads.length > 0) {
        toast.success(`Found ${liveLeads.length} fresh online lead(s) in public_bookings!`);
      } else {
        toast.success(`Database sync complete: 0 pending online leads.`);
      }
    } catch (error) {
      console.error("Firestore sync error:", error);
      handleFirestoreError(error, OperationType.LIST, 'public_bookings');
      toast.error("Failed to sync with Firestore. Please check your connection.");
    } finally {
      setIsSyncing(false);
    }
  };
  
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
          const newRequests: IncomingRequest[] = [];
          
          results.data.forEach((row: any) => {
            const keys = Object.keys(row);
            const getVal = (keywords: string[]) => {
               const key = keys.find(k => keywords.some(kw => k.toLowerCase().includes(kw)));
               return key ? row[key] : '';
            };
            
            const timestamp = getVal(['timestamp', 'date', 'time']) || new Date().toISOString();
            const fullName = getVal(['name', 'first', 'last', 'customer', 'client']) || getVal(['who']) || 'Unknown Customer';
            const phoneNumber = getVal(['phone', 'mobile', 'cell', 'number', 'contact']);
            const email = getVal(['email', 'mail']);
            const address = getVal(['address', 'location', 'where']);
            const city = getVal(['city', 'town', 'zip']);
            const vehicleMakeModel = getVal(['vehicle', 'make', 'model', 'car', 'auto', 'truck']);
            const serviceRequested = getVal(['service', 'package', 'detail', 'type', 'what']);
            const preferredDate = getVal(['date', 'when']);
            const preferredTime = getVal(['time']);
            const notes = getVal(['notes', 'message', 'additional', 'anything']);
            
            const hasData = Object.values(row).some(v => typeof v === 'string' && v.trim() !== '');
            
            if (hasData) {
              const id = generateDeterministicRequestId(timestamp + fullName + (phoneNumber || ''));
              
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
                status: 'Pending'
              });
            }
          });

          // Save new imported requests to Firestore public_bookings collection
          let savedCount = 0;
          for (const req of newRequests) {
            try {
              await setDoc(doc(db, 'public_bookings', req.id), {
                ...req,
                status: 'Pending',
                isLead: true,
                updatedAt: new Date().toISOString()
              }, { merge: true });
              savedCount++;
            } catch (err) {
              console.warn("Could not save lead to Firestore:", err);
            }
          }

          if (savedCount > 0) {
            toast.success(`Imported ${savedCount} lead(s) to Firestore!`);
          } else {
            toast.success("No new requests found in Google Sheet.");
          }
        },
        error: (error) => {
          console.error("CSV Parse Error:", error);
          toast.error("Error parsing the Google Form data.");
        }
      });
    } catch (error) {
      console.error("Sync Error:", error);
      toast.error("Failed to sync from Google Forms. Please ensure you copied the 'Published to the web (CSV)' URL correctly.");
    } finally {
      setIsSyncing(false);
    }
  };

  const addCustomer = async (data: Omit<Customer, 'id' | 'createdAt'>) => {
    const newId = generateId('cus');
    const now = new Date().toISOString();
    const customer = { ...data, id: newId, createdAt: now } as Customer;
    
    setCustomers(prev => [...prev, customer]);

    try {
      await setDoc(doc(db, 'customers', newId), {
        ...customer,
        updatedAt: now
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `customers/${newId}`);
    }

    return customer;
  };

  const updateCustomer = async (id: string, updates: Partial<Customer>) => {
    setCustomers(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));

    try {
      await updateDoc(doc(db, 'customers', id), {
        ...updates,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `customers/${id}`);
    }
  };

  const deleteCustomer = async (id: string) => {
    setCustomers(prev => prev.filter(c => c.id !== id));

    try {
      await deleteDoc(doc(db, 'customers', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `customers/${id}`);
    }
  };

  const addBooking = async (data: Omit<Booking, 'id' | 'createdAt'>) => {
    const newId = generateId('bkg');
    const now = new Date().toISOString();
    const booking = { ...data, id: newId, createdAt: now } as Booking;
    
    setBookings(prev => [booking, ...prev]);

    try {
      await setDoc(doc(db, 'bookings', newId), {
        ...booking,
        updatedAt: now
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `bookings/${newId}`);
    }

    return booking;
  };

  const updateBooking = async (id: string, updates: Partial<Booking>) => {
    setBookings(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));

    try {
      await updateDoc(doc(db, 'bookings', id), {
        ...updates,
        updatedAt: new Date().toISOString()
      }).catch(async () => {
        await updateDoc(doc(db, 'public_bookings', id), {
          ...updates,
          updatedAt: new Date().toISOString()
        });
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `bookings/${id}`);
    }
  };

  const deleteBooking = async (id: string) => {
    setBookings(prev => prev.filter(b => b.id !== id));

    try {
      await deleteDoc(doc(db, 'bookings', id)).catch(async () => {
        await deleteDoc(doc(db, 'public_bookings', id));
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `bookings/${id}`);
    }
  };

  const addVehicle = async (data: Omit<Vehicle, 'id' | 'createdAt'>) => {
    const newId = generateId('veh');
    const now = new Date().toISOString();
    const vehicle = { ...data, id: newId, createdAt: now } as Vehicle;
    
    setVehicles(prev => [...prev, vehicle]);

    try {
      await setDoc(doc(db, 'vehicles', newId), {
        ...vehicle,
        updatedAt: now
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `vehicles/${newId}`);
    }

    return vehicle;
  };

  const updateVehicle = async (id: string, updates: Partial<Vehicle>) => {
    setVehicles(prev => prev.map(v => v.id === id ? { ...v, ...updates } : v));

    try {
      await updateDoc(doc(db, 'vehicles', id), {
        ...updates,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `vehicles/${id}`);
    }
  };

  const deleteVehicle = async (id: string) => {
    setVehicles(prev => prev.filter(v => v.id !== id));

    try {
      await deleteDoc(doc(db, 'vehicles', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `vehicles/${id}`);
    }
  };

  const updateIncomingRequest = async (id: string, status: string) => {
    setIncomingRequests(prev => prev.filter(r => r.id !== id));

    try {
      await updateDoc(doc(db, 'public_bookings', id), {
        status,
        updatedAt: new Date().toISOString()
      }).catch(async () => {
        if (defaultDb !== db) {
          await updateDoc(doc(defaultDb, 'public_bookings', id), {
            status,
            updatedAt: new Date().toISOString()
          });
        }
      });
    } catch (error) {
      console.warn("Could not sync request status to Firestore:", error);
    }
  };

  const refreshRequests = async () => {
    await syncFromFirestore();
  };

  return (
    <CRMContext.Provider value={{
      user,
      loading,
      authError,
      login,
      customers,
      addCustomer,
      updateCustomer,
      deleteCustomer,
      bookings,
      addBooking,
      updateBooking,
      deleteBooking,
      purgeAllBookings,
      purgeAllCustomers,
      purgeAllIncomingLeads,
      vehicles,
      addVehicle,
      updateVehicle,
      deleteVehicle,
      incomingRequests,
      updateIncomingRequest,
      clearIncomingRequests,
      refreshRequests,
      sheetCsvUrl,
      setSheetCsvUrl,
      syncFromGoogleForm,
      syncFromFirestore,
      isSyncing,
      firestoreConnected,
      firestoreDatabaseId: FIRESTORE_DATABASE_ID,
      firestoreProjectId: FIRESTORE_PROJECT_ID
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
