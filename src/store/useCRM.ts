import { useState, useEffect } from 'react';
import { Customer, Booking } from '../types';

function generateId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).substring(2, 9)}`;
}

export function useCRM() {
  const [customers, setCustomers] = useState<Customer[]>(() => {
    const saved = localStorage.getItem('crm_customers');
    return saved ? JSON.parse(saved) : [];
  });

  const [bookings, setBookings] = useState<Booking[]>(() => {
    const saved = localStorage.getItem('crm_bookings');
    return saved ? JSON.parse(saved) : [];
  });

  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(() => {
    return localStorage.getItem('crm_spreadsheet_id');
  });

  useEffect(() => {
    localStorage.setItem('crm_customers', JSON.stringify(customers));
  }, [customers]);

  useEffect(() => {
    localStorage.setItem('crm_bookings', JSON.stringify(bookings));
  }, [bookings]);

  useEffect(() => {
    if (spreadsheetId) {
      localStorage.setItem('crm_spreadsheet_id', spreadsheetId);
    } else {
      localStorage.removeItem('crm_spreadsheet_id');
    }
  }, [spreadsheetId]);

  const addCustomer = (customerData: Omit<Customer, 'id' | 'createdAt'>) => {
    const newCustomer: Customer = {
      ...customerData,
      id: generateId('cus'),
      createdAt: new Date().toISOString(),
    };
    setCustomers((prev) => [newCustomer, ...prev]);
    return newCustomer;
  };

  const updateCustomer = (id: string, updates: Partial<Customer>) => {
    setCustomers((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  };

  const deleteCustomer = (id: string) => {
    setCustomers((prev) => prev.filter((c) => c.id !== id));
  };

  const addBooking = (bookingData: Omit<Booking, 'id' | 'createdAt'>) => {
    const newBooking: Booking = {
      ...bookingData,
      id: generateId('bkg'),
      createdAt: new Date().toISOString(),
    };
    setBookings((prev) => [newBooking, ...prev]);
    return newBooking;
  };

  const updateBooking = (id: string, updates: Partial<Booking>) => {
    setBookings((prev) => {
      const updatedBookings = prev.map((b) => (b.id === id ? { ...b, ...updates } : b));
      
      // Auto-update customer history if completed
      if (updates.status === 'Completed' || updates.status === 'Paid') {
        const booking = updatedBookings.find(b => b.id === id);
        if (booking && booking.customerId) {
          updateCustomer(booking.customerId, { lastServiceDate: booking.date });
        }
      }
      return updatedBookings;
    });
  };

  const deleteBooking = (id: string) => {
    setBookings((prev) => prev.filter((b) => b.id !== id));
  };

  return {
    customers,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    bookings,
    addBooking,
    updateBooking,
    deleteBooking,
    spreadsheetId,
    setSpreadsheetId,
  };
}
