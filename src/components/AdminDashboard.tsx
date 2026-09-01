import { MessageSquare, DownloadCloud, CheckCircle2, Database, RefreshCw, Trash2, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { useCRM } from '../store/useCRM';
import { useState, useEffect } from 'react';
import { useDialog } from './DialogProvider';
import toast from 'react-hot-toast';

export default function AdminDashboard() {
  const { 
    bookings,
    customers,
    incomingRequests,
    sheetCsvUrl, 
    setSheetCsvUrl, 
    syncSheetBookings, 
    syncWebsiteBookings, 
    purgeAllBookings,
    purgeAllCustomers,
    purgeAllIncomingLeads,
    cleanDuplicateBookings,
    isSyncing, 
    firestoreConnected, 
    firestoreDatabaseId 
  } = useCRM();
  const [localUrl, setLocalUrl] = useState(sheetCsvUrl);
  const [saved, setSaved] = useState(false);
  const [purging, setPurging] = useState<string | null>(null);
  const [cleaning, setCleaning] = useState(false);
  const { confirm } = useDialog();

  useEffect(() => {
    if (sheetCsvUrl) {
      setLocalUrl(sheetCsvUrl);
    }
  }, [sheetCsvUrl]);

  const handleSave = async () => {
    await setSheetCsvUrl(localUrl);
    setSaved(true);
    toast.success('Saved ✓');
    setTimeout(() => setSaved(false), 3500);
  };

  const handlePurgeBookings = async () => {
    if (await confirm('Purge All Bookings', `Are you sure you want to permanently delete all ${bookings.length} previous booking records from Cloud Firestore? Only fresh bookings will appear afterwards.`)) {
      setPurging('bookings');
      await purgeAllBookings();
      setPurging(null);
    }
  };

  const handlePurgeCustomers = async () => {
    if (await confirm('Purge All Customers', `Are you sure you want to permanently delete all ${customers.length} customer profiles from Cloud Firestore?`)) {
      setPurging('customers');
      await purgeAllCustomers();
      setPurging(null);
    }
  };

  const handlePurgeLeads = async () => {
    if (await confirm('Purge All Incoming Leads', 'Are you sure you want to clear all leads in public_bookings?')) {
      setPurging('leads');
      await purgeAllIncomingLeads();
      setPurging(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24 md:pb-0">
      
      {/* Cloud Firestore Integration Card */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-start justify-between">
          <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
            <Database className="text-amber-500" size={20} /> Cloud Firestore Database
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

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4 text-xs font-mono text-slate-700 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-sans font-medium">Database ID:</span>
            <span className="font-semibold text-slate-900">{firestoreDatabaseId}</span>
          </div>
          <div className="flex items-center justify-between border-t border-slate-200 pt-1.5">
            <span className="text-slate-500 font-sans font-medium">Online Web Leads (/public_bookings):</span>
            <span className="font-semibold text-purple-600">{incomingRequests.length} Pending</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-sans font-medium">CRM Scheduled Bookings (/bookings):</span>
            <span className="font-semibold text-blue-600">{bookings.length} Records</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-sans font-medium">Customer Profiles (/customers):</span>
            <span className="font-semibold text-emerald-600">{customers.length} Customers</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-slate-500">
            Real-time synchronization is active.
          </p>
          <button
            onClick={syncWebsiteBookings}
            disabled={isSyncing}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
            {isSyncing ? 'Syncing...' : 'Sync Website Bookings'}
          </button>
        </div>
      </div>

      {/* Database Cleanup / Purge Tools */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
          <AlertTriangle className="text-rose-500" size={20} /> Database Reset & Clean Up
        </h3>
        <p className="text-sm text-slate-600 mb-4 leading-relaxed">
          If you have old test or imported records in Firestore that you want to wipe so your CRM starts fresh:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex flex-col justify-between">
            <div>
              <p className="font-bold text-xs text-slate-900">Deduplicate Database</p>
              <p className="text-xs text-slate-500 mt-0.5">Finds & merges duplicate bookings</p>
            </div>
            <button
              onClick={async () => {
                setCleaning(true);
                await cleanDuplicateBookings();
                setCleaning(false);
              }}
              disabled={cleaning || isSyncing}
              className="mt-3 w-full py-1.5 px-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40"
            >
              <RefreshCw size={13} className={cleaning ? 'animate-spin' : ''} /> {cleaning ? 'Cleaning...' : 'Clean Duplicates'}
            </button>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex flex-col justify-between">
            <div>
              <p className="font-bold text-xs text-slate-900">Bookings Collection</p>
              <p className="text-xs text-slate-500 mt-0.5">{bookings.length} total records</p>
            </div>
            <button
              onClick={handlePurgeBookings}
              disabled={purging === 'bookings' || bookings.length === 0}
              className="mt-3 w-full py-1.5 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40"
            >
              <Trash2 size={13} /> {purging === 'bookings' ? 'Purging...' : 'Purge All Bookings'}
            </button>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex flex-col justify-between">
            <div>
              <p className="font-bold text-xs text-slate-900">Customers Collection</p>
              <p className="text-xs text-slate-500 mt-0.5">{customers.length} total records</p>
            </div>
            <button
              onClick={handlePurgeCustomers}
              disabled={purging === 'customers' || customers.length === 0}
              className="mt-3 w-full py-1.5 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40"
            >
              <Trash2 size={13} /> {purging === 'customers' ? 'Purging...' : 'Purge All Customers'}
            </button>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex flex-col justify-between">
            <div>
              <p className="font-bold text-xs text-slate-900">Online Leads Inbox</p>
              <p className="text-xs text-slate-500 mt-0.5">{incomingRequests.length} pending leads</p>
            </div>
            <button
              onClick={handlePurgeLeads}
              disabled={purging === 'leads' || incomingRequests.length === 0}
              className="mt-3 w-full py-1.5 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40"
            >
              <Trash2 size={13} /> {purging === 'leads' ? 'Purging...' : 'Clear All Leads'}
            </button>
          </div>
        </div>
      </div>

      {/* Google Forms / Sheets Sync Card */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
          <DownloadCloud className="text-blue-500" size={20} /> Offline / Google Sheet CSV Sync
        </h3>
        <p className="text-sm text-slate-600 mb-4 leading-relaxed">
          If you take bookings offline or via a Google Form / Sheet, publish your sheet to the web as a CSV.
          Go to Google Sheets &gt; <strong>File &gt; Share &gt; Publish to web</strong> &gt; select <strong>Comma-separated values (.csv)</strong>, and paste the URL below.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1 w-full">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-slate-700">Published Google Sheet CSV Link</label>
              {saved && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                  <CheckCircle2 size={13} /> Saved ✓
                </span>
              )}
            </div>
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
            className={`w-full sm:w-auto px-6 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              saved 
                ? 'bg-emerald-600 text-white hover:bg-emerald-700' 
                : 'bg-slate-900 text-white hover:bg-slate-800'
            }`}
          >
            {saved ? <><CheckCircle2 size={16} /> Saved ✓</> : 'Save Link'}
          </button>
        </div>
        
        {sheetCsvUrl && (
          <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-900">Google Sheet Connection</p>
              <p className="text-xs text-slate-500">Reconcile all offline rows into CRM (updates modified rows, inserts new ones).</p>
            </div>
            <button
              onClick={syncSheetBookings}
              disabled={isSyncing}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <FileSpreadsheet size={16} />
              {isSyncing ? 'Syncing...' : 'Sync Sheet Bookings'}
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
