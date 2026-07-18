import { useState } from 'react';
import { LayoutDashboard, Users, CalendarDays, Crown, Map as MapIcon, Settings, FileSpreadsheet, LogOut } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import Dashboard from './components/Dashboard';
import Customers from './components/Customers';
import Bookings from './components/Bookings';
import Manifest from './components/Manifest';
import AdminDashboard from './components/AdminDashboard';
import Reports from './components/Reports';
import AuthWrapper from './components/AuthWrapper';
import { useCRM, CRMProvider } from './store/useCRM';
import { DialogProvider } from './components/DialogProvider';

function MainApp() {
  const { user, logout } = useCRM();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'manifest' | 'customers' | 'bookings' | 'reports' | 'admin'>('manifest');
  
  const tabs = [
    { id: 'manifest', label: 'Manifest', icon: MapIcon },
    { id: 'bookings', label: 'Bookings', icon: CalendarDays },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'reports', label: 'Reports', icon: FileSpreadsheet },
    { id: 'admin', label: 'Admin', icon: Settings },
  ] as const;

  // Filter tabs: Technician only sees Manifest, Bookings, Customers
  const visibleTabs = tabs.filter(tab => {
    if (user?.role === 'technician') {
      return tab.id === 'manifest' || tab.id === 'bookings' || tab.id === 'customers';
    }
    return true;
  });

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Sidebar - Desktop Only */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col hidden md:flex">
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white shadow-sm">
              <Crown size={20} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight leading-none mb-1">Crown CRM</h1>
              <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">Durham's Detailing</p>
            </div>
          </div>
        </div>
        
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto mt-4">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                activeTab === tab.id ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <tab.icon size={18} className={activeTab === tab.id ? 'text-white' : ''} /> 
              {tab.label}
            </button>
          ))}
        </nav>

        {/* User Info & Logout Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-9 h-9 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 uppercase">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div className="truncate">
              <p className="text-xs font-semibold text-white leading-none truncate">{user?.name}</p>
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mt-1">{user?.role}</p>
            </div>
          </div>
          <button 
            onClick={logout}
            title="Sign Out"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden pb-[72px] md:pb-0">
        
        {/* Mobile Header */}
        <header className="md:hidden bg-white border-b border-slate-200 px-4 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <Crown size={24} className="text-blue-600" />
            <h1 className="font-bold text-slate-900">Crown CRM</h1>
          </div>
          <div className="flex items-center gap-2">
            {user?.role !== 'technician' && (
              <button 
                onClick={() => setActiveTab('admin')}
                className={`p-2 rounded-lg transition-colors cursor-pointer ${activeTab === 'admin' ? 'bg-slate-100 text-slate-900' : 'text-slate-500'}`}
              >
                <Settings size={20} />
              </button>
            )}
            <button 
              onClick={logout}
              className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut size={20} />
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 w-full h-full">
          <div className="max-w-6xl mx-auto h-full">
            <header className="mb-8 hidden md:block">
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight capitalize">
                {tabs.find(t => t.id === activeTab)?.label}
              </h2>
            </header>
            
            {activeTab === 'dashboard' && <Dashboard />}
            {activeTab === 'manifest' && <Manifest />}
            {activeTab === 'customers' && <Customers />}
            {activeTab === 'bookings' && <Bookings />}
            {activeTab === 'reports' && <Reports />}
            {activeTab === 'admin' && <AdminDashboard />}
          </div>
        </div>
      </main>

      {/* Bottom Navigation - Mobile Only */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around items-center h-[72px] pb-safe z-50 px-2">
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex flex-col items-center justify-center w-full h-full gap-1 cursor-pointer ${
              activeTab === tab.id ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <tab.icon size={22} className={activeTab === tab.id ? 'text-blue-600' : ''} />
            <span className="text-[10px] font-semibold leading-none">{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <DialogProvider>
      <CRMProvider>
        <AuthWrapper>
          <MainApp />
          <Toaster position="bottom-right" />
        </AuthWrapper>
      </CRMProvider>
    </DialogProvider>
  );
}
