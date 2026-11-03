/**
 * Treinador de Canto — proxy privado para YouTube Data API v3
 *
 * Configure em Apps Script > Configurações do projeto > Propriedades do script:
 * YOUTUBE_API_KEY = sua chave restrita do YouTube Data API v3
 *
 * Implante como Aplicativo da Web:
 * Executar como: Eu
 * Quem pode acessar: Qualquer pessoa
 *
 * O navegador chama este endpoint via JSONP para evitar bloqueio CORS.
 */
function doGet(e) {
  var callback = String((e && e.parameter && e.parameter.callback) || '');
  if (!/^cantoYt_[A-Za-z0-9_]+$/.test(callback)) {
    return ContentService.createTextOutput('Callback inválido.')
      .setMimeType(ContentService.MimeType.TEXT);
  }

  var query = String((e && e.parameter && e.parameter.q) || '').trim();
  if (!query) return jsonp_(callback, { error: 'Digite o título da música.' });
  if (query.length > 180) query = query.slice(0, 180);

  var cache = CacheService.getScriptCache();
  var cacheKey = 'yt_' + Utilities.base64EncodeWebSafe(query.toLowerCase());
  var cached = cache.get(cacheKey);
  if (cached) return jsonp_(callback, JSON.parse(cached));

  var apiKey = PropertiesService.getScriptProperties().getProperty('YOUTUBE_API_KEY');
  if (!apiKey) return jsonp_(callback, { error: 'A chave do YouTube ainda não foi configurada no servidor.' });

  try {
    var url = 'https://www.googleapis.com/youtube/v3/search?' +
      'part=snippet&type=video&videoEmbeddable=true&maxResults=8&q=' +
      encodeURIComponent(query) + '&key=' + encodeURIComponent(apiKey);
    var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var status = response.getResponseCode();
    var body = JSON.parse(response.getContentText());

    if (status < 200 || status >= 300) {
      var message = body && body.error && body.error.message
        ? body.error.message : 'Erro ao consultar o YouTube.';
      return jsonp_(callback, { error: message });
    }

    var items = (body.items || []).filter(function(item) {
      return item.id && item.id.videoId && item.snippet;
    }).map(function(item) {
      return {
        id: { videoId: item.id.videoId },
        snippet: {
          title: item.snippet.title,
          channelTitle: item.snippet.channelTitle,
          thumbnails: item.snippet.thumbnails
        }
      };
    });

    var result = { items: items };
    cache.put(cacheKey, JSON.stringify(result), 600);
    return jsonp_(callback, result);
  } catch (err) {
    return jsonp_(callback, { error: 'Erro interno na pesquisa. Tente novamente.' });
  }
}

function jsonp_(callback, data) {
  var safe = JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
  return ContentService.createTextOutput(callback + '(' + safe + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

/** Teste opcional: mostra se a propriedade privada está cadastrada. */
function testarConfiguracao() {
  var key = PropertiesService.getScriptProperties().getProperty('YOUTUBE_API_KEY');
  Logger.log(key ? 'Chave configurada.' : 'Chave ainda não configurada.');
}