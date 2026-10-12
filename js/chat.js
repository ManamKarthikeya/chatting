/**
 * iWeather Private Duo Chat Controller
 * Manages romantic 1-on-1 private messaging, photo sharing, voice notes,
 * love heart bursts, and instant panic camouflage.
 */

class DuoChat {
  constructor() {
    this.messagesContainer = document.getElementById('chat-messages-container');
    this.inputArea = document.getElementById('chat-input-text');
    this.sendBtn = document.getElementById('btn-send-message');
    this.panicCamouflageBtn = document.getElementById('btn-panic-camouflage');
    this.lockBtn = document.getElementById('btn-lock-chat');
    this.settingsBtn = document.getElementById('btn-chat-settings');
    this.attachFileBtn = document.getElementById('btn-attach-file') || document.getElementById('btn-attach-photo');
    this.fileInput = document.getElementById('file-media-input') || document.getElementById('file-photo-input');
    this.recordVoiceBtn = document.getElementById('btn-record-voice');

    // Partner UI elements
    this.partnerNameEl = document.getElementById('chat-partner-name');
    this.partnerMoodEl = document.getElementById('chat-partner-mood');
    this.partnerAvatarEl = document.getElementById('chat-partner-avatar');
    this.milestoneTextEl = document.getElementById('milestone-text-display');
    this.roleBadgeEl = document.getElementById('role-badge-display');

    // Settings Modal
    this.settingsModal = document.getElementById('chat-settings-modal');
    this.closeSettingsBtn = document.getElementById('btn-close-settings');
    this.settingPartnerNameInput = document.getElementById('setting-partner-name');
    this.settingUserMoodInput = document.getElementById('setting-user-mood');
    this.settingMilestoneDateInput = document.getElementById('setting-milestone-date');
    this.settingFirebaseInput = document.getElementById('setting-firebase-json');
    this.saveFirebaseBtn = document.getElementById('btn-save-firebase-config');
    this.clearHistoryBtn = document.getElementById('btn-clear-chat-history');

    // Notification Toggles & Controls
    this.settingNotifToggle = document.getElementById('setting-notifications-toggle');
    this.settingCallsToggle = document.getElementById('setting-calls-toggle');
    this.btnTestNotif = document.getElementById('btn-test-notif');
    this.btnRequestPerm = document.getElementById('btn-request-notif-perm');
    this.btnPermText = document.getElementById('btn-perm-text');
    this.notifStatusCallout = document.getElementById('notif-status-callout');
    this.notifStatusText = document.getElementById('notif-status-text');
    this.settingsRoleSubtitle = document.getElementById('settings-role-subtitle');

    // Audio recording state
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isRecording = false;
    this.recordingStartTime = 0;
    this.recordingTimerInterval = null;

    // Emoji Picker Elements
    this.emojiToggleBtn = document.getElementById('btn-emoji-toggle');
    this.emojiTray = document.getElementById('emoji-picker-tray');
    this.emojiCloseBtn = document.getElementById('btn-close-emoji-tray');
    this.emojiSearchInput = document.getElementById('emoji-search-input');
    this.emojiSearchClearBtn = document.getElementById('btn-clear-emoji-search');
    this.emojiCategoryNav = document.getElementById('emoji-category-nav');
    this.emojiGridViewport = document.getElementById('emoji-grid-viewport');
    this.currentEmojiCategory = 'duo';

    this.init();
  }

  init() {
    this.bindEvents();
    this.setupStorageListeners();
    this.initEmojiPicker();
  }

