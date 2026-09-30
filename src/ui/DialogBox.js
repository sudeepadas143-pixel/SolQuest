// Typewriter narration box (dark glass). `await box.say(text, {speaker})`
// resolves after the player confirms. Optional speaker name tab on top.
import { pushFocus } from '../systems/controls.js';
import { sfx } from '../systems/audio.js';
import { panel, text } from './theme.js';
import { highlightTexture, badgeTexture, C } from './skin.js';

export class DialogBox {
  constructor(scene, { x, y, w, h, style = 'glass', size = 28, color = '#fff7e6', depth = 1000 } = {}) {
    this.scene = scene;
    this.rect = { x, y, w, h };
    this.container = scene.add.container(0, 0).setDepth(depth);
    this.bg = style ? panel(scene, x, y, w, h, style) : null;
    this.text = text(scene, x + 30, y + 24, '', size, color, { wordWrap: { width: w - 70 }, lineSpacing: 8 });
    this.arrow = text(scene, x + w - 42, y + h - 44, '▼', 20, '#2ef2a8').setVisible(false);
    scene.tweens.add({ targets: this.arrow, y: this.arrow.y + 5, duration: 380, yoyo: true, repeat: -1 });
    // speaker name plate (+ optional portrait badge) sitting on the box's top edge
    this.tabX = x + 22;
    this.tabY = y - 22;
    this.tab = scene.add.image(this.tabX, this.tabY, highlightTexture(scene, 260, 40)).setOrigin(0).setVisible(false);
    this.tabText = text(scene, this.tabX + 16, this.tabY + 6, '', 26, '#fff7e6', { fontStyle: 'bold' }).setVisible(false);
    this.portrait = scene.add.image(this.tabX + 2, this.tabY + 20, '__DEFAULT').setVisible(false);
    this.container.add([this.bg, this.text, this.arrow, this.tab, this.tabText, this.portrait].filter(Boolean));
    this.speed = 16;
  }

  setVisible(v) { this.container.setVisible(v); return this; }
  clear() { this.text.setText(''); this.arrow.setVisible(false); this.setSpeaker(null); }
  destroy() { this.container.destroy(); }

  setSpeaker(name, portrait = null) {
    const on = !!name;
    this.tab.setVisible(on);
    this.tabText.setVisible(on);
    this.portrait.setVisible(on && !!portrait);
    if (!on) return;
    const pad = portrait ? 58 : 16;
    if (portrait) {
      const key = badgeTexture(this.scene, portrait, 60, C.gold, true);
      this.portrait.setTexture(key).setPosition(this.tabX + 24, this.tabY + 16);
    }
    this.tabText.setText(name).setX(this.tabX + pad);
    this.tab.setDisplaySize(Math.max(110, this.tabText.width + pad + 22), 40);
  }

  /** Type text; optionally wait for confirm. */
  say(str, { wait = true, hold = 0, speaker, portrait = null } = {}) {
    this.setVisible(true);
    if (speaker !== undefined) this.setSpeaker(speaker, portrait);
    this.arrow.setVisible(false);
    return new Promise((resolve) => {
      let i = 0;
      let typing = true;
      let release = null;
      let timer = null;
      const finishTyping = () => {
        typing = false;
        timer?.remove();
        this.text.setText(str);
        if (!wait) {
          release?.();
          this.scene.time.delayedCall(hold, resolve);
          return;
        }
        this.arrow.setVisible(true);
      };
      const onAction = (a) => {
        if (a !== 'confirm' && a !== 'cancel') return;
        if (typing) { finishTyping(); return; }
        release();
        this.scene.input.off('pointerdown', onPointer);
        this.arrow.setVisible(false);
        sfx('tick');
        resolve();
      };
      const onPointer = () => onAction('confirm');
      release = pushFocus(onAction, this.scene);
      if (wait) this.scene.input.on('pointerdown', onPointer);
      timer = this.scene.time.addEvent({
        delay: this.speed,
        repeat: Math.max(0, str.length - 1),
        callback: () => {
          i += 1;
          this.text.setText(str.slice(0, i));
          if (i % 3 === 0 && str[i - 1] !== ' ') sfx('type');
          if (i >= str.length) finishTyping();
        },
      });
      if (!str.length) finishTyping();
    });
  }
}
