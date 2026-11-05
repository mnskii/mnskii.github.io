(async () => {
  'use strict';
  const query = new URLSearchParams(location.search);
  history.replaceState(null, '', location.pathname);
  const status = document.getElementById('status');
  const state = query.get('state') || '';
  const code = query.get('code');
  const error = query.get('error');
  const invalid = query.getAll('state').length !== 1 || !/^[a-f0-9]{64}$/.test(state) ||
    query.getAll('code').length > 1 || query.getAll('error').length > 1 ||
    (code !== null) === (error !== null) ||
    (code !== null && (!code || code.length > 4096 || /[\x00-\x20\x7f]/.test(code))) ||
    (error !== null && !/^[a-zA-Z0-9_]{1,100}$/.test(error));
  if (invalid) { status.textContent = 'Este retorno não é válido. Abra o aplicativo e inicie uma nova conexão com o Drive.'; return; }
  status.textContent = 'Concluindo a conexão com o Drive…';
  try {
    const result=await window.lsExternalRpc('completeDriveConnection',{state,...(code!==null?{code}:{error})});
    status.textContent=result.message;
  } catch (error) { status.textContent=error.message+' Abra o aplicativo para verificar a conexão do Drive.'; }
})();