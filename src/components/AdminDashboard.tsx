import { useState, useEffect } from 'react';
import { MessageSquare, Table, Calendar, CheckCircle2, AlertCircle } from 'lucide-react';
import { useCRM } from '../store/useCRM';
import { createSpreadsheet, getCalendars } from '../lib/workspace';

export default function AdminDashboard() {
  const { spreadsheetId, setSpreadsheetId, calendarId, setCalendarId } = useCRM();
  
  const [calendars, setCalendars] = useState<any[]>([]);
  const [loadingSheets, setLoadingSheets] = useState(false);
  const [loadingCalendars, setLoadingCalendars] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCalendars = async () => {
      try {
        setLoadingCalendars(true);
        const cals = await getCalendars();
        setCalendars(cals);
      } catch (err: any) {
        console.error('Error fetching calendars:', err);
      } finally {
        setLoadingCalendars(false);
      }
    };
    
    fetchCalendars();
  }, []);

  const handleCreateSpreadsheet = async () => {
    try {
      setLoadingSheets(true);
      setError(null);
      const newId = await createSpreadsheet();
      await setSpreadsheetId(newId);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to create spreadsheet');
    } finally {
      setLoadingSheets(false);
    }
  };

  const handleDisconnectSheets = () => {
    if (window.confirm('Are you sure you want to disconnect Google Sheets sync? (Your data will remain in the spreadsheet)')) {
      setSpreadsheetId(null);
    }
  };

  const handleDisconnectCalendar = () => {
    if (window.confirm('Are you sure you want to disconnect Google Calendar?')) {
      setCalendarId(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24 md:pb-0">
      
      {/* Workspace Integration: Sheets */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-start justify-between mb-4">
          <h3 className="font-bold text-slate-900 flex items-center gap-2">
            <Table className="text-emerald-500" size={20} /> Google Sheets Sync
          </h3>
          {spreadsheetId && (
            <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
              <CheckCircle2 size={12} /> Connected
            </span>
          )}
        </div>
        
        <p className="text-sm text-slate-600 mb-6">
          Automatically back up and sync your CRM data (Customers and Bookings) to a Google Spreadsheet.
        </p>

        {error && (
          <div className="mb-4 flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-100">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {spreadsheetId ? (
          <div className="space-y-4">
            <a 
              href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}`} 
              target="_blank" 
              rel="noreferrer"
              className="inline-block text-sm text-blue-600 hover:underline mb-2"
            >
              Open Connected Spreadsheet ↗
            </a>
            <div className="pt-4 border-t border-slate-100">
              <button
                onClick={handleDisconnectSheets}
                className="text-sm text-red-600 hover:text-red-700 font-medium"
              >
                Disconnect Sheets
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={handleCreateSpreadsheet}
            disabled={loadingSheets}
            className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {loadingSheets ? 'Creating Database...' : 'Create & Connect CRM Database'}
          </button>
        )}
      </div>

      {/* Workspace Integration: Calendar */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-start justify-between mb-4">
          <h3 className="font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="text-blue-500" size={20} /> Google Calendar Sync
          </h3>
          {calendarId && (
            <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
              <CheckCircle2 size={12} /> Connected
            </span>
          )}
        </div>
        
        <p className="text-sm text-slate-600 mb-6">
          Automatically create and update events on your Google Calendar when a booking is created or modified.
        </p>

        {loadingCalendars ? (
          <p className="text-sm text-slate-500">Loading calendars...</p>
        ) : (
          <div className="space-y-4">
            {!calendarId ? (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Select a Calendar</label>
                <select
                  className="w-full md:w-auto p-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  onChange={(e) => {
                    if (e.target.value) {
                      setCalendarId(e.target.value);
                    }
                  }}
                  defaultValue=""
                >
                  <option value="" disabled>Choose calendar...</option>
                  {calendars.map(c => (
                    <option key={c.id} value={c.id}>{c.summary}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm font-medium text-slate-900">
                  Currently syncing to: {calendars.find(c => c.id === calendarId)?.summary || calendarId}
                </p>
                <div className="pt-4 border-t border-slate-100">
                  <button
                    onClick={handleDisconnectCalendar}
                    className="text-sm text-red-600 hover:text-red-700 font-medium"
                  >
                    Disconnect Calendar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
          <MessageSquare className="text-slate-500" size={20} /> Automated SMS Notifications
        </h3>
        <p className="text-sm text-slate-500 mb-4">
          You are currently using the <strong>Native SMS Integration (Free)</strong>. 
        </p>
        <p className="text-sm text-slate-600 mb-4">
          When you advance a job status on the Manifest (e.g. to Confirmed, On The Way, or Completed), the app will automatically generate a custom SMS message and open your device's native messaging app (iMessage, Android Messages, or Phone Link) with the customer's phone number and the message pre-filled.
        </p>
        <div className="bg-slate-50 text-slate-800 p-4 rounded-lg text-sm border border-slate-200">
          <strong>Tip:</strong> This approach is 100% free, uses your own business phone number, and doesn't require any API keys or subscriptions!
        </div>
      </div>
    </div>
  );
}
