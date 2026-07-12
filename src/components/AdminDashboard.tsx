import { MessageSquare, FileSpreadsheet, DownloadCloud, CheckCircle2 } from 'lucide-react';
import { useCRM } from '../store/useCRM';
import { useState } from 'react';

export default function AdminDashboard() {
  const { sheetCsvUrl, setSheetCsvUrl, syncFromGoogleForm, isSyncing } = useCRM();
  const [localUrl, setLocalUrl] = useState(sheetCsvUrl);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSheetCsvUrl(localUrl);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24 md:pb-0">
      
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
          <DownloadCloud className="text-blue-500" size={20} /> Google Forms Sync (No API Required)
        </h3>
        <p className="text-sm text-slate-600 mb-4 leading-relaxed">
          You can automatically pull bookings from your Google Form without setting up complex APIs. 
          Simply go to your Google Sheet (where form responses are saved), click <strong>File &gt; Share &gt; Publish to web</strong>, 
          select <strong>Comma-separated values (.csv)</strong>, and paste the generated link below.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1 w-full">
            <label className="block text-sm font-medium text-slate-700 mb-1">Published CSV Link</label>
            <input 
              type="text" 
              value={localUrl}
              onChange={(e) => setLocalUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/e/.../pub?output=csv"
              className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <button 
            onClick={handleSave}
            className="w-full sm:w-auto px-6 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
          >
            {saved ? <><CheckCircle2 size={16} /> Saved</> : 'Save Link'}
          </button>
        </div>
        
        {sheetCsvUrl && (
          <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-900">Test your connection</p>
              <p className="text-xs text-slate-500">Pull the latest responses from your Google Form right now.</p>
            </div>
            <button
              onClick={syncFromGoogleForm}
              disabled={isSyncing}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </button>
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
          <FileSpreadsheet className="text-emerald-500" size={20} /> Local CRM Storage
        </h3>
        <p className="text-sm text-slate-600 mb-4">
          Your CRM data is currently being saved securely to your local browser storage.
        </p>
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
      </div>
    </div>
  );
}
