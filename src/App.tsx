import { useState } from 'react';
import { LayoutDashboard, Users, CalendarDays, Sparkles, Crown, Map as MapIcon, Settings, LogOut } from 'lucide-react';
import Dashboard from './components/Dashboard';
import Customers from './components/Customers';
import Bookings from './components/Bookings';
import AIParser from './components/AIParser';
import Manifest from './components/Manifest';
import AdminDashboard from './components/AdminDashboard';
import AuthWrapper from './components/AuthWrapper';
import { useCRM, CRMProvider } from './store/useCRM';
import { logout } from './lib/firebaseAuth';

function MainApp() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'manifest' | 'customers' | 'bookings' | 'parser' | 'admin'>('manifest');
  const { authError } = useCRM();

  const tabs = [
    { id: 'manifest', label: 'Manifest', icon: MapIcon },
    { id: 'bookings', label: 'Bookings', icon: CalendarDays },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'parser', label: 'AI Parser', icon: Sparkles },
    { id: 'admin', label: 'Admin', icon: Settings },
  ] as const;

  if (authError) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-red-200 max-w-md w-full mx-4 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-600 mx-auto mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-4">Authentication Error</h1>
          <p className="text-slate-600 mb-8 text-sm leading-relaxed">{authError}</p>
          <button
            onClick={() => {
              localStorage.removeItem('google_access_token');
              logout();
              window.location.reload();
            }}
            className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-lg px-4 py-3 transition-colors"
          >
            <LogOut size={18} /> Sign Out and Try Again
          </button>
        </div>
      </div>
    );
  }

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
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <tab.icon size={18} className={activeTab === tab.id ? 'text-white' : tab.id === 'parser' ? 'text-blue-400' : ''} /> 
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="p-4 mt-auto">
          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to log out?')) {
                localStorage.removeItem('google_access_token');
                logout();
                window.location.reload();
              }
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <LogOut size={18} /> Sign Out
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
          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to log out?')) {
                localStorage.removeItem('google_access_token');
                logout();
                window.location.reload();
              }
            }}
            className="text-slate-500 p-2"
          >
            <LogOut size={20} />
          </button>
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
            {activeTab === 'parser' && <AIParser />}
            {activeTab === 'admin' && <AdminDashboard />}
          </div>
        </div>
      </main>

      {/* Bottom Navigation - Mobile Only */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around items-center h-[72px] pb-safe z-50 px-2">
        {tabs.slice(0, 5).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex flex-col items-center justify-center w-full h-full gap-1 ${
              activeTab === tab.id ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <tab.icon size={22} className={activeTab === tab.id && tab.id === 'parser' ? 'text-blue-600' : tab.id === 'parser' ? 'text-blue-400' : ''} />
            <span className="text-[10px] font-medium leading-none">{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

import PublicBookingForm from './components/PublicBookingForm';

export default function App() {
  const isPublicBooking = window.location.pathname === '/book';

  if (isPublicBooking) {
    return <PublicBookingForm />;
  }

  return (
    <AuthWrapper>
      <CRMProvider>
        <MainApp />
      </CRMProvider>
    </AuthWrapper>
  );
}
