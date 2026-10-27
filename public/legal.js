// EN / TR switch for the app's privacy and support pages.
// Picks Turkish for Turkish browsers (or ?lang=tr), remembers the choice.
(function () {
  var KEY = 'mapboast-legal-lang';
  var params = new URLSearchParams(location.search);
  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) { /* private mode */ }
  var lang = params.get('lang') || saved || ((navigator.language || '').toLowerCase().indexOf('tr') === 0 ? 'tr' : 'en');
  if (lang !== 'tr') lang = 'en';

  function apply(l) {
    document.documentElement.lang = l;
    document.querySelectorAll('[data-lang]').forEach(function (el) {
      el.hidden = el.getAttribute('data-lang') !== l;
    });
    document.querySelectorAll('[data-set-lang]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-set-lang') === l));
    });
    var t = document.querySelector('meta[name="title-' + l + '"]');
    if (t) document.title = t.content;
  }

  document.querySelectorAll('[data-set-lang]').forEach(function (b) {
    b.addEventListener('click', function () {
      var l = b.getAttribute('data-set-lang');
      try { localStorage.setItem(KEY, l); } catch (e) { /* ignore */ }
      apply(l);
    });
  });
  apply(lang);
})();
