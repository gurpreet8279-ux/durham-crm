import { useState } from 'react';
import { LayoutDashboard, Users, CalendarDays, Sparkles, Crown, Map, Settings } from 'lucide-react';
import Dashboard from './components/Dashboard';
import Customers from './components/Customers';
import Bookings from './components/Bookings';
import AIParser from './components/AIParser';
import Manifest from './components/Manifest';
import AdminDashboard from './components/AdminDashboard';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'manifest' | 'customers' | 'bookings' | 'parser' | 'admin'>('manifest');

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col hidden md:flex">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white shadow-sm">
            <Crown size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight leading-none mb-1">Crown CRM</h1>
            <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">Durham's Detailing</p>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto mt-4">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'dashboard' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <LayoutDashboard size={18} /> Overview
          </button>
          
          <button
            onClick={() => setActiveTab('manifest')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'manifest' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Map size={18} /> Today's Manifest
          </button>
          
          <button
            onClick={() => setActiveTab('customers')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'customers' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Users size={18} /> Customers
          </button>
          
          <button
            onClick={() => setActiveTab('bookings')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'bookings' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <CalendarDays size={18} /> Bookings
          </button>

          <div className="pt-6 pb-2">
            <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Tools</p>
          </div>

          <button
            onClick={() => setActiveTab('parser')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'parser' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Sparkles size={18} className={activeTab === 'parser' ? 'text-blue-200' : 'text-blue-400'} /> AI Log Parser
          </button>
        </nav>

        <div className="p-4 mt-auto">
          <button
            onClick={() => setActiveTab('admin')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'admin' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Settings size={18} /> Admin Settings
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Mobile Header (visible only on small screens) */}
        <header className="md:hidden bg-white border-b border-slate-200 px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown size={24} className="text-blue-600" />
            <h1 className="font-bold text-slate-900">Crown CRM</h1>
          </div>
          <select 
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value as any)}
            className="bg-slate-50 border border-slate-200 rounded-lg text-sm px-3 py-1.5 focus:outline-none"
          >
            <option value="dashboard">Overview</option>
            <option value="manifest">Manifest</option>
            <option value="customers">Customers</option>
            <option value="bookings">Bookings</option>
            <option value="parser">AI Parser</option>
            <option value="admin">Admin Settings</option>
          </select>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto">
            <header className="mb-8 hidden md:block">
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight capitalize">
                {activeTab === 'parser' ? 'AI Log Parser' : activeTab === 'manifest' ? '' : activeTab === 'admin' ? '' : activeTab}
              </h2>
            </header>
            
            {activeTab === 'dashboard' && <Dashboard />}
            {activeTab === 'manifest' && <Manifest />}
            {activeTab === 'customers' && <Customers />}
            {activeTab === 'bookings' && <Bookings />}
            {activeTab === 'parser' && <AIParser />}
            {activeTab === 'admin' && <AdminDashboard />}
          </div>
        </div>
      </main>
    </div>
  );
}
