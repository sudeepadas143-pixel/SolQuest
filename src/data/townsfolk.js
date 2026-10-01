// Townspeople: they wander a patch of the overworld and chat when you face
// them and press confirm (or click them). Sprites: tools/make_townsfolk.py.
//   home      - where they start (tile)
//   area      - [x0, y0, x1, y1] tiles they wander inside (never tall grass,
//               doorsteps or checkpoints; see scenes/townsfolk.js)
//   lines     - conversations, one per talk, in turn (each a list of pages)
//   night     - said once when you meet them after dark
//   rain      - said once when you meet them in the rain
//   after     - said once after COOKER has fallen
// {NAME} is the player's name. Each one's lines come from who they are: what
// they wear and carry, how old they are, and the corner of the route they
// keep to.
export const TOWNSFOLK = [
  {
    // a boy in a backwards blue cap and a yellow fish tee, a capsule in his fist - the start town
    id: 'capkid', name: 'RAFI', home: { x: 34, y: 123 }, area: [31, 121, 41, 125],
    lines: [
      ["See this capsule? I practise my throw on the lamp posts. I've hit one. Once.", "When I'm old enough, I'm gonna catch something huge in it. Like, roof-huge."],
      ["The cap's backwards for speed. Everybody knows that.", 'You should try it. ...Okay, maybe not. Yours already looks fast.'],
      ["That's the Solace right there. If your team gets hurt, they fix 'em up for free.", 'I go in sometimes just to hear the healing jingle. Ba-da-da-DING!'],
      ["My shirt's got a fish on it because I'm gonna catch a water type first.", "Mum says I'm gonna catch a cold first. Mums don't know about creatures."],
    ],
    night: [["I'm not out late! I'm... guarding the town. From the dark.", "You're out late too. So you're guarding it as well. That's two guards."]],
    rain: [['Rain makes the road all shiny! I keep my capsule under my shirt so it stays dry.']],
    after: [['{NAME}! You beat COOKER?! For real?!', "...Can you sign my cap? No, the back. The front's for when I beat you."]],
  },
  {
    // an older lady: big curls, round glasses, a pearl necklace, a green cardigan, a pink belt bag and
    // both arms full of shopping - Market Row
    id: 'shopper', name: 'AUNTIE PEARL', home: { x: 52, y: 123 }, area: [43, 121, 68, 125],
    lines: [
      ["Oh, mind the bags, dear! Potions were two for one. I bought eleven, and I don't even have a creature.", "Take a tip from your Auntie: potions work in the middle of a battle. Don't wait till it's too late."],
      ["These pearls were my mother's. Real ones, from the coast. Everyone calls me Auntie Pearl now.", "Even my own sister. She's older than me! The cheek."],
      ["This little bag on my belt? Emergency snacks. Biscuits, toffees, half a sandwich.", 'A Trainer should always carry something sweet. For you or for your partner, whoever needs it more.'],
      ["The shopkeeper's off watching the Elite battles, so I left the money on the counter.", "Honest folk on Market Row. Mostly. Keep an eye on the boy in the blue cap."],
    ],
    night: [["Shopping this late? I won't tell if you won't.", 'The lamps on Market Row are the prettiest thing in town after dark. Mind you get home safe, dear.']],
    rain: [["Rain, rain! My bags are paper, dear, this is a disaster.", "If you see a toffee rolling down the road, it's mine."]],
    after: [["Champion! I knew it the moment I saw you. Well, the second moment. I didn't have my glasses on.", "I'm telling everyone on Market Row. Twice."]],
  },
  {
    // a small girl with spiky orange hair, a pale blue dress and sandals - the fountain in Market Square
    id: 'girl', name: 'TILLY', home: { x: 50, y: 109 }, area: [47, 104, 59, 113],
    lines: [
      ['I threw a coin in the fountain and wished for a creature of my very own.', "Nothing yet. I think the fountain's still deciding."],
      ["The fountain water's warm! I put my feet in when nobody's looking.", "Don't tell. My dress got wet last time and I said it was the rain."],
      ['Things sparkle in the square sometimes. If you face the sparkle and look really closely, you might find something!'],
      ["The gazebo has a little plaque. It's for everyone who climbed the route.", 'When I grow up, I want my name on it. Will yours be there first?'],
    ],
    night: [['The fountain makes a different noise at night. Softer. Like it is telling secrets.', "I'm allowed out till the lamps come on. They're on. ...I'm going, I'm going!"]],
    rain: [["It's raining in the fountain! That's double fountain!"]],
    after: [["Everyone in the square is talking about you, {NAME}!", 'I wished on the fountain that you would win. So, you know. You are welcome.']],
  },
  {
    // a girl with curly hair, green goggles pushed up like feelers, a backpack, knee socks and a
    // long bug net - the fork in the road
    id: 'buggirl', name: 'NELL', home: { x: 12, y: 93 }, area: [7, 92, 17, 95],
    lines: [
      ['My net is for bugs, not creatures. Mostly.', 'Some bugs ARE creatures, if you think about it. I think about it a lot.'],
      ["These goggles are for close-up looking. My backpack's full of jars. Empty ones! I let everything go after.", "Well, I let it go after I've drawn it."],
      ["Both branches loop back to the main road, and there's a Trainer on each. I've watched them both.", 'Neither of them catches bugs. I do not understand those people.'],
      ["Something sparkly fell in the grass on the west loop.", "I'd look, but I'm not allowed in tall grass after lunch. Something about 'coming home with things in my hair'."],
    ],
    night: [["Shh. Night bugs are out. Some of them glow!", "If you see a green light floating in the grass, that's a firefly. If it blinks back, walk away."]],
    rain: [["Rain is the best! The snails come out. I've counted fourteen.", 'Fifteen. Oh, no, that was a pebble.']],
    after: [['Is it true you beat COOKER? I am going to be a champion too.', 'Of bugs. Champion of Bugs. I am making the badge myself.']],
  },
  {
    // a boy in a wide straw sun hat and a green vest, a butterfly net on his shoulder - the Willow Pond bank
    id: 'netkid', name: 'BRAM', home: { x: 46, y: 88 }, area: [42, 82, 49, 92],
    lines: [
      ["Shh! The long grass by the pond is full of creatures. I'm just watching.", '...Mostly watching. The net is in case one asks nicely.'],
      ['My gran gave me this hat. It keeps the sun off and the dragonflies land on it.', "One stayed for a whole hour once. I didn't move. My neck still hurts."],
      ['Have you walked out on the pier? Stuff washes up at the very end of it.', "I'd go myself, but this net is not for water. I learned that the wet way."],
      ['Willow Pond is deeper than it looks. Gran says there is a fish in there as old as the windmill.', "I've never seen it. But sometimes the water does a big blorp. That's him."],
    ],
    night: [['Creatures come out more at night. You can see their eyes in the grass.', 'Totally not scary. Totally. You go first.']],
    rain: [['Rain on the pond sounds like a thousand tiny drums. The fish love it.', "My hat doesn't. It goes floppy."]],
    after: [['I saw the lights go up in the Elite Hall last night. That was you, right?', 'I knew it. I caught it in my net. The feeling, I mean.']],
  },
  {
    // a bearded farmer in a flat cap and denim overalls, hand on his hip, always waving - the windmill
    id: 'farmer', name: 'JOSS', home: { x: 50, y: 70 }, area: [42, 68, 55, 71],
    lines: [
      ["Hey there! That windmill's older than me, and I'm older than dirt.", "Somebody oils it at night. Wasn't me. ...Probably wasn't me."],
      ["There's a potion lying by the mill. Go on, take it.", "I've more in the cabin than I'll ever drink. A farmer's cure for everything is a nap."],
      ["These overalls have eleven pockets. I know where nine of 'em are.", 'Found a sandwich in one last week. Still good. Mostly.'],
      ['Wind comes off the pond in the evening. Good for the mill, bad for my cap.', "Lost three caps to that pond. Young Bram fishes 'em out for me. Good lad."],
    ],
    night: [["Can't sleep. The mill creaks like it's telling stories.", "Listen... there. Sounds like 'oil me'. I'm not going to. It's late."]],
    rain: [['Rain! Good for the fields. Bad for the hay. Terrible for my beard.']],
    after: [["Heard the Hall's got a new champion. Don't let it go to your head, {NAME}.", 'Well. Maybe a little. You earned that.']],
  },
  {
    // a young woman in a green headscarf and teal overalls, work gloves on, a yellow bucket of
    // berries - the well by the cabin
    id: 'picker', name: 'HAZEL', home: { x: 60, y: 70 }, area: [56, 68, 69, 72],
    lines: [
      ['Berries grow wild all round the pond. Creatures love them too, so I have to be quick.', 'This bucket is mostly blackberries. And some leaves. And maybe a beetle. Hi, beetle.'],
      ['Gloves are a must! The brambles bite harder than any wild creature.', 'Well. Almost any.'],
      ["Joss says the windmill oils itself. I've seen the oil can by his door.", "I'm not saying anything. I'm just saying I've seen it."],
      ["The well water's cold even in summer. I rinse the berries in it.", 'Good for the berries, bad for my fingers. Hence: gloves.'],
    ],
    night: [["Night picking is the best. The berries are cool and nobody's eaten the ripe ones yet.", 'Except the creatures. They have better eyes than me.']],
    rain: [['Rain plumps up the berries! My bucket gets heavier and my headscarf gets wetter.', 'Worth it.']],
    after: [['I saw the lights on in the Elite Hall last night. Was that your victory party?', 'Next time, invite the berry girl. I bring jam.']],
  },
  {
    // a blond kid under a huge straw hat, an orange tunic over black sleeves, a capsule held up,
    // always pointing - the houses on the road north
    id: 'strawkid', name: 'PIP', home: { x: 24, y: 58 }, area: [19, 56, 29, 60],
    lines: [
      ['Number one! That is what I am going to be. Number one Trainer on the whole route!', "I'm practising the pointing first. The pointing is very important."],
      ["See this capsule? Found it in the grass. It's empty, but I'm keeping it anyway.", "Grandpa says an empty capsule is just a full one that's waiting."],
      ["This hat was Grandpa's. It's too big. I can see out of it if I tilt my head.", "Like this. ...No, this. There. Hi!"],
      ["The grass up here is way thicker than down south. The creatures are bigger too.", 'I only go in up to my ankles. And sometimes my knees. Never my hat.'],
    ],
    night: [['Wanna know a secret? Something sparkles in the grass way over west of here, by the edge.', "I saw it once at night. It's easier to see when it's dark!"]],
    rain: [["My hat is an umbrella! I'm the only dry person in town!", '...My shoes are not dry.']],
    after: [["You're number one! You took my number!", "That's okay. I'll be number two. For now. Can I hold your capsule? Just for a second?"]],
  },
  {
    // an old gardener: bucket hat, round glasses, a long green apron and a pair of long-handled
    // shears - the Orchard rows
    id: 'gardener', name: 'MR. ALDER', home: { x: 51, y: 27 }, area: [46, 23, 58, 32],
    lines: [
      ['Mind the blossom. Took me forty springs to get these rows straight.', 'Forty-one, if you count the year a creature ate the saplings. I do not count that year.'],
      ["These shears were my father's. Sharp enough to trim a hair off a hummingbird.", 'Not that I would. Hummingbirds have done nothing to me.'],
      ['The grass up north grows wild, and so do the creatures in it.', "Level your team before the Hall, {NAME}. COOKER doesn't do warm-ups."],
      ['Climb the ridge to the north-east. Best view on the route.', 'And careless folk drop things up there. I would know. I have dropped my glasses there twice.'],
    ],
    night: [['The orchard at night smells sweeter. The blossom opens a little when the sun goes down.', 'Or perhaps I am just old, and night is when I notice things.']],
    rain: [["Rain is a gardener's friend. Pull up a tree and listen to it drink.", '...Not literally. Do not pull up my trees.']],
    after: [['So the Hall has a new name on its wall.', 'Come back in spring. The blossom will be out, and you can tell me how it went.']],
  },
];
