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
  
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<IncomingRequest[]>([]);
  const [sheetCsvUrl, setSheetCsvUrlState] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [firestoreConnected, setFirestoreConnected] = useState(false);

  // 1. Wipe any old localStorage cache completely on mount
  useEffect(() => {
    try {
      localStorage.removeItem('crown_crm_data');
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

  // 3. Real-time Firestore Listeners: strictly listening to 'public_bookings' and 'customers'
  useEffect(() => {
    // Map to hold raw public_bookings and separate bookings
    let publicBookingsMap = new Map<string, any>();
    let manualBookingsMap = new Map<string, any>();
    let firestoreCustomersList: Customer[] = [];

    const recomputeAll = () => {
      setFirestoreConnected(true);

      const allLeads: IncomingRequest[] = [];
      const unifiedBookings: Booking[] = [];
      const autoCustomersMap = new Map<string, Customer>();

      // Populate already registered customer documents
      firestoreCustomersList.forEach(c => {
        autoCustomersMap.set(c.id, c);
        if (c.phoneNumber) autoCustomersMap.set(c.phoneNumber, c);
      });

      // 1. Process public_bookings collection documents
      publicBookingsMap.forEach((data, docId) => {
        const lead = parseLeadDoc(docId, data);
        if (lead.status === 'Pending') {
          allLeads.push(lead);
        }

        // Auto-synthesize customer profile if not already present
        const custId = data.customerId || `cus_${docId}`;
        const custName = data.fullName || data.name || data.customerName || data.client || 'Online Customer';
        const custPhone = data.phoneNumber || data.phone || data.mobile || '';
        const custEmail = data.email || data.mail || '';
        const custAddress = data.address || data.location || '';
        const custCity = data.city || '';
        const custVehicle = data.vehicle || data.vehicleMakeModel || data.car || '';

        if (!autoCustomersMap.has(custId)) {
          const autoCust: Customer = {
            id: custId,
            fullName: custName,
            phoneNumber: custPhone,
            email: custEmail,
            address: custAddress,
            city: custCity,
            vehicles: custVehicle ? [custVehicle] : [],
            notes: data.notes || '',
            createdAt: lead.timestamp,
            lastServiceDate: lead.preferredDate || ''
          };
          autoCustomersMap.set(custId, autoCust);
          if (custPhone) autoCustomersMap.set(custPhone, autoCust);
        }

        // Add to calendar and bookings if not dismissed
        if (data.status !== 'Dismissed') {
          let dateStr = data.date || data.preferredDate || data.bookingDate || data.appointmentDate;
          if (!dateStr || typeof dateStr !== 'string') {
            const d = new Date();
            dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          } else if (dateStr.includes('T')) {
            dateStr = dateStr.split('T')[0];
          }

          const timeStr = data.time || data.preferredTime || data.bookingTime || data.appointmentTime || '09:00';
          const vehicle = custVehicle || 'Customer Vehicle';
          const service = data.service || data.serviceRequested || data.package || data.serviceType || 'Detailing Service';
          const notes = data.notes || data.message || '';
          const rawStatus = data.status || 'Pending';
          const status = (rawStatus === 'Approved' ? 'Confirmed' : rawStatus) as any;
          const rawPrice = typeof data.price === 'number' ? data.price : parseFloat(data.price || data.totalPrice || data.amount || 0);
          const price = isNaN(rawPrice) ? 0 : rawPrice;
          const rawDuration = typeof data.duration === 'number' ? data.duration : parseInt(data.duration || 120, 10);
          const duration = isNaN(rawDuration) ? 120 : rawDuration;
          const paymentStatus = data.paymentStatus === 'Paid' ? 'Paid' : 'Unpaid';
          const createdAt = data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (data.createdAt || data.timestamp || new Date().toISOString());

          unifiedBookings.push({
            id: docId,
            customerId: custId,
            vehicleId: data.vehicleId || '',
            vehicle,
            date: dateStr,
            time: timeStr,
            duration,
            service,
            price,
            paymentStatus,
            status,
            notes,
            createdAt,
            calendarEventId: data.calendarEventId || ''
          });
        }
      });

      // 2. Process manual bookings collection documents (if any exist)
      manualBookingsMap.forEach((data, docId) => {
        if (!publicBookingsMap.has(docId)) {
          let dateStr = data.date || data.preferredDate || data.bookingDate;
          if (!dateStr || typeof dateStr !== 'string') {
            const d = new Date();
            dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          } else if (dateStr.includes('T')) {
            dateStr = dateStr.split('T')[0];
          }

          const timeStr = data.time || data.preferredTime || data.bookingTime || '09:00';
          const vehicle = data.vehicle || data.vehicleMakeModel || data.car || '';
          const service = data.service || data.serviceRequested || data.package || 'Detailing Service';
          const notes = data.notes || data.message || '';
          const status = data.status || 'New';
          const rawPrice = typeof data.price === 'number' ? data.price : parseFloat(data.price || 0);
          const price = isNaN(rawPrice) ? 0 : rawPrice;
          const rawDuration = typeof data.duration === 'number' ? data.duration : parseInt(data.duration || 120, 10);
          const duration = isNaN(rawDuration) ? 120 : rawDuration;
          const paymentStatus = data.paymentStatus === 'Paid' ? 'Paid' : 'Unpaid';
          const createdAt = data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (data.createdAt || data.timestamp || new Date().toISOString());

          unifiedBookings.push({
            id: docId,
            customerId: data.customerId || docId,
            vehicleId: data.vehicleId || '',
            vehicle,
            date: dateStr,
            time: timeStr,
            duration,
            service,
            price,
            paymentStatus,
            status: status as any,
            notes,
            createdAt,
            calendarEventId: data.calendarEventId || ''
          });
        }
      });

      // Update states
      setIncomingRequests(allLeads);
      setBookings(unifiedBookings);

      // Deduplicate unique customer objects by ID
      const uniqueCustomers = Array.from(
        new Map(Array.from(autoCustomersMap.values()).map(c => [c.id, c])).values()
      );
      setCustomers(uniqueCustomers);
    };

    // Real-time onSnapshot listener strictly for 'public_bookings' on live database
    const unsubscribePublic = onSnapshot(collection(db, 'public_bookings'), (snapshot) => {
      publicBookingsMap.clear();
      snapshot.forEach(docSnap => {
        publicBookingsMap.set(docSnap.id, docSnap.data());
      });
      recomputeAll();
    }, (err) => {
      console.warn("Error listening to public_bookings:", err);
    });

    return () => {
      unsubscribePublic();
    };
  }, []);

  const setSheetCsvUrl = (url: string) => {
    setSheetCsvUrlState(url);
  };

  const login = async () => {};

  const clearIncomingRequests = () => {
    setIncomingRequests([]);
    toast.success('Cleared inbox view.');
  };

  // Bulk Purge Handlers to wipe old test data completely from Cloud Firestore
  const purgeAllBookings = async () => {
    setIsSyncing(true);
    try {
      const snapPublic = await getDocs(collection(db, 'public_bookings'));
      const batch = writeBatch(db);
      
      snapPublic.docs.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
      await batch.commit();

      setBookings([]);
      setIncomingRequests([]);
      toast.success(`Successfully purged ${snapPublic.size} booking(s) from database.`);
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
      setCustomers([]);
      toast.success("Successfully cleared customer list.");
    } catch (error) {
      console.error("Error purging customers:", error);
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
      setFirestoreConnected(true);

      const liveLeads = snapPublic.docs
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

  const addBooking = async (data: Omit<Booking, 'id' | 'createdAt'>) => {
    const newId = generateId('bkg');
    const now = new Date().toISOString();
    const booking = { ...data, id: newId, createdAt: now } as Booking;
    
    setBookings(prev => [booking, ...prev]);

    try {
      await setDoc(doc(db, 'public_bookings', newId), {
        ...booking,
        status: data.status || 'Confirmed',
        updatedAt: now
      });
    } catch (error) {
      console.warn("Could not save booking to public_bookings:", error);
    }

    return booking;
  };

  const updateBooking = async (id: string, updates: Partial<Booking>) => {
    setBookings(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));

    try {
      await updateDoc(doc(db, 'public_bookings', id), {
        ...updates,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.warn("Could not update booking in public_bookings:", error);
    }
  };

  const deleteBooking = async (id: string) => {
    setBookings(prev => prev.filter(b => b.id !== id));

    try {
      await deleteDoc(doc(db, 'public_bookings', id));
    } catch (error) {
      console.warn("Could not delete booking from public_bookings:", error);
    }
  };

  const addCustomer = async (data: Omit<Customer, 'id' | 'createdAt'>) => {
    const newId = generateId('cus');
    const now = new Date().toISOString();
    const customer = { ...data, id: newId, createdAt: now } as Customer;
    
    setCustomers(prev => [...prev, customer]);
    return customer;
  };

  const updateCustomer = async (id: string, updates: Partial<Customer>) => {
    setCustomers(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const deleteCustomer = async (id: string) => {
    setCustomers(prev => prev.filter(c => c.id !== id));
  };

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
