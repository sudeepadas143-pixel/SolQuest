// Global tuning knobs. Content (creatures, trainers, map) lives in src/data/.
export const GAME_W = 960;
export const GAME_H = 640;
// World: a ~46-degree camera. Tiles are 32 x 24 world units (the ground is
// foreshortened), shown at an integer 2x zoom.
export const TILE_W = 32;
export const TILE_H = 24;
export const TILE = TILE_W;
export const WORLD_ZOOM = 2;
// Hi-fi art: world textures carry ART_SCALE texels per world unit, so with the
// 2x camera one texel = one screen pixel (props, tiles, grass, characters).
export const ART_SCALE = 2;
export const CHAR_SCALE = 1 / ART_SCALE;
// Texel density of UI/battle sprites vs. their old sizes (tools/process_assets.py HD):
// creature fronts 2x, backs 3x, trainer battle poses 3x, player portraits 3x.
export const HD = { front: 2, back: 3, battle: 3, full: 3 };

// Day/night: 1 real second = 1 in-game minute (a full day every 24 minutes of play).
export const START_HOUR = 8;
// Weather changes every WEATHER_BLOCK_MIN in-game minutes (deterministic schedule).
export const WEATHER_BLOCK_MIN = 180;

export const FONT = '"Pixelify Sans", monospace';
export const GAME_TITLE = 'SolQuest';

// Per-step chance of a wild battle while walking in tall grass.
export const ENCOUNTER_RATE = 0.10;
// Global multiplier on XP earned; the main lever for "how much grinding".
export const XP_MULT = 2.4;
// Extra XP multiplier for beating a trainer's creature (vs wild).
export const TRAINER_XP_BONUS = 1.5;
export const MAX_LEVEL = 60;

export const WALK_MS = 170;
export const RUN_MS = 105;

export const SAVE_KEY = 'eliteRoute.save.v1';
export const SAVE_VERSION = 1;

// Salt mixed into the wallet-derived team seed. Change per season/event so a
// new event re-rolls teams for everyone (see BUILD_NOTES.md, "Seeded teams").
export const SEASON_SALT = 'elite-route-s1';
