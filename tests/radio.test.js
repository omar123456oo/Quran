const test = require('node:test');
const assert = require('node:assert/strict');
const RadioStations = require('../radio-stations.js');
const RadioService = require('../radio-service.js');

// Mock localStorage
const mockStorage = () => {
    let store = {};
    return {
        getItem: (k) => store[k] || null,
        setItem: (k, v) => { store[k] = String(v); },
        removeItem: (k) => { delete store[k]; },
        clear: () => { store = {}; }
    };
};

// Mock Audio element for unit testing
class MockAudio {
    constructor() {
        this.src = '';
        this.volume = 1.0;
        this.preload = 'none';
        this.listeners = {};
        this.paused = true;
        this.playCallCount = 0;
        this.pauseCallCount = 0;
        this.loadCallCount = 0;
    }

    addEventListener(event, fn) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(fn);
    }

    removeEventListener(event, fn) {
        if (this.listeners[event]) {
            this.listeners[event] = this.listeners[event].filter(f => f !== fn);
        }
    }

    emit(event, payload) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(fn => fn(payload));
        }
    }

    removeAttribute(attr) {
        if (attr === 'src') this.src = '';
    }

    load() {
        this.loadCallCount++;
    }

    play() {
        this.playCallCount++;
        this.paused = false;
        return Promise.resolve();
    }

    pause() {
        this.pauseCallCount++;
        this.paused = true;
        this.emit('pause');
    }
}

// ------------------------------------------------------------- 1. Stations
test('radio stations: all stations have unique IDs, required fields, and valid formats', () => {
    const stations = RadioStations.getAll();
    assert.ok(stations.length >= 10, 'Should provide a rich catalog of verified stations');

    const ids = new Set();
    stations.forEach(s => {
        assert.ok(s.id, 'Station must have an ID');
        assert.ok(!ids.has(s.id), `Duplicate station ID: ${s.id}`);
        ids.add(s.id);

        assert.ok(s.name, `Station ${s.id} must have a name`);
        assert.ok(s.streamUrl, `Station ${s.id} must have a streamUrl`);
        assert.ok(s.streamUrl.startsWith('https://'), `Stream URL must be HTTPS: ${s.streamUrl}`);
        assert.equal(s.format, 'audio/mpeg');
        assert.equal(s.verified, true, `Station ${s.id} must be marked verified`);
    });

    const defaultStation = RadioStations.getDefault();
    assert.ok(defaultStation, 'Must provide a default station');
    assert.equal(defaultStation.id, 'tarateel');

    const categories = RadioStations.getCategories();
    assert.ok(categories.length >= 2, 'Should provide at least thematic and reciter categories');
});

// --------------------------------------------------- 2. Initial State & AutoPlay
test('radio service: opening radio does not start playback automatically', () => {
    global.localStorage = mockStorage();
    const mockAudio = new MockAudio();
    RadioService.init({ audio: mockAudio, force: true });

    assert.equal(RadioService.state, 'idle', 'Initial state must be idle');
    assert.equal(RadioService.isPlaying(), false);
    assert.equal(mockAudio.playCallCount, 0, 'audio.play() must not be called on init');
});

// --------------------------------------------------- 3. Playback State Machine
test('radio service: play, playing, and pause state transitions', async () => {
    global.localStorage = mockStorage();
    const mockAudio = new MockAudio();
    RadioService.init({ audio: mockAudio, force: true });

    let lastSnapshot = null;
    const unsub = RadioService.subscribe((s) => { lastSnapshot = s; });

    // User initiates play
    const playPromise = RadioService.play();
    assert.equal(RadioService.state, 'loading', 'State must be loading while awaiting stream');
    await playPromise;

    // Audio emits 'playing' event
    mockAudio.emit('playing');
    assert.equal(RadioService.state, 'playing', 'State must become playing');
    assert.equal(RadioService.isPlaying(), true);
    assert.equal(lastSnapshot.isPlaying, true);

    // User initiates pause
    RadioService.pause();
    assert.equal(RadioService.state, 'paused', 'State must become paused');
    assert.equal(RadioService.isPlaying(), false);
    assert.equal(mockAudio.pauseCallCount, 1);

    unsub();
});

// --------------------------------------------------- 4. Bounded Reconnection
test('radio service: network failure triggers bounded retry with backoff, then error', () => {
    global.localStorage = mockStorage();
    const mockAudio = new MockAudio();
    RadioService.init({ audio: mockAudio, force: true });

    RadioService.setState('playing');
    assert.equal(RadioService.state, 'playing');

    // Simulate network error 1
    mockAudio.emit('error', { type: 'error' });
    assert.equal(RadioService.state, 'reconnecting');
    assert.equal(RadioService.retryCount, 1);

    // Error 2
    mockAudio.emit('error', { type: 'error' });
    assert.equal(RadioService.state, 'reconnecting');
    assert.equal(RadioService.retryCount, 2);

    // Error 3
    mockAudio.emit('error', { type: 'error' });
    assert.equal(RadioService.state, 'reconnecting');
    assert.equal(RadioService.retryCount, 3);

    // Error 4
    mockAudio.emit('error', { type: 'error' });
    assert.equal(RadioService.state, 'reconnecting');
    assert.equal(RadioService.retryCount, 4);

    // Exceeding MAX_RETRIES (4) sets state to error
    mockAudio.emit('error', { type: 'error' });
    assert.equal(RadioService.state, 'error', 'Must transition to error state after max retries');
    assert.ok(RadioService.errorMessage.length > 0);
    assert.equal(RadioService.retryCount, 0, 'Retry count resets after max retries reached');

    // Manual retry resets count and starts playing
    RadioService.retry();
    assert.equal(RadioService.state, 'loading');
    assert.equal(RadioService.retryCount, 0);
});

