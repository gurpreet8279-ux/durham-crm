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
  getDocs 
} from 'firebase/firestore';
import { 
  db, 
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
  vehicles: Vehicle[];
  addVehicle: (vehicle: Omit<Vehicle, 'id' | 'createdAt'>) => Promise<Vehicle>;
  updateVehicle: (id: string, updates: Partial<Vehicle>) => Promise<void>;
  deleteVehicle: (id: string) => Promise<void>;
  incomingRequests: IncomingRequest[];
  updateIncomingRequest: (id: string, status: string) => Promise<void>;
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
  incomingRequests?: IncomingRequest[];
  sheetCsvUrl?: string;
}

const getStoredData = (): StoredCRMData => {
  try {
    const raw = localStorage.getItem('crown_crm_data');
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error("Failed to load local CRM data", e);
  }
  return {};
};

export const CRMProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user] = useState<User | null>({ id: 'admin', email: 'admin@crown', name: 'Admin' });
  const [loading] = useState(false);
  const [authError] = useState<string | null>(null);
  
  const [customers, setCustomers] = useState<Customer[]>(() => getStoredData().customers || []);
  const [bookings, setBookings] = useState<Booking[]>(() => getStoredData().bookings || []);
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => getStoredData().vehicles || []);
  const [incomingRequests, setIncomingRequests] = useState<IncomingRequest[]>(() => getStoredData().incomingRequests || []);
  const [sheetCsvUrl, setSheetCsvUrlState] = useState<string>(() => getStoredData().sheetCsvUrl || '');
  const [isSyncing, setIsSyncing] = useState(false);
  const [firestoreConnected, setFirestoreConnected] = useState(false);

  // 1. Check initial connection
  useEffect(() => {
    testFirestoreConnection().then((connected) => {
      setFirestoreConnected(connected);
    });
  }, []);

  // 2. Real-time Firestore Listeners
  useEffect(() => {
    // A. Listener for 'public_bookings' -> Strictly New Online Leads
    const publicBookingsCol = collection(db, 'public_bookings');
    const unsubscribePublicBookings = onSnapshot(publicBookingsCol, (snapshot) => {
      setFirestoreConnected(true);
      if (!snapshot.empty) {
        const leads: IncomingRequest[] = [];

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const docId = docSnap.id;
          const status = data.status || 'Pending';

          const dateStr = data.date || data.preferredDate || data.bookingDate || (() => {
            const d = new Date();
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          })();

          const timeStr = data.time || data.preferredTime || data.bookingTime || '';
          const fullName = data.fullName || data.name || data.customerName || data.client || 'New Lead';
          const phone = data.phoneNumber || data.phone || data.mobile || data.contact || '';
          const email = data.email || data.mail || '';
          const vehicle = data.vehicle || data.vehicleMakeModel || data.car || '';
          const service = data.service || data.serviceRequested || data.package || 'Detailing Service';
          const address = data.address || data.location || '';
          const city = data.city || '';
          const notes = data.notes || data.message || '';
          const createdAt = data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (data.createdAt || data.timestamp || new Date().toISOString());

          leads.push({
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
          });
        });

        setIncomingRequests(prev => {
          const map = new Map<string, IncomingRequest>();
          // Keep existing unless replaced by Firestore
          prev.forEach(r => map.set(r.id, r));
          leads.forEach(r => map.set(r.id, r));
          return Array.from(map.values());
        });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'public_bookings');
    });

    // B. Listener for 'bookings' -> CRM Schedule & Confirmed Bookings
    const bookingsCol = collection(db, 'bookings');
    const unsubscribeBookings = onSnapshot(bookingsCol, (snapshot) => {
      setFirestoreConnected(true);
      if (!snapshot.empty) {
        const firestoreBookings: Booking[] = [];

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

        if (firestoreBookings.length > 0) {
          setBookings(prev => {
            const combinedMap = new Map<string, Booking>();
            prev.forEach(b => combinedMap.set(b.id, b));
            firestoreBookings.forEach(b => combinedMap.set(b.id, b));
            return Array.from(combinedMap.values());
          });
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'bookings');
    });

    // C. Listener for 'customers' collection
    const customersCol = collection(db, 'customers');
    const unsubscribeCustomers = onSnapshot(customersCol, (snapshot) => {
      if (!snapshot.empty) {
        const firestoreCustomers: Customer[] = [];
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

        setCustomers(prev => {
          const map = new Map<string, Customer>();
          prev.forEach(c => map.set(c.id, c));
          firestoreCustomers.forEach(c => map.set(c.id, c));
          return Array.from(map.values());
        });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'customers');
    });

    return () => {
      unsubscribePublicBookings();
      unsubscribeBookings();
      unsubscribeCustomers();
    };
  }, []);

  // Sync to local storage as client cache fallback
  useEffect(() => {
    try {
      localStorage.setItem('crown_crm_data', JSON.stringify({
        customers,
        bookings,
        vehicles,
        incomingRequests,
        sheetCsvUrl
      }));
    } catch (e) {
      console.error("Failed to sync CRM data to local storage", e);
    }
  }, [customers, bookings, vehicles, incomingRequests, sheetCsvUrl]);
  
  const setSheetCsvUrl = (url: string) => {
    setSheetCsvUrlState(url);
  };

  const login = async () => {};

  // Manual Firestore sync trigger
  const syncFromFirestore = async () => {
    setIsSyncing(true);
    try {
      const snapPublic = await getDocs(collection(db, 'public_bookings'));
      const snapBookings = await getDocs(collection(db, 'bookings'));
      setFirestoreConnected(true);
      
      const newOnlineLeads = snapPublic.docs.filter(d => {
        const s = d.data().status;
        return s !== 'Approved' && s !== 'Dismissed';
      }).length;

      toast.success(`Synced! Found ${newOnlineLeads} pending online lead(s) and ${snapBookings.size} CRM booking(s).`);
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
          
          setIncomingRequests(prev => {
            const existingIds = new Set(prev.map(r => r.id));
            const toAdd = newRequests.filter(r => !existingIds.has(r.id));
            return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
          });

          // Save new imported requests to Firestore public_bookings collection
          for (const req of newRequests) {
            try {
              await setDoc(doc(db, 'public_bookings', req.id), {
                ...req,
                status: 'Pending',
                isLead: true,
                updatedAt: new Date().toISOString()
              }, { merge: true });
            } catch (err) {
              console.warn("Could not save lead to Firestore:", err);
            }
          }

          const currentIds = new Set(incomingRequests.map(r => r.id));
          const countAdded = newRequests.filter(r => !currentIds.has(r.id)).length;
          if (countAdded > 0) {
            toast.success(`Successfully imported ${countAdded} new request(s)!`);
          } else {
            toast.success("No new requests found. You're all caught up!");
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
    setIncomingRequests(prev => prev.map(r => r.id === id ? { ...r, status: status as any } : r));

    try {
      await updateDoc(doc(db, 'public_bookings', id), {
        status,
        updatedAt: new Date().toISOString()
      }).catch(async () => {
        await updateDoc(doc(db, 'bookings', id), {
          status,
          updatedAt: new Date().toISOString()
        });
      });
    } catch (error) {
      console.warn("Could not sync request status to Firestore:", error);
    }
  };

  const refreshRequests = async () => {
    await syncFromFirestore();
    if (sheetCsvUrl) {
      await syncFromGoogleForm();
    }
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
