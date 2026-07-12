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

  const fetchWithToken = async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('app_token');
    const res = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    if (res.status === 401) {
      localStorage.removeItem('app_token');
      window.location.reload();
    }
    return res;
  };

  const loadData = async () => {
    try {
      const res = await fetchWithToken('/api/data');
      const data = await res.json();
      setCustomers(data.customers || []);
      setBookings(data.bookings || []);
      setVehicles(data.vehicles || []);
      setIncomingRequests(data.incomingRequests || []);
    } catch (e) {
      console.error("Failed to load data", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const login = async () => {
    // Handled by AuthWrapper
  };

  const addCustomer = async (data: Omit<Customer, 'id' | 'createdAt'>) => {
    const newId = generateId('cus');
    const now = new Date().toISOString();
    
    const customer = { ...data, id: newId, createdAt: now };
    await fetchWithToken('/api/customers', {
      method: 'POST',
      body: JSON.stringify(customer)
    });
    setCustomers(prev => [...prev, customer]);
    return customer as Customer;
  };

  const updateCustomer = async (id: string, updates: Partial<Customer>) => {
    await fetchWithToken(`/api/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
    setCustomers(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const deleteCustomer = async (id: string) => {
    await fetchWithToken(`/api/customers/${id}`, { method: 'DELETE' });
    setCustomers(prev => prev.filter(c => c.id !== id));
  };

  const addBooking = async (data: Omit<Booking, 'id' | 'createdAt'>) => {
    const newId = generateId('bkg');
    const now = new Date().toISOString();
    
    const booking = { ...data, id: newId, createdAt: now };
    await fetchWithToken('/api/bookings', {
      method: 'POST',
      body: JSON.stringify(booking)
    });
    setBookings(prev => [booking as Booking, ...prev]);
    return booking as Booking;
  };

  const updateBooking = async (id: string, updates: Partial<Booking>) => {
    await fetchWithToken(`/api/bookings/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
    setBookings(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
  };

  const deleteBooking = async (id: string) => {
    await fetchWithToken(`/api/bookings/${id}`, { method: 'DELETE' });
    setBookings(prev => prev.filter(b => b.id !== id));
  };

  const addVehicle = async (data: Omit<Vehicle, 'id' | 'createdAt'>) => {
    const newId = generateId('veh');
    const now = new Date().toISOString();
    
    const vehicle = { ...data, id: newId, createdAt: now };
    await fetchWithToken('/api/vehicles', {
      method: 'POST',
      body: JSON.stringify(vehicle)
    });
    setVehicles(prev => [...prev, vehicle as Vehicle]);
    return vehicle as Vehicle;
  };

  const updateVehicle = async (id: string, updates: Partial<Vehicle>) => {
    await fetchWithToken(`/api/vehicles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
    setVehicles(prev => prev.map(v => v.id === id ? { ...v, ...updates } : v));
  };

  const deleteVehicle = async (id: string) => {
    await fetchWithToken(`/api/vehicles/${id}`, { method: 'DELETE' });
    setVehicles(prev => prev.filter(v => v.id !== id));
  };

  const updateIncomingRequest = async (id: string, status: string) => {
    await fetchWithToken(`/api/requests/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
    setIncomingRequests(prev => prev.map(r => r.id === id ? { ...r, status: status as any } : r));
  };

  const refreshRequests = async () => {
    await loadData();
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
