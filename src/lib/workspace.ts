import { getAccessToken } from './firebase';
import { Booking, Customer } from '../types';

export const getCalendars = async () => {
  const token = await getAccessToken();
  if (!token) throw new Error('No Google access token found');
  const res = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Failed to fetch calendars');
  return (await res.json()).items;
};

export const syncToGoogleCalendar = async (booking: Booking, customer?: Customer, calendarId: string = 'primary') => {
  const token = await getAccessToken();
  if (!token) throw new Error('No Google access token found');
  
  const dateStr = booking.date; // YYYY-MM-DD
  const timeStr = booking.time || '09:00';
  const startDateTime = new Date(`${dateStr}T${timeStr}:00`);
  const endDateTime = new Date(startDateTime.getTime() + (booking.duration || 120) * 60000);
  
  const event = {
    summary: `Detailing: ${customer?.fullName || 'Unknown Customer'} - ${booking.vehicle || 'Unknown Vehicle'}`,
    description: `Service: ${booking.service}\nNotes: ${booking.notes || 'None'}\nPhone: ${customer?.phoneNumber || 'None'}`,
    location: `${customer?.address || ''}, ${customer?.city || ''}`,
    start: { dateTime: startDateTime.toISOString() },
    end: { dateTime: endDateTime.toISOString() },
  };

  const method = booking.calendarEventId ? 'PUT' : 'POST';
  const url = booking.calendarEventId 
    ? `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${booking.calendarEventId}`
    : `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  });
  
  if (!response.ok) {
    const txt = await response.text();
    console.error(txt);
    throw new Error('Failed to sync to Calendar');
  }

  const data = await response.json();
  return data.id; // Return the event ID
};

export const deleteFromGoogleCalendar = async (eventId: string, calendarId: string = 'primary') => {
  const token = await getAccessToken();
  if (!token) return;
  await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
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
  
    if (!response.ok) {
      const txt = await response.text();
      console.error(txt);
      throw new Error(`Failed to create spreadsheet: ${txt}`);
    }

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
    const txt = await response.text();
    console.error(txt);
    throw new Error('Failed to sync to sheets');
  }
};
