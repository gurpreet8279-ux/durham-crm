export interface Customer {
  id: string;
  fullName: string;
  phoneNumber: string;
  email?: string;
  vehicles?: string[]; // Restored for backward compatibility
  address?: string;
  city?: string;
  notes?: string;
  createdAt: string;
  lastServiceDate?: string;
}

export interface Vehicle {
  id: string;
  customerId: string;
  makeModel: string;
  year?: string;
  color?: string;
  licensePlate?: string;
  createdAt: string;
}

export interface Service {
  id: string;
  name: string;
  description?: string;
  defaultPrice?: number;
  defaultDuration?: number;
  createdAt: string;
}

export type BookingStatus = 'New' | 'Pending' | 'Confirmed' | 'Reminder Sent' | 'Technician Assigned' | 'On The Way' | 'In Progress' | 'Completed' | 'Paid' | 'Cancelled' | 'Rescheduled';

export interface Booking {
  id: string;
  customerId: string;
  vehicleId?: string; // Links to vehicle
  vehicle?: string; // Restored for backward compatibility
  date: string;
  time?: string;
  duration?: number;
  service: string; // Links to service name
  price?: number;
  paymentStatus?: 'Unpaid' | 'Paid';
  status: BookingStatus;
  notes?: string;
  createdAt: string;
  calendarEventId?: string;
}

export interface Setting {
  key: string;
  value: string;
}
