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
        
        // Track the last message element and its type for grouping
        this.lastMessageElement = null;
        this.lastMessageType = null;
        
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

            document.querySelector('#playIcon').style.display = 'none';
            document.querySelector('#pauseIcon').style.display = 'block';

            this.hasEnded = false;
            this.startAnimationLoop();
        }

        pause() {
            this.audio.pause();

            document.querySelector('#playIcon').style.display = 'block';
            document.querySelector('#pauseIcon').style.display = 'none';

            this.stopAnimationLoop();
        }



    handleAudioEnd() {
        this.hasEnded = true;
        this.pause();
        
        // Ensure progress bar is at 100%
        this.progressFill.style.width = '100%';
        this.currentTimeEl.textContent = this.formatTime(this.duration);
        
        // Reset play button to play state (it will restart when clicked)
        document.querySelector('#playIcon').style.display = 'block';
        document.querySelector('#pauseIcon').style.display = 'none';
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

    restartConversation() {
        this.pause();
        this.audio.currentTime = 0;
        this.hasEnded = false;

        // Clear and reset conversation display
        this.conversationWindow.innerHTML = '';
        this.renderedMessages.clear();
        this.progressFill.style.width = '0%';
        this.currentTimeEl.textContent = '0:00';

        // Reset tracking variables
        this.lastMessageElement = null;
        this.lastMessageType = null;

        // Update play button to play state
        document.querySelector('#playIcon').style.display = 'block';
        document.querySelector('#pauseIcon').style.display = 'none';

        const restartIcon = document.querySelector('#restartIcon');
        restartIcon.classList.add('spinning');
        setTimeout(() => {
            restartIcon.classList.remove('spinning');
        }, 300); // match animation duration

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
        // Check if this is a consecutive message from the same user
        if (this.lastMessageElement && this.lastMessageType === message.type) {
            // Add to existing message box with fade animation
            this.appendToExistingMessage(message, index);
        } else {
            // Create new message box
            this.createNewMessage(message, index);
        }
        
        this.renderedMessages.add(index);
        
        // Scroll to bottom after a short delay to ensure DOM is updated
        this.scheduleScrollToBottom();
    }

    createNewMessage(message, index) {
        const messageEl = this.createMessageElement(message);
        messageEl.dataset.index = index;
        this.conversationWindow.appendChild(messageEl);
        
        // Update tracking variables
        this.lastMessageElement = messageEl;
        this.lastMessageType = message.type;
    }

    appendToExistingMessage(message, index) {
        const contentEl = this.lastMessageElement.querySelector('.message-content');
        const existingTexts = contentEl.querySelectorAll('.message-text');
        const lastTextEl = existingTexts[existingTexts.length - 1];
        
        // Create a new text element for the additional message
        const newTextEl = document.createElement('div');
        newTextEl.className = 'message-text additional-message';
        newTextEl.textContent = message.text;
        newTextEl.dataset.index = index;
        newTextEl.style.opacity = '0';
        newTextEl.style.transform = 'translateY(10px)';
        newTextEl.style.maxHeight = '0';
        newTextEl.style.overflow = 'hidden';
        // Add to existing message WITHOUT animations initially
        lastTextEl.parentNode.insertBefore(newTextEl, lastTextEl.nextSibling);
        
        // Update the last message element to include this new content
        this.lastMessageElement.dataset.index = index;
        
        // Force reflow to ensure element is in DOM
        newTextEl.offsetHeight;
        
        // Now apply the fade-in animation
        newTextEl.style.opacity = '1';
        newTextEl.style.transform = 'translateY(0)';
        newTextEl.style.maxHeight = '100px';
        newTextEl.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
   
    }

    createMessageElement(message) {
        const messageEl = document.createElement('div');
        messageEl.className = `message ${message.type}`;
        
        const contentEl = document.createElement('div');
        contentEl.className = 'message-content';
        
        const textEl = document.createElement('div');
        textEl.className = 'message-text';
        textEl.textContent = message.text;
        
        contentEl.appendChild(textEl);
        messageEl.appendChild(contentEl);
        
        return messageEl;
    }

    scheduleScrollToBottom() {
        // Use setTimeout to ensure DOM is updated before scrolling
        setTimeout(() => {
            this.conversationWindow.scrollTop = this.conversationWindow.scrollHeight;
        }, 10);
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
        
        // Reset tracking variables
        this.lastMessageElement = null;
        this.lastMessageType = null;
        
        // Show all messages that should be visible at this time
        this.conversation.forEach((message, index) => {
            if (time >= message.timestamp) {
                // For seeking, we need to handle message grouping correctly
                this.showMessageForSeek(message, index);
            }
        });
        
        // Scroll to bottom after all messages are rendered
        this.scheduleScrollToBottom();
        
        this.updateProgress();
    }

    showMessageForSeek(message, index) {
        // Check if this is a consecutive message from the same user
        if (this.lastMessageElement && this.lastMessageType === message.type) {
            // Add to existing message box WITHOUT animation for seeking
            this.appendToExistingMessageForSeek(message, index);
        } else {
            // Create new message box
            this.createNewMessage(message, index);
        }
        
        this.renderedMessages.add(index);
    }

    appendToExistingMessageForSeek(message, index) {
        const contentEl = this.lastMessageElement.querySelector('.message-content');
        const existingTexts = contentEl.querySelectorAll('.message-text');
        const lastTextEl = existingTexts[existingTexts.length - 1];
        
        // Create a new text element for the additional message
        const newTextEl = document.createElement('div');
        newTextEl.className = 'message-text additional-message';
        newTextEl.textContent = message.text;
        newTextEl.dataset.index = index;
        
        // Add to existing message WITHOUT any animations for seeking
        lastTextEl.parentNode.insertBefore(newTextEl, lastTextEl.nextSibling);
        
        // Make it fully visible immediately (no animation)
        newTextEl.style.opacity = '1';
        newTextEl.style.transform = 'translateY(0)';
        newTextEl.style.maxHeight = '100px';
        
        // Update the last message element to include this new content
        this.lastMessageElement.dataset.index = index;
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
        
        // Reset conversation display and tracking
        this.conversationWindow.innerHTML = '';
        this.renderedMessages.clear();
        this.lastMessageElement = null;
        this.lastMessageType = null;
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
                text: 'Thank you for calling Mile High HVAC, this is our AI receptionist.',
                timestamp: 0,
                duration: 3.5
            },

            {
                type: 'ai',
                text: 'How can I help you today?',
                timestamp: 3.5,
                duration: 0.5
            },

            {
                type: 'user',
                text: 'Yeah, my AC isn\'t blowing cold air and it\'s getting really hot in the house.',
                timestamp: 5.5,
                duration: 4
            },
            {
                type: 'ai',
                text: 'Sorry to hear that — I can help get you scheduled right now.',
                timestamp: 10.5,
                duration: 3
            },
            {
                type: 'ai',
                text: 'Just to confirm, is this for a residential home or a business?',
                timestamp: 14,
                duration: 3
            },
            {
                type: 'user',
                text: 'This is for my house.',
                timestamp: 18,
                duration: 1
            },
            {
                type: 'ai',
                text: 'Got it.',
                timestamp: 20,
                duration: 4
            },
            {
                type: 'ai',
                text: 'And are you noticing warm air, strange noises, or is it not turning on at all?',
                timestamp: 21,
                duration: 4
            },
            {
                type: 'user',
                text: 'It\'s running, but it\'s blowing warm air.',
                timestamp: 27.5,
                duration: 2
            },
            {
                type: 'ai',
                text: 'Thank you. I\'ll get a technician scheduled to take care of that for you. May I get your full name?',
                timestamp: 30,
                duration: 4
            },
            {
                type: 'user',
                text: 'Sarah Longo.',
                timestamp: 36,
                duration: 2
            },
            {
                type: 'ai',
                text: 'Thanks, Sarah. What\'s the best phone number in case the technician needs to contact you?',
                timestamp: 37.5,
                duration: 4
            },
            {
                type: 'user',
                text: '303-555-7284.',
                timestamp: 41.5,
                duration: 5
            },
            {
                type: 'ai',
                text: 'And what\'s address?',
                timestamp: 45.5,
                duration: 1.5
            },
            {
                type: 'user',
                text: '4517 South Pearl Street, Denver, Colorado.',
                timestamp: 48,
                duration: 3
            },
            {
                type: 'ai',
                text: 'Perfect. I show an available service window for today between 4 and 6 PM or tomorrow between 9 and 11 AM.',
                timestamp: 52,
                duration: 9
            },
            {
                type: 'ai',
                text: ' What works best for you?',
                timestamp: 58,
                duration: 1
            },
            {
                type: 'user',
                text: 'Tomorrow morning.',
                timestamp: 60,
                duration: 1
            },
            {
                type: 'ai',
                text: 'You\'re booked for tomorrow between 9 and 11 AM. Our technician will call before arriving.',
                timestamp: 61.5,
                duration: 9
            },
            {
                type: 'ai',
                text: 'You\'ll also receive a confirmation text shortly.',
                timestamp: 66.6,
                duration: 9
            },
            {
                type: 'user',
                text: 'Awesome, thank you.',
                timestamp: 69.5,
                duration: 1
            },
            {
                type: 'ai',
                text: 'You\'re all set, Sarah. Thanks for choosing Mile High HVAC and we\'ll see you tomorrow!',
                timestamp: 72,
                duration: 4
            }
        ],
        audio: '../audios/HVAC_.mp3'
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
                text: 'I\'m calling because I was in a car accident last week',
                timestamp: 4,
                duration: 5
            },
            {
                type: 'user',
                text: 'and I\'m not sure what to do.',
                timestamp: 6.5,
                duration: 5
            },
            {
                type: 'ai',
                text: 'I\'m sorry to hear that. I can help schedule a consultation with one of our attorneys.',
                timestamp: 8.6,
                duration: 6
            },
            {
                type: 'ai',
                text: ' Was anyone injured in the accident?',
                timestamp: 13,
                duration: 6
            },
            {
                type: 'user',
                text: 'Yes, I had some back and neck pain since the accident.',
                timestamp: 15,
                duration: 4
            },
            {
                type: 'ai',
                text: 'Thank you for letting me know. May I get your full name?',
                timestamp: 19.5,
                duration: 3
            },
            {
                type: 'user',
                text: 'Yeah, Sarah Johnson.',
                timestamp: 22,
                duration: 2
            },
            {
                type: 'ai',
                text: 'Thanks, Sarah. What\'s the best phone number and email to reach you?',
                timestamp: 25,
                duration: 4
            },
            {
                type: 'user',
                text: '303-555-8193 and my email is sarahj@gmail.com.',
                timestamp: 29,
                duration: 3
            },
            {
                type: 'ai',
                text: 'Got it. And were you the driver or a passenger?',
                timestamp: 36,
                duration: 3
            },
            {
                type: 'user',
                text: 'I… I was the one driving.',
                timestamp: 39.5,
                duration: 2
            },
            {
                type: 'ai',
                text: 'Understood. I have an opening for a free consultation today at 3:30 PM or tomorrow at 10 AM.',
                timestamp: 41.5,
                duration: 5
            },
            {
                type: 'ai',
                text: 'Which do you prefer?',
                timestamp: 47,
                duration: 5
            },
            {
                type: 'user',
                text: 'Tomorrow at 10.',
                timestamp: 49,
                duration: 1
            },
            {
                type: 'ai',
                text: 'You\'re confirmed for tomorrow at 10 AM. You\'ll receive a confirmation email and a reminder text shortly.',
                timestamp: 50.5,
                duration: 5
            },
            {
                type: 'user',
                text: 'Perfect, thanks so much.',
                timestamp: 56.5,
                duration: 2
            },
            {
                type: 'ai',
                text: 'You\'re very welcome, Sarah. We look forward to helping you tomorrow.',
                timestamp: 58.5,
                duration: 3
            }
        ],
        audio: '../audios/lawfirm_.mp3'
    },
