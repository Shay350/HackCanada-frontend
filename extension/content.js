const iframe = document.createElement('iframe');
iframe.id = 'self-healing-panel';
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

let active = false;
let ourTab = null;
const backendApiBase = 'http://127.0.0.1:8000';

function getPageBg() {
  const raw = getComputedStyle(document.body).backgroundColor;
  const m = raw.match(/\d+/g);
  if (m && m.length >= 3) {
    return '#' + m.slice(0, 3).map(n => (+n).toString(16).padStart(2, '0')).join('');
  }
  return '#111111';
}

function positionIframe(refEl) {
  const nav = refEl.closest('nav') || refEl.parentElement;
  const bottom = nav.getBoundingClientRect().bottom;
  iframe.style.top = bottom + 'px';
  iframe.style.height = `calc(100vh - ${bottom}px)`;
  iframe.style.background = getPageBg();
}

function findSettingsTab() {
  return document.querySelector('a[href*="/admin/settings"]')
    || [...document.querySelectorAll('a[href*="/admin/"]')].find(a =>
        a.textContent.trim().toLowerCase() === 'settings'
      );
}

function findMachinesTab() {
  return document.querySelector('a[href*="/admin/machines"]')
    || [...document.querySelectorAll('a[href*="/admin/"]')][0];
}

function buildTab(templateTab) {
  const tab = templateTab.cloneNode(true);
  tab.removeAttribute('href');
  tab.removeAttribute('aria-current');
  tab.id = 'server-monitor-tab';
  tab.style.cursor = 'pointer';

  const svgEl = tab.querySelector('svg');
  if (svgEl) {
    svgEl.setAttribute('viewBox', '0 0 24 24');
    svgEl.setAttribute('width', '16');
    svgEl.setAttribute('height', '16');
    svgEl.innerHTML = `
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
      <line x1="8" y1="21" x2="16" y2="21"/>
      <line x1="12" y1="17" x2="12" y2="21"/>
    `;
  }

  const walker = document.createTreeWalker(tab, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    if (walker.currentNode.textContent.trim()) {
      walker.currentNode.textContent = 'ServerMonitor';
      break;
    }
  }

  tab.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    active = !active;

    if (active) {
      iframe.src = chrome.runtime.getURL('index.html')
        + '?embedded=true'
        + '&bg=' + encodeURIComponent(getPageBg())
        + '&apiBase=' + encodeURIComponent(backendApiBase);
      positionIframe(templateTab);
      iframe.style.display = 'block';
      tab.setAttribute('aria-current', 'page');
      const liveActive = document.querySelector('a[href*="/admin/"][aria-current="page"]');
      const activeColor = liveActive ? getComputedStyle(liveActive).color : '#60a5fa';
      tab.style.setProperty('color', activeColor, 'important');
    } else {
      iframe.style.display = 'none';
      tab.removeAttribute('aria-current');
      tab.style.removeProperty('color');
    }
  });

  document.addEventListener('click', (e) => {
    if (!active) return;
    const clicked = e.target.closest('a[href*="/admin/"]');
    if (clicked && clicked.id !== 'server-monitor-tab') {
      active = false;
      iframe.style.display = 'none';
      tab.removeAttribute('aria-current');
      tab.style.removeProperty('color');
    }
  });

  window.addEventListener('resize', () => {
    if (active) positionIframe(templateTab);
  });

  return tab;
}

function ensureTab() {
  const settingsTab = findSettingsTab();
  if (!settingsTab) return;

  const existingTab = document.getElementById('server-monitor-tab');

  // Already in the right spot — directly after Settings
  if (existingTab && settingsTab.nextElementSibling === existingTab) return;

  // Exists but drifted — move it back right after Settings
  if (existingTab) {
    settingsTab.insertAdjacentElement('afterend', existingTab);
    return;
  }

  // Doesn't exist yet — build and insert
  const templateTab = findMachinesTab();
  if (!templateTab) return;

  ourTab = buildTab(templateTab);
  settingsTab.insertAdjacentElement('afterend', ourTab);
  console.log('[ServerMonitor] tab injected ✓');
}

ensureTab();

let debounceTimer = null;
const observer = new MutationObserver(() => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(ensureTab, 300);
});
observer.observe(document.body, { childList: true, subtree: true });
