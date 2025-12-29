/**
 * Audio Player Module
 * Handles audio playback, reciter selection, and playback controls
 */

const AudioPlayer = {
    audio: null,
    nextAudio: null, // Preload next ayah
    currentSurah: null,
    currentAyah: null,
    currentReciter: 'ar.alafasy',
    isPlaying: false,
    playlist: [],
    currentIndex: 0,
    repeatMode: 'off', // 'off', 'one', 'all'
    repeatCount: 1, // How many times to repeat (1-10)
    currentRepeatIteration: 0,
    playbackMode: 'ayah', // 'ayah' or 'surah'

    reciters: [
        { id: 'ar.alafasy', name: 'مشاري راشد العفاسي', nameEn: 'Mishary Rashid Alafasy' },
        { id: 'ar.abdulbasitmurattal', name: 'عبد الباسط عبد الصمد', nameEn: 'Abdul Basit Abdul Samad' },
        { id: 'ar.minshawi', name: 'محمد صديق المنشاوي', nameEn: 'Mohamed Siddiq Al-Minshawi' },
        { id: 'ar.husary', name: 'محمود خليل الحصري', nameEn: 'Mahmoud Khalil Al-Hussary' },
        { id: 'ar.saadalghamadi', name: 'سعد الغامدي', nameEn: 'Saad Al-Ghamadi' },
        { id: 'ar.shaatree', name: 'أبو بكر الشاطري', nameEn: 'Abu Bakr Al-Shatri' },
        { id: 'ar.abdurrahmaansudais', name: 'عبد الرحمن السديس', nameEn: 'Abdurrahman As-Sudais' },
        { id: 'ar.mahermuaiqly', name: 'ماهر المعيقلي', nameEn: 'Maher Al-Muaiqly' }
    ],

    /**
     * Initialize audio player
     */
    init() {
        console.log('Initializing Audio Player...');

        this.audio = new Audio();
        this.nextAudio = new Audio(); // For preloading
        this.currentReciter = App.settings.defaultReciter;
        this.repeatCount = 1;
        this.currentRepeatIteration = 0;

        this.setupEventListeners();
        this.setupAudioListeners();
    },

    /**
     * Setup event listeners for player controls
     */
    setupEventListeners() {
        // Play/Pause button
        const playPauseBtn = document.getElementById('playPauseBtn');
        if (playPauseBtn) {
            playPauseBtn.addEventListener('click', () => this.togglePlayPause());
        }

        // Previous button
        const prevBtn = document.getElementById('prevBtn');
        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.playPrevious());
        }

        // Next button
        const nextBtn = document.getElementById('nextBtn');
        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.playNext());
        }

        // Volume slider
        const volumeSlider = document.getElementById('volumeSlider');
        if (volumeSlider) {
            volumeSlider.addEventListener('input', (e) => {
                this.setVolume(e.target.value / 100);
            });
        }

        // Progress bar
        const audioProgress = document.getElementById('audioProgress');
        if (audioProgress) {
            audioProgress.addEventListener('click', (e) => {
                const rect = e.target.getBoundingClientRect();
                const percent = (e.clientX - rect.left) / rect.width;
                this.seek(percent);
            });
        }

        // Reciter button
        const reciterBtn = document.getElementById('reciterBtn');
        if (reciterBtn) {
            reciterBtn.addEventListener('click', () => this.showReciterModal());
        }

        // Repeat button
        const repeatBtn = document.getElementById('repeatBtn');
        if (repeatBtn) {
            repeatBtn.addEventListener('click', () => this.toggleRepeatMode());
        }

        // Repeat count selector
        const repeatCountSelect = document.getElementById('repeatCountSelect');
        if (repeatCountSelect) {
            repeatCountSelect.addEventListener('change', (e) => {
                this.setRepeatCount(e.target.value);
            });
        }

        // Close reciter modal
        const closeReciterModal = document.getElementById('closeReciterModal');
        const reciterBackdrop = document.getElementById('reciterBackdrop');

        if (closeReciterModal) {
            closeReciterModal.addEventListener('click', () => this.hideReciterModal());
        }

        if (reciterBackdrop) {
            reciterBackdrop.addEventListener('click', () => this.hideReciterModal());
        }
    },

    /**
     * Setup audio element listeners
     */
    setupAudioListeners() {
        if (!this.audio) return;

        // Time update
        this.audio.addEventListener('timeupdate', () => {
            this.updateProgress();
        });

        // Loaded metadata
        this.audio.addEventListener('loadedmetadata', () => {
            this.updateDuration();
        });

        // Ended
        this.audio.addEventListener('ended', () => {
            this.handleAudioEnded();
        });

        // Error
        this.audio.addEventListener('error', (e) => {
            console.error('Audio error:', e);
            
            // Get more detailed error information
            const error = this.audio.error;
            let errorMessage = 'حدث خطأ في تشغيل الصوت';
            
            if (error) {
                switch (error.code) {
                    case error.MEDIA_ERR_ABORTED:
                        errorMessage = 'تم إلغاء تحميل الصوت';
                        break;
                    case error.MEDIA_ERR_NETWORK:
                        errorMessage = 'فشل تحميل الصوت. تحقق من اتصال الإنترنت';
                        break;
                    case error.MEDIA_ERR_DECODE:
                        errorMessage = 'فشل فك تشفير ملف الصوت';
                        break;
                    case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
                        errorMessage = 'القارئ المحدد غير متوفر. يرجى اختيار قارئ آخر';
                        console.error('Invalid reciter or audio source:', this.currentReciter);
                        break;
                }
            }
            
            App.showToast(errorMessage, 'error');
            
            // Don't stop completely, just pause to allow user to try again
            this.pause();
        });

        // Playing
        this.audio.addEventListener('playing', () => {
            this.isPlaying = true;
            this.updatePlayButton();
        });

        // Paused
        this.audio.addEventListener('pause', () => {
            this.isPlaying = false;
            this.updatePlayButton();
        });
    },

    /**
     * Handle audio ended event with repeat logic
     */
    handleAudioEnded() {
        // Check repeat mode
        if (this.repeatMode === 'one') {
            // Repeat current ayah
            this.currentRepeatIteration++;
            if (this.currentRepeatIteration < this.repeatCount) {
                this.audio.play();
                App.showToast(`تكرار ${this.currentRepeatIteration + 1} من ${this.repeatCount}`, 'info');
            } else {
                // Finished repeating, move to next or stop
                this.currentRepeatIteration = 0;
                if (this.playbackMode === 'surah' && App.settings.autoPlay) {
                    this.playNext();
                } else {
                    this.stop();
                }
            }
        } else if (this.repeatMode === 'all' && this.playbackMode === 'surah') {
            // Playing full surah with repeat
            if (this.currentIndex < this.playlist.length - 1) {
                // Continue to next ayah
                this.playNext();
            } else {
                // Reached end of surah, check if we should repeat
                this.currentRepeatIteration++;
                if (this.currentRepeatIteration < this.repeatCount) {
                    // Restart surah
                    this.currentIndex = 0;
                    this.playFromPlaylist(0);
                    App.showToast(`تكرار السورة ${this.currentRepeatIteration + 1} من ${this.repeatCount}`, 'info');
                } else {
                    // Finished all repeats
                    this.currentRepeatIteration = 0;
                    this.stop();
                    App.showToast('انتهى التشغيل', 'success');
                }
            }
        } else if (App.settings.autoPlay && this.playbackMode === 'surah') {
            // Auto-play next ayah without repeat
            this.playNext();
        } else {
            this.stop();
        }
    },

    /**
     * Toggle repeat mode
     */
    toggleRepeatMode() {
        const modes = ['off', 'one', 'all'];
        const currentIndex = modes.indexOf(this.repeatMode);
        this.repeatMode = modes[(currentIndex + 1) % modes.length];

        this.updateRepeatButton();

        const messages = {
            'off': 'إيقاف التكرار',
            'one': 'تكرار الآية الحالية',
            'all': 'تكرار السورة كاملة'
        };

        App.showToast(messages[this.repeatMode], 'success');
    },

    /**
     * Update repeat button appearance
     */
    updateRepeatButton() {
        const btn = document.getElementById('repeatBtn');
        if (!btn) return;

        const icon = btn.querySelector('i');
        if (icon) {
            // Update button style based on mode
            if (this.repeatMode === 'off') {
                icon.style.color = 'var(--color-text-gray)';
                btn.title = 'تكرار';
            } else if (this.repeatMode === 'one') {
                icon.style.color = 'var(--color-primary)';
                icon.className = 'fas fa-repeat';
                btn.title = 'تكرار الآية';
            } else {
                icon.style.color = 'var(--color-accent)';
                icon.className = 'fas fa-repeat';
                btn.title = 'تكرار السورة';
            }
        }

        // Update repeat count display
        const countDisplay = document.getElementById('repeatCountDisplay');
        if (countDisplay) {
            countDisplay.textContent = this.repeatMode !== 'off' ? `×${this.repeatCount}` : '';
        }
    },

    /**
     * Set repeat count
     */
    setRepeatCount(count) {
        this.repeatCount = Math.max(1, Math.min(10, parseInt(count)));
        this.currentRepeatIteration = 0;
        this.updateRepeatButton();
    },

    /**
     * Play full Surah continuously
     */
    async playFullSurah(surahNumber) {
        try {
            App.showLoading();

            const surahData = await APIService.getSurah(surahNumber, this.currentReciter);

            if (surahData && surahData.ayahs) {
                this.playlist = surahData.ayahs;
                this.currentIndex = 0;
                this.currentSurah = surahNumber;
                this.playbackMode = 'surah';
                this.currentRepeatIteration = 0;

                // Enable autoplay for continuous playback - keep it enabled
                App.settings.autoPlay = true;

                this.playFromPlaylist(0);

                App.showToast('تشغيل السورة كاملة', 'success');
            }

            App.hideLoading();
        } catch (error) {
            console.error('Error playing full Surah:', error);
            App.showToast('حدث خطأ في تشغيل السورة', 'error');
            App.hideLoading();
        }
    },

    /**
     * Play a specific Ayah
     */
    async playAyah(surahNumber, ayahNumber) {
        try {
            // Get audio URL for the specific Ayah
            const reference = `${surahNumber}:${ayahNumber}`;
            const ayahData = await APIService.getAyah(reference, this.currentReciter);

            if (ayahData && ayahData.audio) {
                this.currentSurah = surahNumber;
                this.currentAyah = ayahNumber;
                this.playbackMode = 'ayah';
                this.currentRepeatIteration = 0;

                // Load and play audio
                this.audio.src = ayahData.audio;
                this.audio.play();

                // Show player
                this.showPlayer();

                // Update current Ayah text
                this.updateCurrentAyahDisplay(ayahData.text);

                // Highlight current Ayah
                this.highlightCurrentAyah(surahNumber, ayahNumber);
            }
        } catch (error) {
            console.error('Error playing Ayah:', error);
            App.showToast('حدث خطأ في تشغيل الآية', 'error');
        }
    },

    /**
     * Play entire Surah
     */
    async playSurah(surahNumber) {
        try {
            const surahData = await APIService.getSurah(surahNumber, this.currentReciter);

            if (surahData && surahData.ayahs) {
                this.playlist = surahData.ayahs;
                this.currentIndex = 0;
                this.currentSurah = surahNumber;

                this.playFromPlaylist(0);
            }
        } catch (error) {
            console.error('Error playing Surah:', error);
            App.showToast('حدث خطأ في تشغيل السورة', 'error');
        }
    },

    /**
     * Play from playlist
     */
    playFromPlaylist(index) {
        if (index >= 0 && index < this.playlist.length) {
            this.currentIndex = index;
            const ayah = this.playlist[index];

            if (ayah.audio) {
                this.audio.src = ayah.audio;
                this.audio.play();

                this.showPlayer();
                this.updateCurrentAyahDisplay(ayah.text);
                this.highlightCurrentAyah(this.currentSurah, ayah.numberInSurah);
                
                // Preload next ayah to remove delay
                this.preloadNextAyah();
            }
        }
    },

    /**
     * Toggle play/pause
     */
    togglePlayPause() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    },

    /**
     * Play
     */
    play() {
        if (this.audio && this.audio.src) {
            this.audio.play();
        }
    },

    /**
     * Pause
     */
    pause() {
        if (this.audio) {
            this.audio.pause();
        }
    },

    /**
     * Stop
     */
    stop() {
        if (this.audio) {
            this.audio.pause();
            this.audio.currentTime = 0;
        }
        this.isPlaying = false;
        this.updatePlayButton();
    },

    /**
     * Play next Ayah
     */
    playNext() {
        if (this.playlist.length > 0) {
            this.playFromPlaylist(this.currentIndex + 1);
        }
    },

    /**
     * Play previous Ayah
     */
    playPrevious() {
        if (this.playlist.length > 0) {
            this.playFromPlaylist(this.currentIndex - 1);
        }
    },

    /**
     * Set volume
     */
    setVolume(volume) {
        if (this.audio) {
            this.audio.volume = Math.max(0, Math.min(1, volume));
        }
    },

    /**
     * Seek to position
     */
    seek(percent) {
        if (this.audio && this.audio.duration) {
            this.audio.currentTime = this.audio.duration * percent;
        }
    },

    /**
     * Update progress bar
     */
    updateProgress() {
        if (!this.audio) return;

        const progressBar = document.getElementById('audioProgressBar');
        const currentTimeEl = document.getElementById('currentTime');

        if (progressBar && this.audio.duration) {
            const percent = (this.audio.currentTime / this.audio.duration) * 100;
            progressBar.style.width = `${percent}%`;
        }

        if (currentTimeEl) {
            currentTimeEl.textContent = App.formatTime(this.audio.currentTime);
        }
    },

    /**
     * Update duration display
     */
    updateDuration() {
        const durationEl = document.getElementById('duration');
        if (durationEl && this.audio) {
            durationEl.textContent = App.formatTime(this.audio.duration);
        }
    },

    /**
     * Update play/pause button
     */
    updatePlayButton() {
        const btn = document.getElementById('playPauseBtn');
        if (btn) {
            const icon = btn.querySelector('i');
            if (icon) {
                icon.className = this.isPlaying ? 'fas fa-pause' : 'fas fa-play';
            }
        }
    },

    /**
     * Update current Ayah display in player
     */
    updateCurrentAyahDisplay(text) {
        const el = document.getElementById('currentAyahText');
        if (el) {
            // Limit text length for display
            const displayText = text.length > 100 ? text.substring(0, 100) + '...' : text;
            el.textContent = displayText;
        }
    },

    /**
     * Highlight current playing Ayah
     */
    highlightCurrentAyah(surahNum, ayahNum) {
        // Remove previous highlights
        document.querySelectorAll('.ayah-container').forEach(el => {
            el.style.background = '';
        });

        // Highlight current
        const current = document.querySelector(`.ayah-container[data-surah="${surahNum}"][data-number-in-surah="${ayahNum}"]`);
        if (current) {
            current.style.background = 'linear-gradient(90deg, rgba(30, 123, 95, 0.1), transparent)';
            current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    },

    /**
     * Show player
     */
    showPlayer() {
        const container = document.getElementById('audioPlayerContainer');
        if (container) {
            container.classList.remove('hidden');
        }
    },

    /**
     * Hide player
     */
    hidePlayer() {
        const container = document.getElementById('audioPlayerContainer');
        if (container) {
            container.classList.add('hidden');
        }
    },

    /**
     * Show reciter selection modal
     */
    showReciterModal() {
        const modal = document.getElementById('reciterModal');
        if (!modal) return;

        // Populate reciter list
        const list = document.getElementById('reciterList');
        if (list) {
            list.innerHTML = '';

            this.reciters.forEach(reciter => {
                const item = document.createElement('div');
                item.className = 'card mb-4';
                item.style.cursor = 'pointer';
                item.innerHTML = `
                    <div class="flex items-center justify-between">
                        <div>
                            <div class="arabic-text" style="font-size: var(--text-lg);">${reciter.name}</div>
                            <div style="color: var(--color-text-gray); font-size: var(--text-sm);">${reciter.nameEn}</div>
                        </div>
                        ${this.currentReciter === reciter.id ? '<i class="fas fa-check" style="color: var(--color-success);"></i>' : ''}
                    </div>
                `;

                item.addEventListener('click', () => {
                    this.selectReciter(reciter.id, reciter.name);
                });

                list.appendChild(item);
            });
        }

        modal.classList.add('active');
    },

    /**
     * Hide reciter modal
     */
    hideReciterModal() {
        const modal = document.getElementById('reciterModal');
        if (modal) {
            modal.classList.remove('active');
        }
    },

    /**
     * Select reciter
     */
    selectReciter(reciterId, reciterName) {
        this.currentReciter = reciterId;
        App.settings.defaultReciter = reciterId;
        App.saveSettings();

        const currentReciterEl = document.getElementById('currentReciter');
        if (currentReciterEl) {
            currentReciterEl.textContent = reciterName;
        }

        App.showToast(`تم اختيار ${reciterName}`, 'success');
        this.hideReciterModal();
        
        // If currently playing, reload with new reciter
        if (this.isPlaying || this.audio.src) {
            this.reloadWithNewReciter();
        }
    },
    
    /**
     * Preload next ayah to eliminate delays
     */
    preloadNextAyah() {
        if (this.playbackMode === 'surah' && this.currentIndex + 1 < this.playlist.length) {
            const nextAyah = this.playlist[this.currentIndex + 1];
            if (nextAyah && nextAyah.audio) {
                this.nextAudio.src = nextAyah.audio;
                this.nextAudio.load();
            }
        }
    },
    
    /**
     * Reload current playback with new reciter
     */
    async reloadWithNewReciter() {
        const wasPlaying = this.isPlaying;
        const currentTime = this.audio.currentTime;
        
        try {
            if (this.playbackMode === 'surah' && this.currentSurah) {
                // Reload the entire playlist with new reciter
                App.showLoading();
                const surahData = await APIService.getSurah(this.currentSurah, this.currentReciter);
                
                if (surahData && surahData.ayahs) {
                    this.playlist = surahData.ayahs;
                    
                    // Continue from current index
                    if (this.currentIndex < this.playlist.length) {
                        const ayah = this.playlist[this.currentIndex];
                        this.audio.src = ayah.audio;
                        
                        if (wasPlaying) {
                            this.audio.play();
                        }
                        
                        this.updateCurrentAyahDisplay(ayah.text);
                        this.preloadNextAyah();
                    }
                }
                App.hideLoading();
            } else if (this.playbackMode === 'ayah' && this.currentSurah && this.currentAyah) {
                // Reload single ayah
                const reference = `${this.currentSurah}:${this.currentAyah}`;
                const ayahData = await APIService.getAyah(reference, this.currentReciter);
                
                if (ayahData && ayahData.audio) {
                    this.audio.src = ayahData.audio;
                    
                    if (wasPlaying) {
                        this.audio.play();
                    }
                    
                    this.updateCurrentAyahDisplay(ayahData.text);
                }
            }
        } catch (error) {
            console.error('Error reloading with new reciter:', error);
            App.showToast('حدث خطأ في تغيير القارئ', 'error');
        }
    }
};

window.AudioPlayer = AudioPlayer;
