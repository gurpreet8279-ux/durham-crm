const fs = require('fs');

let content = fs.readFileSync('src/components/AdminDashboard.tsx', 'utf8');

// Add getCalendars import
content = content.replace(/import \{ createSpreadsheet, syncToGoogleSheets, syncToGoogleCalendar \} from '\.\.\/lib\/workspace';/,
  `import { createSpreadsheet, syncToGoogleSheets, syncToGoogleCalendar, getCalendars } from '../lib/workspace';`);

// Add calendarId and setCalendarId
content = content.replace(/const \{ customers, bookings, spreadsheetId, setSpreadsheetId \} = useCRM\(\);/,
  `const { customers, bookings, spreadsheetId, setSpreadsheetId, calendarId, setCalendarId } = useCRM();
  const [availableCalendars, setAvailableCalendars] = useState<any[]>([]);
  
  useEffect(() => {
    if (user) {
      getCalendars().then(setAvailableCalendars).catch(console.error);
    }
  }, [user]);`);

// Update calendar section
content = content.replace(/<div className="border border-slate-200 p-5 rounded-lg">\s*<div className="flex items-center gap-2 font-bold text-slate-900 mb-2">\s*<Calendar className="text-purple-500" size=\{20\} \/> Google Calendar\s*<\/div>\s*<p className="text-sm text-slate-500 mb-4">\s*Sync all 'New' and 'Confirmed' bookings to your primary Google Calendar\.\s*<\/p>\s*<button \s*onClick=\{handleSyncToCalendar\}\s*disabled=\{isSyncing\}\s*className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 mt-auto"\s*>\s*Sync Bookings to Calendar\s*<\/button>\s*<\/div>/,
  `<div className="border border-slate-200 p-5 rounded-lg flex flex-col">
              <div className="flex items-center gap-2 font-bold text-slate-900 mb-2">
                <Calendar className="text-purple-500" size={20} /> Google Calendar
              </div>
              <p className="text-sm text-slate-500 mb-4">
                Select a calendar to automatically sync bookings. Events update when you edit bookings.
              </p>
              
              <div className="mb-4">
                <select 
                  value={calendarId || ''}
                  onChange={(e) => setCalendarId(e.target.value || null)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                >
                  <option value="">-- Do not sync --</option>
                  {availableCalendars.map(c => (
                    <option key={c.id} value={c.id}>{c.summary}</option>
                  ))}
                </select>
              </div>

              <button 
                onClick={handleSyncToCalendar}
                disabled={isSyncing || !calendarId}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 mt-auto"
              >
                Force Sync All Upcoming
              </button>
            </div>`);

// Also update the `syncToGoogleCalendar` call inside handleSyncToCalendar to pass `calendarId`
content = content.replace(/await syncToGoogleCalendar\(booking, customer\);/g, `await syncToGoogleCalendar(booking, customer, calendarId || 'primary');`);

fs.writeFileSync('src/components/AdminDashboard.tsx', content);
