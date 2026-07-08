export interface Customer {
  id: string;
  fullName: string;
  phoneNumber: string;
  email?: string;
  vehicles: string[];
  address?: string;
  city?: string;
  notes?: string;
  createdAt: string;
  lastServiceDate?: string;
}

export type BookingStatus = 'New Booking' | 'Confirmed' | 'On The Way' | 'Started' | 'Completed' | 'Paid' | 'Follow-up Needed' | 'Cancelled';

export interface Booking {
  id: string;
  customerId: string;
  date: string;
  time?: string;
  duration?: number;
  service: string;
  price?: number;
  paymentStatus?: 'Unpaid' | 'Paid';
  status: BookingStatus | 'pending'; // keeping pending for backward compatibility during migration
  notes?: string;
  createdAt: string;
  vehicle?: string;
}
