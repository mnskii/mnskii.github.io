/* Shared by the app and the OAuth return page. Never sends Google cookies. */
window.lsExternalRpc=async function(method,...args){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),120000);
  try{
    const response=await fetch("https://script.google.com/macros/s/AKfycbz9OPnIPn70XBgsrEuZ_xjb0FsQ_0wmZ4YrlZanr6GjhcFWMD-JQHPRYRS3ospHRlgH/exec",{method:'POST',mode:'cors',credentials:'omit',redirect:'follow',referrerPolicy:'no-referrer',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({method,args}),signal:controller.signal});
    if(!response.ok)throw Error('O servidor não respondeu. Tente novamente.');
    const data=await response.json();
    if(!data||typeof data.ok!=='boolean')throw Error('Resposta inválida do servidor.');
    if(!data.ok)throw Error(data.error||'Não foi possível concluir a operação.');
    return data.result;
  }catch(error){
    if(error.name==='AbortError')throw Error('Tempo esgotado. Confira se a operação foi concluída antes de tentar novamente.');
    if(error instanceof TypeError)throw Error('Não foi possível conectar ao servidor. Verifique a conexão e tente novamente.');
    throw error;
  }finally{clearTimeout(timer);}
};
