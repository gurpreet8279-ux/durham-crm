const fs = require('fs');

let content = fs.readFileSync('src/lib/workspace.ts', 'utf8');

content = content.replace(/export const syncToGoogleCalendar = async \(booking: Booking, customer\?: Customer\) => \{[\s\S]*?\};/, `export const getCalendars = async () => {
  const token = await getAccessToken();
  if (!token) throw new Error('No Google access token found');
  const res = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
    headers: { Authorization: \`Bearer \${token}\` }
  });
  if (!res.ok) throw new Error('Failed to fetch calendars');
  return (await res.json()).items;
};

export const syncToGoogleCalendar = async (booking: Booking, customer?: Customer, calendarId: string = 'primary') => {
  const token = await getAccessToken();
  if (!token) throw new Error('No Google access token found');
  
  const dateStr = booking.date; // YYYY-MM-DD
  const timeStr = booking.time || '09:00';
  const startDateTime = new Date(\`\${dateStr}T\${timeStr}:00\`);
  const endDateTime = new Date(startDateTime.getTime() + (booking.duration || 120) * 60000);
  
  const event = {
    summary: \`Detailing: \${customer?.fullName || 'Unknown Customer'} - \${booking.vehicle || 'Unknown Vehicle'}\`,
    description: \`Service: \${booking.service}\\nNotes: \${booking.notes || 'None'}\\nPhone: \${customer?.phoneNumber || 'None'}\`,
    location: \`\${customer?.address || ''}, \${customer?.city || ''}\`,
    start: { dateTime: startDateTime.toISOString() },
    end: { dateTime: endDateTime.toISOString() },
  };

  const method = booking.calendarEventId ? 'PUT' : 'POST';
  const url = booking.calendarEventId 
    ? \`https://www.googleapis.com/calendar/v3/calendars/\${encodeURIComponent(calendarId)}/events/\${booking.calendarEventId}\`
    : \`https://www.googleapis.com/calendar/v3/calendars/\${encodeURIComponent(calendarId)}/events\`;

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: \`Bearer \${token}\`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  });
  
  if (!response.ok) {
    throw new Error('Failed to sync to Calendar');
  }
  const data = await response.json();
  return data.id; // Return the event ID
};

export const deleteFromGoogleCalendar = async (eventId: string, calendarId: string = 'primary') => {
  const token = await getAccessToken();
  if (!token) return;
  await fetch(\`https://www.googleapis.com/calendar/v3/calendars/\${encodeURIComponent(calendarId)}/events/\${eventId}\`, {
    method: 'DELETE',
    headers: { Authorization: \`Bearer \${token}\` }
  });
};`);

fs.writeFileSync('src/lib/workspace.ts', content);
