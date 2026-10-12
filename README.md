# ⛅ iWeather (Stealth Duo PWA)

A Progressive Web App (PWA) disguised as an atmospheric enterprise weather radar. When added to a phone's home screen, it looks, installs, and behaves like an authentic weather tool. Behind the interactive 3x3 pattern lock lies a private, secure duo sanctuary for two close best friends.

---

## 🔐 The Pattern Lock Matrix

The lock screen presents a 3x3 dot matrix disguised as a localized radar calibration tool:

```
[ 1 ]   [ 2 ]   [ 3 ]
[ 4 ]   [ 5 ]   [ 6 ]
[ 7 ]   [ 8 ]   [ 9 ]
```

| Pattern Code | Action / Destination | What Happens |
| :--- | :--- | :--- |
| **`4 ➔ 5 ➔ 2 ➔ 1 ➔ 7`** | **👧 JeanGrey's Private Chat** | Unlocks the private chat from JeanGrey's perspective. |
| **`5 ➔ 6 ➔ 3 ➔ 2 ➔ 1 ➔ 4 ➔ 7`** | **👦 Karthik's Private Chat** | Unlocks the private chat from Karthikuuuuu's perspective. |
| **`8 ➔ 5 ➔ 6 ➔ 9`** | **⛅ Weather Dashboard** | Directly opens the full weather forecast. |
| **Any Wrong / Random Gesture** | **⛅ Camouflage Decoy** | Smoothly displays *"Calibrating radar coordinates..."* and opens the **real Weather Dashboard**. An intruder never sees "Access Denied" or suspects anything hidden! |

---

## 🛡️ Stealth & Privacy Features

1. **Add to Home Screen (PWA)**:
   * Installs with the name **iWeather** and a modern glassmorphic weather radar icon.
   * Runs in standalone full-screen mode (no browser address bar or navigation buttons).
2. **Instant Emergency Panic Button**:
   * Inside the chat, tap the cloud icon in the top header (or press `Escape` on desktop) to instantly swap back to the real Weather Dashboard in 0.05 seconds with zero trace.
3. **Realistic Weather Screen**:
   * Real-time hourly forecast, 7-day outlook, air quality index, humidity, wind radar, and global city search powered by live weather feeds.
4. **Discreet Triple-Tap Return**:
   * To return to the pattern lock from the weather screen, tap the `iWeather` logo 3 times or tap the subtle lock icon.

---

## ⚡ Secret Duo Bestie Features

* **Internet Voice Calling (📞)**: Real-time peer-to-peer encrypted voice calls with audio waveform and call timer.
* **HD Video Calling (📹)**: Face-to-face video calling with local camera PIP preview.
* **Emergency Panic on Calls**: Tap the cloud button on any call to instantly end the call, mute camera/mic, and flip straight to the weather screen in 0.05s!
* **Universal Media & Files**: Send images (with lightbox zoom), videos (in-chat video player), and documents (PDF, DOCX, ZIP with direct download).
* **Voice Note Recorder**: Record audio notes with duration counter and visualizer.
* **Electric Nudge / High-Five Burst**: Tap the `⚡` button to shower neon sparks across both screens.
* **Custom Nicknames & Moods**: Set custom names ("JeanGrey", "Karthikuuuuu") and status vibes ("Vibing ⚡", "Sup! 👾").

---

## 🚀 How to Run Locally

You can test right now by starting a local static server:

```bash
# Option 1: Using npx serve
npx serve .

# Option 2: Using python
python -m http.server 3000
```

Open `http://localhost:3000` (or `http://localhost:5000`) in **two browser windows side by side**:
* In Window 1: Draw `5 ➔ 6 ➔ 3 ➔ 2 ➔ 1 ➔ 4 ➔ 7` (Boy)
* In Window 2: Draw `4 ➔ 5 ➔ 2 ➔ 1 ➔ 7` (Girl)
* Chat live, send photos, voice notes, and test the floating heart bursts!

---

## ☁️ Setting Up Cloud Sync with Firebase (For Phone-to-Phone)

1. Go to [Firebase Console](https://console.firebase.google.com/) (100% free forever).
2. Click **Create Project** ➔ Name it `iWeather`.
3. In Project Settings, click **Add Web App** (`</>`).
4. Enable **Cloud Firestore** in test mode (read/write enabled).
5. Copy your Firebase configuration JSON and paste it into **Private Space Settings (⚙️) ➔ Live Cloud Sync**.

---

## 🌐 Deploying to Vercel (100% Free HTTPS)

1. Push this directory to your GitHub repository.
2. Go to [Vercel](https://vercel.com) and click **Add New Project** ➔ Import your repository.
3. Click **Deploy**.
4. Open the deployed `https://your-app.vercel.app` link on both phones in Safari (iPhone) or Chrome (Android) and select **"Add to Home Screen"**!
