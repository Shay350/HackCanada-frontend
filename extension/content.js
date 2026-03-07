const API_BASE = 'http://127.0.0.1:8000';
const DOCTOR_PATH = '/admin/doctor';
const HIDDEN_ATTR = 'data-doctor-hidden';
const PREV_DISPLAY_ATTR = 'data-doctor-prev-display';

const nativePush = History.prototype.pushState.bind(history);
const nativeReplace = History.prototype.replaceState.bind(history);

const iframe = document.createElement('iframe');
iframe.id = 'doctor-panel';
let iframeLoaded = false;

iframe.style.cssText = `
  width: 100%;
  border: none;
  display: none;
  background: #111111;
`;

document.body.appendChild(iframe);

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

function getMainContainer() {
  return document.querySelector('main') || document.querySelector('[role="main"]');
}

function hideMainContent(main) {
  if (!main) return;
  for (const child of main.children) {
    if (!(child instanceof HTMLElement) || child === iframe) continue;
    if (!child.hasAttribute(HIDDEN_ATTR)) {
      child.setAttribute(HIDDEN_ATTR, 'true');
      child.setAttribute(PREV_DISPLAY_ATTR, child.style.display || '');
    }
    child.style.display = 'none';
  }
}

function restoreMainContent() {
  const hiddenNodes = document.querySelectorAll(`[${HIDDEN_ATTR}="true"]`);
  hiddenNodes.forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    node.style.display = node.getAttribute(PREV_DISPLAY_ATTR) || '';
    node.removeAttribute(HIDDEN_ATTR);
    node.removeAttribute(PREV_DISPLAY_ATTR);
  });
}

function stealActiveFromNav() {
  const activeTabs = document.querySelectorAll('a[href*="/admin/"][aria-current="page"]:not(#doctor-tab):not(#doctor-tab *)');
  activeTabs.forEach(el => el.removeAttribute('aria-current'));
}

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

function syncPanel() {

  if (isOnDoctorPage()) {

    const main = getMainContainer();
    const bottom = getNavBottom();
    const availableHeight = Math.max(window.innerHeight - bottom, 480);
    const bg = getPageBg();

    if (main && iframe.parentElement !== main) {
      main.appendChild(iframe);
    }

    hideMainContent(main);

    iframe.style.width = main ? '100%' : '100vw';
    iframe.style.height = `${availableHeight}px`;
    iframe.style.background = bg;
    iframe.style.display = 'block';

    if (!iframeLoaded) {
      iframeLoaded = true;
      iframe.src =
        chrome.runtime.getURL('index.html')
        + '?embedded=true'
        + '&apiBase=' + encodeURIComponent(API_BASE)
        + '&bg=' + encodeURIComponent(bg);
    }

    // Remove aria-current from real tabs
    stealActiveFromNav();
    setTimeout(stealActiveFromNav, 50);

    // Read active styling from a real tab BEFORE stealing aria-current
    const liveActive = document.querySelector('a[href*="/admin/"][aria-current="page"]:not(#doctor-tab):not(#doctor-tab *)');
    const activeColor = liveActive ? getComputedStyle(liveActive).color : '#3b82f6';
    const activeClasses = liveActive ? Array.from(liveActive.classList) : [];

    const tab = document.getElementById('doctor-tab');

    if (tab) {

      const innerA = tab.tagName === 'A' ? tab : tab.querySelector('a');

      if (innerA) {

        innerA.setAttribute('aria-current', 'page');

        if (activeClasses.length) {
          innerA.dataset.doctorPrevClass = innerA.className;
          activeClasses.forEach(cls => innerA.classList.add(cls));
        }

        innerA.style.setProperty('color', activeColor, 'important');
      }

      tab.style.setProperty('border-bottom', `2px solid ${activeColor}`, 'important');
      tab.style.setProperty('box-sizing', 'border-box', 'important');
    }

  } else {

    iframe.style.display = 'none';
    restoreMainContent();

    const tab = document.getElementById('doctor-tab');

    if (tab) {

      const innerA = tab.tagName === 'A' ? tab : tab.querySelector('a');

      if (innerA) {

        innerA.removeAttribute('aria-current');

        if (innerA.dataset.doctorPrevClass !== undefined) {
          innerA.className = innerA.dataset.doctorPrevClass;
          delete innerA.dataset.doctorPrevClass;
        }

        innerA.style.removeProperty('color');
      }

      tab.style.removeProperty('border-bottom');
      tab.style.removeProperty('box-sizing');
    }
  }
}

const origPush = history.pushState.bind(history);
const origReplace = history.replaceState.bind(history);

history.pushState = (...args) => { origPush(...args); syncPanel(); };
history.replaceState = (...args) => { origReplace(...args); syncPanel(); };

window.addEventListener('popstate', syncPanel);

window.addEventListener('resize', () => {

  if (!isOnDoctorPage()) return;

  const main = getMainContainer();

  if (main && iframe.parentElement !== main) {
    main.appendChild(iframe);
  }

  hideMainContent(main);

  const bottom = getNavBottom();
  const availableHeight = Math.max(window.innerHeight - bottom, 480);

  iframe.style.height = `${availableHeight}px`;
});

function buildTab(templateContainer) {

  const tab = templateContainer.cloneNode(true);

  tab.id = 'doctor-tab';
  tab.style.cursor = 'pointer';

  tab.removeAttribute('aria-current');
  tab.querySelectorAll('[aria-current]').forEach(el => el.removeAttribute('aria-current'));

  const innerA = tab.tagName === 'A' ? tab : tab.querySelector('a');

  if (innerA) innerA.href = DOCTOR_PATH;

  const svg = tab.querySelector('svg');

  if (svg) {
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '16');
    svg.setAttribute('height', '16');
    svg.innerHTML = `<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>`;
  }

  const walker = document.createTreeWalker(tab, NodeFilter.SHOW_TEXT);

  while (walker.nextNode()) {
    if (walker.currentNode.textContent.trim()) {
      walker.currentNode.textContent = 'Doctor';
      break;
    }
  }

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

  debounceTimer = setTimeout(() => {

    ensureTab();
    syncPanel();

  }, 300);

});

observer.observe(document.body, { childList: true, subtree: true });