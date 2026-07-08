import { getAccessToken } from './auth';
import { Booking, Customer } from '../types';

export const syncToGoogleCalendar = async (booking: Booking, customer?: Customer) => {
  const token = await getAccessToken();
  if (!token) throw new Error('No Google access token found');

  // Basic Google Calendar event payload
  const dateStr = booking.date; // YYYY-MM-DD
  const timeStr = booking.time || '09:00';
  const startDateTime = new Date(`${dateStr}T${timeStr}:00`);
  const endDateTime = new Date(startDateTime.getTime() + (booking.duration || 120) * 60000);

  const event = {
    summary: `Detailing: ${customer?.fullName || 'Unknown Customer'} - ${booking.vehicle || 'Unknown Vehicle'}`,
    description: `Service: ${booking.service}\nNotes: ${booking.notes}\nPhone: ${customer?.phoneNumber || ''}`,
    location: `${customer?.address || ''}, ${customer?.city || ''}`,
    start: { dateTime: startDateTime.toISOString() },
    end: { dateTime: endDateTime.toISOString() },
  };

  const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error('Failed to sync to Calendar', err);
    throw new Error('Failed to create calendar event');
  }
};

export const createSpreadsheet = async () => {
    const token = await getAccessToken();
    if (!token) throw new Error('No Google access token found');
  
    const body = {
      properties: { title: 'CRM Database - Customers & Bookings' },
      sheets: [
        { properties: { title: 'Customers' } },
        { properties: { title: 'Bookings' } }
      ]
    };
  
    const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  
    if (!response.ok) throw new Error('Failed to create spreadsheet');
    const data = await response.json();
    return data.spreadsheetId;
};

export const syncToGoogleSheets = async (spreadsheetId: string, customers: Customer[], bookings: Booking[]) => {
  const token = await getAccessToken();
  if (!token) throw new Error('No Google access token found');

  const customerRows = [
    ['ID', 'Name', 'Phone', 'Email', 'Address', 'City', 'Vehicles', 'Notes'],
    ...customers.map(c => [
      c.id, c.fullName, c.phoneNumber || '', c.email || '', c.address || '', c.city || '', 
      c.vehicles?.join(', ') || '', c.notes || ''
    ])
  ];

  const bookingRows = [
    ['ID', 'Date', 'Time', 'Customer ID', 'Vehicle', 'Service', 'Price', 'Status', 'Payment', 'Notes'],
    ...bookings.map(b => [
      b.id, b.date, b.time || '', b.customerId, b.vehicle || '', b.service, 
      b.price?.toString() || '', b.status, b.paymentStatus || '', b.notes || ''
    ])
  ];

  const updateBody = {
    valueInputOption: 'USER_ENTERED',
    data: [
      { range: 'Customers!A1', values: customerRows },
      { range: 'Bookings!A1', values: bookingRows }
    ]
  };

  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updateBody),
  });

  if (!response.ok) {
    throw new Error('Failed to sync to sheets');
  }
};
