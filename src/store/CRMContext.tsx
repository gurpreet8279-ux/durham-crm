import React, { createContext, useContext, useState, useEffect } from 'react';
import { Customer, Booking, Vehicle, Service, Setting, IncomingRequest } from '../types';
import Papa from 'papaparse';
import toast from 'react-hot-toast';

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
  incomingRequests?: any[];
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
  const [user, setUser] = useState<User | null>({ id: 'admin', email: 'admin@crown', name: 'Admin' });
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  
  const [customers, setCustomers] = useState<Customer[]>(() => getStoredData().customers || []);
  const [bookings, setBookings] = useState<Booking[]>(() => getStoredData().bookings || []);
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => getStoredData().vehicles || []);
  const [incomingRequests, setIncomingRequests] = useState<any[]>(() => getStoredData().incomingRequests || []);
  const [sheetCsvUrl, setSheetCsvUrlState] = useState<string>(() => getStoredData().sheetCsvUrl || '');
  const [isSyncing, setIsSyncing] = useState(false);

  // Sync to local storage whenever CRM state changes
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
        complete: (results) => {
          const newRequests: any[] = [];
          
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
                status: 'pending'
              });
            }
          });
          
          setIncomingRequests(prev => {
            const existingIds = new Set(prev.map(r => r.id));
            const toAdd = newRequests.filter(r => !existingIds.has(r.id));
            return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
          });

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
    return customer;
  };

  const updateCustomer = async (id: string, updates: Partial<Customer>) => {
    setCustomers(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const deleteCustomer = async (id: string) => {
    setCustomers(prev => prev.filter(c => c.id !== id));
  };

  const addBooking = async (data: Omit<Booking, 'id' | 'createdAt'>) => {
    const newId = generateId('bkg');
    const now = new Date().toISOString();
    const booking = { ...data, id: newId, createdAt: now } as Booking;
    
    setBookings(prev => [booking, ...prev]);
    return booking;
  };

  const updateBooking = async (id: string, updates: Partial<Booking>) => {
    setBookings(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
  };

  const deleteBooking = async (id: string) => {
    setBookings(prev => prev.filter(b => b.id !== id));
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
    setIncomingRequests(prev => prev.map(r => r.id === id ? { ...r, status: status as any } : r));
  };

  const refreshRequests = async () => {
    await syncFromGoogleForm();
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
