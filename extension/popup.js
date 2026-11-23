const status = document.getElementById('status');
const action = document.getElementById('action');

async function refresh() {
  const { locked = true } = await chrome.storage.local.get('locked');
  status.dataset.locked = String(locked);
  status.textContent = locked ? 'Браузер заблокирован.' : 'Браузер разблокирован.';
  action.textContent = locked ? 'Открыть экран входа' : 'Заблокировать браузер';
  action.dataset.command = locked ? 'OPEN_GATE' : 'LOCK';
  action.disabled = false;
}

action.addEventListener('click', async () => {
  action.disabled = true;
  await chrome.runtime.sendMessage({ type: action.dataset.command });
  await refresh();
  if (action.dataset.command === 'OPEN_GATE') window.close();
});

refresh().catch(() => {
  status.textContent = 'Не удалось получить состояние.';
  action.textContent = 'Повторить';
});
