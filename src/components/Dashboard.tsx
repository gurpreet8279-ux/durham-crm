import { useCRM } from '../store/useCRM';
import { Users, Calendar as CalendarIcon, DollarSign, Activity, MessageSquare, TrendingUp, Award, Clock, Sparkles } from 'lucide-react';
import IncomingRequests from './IncomingRequests';
import { getSmsUrl, triggerSmsForStatusChange } from '../lib/sms';
import CalendarView from './CalendarView';

export default function Dashboard() {
  const { customers, bookings, updateBooking } = useCRM();

  // Booking filtering
  const activeBookings = bookings.filter(b => ['New', 'Confirmed', 'Reminder Sent', 'Technician Assigned', 'On The Way', 'In Progress', 'Rescheduled', 'New Booking', 'pending'].includes(b.status));
  const completedBookings = bookings.filter(b => ['Completed', 'Paid', 'completed'].includes(b.status));
  const followUpsNeeded = bookings.filter(b => false); // removed as status was removed
  
  // Date helpers
  const parseLocalDate = (dStr: string) => {
    const [y, m, d] = dStr.split('-');
    return new Date(Number(y), Number(m) - 1, Number(d));
  };
  const parseLocalDatetime = (dStr: string, tStr: string = '00:00') => {
    const [y, m, d] = dStr.split('-');
    const [hr, min] = tStr.split(':');
    return new Date(Number(y), Number(m) - 1, Number(d), Number(hr), Number(min));
  };

  // Date calculations
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  // Revenue calculations
  const totalRevenue = completedBookings.reduce((sum, b) => sum + (b.price || 0), 0);
  const weeklyRevenue = completedBookings
    .filter(b => parseLocalDate(b.date) >= startOfWeek)
    .reduce((sum, b) => sum + (b.price || 0), 0);
  const monthlyRevenue = completedBookings
    .filter(b => parseLocalDate(b.date) >= startOfMonth)
    .reduce((sum, b) => sum + (b.price || 0), 0);

  const averageSpend = completedBookings.length > 0 ? totalRevenue / completedBookings.length : 0;

  // Returning Customers
  const customerBookingCounts = bookings.reduce((acc, b) => {
    acc[b.customerId] = (acc[b.customerId] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const returningCustomers = Object.values(customerBookingCounts).filter((count: any) => count > 1).length;

  // Popular Services
  const serviceCounts = bookings.reduce((acc, b) => {
    if (b.service) {
      const s = b.service.toLowerCase().trim();
      acc[s] = (acc[s] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);
  
  const popularServices = Object.entries(serviceCounts)
    .sort((a: any, b: any) => b[1] - a[1])
    .slice(0, 3);
  
  const upcomingBookings = [...activeBookings]
    .sort((a, b) => {
      const dateA = parseLocalDatetime(a.date, a.time).getTime();
      const dateB = parseLocalDatetime(b.date, b.time).getTime();
      return dateA - dateB;
    })
    .slice(0, 5);

  const getCustomerName = (id: string) => customers.find(c => c.id === id)?.fullName || 'Unknown';
  const getCustomerPhone = (id: string) => customers.find(c => c.id === id)?.phoneNumber;

  return (
    <div className="space-y-6">
      <IncomingRequests />
      {/* Top Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Weekly Revenue</p>
              <h3 className="text-3xl font-bold text-emerald-600">${weeklyRevenue.toFixed(0)}</h3>
              <p className="text-xs text-slate-400 mt-2 font-medium">This week</p>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
              <TrendingUp size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Monthly Rev</p>
              <h3 className="text-3xl font-bold text-slate-900">${monthlyRevenue.toFixed(0)}</h3>
              <p className="text-xs text-slate-400 mt-2 font-medium">This month</p>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
              <DollarSign size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Returning Clients</p>
              <h3 className="text-3xl font-bold text-slate-900">{returningCustomers}</h3>
              <p className="text-xs text-slate-400 mt-2 font-medium">Multiple bookings</p>
            </div>
            <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
              <Award size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Avg Spend</p>
              <h3 className="text-3xl font-bold text-slate-900">${averageSpend.toFixed(0)}</h3>
              <p className="text-xs text-slate-400 mt-2 font-medium">Per completed job</p>
            </div>
            <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
              <Activity size={24} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Left Column: Calendar & Upcoming Schedule */}
        <div className="xl:col-span-2 space-y-6">
          <CalendarView />

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Upcoming Schedule</h3>
            </div>
            {upcomingBookings.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">No upcoming bookings.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {upcomingBookings.map(b => (
                  <div key={b.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="bg-blue-50 text-blue-600 font-bold p-3 rounded-lg text-center min-w-[60px]">
                        <div className="text-xs uppercase">{parseLocalDate(b.date).toLocaleDateString(undefined, { month: 'short' })}</div>
                        <div className="text-xl leading-none mt-1">{parseLocalDate(b.date).getDate()}</div>
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{getCustomerName(b.customerId)}</h4>
                        <div className="text-sm text-slate-500 mt-0.5 flex items-center gap-2">
                          <span className="truncate max-w-[150px] sm:max-w-xs">{b.service}</span>
                          {b.time && (
                            <>
                              <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                              <span className="flex items-center gap-1 font-medium text-slate-600"><Clock size={12}/> {b.time}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className="bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full">{b.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
             <div className="px-6 py-5 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">Action Needed: Follow-Ups</h3>
            </div>
            <div className="p-0">
               {followUpsNeeded.length === 0 ? (
                 <div className="p-8 text-center text-slate-500 text-sm">No pending follow-ups.</div>
               ) : (
                 <div className="divide-y divide-slate-100">
                   {followUpsNeeded.map(b => {
                     const phone = getCustomerPhone(b.customerId);
                     return (
                       <div key={b.id} className="p-5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                         <div>
                           <h4 className="font-bold text-slate-900 text-sm">{getCustomerName(b.customerId)}</h4>
                           <p className="text-xs text-slate-500 mt-0.5">Service Date: {b.date}</p>
                         </div>
                         <div className="flex gap-2">
                            {phone && (
                              <a href={getSmsUrl(phone, "Hi! Just checking in to see how everything is looking with your vehicle after our recent detailing service.")} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors">
                                <MessageSquare size={16} />
                              </a>
                            )}
                            <button 
                              onClick={() => {
                                updateBooking(b.id, { status: 'Completed' });
                                const cust = customers.find(c => c.id === b.customerId);
                                if (cust) {
                                  triggerSmsForStatusChange(b, cust, 'Completed');
                                }
                              }}
                              className="px-3 py-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg text-xs font-bold transition-colors"
                            >
                              Resolve
                            </button>
                         </div>
                       </div>
                     )
                   })}
                 </div>
               )}
            </div>
          </div>
        </div>
        
        {/* Right Column: Insights */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
             <div className="px-6 py-5 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Sparkles size={16} className="text-blue-500" /> Popular Services
              </h3>
            </div>
            <div className="p-6">
               {popularServices.length === 0 ? (
                 <div className="text-center text-slate-500 text-sm py-4">Not enough data.</div>
               ) : (
                 <div className="space-y-4">
                   {popularServices.map(([service, count]: any, i) => (
                     <div key={service} className="flex items-center justify-between">
                       <div className="flex items-center gap-3">
                         <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xs font-bold">{i + 1}</div>
                         <div className="text-sm font-medium text-slate-900 capitalize truncate max-w-[140px]">{service}</div>
                       </div>
                       <div className="text-xs font-bold text-slate-500 bg-slate-50 px-2 py-1 rounded">{count} bookings</div>
                     </div>
                   ))}
                 </div>
               )}
            </div>
          </div>

          <div className="bg-slate-900 rounded-xl shadow-sm p-6 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500 rounded-full blur-3xl opacity-20 -mr-10 -mt-10"></div>
             <h3 className="font-bold text-lg mb-2 relative z-10">Business Summary</h3>
             <p className="text-slate-400 text-sm mb-6 relative z-10">Quick stats based on all historical data.</p>
             
             <div className="space-y-3 relative z-10">
               <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                 <span className="text-slate-400 text-sm">Total Bookings</span>
                 <span className="font-bold">{bookings.length}</span>
               </div>
               <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                 <span className="text-slate-400 text-sm">Total Revenue</span>
                 <span className="font-bold text-emerald-400">${totalRevenue.toFixed(2)}</span>
               </div>
               <div className="flex justify-between items-center">
                 <span className="text-slate-400 text-sm">Total Customers</span>
                 <span className="font-bold">{customers.length}</span>
               </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
