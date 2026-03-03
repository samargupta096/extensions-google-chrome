import re
import os

readme_path = "README.md"
with open(readme_path, "r") as f:
    content = f.read()

extensions = [
    {
        "id": "deepwork-guardian",
        "name": "DeepWork Guardian",
        "purpose": "Productivity coaching during focused work blocks.",
        "icon": "./deepwork-guardian/icons/icon128.png",
        "features": ["Pomodoro timer & breaks", "Distraction blocking", "Browsing analytics", "Local dashboard views", "Optional Ollama insights"]
    },
    {
        "id": "neurotab",
        "name": "NeuroTab",
        "purpose": "Save and reason over what you read online.",
        "icon": "./neurotab/icons/icon128.png",
        "features": ["Capture page/selection", "Generate summaries/tags", "Searchable local knowledge base", "Q&A over saved content"]
    },
    {
        "id": "pricehawk",
        "name": "PriceHawk",
        "purpose": "Monitor products over time and avoid misleading discounts.",
        "icon": "./pricehawk/icons/icon128.png",
        "features": ["Manual/assisted product capture", "Historical tracking", "Suspicious sale checks", "AI-assisted buy/no-buy guidance"]
    },
    {
        "id": "clipwise",
        "name": "ClipWise",
        "purpose": "Keep clipboard data reusable and organized.",
        "icon": "./clipwise/icons/icon128.png",
        "features": ["Clipboard archive", "Snippet saving", "Clip type categorization", "AI transform actions"]
    },
    {
        "id": "pagepilot",
        "name": "PagePilot",
        "purpose": "Fast page understanding + handy dev tools in one popup.",
        "icon": "./pagepilot/icons/icon128.png",
        "features": ["Chat with current page context", "Formatter/converter mini-tools", "Regex testing and utility helpers", "Color converter"]
    },
    {
        "id": "gitpulse",
        "name": "GitPulse",
        "purpose": "Centralize PR review work.",
        "icon": "./gitpulse/icons/icon128.png",
        "features": ["Inbox for review requests/authored PRs", "Urgency indicators", "AI PR summaries", "Velocity-oriented stats"]
    },
    {
        "id": "ghosthunter",
        "name": "GhostHunter",
        "purpose": "Identify suspicious job postings.",
        "icon": "./ghosthunter/icons/icon128.png",
        "features": ["Supported on LinkedIn, Indeed, Glassdoor, Wellfound", "Risk badges & listing signal checks", "Application tracking"]
    },
    {
        "id": "codearmor",
        "name": "CodeArmor",
        "purpose": "Reduce accidental credential leakage.",
        "icon": "./codearmor/icons/icon128.png",
        "features": ["Paste interception on risky pages", "Pattern-based secret detection", "Vault of known secrets", "Dashboard metrics"]
    },
    {
        "id": "applyhawk",
        "name": "ApplyHawk",
        "purpose": "Speed up repetitive job applications.",
        "icon": "./applyhawk/icons/icon128.png",
        "features": ["Autofill on major job form flows", "Local profile data", "Activity tracking", "AI-assisted cover-letter generation"]
    },
    {
        "id": "focuslock",
        "name": "FocusLock",
        "purpose": "Maintain flow state while browsing.",
        "icon": "./focuslock/icons/icon128.png",
        "features": ["Deep work mode", "Context-aware nudges", "Score-based focus tracking", "Local productivity analytics"]
    },
    {
        "id": "promptchain",
        "name": "PromptChain",
        "purpose": "Run repeatable multi-step AI tasks locally.",
        "icon": "./promptchain/icons/icon128.png",
        "features": ["Chain builder & execution runner", "Saved chain library", "Page-context prompts", "Model selection"]
    },
    {
        "id": "standupscribe",
        "name": "StandupScribe",
        "purpose": "Generate standup updates from your actual browsing/work activity.",
        "icon": "./standupscribe/icons/icon128.png",
        "features": ["Auto-generated Yesterday/Today/Blockers", "Editable drafts", "History view", "AI model integration"]
    },
    {
        "id": "tabvault",
        "name": "TabVault",
        "purpose": "Manage tab sprawl and session recovery.",
        "icon": "./tabvault/icons/icon128.png",
        "features": ["Save/restore tab sets", "Stale-tab detection", "Memory estimate panel", "Optional AI-generated session summaries"]
    }
]

gif_html = """
<p align="center">
  <img src=".github/gifs/extensions_demo.gif" alt="Extensions Demo Animation" width="300" style="border-radius: 12px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
</p>
"""

html_blocks = []
html_blocks.append(gif_html)

for idx, ext in enumerate(extensions):
    screenshot_path = f".github/screenshots/{ext['id']}_screenshot.png"
    has_screenshot = os.path.exists(screenshot_path)
    
    if has_screenshot:
        screenshot_html = f'<a href="{screenshot_path}"><img src="{screenshot_path}" width="220" style="border-radius: 12px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);" alt="{ext["name"]} Screenshot" /></a>'
    else:
        screenshot_html = f'<img src="{ext["icon"]}" width="160" style="border-radius: 12px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);" alt="{ext["name"]} Icon" />'
        
    # Using float-based div alignment since GitHub markdown strips out display: flex 
    block = f"""### {idx+1}) {ext['name']}

<div align="left" style="display: flex; align-items: flex-start; gap: 20px; margin-bottom: 20px;">
  <div style="flex: 0 0 80px; text-align: center;">
    <img src="{ext['icon']}" width="80" alt="{ext['name']} Icon">
  </div>
  <div style="flex: 1; padding: 0 20px;">
    <p><strong>Purpose:</strong> {ext['purpose']}</p>
    <ul>
"""
    for feature in ext['features']:
        block += f"      <li>{feature}</li>\n"
    block += f"""    </ul>
  </div>
  <div style="flex: 0 0 220px; text-align: center;">
    {screenshot_html}
  </div>
</div>

<br clear="all" />

---

"""
    html_blocks.append(block)

replacement = "".join(html_blocks)

start_marker = "## ✨ Extensions\n"
end_marker = "## 🔒 Privacy Principles\n"

if start_marker in content and end_marker in content:
    start_idx = content.find(start_marker) + len(start_marker)
    end_idx = content.find(end_marker)
    
    new_content = content[:start_idx] + "\n" + replacement + content[end_idx:]
    with open(readme_path, "w") as f:
        f.write(new_content)
    print("Successfully replaced the Extensions section with div layouts.")
else:
    print("Could not find start/end markers.")
