/**
 * Main Game Scene - Core gameplay
 */
import { CONFIG } from '../config.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
    this.monsters = [];
    this.items = [];
    this.damageTexts = [];
    this.targetPos = null;
    this.autoAttack = false;
    this.lastAttackTime = 0;
    this.playerData = null;
    this.mapData = null;
  }

  init(data) {
    this.playerName = this.registry.get('playerName') || '游客';
    this.playerClass = this.registry.get('playerClass') || 'warrior';
    this.playerData = this.registry.get('playerData') || null;
  }

  create() {
    const { width, height } = this.scale;
    
    // Initialize player stats
    this.initPlayer();
    
    // Create game world
    this.worldLayer = this.add.container(0, 0);
    
    // Generate procedural map for now (will load real maps later)
    this.generateMap();
    
    // Create player
    this.createPlayer();
    
    // Spawn monsters
    this.spawnMonsters();
    
    // Create HUD
    this.createHUD();
    
    // Create minimap
    this.createMiniMap();
    
    // Create mobile controls
    this.createMobileControls();
    
    // Input handling
    this.setupInput();
    
    // Camera follows player
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setZoom(1);
    
    // Game loop
    this.time.addEvent({
      delay: 100,
      loop: true,
      callback: () => this.gameLoop(),
    });

    // Monster respawn timer
    this.time.addEvent({
      delay: CONFIG.MONSTER.RESPAWN_TIME,
      loop: true,
      callback: () => this.respawnMonsters(),
    });

    // Welcome message
    this.showSystemMessage(`欢迎来到玛法大陆，${this.playerName}！`);
    this.showSystemMessage(`当前地图: 比奇省 | 经验倍率: ${CONFIG.EXP.MULTIPLIER}x`);
  }

  initPlayer() {
    const cls = this.playerClass;
    this.playerStats = {
      level: 1,
      exp: 0,
      expToNext: CONFIG.EXP.QUICK_TABLE[2] || 100,
      hp: CONFIG.PLAYER.BASE_HP[cls],
      maxHp: CONFIG.PLAYER.BASE_HP[cls],
      mp: CONFIG.PLAYER.BASE_MP[cls],
      maxMp: CONFIG.PLAYER.BASE_MP[cls],
      atk: CONFIG.PLAYER.BASE_ATK[cls],
      def: CONFIG.PLAYER.BASE_DEF[cls],
      speed: CONFIG.PLAYER.SPEED,
      attackRange: CONFIG.PLAYER.ATTACK_RANGE[cls],
      attackSpeed: CONFIG.PLAYER.ATTACK_SPEED[cls],
      gold: 1000,
      diamonds: 50,
      className: cls,
    };

    // Inventory
    this.inventory = [];
    this.maxInventory = 40;
    
    // Equipment slots
    this.equipment = {
      weapon: null,
      armor: null,
      helmet: null,
      boots: null,
      necklace: null,
      ring: null,
    };
  }

  generateMap() {
    // Generate a simple procedural map (比奇省 style)
    this.mapWidth = 80;
    this.mapHeight = 60;
    this.tiles = [];
    this.walkable = [];
    
    const T = CONFIG.TILE_SIZE;
    
    // Create tilemap
    for (let y = 0; y < this.mapHeight; y++) {
      this.tiles[y] = [];
      this.walkable[y] = [];
      for (let x = 0; x < this.mapWidth; x++) {
        // Border walls
        if (x === 0 || y === 0 || x === this.mapWidth - 1 || y === this.mapHeight - 1) {
          this.tiles[y][x] = 'wall';
          this.walkable[y][x] = false;
        }
        // Random walls/obstacles
        else if (Phaser.Math.Between(0, 100) < 8) {
          this.tiles[y][x] = 'wall';
          this.walkable[y][x] = false;
        }
        // Paths
        else if (Math.abs(x - 40) < 3 || Math.abs(y - 30) < 3) {
          this.tiles[y][x] = 'path';
          this.walkable[y][x] = true;
        }
        // Grass patches
        else if (Phaser.Math.Between(0, 100) < 20) {
          this.tiles[y][x] = 'grass';
          this.walkable[y][x] = true;
        }
        // Ground
        else {
          this.tiles[y][x] = 'ground';
          this.walkable[y][x] = true;
        }
      }
    }

    // Render tiles
    this.tileContainer = this.add.container(0, 0);
    for (let y = 0; y < this.mapHeight; y++) {
      for (let x = 0; x < this.mapWidth; x++) {
        const tileType = this.tiles[y][x];
        const tile = this.add.image(x * T + T / 2, y * T + T / 2, `tile_${tileType}`);
        this.tileContainer.add(tile);
      }
    }

    // Add some decorative elements
    for (let i = 0; i < 30; i++) {
      const tx = Phaser.Math.Between(3, this.mapWidth - 3);
      const ty = Phaser.Math.Between(3, this.mapHeight - 3);
      if (this.walkable[ty][tx]) {
        const tree = this.add.rectangle(tx * T + T / 2, ty * T + T / 2, 20, 30, 0x2D5A1F, 0.6);
        this.tileContainer.add(tree);
      }
    }

    // Safe zone marker (center area)
    const safeZone = this.add.rectangle(40 * T, 30 * T, 10 * T, 8 * T)
      .setStrokeStyle(2, 0xFFD700, 0.3);
    this.tileContainer.add(safeZone);
    
    // Town NPC area
    this.addTownNPCs();
  }

  addTownNPCs() {
    const T = CONFIG.TILE_SIZE;
    const npcs = [
      { x: 38, y: 28, name: '药店老板', color: 0x44AA44 },
      { x: 42, y: 28, name: '武器商人', color: 0xAAAA44 },
      { x: 38, y: 32, name: '杂货铺', color: 0x4444AA },
      { x: 42, y: 32, name: '仓库管理员', color: 0xAA44AA },
    ];

    npcs.forEach(npc => {
      const npcSprite = this.add.rectangle(npc.x * T + T / 2, npc.y * T + T / 2, 32, 40, npc.color, 0.8);
      const nameText = this.add.text(npc.x * T + T / 2, npc.y * T - 8, npc.name, {
        fontSize: '10px', color: '#FFD700',
      }).setOrigin(0.5);
      
      npcSprite.setInteractive({ useHandCursor: true });
      npcSprite.on('pointerdown', () => {
        this.showNPCDialog(npc.name);
      });
      
      this.tileContainer.add(npcSprite);
      this.tileContainer.add(nameText);
    });
  }

  createPlayer() {
    const T = CONFIG.TILE_SIZE;
    const startX = 40 * T;
    const startY = 30 * T;
    
    this.player = this.add.rectangle(startX, startY, 32, 40, CONFIG.COLORS[`PLAYER_${this.playerClass.toUpperCase()}`]);
    this.player.setDepth(100);
    
    // Player name tag
    this.playerNameTag = this.add.text(startX, startY - 30, this.playerName, {
      fontSize: '11px',
      color: '#FFFFFF',
      stroke: '#000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(101);

    // HP bar above player
    this.playerHpBar = this.add.rectangle(startX, startY - 22, 40, 4, 0x333333).setDepth(101);
    this.playerHpFill = this.add.rectangle(startX - 20, startY - 22, 40, 4, 0xFF3333).setOrigin(0, 0.5).setDepth(102);
  }

  spawnMonsters() {
    const T = CONFIG.TILE_SIZE;
    const monsterZones = [
      // Zone 1: Low level (稻草人, 鹿) - near town
      { x1: 5, y1: 5, x2: 25, y2: 20, level: 1, types: ['monster_small'], names: ['稻草人', '鹿', '鸡'] },
      // Zone 2: Medium level (半兽人, 蜘蛛) 
      { x1: 55, y1: 5, x2: 75, y2: 25, level: 5, types: ['monster_medium'], names: ['半兽人', '蜘蛛精', '骷髅'] },
      // Zone 3: Higher level (沃玛卫士)
      { x1: 5, y1: 40, x2: 30, y2: 55, level: 10, types: ['monster_medium', 'monster_large'], names: ['沃玛卫士', '蝎子', '钳虫'] },
      // Zone 4: High level (祖玛)
      { x1: 55, y1: 40, x2: 75, y2: 55, level: 20, types: ['monster_large', 'monster_elite'], names: ['祖玛卫士', '祖玛雕像', '楔蛾'] },
    ];

    monsterZones.forEach(zone => {
      const count = Phaser.Math.Between(8, 15);
      for (let i = 0; i < count; i++) {
        const x = Phaser.Math.Between(zone.x1, zone.x2);
        const y = Phaser.Math.Between(zone.y1, zone.y2);
        if (!this.walkable[y] || !this.walkable[y][x]) continue;
        
        const typeIdx = Phaser.Math.Between(0, zone.types.length - 1);
        const nameIdx = Phaser.Math.Between(0, zone.names.length - 1);
        
        this.createMonster(
          x * T + T / 2,
          y * T + T / 2,
          zone.types[typeIdx],
          zone.names[nameIdx],
          zone.level,
          false
        );
      }
    });

    // Spawn a BOSS in a special area
    this.createMonster(
      65 * T + T / 2,
      48 * T + T / 2,
      'monster_boss',
      '沃玛教主',
      25,
      true
    );
    
    this.createMonster(
      15 * T + T / 2,
      48 * T + T / 2,
      'monster_boss',
      '触龙神',
      30,
      true
    );
  }

  createMonster(x, y, type, name, level, isBoss) {
    const monster = this.add.rectangle(x, y, isBoss ? 56 : 32, isBoss ? 56 : 32,
      isBoss ? CONFIG.COLORS.MONSTER_BOSS : CONFIG.COLORS.MONSTER_NORMAL);
    monster.setDepth(50);
    
    // Monster data
    const levelMult = this.getLevelMultiplier(level);
    const monsterData = {
      sprite: monster,
      name: name,
      level: level,
      hp: Math.floor(50 * level * levelMult.hp * (isBoss ? CONFIG.BOSS.HP_MULTIPLIER : 1)),
      maxHp: Math.floor(50 * level * levelMult.hp * (isBoss ? CONFIG.BOSS.HP_MULTIPLIER : 1)),
      atk: Math.floor(5 * level * levelMult.atk * (isBoss ? CONFIG.BOSS.ATK_MULTIPLIER : 1)),
      def: Math.floor(2 * level * levelMult.def * (isBoss ? CONFIG.BOSS.DEF_MULTIPLIER : 1)),
      exp: Math.floor(20 * level * levelMult.exp * CONFIG.EXP.MULTIPLIER * (isBoss ? CONFIG.BOSS.EXP_MULTIPLIER : 1)),
      type: type,
      isBoss: isBoss,
      spawnX: x,
      spawnY: y,
      state: 'idle', // idle, chase, attack, dead
      target: null,
      lastAttack: 0,
      aggroRange: isBoss ? CONFIG.BOSS_AGGRO_RANGE * CONFIG.TILE_SIZE : CONFIG.MONSTER.AGGRO_RANGE * CONFIG.TILE_SIZE,
      nameText: null,
      hpBar: null,
      hpFill: null,
    };

    // Name tag
    const nameColor = isBoss ? '#FF0044' : (level > 15 ? '#FF8800' : '#CCCCCC');
    monsterData.nameText = this.add.text(x, y - (isBoss ? 40 : 24), 
      `${isBoss ? '★BOSS★ ' : ''}${name} [${level}]`, {
      fontSize: isBoss ? '12px' : '9px',
      color: nameColor,
      stroke: '#000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(51);

    // HP bar
    const barWidth = isBoss ? 60 : 36;
    monsterData.hpBar = this.add.rectangle(x, y - (isBoss ? 32 : 18), barWidth, 3, 0x333333).setDepth(51);
    monsterData.hpFill = this.add.rectangle(x - barWidth / 2, y - (isBoss ? 32 : 18), barWidth, 3, 0xFF3333)
      .setOrigin(0, 0.5).setDepth(52);

    // Make boss interactive
    if (isBoss) {
      monster.setInteractive({ useHandCursor: true });
      monster.on('pointerdown', () => {
        this.attackTarget(monsterData);
      });
    }

    this.monsters.push(monsterData);
    return monsterData;
  }

  getLevelMultiplier(level) {
    const levels = CONFIG.MONSTER.LEVEL_MULTIPLIERS;
    const keys = Object.keys(levels).map(Number).sort((a, b) => a - b);
    let mult = levels[1];
    for (const k of keys) {
      if (level >= k) mult = levels[k];
    }
    return mult;
  }

  createHUD() {
    const { width, height } = this.scale;
    this.hudContainer = this.add.container(0, 0).setScrollFactor(0).setDepth(1000);

    // Top-left: Player info panel
    const panelBg = this.add.rectangle(10, 10, 220, 90, 0x000000, 0.7)
      .setOrigin(0, 0).setStrokeStyle(1, 0x333333);
    this.hudContainer.add(panelBg);

    // Name & Level
    this.hudName = this.add.text(15, 15, `${this.playerName} [${this.playerStats.level}级 ${this.getPlayerClassName()}]`, {
      fontSize: '12px', color: '#FFD700',
    });
    this.hudContainer.add(this.hudName);

    // HP bar
    this.hudHpBar = this.add.rectangle(15, 35, 180, 10, 0x333333).setOrigin(0, 0);
    this.hudHpFill = this.add.rectangle(15, 35, 180, 10, 0xFF3333).setOrigin(0, 0);
    this.hudHpText = this.add.text(105, 40, '', { fontSize: '9px', color: '#FFF' }).setOrigin(0.5);
    this.hudContainer.add([this.hudHpBar, this.hudHpFill, this.hudHpText]);

    // MP bar
    this.hudMpBar = this.add.rectangle(15, 50, 180, 8, 0x333333).setOrigin(0, 0);
    this.hudMpFill = this.add.rectangle(15, 50, 180, 8, 0x3333FF).setOrigin(0, 0);
    this.hudMpText = this.add.text(105, 54, '', { fontSize: '8px', color: '#FFF' }).setOrigin(0.5);
    this.hudContainer.add([this.hudMpBar, this.hudMpFill, this.hudMpText]);

    // EXP bar
    this.hudExpBar = this.add.rectangle(15, 63, 180, 6, 0x333333).setOrigin(0, 0);
    this.hudExpFill = this.add.rectangle(15, 63, 0, 6, 0xFFD700).setOrigin(0, 0);
    this.hudExpText = this.add.text(105, 66, '', { fontSize: '7px', color: '#FFF' }).setOrigin(0.5);
    this.hudContainer.add([this.hudExpBar, this.hudExpFill, this.hudExpText]);

    // Gold & Diamonds
    this.hudGold = this.add.text(15, 78, `💰 ${this.playerStats.gold}`, { fontSize: '11px', color: '#FFD700' });
    this.hudDiamond = this.add.text(120, 78, `💎 ${this.playerStats.diamonds}`, { fontSize: '11px', color: '#00BFFF' });
    this.hudContainer.add([this.hudGold, this.hudDiamond]);

    // Bottom: Skill bar
    const skillBarBg = this.add.rectangle(width / 2, height - 35, 300, 50, 0x000000, 0.7)
      .setStrokeStyle(1, 0x333333);
    this.hudContainer.add(skillBarBg);

    const skills = this.getClassSkills();
    skills.forEach((skill, i) => {
      const sx = width / 2 - 120 + i * 50;
      const sy = height - 35;
      const skillBtn = this.add.rectangle(sx, sy, 40, 40, 0x222244)
        .setStrokeStyle(1, 0x4444AA)
        .setInteractive({ useHandCursor: true });
      this.hudContainer.add(skillBtn);
      
      const skillText = this.add.text(sx, sy - 5, skill.icon, { fontSize: '18px' }).setOrigin(0.5);
      const skillName = this.add.text(sx, sy + 14, skill.name, { fontSize: '7px', color: '#AAA' }).setOrigin(0.5);
      this.hudContainer.add([skillText, skillName]);

      skillBtn.on('pointerdown', () => {
        this.useSkill(skill);
      });
    });

    // Shop button
    const shopBtn = this.add.rectangle(width - 50, height - 35, 60, 40, 0x222200)
      .setStrokeStyle(1, 0xFFD700)
      .setInteractive({ useHandCursor: true });
    this.hudContainer.add(shopBtn);
    this.add.text(width - 50, height - 35, '商店', { fontSize: '12px', color: '#FFD700' }).setOrigin(0.5);
    shopBtn.on('pointerdown', () => this.toggleShop());

    // System message area
    this.systemMessages = [];
    this.systemMsgY = height - 100;
  }

  createMiniMap() {
    const { width } = this.scale;
    const mapSize = 120;
    
    this.miniMapBg = this.add.rectangle(width - mapSize / 2 - 10, mapSize / 2 + 10, mapSize + 4, mapSize + 4, 0x000000, 0.7)
      .setStrokeStyle(1, 0x444444).setScrollFactor(0).setDepth(999);
    
    this.miniMapGraphics = this.add.graphics().setScrollFactor(0).setDepth(1000);
    this.miniMapX = width - mapSize - 8;
    this.miniMapY = 12;
    this.miniMapSize = mapSize;
  }

  updateMiniMap() {
    const g = this.miniMapGraphics;
    g.clear();
    
    const scaleX = this.miniMapSize / (this.mapWidth * CONFIG.TILE_SIZE);
    const scaleY = this.miniMapSize / (this.mapHeight * CONFIG.TILE_SIZE);

    // Draw monsters
    this.monsters.forEach(m => {
      if (m.hp <= 0) return;
      const color = m.isBoss ? 0xFF0044 : 0xFF4444;
      const size = m.isBoss ? 4 : 2;
      g.fillStyle(color, 1);
      g.fillRect(
        this.miniMapX + m.sprite.x * scaleX,
        this.miniMapY + m.sprite.y * scaleY,
        size, size
      );
    });

    // Draw items
    this.items.forEach(item => {
      g.fillStyle(0xFFD700, 1);
      g.fillRect(
        this.miniMapX + item.sprite.x * scaleX,
        this.miniMapY + item.sprite.y * scaleY,
        2, 2
      );
    });

    // Draw player
    g.fillStyle(0x00FF00, 1);
    g.fillRect(
      this.miniMapX + this.player.x * scaleX - 2,
      this.miniMapY + this.player.y * scaleY - 2,
      5, 5
    );
  }

  createMobileControls() {
    const { width, height } = this.scale;
    
    // Virtual joystick area (left side)
    this.joystickArea = this.add.rectangle(80, height - 120, 120, 120, 0xFFFFFF, 0.05)
      .setScrollFactor(0).setDepth(998);
    
    this.joystickBase = this.add.circle(80, height - 120, 40, 0xFFFFFF, 0.1)
      .setScrollFactor(0).setDepth(999);
    this.joystickKnob = this.add.circle(80, height - 120, 20, 0xFFFFFF, 0.3)
      .setScrollFactor(0).setDepth(1000);

    // Joystick input
    let joystickActive = false;
    let joystickStart = { x: 80, y: height - 120 };

    this.joystickArea.setInteractive();
    this.joystickArea.on('pointerdown', (pointer) => {
      joystickActive = true;
      joystickStart = { x: 80, y: height - 120 };
    });

    this.input.on('pointermove', (pointer) => {
      if (!joystickActive) return;
      if (pointer.x > width / 2) return; // Only left side
      
      const dx = pointer.x - joystickStart.x;
      const dy = pointer.y - joystickStart.y;
      const dist = Math.min(Math.sqrt(dx * dx + dy * dy), 35);
      const angle = Math.atan2(dy, dx);
      
      this.joystickKnob.x = joystickStart.x + Math.cos(angle) * dist;
      this.joystickKnob.y = joystickStart.y + Math.sin(angle) * dist;
      
      this.joystickDirection = { x: Math.cos(angle), y: Math.sin(angle) };
      this.joystickMoving = true;
    });

    this.input.on('pointerup', () => {
      if (joystickActive) {
        joystickActive = false;
        this.joystickKnob.x = 80;
        this.joystickKnob.y = height - 120;
        this.joystickMoving = false;
        this.joystickDirection = null;
      }
    });
  }

  setupInput() {
    // Click to move / attack
    this.input.on('pointerdown', (pointer) => {
      if (pointer.y > this.scale.height - 80) return; // Skip HUD area
      if (pointer.x < 150 && pointer.y > this.scale.height - 180) return; // Skip joystick
      
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      
      // Check if clicked on a monster
      const clickedMonster = this.monsters.find(m => {
        if (m.hp <= 0) return false;
        const dist = Phaser.Math.Distance.Between(worldPoint.x, worldPoint.y, m.sprite.x, m.sprite.y);
        return dist < 30;
      });

      if (clickedMonster) {
        this.attackTarget(clickedMonster);
      } else {
        // Move to clicked position
        this.targetPos = { x: worldPoint.x, y: worldPoint.y };
        this.autoAttack = false;
      }
    });

    // Keyboard shortcuts
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('Q,W,E,R,SPACE,A');
  }

  gameLoop() {
    this.updatePlayerMovement();
    this.updateMonsterAI();
    this.updateHUD();
    this.updateMiniMap();
    this.cleanupDead();
  }

  updatePlayerMovement() {
    const speed = this.playerStats.speed;
    let dx = 0, dy = 0;

    // Keyboard movement
    if (this.cursors.left.isDown || this.keys.A.isDown) dx -= 1;
    if (this.cursors.right.isDown || this.keys.D.isDown) dx += 1;
    if (this.cursors.up.isDown) dy -= 1;
    if (this.cursors.down.isDown) dy += 1;

    // Joystick movement
    if (this.joystickMoving && this.joystickDirection) {
      dx = this.joystickDirection.x;
      dy = this.joystickDirection.y;
    }

    // Click-to-move
    if (this.targetPos && dx === 0 && dy === 0) {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.targetPos.x, this.targetPos.y);
      if (dist > 5) {
        const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, this.targetPos.x, this.targetPos.y);
        dx = Math.cos(angle);
        dy = Math.sin(angle);
      } else {
        this.targetPos = null;
      }
    }

    // Normalize and apply movement
    if (dx !== 0 || dy !== 0) {
      const len = Math.sqrt(dx * dx + dy * dy);
      dx = (dx / len) * speed;
      dy = (dy / len) * speed;

      const newX = this.player.x + dx;
      const newY = this.player.y + dy;

      // Check walkable
      const tileX = Math.floor(newX / CONFIG.TILE_SIZE);
      const tileY = Math.floor(newY / CONFIG.TILE_SIZE);
      
      if (tileX >= 0 && tileX < this.mapWidth && tileY >= 0 && tileY < this.mapHeight) {
        if (this.walkable[tileY][tileX]) {
          this.player.x = newX;
          this.player.y = newY;
        }
      }
    }

    // Update name tag and HP bar position
    this.playerNameTag.x = this.player.x;
    this.playerNameTag.y = this.player.y - 30;
    this.playerHpBar.x = this.player.x;
    this.playerHpBar.y = this.player.y - 22;
    this.playerHpFill.x = this.player.x - 20;
    this.playerHpFill.y = this.player.y - 22;

    // HP regen
    if (this.playerStats.hp < this.playerStats.maxHp) {
      this.playerStats.hp = Math.min(this.playerStats.hp + 1, this.playerStats.maxHp);
    }
  }

  updateMonsterAI() {
    const now = this.time.now;
    
    this.monsters.forEach(monster => {
      if (monster.hp <= 0) return;

      const distToPlayer = Phaser.Math.Distance.Between(
        monster.sprite.x, monster.sprite.y,
        this.player.x, this.player.y
      );

      // State machine
      switch (monster.state) {
        case 'idle':
          // Random wander
          if (Phaser.Math.Between(0, 100) < 2) {
            const wx = monster.spawnX + Phaser.Math.Between(-100, 100);
            const wy = monster.spawnY + Phaser.Math.Between(-100, 100);
            monster.wanderTarget = { x: wx, y: wy };
          }
          if (monster.wanderTarget) {
            const wDist = Phaser.Math.Distance.Between(monster.sprite.x, monster.sprite.y, monster.wanderTarget.x, monster.wanderTarget.y);
            if (wDist > 5) {
              const angle = Phaser.Math.Angle.Between(monster.sprite.x, monster.sprite.y, monster.wanderTarget.x, monster.wanderTarget.y);
              monster.sprite.x += Math.cos(angle) * 1;
              monster.sprite.y += Math.sin(angle) * 1;
            } else {
              monster.wanderTarget = null;
            }
          }
          
          // Aggro check
          if (distToPlayer < monster.aggroRange) {
            monster.state = 'chase';
            monster.target = this.player;
          }
          break;

        case 'chase':
          if (distToPlayer > monster.aggroRange * 2) {
            monster.state = 'idle';
            monster.target = null;
            break;
          }
          
          const chaseSpeed = monster.isBoss ? 2 : 1.5;
          const angle = Phaser.Math.Angle.Between(monster.sprite.x, monster.sprite.y, this.player.x, this.player.y);
          monster.sprite.x += Math.cos(angle) * chaseSpeed;
          monster.sprite.y += Math.sin(angle) * chaseSpeed;

          // Attack range check
          const attackDist = CONFIG.TILE_SIZE * 1.2;
          if (distToPlayer < attackDist) {
            monster.state = 'attack';
          }
          break;

        case 'attack':
          if (distToPlayer > CONFIG.TILE_SIZE * 1.5) {
            monster.state = 'chase';
            break;
          }
          
          if (now - monster.lastAttack > 1500) {
            monster.lastAttack = now;
            this.monsterAttackPlayer(monster);
          }
          break;
      }

      // Update monster UI position
      const barY = monster.isBoss ? 32 : 18;
      const nameY = monster.isBoss ? 40 : 24;
      monster.nameText.x = monster.sprite.x;
      monster.nameText.y = monster.sprite.y - nameY;
      monster.hpBar.x = monster.sprite.x;
      monster.hpBar.y = monster.sprite.y - barY;
      monster.hpFill.x = monster.sprite.x - (monster.isBoss ? 30 : 18);
      monster.hpFill.y = monster.sprite.y - barY;
    });
  }

  monsterAttackPlayer(monster) {
    const damage = Math.max(1, monster.atk - this.playerStats.def + Phaser.Math.Between(-3, 3));
    this.playerStats.hp -= damage;
    
    // Damage text
    this.showDamageText(this.player.x, this.player.y - 20, damage, '#FF4444');
    
    // Flash effect
    this.player.fillColor = 0xFF0000;
    this.time.delayedCall(100, () => {
      this.player.fillColor = CONFIG.COLORS[`PLAYER_${this.playerClass.toUpperCase()}`];
    });

    if (this.playerStats.hp <= 0) {
      this.playerDeath();
    }
  }

  attackTarget(monster) {
    const now = this.time.now;
    if (now - this.lastAttackTime < this.playerStats.attackSpeed) return;
    this.lastAttackTime = now;

    const dist = Phaser.Math.Distance.Between(
      this.player.x, this.player.y,
      monster.sprite.x, monster.sprite.y
    );
    const range = this.playerStats.attackRange * CONFIG.TILE_SIZE;

    if (dist > range) {
      // Move towards monster
      this.targetPos = { x: monster.sprite.x, y: monster.sprite.y };
      this.autoAttack = true;
      this.autoAttackTarget = monster;
      return;
    }

    // Calculate damage
    const baseDamage = this.playerStats.atk;
    const damage = Math.max(1, baseDamage - monster.def + Phaser.Math.Between(-2, 5));
    
    // Critical hit (15% chance)
    const isCrit = Phaser.Math.Between(0, 100) < 15;
    const finalDamage = isCrit ? damage * 2 : damage;
    
    monster.hp -= finalDamage;
    
    // Visual feedback
    this.showDamageText(monster.sprite.x, monster.sprite.y - 20, finalDamage, isCrit ? '#FFD700' : '#FFFFFF');
    
    // Hit effect
    const hitEffect = this.add.rectangle(monster.sprite.x, monster.sprite.y, 20, 20, 0xFFFF00, 0.5);
    this.tweens.add({
      targets: hitEffect,
      alpha: 0,
      scale: 2,
      duration: 200,
      onComplete: () => hitEffect.destroy(),
    });

    // Update HP bar
    const barWidth = monster.isBoss ? 60 : 36;
    const hpPercent = Math.max(0, monster.hp / monster.maxHp);
    monster.hpFill.width = barWidth * hpPercent;

    // Monster aggro
    if (monster.state === 'idle') {
      monster.state = 'chase';
    }

    // Monster death
    if (monster.hp <= 0) {
      this.monsterDeath(monster);
    }

    // Auto-attack continuation
    if (this.autoAttack && this.autoAttackTarget && this.autoAttackTarget.hp > 0) {
      this.time.delayedCall(this.playerStats.attackSpeed, () => {
        if (this.autoAttackTarget && this.autoAttackTarget.hp > 0) {
          this.attackTarget(this.autoAttackTarget);
        }
      });
    }
  }

  monsterDeath(monster) {
    // Grant EXP
    const expGain = monster.exp;
    this.playerStats.exp += expGain;
    this.showSystemMessage(`击杀 ${monster.name}! +${expGain} 经验`);
    
    // Show EXP gain text
    this.showDamageText(this.player.x, this.player.y - 40, `+${expGain} EXP`, '#FFD700');

    // Check level up
    this.checkLevelUp();

    // Drop loot
    this.dropLoot(monster);

    // Death animation
    this.tweens.add({
      targets: monster.sprite,
      alpha: 0,
      scale: 0.5,
      duration: 500,
      onComplete: () => {
        monster.sprite.setVisible(false);
        monster.nameText.setVisible(false);
        monster.hpBar.setVisible(false);
        monster.hpFill.setVisible(false);
      },
    });
  }

  dropLoot(monster) {
    const dropChance = monster.isBoss ? CONFIG.BOSS.DROP_RATE : CONFIG.DROP.NORMAL_RATE;
    
    // Gold always drops
    const goldAmount = Math.floor((monster.level * 10 + Phaser.Math.Between(1, 20)) * CONFIG.DROP.GOLD_MULTIPLIER);
    this.createItemDrop(monster.sprite.x + Phaser.Math.Between(-20, 20), monster.sprite.y + Phaser.Math.Between(-20, 20), 'gold', goldAmount);

    // Item drops
    if (Math.random() < dropChance) {
      const item = this.generateItem(monster);
      this.createItemDrop(
        monster.sprite.x + Phaser.Math.Between(-30, 30),
        monster.sprite.y + Phaser.Math.Between(-30, 30),
        item.type,
        0,
        item
      );
    }

    // BOSS extra drops
    if (monster.isBoss) {
      // Rare drop
      if (Math.random() < CONFIG.BOSS.RARE_DROP_RATE) {
        const rareItem = this.generateItem(monster, 'rare');
        this.createItemDrop(monster.sprite.x, monster.sprite.y + 20, rareItem.type, 0, rareItem);
      }
      // Epic drop
      if (Math.random() < CONFIG.BOSS.EPIC_DROP_RATE) {
        const epicItem = this.generateItem(monster, 'epic');
        this.createItemDrop(monster.sprite.x + 20, monster.sprite.y, epicItem.type, 0, epicItem);
        this.showSystemMessage('🎉 恭喜！获得史诗装备！');
      }
      // Legendary drop
      if (Math.random() < CONFIG.BOSS.LEGENDARY_DROP_RATE) {
        const legendaryItem = this.generateItem(monster, 'legendary');
        this.createItemDrop(monster.sprite.x - 20, monster.sprite.y, legendaryItem.type, 0, legendaryItem);
        this.showSystemMessage('🌟 传说降临！获得传说装备！');
      }
    }
  }

  generateItem(monster, forceRarity = null) {
    const rarity = forceRarity || this.rollRarity(monster);
    const types = ['weapon', 'armor', 'potion_hp', 'potion_mp'];
    const type = types[Phaser.Math.Between(0, types.length - 1)];
    
    const rarityMult = CONFIG.RARITY[rarity.toUpperCase()]?.statMult || 1;
    const level = monster.level;
    
    const itemNames = {
      weapon: ['木剑', '青铜刀', '铁剑', '半月弯刀', '裁决之杖', '屠龙刀', '倚天剑'],
      armor: ['布衣', '轻型铠甲', '重铠甲', '天魔神甲', '圣战宝甲', '炎龙战甲'],
      potion_hp: ['太阳水(小)', '太阳水(中)', '太阳水(大)'],
      potion_mp: ['魔法药(小)', '魔法药(中)', '魔法药(大)'],
    };

    const nameIdx = Math.min(Math.floor(level / 5), (itemNames[type]?.length || 1) - 1);
    const baseName = itemNames[type]?.[nameIdx] || '神秘物品';
    const prefix = rarity !== 'common' ? CONFIG.RARITY[rarity.toUpperCase()].name + ' ' : '';
    
    return {
      name: prefix + baseName,
      type: type,
      rarity: rarity,
      level: level,
      atk: type === 'weapon' ? Math.floor((5 + level * 2) * rarityMult) : 0,
      def: type === 'armor' ? Math.floor((3 + level * 1.5) * rarityMult) : 0,
      healHp: type === 'potion_hp' ? Math.floor(50 + level * 10 * rarityMult) : 0,
      healMp: type === 'potion_mp' ? Math.floor(30 + level * 8 * rarityMult) : 0,
      value: Math.floor((10 + level * 5) * rarityMult),
    };
  }

  rollRarity(monster) {
    const roll = Math.random() * 100;
    if (roll < 1) return 'legendary';
    if (roll < 5) return 'epic';
    if (roll < 15) return 'rare';
    if (roll < 40) return 'uncommon';
    return 'common';
  }

  createItemDrop(x, y, type, amount, itemData = null) {
    const textureKey = type === 'gold' ? 'item_gold' : `item_${type}`;
    const sprite = this.add.rectangle(x, y, 20, 20, 
      type === 'gold' ? 0xFFD700 : 
      type === 'potion_hp' ? 0xFF3333 :
      type === 'potion_mp' ? 0x3333FF :
      itemData?.rarity === 'legendary' ? 0xFF8800 :
      itemData?.rarity === 'epic' ? 0xAA00FF :
      itemData?.rarity === 'rare' ? 0x0088FF : 0xCCCCCC
    ).setDepth(30);

    // Blinking effect
    this.tweens.add({
      targets: sprite,
      alpha: 0.5,
      duration: 500,
      yoyo: true,
      repeat: -1,
    });

    // Name label
    const label = type === 'gold' ? `${amount}金币` : (itemData?.name || type);
    const labelColor = itemData ? (CONFIG.RARITY[itemData.rarity.toUpperCase()]?.color || '#FFF') : '#FFD700';
    const nameText = this.add.text(x, y - 14, label, {
      fontSize: '8px', color: labelColor, stroke: '#000', strokeThickness: 1,
    }).setOrigin(0.5).setDepth(31);

    const itemObj = {
      sprite,
      nameText,
      type,
      amount,
      data: itemData,
      x, y,
      createdAt: this.time.now,
    };

    // Click to pick up
    sprite.setInteractive({ useHandCursor: true });
    sprite.on('pointerdown', () => {
      this.pickupItem(itemObj);
    });

    this.items.push(itemObj);

    // Auto-despawn after 60 seconds
    this.time.delayedCall(60000, () => {
      if (itemObj.sprite.active) {
        itemObj.sprite.destroy();
        itemObj.nameText.destroy();
      }
    });
  }

  pickupItem(itemObj) {
    const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, itemObj.x, itemObj.y);
    if (dist > CONFIG.TILE_SIZE * 2) {
      this.showSystemMessage('距离太远，无法拾取');
      return;
    }

    if (itemObj.type === 'gold') {
      this.playerStats.gold += itemObj.amount;
      this.showSystemMessage(`拾取 ${itemObj.amount} 金币`);
    } else if (itemObj.data) {
      if (this.inventory.length < this.maxInventory) {
        this.inventory.push(itemObj.data);
        this.showSystemMessage(`拾取: ${itemObj.data.name}`);
      } else {
        this.showSystemMessage('背包已满！');
        return;
      }
    }

    itemObj.sprite.destroy();
    itemObj.nameText.destroy();
    const idx = this.items.indexOf(itemObj);
    if (idx > -1) this.items.splice(idx, 1);
  }

  checkLevelUp() {
    while (this.playerStats.exp >= this.playerStats.expToNext) {
      this.playerStats.exp -= this.playerStats.expToNext;
      this.playerStats.level++;
      
      // Stat growth
      const cls = this.playerClass;
      const hpGain = cls === 'warrior' ? 30 : cls === 'taoist' ? 20 : 12;
      const mpGain = cls === 'wizard' ? 25 : cls === 'taoist' ? 15 : 5;
      const atkGain = cls === 'wizard' ? 5 : cls === 'warrior' ? 4 : 3;
      const defGain = cls === 'warrior' ? 3 : cls === 'taoist' ? 2 : 1;

      this.playerStats.maxHp += hpGain;
      this.playerStats.maxMp += mpGain;
      this.playerStats.atk += atkGain;
      this.playerStats.def += defGain;
      this.playerStats.hp = this.playerStats.maxHp;
      this.playerStats.mp = this.playerStats.maxMp;
      
      // Next level exp
      this.playerStats.expToNext = Math.floor(100 * Math.pow(this.playerStats.level, 1.8));

      // Level up effect
      this.showSystemMessage(`🎉 升级! 当前等级: ${this.playerStats.level}`);
      this.showDamageText(this.player.x, this.player.y - 50, `LEVEL UP! ${this.playerStats.level}`, '#FFD700');
      
      // Visual effect
      const levelEffect = this.add.circle(this.player.x, this.player.y, 10, 0xFFD700, 0.8);
      this.tweens.add({
        targets: levelEffect,
        radius: 80,
        alpha: 0,
        duration: 1000,
        onComplete: () => levelEffect.destroy(),
      });
    }
  }

  useSkill(skill) {
    if (this.playerStats.mp < skill.mpCost) {
      this.showSystemMessage('MP不足!');
      return;
    }

    this.playerStats.mp -= skill.mpCost;

    // Find nearest monster
    let nearest = null;
    let nearestDist = Infinity;
    this.monsters.forEach(m => {
      if (m.hp <= 0) return;
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, m.sprite.x, m.sprite.y);
      if (dist < nearestDist && dist < CONFIG.TILE_SIZE * skill.range) {
        nearest = m;
        nearestDist = dist;
      }
    });

    if (nearest) {
      const damage = Math.floor(this.playerStats.atk * skill.damageMult + Phaser.Math.Between(0, 10));
      nearest.hp -= damage;
      this.showDamageText(nearest.sprite.x, nearest.sprite.y - 20, damage, skill.color || '#00FFFF');
      
      // Skill effect
      const effect = this.add.circle(nearest.sprite.x, nearest.sprite.y, 15, 
        Phaser.Display.Color.HexStringToColor(skill.color || '#00FFFF').color, 0.6);
      this.tweens.add({
        targets: effect,
        radius: 40,
        alpha: 0,
        duration: 400,
        onComplete: () => effect.destroy(),
      });

      // Update HP bar
      const barWidth = nearest.isBoss ? 60 : 36;
      const hpPercent = Math.max(0, nearest.hp / nearest.maxHp);
      nearest.hpFill.width = barWidth * hpPercent;

      if (nearest.hp <= 0) {
        this.monsterDeath(nearest);
      }
    } else {
      this.showSystemMessage('附近没有目标');
    }
  }

  getClassSkills() {
    const skills = {
      warrior: [
        { name: '普攻', icon: '⚔️', mpCost: 0, damageMult: 1, range: 1.5, color: '#FFFFFF' },
        { name: '烈火', icon: '🔥', mpCost: 10, damageMult: 2.5, range: 1.5, color: '#FF4400' },
        { name: '野蛮', icon: '💨', mpCost: 15, damageMult: 1.8, range: 2, color: '#FFAA00' },
        { name: '逐日', icon: '☀️', mpCost: 25, damageMult: 3, range: 3, color: '#FFD700' },
      ],
      wizard: [
        { name: '火球', icon: '🔮', mpCost: 5, damageMult: 1.5, range: 5, color: '#FF4400' },
        { name: '雷电', icon: '⚡', mpCost: 15, damageMult: 2.5, range: 5, color: '#4444FF' },
        { name: '冰咆', icon: '❄️', mpCost: 25, damageMult: 3, range: 4, color: '#00CCFF' },
        { name: '火墙', icon: '🌋', mpCost: 30, damageMult: 2, range: 5, color: '#FF6600' },
      ],
      taoist: [
        { name: '符咒', icon: '📜', mpCost: 5, damageMult: 1.2, range: 3, color: '#FFFF00' },
        { name: '施毒', icon: '☠️', mpCost: 10, damageMult: 1.5, range: 3, color: '#00FF00' },
        { name: '治愈', icon: '💚', mpCost: 15, damageMult: 0, range: 0, color: '#00FF00', heal: true },
        { name: '召唤', icon: '🐉', mpCost: 30, damageMult: 2, range: 4, color: '#AA00FF' },
      ],
    };
    return skills[this.playerClass] || skills.warrior;
  }

  getPlayerClassName() {
    const names = { warrior: '战士', wizard: '法师', taoist: '道士' };
    return names[this.playerClass] || '战士';
  }

  showDamageText(x, y, text, color) {
    const dmgText = this.add.text(x, y, String(text), {
      fontSize: '14px',
      color: color,
      fontStyle: 'bold',
      stroke: '#000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(200);

    this.tweens.add({
      targets: dmgText,
      y: y - 40,
      alpha: 0,
      duration: 1000,
      onComplete: () => dmgText.destroy(),
    });
  }

  showSystemMessage(msg) {
    const { height } = this.scale;
    const y = height - 100 - this.systemMessages.length * 18;
    
    const text = this.add.text(10, y, msg, {
      fontSize: '11px',
      color: '#FFD700',
      stroke: '#000',
      strokeThickness: 1,
    }).setScrollFactor(0).setDepth(900);

    this.systemMessages.push(text);

    this.time.delayedCall(5000, () => {
      this.tweens.add({
        targets: text,
        alpha: 0,
        duration: 500,
        onComplete: () => {
          text.destroy();
          const idx = this.systemMessages.indexOf(text);
          if (idx > -1) this.systemMessages.splice(idx, 1);
          // Reposition remaining messages
          this.systemMessages.forEach((t, i) => {
            t.y = height - 100 - i * 18;
          });
        },
      });
    });
  }

  showNPCDialog(npcName) {
    this.showSystemMessage(`${npcName}: 勇士，需要什么帮助吗？`);
  }

  toggleShop() {
    this.showSystemMessage('商店功能开发中...');
  }

  updateHUD() {
    const s = this.playerStats;
    
    // HP
    const hpPercent = Math.max(0, s.hp / s.maxHp);
    this.hudHpFill.width = 180 * hpPercent;
    this.hudHpText.setText(`${Math.floor(s.hp)} / ${s.maxHp}`);
    this.playerHpFill.width = 40 * hpPercent;

    // MP
    const mpPercent = Math.max(0, s.mp / s.maxMp);
    this.hudMpFill.width = 180 * mpPercent;
    this.hudMpText.setText(`${Math.floor(s.mp)} / ${s.maxMp}`);

    // EXP
    const expPercent = s.expToNext > 0 ? s.exp / s.expToNext : 0;
    this.hudExpFill.width = 180 * expPercent;
    this.hudExpText.setText(`EXP: ${s.exp} / ${s.expToNext}`);

    // Name & Level
    this.hudName.setText(`${this.playerName} [${s.level}级 ${this.getPlayerClassName()}]`);

    // Gold & Diamonds
    this.hudGold.setText(`💰 ${s.gold}`);
    this.hudDiamond.setText(`💎 ${s.diamonds}`);
  }

  cleanupDead() {
    // Remove old items
    const now = this.time.now;
    this.items = this.items.filter(item => {
      if (now - item.createdAt > 60000 && item.sprite.active) {
        item.sprite.destroy();
        item.nameText.destroy();
        return false;
      }
      return true;
    });
  }

  respawnMonsters() {
    const aliveCount = this.monsters.filter(m => m.hp > 0).length;
    if (aliveCount < 30) {
      // Respawn some monsters
      const zones = [
        { x1: 5, y1: 5, x2: 25, y2: 20, level: 1, types: ['monster_small'], names: ['稻草人', '鹿'] },
        { x1: 55, y1: 5, x2: 75, y2: 25, level: 5, types: ['monster_medium'], names: ['半兽人', '蜘蛛精'] },
      ];
      
      for (let i = 0; i < 5; i++) {
        const zone = zones[Phaser.Math.Between(0, zones.length - 1)];
        const x = Phaser.Math.Between(zone.x1, zone.x2);
        const y = Phaser.Math.Between(zone.y1, zone.y2);
        if (this.walkable[y] && this.walkable[y][x]) {
          const T = CONFIG.TILE_SIZE;
          this.createMonster(
            x * T + T / 2, y * T + T / 2,
            zone.types[0], zone.names[Phaser.Math.Between(0, zone.names.length - 1)],
            zone.level, false
          );
        }
      }
    }

    // Respawn bosses
    const aliveBosses = this.monsters.filter(m => m.isBoss && m.hp > 0).length;
    if (aliveBosses === 0) {
      const T = CONFIG.TILE_SIZE;
      this.createMonster(65 * T + T / 2, 48 * T + T / 2, 'monster_boss', '沃玛教主', 25, true);
      this.createMonster(15 * T + T / 2, 48 * T + T / 2, 'monster_boss', '触龙神', 30, true);
      this.showSystemMessage('⚠️ BOSS已刷新！');
    }
  }

  playerDeath() {
    this.showSystemMessage('你已阵亡！3秒后回到安全区...');
    this.playerStats.hp = 0;
    
    this.time.delayedCall(3000, () => {
      // Respawn at safe zone
      const T = CONFIG.TILE_SIZE;
      this.player.x = 40 * T;
      this.player.y = 30 * T;
      this.playerStats.hp = Math.floor(this.playerStats.maxHp * 0.5);
      this.playerStats.mp = Math.floor(this.playerStats.maxMp * 0.5);
      this.showSystemMessage('已回到安全区，恢复中...');
    });
  }
}
