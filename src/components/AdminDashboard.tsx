import { MessageSquare, FileSpreadsheet, ExternalLink } from 'lucide-react';
import { useCRM } from '../store/useCRM';
import { useEffect, useState } from 'react';
import { getAccessToken } from '../lib/firebaseAuth';

export default function AdminDashboard() {
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null);

  useEffect(() => {
    const fetchId = async () => {
      try {
        const token = await getAccessToken();
        if (!token) return;
        const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=name='Crown CRM Database' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.files && data.files.length > 0) {
          setSpreadsheetId(data.files[0].id);
        }
      } catch (e) {}
    };
    fetchId();
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24 md:pb-0">
      
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
          <FileSpreadsheet className="text-emerald-500" size={20} /> Google Sheets Database
        </h3>
        <p className="text-sm text-slate-600 mb-4">
          Your CRM data is automatically synchronized in real-time to a secure Google Sheet in your Google Drive. 
          Every time you add a customer or update a booking, the sheet is instantly updated.
        </p>
        
        {spreadsheetId ? (
          <a 
            href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-medium rounded-lg transition-colors text-sm"
          >
            Open Google Sheet <ExternalLink size={16} />
          </a>
        ) : (
          <div className="text-sm text-slate-500 italic">Looking for your Google Sheet...</div>
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
