/**
 * Dropdown Manager — Upgrades native selects to custom glassmorphic dropdowns
 * 
 * Features:
 * - Automatic conversion of any <select class="glass-select">
 * - Custom scrollbar styling
 * - Smooth glassmorphic animations
 * - Syncs back to original select so existing logic doesn't break
 */
class DropdownManager {
  constructor() {
    this.upgraded = new Map();
    this.init();
  }

  init() {
    this.upgradeAll();
    
    // Global click listener to close all dropdowns
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.glass-select-wrapper')) {
        this.closeAll();
      }
    });

    // Observer to handle dynamically added selects or options
    const observer = new MutationObserver((mutations) => {
      let needsRefresh = false;
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          // If a new select was added, or options within an upgraded select changed
          mutation.addedNodes.forEach(node => {
            if (node.tagName === 'SELECT' && node.classList.contains('glass-select')) needsRefresh = true;
            if (node.tagName === 'OPTION' && node.parentNode.classList.contains('glass-select')) {
              this.refreshSelect(node.parentNode);
            }
          });
        }
      }
      if (needsRefresh) this.upgradeAll();
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  upgradeAll() {
    const selects = document.querySelectorAll('select.glass-select:not([data-upgraded])');
    selects.forEach(select => this.upgrade(select));
  }

  upgrade(select) {
    if (select.dataset.upgraded) return;
    select.dataset.upgraded = 'true';
    select.style.display = 'none';

    const wrapper = document.createElement('div');
    wrapper.className = 'glass-select-wrapper';
    wrapper.style.width = select.style.width || '100%';
    select.parentNode.insertBefore(wrapper, select);
    wrapper.appendChild(select);

    const trigger = document.createElement('div');
    trigger.className = 'glass-select-trigger';
    trigger.textContent = select.options[select.selectedIndex]?.text || select.placeholder || 'Select...';
    wrapper.appendChild(trigger);

    const dropdown = document.createElement('div');
    dropdown.className = 'glass-dropdown';
    wrapper.appendChild(dropdown);

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isShowing = dropdown.classList.contains('show');
      this.closeAll();
      if (!isShowing) dropdown.classList.add('show');
    });

    this.populate(select, dropdown, trigger);
    this.upgraded.set(select, { wrapper, trigger, dropdown });
  }

  refreshSelect(select) {
    const component = this.upgraded.get(select);
    if (component) {
      this.populate(select, component.dropdown, component.trigger);
    }
  }

  populate(select, dropdown, trigger) {
    dropdown.innerHTML = Array.from(select.options).map(opt => {
      if (opt.disabled && !opt.value) return ''; // Skip "placeholder" options
      return `<div class="dropdown-item ${opt.selected ? 'selected' : ''}" data-value="${opt.value}">${opt.text}</div>`;
    }).join('');

    dropdown.querySelectorAll('.dropdown-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const val = item.dataset.value;
        select.value = val;
        trigger.textContent = item.textContent;
        dropdown.classList.remove('show');
        
        // Dispatch change event to trigger original logic
        select.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });

    // Update trigger text if selection changed externally
    if (select.options[select.selectedIndex]) {
      trigger.textContent = select.options[select.selectedIndex].text;
    }
  }

  closeAll() {
    document.querySelectorAll('.glass-dropdown.show').forEach(d => d.classList.remove('show'));
  }
}

// Auto-init on DOM load
document.addEventListener('DOMContentLoaded', () => {
  window.devDashDropdowns = new DropdownManager();
});
