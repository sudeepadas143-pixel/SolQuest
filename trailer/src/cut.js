// Which edit to build: 'full' (the 30 s teaser) or 'ten' (the 10 s teaser).
// In the browser it comes from the page URL (?cut=ten), in Node from CUT=ten.
const fromUrl = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('cut') : null;
const fromEnv = typeof process !== 'undefined' ? process.env?.CUT : null;
export const CUT = fromUrl || fromEnv || 'full';
export const CUTS = {
  full: { duration: 30, out: 'solquest-trailer.mp4', audio: 'audio.wav', stills: [0, 3, 8, 14, 22, 28] },
  ten: { duration: 10, out: 'solquest-teaser-10s.mp4', audio: 'audio-ten.wav', stills: [0, 2, 3.5, 4.6, 6.7, 9] },
};
if (!CUTS[CUT]) throw new Error(`unknown cut: ${CUT}`);
