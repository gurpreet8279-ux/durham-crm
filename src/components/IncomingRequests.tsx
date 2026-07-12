import { useState, useEffect } from 'react';
import { getFirestore, collection, query, orderBy, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { app } from '../lib/firebaseAuth';
import { useCRM } from '../store/useCRM';
import { Calendar, Check, Trash2, Clock, Car } from 'lucide-react';

export default function IncomingRequests() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { addCustomer, addBooking, customers } = useCRM();

  useEffect(() => {
    const db = getFirestore(app);
    const q = query(collection(db, 'public_bookings'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRequests(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleApprove = async (req: any) => {
    try {
      // 1. Check if customer exists or create new
      let customerId = '';
      const existingCustomer = customers.find(c => 
        c.phoneNumber === req.phoneNumber || c.email === req.email
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

      // 3. Delete the request from Firestore
      const db = getFirestore(app);
      await deleteDoc(doc(db, 'public_bookings', req.id));

    } catch (error) {
      console.error('Error approving request:', error);
      alert('Failed to approve request. Please try again.');
    }
  };

  const handleDismiss = async (id: string) => {
    if (!window.confirm('Are you sure you want to dismiss this request?')) return;
    try {
      const db = getFirestore(app);
      await deleteDoc(doc(db, 'public_bookings', id));
    } catch (error) {
      console.error('Error dismissing request:', error);
    }
  };

  if (loading || requests.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-blue-200 overflow-hidden mb-6">
      <div className="px-6 py-4 border-b border-blue-100 bg-blue-50 flex justify-between items-center">
        <h3 className="font-bold text-blue-900 flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
          </span>
          New Online Booking Requests ({requests.length})
        </h3>
      </div>
      <div className="divide-y divide-slate-100">
        {requests.map(req => (
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
            </div>
            
            <div className="flex gap-2 mt-2 sm:mt-0 shrink-0">
              <button 
                onClick={() => handleDismiss(req.id)}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                <Trash2 size={16} /> Dismiss
              </button>
              <button 
                onClick={() => handleApprove(req)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 shadow-sm"
              >
                <Check size={16} /> Approve & Sync
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
