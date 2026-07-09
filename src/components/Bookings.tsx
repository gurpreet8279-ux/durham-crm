import { useState } from 'react';
import { Booking, BookingStatus, Customer } from '../types';
import { useCRM } from '../store/useCRM';
import { Plus, Calendar, Clock, DollarSign, Edit2, Trash2, X, Check, Search, Car, UserPlus, Users } from 'lucide-react';

const STATUS_OPTIONS: BookingStatus[] = [
  'New', 'Confirmed', 'Reminder Sent', 'Technician Assigned', 'On The Way', 'In Progress', 'Completed', 'Paid', 'Cancelled', 'Rescheduled'
];

export default function Bookings() {
  const { bookings, customers, addBooking, updateBooking, deleteBooking, addCustomer } = useCRM();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  
  const [formData, setFormData] = useState<Partial<Booking>>({
    customerId: '',
    date: new Date().toISOString().split('T')[0],
    time: '09:00',
    duration: 120,
    service: '',
    vehicle: '',
    price: 0,
    paymentStatus: 'Unpaid',
    status: 'New',
    notes: ''
  });

  const [customerData, setCustomerData] = useState<Partial<Customer>>({
    fullName: '',
    phoneNumber: '',
    email: '',
    address: '',
    city: '',
    vehicles: [],
    notes: ''
  });

  const getCustomerName = (id: string) => customers.find(c => c.id === id)?.fullName || 'Unknown';
  const getCustomer = (id: string) => customers.find(c => c.id === id);
  
  const filteredBookings = bookings
    .filter(b => {
      const cName = getCustomerName(b.customerId).toLowerCase();
      return cName.includes(searchTerm.toLowerCase()) || b.service.toLowerCase().includes(searchTerm.toLowerCase());
    })
    .sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.time || '00:00'}`).getTime();
      const dateB = new Date(`${b.date}T${b.time || '00:00'}`).getTime();
      return dateB - dateA;
    });

  const resetForm = () => {
    setFormData({ customerId: '', date: new Date().toISOString().split('T')[0], time: '09:00', duration: 120, service: '', vehicle: '', price: 0, paymentStatus: 'Unpaid', status: 'New', notes: '' });
    setCustomerData({ fullName: '', phoneNumber: '', email: '', address: '', city: '', vehicles: [], notes: '' });
    setIsAdding(false);
    setEditingId(null);
    setIsNewCustomer(false);
  };

  const handleEdit = (booking: Booking) => {
    setFormData({ ...booking });
    setIsAdding(true);
    setEditingId(booking.id);
    setIsNewCustomer(false);
  };

  const handleSave = async () => {
    if (isNewCustomer && !editingId) {
      if (!customerData.fullName) {
        alert("Please enter customer name");
        return;
      }
      try {
        const newCust = await addCustomer(customerData as Omit<Customer, 'id' | 'createdAt'>);
        if (!formData.date || !formData.service) return;
        await addBooking({ ...(formData as Omit<Booking, 'id' | 'createdAt'>), customerId: newCust.id, vehicle: formData.vehicle || (customerData.vehicles && customerData.vehicles[0]) || '' });
        resetForm();
      } catch (err) {
        console.error(err);
        alert("Error saving booking");
      }
    } else {
      if (!formData.customerId || !formData.date || !formData.service) return;
      if (editingId) {
        updateBooking(editingId, formData);
      } else {
        addBooking(formData as Omit<Booking, 'id' | 'createdAt'>);
      }
      resetForm();
    }
  };

  if (isAdding) {
    const selectedCustomer = getCustomer(formData.customerId || '');
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
          <h2 className="text-lg font-bold text-slate-900">{editingId ? 'Edit Booking' : 'New Booking'}</h2>
          <button onClick={resetForm} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>
        
        <div className="space-y-6">
          {!editingId && (
            <div className="flex bg-slate-100 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setIsNewCustomer(false)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${!isNewCustomer ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <Users size={16} /> Existing Customer
              </button>
              <button
                type="button"
                onClick={() => setIsNewCustomer(true)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${isNewCustomer ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <UserPlus size={16} /> New Customer
              </button>
            </div>
          )}

          {(!isNewCustomer || editingId) ? (
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Customer *</label>
              <select 
                value={formData.customerId || ''} 
                onChange={e => setFormData({...formData, customerId: e.target.value, vehicle: ''})}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="" disabled>Select a customer...</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.fullName} - {c.phoneNumber}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Full Name *</label>
                  <input 
                    type="text" 
                    value={customerData.fullName || ''} 
                    onChange={e => setCustomerData({...customerData, fullName: e.target.value})}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Phone Number</label>
                  <input 
                    type="tel" 
                    value={customerData.phoneNumber || ''} 
                    onChange={e => setCustomerData({...customerData, phoneNumber: e.target.value})}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" 
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Address</label>
                <input 
                  type="text" 
                  value={customerData.address || ''} 
                  onChange={e => setCustomerData({...customerData, address: e.target.value})}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" 
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Date *</label>
              <input 
                type="date" 
                value={formData.date || ''} 
                onChange={e => setFormData({...formData, date: e.target.value})}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Time</label>
              <input 
                type="time" 
                value={formData.time || ''} 
                onChange={e => setFormData({...formData, time: e.target.value})}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Dur. (mins)</label>
              <input 
                type="number" 
                step="15"
                min="15"
                value={formData.duration || 120} 
                onChange={e => setFormData({...formData, duration: parseInt(e.target.value) || 120})}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" 
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Vehicle</label>
              {isNewCustomer && !editingId ? (
                <input 
                  type="text" 
                  value={formData.vehicle || ''} 
                  onChange={e => {
                    setFormData({...formData, vehicle: e.target.value});
                    setCustomerData({...customerData, vehicles: [e.target.value]});
                  }}
                  placeholder="e.g. Black Honda Civic"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" 
                />
              ) : (
                <select
                  value={formData.vehicle || ''}
                  onChange={e => setFormData({...formData, vehicle: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="">No vehicle specified</option>
                  {selectedCustomer?.vehicles?.map((v, i) => (
                    <option key={i} value={v}>{v}</option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Service *</label>
              <input 
                type="text" 
                value={formData.service || ''} 
                onChange={e => setFormData({...formData, service: e.target.value})}
                placeholder="e.g. Full Detail"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" 
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Price</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="number" 
                  value={formData.price || ''} 
                  onChange={e => setFormData({...formData, price: parseFloat(e.target.value) || 0})}
                  className="w-full pl-9 pr-4 bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" 
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Payment</label>
              <select 
                value={formData.paymentStatus || 'Unpaid'} 
                onChange={e => setFormData({...formData, paymentStatus: e.target.value as 'Paid' | 'Unpaid'})}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="Unpaid">Unpaid</option>
                <option value="Paid">Paid</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Status</label>
              <select 
                value={formData.status || 'New'} 
                onChange={e => setFormData({...formData, status: e.target.value as BookingStatus})}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                {STATUS_OPTIONS.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Notes</label>
            <textarea 
              value={formData.notes || ''} 
              onChange={e => setFormData({...formData, notes: e.target.value})}
              rows={3}
              placeholder="Any special instructions or requests..."
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none" 
            />
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-3">
          <button onClick={resetForm} className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-lg text-sm transition-colors">Cancel</button>
          <button 
            onClick={handleSave} 
            disabled={(!isNewCustomer && !formData.customerId) || (isNewCustomer && !customerData.fullName) || !formData.date || !formData.service}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm disabled:opacity-50 flex items-center gap-2 text-sm transition-colors"
          >
            <Check size={16} /> {editingId ? 'Save Changes' : 'Create Booking'}
          </button>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Completed': return <span className="bg-green-100 text-green-700 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">Completed</span>;
      case 'Paid': return <span className="bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">Paid</span>;
      case 'In Progress': return <span className="bg-purple-100 text-purple-700 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">In Progress</span>;
      case 'On The Way': return <span className="bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">On The Way</span>;
      case 'Technician Assigned': return <span className="bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">Assigned</span>;
      case 'Reminder Sent': return <span className="bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">Reminder</span>;
      case 'Confirmed': return <span className="bg-sky-100 text-sky-700 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">Confirmed</span>;
      case 'Cancelled': return <span className="bg-red-100 text-red-700 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">Cancelled</span>;
      case 'Rescheduled': return <span className="bg-orange-100 text-orange-700 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">Rescheduled</span>;
      case 'New': return <span className="bg-slate-100 text-slate-800 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">New</span>;
      default: return <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search by customer or service..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm"
          />
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm flex items-center justify-center gap-2 text-sm transition-colors"
        >
          <Plus size={18} /> New Booking
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {filteredBookings.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Calendar className="mx-auto mb-3 opacity-20" size={48} />
            <p className="font-medium text-slate-600">No bookings found.</p>
            <p className="text-sm">Click 'New Booking' to schedule a job.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-bold">
                <tr>
                  <th className="px-6 py-4">Date & Time</th>
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Service</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBookings.map(booking => {
                  const customer = getCustomer(booking.customerId);
                  return (
                    <tr key={booking.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900 flex items-center gap-2">
                          <Calendar size={14} className="text-slate-400" />
                          {new Date(booking.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                        </div>
                        {booking.time && (
                          <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 ml-5">
                            <Clock size={12} /> {booking.time} ({booking.duration}m)
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">{customer?.fullName || 'Unknown'}</div>
                        {booking.vehicle && (
                          <div className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                            <Car size={12} /> {booking.vehicle}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        <div className="truncate max-w-[200px]">{booking.service}</div>
                        {booking.price !== undefined && booking.price > 0 && (
                          <div className="text-xs font-bold mt-1 flex items-center gap-1.5">
                            <DollarSign size={12} className="text-slate-400"/> 
                            <span className={booking.paymentStatus === 'Paid' ? 'text-emerald-600' : 'text-slate-600'}>
                              {booking.price.toFixed(2)} {booking.paymentStatus === 'Paid' ? '(Paid)' : ''}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(booking.status)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleEdit(booking)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"><Edit2 size={16} /></button>
                          <button onClick={() => {if(confirm('Delete booking?')) deleteBooking(booking.id)}} className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