tab3: {
    conversation: [
        {
            type: 'ai',
            text: 'Thanks for calling PeakMotion Chiropractic.',
            timestamp: 0,
            duration: 6
        },
        {
            type: 'ai',
            text: 'How can I help you today?',
            timestamp: 2,
            duration: 6
        },
        {
            type: 'user',
            text: 'Hey there, I\'ve had some lower back pain for a while and need to see someone about it.',
            timestamp: 4.5,
            duration: 4
        },
        {
            type: 'ai',
            text: 'We can definitely help with that. Is this your first visit to our clinic?',
            timestamp: 9,
            duration: 4
        },
        {
            type: 'user',
            text: 'Yes, it is.',
            timestamp: 13,
            duration: 1
        },
        {
            type: 'ai',
            text: 'Great! Let\'s get you taken care of. May I have your full name?',
            timestamp: 14.5,
            duration: 3
        },
        {
            type: 'user',
            text: 'Yeah! Mark Daniels.',
            timestamp: 18,
            duration: 2
        },
        {
            type: 'ai',
            text: 'Thanks, Mark. What\'s the best phone number for your appointment confirmation?',
            timestamp: 20.5,
            duration: 4
        },
        {
            type: 'user',
            text: '720-555-4419.',
            timestamp: 24,
            duration: 2
        },
        {
            type: 'ai',
            text: 'Okay great — is your pain recent or something you\'ve been dealing with for a while?',
            timestamp: 28.5,
            duration: 4
        },
        {
            type: 'user',
            text: 'Um... probably about three months now.',
            timestamp: 33,
            duration: 2
        },
        {
            type: 'ai',
            text: 'Thanks for sharing that. I have availability for a new patient exam today at 5 PM or tomorrow at 11:30 AM.',
            timestamp: 36.5,
            duration: 5
        },
        {
            type: 'ai',
            text: 'Which works for you?',
            timestamp: 44,
            duration: 5
        },
        {
            type: 'user',
            text: 'Tomorrow works with me.',
            timestamp: 46,
            duration: 1
        },
        {
            type: 'ai',
            text: 'You\'re booked for tomorrow at 11:30 AM. You\'ll receive a text with our address and intake form.',
            timestamp: 48,
            duration: 4
        },
        {
            type: 'user',
            text: 'Awesome, thank you for your help.',
            timestamp: 53.5,
            duration: 1
        },
        {
            type: 'ai',
            text: 'You\'re all set, Mark. We look forward to seeing you tomorrow at PeakMotion Chiropractic!',
            timestamp: 57,
            duration: 4
        }
    ],
    audio: '../audios/chiropractor.mp3'
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