// --------------------------------------------------- 5. Station Switching
test('radio service: switching stations stops previous and connects to new station', () => {
    global.localStorage = mockStorage();
    const mockAudio = new MockAudio();
    RadioService.init({ audio: mockAudio, force: true });

    RadioService.setState('playing');
    const firstStation = RadioService.station;

    RadioService.nextStation();
    const secondStation = RadioService.station;
    assert.notEqual(firstStation.id, secondStation.id, 'Must advance to next station');
    assert.ok(mockAudio.src.includes(secondStation.streamUrl), 'Must set new stream URL');

    RadioService.previousStation();
    assert.equal(RadioService.station.id, firstStation.id, 'Must cycle back to previous station');
});

// --------------------------------------------------- 6. Coordination Policy
test('radio service: starting recitation pauses radio, and starting radio pauses recitation', async () => {
    global.localStorage = mockStorage();
    const mockAudio = new MockAudio();

    let recitationPaused = false;
    const mockAudioPlayer = {
        pause() { recitationPaused = true; }
    };

    let playbackStoreSubscriber = null;
    const mockPlaybackStore = {
        get: () => ({ status: 'playing' }),
        subscribe: (fn) => { playbackStoreSubscriber = fn; }
    };

    global.AudioPlayer = mockAudioPlayer;
    global.PlaybackStore = mockPlaybackStore;

    RadioService.init({ audio: mockAudio, force: true });

    await RadioService.play();
    assert.equal(recitationPaused, true, 'Starting radio must pause Quran recitation');

    // Radio is currently playing
    mockAudio.emit('playing');
    assert.equal(RadioService.isPlaying(), true);

    // Later, user starts a Quran recitation -> PlaybackStore emits playing status
    if (playbackStoreSubscriber) {
        playbackStoreSubscriber({ status: 'playing' }, ['status']);
        assert.equal(RadioService.isPlaying(), false, 'Recitation starting must pause radio');
        assert.equal(RadioService.state, 'paused');
    }
});

// --------------------------------------------------- 7. Preferences Persistence
test('radio service: saves and restores preferences cleanly without corruption', () => {
    const storage = mockStorage();
    global.localStorage = storage;
    const mockAudio = new MockAudio();

    RadioService.init({ audio: mockAudio, force: true });

    RadioService.setVolume(0.65);
    RadioService.setStation('alafasi', false);
    RadioService.setMiniPlayerVisible(false);

    // Instantiate fresh service with saved storage
    RadioService.station = null;
    RadioService.init({ audio: new MockAudio(), force: true });

    assert.equal(RadioService.volume, 0.65, 'Volume must be restored');
    assert.equal(RadioService.station.id, 'alafasi', 'Last selected station must be restored');
    assert.equal(RadioService.miniPlayerVisible, false, 'Mini player visibility preference must be restored');
});

// --------------------------------------------------- 8. Volume bounds & Corrupt Storage Handling
test('radio service: volume clamping and handling of corrupted storage', () => {
    const storage = mockStorage();
    storage.setItem('quran_radio_prefs_v1', 'not valid json {{{');
    global.localStorage = storage;

    const mockAudio = new MockAudio();
    RadioService.init({ audio: mockAudio, force: true });
    assert.equal(RadioService.volume, 0.8, 'Corrupted storage falls back to default volume');

    // Out of bounds volume handling
    RadioService.setVolume(1.5);
    assert.equal(RadioService.volume, 1.0, 'Volume must be clamped to 1.0');

    RadioService.setVolume(-0.5);
    assert.equal(RadioService.volume, 0.0, 'Volume must be clamped to 0.0');

    RadioService.setVolume('invalid');
    assert.equal(RadioService.volume, 0.0, 'Invalid volume value is ignored or set safely');
});

// --------------------------------------------------- 9. Stopping cancels retry timers
test('radio service: stop cancels any active retry timers and clears src', () => {
    global.localStorage = mockStorage();
    const mockAudio = new MockAudio();
    RadioService.init({ audio: mockAudio, force: true });

    RadioService.setState('playing');
    mockAudio.emit('error', { type: 'error' });
    assert.equal(RadioService.state, 'reconnecting');
    assert.ok(RadioService.retryTimer !== null, 'Retry timer must be active');

    RadioService.stop();
    assert.equal(RadioService.state, 'idle');
    assert.equal(RadioService.retryTimer, null, 'Stop must clear retry timer');
    assert.equal(RadioService.retryCount, 0, 'Stop must reset retry count');
    assert.equal(mockAudio.src, '', 'Stop must detach audio src');
});
