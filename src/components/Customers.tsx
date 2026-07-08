import { useState } from 'react';
import { Customer } from '../types';
import { useCRM } from '../store/useCRM';
import { Search, Plus, User, MapPin, Phone, Car, Edit2, Trash2, X, Check } from 'lucide-react';

export default function Customers() {
  const { customers, addCustomer, updateCustomer, deleteCustomer } = useCRM();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<Customer>>({
    fullName: '',
    phoneNumber: '',
    email: '',
    vehicles: [],
    address: '',
    city: '',
    notes: ''
  });
  const [vehicleInput, setVehicleInput] = useState('');

  const filteredCustomers = customers.filter(c => 
    c.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phoneNumber.includes(searchTerm)
  );

  const resetForm = () => {
    setFormData({ fullName: '', phoneNumber: '', email: '', vehicles: [], address: '', city: '', notes: '' });
    setVehicleInput('');
    setIsAdding(false);
    setEditingId(null);
  };

  const handleEdit = (customer: Customer) => {
    setFormData({ ...customer });
    setIsAdding(true);
    setEditingId(customer.id);
  };

  const handleSave = () => {
    if (!formData.fullName || !formData.phoneNumber) return;

    if (editingId) {
      updateCustomer(editingId, formData);
    } else {
      addCustomer(formData as Omit<Customer, 'id' | 'createdAt'>);
    }
    resetForm();
  };

  const addVehicle = () => {
    if (vehicleInput.trim()) {
      setFormData(prev => ({
        ...prev,
        vehicles: [...(prev.vehicles || []), vehicleInput.trim()]
      }));
      setVehicleInput('');
    }
  };

  const removeVehicle = (idx: number) => {
    setFormData(prev => ({
      ...prev,
      vehicles: (prev.vehicles || []).filter((_, i) => i !== idx)
    }));
  };

  if (isAdding) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
          <h2 className="text-lg font-bold text-slate-900">{editingId ? 'Edit Customer' : 'New Customer'}</h2>
          <button onClick={resetForm} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Full Name *</label>
              <input 
                type="text" 
                value={formData.fullName || ''} 
                onChange={e => setFormData({...formData, fullName: e.target.value})}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Phone Number *</label>
              <input 
                type="tel" 
                value={formData.phoneNumber || ''} 
                onChange={e => setFormData({...formData, phoneNumber: e.target.value})}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" 
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Email Address</label>
            <input 
              type="email" 
              value={formData.email || ''} 
              onChange={e => setFormData({...formData, email: e.target.value})}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Street Address</label>
              <input 
                type="text" 
                value={formData.address || ''} 
                onChange={e => setFormData({...formData, address: e.target.value})}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">City/Town</label>
              <input 
                type="text" 
                value={formData.city || ''} 
                onChange={e => setFormData({...formData, city: e.target.value})}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" 
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Vehicles</label>
            <div className="flex gap-2 mb-2">
              <input 
                type="text" 
                value={vehicleInput} 
                onChange={e => setVehicleInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addVehicle())}
                placeholder="e.g. 2021 Ford F-150"
                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" 
              />
              <button onClick={addVehicle} type="button" className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 rounded-lg font-medium text-sm transition-colors">Add</button>
            </div>
            {formData.vehicles && formData.vehicles.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.vehicles.map((v, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-medium border border-blue-100">
                    <Car size={12} /> {v}
                    <button onClick={() => removeVehicle(i)} className="hover:text-blue-900 ml-1"><X size={12} /></button>
                  </span>
                ))}
              </div>
            )}
          </div>
          
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Internal Notes</label>
            <textarea 
              value={formData.notes || ''} 
              onChange={e => setFormData({...formData, notes: e.target.value})}
              rows={3}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none" 
            />
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-3">
          <button onClick={resetForm} className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-lg text-sm transition-colors">Cancel</button>
          <button 
            onClick={handleSave} 
            disabled={!formData.fullName || !formData.phoneNumber}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm disabled:opacity-50 flex items-center gap-2 text-sm transition-colors"
          >
            <Check size={16} /> {editingId ? 'Save Changes' : 'Create Customer'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search customers by name or phone..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm"
          />
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm flex items-center justify-center gap-2 text-sm transition-colors"
        >
          <Plus size={18} /> Add Customer
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {filteredCustomers.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <User className="mx-auto mb-3 opacity-20" size={48} />
            <p className="font-medium text-slate-600">No customers found.</p>
            <p className="text-sm">Click 'Add Customer' to build your database.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-bold">
                <tr>
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Contact</th>
                  <th className="px-6 py-4">Vehicles</th>
                  <th className="px-6 py-4">Location</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCustomers.map(customer => (
                  <tr key={customer.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{customer.fullName}</div>
                      <div className="text-xs text-slate-400 mt-0.5">ID: {customer.id.split('_')[1].toUpperCase()}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <Phone size={14} className="text-slate-400" /> {customer.phoneNumber}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {customer.vehicles?.length > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md border border-slate-200">
                            <Car size={12} /> {customer.vehicles.length} Vehicle{customer.vehicles.length !== 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-xs">None listed</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {customer.city ? (
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <MapPin size={14} className="text-slate-400" /> {customer.city}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-xs">No address</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleEdit(customer)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"><Edit2 size={16} /></button>
                        <button onClick={() => {if(confirm('Delete customer?')) deleteCustomer(customer.id)}} className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
