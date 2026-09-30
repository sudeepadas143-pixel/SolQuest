export const ITEMS = {
  potion:      { name: 'Potion',       heal: 30,  desc: 'Restores 30 HP.' },
  superpotion: { name: 'Super Potion', heal: 80,  desc: 'Restores 80 HP.' },
  hyperpotion: { name: 'Hyper Potion', heal: 200, desc: 'Restores 200 HP.' },
  fullheal:    { name: 'Full Restore', heal: 9999, desc: 'Fully restores HP.' },
  levelgem:    { name: 'Level Gem',    levelUp: 1, desc: 'Raises your partner by one level. Found, never sold.' },
};

export const STARTING_BAG = { potion: 3 };

// Chance a won wild battle drops a Potion.
export const WILD_DROP_CHANCE = 0.12;
