import { useState } from 'react';
import { useCRM } from '../store/useCRM';
import { Calendar, Check, Trash2, Car, Loader2, RefreshCw, Radio, Phone, Mail, MapPin } from 'lucide-react';
import { IncomingRequest } from '../types';
import toast from 'react-hot-toast';
import { useDialog } from './DialogProvider';

export default function IncomingRequests() {
  const { addCustomer, addBooking, customers, incomingRequests, updateIncomingRequest, clearIncomingRequests, refreshRequests } = useCRM();
  const [processing, setProcessing] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { confirm } = useDialog();

  // Only show pending requests
  const pendingRequests = incomingRequests.filter(req => req.status === 'Pending' && req.fullName);

  const handleApprove = async (req: IncomingRequest) => {
    setProcessing(req.id);
    try {
      // 1. Check if customer exists or create new
      let customerId = '';
      const existingCustomer = customers.find(c => 
        (req.phoneNumber && c.phoneNumber === req.phoneNumber) || (req.email && c.email && c.email === req.email)
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
          lastServiceDate: req.preferredDate || '',
          vehicles: req.vehicleMakeModel ? [req.vehicleMakeModel] : []
        });
        customerId = newCustomer.id;
      }

      // 2. Mark request as Approved in public_bookings
      await updateIncomingRequest(req.id, 'Approved');
      toast.success('Request approved and confirmed on your Bookings Calendar!');

    } catch (error) {
      console.error('Error approving request:', error);
      toast.error('Failed to approve request. Please try again.');
    } finally {
      setProcessing(null);
    }
  };

  const handleDismiss = async (req: IncomingRequest) => {
    if (!(await confirm('Dismiss Request', 'Are you sure you want to dismiss this incoming lead?'))) return;
    setProcessing(req.id);
    try {
      await updateIncomingRequest(req.id, 'Dismissed');
      toast.success('Request dismissed');
    } catch (error) {
      console.error('Error dismissing request:', error);
      toast.error('Failed to dismiss request.');
    } finally {
      setProcessing(null);
    }
  };

  const handleClearAll = async () => {
    if (!(await confirm('Clear All Pending Requests', 'Are you sure you want to clear all previous cached requests? New online bookings will continue to arrive automatically.'))) return;
    clearIncomingRequests();
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshRequests();
    setRefreshing(false);
  };

  if (pendingRequests.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6 p-6">
        <div className="flex items-center justify-between">
           <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center">
               <Check size={20} />
             </div>
             <div>
               <h3 className="font-bold text-slate-900">Incoming Requests Inbox (0 Pending)</h3>
               <p className="text-sm text-slate-500">All caught up! Real-time listener is waiting for new website leads from <code className="font-mono text-purple-600 bg-purple-50 px-1 py-0.5 rounded">public_bookings</code>.</p>
             </div>
          </div>
          <button 
            onClick={handleRefresh} 
            disabled={refreshing} 
            title="Check for new leads"
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 border border-slate-200 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Check Now
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-purple-200 overflow-hidden mb-6">
      <div className="px-6 py-4 border-b border-purple-100 bg-purple-50 flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-600"></span>
          </span>
          <h3 className="font-bold text-purple-950 text-base">
            New Online Booking Requests ({pendingRequests.length})
          </h3>
          <span className="text-xs bg-purple-200 text-purple-800 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
            <Radio size={12} className="animate-pulse" /> Live Firestore
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleClearAll} 
            className="text-xs text-slate-500 hover:text-rose-600 px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-rose-50 transition-colors"
          >
            Clear Old Cached ({pendingRequests.length})
          </button>
          <button 
            onClick={handleRefresh} 
            disabled={refreshing} 
            className="text-purple-700 hover:text-purple-900 text-xs font-semibold px-3 py-1 bg-purple-100 hover:bg-purple-200 rounded-md transition-colors flex items-center gap-1.5"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /> Sync Now
          </button>
        </div>
      </div>
      
      <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
        {pendingRequests.map(req => (
          <div key={req.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-purple-50/30 transition-colors">
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center gap-2.5">
                <h4 className="font-bold text-slate-900 text-base">{req.fullName}</h4>
                <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">New Online Lead</span>
              </div>
              
              <div className="text-xs text-slate-600 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
                {req.phoneNumber && (
                  <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                    <Phone size={13} className="text-slate-400"/> {req.phoneNumber}
                  </div>
                )}
                {req.email && (
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <Mail size={13} className="text-slate-400"/> {req.email}
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <Calendar size={13} className="text-purple-600"/> 
                  <span className="font-medium">{req.preferredDate || 'Flexible Date'}</span> {req.preferredTime && `(${req.preferredTime})`}
                </div>
                {req.vehicleMakeModel && (
                  <div className="flex items-center gap-1.5">
                    <Car size={13} className="text-slate-400"/> {req.vehicleMakeModel}
                  </div>
                )}
                {req.address && (
                  <div className="flex items-center gap-1.5 sm:col-span-2">
                    <MapPin size={13} className="text-slate-400"/> {req.address} {req.city && `(${req.city})`}
                  </div>
                )}
                <div className="col-span-1 sm:col-span-2 lg:col-span-3 text-slate-800 font-medium">
                  <span className="text-slate-500 font-normal">Service Requested:</span> {req.serviceRequested}
                </div>
              </div>

              {req.notes && (
                <p className="text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded p-2 italic mt-1">
                  "{req.notes}"
                </p>
              )}
            </div>
            
            <div className="flex items-center gap-2 sm:self-center shrink-0">
              <button 
                onClick={() => handleDismiss(req)}
                disabled={processing === req.id}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {processing === req.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Dismiss
              </button>
              <button 
                onClick={() => handleApprove(req)}
                disabled={processing === req.id}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                {processing === req.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Approve & Add to Calendar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
