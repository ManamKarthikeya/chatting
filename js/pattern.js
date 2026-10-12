/**
 * iWeather Pattern Lock Engine
 * Interactive 3x3 touch & mouse gesture lock with realistic camouflage feedback.
 * 
 * Target Codes:
 * - 4-5-2-1-7        => Girl's Private Chat
 * - 5-6-3-2-1-4-7    => Boy's Private Chat
 * - 8-5-6-9          => Weather Dashboard
 * - Any other pattern => Camouflage fallback to Weather Dashboard!
 */

class PatternLock {
  constructor() {
    this.wrapper = document.getElementById('pattern-canvas-wrapper');
    this.canvas = document.getElementById('pattern-canvas');
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.statusEl = document.getElementById('pattern-status');
    this.dotsGrid = document.getElementById('pattern-dots-grid');
    this.dotCells = document.querySelectorAll('.pattern-dot-cell');

    this.selectedDots = []; // Array of integers 1-9
    this.isDrawing = false;
    this.currentPos = { x: 0, y: 0 };
    this.dotCenters = []; // Cached center coordinates of each dot (1 to 9)

    this.PATTERNS = {
      GIRL: '45217',
      BOY: '5632147',
      WEATHER: '8569'
    };

    if (this.canvas) {
      this.init();
    }
  }

  init() {
    this.resizeCanvas();
    window.addEventListener('resize', () => {
      this.resizeCanvas();
      this.calculateDotCenters();
    });

    // Calculate centers after layout
    setTimeout(() => this.calculateDotCenters(), 100);

    // Event Listeners for Touch and Mouse
    this.wrapper.addEventListener('mousedown', (e) => this.handleStart(e));
    window.addEventListener('mousemove', (e) => this.handleMove(e));
    window.addEventListener('mouseup', () => this.handleEnd());

    this.wrapper.addEventListener('touchstart', (e) => this.handleStart(e), { passive: false });
    window.addEventListener('touchmove', (e) => this.handleMove(e), { passive: false });
    window.addEventListener('touchend', () => this.handleEnd());

    // Decoy button
    const decoyBtn = document.getElementById('btn-open-decoy-weather');
    if (decoyBtn) {
      decoyBtn.addEventListener('click', () => {
        if (window.App) window.App.openWeather();
      });
    }
  }

  resizeCanvas() {
    if (!this.canvas || !this.wrapper) return;
    const rect = this.wrapper.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
    this.redrawLines();
  }

  calculateDotCenters() {
    if (!this.wrapper) return;
    const wrapperRect = this.wrapper.getBoundingClientRect();
    this.dotCenters = [];

    this.dotCells.forEach((cell) => {
      const index = parseInt(cell.getAttribute('data-index'), 10);
      const dot = cell.querySelector('.pattern-dot');
      if (dot) {
        const dotRect = dot.getBoundingClientRect();
        this.dotCenters[index] = {
          x: dotRect.left + dotRect.width / 2 - wrapperRect.left,
          y: dotRect.top + dotRect.height / 2 - wrapperRect.top,
          element: dot
        };
      }
    });
  }

  getEventCoords(e) {
    const wrapperRect = this.wrapper.getBoundingClientRect();
    let clientX = e.clientX;
    let clientY = e.clientY;

    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    }

