/**
 * iWeather - Firebase Configuration & Secrets
 * 
 * To enable live sync between two phones over the internet:
 * 1. Go to https://console.firebase.google.com (100% free)
 * 2. Create a project named "iWeather"
 * 3. Add a Web App (</>) and copy the firebaseConfig object below, or paste it in the in-app settings!
 */

window.DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyDOPmno_SWAUSxgA4pMV3vLTwqpByvL0zg",
  authDomain: "iweather-duo.firebaseapp.com",
  projectId: "iweather-duo",
  storageBucket: "iweather-duo.firebasestorage.app",
  messagingSenderId: "899275202572",
  appId: "1:899275202572:web:1ed37f38dc308d1c4a0e29",
  measurementId: "G-05TTCCFZX7"
};

// Check if user has saved custom Firebase config in localStorage
window.getFirebaseConfig = function() {
  try {
    const saved = localStorage.getItem('iweather_firebase_config');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.apiKey && parsed.projectId) return parsed;
    }
  } catch (e) {
    console.warn('Error reading saved Firebase config', e);
  }
  return window.DEFAULT_FIREBASE_CONFIG.apiKey ? window.DEFAULT_FIREBASE_CONFIG : null;
};
