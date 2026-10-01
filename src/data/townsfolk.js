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
];
