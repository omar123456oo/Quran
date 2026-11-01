/**
 * Quran Radio Service
 * Centralized audio engine for live Quran radio streaming.
 * Coordinates with the existing recitation audio player, manages state,
 * handles bounded reconnections, fallback URLs, mute/volume, and Media Session.
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
    const RETRY_DELAYS = [800, 2000, 4000, 8000];
    const CONNECTION_TIMEOUT_MS = 12000;

    const RadioService = {
        audio: null,
        station: null,
        state: 'idle', // idle | loading | playing | paused | reconnecting | error
        errorMessage: '',
        retryCount: 0,
        fallbackIndex: 0,
        retryTimer: null,
        connectTimeoutTimer: null,
        volume: 0.8,
        muted: false,
        miniPlayerVisible: true,
        wasPlayingBeforeOffline: false,
        listeners: new Set(),
        initialized: false,
        networkListenersBound: false,

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
            this.muted = false;
            this.station = null;
            this.state = 'idle';
            this.errorMessage = '';
            this.retryCount = 0;
            this.fallbackIndex = 0;
            this.wasPlayingBeforeOffline = false;
            this.clearRetryTimer();
            this.clearConnectTimeout();

            this.loadPreferences();

            // Create single dedicated Audio instance
            if (options.audio || typeof Audio !== 'undefined') {
                this.audio = options.audio || new Audio();
                this.audio.preload = 'none';
                this.audio.volume = this.muted ? 0 : this.volume;
                this.audio.muted = this.muted;
                this.setupAudioListeners();
            }

            // Set default station
            if (!this.station && RadioStations) {
                this.station = RadioStations.getDefault();
            }

            this.setupRecitationCoordination();
            this.setupNetworkListeners();
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
                    if (typeof prefs.muted === 'boolean') {
                        this.muted = prefs.muted;
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
                // Ignore corrupted storage
            }
        },

        savePreferences() {
            try {
                if (typeof localStorage === 'undefined') return;
                const prefs = {
                    version: 1,
                    volume: this.volume,
                    muted: this.muted,
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
                this.clearConnectTimeout();
                this.clearRetry();
                this.setState('playing');
                this.updateMediaSession();
            });

            this.audio.addEventListener('waiting', () => {
                if (this.state === 'playing') {
                    this.setState('loading', 'جارٍ التخزين المؤقت للبث…');
                }
            });

            this.audio.addEventListener('stalled', () => {
                if (this.state === 'playing') {
                    this.setState('loading', 'ضعف في تدفق البيانات، جارٍ الاستئناف…');
                }
            });

            this.audio.addEventListener('pause', () => {
                this.clearConnectTimeout();
                // If paused intentionally and not transitioning or erroring
                if (this.state !== 'loading' && this.state !== 'reconnecting' && this.state !== 'error' && this.state !== 'idle') {
                    this.setState('paused');
                    this.updateMediaSession();
                }
            });

            this.audio.addEventListener('error', () => {
                this.clearConnectTimeout();
                const mediaError = this.audio && this.audio.error ? this.audio.error.code : 0;
                let msg = 'تعذر تشغيل البث المباشر. يرجى التحقق من الاتصال بالإنترنت.';
                if (mediaError === 2) msg = 'خطأ في شبكة الاتصال أثناء تحميل البث.';
                if (mediaError === 3) msg = 'خطأ في فك تشفير الصوت للبث المباشر.';
                if (mediaError === 4) msg = 'صيغة البث غير مدعومة أو المصدر غير متاح حاليًا.';

                this.handleStreamFailure(msg);
            });

            this.audio.addEventListener('ended', () => {
                this.clearConnectTimeout();
                // Live stream ended unexpectedly; treat as stream interruption
                this.handleStreamFailure('انقطع البث المباشر من المصدر.');
            });
        },

        /* ------------------------------------------------ network listeners */
        setupNetworkListeners() {
            if (this.networkListenersBound || typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
                return;
            }
            this.networkListenersBound = true;

            window.addEventListener('offline', () => {
                if (this.isPlaying() || this.state === 'loading' || this.state === 'reconnecting') {
                    this.wasPlayingBeforeOffline = true;
                    this.cancelRetry();
                    this.clearConnectTimeout();
                    if (this.audio) {
                        try { this.audio.pause(); } catch (e) {}
                    }
                    this.setState('error', 'انقطع الاتصال بالإنترنت. سيعود البث تلقائيًا عند استعادة الشبكة.');
                }
            });

            window.addEventListener('online', () => {
                if (this.wasPlayingBeforeOffline || this.state === 'reconnecting' || this.state === 'error') {
                    this.wasPlayingBeforeOffline = false;
                    this.retry();
                }
            });
        },

        /* --------------------------------- coordination with Quran recitation */
        setupRecitationCoordination() {
            const ps = PlaybackStore || (typeof window !== 'undefined' ? window.PlaybackStore : (typeof global !== 'undefined' ? global.PlaybackStore : null));
            if (ps && typeof ps.subscribe === 'function') {
                ps.subscribe((state, keys) => {
                    if (keys.includes('status')) {
                        const recStatus = state.status;
                        if ((recStatus === 'playing' || recStatus === 'buffering') && (this.isPlaying() || this.state === 'loading' || this.state === 'reconnecting')) {
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
            this.clearConnectTimeout();

            if (this.audio) {
                try {
                    this.audio.pause();
                    this.audio.removeAttribute('src');
                    this.audio.load();
                } catch (e) { /* ignore */ }
            }

            this.station = target;
            this.retryCount = 0;
            this.fallbackIndex = 0;
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
            this.clearConnectTimeout();
            this.setState('loading', 'جارٍ الاتصال بالبث المباشر…');

            if (!this.audio) {
                this.setState('playing');
                return;
            }

            // Fresh live stream URL with cache-buster timestamp parameter to prevent stale buffers
            const streamUrl = this.getStreamUrl();
            if (this.audio.src !== streamUrl) {
                this.audio.src = streamUrl;
            }

            this.startConnectTimeout();

            try {
                const playPromise = this.audio.play();
                if (playPromise !== undefined) {
                    await playPromise;
                }
            } catch (err) {
                this.clearConnectTimeout();
                if (err && err.name === 'NotAllowedError') {
                    // Browser Autoplay Policy blocked
                    this.setState('paused', 'اضغط زر التشغيل لبدء الاستماع');
                } else if (err && err.name === 'AbortError') {
                    // Play request was interrupted by another action; benign
                } else {
                    this.handleStreamFailure('تعذر تشغيل الصوت. جارٍ محاولة الاتصال مجددًا…');
                }
            }
        },

        pause(userInitiated = true) {
            this.cancelRetry();
            this.clearConnectTimeout();
            this.wasPlayingBeforeOffline = false;
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
            this.clearConnectTimeout();
            this.wasPlayingBeforeOffline = false;
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
                if (num > 0 && this.muted) {
                    this.muted = false;
                }
                if (this.audio) {
                    this.audio.volume = this.muted ? 0 : num;
                    this.audio.muted = this.muted;
                }
                this.savePreferences();
                this.notify();
            }
        },

        setMuted(muted) {
            this.muted = !!muted;
            if (this.audio) {
                this.audio.muted = this.muted;
                this.audio.volume = this.muted ? 0 : this.volume;
            }
            this.savePreferences();
            this.notify();
        },

        toggleMute() {
            this.setMuted(!this.muted);
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
        startConnectTimeout() {
            this.clearConnectTimeout();
            if (typeof setTimeout === 'undefined') return;
            this.connectTimeoutTimer = setTimeout(() => {
                if (this.state === 'loading') {
                    this.handleStreamFailure('انتهت مهلة الاتصال بالخادم.');
                }
            }, CONNECTION_TIMEOUT_MS);
            if (this.connectTimeoutTimer && typeof this.connectTimeoutTimer.unref === 'function') {
                this.connectTimeoutTimer.unref();
            }
        },

        clearConnectTimeout() {
            if (this.connectTimeoutTimer) {
                clearTimeout(this.connectTimeoutTimer);
                this.connectTimeoutTimer = null;
            }
        },

        handleStreamFailure(msg) {
            this.clearConnectTimeout();
            if (this.retryCount < MAX_RETRIES) {
                const delay = RETRY_DELAYS[this.retryCount] || 5000;
                this.retryCount++;

                // Advance fallback stream URL if the station defines alternates
                if (this.station && Array.isArray(this.station.fallbackUrls) && this.station.fallbackUrls.length > 0) {
                    const totalUrls = 1 + this.station.fallbackUrls.length;
                    this.fallbackIndex = (this.fallbackIndex + 1) % totalUrls;
                }

                this.setState('reconnecting', `انقطع الاتصال. جارٍ إعادة المحاولة (${this.retryCount}/${MAX_RETRIES})…`);

                this.clearRetryTimer();
                this.retryTimer = setTimeout(() => {
                    if (this.state === 'reconnecting') {
                        if (this.audio) {
                            try {
                                this.audio.src = this.getStreamUrl();
                                this.startConnectTimeout();
                                this.audio.play().catch(() => {});
                            } catch (e) {}
                        }
                    }
                }, delay);
                if (this.retryTimer && typeof this.retryTimer.unref === 'function') {
                    this.retryTimer.unref();
                }
            } else {
                this.clearRetry();
                this.setState('error', msg || 'تعذر تشغيل الإذاعة بعد عدة محاولات. يرجى تجربة محطة أخرى أو إعادة المحاولة.');
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

        getActiveBaseUrl() {
            if (!this.station) return '';
            if (this.fallbackIndex > 0 && Array.isArray(this.station.fallbackUrls)) {
                const candidate = this.station.fallbackUrls[this.fallbackIndex - 1];
                if (candidate) return candidate;
            }
            return this.station.streamUrl;
        },

        getStreamUrl() {
            const baseUrl = this.getActiveBaseUrl();
            if (!baseUrl) return '';
            // Append cache busting parameter so live streams reconnect to fresh chunk/socket
            const sep = baseUrl.includes('?') ? '&' : '?';
            return `${baseUrl}${sep}_t=${Date.now()}`;
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
                    artist: 'إذاعة القرآن الكريم من القاهرة',
                    album: this.station.description || 'بث مباشر على مدار الساعة',
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
                fallbackIndex: this.fallbackIndex,
                volume: this.volume,
                muted: this.muted,
                miniPlayerVisible: this.miniPlayerVisible,
                isPlaying: this.isPlaying()
            };
        }
    };

    return RadioService;
});
