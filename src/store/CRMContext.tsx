import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Customer, Booking, Vehicle, IncomingRequest } from '../types';
import Papa from 'papaparse';
import toast from 'react-hot-toast';
import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  getDoc,
  updateDoc, 
  deleteDoc, 
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { 
  db, 
  defaultDb,
  handleFirestoreError, 
  OperationType, 
  FIRESTORE_DATABASE_ID,
  FIRESTORE_PROJECT_ID,
  testFirestoreConnection 
} from '../lib/firebase';
import { playPhoneNotificationSound } from '../lib/notificationSound';

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
  purgeAllBookings: () => Promise<void>;
  purgeAllCustomers: () => Promise<void>;
  purgeAllIncomingLeads: () => Promise<void>;
  vehicles: Vehicle[];
  addVehicle: (vehicle: Omit<Vehicle, 'id' | 'createdAt'>) => Promise<Vehicle>;
  updateVehicle: (id: string, updates: Partial<Vehicle>) => Promise<void>;
  deleteVehicle: (id: string) => Promise<void>;
  incomingRequests: IncomingRequest[];
  updateIncomingRequest: (id: string, status: string) => Promise<void>;
  clearIncomingRequests: () => Promise<void>;
  refreshRequests: () => Promise<void>;
  sheetCsvUrl: string;
  setSheetCsvUrl: (url: string) => Promise<void>;
  syncFromGoogleForm: () => Promise<void>;
  syncFromFirestore: () => Promise<void>;
  syncWebsiteBookings: () => Promise<void>;
  syncSheetBookings: (silent?: boolean) => Promise<void>;
  cleanDuplicateBookings: () => Promise<void>;
  isSyncing: boolean;
  firestoreConnected: boolean;
  firestoreDatabaseId: string;
  firestoreProjectId: string;
  activePhoneNotifications: IncomingRequest[];
  dismissPhoneNotification: (id: string) => void;
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
  sheetCsvUrl?: string;
}

const getStoredData = (): StoredCRMData => {
  return {};
};

function getField(obj: any, keys: string[]): any {
  if (!obj || typeof obj !== 'object') return '';
  const objKeys = Object.keys(obj);
  
  // 1. Direct exact key match
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== '') {
      return obj[k];
    }
  }

  // 2. Case-insensitive / normalized EXACT key match (e.g. 'First Name' or 'first_name' strictly matches 'firstname')
  const normalizedObjKeys = objKeys.map(k => ({
    original: k,
    norm: k.toLowerCase().replace(/[^a-z0-9]/g, '')
  }));

  for (const k of keys) {
    const normSearch = k.toLowerCase().replace(/[^a-z0-9]/g, '');
    const found = normalizedObjKeys.find(item => item.norm === normSearch);
    if (found && obj[found.original] !== undefined && obj[found.original] !== null && String(obj[found.original]).trim() !== '') {
      return obj[found.original];
    }
  }

  return '';
}

/**
 * Remove duplicate repeated words from a name (e.g. "Kelly Kelly Kelly" -> "Kelly", or "Kelly Smith Kelly Smith" -> "Kelly Smith")
 */
function cleanRepeatedWords(nameStr: string): string {
  if (!nameStr) return '';
  const trimmed = nameStr.trim();
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';

  // 1. If all words in the string are identical (e.g. ["Kelly", "Kelly", "Kelly"])
  const firstWord = words[0];
  if (words.length > 1 && words.every(w => w.toLowerCase() === firstWord.toLowerCase())) {
    return firstWord;
  }

  // 2. If it's a repeated full name (e.g. "Kelly Smith Kelly Smith")
  if (words.length % 2 === 0 && words.length >= 4) {
    const half = words.length / 2;
    const firstHalf = words.slice(0, half).join(' ').toLowerCase();
    const secondHalf = words.slice(half).join(' ').toLowerCase();
    if (firstHalf === secondHalf) {
      return words.slice(0, half).join(' ');
    }
  }

  // 3. Filter out immediate consecutive duplicates (e.g. "Kelly Kelly Smith" -> "Kelly Smith")
  const deduped: string[] = [];
  for (let i = 0; i < words.length; i++) {
    if (i === 0 || words[i].toLowerCase() !== words[i - 1].toLowerCase()) {
      deduped.push(words[i]);
    }
  }

  return deduped.join(' ');
}

/**
 * Extract complete name with exact First Name and Last Name logic.
 * If no last name is present, leaves it blank without repeating.
 */
