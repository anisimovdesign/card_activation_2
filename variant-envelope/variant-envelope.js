/**
 * VariantEnvelope — layered card envelope (Variant 2 assets).
 *
 * Layers (bottom → top):
 *   masked: pink_inside → envelope_bottom → envelope_top
 *   card (outside mask) → tear animation
 */
(function (global) {
  'use strict';

  var DEFAULTS = {
    width: 374,
    height: 369,
    tearBottom: 178,
    tearWidth: 335,
    insideSrc: 'pink_inside.png',
    cardSrc: 'card.png',
    topSrc: 'envelope_top.png',
    bottomSrc: 'envelope_bottom.png',
    cardFinalWidth: 341,
    cardDelay: 500,
    cardDuration: 1500,
    stripOptions: {
      animationMode: 'scatter',
      color: '#19CA41',
      segmentWidth: 24.6,
      segmentHeight: 30,
    },
  };

  function VariantEnvelope(root, options) {
    this.root = root;
    this.options = Object.assign({}, DEFAULTS, options || {});
    this.strip = null;
    this._build();
  }

  VariantEnvelope.create = function (container, options) {
    var opts = Object.assign({}, options || {});
    var scale = typeof opts.scale === 'number' ? opts.scale : 1;
    var el = document.createElement('div');
    el.className = 'variant-envelope';
    el.style.setProperty('--env-w', (opts.width || DEFAULTS.width) + 'px');
    el.style.setProperty('--env-h', (opts.height || DEFAULTS.height) + 'px');
    el.style.setProperty('--env-scale', String(scale));
    el.style.setProperty('--env-tear-bottom', (opts.tearBottom || DEFAULTS.tearBottom) + 'px');
    el.style.setProperty('--env-tear-w', (opts.tearWidth || DEFAULTS.tearWidth) + 'px');
    if (opts.cardDuration) {
      el.style.setProperty('--env-card-duration', (opts.cardDuration / 1000) + 's');
    }
    container.appendChild(el);
    return new VariantEnvelope(el, opts);
  };

  VariantEnvelope.prototype._build = function () {
    var opts = this.options;
    var stripOpts = Object.assign({}, opts.stripOptions || {});

    this.root.innerHTML =
      '<div class="variant-envelope__masked">' +
      '<div class="variant-envelope__layer variant-envelope__layer--inside">' +
      '<img class="variant-envelope__inside" src="' +
      opts.insideSrc +
      '" alt="" draggable="false" width="325" height="218">' +
      '</div>' +
      '<div class="variant-envelope__layer variant-envelope__layer--flaps">' +
      '<img class="variant-envelope__bottom" src="' +
      opts.bottomSrc +
      '" alt="" draggable="false" width="335" height="183">' +
      '<img class="variant-envelope__top" src="' +
      opts.topSrc +
      '" alt="" draggable="false" width="335" height="55">' +
      '</div>' +
      '</div>' +
      '<div class="variant-envelope__card-stage">' +
      '<img class="variant-envelope__card" src="' +
      opts.cardSrc +
      '" alt="" draggable="false" width="305" height="192">' +
      '</div>' +
      '<div class="variant-envelope__tear"></div>';

    this.tearHost = this.root.querySelector('.variant-envelope__tear');
    this.cardEl = this.root.querySelector('.variant-envelope__card');

    var stripWidth = opts.tearWidth || DEFAULTS.tearWidth;
    var segW = stripOpts.segmentWidth || 30;
    stripOpts.segmentCount = stripOpts.segmentCount || Math.ceil(stripWidth / segW);
    stripOpts.fillWidth = true;

    var self = this;
    var userOnComplete = stripOpts.onComplete;
    var userOnProgress = stripOpts.onProgress;

    stripOpts.onProgress = function (tearPx, tornCount, remaining) {
      self._updateFlapRotation(remaining);
      if (typeof userOnProgress === 'function') userOnProgress(tearPx, tornCount, remaining);
    };

    stripOpts.onComplete = function () {
      self._onTearComplete();
      if (typeof userOnComplete === 'function') userOnComplete();
      if (typeof opts.onComplete === 'function') opts.onComplete();
    };

    this.strip = global.TearStrip.create(this.tearHost, stripOpts);
    this._updateFlapRotation(this.strip.segmentCount);
  };

  VariantEnvelope.prototype._getFlapRotation = function (remaining) {
    if (remaining > 2) return 0;
    if (remaining === 2) return 2;
    if (remaining === 1) return 3;
    return 4;
  };

  VariantEnvelope.prototype._updateFlapRotation = function (remaining) {
    var deg = this._getFlapRotation(remaining);
    this.root.style.setProperty('--env-top-rotate', deg + 'deg');
  };

  VariantEnvelope.prototype._onTearComplete = function () {
    this.root.classList.add('is-revealed');
    this._scheduleCardAnimation();
  };

  VariantEnvelope.prototype._scheduleCardAnimation = function () {
    var self = this;
    var opts = this.options;
    var delay = opts.cardDelay != null ? opts.cardDelay : 500;
    var finalWidth = opts.cardFinalWidth || 341;

    if (this._cardTimer) window.clearTimeout(this._cardTimer);

    this._cardTimer = window.setTimeout(function () {
      self._startCardAnimation(finalWidth);
    }, delay);
  };

  VariantEnvelope.prototype._startCardAnimation = function (finalWidth) {
    var card = this.cardEl;
    var activation = this.root.closest('.activation');
    var nav = activation ? activation.querySelector('.activation__nav') : null;

    if (!card || !nav || !activation) return;

    var cardRect = card.getBoundingClientRect();
    var navRect = nav.getBoundingClientRect();
    var shellRect = activation.getBoundingClientRect();
    var envScale = parseFloat(getComputedStyle(this.root).getPropertyValue('--env-scale')) || 1;
    var scale = finalWidth / cardRect.width;

    var cardCenterX = cardRect.left + cardRect.width / 2;
    var cardCenterY = cardRect.top + cardRect.height / 2;
    var targetCenterX = shellRect.left + shellRect.width / 2;
    var targetCenterY = navRect.bottom + (cardRect.height * scale) / 2;

    this._cardTarget = {
      top: navRect.bottom - shellRect.top,
      width: finalWidth,
      height: cardRect.height * scale,
    };

    this.root.style.setProperty('--card-dx', (targetCenterX - cardCenterX) / envScale + 'px');
    this.root.style.setProperty('--card-dy', (targetCenterY - cardCenterY) / envScale + 'px');
    this.root.style.setProperty('--card-scale', String(scale));

    this.root.classList.add('is-card-revealed');

    if (typeof this.options.onCardRiseStart === 'function') {
      this.options.onCardRiseStart();
    }

    var self = this;
    var userRevealComplete = this.options.onRevealComplete;

    var onCardEnd = function (e) {
      if (e.propertyName !== 'transform') return;
      card.removeEventListener('transitionend', onCardEnd);
      self.root.classList.add('is-card-settled');
      if (activation) activation.classList.add('is-card-settled');
      if (typeof userRevealComplete === 'function') userRevealComplete();
    };

    card.addEventListener('transitionend', onCardEnd);
  };

  VariantEnvelope.prototype.destroy = function () {
    if (this._cardTimer) window.clearTimeout(this._cardTimer);
    if (this.strip) this.strip.destroy();
    this.root.innerHTML = '';
    this.root.className = '';
  };

  global.VariantEnvelope = VariantEnvelope;
})(typeof window !== 'undefined' ? window : globalThis);
