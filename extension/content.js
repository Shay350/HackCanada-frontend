const TAB_ID = 'server-monitor-tab';
const TAB_LABEL = 'Server Monitor';
const backendApiBase = 'http://127.0.0.1:8000';

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

function normalizeText(value) {
  return (value || '').trim().toLowerCase();
}

function getPageBg() {
  const raw = getComputedStyle(document.body).backgroundColor;
  const m = raw.match(/\d+/g);
  if (m && m.length >= 3) {
    return '#'
      + m
        .slice(0, 3)
        .map((n) => (+n).toString(16).padStart(2, '0'))
        .join('');
  }
  return '#111111';
}

function getNavLinks() {
  const scoped = [
    ...document.querySelectorAll('nav a[href], [role="navigation"] a[href]'),
  ];

  if (scoped.length > 0) {
    return scoped;
  }

  return [...document.querySelectorAll('a[href]')].filter((anchor) => {
    const href = normalizeText(anchor.getAttribute('href'));
    return href.includes('admin') || href.includes('machines') || href.includes('settings');
  });
}

function findSettingsTab() {
  return getNavLinks().find((anchor) => {
    const href = normalizeText(anchor.getAttribute('href'));
    const text = normalizeText(anchor.textContent);
    return href.includes('/admin/settings') || href.includes('/settings') || text === 'settings';
  }) || null;
}

function findTemplateTab() {
  return getNavLinks().find((anchor) => {
    const href = normalizeText(anchor.getAttribute('href'));
    const text = normalizeText(anchor.textContent);
    return href.includes('/admin/machines')
      || href.includes('/machines')
      || text === 'machines'
      || text === 'devices';
  }) || getNavLinks()[0] || null;
}

function positionIframe(refEl) {
  const nav = refEl.closest('nav')
    || refEl.closest('[role="navigation"]')
    || refEl.parentElement;

  if (!nav) {
    iframe.style.top = '0';
    iframe.style.height = '100vh';
    return;
  }

  const bottom = nav.getBoundingClientRect().bottom;
  iframe.style.top = `${bottom}px`;
  iframe.style.height = `calc(100vh - ${bottom}px)`;
  iframe.style.background = getPageBg();
}

function setTabLabel(tab) {
  const walker = document.createTreeWalker(tab, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    if (walker.currentNode.textContent.trim()) {
      walker.currentNode.textContent = TAB_LABEL;
      return;
    }
  }

  const label = document.createElement('span');
  label.textContent = TAB_LABEL;
  tab.appendChild(label);
}

function buildTab(templateTab) {
  const tab = templateTab.cloneNode(true);
  tab.removeAttribute('href');
  tab.removeAttribute('aria-current');
  tab.id = TAB_ID;
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

  setTabLabel(tab);

  tab.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    active = !active;

    if (active) {
      iframe.src = `${chrome.runtime.getURL('index.html')}?embedded=true&bg=${encodeURIComponent(getPageBg())}&apiBase=${encodeURIComponent(backendApiBase)}`;
      positionIframe(tab);
      iframe.style.display = 'block';
      tab.setAttribute('aria-current', 'page');

      const liveActive = document.querySelector('a[aria-current="page"]');
      const activeColor = liveActive ? getComputedStyle(liveActive).color : '#60a5fa';
      tab.style.setProperty('color', activeColor, 'important');
      return;
    }

    iframe.style.display = 'none';
    tab.removeAttribute('aria-current');
    tab.style.removeProperty('color');
  });

  document.addEventListener('click', (e) => {
    if (!active || !(e.target instanceof Element)) {
      return;
    }

    const clicked = e.target.closest('nav a[href], [role="navigation"] a[href]');
    if (clicked && clicked.id !== TAB_ID) {
      active = false;
      iframe.style.display = 'none';
      tab.removeAttribute('aria-current');
      tab.style.removeProperty('color');
    }
  });

  window.addEventListener('resize', () => {
    if (active) {
      positionIframe(tab);
    }
  });

  return tab;
}

function ensureTab() {
  const anchorTab = findSettingsTab() || findTemplateTab();
  const templateTab = findTemplateTab();

  if (!anchorTab || !templateTab) {
    return;
  }

  const existingTab = document.getElementById(TAB_ID);

  if (existingTab) {
    if (anchorTab.nextElementSibling !== existingTab) {
      anchorTab.insertAdjacentElement('afterend', existingTab);
    }
    return;
  }

  const tab = buildTab(templateTab);
  anchorTab.insertAdjacentElement('afterend', tab);
  console.log('[ServerMonitor] tab injected');
}

ensureTab();
const observer = new MutationObserver(ensureTab);
observer.observe(document.body, { childList: true, subtree: true });
