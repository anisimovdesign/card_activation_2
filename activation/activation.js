/**
 * ActivationScreen — Variant 2 with tear + card rise + keyboard reveal.
 */
(function (global) {
  'use strict';

  var KEY_ROWS = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['', '0', 'delete'],
  ];

  var ENVELOPE_DESIGN = { width: 374, height: 369 };
  var CARD_FINAL_WIDTH = 341;
  var KEYBOARD_DELAY = 400;

  function resolveEnvelopeScale() {
    var designWidth = ENVELOPE_DESIGN.width;
    var viewportWidth =
      (window.visualViewport && window.visualViewport.width) || window.innerWidth || designWidth;
    var horizontalInset = 32;
    var available = viewportWidth - horizontalInset;

    return Math.min(1, available / designWidth);
  }

  function ActivationScreen(root, options) {
    this.root = root;
    this.options = options || {};
    this.envelope = null;
    this._build();
  }

  ActivationScreen.create = function (container, options) {
    var el = document.createElement('div');
    el.className = 'activation';
    container.appendChild(el);
    return new ActivationScreen(el, options);
  };

  ActivationScreen.prototype._buildKeyboard = function () {
    var html = '<div class="activation__keys">';

    for (var r = 0; r < KEY_ROWS.length; r++) {
      html += '<div class="activation__key-row">';
      var row = KEY_ROWS[r];
      for (var c = 0; c < row.length; c++) {
        var key = row[c];
        if (key === '') {
          html += '<button type="button" class="activation__key activation__key--ghost" tabindex="-1"></button>';
        } else if (key === 'delete') {
          html +=
            '<button type="button" class="activation__key activation__key--delete" tabindex="-1" aria-label="Удалить">⌫</button>';
        } else {
          html +=
            '<button type="button" class="activation__key" tabindex="-1">' + key + '</button>';
        }
      }
      html += '</div>';
    }

    html += '</div>';
    return html;
  };

  ActivationScreen.prototype._build = function () {
    var opts = this.options;

    this.root.innerHTML =
      '<header class="activation__nav">' +
      '<button type="button" class="activation__back" aria-label="Назад" tabindex="-1">' +
      '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<path d="M14.5 6L9 11.5L14.5 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg></button>' +
      '<h1 class="activation__title">Активация</h1>' +
      '</header>' +
      '<div class="activation__body">' +
      '<div class="activation__center">' +
      '<div class="activation__envelope-host"></div>' +
      '</div>' +
      '<div class="activation__intro">' +
      '<h2 class="activation__intro-title">Карта уже у вас, осталось активировать</h2>' +
      '<p class="activation__intro-text">Рвём конверт, прям как подарочную упаковку</p>' +
      '</div>' +
      '<p class="activation__hint" hidden>Впишите номер пластиковой карты</p>' +
      '</div>' +
      '<footer class="activation__footer">' +
      '<div class="activation__keyboard" hidden>' +
      this._buildKeyboard() +
      '</div>' +
      '<button type="button" class="activation__btn" tabindex="-1">' +
      '<span class="activation__btn-label" data-state="start">Начать активацию</span>' +
      '<span class="activation__btn-label" data-state="next" hidden>Далее</span>' +
      '</button>' +
      '<div class="activation__home-bar" aria-hidden="true"></div>' +
      '</footer>';

    this.btnLabels = {
      start: this.root.querySelector('[data-state="start"]'),
      next: this.root.querySelector('[data-state="next"]'),
    };

    var envelopeHost = this.root.querySelector('.activation__envelope-host');
    var self = this;
    var envelopeOpts = Object.assign({}, opts.envelope || {});
    var userRevealComplete = envelopeOpts.onRevealComplete;
    var userCardRiseStart = envelopeOpts.onCardRiseStart;

    envelopeOpts.onCardRiseStart = function () {
      self._pinCardStage();
      if (self._keyboardTimer) window.clearTimeout(self._keyboardTimer);
      self._keyboardTimer = window.setTimeout(function () {
        self._showKeyboard();
      }, KEYBOARD_DELAY);
      if (typeof userCardRiseStart === 'function') userCardRiseStart();
    };

    envelopeOpts.onRevealComplete = function () {
      if (typeof userRevealComplete === 'function') userRevealComplete();
    };

    var envelopeScale = resolveEnvelopeScale();
    envelopeOpts.scale = envelopeScale;
    envelopeHost.style.setProperty('--env-scale', envelopeScale);
    envelopeHost.style.setProperty(
      '--env-layout-h',
      Math.ceil(ENVELOPE_DESIGN.height * envelopeScale) + 'px'
    );

    this.envelope = global.VariantEnvelope.create(envelopeHost, envelopeOpts);
    this._lockViewportHeight();
  };

  ActivationScreen.prototype._lockViewportHeight = function () {
    var self = this;
    var apply = function () {
      if (self.root.classList.contains('is-keyboard')) return;
      var height =
        window.visualViewport && window.visualViewport.height
          ? window.visualViewport.height
          : window.innerHeight;
      self.root.style.height = height + 'px';
    };

    apply();
    window.addEventListener('resize', apply);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', apply);
    }
  };

  ActivationScreen.prototype._pinCardStage = function () {
    var body = this.root.querySelector('.activation__body');
    var center = this.root.querySelector('.activation__center');
    var intro = this.root.querySelector('.activation__intro');
    if (!body || !center || center.dataset.pinned === '1') return;

    var bodyRect = body.getBoundingClientRect();
    var rect = center.getBoundingClientRect();

    center.style.position = 'absolute';
    center.style.left = rect.left - bodyRect.left + 'px';
    center.style.top = rect.top - bodyRect.top + 'px';
    center.style.width = rect.width + 'px';
    center.style.zIndex = '2';
    center.style.pointerEvents = 'none';
    center.dataset.pinned = '1';

    if (intro && intro.dataset.pinned !== '1') {
      var introRect = intro.getBoundingClientRect();
      intro.style.position = 'absolute';
      intro.style.left = introRect.left - bodyRect.left + 'px';
      intro.style.top = introRect.top - bodyRect.top + 'px';
      intro.style.width = introRect.width + 'px';
      intro.style.marginTop = '0';
      intro.style.transform = 'none';
      intro.dataset.pinned = '1';
    }
  };

  ActivationScreen.prototype._showKeyboard = function () {
    if (this.root.classList.contains('is-keyboard')) return;

    var hint = this.root.querySelector('.activation__hint');
    var keyboard = this.root.querySelector('.activation__keyboard');

    hint.hidden = false;
    keyboard.hidden = false;

    this.root.classList.add('is-keyboard');

    this.btnLabels.start.hidden = true;
    this.btnLabels.next.hidden = false;
  };

  ActivationScreen.prototype.destroy = function () {
    if (this._keyboardTimer) window.clearTimeout(this._keyboardTimer);
    if (this.envelope) this.envelope.destroy();
    this.root.innerHTML = '';
    this.root.className = '';
  };

  global.ActivationScreen = ActivationScreen;
})(typeof window !== 'undefined' ? window : globalThis);
