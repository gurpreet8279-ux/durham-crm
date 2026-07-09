const fs = require('fs');

let content = fs.readFileSync('src/components/Manifest.tsx', 'utf8');

content = content.replace(/const getStatusColor = \(status: string\) => \{[\s\S]*?\};/, `const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return 'bg-green-100 text-green-700 border-green-200';
      case 'Paid': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'In Progress': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'On The Way': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Technician Assigned': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
      case 'Reminder Sent': return 'bg-indigo-50 text-indigo-600 border-indigo-100';
      case 'Confirmed': return 'bg-sky-100 text-sky-700 border-sky-200';
      case 'Cancelled': return 'bg-red-100 text-red-700 border-red-200';
      case 'Rescheduled': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'New': return 'bg-slate-100 text-slate-800 border-slate-300';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };`);

content = content.replace(/const nextStatus = \(currentStatus: string\) => \{[\s\S]*?\};/, `const nextStatus = (currentStatus: string) => {
    switch (currentStatus) {
      case 'New': return 'Confirmed';
      case 'Confirmed': return 'Reminder Sent';
      case 'Reminder Sent': return 'Technician Assigned';
      case 'Technician Assigned': return 'On The Way';
      case 'On The Way': return 'In Progress';
      case 'In Progress': return 'Completed';
      case 'Completed': return 'Paid';
      default: return null;
    }
  };`);

content = content.replace(/const handleStatusAdvance = async \(jobId: string, currentStatus: string\) => \{[\s\S]*?if \(message\) \{[\s\S]*?\}[\s\S]*?\};/, `const handleStatusAdvance = async (jobId: string, currentStatus: string) => {
    const next = nextStatus(currentStatus);
    if (!next) return;
    
    updateBooking(jobId, { status: next as any });
    
    // Auto payment status update if going to Paid
    if (next === 'Paid') {
      updateBooking(jobId, { paymentStatus: 'Paid' });
    }

    // Handle automated SMS
    const booking = bookings.find(b => b.id === jobId);
    const customer = getCustomer(booking?.customerId || '');
    
    if (customer?.phoneNumber && booking) {
      let message = '';
      const dateStr = new Date(booking.date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
      
      if (next === 'Confirmed') {
        message = \`Hello \${customer.fullName},\\n\\nYour appointment with Durham's Crown Mobile Detailing has been confirmed for \${dateStr} at \${formatTime(booking.time)}.\\n\\nWe appreciate the opportunity to care for your vehicle and look forward to providing you with exceptional service.\\n\\nThank you for choosing\\nDurham's Crown Mobile Detailing.\`;
      } else if (next === 'Reminder Sent') {
        message = \`Hello \${customer.fullName}, this is a reminder that your Durham’s Crown Mobile Detailing appointment is scheduled for \${dateStr} at \${formatTime(booking.time)}. Please ensure your vehicle is accessible and remove any personal belongings before our arrival. We look forward to providing exceptional service.\`;
      } else if (next === 'On The Way') {
        message = \`Hello \${customer.fullName},\\n\\nYour Durham’s Crown Mobile Detailing technician is currently on the way and will be arriving shortly for your scheduled service.\\n\\nTo ensure the best possible detailing experience, please have your vehicle accessible and remove any personal belongings or valuables from the interior prior to our arrival.\\n\\nWe appreciate your trust in Durham’s Crown Mobile Detailing and look forward to delivering exceptional care for your vehicle.\`;
      } else if (next === 'Completed') {
        message = \`Thank you for choosing Durham’s Crown mobile detailing ! We just wanted to follow up and make sure you were happy with the service. If you have a moment, we’d greatly appreciate a google review—it goes a long way in helping our small business grow, https://search.google.com/local/writereview?placeid=ChIJrd4LoTESpQIRnrIgBZgIU3E&source=g.page.m.ia._&laa=nmx-review-solicitation-ia2\\n\\nThank you for your support!\`;
      }

      if (message) {
        setSmsStatus(prev => ({ ...prev, [jobId]: 'Opening SMS App...' }));
        window.open(\`sms:\${customer.phoneNumber}?body=\${encodeURIComponent(message)}\`, '_blank');
        setTimeout(() => {
          setSmsStatus(prev => {
            const newStatus = { ...prev };
            delete newStatus[jobId];
            return newStatus;
          });
        }, 3000);
      }
    }
  };`);

// Also change todayJobs filter to account for 'New Booking' vs 'New' and 'Started' vs 'In Progress' etc.
content = content.replace(/b\.date === today && b\.status !== 'Cancelled'/g, `b.date === today && b.status !== 'Cancelled'`);

fs.writeFileSync('src/components/Manifest.tsx', content);
