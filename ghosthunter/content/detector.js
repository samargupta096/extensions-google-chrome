/**
 * GhostHunter — Content Script (Job Board Detector)
 * Scans job listings on LinkedIn, Indeed, Glassdoor, Wellfound
 * and overlays ghost job risk badges.
 */

(function () {
  'use strict';

  const GHOST_SIGNALS = {
    // High-risk signals (weight: 3)
    reposted: {
      weight: 3,
      label: 'Reposted',
      patterns: [/repost/i, /posted\s+\d+\+?\s*(months?|weeks?)\s*ago/i, /30\+\s*days?\s*ago/i]
    },
    alwaysHiring: {
      weight: 3,
      label: 'Always Hiring',
      patterns: [/always\s+hiring/i, /continuous\s*(ly)?\s*hiring/i, /ongoing\s+recruitment/i]
    },
    noSalary: {
      weight: 2,
      label: 'No Salary Info',
      check: (text) => !(/\$[\d,]+/i.test(text) || /salary/i.test(text) || /compensation/i.test(text) || /\d+k\s*[-–]\s*\d+k/i.test(text))
    },

    // Medium signals (weight: 2)
    vagueDescription: {
      weight: 2,
      label: 'Vague Description',
      check: (text) => {
        const words = text.split(/\s+/).length;
        return words < 80;
      }
    },
    unrealisticRequirements: {
      weight: 2,
      label: 'Unrealistic Requirements',
      patterns: [
        /\d{2,}\+?\s*years?\s*(of)?\s*(experience|exp)/i,
        /must\s+know\s+everything/i,
        /expert\s+in\s+all/i
      ]
    },
    genericTitle: {
      weight: 1,
      label: 'Generic Title',
      patterns: [
        /^(software\s+)?engineer$/i,
        /^developer$/i,
        /multiple\s+positions?/i
      ]
    },

    // Low signals (weight: 1)
    tooManyApplicants: {
      weight: 1,
      label: 'High Volume',
      patterns: [/\d{3,}\+?\s*applicants?/i, /over\s+\d{3,}\s+applicat/i]
    },
    oldPosting: {
      weight: 2,
      label: 'Old Posting',
      patterns: [/posted\s+(2|3|4|5|6)\+?\s*weeks?\s*ago/i, /posted\s+over\s+a?\s*month/i]
    }
  };

  // ─── Platform Detection ───
  function detectPlatform() {
    const host = window.location.hostname;
    if (host.includes('linkedin.com')) return 'linkedin';
    if (host.includes('indeed.com')) return 'indeed';
    if (host.includes('glassdoor.com')) return 'glassdoor';
    if (host.includes('wellfound.com')) return 'wellfound';
    return 'unknown';
  }

  const platform = detectPlatform();

  // ─── Job Card Selectors ───
  const SELECTORS = {
    linkedin: {
      cards: '.jobs-search-results__list-item, .job-card-container, .scaffold-layout__list-item',
      title: '.job-card-list__title, .job-card-container__link, a[data-control-name="job_card"]',
      company: '.job-card-container__primary-description, .artdeco-entity-lockup__subtitle',
      meta: '.job-card-container__metadata-wrapper, .artdeco-entity-lockup__caption',
      description: '.jobs-description__content, .jobs-box__html-content'
    },
    indeed: {
      cards: '.job_seen_beacon, .jobsearch-ResultsList .result, .css-1ac2h1w',
      title: '.jobTitle a, .jcs-JobTitle a, h2.jobTitle',
      company: '.companyName, .css-63koeb, [data-testid="company-name"]',
      meta: '.metadata, .css-1hl8ood, .resultContent',
      description: '#jobDescriptionText, .jobsearch-JobMetadataHeader-item'
    },
    glassdoor: {
      cards: '.react-job-listing, [data-test="jobListing"], .JobsList_jobListItem__wjTHv',
      title: '.job-title, [data-test="job-title"], a.jobLink',
      company: '.employer-name, [data-test="employer-name"]',
      meta: '.listing-age, .job-age',
      description: '.desc, .jobDescriptionContent'
    },
    wellfound: {
      cards: '[data-test="StartupResult"], .styles_component__UCLp3',
      title: 'a[data-test="startup-link"], .styles_title__xpbat',
      company: '[data-test="startup-name"], .styles_name__Aacaq',
      meta: '.styles_tagLink__i5IA7, .styles_subheader__E1mBf',
      description: '.styles_description__nOWAr'
    }
  };

  // ─── Analyze a Job Listing ───
  function analyzeJob(cardEl) {
    const sel = SELECTORS[platform];
    if (!sel) return null;

    const titleEl = cardEl.querySelector(sel.title);
    const companyEl = cardEl.querySelector(sel.company);
    const metaEl = cardEl.querySelector(sel.meta);

    const title = titleEl?.textContent?.trim() || '';
    const company = companyEl?.textContent?.trim() || '';
    const meta = metaEl?.textContent?.trim() || '';
    const fullText = `${title} ${company} ${meta} ${cardEl.textContent}`;

    const signals = [];
    let totalScore = 0;

    for (const [key, signal] of Object.entries(GHOST_SIGNALS)) {
      let triggered = false;

      if (signal.patterns) {
        triggered = signal.patterns.some(p => p.test(fullText));
      }
      if (signal.check) {
        triggered = signal.check(fullText);
      }

      if (triggered) {
        signals.push({ key, label: signal.label, weight: signal.weight });
        totalScore += signal.weight;
      }
    }

    // Normalize to 0-100
    const maxPossible = Object.values(GHOST_SIGNALS).reduce((s, v) => s + v.weight, 0);
    const ghostScore = Math.round((totalScore / maxPossible) * 100);

    return {
      title,
      company,
      url: titleEl?.href || window.location.href,
      ghostScore,
      signals,
      risk: ghostScore >= 50 ? 'high' : ghostScore >= 25 ? 'medium' : 'low'
    };
  }

  // ─── Inject Badge ───
  function injectBadge(cardEl, analysis) {
    if (cardEl.querySelector('.gh-badge')) return;

    const badge = document.createElement('div');
    badge.className = `gh-badge gh-risk-${analysis.risk}`;

    const icon = analysis.risk === 'high' ? '🔴' : analysis.risk === 'medium' ? '🟡' : '🟢';
    const label = analysis.risk === 'high' ? 'Ghost Risk' : analysis.risk === 'medium' ? 'Caution' : 'Likely Real';

    badge.innerHTML = `
      <span class="gh-badge-icon">${icon}</span>
      <span class="gh-badge-label">${label}</span>
      <span class="gh-badge-score">${analysis.ghostScore}%</span>
    `;

    // Tooltip with signals
    if (analysis.signals.length > 0) {
      const tooltip = document.createElement('div');
      tooltip.className = 'gh-tooltip';
      tooltip.innerHTML = `
        <div class="gh-tooltip-title">Ghost Signals Detected:</div>
        ${analysis.signals.map(s => `<div class="gh-tooltip-item">⚠️ ${s.label}</div>`).join('')}
        <div class="gh-tooltip-action">
          <button class="gh-track-btn" data-title="${encodeURIComponent(analysis.title)}" data-company="${encodeURIComponent(analysis.company)}" data-url="${encodeURIComponent(analysis.url)}" data-score="${analysis.ghostScore}" data-signals="${encodeURIComponent(JSON.stringify(analysis.signals))}">
            📋 Track Application
          </button>
        </div>
      `;
      badge.appendChild(tooltip);
    }

    // Position
    cardEl.style.position = 'relative';
    cardEl.appendChild(badge);

    // Report signal
    if (analysis.ghostScore > 0) {
      chrome.runtime.sendMessage({
        action: 'reportGhostSignal',
        data: {
          platform,
          ghostScore: analysis.ghostScore,
          signals: analysis.signals.map(s => s.key),
          url: window.location.href
        }
      }).catch(() => {});
    }
  }

  // ─── Track button handler ───
  document.addEventListener('click', (e) => {
    const trackBtn = e.target.closest('.gh-track-btn');
    if (trackBtn) {
      e.preventDefault();
      e.stopPropagation();

      const data = {
        title: decodeURIComponent(trackBtn.dataset.title),
        company: decodeURIComponent(trackBtn.dataset.company),
        url: decodeURIComponent(trackBtn.dataset.url),
        platform,
        ghostScore: parseInt(trackBtn.dataset.score) || 0,
        ghostSignals: JSON.parse(decodeURIComponent(trackBtn.dataset.signals || '[]'))
      };

      chrome.runtime.sendMessage({ action: 'addApplication', data }, (response) => {
        if (response?.success) {
          trackBtn.textContent = '✅ Tracked!';
          trackBtn.disabled = true;
        }
      });
    }
  });

  // ─── Scan Page ───
  function scanPage() {
    const sel = SELECTORS[platform];
    if (!sel) return;

    const cards = document.querySelectorAll(sel.cards);
    cards.forEach(card => {
      if (card.dataset.ghScanned) return;
      card.dataset.ghScanned = 'true';

      const analysis = analyzeJob(card);
      if (analysis) {
        injectBadge(card, analysis);
      }
    });
  }

  // ─── Run ───
  // Initial scan
  setTimeout(scanPage, 1500);

  // MutationObserver for dynamic content
  const observer = new MutationObserver((mutations) => {
    let hasNewNodes = false;
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        hasNewNodes = true;
        break;
      }
    }
    if (hasNewNodes) {
      setTimeout(scanPage, 500);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Rescan on scroll (for lazy-loaded content)
  let scrollTimer;
  window.addEventListener('scroll', () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(scanPage, 800);
  });

  console.log(`[GhostHunter] Active on ${platform}`);
})();
