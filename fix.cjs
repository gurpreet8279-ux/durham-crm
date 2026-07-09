const fs = require('fs');
let content = fs.readFileSync('src/components/Manifest.tsx', 'utf8');

content = content.replace(/  };\n            delete newStatus\[jobId\];\n            return newStatus;\n          }\);\n        }, 3000\);\n      }\n    }\n  };/g, '  };');

fs.writeFileSync('src/components/Manifest.tsx', content);
