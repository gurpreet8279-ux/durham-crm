import { useState } from 'react';
import { Booking, BookingStatus, Customer } from '../types';
import { useCRM } from '../store/useCRM';
import { Plus, Calendar, Clock, DollarSign, Edit2, Trash2, X, Check, Search, Car, UserPlus, Users, DownloadCloud, RefreshCw, Phone, Mail, MessageSquare, FileSpreadsheet, Database } from 'lucide-react';
import toast from 'react-hot-toast';
import { useDialog } from './DialogProvider';
import { triggerSmsForStatusChange } from '../lib/sms';

const STATUS_OPTIONS: BookingStatus[] = [
  'New', 'Confirmed', 'Reminder Sent', 'Technician Assigned', 'On The Way', 'In Progress', 'Completed', 'Paid', 'Cancelled', 'Rescheduled'
];

export default function Bookings() {
  const { 
    bookings, 
    customers, 
    addBooking, 
    updateBooking, 
    deleteBooking, 
    addCustomer, 
    updateCustomer, 
    purgeAllBookings, 
    syncSheetBookings,
    syncWebsiteBookings,
    isSyncing, 
    sheetCsvUrl 
  } = useCRM();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPurging, setIsPurging] = useState(false);
  
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const { confirm } = useDialog();
  
  const getLocalDateString = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const [formData, setFormData] = useState<Partial<Booking>>({
    customerId: '',
    date: getLocalDateString(),
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

  const getCustomer = (id: string, booking?: Booking) => {
    let cust = customers.find(c => c.id === id);
    if (cust) return cust;
    if (booking) {
      if ((booking as any).phoneNumber) {
        cust = customers.find(c => c.phoneNumber === (booking as any).phoneNumber);
        if (cust) return cust;
      }
      if ((booking as any).customerName || (booking as any).fullName) {
        const name = (booking as any).customerName || (booking as any).fullName;
        cust = customers.find(c => c.fullName.toLowerCase() === name.toLowerCase());
        if (cust) return cust;
      }
    }
    return undefined;
  };

  const getCustomerName = (id: string, booking?: Booking) => {
    const cust = getCustomer(id, booking);
    if (cust?.fullName) return cust.fullName;
    if (booking && ((booking as any).customerName || (booking as any).fullName)) {
      return (booking as any).customerName || (booking as any).fullName;
    }
    return 'Customer';
  };
  
  const parseLocalDatetime = (dStr: string, tStr: string = '00:00') => {
    if (!dStr || typeof dStr !== 'string') return new Date();
    const parts = dStr.split('-');
    const tParts = (tStr || '00:00').split(':');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const d = parseInt(parts[2], 10);
      const hr = parseInt(tParts[0], 10) || 0;
      const min = parseInt(tParts[1], 10) || 0;
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        return new Date(y, m - 1, d, hr, min);
      }
    }
    const parsed = new Date(dStr);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  };
  
  const parseLocalDate = (dStr: string) => {
    if (!dStr || typeof dStr !== 'string') return new Date();
    const parts = dStr.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const d = parseInt(parts[2], 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        return new Date(y, m - 1, d);
      }
    }
    const parsed = new Date(dStr);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  };

  const filteredBookings = bookings
    .filter(b => {
      const cName = getCustomerName(b.customerId, b).toLowerCase();
      const customer = getCustomer(b.customerId, b);
      const phone = (customer?.phoneNumber || (b as any).phoneNumber || '').toLowerCase();
      const vehicle = (b.vehicle || '').toLowerCase();
      const service = (b.service || '').toLowerCase();
      const notes = (b.notes || '').toLowerCase();
      const query = searchTerm.toLowerCase();

      return cName.includes(query) || phone.includes(query) || vehicle.includes(query) || service.includes(query) || notes.includes(query);
    })
    .sort((a, b) => {
      const dateA = parseLocalDatetime(a.date, a.time).getTime();
      const dateB = parseLocalDatetime(b.date, b.time).getTime();
      return dateB - dateA;
    });

  const resetForm = () => {
    const d = new Date();
    const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    setFormData({ customerId: '', date: todayStr, time: '09:00', duration: 120, service: '', vehicle: '', price: 0, paymentStatus: 'Unpaid', status: 'New', notes: '' });
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
    const selected = customers.find(c => c.id === booking.customerId);
    if (selected) {
      setCustomerData({
        fullName: selected.fullName,
        phoneNumber: selected.phoneNumber,
        email: selected.email || '',
        address: selected.address || '',
        city: selected.city || '',
        vehicles: selected.vehicles || [],
        notes: selected.notes || ''
      });
    }
  };

  const handleSave = async () => {
    if (isNewCustomer && !editingId) {
      if (!customerData.fullName) {
        toast.error("Please enter customer name");
        return;
      }
      try {
        const newCust = await addCustomer(customerData as Omit<Customer, 'id' | 'createdAt'>);
        if (!formData.date || !formData.service) return;
        const newBkg = await addBooking({ ...(formData as Omit<Booking, 'id' | 'createdAt'>), customerId: newCust.id, vehicle: formData.vehicle || (customerData.vehicles && customerData.vehicles[0]) || '' });
        toast.success("Booking created");
        
        // Trigger pre-saved SMS if status is configured
        if (formData.status && formData.status !== 'New') {
          triggerSmsForStatusChange(newBkg, newCust, formData.status);
        }
        
        resetForm();
      } catch (err) {
        console.error(err);
        toast.error("Error saving booking");
      }
    } else {
      if (!formData.customerId || !formData.date || !formData.service) return;
      
      // Update the customer's address and city if provided/changed
      await updateCustomer(formData.customerId, {
        address: customerData.address || '',
        city: customerData.city || ''
      });

      if (editingId) {
        const originalBooking = bookings.find(b => b.id === editingId);
        updateBooking(editingId, formData);
        toast.success("Booking updated");
        
        // Trigger pre-saved SMS if status was changed
        if (originalBooking && formData.status && formData.status !== originalBooking.status) {
          const customer = getCustomer(formData.customerId || '');
          if (customer) {
            triggerSmsForStatusChange({ ...originalBooking, ...formData } as Booking, customer, formData.status);
          }
        }
      } else {
        const newBkg = await addBooking(formData as Omit<Booking, 'id' | 'createdAt'>);
        toast.success("Booking created");
        
        // Trigger pre-saved SMS if status is not 'New'
        if (formData.status && formData.status !== 'New') {
          const customer = getCustomer(formData.customerId || '');
          if (customer) {
            triggerSmsForStatusChange(newBkg, customer, formData.status);
          }
        }
      }
      resetForm();
    }
  };

  const handleDelete = async (id: string) => {
    if (await confirm('Delete Booking', 'Are you sure you want to delete this booking?')) {
      deleteBooking(id);
      toast.success("Booking deleted");
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
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Customer *</label>
                <select 
                  value={formData.customerId || ''} 
                  onChange={e => {
                    const cid = e.target.value;
                    setFormData({...formData, customerId: cid, vehicle: ''});
                    const selected = customers.find(c => c.id === cid);
                    if (selected) {
                      setCustomerData({
                        fullName: selected.fullName,
                        phoneNumber: selected.phoneNumber,
                        email: selected.email || '',
                        address: selected.address || '',
                        city: selected.city || '',
                        vehicles: selected.vehicles || [],
                        notes: selected.notes || ''
                      });
                    }
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="" disabled>Select a customer...</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.fullName} - {c.phoneNumber}</option>
                  ))}
                </select>
              </div>

              {formData.customerId && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Customer Address</label>
                      <input 
                        type="text" 
                        value={customerData.address || ''} 
                        onChange={e => setCustomerData({...customerData, address: e.target.value})}
                        placeholder="Customer Address"
                        className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">City</label>
                      <input 
                        type="text" 
                        value={customerData.city || ''} 
                        onChange={e => setCustomerData({...customerData, city: e.target.value})}
                        placeholder="Customer City"
                        className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" 
                      />
                    </div>
                  </div>
                </div>
              )}
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Address</label>
                  <input 
                    type="text" 
                    value={customerData.address || ''} 
                    onChange={e => setCustomerData({...customerData, address: e.target.value})}
                    placeholder="Customer Address"
                    className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">City</label>
                  <input 
                    type="text" 
                    value={customerData.city || ''} 
                    onChange={e => setCustomerData({...customerData, city: e.target.value})}
                    placeholder="Customer City"
                    className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" 
                  />
                </div>
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
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={syncWebsiteBookings}
            disabled={isSyncing}
            title="Sync online bookings directly from Firestore"
            className="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            <Database size={15} className={isSyncing ? 'animate-spin' : 'text-blue-400'} />
            {isSyncing ? 'Syncing...' : 'Sync Website Bookings'}
          </button>

          {sheetCsvUrl && (
            <button
              onClick={syncSheetBookings}
              disabled={isSyncing}
              title="Fetch and reconcile offline / manual bookings from your Google Sheet CSV"
              className="px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold rounded-lg shadow-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              <FileSpreadsheet size={15} className={isSyncing ? 'animate-pulse text-emerald-600' : 'text-emerald-600'} />
              {isSyncing ? 'Syncing CSV...' : 'Sync Sheet Bookings'}
            </button>
          )}

          {bookings.length > 0 && (
            <button 
              onClick={async () => {
                if (await confirm('Purge All Bookings from Database', `Are you sure you want to permanently delete all ${bookings.length} previous bookings from your database? This will reset your calendar so only fresh bookings show up.`)) {
                  setIsPurging(true);
                  await purgeAllBookings();
                  setIsPurging(false);
                }
              }}
              disabled={isPurging}
              className="px-3 py-2.5 text-xs font-semibold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <Trash2 size={15} /> {isPurging ? 'Purging...' : `Clear All (${bookings.length})`}
            </button>
          )}
          <button 
            onClick={() => setIsAdding(true)}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm flex items-center justify-center gap-2 text-sm transition-colors"
          >
            <Plus size={18} /> New Booking
          </button>
        </div>
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
                  <th className="px-6 py-4">Vehicle</th>
                  <th className="px-6 py-4">Package & Price</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBookings.map(booking => {
                  const customer = getCustomer(booking.customerId, booking);
                  const custName = getCustomerName(booking.customerId, booking);
                  const phone = customer?.phoneNumber || (booking as any).phoneNumber || '';
                  const email = customer?.email || (booking as any).email || '';
                  const city = customer?.city || (booking as any).city || '';

                  return (
                    <tr key={booking.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900 flex items-center gap-2">
                          <Calendar size={14} className="text-blue-500" />
                          {parseLocalDate(booking.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                        </div>
                        {booking.time && (
                          <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 ml-5 font-medium">
                            <Clock size={12} /> {booking.time} ({booking.duration || 120}m)
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">{custName}</div>
                        <div className="flex flex-col gap-0.5 mt-0.5">
                          {phone && (
                            <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="text-xs text-slate-500 hover:text-blue-600 flex items-center gap-1">
                              <Phone size={11} className="text-slate-400" /> {phone}
                            </a>
                          )}
                          {email && (
                            <a href={`mailto:${email}`} className="text-xs text-slate-500 hover:text-blue-600 flex items-center gap-1">
                              <Mail size={11} className="text-slate-400" /> {email}
                            </a>
                          )}
                          {city && (
                            <span className="text-[11px] text-slate-400">
                              {city}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {booking.vehicle ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-800 font-medium text-xs border border-slate-200">
                            <Car size={13} className="text-slate-500 shrink-0" />
                            <span className="truncate max-w-[160px]">{booking.vehicle}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Not specified</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-700">
                        <div className="font-semibold text-slate-900 truncate max-w-[200px]">{booking.service || 'Detailing Service'}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs font-bold text-emerald-600 flex items-center">
                            <DollarSign size={12} />
                            {(Number(booking.price) || 0).toFixed(2)}
                          </span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                            booking.paymentStatus === 'Paid' 
                              ? 'bg-emerald-100 text-emerald-700' 
                              : 'bg-amber-100 text-amber-700'
                          }`}>
                            {booking.paymentStatus === 'Paid' ? 'Paid' : 'Unpaid'}
                          </span>
                        </div>
                        {booking.notes && (
                          <div className="text-[11px] text-slate-400 italic truncate max-w-[200px] mt-0.5" title={booking.notes}>
                            "{booking.notes}"
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(booking.status)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                          {phone && (
                            <a 
                              href={`sms:${phone.replace(/[^\d+]/g, '')}?body=Hi ${encodeURIComponent(custName)}, checking in regarding your detailing appointment.`}
                              className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                              title="Send SMS"
                            >
                              <MessageSquare size={16} />
                            </a>
                          )}
                          <button onClick={() => handleEdit(booking)} title="Edit" className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"><Edit2 size={16} /></button>
                          <button onClick={() => handleDelete(booking.id)} title="Delete" className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"><Trash2 size={16} /></button>
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
