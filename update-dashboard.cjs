const fs = require('fs');

let content = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

content = content.replace(/const activeBookings = bookings\.filter\(b => \['New Booking', 'Confirmed', 'On The Way', 'Started', 'pending'\]\.includes\(b\.status\)\);/, `const activeBookings = bookings.filter(b => ['New', 'Confirmed', 'Reminder Sent', 'Technician Assigned', 'On The Way', 'In Progress', 'Rescheduled', 'New Booking', 'pending'].includes(b.status));`);

content = content.replace(/const followUpsNeeded = bookings\.filter\(b => b\.status === 'Follow-up Needed'\);/, `const followUpsNeeded = bookings.filter(b => false); // removed as status was removed`);

fs.writeFileSync('src/components/Dashboard.tsx', content);
