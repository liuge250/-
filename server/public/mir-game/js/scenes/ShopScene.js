// ============================================================
// ShopScene - 商店场景 (占位)
// ============================================================
class ShopScene extends Phaser.Scene {
  constructor() { super('ShopScene'); }

  create() {
    const { width, height } = this.scale;
    this.add.rectangle(0, 0, width, height, 0x0a0a1a).setOrigin(0);
    this.add.text(width / 2, height / 2, '商店 - 即将开放', {
      fontSize: '24px', fill: '#FFD700', fontFamily: 'serif',
    }).setOrigin(0.5);

    const backBtn = this.add.text(20, 20, '< 返回', {
      fontSize: '16px', fill: '#aaaaaa',
    }).setInteractive({ useHandCursor: true });
    backBtn.on('pointerdown', () => this.scene.start('GameScene'));
  }
}
