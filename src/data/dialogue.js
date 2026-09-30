// Intro script - rendered on a pure black overlay, white text, no portrait.
// Each entry is one "page" (press to continue). {PLAYER_NAME} is substituted.
// { input: 'name' } marks where the name entry appears.
export const INTRO_SPEAKER = 'PROFESSOR SATOSHI';

export const INTRO_SCRIPT = [
  '...',
  "Oh. You're up.",
  "Don't turn around. Nobody sees my face, and I'd like to keep it that way.",
  'One road runs out of this town. Five Elites stand on it.',
  "Four of them are spread along the route. The fifth, Cooker, holds the Elite Hall at the very end. Nobody has beaten Cooker yet.",
  'Clear all five and you make the board. The fastest runs get paid out of the creator fees, straight to your wallet.',
  "Your clock starts on your first step, so I'll keep this short.",
  'What do people call you?',
  { input: 'name' },
  '{PLAYER_NAME}. Good. Easy to remember if it ends up at the top of the board.',
  "Go on. That road won't clear itself.",
];

export const WALLET_PROMPT = 'Paste your wallet address — this is where your airdrop will be sent if you qualify';

export const LOOK_PROMPT = 'Which Trainer are you?';
export const STARTER_PROMPT = 'Choose your partner. This choice is final.';
