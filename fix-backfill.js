const fs = require('fs');
const path = 'backend/routes/verification.js';
let code = fs.readFileSync(path, 'utf8');
const lines = code.split('\n');

// Find the exact lines to replace
// After the forEach close, we have:
//   });  <- closes forEach
//   }    <- closes outer db.query callback  
//   };   <- closes backfillArchive
// But currently there are extra lines

// Find the forEach closing line
const forEachCloseIdx = lines.findIndex(l => l.trim() === '});' && l.includes('approvedDrivers.forEach'));
if (forEachCloseIdx === -1) {
  console.log('Could not find forEach close');
  process.exit(1);
}

console.log('forEach closes at line', forEachCloseIdx + 1);

// The next lines should be:
// Line after forEachCloseIdx: `      }` (close outer db.query callback)
// Line after that: `    );` (close db.query call)
// Line after that: `  };` (close backfillArchive)

// Show current state
console.log('Current lines after forEach close:');
for (let i = forEachCloseIdx; i < Math.min(forEachCloseIdx + 10, lines.length); i++) {
  console.log(`  ${i+1}: ${JSON.stringify(lines[i].trim())}`);
}

// Replace everything from forEachCloseIdx+1 to the next `  };` 
let endIdx = forEachCloseIdx + 1;
while (endIdx < lines.length && lines[endIdx].trim() !== '};') {
  endIdx++;
}

console.log('Replacing lines', forEachCloseIdx + 2, 'to', endIdx + 1);

const replacement = [
  '        }',
  '      };'
];

lines.splice(forEachCloseIdx + 1, endIdx - forEachCloseIdx, ...replacement);

code = lines.join('\n');
fs.writeFileSync(path, code);
console.log('Fixed!');

// Verify
const newLines = code.split('\n');
console.log('Verification:');
for (let i = forEachCloseIdx - 2; i < Math.min(forEachCloseIdx + 8, newLines.length); i++) {
  console.log(`  ${i+1}: ${JSON.stringify(newLines[i].trim())}`);
}
