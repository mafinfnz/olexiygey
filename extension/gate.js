const $ = (id) => document.getElementById(id);
chrome.storage.local.get(['server','token'], ({server,token}) => {
  $('server').value = server || '';
  if (token && server) fetch(`${server}/api/session`, {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token})})
    .then(async r => { if (r.ok) { await chrome.runtime.sendMessage({type:'UNLOCK'}); location.replace('chrome://newtab'); } else { await chrome.storage.local.remove('token'); } }).catch(()=>{});
});
$('save').onclick = async () => {
  const value = $('server').value.trim().replace(/\/$/, '');
  if (!/^https?:\/\//.test(value)) { $('status').textContent = 'Укажите адрес сервера с http:// или https://'; return; }
  await chrome.storage.local.set({server:value}); $('status').textContent = 'Адрес сохранён.';
};
$('form').onsubmit = async (e) => {
  e.preventDefault();
  const enteredCode = $('code').value.trim();
  if (!/^\d{6}$/.test(enteredCode)) {
    $('status').textContent = 'Введите код из 6 цифр.';
    $('code').setAttribute('aria-invalid', 'true');
    $('code').focus();
    return;
  }
  $('code').removeAttribute('aria-invalid');
  $('status').textContent = 'Проверяю код…';
  const {server} = await chrome.storage.local.get('server');
  if (!server) { $('status').textContent = 'Сначала укажите адрес сервера.'; return; }
  try {
    const r = await fetch(`${server}/api/verify`, {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:enteredCode})});
    const data = await r.json(); if (!r.ok) throw new Error(data.error || 'Код не подошёл');
    await chrome.storage.local.set({token:data.token});
    await chrome.runtime.sendMessage({type:'UNLOCK'});
    $('status').textContent = 'Доступ открыт. Теперь поиск и сайты доступны.';
  } catch(err) { $('status').textContent = err.message === 'Failed to fetch' ? 'Нет связи с сервером.' : err.message; }
};
