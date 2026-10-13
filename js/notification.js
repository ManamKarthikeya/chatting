/**
 * iWeather Stealth Duo Notification Manager
 * Handles disguised Mysore weather alerts ("Mysore temperature is hot / cool"),
 * atmospheric urgent call advisories, Service Worker mobile push notifications,
 * Web Audio harmonic chimes, and respects Silent Stealth mode.
 */

class VaultNotificationManager {
  constructor() {
    this.banner = document.getElementById('vault-notification-banner');
    this.bannerAvatar = document.getElementById('notif-banner-img');
    this.bannerTitle = document.getElementById('notif-banner-title');
    this.bannerText = document.getElementById('notif-banner-text');
    this.bannerActions = document.getElementById('notif-banner-actions');
    this.bannerBtnOpen = document.getElementById('notif-banner-btn-open');
    this.bannerBtnClose = document.getElementById('notif-banner-btn-close');

    this.bannerTimeout = null;
    this.currentCallPayload = null;
    this.audioCtx = null;
    this.notifiedMessageIds = new Set();

    this.init();
  }

  init() {
    if (this.bannerBtnClose) {
      this.bannerBtnClose.addEventListener('click', (e) => {
        e.stopPropagation();
        this.hideBanner();
      });
    }

    if (this.banner) {
      this.banner.addEventListener('click', () => {
        this.handleBannerClick();
      });
    }

    // Auto-prompt for system notifications on first user tap or pattern draw
    const autoPrompt = async () => {
      if ('Notification' in window && Notification.permission === 'default') {
        try {
          await Notification.requestPermission();
        } catch (e) {}
      }
      window.removeEventListener('pointerdown', autoPrompt);
      window.removeEventListener('click', autoPrompt);
    };
    window.addEventListener('pointerdown', autoPrompt, { once: true });
    window.addEventListener('click', autoPrompt, { once: true });

    // Auto-request notification permission if previously enabled
    this.checkPermissionStatus();
  }

  checkPermissionStatus() {
    if ('Notification' in window) {
      return Notification.permission;
    }
    return 'unsupported';
  }

