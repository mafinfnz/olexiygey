const $ = (id) => document.getElementById(id);
const SERVER = 'https://olexiygey.vercel.app';
const codeInput = $('code');
const motion = window.CodeGateMotion;
const setStatus = (message, state) => {
  if (motion) motion.setStatus($('status'), message, state);
  else $('status').textContent = message;
};

motion?.enter(document.querySelector('.access'), 'h1, .intro, form, #status, .footnote');
document.querySelectorAll('button').forEach((button) => button.addEventListener('pointerdown', () => motion?.pulse(button)));

codeInput.addEventListener('input', () => {
  const digitsOnly = codeInput.value.replace(/\D/g, '').slice(0, 6);
  if (codeInput.value !== digitsOnly) codeInput.value = digitsOnly;
});

$('form').onsubmit = async (e) => {
  e.preventDefault();
  const enteredCode = codeInput.value;
  if (!/^\d{6}$/.test(enteredCode)) {
    setStatus('Введите код из 6 цифр.', 'error');
    $('code').setAttribute('aria-invalid', 'true');
    $('code').focus();
    return;
  }
  $('code').removeAttribute('aria-invalid');
  setStatus('Проверяю код…', 'neutral');
  try {
    const r = await fetch(`${SERVER}/api/verify`, {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:enteredCode})});
    const data = await r.json(); if (!r.ok) throw new Error(data.error || 'Код не подошёл');
    await chrome.storage.local.set({token:data.token});
    await chrome.runtime.sendMessage({type:'UNLOCK'});
    setStatus('Доступ открыт. Теперь поиск и сайты доступны.', 'success');
  } catch(err) { setStatus(err.message === 'Failed to fetch' ? 'Нет связи с сервером.' : /invalid or expired code/i.test(err.message) ? 'Неправильный код' : err.message, 'error'); }
};
