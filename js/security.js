/**
 * iWeather Anti-Screenshot & Screen Recording Defense Suite
 * Multi-Tier Security:
 * 1. App Switcher / Blur Blackout Curtain (Protects OS task switcher previews & mobile swipe captures)
 * 2. Keyboard Interception (PrintScreen, Snipping tool, Save, Print, DevTools)
 * 3. Screen Recording API Interception (getDisplayMedia blocker)
 * 4. Context Menu, Drag & Long-press Selection Prevention
 * 5. Clipboard Clearing on Capture Trigger
 */

class VaultSecurityManager {
  constructor() {
    this.privacyCurtain = document.getElementById('privacy-curtain');
    this.isCurtainActive = false;
    this.curtainHideTimeout = null;

    this.init();
  }

  init() {
    this.bindWindowFocusListeners();
    this.bindKeyboardDefense();
    this.bindContextMenuDefense();
    this.bindScreenRecordingDefense();
  }

  // 1. App Switcher / Blur Blackout Curtain & Direct Auto-Lock on Recent Apps
  bindWindowFocusListeners() {
    this.blurLockTimeout = null;

    // When window loses focus (e.g. mobile recent apps gesture, task switching, Alt+Tab)
    window.addEventListener('blur', () => {
      if (this.isChatActive()) {
        this.showPrivacyCurtain();
        // If blurred (e.g. recent apps carousel active or home screen pull), lock to pattern screen after short buffer
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

    // When visibility state changes (recent apps, app minimized, screen turned off, tab switched)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        if (this.isChatActive()) {
          this.showPrivacyCurtain();
          // Directly lock the vault so recent apps preview and next opening asks for the pattern lock!
          if (window.App && window.App.lockVault) {
            window.App.lockVault();
          }
        }
      } else if (document.visibilityState === 'visible') {
        this.scheduleHidePrivacyCurtain();
      }
    });

    // Mobile OS pagehide event (fired when mobile OS moves app to recent / background)
    window.addEventListener('pagehide', () => {
      if (this.isChatActive()) {
        this.showPrivacyCurtain();
        if (window.App && window.App.lockVault) {
          window.App.lockVault();
        }
      }
    });

    // When focus returns
    window.addEventListener('focus', () => {
      clearTimeout(this.blurLockTimeout);
      this.scheduleHidePrivacyCurtain();
    });
  }

  showPrivacyCurtain() {
    if (!this.privacyCurtain) return;
    clearTimeout(this.curtainHideTimeout);
    this.privacyCurtain.classList.add('active');
    this.isCurtainActive = true;
  }

  scheduleHidePrivacyCurtain() {
    if (!this.privacyCurtain) return;
    clearTimeout(this.curtainHideTimeout);
    this.curtainHideTimeout = setTimeout(() => {
      if (document.hasFocus() && document.visibilityState === 'visible') {
        this.privacyCurtain.classList.remove('active');
        this.isCurtainActive = false;
      }
    }, 250);
  }

  // 2. Keyboard Screenshot & Recording Interception
  bindKeyboardDefense() {
    const handleScreenshotKey = (e) => {
      const isScreenshot =
        e.key === 'PrintScreen' ||
        e.keyCode === 44 ||
        (e.ctrlKey && e.key === 'p') || // Print page
        (e.ctrlKey && e.key === 's') || // Save page
        (e.altKey && e.key === 'PrintScreen') ||
        (e.metaKey && e.shiftKey && (e.key === '3' || e.key === '4' || e.key === '5')); // Mac screenshot

      if (isScreenshot && this.isChatActive()) {
        e.preventDefault();
        e.stopPropagation();

        // Flash privacy curtain immediately
        this.showPrivacyCurtain();
        setTimeout(() => this.scheduleHidePrivacyCurtain(), 1400);

        // Wipe clipboard
        this.wipeClipboard();

        if (window.App && window.App.showToast) {
          window.App.showToast('🔒 Screenshots are blocked in this vault', 'error');
        }
        return false;
      }

      // Block Developer Tools / Inspect Element shortcuts inside chat
      const isDevTools =
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) ||
        (e.ctrlKey && (e.key === 'u' || e.key === 'U'));

      if (isDevTools && this.isChatActive()) {
        e.preventDefault();
        e.stopPropagation();
        if (window.App && window.App.showToast) {
          window.App.showToast('🔒 Developer inspection restricted', 'error');
        }
        return false;
      }
    };

    window.addEventListener('keydown', handleScreenshotKey, true);
    window.addEventListener('keyup', handleScreenshotKey, true);
  }

  // Clear clipboard to avoid any captured snapshot data remaining on the clipboard
  async wipeClipboard() {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText('');
      }
    } catch (e) {
      // Ignore clipboard permission errors
    }
  }

  // 3. Prevent Screen Recording Extensions / Display Capture API
  bindScreenRecordingDefense() {
    if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
      const originalGetDisplayMedia = navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getDisplayMedia = (constraints) => {
        if (this.isChatActive()) {
          if (window.App && window.App.showToast) {
            window.App.showToast('⚠️ Screen recording blocked by Duo Security', 'error');
          }
          if (window.App && window.App.openWeather) {
            window.App.openWeather(true); // Emergency camouflage flip!
          }
          return Promise.reject(new DOMException('Screen recording is strictly prohibited for confidential spaces.', 'NotAllowedError'));
        }
        return originalGetDisplayMedia(constraints);
      };
    }
  }

  // 4. Right Click, Long Press Context Menu & Drag Protection
  bindContextMenuDefense() {
    document.addEventListener('contextmenu', (e) => {
      if (this.isChatActive()) {
        // Allow right-click only inside inputs/textareas for pasting
        if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
        e.preventDefault();
      }
    });

    document.addEventListener('dragstart', (e) => {
      if (this.isChatActive()) {
        e.preventDefault();
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
