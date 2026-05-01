# 🚀 DevDash

**DevDash** is a highly customizable, locally-focused Developer Productivity Dashboard that replaces your default Chrome new tab page. It features 36+ widgets tailored specifically for software engineers, encompassing productivity tracking, developer utilities, system monitoring, and AI chat.

---

## 🧩 Included Widgets

DevDash includes a vast array of widgets that can be toggled via the built-in Template Manager (All, Developer Suite, Daily Focus, Information Hub) or customized individually:

### ⏱️ Productivity & Focus
- **Quote**: Displays a daily motivational or tech-related quote.
- **Active Goals**: Set and track your top priorities for the day.
- **Focus Timer**: A built-in Pomodoro timer to manage deep work sessions.
- **Today's Tasks**: A quick, persistent to-do list.
- **Quick Links**: Customizable bookmarks for your most visited sites.
- **Scratchpad**: A persistent auto-saving text area for quick notes.

### 🌐 Information Hub
- **World Clock**: Track time across multiple time zones instantly.
- **Weather**: Current weather conditions and forecasts for your area.
- **Tech News**: Pulls the latest headlines from Hacker News and tech subreddits.

### 💻 Developer Utilities
- **Regex Tester**: Test regular expressions instantly against sample text.
- **Epoch Time**: Convert Unix timestamps to human-readable dates and vice-versa.
- **NPM Tracker**: Track download stats and version info for NPM packages.
- **Bundle Size**: Estimate the minified and gzipped size of NPM packages.
- **JSON Formatter**: Format, minify, and validate JSON payloads.
- **JWT Decoder**: Decode JSON Web Tokens to inspect their headers and payload.
- **Base64**: Encode and decode strings in Base64.
- **UUID Generator**: Quickly generate v4 UUIDs on the fly.
- **ColorBox (colorutility)**: Convert colors between HEX, RGB, HSL, and pick colors.
- **API PingBox (apitester)**: Send quick HTTP requests (GET/POST) to test endpoints.
- **Cmd CheatSheet**: Quick reference for Git, Docker, Linux, and Kubernetes commands.
- **HTTP Codes (httpref)**: Quick reference for HTTP status codes and their meanings.
- **DP/PX/SP (dppxconverter)**: Convert between CSS pixels, device pixels, and scale-independent pixels.

### 🛠️ Advanced Tools & DevOps
- **GitHub Graph**: View your GitHub contribution heatmap directly in your new tab.
- **GitHub Stats**: Track your repositories, followers, and stars.
- **PR Monitor (ghmonitor)**: Keep track of your open Pull Requests and their review status.
- **Stack Overflow**: Search or view recent questions on Stack Overflow.
- **Cron Sentinel**: Generate and decode Cron expressions in plain English.
- **Region Compass**: AWS/GCP/Azure region directory and latency checks.
- **Env Vault**: Safely store and manage local `.env` variables and secrets.
- **Intent Builder**: Android Intent URI builder and deep link tester.
- **Docker Monitor**: Cheatsheet and quick reference for Docker commands.
- **IAM Decoder**: AWS IAM policy explainer and reference.
- **Material Palette**: Material design color palette generator.
- **OTel TraceBox (traceviewer)**: Inspect and format OpenTelemetry trace payloads.

### 🖥️ System & AI Integration
- **System Monitor**: Real-time tracking of CPU and Memory usage via Chrome APIs.
- **AI Chat (Ollama)**: A fully local, privacy-first AI chat widget integrated with Ollama.

---

## ⚙️ Configuration & Layout

DevDash supports a full **Drag & Drop** grid. You can reorder widgets to fit your workflow. 

Click the **🧩 Manage Widgets** button in the bottom corner to:
- Toggle individual widgets on or off.
- Reorder widgets in the sidebar list.
- Apply preset templates like **Developer Suite** or **Daily Focus**.

## 🔒 Privacy First
Like all extensions in this suite, DevDash stores your configurations, scratchpad notes, and tasks entirely locally using `chrome.storage.local`. External API calls (like Weather or GitHub) are made directly from your browser, with no intermediary servers or telemetry.
