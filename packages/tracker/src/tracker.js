/**
 * Alora first-party AI traffic tracker.
 *
 * Embedded on customer websites. Fires only when the visitor arrived from an AI
 * chat interface, either by referrer or by a tagged utm_source; ordinary traffic
 * is never reported. The server resolves which provider the visit belongs to and
 * decides whether a request is a crawler, so this script only reports raw signals.
 *
 * Every failure path is swallowed: a tracker must never break the host page.
 */
(function () {
  'use strict';

  var TRACKER_VERSION = 'v1';

  /** Referrer hosts, matched as an exact host or a subdomain of it. */
  var AI_HOSTS = [
    'chatgpt.com',
    'chat.openai.com',
    'openai.com',
    'claude.ai',
    'anthropic.com',
    'perplexity.ai',
    'pplx.ai',
    'gemini.google.com',
    'bard.google.com',
    'aistudio.google.com',
    'copilot.microsoft.com',
    'edgeservices.bing.com',
    'grok.com',
    'grok.x.ai',
    'x.ai',
    'chat.deepseek.com',
    'deepseek.com',
    'meta.ai',
  ];

  /** utm_source tokens, matched as substrings. */
  var AI_UTM_TOKENS = [
    'chatgpt',
    'chat-gpt',
    'gpt',
    'openai',
    'claude',
    'anthropic',
    'perplexity',
    'pplx',
    'gemini',
    'bard',
    'copilot',
    'bingchat',
    'bing-chat',
    'grok',
    'deepseek',
    'meta-ai',
    'metaai',
    'llama',
  ];

  try {
    var script =
      document.currentScript ||
      (function () {
        var all = document.getElementsByTagName('script');
        return all[all.length - 1];
      })();

    if (!script) return;

    var accountId = script.getAttribute('data-account-id');
    var endpoint = script.getAttribute('data-endpoint');
    if (!accountId || !endpoint) return;

    var referrer = document.referrer || '';
    var params = new URLSearchParams(window.location.search || '');
    var utmSource = params.get('utm_source');
    var utmMedium = params.get('utm_medium');
    var utmCampaign = params.get('utm_campaign');

    // Exact host match, so unrelated domains that merely contain a provider name
    // (grokkingalgorithms.com, claude-monet-gallery.com) are not counted.
    var fromAiHost = false;
    if (referrer) {
      try {
        var host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, '');
        for (var i = 0; i < AI_HOSTS.length; i++) {
          var candidate = AI_HOSTS[i];
          if (host === candidate || host.endsWith('.' + candidate)) {
            fromAiHost = true;
            break;
          }
        }
      } catch (err) {
        // Unparseable referrer: fall through to the utm check.
      }
    }

    var fromAiUtm = false;
    if (utmSource) {
      var lowered = utmSource.toLowerCase();
      for (var j = 0; j < AI_UTM_TOKENS.length; j++) {
        if (lowered.indexOf(AI_UTM_TOKENS[j]) !== -1) {
          fromAiUtm = true;
          break;
        }
      }
    }

    if (!fromAiHost && !fromAiUtm) return;

    var ua = navigator.userAgent || '';
    var lowerUa = ua.toLowerCase();

    var browser = /edg/.test(lowerUa)
      ? 'Edge'
      : /opr|opera/.test(lowerUa)
        ? 'Opera'
        : /firefox|fxios/.test(lowerUa)
          ? 'Firefox'
          : /chrome|crios/.test(lowerUa)
            ? 'Chrome'
            : /safari/.test(lowerUa)
              ? 'Safari'
              : 'Other';

    var os = /windows/.test(lowerUa)
      ? 'Windows'
      : /iphone|ipad|ipod/.test(lowerUa)
        ? 'iOS'
        : /android/.test(lowerUa)
          ? 'Android'
          : /mac os|macintosh/.test(lowerUa)
            ? 'macOS'
            : /linux/.test(lowerUa)
              ? 'Linux'
              : 'Other';

    var payload = {
      trackerVersion: TRACKER_VERSION,
      accountId: accountId,
      ts: new Date().toISOString(),
      url: window.location.href,
      path: window.location.pathname,
      // Raw referrer only. Server-side aggregation parses a hostname out of this
      // column, so utm values must not be substituted in when it is empty.
      referrer: referrer || null,
      userAgent: ua,
      utmSource: utmSource || null,
      utmMedium: utmMedium || null,
      utmCampaign: utmCampaign || null,
      browser: browser,
      os: os,
      device: /mobile|android|iphone|ipad|ipod/.test(lowerUa) ? 'mobile' : 'desktop',
      screen: window.screen.width + 'x' + window.screen.height,
      platform: navigator.platform || null,
      language: navigator.language || null,
    };

    // keepalive lets the request survive the page unloading mid-flight.
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
      mode: 'cors',
      credentials: 'omit',
    }).catch(function () {
      // Ignored on purpose: analytics must not surface errors on the host page.
    });
  } catch (err) {
    // Ignored on purpose.
  }
})();
