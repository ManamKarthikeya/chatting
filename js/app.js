/**
 * iWeather Main Application Coordinator
 * Manages view routing, PWA service worker, floating heart physics, and global security.
 */

class AppController {
  constructor() {
    this.viewPattern = document.getElementById('view-pattern');
    this.viewWeather = document.getElementById('view-weather');
    this.viewChat = document.getElementById('view-chat');

    this.lightbox = document.getElementById('image-lightbox');
    this.lightboxImg = document.getElementById('lightbox-img');
    this.lightboxClose = document.getElementById('lightbox-close');

    this.heartCanvas = document.getElementById('heart-canvas-overlay');
    this.heartCtx = this.heartCanvas ? this.heartCanvas.getContext('2d') : null;
    this.heartParticles = [];
    this.isHeartLoopRunning = false;

    this.currentRole = 'boy'; // 'boy' or 'girl'
    this.activeView = 'pattern';

    this.init();
  }

  init() {
    this.initPWA();
    this.initViews();
    this.initLightbox();
    this.initHeartCanvas();
    this.bindGlobalShortcuts();

    // Instantiate Subsystems
    window.PatternLockInstance = new window.PatternLock();
    window.WeatherDashboardInstance = new window.WeatherDashboard();
    window.DuoChatInstance = new window.DuoChat();
    if (window.DuoCallManager) {
      window.DuoCallManagerInstance = new window.DuoCallManager();
    }
  }

  // Register PWA Service Worker for offline and Add-to-Home-Screen capability
  initPWA() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then((reg) => console.log('iWeather PWA Service Worker registered:', reg.scope))
          .catch((err) => console.log('Service Worker registration skipped:', err));
      });
    }
  }

  initViews() {
    // Default start view: Pattern Lock
    this.openPattern();
  }

  // View Routing: Pattern Lock Screen
  openPattern() {
    this.switchView(this.viewPattern);
    this.activeView = 'pattern';
    if (window.PatternLockInstance) {
      window.PatternLockInstance.clear();
    }
  }

  // View Routing: Authentic Weather Dashboard
  openWeather(instant = false) {
    this.switchView(this.viewWeather, instant);
    this.activeView = 'weather';
  }

  // View Routing: Private Duo Chat
  openChat(role = 'boy') {
    this.currentRole = role;
    if (window.DuoChatInstance) {
      window.DuoChatInstance.setRole(role);
    }
    this.switchView(this.viewChat);
    this.activeView = 'chat';
    this.showToast(`Duo Vault Unlocked • ${role === 'girl' ? "👧 JeanGrey's View" : "👦 Karthik's View"}`, 'success');
  }

  switchView(targetView, instant = false) {
    const views = [this.viewPattern, this.viewWeather, this.viewChat];
    views.forEach((v) => {
      if (instant) v.classList.add('instant-switch');
      else v.classList.remove('instant-switch');

      if (v === targetView) {
        v.classList.add('active');
      } else {
        v.classList.remove('active');
      }
    });

    if (instant) {
      setTimeout(() => {
        views.forEach((v) => v.classList.remove('instant-switch'));
      }, 50);
    }
  }

  // Lightbox
  initLightbox() {
    this.lightbox = document.getElementById('image-lightbox');
    this.lightboxImg = document.getElementById('lightbox-img');
    this.lightboxClose = document.getElementById('lightbox-close');
    this.lightboxDownloadBtn = document.getElementById('lightbox-download-btn');
    this.lightboxFilename = document.getElementById('lightbox-filename');
    this.currentLightboxMedia = null;

    if (this.lightboxClose) {
      this.lightboxClose.addEventListener('click', () => {
        if (this.lightbox) this.lightbox.classList.remove('active');
      });
    }

    if (this.lightboxDownloadBtn) {
      this.lightboxDownloadBtn.addEventListener('click', () => {
        if (this.currentLightboxMedia) {
          window.downloadMedia(this.currentLightboxMedia.url, this.currentLightboxMedia.filename);
        }
      });
    }

    if (this.lightbox) {
      this.lightbox.addEventListener('click', (e) => {
        if (e.target === this.lightbox || e.target.classList.contains('lightbox-body')) {
          this.lightbox.classList.remove('active');
        }
      });
    }
  }

  openLightbox(src, filename = 'photo.jpg') {
    if (!this.lightbox || !this.lightboxImg) return;
    this.currentLightboxMedia = { url: src, filename: filename };
    this.lightboxImg.src = src;
    if (this.lightboxFilename) {
      this.lightboxFilename.textContent = filename || 'Photo Preview';
    }
    this.lightbox.classList.add('active');
  }

  // Global Keyboard Shortcuts (Escape triggers Panic Camouflage to Weather!)
  bindGlobalShortcuts() {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.activeView === 'chat') {
        this.openWeather(true); // Instant disguise
      }
    });
  }

  // Toast Notification
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <span>${message}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'toastOut 0.3s forwards';
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }

  // Neon Electric Spark / High-Five Particle Canvas Engine
  initHeartCanvas() {
    if (!this.heartCanvas) return;
    const resize = () => {
      this.heartCanvas.width = window.innerWidth;
      this.heartCanvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();
  }

  triggerSparkShower(isSender = true) {
    if (!this.heartCanvas || !this.heartCtx) return;

    const colors = ['#38bdf8', '#818cf8', '#a855f7', '#fbbf24', '#34d399', '#f59e0b'];
    const count = 48;

    for (let i = 0; i < count; i++) {
      this.heartParticles.push({
        x: Math.random() * this.heartCanvas.width,
        y: this.heartCanvas.height + Math.random() * 60,
        size: Math.random() * 18 + 10,
        speedY: Math.random() * 4.2 + 3.0,
        speedX: (Math.random() - 0.5) * 2.2,
        color: colors[Math.floor(Math.random() * colors.length)],
        opacity: 1,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.1,
        swingOffset: Math.random() * 10
      });
    }

    if (navigator.vibrate) {
      navigator.vibrate([20, 40, 20]);
    }

    if (!this.isHeartLoopRunning) {
      this.isHeartLoopRunning = true;
      this.animateHearts();
    }

    if (!isSender) {
      this.showToast('Received a High-Five! ⚡👊', 'success');
    }
  }

  triggerHeartShower(isSender = true) {
    this.triggerSparkShower(isSender);
  }

  animateHearts() {
    if (!this.heartCtx || !this.heartCanvas) return;
    this.heartCtx.clearRect(0, 0, this.heartCanvas.width, this.heartCanvas.height);

    for (let i = this.heartParticles.length - 1; i >= 0; i--) {
      const p = this.heartParticles[i];
      p.y -= p.speedY;
      p.x += Math.sin(p.y / 25 + p.swingOffset) * 1.5 + p.speedX;
      p.rotation += p.rotationSpeed;
      p.opacity -= 0.007;

      if (p.opacity <= 0 || p.y < -50) {
        this.heartParticles.splice(i, 1);
        continue;
      }

      this.heartCtx.save();
      this.heartCtx.translate(p.x, p.y);
      this.heartCtx.rotate(p.rotation);
      this.heartCtx.globalAlpha = Math.max(0, p.opacity);
      this.drawSparkShape(this.heartCtx, p.size, p.color);
      this.heartCtx.restore();
    }

    if (this.heartParticles.length > 0) {
      requestAnimationFrame(() => this.animateHearts());
    } else {
      this.isHeartLoopRunning = false;
      this.heartCtx.clearRect(0, 0, this.heartCanvas.width, this.heartCanvas.height);
    }
  }

  drawSparkShape(ctx, size, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    // 4-pointed radiant spark / diamond star
    const spikes = 4;
    const outerRadius = size;
    const innerRadius = size * 0.35;
    let rot = Math.PI / 2 * 3;
    let x = 0;
    let y = 0;
    const step = Math.PI / spikes;

    ctx.moveTo(0, -outerRadius);
    for (let i = 0; i < spikes; i++) {
      x = Math.cos(rot) * outerRadius;
      y = Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y);
      rot += step;

      x = Math.cos(rot) * innerRadius;
      y = Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y);
      rot += step;
    }
    ctx.lineTo(0, -outerRadius);
    ctx.closePath();
    ctx.fill();
  }
}

