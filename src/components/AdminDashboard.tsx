import { MessageSquare, FileSpreadsheet, DownloadCloud, CheckCircle2, Database, RefreshCw, Radio } from 'lucide-react';
import { useCRM } from '../store/useCRM';
import { useState } from 'react';

export default function AdminDashboard() {
  const { 
    sheetCsvUrl, 
    setSheetCsvUrl, 
    syncFromGoogleForm, 
    syncFromFirestore, 
    isSyncing, 
    firestoreConnected, 
    firestoreDatabaseId 
  } = useCRM();
  const [localUrl, setLocalUrl] = useState(sheetCsvUrl);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSheetCsvUrl(localUrl);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24 md:pb-0">
      
      {/* Cloud Firestore Integration Card */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-start justify-between">
          <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
            <Database className="text-amber-500" size={20} /> Cloud Firestore Real-Time Database
          </h3>
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
            firestoreConnected ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'
          }`}>
            <span className={`w-2 h-2 rounded-full ${firestoreConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
            {firestoreConnected ? 'Live & Connected' : 'Connecting...'}
          </div>
        </div>

        <p className="text-sm text-slate-600 mb-4 leading-relaxed">
          Your CRM is connected to Cloud Firestore. All bookings, incoming leads, and customer records automatically sync across all your browsers and devices in real time.
        </p>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4 text-xs font-mono text-slate-700 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-sans font-medium">Database ID:</span>
            <span className="font-semibold text-slate-900">{firestoreDatabaseId}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-sans font-medium">Public Web Leads Collection:</span>
            <span className="font-semibold text-purple-600">/public_bookings</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-sans font-medium">CRM Bookings Collection:</span>
            <span className="font-semibold text-blue-600">/bookings</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-sans font-medium">Customers Collection:</span>
            <span className="font-semibold text-emerald-600">/customers</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-slate-500">
            Real-time listener is actively listening for new leads in <code className="text-slate-700 font-semibold">bookings</code>.
          </p>
          <button
            onClick={syncFromFirestore}
            disabled={isSyncing}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
            {isSyncing ? 'Syncing...' : 'Fetch Leads Now'}
          </button>
        </div>
      </div>

      {/* Google Forms / Sheets Sync Card */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
          <DownloadCloud className="text-blue-500" size={20} /> Google Forms Sync (Alternative Import)
        </h3>
        <p className="text-sm text-slate-600 mb-4 leading-relaxed">
          If you also use a Google Form for bookings, you can pull responses into your CRM. 
          Go to your Google Sheet, click <strong>File &gt; Share &gt; Publish to web</strong>, 
          select <strong>Comma-separated values (.csv)</strong>, and paste the link below.
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
              <p className="text-sm font-medium text-slate-900">Google Sheet Connection</p>
              <p className="text-xs text-slate-500">Import responses from your published Google Form sheet.</p>
            </div>
            <button
              onClick={syncFromGoogleForm}
              disabled={isSyncing}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isSyncing ? 'Syncing...' : 'Sync CSV Now'}
            </button>
          </div>
        )}
      </div>

      {/* SMS Notifications Card */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
          <MessageSquare className="text-blue-500" size={20} /> Automated SMS Notifications
        </h3>
        <p className="text-sm text-slate-500 mb-2">
          You are currently using <strong>Native SMS Integration (Free)</strong>. 
        </p>
        <p className="text-sm text-slate-600">
          When you advance a job status on the Manifest (e.g. to Confirmed, On The Way, or Completed), the app will automatically generate a custom SMS message and open your device's native messaging app (iMessage, Android Messages, or Phone Link) with the customer's phone number and the message pre-filled.
        </p>
      </div>
    </div>
  );
}
