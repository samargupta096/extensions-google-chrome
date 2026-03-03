import os
import glob

html_snippet = '<select id="globalModelSelect" class="model-select" style="display:none;" title="Select AI Model"></select>'

js_snippet = '''
// --- Global Model Selector ---
async function initGlobalModelSelector() {
  const select = document.getElementById('globalModelSelect');
  if (!select) return;

  try {
    const models = await ollama.listModels();
    if (!models || models.length === 0) {
      select.style.display = 'none';
      return;
    }
    
    select.style.display = ''; // show it
    const local = await chrome.storage.local.get('settings');
    const settings = local.settings || {};
    const savedModel = settings.defaultModel || ollama.defaultModel || 'llama3.2';

    select.innerHTML = models.map(m => `<option value="${m.name}">${m.name}</option>`).join('');
    
    if (models.some(m => m.name === savedModel)) {
      select.value = savedModel;
    } else {
      select.value = models[0].name;
      await chrome.storage.local.set({ settings: { ...settings, defaultModel: select.value } });
    }

    select.addEventListener('change', async (e) => {
      const current = await chrome.storage.local.get('settings');
      await chrome.storage.local.set({ settings: { ...(current.settings || {}), defaultModel: e.target.value } });
    });
  } catch(e) { console.error('Failed to init model selector', e); }
}

// Auto-run after DOM load and status check
setTimeout(initGlobalModelSelector, 500);
'''

css_snippet = '''
/* AI Model Selector */
.model-select {
  background: var(--bg-hover, rgba(255, 255, 255, 0.1));
  color: var(--text-primary, rgba(255, 255, 255, 0.9));
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 12px;
  margin-right: 8px;
  outline: none;
  cursor: pointer;
  max-width: 130px;
  font-family: inherit;
}
.model-select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.model-select option {
  background: #1e1e1e;
  color: #fff;
}
'''

# 1. Update CSS
css_file = 'shared/ui-components.css'
if os.path.exists(css_file):
    with open(css_file, 'r') as f:
        content = f.read()
    if '.model-select' not in content:
        with open(css_file, 'a') as f:
            f.write(css_snippet)

# 2. Update HTML & JS
extensions = glob.glob('*/popup/popup.html')

for html_file in extensions:
    if 'ollama-ui' in html_file: continue
    
    with open(html_file, 'r') as f:
        html_content = f.read()
    
    if 'globalModelSelect' not in html_content:
        # We need to insert it in the DOM somewhere at the top.
        # Find the last closing tag before the end of the header
        # or just inject before <div class="header-actions"> or similar.
        if '<div class="header-actions">' in html_content:
             html_content = html_content.replace('<div class="header-actions">', '<div class="header-actions">\n        ' + html_snippet)
        elif '<div class="header-right">' in html_content:
             html_content = html_content.replace('<div class="header-right">', '<div class="header-right">\n        ' + html_snippet)
        elif '<div class="popup-header-actions">' in html_content:
             html_content = html_content.replace('<div class="popup-header-actions">', '<div class="popup-header-actions">\n        ' + html_snippet)
        else:
            # Fallback for completely different headers, insert after </title> or before </head> for now to just show up,
            # or better: right after <body>
            html_content = html_content.replace('<body>', '<body>\n    ' + html_snippet)
            
        with open(html_file, 'w') as f:
            f.write(html_content)
        print(f"Updated {html_file}")

    js_file = html_file.replace('.html', '.js')
    if os.path.exists(js_file):
        with open(js_file, 'r') as f:
            js_content = f.read()
        
        if 'initGlobalModelSelector' not in js_content:
            with open(js_file, 'a') as f:
                f.write('\n' + js_snippet)
            print(f"Updated {js_file}")

print("Done")
