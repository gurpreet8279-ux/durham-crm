import React, { createContext, useContext, useState, useEffect } from 'react';
import { Customer, Booking } from '../types';

interface CRMContextType {
  customers: Customer[];
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt'>) => Promise<Customer>;
  updateCustomer: (id: string, updates: Partial<Customer>) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
  bookings: Booking[];
  addBooking: (booking: Omit<Booking, 'id' | 'createdAt'>) => Promise<Booking>;
  updateBooking: (id: string, updates: Partial<Booking>) => Promise<void>;
  deleteBooking: (id: string) => Promise<void>;
  spreadsheetId: string | null;
  setSpreadsheetId: (id: string | null) => Promise<void>;
  calendarId: string | null;
  setCalendarId: (id: string | null) => Promise<void>;
}

const CRMContext = createContext<CRMContextType | null>(null);

function generateId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).substring(2, 9)}`;
}

export const CRMProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [customers, setCustomers] = useState<Customer[]>(() => {
    const saved = localStorage.getItem('crm_customers');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [bookings, setBookings] = useState<Booking[]>(() => {
    const saved = localStorage.getItem('crm_bookings');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [spreadsheetId, setSpreadsheetIdState] = useState<string | null>(null);
  const [calendarId, setCalendarIdState] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('crm_customers', JSON.stringify(customers));
  }, [customers]);

  useEffect(() => {
    localStorage.setItem('crm_bookings', JSON.stringify(bookings));
  }, [bookings]);

  const addCustomer = async (customerData: Omit<Customer, 'id' | 'createdAt'>) => {
    const id = generateId('cus');
    const newCustomer: Customer = {
      ...customerData,
      id,
      createdAt: new Date().toISOString(),
    };
    setCustomers(prev => [newCustomer, ...prev]);
    return newCustomer;
  };

  const updateCustomer = async (id: string, updates: Partial<Customer>) => {
    setCustomers(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const deleteCustomer = async (id: string) => {
    setCustomers(prev => prev.filter(c => c.id !== id));
  };

  const addBooking = async (bookingData: Omit<Booking, 'id' | 'createdAt'>) => {
    const id = generateId('bkg');
    const newBooking: Booking = {
      ...bookingData,
      id,
      createdAt: new Date().toISOString(),
    };
    setBookings(prev => [newBooking, ...prev]);
    return newBooking;
  };

  const updateBooking = async (id: string, updates: Partial<Booking>) => {
    setBookings(prev => {
      const updated = prev.map(b => b.id === id ? { ...b, ...updates } : b);
      const changedBooking = updated.find(b => b.id === id);
      
      // Auto-update customer history if completed
      if (changedBooking && (updates.status === 'Completed' || updates.status === 'Paid')) {
        if (changedBooking.customerId) {
          updateCustomer(changedBooking.customerId, { lastServiceDate: changedBooking.date });
        }
      }
      return updated;
    });
  };

  const deleteBooking = async (id: string) => {
    setBookings(prev => prev.filter(b => b.id !== id));
  };

  const setSpreadsheetId = async (id: string | null) => {
    setSpreadsheetIdState(id);
  };

  const setCalendarId = async (id: string | null) => {
    setCalendarIdState(id);
  };

  return (
    <CRMContext.Provider value={{
      customers, addCustomer, updateCustomer, deleteCustomer,
      bookings, addBooking, updateBooking, deleteBooking,
      spreadsheetId, setSpreadsheetId,
      calendarId, setCalendarId
    }}>
      {children}
    </CRMContext.Provider>
  );
};

export const useCRM = () => {
  const context = useContext(CRMContext);
  if (!context) throw new Error('useCRM must be used within CRMProvider');
  return context;
};