function extractFullName(data: any, fallbackIndex?: number): string {
  if (!data || typeof data !== 'object') return '';

  // 1. Check for dedicated first and last name fields
  const rawFirst = getField(data, [
    'firstName', 'first_name', 'fname', 'first', 'givenName', 'given_name',
    'first_name_customer', 'client_first_name', 'customer_first_name'
  ]);
  const rawLast = getField(data, [
    'lastName', 'last_name', 'lname', 'last', 'familyName', 'family_name', 'surname',
    'last_name_customer', 'client_last_name', 'customer_last_name'
  ]);

  const firstName = (typeof rawFirst === 'string' ? rawFirst : (rawFirst != null ? String(rawFirst) : '')).trim();
  const lastName = (typeof rawLast === 'string' ? rawLast : (rawLast != null ? String(rawLast) : '')).trim();

  if (firstName || lastName) {
    if (firstName && lastName) {
      // If first and last name are accidentally identical, don't repeat
      if (firstName.toLowerCase() === lastName.toLowerCase()) {
        return cleanRepeatedWords(firstName);
      }
      return cleanRepeatedWords(`${firstName} ${lastName}`);
    }
    // If no last name, leave last name blank (return only first name or only last name)
    return cleanRepeatedWords(firstName || lastName);
  }

  // 2. Check general full name fields
  const rawFullName = getField(data, [
    'fullName', 
    'full_name', 
    'name', 
    'customerName', 
    'customer_name', 
    'clientName', 
    'client_name', 
    'customer', 
    'client', 
    'contactName', 
    'contact_name', 
    'who',
    'yourName',
    'your_name',
    'guestName',
    'guest_name'
  ]);

  let directFullName = (typeof rawFullName === 'string' ? rawFullName : (rawFullName != null ? String(rawFullName) : '')).trim();

  if (directFullName && directFullName.toLowerCase() !== 'online customer') {
    return cleanRepeatedWords(directFullName);
  }

  return directFullName || '';
}

function parseCleanPrice(val: any, serviceName?: string): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (typeof val === 'string' && val.trim() !== '') {
    const cleaned = val.replace(/[^0-9.]/g, '');
    const num = parseFloat(cleaned);
    if (!isNaN(num)) return num;
  }
  // If price is missing or 0, check package name for price
  if (serviceName && typeof serviceName === 'string') {
    const lower = serviceName.toLowerCase();
    if (lower.includes('$')) {
      const match = lower.match(/\$\s*([0-9]+(\.[0-9]{2})?)/);
      if (match) {
        const num = parseFloat(match[1]);
        if (!isNaN(num)) return num;
      }
    }
  }
  return 0;
}

