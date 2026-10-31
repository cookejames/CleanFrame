/* Unsplash adapter: photo selection, hotlinked image sizes and download tracking. */
(function () {
  'use strict';
  var API = 'https://api.unsplash.com/', IMAGES = 'https://images.unsplash.com/';
  var IDEAL_WIDTH = 3840, MIN_WIDTH = 2560, MIN_RATIO = 1.4, MAX_RATIO = 2, TIMEOUT = 10000;
  // Server-side blur keeps the TV free of live blur, as the bundled materials do.
  var BLUR = { soft: 120, frost: 220, tint: 10 };
  var config = window.CleanFrameUnsplash || {};

  function request(url, done) {
    var xhr = new XMLHttpRequest(), ended = false;
    function finish(status, body) { if (!ended) { ended = true; done(status, body); } }
    xhr.open('GET', url);
    xhr.timeout = TIMEOUT;
    xhr.setRequestHeader('Accept-Version', 'v1');
    xhr.setRequestHeader('Authorization', 'Client-ID ' + config.accessKey);
    xhr.onload = function () { finish(xhr.status, xhr.responseText); };
    xhr.onerror = xhr.ontimeout = xhr.onabort = function () { finish(0, ''); };
    xhr.send();
  }
  function valid(p) {
    return !!p && typeof p.id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(p.id)
      && typeof p.raw === 'string' && p.raw.indexOf(IMAGES) === 0
      && typeof p.user === 'string' && p.user.length > 0
      && typeof p.download === 'string' && p.download.indexOf(API) === 0;
  }
  function fromApi(item) {
    return item && item.urls && item.user && item.links ? { id: item.id, raw: item.urls.raw, user: item.user.name, download: item.links.download_location, width: item.width, height: item.height } : null;
  }
  function usable(p, minWidth) {
    var ratio = p.width / p.height;
    return p.width >= minWidth && ratio >= MIN_RATIO && ratio <= MAX_RATIO;
  }
  function choose(items, exclude) {
    var photos = (Array.isArray(items) ? items : []).map(fromApi).filter(function (p) { return valid(p) && p.id !== exclude; });
    var best = photos.filter(function (p) { return usable(p, IDEAL_WIDTH); });
    if (!best.length) best = photos.filter(function (p) { return usable(p, MIN_WIDTH); });
    return best.length ? best[Math.floor(Math.random() * best.length)] : null;
  }
  function random(keyword, exclude, done) {
    if (!config.accessKey) { done({ reason: 'key' }); return; }
    request(API + 'photos/random?count=10&orientation=landscape&content_filter=high&query=' + encodeURIComponent(keyword), function (status, body) {
      var items, photo;
      if (status === 401) { done({ reason: 'key' }); return; }
      if (status === 403 || status === 429) { done({ reason: 'limit' }); return; }
      if (status === 404) { done({ reason: 'none' }); return; }
      if (status !== 200) { done({ reason: 'network' }); return; }
      try { items = JSON.parse(body); } catch (e) { done({ reason: 'network' }); return; }
      photo = choose(items, exclude);
      if (photo) done(null, photo); else done({ reason: 'none' });
    });
  }
  function size(photo, width, height, quality, blur) {
    return photo.raw + (photo.raw.indexOf('?') < 0 ? '?' : '&') + 'w=' + width + '&h=' + height + '&fit=crop&fm=jpg&q=' + quality + (blur ? '&blur=' + blur : '');
  }
  // Every variant shares the centred 16:9 crop, so materials stay aligned with the photo.
  function src(photo, kind) {
    var screenWidth = Math.round((window.screen && window.screen.width || 1920) * (window.devicePixelRatio || 1));
    var width = Math.max(1920, Math.min(IDEAL_WIDTH, screenWidth));
    if (kind === 'full') return size(photo, width, Math.round(width * 9 / 16), 85);
    if (kind === 'panel') return size(photo, 640, 360, 80, BLUR.frost);
    if (kind === 'thumb') return size(photo, 256, 144, 80);
    return size(photo, 1920, 1080, 80, BLUR[kind] || BLUR.frost);
  }
  // Unsplash asks API clients to report when a photo is put to use.
  function track(photo) { if (config.accessKey) request(photo.download, function () {}); }

  window.FrameUnsplash = { available: function () { return !!config.accessKey; }, random: random, src: src, track: track, valid: valid };
})();
