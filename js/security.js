/**
 * iWeather Security Manager
 * Manages auto-lock on recent apps / background switching.
 * Safe against in-app dialogs (file picker, microphone/camera permission prompts, and ongoing calls).
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
    // When visibility state changes (recent apps, app minimized, screen turned off)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        if (this.isEligibleToLock()) {
          if (window.App && window.App.lockVault) {
            window.App.lockVault();
          }
        }
      }
    });

    // Mobile OS pagehide event (fired when mobile OS moves app to recent / background)
    window.addEventListener('pagehide', () => {
      if (this.isEligibleToLock()) {
        if (window.App && window.App.lockVault) {
          window.App.lockVault();
        }
      }
    });
  }

  isEligibleToLock() {
    // Don't lock if not in private chat
    if (!this.isChatActive()) return false;

    // Don't lock if user is selecting a photo or file
    if (window.isSelectingFile) return false;

    // Don't lock if a call is ongoing or being dialed/answered
    if (window.DuoCallManagerInstance && window.DuoCallManagerInstance.callState !== 'idle') {
      return false;
    }

    return true;
  }

  isChatActive() {
    return window.App && window.App.activeView === 'chat';
  }
}

// Global bootstrap
document.addEventListener('DOMContentLoaded', () => {
  window.VaultSecurity = new VaultSecurityManager();
});
