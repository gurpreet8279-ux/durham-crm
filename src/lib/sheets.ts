import { getAccessToken } from './firebase';

const SPREADSHEET_NAME = 'Durham CRM Database';

export async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated');
  
  const headers = {
    ...options.headers,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  
  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google API Error: ${response.status} ${errorText}`);
  }
  return response.json();
}

export async function findOrCreateSpreadsheet(): Promise<string> {
  // Search for existing spreadsheet
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='${SPREADSHEET_NAME}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`;
  const searchResult = await fetchWithAuth(searchUrl);
  
  if (searchResult.files && searchResult.files.length > 0) {
    return searchResult.files[0].id;
  }
  
  // Create new spreadsheet
  const createUrl = 'https://sheets.googleapis.com/v4/spreadsheets';
  const createResult = await fetchWithAuth(createUrl, {
    method: 'POST',
    body: JSON.stringify({
      properties: { title: SPREADSHEET_NAME },
      sheets: [
        { properties: { title: 'Customers' } },
        { properties: { title: 'Bookings' } },
        { properties: { title: 'Vehicles' } },
        { properties: { title: 'Services' } },
        { properties: { title: 'Settings' } }
      ]
    })
  });
  
  const spreadsheetId = createResult.spreadsheetId;
  
  // Set headers
  await fetchWithAuth(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        { updateCells: { range: { sheetId: createResult.sheets[0].properties.sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 11 }, rows: [{ values: ['id', 'fullName', 'phoneNumber', 'email', 'address', 'city', 'notes', 'createdAt', 'lastServiceDate', 'updatedAt', 'vehicles'].map(v => ({ userEnteredValue: { stringValue: v } })) }], fields: 'userEnteredValue' } },
        { updateCells: { range: { sheetId: createResult.sheets[1].properties.sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 14 }, rows: [{ values: ['id', 'customerId', 'vehicleId', 'date', 'time', 'duration', 'service', 'price', 'paymentStatus', 'status', 'notes', 'createdAt', 'calendarEventId', 'updatedAt'].map(v => ({ userEnteredValue: { stringValue: v } })) }], fields: 'userEnteredValue' } },
        { updateCells: { range: { sheetId: createResult.sheets[2].properties.sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 7 }, rows: [{ values: ['id', 'customerId', 'makeModel', 'year', 'color', 'licensePlate', 'createdAt'].map(v => ({ userEnteredValue: { stringValue: v } })) }], fields: 'userEnteredValue' } },
        { updateCells: { range: { sheetId: createResult.sheets[3].properties.sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 5 }, rows: [{ values: ['id', 'name', 'description', 'defaultPrice', 'defaultDuration'].map(v => ({ userEnteredValue: { stringValue: v } })) }], fields: 'userEnteredValue' } },
        { updateCells: { range: { sheetId: createResult.sheets[4].properties.sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 2 }, rows: [{ values: ['key', 'value'].map(v => ({ userEnteredValue: { stringValue: v } })) }], fields: 'userEnteredValue' } }
      ]
    })
  });
  
  return spreadsheetId;
}

export async function getSheetData(spreadsheetId: string, range: string) {
  const data = await fetchWithAuth(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`);
  return data.values || [];
}

export async function appendRow(spreadsheetId: string, range: string, values: any[]) {
  return await fetchWithAuth(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`, {
    method: 'POST',
    body: JSON.stringify({ values: [values] })
  });
}

export async function updateRow(spreadsheetId: string, range: string, values: any[]) {
  return await fetchWithAuth(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    body: JSON.stringify({ values: [values] })
  });
}
