const GATE = chrome.runtime.getURL('gate.html');
const SERVER = 'https://olexiygey.vercel.app';
const LOCK_RULE_ID = 1;

function isGateUrl(url) {
  return url === GATE;
}

function isNewTabUrl(url) {
  return url === 'chrome://newtab' || url === 'chrome://newtab/';
}

async function lockBrowser() {
  await chrome.storage.local.set({ locked: true });
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [LOCK_RULE_ID],
    addRules: [{
      id: LOCK_RULE_ID,
      priority: 1,
      action: { type: 'redirect', redirect: { extensionPath: '/gate.html' } },
      condition: { urlFilter: 'http', resourceTypes: ['main_frame'] }
    }]
  });
}

async function unlockBrowser() {
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [LOCK_RULE_ID] });
  await chrome.storage.local.set({ locked: false });
}

async function showGateTab({ closeOtherTabs = false, reloadGate = false } = {}) {
  const tabs = await chrome.tabs.query({});
  let gateTab = tabs.find(tab => isGateUrl(tab.url) || isGateUrl(tab.pendingUrl));
  const reuseGateTab = Boolean(gateTab);
  if (!gateTab) {
    gateTab = tabs.find(tab => isNewTabUrl(tab.url || tab.pendingUrl));
    if (gateTab?.id != null) await chrome.tabs.update(gateTab.id, { url: GATE });
    else gateTab = await chrome.tabs.create({ url: GATE, active: true });
  }

  const tabsToClose = tabs.filter(tab => {
    if (tab.id === gateTab.id) return false;
    return closeOtherTabs || isNewTabUrl(tab.url || tab.pendingUrl);
  });
  await Promise.all(tabsToClose.map(tab => chrome.tabs.remove(tab.id).catch(() => {})));
  if (reloadGate && reuseGateTab) await chrome.tabs.reload(gateTab.id);
  await chrome.tabs.update(gateTab.id, { active: true });
}

async function enforceTabLock(tabId) {
  const tabs = await chrome.tabs.query({});
  const existingGate = tabs.find(tab => tab.id !== tabId && (isGateUrl(tab.url) || isGateUrl(tab.pendingUrl)));
  if (existingGate?.id != null) {
    await chrome.tabs.remove(tabId).catch(() => {});
    await chrome.tabs.update(existingGate.id, { active: true }).catch(() => {});
    return;
  }

  try {
    await chrome.tabs.update(tabId, { url: GATE });
  } catch {
    const gateTab = await chrome.tabs.create({ url: GATE, active: true });
    await chrome.tabs.remove(tabId).catch(() => {});
    return gateTab;
  }
}

async function lockOnStartup() {
  chrome.alarms.create('session-check', { periodInMinutes: 0.5 });
  await chrome.storage.local.remove('token');
  await lockBrowser();
  await showGateTab({ closeOtherTabs: true, reloadGate: true });
}

async function acknowledgeLock(requestId) {
  if (!requestId) return;
  try {
    await fetch(`${SERVER}/api/lock-ack`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ requestId })
    });
  } catch { /* The server status will remain unconfirmed if this request fails. */ }
}

chrome.tabs.onCreated.addListener(async (tab) => {
  if (tab.id == null || isGateUrl(tab.url) || isGateUrl(tab.pendingUrl)) return;
  const { locked = true } = await chrome.storage.local.get('locked');
  if (locked) {
    try { await enforceTabLock(tab.id); } catch { /* Tab may have closed. */ }
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  const url = changeInfo.url;
  if (!url || isGateUrl(url)) return;
  const { locked = true } = await chrome.storage.local.get('locked');
  if (locked) {
    try { await enforceTabLock(tabId); } catch { /* Tab may have closed. */ }
  }
});

chrome.runtime.onStartup.addListener(lockOnStartup);
chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName !== 'local' || !chrome.extension.inIncognitoContext || changes.locked?.newValue !== true) return;
  try {
    await showGateTab({ closeOtherTabs: true, reloadGate: true });
  } catch { /* Incognito tabs will still be redirected by the dynamic rule. */ }
});
chrome.action.onClicked.addListener(async () => {
  const { locked = true } = await chrome.storage.local.get('locked');
  if (locked) await showGateTab();
});
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await lockOnStartup();
    return;
  }
  chrome.alarms.create('session-check', { periodInMinutes: 0.5 });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'session-check') return;
  const { token } = await chrome.storage.local.get('token');
  if (!token) return;

  try {
    const response = await fetch(`${SERVER}/api/session`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token })
    });
    if (response.status === 401 || response.status === 403) {
      const data = await response.json().catch(() => ({}));
      await chrome.storage.local.remove('token');
      await lockBrowser();
      await showGateTab({ closeOtherTabs: true, reloadGate: true });
      await acknowledgeLock(data.requestId);
    }
  } catch { /* Keep the current state while the control server is unreachable. */ }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'GET_STATUS') {
    chrome.storage.local.get('locked').then(({ locked = true }) => sendResponse({ locked }));
    return true;
  }

  let action;
  if (message?.type === 'UNLOCK') action = unlockBrowser();
  if (message?.type === 'LOCK') {
    action = (async () => {
      await chrome.storage.local.remove('token');
      await lockBrowser();
      await showGateTab({ closeOtherTabs: true, reloadGate: true });
    })();
  }
  if (message?.type === 'OPEN_GATE') action = showGateTab();

  if (action) {
    action.then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
    return true;
  }
});

