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

async function showGateTab() {
  const tabs = await chrome.tabs.query({});
  const existingGate = tabs.find(tab => isGateUrl(tab.url) || isGateUrl(tab.pendingUrl));
  if (existingGate?.id != null) {
    await Promise.all(tabs
      .filter(tab => tab.id !== existingGate.id && isNewTabUrl(tab.url || tab.pendingUrl))
      .map(tab => chrome.tabs.remove(tab.id).catch(() => {})));
    await chrome.tabs.update(existingGate.id, { active: true });
    return;
  }

  const newTabs = tabs.filter(tab => isNewTabUrl(tab.url || tab.pendingUrl));
  const newTab = newTabs[0];
  if (newTab?.id != null) {
    await chrome.tabs.update(newTab.id, { url: GATE, active: true });
    await Promise.all(newTabs.slice(1).map(tab => chrome.tabs.remove(tab.id).catch(() => {})));
    return;
  }

  await chrome.tabs.create({ url: GATE });
}

async function restoreSession() {
  const { token, locked = true } = await chrome.storage.local.get(['token', 'locked']);
  if (!token) {
    await lockBrowser();
    return false;
  }

  try {
    const response = await fetch(`${SERVER}/api/session`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token })
    });

    if (response.ok) {
      await unlockBrowser();
      return true;
    }

    if (response.status === 401 || response.status === 403) {
      await chrome.storage.local.remove('token');
      await lockBrowser();
      return false;
    }
  } catch { /* Keep the last local state while the control server is unreachable. */ }

  if (locked) await lockBrowser();
  else await unlockBrowser();
  return !locked;
}

async function prepareBrowser() {
  chrome.alarms.create('session-check', { periodInMinutes: 0.5 });
  const unlocked = await restoreSession();
  if (!unlocked) await showGateTab();
}

chrome.tabs.onCreated.addListener(async (tab) => {
  if (tab.id == null || isGateUrl(tab.url) || isGateUrl(tab.pendingUrl)) return;
  const { locked = true } = await chrome.storage.local.get('locked');
  if (locked) {
    try {
      const tabs = await chrome.tabs.query({});
      const existingGate = tabs.find(item => item.id !== tab.id && (isGateUrl(item.url) || isGateUrl(item.pendingUrl)));
      if (existingGate?.id != null) {
        await chrome.tabs.remove(tab.id);
        await chrome.tabs.update(existingGate.id, { active: true });
      } else {
        await chrome.tabs.update(tab.id, { url: GATE });
      }
    } catch { /* Tab may have closed. */ }
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  const url = changeInfo.url || tab.pendingUrl || tab.url;
  if (!isNewTabUrl(url)) return;
  const { locked = true } = await chrome.storage.local.get('locked');
  if (locked) {
    try {
      const tabs = await chrome.tabs.query({});
      const existingGate = tabs.find(item => item.id !== tabId && (isGateUrl(item.url) || isGateUrl(item.pendingUrl)));
      if (existingGate?.id != null) {
        await chrome.tabs.remove(tabId);
        await chrome.tabs.update(existingGate.id, { active: true });
      } else {
        await chrome.tabs.update(tabId, { url: GATE });
      }
    } catch { /* Tab may have closed. */ }
  }
});

chrome.runtime.onStartup.addListener(prepareBrowser);
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await lockBrowser();
    chrome.alarms.create('session-check', { periodInMinutes: 0.5 });
    await showGateTab();
    return;
  }
  await prepareBrowser();
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
      await chrome.storage.local.remove('token');
      await lockBrowser();
      await showGateTab();
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
      await showGateTab();
    })();
  }
  if (message?.type === 'OPEN_GATE') action = showGateTab();

  if (action) {
    action.then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
    return true;
  }
});
