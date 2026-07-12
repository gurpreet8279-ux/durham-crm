import React, { createContext, useContext, useState, useEffect } from 'react';
import { Customer, Booking, Vehicle, Service, Setting, IncomingRequest } from '../types';
import Papa from 'papaparse';

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

export const CRMProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>({ id: 'admin', email: 'admin@crown', name: 'Admin' });
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
  
  const [sheetCsvUrl, setSheetCsvUrlState] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState(false);

  const loadData = () => {
    try {
      const data = localStorage.getItem('crown_crm_data');
      if (data) {
        const parsed = JSON.parse(data);
        setCustomers(parsed.customers || []);
        setBookings(parsed.bookings || []);
        setVehicles(parsed.vehicles || []);
        setIncomingRequests(parsed.incomingRequests || []);
        setSheetCsvUrlState(parsed.sheetCsvUrl || '');
      }
    } catch (e: any) {
      console.error("Failed to load local data", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const triggerSave = (newData: any) => {
    try {
      localStorage.setItem('crown_crm_data', JSON.stringify(newData));
    } catch (e) {
      console.error("Failed to sync to local storage", e);
    }
  };
  
  const setSheetCsvUrl = (url: string) => {
    setSheetCsvUrlState(url);
    triggerSave({ customers, bookings, vehicles, incomingRequests, sheetCsvUrl: url });
  };

  const login = async () => {};
  
  const syncFromGoogleForm = async () => {
    if (!sheetCsvUrl) {
      alert("Please enter a Google Sheet CSV URL in the Admin tab.");
      return;
    }
    
    setIsSyncing(true);
    try {
      const response = await fetch(sheetCsvUrl);
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
            
            const timestamp = getVal(['timestamp', 'date', 'time']);
            const fullName = getVal(['name', 'first', 'last']);
            const phoneNumber = getVal(['phone', 'mobile', 'cell']);
            const email = getVal(['email']);
            const address = getVal(['address', 'location']);
            const city = getVal(['city', 'town']);
            const vehicleMakeModel = getVal(['vehicle', 'make', 'model', 'car']);
            const serviceRequested = getVal(['service', 'package', 'detail']);
            const preferredDate = getVal(['date']);
            const preferredTime = getVal(['time']);
            const notes = getVal(['notes', 'message', 'additional']);
            
            if (timestamp && fullName) {
              const id = `req_${btoa(timestamp + fullName).replace(/[^a-zA-Z0-9]/g, '').substring(0, 15)}`;
              
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
             
             if (toAdd.length === 0) {
               alert("No new requests found. You're all caught up!");
               return prev;
             }
             
             const updated = [...prev, ...toAdd];
             triggerSave({ customers, bookings, vehicles, incomingRequests: updated, sheetCsvUrl });
             alert(`Successfully imported ${toAdd.length} new request(s)!`);
             return updated;
          });
        },
        error: (error) => {
          console.error("CSV Parse Error:", error);
          alert("Error parsing the Google Form data.");
        }
      });
    } catch (error) {
      console.error("Sync Error:", error);
      alert("Failed to sync from Google Forms. Please ensure you copied the 'Published to the web (CSV)' URL correctly.");
    } finally {
      setIsSyncing(false);
    }
  };

  const addCustomer = async (data: Omit<Customer, 'id' | 'createdAt'>) => {
    const newId = generateId('cus');
    const now = new Date().toISOString();
    const customer = { ...data, id: newId, createdAt: now } as Customer;
    
    setCustomers(prev => {
      const updated = [...prev, customer];
      triggerSave({ customers: updated, bookings, vehicles, incomingRequests, sheetCsvUrl });
      return updated;
    });
    return customer;
  };

  const updateCustomer = async (id: string, updates: Partial<Customer>) => {
    setCustomers(prev => {
      const updated = prev.map(c => c.id === id ? { ...c, ...updates } : c);
      triggerSave({ customers: updated, bookings, vehicles, incomingRequests, sheetCsvUrl });
      return updated;
    });
  };

  const deleteCustomer = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this customer? This action cannot be undone.")) return;
    setCustomers(prev => {
      const updated = prev.filter(c => c.id !== id);
      triggerSave({ customers: updated, bookings, vehicles, incomingRequests, sheetCsvUrl });
      return updated;
    });
  };

  const addBooking = async (data: Omit<Booking, 'id' | 'createdAt'>) => {
    const newId = generateId('bkg');
    const now = new Date().toISOString();
    const booking = { ...data, id: newId, createdAt: now } as Booking;
    
    setBookings(prev => {
      const updated = [booking, ...prev];
      triggerSave({ customers, bookings: updated, vehicles, incomingRequests, sheetCsvUrl });
      return updated;
    });
    return booking;
  };

  const updateBooking = async (id: string, updates: Partial<Booking>) => {
    setBookings(prev => {
      const updated = prev.map(b => b.id === id ? { ...b, ...updates } : b);
      triggerSave({ customers, bookings: updated, vehicles, incomingRequests, sheetCsvUrl });
      return updated;
    });
  };

  const deleteBooking = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this booking? This action cannot be undone.")) return;
    setBookings(prev => {
      const updated = prev.filter(b => b.id !== id);
      triggerSave({ customers, bookings: updated, vehicles, incomingRequests, sheetCsvUrl });
      return updated;
    });
  };

  const addVehicle = async (data: Omit<Vehicle, 'id' | 'createdAt'>) => {
    const newId = generateId('veh');
    const now = new Date().toISOString();
    const vehicle = { ...data, id: newId, createdAt: now } as Vehicle;
    
    setVehicles(prev => {
      const updated = [...prev, vehicle];
      triggerSave({ customers, bookings, vehicles: updated, incomingRequests, sheetCsvUrl });
      return updated;
    });
    return vehicle;
  };

  const updateVehicle = async (id: string, updates: Partial<Vehicle>) => {
    setVehicles(prev => {
      const updated = prev.map(v => v.id === id ? { ...v, ...updates } : v);
      triggerSave({ customers, bookings, vehicles: updated, incomingRequests, sheetCsvUrl });
      return updated;
    });
  };

  const deleteVehicle = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this vehicle? This action cannot be undone.")) return;
    setVehicles(prev => {
      const updated = prev.filter(v => v.id !== id);
      triggerSave({ customers, bookings, vehicles: updated, incomingRequests, sheetCsvUrl });
      return updated;
    });
  };

  const updateIncomingRequest = async (id: string, status: string) => {
    setIncomingRequests(prev => {
      const updated = prev.map(r => r.id === id ? { ...r, status: status as any } : r);
      triggerSave({ customers, bookings, vehicles, incomingRequests: updated, sheetCsvUrl });
      return updated;
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
