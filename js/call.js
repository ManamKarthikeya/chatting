/**
 * iWeather WebRTC Internet Voice & Video Calling Engine
 * Direct Peer-to-Peer encrypted audio and video calling between Karthikuuuuu and JeanGrey.
 * Includes multi-port TURN relay (Metered OpenRelay), hardware audio bridge, and clock-drift resilience.
 */

class DuoCallManager {
  constructor() {
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.currentCallType = 'voice'; // 'voice' or 'video'
    this.callState = 'idle'; // 'idle' | 'calling' | 'incoming' | 'connected'

    // Timer & Ringtone
    this.callDurationTimer = null;
    this.callSeconds = 0;
    this.ringtoneOscillator = null;
    this.audioContext = null;

    // Web Audio hardware direct output bridge
    this.webAudioContext = null;
    this.audioSourceNode = null;
    this.audioGainNode = null;

    // Signal tracking
    this.processedDocIds = new Set();
    this.candidateQueue = [];

    // DOM Elements
    this.btnVoiceCall = document.getElementById('btn-voice-call');
    this.btnVideoCall = document.getElementById('btn-video-call');

    // Modals
    this.incomingModal = document.getElementById('incoming-call-modal');
    this.incomingName = document.getElementById('incoming-call-name');
    this.incomingType = document.getElementById('incoming-call-type');
    this.incomingAvatar = document.getElementById('incoming-call-avatar');
    this.btnIncomingAccept = document.getElementById('btn-incoming-accept');
    this.btnIncomingDecline = document.getElementById('btn-incoming-decline');

    this.activeModal = document.getElementById('active-call-modal');
    this.activeName = document.getElementById('active-call-name');
    this.activeAvatar = document.getElementById('active-call-avatar');
    this.activeAudioView = document.getElementById('active-audio-view');
    this.activeTimer = document.getElementById('active-call-timer');
    this.activeTypeBadge = document.getElementById('active-call-type-badge');

    this.remoteAudio = document.getElementById('remote-audio');
    this.remoteVideo = document.getElementById('remote-video');
    this.localVideo = document.getElementById('local-video');

    // Active Controls
    this.btnMuteMic = document.getElementById('btn-call-mute-mic');
    this.btnToggleCam = document.getElementById('btn-call-toggle-cam');
    this.btnCallPanic = document.getElementById('btn-call-panic');
    this.btnCallEnd = document.getElementById('btn-call-end');

    this.isMicMuted = false;
    this.isCamOff = false;

    this.init();
  }

  init() {
    this.bindEvents();
    this.setupSignaling();
  }

  bindEvents() {
    // Header Call Buttons
    if (this.btnVoiceCall) {
      this.btnVoiceCall.addEventListener('click', () => {
        this.prewarmAudioHardware();
        this.startCall('voice');
      });
    }
    if (this.btnVideoCall) {
      this.btnVideoCall.addEventListener('click', () => {
        this.prewarmAudioHardware();
        this.startCall('video');
      });
    }

    // Incoming Call Controls
    if (this.btnIncomingAccept) {
      this.btnIncomingAccept.addEventListener('click', () => {
        this.prewarmAudioHardware();
        this.acceptIncomingCall();
      });
    }
    if (this.btnIncomingDecline) {
      this.btnIncomingDecline.addEventListener('click', () => this.declineIncomingCall());
    }

    // Active Call Controls
    if (this.btnMuteMic) {
      this.btnMuteMic.addEventListener('click', () => this.toggleMuteMic());
    }
    if (this.btnToggleCam) {
      this.btnToggleCam.addEventListener('click', () => this.toggleCam());
    }
    if (this.btnCallEnd) {
      this.btnCallEnd.addEventListener('click', () => this.endCall(true));
    }

    // Emergency Panic on Call (hangs up & flips to weather!)
    if (this.btnCallPanic) {
      this.btnCallPanic.addEventListener('click', () => {
        this.endCall(true);
        if (window.App) window.App.openWeather(true);
      });
    }
  }

