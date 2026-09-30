// Type chart (attacker -> defender multiplier). Anything not listed is 1x.
export const TYPE_COLORS = {
  normal: 0xa8a29a, fire: 0xf07838, water: 0x4f8ff0, grass: 0x58b858,
  fighting: 0xc04830, dragon: 0x7058e8, rock: 0xb8a058, ghost: 0x705898,
  steel: 0x98a8c0, poison: 0xa048a0, dark: 0x5a4a44, bug: 0x98b020,
};

const CHART = {
  normal: { rock: 0.5, ghost: 0, steel: 0.5 },
  fire: { fire: 0.5, water: 0.5, grass: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
  water: { fire: 2, water: 0.5, grass: 0.5, rock: 2, dragon: 0.5 },
  grass: { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
  fighting: { normal: 2, poison: 0.5, bug: 0.5, rock: 2, ghost: 0, dark: 2, steel: 2 },
  dragon: { dragon: 2, steel: 0.5 },
  rock: { fire: 2, fighting: 0.5, bug: 2, steel: 0.5 },
  ghost: { normal: 0, ghost: 2, dark: 0.5 },
  steel: { fire: 0.5, water: 0.5, rock: 2, steel: 0.5 },
  poison: { grass: 2, poison: 0.5, rock: 0.5, ghost: 0.5, steel: 0 },
  dark: { fighting: 0.5, ghost: 2, dark: 0.5 },
  bug: { fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, ghost: 0.5, steel: 0.5, dark: 2 },
};

export function effectiveness(atkType, defTypes) {
  return defTypes.reduce((m, t) => m * (CHART[atkType]?.[t] ?? 1), 1);
}
