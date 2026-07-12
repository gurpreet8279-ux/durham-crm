import { getAccessToken } from './firebaseAuth';

const SPREADSHEET_NAME = 'Crown CRM Database';

export async function findOrCreateSpreadsheet(): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error("No access token");

  // Search for existing
  const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=name='${SPREADSHEET_NAME}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const searchData = await searchRes.json();

  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // Create new
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: { 
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      properties: { title: SPREADSHEET_NAME },
      sheets: [
        { properties: { title: 'Customers' } },
        { properties: { title: 'Bookings' } },
        { properties: { title: 'Vehicles' } },
        { properties: { title: 'IncomingRequests' } }
      ]
    })
  });
  const createData = await createRes.json();
  return createData.spreadsheetId;
}

export async function syncToSheets(spreadsheetId: string, data: any) {
  const token = await getAccessToken();
  if (!token) throw new Error("No access token");

  // We will do a simple wipe and rewrite for this simple app to keep it fully synced
  // In a production app, we would use append or update rows selectively.
  
  const requests = [];

  // Helper to convert array of objects to array of arrays (sheets format)
  const toSheetData = (arr: any[]) => {
    if (!arr || arr.length === 0) return [];
    const headers = Object.keys(arr[0]);
    const rows = arr.map(item => headers.map(h => typeof item[h] === 'object' ? JSON.stringify(item[h]) : String(item[h])));
    return [headers, ...rows];
  };

  const sheetsToSync = ['Customers', 'Bookings', 'Vehicles', 'IncomingRequests'];
  
  for (const sheetName of sheetsToSync) {
    const sheetData = data[sheetName.charAt(0).toLowerCase() + sheetName.slice(1)] || [];
    const values = toSheetData(sheetData);

    // Clear existing
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A1:Z1000:clear`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });

    // Write new
    if (values.length > 0) {
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A1?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values })
      });
    }
  }
}

export async function readFromSheets(spreadsheetId: string) {
  const token = await getAccessToken();
  if (!token) throw new Error("No access token");

  const sheetsToSync = ['Customers', 'Bookings', 'Vehicles', 'IncomingRequests'];
  const data: any = {
    customers: [],
    bookings: [],
    vehicles: [],
    incomingRequests: []
  };

  const toObjects = (values: any[][]) => {
    if (!values || values.length < 2) return [];
    const headers = values[0];
    return values.slice(1).map(row => {
      const obj: any = {};
      headers.forEach((h, i) => {
        let val = row[i];
        try { val = JSON.parse(val); } catch(e) {}
        obj[h] = val;
      });
      return obj;
    });
  };

  for (const sheetName of sheetsToSync) {
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A1:Z1000`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const result = await res.json();
    const key = sheetName.charAt(0).toLowerCase() + sheetName.slice(1);
    if (result.values) {
      data[key] = toObjects(result.values);
    }
  }

  return data;
}
