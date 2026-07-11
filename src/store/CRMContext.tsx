import React, { createContext, useContext, useState, useEffect } from 'react';
import { Customer, Booking, Vehicle, Service, Setting } from '../types';
import { findOrCreateSpreadsheet, getSheetData, appendRow, updateRow, fetchWithAuth } from '../lib/sheets';

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
}

const CRMContext = createContext<CRMContextType | null>(null);

function generateId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).substring(2, 9)}`;
}

export const CRMProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null);
  const [sheetIds, setSheetIds] = useState<Record<string, number>>({});
  
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  useEffect(() => {
    const initializeApp = async () => {
      const token = localStorage.getItem('google_access_token');
      if (!token) {
        setUser(null);
        setCustomers([]);
        setBookings([]);
        setVehicles([]);
        setSpreadsheetId(null);
        setAuthError(null);
        setLoading(false);
        return;
      }

      try {
        const tokenInfoRes = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${token}`);
        if (!tokenInfoRes.ok) {
          throw new Error('token might be expired');
        }
        
        const tokenInfo = await tokenInfoRes.json();
        const scopes = tokenInfo.scope || '';
        if (!scopes.includes('auth/drive.file') || !scopes.includes('auth/spreadsheets')) {
          throw new Error('missing_scopes');
        }

        const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (!userInfoRes.ok) {
          throw new Error('Failed to fetch user info - token might be expired');
        }
        
        const userInfo = await userInfoRes.json();
        setUser({
          id: userInfo.sub,
          email: userInfo.email,
          name: userInfo.name
        });
        setAuthError(null);

        const id = await findOrCreateSpreadsheet();
        setSpreadsheetId(id);
        
        // Get sheet IDs for row deletion
        const meta = await fetchWithAuth(`https://sheets.googleapis.com/v4/spreadsheets/${id}?fields=sheets.properties(sheetId,title)`);
        const ids: Record<string, number> = {};
        meta.sheets.forEach((s: any) => {
          ids[s.properties.title] = s.properties.sheetId;
        });
        setSheetIds(ids);
        
        await loadData(id);
      } catch (e: any) {
        console.error("Error setting up sheets", e);
        if (e.message && e.message.includes('403')) {
          setAuthError('Google Sheets access denied. The API might not be enabled on your Google Cloud Project, or the file is restricted.');
        } else if (e.message && e.message.includes('missing_scopes')) {
          setAuthError('Permissions missing. Please Sign Out, then sign in again and ENSURE you check the boxes to grant access to Google Drive and Google Sheets on the consent screen.');
        } else if (e.message && e.message.includes('token might be expired')) {
          localStorage.removeItem('google_access_token');
          import('../lib/firebaseAuth').then(m => m.logout());
          window.location.reload();
        } else {
          setAuthError(e.message || 'Error connecting to Google Sheets.');
        }
      } finally {
        setLoading(false);
      }
    };

    initializeApp();
  }, []);

  useEffect(() => {
    if (!spreadsheetId) return;
    
    // Poll for changes every 30 seconds
    const interval = setInterval(() => {
      loadData(spreadsheetId);
    }, 30000);
    
    return () => clearInterval(interval);
  }, [spreadsheetId]);

  const login = async () => {
    // handled by wrapper
  };

  const loadData = async (id: string) => {
    try {
      const [customersData, bookingsData, vehiclesData] = await Promise.all([
        getSheetData(id, 'Customers!A2:K'),
        getSheetData(id, 'Bookings!A2:N'),
        getSheetData(id, 'Vehicles!A2:G')
      ]);

      setCustomers(customersData.map(row => ({
        id: row[0] || '',
        fullName: row[1] || '',
        phoneNumber: row[2] || '',
        email: row[3] || '',
        address: row[4] || '',
        city: row[5] || '',
        notes: row[6] || '',
        createdAt: row[7] || '',
        lastServiceDate: row[8] || '',
        vehicles: (() => {
          try {
            return row[10] ? JSON.parse(row[10]) : [];
          } catch (e) {
            return [];
          }
        })()
      })).reverse());

      setBookings(bookingsData.map(row => ({
        id: row[0] || '',
        customerId: row[1] || '',
        vehicleId: row[2] || '',
        date: row[3] || '',
        time: row[4] || '',
        duration: row[5] ? parseInt(row[5]) : undefined,
        service: row[6] || '',
        price: row[7] ? parseFloat(row[7]) : undefined,
        paymentStatus: row[8] || 'Unpaid',
        status: row[9] || 'Pending',
        notes: row[10] || '',
        createdAt: row[11] || '',
        calendarEventId: row[12] || '',
      })).reverse());

      setVehicles(vehiclesData.map(row => ({
        id: row[0] || '',
        customerId: row[1] || '',
        makeModel: row[2] || '',
        year: row[3] || '',
        color: row[4] || '',
        licensePlate: row[5] || '',
        createdAt: row[6] || '',
      })));
    } catch (e) {
      console.error("Failed to load data from sheets", e);
    }
  };

  const findRowIndex = async (sheetName: string, id: string) => {
    if (!spreadsheetId) throw new Error("No spreadsheet connected");
    const data = await getSheetData(spreadsheetId, `${sheetName}!A:A`);
    const rowIndex = data.findIndex(row => row[0] === id);
    if (rowIndex === -1) throw new Error("Row not found");
    return rowIndex + 1; // 1-indexed for sheets
  };

  const addCustomer = async (data: Omit<Customer, 'id' | 'createdAt'>) => {
    if (!spreadsheetId) throw new Error("No spreadsheet connected");
    const newId = generateId('cus');
    const now = new Date().toISOString();
    
    const row = [
      newId, data.fullName, data.phoneNumber, data.email || '', 
      data.address || '', data.city || '', data.notes || '', 
      now, data.lastServiceDate || '', now, JSON.stringify(data.vehicles || [])
    ];
    
    await appendRow(spreadsheetId, 'Customers', row);
    await loadData(spreadsheetId);
    
    return { ...data, id: newId, createdAt: now, vehicles: data.vehicles || [] } as Customer;
  };

  const updateCustomer = async (id: string, updates: Partial<Customer>) => {
    if (!spreadsheetId) throw new Error("No spreadsheet connected");
    const rowIndex = await findRowIndex('Customers', id);
    const existing = customers.find(c => c.id === id);
    if (!existing) return;
    
    const merged = { ...existing, ...updates };
    const now = new Date().toISOString();
    const row = [
      merged.id, merged.fullName, merged.phoneNumber, merged.email || '', 
      merged.address || '', merged.city || '', merged.notes || '', 
      merged.createdAt, merged.lastServiceDate || '', now, JSON.stringify(merged.vehicles || [])
    ];
    
    await updateRow(spreadsheetId, `Customers!A${rowIndex}:K${rowIndex}`, row);
    await loadData(spreadsheetId);
  };

  const deleteRow = async (sheetName: string, id: string) => {
    if (!spreadsheetId) throw new Error("No spreadsheet connected");
    const rowIndex = await findRowIndex(sheetName, id);
    const sheetId = sheetIds[sheetName];
    if (sheetId === undefined) throw new Error("Sheet ID not found");
    
    await fetchWithAuth(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({
        requests: [{
          deleteDimension: {
            range: {
              sheetId: sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex - 1,
              endIndex: rowIndex
            }
          }
        }]
      })
    });
    await loadData(spreadsheetId);
  };

  const deleteCustomer = async (id: string) => deleteRow('Customers', id);

  const addBooking = async (data: Omit<Booking, 'id' | 'createdAt'>) => {
    if (!spreadsheetId) throw new Error("No spreadsheet connected");
    const newId = generateId('bkg');
    const now = new Date().toISOString();
    
    const row = [
      newId, data.customerId, data.vehicleId || '', data.date, data.time || '',
      data.duration || '', data.service, data.price || '', data.paymentStatus || '',
      data.status, data.notes || '', now, data.calendarEventId || '', now
    ];
    
    await appendRow(spreadsheetId, 'Bookings', row);
    await loadData(spreadsheetId);
    return { ...data, id: newId, createdAt: now } as Booking;
  };

  const updateBooking = async (id: string, updates: Partial<Booking>) => {
    if (!spreadsheetId) throw new Error("No spreadsheet connected");
    const rowIndex = await findRowIndex('Bookings', id);
    const existing = bookings.find(b => b.id === id);
    if (!existing) return;
    
    const merged = { ...existing, ...updates };
    const now = new Date().toISOString();
    const row = [
      merged.id, merged.customerId, merged.vehicleId || '', merged.date, merged.time || '',
      merged.duration || '', merged.service, merged.price || '', merged.paymentStatus || '',
      merged.status, merged.notes || '', merged.createdAt, merged.calendarEventId || '', now
    ];
    
    await updateRow(spreadsheetId, `Bookings!A${rowIndex}:N${rowIndex}`, row);
    await loadData(spreadsheetId);
  };

  const deleteBooking = async (id: string) => deleteRow('Bookings', id);

  const addVehicle = async (data: Omit<Vehicle, 'id' | 'createdAt'>) => {
    if (!spreadsheetId) throw new Error("No spreadsheet connected");
    const newId = generateId('veh');
    const now = new Date().toISOString();
    
    const row = [
      newId, data.customerId, data.makeModel, data.year || '',
      data.color || '', data.licensePlate || '', now
    ];
    
    await appendRow(spreadsheetId, 'Vehicles', row);
    await loadData(spreadsheetId);
    return { ...data, id: newId, createdAt: now } as Vehicle;
  };

  const updateVehicle = async (id: string, updates: Partial<Vehicle>) => {
    if (!spreadsheetId) throw new Error("No spreadsheet connected");
    const rowIndex = await findRowIndex('Vehicles', id);
    const existing = vehicles.find(v => v.id === id);
    if (!existing) return;
    
    const merged = { ...existing, ...updates };
    const row = [
      merged.id, merged.customerId, merged.makeModel, merged.year || '',
      merged.color || '', merged.licensePlate || '', existing.createdAt || new Date().toISOString()
    ];
    
    await updateRow(spreadsheetId, `Vehicles!A${rowIndex}:G${rowIndex}`, row);
    await loadData(spreadsheetId);
  };

  const deleteVehicle = async (id: string) => deleteRow('Vehicles', id);

  return (
    <CRMContext.Provider value={{
      user, loading, authError, login,
      customers, addCustomer, updateCustomer, deleteCustomer,
      bookings, addBooking, updateBooking, deleteBooking,
      vehicles, addVehicle, updateVehicle, deleteVehicle
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
