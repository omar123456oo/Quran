# Playback, queue and playlists

## Data sources
- Quran text: `api.alquran.cloud` edition `quran-uthmani` (single source, never edited; `QuranDisplay.TEXT_EDITION`).
- Audio: one MP3 **per ayah** (`ayah.audio`) for the chosen reciter. A Surah / page / Juz is played as the sequence of its ayah files, so the highlighted ayah and page are exact. No timing is estimated.
- Reciters: the 8 entries in `AudioPlayer.reciters`. Availability is checked (the API must return audio for the item) before switching.

## Modules
| File | Role |
|---|---|
| `play-queue.js` | Session queue (current / upcoming / history, shuffle, repeat). Pure logic, unit-tested. |
| `playlists.js` | Saved playlists. Pure logic, unit-tested. |
| `playback-store.js` | `PlaybackStore` (single playback state + separate *reading* state), `PlayerStorage` (versioned localStorage), `PlayerState`. |
| `audio-player.js` | The only `<audio>` element and the engine (load tokens, de-duplicated `ended`, retry, failure skipping). |
| `playlists-ui.js` | "القوائم" page: now playing, queue, playlists, Surah picker. |

## Behaviour rules
- **Playlist ≠ queue.** Starting a playlist copies it into the queue. Editing/deleting the playlist later does not change the running session. Starting another playlist replaces the queue (playlists are never mixed).
- **Play Now** interrupts; the rest of the queue continues afterwards. **Play Next** inserts after the current item. **Add to Queue** appends. **Clear** removes only upcoming items.
- **Shuffle** reorders only the upcoming queue; saved playlists are untouched. Turning it off restores the natural order of what is left.
- **Repeat One** repeats the current Surah (∞, or N times from the selector), then moves on. **Repeat All** loops the whole session (items played so far + current + upcoming). **Off** stops at the end.
- **Previous** goes to the previous item (or restarts the first). **Next** on the last item does nothing.
- An item with no recording, or a failed request, is skipped with a message; after 5 consecutive failures playback stops with an error instead of looping.
- Reading position (`PlaybackStore.reading`, selected ayah) is separate from playback position. "تتبع التشغيل" controls whether the reader/mushaf follows playback; "العودة للآية الجارية" jumps back.

## Persistence
`localStorage` key `quran_player_v1` (versioned, validated on load; bad records are dropped): playlists, selected playlist, queue, shuffle/repeat, volume, repeat count, follow setting, and the ayah + second of the current item (restored paused, never auto-played).
There is no backend or login, so data is **per browser** — it is not synced across devices and is shared by anyone using the same browser profile.

## Tests
- `npm test` — unit tests for queue/playlist logic and persistence validation (Node ≥ 20, no dependencies).
- `npm run test:browser` — end-to-end tests that drive real Chrome over the DevTools protocol (needs `google-chrome` and the site served on `127.0.0.1:8000`, e.g. `npm start`). They use the real audio CDN and play at 16× speed.
