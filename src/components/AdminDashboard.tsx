import { MessageSquare, FileSpreadsheet, ExternalLink } from 'lucide-react';
import { useCRM } from '../store/useCRM';

export default function AdminDashboard() {
  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24 md:pb-0">
      
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
          <FileSpreadsheet className="text-emerald-500" size={20} /> Local CRM Storage
        </h3>
        <p className="text-sm text-slate-600 mb-4">
          Your CRM data is currently being saved securely to your local browser storage. This means you do not need to sign in with Google or worry about API keys!
        </p>
        
        <div className="bg-emerald-50 text-emerald-800 p-4 rounded-lg text-sm border border-emerald-200">
          <strong>Tip:</strong> If you want to accept bookings from a public website, you can create a free <strong>Google Form</strong> and manually enter those incoming requests here.
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
