import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Calendar, Car, Clock, Phone, User, X, Check, ArrowRight } from 'lucide-react';
import { IncomingRequest } from '../types';

interface PhoneNotificationProps {
  requests: IncomingRequest[];
  onViewRequest: (req: IncomingRequest) => void;
  onDismissNotification: (id: string) => void;
}

export const PhoneNotificationBanner: React.FC<PhoneNotificationProps> = ({
  requests,
  onViewRequest,
  onDismissNotification
}) => {
  // Only display the most recent 2 un-dismissed notifications
  const [activeItems, setActiveItems] = useState<IncomingRequest[]>([]);

  useEffect(() => {
    setActiveItems(requests.slice(0, 2));
  }, [requests]);

  if (activeItems.length === 0) return null;

  return (
    <div 
      id="phone-notification-stack"
      className="fixed top-3 left-0 right-0 z-[9999] flex flex-col items-center pointer-events-none px-3 sm:px-4 space-y-2.5 max-w-lg mx-auto"
    >
      <AnimatePresence>
        {activeItems.map((req) => (
          <motion.div
            key={req.id}
            initial={{ opacity: 0, y: -40, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 22, stiffness: 320 }}
            className="w-full bg-slate-900/95 backdrop-blur-md text-white rounded-2xl p-3.5 shadow-2xl border border-slate-700/60 pointer-events-auto flex flex-col gap-2.5"
            style={{
              boxShadow: '0 15px 35px -5px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.1) inset'
            }}
          >
            {/* Header: App Pill & Time */}
            <div className="flex items-center justify-between text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-slate-950 font-black text-[10px] shadow-sm">
                  👑
                </div>
                <span className="font-semibold tracking-wide text-slate-200">CROWN DETAILING</span>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                  New Booking
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-400">Just now</span>
                <button
                  id={`close-notif-${req.id}`}
                  onClick={() => onDismissNotification(req.id)}
                  className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800 transition-colors"
                  title="Dismiss notification"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Notification Body */}
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-600/20 border border-blue-400/30 flex items-center justify-center text-blue-300 font-bold shrink-0 text-sm">
                <User size={18} />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <h4 className="font-bold text-white text-sm truncate">
                    {req.fullName}
                  </h4>
                  {req.price ? (
                    <span className="text-xs font-extrabold text-emerald-400 shrink-0">
                      ${req.price}
                    </span>
                  ) : null}
                </div>
                
                <p className="text-xs text-slate-300 truncate mt-0.5 font-medium">
                  {req.serviceRequested || 'Detailing Service'}
                  {req.vehicleMakeModel && ` • ${req.vehicleMakeModel}`}
                </p>

                <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1.5 flex-wrap">
                  <span className="flex items-center gap-1">
                    <Calendar size={11} className="text-amber-400" />
                    {req.preferredDate || 'Flexible Date'}
                  </span>
                  {req.preferredTime && (
                    <span className="flex items-center gap-1">
                      <Clock size={11} className="text-blue-400" />
                      {req.preferredTime}
                    </span>
                  )}
                  {req.phoneNumber && (
                    <span className="flex items-center gap-1">
                      <Phone size={11} className="text-emerald-400" />
                      {req.phoneNumber}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Action Footer */}
            <div className="flex items-center gap-2 pt-1 border-t border-slate-800/80">
              <button
                id={`dismiss-btn-${req.id}`}
                onClick={() => onDismissNotification(req.id)}
                className="flex-1 py-1.5 px-3 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800/70 hover:bg-slate-800 transition-colors text-center"
              >
                Dismiss
              </button>
              <button
                id={`view-btn-${req.id}`}
                onClick={() => onViewRequest(req)}
                className="flex-1 py-1.5 px-3 rounded-lg text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 transition-colors flex items-center justify-center gap-1.5 shadow-sm"
              >
                <span>View & Approve</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