function parseCleanDate(rawDate: any): string {
  if (!rawDate) {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  if (typeof rawDate === 'object' && rawDate.toDate) {
    const d = rawDate.toDate();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  if (typeof rawDate === 'string') {
    const trimmed = rawDate.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      return trimmed.substring(0, 10);
    }
    // Handle MM/DD/YYYY or DD/MM/YYYY or M/D/YYYY
    if (trimmed.includes('/')) {
      const parts = trimmed.split(' ')[0].split('/');
      if (parts.length === 3) {
        let y = parseInt(parts[2], 10);
        if (y < 100) y += 2000;
        let m = parseInt(parts[0], 10);
        let d = parseInt(parts[1], 10);
        if (m > 12 && d <= 12) {
          const temp = m;
          m = d;
          d = temp;
        }
        if (!isNaN(y) && !isNaN(m) && !isNaN(d) && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
          return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        }
      }
    }
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
    }
  }
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseCleanTime(rawTime: any): string {
  if (!rawTime || typeof rawTime !== 'string') return '09:00';
  const trimmed = rawTime.trim();
  const ampmMatch = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (ampmMatch) {
    let hr = parseInt(ampmMatch[1], 10);
    const min = ampmMatch[2];
    const ampm = ampmMatch[3]?.toUpperCase();
    if (ampm === 'PM' && hr < 12) hr += 12;
    if (ampm === 'AM' && hr === 12) hr = 0;
    return `${String(hr).padStart(2, '0')}:${min}`;
  }
  const hrOnlyMatch = trimmed.match(/^(\d{1,2})\s*(AM|PM)$/i);
  if (hrOnlyMatch) {
    let hr = parseInt(hrOnlyMatch[1], 10);
    const ampm = hrOnlyMatch[2].toUpperCase();
    if (ampm === 'PM' && hr < 12) hr += 12;
    if (ampm === 'AM' && hr === 12) hr = 0;
    return `${String(hr).padStart(2, '0')}:00`;
  }
  if (/^\d{1,2}:\d{2}/.test(trimmed)) {
    const [h, m] = trimmed.split(':');
    return `${String(parseInt(h, 10)).padStart(2, '0')}:${m.substring(0, 2)}`;
  }
  return '09:00';
}

export function isPendingLeadStatus(rawStatus?: string): boolean {
  if (!rawStatus) return true;
  const s = String(rawStatus).trim().toLowerCase();
  if (['approved', 'dismissed', 'confirmed', 'in progress', 'completed', 'paid', 'cancelled', 'canceled', 'rescheduled', 'on the way', 'technician assigned', 'reminder sent', 'closed'].includes(s)) {
    return false;
  }
  return s === 'pending' || s === 'new' || s === 'lead' || s === 'unread';
}

function parseLeadDoc(docId: string, data: any): IncomingRequest {
  const extracted = extractFullName(data);
  const fullName = extracted || (data.fullName ? cleanRepeatedWords(String(data.fullName)) : (data.name ? cleanRepeatedWords(String(data.name)) : 'Online Customer'));
  const phone = String(getField(data, ['phoneNumber', 'phone', 'mobile', 'cell', 'contact', 'telephone', 'phone_number']) || '');
  const email = String(getField(data, ['email', 'mail', 'emailAddress', 'email_address']) || '');
  const vehicle = String(getField(data, ['vehicle', 'vehicleMakeModel', 'car', 'makeModel', 'make_model', 'vehicleType', 'model', 'vehicle_make_model']) || '');
  const service = String(getField(data, ['service', 'package', 'serviceRequested', 'service_requested', 'serviceType', 'packageSelected', 'selectedPackage', 'plan', 'serviceName']) || 'Detailing Service');
  const rawPrice = getField(data, ['price', 'totalPrice', 'amount', 'cost', 'packagePrice', 'total', 'fee', 'rate', 'total_price']);
  const price = parseCleanPrice(rawPrice, service);
  const dateStr = parseCleanDate(getField(data, ['date', 'preferredDate', 'bookingDate', 'appointmentDate', 'selectedDate', 'serviceDate', 'preferred_date', 'booking_date']));
  const timeStr = parseCleanTime(getField(data, ['time', 'preferredTime', 'bookingTime', 'appointmentTime', 'selectedTime', 'slot', 'preferred_time']));
  const address = String(getField(data, ['address', 'location', 'street', 'streetAddress', 'street_address']) || '');
  const city = String(getField(data, ['city', 'town', 'municipality', 'zip', 'postalCode']) || '');
  const notes = String(getField(data, ['notes', 'message', 'comments', 'specialInstructions', 'additionalNotes']) || '');
  const rawStatus = String(data.status || 'Pending').trim();
  const createdAt = data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (data.createdAt || data.timestamp || new Date().toISOString());

  let leadStatus: 'Pending' | 'Approved' | 'Dismissed' = 'Pending';
  if (rawStatus.toLowerCase() === 'dismissed') {
    leadStatus = 'Dismissed';
  } else if (!isPendingLeadStatus(rawStatus)) {
    leadStatus = 'Approved';
  } else {
    leadStatus = 'Pending';
  }

  return {
    id: docId,
    timestamp: createdAt,
    fullName,
    phoneNumber: phone,
    email,
    address,
    city,
    vehicleMakeModel: vehicle,
    serviceRequested: service,
    price,
    preferredDate: dateStr,
    preferredTime: timeStr,
    notes,
    status: leadStatus
  };
}

export const CRMProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user] = useState<User | null>({ id: 'admin', email: 'admin@crown', name: 'Admin' });
  const [loading] = useState(false);
  const [authError] = useState<string | null>(null);
  
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<IncomingRequest[]>([]);
  const [sheetCsvUrl, setSheetCsvUrlState] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [firestoreConnected, setFirestoreConnected] = useState(false);
  const [activePhoneNotifications, setActivePhoneNotifications] = useState<IncomingRequest[]>([]);
  
  const sheetCsvUrlRef = useRef<string>('');
  useEffect(() => {
    sheetCsvUrlRef.current = sheetCsvUrl;
  }, [sheetCsvUrl]);

  const publicBookingsMapRef = useRef<Map<string, any>>(new Map());
  const firestoreCustomersListRef = useRef<Customer[]>([]);

  const dismissPhoneNotification = (id: string) => {
    setActivePhoneNotifications(prev => prev.filter(n => n.id !== id));
  };

  // 1. Wipe any old localStorage cache completely on mount, but preserve offlineBookingsCsvUrl
  useEffect(() => {
    try {
      localStorage.removeItem('crown_crm_data');
    } catch {
      // ignore
    }
  }, []);

  // 2. Persistence layer for CSV link: Firestore (cross-device source of truth) + localStorage (instant fallback)
  useEffect(() => {
    // Initial immediate read from localStorage
    try {
      const local = localStorage.getItem('offlineBookingsCsvUrl');
      if (local && local.trim()) {
        setSheetCsvUrlState(local.trim());
      }
    } catch (e) {
      console.warn("Could not read offlineBookingsCsvUrl from localStorage:", e);
    }

    // Subscribe to Firestore settings/csvConfig for cross-device synchronization
    const unsubscribe = onSnapshot(doc(db, 'settings', 'csvConfig'), (configSnap) => {
      if (configSnap.exists()) {
        const remoteUrl = configSnap.data()?.url;
        if (remoteUrl && typeof remoteUrl === 'string' && remoteUrl.trim()) {
          const trimmed = remoteUrl.trim();
          setSheetCsvUrlState(trimmed);
          try {
            localStorage.setItem('offlineBookingsCsvUrl', trimmed);
          } catch (e) {
            console.warn("Could not sync offlineBookingsCsvUrl to localStorage:", e);
          }
        }
      }
    }, (err) => {
      console.warn("Firestore settings/csvConfig listener note:", err);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // 3. Initial connection check
  useEffect(() => {
    testFirestoreConnection().then((connected) => {
      setFirestoreConnected(connected);
    });
  }, []);

  const recomputeAll = useCallback(() => {
    setFirestoreConnected(true);

    const allLeads: IncomingRequest[] = [];
    const unifiedBookings: Booking[] = [];
    const autoCustomersMap = new Map<string, Customer>();

    // Populate already registered customer documents
    firestoreCustomersListRef.current.forEach(c => {
      const cleanedCust = {
        ...c,
        fullName: cleanRepeatedWords(c.fullName)
      };
      autoCustomersMap.set(c.id, cleanedCust);
      if (c.phoneNumber) autoCustomersMap.set(c.phoneNumber, cleanedCust);
    });

    // 1. Process public_bookings collection documents
    publicBookingsMapRef.current.forEach((data, docId) => {
      const lead = parseLeadDoc(docId, data);
      const isSheetBooking = data.source === 'google_sheet' && data.status !== 'Pending';
      
      // Only show truly unapproved/pending online requests in the Incoming Requests inbox
      if (lead.status === 'Pending' && !isSheetBooking && data.status !== 'Dismissed') {
        allLeads.push(lead);
      }

      // Auto-synthesize customer profile if not already present
      const custName = lead.fullName || 'Online Customer';
      const custPhone = lead.phoneNumber || '';
      const custEmail = lead.email || '';
      const custAddress = lead.address || '';
      const custCity = lead.city || '';
      const custVehicle = lead.vehicleMakeModel || '';
      const custId = data.customerId || (custPhone ? `cus_${custPhone.replace(/[^0-9]/g, '')}` : `cus_${docId}`);

      if (!autoCustomersMap.has(custId)) {
        const autoCust: Customer = {
          id: custId,
          fullName: custName,
          phoneNumber: custPhone,
          email: custEmail,
          address: custAddress,
          city: custCity,
          vehicles: custVehicle ? [custVehicle] : [],
          notes: lead.notes || '',
          createdAt: lead.timestamp,
          lastServiceDate: lead.preferredDate || ''
        };
        autoCustomersMap.set(custId, autoCust);
        if (custPhone) autoCustomersMap.set(custPhone, autoCust);
      } else {
        // If customer exists, append vehicle if new
        const existingCust = autoCustomersMap.get(custId)!;
        if (custVehicle && existingCust.vehicles && !existingCust.vehicles.includes(custVehicle)) {
          existingCust.vehicles.push(custVehicle);
        }
      }

      // Add to calendar and bookings if not dismissed
      if (data.status !== 'Dismissed') {
        const dateStr = lead.preferredDate;
        const timeStr = lead.preferredTime || '09:00';
        const vehicle = custVehicle || 'Customer Vehicle';
        const service = lead.serviceRequested || 'Detailing Service';
        const notes = lead.notes || '';
        const rawStatus = data.status || (data.source === 'google_sheet' ? 'Confirmed' : 'Pending');
        const status = (rawStatus === 'Approved' ? 'Confirmed' : rawStatus) as any;
        const price = lead.price !== undefined ? lead.price : parseCleanPrice(getField(data, ['price', 'totalPrice', 'amount', 'cost', 'packagePrice', 'total', 'fee']), service);
        const rawDuration = typeof data.duration === 'number' ? data.duration : parseInt(data.duration || 120, 10);
        const duration = isNaN(rawDuration) ? 120 : rawDuration;
        const paymentStatus = data.paymentStatus === 'Paid' ? 'Paid' : 'Unpaid';
        const createdAt = lead.timestamp;

        unifiedBookings.push({
          id: docId,
          customerId: custId,
          vehicleId: data.vehicleId || '',
          vehicle,
          date: dateStr,
          time: timeStr,
          duration,
          service,
          price,
          paymentStatus,
          status,
          notes,
          createdAt,
          calendarEventId: data.calendarEventId || ''
        });
      }
    });

    // Deduplicate bookings by customer contact/identity and appointment date+time
    const STATUS_RANK: Record<string, number> = {
      'paid': 10,
      'completed': 9,
      'in progress': 8,
      'on the way': 7,
      'technician assigned': 6,
      'reminder sent': 5,
      'confirmed': 4,
      'approved': 4,
      'new': 3,
      'pending': 2,
      'rescheduled': 1,
      'cancelled': 0,
      'dismissed': -1
    };

    const deduplicatedBookingsMap = new Map<string, Booking>();

    unifiedBookings.forEach((booking) => {
      const cust = autoCustomersMap.get(booking.customerId);
      const rawName = cust?.fullName || (booking as any).customerName || (booking as any).fullName || '';
      const cleanName = cleanRepeatedWords(rawName).toLowerCase().replace(/[^a-z0-9]/g, '');
      const cleanPhone = (cust?.phoneNumber || (booking as any).phoneNumber || '').replace(/[^0-9]/g, '');
      const cleanEmail = (cust?.email || (booking as any).email || '').toLowerCase().trim();

      // Customer contact key
      const contactKey = cleanPhone || cleanEmail || cleanName || booking.customerId;
      const dateKey = (booking.date || 'no_date').trim();
      const timeKey = (booking.time || '09:00').trim().replace(/[^0-9]/g, '');

      const appointmentKey = `${contactKey}_${dateKey}_${timeKey}`;

      if (!deduplicatedBookingsMap.has(appointmentKey)) {
        deduplicatedBookingsMap.set(appointmentKey, booking);
      } else {
        const existing = deduplicatedBookingsMap.get(appointmentKey)!;
        const currentRank = STATUS_RANK[String(booking.status || '').toLowerCase()] ?? 2;
        const existingRank = STATUS_RANK[String(existing.status || '').toLowerCase()] ?? 2;

        if (currentRank > existingRank) {
          deduplicatedBookingsMap.set(appointmentKey, {
            ...booking,
            notes: booking.notes || existing.notes,
            vehicle: (booking.vehicle && booking.vehicle !== 'Customer Vehicle') ? booking.vehicle : existing.vehicle,
            price: (booking.price && booking.price > 0) ? booking.price : existing.price
          });
        } else {
          if (!existing.notes && booking.notes) existing.notes = booking.notes;
          if (existing.vehicle === 'Customer Vehicle' && booking.vehicle && booking.vehicle !== 'Customer Vehicle') {
            existing.vehicle = booking.vehicle;
          }
          if ((!existing.price || existing.price === 0) && booking.price > 0) {
            existing.price = booking.price;
          }
        }
      }
    });

    // Deduplicate leads by contact and requested date+time
    const deduplicatedLeadsMap = new Map<string, IncomingRequest>();
    allLeads.forEach((lead) => {
      const cleanName = cleanRepeatedWords(lead.fullName).toLowerCase().replace(/[^a-z0-9]/g, '');
      const cleanPhone = (lead.phoneNumber || '').replace(/[^0-9]/g, '');
      const cleanEmail = (lead.email || '').toLowerCase().trim();
      const contactKey = cleanPhone || cleanEmail || cleanName || lead.id;
      const dateKey = (lead.preferredDate || 'no_date').trim();
      const timeKey = (lead.preferredTime || '09:00').trim().replace(/[^0-9]/g, '');

      const leadKey = `${contactKey}_${dateKey}_${timeKey}`;

      if (!deduplicatedLeadsMap.has(leadKey)) {
        deduplicatedLeadsMap.set(leadKey, lead);
      } else {
        const existing = deduplicatedLeadsMap.get(leadKey)!;
        if ((!existing.notes && lead.notes) || (!existing.email && lead.email)) {
          deduplicatedLeadsMap.set(leadKey, {
            ...existing,
            notes: lead.notes || existing.notes,
            email: lead.email || existing.email,
            vehicleMakeModel: lead.vehicleMakeModel || existing.vehicleMakeModel
          });
        }
      }
    });

    const finalBookings = Array.from(deduplicatedBookingsMap.values());
    const finalLeads = Array.from(deduplicatedLeadsMap.values());

    // Update states
    setIncomingRequests(finalLeads);
    setBookings(finalBookings);

    // Deduplicate unique customer objects by ID
    const uniqueCustomers = Array.from(
      new Map(Array.from(autoCustomersMap.values()).map(c => [c.id, c])).values()
    );
    setCustomers(uniqueCustomers);
  }, []);

  // 4. Real-time Firestore Listeners: strictly listening to 'public_bookings' and 'customers'
  useEffect(() => {
    let isFirstLoad = true;

    // Real-time onSnapshot listener strictly for 'public_bookings' on live database
    const unsubscribePublic = onSnapshot(collection(db, 'public_bookings'), (snapshot) => {
      // Check for freshly added pending bookings
      if (!isFirstLoad) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const data = change.doc.data();
            const rawStatus = (data.status || 'Pending').toLowerCase();
            const isPending = rawStatus === 'pending' || rawStatus === 'new';
            const isSheetBooking = data.source === 'google_sheet';
            
            // Only trigger alert chimes and banner for genuine pending online customer bookings
            if (isPending && !isSheetBooking && data.status !== 'Dismissed' && data.status !== 'Approved') {
              const parsedLead = parseLeadDoc(change.doc.id, data);
              
              // Add to Phone Screen Notification banner
              setActivePhoneNotifications(prev => {
                const exists = prev.some(item => item.id === parsedLead.id);
                if (!exists) {
                  return [parsedLead, ...prev];
                }
                return prev;
              });

              // Play authentic phone push notification chime & haptics
              playPhoneNotificationSound();
            }
          }
        });
      }
      isFirstLoad = false;

      publicBookingsMapRef.current.clear();
      snapshot.forEach(docSnap => {
        publicBookingsMapRef.current.set(docSnap.id, docSnap.data());
      });
      recomputeAll();
    }, (err) => {
      console.warn("Error listening to public_bookings:", err);
    });

    return () => {
      unsubscribePublic();
    };
  }, [recomputeAll]);

  // Fix B: Save CSV URL to state, localStorage (offlineBookingsCsvUrl), and Firestore (settings/csvConfig)
  const setSheetCsvUrl = async (url: string) => {
    const trimmed = (url || '').trim();
    setSheetCsvUrlState(trimmed);

    try {
      if (trimmed) {
        localStorage.setItem('offlineBookingsCsvUrl', trimmed);
      } else {
        localStorage.removeItem('offlineBookingsCsvUrl');
      }
    } catch (e) {
      console.warn("Could not save offlineBookingsCsvUrl to localStorage:", e);
    }

    try {
      await setDoc(doc(db, 'settings', 'csvConfig'), {
        url: trimmed,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (error) {
      console.warn("Could not save settings/csvConfig to Firestore:", error);
    }
  };

  const login = async () => {};

  const clearIncomingRequests = async () => {
    try {
      setIncomingRequests([]);
      const snap = await getDocs(collection(db, 'public_bookings'));
      const batch = writeBatch(db);
      let count = 0;
      snap.forEach(d => {
        const data = d.data();
        const rawStatus = (data.status || 'Pending').toLowerCase();
        if (rawStatus === 'pending' || rawStatus === 'new') {
          batch.update(d.ref, { status: 'Dismissed', updatedAt: new Date().toISOString() });
          count++;
        }
      });
      if (count > 0) {
        await batch.commit();
        toast.success(`Cleared and dismissed ${count} pending request(s).`);
      } else {
        toast.success('Cleared inbox view.');
      }
    } catch (err) {
      console.warn("Could not batch clear incoming requests:", err);
      toast.success('Cleared inbox view.');
    }
  };

  // Bulk Purge Handlers to wipe old test data completely from Cloud Firestore
  const purgeAllBookings = async () => {
    setIsSyncing(true);
    try {
      const snapPublic = await getDocs(collection(db, 'public_bookings'));
      const batch = writeBatch(db);
      
      snapPublic.docs.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
      await batch.commit();

      setBookings([]);
      setIncomingRequests([]);
      toast.success(`Successfully purged ${snapPublic.size} booking(s) from database.`);
    } catch (error) {
      console.error("Error purging bookings:", error);
      toast.error("Failed to purge bookings from Firestore.");
    } finally {
      setIsSyncing(false);
    }
  };

  const purgeAllCustomers = async () => {
    setIsSyncing(true);
    try {
      setCustomers([]);
      toast.success("Successfully cleared customer list.");
    } catch (error) {
      console.error("Error purging customers:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  const purgeAllIncomingLeads = async () => {
    setIsSyncing(true);
    try {
      const snap = await getDocs(collection(db, 'public_bookings'));
      const batch = writeBatch(db);
      snap.docs.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
      await batch.commit();

      setIncomingRequests([]);
      toast.success(`Cleared all incoming lead records from database.`);
    } catch (error) {
      console.error("Error purging incoming leads:", error);
      toast.error("Failed to purge incoming leads.");
    } finally {
      setIsSyncing(false);
    }
  };

  // Fix A: Isolated Website Bookings Sync (Firestore only, never touches sheet/CSV)
  const syncWebsiteBookings = async () => {
    setIsSyncing(true);
    try {
      const snapPublic = await getDocs(collection(db, 'public_bookings'));
      setFirestoreConnected(true);
      publicBookingsMapRef.current.clear();
      snapPublic.forEach(docSnap => {
        publicBookingsMapRef.current.set(docSnap.id, docSnap.data());
      });
      recomputeAll();
      toast.success(`Synced ${publicBookingsMapRef.current.size} record(s) from Firestore!`);
    } catch (error) {
      console.error("Website bookings sync error:", error);
      toast.error("Failed to sync website bookings from Firestore.");
    } finally {
      setIsSyncing(false);
    }
  };

  const syncFromFirestore = syncWebsiteBookings;
  
  // High-Speed Isolated Sheet Bookings Sync (Optimized Batch writes & Reconcile by key)
  const syncSheetBookings = async (silent = false) => {
    const targetUrl = sheetCsvUrlRef.current || sheetCsvUrl;
    if (!targetUrl) {
      if (!silent) {
        toast.error("Please enter and save your published Google Sheet CSV link in the Admin tab first.");
      }
      return;
    }
    
    if (!silent) setIsSyncing(true);
    try {
      const urlWithCacheBuster = targetUrl.includes('?') 
        ? `${targetUrl}&_t=${new Date().getTime()}`
        : `${targetUrl}?_t=${new Date().getTime()}`;
        
      const response = await fetch(urlWithCacheBuster, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}: Failed to fetch CSV`);
      
      const csvText = await response.text();
      
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          const sheetRecords: any[] = [];
          
          results.data.forEach((row: any, index: number) => {
            const hasData = Object.values(row).some(v => typeof v === 'string' && v.trim() !== '');
            if (!hasData) return;

            const rowNumber = String(getField(row, ['#', 'row', 'row_number', 'rowNumber', 'id', 'booking_id', 'bookingId']) || '').trim();
            const timestamp = String(getField(row, ['timestamp', 'created', 'date_submitted', 'submitted_at']) || '');
            
            // Advanced First & Last Name extraction
            const fullName = extractFullName(row, index + 1) || (rowNumber ? `Guest #${rowNumber}` : `Guest #${index + 1}`);
            const phoneNumber = String(getField(row, ['phone', 'mobile', 'cell', 'number', 'contact', 'telephone', 'phone_number']) || '');
            const email = String(getField(row, ['email', 'mail', 'email_address']) || '');
            const address = String(getField(row, ['address', 'location', 'where', 'street', 'street_address']) || '');
            const city = String(getField(row, ['city', 'town', 'zip', 'postal']) || '');
            const vehicleMakeModel = String(getField(row, ['vehicle', 'make', 'model', 'car', 'auto', 'truck', 'vehicle_make_model', 'vehicle_type']) || 'Customer Vehicle');
            const serviceRequested = String(getField(row, ['service', 'package', 'detail', 'type', 'what', 'plan', 'service_requested', 'package_selected']) || 'Detailing Service');
            const rawPrice = getField(row, ['price', 'cost', 'amount', 'fee', 'total', 'rate', 'package_price', 'total_price', '$']);
            const price = parseCleanPrice(rawPrice, serviceRequested);
            const preferredDate = parseCleanDate(getField(row, ['date', 'when', 'day', 'booking_date', 'preferred_date', 'service_date']));
            const preferredTime = parseCleanTime(getField(row, ['time', 'slot', 'hour', 'preferred_time', 'booking_time']));
            const notes = String(getField(row, ['notes', 'message', 'additional', 'anything', 'comments', 'instructions']) || '');

            const cleanName = cleanRepeatedWords(fullName).toLowerCase().trim().replace(/[^a-z0-9]/g, '');
            const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
            const cleanDate = preferredDate.replace(/[^0-9]/g, '');
            const cleanTime = preferredTime.replace(/[^0-9]/g, '');
            
            const uniqueKeySignature = rowNumber 
              ? `row_${rowNumber}_${cleanDate || 'nodate'}` 
              : `${cleanPhone || cleanName}_${cleanDate || 'nodate'}_${cleanTime || '0900'}`;

            const id = `sheet_${generateDeterministicRequestId(uniqueKeySignature)}`;
            const rawExplicitStatus = String(getField(row, ['status', 'booking_status', 'state', 'stage']) || '').trim();
            const explicitSheetStatus = rawExplicitStatus ? (rawExplicitStatus.toLowerCase() === 'approved' ? 'Confirmed' : rawExplicitStatus) : null;

            sheetRecords.push({
              id,
              source: 'google_sheet',
              timestamp: timestamp || new Date().toISOString(),
              fullName,
              name: fullName,
              customerName: fullName,
              phoneNumber,
              phone: phoneNumber,
              email,
              address,
              city,
              vehicle: vehicleMakeModel,
              vehicleMakeModel,
              service: serviceRequested,
              serviceRequested,
              package: serviceRequested,
              price,
              totalPrice: price,
              date: preferredDate,
              preferredDate,
              time: preferredTime,
              preferredTime,
              notes,
              explicitSheetStatus,
              isLead: explicitSheetStatus?.toLowerCase() === 'pending' || explicitSheetStatus?.toLowerCase() === 'new',
              updatedAt: new Date().toISOString()
            });
          });

          if (sheetRecords.length === 0) {
            if (!silent) toast.success("No rows found in Google Sheet.");
            return;
          }

          // Fetch existing public_bookings to preserve current CRM statuses (e.g. Confirmed, In Progress, Completed, Dismissed)
          const existingDocsSnap = await getDocs(collection(db, 'public_bookings'));
          const existingStatusMap = new Map<string, string>();
          existingDocsSnap.forEach(d => {
            const data = d.data();
            if (data?.status) {
              existingStatusMap.set(d.id, data.status);
            }
          });

          // Perform high-speed batched writes (up to 450 records per batch)
          const BATCH_SIZE = 450;
          for (let i = 0; i < sheetRecords.length; i += BATCH_SIZE) {
            const chunk = sheetRecords.slice(i, i + BATCH_SIZE);
            const batch = writeBatch(db);

            chunk.forEach(req => {
              const existingStatus = existingStatusMap.get(req.id);
              // Default to Confirmed so Google Sheet appointments land directly on schedule & never flood online leads
              const currentStatus = req.explicitSheetStatus || existingStatus || 'Confirmed';
              const { explicitSheetStatus, ...docData } = req;
              const recordToSave = {
                ...docData,
                status: currentStatus,
                isLead: currentStatus.toLowerCase() === 'pending'
              };
              batch.set(doc(db, 'public_bookings', req.id), recordToSave, { merge: true });
            });

            await batch.commit();
          }

          if (!silent) {
            toast.success(`Synced ${sheetRecords.length} booking(s) from Google Sheet!`);
          }
        },
        error: (error) => {
          console.error("CSV Parse Error:", error);
          if (!silent) toast.error("Error parsing Google Sheet CSV.");
        }
      });
    } catch (error) {
      console.error("Sheet Sync Error:", error);
      if (!silent) toast.error("Failed to sync from Google Sheet. Check link.");
    } finally {
      if (!silent) setIsSyncing(false);
    }
  };

  // Background Auto-Sync every 45 seconds for Google Sheet
  useEffect(() => {
    if (!sheetCsvUrl) return;

    // Initial background sync after 2.5 seconds
    const initialTimer = setTimeout(() => {
      syncSheetBookings(true);
    }, 2500);

    // Periodic auto-sync interval
    const interval = setInterval(() => {
      syncSheetBookings(true);
    }, 45000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [sheetCsvUrl]);

  const syncFromGoogleForm = () => syncSheetBookings(false);

  const addBooking = async (data: Omit<Booking, 'id' | 'createdAt'>) => {
    const newId = generateId('bkg');
    const now = new Date().toISOString();
    const booking = { ...data, id: newId, createdAt: now } as Booking;
    
    setBookings(prev => [booking, ...prev]);

    try {
      await setDoc(doc(db, 'public_bookings', newId), {
        ...booking,
        status: data.status || 'Confirmed',
        updatedAt: now
      }, { merge: true });
    } catch (error) {
      console.warn("Could not save booking to public_bookings:", error);
    }

    return booking;
  };

  const updateBooking = async (id: string, updates: Partial<Booking>) => {
    setBookings(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));

    try {
      await setDoc(doc(db, 'public_bookings', id), {
        ...updates,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (error) {
      console.warn("Could not update booking in public_bookings:", error);
    }
  };

  const deleteBooking = async (id: string) => {
    setBookings(prev => prev.filter(b => b.id !== id));

    try {
      await deleteDoc(doc(db, 'public_bookings', id));
    } catch (error) {
      console.warn("Could not delete booking from public_bookings:", error);
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
    setIncomingRequests(prev => prev.filter(r => r.id !== id));

    try {
      await updateDoc(doc(db, 'public_bookings', id), {
        status,
        updatedAt: new Date().toISOString()
      }).catch(async () => {
        if (defaultDb !== db) {
          await updateDoc(doc(defaultDb, 'public_bookings', id), {
            status,
            updatedAt: new Date().toISOString()
          });
        }
      });
    } catch (error) {
      console.warn("Could not sync request status to Firestore:", error);
    }
  };

  const refreshRequests = async () => {
    await syncFromFirestore();
  };

  const cleanDuplicateBookings = async () => {
    try {
      const snap = await getDocs(collection(db, 'public_bookings'));
      const groups = new Map<string, { id: string; data: any; rank: number; createdAt: string }[]>();

      const STATUS_RANK: Record<string, number> = {
        'paid': 10,
        'completed': 9,
        'in progress': 8,
        'on the way': 7,
        'technician assigned': 6,
        'reminder sent': 5,
        'confirmed': 4,
        'approved': 4,
        'new': 3,
        'pending': 2,
        'rescheduled': 1,
        'cancelled': 0,
        'dismissed': -1
      };

      snap.forEach(d => {
        const data = d.data();
        const rawName = extractFullName(data) || data.fullName || data.name || data.customerName || '';
        const cleanName = cleanRepeatedWords(rawName).toLowerCase().replace(/[^a-z0-9]/g, '');
        const cleanPhone = String(getField(data, ['phoneNumber', 'phone', 'mobile', 'cell', 'telephone']) || '').replace(/[^0-9]/g, '');
        const cleanEmail = String(getField(data, ['email', 'mail']) || '').toLowerCase().trim();
        const contactSig = cleanPhone || cleanEmail || cleanName;
        
        const dateSig = String(getField(data, ['date', 'preferredDate', 'bookingDate']) || '').trim();
        const timeSig = String(getField(data, ['time', 'preferredTime', 'bookingTime']) || '09:00').trim().replace(/[^0-9]/g, '');
        
        if (!contactSig) return;
        const groupKey = `${contactSig}_${dateSig}_${timeSig}`;
        
        const rawStatus = (data.status || 'Pending').toLowerCase();
        const rank = STATUS_RANK[rawStatus] ?? 2;
        const createdAt = data.createdAt || data.timestamp || '';
        
        if (!groups.has(groupKey)) {
          groups.set(groupKey, []);
        }
        groups.get(groupKey)!.push({ id: d.id, data, rank, createdAt });
      });

      let deletedCount = 0;
      const batch = writeBatch(db);
      let batchOperations = 0;

      groups.forEach((items) => {
        if (items.length > 1) {
          // Sort items so the best/highest-priority booking is first
          items.sort((a, b) => {
            if (b.rank !== a.rank) return b.rank - a.rank;
            return (b.createdAt || '').localeCompare(a.createdAt || '');
          });

          // Keep items[0], delete redundant duplicates items[1..n]
          for (let i = 1; i < items.length; i++) {
            batch.delete(doc(db, 'public_bookings', items[i].id));
            deletedCount++;
            batchOperations++;
          }
        }
      });

      if (batchOperations > 0) {
        await batch.commit();
        toast.success(`Cleaned up ${deletedCount} duplicate booking(s) from database!`);
      } else {
        toast.success("Database is clean. No duplicates found.");
      }
    } catch (err) {
      console.error("Error cleaning duplicates:", err);
      toast.error("Failed to clean duplicates from database.");
    }
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
      purgeAllBookings,
      purgeAllCustomers,
      purgeAllIncomingLeads,
      cleanDuplicateBookings,
      vehicles,
      addVehicle,
      updateVehicle,
      deleteVehicle,
      incomingRequests,
      updateIncomingRequest,
      clearIncomingRequests,
      refreshRequests,
      sheetCsvUrl,
      setSheetCsvUrl,
      syncFromGoogleForm,
      syncFromFirestore,
      syncWebsiteBookings,
      syncSheetBookings,
      isSyncing,
      firestoreConnected,
      firestoreDatabaseId: FIRESTORE_DATABASE_ID,
      firestoreProjectId: FIRESTORE_PROJECT_ID,
      activePhoneNotifications,
      dismissPhoneNotification
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
