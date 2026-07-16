// 传奇先锋 - 主游戏场景 (使用AI生成素材)
const TILE_SIZE = 48;
const MAP_WIDTH = 40;
const MAP_HEIGHT = 30;

class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
    this.player = null;
    this.playerSprite = null;
    this.monsters = [];
    this.monsterSprites = new Map();
    this.npcs = [];
    this.groundItems = [];
    this.damageTexts = [];
    this.cursors = null;
    this.moveDir = { x: 0, y: 0 };
    this.lastMoveTime = 0;
    this.moveInterval = 150;
    this.ws = null;
    this.wsConnected = false;
    this.mapData = null;
    this.tilemapLayer = null;
    this.tickInterval = null;
    this.hpBar = null;
    this.mpBar = null;
    this.expBar = null;
    this.targetMonster = null;
  }

  preload() {
    // 加载地图tileset
    this.load.image('town_tileset', 'assets/tilesets/town_tileset.jpg');
    this.load.image('cave_tileset', 'assets/tilesets/cave_tileset.jpg');
    this.load.image('desert_tileset', 'assets/tilesets/desert_tileset.jpg');
    this.load.image('temple_tileset', 'assets/tilesets/temple_tileset.jpg');

    // 加载角色精灵
    this.load.image('warrior_sprites', 'assets/sprites/warrior_sprites.jpg');
    this.load.image('wizard_sprites', 'assets/sprites/wizard_sprites.jpg');
    this.load.image('taoist_sprites', 'assets/sprites/taoist_sprites.jpg');
    this.load.image('monsters_sprites', 'assets/sprites/monsters_sprites.jpg');
  }

  create() {
    const char = window.MIR.character;
    if (!char) {
      this.scene.start('MenuScene');
      return;
    }

    this.charData = char;
    this.mapData = window.MIR.gameData?.maps?.[char.mapId] || { id: char.mapId, name: '比奇省', width: MAP_WIDTH, height: MAP_HEIGHT };

    // 确定地图主题
    this.mapTheme = this.getMapTheme(this.mapData.id);

    // 渲染地图背景
    this.renderMap();

    // 创建玩家精灵
    this.createPlayer();

    // 生成怪物
    this.spawnMonsters();

    // 创建UI
    this.createUI();

    // 创建虚拟摇杆
    this.createJoystick();

    // 键盘输入
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys('W,S,A,D');

    // 连接WebSocket
    this.connectWebSocket();

    // 游戏循环
    this.tickInterval = setInterval(() => this.gameTick(), 100);

    // 显示地图名称
    this.showMapName();

    // 设置相机跟随玩家
    this.cameras.main.startFollow(this.playerSprite, true, 0.1, 0.1);
    this.cameras.main.setZoom(1);
  }

  getMapTheme(mapId) {
    const id = parseInt(mapId) || 0;
    if (id === 0 || id === 1) return 'town';      // 比奇省
    if (id === 3) return 'desert';                  // 盟重省
    if (id === 4) return 'town';                    // 毒蛇山谷
    if (id >= 100 && id < 200) return 'cave';      // 洞穴类
    if (id >= 200 && id < 300) return 'temple';    // 寺庙类
    if (id >= 300 && id < 400) return 'cave';      // 地牢类
    return 'town';
  }

  renderMap() {
    const theme = this.mapTheme;
    const tilesetKey = `${theme}_tileset`;

    // 创建大地色背景
    const bgColors = {
      town: 0x3a5c3a,
      cave: 0x1a1a2e,
      desert: 0x8b7355,
      temple: 0x4a3728
    };

    // 创建tilemap
    const mapWidth = MAP_WIDTH;
    const mapHeight = MAP_HEIGHT;

    // 用tileset图片平铺地面
    const tilesetTexture = this.textures.get(tilesetKey);
    const tileW = 64;
    const tileH = 64;

    // 创建地面层 - 使用tileset图片的裁剪区域
    for (let y = 0; y < mapHeight; y++) {
      for (let x = 0; x < mapWidth; x++) {
        // 从tileset中随机选择一个tile区域
        const srcX = (Math.floor(Math.random() * 4)) * tileW;
        const srcY = (Math.floor(Math.random() * 4)) * tileH;

        const tile = this.add.image(x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2, tilesetKey);
        tile.setCrop(srcX, srcY, tileW, tileH);
        tile.setDisplaySize(TILE_SIZE, TILE_SIZE);
        tile.setDepth(0);
      }
    }

    // 创建边界墙壁
    const wallColor = {
      town: 0x5c4033,
      cave: 0x2d2d44,
      desert: 0x6b5b3a,
      temple: 0x5c3a28
    };

    // 添加一些装饰物
    this.addDecorations(theme);

    // 地图边界
    const graphics = this.add.graphics();
    graphics.fillStyle(wallColor[theme] || 0x333333, 0.8);
    // 上边界
    graphics.fillRect(0, -TILE_SIZE, mapWidth * TILE_SIZE, TILE_SIZE);
    // 下边界
    graphics.fillRect(0, mapHeight * TILE_SIZE, mapWidth * TILE_SIZE, TILE_SIZE);
    // 左边界
    graphics.fillRect(-TILE_SIZE, 0, TILE_SIZE, mapHeight * TILE_SIZE);
    // 右边界
    graphics.fillRect(mapWidth * TILE_SIZE, 0, TILE_SIZE, mapHeight * TILE_SIZE);
    graphics.setDepth(5);
  }

  addDecorations(theme) {
    const mapWidth = MAP_WIDTH;
    const mapHeight = MAP_HEIGHT;
    const decoCount = 15 + Math.floor(Math.random() * 10);

    for (let i = 0; i < decoCount; i++) {
      const x = (2 + Math.floor(Math.random() * (mapWidth - 4))) * TILE_SIZE + TILE_SIZE / 2;
      const y = (2 + Math.floor(Math.random() * (mapHeight - 4))) * TILE_SIZE + TILE_SIZE / 2;

      const graphics = this.add.graphics();
      graphics.setDepth(2);

      if (theme === 'town') {
        // 树木
        if (Math.random() > 0.5) {
          graphics.fillStyle(0x2d5a27, 0.9);
          graphics.fillCircle(0, -10, 18);
          graphics.fillStyle(0x5c4033, 1);
          graphics.fillRect(-4, 0, 8, 15);
        } else {
          // 石头
          graphics.fillStyle(0x888888, 0.8);
          graphics.fillEllipse(0, 0, 20, 14);
        }
      } else if (theme === 'cave') {
        // 钟乳石
        graphics.fillStyle(0x4a4a6a, 0.8);
        graphics.fillTriangle(-8, 10, 8, 10, 0, -15);
      } else if (theme === 'desert') {
        // 仙人掌或岩石
        if (Math.random() > 0.5) {
          graphics.fillStyle(0x2d5a27, 0.9);
          graphics.fillRect(-4, -20, 8, 25);
          graphics.fillRect(-12, -12, 8, 4);
          graphics.fillRect(4, -8, 8, 4);
        } else {
          graphics.fillStyle(0x8b7355, 0.8);
          graphics.fillEllipse(0, 0, 22, 16);
        }
      } else {
        // 蜡烛或柱子
        graphics.fillStyle(0xc4a35a, 0.9);
        graphics.fillRect(-5, -20, 10, 25);
        graphics.fillStyle(0xff9900, 0.8);
        graphics.fillCircle(0, -24, 5);
      }

      graphics.setPosition(x, y);
      graphics.setDepth(2);
    }
  }

  createPlayer() {
    const char = this.charData;
    const spriteKey = `${char.class}_sprites`;

    // 创建玩家精灵
    const startX = (MAP_WIDTH / 2) * TILE_SIZE;
    const startY = (MAP_HEIGHT / 2) * TILE_SIZE;

    // 玩家身体
    this.playerSprite = this.add.graphics();
    this.drawCharacter(this.playerSprite, char.class, char.level);
    this.playerSprite.setPosition(startX, startY);
    this.playerSprite.setDepth(10);

    // 玩家名称
    this.playerNameText = this.add.text(startX, startY - 35, char.name, {
      fontSize: '12px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3
    });
    this.playerNameText.setOrigin(0.5);
    this.playerNameText.setDepth(11);

    // 玩家数据
    this.player = {
      x: startX,
      y: startY,
      char: char,
      hp: char.curHp || char.stats.hp,
      maxHp: char.stats.hp,
      mp: char.curMp || char.stats.mp,
      maxMp: char.stats.mp,
      exp: char.curExp || 0,
      maxExp: char.stats.maxExp || 100,
      level: char.level || 1,
      class: char.class,
      attackCooldown: 0
    };

    this.cameras.main.setBounds(0, 0, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE);
    this.cameras.main.scrollX = startX - this.cameras.main.width / 2;
    this.cameras.main.scrollY = startY - this.cameras.main.height / 2;
  }

  drawCharacter(g, charClass, level) {
    g.clear();
    const colors = {
      warrior: { body: 0x8b4513, armor: 0xc0c0c0, weapon: 0xdaa520 },
      wizard: { body: 0x4b0082, armor: 0x6a5acd, weapon: 0x9370db },
      taoist: { body: 0x006400, armor: 0x90ee90, weapon: 0xf0e68c }
    };
    const c = colors[charClass] || colors.warrior;

    // 身体
    g.fillStyle(c.armor, 1);
    g.fillRoundedRect(-12, -8, 24, 28, 4);

    // 头
    g.fillStyle(0xffdbac, 1);
    g.fillCircle(0, -16, 10);

    // 头发/帽子
    g.fillStyle(c.body, 1);
    g.fillRoundedRect(-10, -26, 20, 12, 4);

    // 武器
    g.fillStyle(c.weapon, 1);
    if (charClass === 'warrior') {
      g.fillRect(14, -20, 4, 30);
      g.fillRect(10, -22, 12, 4);
    } else if (charClass === 'wizard') {
      g.fillRect(14, -25, 3, 35);
      g.fillCircle(15, -28, 5);
    } else {
      g.fillRect(14, -15, 3, 25);
      // 扇子
      g.fillStyle(0xf5f5dc, 0.9);
      g.fillPie(18, -18, 10, 0, Math.PI);
    }

    // 等级标记
    if (level >= 10) {
      g.fillStyle(0xffd700, 0.8);
      g.fillStar?.(0, -32, 5, 6, 3) || g.fillCircle(0, -32, 4);
    }
  }

  spawnMonsters() {
    const spawns = window.MIR.gameData?.mapSpawns?.[this.mapData.id] || [];
    const monsterList = window.MIR.gameData?.monsters || [];

    // 如果没有刷新数据，生成一些默认怪物
    const monsterCount = Math.max(spawns.length, 8);

    for (let i = 0; i < monsterCount; i++) {
      const spawn = spawns[i] || null;
      const monsterData = spawn
        ? monsterList.find(m => m.id === spawn.monsterId) || monsterList[Math.floor(Math.random() * monsterList.length)]
        : monsterList[Math.floor(Math.random() * Math.min(monsterList.length, 20))];

      if (!monsterData) continue;

      const x = spawn
        ? spawn.x * TILE_SIZE
        : (3 + Math.floor(Math.random() * (MAP_WIDTH - 6))) * TILE_SIZE;
      const y = spawn
        ? spawn.y * TILE_SIZE
        : (3 + Math.floor(Math.random() * (MAP_HEIGHT - 6))) * TILE_SIZE;

      const monster = {
        id: `m_${i}_${Date.now()}`,
        data: monsterData,
        x: x,
        y: y,
        homeX: x,
        homeY: y,
        hp: monsterData.maxHp || 50,
        maxHp: monsterData.maxHp || 50,
        alive: true,
        spawnX: x,
        spawnY: y,
        state: 'idle',
        targetX: x,
        targetY: y,
        lastMove: 0,
        aggroRange: monsterData.viewRange || 5,
        attackRange: 1.5
      };

      this.monsters.push(monster);
      this.drawMonster(monster);
    }
  }

  drawMonster(monster) {
    const g = this.add.graphics();
    const md = monster.data;

    // 根据怪物类型决定外观
    const monsterType = md.id % 6;
    let bodyColor, eyeColor, size;

    if (md.monsterType === 'creature' || md.hp < 100) {
      // 小型怪物 - 鸡/鹿/猪
      bodyColor = [0x8B4513, 0xDEB887, 0xFFC0CB, 0x808080][monsterType % 4];
      eyeColor = 0x000000;
      size = 12;

      g.fillStyle(bodyColor, 1);
      g.fillEllipse(0, 0, size * 2, size * 1.5);
      g.fillStyle(eyeColor, 1);
      g.fillCircle(-4, -4, 2);
      g.fillCircle(4, -4, 2);
    } else if (md.hp < 500) {
      // 中型怪物 - 狼/蜘蛛/半兽人
      bodyColor = [0x4a4a4a, 0x2d2d2d, 0x556b2f, 0x8b0000][monsterType % 4];
      eyeColor = 0xff0000;
      size = 18;

      g.fillStyle(bodyColor, 1);
      g.fillRoundedRect(-size, -size, size * 2, size * 2, 6);
      g.fillStyle(eyeColor, 1);
      g.fillCircle(-6, -6, 3);
      g.fillCircle(6, -6, 3);
      // 牙齿
      g.fillStyle(0xffffff, 1);
      g.fillRect(-4, 6, 3, 5);
      g.fillRect(1, 6, 3, 5);
    } else {
      // 大型怪物/Boss
      bodyColor = [0x8b0000, 0x4b0082, 0x006400, 0x2f4f4f][monsterType % 4];
      eyeColor = 0xff4500;
      size = 24;

      g.fillStyle(bodyColor, 1);
      g.fillRoundedRect(-size, -size, size * 2, size * 2, 8);
      // 角
      g.fillStyle(0xdaa520, 1);
      g.fillTriangle(-size + 4, -size, -size + 10, -size, -size + 7, -size - 12);
      g.fillTriangle(size - 10, -size, size - 4, -size, size - 7, -size - 12);
      // 眼睛
      g.fillStyle(eyeColor, 1);
      g.fillCircle(-8, -6, 4);
      g.fillCircle(8, -6, 4);
      g.fillStyle(0x000000, 1);
      g.fillCircle(-8, -6, 2);
      g.fillCircle(8, -6, 2);
    }

    g.setPosition(monster.x, monster.y);
    g.setDepth(8);

    // 怪物名称
    const nameText = this.add.text(monster.x, monster.y - size - 15, md.name || '未知怪物', {
      fontSize: '10px',
      color: monster.hp > 500 ? '#ff4444' : '#ffcc00',
      stroke: '#000000',
      strokeThickness: 2
    });
    nameText.setOrigin(0.5);
    nameText.setDepth(9);

    // HP条
    const hpBarBg = this.add.graphics();
    hpBarBg.fillStyle(0x333333, 0.8);
    hpBarBg.fillRect(monster.x - 20, monster.y - size - 8, 40, 4);
    hpBarBg.setDepth(9);

    const hpBar = this.add.graphics();
    hpBar.fillStyle(0xff0000, 1);
    hpBar.fillRect(monster.x - 20, monster.y - size - 8, 40, 4);
    hpBar.setDepth(10);

    this.monsterSprites.set(monster.id, { graphics: g, name: nameText, hpBarBg: hpBarBg, hpBar: hpBar, size: size });
  }

  createUI() {
    const width = this.scale.width;
    const height = this.scale.height;

    // 固定UI不跟随相机
    const uiLayer = this.add.container(0, 0);
    uiLayer.setScrollFactor(0);
    uiLayer.setDepth(100);

    // 顶部信息栏
    const topBar = this.add.graphics();
    topBar.fillStyle(0x000000, 0.7);
    topBar.fillRoundedRect(10, 10, 250, 80, 8);
    uiLayer.add(topBar);

    // 角色名和等级
    const charInfo = this.add.text(20, 15, `${this.charData.name} Lv.${this.player.level}`, {
      fontSize: '14px',
      color: '#ffd700',
      fontStyle: 'bold'
    });
    uiLayer.add(charInfo);

    // HP条
    const hpLabel = this.add.text(20, 35, 'HP', { fontSize: '11px', color: '#ff4444' });
    uiLayer.add(hpLabel);

    this.hpBarBg = this.add.graphics();
    this.hpBarBg.fillStyle(0x333333, 0.8);
    this.hpBarBg.fillRoundedRect(45, 35, 150, 14, 4);
    uiLayer.add(this.hpBarBg);

    this.hpBarFill = this.add.graphics();
    this.hpBarFill.fillStyle(0xff3333, 1);
    this.hpBarFill.fillRoundedRect(45, 35, 150, 14, 4);
    uiLayer.add(this.hpBarFill);

    this.hpText = this.add.text(120, 36, `${this.player.hp}/${this.player.maxHp}`, {
      fontSize: '10px', color: '#ffffff', stroke: '#000000', strokeThickness: 2
    });
    this.hpText.setOrigin(0.5);
    uiLayer.add(this.hpText);

    // MP条
    const mpLabel = this.add.text(20, 53, 'MP', { fontSize: '11px', color: '#4444ff' });
    uiLayer.add(mpLabel);

    this.mpBarBg = this.add.graphics();
    this.mpBarBg.fillStyle(0x333333, 0.8);
    this.mpBarBg.fillRoundedRect(45, 53, 150, 14, 4);
    uiLayer.add(this.mpBarBg);

    this.mpBarFill = this.add.graphics();
    this.mpBarFill.fillStyle(0x3333ff, 1);
    this.mpBarFill.fillRoundedRect(45, 53, 150, 14, 4);
    uiLayer.add(this.mpBarFill);

    this.mpText = this.add.text(120, 54, `${this.player.mp}/${this.player.maxMp}`, {
      fontSize: '10px', color: '#ffffff', stroke: '#000000', strokeThickness: 2
    });
    this.mpText.setOrigin(0.5);
    uiLayer.add(this.mpText);

    // EXP条
    const expLabel = this.add.text(20, 71, 'EXP', { fontSize: '11px', color: '#44ff44' });
    uiLayer.add(expLabel);

    this.expBarBg = this.add.graphics();
    this.expBarBg.fillStyle(0x333333, 0.8);
    this.expBarBg.fillRoundedRect(45, 71, 150, 14, 4);
    uiLayer.add(this.expBarBg);

    this.expBarFill = this.add.graphics();
    this.expBarFill.fillStyle(0x33ff33, 1);
    this.expBarFill.fillRoundedRect(45, 71, 0, 14, 4);
    uiLayer.add(this.expBarFill);

    this.expText = this.add.text(120, 72, `${this.player.exp}/${this.player.maxExp}`, {
      fontSize: '10px', color: '#ffffff', stroke: '#000000', strokeThickness: 2
    });
    this.expText.setOrigin(0.5);
    uiLayer.add(this.expText);

    // 小地图
    const miniMap = this.add.graphics();
    miniMap.fillStyle(0x000000, 0.6);
    miniMap.fillRoundedRect(width - 130, 10, 120, 90, 6);
    miniMap.setScrollFactor(0);
    miniMap.setDepth(100);

    this.miniMapText = this.add.text(width - 70, 15, this.mapData.name || '未知地图', {
      fontSize: '11px', color: '#ffffff', fontStyle: 'bold'
    });
    this.miniMapText.setOrigin(0.5);
    this.miniMapText.setScrollFactor(0);
    this.miniMapText.setDepth(101);

    // 迷你地图上的点
    this.miniMapDot = this.add.graphics();
    this.miniMapDot.setScrollFactor(0);
    this.miniMapDot.setDepth(101);

    // 底部技能栏
    const skillBar = this.add.graphics();
    skillBar.fillStyle(0x000000, 0.7);
    skillBar.fillRoundedRect(width / 2 - 150, height - 60, 300, 50, 8);
    skillBar.setScrollFactor(0);
    skillBar.setDepth(100);

    // 技能按钮
    const skills = ['攻击', '技能1', '技能2', '技能3', '药品'];
    const skillColors = [0xff4444, 0x4444ff, 0x44ff44, 0xffff44, 0xff44ff];
    this.skillButtons = [];

    skills.forEach((skill, i) => {
      const bx = width / 2 - 120 + i * 60;
      const by = height - 45;

      const btn = this.add.graphics();
      btn.fillStyle(skillColors[i], 0.3);
      btn.fillRoundedRect(bx - 22, by - 15, 44, 30, 6);
      btn.lineStyle(1, skillColors[i], 0.8);
      btn.strokeRoundedRect(bx - 22, by - 15, 44, 30, 6);
      btn.setScrollFactor(0);
      btn.setDepth(101);

      const txt = this.add.text(bx, by, skill, {
        fontSize: '11px', color: '#ffffff'
      });
      txt.setOrigin(0.5);
      txt.setScrollFactor(0);
      txt.setDepth(102);

      // 点击事件
      const hitArea = this.add.rectangle(bx, by, 44, 30);
      hitArea.setScrollFactor(0);
      hitArea.setDepth(103);
      hitArea.setInteractive({ useHandCursor: true });
      hitArea.on('pointerdown', () => this.useSkill(i));
      this.skillButtons.push({ btn, txt, hitArea });
    });

    // 消息日志
    this.msgLog = [];
    this.msgTexts = [];
    for (let i = 0; i < 5; i++) {
      const t = this.add.text(10, height - 120 - i * 18, '', {
        fontSize: '11px', color: '#cccccc', stroke: '#000000', strokeThickness: 2
      });
      t.setScrollFactor(0);
      t.setDepth(100);
      t.setAlpha(1 - i * 0.2);
      this.msgTexts.push(t);
    }
  }

  createJoystick() {
    const width = this.scale.width;
    const height = this.scale.height;

    // 虚拟摇杆区域 (左下角)
    const jx = 80;
    const jy = height - 140;

    // 底座
    this.joystickBase = this.add.graphics();
    this.joystickBase.fillStyle(0xffffff, 0.15);
    this.joystickBase.fillCircle(jx, jy, 50);
    this.joystickBase.lineStyle(2, 0xffffff, 0.3);
    this.joystickBase.strokeCircle(jx, jy, 50);
    this.joystickBase.setScrollFactor(0);
    this.joystickBase.setDepth(100);

    // 摇杆
    this.joystickKnob = this.add.graphics();
    this.joystickKnob.fillStyle(0xffffff, 0.4);
    this.joystickKnob.fillCircle(jx, jy, 22);
    this.joystickKnob.setScrollFactor(0);
    this.joystickKnob.setDepth(101);

    this.joystickCenter = { x: jx, y: jy };
    this.joystickActive = false;

    // 触摸事件
    this.input.on('pointerdown', (pointer) => {
      if (pointer.x < 160 && pointer.y > height - 220) {
        this.joystickActive = true;
      }
    });

    this.input.on('pointermove', (pointer) => {
      if (!this.joystickActive) return;
      if (pointer.x > 160 || pointer.y < height - 220) return;

      const dx = pointer.x - this.joystickCenter.x;
      const dy = pointer.y - this.joystickCenter.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxDist = 40;

      const clampDist = Math.min(dist, maxDist);
      const angle = Math.atan2(dy, dx);

      const knobX = this.joystickCenter.x + Math.cos(angle) * clampDist;
      const knobY = this.joystickCenter.y + Math.sin(angle) * clampDist;

      this.joystickKnob.clear();
      this.joystickKnob.fillStyle(0xffffff, 0.5);
      this.joystickKnob.fillCircle(knobX, knobY, 22);

      if (dist > 10) {
        this.moveDir.x = Math.cos(angle);
        this.moveDir.y = Math.sin(angle);
      } else {
        this.moveDir.x = 0;
        this.moveDir.y = 0;
      }
    });

    this.input.on('pointerup', () => {
      this.joystickActive = false;
      this.moveDir.x = 0;
      this.moveDir.y = 0;
      this.joystickKnob.clear();
      this.joystickKnob.fillStyle(0xffffff, 0.4);
      this.joystickKnob.fillCircle(this.joystickCenter.x, this.joystickCenter.y, 22);
    });
  }

  connectWebSocket() {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/game-ws`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.wsConnected = true;
        this.addMessage('已连接游戏服务器');

        // 发送加入游戏
        this.ws.send(JSON.stringify({
          type: 'join',
          playerId: window.MIR.token,
          characterId: this.charData.id
        }));
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleServerMessage(msg);
        } catch (e) {}
      };

      this.ws.onclose = () => {
        this.wsConnected = false;
        this.addMessage('服务器连接断开');
      };

      this.ws.onerror = () => {
        this.wsConnected = false;
      };
    } catch (e) {
      this.wsConnected = false;
    }
  }

  handleServerMessage(msg) {
    switch (msg.type) {
      case 'state':
        // 服务器状态更新
        if (msg.data) {
          this.player.hp = msg.data.hp || this.player.hp;
          this.player.mp = msg.data.mp || this.player.mp;
          this.player.exp = msg.data.exp || this.player.exp;
          this.player.level = msg.data.level || this.player.level;
          this.updateUI();
        }
        break;
      case 'damage':
        this.showDamageText(msg.x, msg.y, msg.damage, msg.isCrit);
        break;
      case 'monster_died':
        this.onMonsterDied(msg.monsterId);
        break;
      case 'item_drop':
        this.showGroundItem(msg.x, msg.y, msg.item);
        break;
      case 'level_up':
        this.addMessage(`恭喜升级! 当前等级: ${msg.level}`);
        this.showLevelUpEffect();
        break;
    }
  }

  gameTick() {
    if (!this.player) return;

    const now = Date.now();

    // 处理移动
    this.handleMovement(now);

    // 更新怪物AI
    this.updateMonsters(now);

    // 自动攻击最近的怪物
    this.autoAttack(now);

    // 更新UI
    this.updateUI();

    // 更新迷你地图
    this.updateMiniMap();

    // 清理伤害文字
    this.damageTexts = this.damageTexts.filter(dt => {
      dt.text.setY(dt.text.y - 1);
      dt.text.setAlpha(dt.text.alpha - 0.02);
      if (dt.text.alpha <= 0) {
        dt.text.destroy();
        return false;
      }
      return true;
    });
  }

  handleMovement(now) {
    if (now - this.lastMoveTime < this.moveInterval) return;

    let dx = 0, dy = 0;

    // 键盘输入
    if (this.cursors) {
      if (this.cursors.left.isDown || (this.wasd && this.wasd.A.isDown)) dx -= 1;
      if (this.cursors.right.isDown || (this.wasd && this.wasd.D.isDown)) dx += 1;
      if (this.cursors.up.isDown || (this.wasd && this.wasd.W.isDown)) dy -= 1;
      if (this.cursors.down.isDown || (this.wasd && this.wasd.S.isDown)) dy += 1;
    }

    // 摇杆输入
    if (Math.abs(this.moveDir.x) > 0.1 || Math.abs(this.moveDir.y) > 0.1) {
      dx = this.moveDir.x;
      dy = this.moveDir.y;
    }

    if (dx === 0 && dy === 0) return;

    // 归一化
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0) {
      dx /= len;
      dy /= len;
    }

    const speed = TILE_SIZE * 0.6;
    const newX = Phaser.Math.Clamp(this.player.x + dx * speed, TILE_SIZE, (MAP_WIDTH - 1) * TILE_SIZE);
    const newY = Phaser.Math.Clamp(this.player.y + dy * speed, TILE_SIZE, (MAP_HEIGHT - 1) * TILE_SIZE);

    this.player.x = newX;
    this.player.y = newY;

    this.playerSprite.setPosition(newX, newY);
    this.playerNameText.setPosition(newX, newY - 35);

    this.lastMoveTime = now;

    // 发送移动到服务器
    if (this.wsConnected && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'move',
        x: newX,
        y: newY
      }));
    }
  }

  updateMonsters(now) {
    for (const monster of this.monsters) {
      if (!monster.alive) continue;

      const distToPlayer = Phaser.Math.Distance.Between(monster.x, monster.y, this.player.x, this.player.y);

      // AI状态机
      if (distToPlayer < monster.attackRange * TILE_SIZE) {
        // 攻击范围 - 攻击玩家
        monster.state = 'attacking';
        if (now - (monster.lastAttack || 0) > 1500) {
          this.monsterAttackPlayer(monster);
          monster.lastAttack = now;
        }
      } else if (distToPlayer < monster.aggroRange * TILE_SIZE) {
        // 仇恨范围 - 追击玩家
        monster.state = 'chasing';
        const angle = Phaser.Math.Angle.Between(monster.x, monster.y, this.player.x, this.player.y);
        const speed = TILE_SIZE * 0.3;
        monster.x += Math.cos(angle) * speed;
        monster.y += Math.sin(angle) * speed;
      } else {
        // 巡逻
        monster.state = 'idle';
        if (now - monster.lastMove > 2000) {
          const angle = Math.random() * Math.PI * 2;
          const dist = TILE_SIZE * (1 + Math.random() * 2);
          monster.targetX = Phaser.Math.Clamp(monster.homeX + Math.cos(angle) * dist, TILE_SIZE, (MAP_WIDTH - 1) * TILE_SIZE);
          monster.targetY = Phaser.Math.Clamp(monster.homeY + Math.sin(angle) * dist, TILE_SIZE, (MAP_HEIGHT - 1) * TILE_SIZE);
          monster.lastMove = now;
        }
        // 移向目标
        const distToTarget = Phaser.Math.Distance.Between(monster.x, monster.y, monster.targetX, monster.targetY);
        if (distToTarget > 5) {
          const angle = Phaser.Math.Angle.Between(monster.x, monster.y, monster.targetX, monster.targetY);
          const speed = TILE_SIZE * 0.15;
          monster.x += Math.cos(angle) * speed;
          monster.y += Math.sin(angle) * speed;
        }
      }

      // 更新怪物精灵位置
      const sprite = this.monsterSprites.get(monster.id);
      if (sprite) {
        sprite.graphics.setPosition(monster.x, monster.y);
        sprite.name.setPosition(monster.x, monster.y - sprite.size - 15);
        sprite.hpBarBg.setPosition(0, 0);
        sprite.hpBarBg.clear();
        sprite.hpBarBg.fillStyle(0x333333, 0.8);
        sprite.hpBarBg.fillRect(monster.x - 20, monster.y - sprite.size - 8, 40, 4);

        const hpRatio = Math.max(0, monster.hp / monster.maxHp);
        sprite.hpBar.clear();
        sprite.hpBar.fillStyle(hpRatio > 0.5 ? 0x00ff00 : hpRatio > 0.25 ? 0xffff00 : 0xff0000, 1);
        sprite.hpBar.fillRect(monster.x - 20, monster.y - sprite.size - 8, 40 * hpRatio, 4);
      }
    }
  }

  autoAttack(now) {
    if (this.player.attackCooldown > now) return;

    // 找最近的怪物
    let nearest = null;
    let nearestDist = Infinity;

    for (const monster of this.monsters) {
      if (!monster.alive) continue;
      const dist = Phaser.Math.Distance.Between(monster.x, monster.y, this.player.x, this.player.y);
      if (dist < nearestDist && dist < TILE_SIZE * 2.5) {
        nearest = monster;
        nearestDist = dist;
      }
    }

    if (nearest) {
      this.attackMonster(nearest);
      this.player.attackCooldown = now + 800;
    }
  }

  attackMonster(monster) {
    const stats = this.charData.stats || {};
    const dc = stats.dc || [30, 60];
    const attackPower = dc[0] + Math.floor(Math.random() * (dc[1] - dc[0]));
    const monsterDef = monster.data.ac || [0, 0];
    const defence = monsterDef[0] + Math.floor(Math.random() * (monsterDef[1] - monsterDef[0] + 1));

    let damage = Math.max(1, attackPower - defence);

    // 暴击判定
    const isCrit = Math.random() < 0.15;
    if (isCrit) damage = Math.floor(damage * 1.5);

    monster.hp -= damage;

    // 显示伤害
    this.showDamageText(monster.x, monster.y - 20, damage, isCrit);

    // 攻击特效
    this.showAttackEffect(this.player.x, this.player.y, monster.x, monster.y);

    if (monster.hp <= 0) {
      monster.alive = false;
      this.onMonsterDied(monster.id);

      // 发送击杀到服务器
      if (this.wsConnected && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'kill_monster',
          monsterId: monster.id,
          monsterDataId: monster.data.id
        }));
      }
    }
  }

  monsterAttackPlayer(monster) {
    const atk = monster.data.dc || [10, 20];
    const attackPower = atk[0] + Math.floor(Math.random() * (atk[1] - atk[0]));
    const stats = this.charData.stats || {};
    const ac = stats.ac || [5, 10];
    const defence = ac[0] + Math.floor(Math.random() * (ac[1] - ac[0] + 1));

    let damage = Math.max(1, attackPower - defence);
    this.player.hp = Math.max(0, this.player.hp - damage);

    this.showDamageText(this.player.x, this.player.y - 30, damage, false, true);

    if (this.player.hp <= 0) {
      this.onPlayerDeath();
    }
  }

  onMonsterDied(monsterId) {
    const monster = this.monsters.find(m => m.id === monsterId);
    if (!monster) return;

    monster.alive = false;

    // 隐藏精灵
    const sprite = this.monsterSprites.get(monsterId);
    if (sprite) {
      sprite.graphics.setVisible(false);
      sprite.name.setVisible(false);
      sprite.hpBarBg.setVisible(false);
      sprite.hpBar.setVisible(false);
    }

    // 获得经验
    const expGain = monster.data.exp || 10;
    this.player.exp += expGain;
    this.addMessage(`击杀 ${monster.data.name}! +${expGain}经验`);

    // 检查升级
    this.checkLevelUp();

    // 掉落物品
    if (Math.random() < 0.3) {
      this.showGroundItem(monster.x, monster.y, {
        name: ['金币', '小红药', '小蓝药', '铁剑', '布衣'][Math.floor(Math.random() * 5)],
        color: ['#ffd700', '#ff4444', '#4444ff', '#c0c0c0', '#90ee90'][Math.floor(Math.random() * 5)]
      });
    }

    // 3秒后复活怪物
    setTimeout(() => {
      monster.alive = true;
      monster.hp = monster.maxHp;
      monster.x = monster.spawnX;
      monster.y = monster.spawnY;
      if (sprite) {
        sprite.graphics.setVisible(true);
        sprite.name.setVisible(true);
        sprite.hpBarBg.setVisible(true);
        sprite.hpBar.setVisible(true);
      }
    }, 5000);
  }

  checkLevelUp() {
    const maxExp = this.player.maxExp || 100;
    while (this.player.exp >= maxExp) {
      this.player.exp -= maxExp;
      this.player.level++;
      this.player.maxExp = Math.floor(maxExp * 1.5);
      this.player.maxHp += 20;
      this.player.hp = this.player.maxHp;
      this.player.maxMp += 10;
      this.player.mp = this.player.maxMp;

      this.addMessage(`升级! 当前等级: ${this.player.level}`);
      this.showLevelUpEffect();
    }
  }

  showDamageText(x, y, damage, isCrit, isPlayerDamage) {
    const color = isPlayerDamage ? '#ff4444' : (isCrit ? '#ffff00' : '#ffffff');
    const size = isCrit ? '18px' : '14px';
    const prefix = isCrit ? '暴击! ' : '';

    const text = this.add.text(x + (Math.random() - 0.5) * 20, y, `${prefix}${damage}`, {
      fontSize: size,
      color: color,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3
    });
    text.setOrigin(0.5);
    text.setDepth(50);

    this.damageTexts.push({ text, time: Date.now() });
  }

  showAttackEffect(fromX, fromY, toX, toY) {
    const g = this.add.graphics();
    g.setDepth(15);

    const charClass = this.charData.class;
    if (charClass === 'warrior') {
      // 剑气效果
      g.lineStyle(3, 0xffffff, 0.8);
      g.beginPath();
      g.moveTo(fromX, fromY);
      g.lineTo(toX, toY);
      g.strokePath();
    } else if (charClass === 'wizard') {
      // 魔法效果
      g.fillStyle(0x6a5acd, 0.6);
      g.fillCircle(toX, toY, 20);
      g.fillStyle(0x9370db, 0.4);
      g.fillCircle(toX, toY, 30);
    } else {
      // 道术效果
      g.fillStyle(0x90ee90, 0.5);
      g.fillCircle(toX, toY, 18);
    }

    this.time.delayedCall(200, () => g.destroy());
  }

  showLevelUpEffect() {
    const g = this.add.graphics();
    g.setDepth(60);

    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const x = this.player.x + Math.cos(angle) * 40;
      const y = this.player.y + Math.sin(angle) * 40;
      g.fillStyle(0xffd700, 0.8);
      g.fillCircle(x, y, 4);
    }

    this.tweens.add({
      targets: g,
      alpha: 0,
      scale: 2,
      duration: 800,
      onComplete: () => g.destroy()
    });
  }

  showGroundItem(x, y, item) {
    const g = this.add.graphics();
    g.fillStyle(Phaser.Display.Color.HexStringToColor(item.color || '#ffd700').color, 0.8);
    g.fillRoundedRect(x - 8, y - 8, 16, 16, 3);
    g.setDepth(7);

    const text = this.add.text(x, y + 12, item.name, {
      fontSize: '9px',
      color: item.color || '#ffd700',
      stroke: '#000000',
      strokeThickness: 2
    });
    text.setOrigin(0.5);
    text.setDepth(7);

    // 5秒后消失
    this.time.delayedCall(5000, () => {
      g.destroy();
      text.destroy();
    });
  }

  useSkill(index) {
    if (!this.player || this.player.hp <= 0) return;

    if (index === 0) {
      // 普通攻击 - 攻击最近的怪物
      let nearest = null;
      let nearestDist = Infinity;
      for (const monster of this.monsters) {
        if (!monster.alive) continue;
        const dist = Phaser.Math.Distance.Between(monster.x, monster.y, this.player.x, this.player.y);
        if (dist < nearestDist && dist < TILE_SIZE * 3) {
          nearest = monster;
          nearestDist = dist;
        }
      }
      if (nearest) {
        this.attackMonster(nearest);
      } else {
        this.addMessage('附近没有怪物');
      }
    } else if (index === 4) {
      // 使用药品
      if (this.player.hp < this.player.maxHp) {
        const heal = Math.floor(this.player.maxHp * 0.3);
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + heal);
        this.addMessage(`使用药品，恢复 ${heal} HP`);
        this.showDamageText(this.player.x, this.player.y - 30, `+${heal}`, false, false);
      }
    } else {
      // 技能攻击 - 范围伤害
      const manaCost = 10 + index * 5;
      if (this.player.mp >= manaCost) {
        this.player.mp -= manaCost;
        const damage = (this.charData.stats?.mc || [43, 43])[0] * (index + 1);

        for (const monster of this.monsters) {
          if (!monster.alive) continue;
          const dist = Phaser.Math.Distance.Between(monster.x, monster.y, this.player.x, this.player.y);
          if (dist < TILE_SIZE * 4) {
            monster.hp -= damage;
            this.showDamageText(monster.x, monster.y - 20, damage, true);
            if (monster.hp <= 0) {
              monster.alive = false;
              this.onMonsterDied(monster.id);
            }
          }
        }

        // 技能特效
        const g = this.add.graphics();
        g.fillStyle([0, 0x6a5acd, 0x90ee90, 0xffd700][index], 0.4);
        g.fillCircle(this.player.x, this.player.y, TILE_SIZE * 4);
        g.setDepth(15);
        this.tweens.add({ targets: g, alpha: 0, scale: 1.5, duration: 500, onComplete: () => g.destroy() });

        this.addMessage(`释放技能${index}! 消耗 ${manaCost} MP`);
      } else {
        this.addMessage('MP不足!');
      }
    }
  }

  updateUI() {
    if (!this.player) return;

    const hpRatio = Math.max(0, this.player.hp / this.player.maxHp);
    const mpRatio = Math.max(0, this.player.mp / this.player.maxMp);
    const expRatio = Math.max(0, this.player.exp / (this.player.maxExp || 100));

    this.hpBarFill.clear();
    this.hpBarFill.fillStyle(0xff3333, 1);
    this.hpBarFill.fillRoundedRect(45, 35, 150 * hpRatio, 14, 4);
    this.hpText.setText(`${Math.floor(this.player.hp)}/${this.player.maxHp}`);

    this.mpBarFill.clear();
    this.mpBarFill.fillStyle(0x3333ff, 1);
    this.mpBarFill.fillRoundedRect(45, 53, 150 * mpRatio, 14, 4);
    this.mpText.setText(`${Math.floor(this.player.mp)}/${this.player.maxMp}`);

    this.expBarFill.clear();
    this.expBarFill.fillStyle(0x33ff33, 1);
    this.expBarFill.fillRoundedRect(45, 71, 150 * expRatio, 14, 4);
    this.expText.setText(`${this.player.exp}/${this.player.maxExp || 100}`);
  }

  updateMiniMap() {
    if (!this.miniMapDot) return;
    this.miniMapDot.clear();

    const width = this.scale.width;
    const mapScaleX = 100 / (MAP_WIDTH * TILE_SIZE);
    const mapScaleY = 60 / (MAP_HEIGHT * TILE_SIZE);
    const offsetX = width - 120;
    const offsetY = 35;

    // 玩家位置
    this.miniMapDot.fillStyle(0x00ff00, 1);
    this.miniMapDot.fillCircle(
      offsetX + this.player.x * mapScaleX,
      offsetY + this.player.y * mapScaleY,
      3
    );

    // 怪物位置
    for (const monster of this.monsters) {
      if (!monster.alive) continue;
      this.miniMapDot.fillStyle(0xff0000, 0.8);
      this.miniMapDot.fillCircle(
        offsetX + monster.x * mapScaleX,
        offsetY + monster.y * mapScaleY,
        2
      );
    }
  }

  showMapName() {
    const text = this.add.text(this.scale.width / 2, 100, this.mapData.name || '未知地图', {
      fontSize: '24px',
      color: '#ffd700',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4
    });
    text.setOrigin(0.5);
    text.setScrollFactor(0);
    text.setDepth(200);

    this.tweens.add({
      targets: text,
      alpha: 0,
      y: 80,
      duration: 2000,
      delay: 1000,
      onComplete: () => text.destroy()
    });
  }

  addMessage(msg) {
    this.msgLog.unshift(msg);
    if (this.msgLog.length > 5) this.msgLog.pop();

    for (let i = 0; i < this.msgTexts.length; i++) {
      this.msgTexts[i].setText(this.msgLog[i] || '');
    }
  }

  onPlayerDeath() {
    this.addMessage('你已死亡! 3秒后复活...');
    this.player.hp = 0;

    this.time.delayedCall(3000, () => {
      this.player.hp = this.player.maxHp;
      this.player.mp = this.player.maxMp;
      this.player.x = (MAP_WIDTH / 2) * TILE_SIZE;
      this.player.y = (MAP_HEIGHT / 2) * TILE_SIZE;
      this.playerSprite.setPosition(this.player.x, this.player.y);
      this.playerNameText.setPosition(this.player.x, this.player.y - 35);
      this.addMessage('已复活');
    });
  }

  update() {
    // Phaser update loop
  }

  shutdown() {
    if (this.tickInterval) clearInterval(this.tickInterval);
    if (this.ws) this.ws.close();
  }
}
