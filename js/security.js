/**
 * iWeather Security Manager
 * Manages auto-lock on recent apps / background switching.
 * Screenshot and screen recording protection disabled as requested.
 */

class VaultSecurityManager {
  constructor() {
    this.init();
  }

  init() {
    this.bindWindowFocusListeners();
  }

  // Auto-Lock on Recent Apps & Background Switching
  bindWindowFocusListeners() {
    this.blurLockTimeout = null;

    // When window loses focus (e.g. mobile recent apps gesture, task switching)
    window.addEventListener('blur', () => {
      if (this.isChatActive()) {
        clearTimeout(this.blurLockTimeout);
        this.blurLockTimeout = setTimeout(() => {
          if (!document.hasFocus() || document.visibilityState === 'hidden') {
            if (this.isChatActive() && window.App && window.App.lockVault) {
              window.App.lockVault();
            }
          }
        }, 350);
      }
    });

    // When visibility state changes (recent apps, app minimized, screen turned off)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        if (this.isChatActive()) {
          if (window.App && window.App.lockVault) {
            window.App.lockVault();
          }
        }
      }
    });

    // Mobile OS pagehide event (fired when mobile OS moves app to recent / background)
    window.addEventListener('pagehide', () => {
      if (this.isChatActive()) {
        if (window.App && window.App.lockVault) {
          window.App.lockVault();
        }
      }
    });
  }

  isChatActive() {
    return window.App && window.App.activeView === 'chat';
  }
}

// Global bootstrap
document.addEventListener('DOMContentLoaded', () => {
  window.VaultSecurity = new VaultSecurityManager();
});
