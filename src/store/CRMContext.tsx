import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Customer, Booking } from '../types';
import { syncToGoogleSheets, syncToGoogleCalendar, deleteFromGoogleCalendar } from '../lib/workspace';

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
  
  const [spreadsheetId, setSpreadsheetIdState] = useState<string | null>(() => {
    return localStorage.getItem('crm_spreadsheetId');
  });
  
  const [calendarId, setCalendarIdState] = useState<string | null>(() => {
    return localStorage.getItem('crm_calendarId');
  });

  const isInitialMount = useRef(true);

  useEffect(() => {
    localStorage.setItem('crm_customers', JSON.stringify(customers));
    localStorage.setItem('crm_bookings', JSON.stringify(bookings));
    
    // Background sync to Google Sheets
    if (spreadsheetId && !isInitialMount.current) {
      syncToGoogleSheets(spreadsheetId, customers, bookings).catch(err => {
        console.error('Failed to sync to sheets:', err);
      });
    }
  }, [customers, bookings, spreadsheetId]);

  useEffect(() => {
    isInitialMount.current = false;
  }, []);

  const setSpreadsheetId = async (id: string | null) => {
    setSpreadsheetIdState(id);
    if (id) {
      localStorage.setItem('crm_spreadsheetId', id);
    } else {
      localStorage.removeItem('crm_spreadsheetId');
    }
  };

  const setCalendarId = async (id: string | null) => {
    setCalendarIdState(id);
    if (id) {
      localStorage.setItem('crm_calendarId', id);
    } else {
      localStorage.removeItem('crm_calendarId');
    }
  };

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
    let newBooking: Booking = {
      ...bookingData,
      id,
      createdAt: new Date().toISOString(),
    };

    if (calendarId) {
      try {
        const customer = customers.find(c => c.id === bookingData.customerId);
        const eventId = await syncToGoogleCalendar(newBooking, customer, calendarId);
        newBooking.calendarEventId = eventId;
      } catch (err) {
        console.error('Failed to sync to calendar:', err);
      }
    }

    setBookings(prev => [newBooking, ...prev]);
    return newBooking;
  };

  const updateBooking = async (id: string, updates: Partial<Booking>) => {
    setBookings(prev => {
      const updated = prev.map(b => b.id === id ? { ...b, ...updates } : b);
      const changedBooking = updated.find(b => b.id === id);
      return updated;
    });

    // We do the async sync after state update so UI is fast
    setTimeout(async () => {
      const currentBooking = bookings.find(b => b.id === id);
      if (!currentBooking) return;
      const updatedBooking = { ...currentBooking, ...updates };
      
      // Auto-update customer history if completed
      if (updates.status === 'Completed' || updates.status === 'Paid') {
        if (updatedBooking.customerId) {
          updateCustomer(updatedBooking.customerId, { lastServiceDate: updatedBooking.date });
        }
      }

      if (calendarId) {
        try {
          const customer = customers.find(c => c.id === updatedBooking.customerId);
          const eventId = await syncToGoogleCalendar(updatedBooking, customer, calendarId);
          if (eventId !== updatedBooking.calendarEventId) {
            setBookings(prev => prev.map(b => b.id === id ? { ...b, calendarEventId: eventId } : b));
          }
        } catch (err) {
          console.error('Failed to sync update to calendar:', err);
        }
      }
    }, 0);
  };

  const deleteBooking = async (id: string) => {
    const bookingToDelete = bookings.find(b => b.id === id);
    
    if (bookingToDelete && bookingToDelete.calendarEventId && calendarId) {
      deleteFromGoogleCalendar(bookingToDelete.calendarEventId, calendarId).catch(err => {
        console.error('Failed to delete from calendar:', err);
      });
    }

    setBookings(prev => prev.filter(b => b.id !== id));
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
