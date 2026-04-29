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
        "features": ["⏲️ Smart Pomodoro timer & breaks", "🛡️ Advanced distraction blocking", "📊 Deep-dive browsing analytics", "🏠 Local dashboard & insights", "🤖 Optional Ollama integration"]
    },
    {
        "id": "neurotab",
        "name": "NeuroTab",
        "purpose": "Save and reason over what you read online.",
        "icon": "./neurotab/icons/icon128.png",
        "features": ["📸 1-click capture page/selection", "🏷️ AI-generated summaries & tags", "🧠 Searchable local knowledge base", "💬 Interactive Q&A over saved content"]
    },
    {
        "id": "pricehawk",
        "name": "PriceHawk",
        "purpose": "Monitor products over time and avoid misleading discounts.",
        "icon": "./pricehawk/icons/icon128.png",
        "features": ["🛒 Manual & automated product capture", "📈 Detailed historical price tracking", "🚨 Suspicious sale & fake discount checks", "💡 AI-assisted buy/no-buy guidance"]
    },
    {
        "id": "clipwise",
        "name": "ClipWise",
        "purpose": "Keep clipboard data reusable and organized.",
        "icon": "./clipwise/icons/icon128.png",
        "features": ["📂 Comprehensive clipboard archive", "💾 Persistent snippet saving", "s️ Smart clip type categorization", "✨ AI-powered text transform actions"]
    },
    {
        "id": "pagepilot",
        "name": "PagePilot",
        "purpose": "Fast page understanding + handy dev tools in one popup.",
        "icon": "./pagepilot/icons/icon128.png",
        "features": ["💬 Contextual chat with the active page", "🛠️ Quick formatter/converter mini-tools", "🔍 Regex testing & utility helpers", "🎨 Instant color format converter"]
    },
    {
        "id": "gitpulse",
        "name": "GitPulse",
        "purpose": "Centralize PR review work.",
        "icon": "./gitpulse/icons/icon128.png",
        "features": ["📥 Unified inbox for PR review requests", "🔥 Smart urgency indicators", "📝 AI-generated PR summaries", "📊 Velocity & code review stats"]
    },
    {
        "id": "ghosthunter",
        "name": "GhostHunter",
        "purpose": "Identify suspicious job postings.",
        "icon": "./ghosthunter/icons/icon128.png",
        "features": ["🌐 Works on LinkedIn, Indeed, Glassdoor", "⚠️ Risk badges & fake listing signals", "📋 Automated application tracking", "🔎 Deep-dive employer background checks"]
    },
    {
        "id": "codearmor",
        "name": "CodeArmor",
        "purpose": "Reduce accidental credential leakage.",
        "icon": "./codearmor/icons/icon128.png",
        "features": ["🛑 Paste interception on risky domains", "🔑 Pattern-based secret detection", "🗄️ Secure local vault of known secrets", "📈 Dashboard metrics & risk reports"]
    },
    {
        "id": "applyhawk",
        "name": "ApplyHawk",
        "purpose": "Speed up repetitive job applications.",
        "icon": "./applyhawk/icons/icon128.png",
        "features": ["⚡ Autofill across major job portals", "📁 Local profile & resume data storage", "📅 Comprehensive activity tracking", "✍️ AI-assisted cover-letter generator"]
    },
    {
        "id": "focuslock",
        "name": "FocusLock",
        "purpose": "Maintain flow state while browsing.",
        "icon": "./focuslock/icons/icon128.png",
        "features": ["🧘 Dedicated deep work mode", "🔔 Context-aware nudges & alerts", "🎯 Score-based focus tracking", "📊 Local productivity analytics"]
    },
    {
        "id": "promptchain",
        "name": "PromptChain",
        "purpose": "Run repeatable multi-step AI tasks locally.",
        "icon": "./promptchain/icons/icon128.png",
        "features": ["⛓️ Visual chain builder & execution runner", "📚 Saved prompt chain library", "🔗 Page-context aware prompts", "⚙️ Dynamic model selection"]
    },
    {
        "id": "standupscribe",
        "name": "StandupScribe",
        "purpose": "Generate standup updates from your actual browsing/work activity.",
        "icon": "./standupscribe/icons/icon128.png",
        "features": ["🤖 Auto-generated Yesterday/Today/Blockers", "✏️ Easily editable daily drafts", "📅 Comprehensive history view", "🧠 Deep AI model integration"]
    },
    {
        "id": "tabvault",
        "name": "TabVault",
        "purpose": "Manage tab sprawl and session recovery.",
        "icon": "./tabvault/icons/icon128.png",
        "features": ["💾 Save & restore complex tab sets", "🕸️ Stale-tab & duplicate detection", "💾 Real-time memory estimate panel", "📄 AI-generated session summaries"]
    },
    {
        "id": "tabhandoff",
        "name": "Tab Handoff",
        "purpose": "Instant Tab Sharing across paired devices.",
        "icon": "./tabhandoff/icons/icon128.png",
        "features": ["🔗 Pair multiple Chrome browsers", "📤 Instantly push active tabs to devices", "📥 Pull tabs from paired devices", "🔄 Seamlessly sync open tabs & windows"]
    },
    {
        "id": "devdash",
        "name": "DevDash",
        "purpose": "Developer productivity dashboard for your new tab.",
        "icon": "./devdash/icons/icon128.png",
        "features": [
            "⏰ Large digital clock and world clock",
            "🤖 Local Ollama AI Chat Integration",
            "💻 Real-time System CPU/RAM Monitor",
            "🐙 GitHub PR Tracker & Stack Overflow Watcher",
            "📰 Hacker News & Subreddit Feeds",
            "📝 Persistent Auto-saving Scratchpad & Goals"
        ]
    }
]

html_blocks = []
for idx, ext in enumerate(extensions):
    screenshot_path = f".github/screenshots/{ext['id']}_screenshot.png"
    has_screenshot = os.path.exists(screenshot_path)
    
    screenshot_html = ""
    if has_screenshot:
        screenshot_html = f'<a href="{screenshot_path}"><img src="{screenshot_path}" width="220" style="border-radius: 12px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);" alt="{ext["name"]} Screenshot" /></a>'
    else:
        # Fallback to the extension icon itself scaled up if no screenshot exists to keep layout consistent
        screenshot_html = f'<img src="{ext["icon"]}" width="160" style="border-radius: 12px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);" alt="{ext["name"]} Icon" />'
        
    block = f"""### {idx+1}) {ext['name']}

<table width="100%">
  <tr>
    <td width="15%" align="center" valign="top">
      <img src="{ext['icon']}" width="80" alt="{ext['name']} Icon">
    </td>
    <td width="45%" valign="top">
      <p><strong>Purpose:</strong> {ext['purpose']}</p>
      <ul>
"""
    for feature in ext['features']:
        block += f"        <li>{feature}</li>\n"
    block += f"""      </ul>
    </td>
    <td width="40%" align="center" valign="top">
      {screenshot_html}
    </td>
  </tr>
</table>

---

"""
    html_blocks.append(block)

replacement = "".join(html_blocks)

start_marker = "## ✨ Extensions\n"
end_marker = "## ⚙️ How It Works — Technical Deep Dive\n"

if start_marker in content and end_marker in content:
    start_idx = content.find(start_marker) + len(start_marker)
    end_idx = content.find(end_marker)
    
    new_content = content[:start_idx] + "\n" + replacement + content[end_idx:]
    with open(readme_path, "w") as f:
        f.write(new_content)
    print("Successfully replaced the Extensions section.")
else:
    print("Could not find start/end markers.")
