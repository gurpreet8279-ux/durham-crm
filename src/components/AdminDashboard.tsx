import { useState, useEffect } from 'react';
import { useCRM } from '../store/useCRM';
import { initAuth, googleSignIn, getAccessToken, logout } from '../lib/auth';
import { createSpreadsheet, syncToGoogleSheets, syncToGoogleCalendar } from '../lib/workspace';
import { Settings, Database, Calendar, MessageSquare, Save, LogOut } from 'lucide-react';

export default function AdminDashboard() {
  const { customers, bookings, spreadsheetId, setSpreadsheetId } = useCRM();
  const [needsAuth, setNeedsAuth] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  useEffect(() => {
    initAuth(
      (u) => {
        setUser(u);
        setNeedsAuth(false);
      },
      () => {
        setUser(null);
        setNeedsAuth(true);
      }
    );
  }, []);

  const handleLogin = async () => {
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setNeedsAuth(false);
      }
    } catch (err) {
      console.error('Login failed:', err);
    }
  };

  const handleSyncToSheets = async () => {
    setIsSyncing(true);
    setSyncStatus('Syncing to Google Sheets...');
    try {
      let currentSpreadsheetId = spreadsheetId;
      if (!currentSpreadsheetId) {
        setSyncStatus('Creating new spreadsheet...');
        currentSpreadsheetId = await createSpreadsheet();
        setSpreadsheetId(currentSpreadsheetId);
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
        await syncToGoogleCalendar(booking, customer);
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
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold flex items-center gap-2 mb-6">
          <Settings className="text-slate-500" /> Admin Dashboard & Integrations
        </h2>

        {needsAuth ? (
          <div className="bg-slate-50 p-6 rounded-lg text-center border border-slate-200">
            <h3 className="font-bold text-slate-900 mb-2">Connect Google Workspace</h3>
            <p className="text-sm text-slate-500 mb-4">
              Sign in with your Google account to enable two-way sync with Google Sheets and Google Calendar.
            </p>
            <button onClick={handleLogin} className="gsi-material-button bg-white border border-slate-300 rounded shadow-sm px-4 py-2 flex items-center gap-3 mx-auto hover:bg-slate-50 transition-colors">
              <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5" style={{display: 'block'}}>
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                <path fill="none" d="M0 0h48v48H0z"></path>
              </svg>
              <span className="text-sm font-medium text-slate-700">Sign in with Google</span>
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-emerald-50 text-emerald-800 rounded-lg border border-emerald-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center font-bold">
                  {user?.displayName?.[0] || 'A'}
                </div>
                <div>
                  <div className="font-bold">Connected as {user?.displayName}</div>
                  <div className="text-sm opacity-80">{user?.email}</div>
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
                {spreadsheetId && (
                  <p className="text-xs text-blue-600 mb-4 font-medium">
                    <a href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`} target="_blank" rel="noreferrer" className="hover:underline">
                      Open Current Spreadsheet ↗
                    </a>
                  </p>
                )}
                <button 
                  onClick={handleSyncToSheets}
                  disabled={isSyncing}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
                >
                  Sync Database to Sheets
                </button>
              </div>

              <div className="border border-slate-200 p-5 rounded-lg">
                <div className="flex items-center gap-2 font-bold text-slate-900 mb-2">
                  <Calendar className="text-purple-500" size={20} /> Google Calendar
                </div>
                <p className="text-sm text-slate-500 mb-4">
                  Sync all 'New' and 'Confirmed' bookings to your primary Google Calendar.
                </p>
                <button 
                  onClick={handleSyncToCalendar}
                  disabled={isSyncing}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 mt-auto"
                >
                  Sync Bookings to Calendar
                </button>
              </div>
            </div>

            {syncStatus && (
              <div className="p-3 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg text-center animate-pulse">
                {syncStatus}
              </div>
            )}
          </div>
        )}
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
