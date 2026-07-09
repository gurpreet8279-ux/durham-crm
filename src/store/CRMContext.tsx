import React, { createContext, useContext, useState, useEffect } from 'react';
import { Customer, Booking } from '../types';
import { db, auth } from '../lib/firebase';
import { collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp, query } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

interface CRMContextType {
  customers: Customer[];
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt'>) => Promise<Customer>;
  updateCustomer: (id: string, updates: Partial<Customer>) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
  bookings: Booking[];
  addBooking: (booking: Omit<Booking, 'id' | 'createdAt'>) => Promise<Booking>;
  updateBooking: (id: string, updates: Partial<Booking>) => Promise<void>;
  deleteBooking: (id: string) => Promise<void>;
}

const CRMContext = createContext<CRMContextType | null>(null);

function generateId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).substring(2, 9)}`;
}

export const CRMProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUserId(user ? user.uid : null);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) {
      setCustomers([]);
      setBookings([]);
      return;
    }

    const customersRef = collection(db, 'users', userId, 'customers');
    const unsubscribeCustomers = onSnapshot(query(customersRef), (snapshot) => {
      const data: Customer[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as Customer);
      });
      // sort by createdAt descending
      data.sort((a, b) => {
        const aDate = typeof a.createdAt === 'string' ? new Date(a.createdAt).getTime() : 0;
        const bDate = typeof b.createdAt === 'string' ? new Date(b.createdAt).getTime() : 0;
        return bDate - aDate;
      });
      setCustomers(data);
    }, (err) => {
      console.error("Customers sync error:", err);
    });

    const bookingsRef = collection(db, 'users', userId, 'bookings');
    const unsubscribeBookings = onSnapshot(query(bookingsRef), (snapshot) => {
      const data: Booking[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as Booking);
      });
      data.sort((a, b) => {
        const aDate = typeof a.createdAt === 'string' ? new Date(a.createdAt).getTime() : 0;
        const bDate = typeof b.createdAt === 'string' ? new Date(b.createdAt).getTime() : 0;
        return bDate - aDate;
      });
      setBookings(data);
    }, (err) => {
      console.error("Bookings sync error:", err);
    });

    return () => {
      unsubscribeCustomers();
      unsubscribeBookings();
    };
  }, [userId]);

  const addCustomer = async (customerData: Omit<Customer, 'id' | 'createdAt'>) => {
    if (!userId) throw new Error("Not logged in");
    const id = generateId('cus');
    
    // Default values if undefined
    const firestoreData: any = {
      userId,
      fullName: customerData.fullName || "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (customerData.phoneNumber) firestoreData.phoneNumber = customerData.phoneNumber;
    if (customerData.email) firestoreData.email = customerData.email;
    if (customerData.address) firestoreData.address = customerData.address;
    if (customerData.city) firestoreData.city = customerData.city;
    if (customerData.vehicles) firestoreData.vehicles = customerData.vehicles;
    if (customerData.notes) firestoreData.notes = customerData.notes;
    if (customerData.lastServiceDate) firestoreData.lastServiceDate = customerData.lastServiceDate;

    await setDoc(doc(db, 'users', userId, 'customers', id), firestoreData);
    
    return {
      ...customerData,
      id,
      createdAt: new Date().toISOString()
    } as Customer;
  };

  const updateCustomer = async (id: string, updates: Partial<Customer>) => {
    if (!userId) return;
    const updateData: any = { ...updates, updatedAt: serverTimestamp() };
    await updateDoc(doc(db, 'users', userId, 'customers', id), updateData);
  };

  const deleteCustomer = async (id: string) => {
    if (!userId) return;
    await deleteDoc(doc(db, 'users', userId, 'customers', id));
  };

  const addBooking = async (bookingData: Omit<Booking, 'id' | 'createdAt'>) => {
    if (!userId) throw new Error("Not logged in");
    const id = generateId('bkg');

    const firestoreData: any = {
      userId,
      customerId: bookingData.customerId,
      date: bookingData.date,
      service: bookingData.service,
      status: bookingData.status,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    if (bookingData.time) firestoreData.time = bookingData.time;
    if (bookingData.vehicle) firestoreData.vehicle = bookingData.vehicle;
    if (bookingData.price) firestoreData.price = bookingData.price;
    if (bookingData.paymentStatus) firestoreData.paymentStatus = bookingData.paymentStatus;
    if (bookingData.notes) firestoreData.notes = bookingData.notes;
    if (bookingData.duration) firestoreData.duration = bookingData.duration;

    await setDoc(doc(db, 'users', userId, 'bookings', id), firestoreData);

    return {
      ...bookingData,
      id,
      createdAt: new Date().toISOString()
    } as Booking;
  };

  const updateBooking = async (id: string, updates: Partial<Booking>) => {
    if (!userId) return;
    const updateData: any = { ...updates, updatedAt: serverTimestamp() };
    await updateDoc(doc(db, 'users', userId, 'bookings', id), updateData);
    
    // Auto-update customer history if completed
    if (updates.status === 'Completed' || updates.status === 'Paid') {
      const bkg = bookings.find(b => b.id === id);
      if (bkg && bkg.customerId) {
        // Need to pass the actual date, here we just use bkg.date 
        // if updates doesn't have it
        const finalDate = updates.date || bkg.date;
        await updateCustomer(bkg.customerId, { lastServiceDate: finalDate });
      }
    }
  };

  const deleteBooking = async (id: string) => {
    if (!userId) return;
    await deleteDoc(doc(db, 'users', userId, 'bookings', id));
  };

  return (
    <CRMContext.Provider value={{
      customers, addCustomer, updateCustomer, deleteCustomer,
      bookings, addBooking, updateBooking, deleteBooking
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
