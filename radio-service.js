/**
 * Quran Radio Service
 * Centralized audio engine for live Quran radio streaming.
 * Coordinates with the existing recitation audio player, manages state,
 * handles bounded reconnections, and updates Media Session.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        const RS = root.RadioStations || (typeof require === 'function' ? require('./radio-stations.js') : null);
        module.exports = factory(RS, root.PlaybackStore, root.AudioPlayer);
    } else {
        root.RadioService = factory(root.RadioStations, root.PlaybackStore, root.AudioPlayer);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (RadioStations, PlaybackStore, AudioPlayer) {
    'use strict';

    const STORAGE_KEY = 'quran_radio_prefs_v1';
    const MAX_RETRIES = 4;
    const RETRY_DELAYS = [1000, 2000, 4000, 8000];

    const RadioService = {
        audio: null,
        station: null,
        state: 'idle', // idle | loading | playing | paused | reconnecting | error
        errorMessage: '',
        retryCount: 0,
        retryTimer: null,
        volume: 0.8,
        miniPlayerVisible: true,
        listeners: new Set(),
        initialized: false,

        /* ------------------------------------------------------------ init */
        init(options = {}) {
            if (this.initialized && !options.force) return;

            // Resolve dependencies if injected late
            if (!RadioStations) {
                if (typeof window !== 'undefined' && window.RadioStations) {
                    RadioStations = window.RadioStations;
                } else if (typeof require === 'function') {
                    try { RadioStations = require('./radio-stations.js'); } catch (e) {}
                }
            }
            if (!PlaybackStore) {
                if (typeof window !== 'undefined' && window.PlaybackStore) {
                    PlaybackStore = window.PlaybackStore;
                } else if (typeof global !== 'undefined' && global.PlaybackStore) {
                    PlaybackStore = global.PlaybackStore;
                }
            }
            if (!AudioPlayer) {
                if (typeof window !== 'undefined' && window.AudioPlayer) {
                    AudioPlayer = window.AudioPlayer;
                } else if (typeof global !== 'undefined' && global.AudioPlayer) {
                    AudioPlayer = global.AudioPlayer;
                }
            }

            this.volume = 0.8;
            this.state = 'idle';
            this.errorMessage = '';
            this.retryCount = 0;
            this.clearRetryTimer();

            this.loadPreferences();

            // Create single dedicated Audio instance
            if (options.audio || typeof Audio !== 'undefined') {
                this.audio = options.audio || new Audio();
                this.audio.preload = 'none';
                this.audio.volume = this.volume;
                this.setupAudioListeners();
            }

            // Set default station
            if (!this.station && RadioStations) {
                this.station = RadioStations.getDefault();
            }

            this.setupRecitationCoordination();
            this.initialized = true;
            this.notify();
        },

        /* ----------------------------------------------------- preferences */
        loadPreferences() {
            try {
                if (typeof localStorage === 'undefined') return;
                const raw = localStorage.getItem(STORAGE_KEY);
                if (!raw) return;
                const prefs = JSON.parse(raw);
                if (prefs && typeof prefs === 'object') {
                    if (typeof prefs.volume === 'number' && prefs.volume >= 0 && prefs.volume <= 1) {
                        this.volume = prefs.volume;
                    }
                    if (typeof prefs.miniPlayerVisible === 'boolean') {
                        this.miniPlayerVisible = prefs.miniPlayerVisible;
                    }
                    if (prefs.lastStationId && RadioStations) {
                        const found = RadioStations.getById(prefs.lastStationId);
                        if (found) this.station = found;
                    }
                }
            } catch (e) {
                console.warn('Could not load radio preferences', e);
            }
        },

        savePreferences() {
            try {
                if (typeof localStorage === 'undefined') return;
                const prefs = {
                    version: 1,
                    volume: this.volume,
                    miniPlayerVisible: this.miniPlayerVisible,
                    lastStationId: this.station ? this.station.id : null
                };
                localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
            } catch (e) {
                // Ignore storage quota/permission errors
            }
        },

        /* -------------------------------------------------- audio listeners */
        setupAudioListeners() {
            if (!this.audio) return;

            this.audio.addEventListener('playing', () => {
                this.clearRetry();
                this.setState('playing');
                this.updateMediaSession();
            });

            this.audio.addEventListener('waiting', () => {
                if (this.state === 'playing') {
                    this.setState('loading', 'جارٍ التخزين المؤقت للبث…');
                }
            });

            this.audio.addEventListener('pause', () => {
                // If paused intentionally and not transitioning or erroring
                if (this.state !== 'loading' && this.state !== 'reconnecting' && this.state !== 'error') {
                    this.setState('paused');
                    this.updateMediaSession();
                }
            });

            this.audio.addEventListener('error', (e) => {
                const mediaError = this.audio && this.audio.error ? this.audio.error.code : 0;
                let msg = 'تعذر تشغيل البث المباشر. يرجى التحقق من الاتصال بالإنترنت.';
                if (mediaError === 2) msg = 'خطأ في شبكة الاتصال أثناء تحميل البث.';
                if (mediaError === 3) msg = 'خطأ في فك تشفير الصوت للبث المباشر.';
                if (mediaError === 4) msg = 'صيغة البث غير مدعومة أو الرابط غير متاح حاليًا.';

                console.warn('Radio audio error encountered:', mediaError, e);
                this.handleStreamFailure(msg);
            });

            this.audio.addEventListener('ended', () => {
                // Live stream ended unexpectedly; treat as stream interruption
                this.handleStreamFailure('انقطع البث المباشر من المصدر.');
            });
        },

        /* --------------------------------- coordination with Quran recitation */
        setupRecitationCoordination() {
            const ps = PlaybackStore || (typeof window !== 'undefined' ? window.PlaybackStore : (typeof global !== 'undefined' ? global.PlaybackStore : null));
            if (ps && typeof ps.subscribe === 'function') {
                ps.subscribe((state, keys) => {
                    if (keys.includes('status')) {
                        const recStatus = state.status;
                        if ((recStatus === 'playing' || recStatus === 'buffering') && this.isPlaying()) {
                            this.pause(false);
                        }
                    }
                });
            }
        },

        /* ---------------------------------------------------- stream actions */
        setStation(stationOrId, autoPlay = false) {
            let target = null;
            if (typeof stationOrId === 'string' && RadioStations) {
                target = RadioStations.getById(stationOrId);
            } else if (stationOrId && typeof stationOrId === 'object') {
                target = stationOrId;
            }
            if (!target) return;

            const wasPlaying = this.isPlaying();
            this.cancelRetry();

            if (this.audio) {
                try {
                    this.audio.pause();
                    this.audio.removeAttribute('src');
                    this.audio.load();
                } catch (e) { /* ignore */ }
            }

            this.station = target;
            this.retryCount = 0;
            this.savePreferences();

            if (autoPlay || wasPlaying) {
                this.play();
            } else {
                this.setState('idle');
            }
        },

        async play() {
            if (!this.station) {
                if (RadioStations) this.station = RadioStations.getDefault();
                if (!this.station) return;
            }

            // Coordination: Pause Quran recitation player if active
            const resolvedAudioPlayer = AudioPlayer || (typeof window !== 'undefined' ? window.AudioPlayer : (typeof global !== 'undefined' ? global.AudioPlayer : null));
            const resolvedPlaybackStore = PlaybackStore || (typeof window !== 'undefined' ? window.PlaybackStore : (typeof global !== 'undefined' ? global.PlaybackStore : null));
            if (resolvedAudioPlayer && typeof resolvedAudioPlayer.pause === 'function') {
                const recStatus = resolvedPlaybackStore ? resolvedPlaybackStore.get().status : null;
                if (!recStatus || recStatus === 'playing' || recStatus === 'buffering') {
                    resolvedAudioPlayer.pause();
                }
            }

            this.cancelRetry();
            this.setState('loading', 'جارٍ الاتصال بالإذاعة…');

            if (!this.audio) {
                this.setState('playing');
                return;
            }

            // Fresh live stream URL with cache-buster timestamp parameter to prevent stale buffers
            const streamUrl = this.getStreamUrl();
            if (this.audio.src !== streamUrl) {
                this.audio.src = streamUrl;
            }

            try {
                const playPromise = this.audio.play();
                if (playPromise !== undefined) {
                    await playPromise;
                }
            } catch (err) {
                if (err && err.name === 'NotAllowedError') {
                    // Browser Autoplay Policy blocked
                    this.setState('paused', 'اضغط زر التشغيل لبدء الاستماع');
                } else if (err && err.name === 'AbortError') {
                    // Play request was interrupted by another action; benign
                } else {
                    console.warn('audio.play() failed:', err);
                    this.handleStreamFailure('تعذر تشغيل الصوت. اضغط إعادة المحاولة.');
                }
            }
        },

        pause(userInitiated = true) {
            this.cancelRetry();
            if (this.audio) {
                try {
                    this.audio.pause();
                } catch (e) { /* ignore */ }
            }
            this.setState('paused');
            if (userInitiated) {
                this.updateMediaSession();
            }
        },

        stop() {
            this.cancelRetry();
            if (this.audio) {
                try {
                    this.audio.pause();
                    this.audio.removeAttribute('src');
                    this.audio.load();
                } catch (e) { /* ignore */ }
            }
            this.setState('idle');
            this.clearMediaSession();
        },

        togglePlay() {
            if (this.isPlaying() || this.state === 'loading' || this.state === 'reconnecting') {
                this.pause(true);
            } else {
                this.play();
            }
        },

        setVolume(value) {
            const num = Math.max(0, Math.min(1, Number(value)));
            if (Number.isFinite(num)) {
                this.volume = num;
                if (this.audio) this.audio.volume = num;
                this.savePreferences();
                this.notify();
            }
        },

        setMiniPlayerVisible(visible) {
            this.miniPlayerVisible = !!visible;
            this.savePreferences();
            this.notify();
        },

        nextStation() {
            if (!RadioStations) return;
            const all = RadioStations.getAll();
            if (!all.length) return;
            const idx = all.findIndex(s => s.id === (this.station ? this.station.id : ''));
            const nextIdx = (idx + 1) % all.length;
            this.setStation(all[nextIdx], this.isPlaying());
        },

        previousStation() {
            if (!RadioStations) return;
            const all = RadioStations.getAll();
            if (!all.length) return;
            const idx = all.findIndex(s => s.id === (this.station ? this.station.id : ''));
            const prevIdx = (idx - 1 + all.length) % all.length;
            this.setStation(all[prevIdx], this.isPlaying());
        },

        /* ---------------------------------------------------- retry logic */
        handleStreamFailure(msg) {
            if (this.retryCount < MAX_RETRIES) {
                const delay = RETRY_DELAYS[this.retryCount] || 5000;
                this.retryCount++;
                this.setState('reconnecting', `انقطع الاتصال. جارٍ إعادة المحاولة (${this.retryCount}/${MAX_RETRIES})…`);

                this.clearRetryTimer();
                this.retryTimer = setTimeout(() => {
                    if (this.state === 'reconnecting') {
                        if (this.audio) {
                            try {
                                this.audio.src = this.getStreamUrl();
                                this.audio.play().catch(() => {});
                            } catch (e) {}
                        }
                    }
                }, delay);
            } else {
                this.clearRetry();
                this.setState('error', msg || 'تعذر تشغيل الإذاعة بعد عدة محاولات. يرجى تجربة محطة أخرى.');
            }
        },

        retry() {
            this.retryCount = 0;
            this.play();
        },

        cancelRetry() {
            this.clearRetryTimer();
            this.retryCount = 0;
        },

        clearRetry() {
            this.clearRetryTimer();
            this.retryCount = 0;
        },

        clearRetryTimer() {
            if (this.retryTimer) {
                clearTimeout(this.retryTimer);
                this.retryTimer = null;
            }
        },

        getStreamUrl() {
            if (!this.station) return '';
            // Append cache busting parameter so live streams reconnect to fresh chunk/socket
            const sep = this.station.streamUrl.includes('?') ? '&' : '?';
            return `${this.station.streamUrl}${sep}_t=${Date.now()}`;
        },

        /* -------------------------------------------------- state management */
        setState(newState, msg = '') {
            const changed = this.state !== newState || this.errorMessage !== msg;
            this.state = newState;
            this.errorMessage = msg;
            if (changed) {
                this.notify();
            }
        },

        isPlaying() {
            return this.state === 'playing';
        },

        /* -------------------------------------------------- Media Session */
        updateMediaSession() {
            if (typeof navigator === 'undefined' || !('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') {
                return;
            }

            if (!this.station) return;

            try {
                navigator.mediaSession.metadata = new MediaMetadata({
                    title: this.station.name,
                    artist: 'الإذاعة القرآنية المباركة',
                    album: this.station.description || 'بث مباشر',
                    artwork: [
                        { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
                        { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }
                    ]
                });

                navigator.mediaSession.playbackState = this.isPlaying() ? 'playing' : (this.state === 'paused' ? 'paused' : 'none');

                navigator.mediaSession.setActionHandler('play', () => this.play());
                navigator.mediaSession.setActionHandler('pause', () => this.pause(true));
                navigator.mediaSession.setActionHandler('stop', () => this.stop());
                navigator.mediaSession.setActionHandler('nexttrack', () => this.nextStation());
                navigator.mediaSession.setActionHandler('previoustrack', () => this.previousStation());
            } catch (e) {
                // Ignore platform metadata issues
            }
        },

        clearMediaSession() {
            if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
            try {
                navigator.mediaSession.playbackState = 'none';
                if (navigator.mediaSession.metadata) {
                    navigator.mediaSession.metadata = null;
                }
            } catch (e) {}
        },

        /* ------------------------------------------------- pub/sub subscribe */
        subscribe(fn) {
            this.listeners.add(fn);
            // Immediately dispatch current state to subscriber
            try {
                fn(this.getSnapshot());
            } catch (e) {
                console.error('Radio subscriber failed', e);
            }
            return () => this.listeners.delete(fn);
        },

        notify() {
            const snap = this.getSnapshot();
            this.listeners.forEach(fn => {
                try {
                    fn(snap);
                } catch (e) {
                    console.error('Radio listener error', e);
                }
            });
        },

        getSnapshot() {
            return {
                state: this.state,
                station: this.station,
                errorMessage: this.errorMessage,
                retryCount: this.retryCount,
                volume: this.volume,
                miniPlayerVisible: this.miniPlayerVisible,
                isPlaying: this.isPlaying()
            };
        }
    };

    return RadioService;
});
