/**
 * Boot Scene - Loading screen with progress
 */
import { CONFIG } from '../config.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // Create loading UI
    const { width, height } = this.scale;
    
    // Background
    this.add.rectangle(width / 2, height / 2, width, height, 0x0a0a1a);
    
    // Title
    this.add.text(width / 2, height / 2 - 80, 'AI 传 奇', {
      fontSize: '48px',
      color: '#FFD700',
      fontFamily: 'Microsoft YaHei, PingFang SC, sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(width / 2, height / 2 - 30, 'AI LEGEND OF MIR', {
      fontSize: '14px',
      color: '#888888',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    // Progress bar
    const barWidth = 300;
    const barHeight = 6;
    const barX = width / 2 - barWidth / 2;
    const barY = height / 2 + 30;

    this.progressBarBg = this.add.rectangle(barX, barY, barWidth, barHeight, 0x333333).setOrigin(0, 0.5);
    this.progressBar = this.add.rectangle(barX, barY, 0, barHeight, 0xFFD700).setOrigin(0, 0.5);
    
    this.loadingText = this.add.text(width / 2, barY + 25, '正在加载...', {
      fontSize: '12px',
      color: '#666666',
    }).setOrigin(0.5);

    // Load game data
    this.loadGameAssets();
    
    // Update progress
    this.load.on('progress', (value) => {
      this.progressBar.width = barWidth * value;
    });

    this.load.on('complete', () => {
      this.loadingText.setText('加载完成!');
      this.time.delayedCall(500, () => {
        this.scene.start('MenuScene');
      });
    });
  }

  loadGameAssets() {
    // Generate textures programmatically (no external images needed for prototype)
    this.generateTextures();
    
    // Load JSON data
    const baseUrl = window.location.origin;
    this.load.json('mapInfo', `${baseUrl}/api/v1/game/data/map_info.json`);
    this.load.json('monsters', `${baseUrl}/api/v1/game/data/monsters.json`);
    this.load.json('stditems', `${baseUrl}/api/v1/game/data/stditems.json`);
    this.load.json('magics', `${baseUrl}/api/v1/game/data/magics.json`);
  }

  generateTextures() {
    const g = this.make.graphics();

    // Player textures (3 classes)
    const classColors = {
      warrior: 0xFF4444,
      wizard: 0x4444FF,
      taoist: 0x44FF44,
    };

    for (const [cls, color] of Object.entries(classColors)) {
      g.clear();
      // Body
      g.fillStyle(color, 1);
      g.fillRoundedRect(8, 12, 24, 28, 4);
      // Head
      g.fillStyle(0xFFCC99, 1);
      g.fillCircle(20, 10, 8);
      // Class indicator
      g.fillStyle(0xFFFFFF, 0.3);
      if (cls === 'warrior') {
        g.fillRect(30, 8, 4, 24); // Sword
      } else if (cls === 'wizard') {
        g.fillCircle(20, 4, 4); // Magic orb
      } else {
        g.fillTriangle(20, 0, 16, 8, 24, 8); // Taoist symbol
      }
      g.generateTexture(`player_${cls}`, 40, 48);
    }

    // Monster textures (different sizes)
    const monsterTypes = [
      { key: 'monster_small', size: 28, color: 0xAA6644 },
      { key: 'monster_medium', size: 36, color: 0x886644 },
      { key: 'monster_large', size: 48, color: 0x664422 },
      { key: 'monster_elite', size: 44, color: 0xFF8800 },
      { key: 'monster_boss', size: 64, color: 0xFF0044 },
    ];

    for (const m of monsterTypes) {
      g.clear();
      const s = m.size;
      // Body
      g.fillStyle(m.color, 1);
      g.fillRoundedRect(s * 0.15, s * 0.2, s * 0.7, s * 0.65, s * 0.1);
      // Eyes
      g.fillStyle(0xFF0000, 1);
      g.fillCircle(s * 0.35, s * 0.35, s * 0.06);
      g.fillCircle(s * 0.65, s * 0.35, s * 0.06);
      // Boss crown
      if (m.key === 'monster_boss') {
        g.fillStyle(0xFFD700, 1);
        g.fillTriangle(s * 0.3, s * 0.15, s * 0.5, 0, s * 0.7, s * 0.15);
      }
      // Elite glow
      if (m.key === 'monster_elite') {
        g.lineStyle(2, 0xFFAA00, 0.8);
        g.strokeRoundedRect(s * 0.1, s * 0.15, s * 0.8, s * 0.75, s * 0.12);
      }
      g.generateTexture(m.key, s, s);
    }

    // Item textures
    const itemTypes = [
      { key: 'item_gold', color: 0xFFD700 },
      { key: 'item_potion_hp', color: 0xFF3333 },
      { key: 'item_potion_mp', color: 0x3333FF },
      { key: 'item_weapon', color: 0xCCCCCC },
      { key: 'item_armor', color: 0x8888AA },
      { key: 'item_accessory', color: 0xAA44FF },
      { key: 'item_rare', color: 0x0088FF },
      { key: 'item_epic', color: 0xAA00FF },
      { key: 'item_legendary', color: 0xFF8800 },
    ];

    for (const item of itemTypes) {
      g.clear();
      g.fillStyle(item.color, 1);
      g.fillRoundedRect(4, 4, 24, 24, 4);
      g.lineStyle(1, 0xFFFFFF, 0.3);
      g.strokeRoundedRect(4, 4, 24, 24, 4);
      // Glow effect for rare+
      if (['item_rare', 'item_epic', 'item_legendary'].includes(item.key)) {
        g.lineStyle(2, item.color, 0.5);
        g.strokeRoundedRect(2, 2, 28, 28, 6);
      }
      g.generateTexture(item.key, 32, 32);
    }

    // Tile textures
    g.clear();
    g.fillStyle(0x3D2B1F, 1);
    g.fillRect(0, 0, 48, 48);
    g.lineStyle(1, 0x2A1F15, 0.3);
    g.strokeRect(0, 0, 48, 48);
    g.generateTexture('tile_ground', 48, 48);

    g.clear();
    g.fillStyle(0x1A1A2E, 1);
    g.fillRect(0, 0, 48, 48);
    g.fillStyle(0x2A2A3E, 0.5);
    g.fillRect(4, 4, 40, 40);
    g.generateTexture('tile_wall', 48, 48);

    g.clear();
    g.fillStyle(0x2D4A1F, 1);
    g.fillRect(0, 0, 48, 48);
    g.fillStyle(0x3D5A2F, 0.5);
    g.fillCircle(24, 24, 12);
    g.generateTexture('tile_grass', 48, 48);

    g.clear();
    g.fillStyle(0x4A3520, 1);
    g.fillRect(0, 0, 48, 48);
    g.fillStyle(0x5A4530, 0.3);
    g.fillRect(8, 0, 32, 48);
    g.generateTexture('tile_path', 48, 48);

    // Effect textures
    g.clear();
    g.fillStyle(0xFFFF00, 0.8);
    g.fillCircle(16, 16, 14);
    g.fillStyle(0xFF8800, 0.6);
    g.fillCircle(16, 16, 10);
    g.generateTexture('effect_hit', 32, 32);

    g.clear();
    g.fillStyle(0x00FF00, 0.6);
    g.fillCircle(12, 12, 10);
    g.generateTexture('effect_heal', 24, 24);

    g.clear();
    g.fillStyle(0xFFD700, 0.8);
    g.fillStar(12, 12, 5, 12, 6);
    g.generateTexture('effect_levelup', 24, 24);

    // Minimap player dot
    g.clear();
    g.fillStyle(0x00FF00, 1);
    g.fillCircle(4, 4, 4);
    g.generateTexture('minimap_player', 8, 8);

    g.clear();
    g.fillStyle(0xFF0000, 1);
    g.fillCircle(3, 3, 3);
    g.generateTexture('minimap_monster', 6, 6);

    g.clear();
    g.fillStyle(0xFFD700, 1);
    g.fillCircle(2, 2, 2);
    g.generateTexture('minimap_item', 4, 4);

    g.destroy();
  }

  create() {
    // Transition handled in preload complete callback
  }
}
