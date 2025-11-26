class ConversaPlay {
    constructor(conversationData, audioSrc, options = {}) {
        this.conversation = conversationData;
        this.audioSrc = audioSrc;
        this.options = {
            typingSpeed: options.typingSpeed || 50,
            autoPlay: options.autoPlay || false
        };
        
        this.audio = new Audio(this.audioSrc);
        this.renderedMessages = new Set();
        this.isDragging = false;
        this.duration = 0;
        this.lastRenderTime = 0;
        this.animationFrameId = null;
        this.hasEnded = false;
        
        this.init();
    }

    init() {
        this.conversationWindow = document.getElementById('conversationWindow');
        this.progressBar = document.getElementById('progressBar');
        this.progressFill = document.getElementById('progressFill');
        this.scrubber = document.getElementById('scrubber');
        this.playPauseBtn = document.getElementById('playPauseBtn');
        this.muteBtn = document.getElementById('muteBtn');
        this.currentTimeEl = document.getElementById('currentTime');
        this.totalTimeEl = document.getElementById('totalTime');
        
        this.setupAudio();
        this.setupEventListeners();
    }

    setupAudio() {
        this.audio.addEventListener('loadedmetadata', () => {
            this.duration = this.audio.duration;
            this.totalTimeEl.textContent = this.formatTime(this.duration);
        });

        this.audio.addEventListener('timeupdate', () => {
            if (!this.isDragging) {
                this.updateProgress();
                this.scheduleMessageUpdate();
                
                // Check if audio has reached the end
                if (this.audio.currentTime >= this.duration - 0.1 && this.duration > 0 && !this.hasEnded) {
                    this.handleAudioEnd();
                }
            }
        });

        this.audio.addEventListener('ended', () => {
            this.handleAudioEnd();
        });

        // Load audio metadata
        this.audio.load();
    }

    setupEventListeners() {
        this.playPauseBtn.addEventListener('click', () => this.togglePlayPause());
        
        // Mute button now acts as restart button
        this.muteBtn.addEventListener('click', () => this.restartConversation());
        
        // Progress bar click to seek
        this.progressBar.addEventListener('click', (e) => {
            if (!this.isDragging) {
                this.seekToPosition(e);
            }
        });
        
        // Scrubber drag
        this.scrubber.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                this.handleDrag(e);
            }
        });
        
        document.addEventListener('mouseup', (e) => {
            if (this.isDragging) {
                this.isDragging = false;
                this.handleDragEnd(e);
            }
        });

        // Touch support
        this.scrubber.addEventListener('touchstart', (e) => {
            this.isDragging = true;
            e.preventDefault();
        });

        document.addEventListener('touchmove', (e) => {
            if (this.isDragging) {
                this.handleDrag(e.touches[0]);
            }
        });

        document.addEventListener('touchend', (e) => {
            if (this.isDragging) {
                this.isDragging = false;
                if (e.changedTouches[0]) {
                    this.handleDragEnd(e.changedTouches[0]);
                }
            }
        });

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                this.togglePlayPause();
            }
            // R key for restart
            if (e.code === 'KeyR') {
                e.preventDefault();
                this.restartConversation();
            }
        });
    }

    togglePlayPause() {
        if (this.hasEnded) {
            // If audio has ended, restart from beginning
            this.restartConversation();
            this.play();
        } else if (this.audio.paused) {
            this.play();
        } else {
            this.pause();
        }
    }

    play() {
        this.audio.play();
        this.playPauseBtn.querySelector('#playPauseIcon').textContent = '⏸';
        this.hasEnded = false;
        
        this.startAnimationLoop();
    }

    pause() {
        this.audio.pause();
        this.playPauseBtn.querySelector('#playPauseIcon').textContent = '▶';
       
        this.stopAnimationLoop();
    }

    handleAudioEnd() {
        this.hasEnded = true;
        this.pause();
        
        // Ensure progress bar is at 100%
        this.progressFill.style.width = '100%';
        this.currentTimeEl.textContent = this.formatTime(this.duration);
        
        // Reset play button to play state (it will restart when clicked)
        this.playPauseBtn.querySelector('#playPauseIcon').textContent = '▶';
    }

    startAnimationLoop() {
        if (this.animationFrameId) return;
        
        const animate = () => {
            this.updateMessages();
            this.animationFrameId = requestAnimationFrame(animate);
        };
        this.animationFrameId = requestAnimationFrame(animate);
    }

    stopAnimationLoop() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    scheduleMessageUpdate() {
        // Use requestAnimationFrame for smooth updates
        if (!this.animationFrameId) {
            requestAnimationFrame(() => this.updateMessages());
        }
    }

    // Mute button functionality replaced with restart
    restartConversation() {
        this.pause();
        this.audio.currentTime = 0;
        this.hasEnded = false;
        
        // Clear and reset conversation display
        this.conversationWindow.innerHTML = '';
        this.renderedMessages.clear();
        this.progressFill.style.width = '0%';
        this.currentTimeEl.textContent = '0:00';
        
        // Update play button to play state
        this.playPauseBtn.querySelector('#playPauseIcon').textContent = '▶';
        
        // Add visual feedback for restart
        this.muteBtn.classList.add('restarting');
        setTimeout(() => {
            this.muteBtn.classList.remove('restarting');
        }, 300);
    }

    updateProgress() {
        const progress = (this.audio.currentTime / this.duration) * 100;
        this.progressFill.style.width = `${progress}%`;
        this.currentTimeEl.textContent = this.formatTime(this.audio.currentTime);
    }

    updateMessages() {
        if (this.hasEnded) return;
        
        const currentTime = this.audio.currentTime;
        const now = performance.now();
        
        // Throttle updates to ~60fps for smooth performance
        if (now - this.lastRenderTime < 16) {
            return;
        }
        this.lastRenderTime = now;
        
        this.conversation.forEach((message, index) => {
            // Show message if we've reached its timestamp
            if (currentTime >= message.timestamp && !this.renderedMessages.has(index)) {
                this.showMessage(message, index);
            }
        });
    }

    showMessage(message, index) {
        const messageEl = this.createMessageElement(message);
        messageEl.dataset.index = index;
        this.conversationWindow.appendChild(messageEl);
        this.renderedMessages.add(index);
        
        // Smooth scroll to bottom
        requestAnimationFrame(() => {
            this.conversationWindow.scrollTop = this.conversationWindow.scrollHeight;
        });
    }

    createMessageElement(message) {
        const messageEl = document.createElement('div');
        messageEl.className = `message ${message.type}`;
        
        const contentEl = document.createElement('div');
        contentEl.className = 'message-content';
        
        const textEl = document.createElement('div');
        textEl.className = 'message-text';
        textEl.textContent = message.text;
        
        const timestamp = document.createElement('div');
        timestamp.className = 'message-timestamp';
        timestamp.textContent = this.formatTime(message.timestamp);
        
        contentEl.appendChild(textEl);
        contentEl.appendChild(timestamp);
        messageEl.appendChild(contentEl);
        
        return messageEl;
    }

    seekToPosition(e) {
        const rect = this.progressBar.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percentage = Math.max(0, Math.min(1, clickX / rect.width));
        this.seekToTime(percentage * this.duration);
    }

    handleDrag(e) {
        const rect = this.progressBar.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percentage = Math.max(0, Math.min(1, clickX / rect.width));
        
        this.progressFill.style.width = `${percentage * 100}%`;
        this.currentTimeEl.textContent = this.formatTime(percentage * this.duration);
    }

    handleDragEnd(e) {
        const rect = this.progressBar.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percentage = Math.max(0, Math.min(1, clickX / rect.width));
        this.seekToTime(percentage * this.duration);
    }

    seekToTime(time) {
        this.audio.currentTime = time;
        this.hasEnded = false;
        
        // Clear and rebuild conversation based on new time
        this.conversationWindow.innerHTML = '';
        this.renderedMessages.clear();
        
        // Show all messages that should be visible at this time
        this.conversation.forEach((message, index) => {
            if (time >= message.timestamp) {
                this.showMessage(message, index);
            }
        });
        
        this.updateProgress();
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // Method to switch conversation and audio
    switchConversation(newConversation, newAudioSrc) {
        this.pause();
        this.conversation = newConversation;
        this.audioSrc = newAudioSrc;
        this.hasEnded = false;
        
        // Create new audio element
        this.audio = new Audio(this.audioSrc);
        this.setupAudio();
        
        // Reset conversation display
        this.conversationWindow.innerHTML = '';
        this.renderedMessages.clear();
        this.progressFill.style.width = '0%';
        this.currentTimeEl.textContent = '0:00';
        this.totalTimeEl.textContent = '0:00';
    }
}

