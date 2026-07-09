const fs = require('fs');

let content = fs.readFileSync('src/components/AdminDashboard.tsx', 'utf8');

content = content.replace(/\{spreadsheetId && \(\n\s*<p className="text-xs text-blue-600 mb-4 font-medium">\n\s*<a href=\{`https:\/\/docs\.google\.com\/spreadsheets\/d\/\$\{spreadsheetId\}\/edit`\} target="_blank" rel="noreferrer" className="hover:underline">\n\s*Open Current Spreadsheet ↗\n\s*<\/a>\n\s*<\/p>\n\s*\)\}/, 
  `{spreadsheetId ? (
                <div className="mb-4">
                  <p className="text-xs text-blue-600 font-medium mb-2">
                    <a href={\`https://docs.google.com/spreadsheets/d/\${spreadsheetId}/edit\`} target="_blank" rel="noreferrer" className="hover:underline">
                      Open Current Spreadsheet ↗
                    </a>
                  </p>
                  <button 
                    onClick={() => setSpreadsheetId(null)}
                    className="text-xs text-red-600 font-medium hover:underline"
                  >
                    Disconnect Spreadsheet
                  </button>
                </div>
              ) : (
                <div className="mb-4">
                  <p className="text-xs text-slate-500 mb-2">Paste a Google Sheet ID to use an existing one, or leave blank to create a new one.</p>
                  <input
                    type="text"
                    placeholder="Spreadsheet ID (Optional)"
                    id="sheetIdInput"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              )}`);

// Also update the handleSyncToSheets to read from sheetIdInput
content = content.replace(/let currentSpreadsheetId = spreadsheetId;\n\s*if \(\!currentSpreadsheetId\) \{/, 
  `let currentSpreadsheetId = spreadsheetId;
      if (!currentSpreadsheetId) {
        const inputVal = (document.getElementById('sheetIdInput') as HTMLInputElement)?.value;
        if (inputVal) {
          currentSpreadsheetId = inputVal.includes('d/') ? inputVal.split('d/')[1].split('/')[0] : inputVal;
          await setSpreadsheetId(currentSpreadsheetId);
        }
      }
      if (!currentSpreadsheetId) {`);

fs.writeFileSync('src/components/AdminDashboard.tsx', content);
