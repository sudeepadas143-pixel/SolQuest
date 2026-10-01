// Intro script - rendered on a pure black overlay, white text, no portrait.
// Each entry is one "page" (press to continue). {PLAYER_NAME} is substituted.
// { input: 'name' } marks where the name entry appears.
export const INTRO_SPEAKER = 'PROFESSOR MIA';

// Short on purpose: the run clock is waiting.
export const INTRO_SCRIPT = [
  "Oh, hi! You must be the new Trainer. I'm Professor Mia.",
  "Five Elites stand on the road out of town. Beat four on the route, and the fifth waits for you in the Elite Hall.",
  'The fastest clears earn a share of the creator fees, paid straight to your wallet. Your clock starts on your first step.',
  'So, what should I call you?',
  { input: 'name' },
  "{PLAYER_NAME}! Love it. Now let's get a good look at you.",
];

export const WALLET_PROMPT = 'Paste your wallet address. If your clear qualifies, this is where your payout is sent.';

export const LOOK_PROMPT = 'Which Trainer are you?';
export const STARTER_PROMPT = 'Choose your partner. This choice is final.';
