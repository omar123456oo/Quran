# Continuous (gapless) Full Surah playback

Date: 2026-11-15. Files: `gapless-stream.js` (new), `audio-player.js`, `offline-audio.js`, `playback-store.js`, `index.html`, `sw.js` (shell v8).

## Root cause

The API publishes one MP3 per ayah. Before this change the player gave each ayah file its own media pipeline: a standby `<audio>` pre-buffered the next file and was started on `ended`.

1. **Pipeline hand-off.** Between the last sample of one file and the first sample of the next, the browser has to detect the end, fire `ended`, and start a second element's output. Measured in Chrome (rendered output tapped and searched for digital silence, files served locally so no network time is involved): **115–157 ms of silence at every boundary, mean 131 ms (Alafasy, 12 boundaries); 128–174 ms, mean 149 ms (Minshawi, 11 boundaries).** That is about 4 s of added silence in Surah An-Naba and about 40 s in Al-Baqarah. Pre-buffering cannot remove it, because the cost is in the hand-off, not in the download.
2. **Decoder priming in the files themselves.** 6 of the 8 per-ayah reciters (Husary, Minshawi, Shatri, Abdul Basit, Sudais, Yasser Al-Dosari) publish files cut out of one continuous MP3 stream at frame boundaries. The files have no LAME/Xing header, and the first frame's `main_data_begin` is greater than 0 (390–498 bytes): it points into a previous frame that is not in the file. Decoded on its own, each file starts with 13–39 ms of zeros that are not in the recording (Husary/Minshawi/Shatri 39 ms, Sudais/Dosari 26 ms, Abdul Basit 13 ms). Decoded as one byte stream, consecutive files join with **0** zero samples, and the decoder output equals the standalone decode after about 2,500 samples. This means the files are pieces of one stream.
3. Alafasy and Maher Al-Muaiqly files carry a LAME Info header (encoder delay 576, padding 1,728–1,834 samples), so their files are made to be trimmed exactly.

**Intentional pauses.** The recordings' own pauses (waqf and breath) are inside the audio samples. They are kept unchanged. No silence detection or trimming of recitation audio is done. Only samples that the encoder itself marks as padding (the LAME header) are left out. The files are the published files, byte for byte.

## Solution

Full Surah mode appends the ayah files, one after another, to **one `MediaSource` SourceBuffer** on the existing persistent `audio` element (`GaplessSession`):

- Header-less files are appended as they are, so the decoder runs continuously across the cut and the stream is restored.
- LAME-tagged files: `timestampOffset = T − delay/sr` and `appendWindow = [T, T + exact length]`, so the encoder delay and padding are dropped and the ayahs join sample-exact.
- The timeline is kept in integer samples. Ayah *i* starts exactly where ayah *i − 1* ends. The current ayah is read from the playhead (`timeupdate`, plus a timer at the next boundary), so the highlighted verse follows the audio itself.
- Read-ahead: at least 45 s and 3 ayahs, with 3 downloads in flight. Played audio more than 30 s behind the playhead is removed when more than 8 MB is buffered, so long Surahs stay under the SourceBuffer quota.
- The bytes come from the CORS-enabled mirror `everyayah.com`. Its audio frames are byte-identical to the API's files: re-verified for 7 reciters × 12 ayahs (An-Naba 1–12, SHA-256 of the audio frames). The API's CDN sends no CORS headers, so a page cannot read its bytes. Downloaded Surahs are read from the device cache. The API URLs stay in use for the per-file path.

The **per-file path** is unchanged and still used for:
- Single Ayah mode
- whole-Surah tracks
- browsers without `MediaSource` for `audio/mpeg` (for example iPhone Safari before `ManagedMediaSource`, which is not used)
- fallback: if the first file cannot be fetched, the per-file path is used at once. If a later file fails (after 2 retries), everything already buffered plays, then that ayah plays from the API URL (with the existing retry/skip logic), and the stream resumes from the next ayah.

Controls:
- Previous/next ayah and seek inside the buffered range move the playhead. There is no new request and no reload.
- Mode switch Full Surah → Single continues the same ayah at the same position on the per-file path.
- Repeat Surah, queue, reciter change and resume keep their behaviour.
- `AudioPlayer.setPlaybackRate(0.5–2)` is new. The app had no speed control. It is persisted as `prefs.rate`. There is no UI for it.

## Measurements (Chrome 157, rendered output, An-Naba 1–13)

| Engine | Reciter | Boundaries | Digital silence per boundary |
|---|---|---|---|
| before (two elements) | Alafasy | 12 | 115–157 ms, mean 131 ms |
| before (two elements) | Minshawi | 11 | 128–174 ms, mean 149 ms |
| after (one stream), real network | Alafasy (LAME) | 12 | **0** |
| after | Minshawi (header-less) | 12 | **0** |
| after | Maher (22 kHz, LAME) | 12 | **0** |
| after | Yasser Al-Dosari (mirror only) | 12 | **0** |
| after, 400 ms RTT, 400 kbit/s, 4× CPU throttle | Alafasy | 12 | **0** |

Other results:
- Prototype check: a 12-ayah stream compared with the reference decode has lag 0 and an error of −59 dB against a signal of −20 dB, which is the decoder's numeric precision.
- One source assignment and no new `Audio()` per Surah (before: one per ayah).
- The verse change follows the boundary with ±25 ms jitter.
- Background tab (`visibilityState: hidden`, 2× speed): 40/40 ayahs, in order, no duplicates.

## Tests

- `tests/gapless-stream.test.js` (18 tests): MP3 parsing, contiguous timeline, exact trimming, verse tracking, next/previous/seek without reload, both modes and switching between them, fetch failure (start and middle), no `MediaSource`, offline copy, 286-ayah Surah with eviction, Repeat Surah, reciter change, speed.
- `npm test`: 92/92 pass.
- `npm run test:browser`:
  - 01–06, 08, 09 and 10 pass. 09 now passes fully; before this change it failed "one audio element ever played" (players=2).
  - 07-responsive has the same 6 layout-overflow failures at 1440×900 as before this change (CSS, unrelated).
- Browser tests 02, 06 and 10 now read per-ayah position and URL through `AudioPlayer.ayahTime()`/`ayahDuration()` and `PlaybackStore.audioSrc`. In Full Surah mode the element plays the whole Surah as one stream, so `audio.src` is a `blob:` URL and `audio.duration` is the stream's length.