// Sample conversation data for different tabs
const conversations = {
    tab1: {
        conversation: [
            {
                type: 'ai',
                text: 'Thank you for calling Mile High HVAC, this is our AI receptionist. How can I help you today?',
                timestamp: 0,
                duration: 4
            },
            {
                type: 'user',
                text: 'Yeah, my AC isn\'t blowing cold air and it\'s getting really hot in the house.',
                timestamp: 5.5,
                duration: 4
            },
            {
                type: 'ai',
                text: 'Sorry to hear that — I can help get you scheduled right now. Just to confirm, is this for a residential home or a business?',
                timestamp: 10,
                duration: 6
            },
            {
                type: 'user',
                text: 'It\'s my house.',
                timestamp: 17,
                duration: 1
            },
            {
                type: 'ai',
                text: 'Got it. And are you noticing warm air, strange noises, or is it not turning on at all?',
                timestamp: 19,
                duration: 4
            },
            {
                type: 'user',
                text: 'It\'s running, but it\'s blowing warm air.',
                timestamp: 24.5,
                duration: 2
            },
            {
                type: 'ai',
                text: 'Thank you. I\'ll get a technician scheduled to take care of that for you. May I get your full name?',
                timestamp: 27.5,
                duration: 4
            },
            {
                type: 'user',
                text: 'John Martinez.',
                timestamp: 32.5,
                duration: 2
            },
            {
                type: 'ai',
                text: 'Thanks, John. What\'s the best phone number in case the technician needs to contact you?',
                timestamp: 34.5,
                duration: 4
            },
            {
                type: 'user',
                text: '303-555-7284.',
                timestamp: 40,
                duration: 5
            },
            {
                type: 'ai',
                text: 'And what\'s address?',
                timestamp: 46,
                duration: 1.5
            },
            {
                type: 'user',
                text: '4517 South Pearl Street, Denver.',
                timestamp: 48,
                duration: 3
            },
            {
                type: 'ai',
                text: 'Perfect. I show an available service window for today between 4 and 6 PM or tomorrow between 9 and 11 AM. What works best for you?',
                timestamp: 52,
                duration: 10
            },
            {
                type: 'user',
                text: 'Tomorrow morning.',
                timestamp: 63,
                duration: 1
            },
            {
                type: 'ai',
                text: 'You\'re booked for tomorrow between 9 and 11 AM. Our technician will call before arriving. You\'ll also receive a confirmation text shortly.',
                timestamp: 65,
                duration: 9
            },
            {
                type: 'user',
                text: 'Awesome, thank you.',
                timestamp: 74.5,
                duration: 1
            },
            {
                type: 'ai',
                text: 'You\'re all set, John. Thanks for choosing Mile High HVAC and we\'ll see you tomorrow!',
                timestamp: 76,
                duration: 4
            }
        ],
        audio: '../audios/HVAC.mp3'
    },
    tab2: {
        conversation: [
            {
                type: 'ai',
                text: 'Thank you for calling Anderson Law. How can I help you today?',
                timestamp: 0,
                duration: 3
            },
            {
                type: 'user',
                text: 'I\'m calling because I was in a car accident last week and I\'m not sure what to do.',
                timestamp: 4,
                duration: 5
            },
            {
                type: 'ai',
                text: 'I\'m sorry to hear that. I can help schedule a consultation with one of our attorneys. Was anyone injured in the accident?',
                timestamp: 10,
                duration: 6
            },
            {
                type: 'user',
                text: 'Yes, I had some back and neck pain. I\'ve already seen a doctor.',
                timestamp: 18,
                duration: 4
            },
            {
                type: 'ai',
                text: 'Thank you for letting me know. May I get your full name?',
                timestamp: 22,
                duration: 3
            },
            {
                type: 'user',
                text: 'Sarah Johnson.',
                timestamp: 27,
                duration: 2
            },
            {
                type: 'ai',
                text: 'Thanks, Sarah. What\'s the best phone number and email to reach you?',
                timestamp: 28.5,
                duration: 4
            },
            {
                type: 'user',
                text: '303-555-8193 and sarahj@gmail.com.',
                timestamp: 34,
                duration: 3
            },
            {
                type: 'ai',
                text: 'Got it. And were you the driver or a passenger?',
                timestamp: 47.5,
                duration: 3
            },
            {
                type: 'user',
                text: 'I was the driver.',
                timestamp: 52,
                duration: 2
            },
            {
                type: 'ai',
                text: 'Understood. I have an opening for a free consultation today at 3:30 PM or tomorrow at 10 AM. Which do you prefer?',
                timestamp: 54,
                duration: 5
            },
            {
                type: 'user',
                text: 'Tomorrow at 10.',
                timestamp: 65,
                duration: 1
            },
            {
                type: 'ai',
                text: 'You\'re confirmed for tomorrow at 10 AM with Attorney Anderson. You\'ll receive a confirmation email and a reminder text shortly.',
                timestamp: 67,
                duration: 5
            },
            {
                type: 'user',
                text: 'Perfect, thanks so much.',
                timestamp: 76,
                duration: 2
            },
            {
                type: 'ai',
                text: 'You\'re very welcome, Sarah. We look forward to helping you tomorrow.',
                timestamp: 78,
                duration: 3
            }
        ],
        audio: '../audios/law.mp3'
    },
    tab3: {
        conversation: [
            {
                type: 'ai',
                text: 'Thanks for calling PeakMotion Chiropractic, this is our AI receptionist on a recorded line. How can I help you today?',
                timestamp: 0,
                duration: 6
            },
            {
                type: 'user',
                text: 'Hi, I\'ve had some lower back pain for a while and I think it\'s time to get it looked at.',
                timestamp: 7,
                duration: 4
            },
            {
                type: 'ai',
                text: 'I\'m glad you called — we help with that every day. Is this your first visit to our clinic?',
                timestamp: 13,
                duration: 4
            },
            {
                type: 'user',
                text: 'Yes, it is.',
                timestamp: 18,
                duration: 1
            },
            {
                type: 'ai',
                text: 'Great! Let\'s get you taken care of. May I have your full name?',
                timestamp: 20,
                duration: 3
            },
            {
                type: 'user',
                text: 'Mark Daniels.',
                timestamp: 24,
                duration: 2
            },
            {
                type: 'ai',
                text: 'Thanks, Mark. What\'s the best phone number for your appointment confirmation?',
                timestamp: 26,
                duration: 4
            },
            {
                type: 'user',
                text: '720-555-4419.',
                timestamp: 30,
                duration: 2
            },
            {
                type: 'ai',
                text: 'One quick question — is your pain recent or something you\'ve been dealing with for a while?',
                timestamp: 35,
                duration: 4
            },
            {
                type: 'user',
                text: 'Probably about three months now.',
                timestamp: 42,
                duration: 2
            },
            {
                type: 'ai',
                text: 'Thanks for sharing that. I have availability for a new patient exam today at 5 PM or tomorrow at 11:30 AM. Which works for you?',
                timestamp: 44,
                duration: 5
            },
            {
                type: 'user',
                text: 'Tomorrow works.',
                timestamp: 54,
                duration: 1
            },
            {
                type: 'ai',
                text: 'You\'re booked for tomorrow at 11:30 AM. You\'ll receive a text with our address and intake form.',
                timestamp: 56,
                duration: 4
            },
            {
                type: 'user',
                text: 'Awesome, thank you.',
                timestamp: 62,
                duration: 1
            },
            {
                type: 'ai',
                text: 'You\'re all set, Mark. We look forward to seeing you tomorrow at PeakMotion Chiropractic!',
                timestamp: 64,
                duration: 4
            }
        ],
        audio: '../audios/chiro.mp3'
    }
};

// Initialize the conversation player with the first tab
let currentPlayer = new ConversaPlay(
    conversations.tab1.conversation, 
    conversations.tab1.audio, 
    {
        typingSpeed: 160,
        autoPlay: false
    }
);

// Tab switching functionality
document.addEventListener('DOMContentLoaded', function() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            
            // Remove active class from all buttons
            tabButtons.forEach(btn => btn.classList.remove('active'));
            // Add active class to clicked button
            this.classList.add('active');
            
            // Switch conversation based on tab
            if (conversations[tabId]) {
                currentPlayer.switchConversation(
                    conversations[tabId].conversation,
                    conversations[tabId].audio
                );
            }
        });
    });
});