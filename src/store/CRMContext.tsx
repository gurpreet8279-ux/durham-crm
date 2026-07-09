import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Customer, Booking } from '../types';
import { syncToGoogleCalendar, deleteFromGoogleCalendar } from '../lib/workspace';

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
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [spreadsheetId, setSpreadsheetIdState] = useState<string | null>(null);
  const [calendarId, setCalendarIdState] = useState<string | null>(null);

  useEffect(() => {
    const qCustomers = query(collection(db, 'customers'), orderBy('createdAt', 'desc'));
    const unsubscribeCustomers = onSnapshot(qCustomers, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
      setCustomers(data);
    });

    const qBookings = query(collection(db, 'bookings'), orderBy('createdAt', 'desc'));
    const unsubscribeBookings = onSnapshot(qBookings, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking));
      setBookings(data);
    });

    const unsubscribeSettings = onSnapshot(doc(db, 'settings', 'general'), (doc) => {
      if (doc.exists()) {
        setSpreadsheetIdState(doc.data().spreadsheetId || null);
        setCalendarIdState(doc.data().calendarId || null);
      }
    });

    return () => {
      unsubscribeCustomers();
      unsubscribeBookings();
      unsubscribeSettings();
    };
  }, []);

  const addCustomer = async (customerData: Omit<Customer, 'id' | 'createdAt'>) => {
    const id = generateId('cus');
    const newCustomer: Customer = {
      ...customerData,
      id,
      createdAt: new Date().toISOString(),
    };
    await setDoc(doc(db, 'customers', id), newCustomer);
    return newCustomer;
  };

  const updateCustomer = async (id: string, updates: Partial<Customer>) => {
    await updateDoc(doc(db, 'customers', id), updates);
  };

  const deleteCustomer = async (id: string) => {
    await deleteDoc(doc(db, 'customers', id));
  };

  const addBooking = async (bookingData: Omit<Booking, 'id' | 'createdAt'>) => {
    const id = generateId('bkg');
    const newBooking: Booking = {
      ...bookingData,
      id,
      createdAt: new Date().toISOString(),
    };
    
    // Attempt calendar sync
    if (calendarId) {
      try {
        const c = customers.find(c => c.id === newBooking.customerId);
        const eventId = await syncToGoogleCalendar(newBooking, c, calendarId);
        newBooking.calendarEventId = eventId;
      } catch (e) {
        console.error("Failed to auto-create calendar event", e);
      }
    }

    await setDoc(doc(db, 'bookings', id), newBooking);
    return newBooking;
  };

  const updateBooking = async (id: string, updates: Partial<Booking>) => {
    const bookingRef = doc(db, 'bookings', id);
    const bookingDoc = await getDoc(bookingRef);
    if (!bookingDoc.exists()) return;
    
    const existing = bookingDoc.data() as Booking;
    const merged = { ...existing, ...updates };

    // Sync to calendar if date/time/details changed
    if (calendarId && (updates.date || updates.time || updates.service || updates.notes)) {
      try {
        const c = customers.find(c => c.id === merged.customerId);
        const eventId = await syncToGoogleCalendar(merged, c, calendarId);
        if (eventId !== merged.calendarEventId) {
          updates.calendarEventId = eventId;
        }
      } catch (e) {
        console.error("Failed to auto-update calendar event", e);
      }
    }

    await updateDoc(bookingRef, updates);
    
    // Auto-update customer history if completed
    if (updates.status === 'Completed' || updates.status === 'Paid') {
      if (merged.customerId) {
        await updateCustomer(merged.customerId, { lastServiceDate: merged.date });
      }
    }
  };

  const deleteBooking = async (id: string) => {
    const bookingDoc = await getDoc(doc(db, 'bookings', id));
    if (bookingDoc.exists()) {
      const data = bookingDoc.data() as Booking;
      if (data.calendarEventId && calendarId) {
        try {
          await deleteFromGoogleCalendar(data.calendarEventId, calendarId);
        } catch (e) {
          console.error("Failed to auto-delete calendar event", e);
        }
      }
    }
    await deleteDoc(doc(db, 'bookings', id));
  };

  const setSpreadsheetId = async (id: string | null) => {
    await setDoc(doc(db, 'settings', 'general'), { spreadsheetId: id }, { merge: true });
    setSpreadsheetIdState(id);
  };

  const setCalendarId = async (id: string | null) => {
    await setDoc(doc(db, 'settings', 'general'), { calendarId: id }, { merge: true });
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
