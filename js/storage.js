/**
 * iWeather Storage & Real-Time Sync Engine
 * Dual Architecture:
 * 1. BroadcastChannel + LocalStorage for zero-config instant multi-tab sync.
 * 2. Firebase Firestore for seamless live cross-device internet sync.
 */

class StorageEngine {
  constructor() {
    this.STORAGE_KEY = 'iweather_messages_v1';
    this.SETTINGS_KEY = 'iweather_user_settings_v1';
    this.channel = null;
    this.messageListeners = [];
    this.statusListeners = [];
    this.isFirebaseActive = false;
    this.firestoreDb = null;
    this.unsubscribeFirestore = null;

    this.initBroadcastChannel();
    this.checkAndInitFirebase();
  }

  // Initialize BroadcastChannel for instant local testing across windows/tabs
  initBroadcastChannel() {
    if ('BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel('iweather_sync_channel');
        this.channel.onmessage = (event) => {
          const { type, payload } = event.data || {};
          if (type === 'NEW_MESSAGE') {
            this.notifyMessageListeners(payload);
            if (window.VaultNotification) {
              window.VaultNotification.notifyMessage(payload);
            }
          } else if (type === 'MESSAGES_READ') {
            const reader = (payload && payload.reader) || 'girl';
            const messages = this.getMessages();
            let changed = false;
            messages.forEach((m) => {
              if (m.sender !== reader && m.status !== 'read') {
                m.status = 'read';
                changed = true;
              }
            });
            if (changed) {
              localStorage.setItem(this.STORAGE_KEY, JSON.stringify(messages));
            }
            this.notifyMessageListeners(messages, true);
            if (window.DuoChatInstance && window.DuoChatInstance.markTicksAsReadInDOM) {
              window.DuoChatInstance.markTicksAsReadInDOM();
            }
          } else if (type === 'HEART_BURST') {
            if (window.App && window.App.triggerHeartShower) {
              window.App.triggerHeartShower(false);
            }
          } else if (type === 'STATUS_UPDATE') {
            this.notifyStatusListeners(payload);
          } else if (type === 'CLEAR_HISTORY') {
            localStorage.removeItem(this.STORAGE_KEY);
            this.notifyMessageListeners(null, true);
          }
        };
      } catch (err) {
        console.warn('BroadcastChannel error:', err);
      }
    }
  }

  // Check and dynamically initialize Firebase if config is present
  async checkAndInitFirebase() {
    const config = window.getFirebaseConfig ? window.getFirebaseConfig() : null;
    if (!config || !config.apiKey) {
      console.log('iWeather: Running in Local Sync Mode (BroadcastChannel + LocalStorage)');
      return;
    }

    try {
      // Dynamically load Firebase Compat scripts if not already loaded
      if (!window.firebase) {
        await this.loadScript('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
        await this.loadScript('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js');
      }

      if (window.firebase && !window.firebase.apps.length) {
        window.firebase.initializeApp(config);
      }

      this.firestoreDb = window.firebase.firestore();
      this.isFirebaseActive = true;
      console.log('iWeather: Firebase Firestore Connected Successfully!');

      // Listen to Firestore real-time updates
      this.listenFirestore();
    } catch (err) {
      console.warn('Firebase init error, fallback to local sync:', err);
      this.isFirebaseActive = false;
    }
  }

  loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  listenFirestore() {
    if (!this.firestoreDb) return;
    try {
      const appStartTime = Date.now() - 5000;
      let initialLoadDone = false;

      this.unsubscribeFirestore = this.firestoreDb
        .collection('duo_chat')
        .orderBy('timestamp', 'asc')
        .onSnapshot((snapshot) => {
          const remoteMessages = [];
          snapshot.forEach((doc) => {
            remoteMessages.push({ id: doc.id, ...doc.data() });
          });
          // Cache to localStorage
          localStorage.setItem(this.STORAGE_KEY, JSON.stringify(remoteMessages));
          // Notify UI listeners
          this.notifyMessageListeners(remoteMessages, true);

          // If this is after initial load, detect new incoming messages
          if (initialLoadDone) {
            snapshot.docChanges().forEach((change) => {
              if (change.type === 'added') {
                const data = change.doc.data();
                if (data && data.timestamp > appStartTime) {
                  if (window.VaultNotification) {
                    window.VaultNotification.notifyMessage(data);
                  }
                }
              }
            });
          }
          initialLoadDone = true;
        }, (error) => {
          console.warn('Firestore onSnapshot error:', error);
        });
    } catch (e) {
      console.warn('Failed to listen to Firestore', e);
    }
  }

  // Get local message list
  getMessages() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  // Save new message
  async saveMessage(msg) {
    if (!msg.status) msg.status = 'sent';
    const messages = this.getMessages();
    messages.push(msg);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(messages));

    // Broadcast locally
    if (this.channel) {
      this.channel.postMessage({ type: 'NEW_MESSAGE', payload: msg });
    }

    // Save to Firebase Firestore if active
    if (this.isFirebaseActive && this.firestoreDb) {
      try {
        await this.firestoreDb.collection('duo_chat').doc(msg.id).set(msg);
      } catch (err) {
        console.warn('Error saving to Firestore:', err);
      }
    }

    return msg;
  }

  // Mark all unread messages from partner as read (triggers blue ticks!)
  async markAllAsReadBy(readerRole) {
    if (!readerRole) return;
    const messages = this.getMessages();
    let hasUnread = false;

    messages.forEach((m) => {
      if (m.sender !== readerRole && m.status !== 'read') {
        m.status = 'read';
        hasUnread = true;
      }
    });

    if (hasUnread) {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(messages));

      // Broadcast read receipt locally
      if (this.channel) {
        this.channel.postMessage({ type: 'MESSAGES_READ', payload: { reader: readerRole } });
      }

      // Update in Firebase Firestore
      if (this.isFirebaseActive && this.firestoreDb) {
        try {
          const snapshot = await this.firestoreDb.collection('duo_chat')
            .where('status', '==', 'sent')
            .get();

          const batch = this.firestoreDb.batch();
          snapshot.forEach((doc) => {
            const data = doc.data();
            if (data && data.sender !== readerRole) {
              batch.update(doc.ref, { status: 'read' });
            }
          });
          await batch.commit();
        } catch (e) {
          console.warn('Firestore batch mark read error:', e);
        }
      }

      this.notifyMessageListeners(messages, true);
    }
  }

  // Send High-Five / Nudge Burst
  sendNudgeBurst() {
    if (this.channel) {
      this.channel.postMessage({ type: 'HEART_BURST' });
    }
    const nudgeMsg = {
      id: 'nudge_' + Date.now(),
      sender: window.App ? window.App.currentRole : 'boy',
      type: 'heart',
      text: 'Sent a High-Five! ⚡👊',
      timestamp: Date.now(),
      status: 'sent'
    };
    this.saveMessage(nudgeMsg);
  }

  // Clear chat history
  async clearAllHistory() {
    localStorage.removeItem(this.STORAGE_KEY);
    if (this.channel) {
      this.channel.postMessage({ type: 'CLEAR_HISTORY' });
    }
    if (this.isFirebaseActive && this.firestoreDb) {
      try {
        const snapshot = await this.firestoreDb.collection('duo_chat').get();
        const batch = this.firestoreDb.batch();
        snapshot.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
      } catch (e) {
        console.warn('Failed clearing Firestore history', e);
      }
    }
  }

  // Settings
  getSettings() {
    const defaults = {
      boyName: 'Karthikuuuuu',
      girlName: 'JeanGrey',
      boyMood: 'Vibing ⚡',
      girlMood: 'Sup! 👾',
      boyAvatar: 'https://res.cloudinary.com/dmdrn1bge/image/upload/v1791767000/peter_ayhcrs.png',
      girlAvatar: 'https://res.cloudinary.com/dmdrn1bge/image/upload/v1791767001/jean_u8zloq.png',
      chatWallpaper: 'https://res.cloudinary.com/dmdrn1bge/image/upload/v1791767002/Split-Panel_Portrait__Wary_Woman_Concerned_Man_y0v1vu.png',
      anniversaryDate: '2023-06-15',
      notificationsEnabled: true,
      callNotificationsEnabled: true
    };

    try {
      const saved = localStorage.getItem(this.SETTINGS_KEY);
      if (!saved) return defaults;
      const parsed = JSON.parse(saved);
      return {
        ...defaults,
        ...parsed,
        // Ensure new DP URLs take effect even if older settings were cached
        boyAvatar: parsed.boyAvatar || defaults.boyAvatar,
        girlAvatar: parsed.girlAvatar || defaults.girlAvatar,
        chatWallpaper: parsed.chatWallpaper || defaults.chatWallpaper,
        notificationsEnabled: parsed.notificationsEnabled !== undefined ? parsed.notificationsEnabled : true,
        callNotificationsEnabled: parsed.callNotificationsEnabled !== undefined ? parsed.callNotificationsEnabled : true
      };
    } catch (e) {
      return defaults;
    }
  }

  saveSettings(settings) {
    localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(settings));
    if (this.channel) {
      this.channel.postMessage({ type: 'STATUS_UPDATE', payload: settings });
    }
  }

  // Listeners
  onMessage(callback) {
    this.messageListeners.push(callback);
  }

  onStatusChange(callback) {
    this.statusListeners.push(callback);
  }

  notifyMessageListeners(msg, isFullList = false) {
    this.messageListeners.forEach((cb) => cb(msg, isFullList));
  }

  notifyStatusListeners(settings) {
    this.statusListeners.forEach((cb) => cb(settings));
  }
}

window.Storage = new StorageEngine();