  bindEvents() {
    // Send message on click
    if (this.sendBtn) {
      this.sendBtn.addEventListener('click', () => this.handleSendMessage());
    }

    // Send on Enter (unless shift-enter)
    if (this.inputArea) {
      this.inputArea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.handleSendMessage();
        }
      });
    }

    // Emergency Panic Camouflage Button
    if (this.panicCamouflageBtn) {
      this.panicCamouflageBtn.addEventListener('click', () => {
        if (window.App) {
          window.App.openWeather(true); // Instant switch without transition delay!
        }
      });
    }

    // Lock button
    if (this.lockBtn) {
      this.lockBtn.addEventListener('click', () => {
        if (window.App) window.App.openPattern();
      });
    }

    // 3-Lines Hamburger Menu
    const menuBtn = document.getElementById('btn-chat-menu');
    const dropdownMenu = document.getElementById('chat-dropdown-menu');

    if (menuBtn && dropdownMenu) {
      menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownMenu.classList.toggle('active');
      });

      document.addEventListener('click', (e) => {
        if (!dropdownMenu.contains(e.target) && e.target !== menuBtn) {
          dropdownMenu.classList.remove('active');
        }
      });

      dropdownMenu.querySelectorAll('.dropdown-item').forEach((item) => {
        item.addEventListener('click', () => {
          dropdownMenu.classList.remove('active');
        });
      });
    }

    // Attach Photos, Videos, and Files
    if (this.attachFileBtn && this.fileInput) {
      this.attachFileBtn.addEventListener('click', () => this.fileInput.click());
      this.fileInput.addEventListener('change', (e) => this.handleMediaSelected(e));
    }

    // Voice Note Recording
    if (this.recordVoiceBtn) {
      this.recordVoiceBtn.addEventListener('click', () => this.toggleVoiceRecording());
    }

    // Settings Modal
    if (this.settingsBtn && this.settingsModal) {
      this.settingsBtn.addEventListener('click', () => this.openSettings());
    }

    if (this.closeSettingsBtn && this.settingsModal) {
      this.closeSettingsBtn.addEventListener('click', () => this.closeSettings());
    }

    // Edit Mood quick click
    const editMoodBtn = document.getElementById('btn-edit-mood');
    if (editMoodBtn) {
      editMoodBtn.addEventListener('click', () => this.openSettings());
    }

    // Save Firebase keys button
    if (this.saveFirebaseBtn) {
      this.saveFirebaseBtn.addEventListener('click', () => this.saveFirebaseConfig());
    }

    // Clear history
    if (this.clearHistoryBtn) {
      this.clearHistoryBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear your private chat history?')) {
          if (window.Storage) window.Storage.clearAllHistory();
          this.closeSettings();
        }
      });
    }

    // Notification Toggles & Actions
    if (this.settingNotifToggle) {
      this.settingNotifToggle.addEventListener('change', () => this.updateNotifUIStatus());
    }
    if (this.settingCallsToggle) {
      this.settingCallsToggle.addEventListener('change', () => this.updateNotifUIStatus());
    }
    if (this.btnTestNotif) {
      this.btnTestNotif.addEventListener('click', () => {
        if (window.VaultNotification) {
          window.VaultNotification.testNotification();
        }
      });
    }
    if (this.btnRequestPerm) {
      this.btnRequestPerm.addEventListener('click', async () => {
        if (window.VaultNotification) {
          const res = await window.VaultNotification.requestPermission();
          if (res === 'granted') {
            if (this.btnPermText) this.btnPermText.textContent = 'Push Enabled ✓';
            if (window.App) window.App.showToast('Push notifications enabled!', 'success');
          } else {
            if (window.App) window.App.showToast(`Notification status: ${res}`, 'info');
          }
        }
      });
    }

    // Tap partner avatar in header to view full resolution DP in Lightbox!
    const avatarWrap = document.getElementById('chat-avatar-wrap');
    if (avatarWrap) {
      avatarWrap.addEventListener('click', () => {
        if (window.App && window.App.openLightbox && this.currentPartnerAvatarUrl) {
          window.App.openLightbox(this.currentPartnerAvatarUrl, (this.currentPartnerName || 'Partner') + ' DP.png');
        }
      });
    }
  }

  setupStorageListeners() {
    if (!window.Storage) return;

    window.Storage.onMessage((msg, isFullList) => {
      if (isFullList) {
        this.renderAllMessages();
      } else if (msg) {
        this.appendMessageElement(msg);
        this.scrollToBottom();
      }
    });

    window.Storage.onStatusChange((settings) => {
      this.applySettingsToUI(settings);
    });
  }

  // Called when logging in as 'girl' or 'boy'
  setRole(role) {
    this.currentRole = role; // 'girl' or 'boy'
    const settings = window.Storage ? window.Storage.getSettings() : {};

    const boyAvatarUrl = settings.boyAvatar || 'https://res.cloudinary.com/dmdrn1bge/image/upload/v1791767000/peter_ayhcrs.png';
    const girlAvatarUrl = settings.girlAvatar || 'https://res.cloudinary.com/dmdrn1bge/image/upload/v1791767001/jean_u8zloq.png';

    if (role === 'girl') {
      // She (JeanGrey) is chatting with Boy (Karthikuuuuu)
      const name = settings.boyName || 'Karthikuuuuu';
      if (this.partnerNameEl) this.partnerNameEl.textContent = name;
      if (this.partnerMoodEl) this.partnerMoodEl.textContent = settings.boyMood || 'Vibing ⚡';
      if (this.partnerAvatarEl) {
        this.partnerAvatarEl.innerHTML = `<img src="${boyAvatarUrl}" alt="${name}" class="chat-avatar-img">`;
      }
      if (this.roleBadgeEl) this.roleBadgeEl.textContent = "👧 JeanGrey's View";
      this.currentPartnerAvatarUrl = boyAvatarUrl;
      this.currentPartnerName = name;
    } else {
      // He (Karthik) is chatting with Girl (JeanGrey)
      const name = settings.girlName || 'JeanGrey';
      if (this.partnerNameEl) this.partnerNameEl.textContent = name;
      if (this.partnerMoodEl) this.partnerMoodEl.textContent = settings.girlMood || 'Sup! 👾';
      if (this.partnerAvatarEl) {
        this.partnerAvatarEl.innerHTML = `<img src="${girlAvatarUrl}" alt="${name}" class="chat-avatar-img">`;
      }
      if (this.roleBadgeEl) this.roleBadgeEl.textContent = "👦 Karthik's View";
      this.currentPartnerAvatarUrl = girlAvatarUrl;
      this.currentPartnerName = name;
    }

    this.renderAllMessages();
  }

  calculateMilestone(dateStr) {
    if (!this.milestoneTextEl) return;
    if (!dateStr) {
      this.milestoneTextEl.textContent = 'Close Friends Vault ⚡';
      return;
    }

    try {
      const start = new Date(dateStr);
      const now = new Date();
      const diffTime = Math.abs(now - start);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      this.milestoneTextEl.textContent = `Besties for ${diffDays} Days ⚡`;
    } catch (e) {
      this.milestoneTextEl.textContent = 'Close Friends Vault ⚡';
    }
  }

  handleSendMessage() {
    const text = this.inputArea.value.trim();
    if (!text) return;

    const message = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      sender: this.currentRole || 'boy',
      type: 'text',
      text: text,
      timestamp: Date.now(),
      status: 'read'
    };

    if (window.Storage) {
      window.Storage.saveMessage(message);
    }

    this.inputArea.value = '';
    this.inputArea.style.height = 'auto';
    this.appendMessageElement(message);
    this.scrollToBottom();
  }

  // Handle Selection of Photos, Videos, and Documents
  handleMediaSelected(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    let msgType = 'file';
    if (file.type.startsWith('image/')) {
      msgType = 'photo';
    } else if (file.type.startsWith('video/')) {
      msgType = 'video';
    } else if (file.type.startsWith('audio/')) {
      msgType = 'audio';
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      const message = {
        id: 'media_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        sender: this.currentRole || 'boy',
        type: msgType,
        mediaUrl: dataUrl,
        fileName: file.name,
        fileSize: this.formatBytes(file.size),
        fileMime: file.type,
        timestamp: Date.now(),
        status: 'read'
      };

      if (window.Storage) {
        window.Storage.saveMessage(message);
      }

      this.appendMessageElement(message);
      this.scrollToBottom();
    };
    reader.readAsDataURL(file);
    this.fileInput.value = '';
  }

  formatBytes(bytes, decimals = 1) {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  getFileIcon(filename = '') {
    const ext = filename.split('.').pop().toLowerCase();
    if (['pdf'].includes(ext)) return '&#128196;';
    if (['zip', 'rar', '7z', 'tar'].includes(ext)) return '&#128230;';
    if (['doc', 'docx', 'txt', 'rtf'].includes(ext)) return '&#128221;';
    if (['xls', 'xlsx', 'csv'].includes(ext)) return '&#128202;';
    if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) return '&#127925;';
    return '&#128193;';
  }

  // Voice Recording Engine
  async toggleVoiceRecording() {
    if (!this.isRecording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.mediaRecorder = new MediaRecorder(stream);
        this.audioChunks = [];

        this.mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) this.audioChunks.push(e.data);
        };

        this.mediaRecorder.onstop = () => {
          const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.onload = () => {
            const base64Audio = reader.result;
            const message = {
              id: 'voice_' + Date.now(),
              sender: this.currentRole || 'boy',
              type: 'audio',
              mediaUrl: base64Audio,
              duration: Math.max(1, Math.round((Date.now() - this.recordingStartTime) / 1000)),
              timestamp: Date.now(),
              status: 'read'
            };

            if (window.Storage) window.Storage.saveMessage(message);
            this.appendMessageElement(message);
            this.scrollToBottom();
          };
          reader.readAsDataURL(audioBlob);

          // Stop all audio tracks
          stream.getTracks().forEach((track) => track.stop());
        };

        this.mediaRecorder.start();
        this.isRecording = true;
        this.recordingStartTime = Date.now();
        this.showRecordingOverlay();
      } catch (err) {
        alert('Microphone permission is required to send voice notes.');
      }
    } else {
      // Stop recording
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }
      this.isRecording = false;
      this.hideRecordingOverlay();
    }
  }

  showRecordingOverlay() {
    const wrap = document.getElementById('chat-input-wrap');
    if (!wrap) return;
    wrap.innerHTML = `
      <div class="recording-bar-overlay">
        <div class="recording-dot"></div>
        <span class="recording-timer" id="recording-timer-display">Recording 0:01</span>
        <button class="btn-cancel-recording" id="btn-cancel-voice">Tap mic to send</button>
      </div>
    `;

    this.recordVoiceBtn.style.color = '#f43f5e';
    this.recordVoiceBtn.style.background = 'rgba(244, 63, 94, 0.25)';

    this.recordingTimerInterval = setInterval(() => {
      const elapsed = Math.round((Date.now() - this.recordingStartTime) / 1000);
      const mins = Math.floor(elapsed / 60);
      const secs = (elapsed % 60).toString().padStart(2, '0');
      const timerEl = document.getElementById('recording-timer-display');
      if (timerEl) timerEl.textContent = `Recording ${mins}:${secs}`;
    }, 1000);
  }

  hideRecordingOverlay() {
    clearInterval(this.recordingTimerInterval);
    const wrap = document.getElementById('chat-input-wrap');
    if (!wrap) return;
    wrap.innerHTML = `<textarea id="chat-input-text" class="chat-textarea" placeholder="Send private message..." rows="1"></textarea>`;

    this.inputArea = document.getElementById('chat-input-text');
    this.inputArea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSendMessage();
      }
    });

    this.recordVoiceBtn.style.color = '#cbd5e1';
    this.recordVoiceBtn.style.background = 'rgba(255, 255, 255, 0.06)';
  }

  renderAllMessages() {
    if (!this.messagesContainer) return;
    this.messagesContainer.innerHTML = '';

    const messages = window.Storage ? window.Storage.getMessages() : [];
    if (messages.length === 0) {
      const welcome = document.createElement('div');
      welcome.className = 'date-divider';
      welcome.textContent = 'Secret Duo Space • Karthik & JeanGrey ⚡';
      this.messagesContainer.appendChild(welcome);
    } else {
      messages.forEach((msg) => this.appendMessageElement(msg));
    }
    this.scrollToBottom();
  }

  appendMessageElement(msg) {
    if (!this.messagesContainer) return;
    const isSent = msg.sender === this.currentRole;
    const row = document.createElement('div');
    row.className = `message-row ${isSent ? 'sent' : 'received'}`;

    const timeStr = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let contentHtml = '';
    if (msg.type === 'heart') {
      contentHtml = `
        <div class="message-bubble heart-ping-bubble">
          <span class="heart-ping-icon">&hearts;</span>
          <span>${msg.text}</span>
        </div>
      `;
    } else if (msg.type === 'photo') {
      const fileName = msg.fileName || 'photo.jpg';
      contentHtml = `
        <div class="message-bubble media-bubble" style="padding: 6px;">
          <div class="message-photo-wrap">
            <img src="${msg.mediaUrl}" class="message-image" alt="${this.escapeHtml(fileName)}">
            <button class="photo-overlay-download-btn" title="Download Photo (${this.escapeHtml(fileName)})" aria-label="Download Photo">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
            </button>
          </div>
          <div class="media-bubble-meta-row">
            <span class="media-bubble-title" title="${this.escapeHtml(fileName)}">${this.escapeHtml(fileName)}</span>
            <span class="media-bubble-size">${msg.fileSize || ''}</span>
          </div>
          <div class="message-meta">
            <span>${timeStr}</span>
            ${isSent ? '<span class="read-ticks">&#10003;&#10003;</span>' : ''}
          </div>
        </div>
      `;
    } else if (msg.type === 'video') {
      const fileName = msg.fileName || 'video.mp4';
      contentHtml = `
        <div class="message-bubble media-bubble" style="padding: 6px;">
          <div class="message-video-wrap">
            <video controls playsinline class="message-video" src="${msg.mediaUrl}"></video>
          </div>
          <div class="media-file-actions-row">
            <div class="media-bubble-meta-info">
              <span class="media-bubble-title" title="${this.escapeHtml(fileName)}">${this.escapeHtml(fileName)}</span>
              <span class="media-bubble-size">${msg.fileSize || 'Video'}</span>
            </div>
            <button class="media-download-pill-btn" title="Download Video (${this.escapeHtml(fileName)})">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              <span>Download</span>
            </button>
          </div>
          <div class="message-meta">
            <span>${timeStr}</span>
            ${isSent ? '<span class="read-ticks">&#10003;&#10003;</span>' : ''}
          </div>
        </div>
      `;
    } else if (msg.type === 'file') {
      const fileName = msg.fileName || 'Document.pdf';
      const fileIcon = this.getFileIcon(fileName);
      contentHtml = `
        <div class="message-bubble">
          <div class="message-file-card" title="Click to download ${this.escapeHtml(fileName)}">
            <span class="file-card-icon">${fileIcon}</span>
            <div class="file-card-info">
              <span class="file-card-name" title="${this.escapeHtml(fileName)}">${this.escapeHtml(fileName)}</span>
              <span class="file-card-size">${msg.fileSize || 'Document'}</span>
            </div>
            <button class="file-card-download" title="Download ${this.escapeHtml(fileName)}">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
            </button>
          </div>
          <div class="message-meta">
            <span>${timeStr}</span>
            ${isSent ? '<span class="read-ticks">&#10003;&#10003;</span>' : ''}
          </div>
        </div>
      `;
    } else if (msg.type === 'audio') {
      const fileName = msg.fileName || `voice-note-${msg.duration || 3}s.webm`;
      contentHtml = `
        <div class="message-bubble">
          <div class="voice-note-bubble">
            <button class="voice-play-btn" title="Play Voice Note">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            </button>
            <div class="voice-waveform-wrap">
              <div class="waveform-bars">
                <span class="waveform-bar" style="height: 8px;"></span>
                <span class="waveform-bar" style="height: 14px;"></span>
                <span class="waveform-bar" style="height: 6px;"></span>
                <span class="waveform-bar" style="height: 18px;"></span>
                <span class="waveform-bar" style="height: 10px;"></span>
                <span class="waveform-bar" style="height: 15px;"></span>
                <span class="waveform-bar" style="height: 7px;"></span>
              </div>
              <span class="voice-duration">${msg.duration || 3}s audio note</span>
            </div>
            <button class="voice-download-btn" title="Download Audio Note">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
            </button>
          </div>
          <div class="message-meta">
            <span>${timeStr}</span>
            ${isSent ? '<span class="read-ticks">&#10003;&#10003;</span>' : ''}
          </div>
        </div>
      `;
    } else {
      // Normal Text
      contentHtml = `
        <div class="message-bubble">
          <span>${this.escapeHtml(msg.text)}</span>
          <div class="message-meta">
            <span>${timeStr}</span>
            ${isSent ? '<span class="read-ticks">&#10003;&#10003;</span>' : ''}
          </div>
        </div>
      `;
    }

    row.innerHTML = contentHtml;

    // Attach dynamic listeners for robust media download and modal viewing
    if (msg.type === 'photo') {
      const imgEl = row.querySelector('.message-image');
      const dlBtn = row.querySelector('.photo-overlay-download-btn');
      const fileName = msg.fileName || 'photo.jpg';

      if (imgEl) {
        imgEl.addEventListener('click', () => {
          if (window.App && window.App.openLightbox) {
            window.App.openLightbox(msg.mediaUrl, fileName);
          }
        });
      }

      if (dlBtn) {
        dlBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (window.downloadMedia) {
            window.downloadMedia(msg.mediaUrl, fileName);
          }
        });
      }
    } else if (msg.type === 'video') {
      const dlBtn = row.querySelector('.media-download-pill-btn');
      const fileName = msg.fileName || 'video.mp4';
      if (dlBtn) {
        dlBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (window.downloadMedia) {
            window.downloadMedia(msg.mediaUrl, fileName);
          }
        });
      }
    } else if (msg.type === 'file') {
      const fileCard = row.querySelector('.message-file-card');
      const dlBtn = row.querySelector('.file-card-download');
      const fileName = msg.fileName || 'document.pdf';

      const triggerDownload = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (window.downloadMedia) {
          window.downloadMedia(msg.mediaUrl, fileName);
        }
      };

      if (dlBtn) dlBtn.addEventListener('click', triggerDownload);
      if (fileCard) fileCard.addEventListener('click', triggerDownload);
    } else if (msg.type === 'audio') {
      const playBtn = row.querySelector('.voice-play-btn');
      const dlBtn = row.querySelector('.voice-download-btn');
      const fileName = msg.fileName || `voice-note-${msg.duration || 3}s.webm`;

      if (playBtn) {
        playBtn.addEventListener('click', () => this.playAudio(playBtn, msg.mediaUrl));
      }
      if (dlBtn) {
        dlBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (window.downloadMedia) {
            window.downloadMedia(msg.mediaUrl, fileName);
          }
        });
      }
    }
    this.messagesContainer.appendChild(row);
  }

  playAudio(btnEl, audioSrc) {
    const audio = new Audio(audioSrc);
    const bars = btnEl.parentElement.querySelectorAll('.waveform-bar');

    bars.forEach((b) => b.classList.add('playing'));
    btnEl.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`;

    audio.play();
    audio.onended = () => {
      bars.forEach((b) => b.classList.remove('playing'));
      btnEl.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
    };
  }

  scrollToBottom() {
    if (!this.messagesContainer) return;
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  // Settings
  openSettings() {
    if (!this.settingsModal) return;
    const settings = window.Storage ? window.Storage.getSettings() : {};

    if (this.currentRole === 'girl') {
      this.settingPartnerNameInput.value = settings.boyName || '';
      this.settingUserMoodInput.value = settings.girlMood || '';
      if (this.settingsRoleSubtitle) this.settingsRoleSubtitle.textContent = "Active View: 👧 JeanGrey";
    } else {
      this.settingPartnerNameInput.value = settings.girlName || '';
      this.settingUserMoodInput.value = settings.boyMood || '';
      if (this.settingsRoleSubtitle) this.settingsRoleSubtitle.textContent = "Active View: 👦 Karthik";
    }

    if (this.settingMilestoneDateInput) {
      this.settingMilestoneDateInput.value = settings.anniversaryDate || '';
    }

    // Populate notification toggles
    if (this.settingNotifToggle) {
      this.settingNotifToggle.checked = settings.notificationsEnabled !== false;
    }
    if (this.settingCallsToggle) {
      this.settingCallsToggle.checked = settings.callNotificationsEnabled !== false;
    }

    // Update permission button text
    if (this.btnPermText && window.VaultNotification) {
      const status = window.VaultNotification.checkPermissionStatus();
      if (status === 'granted') this.btnPermText.textContent = 'Push Enabled ✓';
      else if (status === 'denied') this.btnPermText.textContent = 'Push Blocked ✕';
      else this.btnPermText.textContent = 'Phone Push';
    }

    this.updateNotifUIStatus(false);

    // Show saved Firebase config
    const savedFb = localStorage.getItem('iweather_firebase_config');
    if (savedFb && this.settingFirebaseInput) {
      this.settingFirebaseInput.value = savedFb;
    }

    this.settingsModal.classList.add('active');
  }

  updateNotifUIStatus(saveToStorage = true) {
    const isNotif = this.settingNotifToggle ? this.settingNotifToggle.checked : true;
    const isCalls = this.settingCallsToggle ? this.settingCallsToggle.checked : true;

    if (this.notifStatusCallout && this.notifStatusText) {
      if (!isNotif && !isCalls) {
        this.notifStatusCallout.className = 'settings-status-callout silent';
        this.notifStatusText.textContent = '🛡️ Silent Stealth Mode: Pop-ups & call alerts are completely disabled outside the vault.';
      } else {
        this.notifStatusCallout.className = 'settings-status-callout';
        const partner = this.currentRole === 'girl' ? 'Karthik' : 'Jean';
        this.notifStatusText.textContent = `🟢 Active Alerts: Instant pop-ups when ${partner} messages or calls you.`;
      }
    }

    if (saveToStorage && window.Storage) {
      const settings = window.Storage.getSettings() || {};
      settings.notificationsEnabled = isNotif;
      settings.callNotificationsEnabled = isCalls;
      window.Storage.saveSettings(settings);
    }
  }

  closeSettings() {
    if (!this.settingsModal) return;

    // Save nicknames and moods
    const settings = window.Storage ? window.Storage.getSettings() : {};
    if (this.currentRole === 'girl') {
      settings.boyName = this.settingPartnerNameInput.value.trim() || 'Karthikuuuuu';
      settings.girlMood = this.settingUserMoodInput.value.trim() || 'Missing you ✨';
    } else {
      settings.girlName = this.settingPartnerNameInput.value.trim() || 'JeanGrey';
      settings.boyMood = this.settingUserMoodInput.value.trim() || 'Thinking of you ❤️';
    }

    if (this.settingNotifToggle) {
      settings.notificationsEnabled = this.settingNotifToggle.checked;
    }
    if (this.settingCallsToggle) {
      settings.callNotificationsEnabled = this.settingCallsToggle.checked;
    }

    if (this.settingMilestoneDateInput) {
      settings.anniversaryDate = this.settingMilestoneDateInput.value;
    }
    if (window.Storage) window.Storage.saveSettings(settings);

    this.applySettingsToUI(settings);
    this.settingsModal.classList.remove('active');
  }

  applySettingsToUI(settings) {
    if (this.currentRole === 'girl') {
      if (this.partnerNameEl) this.partnerNameEl.textContent = settings.boyName || 'Karthikuuuuu';
      if (this.partnerMoodEl) this.partnerMoodEl.textContent = settings.boyMood || 'Vibing ⚡';
    } else {
      if (this.partnerNameEl) this.partnerNameEl.textContent = settings.girlName || 'JeanGrey';
      if (this.partnerMoodEl) this.partnerMoodEl.textContent = settings.girlMood || 'Sup! 👾';
    }
  }

  saveFirebaseConfig() {
    const raw = this.settingFirebaseInput.value.trim();
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      localStorage.setItem('iweather_firebase_config', JSON.stringify(parsed));
      alert('Firebase credentials saved successfully! The app will now sync live across the internet.');
      if (window.Storage) window.Storage.checkAndInitFirebase();
      this.closeSettings();
    } catch (e) {
      alert('Invalid JSON format. Please paste a valid Firebase configuration JSON object.');
    }
  }

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ==========================================
  // EMOJI PICKER ENGINE
  // ==========================================
  initEmojiPicker() {
    this.emojiData = {
      duo: ['⚡', '👾', '🔥', '💯', '✨', '😂', '🤣', '😎', '👊', '🤝', '🙌', '🫶', '🤍', '🚀', '☕', '🍕', '🎮', '🫡', '👀', '🤙', '🍿', '🎸', '🌟', '💥', '🎉', '🥂', '🫂', '👑'],
      smileys: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '🥲', '🥹', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥸', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😮‍💨', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🫡', '🤔', '🫣', '🤭', '🫢', '🤫', '🫠', '🤥', '😶', '😐', '😑', '🫨', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿', '👻', '💀', '☠️', '👽', '👾', '🤖', '🎃'],
      hands: ['⚡', '👊', '🤛', '🤜', '✌️', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '👍', '👎', '✊', '✋', '🤚', '🖐️', '🖖', '🫱', '🫲', '🫸', '🫷', '🫳', '🫴', '🤝', '👏', '🙌', '🫶', '👐', '🤲', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁️', '👅', '👄'],
      sparks: ['🔥', '💯', '✨', '💥', '🌟', '⭐', '💫', '⚡', '🔮', '🧿', '💎', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❤️‍🔥', '❤️‍🩹', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💢', '💤', '💨'],
      food: ['🍕', '🍔', '🍟', '🌭', '🍿', '🥓', '🥚', '🍳', '🧇', '🥞', '🍞', '🥐', '🥨', '🧀', '🥗', '🥪', '🌮', '🌯', '🍜', '🍝', '🍣', '🍱', '🥟', '🍤', '🍙', '🍚', '🍛', '🍲', '🍧', '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍩', '🍪', '☕', '🧋', '🍵', '🧃', '🥤', '🍺', '🍻', '🥂', '🍷', '🥃', '🍸', '🍹', '🍾', '🍎', '🍓', '🥑', '🍉', '🍌', '🍇', '🍒', '🥭'],
      activities: ['🎮', '🕹️', '🎲', '🎯', '🎳', '🎧', '🎬', '🎤', '🎸', '🎹', '🥁', '🎨', '🎪', '🎟️', '🏆', '🥇', '⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🎱', '🏓', '🏸', '🥊', '🥋', '🛹', '🛼', '🏋️', '🧗', '🚗', '🏎️', '🏍️', '🚲', '🚀', '🛸', '✈️', '🏝️', '⛺', '🏖️', '🌋', '🏔️', '🪐', '🌌', '🎆', '🎇'],
      animals: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐢', '🐍', '🐙', '🐬', '🐳', '🦈', '🐊', '🐅', '🐆', '🌸', '🌹', '🌺', '🌻', '🌼', '🌷', '🌱', '🌲', '🌳', '🌴', '🍀', '🍁', '🍂', '🍃', '☀️', '🌙', '⭐', '🌈', '⚡', '⛈️', '❄️']
    };

    if (this.emojiToggleBtn) {
      this.emojiToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleEmojiPicker();
      });
    }

    if (this.emojiCloseBtn) {
      this.emojiCloseBtn.addEventListener('click', () => {
        this.closeEmojiPicker();
      });
    }

    // Close on click outside
    document.addEventListener('click', (e) => {
      if (this.emojiTray && this.emojiTray.classList.contains('active')) {
        if (!this.emojiTray.contains(e.target) && e.target !== this.emojiToggleBtn && !this.emojiToggleBtn.contains(e.target)) {
          this.closeEmojiPicker();
        }
      }
    });

    // Category Tabs click
    if (this.emojiCategoryNav) {
      this.emojiCategoryNav.querySelectorAll('.emoji-cat-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.emojiCategoryNav.querySelectorAll('.emoji-cat-btn').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          this.currentEmojiCategory = btn.dataset.cat || 'duo';
          if (this.emojiSearchInput) {
            this.emojiSearchInput.value = '';
            if (this.emojiSearchClearBtn) this.emojiSearchClearBtn.style.display = 'none';
          }
          this.renderCategoryEmojis(this.currentEmojiCategory);
        });
      });
    }

    // Search input
    if (this.emojiSearchInput) {
      this.emojiSearchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim().toLowerCase();
        if (this.emojiSearchClearBtn) {
          this.emojiSearchClearBtn.style.display = query ? 'block' : 'none';
        }
        if (!query) {
          this.renderCategoryEmojis(this.currentEmojiCategory);
        } else {
          this.searchEmojis(query);
        }
      });
    }

    if (this.emojiSearchClearBtn) {
      this.emojiSearchClearBtn.addEventListener('click', () => {
        if (this.emojiSearchInput) this.emojiSearchInput.value = '';
        this.emojiSearchClearBtn.style.display = 'none';
        this.renderCategoryEmojis(this.currentEmojiCategory);
      });
    }

    // Initial render
    this.renderCategoryEmojis('duo');
  }

  toggleEmojiPicker() {
    if (!this.emojiTray) return;
    const isActive = this.emojiTray.classList.toggle('active');
    if (this.emojiToggleBtn) this.emojiToggleBtn.classList.toggle('active', isActive);
  }

  closeEmojiPicker() {
    if (this.emojiTray) this.emojiTray.classList.remove('active');
    if (this.emojiToggleBtn) this.emojiToggleBtn.classList.remove('active');
  }

  renderCategoryEmojis(catName) {
    const list = this.emojiData[catName] || this.emojiData.duo;
    this.renderEmojiGrid(list);
  }

  searchEmojis(query) {
    const all = [];
    const seen = new Set();
    Object.values(this.emojiData).forEach((arr) => {
      arr.forEach((em) => {
        if (!seen.has(em)) {
          seen.add(em);
          all.push(em);
        }
      });
    });

    const matchMap = {
      fire: ['🔥', '💥', '✨', '⚡', '💯', '❤️‍🔥'],
      laugh: ['😂', '🤣', '😆', '😅', '😀', '😄'],
      happy: ['😀', '😃', '😄', '😁', '😊', '🙂', '😇'],
      love: ['❤️', '💖', '💕', '🫶', '😍', '🥰', '😘', '🤍', '💜', '💙'],
      heart: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖'],
      bro: ['👊', '🤝', '⚡', '🤙', '✌️', '🙌', '🫡', '🫂', '😎'],
      cool: ['😎', '🤙', '🔥', '✨', '⚡', '🚀', '🎸', '👾'],
      sad: ['😢', '😭', '🥺', '😞', '😔', '💔', '🙁'],
      pizza: ['🍕', '🍔', '🍟', '🍿'],
      food: ['🍕', '🍔', '🍟', '🌭', '🌮', '🍣', '🍜', '🍩', '🍫', '☕'],
      game: ['🎮', '🕹️', '🎲', '🎯', '👾'],
      music: ['🎧', '🎸', '🎹', '🥁', '🎤', '🎬'],
      car: ['🚗', '🏎️', '🏍️', '🚲', '🚀'],
      cat: ['🐱', '🐈', '🦁', '🐯'],
      dog: ['🐶', '🐕', '🐩', '🐺'],
      party: ['🥳', '🎉', '🍾', '🥂', '🎈', '✨'],
      cry: ['😭', '😢', '🥺', '😿'],
      star: ['⭐', '🌟', '✨', '💫']
    };

    let filtered = [];
    for (const [key, emojis] of Object.entries(matchMap)) {
      if (key.includes(query) || query.includes(key)) {
        filtered = filtered.concat(emojis);
      }
    }

    if (filtered.length === 0) {
      filtered = all.slice(0, 40);
    }

    const uniqueFiltered = [...new Set(filtered)];
    this.renderEmojiGrid(uniqueFiltered);
  }

  renderEmojiGrid(emojis) {
    if (!this.emojiGridViewport) return;
    this.emojiGridViewport.innerHTML = '';

    if (!emojis || emojis.length === 0) {
      this.emojiGridViewport.innerHTML = '<div class="emoji-no-results">No emojis found</div>';
      return;
    }

    const frag = document.createDocumentFragment();
    emojis.forEach((em) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'emoji-item-btn';
      btn.textContent = em;
      btn.title = em;
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.insertEmoji(em);
      });
      frag.appendChild(btn);
    });

    this.emojiGridViewport.appendChild(frag);
  }

  insertEmoji(emoji) {
    const input = document.getElementById('chat-input-text');
    if (!input) return;

    const start = input.selectionStart || input.value.length;
    const end = input.selectionEnd || input.value.length;
    const text = input.value;

    input.value = text.substring(0, start) + emoji + text.substring(end);
    const newPos = start + emoji.length;
    input.selectionStart = newPos;
    input.selectionEnd = newPos;
    input.focus();

    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

window.DuoChat = DuoChat;