    return {
      x: clientX - wrapperRect.left,
      y: clientY - wrapperRect.top
    };
  }

  handleStart(e) {
    if (e.cancelable) e.preventDefault();
    this.calculateDotCenters();
    this.isDrawing = true;
    this.selectedDots = [];
    this.resetDotClasses();

    const coords = this.getEventCoords(e);
    this.currentPos = coords;
    this.checkHitDot(coords);
    this.redrawLines();
  }

  handleMove(e) {
    if (!this.isDrawing) return;
    if (e.cancelable) e.preventDefault();

    const coords = this.getEventCoords(e);
    this.currentPos = coords;
    this.checkHitDot(coords);
    this.redrawLines();
  }

  handleEnd() {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    this.redrawLines();

    if (this.selectedDots.length > 0) {
      this.evaluatePattern();
    }
  }

  checkHitDot(coords) {
    const hitRadius = 38; // forgiving touch area
    for (let i = 1; i <= 9; i++) {
      const dot = this.dotCenters[i];
      if (!dot) continue;

      const dx = coords.x - dot.x;
      const dy = coords.y - dot.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= hitRadius && !this.selectedDots.includes(i)) {
        // Intermediate dot interpolation (e.g. if dragging 1 to 3, connect 2)
        if (this.selectedDots.length > 0) {
          const last = this.selectedDots[this.selectedDots.length - 1];
          const mid = this.getIntermediateDot(last, i);
          if (mid && !this.selectedDots.includes(mid)) {
            this.selectedDots.push(mid);
            if (this.dotCenters[mid].element) {
              this.dotCenters[mid].element.classList.add('active');
            }
          }
        }

        this.selectedDots.push(i);
        if (dot.element) {
          dot.element.classList.add('active');
        }

        // Haptic feedback if supported
        if (navigator.vibrate) {
          navigator.vibrate(15);
        }
        break;
      }
    }
  }

  getIntermediateDot(a, b) {
    // 3x3 grid matrix check for middle dot
    const linePairs = {
      '1-3': 2, '3-1': 2,
      '4-6': 5, '6-4': 5,
      '7-9': 8, '8-7': 8,
      '1-7': 4, '7-1': 4,
      '2-8': 5, '8-2': 5,
      '3-9': 6, '9-3': 6,
      '1-9': 5, '9-1': 5,
      '3-7': 5, '7-3': 5
    };
    return linePairs[`${a}-${b}`] || null;
  }

  redrawLines() {
    if (!this.ctx || !this.wrapper) return;
    const rect = this.wrapper.getBoundingClientRect();
    this.ctx.clearRect(0, 0, rect.width, rect.height);

    if (this.selectedDots.length === 0) return;

    this.ctx.beginPath();
    this.ctx.lineWidth = 4.5;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.strokeStyle = '#38bdf8';
    this.ctx.shadowColor = 'rgba(56, 189, 248, 0.7)';
    this.ctx.shadowBlur = 14;

    const first = this.dotCenters[this.selectedDots[0]];
    if (!first) return;
    this.ctx.moveTo(first.x, first.y);

    for (let i = 1; i < this.selectedDots.length; i++) {
      const pt = this.dotCenters[this.selectedDots[i]];
      if (pt) this.ctx.lineTo(pt.x, pt.y);
    }

    if (this.isDrawing) {
      this.ctx.lineTo(this.currentPos.x, this.currentPos.y);
    }

    this.ctx.stroke();
  }

  resetDotClasses() {
    for (let i = 1; i <= 9; i++) {
      if (this.dotCenters[i] && this.dotCenters[i].element) {
        this.dotCenters[i].element.className = 'pattern-dot';
      }
    }
  }

  evaluatePattern() {
    const patternStr = this.selectedDots.join('');
    console.log('Entered pattern code:', patternStr);

    if (patternStr === this.PATTERNS.GIRL) {
      // Girl Chat View
      this.showStatus('Radar verified • Welcome', 'verified');
      this.highlightDots('love');
      setTimeout(() => {
        this.clear();
        if (window.App) window.App.openChat('girl');
      }, 450);

    } else if (patternStr === this.PATTERNS.BOY) {
      // Boy Chat View
      this.showStatus('Radar verified • Welcome', 'verified');
      this.highlightDots('success');
      setTimeout(() => {
        this.clear();
        if (window.App) window.App.openChat('boy');
      }, 450);

    } else if (patternStr === this.PATTERNS.WEATHER) {
      // Explicit Weather Pattern
      this.showStatus('Loading local radar...', 'loading');
      setTimeout(() => {
        this.clear();
        if (window.App) window.App.openWeather();
      }, 350);

    } else {
      // Decoy / Wrong Pattern: Never show an error! Smoothly transition to normal weather!
      this.showStatus('Calibrating radar coordinates...', 'loading');
      setTimeout(() => {
        this.clear();
        if (window.App) window.App.openWeather();
      }, 650);
    }
  }

  highlightDots(className) {
    this.selectedDots.forEach((idx) => {
      if (this.dotCenters[idx] && this.dotCenters[idx].element) {
        this.dotCenters[idx].element.classList.add(className);
      }
    });
  }

  showStatus(text, className) {
    if (!this.statusEl) return;
    this.statusEl.textContent = text;
    this.statusEl.className = 'pattern-status ' + (className || '');
  }

  clear() {
    this.selectedDots = [];
    this.isDrawing = false;
    this.resetDotClasses();
    if (this.ctx && this.wrapper) {
      const rect = this.wrapper.getBoundingClientRect();
      this.ctx.clearRect(0, 0, rect.width, rect.height);
    }
    if (this.statusEl) {
      this.statusEl.textContent = 'Connect pattern to calibrate';
      this.statusEl.className = 'pattern-status';
    }
  }
}

window.PatternLock = PatternLock;
