const fs = require('fs');
const path = require('path');

const exts = [
  'standupscribe', 'tabvault', 'focuslock', 'ghosthunter',
  'codearmor', 'gitpulse', 'clipwise', 'deepwork-guardian',
  'neurotab', 'pagepilot', 'pricehawk', 'applyhawk', 'promptchain'
];

for (const ext of exts) {
  const htmlPath = path.join(__dirname, ext, 'popup', 'popup.html');
  const jsPath = path.join(__dirname, ext, 'popup', 'popup.js');
  
  if (!fs.existsSync(htmlPath) || !fs.existsSync(jsPath)) continue;
  
  const html = fs.readFileSync(htmlPath, 'utf8');
  const js = fs.readFileSync(jsPath, 'utf8');
  
  // Find all IDs in HTML that look like buttons
  const idMatches = html.match(/id="([^"]*(?:btn|button|save|copy|clear|export|add|delete|generate|send|start|end|refresh|close|toggle|submit|run|test)[^"]*)"/gi);
  if (!idMatches) continue;
  
  const ids = [...new Set(idMatches.map(m => m.match(/id="([^"]+)"/)[1]))];
  
  const missing = [];
  for (const id of ids) {
    if (!js.includes(id)) {
      missing.push(id);
    }
  }
  
  if (missing.length > 0) {
    console.log(`\n=== ${ext} ===`);
    missing.forEach(id => console.log(`  ❌ ${id}`));
  }
}
