import { useState } from 'react';
import { useCRM } from '../store/useCRM';
import { Calendar, Check, Trash2, Car, Loader2, RefreshCw } from 'lucide-react';
import { IncomingRequest } from '../types';

export default function IncomingRequests() {
  const { addCustomer, addBooking, customers, incomingRequests, updateIncomingRequest, refreshRequests } = useCRM();
  const [processing, setProcessing] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Only show pending requests
  const pendingRequests = incomingRequests.filter(req => req.status !== 'Approved' && req.status !== 'Dismissed' && req.fullName);

  const handleApprove = async (req: IncomingRequest) => {
    setProcessing(req.id);
    try {
      // 1. Check if customer exists or create new
      let customerId = '';
      const existingCustomer = customers.find(c => 
        c.phoneNumber === req.phoneNumber || (c.email && c.email === req.email)
      );

      if (existingCustomer) {
        customerId = existingCustomer.id;
      } else {
        const newCustomer = await addCustomer({
          fullName: req.fullName,
          phoneNumber: req.phoneNumber,
          email: req.email || '',
          address: req.address || '',
          city: req.city || '',
          notes: 'Added from online booking request.',
          lastServiceDate: '',
          vehicles: [req.vehicleMakeModel]
        });
        customerId = newCustomer.id;
      }

      // 2. Create the booking
      await addBooking({
        customerId,
        vehicleId: '',
        vehicle: req.vehicleMakeModel,
        date: req.preferredDate || new Date().toISOString().split('T')[0],
        time: req.preferredTime || '',
        duration: 120, // default
        service: req.serviceRequested,
        price: 0,
        paymentStatus: 'Unpaid',
        status: 'New',
        notes: req.notes || '',
        calendarEventId: ''
      });

      // 3. Mark request as Approved in Sheets
      await updateIncomingRequest(req.id, 'Approved');

    } catch (error) {
      console.error('Error approving request:', error);
      alert('Failed to approve request. Please try again.');
    } finally {
      setProcessing(null);
    }
  };

  const handleDismiss = async (req: IncomingRequest) => {
    if (!window.confirm('Are you sure you want to dismiss this request?')) return;
    setProcessing(req.id);
    try {
      await updateIncomingRequest(req.id, 'Dismissed');
    } catch (error) {
      console.error('Error dismissing request:', error);
      alert('Failed to dismiss request.');
    } finally {
      setProcessing(null);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshRequests();
    setRefreshing(false);
  };

  if (incomingRequests.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6 p-6">
        <div className="flex items-center justify-between mb-4">
           <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
               <Check size={20} />
             </div>
             <div>
               <h3 className="font-bold text-slate-900">No New Requests</h3>
               <p className="text-sm text-slate-500">You're all caught up on Google Form responses.</p>
             </div>
          </div>
          <button onClick={handleRefresh} disabled={refreshing} className="p-2 text-slate-400 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 rounded-lg transition-colors">
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
        <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg mt-4 text-sm text-blue-900">
          <h4 className="font-bold mb-2">How to connect your Google Form:</h4>
          <ol className="list-decimal pl-5 space-y-1 text-blue-800">
            <li>Create a new Google Form with the fields: Full Name, Phone, Email, Address, City, Vehicle, Service, Date, Time, Notes.</li>
            <li>In the Form Responses tab, click "Link to Sheets".</li>
            <li>Select "Select existing spreadsheet" and choose the <strong>Durham CRM Database</strong> file.</li>
            <li>Ensure the new sheet in the spreadsheet is named <strong>Form Responses 1</strong>.</li>
            <li>New submissions will automatically appear here!</li>
          </ol>
        </div>
      </div>
    );
  }

  if (pendingRequests.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6 p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
           <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
             <Check size={20} />
           </div>
           <div>
             <h3 className="font-bold text-slate-900">No New Requests</h3>
             <p className="text-sm text-slate-500">You're all caught up on Google Form responses.</p>
           </div>
        </div>
        <button onClick={handleRefresh} disabled={refreshing} className="p-2 text-slate-400 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 rounded-lg transition-colors">
          <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-blue-200 overflow-hidden mb-6">
      <div className="px-6 py-4 border-b border-blue-100 bg-blue-50 flex justify-between items-center">
        <h3 className="font-bold text-blue-900 flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
          </span>
          New Online Booking Requests ({pendingRequests.length})
        </h3>
        <button onClick={handleRefresh} disabled={refreshing} className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1.5">
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>
      <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
        {pendingRequests.map(req => (
          <div key={req.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h4 className="font-bold text-slate-900 text-base">{req.fullName}</h4>
                <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">Needs Action</span>
              </div>
              <div className="text-sm text-slate-500 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 mt-2">
                <div className="flex items-center gap-1.5"><Calendar size={14} className="text-slate-400"/> {req.preferredDate || 'Any Date'} {req.preferredTime && `(${req.preferredTime})`}</div>
                <div className="flex items-center gap-1.5"><Car size={14} className="text-slate-400"/> {req.vehicleMakeModel}</div>
                <div className="col-span-1 sm:col-span-2 mt-1 flex gap-1.5">
                  <span className="font-medium text-slate-700">Service:</span> {req.serviceRequested}
                </div>
              </div>
              {req.notes && <p className="text-xs text-slate-500 mt-2 italic">"{req.notes}"</p>}
              <p className="text-xs text-slate-400 mt-2">Submitted: {req.timestamp}</p>
            </div>
            
            <div className="flex gap-2 mt-2 sm:mt-0 shrink-0">
              <button 
                onClick={() => handleDismiss(req)}
                disabled={processing === req.id}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {processing === req.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} Dismiss
              </button>
              <button 
                onClick={() => handleApprove(req)}
                disabled={processing === req.id}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
              >
                {processing === req.id ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Approve & Sync
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
