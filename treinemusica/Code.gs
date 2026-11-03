/**
 * Treine Música — proxy privado para YouTube Data API v3 e Last.fm.
 *
 * Propriedades do script:
 * YOUTUBE_API_KEY
 * LASTFM_API_KEY
 * LASTFM_SHARED_SECRET
 *
 * Implantação: Aplicativo da Web / Executar como: Eu / Acesso: Qualquer pessoa.
 */
function doGet(e) {
  var p = (e && e.parameter) || {};
  var callback = String(p.callback || '');
  if (!/^(cantoYt|treineLastfm)_[A-Za-z0-9_]+$/.test(callback)) {
    return ContentService.createTextOutput('Callback inválido.')
      .setMimeType(ContentService.MimeType.TEXT);
  }

  var action = String(p.action || '');
  if (action.indexOf('lastfm_') === 0) {
    try {
      var result = handleLastfm_(action, p);
      return jsonp_(callback, result);
    } catch (err) {
      return jsonp_(callback, { error: err && err.message ? err.message : 'Erro na integração Last.fm.' });
    }
  }

  var query = String(p.q || '').trim();
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

function handleLastfm_(action, p) {
  var props = PropertiesService.getScriptProperties();
  var apiKey = props.getProperty('LASTFM_API_KEY');
  var secret = props.getProperty('LASTFM_SHARED_SECRET');
  if (!apiKey || !secret) throw new Error('Configure LASTFM_API_KEY e LASTFM_SHARED_SECRET nas propriedades do Apps Script.');

  if (action === 'lastfm_config') return { apiKey: apiKey };

  if (action === 'lastfm_session') {
    var token = String(p.token || '');
    if (!token || token.length > 300) throw new Error('Token de autorização ausente ou inválido.');
    var session = lastfmCall_('auth.getSession', { token: token }, apiKey, secret, false);
    if (!session.session || !session.session.key) throw new Error('O Last.fm não retornou uma sessão válida.');
    return { sessionKey: session.session.key, username: session.session.name };
  }

  var sessionKey = String(p.sk || '');
  if (!sessionKey || sessionKey.length > 500) throw new Error('Vincule sua conta Last.fm primeiro.');

  if (action === 'lastfm_nowplaying' || action === 'lastfm_scrobble') {
    var artist = String(p.artist || '').trim().slice(0, 200);
    var track = String(p.track || '').trim().slice(0, 200);
    if (!artist || !track) throw new Error('Informe artista e título da música.');
    var params = { artist: artist, track: track, sk: sessionKey };
    if (p.album) params.album = String(p.album).slice(0, 200);
    if (p.duration && /^\d+$/.test(String(p.duration))) params.duration = String(p.duration);
    if (action === 'lastfm_scrobble') {
      var timestamp = String(p.timestamp || '');
      if (!/^\d{9,12}$/.test(timestamp)) throw new Error('Horário do scrobble inválido.');
      params.timestamp = timestamp;
    }
    var method = action === 'lastfm_nowplaying' ? 'track.updateNowPlaying' : 'track.scrobble';
    lastfmCall_(method, params, apiKey, secret, true);
    return { ok: true, action: action };
  }
  throw new Error('Ação Last.fm desconhecida.');
}

function lastfmCall_(method, params, apiKey, secret, useSession) {
  var all = Object.assign({}, params, { method: method, api_key: apiKey });
  var keys = Object.keys(all).sort();
  var signatureText = keys.map(function(k) { return k + all[k]; }).join('') + secret;
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, signatureText, Utilities.Charset.UTF_8);
  var signature = digest.map(function(b) {
    var n = (b + 256) % 256;
    return ('0' + n.toString(16)).slice(-2);
  }).join('');
  all.api_sig = signature;
  all.format = 'json';
  var response = UrlFetchApp.fetch('https://ws.audioscrobbler.com/2.0/', {
    method: 'post',
    payload: all,
    muteHttpExceptions: true
  });
  var status = response.getResponseCode();
  var body = JSON.parse(response.getContentText() || '{}');
  if (status < 200 || status >= 300 || body.error) {
    throw new Error(body.message || body.error || 'O Last.fm não aceitou a solicitação.');
  }
  return body;
}

function jsonp_(callback, data) {
  var safe = JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
  return ContentService.createTextOutput(callback + '(' + safe + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function testarConfiguracao() {
  var p = PropertiesService.getScriptProperties();
  Logger.log('YouTube: ' + (p.getProperty('YOUTUBE_API_KEY') ? 'configurado' : 'ausente'));
  Logger.log('Last.fm API Key: ' + (p.getProperty('LASTFM_API_KEY') ? 'configurada' : 'ausente'));
  Logger.log('Last.fm Shared Secret: ' + (p.getProperty('LASTFM_SHARED_SECRET') ? 'configurado' : 'ausente'));
}
