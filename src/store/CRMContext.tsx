import React, { createContext, useContext, useState, useEffect } from 'react';
import { Customer, Booking, Vehicle, Service, Setting, IncomingRequest } from '../types';

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
  updateIncomingRequest: (rowNum: string, status: string) => Promise<void>;
  refreshRequests: () => Promise<void>;
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
  const [incomingRequests, setIncomingRequests] = useState<IncomingRequest[]>([]);

  const loadData = () => {
    try {
      const data = localStorage.getItem('crown_crm_data');
      if (data) {
        const parsed = JSON.parse(data);
        setCustomers(parsed.customers || []);
        setBookings(parsed.bookings || []);
        setVehicles(parsed.vehicles || []);
        setIncomingRequests(parsed.incomingRequests || []);
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

  // Helper to trigger save
  const triggerSave = (newData: any) => {
    try {
      localStorage.setItem('crown_crm_data', JSON.stringify(newData));
    } catch (e) {
      console.error("Failed to sync to local storage", e);
    }
  };

  const login = async () => {
    // Handled by AuthWrapper if needed (now disabled)
  };

  const addCustomer = async (data: Omit<Customer, 'id' | 'createdAt'>) => {
    const newId = generateId('cus');
    const now = new Date().toISOString();
    const customer = { ...data, id: newId, createdAt: now } as Customer;
    
    setCustomers(prev => {
      const updated = [...prev, customer];
      triggerSave({ customers: updated, bookings, vehicles, incomingRequests });
      return updated;
    });
    return customer;
  };

  const updateCustomer = async (id: string, updates: Partial<Customer>) => {
    setCustomers(prev => {
      const updated = prev.map(c => c.id === id ? { ...c, ...updates } : c);
      triggerSave({ customers: updated, bookings, vehicles, incomingRequests });
      return updated;
    });
  };

  const deleteCustomer = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this customer? This action cannot be undone.")) return;
    setCustomers(prev => {
      const updated = prev.filter(c => c.id !== id);
      triggerSave({ customers: updated, bookings, vehicles, incomingRequests });
      return updated;
    });
  };

  const addBooking = async (data: Omit<Booking, 'id' | 'createdAt'>) => {
    const newId = generateId('bkg');
    const now = new Date().toISOString();
    const booking = { ...data, id: newId, createdAt: now } as Booking;
    
    setBookings(prev => {
      const updated = [booking, ...prev];
      triggerSave({ customers, bookings: updated, vehicles, incomingRequests });
      return updated;
    });
    return booking;
  };

  const updateBooking = async (id: string, updates: Partial<Booking>) => {
    setBookings(prev => {
      const updated = prev.map(b => b.id === id ? { ...b, ...updates } : b);
      triggerSave({ customers, bookings: updated, vehicles, incomingRequests });
      return updated;
    });
  };

  const deleteBooking = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this booking? This action cannot be undone.")) return;
    setBookings(prev => {
      const updated = prev.filter(b => b.id !== id);
      triggerSave({ customers, bookings: updated, vehicles, incomingRequests });
      return updated;
    });
  };

  const addVehicle = async (data: Omit<Vehicle, 'id' | 'createdAt'>) => {
    const newId = generateId('veh');
    const now = new Date().toISOString();
    const vehicle = { ...data, id: newId, createdAt: now } as Vehicle;
    
    setVehicles(prev => {
      const updated = [...prev, vehicle];
      triggerSave({ customers, bookings, vehicles: updated, incomingRequests });
      return updated;
    });
    return vehicle;
  };

  const updateVehicle = async (id: string, updates: Partial<Vehicle>) => {
    setVehicles(prev => {
      const updated = prev.map(v => v.id === id ? { ...v, ...updates } : v);
      triggerSave({ customers, bookings, vehicles: updated, incomingRequests });
      return updated;
    });
  };

  const deleteVehicle = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this vehicle? This action cannot be undone.")) return;
    setVehicles(prev => {
      const updated = prev.filter(v => v.id !== id);
      triggerSave({ customers, bookings, vehicles: updated, incomingRequests });
      return updated;
    });
  };

  const updateIncomingRequest = async (id: string, status: string) => {
    setIncomingRequests(prev => {
      const updated = prev.map(r => r.id === id ? { ...r, status: status as any } : r);
      triggerSave({ customers, bookings, vehicles, incomingRequests: updated });
      return updated;
    });
  };

  const refreshRequests = async () => {
    loadData();
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
      refreshRequests
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
