const $ = (id) => document.getElementById(id);
const SERVER = 'https://olexiygey.vercel.app';
const codeInput = $('code');

codeInput.addEventListener('input', () => {
  const digitsOnly = codeInput.value.replace(/\D/g, '').slice(0, 6);
  if (codeInput.value !== digitsOnly) codeInput.value = digitsOnly;
});

async function restoreExistingSession() {
  try {
    const {token} = await chrome.storage.local.get('token');
    if (!token) return;

    const response = await fetch(`${SERVER}/api/session`, {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({token})
    });
    if (!response.ok) {
      await chrome.storage.local.remove('token');
      return;
    }

    const result = await chrome.runtime.sendMessage({type: 'UNLOCK'});
    if (!result?.ok) throw new Error('Не удалось восстановить доступ.');

    const currentTab = await chrome.tabs.getCurrent();
    await chrome.tabs.create({active: true});
    if (currentTab?.id != null) await chrome.tabs.remove(currentTab.id);
  } catch {
    $('status').textContent = 'Не удалось восстановить доступ. Введите код ещё раз.';
  }
}

restoreExistingSession();
$('form').onsubmit = async (e) => {
  e.preventDefault();
  const enteredCode = codeInput.value;
  if (!/^\d{6}$/.test(enteredCode)) {
    $('status').textContent = 'Введите код из 6 цифр.';
    $('code').setAttribute('aria-invalid', 'true');
    $('code').focus();
    return;
  }
  $('code').removeAttribute('aria-invalid');
  $('status').textContent = 'Проверяю код…';
  try {
    const r = await fetch(`${SERVER}/api/verify`, {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:enteredCode})});
    const data = await r.json(); if (!r.ok) throw new Error(data.error || 'Код не подошёл');
    await chrome.storage.local.set({token:data.token});
    await chrome.runtime.sendMessage({type:'UNLOCK'});
    $('status').textContent = 'Доступ открыт. Теперь поиск и сайты доступны.';
  } catch(err) { $('status').textContent = err.message === 'Failed to fetch' ? 'Нет связи с сервером.' : /invalid or expired code/i.test(err.message) ? 'Неправильный код' : err.message; }
};

