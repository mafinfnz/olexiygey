const GATE = chrome.runtime.getURL('gate.html');
const LOCK_RULE_ID = 1;
async function lockBrowser() {
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
}
chrome.runtime.onStartup.addListener(async () => {
  await lockBrowser();
  chrome.alarms.create('session-check', { periodInMinutes: 0.5 });
  await chrome.tabs.create({ url: GATE });
});
chrome.runtime.onInstalled.addListener(async () => {
  await lockBrowser();
  chrome.alarms.create('session-check', { periodInMinutes: 0.5 });
  await chrome.tabs.create({ url: GATE });
});
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'session-check') return;
  const { server, token } = await chrome.storage.local.get(['server', 'token']);
  if (!server || !token) return;
  try {
    const response = await fetch(`${server}/api/session`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token })
    });
    if (!response.ok) {
      await chrome.storage.local.remove('token');
      await lockBrowser();
      await chrome.tabs.create({ url: GATE });
    }
  } catch { /* Keep the current state while the control server is unreachable. */ }
});
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const action = message?.type === 'UNLOCK' ? unlockBrowser() : message?.type === 'LOCK' ? lockBrowser() : null;
  if (action) { action.then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false })); return true; }
});
