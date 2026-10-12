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
      status: 'read'
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
      anniversaryDate: '2023-06-15'
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
        chatWallpaper: parsed.chatWallpaper || defaults.chatWallpaper
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
