import { useState } from 'react';
import { useCRM } from '../store/useCRM';
import { Calendar as CalendarIcon, MapPin, Phone, Car, DollarSign, Clock, Navigation, CheckCircle, RefreshCcw, Bell } from 'lucide-react';

export default function Manifest() {
  const { bookings, customers, updateBooking } = useCRM();
  const [smsStatus, setSmsStatus] = useState<Record<string, string>>({});

  // Get today's date in YYYY-MM-DD
  const todayStr = new Date().toISOString().split('T')[0];
  
  // Filter jobs for today, sort by time
  const todayJobs = bookings
    .filter(b => b.date === todayStr)
    .sort((a, b) => {
      const timeA = a.time || '00:00';
      const timeB = b.time || '00:00';
      return timeA.localeCompare(timeB);
    });

  const totalRevenue = todayJobs.reduce((sum, job) => sum + (job.price || 0), 0);
  
  const getCustomer = (id: string) => customers.find(c => c.id === id);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return 'bg-green-100 text-green-700 border-green-200';
      case 'Paid': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'Started': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'On The Way': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Confirmed': return 'bg-sky-100 text-sky-700 border-sky-200';
      case 'Cancelled': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const nextStatus = (currentStatus: string) => {
    switch (currentStatus) {
      case 'New Booking': return 'Confirmed';
      case 'Confirmed': return 'On The Way';
      case 'On The Way': return 'Started';
      case 'Started': return 'Completed';
      case 'Completed': return 'Paid';
      case 'Paid': return 'Follow-up Needed';
      default: return null;
    }
  };

  const formatTime = (time?: string) => {
    if (!time) return 'TBD';
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
  };

  const handleStatusAdvance = async (jobId: string, currentStatus: string) => {
    const next = nextStatus(currentStatus);
    if (!next) return;
    
    updateBooking(jobId, { status: next as any });
    
    // Auto payment status update if going to Paid
    if (next === 'Paid') {
      updateBooking(jobId, { paymentStatus: 'Paid' });
    }

    // Handle automated SMS
    const booking = bookings.find(b => b.id === jobId);
    const customer = getCustomer(booking?.customerId || '');
    
    if (customer?.phoneNumber && booking) {
      let message = '';
      const dateStr = new Date(booking.date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
      
      if (next === 'Confirmed') {
        message = `Hello ${customer.fullName.split(' ')[0]}, your detailing service for the ${booking.vehicle || 'vehicle'} is confirmed for ${dateStr} at ${formatTime(booking.time)}. We look forward to seeing you.`;
      } else if (next === 'On The Way') {
        message = `Hello ${customer.fullName.split(' ')[0]}, your technician is currently en route to your location for your scheduled appointment.`;
      } else if (next === 'Completed') {
        message = `Hello ${customer.fullName.split(' ')[0]}, the service on your ${booking.vehicle || 'vehicle'} has been completed. Thank you for your business. ${booking.price ? `Your total is $${booking.price.toFixed(2)}.` : ''}`;
      }

      if (message) {
        setSmsStatus(prev => ({ ...prev, [jobId]: 'Opening SMS App...' }));
        window.open(`sms:${customer.phoneNumber}?body=${encodeURIComponent(message)}`, '_blank');
        setTimeout(() => {
          setSmsStatus(prev => {
            const newStatus = { ...prev };
            delete newStatus[jobId];
            return newStatus;
          });
        }, 3000);
      }
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      
      {/* Manifest Header */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500 rounded-full blur-3xl opacity-20 -mr-20 -mt-20 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-purple-500 rounded-full blur-3xl opacity-20 -ml-10 -mb-10 pointer-events-none"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <p className="text-blue-300 font-bold uppercase tracking-wider text-xs mb-1">Today's Manifest</p>
            <h2 className="text-3xl font-bold tracking-tight mb-2">
              {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            </h2>
            <div className="flex items-center gap-4 text-sm text-slate-300">
              <span className="flex items-center gap-1.5"><CalendarIcon size={16} /> {todayJobs.length} Jobs Scheduled</span>
              <span className="flex items-center gap-1.5"><DollarSign size={16} /> ${totalRevenue.toFixed(2)} Expected</span>
            </div>
          </div>
          
          <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-xl p-4 flex gap-6 shrink-0">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-1">Weather</p>
              <div className="text-xl font-bold flex items-center gap-2">☀️ 72°F</div>
            </div>
            <div className="w-px bg-white/20"></div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-1">Est. Route</p>
              <div className="text-xl font-bold flex items-center gap-2">🚗 42 mi</div>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline/Jobs List */}
      <div className="space-y-4">
        {todayJobs.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
             <CalendarIcon size={48} className="mx-auto text-slate-300 mb-4" />
             <h3 className="text-lg font-bold text-slate-900 mb-1">No jobs scheduled for today</h3>
             <p className="text-slate-500 text-sm">Take a well-deserved break, or check your bookings to add one.</p>
          </div>
        ) : (
          todayJobs.map((job, index) => {
            const customer = getCustomer(job.customerId);
            
            return (
              <div key={job.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col sm:flex-row relative">
                
                {/* Time Indicator - Left side */}
                <div className="bg-slate-50 sm:w-32 p-4 sm:p-6 sm:border-r border-b sm:border-b-0 border-slate-200 flex flex-row sm:flex-col items-center sm:items-start justify-between sm:justify-start gap-2 shrink-0">
                  <div>
                    <div className="font-bold text-slate-900 text-lg leading-tight">{formatTime(job.time)}</div>
                    <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1 flex items-center gap-1">
                      <Clock size={12} /> {job.duration} MIN
                    </div>
                  </div>
                  <div className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(job.status)}`}>
                    {job.status}
                  </div>
                </div>

                {/* Job Content */}
                <div className="p-4 sm:p-6 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="text-xl font-bold text-slate-900">{customer?.fullName || 'Unknown Customer'}</h3>
                        <div className="flex items-center gap-4 mt-1.5 text-sm">
                           {customer?.phoneNumber && (
                             <a href={`tel:${customer.phoneNumber}`} className="text-blue-600 hover:text-blue-800 flex items-center gap-1.5 font-medium">
                               <Phone size={14} /> {customer.phoneNumber}
                             </a>
                           )}
                        </div>
                      </div>
                      
                      {job.price && job.price > 0 && (
                        <div className="text-right">
                          <div className="text-lg font-bold text-slate-900">${job.price.toFixed(2)}</div>
                          <div className={`text-[10px] uppercase font-bold tracking-wider mt-0.5 ${job.paymentStatus === 'Paid' ? 'text-emerald-600' : 'text-slate-400'}`}>
                            {job.paymentStatus}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
                      <div className="space-y-3">
                        {customer?.address && (
                          <div className="flex gap-2.5 text-sm">
                            <MapPin size={16} className="text-slate-400 shrink-0 mt-0.5" />
                            <div>
                              <div className="text-slate-900 font-medium">{customer.address}</div>
                              {customer.city && <div className="text-slate-500">{customer.city}</div>}
                              <a 
                                href={`https://maps.google.com/?q=${encodeURIComponent(`${customer.address}, ${customer.city || ''}`)}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 text-xs font-bold uppercase tracking-wider flex items-center gap-1 mt-1.5"
                              >
                                <Navigation size={12} /> Open in Maps
                              </a>
                            </div>
                          </div>
                        )}
                        
                        {(job.vehicle || (customer?.vehicles && customer.vehicles.length > 0)) && (
                           <div className="flex gap-2.5 text-sm">
                             <Car size={16} className="text-slate-400 shrink-0 mt-0.5" />
                             <div className="font-medium text-slate-700">
                               {job.vehicle || customer?.vehicles[0]}
                             </div>
                           </div>
                        )}
                      </div>

                      <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Service Package</div>
                        <div className="font-medium text-slate-900 text-sm mb-2">{job.service}</div>
                        
                        {job.notes && (
                          <>
                            <div className="w-full h-px bg-slate-200 my-2"></div>
                            <div className="text-xs text-slate-600 italic">
                              "{job.notes}"
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Bar */}
                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <button className="text-slate-400 hover:text-slate-700 text-sm font-medium transition-colors">
                      Edit Details
                    </button>
                    
                    <div className="flex items-center gap-3">
                      {smsStatus[job.id] && (
                        <div className="flex items-center gap-1.5 text-xs font-bold px-2 py-1 bg-blue-50 text-blue-600 rounded">
                          <Bell size={12} /> {smsStatus[job.id]}
                        </div>
                      )}
                      {nextStatus(job.status) ? (
                        <button 
                          onClick={() => handleStatusAdvance(job.id, job.status)}
                          className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2 rounded-lg text-sm font-bold shadow-sm flex items-center gap-2 transition-colors"
                        >
                          {job.status === 'Completed' ? <DollarSign size={16} /> : <RefreshCcw size={16} />} 
                          Mark as {nextStatus(job.status)}
                        </button>
                      ) : (
                        <div className="text-emerald-600 font-bold text-sm flex items-center gap-1.5 bg-emerald-50 px-4 py-2 rounded-lg">
                          <CheckCircle size={16} /> Process Complete
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
