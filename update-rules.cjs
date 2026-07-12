const fs = require('fs');
let rules = fs.readFileSync('firestore.rules', 'utf8');

const newRule = `
    match /public_bookings/{bookingId} {
      allow create: if true;
      allow read, update, delete: if isSignedIn();
    }
`;

rules = rules.replace('match /databases/{database}/documents {', 'match /databases/{database}/documents {' + newRule);
fs.writeFileSync('firestore.rules', rules);