  async requestPermission() {
    if ('Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        return perm;
      } catch (e) {
        console.warn('Notification permission error:', e);
      }
    }
    return 'denied';
  }

  isNotificationsAllowed() {
    const settings = window.Storage ? window.Storage.getSettings() : {};
    return settings.notificationsEnabled !== false;
  }

  isCallsAllowed() {
    const settings = window.Storage ? window.Storage.getSettings() : {};
    return settings.notificationsEnabled !== false && settings.callNotificationsEnabled !== false;
  }

  // Disguised weather alert text resolver
  // If Jean sends -> recipient sees: "Mysore temperature is hot"
  // If Karthik sends -> recipient sees: "Mysore temperature is cool"
  getDisguisedMessageAlert(senderRole) {
    if (senderRole === 'girl') {
      return {
        title: 'iWeather Alert',
        body: 'Mysore temperature is hot',
        icon: 'icons/icon-192.png'
      };
    } else {
      return {
        title: 'iWeather Alert',
        body: 'Mysore temperature is cool',
        icon: 'icons/icon-192.png'
      };
    }
  }

  // Disguised call advisory resolver
  // If Jean calls -> recipient sees: "Mysore thunderstorm alert ⚡"
  // If Karthik calls -> recipient sees: "Mysore cold front warning ❄️"
  getDisguisedCallAlert(callerRole) {
    if (callerRole === 'girl') {
      return {
        title: 'iWeather Urgent Advisory',
        body: 'Mysore thunderstorm alert ⚡',
        icon: 'icons/icon-192.png'
      };
    } else {
      return {
        title: 'iWeather Urgent Advisory',
        body: 'Mysore cold front warning ❄️',
        icon: 'icons/icon-192.png'
      };
    }
  }

  // 1. Inbound & Outbound Message Handler (Supports both accounts on this single device)
  notifyMessage(msg) {
    if (!msg) return;

    // Check if notifications are enabled
    if (!this.isNotificationsAllowed()) {
      console.log('🔇 Message received silently (Notifications toggled OFF)');
      return;
    }

    // Deduplicate identical message ID alerts
    if (msg.id) {
      if (this.notifiedMessageIds.has(msg.id)) return;
      this.notifiedMessageIds.add(msg.id);
      setTimeout(() => this.notifiedMessageIds.delete(msg.id), 25000);
    }

    // Camouflage text resolver:
    // If msg is from Jean ('girl') -> "Mysore temperature is hot" (Karthik's notification)
    // If msg is from Karthik ('boy') -> "Mysore temperature is cool" (Jean's notification)
    const camouflage = this.getDisguisedMessageAlert(msg.sender);

    // Play subtle pleasant chime
    this.playChime('message');

    // Haptic pulse
    if (navigator.vibrate) {
      try { navigator.vibrate([150, 80, 150]); } catch (e) {}
    }

    // Show floating in-app banner for both accounts
    this.showBanner({
      title: camouflage.title,
      text: camouflage.body,
      avatar: camouflage.icon,
      type: 'message',
      role: msg.sender
    });

    // Trigger Phone System Notification (works on Android lock screen & status bar)
    this.sendSystemNotification(camouflage.title, camouflage.body, camouflage.icon, {
      tag: 'iweather-radar-' + (msg.id || Date.now()),
      type: 'message'
    });
  }

  // 2. Inbound Call Handler
  notifyIncomingCall(payload) {
    if (!payload) return;

    if (!this.isCallsAllowed()) {
      console.log('🔇 Call received silently (Calls toggled OFF)');
      return;
    }

    const myRole = window.App ? window.App.currentRole : 'boy';
    const callerRole = payload.sender || (myRole === 'boy' ? 'girl' : 'boy');
    if (callerRole === myRole) return;

    const settings = window.Storage ? window.Storage.getSettings() : {};
    let callerName = callerRole === 'girl' ? (settings.girlName || 'Jean') : (settings.boyName || 'Karthik');
    if (callerRole === 'girl' && callerName.toLowerCase().includes('jean')) callerName = 'Jean';
    if (callerRole === 'boy' && callerName.toLowerCase().includes('karthik')) callerName = 'Karthik';

    const callerAvatar = callerRole === 'girl'
      ? (settings.girlAvatar || 'https://res.cloudinary.com/dmdrn1bge/image/upload/v1791767001/jean_u8zloq.png')
      : (settings.boyAvatar || 'https://res.cloudinary.com/dmdrn1bge/image/upload/v1791767000/peter_ayhcrs.png');

    const callType = payload.callType === 'video' ? 'Video' : 'Voice';
    this.currentCallPayload = payload;

    // Play subtle chime
    this.playChime('message');

    // Show floating in-app banner
    this.showBanner({
      title: `${callerName} is calling you`,
      text: `Incoming ${callType} Call...`,
      avatar: callerAvatar,
      type: 'call',
      role: callerRole
    });

    // High priority system notification (shows on lockscreen, status bar, and recent apps)
    this.sendSystemNotification(
      `${callerName} calling you`,
      `Incoming ${callType} Call 📞 Tap to answer`,
      callerAvatar,
      {
        tag: 'iweather-incoming-call',
        type: 'call',
        requireInteraction: true,
        vibrate: [500, 200, 500, 200, 500],
        actions: [
          { action: 'answer', title: 'Answer' },
          { action: 'decline', title: 'Decline' }
        ]
      }
    );
  }

  // Display top floating glass banner
  showBanner({ title, text, avatar, type = 'message', role }) {
    if (!this.banner) return;

    clearTimeout(this.bannerTimeout);

    if (this.bannerAvatar) {
      this.bannerAvatar.src = avatar || 'icons/icon-192.png';
    }
    if (this.bannerTitle) {
      this.bannerTitle.textContent = title;
    }
    if (this.bannerText) {
      this.bannerText.textContent = text;
    }

    // Configure action buttons
    if (this.bannerActions) {
      const myRole = window.App ? window.App.currentRole : 'boy';

      if (type === 'call') {
        this.bannerActions.innerHTML = `
          <button class="notif-call-btn notif-accept-btn" id="notif-btn-answer" title="Answer Radar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg>
          </button>
          <button class="notif-call-btn notif-decline-btn" id="notif-btn-decline" title="Dismiss">&times;</button>
        `;

        const ansBtn = document.getElementById('notif-btn-answer');
        const decBtn = document.getElementById('notif-btn-decline');

        if (ansBtn) {
          ansBtn.onclick = (e) => {
            e.stopPropagation();
            this.hideBanner();
            if (window.App) window.App.openChat(myRole);
            if (window.DuoCallManagerInstance) {
              window.DuoCallManagerInstance.acceptIncomingCall();
            }
          };
        }

        if (decBtn) {
          decBtn.onclick = (e) => {
            e.stopPropagation();
            this.hideBanner();
            if (window.DuoCallManagerInstance) {
              window.DuoCallManagerInstance.declineIncomingCall();
            }
          };
        }
      } else {
        this.bannerActions.innerHTML = `
          <button class="notif-open-badge" title="View Alert">View</button>
          <button class="notif-close-cross" title="Dismiss">&times;</button>
        `;
        const openBtn = this.bannerActions.querySelector('.notif-open-badge');
        const closeCross = this.bannerActions.querySelector('.notif-close-cross');

        if (openBtn) {
          openBtn.onclick = (e) => {
            e.stopPropagation();
            this.handleBannerClick();
          };
        }

        if (closeCross) {
          closeCross.onclick = (e) => {
            e.stopPropagation();
            this.hideBanner();
          };
        }
      }
    }

    this.banner.classList.add('active');

    // Auto-hide messages after 5 seconds
    if (type === 'message') {
      this.bannerTimeout = setTimeout(() => {
        this.hideBanner();
      }, 5000);
    }
  }

  hideBanner() {
    if (!this.banner) return;
    clearTimeout(this.bannerTimeout);
    this.banner.classList.remove('active');
  }

  handleBannerClick() {
    this.hideBanner();
    if (window.App) {
      const myRole = window.App.currentRole || 'boy';
      window.App.openChat(myRole);
    }
  }

  // System Push / Android Notification
  async sendSystemNotification(title, body, iconUrl, optionsExtra = {}) {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch (e) {}
    }
    if (Notification.permission !== 'granted') return;

    const notifOptions = {
      body: body,
      icon: iconUrl || 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      tag: optionsExtra.tag || 'iweather-alert',
      renotify: true,
      requireInteraction: true,
      silent: false,
      vibrate: optionsExtra.vibrate || [300, 100, 300, 100, 300],
      actions: optionsExtra.actions || [
        { action: 'open', title: 'Open' }
      ],
      data: {
        url: './',
        type: optionsExtra.type || 'message'
      }
    };

    // Priority 1: ServiceWorker showNotification (Mandatory for Android Chrome & Installed PWAs)
    if ('serviceWorker' in navigator) {
      try {
        const registration = await Promise.race([
          navigator.serviceWorker.ready,
          new Promise((_, reject) => setTimeout(() => reject(new Error('SW timeout')), 2500))
        ]);
        if (registration && registration.showNotification) {
          await registration.showNotification(title, notifOptions);
          return;
        }
      } catch (swErr) {
        console.warn('SW showNotification error, trying fallback:', swErr);
      }
    }

    // Priority 2: Standard Desktop Window Notification
    try {
      const n = new Notification(title, notifOptions);
      n.onclick = () => {
        window.focus();
        if (window.App) {
          window.App.openChat(window.App.currentRole || 'boy');
        }
        n.close();
      };
    } catch (e) {
      console.warn('Desktop Notification constructor failed:', e);
    }
  }

  // Audio synthesis: Clean harmonic chime for incoming messages
  playChime(type = 'message') {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      if (!this.audioCtx || this.audioCtx.state === 'closed') {
        this.audioCtx = new AudioCtx();
      }

      const ctx = this.audioCtx;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      if (type === 'message') {
        // High dual-tone soft glass ping (880Hz -> 1320Hz)
        const now = ctx.currentTime;
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sine';
        osc2.type = 'sine';
        osc1.frequency.setValueAtTime(880, now); // A5
        osc2.frequency.setValueAtTime(1320, now + 0.08); // E6

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.exponentialRampToValueAtTime(0.12, now + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now + 0.08);
        osc1.stop(now + 0.45);
        osc2.stop(now + 0.45);
      }
    } catch (e) {
      // Audio playback restrictions on un-interacted tabs
    }
  }

  // Trigger test notification for Settings testing
  async testNotification() {
    const myRole = window.App ? window.App.currentRole : 'boy';
    const partnerRole = myRole === 'boy' ? 'girl' : 'boy';

    // Disguised alert preview based on partner role
    const camouflage = this.getDisguisedMessageAlert(partnerRole);

    this.playChime('message');
    this.showBanner({
      title: camouflage.title,
      text: camouflage.body,
      avatar: camouflage.icon,
      type: 'message',
      role: partnerRole
    });

    await this.sendSystemNotification(camouflage.title, camouflage.body, camouflage.icon, {
      tag: 'iweather-test',
      type: 'message'
    });
  }
}

// Global bootstrap
document.addEventListener('DOMContentLoaded', () => {
  window.VaultNotification = new VaultNotificationManager();
});
