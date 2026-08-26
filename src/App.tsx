import { useState } from 'react';
import { LayoutDashboard, Users, CalendarDays, Crown, Map as MapIcon, Settings, FileSpreadsheet } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import Dashboard from './components/Dashboard';
import Customers from './components/Customers';
import Bookings from './components/Bookings';
import Manifest from './components/Manifest';
import AdminDashboard from './components/AdminDashboard';
import Reports from './components/Reports';
import AuthWrapper from './components/AuthWrapper';
import ErrorBoundary from './components/ErrorBoundary';
import { useCRM, CRMProvider } from './store/useCRM';
import { DialogProvider } from './components/DialogProvider';

function MainApp() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'manifest' | 'customers' | 'bookings' | 'reports' | 'admin'>('manifest');
  const { incomingRequests } = useCRM();
  
  // Count of pending incoming leads
  const pendingCount = incomingRequests.filter(r => r.status === 'Pending' || (r.status !== 'Approved' && r.status !== 'Dismissed')).length;

  const tabs = [
    { id: 'manifest', label: 'Manifest', icon: MapIcon },
    { id: 'bookings', label: 'Bookings', icon: CalendarDays, badge: pendingCount },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'reports', label: 'Reports', icon: FileSpreadsheet },
    { id: 'admin', label: 'Admin', icon: Settings },
  ] as const;

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
          {pendingCount > 0 && (
            <span className="flex items-center gap-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-bold px-2 py-0.5 rounded-full animate-pulse" title={`${pendingCount} new pending bookings`}>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
              {pendingCount} new
            </span>
          )}
        </div>
        
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto mt-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-3">
                <tab.icon size={18} className={activeTab === tab.id ? 'text-white' : ''} /> 
                {tab.label}
              </div>
              {'badge' in tab && (tab as any).badge > 0 && (
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  activeTab === tab.id 
                    ? 'bg-white text-blue-700' 
                    : 'bg-blue-500 text-white'
                }`}>
                  {(tab as any).badge}
                </span>
              )}
            </button>
          ))}
        </nav>
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
            {pendingCount > 0 && (
              <button 
                onClick={() => setActiveTab('bookings')}
                className="flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold px-2.5 py-1 rounded-full animate-pulse"
              >
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                {pendingCount} New
              </button>
            )}
            <button 
              onClick={() => setActiveTab('admin')}
              className={`p-2 rounded-lg transition-colors ${activeTab === 'admin' ? 'bg-slate-100 text-slate-900' : 'text-slate-500'}`}
            >
              <Settings size={20} />
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
        {tabs.slice(0, 5).map((tab) => {
          const badgeCount = 'badge' in tab ? (tab as any).badge : 0;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex flex-col items-center justify-center w-full h-full gap-1 relative ${
                activeTab === tab.id ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <div className="relative">
                <tab.icon size={22} className={activeTab === tab.id ? 'text-blue-600' : ''} />
                {badgeCount > 0 && (
                  <span className="absolute -top-1 -right-2 bg-amber-500 text-white text-[9px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center border-2 border-white">
                    {badgeCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium leading-none">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthWrapper>
        <DialogProvider>
          <CRMProvider>
            <MainApp />
            <Toaster position="bottom-right" />
          </CRMProvider>
        </DialogProvider>
      </AuthWrapper>
    </ErrorBoundary>
  );
}
