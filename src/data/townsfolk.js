// Townspeople: they wander a patch of the overworld and chat when you face
// them and press confirm (or click them). Sprites: tools/make_townsfolk.py.
//   home      - where they start (tile)
//   area      - [x0, y0, x1, y1] tiles they wander inside (never tall grass,
//               doorsteps or checkpoints; see scenes/townsfolk.js)
//   lines     - conversations, one per talk, in turn (each is a list of pages)
//   after     - what they say once COOKER has fallen
export const TOWNSFOLK = [
  {
    id: 'capkid', name: 'RAFI', home: { x: 34, y: 123 }, area: [31, 121, 41, 125],
    lines: [
      ["One day I'm gonna beat all five Elites.", "Then I'm gonna beat 'em again, but faster."],
      ['Hold the run button and you fly down Route 1. My mum says no running in town. I say she has to catch me first.'],
      ["The Solace heals your team for free. Best deal on the whole route, if you ask me."],
    ],
    after: [["You beat COOKER?! For real?", "...Can you sign my cap? No, the other side. That side's for when I beat him."]],
  },
  {
    id: 'girl', name: 'TILLY', home: { x: 50, y: 109 }, area: [47, 104, 59, 113],
    lines: [
      ['I threw a coin in the fountain and wished for a creature of my own.', "Nothing yet. I think the fountain's thinking about it."],
      ['Things sparkle in the square sometimes. If you stand facing the sparkle and look closely, you might find something!'],
      ["The gazebo has a little plaque. It's for everyone who climbed the route. Will that be you?"],
    ],
    after: [['Everyone in the square is talking about you!', 'I wished on the fountain that you would win. So, you know. You are welcome.']],
  },
  {
    id: 'netkid', name: 'BRAM', home: { x: 46, y: 88 }, area: [42, 82, 49, 92],
    lines: [
      ["Shh! The long grass by the pond is full of creatures. I'm just watching.", '...Mostly watching.'],
      ['Have you walked out on the pier? Stuff washes up at the very end of it. I would go, but this net is not for water.'],
      ["Creatures come out more at night. You can see their eyes in the grass. Totally not scary. Totally."],
    ],
    after: [['I saw the lights go up in the Elite Hall last night.', 'That was you, right? I knew it. I caught it in my net. The feeling, I mean.']],
  },
  {
    id: 'farmer', name: 'JOSS', home: { x: 50, y: 70 }, area: [42, 68, 55, 71],
    lines: [
      ["That windmill's older than me. And I'm older than dirt.", "Somebody oils it at night. Wasn't me. ...Probably wasn't me."],
      ["There's a potion lying by the mill. Go on, take it. I've more in the cabin than I'll ever drink."],
      ['Wind comes off the pond in the evening. Good for the mill, bad for my hat.'],
    ],
    after: [["Heard the Hall's got a new champion. Don't let it go to your head.", 'Well. Maybe a little. You earned that.']],
  },
  {
    id: 'gardener', name: 'MR. ALDER', home: { x: 51, y: 27 }, area: [46, 23, 58, 32],
    lines: [
      ['Mind the blossom. Took me forty springs to get these rows straight.'],
      ["The grass up north grows wild, and so do the creatures in it.", "Level your team before the Hall. COOKER doesn't do warm-ups."],
      ['Climb the ridge to the north-east. Best view on the route, and careless folk drop things up there.'],
    ],
    after: [['So the Hall has a new name on its wall.', 'Come back in spring. The blossom will be out, and you can tell me how it went.']],
  },
  {
    id: 'shopper', name: 'AUNTIE PEARL', home: { x: 52, y: 123 }, area: [43, 121, 68, 125],
    lines: [
      ["Oh, these bags! The market had a sale on potions. I bought eleven. I don't even have a creature.", "Here's a tip, dear: potions work in the middle of a battle. Don't save them for a rainy day."],
      ["The shopkeeper's off watching the Elite battles, so I left the money on the counter. Honest folk, round here."],
      ['You look like you skipped breakfast. Trainers always do. Eat something before the Hall, promise me.'],
    ],
    after: [['Champion! I knew it the moment I saw you. Well, the second moment.', "I'm telling everyone at the market. Twice."]],
  },
  {
    id: 'picker', name: 'HAZEL', home: { x: 60, y: 70 }, area: [56, 68, 69, 72],
    lines: [
      ['Wild berries grow round the pond. Creatures love them too, so I have to be quick.'],
      ["Joss says the windmill oils itself. I've seen the oil can by his door. I'm not saying anything."],
      ["The well water's cold even in summer. Good for the berries, bad for my fingers."],
    ],
    after: [['I saw the lights on in the Elite Hall last night. Was that your victory party?', 'Next time, invite the berry girl. I bring snacks.']],
  },
  {
    id: 'strawkid', name: 'PIP', home: { x: 24, y: 58 }, area: [19, 56, 29, 60],
    lines: [
      ["See this capsule? Found it in the grass. It's empty, but I'm keeping it anyway."],
      ['The grass up here is way thicker than down south, and the creatures are bigger. I only go in up to my ankles.'],
      ['Wanna know a secret? Something sparkles in the grass way over west of here. I saw it once!'],
    ],
    after: [["You're the champion now! Can I hold your capsule? Just for a second? I'll give it back. Probably."]],
  },
  {
    id: 'buggirl', name: 'NELL', home: { x: 12, y: 93 }, area: [7, 92, 17, 95],
    lines: [
      ['My net is for bugs, not creatures. Mostly. Some bugs are creatures, if you think about it.'],
      ["Both branches loop back to the main road, and there's a Trainer on each one. I've watched them both. Neither of them catches bugs."],
      ["Something sparkly fell in the grass on the west loop. I'd look, but I'm not allowed in tall grass after lunch."],
    ],
    after: [["Is it true you beat COOKER? I'm going to be a champion too. Of bugs."]],
  },
];
