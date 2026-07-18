import { useState, useMemo } from 'react';
import { useCRM } from '../store/useCRM';
import { Booking, BookingStatus } from '../types';
import { 
  FileText, 
  Download, 
  Printer, 
  Table, 
  Calendar, 
  TrendingUp, 
  Users, 
  DollarSign, 
  Briefcase, 
  Award,
  ChevronRight,
  Filter
} from 'lucide-react';
import toast from 'react-hot-toast';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

type DatePreset = 'today' | 'this_week' | 'this_month' | 'last_month' | 'this_year' | 'custom';

export default function Reports() {
  const { bookings, customers } = useCRM();
  
  const [preset, setPreset] = useState<DatePreset>('this_month');
  
  // Custom date range state (defaulting to current month's start to today)
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  // Helper: parse a local YYYY-MM-DD string into a real Date object in local timezone
  const parseLocalDate = (dateStr: string): Date => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  // Helper: format a date nicely
  const formatDateLabel = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const d = parseLocalDate(dateStr);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Calculate local timezone constraints based on preset selection
  const filterRange = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    let start = new Date(now);
    let end = new Date(now);

    switch (preset) {
      case 'today':
        // Start and end are today
        break;
      case 'this_week': {
        const dayOfWeek = now.getDay(); // 0 is Sunday
        start.setDate(now.getDate() - dayOfWeek);
        end.setDate(now.getDate() + (6 - dayOfWeek));
        break;
      }
      case 'this_month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'last_month':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'this_year':
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31);
        break;
      case 'custom':
        if (startDate) start = parseLocalDate(startDate);
        if (endDate) end = parseLocalDate(endDate);
        break;
    }

    // Adjust hours for safe boundary checks
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }, [preset, startDate, endDate]);

  // Filtered bookings
  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
      if (!b.date) return false;
      const bDate = parseLocalDate(b.date);
      return bDate >= filterRange.start && bDate <= filterRange.end;
    }).sort((a, b) => b.date.localeCompare(a.date) || (b.time || '').localeCompare(a.time || ''));
  }, [bookings, filterRange]);

  // Customer Map for fast lookup
  const customerMap = useMemo(() => {
    const map = new Map<string, typeof customers[0]>();
    customers.forEach(c => map.set(c.id, c));
    return map;
  }, [customers]);

  // Extraction Helpers for PDF/CSV tables
  const getTechnician = (booking: Booking) => {
    if (booking.notes) {
      const match = booking.notes.match(/(?:tech|technician|worker|assigned\s*to):\s*([^\n,]+)/i);
      if (match) return match[1].trim();
    }
    if (booking.status === 'Completed' || booking.status === 'Paid' || booking.status === 'Technician Assigned') {
      return 'Completed by Lead Tech';
    }
    return 'Unassigned';
  };

  const getPaymentMethod = (booking: Booking) => {
    if (booking.notes) {
      const match = booking.notes.match(/(?:payment|pay\s*by|method):\s*([^\n,]+)/i);
      if (match) return match[1].trim();
      if (/cash/i.test(booking.notes)) return 'Cash';
      if (/card|credit|debit/i.test(booking.notes)) return 'Card';
      if (/zelle/i.test(booking.notes)) return 'Zelle';
      if (/venmo/i.test(booking.notes)) return 'Venmo';
      if (/check/i.test(booking.notes)) return 'Check';
    }
    return booking.paymentStatus === 'Paid' ? 'Card/Online' : 'Pending';
  };

  // Summary Metrics calculations
  const metrics = useMemo(() => {
    const count = filteredBookings.length;
    const completedOrPaid = filteredBookings.filter(b => b.status === 'Completed' || b.status === 'Paid' || b.paymentStatus === 'Paid');
    const cancelledCount = filteredBookings.filter(b => b.status === 'Cancelled').length;
    const completedCount = filteredBookings.filter(b => b.status === 'Completed').length;
    
    // Total Revenue of Completed or Paid bookings
    const totalRevenue = completedOrPaid.reduce((sum, b) => sum + (b.price || 0), 0);
    const avgBookingValue = completedOrPaid.length > 0 ? totalRevenue / completedOrPaid.length : 0;

    // Unique clients in filtered bookings
    const uniqueClients = new Set(filteredBookings.map(b => b.customerId));
    const totalClients = uniqueClients.size;

    // Most popular service
    const serviceCounts: Record<string, number> = {};
    filteredBookings.forEach(b => {
      const s = b.service || 'General Detail';
      serviceCounts[s] = (serviceCounts[s] || 0) + 1;
    });
    let popularService = 'N/A';
    let maxServiceCount = 0;
    Object.entries(serviceCounts).forEach(([service, cnt]) => {
      if (cnt > maxServiceCount) {
        maxServiceCount = cnt;
        popularService = service;
      }
    });

    // Most frequent customer
    const customerCounts: Record<string, number> = {};
    filteredBookings.forEach(b => {
      customerCounts[b.customerId] = (customerCounts[b.customerId] || 0) + 1;
    });
    let frequentCustomer = 'N/A';
    let maxCustomerCount = 0;
    Object.entries(customerCounts).forEach(([cid, cnt]) => {
      if (cnt > maxCustomerCount) {
        maxCustomerCount = cnt;
        const custName = customerMap.get(cid)?.fullName;
        if (custName) frequentCustomer = custName;
      }
    });

    return {
      totalBookings: count,
      totalClients,
      totalRevenue,
      avgBookingValue,
      popularService,
      frequentCustomer,
      completedCount,
      cancelledCount
    };
  }, [filteredBookings, customerMap]);

  // Generate dynamic filename label
  const getFileLabel = () => {
    const now = new Date();
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    if (preset === 'this_month') {
      return `${months[now.getMonth()]}_${now.getFullYear()}`;
    }
    if (preset === 'last_month') {
      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return `${months[prevMonth.getMonth()]}_${prevMonth.getFullYear()}`;
    }
    if (preset === 'today') {
      return `${months[now.getMonth()]}_${now.getDate()}_${now.getFullYear()}`;
    }
    return `Period_${now.getFullYear()}`;
  };

  // EXPORT 1: PDF Generation
  const downloadPDF = () => {
    if (filteredBookings.length === 0) {
      toast.error("No bookings in the selected date range to generate a report.");
      return;
    }

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;

      // 1. Draw Royal Navy Top Stripe
      doc.setFillColor(15, 23, 42); // Slate 900
      doc.rect(0, 0, pageWidth, 42, 'F');

      // 2. Vector Gold Crown Logo (Hand-crafted beautiful crown)
      // Left peak
      doc.setFillColor(234, 179, 8); // Gold 500
      doc.triangle(165, 10, 168, 25, 160, 25, 'F');
      // Center peak
      doc.triangle(175, 7, 179, 25, 171, 25, 'F');
      // Right peak
      doc.triangle(185, 10, 188, 25, 180, 25, 'F');
      // Base band
      doc.rect(160, 25, 28, 4, 'F');
      // Little gem circles on top of peaks
      doc.setFillColor(255, 255, 255);
      doc.circle(165, 10, 0.7, 'F');
      doc.circle(175, 7, 0.7, 'F');
      doc.circle(185, 10, 0.7, 'F');

      // 3. Business Header Text (White on dark background)
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text("Durham's Crown Mobile Detailing", 14, 18);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(203, 213, 225); // Slate 300
      doc.text("Professional Fleet & Private Detailing Portal", 14, 25);
      doc.text("Phone: (919) 555-0199 | Website: www.durhamscrowndetailing.com", 14, 30);

      // 4. Report Meta block
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(255, 255, 255);
      doc.text("EXECUTIVE CLIENT SERVICE REPORT", 14, 38);

      const generatedOn = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184); // Slate 400
      doc.text(`Report Generated On: ${generatedOn}`, 14, 50);
      
      const filterLabel = preset === 'custom' 
        ? `${formatDateLabel(startDate)} to ${formatDateLabel(endDate)}` 
        : preset.replace('_', ' ').toUpperCase();
      doc.text(`Date Range: ${filterLabel} (${filteredBookings.length} records)`, 14, 55);

      // 5. Setup table rows
      const tableData = filteredBookings.map(b => {
        const cust = customerMap.get(b.customerId);
        return [
          b.date,
          cust?.fullName || 'N/A',
          cust?.phoneNumber || 'N/A',
          b.vehicle || 'N/A',
          b.service || 'N/A',
          getTechnician(b),
          getPaymentMethod(b),
          `$${(b.price || 0).toFixed(2)}`,
          b.status
        ];
      });

      // 6. Build Grid
      autoTable(doc, {
        startY: 62,
        head: [['Date', 'Customer', 'Phone', 'Vehicle', 'Service', 'Technician', 'Payment', 'Price', 'Status']],
        body: tableData,
        theme: 'striped',
        headStyles: { 
          fillColor: [15, 23, 42], 
          textColor: [255, 255, 255], 
          fontSize: 8, 
          fontStyle: 'bold' 
        },
        styles: { fontSize: 7.5, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 16 }, // Date
          1: { cellWidth: 23 }, // Customer
          2: { cellWidth: 20 }, // Phone
          3: { cellWidth: 22 }, // Vehicle
          4: { cellWidth: 25 }, // Service
          5: { cellWidth: 32 }, // Technician
          6: { cellWidth: 18 }, // Payment
          7: { cellWidth: 13 }, // Price
          8: { cellWidth: 18 }  // Status
        },
        didDrawPage: (data) => {
          const pageCount = (doc as any).internal.getNumberOfPages();
          doc.setFontSize(8);
          doc.setFont('helvetica', 'italic');
          doc.setTextColor(148, 163, 184);
          doc.text("Durham's Crown Mobile Detailing — Premium Finish & Protective Coatings", 14, doc.internal.pageSize.height - 10);
          doc.setFont('helvetica', 'normal');
          doc.text(`Page ${data.pageNumber} of ${pageCount}`, doc.internal.pageSize.width - 25, doc.internal.pageSize.height - 10);
        }
      });

      // 7. Executive Summary Panel on last page
      const finalY = (doc as any).lastAutoTable.finalY || 120;
      const spaceNeeded = 60;
      const pageHeight = doc.internal.pageSize.height;

      // Add new page if not enough space
      if (finalY + spaceNeeded > pageHeight - 20) {
        doc.addPage();
        // Redraw thin header band on extra page
        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, pageWidth, 8, 'F');
      }

      const summaryY = finalY + spaceNeeded > pageHeight - 20 ? 15 : finalY + 10;

      // Card Box Border
      doc.setDrawColor(226, 232, 240); // Slate 200
      doc.setFillColor(248, 250, 252); // Slate 50
      doc.roundedRect(14, summaryY, pageWidth - 28, 48, 3, 3, 'FD');

      // Title
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text("BUSINESS PERFORMANCE SUMMARY STATISTICS", 18, summaryY + 7);

      // Horizontal separator line
      doc.setDrawColor(226, 232, 240);
      doc.line(18, summaryY + 11, pageWidth - 18, summaryY + 11);

      // Data Grid
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(51, 65, 85); // Slate 700

      // Left Column
      doc.text(`Total Bookings Scheduled:  ${metrics.totalBookings}`, 20, summaryY + 18);
      doc.text(`Active Unique Clients:     ${metrics.totalClients}`, 20, summaryY + 25);
      doc.text(`Total Period Revenue:      $${metrics.totalRevenue.toFixed(2)}`, 20, summaryY + 32);
      doc.text(`Average Booking Value:     $${metrics.avgBookingValue.toFixed(2)}`, 20, summaryY + 39);

      // Right Column
      doc.text(`Most Popular Service:      ${metrics.popularService}`, 110, summaryY + 18);
      doc.text(`Top Account Client:        ${metrics.frequentCustomer}`, 110, summaryY + 25);
      doc.text(`Completed Jobs:            ${metrics.completedCount}`, 110, summaryY + 32);
      doc.text(`Cancelled Bookings:        ${metrics.cancelledCount}`, 110, summaryY + 39);

      // Save Document
      const filename = `Client_Report_${getFileLabel()}.pdf`;
      doc.save(filename);
      toast.success(`PDF downloaded: ${filename}`);
    } catch (err) {
      console.error(err);
      toast.error("An error occurred during PDF generation");
    }
  };

  // EXPORT 2: Excel (.xlsx) Generation
  const downloadExcel = () => {
    if (filteredBookings.length === 0) {
      toast.error("No bookings in selected range to export.");
      return;
    }

    try {
      const dataRows = filteredBookings.map(b => {
        const cust = customerMap.get(b.customerId);
        return {
          'Booking Date': b.date,
          'Customer Name': cust?.fullName || 'N/A',
          'Phone': cust?.phoneNumber || 'N/A',
          'Email': cust?.email || 'N/A',
          'Vehicle': b.vehicle || 'N/A',
          'Service': b.service || 'N/A',
          'Technician': getTechnician(b),
          'Payment Method': getPaymentMethod(b),
          'Price ($)': b.price || 0,
          'Status': b.status,
          'Notes': b.notes || ''
        };
      });

      const ws = XLSX.utils.json_to_sheet(dataRows);
      
      // Auto-fit column widths
      const colWidths = [
        { wch: 12 }, // Date
        { wch: 20 }, // Name
        { wch: 15 }, // Phone
        { wch: 22 }, // Email
        { wch: 20 }, // Vehicle
        { wch: 18 }, // Service
        { wch: 22 }, // Tech
        { wch: 15 }, // Payment
        { wch: 10 }, // Price
        { wch: 15 }, // Status
        { wch: 30 }  // Notes
      ];
      ws['!cols'] = colWidths;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Detall Reports');

      const filename = `Client_Report_${getFileLabel()}.xlsx`;
      XLSX.writeFile(wb, filename);
      toast.success(`Excel downloaded: ${filename}`);
    } catch (err) {
      console.error(err);
      toast.error("Error creating Excel file");
    }
  };

  // EXPORT 3: CSV Generation
  const downloadCSV = () => {
    if (filteredBookings.length === 0) {
      toast.error("No bookings in selected range to export.");
      return;
    }

    try {
      const csvData = filteredBookings.map(b => {
        const cust = customerMap.get(b.customerId);
        return {
          'Booking Date': b.date,
          'Customer Name': cust?.fullName || 'N/A',
          'Phone': cust?.phoneNumber || 'N/A',
          'Email': cust?.email || 'N/A',
          'Vehicle': b.vehicle || 'N/A',
          'Service': b.service || 'N/A',
          'Technician': getTechnician(b),
          'Payment Method': getPaymentMethod(b),
          'Price': b.price || 0,
          'Status': b.status,
          'Notes': b.notes || ''
        };
      });

      const csvString = Papa.unparse(csvData);
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      const filename = `Client_Report_${getFileLabel()}.csv`;
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success(`CSV downloaded: ${filename}`);
    } catch (err) {
      console.error(err);
      toast.error("Error creating CSV export");
    }
  };

  // EXPORT 4: Browser Print
  const triggerPrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Hero Card */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 md:p-8 shadow-md border border-slate-800 relative overflow-hidden">
        {/* Decorative Golden Crown backdrop vector */}
        <div className="absolute right-8 top-1/2 -translate-y-1/2 opacity-10 hidden lg:block">
          <FileText size={160} className="text-amber-400 rotate-12" />
        </div>
        
        <div className="relative z-10 max-w-2xl">
          <span className="bg-blue-500/20 text-blue-300 font-bold uppercase tracking-widest text-xs px-3 py-1 rounded-full border border-blue-500/30">
            Analytics & Reports Portal
          </span>
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight mt-3 mb-2">
            Durham's Crown Detailing Client Reports
          </h2>
          <p className="text-slate-300 text-sm leading-relaxed">
            Generate, filter, and extract high-fidelity executive summaries of customer appointments, fleet maintenance services, revenue matrices, and detailing statistics instantly. No server roundtrips required.
          </p>
        </div>
      </div>

      {/* 2. Advanced Filters & Range Selector */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h3 className="font-bold text-slate-900 text-base mb-4 flex items-center gap-2">
          <Filter size={18} className="text-blue-600" /> Filter Report Parameters
        </h3>
        
        <div className="space-y-4">
          {/* Preset Buttons */}
          <div className="flex flex-wrap gap-2">
            {(
              [
                { id: 'today', label: 'Today' },
                { id: 'this_week', label: 'This Week' },
                { id: 'this_month', label: 'This Month' },
                { id: 'last_month', label: 'Last Month' },
                { id: 'this_year', label: 'This Year' },
                { id: 'custom', label: 'Custom Date Range' }
              ] as { id: DatePreset; label: string }[]
            ).map(opt => (
              <button
                key={opt.id}
                onClick={() => setPreset(opt.id)}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all border ${
                  preset === opt.id 
                    ? 'bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-500/10' 
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Custom Date Inputs */}
          {preset === 'custom' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200/60 max-w-xl animate-fade-in">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Start Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                  <input 
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full pl-9 bg-white border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">End Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                  <input 
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full pl-9 bg-white border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Real-Time Performance Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 hover:border-slate-300 transition-all flex items-start gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <TrendingUp size={20} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Bookings</p>
            <h4 className="text-xl md:text-2xl font-black text-slate-900 mt-1">{metrics.totalBookings}</h4>
            <span className="text-[10px] text-slate-500">Scheduled services</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 hover:border-slate-300 transition-all flex items-start gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <DollarSign size={20} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Revenue</p>
            <h4 className="text-xl md:text-2xl font-black text-slate-900 mt-1">${metrics.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h4>
            <span className="text-[10px] text-slate-500">Completed & paid</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 hover:border-slate-300 transition-all flex items-start gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Users size={20} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Unique Clients</p>
            <h4 className="text-xl md:text-2xl font-black text-slate-900 mt-1">{metrics.totalClients}</h4>
            <span className="text-[10px] text-slate-500">Active accounts</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 hover:border-slate-300 transition-all flex items-start gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Award size={20} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Avg. Booking Price</p>
            <h4 className="text-xl md:text-2xl font-black text-slate-900 mt-1">${metrics.avgBookingValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h4>
            <span className="text-[10px] text-slate-500">Ticket average</span>
          </div>
        </div>
      </div>

      {/* Auxiliary Statistics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-lg">
              <Briefcase size={18} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Most Popular Service</p>
              <p className="font-bold text-slate-800 text-sm mt-0.5">{metrics.popularService}</p>
            </div>
          </div>
          <ChevronRight size={16} className="text-slate-300" />
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-sky-50 text-sky-600 rounded-lg">
              <Users size={18} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Most Frequent Account</p>
              <p className="font-bold text-slate-800 text-sm mt-0.5">{metrics.frequentCustomer}</p>
            </div>
          </div>
          <ChevronRight size={16} className="text-slate-300" />
        </div>
      </div>

      {/* 4. Downloader Actions Toolbar */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h4 className="font-bold text-slate-900 text-sm">Download & Extract Manifest Reports</h4>
            <p className="text-xs text-slate-500">Generate instantly directly to your file manager. Fully styled and structured.</p>
          </div>
          
          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={downloadPDF}
              className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              <FileText size={16} /> Download PDF
            </button>
            <button
              onClick={downloadExcel}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              <Table size={16} /> Export Excel (.xlsx)
            </button>
            <button
              onClick={downloadCSV}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              <Download size={16} /> Export CSV
            </button>
            <button
              onClick={triggerPrint}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-300 hover:border-slate-400 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              <Printer size={16} /> Print Report
            </button>
          </div>
        </div>
      </div>

      {/* 5. Live Document Preview Grid */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <span className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">Document Live Grid Preview</span>
          <span className="text-xs text-slate-500 bg-white border border-slate-200/80 rounded-lg px-2.5 py-1 font-medium shadow-2xs">
            Showing {filteredBookings.length} entries matching current range
          </span>
        </div>

        {filteredBookings.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="mx-auto text-slate-300 mb-3" size={44} />
            <h4 className="font-bold text-slate-800 text-sm">No Client Bookings Found</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">There are no records in the active period. Change the preset filters or add more CRM bookings to preview reports.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="px-6 py-3">Booking Date</th>
                  <th className="px-6 py-3">Customer Name</th>
                  <th className="px-6 py-3">Phone</th>
                  <th className="px-6 py-3">Vehicle</th>
                  <th className="px-6 py-3">Service</th>
                  <th className="px-6 py-3">Technician</th>
                  <th className="px-6 py-3">Payment</th>
                  <th className="px-6 py-3 text-right">Price</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredBookings.map((b) => {
                  const cust = customerMap.get(b.customerId);
                  return (
                    <tr key={b.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-3.5 font-semibold text-slate-900 whitespace-nowrap">{b.date}</td>
                      <td className="px-6 py-3.5 whitespace-nowrap font-medium text-slate-800">{cust?.fullName || 'N/A'}</td>
                      <td className="px-6 py-3.5 whitespace-nowrap text-slate-500">{cust?.phoneNumber || 'N/A'}</td>
                      <td className="px-6 py-3.5 whitespace-nowrap">{b.vehicle || 'N/A'}</td>
                      <td className="px-6 py-3.5 whitespace-nowrap font-medium text-blue-700">{b.service || 'N/A'}</td>
                      <td className="px-6 py-3.5 whitespace-nowrap text-slate-500">{getTechnician(b)}</td>
                      <td className="px-6 py-3.5 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-bold text-[9px] uppercase ${
                          b.paymentStatus === 'Paid' 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                            : 'bg-amber-50 text-amber-700 border border-amber-100'
                        }`}>
                          {getPaymentMethod(b)}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-right font-bold text-slate-900 whitespace-nowrap">${(b.price || 0).toFixed(2)}</td>
                      <td className="px-6 py-3.5 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-bold text-[9px] uppercase ${
                          b.status === 'Completed' || b.status === 'Paid'
                            ? 'bg-green-50 text-green-700 border border-green-100'
                            : b.status === 'Cancelled'
                            ? 'bg-red-50 text-red-700 border border-red-100'
                            : 'bg-blue-50 text-blue-700 border border-blue-100'
                        }`}>
                          {b.status}
                        </span>
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