  prewarmAudioHardware() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        if (!this.webAudioContext || this.webAudioContext.state === 'closed') {
          this.webAudioContext = new AudioCtx();
        }
        if (this.webAudioContext.state === 'suspended') {
          this.webAudioContext.resume();
        }
      }
      if (this.remoteAudio) {
        this.remoteAudio.muted = false;
        this.remoteAudio.volume = 1.0;
        this.remoteAudio.setAttribute('playsinline', '');
        this.remoteAudio.setAttribute('webkit-playsinline', '');
        const p = this.remoteAudio.play();
        if (p !== undefined) p.catch(() => {});
      }
    } catch (e) {
      console.warn('Audio pre-warm notice:', e);
    }
  }

  setupSignaling() {
    // 1. BroadcastChannel for local testing
    if (window.Storage && window.Storage.channel) {
      window.Storage.channel.addEventListener('message', (event) => {
        const { type, payload } = event.data || {};
        if (type && payload) this.processSignal(type, payload);
      });
    }

    // 2. Firestore signaling for cross-device internet calling
    this.initFirestoreSignaling();
  }

  initFirestoreSignaling() {
    const checkDb = () => {
      if (window.Storage && window.Storage.firestoreDb && window.Storage.isFirebaseActive) {
        this.listenFirestoreSignals();
      } else {
        setTimeout(checkDb, 2000);
      }
    };
    checkDb();
  }

  listenFirestoreSignals() {
    if (!window.Storage || !window.Storage.firestoreDb) return;
    try {
      // 90 second buffer prevents clock drift between phones from dropping signals
      const startTime = Date.now() - 90000;
      window.Storage.firestoreDb
        .collection('duo_signals')
        .where('timestamp', '>', startTime)
        .onSnapshot((snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const docId = change.doc.id;
              if (this.processedDocIds.has(docId)) return;
              this.processedDocIds.add(docId);

              const data = change.doc.data();
              if (data && data.type && data.payload) {
                // Ignore stale signals from older sessions (> 2 minutes old)
                if (data.timestamp && Date.now() - data.timestamp > 120000) return;
                this.processSignal(data.type, data.payload);
              }
            }
          });
        }, (err) => {
          console.warn('Firestore signaling error:', err);
        });
    } catch (e) {
      console.warn('Could not listen to Firestore signals:', e);
    }
  }

  processSignal(type, payload) {
    if (!type || !payload) return;
    const myRole = window.App ? window.App.currentRole : 'boy';
    if (payload.sender === myRole) return;

    switch (type) {
      case 'WEBRTC_OFFER':
        this.handleRemoteOffer(payload);
        break;
      case 'WEBRTC_ANSWER':
        this.handleRemoteAnswer(payload);
        break;
      case 'WEBRTC_CANDIDATE':
        this.handleRemoteCandidate(payload);
        break;
      case 'WEBRTC_DECLINE':
        this.handleCallDeclined();
        break;
      case 'WEBRTC_END':
        this.handleCallEndedByPeer();
        break;
    }
  }

  sendSignal(type, payload) {
    const data = {
      ...payload,
      sender: window.App ? window.App.currentRole : 'boy',
      timestamp: Date.now()
    };

    // Broadcast locally
    if (window.Storage && window.Storage.channel) {
      window.Storage.channel.postMessage({ type, payload: data });
    }

    // Send over Firebase Firestore if active
    if (window.Storage && window.Storage.isFirebaseActive && window.Storage.firestoreDb) {
      try {
        // Essential: Convert any non-plain objects to plain JSON to prevent Firestore rejection
        const safeData = JSON.parse(JSON.stringify(data));
        window.Storage.firestoreDb.collection('duo_signals').add({
          type: type,
          payload: safeData,
          sender: safeData.sender,
          timestamp: Date.now()
        }).catch((err) => {
          console.warn('Firestore add signal error:', err);
        });
      } catch (e) {
        console.warn('Error serializing signal for Firestore:', e);
      }
    }
  }

  getIceServers() {
    return [
      // Google Global STUNs
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      // Mozilla STUN
      { urls: 'stun:stun.services.mozilla.com' },
      // Metered OpenRelay STUN & TURN Servers (Bypasses Carrier NAT & Strict Mobile Firewalls)
      { urls: 'stun:openrelay.metered.ca:80' },
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      {
        urls: 'turn:openrelay.metered.ca:443?transport=tcp',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      }
    ];
  }

  createPeerConnection() {
    const config = {
      iceServers: this.getIceServers(),
      iceCandidatePoolSize: 10
    };

    this.peerConnection = new RTCPeerConnection(config);

    // ICE Candidate gathering
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        const candData = event.candidate.toJSON
          ? event.candidate.toJSON()
          : {
              candidate: event.candidate.candidate,
              sdpMid: event.candidate.sdpMid,
              sdpMLineIndex: event.candidate.sdpMLineIndex,
              usernameFragment: event.candidate.usernameFragment
            };
        this.sendSignal('WEBRTC_CANDIDATE', { candidate: candData });
      }
    };

    // Track handling
    this.peerConnection.ontrack = (event) => {
      console.log('WebRTC ontrack received:', event.track ? event.track.kind : 'unknown');
      let stream = event.streams && event.streams[0];
      if (!stream) {
        if (!this.remoteStream) {
          this.remoteStream = new MediaStream();
        }
        this.remoteStream.addTrack(event.track);
        stream = this.remoteStream;
      }
      this.attachRemoteMedia(stream, event.track ? event.track.kind : null);
    };

    // ICE Connection state
    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection.iceConnectionState;
      console.log('ICE Connection state:', state);
      if (state === 'connected' || state === 'completed') {
        this.onCallConnected();
        if (this.activeTypeBadge) {
          this.activeTypeBadge.textContent = this.currentCallType === 'video' ? 'HD Video Connected 🔒' : 'Encrypted Voice Connected 🔒';
        }
      } else if (state === 'checking') {
        if (this.activeTypeBadge) {
          this.activeTypeBadge.textContent = 'Connecting Voice...';
        }
      } else if (state === 'failed') {
        console.warn('ICE connection failed! Attempting restart...');
        if (this.activeTypeBadge) {
          this.activeTypeBadge.textContent = 'Reconnecting...';
        }
        if (this.peerConnection.restartIce) {
          this.peerConnection.restartIce();
        }
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection.connectionState;
      console.log('PeerConnection state change:', state);
      if (state === 'connected') {
        this.onCallConnected();
      } else if (['disconnected', 'closed'].includes(state)) {
        this.endCall(false);
      }
    };
  }

  attachRemoteMedia(stream, trackKind) {
    if (!stream) return;
    this.remoteStream = stream;

    // 1. Dedicated Remote Audio Pipe (Always unmuted, full volume)
    if (this.remoteAudio) {
      this.remoteAudio.srcObject = stream;
      this.remoteAudio.volume = 1.0;
      this.remoteAudio.muted = false;
      this.remoteAudio.setAttribute('playsinline', '');
      this.remoteAudio.setAttribute('webkit-playsinline', '');
      const p = this.remoteAudio.play();
      if (p !== undefined) {
        p.catch((err) => console.warn('remoteAudio.play() info:', err));
      }
    }

    // 2. Web Audio Direct Speaker Bridge (Guarantees loud speaker sound even if HTML audio element is throttled)
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx && stream.getAudioTracks().length > 0) {
        if (!this.webAudioContext || this.webAudioContext.state === 'closed') {
          this.webAudioContext = new AudioCtx();
        }
        if (this.webAudioContext.state === 'suspended') {
          this.webAudioContext.resume();
        }
        if (!this.audioSourceNode) {
          this.audioSourceNode = this.webAudioContext.createMediaStreamSource(stream);
          this.audioGainNode = this.webAudioContext.createGain();
          this.audioGainNode.gain.value = 1.0;
          this.audioSourceNode.connect(this.audioGainNode);
          this.audioGainNode.connect(this.webAudioContext.destination);
          console.log('WebAudio Hardware Bridge: Connected to device output');
        }
      }
    } catch (e) {
      console.warn('WebAudio direct bridge notice:', e);
    }

    // 3. Remote Video Element (Only for video calls; keep video element muted so it doesn't conflict with remoteAudio)
    if (this.currentCallType === 'video' && this.remoteVideo) {
      this.remoteVideo.srcObject = stream;
      this.remoteVideo.muted = true; // remoteAudio carries the unmuted sound
      this.remoteVideo.play().catch((err) => console.warn('remoteVideo play failed:', err));
    }
  }

  async startCall(type) {
    if (this.callState !== 'idle') return;

    this.currentCallType = type;
    this.callState = 'calling';

    try {
      const isVideo = type === 'video';
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: { ideal: true },
            noiseSuppression: { ideal: true },
            autoGainControl: { ideal: true }
          },
          video: isVideo ? { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' } : false
        });
      } catch (e) {
        // Fallback to basic audio
        this.localStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: isVideo ? true : false
        });
      }

      // Ensure local microphone tracks are enabled
      if (this.localStream) {
        this.localStream.getAudioTracks().forEach((track) => {
          track.enabled = true;
          console.log('Local mic track active:', track.label);
        });
      }

      if (this.localVideo && isVideo) {
        this.localVideo.srcObject = this.localStream;
      }

      this.createPeerConnection();

      // Add tracks to connection
      this.localStream.getTracks().forEach((track) => {
        this.peerConnection.addTrack(track, this.localStream);
      });

      // Create Offer with explicit audio/video receive flags
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: isVideo
      });
      await this.peerConnection.setLocalDescription(offer);

      // Send Offer to Partner as clean serializable plain object
      const safeOffer = {
        type: offer.type,
        sdp: offer.sdp
      };

      this.sendSignal('WEBRTC_OFFER', {
        offer: safeOffer,
        callType: type,
        partnerName: window.App && window.App.currentRole === 'girl' ? 'JeanGrey' : 'Karthikuuuuu'
      });

      // Show Active Modal in 'Calling...' state
      this.showActiveCallModal(true);
      this.playRingtone(true); // outgoing calling chime

    } catch (err) {
      alert(`Could not access ${type === 'video' ? 'camera/microphone' : 'microphone'}: ${err.message}`);
      this.callState = 'idle';
    }
  }

  async handleRemoteOffer(payload) {
    if (this.callState !== 'idle') {
      this.sendSignal('WEBRTC_DECLINE', {});
      return;
    }

    this.pendingOffer = payload.offer;
    this.currentCallType = payload.callType || 'voice';

    const isCallsAllowed = window.VaultNotification ? window.VaultNotification.isCallsAllowed() : true;
    const isChatActive = window.App && window.App.activeView === 'chat';

    // If calls toggle is OFF and user is not inside chat: Silent Stealth Mode!
    if (!isCallsAllowed && !isChatActive) {
      this.callState = 'incoming_silent';
      this.pendingCallPayload = payload;
      console.log('🔇 Call held in Silent Stealth mode until chat is opened');
      return;
    }

    this.callState = 'incoming';

    const isGirl = window.App && window.App.currentRole === 'girl';
    const callerRole = payload.sender || (isGirl ? 'boy' : 'girl');
    const settings = window.Storage ? window.Storage.getSettings() : {};
    let callerName = callerRole === 'girl' ? (settings.girlName || 'Jean') : (settings.boyName || 'Karthik');
    if (callerRole === 'girl' && callerName.toLowerCase().includes('jean')) callerName = 'Jean';
    if (callerRole === 'boy' && callerName.toLowerCase().includes('karthik')) callerName = 'Karthik';

    const partnerAvatar = callerRole === 'girl'
      ? (settings.girlAvatar || 'https://res.cloudinary.com/dmdrn1bge/image/upload/v1791767001/jean_u8zloq.png')
      : (settings.boyAvatar || 'https://res.cloudinary.com/dmdrn1bge/image/upload/v1791767000/peter_ayhcrs.png');

    if (this.incomingName) this.incomingName.textContent = `${callerName} calling you`;
    if (this.incomingAvatar) {
      this.incomingAvatar.innerHTML = `<img src="${partnerAvatar}" class="call-avatar-img" alt="${callerName}">`;
    }
    if (this.incomingType) this.incomingType.textContent = `Incoming ${this.currentCallType === 'video' ? 'Video' : 'Voice'} Call...`;

    if (isChatActive) {
      if (this.incomingModal) this.incomingModal.classList.add('active');
    }

    if (isCallsAllowed) {
      this.playRingtone(false);
      if (window.VaultNotification) {
        window.VaultNotification.notifyIncomingCall(payload);
      }
    }
  }

  presentPendingCall() {
    if (this.callState === 'incoming_silent' && this.pendingCallPayload) {
      const payload = this.pendingCallPayload;
      this.callState = 'incoming';

      const isGirl = window.App && window.App.currentRole === 'girl';
      const callerRole = payload.sender || (isGirl ? 'boy' : 'girl');
      const settings = window.Storage ? window.Storage.getSettings() : {};
      let callerName = callerRole === 'girl' ? (settings.girlName || 'Jean') : (settings.boyName || 'Karthik');
      if (callerRole === 'girl' && callerName.toLowerCase().includes('jean')) callerName = 'Jean';
      if (callerRole === 'boy' && callerName.toLowerCase().includes('karthik')) callerName = 'Karthik';

      const partnerAvatar = callerRole === 'girl'
        ? (settings.girlAvatar || 'https://res.cloudinary.com/dmdrn1bge/image/upload/v1791767001/jean_u8zloq.png')
        : (settings.boyAvatar || 'https://res.cloudinary.com/dmdrn1bge/image/upload/v1791767000/peter_ayhcrs.png');

      if (this.incomingName) this.incomingName.textContent = `${callerName} calling you`;
      if (this.incomingAvatar) {
        this.incomingAvatar.innerHTML = `<img src="${partnerAvatar}" class="call-avatar-img" alt="${callerName}">`;
      }
      if (this.incomingType) this.incomingType.textContent = `Incoming ${this.currentCallType === 'video' ? 'Video' : 'Voice'} Call...`;
      if (this.incomingModal) this.incomingModal.classList.add('active');
      this.playRingtone(false);
    }
  }

  async acceptIncomingCall() {
    this.stopRingtone();
    if (this.incomingModal) this.incomingModal.classList.remove('active');

    this.callState = 'connected';
    const isVideo = this.currentCallType === 'video';

    try {
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: { ideal: true },
            noiseSuppression: { ideal: true },
            autoGainControl: { ideal: true }
          },
          video: isVideo ? { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' } : false
        });
      } catch (e) {
        this.localStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: isVideo ? true : false
        });
      }

      if (this.localStream) {
        this.localStream.getAudioTracks().forEach((track) => {
          track.enabled = true;
          console.log('Local mic track active:', track.label);
        });
      }

      if (this.localVideo && isVideo) {
        this.localVideo.srcObject = this.localStream;
      }

      this.createPeerConnection();

      this.localStream.getTracks().forEach((track) => {
        this.peerConnection.addTrack(track, this.localStream);
      });

      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(this.pendingOffer));
      await this.flushCandidateQueue();

      const answer = await this.peerConnection.createAnswer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: isVideo
      });
      await this.peerConnection.setLocalDescription(answer);

      const safeAnswer = {
        type: answer.type,
        sdp: answer.sdp
      };

      this.sendSignal('WEBRTC_ANSWER', { answer: safeAnswer });

      this.showActiveCallModal(false);
      this.onCallConnected();

    } catch (err) {
      alert(`Failed to answer call: ${err.message}`);
      this.declineIncomingCall();
    }
  }

  declineIncomingCall() {
    this.stopRingtone();
    if (this.incomingModal) this.incomingModal.classList.remove('active');
    this.sendSignal('WEBRTC_DECLINE', {});
    this.callState = 'idle';
  }

  async handleRemoteAnswer(payload) {
    this.stopRingtone();
    if (!this.peerConnection) return;
    try {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(payload.answer));
      await this.flushCandidateQueue();
      this.onCallConnected();
    } catch (err) {
      console.warn('Error setting remote answer:', err);
    }
  }

  async handleRemoteCandidate(payload) {
    if (!payload || !payload.candidate) return;
    if (!this.peerConnection || !this.peerConnection.remoteDescription || !this.peerConnection.remoteDescription.type) {
      this.candidateQueue.push(payload.candidate);
      return;
    }
    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(payload.candidate));
    } catch (err) {
      console.warn('Error adding ICE candidate:', err);
    }
  }

  async flushCandidateQueue() {
    if (!this.peerConnection || !this.peerConnection.remoteDescription) return;
    while (this.candidateQueue.length > 0) {
      const cand = this.candidateQueue.shift();
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(cand));
      } catch (err) {
        console.warn('Error flushing ICE candidate:', err);
      }
    }
  }

  handleCallDeclined() {
    this.stopRingtone();
    if (window.App) window.App.showToast('Call declined or busy', 'error');
    this.endCall(false);
  }

  handleCallEndedByPeer() {
    this.stopRingtone();
    if (window.VaultNotification) {
      window.VaultNotification.hideBanner();
    }
    if (this.callState === 'incoming_silent') {
      this.callState = 'idle';
      this.pendingCallPayload = null;
      return;
    }
    if (window.App) window.App.showToast('Call ended', 'info');
    this.endCall(false);
  }

  onCallConnected() {
    this.stopRingtone();
    this.callState = 'connected';
    this.startCallTimer();

    if (this.activeTimer && this.activeTimer.textContent === 'Calling...') {
      this.activeTimer.textContent = '00:00';
    }
    if (this.activeTypeBadge) {
      this.activeTypeBadge.textContent = this.currentCallType === 'video' ? 'HD Video Connected 🔒' : 'Encrypted Voice Connected 🔒';
    }
  }

  showActiveCallModal(isCalling) {
    if (!this.activeModal) return;

    const isGirl = window.App && window.App.currentRole === 'girl';
    const partnerName = isGirl ? 'Karthikuuuuu' : 'JeanGrey';
    const partnerAvatar = isGirl
      ? 'https://res.cloudinary.com/dmdrn1bge/image/upload/v1791767000/peter_ayhcrs.png'
      : 'https://res.cloudinary.com/dmdrn1bge/image/upload/v1791767001/jean_u8zloq.png';

    if (this.activeName) this.activeName.textContent = partnerName;
    if (this.activeAvatar) {
      this.activeAvatar.innerHTML = `<img src="${partnerAvatar}" class="call-avatar-img" alt="${partnerName}">`;
    }
    if (this.activeTimer) this.activeTimer.textContent = isCalling ? 'Calling...' : '00:00';
    if (this.activeTypeBadge) {
      this.activeTypeBadge.textContent = isCalling
        ? 'Calling...'
        : (this.currentCallType === 'video' ? 'HD Video Call' : 'Encrypted Voice Call');
    }

    if (this.currentCallType === 'video') {
      if (this.remoteVideo) this.remoteVideo.style.display = 'block';
      if (this.localVideo) this.localVideo.style.display = 'block';
      if (this.activeAudioView) this.activeAudioView.style.display = 'none';
      if (this.btnToggleCam) this.btnToggleCam.style.display = 'inline-flex';
    } else {
      if (this.remoteVideo) this.remoteVideo.style.display = 'none';
      if (this.localVideo) this.localVideo.style.display = 'none';
      if (this.activeAudioView) this.activeAudioView.style.display = 'flex';
      if (this.btnToggleCam) this.btnToggleCam.style.display = 'none';
    }

    this.activeModal.classList.add('active');
  }

  startCallTimer() {
    clearInterval(this.callDurationTimer);
    this.callSeconds = 0;
    this.callDurationTimer = setInterval(() => {
      this.callSeconds++;
      const mins = Math.floor(this.callSeconds / 60).toString().padStart(2, '0');
      const secs = (this.callSeconds % 60).toString().padStart(2, '0');
      if (this.activeTimer) this.activeTimer.textContent = `${mins}:${secs}`;
    }, 1000);
  }

  toggleMuteMic() {
    if (!this.localStream) return;
    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      this.isMicMuted = !this.isMicMuted;
      audioTrack.enabled = !this.isMicMuted;
      if (this.btnMuteMic) {
        this.btnMuteMic.style.background = this.isMicMuted ? '#f43f5e' : 'rgba(255, 255, 255, 0.15)';
      }
    }
  }

  toggleCam() {
    if (!this.localStream) return;
    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      this.isCamOff = !this.isCamOff;
      videoTrack.enabled = !this.isCamOff;
      if (this.btnToggleCam) {
        this.btnToggleCam.style.background = this.isCamOff ? '#f43f5e' : 'rgba(255, 255, 255, 0.15)';
      }
    }
  }

  endCall(notifyPeer = true) {
    this.stopRingtone();
    if (window.VaultNotification) {
      window.VaultNotification.hideBanner();
    }
    clearInterval(this.callDurationTimer);

    if (notifyPeer && this.callState !== 'idle') {
      this.sendSignal('WEBRTC_END', {});
    }

    // Disconnect Web Audio Hardware Bridge
    if (this.audioSourceNode) {
      try { this.audioSourceNode.disconnect(); } catch (e) {}
      this.audioSourceNode = null;
    }
    if (this.audioGainNode) {
      try { this.audioGainNode.disconnect(); } catch (e) {}
      this.audioGainNode = null;
    }
    if (this.webAudioContext && this.webAudioContext.state !== 'closed') {
      try { this.webAudioContext.close(); } catch (e) {}
      this.webAudioContext = null;
    }

    // Stop all media tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach((track) => track.stop());
      this.remoteStream = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    if (this.incomingModal) this.incomingModal.classList.remove('active');
    if (this.activeModal) this.activeModal.classList.remove('active');

    if (this.remoteAudio) this.remoteAudio.srcObject = null;
    if (this.remoteVideo) this.remoteVideo.srcObject = null;
    if (this.localVideo) this.localVideo.srcObject = null;
    this.candidateQueue = [];

    this.callState = 'idle';
    this.isMicMuted = false;
    this.isCamOff = false;

    if (this.btnMuteMic) this.btnMuteMic.style.background = 'rgba(255, 255, 255, 0.15)';
    if (this.btnToggleCam) this.btnToggleCam.style.background = 'rgba(255, 255, 255, 0.15)';
  }

  // Synthesized Pleasant Audio Ringtone
  playRingtone(isOutgoing = false) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.audioContext = new AudioCtx();

      const freq1 = isOutgoing ? 440 : 480;
      const freq2 = isOutgoing ? 480 : 520;

      const osc1 = this.audioContext.createOscillator();
      const osc2 = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      osc1.frequency.value = freq1;
      osc2.frequency.value = freq2;

      gainNode.gain.setValueAtTime(0.08, this.audioContext.currentTime);

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      osc1.start();
      osc2.start();

      this.ringtoneOscillator = { osc1, osc2, gainNode };
    } catch (e) {}
  }

  stopRingtone() {
    try {
      if (this.ringtoneOscillator) {
        this.ringtoneOscillator.osc1.stop();
        this.ringtoneOscillator.osc2.stop();
        this.ringtoneOscillator = null;
      }
      if (this.audioContext && this.audioContext.state !== 'closed') {
        this.audioContext.close();
        this.audioContext = null;
      }
    } catch (e) {}
  }
}

window.DuoCallManager = DuoCallManager;
