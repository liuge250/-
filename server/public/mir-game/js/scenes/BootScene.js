// ============================================================
// BootScene - 启动场景
// ============================================================
class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  preload() {
    const { width, height } = this.scale;
    const centerX = width / 2;
    const centerY = height / 2;

    // Loading text
    const loadingText = this.add.text(centerX, centerY - 30, 'AI传奇', {
      fontSize: '48px', fill: '#FFD700', fontFamily: 'serif',
      stroke: '#8B4513', strokeThickness: 4,
    }).setOrigin(0.5);

    const subText = this.add.text(centerX, centerY + 20, '正在加载...', {
      fontSize: '16px', fill: '#C0A060',
    }).setOrigin(0.5);

    // Progress bar
    const barW = 300;
    const barH = 12;
    const barX = centerX - barW / 2;
    const barY = centerY + 50;

    this.add.rectangle(barX, barY, barW, barH, 0x333333, 1).setOrigin(0);
    const progressBar = this.add.rectangle(barX, barY, 0, barH, 0xFFD700, 1).setOrigin(0);

    this.load.on('progress', (value) => {
      progressBar.width = barW * value;
    });

    // Load tileset images
    const basePath = 'assets/tilesets/';
    this.load.image('town_tileset', basePath + 'town_tileset.jpg');
    this.load.image('cave_tileset', basePath + 'cave_tileset.jpg');
    this.load.image('desert_tileset', basePath + 'desert_tileset.jpg');
    this.load.image('temple_tileset', basePath + 'temple_tileset.jpg');

    // Load sprite images
    const spritePath = 'assets/sprites/';
    this.load.image('warrior_sprite', spritePath + 'warrior_sprites.jpg');
    this.load.image('wizard_sprite', spritePath + 'wizard_sprites.jpg');
    this.load.image('taoist_sprite', spritePath + 'taoist_sprites.jpg');
    this.load.image('monsters_sprite', spritePath + 'monsters_sprites.jpg');

    // Handle load errors gracefully
    this.load.on('loaderror', (file) => {
      console.warn('Failed to load:', file.key);
    });
  }

  create() {
    this.scene.start('MenuScene');
  }
}
