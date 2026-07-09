import { useState } from 'react';
import { useCRM } from '../store/useCRM';
import { auth, logout } from '../lib/firebase';
import { createSpreadsheet, syncToGoogleSheets, syncToGoogleCalendar, getCalendars } from '../lib/workspace';
import { Settings, Database, Calendar, MessageSquare, LogOut } from 'lucide-react';

export default function AdminDashboard() {
  const { customers, bookings, spreadsheetId, setSpreadsheetId, calendarId, setCalendarId } = useCRM();
  const [availableCalendars, setAvailableCalendars] = useState<any[]>([]);
  
  useEffect(() => {
    if (user) {
      getCalendars().then(setAvailableCalendars).catch(console.error);
    }
  }, [user]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  const user = auth.currentUser;

  const handleSyncToSheets = async () => {
    setIsSyncing(true);
    setSyncStatus('Syncing to Google Sheets...');
    try {
      let currentSpreadsheetId = spreadsheetId;
      if (!currentSpreadsheetId) {
        const inputVal = (document.getElementById('sheetIdInput') as HTMLInputElement)?.value;
        if (inputVal) {
          currentSpreadsheetId = inputVal.includes('d/') ? inputVal.split('d/')[1].split('/')[0] : inputVal;
          await setSpreadsheetId(currentSpreadsheetId);
        }
      }
      if (!currentSpreadsheetId) {
        setSyncStatus('Creating new spreadsheet...');
        currentSpreadsheetId = await createSpreadsheet();
        await setSpreadsheetId(currentSpreadsheetId);
      }
      
      setSyncStatus('Updating spreadsheet data...');
      await syncToGoogleSheets(currentSpreadsheetId!, customers, bookings);
      setSyncStatus('Successfully synced to Google Sheets!');
      setTimeout(() => setSyncStatus(null), 3000);
    } catch (err) {
      console.error(err);
      setSyncStatus('Failed to sync to Google Sheets');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncToCalendar = async () => {
    setIsSyncing(true);
    setSyncStatus('Syncing upcoming bookings to Calendar...');
    try {
      const upcomingBookings = bookings.filter(b => b.status === 'New Booking' || b.status === 'Confirmed');
      for (const booking of upcomingBookings) {
        const customer = customers.find(c => c.id === booking.customerId);
        await syncToGoogleCalendar(booking, customer, calendarId || 'primary');
        setSyncStatus(`Synced booking for ${customer?.fullName || 'Unknown'}`);
      }
      setSyncStatus('Successfully synced all upcoming bookings to Calendar!');
      setTimeout(() => setSyncStatus(null), 3000);
    } catch (err) {
      console.error(err);
      setSyncStatus('Failed to sync to Google Calendar');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24 md:pb-0">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold flex items-center gap-2 mb-6">
          <Settings className="text-slate-500" /> Admin Dashboard & Integrations
        </h2>
        
        <div className="space-y-6">
          <div className="flex items-center justify-between p-4 bg-emerald-50 text-emerald-800 rounded-lg border border-emerald-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center font-bold">
                {user?.displayName?.[0] || 'A'}
              </div>
              <div>
                <div className="font-bold">Connected as {user?.displayName || 'User'}</div>
                <div className="text-sm opacity-80">{user?.email || ''}</div>
              </div>
            </div>
            <button onClick={logout} className="p-2 hover:bg-emerald-100 rounded-lg text-emerald-700 transition-colors">
              <LogOut size={20} />
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-slate-200 p-5 rounded-lg">
              <div className="flex items-center gap-2 font-bold text-slate-900 mb-2">
                <Database className="text-blue-500" size={20} /> Google Sheets Database
              </div>
              <p className="text-sm text-slate-500 mb-4">
                Export all your customers and bookings to a Google Sheet for reporting and backup.
              </p>
              {spreadsheetId ? (
                <div className="mb-4">
                  <p className="text-xs text-blue-600 font-medium mb-2">
                    <a href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`} target="_blank" rel="noreferrer" className="hover:underline">
                      Open Current Spreadsheet ↗
                    </a>
                  </p>
                  <button 
                    onClick={() => setSpreadsheetId(null)}
                    className="text-xs text-red-600 font-medium hover:underline"
                  >
                    Disconnect Spreadsheet
                  </button>
                </div>
              ) : (
                <div className="mb-4">
                  <p className="text-xs text-slate-500 mb-2">Paste a Google Sheet ID to use an existing one, or leave blank to create a new one.</p>
                  <input
                    type="text"
                    placeholder="Spreadsheet ID (Optional)"
                    id="sheetIdInput"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              )}
              <button 
                onClick={handleSyncToSheets}
                disabled={isSyncing}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
              >
                Sync Database to Sheets
              </button>
            </div>
            
            <div className="border border-slate-200 p-5 rounded-lg flex flex-col">
              <div className="flex items-center gap-2 font-bold text-slate-900 mb-2">
                <Calendar className="text-purple-500" size={20} /> Google Calendar
              </div>
              <p className="text-sm text-slate-500 mb-4">
                Select a calendar to automatically sync bookings. Events update when you edit bookings.
              </p>
              
              <div className="mb-4">
                <select 
                  value={calendarId || ''}
                  onChange={(e) => setCalendarId(e.target.value || null)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                >
                  <option value="">-- Do not sync --</option>
                  {availableCalendars.map(c => (
                    <option key={c.id} value={c.id}>{c.summary}</option>
                  ))}
                </select>
              </div>

              <button 
                onClick={handleSyncToCalendar}
                disabled={isSyncing || !calendarId}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 mt-auto"
              >
                Force Sync All Upcoming
              </button>
            </div>
          </div>
          
          {syncStatus && (
            <div className="p-3 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg text-center animate-pulse">
              {syncStatus}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
          <MessageSquare className="text-blue-500" size={20} /> Automated SMS Notifications
        </h3>
        <p className="text-sm text-slate-500 mb-4">
          You are currently using the <strong>Native SMS Integration (Free)</strong>. 
        </p>
        <p className="text-sm text-slate-600 mb-4">
          When you advance a job status on the Manifest (e.g. to Confirmed, On The Way, or Completed), the app will automatically generate a custom SMS message and open your device's native messaging app (iMessage, Android Messages, or Phone Link) with the customer's phone number and the message pre-filled.
        </p>
        <div className="bg-blue-50 text-blue-800 p-4 rounded-lg text-sm border border-blue-200">
          <strong>Tip:</strong> This approach is 100% free, uses your own business phone number, and doesn't require any API keys or subscriptions!
        </div>
      </div>
    </div>
  );
}