/**
 * Universal Media & File Download Utility
 * Converts Data URLs / Blobs into download links safely across Chrome, iOS Safari, Android, and Desktop.
 */
window.downloadMedia = function(mediaUrl, filename) {
  if (!mediaUrl) {
    if (window.App && window.App.showToast) {
      window.App.showToast('Download error: File not found', 'error');
    }
    return;
  }

  const finalName = filename || 'download';

  try {
    // If it's a base64 Data URL, convert to Blob object URL to prevent browser URL truncation
    if (mediaUrl.startsWith('data:')) {
      const parts = mediaUrl.split(',');
      const meta = parts[0];
      const base64Data = parts[1];
      const mimeMatch = meta.match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';

      const binaryStr = atob(base64Data);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      const blob = new Blob([bytes], { type: mime });
      const blobUrl = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = finalName;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      }, 1500);

      if (window.App && window.App.showToast) {
        window.App.showToast(`Saved: ${finalName}`, 'success');
      }
      return;
    }

    // Standard URL (HTTP, HTTPS, or existing Blob URL)
    const link = document.createElement('a');
    link.href = mediaUrl;
    link.download = finalName;
    link.target = '_blank';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      document.body.removeChild(link);
    }, 1500);

    if (window.App && window.App.showToast) {
      window.App.showToast(`Saved: ${finalName}`, 'success');
    }
  } catch (err) {
    console.warn('downloadMedia fallback triggered:', err);
    try {
      const win = window.open(mediaUrl, '_blank');
      if (!win) {
        window.location.href = mediaUrl;
      }
    } catch (e2) {
      alert(`Could not download file: ${err.message}`);
    }
  }
};

// Global bootstrap
document.addEventListener('DOMContentLoaded', () => {
  window.App = new AppController();
});
