import { useState } from 'react';
import { useCRM } from '../store/useCRM';
import { Booking, BookingStatus, Customer } from '../types';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Clock, 
  MessageSquare, 
  Sparkles,
  Phone,
  User,
  MapPin,
  DollarSign,
  Briefcase
} from 'lucide-react';
import { formatTime12h, getSmsUrl, triggerSmsForStatusChange } from '../lib/sms';
import toast from 'react-hot-toast';

const STATUS_OPTIONS: BookingStatus[] = [
  'New', 'Confirmed', 'Reminder Sent', 'Technician Assigned', 'On The Way', 'In Progress', 'Completed', 'Paid', 'Cancelled', 'Rescheduled'
];

export default function CalendarView() {
  const { bookings, customers, updateBooking } = useCRM();

  // Calendar Date State
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [currentMonth, setCurrentMonth] = useState<number>(selectedDate.getMonth());
  const [currentYear, setCurrentYear] = useState<number>(selectedDate.getFullYear());

  // Helper to format date object to YYYY-MM-DD
  const formatDateString = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const selectedDateStr = formatDateString(selectedDate);

  // Month navigation
  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const jumpToToday = () => {
    const today = new Date();
    setSelectedDate(today);
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
  };

  // Generate calendar grid (6 rows of 7 days = 42 cells)
  const getDaysInMonth = (year: number, month: number) => {
    const firstDayIndex = new Date(year, month, 1).getDay();
    const numberOfDays = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const days: { date: Date; dateStr: string; isCurrentMonth: boolean }[] = [];

    // Trailing days from previous month
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const m = month === 0 ? 11 : month - 1;
      const y = month === 0 ? year - 1 : year;
      const date = new Date(y, m, d);
      days.push({
        date,
        dateStr: formatDateString(date),
        isCurrentMonth: false
      });
    }

    // Current month days
    for (let d = 1; d <= numberOfDays; d++) {
      const date = new Date(year, month, d);
      days.push({
        date,
        dateStr: formatDateString(date),
        isCurrentMonth: true
      });
    }

    // Leading days from next month
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      const m = month === 11 ? 0 : month + 1;
      const y = month === 11 ? year + 1 : year;
      const date = new Date(y, m, d);
      days.push({
        date,
        dateStr: formatDateString(date),
        isCurrentMonth: false
      });
    }

    return days;
  };

  const calendarDays = getDaysInMonth(currentYear, currentMonth);

  const getCustomerName = (id: string) => customers.find(c => c.id === id)?.fullName || 'Unknown Customer';
  const getCustomer = (id: string) => customers.find(c => c.id === id);

  // Filter bookings for the selected date
  const bookingsForSelectedDate = bookings.filter(b => b.date === selectedDateStr);

  // Status visual configurations
  const getStatusColorClass = (status: BookingStatus) => {
    switch (status) {
      case 'Confirmed':
        return 'bg-emerald-500';
      case 'In Progress':
        return 'bg-blue-500';
      case 'Completed':
      case 'Paid':
        return 'bg-indigo-500';
      case 'New':
      case 'Pending':
        return 'bg-amber-500';
      case 'Cancelled':
        return 'bg-rose-500';
      case 'Rescheduled':
      case 'Reminder Sent':
      case 'Technician Assigned':
      case 'On The Way':
      default:
        return 'bg-purple-500';
    }
  };

  const getStatusBadgeStyle = (status: BookingStatus) => {
    switch (status) {
      case 'Confirmed':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'In Progress':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Completed':
      case 'Paid':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'New':
      case 'Pending':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Cancelled':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-purple-50 text-purple-700 border-purple-200';
    }
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const handleStatusChange = async (booking: Booking, newStatus: BookingStatus) => {
    try {
      await updateBooking(booking.id, { status: newStatus });
      toast.success(`Booking status updated to ${newStatus}`);

      const customer = getCustomer(booking.customerId);
      if (customer) {
        // Trigger pre-saved SMS template automatically if applicable
        const triggered = triggerSmsForStatusChange(booking, customer, newStatus);
        if (triggered) {
          toast.success("SMS prefilled template opened!");
        }
      }
    } catch (e: any) {
      toast.error("Failed to update status");
    }
  };

  return (
    <div id="crm-professional-calendar" className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Calendar Grid & List view side-by-side on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
        
        {/* Calendar Left Column (col-span 7) */}
        <div className="lg:col-span-7 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                <CalendarIcon size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 leading-tight">Business Calendar</h3>
                <p className="text-xs text-slate-500 font-medium">{monthNames[currentMonth]} {currentYear}</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button 
                onClick={jumpToToday}
                className="px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
              >
                Today
              </button>
              <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                <button 
                  onClick={prevMonth}
                  className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-md transition-all"
                  aria-label="Previous month"
                >
                  <ChevronLeft size={16} />
                </button>
                <button 
                  onClick={nextMonth}
                  className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-md transition-all"
                  aria-label="Next month"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Weekday Labels */}
          <div className="grid grid-cols-7 gap-1 mb-2 text-center">
            {weekdayNames.map(day => (
              <div key={day} className="text-xs font-semibold text-slate-400 py-1 uppercase tracking-wider">
                {day}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map(({ date, dateStr, isCurrentMonth }) => {
              const dateBookings = bookings.filter(b => b.date === dateStr);
              const isSelected = selectedDateStr === dateStr;
              const isToday = formatDateString(new Date()) === dateStr;

              return (
                <button
                  key={dateStr}
                  onClick={() => {
                    setSelectedDate(date);
                    setCurrentMonth(date.getMonth());
                    setCurrentYear(date.getFullYear());
                  }}
                  className={`
                    relative aspect-square flex flex-col justify-between p-1.5 rounded-lg border transition-all text-left group
                    ${isCurrentMonth ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/50 hover:bg-slate-100/50'}
                    ${isSelected 
                      ? 'border-indigo-600 bg-indigo-600/5 hover:bg-indigo-600/10 font-bold text-indigo-900 shadow-sm ring-1 ring-indigo-600' 
                      : isToday 
                        ? 'border-indigo-200 ring-1 ring-indigo-200 bg-slate-50/60 font-semibold' 
                        : 'border-transparent'
                    }
                  `}
                >
                  <span className={`
                    text-xs inline-flex items-center justify-center w-5 h-5 rounded-full
                    ${isToday && !isSelected ? 'bg-indigo-600 text-white font-bold' : ''}
                    ${isCurrentMonth ? 'text-slate-700 font-medium' : 'text-slate-300'}
                    ${isSelected ? 'text-indigo-900' : ''}
                  `}>
                    {date.getDate()}
                  </span>

                  {/* Booking indicator dots */}
                  {dateBookings.length > 0 && (
                    <div className="flex flex-wrap gap-0.5 mt-auto max-h-[16px] overflow-hidden">
                      {dateBookings.slice(0, 3).map(b => (
                        <span 
                          key={b.id} 
                          className={`w-1.5 h-1.5 rounded-full ${getStatusColorClass(b.status)}`}
                          title={`${getCustomerName(b.customerId)}: ${b.service}`}
                        />
                      ))}
                      {dateBookings.length > 3 && (
                        <span className="text-[8px] font-black leading-none text-slate-500 mt-0.5">
                          +{dateBookings.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick Mini Legend */}
          <div className="flex flex-wrap items-center gap-3.5 mt-5 pt-4 border-t border-slate-100 text-[11px] text-slate-500 font-medium">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" /> New / Pending
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> Confirmed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500" /> In Progress
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-500" /> Completed
            </span>
          </div>
        </div>

        {/* Selected Day Details Panel Right Column (col-span 5) */}
        <div className="lg:col-span-5 p-6 bg-slate-50/50 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">
                  {selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                </h4>
                <p className="text-xs text-slate-500 font-medium">
                  {bookingsForSelectedDate.length} {bookingsForSelectedDate.length === 1 ? 'appointment' : 'appointments'} booked
                </p>
              </div>
            </div>

            {/* Bookings List for Selected Date */}
            {bookingsForSelectedDate.length === 0 ? (
              <div className="py-12 px-4 text-center rounded-xl border border-dashed border-slate-200 bg-white shadow-inner">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
                  <Briefcase size={20} />
                </div>
                <h5 className="font-semibold text-slate-700 text-sm mb-1">No Bookings Scheduled</h5>
                <p className="text-xs text-slate-400 max-w-[200px] mx-auto font-medium">There are no client appointments scheduled for this day.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                {bookingsForSelectedDate.map(booking => {
                  const customer = getCustomer(booking.customerId);
                  const phone = customer?.phoneNumber;

                  return (
                    <div 
                      key={booking.id} 
                      className="bg-white p-4 rounded-xl border border-slate-200 hover:shadow-md transition-all flex flex-col justify-between gap-3 relative overflow-hidden"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5">
                          <h5 className="font-bold text-slate-900 text-sm">{getCustomerName(booking.customerId)}</h5>
                          <div className="flex items-center gap-1 text-xs text-slate-500 font-medium">
                            <Clock size={12} className="text-slate-400" />
                            <span>{formatTime12h(booking.time)}</span>
                            {booking.price !== undefined && (
                              <>
                                <span className="w-1 h-1 bg-slate-300 rounded-full" />
                                <span className="text-emerald-600 font-bold">${booking.price}</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Status dropdown directly on card for instant modification */}
                        <select
                          value={booking.status}
                          onChange={(e) => handleStatusChange(booking, e.target.value as BookingStatus)}
                          className={`
                            text-[11px] font-bold uppercase tracking-wider py-1 px-2.5 rounded-full border cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all
                            ${getStatusBadgeStyle(booking.status)}
                          `}
                        >
                          {STATUS_OPTIONS.map(opt => (
                            <option key={opt} value={opt} className="bg-white text-slate-800 normal-case font-medium">
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Detail lines */}
                      <div className="space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-xs">
                        <div className="flex items-center gap-2 text-slate-600">
                          <span className="font-semibold text-indigo-600 shrink-0">Service:</span>
                          <span className="font-medium text-slate-800 truncate">{booking.service}</span>
                        </div>
                        {booking.vehicle && (
                          <div className="flex items-center gap-2 text-slate-600">
                            <span className="font-semibold text-slate-500 shrink-0">Vehicle:</span>
                            <span className="font-medium text-slate-800 truncate">{booking.vehicle}</span>
                          </div>
                        )}
                        {booking.notes && (
                          <div className="text-slate-500 italic text-[11px] mt-1 pt-1 border-t border-slate-200/60 line-clamp-2">
                            "{booking.notes}"
                          </div>
                        )}
                      </div>

                      {/* SMS & Phone Quick Action Row */}
                      {phone && (
                        <div className="flex items-center gap-2 pt-1 border-t border-slate-100/80">
                          <a 
                            href={`tel:${phone.replace(/[^\d+]/g, '')}`} 
                            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg text-xs font-bold transition-all border border-slate-200"
                          >
                            <Phone size={12} />
                            <span>Call Client</span>
                          </a>

                          <a 
                            href={getSmsUrl(phone, `Hi ${customer.fullName}, just checking in regarding your detailing appointment today!`)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg text-xs font-bold transition-all border border-indigo-100"
                          >
                            <MessageSquare size={12} />
                            <span>Text Client</span>
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-200 text-center">
            <p className="text-[10px] text-slate-400 font-medium flex items-center justify-center gap-1">
              <Sparkles size={11} className="text-indigo-500" />
              Tip: Change booking status dropdown to trigger automatic customer SMS notifications.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
