const API_BASE = 'http://127.0.0.1:8000';
const DOCTOR_PATH = '/admin/doctor';

// Grab the native pushState/replaceState BEFORE any SPA (Tailscale's React router)
// can wrap them. Calling these directly bypasses the SPA router entirely so
// navigating to /admin/doctor won't trigger a React re-render / 404 redirect.
const nativePush    = History.prototype.pushState.bind(history);
const nativeReplace = History.prototype.replaceState.bind(history);

// ── iframe panel ─────────────────────────────────────────────────────────────

const iframe = document.createElement('iframe');
iframe.id = 'doctor-panel';
iframe.src = chrome.runtime.getURL('index.html')
  + '?embedded=true'
  + '&apiBase=' + encodeURIComponent(API_BASE);
iframe.style.cssText = `
  position: fixed;
  left: 0;
  width: 100vw;
  border: none;
  z-index: 9999;
  display: none;
  background: #111111;
`;
document.body.appendChild(iframe);

// ── Helpers ──────────────────────────────────────────────────────────────────

function getPageBg() {
  const raw = getComputedStyle(document.body).backgroundColor;
  const m = raw.match(/\d+/g);
  if (m && m.length >= 3)
    return '#' + m.slice(0, 3).map(n => (+n).toString(16).padStart(2, '0')).join('');
  return '#111111';
}

function getNavBottom() {
  const nav = document.querySelector('nav') || document.querySelector('[role="navigation"]');
  return nav ? nav.getBoundingClientRect().bottom : 56;
}

function isOnDoctorPage() {
  return window.location.pathname === DOCTOR_PATH;
}

// Walk up from an <a> to find the element sitting directly inside the tab bar
function getTabContainer(a) {
  if (!a) return null;
  let el = a;
  while (el.parentElement) {
    if (el.parentElement.querySelectorAll('a[href*="/admin/"]').length > 1) return el;
    el = el.parentElement;
  }
  return a;
}

function findSettingsContainer() {
  const a = document.querySelector('a[href*="/admin/settings"]')
    || [...document.querySelectorAll('a[href*="/admin/"]')]
        .find(el => el.textContent.trim().toLowerCase() === 'settings');
  return getTabContainer(a);
}

function findMachinesContainer() {
  const a = document.querySelector('a[href*="/admin/machines"]')
    || document.querySelectorAll('a[href*="/admin/"]')[0];
  return getTabContainer(a);
}

// ── Show / Hide panel based on current URL ────────────────────────────────────

function syncPanel() {
  if (isOnDoctorPage()) {
    const bottom = getNavBottom();
    iframe.style.top = bottom + 'px';
    iframe.style.height = `calc(100vh - ${bottom}px)`;
    iframe.style.background = getPageBg();
    iframe.style.display = 'block';

    // Hide the page's main content so only our panel shows
    const main = document.querySelector('main') || document.querySelector('[role="main"]');
    if (main) main.style.visibility = 'hidden';

    // Mark our tab active
    const tab = document.getElementById('doctor-tab');
    if (tab) {
      const innerA = tab.tagName === 'A' ? tab : tab.querySelector('a');
      if (innerA) innerA.setAttribute('aria-current', 'page');
      const liveActive = document.querySelector('a[href*="/admin/"]:not(#doctor-tab a)[aria-current="page"]');
      const color = liveActive ? getComputedStyle(liveActive).color : '#60a5fa';
      tab.style.setProperty('color', color, 'important');
    }
  } else {
    iframe.style.display = 'none';

    const main = document.querySelector('main') || document.querySelector('[role="main"]');
    if (main) main.style.visibility = '';

    const tab = document.getElementById('doctor-tab');
    if (tab) {
      const innerA = tab.tagName === 'A' ? tab : tab.querySelector('a');
      if (innerA) innerA.removeAttribute('aria-current');
      tab.style.removeProperty('color');
    }
  }
}

// ── Intercept SPA navigation ─────────────────────────────────────────────────

// Also wrap pushState/replaceState so that when the SPA navigates away from
// /admin/doctor (e.g. user clicks Logs) we hide the panel.
const origPush    = history.pushState.bind(history);
const origReplace = history.replaceState.bind(history);
history.pushState    = (...args) => { origPush(...args);    syncPanel(); };
history.replaceState = (...args) => { origReplace(...args); syncPanel(); };
window.addEventListener('popstate', syncPanel);

window.addEventListener('resize', () => {
  if (!isOnDoctorPage()) return;
  const bottom = getNavBottom();
  iframe.style.top = bottom + 'px';
  iframe.style.height = `calc(100vh - ${bottom}px)`;
});

// ── Build & inject tab ───────────────────────────────────────────────────────

function buildTab(templateContainer) {
  const tab = templateContainer.cloneNode(true);
  tab.id = 'doctor-tab';
  tab.style.cursor = 'pointer';

  tab.removeAttribute('aria-current');
  tab.querySelectorAll('[aria-current]').forEach(el => el.removeAttribute('aria-current'));

  // Set href to /admin/doctor so it behaves like a real tab
  const innerA = tab.tagName === 'A' ? tab : tab.querySelector('a');
  if (innerA) innerA.href = DOCTOR_PATH;

  // Activity / heartbeat icon — matches lucide-react's Activity icon
  const svg = tab.querySelector('svg');
  if (svg) {
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '16');
    svg.setAttribute('height', '16');
    svg.innerHTML = `<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>`;
  }

  // Set label to "Doctor"
  const walker = document.createTreeWalker(tab, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    if (walker.currentNode.textContent.trim()) {
      walker.currentNode.textContent = 'Doctor';
      break;
    }
  }

  // On click, use the NATIVE pushState to update the URL bar without
  // triggering Tailscale's React router (which would re-render / redirect).
  tab.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    nativePush({}, '', DOCTOR_PATH);
    syncPanel();
  }, true);

  return tab;
}

function ensureTab() {
  const settingsContainer = findSettingsContainer();
  if (!settingsContainer) return;

  const existing = document.getElementById('doctor-tab');

  if (existing && settingsContainer.nextElementSibling === existing) return;

  if (existing) {
    settingsContainer.insertAdjacentElement('afterend', existing);
    syncPanel();
    return;
  }

  const machinesContainer = findMachinesContainer();
  if (!machinesContainer) return;

  const tab = buildTab(machinesContainer);
  settingsContainer.insertAdjacentElement('afterend', tab);
  console.log('[Doctor] tab injected ✓');
  syncPanel();
}

ensureTab();

let debounceTimer = null;
const observer = new MutationObserver(() => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(ensureTab, 300);
});
observer.observe(document.body, { childList: true, subtree: true });
