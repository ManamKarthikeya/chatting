/**
 * iWeather WebRTC Internet Voice & Video Calling Engine
 * Direct Peer-to-Peer encrypted audio and video calling between Karthikuuuuu and JeanGrey.
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
      this.btnVoiceCall.addEventListener('click', () => this.startCall('voice'));
    }
    if (this.btnVideoCall) {
      this.btnVideoCall.addEventListener('click', () => this.startCall('video'));
    }

    // Incoming Call Controls
    if (this.btnIncomingAccept) {
      this.btnIncomingAccept.addEventListener('click', () => this.acceptIncomingCall());
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
        setTimeout(checkDb, 2500);
      }
    };
    checkDb();
  }

  listenFirestoreSignals() {
    if (!window.Storage || !window.Storage.firestoreDb) return;
    try {
      const startTime = Date.now() - 10000;
      window.Storage.firestoreDb
        .collection('duo_signals')
        .where('timestamp', '>', startTime)
        .onSnapshot((snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const data = change.doc.data();
              if (data && data.type && data.payload) {
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
      sender: window.App ? window.App.currentRole : 'boy'
    };

    // Broadcast locally
    if (window.Storage && window.Storage.channel) {
      window.Storage.channel.postMessage({ type, payload: data });
    }

    // Send over Firebase Firestore if active
    if (window.Storage && window.Storage.isFirebaseActive && window.Storage.firestoreDb) {
      try {
        window.Storage.firestoreDb.collection('duo_signals').add({
          type: type,
          payload: data,
          sender: data.sender,
          timestamp: Date.now()
        });
      } catch (e) {
        console.warn('Error sending signal to Firestore:', e);
      }
    }
  }

  createPeerConnection() {
    const config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    this.peerConnection = new RTCPeerConnection(config);

    // ICE Candidate
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal('WEBRTC_CANDIDATE', { candidate: event.candidate });
      }
    };

    // Remote Track
    this.peerConnection.ontrack = (event) => {
      this.remoteStream = event.streams[0];
      if (this.remoteVideo) {
        this.remoteVideo.srcObject = this.remoteStream;
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      if (this.peerConnection.connectionState === 'connected') {
        this.onCallConnected();
      } else if (['disconnected', 'failed', 'closed'].includes(this.peerConnection.connectionState)) {
        this.endCall(false);
      }
    };
  }

  async startCall(type) {
    if (this.callState !== 'idle') return;

    this.currentCallType = type;
    this.callState = 'calling';

    try {
      // Get Media
      const isVideo = type === 'video';
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: isVideo ? { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' } : false
      });

      if (this.localVideo && isVideo) {
        this.localVideo.srcObject = this.localStream;
      }

      this.createPeerConnection();

      // Add tracks
      this.localStream.getTracks().forEach((track) => {
        this.peerConnection.addTrack(track, this.localStream);
      });

      // Create Offer
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      // Send Offer to Partner
      this.sendSignal('WEBRTC_OFFER', {
        offer: offer,
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
      // Busy
      this.sendSignal('WEBRTC_DECLINE', {});
      return;
    }

    this.pendingOffer = payload.offer;
    this.currentCallType = payload.callType || 'voice';
    this.callState = 'incoming';

    // Show Incoming Modal
    const callerName = payload.partnerName || (window.App && window.App.currentRole === 'girl' ? 'Karthikuuuuu' : 'JeanGrey');
    const partnerAvatar = callerName.includes('Jean')
      ? 'https://res.cloudinary.com/dmdrn1bge/image/upload/v1791767001/jean_u8zloq.png'
      : 'https://res.cloudinary.com/dmdrn1bge/image/upload/v1791767000/peter_ayhcrs.png';

    if (this.incomingName) this.incomingName.textContent = callerName;
    if (this.incomingAvatar) {
      this.incomingAvatar.innerHTML = `<img src="${partnerAvatar}" class="call-avatar-img" alt="${callerName}">`;
    }
    if (this.incomingType) this.incomingType.textContent = `Incoming ${this.currentCallType === 'video' ? 'Video' : 'Voice'} Call...`;
    if (this.incomingModal) this.incomingModal.classList.add('active');

    this.playRingtone(false); // incoming ringtone
  }

  async acceptIncomingCall() {
    this.stopRingtone();
    if (this.incomingModal) this.incomingModal.classList.remove('active');

    this.callState = 'connected';
    const isVideo = this.currentCallType === 'video';

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: isVideo ? { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' } : false
      });

      if (this.localVideo && isVideo) {
        this.localVideo.srcObject = this.localStream;
      }

      this.createPeerConnection();

      this.localStream.getTracks().forEach((track) => {
        this.peerConnection.addTrack(track, this.localStream);
      });

      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(this.pendingOffer));
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      this.sendSignal('WEBRTC_ANSWER', { answer });

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
      this.onCallConnected();
    } catch (err) {
      console.warn('Error setting remote answer:', err);
    }
  }

  async handleRemoteCandidate(payload) {
    if (!this.peerConnection || !payload.candidate) return;
    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(payload.candidate));
    } catch (err) {
      console.warn('Error adding ICE candidate:', err);
    }
  }

  handleCallDeclined() {
    this.stopRingtone();
    if (window.App) window.App.showToast('Call declined or busy', 'error');
    this.endCall(false);
  }

  handleCallEndedByPeer() {
    this.stopRingtone();
    if (window.App) window.App.showToast('Call ended', 'info');
    this.endCall(false);
  }

  onCallConnected() {
    this.stopRingtone();
    this.callState = 'connected';
    this.startCallTimer();

    if (this.activeTimer) this.activeTimer.textContent = '00:00';
    if (this.activeTypeBadge) {
      this.activeTypeBadge.textContent = this.currentCallType === 'video' ? 'HD Video Call' : 'Encrypted Voice Call';
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
      this.activeTypeBadge.textContent = this.currentCallType === 'video' ? 'Video Call' : 'Voice Call';
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
    clearInterval(this.callDurationTimer);

    if (notifyPeer && this.callState !== 'idle') {
      this.sendSignal('WEBRTC_END', {});
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

    this.callState = 'idle';
    this.isMicMuted = false;
    this.isCamOff = false;

    if (this.btnMuteMic) this.btnMuteMic.style.background = 'rgba(255, 255, 255, 0.15)';
    if (this.btnToggleCam) this.btnToggleCam.style.background = 'rgba(255, 255, 255, 0.15)';
  }

  // Synthesized Pleasant Audio Ringtone (Zero MP3 files needed!)
  playRingtone(isOutgoing = false) {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      this.audioContext = new AudioContext();

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
    } catch (e) {
      // AudioContext autoplay restriction fallback
    }
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
