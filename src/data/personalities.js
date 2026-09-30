// Boss personalities, keyed by character design (see DESIGN_NAMES in
// trainers.js). The four route Elites are shuffled per player, so every line
// belongs to the *character*, not the route slot.
//
//   intro     first meeting, before the battle
//   rematch   meeting again after beating the player
//   lastMon   in battle, sending out their final creature
//   defeat    they lose (first line is said in battle, the rest on the map)
//   victory   they win (said in battle, over the player's blackout)
//   after     talking to them once they're beaten
//   blocked   the road-block Elite turning the player away
//             ({LIST} = who's left, {VERB} = is / are)
//
// Player assistance (see src/systems/advice.js), all in character:
//   warn      before the battle, when your lead creature is under-levelled
//   form      ...and it hasn't reached the form it needs ({EVO} = that level)
//   ask       offering you a way out: BATTLE / NOT YET
//   wait      you chose NOT YET
//   coach     after they beat you: where to train and to what level
//   lucky     after they beat you although your level was fine
// Tokens: {MON} {LV} your lead creature, {THEIR} their levels, {REC} the
// recommended level, {WHERE} where to train.

export const PERSONALITY = {
  // TJR - cocky: playful swagger, a good sport about it
  A: {
    trait: 'cocky',
    intro: ['Yo! You actually made it all the way out here? Nice.', "Fair warning though: I don't lose much. Let's have some fun."],
    warn: ["Quick heads up: your {MON}'s Lv {LV}, and my team runs Lv {THEIR}.", "I'd hit {WHERE} till about Lv {REC}. Just saying."],
    form: ['Your {MON} evolves at Lv {EVO}, too. Might want that first.'],
    ask: 'So... still want to run it?',
    wait: ["Smart move. I'll be right here."],
    coach: ["Tip from me: train in {WHERE} till your {MON} hits Lv {REC}.", 'Heal up at the Solace, grab some potions, then run it back.'],
    lucky: ['Honestly? Your level was fine. Heal a little earlier and pick your moves carefully.'],
    rematch: ["Round two? Love the energy. Let's go."],
    lastMon: "Okay, okay. You've got my attention now.",
    defeat: ['Wait... did I just lose? Huh.', "Alright, that one's yours. Enjoy it. I'll want a rematch someday."],
    victory: ['Too slick for you this time. Go train up and come back swinging.'],
    after: ["Still can't believe you pulled that off. Respect."],
    blocked: ["Easy there! Nobody skips the line on my road.", '{LIST} {VERB} still out there on the side paths.', 'Beat them first, then come get your shot at me.'],
  },
  // Ansem - arrogant: lofty and proud, but never insulting
  B: {
    trait: 'arrogant',
    intro: ["Ah, a challenger. It's been a while since anyone made it this far.", "I've studied this game longer than most. Allow me to show you what that looks like."],
    warn: ['Your {MON} is Lv {LV}. Mine are Lv {THEIR}.', "Train in {WHERE} until about Lv {REC}. Then you'll be worth a proper battle."],
    form: ["Your {MON} hasn't reached its next form yet. That comes at Lv {EVO}."],
    ask: 'Do you still wish to face me?',
    wait: ['A sensible choice.'],
    coach: ['Reach Lv {REC} before you return. {WHERE} will get you there.', "And use your potions. There's no prize for pride."],
    lucky: ["Your level was adequate. Your timing wasn't. Heal sooner next time."],
    rematch: ['Back again? Persistence is a start.'],
    lastMon: 'Very well. Time to take this seriously.',
    defeat: ['...Well. I did not see that coming.', "Enjoy it. I'll be sharper next time."],
    victory: ["As I expected. Come back when you're ready for this level."],
    after: ['That battle was... educational. For both of us.'],
    blocked: ['Not yet. I only face challengers who have proven themselves.', '{LIST} {VERB} still standing on the side paths.', "Beat them, and then we'll talk."],
  },
  // Orangie - nice, friendly and encouraging
  C: {
    trait: 'nice',
    warn: ['Oh, wait! Your {MON} is Lv {LV}, and mine are Lv {THEIR}.', 'Maybe battle some wild creatures in {WHERE} first? Around Lv {REC} would be perfect!'],
    form: ['Ooh, and your {MON} evolves at Lv {EVO}! That would help a LOT.'],
    ask: 'Do you still want to battle now?',
    wait: ['Good call! Go get stronger. I believe in you!'],
    coach: ["You'll get me next time! Train in {WHERE} until your {MON} is about Lv {REC}.", "And don't forget: the Solace heals you for free, and potions work mid-battle!"],
    lucky: ['So close! Your level is fine. Try healing a bit earlier, and use moves that are super effective!'],
    intro: ['Oh hey! A new challenger! This is gonna be so fun.', "No hard feelings whatever happens, okay? Let's both give it everything!"],
    rematch: ['You came back! I knew you would. Ready?'],
    lastMon: "Last one! Let's make it count, buddy!",
    defeat: ['Wow, that was amazing! You\'re really, really good!', "Seriously, you're going places. Good luck out there!"],
    victory: ["That was close! Rest up and come back. I'll be right here."],
    after: ['Still thinking about that battle. You were awesome!'],
    blocked: ["Hey, sorry! I can't battle you just yet.", '{LIST} {VERB} still out on the side paths. Go beat them first!', "I'll be right here cheering you on. Promise!"],
  },
  // Cented - respectful, calm and honourable
  E: {
    trait: 'respectful',
    warn: ['A word, before we begin. Your {MON} is Lv {LV}. My partners are Lv {THEIR}.', 'Train in {WHERE} until Lv {REC}. There is no shame in preparing.'],
    form: ['Your {MON} also has a stronger form waiting. It evolves at Lv {EVO}.'],
    ask: 'The choice is yours. Shall we?',
    wait: ["Wise. Return when you're ready. I'll be here."],
    coach: ['Train in {WHERE} until your {MON} reaches Lv {REC}.', 'Use potions when your HP runs low, and rest at the Solace. You will be ready.'],
    lucky: ["You're strong enough. Heal before it gets dangerous, and choose moves that suit the matchup."],
    intro: ["Welcome, challenger. You've come a long way to stand here.", "I'll give you my full strength. It's the least I owe you."],
    rematch: ["You returned. Good. Let's see what you've learned."],
    lastMon: 'My final partner. We hold nothing back.',
    defeat: ['...Well fought. Truly.', "You've earned my respect. Carry it with you to the Hall."],
    victory: ["A good battle. Train, rest, and return. I'll be waiting."],
    after: ["There's no shame in how you fight. Keep going."],
    blocked: ['Not yet, challenger. The order of this road matters.', '{LIST} {VERB} still undefeated on the side paths.', 'Face them with honour. Then come to me.'],
  },
  // Cooker - disrespectful: trash talk and shrugs, grudging respect when beaten
  D: {
    trait: 'disrespectful',
    intro: ["So you're the one everybody's been talking about? Huh. Thought you'd be taller.", "Four Elites down. I'm not like them. Let's cook."],
    warn: ['Lv {LV}? My creatures are Lv {THEIR}.', "Go grind {WHERE} till Lv {REC}, then we'll talk."],
    form: ["And your {MON} isn't even in its final form yet. That's Lv {EVO}."],
    ask: 'Well? You still want this?',
    wait: ["Then head out. Come back when you're ready to actually cook."],
    coach: ['Free tip: {WHERE}. Lv {REC}. Final form.', 'Then come back up here and show me something.'],
    lucky: ['Your level was fine. You just played it rough. Heal earlier and try again.'],
    rematch: ['Back already? Alright, run it.'],
    lastMon: "Okay. Now you've got me annoyed.",
    defeat: ['...', "Okay. OKAY. You're the real deal. Go put your name on that wall."],
    victory: ['Cooked. Go train up and try again next season.'],
    after: ["Don't expect me to say it twice. ...You're good."],
    blocked: [],
  },
};

const FALLBACK = {
  intro: ["You made it this far? Let's see what you've got."],
  rematch: ['Back again? Alright.'],
  lastMon: 'Last one. Here we go.',
  defeat: ['Not bad at all.', 'Go on, then.'],
  victory: ['Train up and try again.'],
  after: ['Good battle.'],
  blocked: ["You can't face me yet.", '{LIST} {VERB} still undefeated out on the side paths.', 'Beat them first.'],
  warn: ['Your {MON} is Lv {LV}. My team is Lv {THEIR}.', 'Train in {WHERE} until about Lv {REC}.'],
  form: ['Your {MON} evolves at Lv {EVO}. It would help.'],
  ask: 'Still want to battle?',
  wait: ['Come back when you are ready.'],
  coach: ['Train in {WHERE} until your {MON} is about Lv {REC}, then try again.'],
  lucky: ['Your level is fine. Heal earlier and use super-effective moves.'],
};

export function personality(design) {
  return { ...FALLBACK, ...(PERSONALITY[design] ?? {}) };
}
