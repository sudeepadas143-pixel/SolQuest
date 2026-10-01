// Hall of Fame: unlocked by beating Cooker. A celebratory interior showing the
// player's final team and total score.
import Phaser from 'phaser';
import { GAME_W, GAME_H, HD } from '../config.js';
import { SPECIES, displaySprite, spriteDensity } from '../data/creatures.js';
import { TRAINERS, TRAINER_ORDER } from '../data/trainers.js';
import { calcStats } from '../systems/creature.js';
import { getSave } from '../systems/save.js';
import { trainerName } from '../systems/teams.js';
import { maxScore } from '../systems/score.js';
import { panel, text, COLORS } from '../ui/theme.js';
import { formatRun } from '../systems/world.js';
import { music, sfx } from '../systems/audio.js';
import { typeBadge } from '../ui/Summary.js';
import { fadeTo, waitContinue } from '../ui/helpers.js';

export class HallOfFameScene extends Phaser.Scene {
  constructor() { super('HallOfFame'); }

  create() {
    const s = getSave();
    const hof = s.hallOfFame ?? { score: s.score, team: s.party, at: new Date().toISOString(), playMs: s.stats.playMs };
    this.cameras.main.fadeIn(900, 255, 255, 255);
    music('hof');
    sfx('fanfare');

    // --- room: back wall, marble floor, red carpet (uses the interior tiles) ---
    const wallH = 190;
    const g = this.add.graphics();
    g.fillGradientStyle(0x3a2a6a, 0x3a2a6a, 0x251a48, 0x251a48, 1).fillRect(0, 0, GAME_W, wallH);
    g.fillStyle(0xecbc48, 1).fillRect(0, wallH - 10, GAME_W, 6);
    g.fillStyle(0x1b1236, 1).fillRect(0, wallH - 4, GAME_W, 4);
    g.fillGradientStyle(0xf1edf8, 0xf1edf8, 0xd9d2ea, 0xd9d2ea, 1).fillRect(0, wallH, GAME_W, GAME_H - wallH);
    for (let x = 0; x < GAME_W; x += 64) g.lineStyle(1, 0xc9c0dd, 1).lineBetween(x, wallH, x - 120, GAME_H);
    for (let y = wallH + 40; y < GAME_H; y += 56) g.lineStyle(1, 0xc9c0dd, 1).lineBetween(0, y, GAME_W, y);
    g.fillStyle(0xb0243c, 1).fillPoints([{ x: GAME_W / 2 - 70, y: wallH }, { x: GAME_W / 2 + 70, y: wallH }, { x: GAME_W / 2 + 190, y: GAME_H }, { x: GAME_W / 2 - 190, y: GAME_H }], true);
    g.lineStyle(4, 0xecbc48, 1)
      .lineBetween(GAME_W / 2 - 70, wallH, GAME_W / 2 - 190, GAME_H)
      .lineBetween(GAME_W / 2 + 70, wallH, GAME_W / 2 + 190, GAME_H);
    // pillars + banners
    for (const px of [60, GAME_W - 100]) {
      g.fillStyle(0xefe6d2, 1).fillRect(px, 30, 40, wallH + 40);
      g.fillStyle(0xecbc48, 1).fillRect(px - 6, 24, 52, 12).fillRect(px - 6, wallH + 64, 52, 12);
    }
    for (const bx of [200, GAME_W - 240]) {
      g.fillStyle(0x9945ff, 1).fillPoints([{ x: bx, y: 20 }, { x: bx + 40, y: 20 }, { x: bx + 40, y: 150 }, { x: bx + 20, y: 130 }, { x: bx, y: 150 }], true);
      g.fillStyle(0x14f195, 1).fillTriangle(bx + 10, 60, bx + 30, 60, bx + 20, 80);
    }

    text(this, GAME_W / 2, 36, 'HALL OF FAME', 60, '#ecbc48', { fontStyle: 'bold', stroke: '#1b1236', strokeThickness: 10 })
      .setOrigin(0.5, 0).setShadow(0, 4, '#9945ff', 0, true, true);
    text(this, GAME_W / 2, 118, `Champion ${s.player.name}`, 30, '#fbf6e9').setOrigin(0.5, 0);

    // --- pedestal with the final team ---
    const c = hof.team[0];
    const sp = SPECIES[c.species];
    const pg = this.add.graphics();
    pg.fillStyle(0x000000, 0.2).fillEllipse(GAME_W / 2, 470, 280, 50);
    pg.fillStyle(0xefe6d2, 1).fillRect(GAME_W / 2 - 110, 400, 220, 66);
    pg.fillStyle(0xecbc48, 1).fillRect(GAME_W / 2 - 124, 392, 248, 14).fillRect(GAME_W / 2 - 124, 458, 248, 12);
    pg.lineStyle(3, COLORS.ink, 1).strokeRect(GAME_W / 2 - 110, 400, 220, 66);
    const key = displaySprite(c.species, 'front');
    const mon = this.add.image(GAME_W / 2, 398, key).setOrigin(0.5, 1).setScale(2.4 / spriteDensity(key));
    this.tweens.add({ targets: mon, y: 392, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    text(this, GAME_W / 2, 412, `${sp.name.toUpperCase()}  Lv.${c.level}`, 24, '#262a3b', { fontStyle: 'bold' }).setOrigin(0.5, 0);
    sp.types.forEach((t, i) => typeBadge(this, GAME_W / 2 - sp.types.length * 50 + i * 104, 438, t));

    // player portrait
    this.add.image(170, GAME_H - 20, `player_${s.player.gender}_full`).setOrigin(0.5, 1).setScale(2.2 / HD.full);

    // --- stats plaque ---
    panel(this, GAME_W - 334, 206, 312, 414, 'gold');
    const st = calcStats(c);
    const clearMs = hof.clearMs ?? s.run?.clearMs ?? hof.playMs;
    text(this, GAME_W - 310, 226, 'CLEAR TIME', 20, '#ffc94a', { fontStyle: 'bold' });
    text(this, GAME_W - 48, 246, formatRun(clearMs), 40, '#2ef2a8', { fontStyle: 'bold' }).setOrigin(1, 0);
    const lines = [
      ['Score', `${hof.score} / ${maxScore()}`],
      ['HP', st.hp], ['Attack', st.atk], ['Defense', st.def], ['Sp. Atk', st.spa], ['Sp. Def', st.spd], ['Speed', st.spe],
    ];
    lines.forEach(([k, v], i) => {
      text(this, GAME_W - 310, 304 + i * 32, k, 20, i === 0 ? '#ffc94a' : '#c9c3d9');
      text(this, GAME_W - 48, 304 + i * 32, `${v}`, 20, '#fff7e6').setOrigin(1, 0);
    });
    const beaten = TRAINER_ORDER.filter((id) => s.defeated[id]).map((id) => trainerName(s.teams, id).replace('Elite Trainer ', 'E')).join(' · ');
    text(this, GAME_W - 310, 540, beaten, 16, '#c9c3d9', { wordWrap: { width: 270 } });
    text(this, GAME_W - 310, 588, `Items found: ${s.pickedItems?.length ?? 0}`, 16, '#a8acd6');

    const w = s.player.wallet;
    panel(this, 16, 206, 264, 66, 'chip').setDepth(55);
    text(this, 30, 216, w ? `AIRDROP WALLET\n${w.slice(0, 6)}…${w.slice(-4)}` : 'NO WALLET ON FILE\nAdd one in MENU > PROFILE', 17, w ? '#2ef2a8' : '#ff8a8a', { lineSpacing: 6 }).setDepth(56);

    // confetti
    const colors = [0x9945ff, 0x14f195, 0xecbc48, 0xfbf6e9, 0xee4f4b];
    this.time.addEvent({
      delay: 90, loop: true, callback: () => {
        const r = this.add.rectangle(Phaser.Math.Between(0, GAME_W), -10, 8, 12, Phaser.Utils.Array.GetRandom(colors)).setDepth(50);
        this.tweens.add({ targets: r, y: GAME_H + 20, angle: Phaser.Math.Between(-360, 360), x: r.x + Phaser.Math.Between(-80, 80), duration: Phaser.Math.Between(2200, 3600), onComplete: () => r.destroy() });
      },
    });

    const hint = text(this, GAME_W / 2, GAME_H - 34, 'Click or press ENTER to return to the route', 20, '#fff7e6', { stroke: '#12163a', strokeThickness: 5 }).setOrigin(0.5).setDepth(60);
    this.tweens.add({ targets: hint, alpha: 0.3, duration: 800, yoyo: true, repeat: -1 });
    // don't let a held or mashed key skip the moment (a delayed flag: the
    // scene clock still reads 0 during create, so a timestamp can't be used)
    let ready = false;
    this.time.delayedCall(2500, () => { ready = true; });
    waitContinue(this, { ready: () => ready }).then(() => fadeTo(this, 'Overworld', {}, 600));
  }
}
