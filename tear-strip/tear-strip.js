/**
 * TearStrip — drag-to-tear perforated strip animation.
 *
 * Bottom layer: fixed to the right, segments hide left → right.
 * Top layer: peeled trail pinned to the tear line (handle),
 * accumulating behind it and leaving empty space on the far left —
 * matching the Figma reference states.
 */
(function (global) {
  'use strict';

  var SEGMENT_PATH = 'M0 0H20L30 6V30L20 36H0V0Z';
  var DEFAULTS = {
    segmentCount: 14,
    segmentWidth: 24.6,
    segmentHeight: 30,
    color: '#19CA41',
    /** 'peel' — trail behind handle; 'scatter' — torn segments fly away */
    animationMode: 'peel',
    tornGradient: [
      { offset: 0, color: '#0d6321' },
      { offset: 0.52, color: '#1ac940' },
      { offset: 1, color: '#0d6321' },
    ],
    tornScaleEdge: 1,
    tornScalePeak: 1.22,
    trailGap: 15,
    /** Handle pill inset from strip left edge at rest (px) */
    handleInset: 8,
    /** Overlap between adjacent segments to hide subpixel seams (px) */
    segmentOverlap: 1,
    onComplete: null,
  };

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function segmentSvg(color) {
    return (
      '<svg viewBox="0 0 30 36" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" shape-rendering="geometricPrecision">' +
      '<path d="' +
      SEGMENT_PATH +
      '" fill="' +
      color +
      '"/>' +
      '</svg>'
    );
  }

  function segmentHtml(options) {
    if (options.segmentImage) {
      return (
        '<img class="ts-seg-img" src="' +
        options.segmentImage +
        '" alt="" draggable="false">'
      );
    }
    return segmentSvg(options.color);
  }

  function handleSvg(accent) {
    return (
      '<svg viewBox="0 0 75 43" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<rect x="0.5" y="0.5" width="74" height="42" rx="21" fill="rgba(236,236,236,0.85)" stroke="white" stroke-width="1"/>' +
      '<path d="M30 21.5H42" stroke="' +
      accent +
      '" stroke-width="2.6" stroke-linecap="round"/>' +
      '<path d="M38 17.5L42.5 21.5L38 25.5" stroke="' +
      accent +
      '" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
      '</svg>'
    );
  }

  function TearStrip(root, options) {
    this.root = root;
    this.options = Object.assign({}, DEFAULTS, options || {});
    this.segmentCount = this.options.segmentCount;
    this.segmentWidth = this.options.segmentWidth;
    this.segmentHeight = this.options.segmentHeight;
    this.stripWidth = this.segmentCount * this.segmentWidth;

    this.tearPx = 0;
    this.isDragging = false;
    this.isComplete = false;
    this.pointerId = null;
    this.dragOffsetX = 0;
    this.scatteredIndices = {};

    this._build();
    this._applyHandleRestOffset();
    this._bindEvents();

    var self = this;
    requestAnimationFrame(function () {
      self._syncDragMetrics();
      self.update(self.tearPx);
    });
  }

  TearStrip.prototype._applyHandleRestOffset = function () {
    this._syncDragMetrics();
  };

  TearStrip.prototype._syncDragMetrics = function () {
    var handleW = this.options.handleWidth || 75;
    var inset = this.options.handleInset != null ? this.options.handleInset : 8;
    var restOffset = inset + handleW / 2;
    var rootRect = this.root.getBoundingClientRect();
    var visualWidth = rootRect.width || this.stripWidth;

    this.handleRestOffset = restOffset;
    this.coordRatio = visualWidth > 0 ? this.stripWidth / visualWidth : 1;
    this.tearMax = Math.max(0, this.stripWidth - inset * 2 - handleW);
    this.root.style.setProperty('--ts-handle-rest-offset', restOffset + 'px');
  };

  TearStrip.prototype._pointerXToTearPx = function (clientX, dragOffsetX) {
    var rootRect = this.root.getBoundingClientRect();
    var visualWidth = rootRect.width || this.stripWidth;
    var ratio = visualWidth > 0 ? this.stripWidth / visualWidth : 1;
    var centerXInternal = (clientX - rootRect.left - dragOffsetX) * ratio;

    return centerXInternal - this.handleRestOffset;
  };

  TearStrip.prototype._getTornProgress = function (tearPx) {
    if (this.tearMax <= 0) return 0;
    return clamp(tearPx / this.tearMax, 0, 1);
  };

  TearStrip.prototype._getEffectiveTearPx = function (tearPx) {
    return this._getTornProgress(tearPx) * this.stripWidth;
  };

  TearStrip.create = function (container, options) {
    var opts = options || {};
    var width = opts.segmentWidth || DEFAULTS.segmentWidth;
    var count = opts.segmentCount || DEFAULTS.segmentCount;

    if (opts.fillWidth && container) {
      var hostWidth = container.clientWidth || container.offsetWidth;
      if (hostWidth > 0) {
        count = Math.ceil(hostWidth / width);
        width = hostWidth / count;
      }
    }

    var el = document.createElement('div');
    var mode = opts.animationMode || DEFAULTS.animationMode;
    el.className = 'tear-strip tear-strip--' + mode;
    el.style.setProperty('--ts-strip-w', count * width + 'px');
    el.style.setProperty('--ts-seg-w', width + 'px');
    el.style.setProperty(
      '--ts-seg-overlap',
      (opts.segmentOverlap != null ? opts.segmentOverlap : DEFAULTS.segmentOverlap) + 'px'
    );
    el.style.setProperty('--ts-accent', opts.color || DEFAULTS.color);
    container.appendChild(el);
    return new TearStrip(el, Object.assign({}, opts, { segmentCount: count, segmentWidth: width }));
  };

  TearStrip.prototype._build = function () {
    var bottomHtml = '';
    var w = this.segmentWidth;

    for (var i = 0; i < this.segmentCount; i++) {
      bottomHtml +=
        '<div class="ts-seg" data-index="' +
        i +
        '" style="left:' +
        i * w +
        'px">' +
        segmentHtml(this.options) +
        '</div>';
    }

    this.root.innerHTML =
      '<div class="tear-strip__stage">' +
      '<div class="tear-strip__shadow" aria-hidden="true"></div>' +
      '<div class="tear-strip__bottom">' +
      bottomHtml +
      '</div>' +
      '<div class="tear-strip__torn-track" aria-hidden="true"></div>' +
      '<div class="tear-strip__scatter" aria-hidden="true"></div>' +
      '</div>' +
      '<button type="button" class="tear-strip__handle" aria-label="Потяните, чтобы оторвать ленту">' +
      handleSvg(this.options.color) +
      '</button>';

    this.shadow = this.root.querySelector('.tear-strip__shadow');
    this.bottomLayer = this.root.querySelector('.tear-strip__bottom');
    this.tornTrack = this.root.querySelector('.tear-strip__torn-track');
    this.scatterLayer = this.root.querySelector('.tear-strip__scatter');
    this.bottomSegs = Array.prototype.slice.call(this.bottomLayer.querySelectorAll('.ts-seg'));
    this.handle = this.root.querySelector('.tear-strip__handle');
  };

  TearStrip.prototype._bindEvents = function () {
    var self = this;

    this.handle.addEventListener('pointerdown', function (e) {
      if (self.isComplete) return;
      self._syncDragMetrics();
      self.isDragging = true;
      self.pointerId = e.pointerId;
      self.root.classList.add('is-dragging');
      self.handle.setPointerCapture(e.pointerId);

      var handleRect = self.handle.getBoundingClientRect();
      self.dragOffsetX = e.clientX - (handleRect.left + handleRect.width / 2);
      e.preventDefault();
    });

    this.handle.addEventListener('pointermove', function (e) {
      if (!self.isDragging || e.pointerId !== self.pointerId) return;
      var tearX = self._pointerXToTearPx(e.clientX, self.dragOffsetX);
      self.update(clamp(tearX, 0, self.tearMax));
    });

    var endDrag = function (e) {
      if (!self.isDragging || (e.pointerId !== undefined && e.pointerId !== self.pointerId)) return;
      self.isDragging = false;
      self.pointerId = null;
      self.root.classList.remove('is-dragging');

      if (self.tearPx >= self.tearMax - 0.5) {
        self._complete();
      }
    };

    this.handle.addEventListener('pointerup', endDrag);
    this.handle.addEventListener('pointercancel', endDrag);

    var onViewportChange = function () {
      if (self.isDragging) return;
      self._syncDragMetrics();
      self.update(self.tearPx);
    };

    window.addEventListener('resize', onViewportChange);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', onViewportChange);
    }
  };

  /**
   * Segment i is gone from the bottom once the tear line has passed
   * its right edge — keeps bottom flush with the handle at rest points.
   */
  TearStrip.prototype._getTornCount = function (tearPx) {
    var progress = this._getTornProgress(tearPx);
    return clamp(Math.floor(progress * this.segmentCount + 1e-6), 0, this.segmentCount);
  };

  /**
   * Scale profile for torn segments: 1:1 at both edges, tallest at center.
   * Simulates the ribbon bulging toward the viewer in the middle of the peel.
   */
  TearStrip.prototype._getTornSegmentScaleY = function (index, tornCount) {
    var edge = this.options.tornScaleEdge;
    var peak = this.options.tornScalePeak;

    if (tornCount <= 1) return edge;

    var t = index / (tornCount - 1);
    var bulge = Math.sin(t * Math.PI);

    return edge + (peak - edge) * bulge;
  };

  /**
   * Build torn trail as HTML segments with a shared gradient background.
   * Position uses trailGap (compressed step); scaleY bulges toward center.
   */
  TearStrip.prototype._renderTornSegments = function (tornCount, step, trailWidth) {
    if (tornCount <= 0) return '';

    var html = '';
    var grad = this._tornGradientCss();

    for (var i = 0; i < tornCount; i++) {
      var left = i * step;
      var scaleY = this._getTornSegmentScaleY(i, tornCount);

      html +=
        '<div class="ts-seg ts-seg--torn" style="left:' +
        left +
        'px;--ts-seg-scale-y:' +
        scaleY +
        ';--ts-seg-bg-x:-' +
        left +
        'px;background-image:' +
        grad +
        '"></div>';
    }

    return html;
  };

  TearStrip.prototype._getScatterMotion = function (index) {
    var dir = index % 2 === 0 ? -1 : 1;
    var flyX = -(22 + (index * 13) % 28);
    var flyY = dir * (14 + (index * 9) % 22);
    var rot = dir * (10 + (index * 11) % 24);

    return { flyX: flyX, flyY: flyY, rot: rot };
  };

  TearStrip.prototype._spawnScatterSegment = function (index) {
    if (this.scatteredIndices[index]) return;

    var motion = this._getScatterMotion(index);
    var w = this.segmentWidth;
    var el = document.createElement('div');

    el.className = 'ts-seg ts-seg--scatter';
    el.style.left = index * w + 'px';
    el.style.setProperty('--ts-fly-x', motion.flyX + 'px');
    el.style.setProperty('--ts-fly-y', motion.flyY + 'px');
    el.style.setProperty('--ts-fly-rot', motion.rot + 'deg');
    el.innerHTML = segmentHtml(this.options);

    this.scatterLayer.appendChild(el);
    this.scatteredIndices[index] = true;
  };

  TearStrip.prototype._updatePeel = function (tearPx, tornCount) {
    var w = this.segmentWidth;
    var gap = this.options.trailGap || 0;
    var step = Math.max(w - gap, 1);
    var trailWidth = tornCount > 0 ? w + (tornCount - 1) * step : 0;
    var trackLeft = tearPx - trailWidth;

    this.root.style.setProperty('--ts-track-x', trackLeft + 'px');
    this.root.style.setProperty('--ts-trail-w', trailWidth + 'px');
    this.tornTrack.style.width = trailWidth + 'px';
    this.tornTrack.style.transform = 'translateX(' + trackLeft + 'px)';
    this.tornTrack.innerHTML = this._renderTornSegments(tornCount, step, trailWidth);

    if (tornCount > 0) {
      this.root.style.setProperty('--ts-shadow-left', trackLeft + 'px');
      this.root.style.setProperty('--ts-shadow-width', trailWidth + 'px');
      this.shadow.style.opacity = String(clamp(tearPx / 70, 0.2, 1));
    } else {
      this.shadow.style.opacity = '0';
    }
  };

  TearStrip.prototype._updateScatter = function (tornCount) {
    this.tornTrack.innerHTML = '';
    this.tornTrack.style.width = '0';
    this.tornTrack.style.transform = 'translateX(0)';
    this.shadow.style.opacity = '0';

    for (var i = 0; i < tornCount; i++) {
      this._spawnScatterSegment(i);
    }
  };

  TearStrip.prototype._tornGradientCss = function () {
    var stops = this.options.tornGradient;
    var parts = [];

    for (var i = 0; i < stops.length; i++) {
      parts.push(stops[i].color + ' ' + stops[i].offset * 100 + '%');
    }

    return 'linear-gradient(90deg,' + parts.join(',') + ')';
  };

  TearStrip.prototype.update = function (tearPx) {
    this.tearPx = tearPx;
    var tornCount = this._getTornCount(tearPx);
    var effectiveTearPx = this._getEffectiveTearPx(tearPx);

    this.root.style.setProperty('--ts-tear', tearPx + 'px');

    if (this.options.animationMode === 'scatter') {
      this._updateScatter(tornCount);
    } else {
      this._updatePeel(effectiveTearPx, tornCount);
    }

    for (var i = 0; i < this.segmentCount; i++) {
      this.bottomSegs[i].classList.toggle('is-hidden', i < tornCount);
    }

    if (typeof this.options.onProgress === 'function') {
      this.options.onProgress(tearPx, tornCount, this.segmentCount - tornCount);
    }
  };

  TearStrip.prototype._complete = function () {
    if (this.isComplete) return;
    this.isComplete = true;
    this.root.classList.add('is-complete');

    var self = this;

    if (this.options.animationMode === 'scatter') {
      this.bottomLayer.style.visibility = 'hidden';
      if (typeof self.options.onComplete === 'function') self.options.onComplete();
      return;
    }

    this.tornTrack.classList.add('is-falling');

    this.tornTrack.addEventListener('animationend', function onEnd() {
      self.tornTrack.removeEventListener('animationend', onEnd);
      self.tornTrack.style.visibility = 'hidden';
      self.bottomLayer.style.visibility = 'hidden';
      self.shadow.style.opacity = '0';
      if (typeof self.options.onComplete === 'function') self.options.onComplete();
    });
  };

  TearStrip.prototype.getProgress = function () {
    return this._getTornProgress(this.tearPx);
  };

  TearStrip.prototype.destroy = function () {
    this.root.innerHTML = '';
    this.root.className = '';
  };

  global.TearStrip = TearStrip;
})(typeof window !== 'undefined' ? window : globalThis);
