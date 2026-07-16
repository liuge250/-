// ShopScene.js - NPC商店场景
class ShopScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ShopScene' });
  }

  create() {
    this.cameras.main.setBackgroundColor('#1a0a0a');
    const { width, height } = this.scale;

    // Title
    this.add.text(width / 2, 40, '商店', {
      fontSize: '28px',
      color: '#FFD700',
      fontFamily: 'serif'
    }).setOrigin(0.5);

    // Back button
    const backBtn = this.add.text(20, 20, '← 返回', {
      fontSize: '18px',
      color: '#FFD700',
      fontFamily: 'serif',
      backgroundColor: '#333',
      padding: { x: 10, y: 5 }
    }).setInteractive();

    backBtn.on('pointerdown', () => {
      this.scene.stop('ShopScene');
      this.scene.wake('GameScene');
    });

    // Shop items placeholder
    this.add.text(width / 2, height / 2, '商店功能开发中...', {
      fontSize: '18px',
      color: '#888',
      fontFamily: 'serif'
    }).setOrigin(0.5);
  }
}
