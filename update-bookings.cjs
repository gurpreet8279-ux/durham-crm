const fs = require('fs');

let content = fs.readFileSync('src/components/Bookings.tsx', 'utf8');

content = content.replace(/const STATUS_OPTIONS: BookingStatus\[\] = \[.*?\];/s, `const STATUS_OPTIONS: BookingStatus[] = [
  'New', 'Confirmed', 'Reminder Sent', 'Technician Assigned', 'On The Way', 'In Progress', 'Completed', 'Paid', 'Cancelled', 'Rescheduled'
];`);

content = content.replace(/const getStatusBadge = \(status: string\) => \{[\s\S]*?\};/g, `const getStatusBadge = (status: string) => {
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
  };`);

// Also change the default form status
content = content.replace(/status: 'New Booking'/g, `status: 'New'`);

fs.writeFileSync('src/components/Bookings.tsx', content);
