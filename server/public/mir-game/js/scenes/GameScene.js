// 传奇先锋 - 主游戏场景
class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
    this.player = null;
    this.monsters = [];
    this.npcs = [];
    this.groundItems = [];
    this.damageTexts = [];
    this.cursors = null;
    this.joystick = null;
    this.moveDir = { x: 0, y: 0 };
    this.lastMoveTime = 0;
    this.moveInterval = 150; // ms between moves
    this.ws = null;
    this.wsConnected = false;
    this.mapData = null;
    this.mapGraphics = null;
    this.camera = null;
    this.tickInterval = null;
  }

  create() {
    const char = window.MIR.character;
    if (!char) {
      this.scene.start('MenuScene');
      return;
    }

    // 获取地图数据
    this.mapData = window.MIR.gameData?.maps?.[char.mapId] || { id: char.mapId, name: '比奇城', width: 100, height: 100, tiles: [] };

    // 创建地图图形
    this.mapGraphics = this.add.graphics();

    // 创建玩家
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
    this.attackKey = this.input.keyboard.addKey('SPACE');
    this.skillKeys = this.input.keyboard.addKeys(['Q', 'E', 'R', 'F']);

    // 点击移动/攻击
    this.input.on('pointerdown', (pointer) => {
      if (pointer.x > 200 && pointer.x < this.cameras.main.width - 200) {
        this.handleWorldClick(pointer);
      }
    });

    // 连接WebSocket
    this.connectWebSocket();

    // 游戏主循环
    this.tickInterval = this.time.addEvent({
      delay: 100,
      callback: () => this.gameTick(),
      loop: true,
    });

    // 绘制地图
    this.drawMap();

    // 显示欢迎消息
    this.showSystemMessage(`欢迎来到${GAME_CONFIG.MAP_NAMES[char.mapId] || '玛法大陆'}！`);
  }

  createPlayer() {
    const char = window.MIR.character;
    const classColor = GAME_CONFIG.CLASSES[char.class]?.color || '#FFFFFF';

    // 玩家图形
    this.player = {
      x: char.x * GAME_CONFIG.TILE_SIZE,
      y: char.y * GAME_CONFIG.TILE_SIZE,
      graphics: this.add.graphics(),
      nameText: null,
      hpBar: null,
      direction: char.direction || 6,
      isMoving: false,
      targetX: char.x * GAME_CONFIG.TILE_SIZE,
      targetY: char.y * GAME_CONFIG.TILE_SIZE,
      char: char,
    };

    this.drawPlayer();

    // 名字
    this.player.nameText = this.add.text(this.player.x, this.player.y - 40, char.name, {
      fontFamily: 'sans-serif',
      fontSize: '12px',
      color: '#FFFFFF',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);

    // 相机跟随
    this.cameras.main.startFollow(this.player.graphics, true, 0.1, 0.1);
    this.cameras.main.setZoom(1);
  }

  drawPlayer() {
    const g = this.player.graphics;
    g.clear();
    const char = this.player.char;
    const classColor = GAME_CONFIG.CLASSES[char.class]?.color || '#FFFFFF';
    const color = Phaser.Display.Color.HexStringToColor(classColor).color;

    // 身体
    g.fillStyle(color, 0.9);
    g.fillRoundedRect(this.player.x - 16, this.player.y - 20, 32, 40, 4);

    // 头
    g.fillStyle(0xFFDBAC, 0.9);
    g.fillCircle(this.player.x, this.player.y - 28, 12);

    // 职业标识
    g.fillStyle(0x000000, 0.5);
    g.fillCircle(this.player.x, this.player.y - 28, 4);
    g.fillStyle(color, 1);
    g.fillCircle(this.player.x, this.player.y - 28, 3);
  }

  spawnMonsters() {
    const char = window.MIR.character;
    const mapId = char.mapId;
    const spawns = window.MIR.gameData?.mapSpawns?.[mapId] || [];

    // 限制每屏最多显示20个怪物
    const maxMonsters = 20;
    const playerTileX = char.x;
    const playerTileY = char.y;

    // 按距离排序，取最近的
    const sortedSpawns = spawns
      .map(s => ({
        ...s,
        dist: Math.abs(s.x - playerTileX) + Math.abs(s.y - playerTileY)
      }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, maxMonsters);

    sortedSpawns.forEach((spawn, i) => {
      const monsterData = window.MIR.gameData?.monsters?.[spawn.monsterId];
      if (!monsterData) return;

      const mx = spawn.x * GAME_CONFIG.TILE_SIZE;
      const my = spawn.y * GAME_CONFIG.TILE_SIZE;

      const monster = {
        id: `m_${i}`,
        data: monsterData,
        x: mx,
        y: my,
        spawnX: mx,
        spawnY: my,
        hp: monsterData.MaxHP,
        maxHp: monsterData.MaxHP,
        graphics: this.add.graphics(),
        nameText: null,
        hpBar: null,
        alive: true,
        targetX: mx,
        targetY: my,
        moveTimer: 0,
        state: 'idle', // idle, chase, attack, return
        aggroRange: 5 * GAME_CONFIG.TILE_SIZE,
      };

      this.drawMonster(monster);

      // 名字
      monster.nameText = this.add.text(mx, my - 35, monsterData.Name, {
        fontFamily: 'sans-serif',
        fontSize: '11px',
        color: '#FF8A80',
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(0.5);

      // 血条背景
      monster.hpBar = this.add.graphics();
      this.drawMonsterHpBar(monster);

      this.monsters.push(monster);
    });
  }

  drawMonster(monster) {
    const g = monster.graphics;
    g.clear();

    if (!monster.alive) return;

    const data = monster.data;
    const isBoss = data.AI >= 64;
    const size = isBoss ? 24 : 18;

    // 身体颜色根据怪物类型
    let bodyColor = 0x8B4513; // 默认棕色
    if (data.EffectType === 4) bodyColor = 0x4A0080; // 紫（Boss）
    else if (data.Level > 30) bodyColor = 0xCC0000; // 红（高级）
    else if (data.Level > 15) bodyColor = 0x006600; // 绿（中级）

    // 身体
    g.fillStyle(bodyColor, 0.9);
    g.fillRoundedRect(monster.x - size, monster.y - size, size * 2, size * 2, 4);

    // 眼睛
    g.fillStyle(0xFF0000, 0.8);
    g.fillCircle(monster.x - size / 3, monster.y - size / 3, 3);
    g.fillCircle(monster.x + size / 3, monster.y - size / 3, 3);

    // Boss标识
    if (isBoss) {
      g.lineStyle(2, 0xFFD700, 0.8);
      g.strokeRoundedRect(monster.x - size - 2, monster.y - size - 2, (size + 2) * 2, (size + 2) * 2, 4);
    }
  }

  drawMonsterHpBar(monster) {
    if (!monster.hpBar) return;
    monster.hpBar.clear();

    if (!monster.alive || monster.hp >= monster.maxHp) return;

    const barW = 40;
    const barH = 4;
    const ratio = Math.max(0, monster.hp / monster.maxHp);

    // 背景
    monster.hpBar.fillStyle(0x000000, 0.7);
    monster.hpBar.fillRect(monster.x - barW / 2, monster.y - 30, barW, barH);

    // 血条
    const hpColor = ratio > 0.5 ? 0x4CAF50 : ratio > 0.25 ? 0xFF9800 : 0xF44336;
    monster.hpBar.fillStyle(hpColor, 1);
    monster.hpBar.fillRect(monster.x - barW / 2, monster.y - 30, barW * ratio, barH);
  }

  createUI() {
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const char = window.MIR.character;
    const C = GAME_CONFIG.COLORS;

    // UI容器（固定位置，不随相机移动）
    this.uiContainer = this.add.container(0, 0);
    this.uiContainer.setScrollFactor(0);
    this.uiContainer.setDepth(100);

    // === 底部面板 ===
    const bottomPanel = this.add.graphics();
    bottomPanel.fillStyle(0x0A0A0F, 0.85);
    bottomPanel.fillRect(0, h - 100, w, 100);
    bottomPanel.lineStyle(1, 0xC9A96E, 0.3);
    bottomPanel.strokeRect(0, h - 100, w, 100);
    this.uiContainer.add(bottomPanel);

    // HP条
    const hpBarX = 20;
    const hpBarY = h - 80;
    const barW = 200;
    const barH = 20;

    const hpBg = this.add.rectangle(hpBarX + barW / 2, hpBarY, barW, barH, 0x1A1A2E);
    hpBg.setStrokeStyle(1, 0x333333);
    this.uiContainer.add(hpBg);

    this.hpBarFill = this.add.rectangle(hpBarX, hpBarY, barW, barH, Phaser.Display.Color.HexStringToColor(C.HP).color);
    this.hpBarFill.setOrigin(0, 0.5);
    this.uiContainer.add(this.hpBarFill);

    this.hpText = this.add.text(hpBarX + barW / 2, hpBarY, `${char.stats.HP}/${char.stats.MaxHP}`, {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#FFFFFF',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);
    this.uiContainer.add(this.hpText);

    // MP条
    const mpBarY = hpBarY + 28;
    const mpBg = this.add.rectangle(hpBarX + barW / 2, mpBarY, barW, barH, 0x1A1A2E);
    mpBg.setStrokeStyle(1, 0x333333);
    this.uiContainer.add(mpBg);

    this.mpBarFill = this.add.rectangle(hpBarX, mpBarY, barW, barH, Phaser.Display.Color.HexStringToColor(C.MP).color);
    this.mpBarFill.setOrigin(0, 0.5);
    this.uiContainer.add(this.mpBarFill);

    this.mpText = this.add.text(hpBarX + barW / 2, mpBarY, `${char.stats.MP}/${char.stats.MaxMP}`, {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#FFFFFF',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);
    this.uiContainer.add(this.mpText);

    // EXP条
    const expBarY = mpBarY + 28;
    const expBg = this.add.rectangle(hpBarX + barW / 2, expBarY, barW, 10, 0x1A1A2E);
    expBg.setStrokeStyle(1, 0x333333);
    this.uiContainer.add(expBg);

    this.expBarFill = this.add.rectangle(hpBarX, expBarY, barW, 10, Phaser.Display.Color.HexStringToColor(C.EXP).color);
    this.expBarFill.setOrigin(0, 0.5);
    this.uiContainer.add(this.expBarFill);

    this.levelText = this.add.text(hpBarX + barW + 10, expBarY, `Lv.${char.level}`, {
      fontFamily: 'sans-serif',
      fontSize: '14px',
      color: '#C9A96E',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    this.uiContainer.add(this.levelText);

    // === 技能栏 ===
    const skillBarX = w / 2 - 100;
    const skillBarY = h - 55;
    const skillNames = ['普攻', '技能1', '技能2', '技能3'];
    const skillKeys = ['SPACE', 'Q', 'E', 'R'];

    for (let i = 0; i < 4; i++) {
      const sx = skillBarX + i * 55;
      const skillBg = this.add.rectangle(sx, skillBarY, 48, 48, 0x1A1A2E, 0.9);
      skillBg.setStrokeStyle(2, 0xC9A96E, 0.5);
      this.uiContainer.add(skillBg);

      const skillText = this.add.text(sx, skillBarY - 5, skillNames[i], {
        fontFamily: 'sans-serif',
        fontSize: '11px',
        color: '#E8E8E8',
      }).setOrigin(0.5);
      this.uiContainer.add(skillText);

      const keyText = this.add.text(sx, skillBarY + 16, skillKeys[i], {
        fontFamily: 'monospace',
        fontSize: '9px',
        color: '#888888',
      }).setOrigin(0.5);
      this.uiContainer.add(keyText);

      // 点击技能
      skillBg.setInteractive({ useHandCursor: true });
      skillBg.on('pointerdown', () => this.useSkill(i));
    }

    // === 金币显示 ===
    this.goldText = this.add.text(w - 20, h - 85, `金币: ${char.gold}`, {
      fontFamily: 'sans-serif',
      fontSize: '14px',
      color: '#FFD700',
    }).setOrigin(1, 0);
    this.uiContainer.add(this.goldText);

    // === 地图名 ===
    const mapName = GAME_CONFIG.MAP_NAMES[char.mapId] || `地图${char.mapId}`;
    this.mapNameText = this.add.text(w - 20, 20, mapName, {
      fontFamily: 'serif',
      fontSize: '18px',
      color: '#C9A96E',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(1, 0);
    this.uiContainer.add(this.mapNameText);

    // === 坐标 ===
    this.coordText = this.add.text(w - 20, 45, `(${char.x}, ${char.y})`, {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#888888',
    }).setOrigin(1, 0);
    this.uiContainer.add(this.coordText);

    // === 小地图 ===
    this.createMiniMap();

    // === 消息日志 ===
    this.messageLog = [];
    this.messageTexts = [];
    for (let i = 0; i < 5; i++) {
      const t = this.add.text(20, 60 + i * 20, '', {
        fontFamily: 'sans-serif',
        fontSize: '12px',
        color: '#AAAAAA',
        stroke: '#000000',
        strokeThickness: 2,
      });
      t.setScrollFactor(0);
      t.setDepth(100);
      this.messageTexts.push(t);
    }

    // === 背包按钮 ===
    const bagBtn = this.add.text(w - 60, h - 55, '背包', {
      fontFamily: 'sans-serif',
      fontSize: '14px',
      color: '#C9A96E',
      backgroundColor: '#1A1A2E',
      padding: { x: 10, y: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    bagBtn.setScrollFactor(0);
    bagBtn.setDepth(100);
    bagBtn.on('pointerdown', () => this.toggleInventory());

    // 背包面板（默认隐藏）
    this.inventoryVisible = false;
    this.createInventoryPanel();
  }

  createMiniMap() {
    const w = this.cameras.main.width;
    const mmSize = 120;
    const mmX = w - mmSize - 10;
    const mmY = 70;

    const mmBg = this.add.rectangle(mmX + mmSize / 2, mmY + mmSize / 2, mmSize, mmSize, 0x0A0A0F, 0.8);
    mmBg.setStrokeStyle(1, 0xC9A96E, 0.5);
    mmBg.setScrollFactor(0);
    mmBg.setDepth(100);

    this.miniMap = this.add.graphics();
    this.miniMap.setScrollFactor(0);
    this.miniMap.setDepth(101);
    this.miniMapX = mmX;
    this.miniMapY = mmY;
    this.miniMapSize = mmSize;
  }

  drawMiniMap() {
    this.miniMap.clear();
    const char = window.MIR.character;
    const scale = this.miniMapSize / 100; // 假设地图100x100

    // 玩家点
    this.miniMap.fillStyle(0x00FF00, 1);
    this.miniMap.fillCircle(
      this.miniMapX + char.x * scale,
      this.miniMapY + char.y * scale,
      3
    );

    // 怪物点
    this.monsters.forEach(m => {
      if (!m.alive) return;
      const mx = m.x / GAME_CONFIG.TILE_SIZE;
      const my = m.y / GAME_CONFIG.TILE_SIZE;
      this.miniMap.fillStyle(0xFF0000, 0.7);
      this.miniMap.fillCircle(
        this.miniMapX + mx * scale,
        this.miniMapY + my * scale,
        2
      );
    });
  }

  createJoystick() {
    const h = this.cameras.main.height;
    const jx = 100;
    const jy = h - 200;

    // 摇杆底座
    this.joystickBase = this.add.circle(jx, jy, 50, 0x1A1A2E, 0.5);
    this.joystickBase.setStrokeStyle(2, 0xC9A96E, 0.3);
    this.joystickBase.setScrollFactor(0);
    this.joystickBase.setDepth(100);

    // 摇杆头
    this.joystickHead = this.add.circle(jx, jy, 20, 0xC9A96E, 0.6);
    this.joystickHead.setScrollFactor(0);
    this.joystickHead.setDepth(101);

    this.joystickBaseX = jx;
    this.joystickBaseY = jy;
    this.joystickActive = false;

    // 触摸事件
    this.joystickBase.setInteractive();
    this.joystickBase.on('pointerdown', () => { this.joystickActive = true; });
    this.joystickBase.on('pointerup', () => {
      this.joystickActive = false;
      this.joystickHead.setPosition(this.joystickBaseX, this.joystickBaseY);
      this.moveDir.x = 0;
      this.moveDir.y = 0;
    });
    this.joystickBase.on('pointermove', (pointer) => {
      if (!this.joystickActive) return;
      const dx = pointer.x - this.joystickBaseX;
      const dy = pointer.y - this.joystickBaseY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxDist = 40;

      if (dist > maxDist) {
        const angle = Math.atan2(dy, dx);
        this.joystickHead.setPosition(
          this.joystickBaseX + Math.cos(angle) * maxDist,
          this.joystickBaseY + Math.sin(angle) * maxDist
        );
      } else {
        this.joystickHead.setPosition(pointer.x, pointer.y);
      }

      // 计算方向
      if (dist > 10) {
        this.moveDir.x = dx / dist;
        this.moveDir.y = dy / dist;
      } else {
        this.moveDir.x = 0;
        this.moveDir.y = 0;
      }
    });
  }

  createInventoryPanel() {
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const panelW = 300;
    const panelH = 400;

    this.inventoryPanel = this.add.container(w / 2 - panelW / 2, h / 2 - panelH / 2);
    this.inventoryPanel.setScrollFactor(0);
    this.inventoryPanel.setDepth(200);
    this.inventoryPanel.setVisible(false);

    // 背景
    const bg = this.add.rectangle(panelW / 2, panelH / 2, panelW, panelH, 0x1A1A2E, 0.95);
    bg.setStrokeStyle(2, 0xC9A96E);
    this.inventoryPanel.add(bg);

    // 标题
    const title = this.add.text(panelW / 2, 20, '背包', {
      fontFamily: 'serif',
      fontSize: '18px',
      color: '#C9A96E',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.inventoryPanel.add(title);

    // 关闭按钮
    const closeBtn = this.add.text(panelW - 15, 15, '✕', {
      fontFamily: 'sans-serif',
      fontSize: '18px',
      color: '#888888',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.toggleInventory());
    this.inventoryPanel.add(closeBtn);

    // 物品列表
    this.inventoryItems = [];
    const char = window.MIR.character;
    const items = char.inventory || [];

    for (let i = 0; i < Math.min(items.length, 20); i++) {
      const item = items[i];
      const ix = 20 + (i % 5) * 55;
      const iy = 50 + Math.floor(i / 5) * 55;

      const itemBg = this.add.rectangle(ix + 22, iy + 22, 48, 48, 0x0A0A0F, 0.8);
      const qualityColor = Phaser.Display.Color.HexStringToColor(GAME_CONFIG.QUALITY_COLORS[item.quality || 0] || '#B0BEC5').color;
      itemBg.setStrokeStyle(1, qualityColor);
      this.inventoryPanel.add(itemBg);

      const nameText = this.add.text(ix + 22, iy + 18, item.name || '???', {
        fontFamily: 'sans-serif',
        fontSize: '9px',
        color: Phaser.Display.Color.IntegerToColor(qualityColor).rgba,
        wordWrap: { width: 44 },
        align: 'center',
      }).setOrigin(0.5);
      this.inventoryPanel.add(nameText);

      if (item.count > 1) {
        const countText = this.add.text(ix + 40, iy + 40, `x${item.count}`, {
          fontFamily: 'monospace',
          fontSize: '10px',
          color: '#FFFFFF',
        }).setOrigin(1, 1);
        this.inventoryPanel.add(countText);
      }
    }

    if (items.length === 0) {
      const emptyText = this.add.text(panelW / 2, panelH / 2, '背包为空', {
        fontFamily: 'sans-serif',
        fontSize: '14px',
        color: '#555555',
      }).setOrigin(0.5);
      this.inventoryPanel.add(emptyText);
    }
  }

  toggleInventory() {
    this.inventoryVisible = !this.inventoryVisible;
    this.inventoryPanel.setVisible(this.inventoryVisible);
  }

  connectWebSocket() {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/game`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.wsConnected = true;
        // 发送加入游戏消息
        this.ws.send(JSON.stringify({
          type: 'join',
          token: window.MIR.token,
          character: window.MIR.character,
        }));
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleServerMessage(msg);
        } catch (e) {
          console.error('WS message error:', e);
        }
      };

      this.ws.onclose = () => {
        this.wsConnected = false;
        // 3秒后重连
        this.time.delayedCall(3000, () => this.connectWebSocket());
      };

      this.ws.onerror = (err) => {
        console.error('WebSocket error:', err);
      };
    } catch (e) {
      console.error('WebSocket connection failed:', e);
    }
  }

  handleServerMessage(msg) {
    switch (msg.type) {
      case 'monster_update':
        this.updateMonsterFromServer(msg);
        break;
      case 'damage':
        this.showDamageText(msg.x, msg.y, msg.amount, msg.isCritical);
        break;
      case 'item_drop':
        this.showGroundItem(msg);
        break;
      case 'level_up':
        this.showSystemMessage(`恭喜升级！当前等级: ${msg.level}`);
        break;
      case 'player_update':
        if (msg.character) {
          window.MIR.character = msg.character;
          this.updateUI();
        }
        break;
    }
  }

  handleWorldClick(pointer) {
    const worldX = pointer.worldX;
    const worldY = pointer.worldY;

    // 检查是否点击了怪物
    const clickedMonster = this.monsters.find(m => {
      if (!m.alive) return false;
      const dist = Phaser.Math.Distance.Between(worldX, worldY, m.x, m.y);
      return dist < 30;
    });

    if (clickedMonster) {
      // 攻击怪物
      this.attackMonster(clickedMonster);
    } else {
      // 移动到点击位置
      this.player.targetX = worldX;
      this.player.targetY = worldY;
    }
  }

  attackMonster(monster) {
    const char = window.MIR.character;
    const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, monster.x, monster.y);

    if (dist > GAME_CONFIG.TILE_SIZE * 2) {
      // 距离太远，先移动过去
      this.player.targetX = monster.x;
      this.player.targetY = monster.y;
      this.player.attackTarget = monster;
      return;
    }

    // 计算伤害（参考 Crystal 公式）
    const attackPower = Phaser.Math.Between(char.stats.MinDC, char.stats.MaxDC);
    const monsterDef = Phaser.Math.Between(
      monster.data.MinAC || 0, monster.data.MaxAC || 0
    );

    // 命中判定
    const hitChance = 70 + (char.stats.Accuracy - monster.data.Agility) * 5;
    const isHit = Phaser.Math.Between(0, 100) < Math.min(95, Math.max(30, hitChance));

    if (!isHit) {
      this.showDamageText(monster.x, monster.y - 20, 'MISS', false, '#B0BEC5');
      return;
    }

    // 暴击判定
    const critChance = char.stats.CriticalRate || 5;
    const isCrit = Phaser.Math.Between(0, 100) < critChance;
    let damage = Math.max(1, attackPower - monsterDef);
    if (isCrit) {
      damage = Math.floor(damage * (1 + (char.stats.CriticalDamage || 50) / 100));
    }

    // 应用伤害
    monster.hp -= damage;
    this.showDamageText(monster.x, monster.y - 20, damage, isCrit);
    this.drawMonsterHpBar(monster);

    if (monster.hp <= 0) {
      this.killMonster(monster);
    }

    // 怪物反击
    if (monster.alive && dist < GAME_CONFIG.TILE_SIZE * 3) {
      this.time.delayedCall(500, () => this.monsterAttack(monster));
    }
  }

  monsterAttack(monster) {
    if (!monster.alive) return;

    const char = window.MIR.character;
    const monsterAtk = Phaser.Math.Between(monster.data.MinDC || 1, monster.data.MaxDC || 5);
    const playerDef = Phaser.Math.Between(char.stats.MinAC, char.stats.MaxAC);
    let damage = Math.max(1, monsterAtk - playerDef);

    // 闪避判定
    const dodgeChance = char.stats.Agility * 3;
    if (Phaser.Math.Between(0, 100) < dodgeChance) {
      this.showDamageText(this.player.x, this.player.y - 30, '闪避', false, '#B0BEC5');
      return;
    }

    char.stats.HP = Math.max(0, char.stats.HP - damage);
    this.showDamageText(this.player.x, this.player.y - 30, damage, false, '#FF5252');
    this.updateUI();

    if (char.stats.HP <= 0) {
      this.playerDeath();
    }
  }

  killMonster(monster) {
    monster.alive = false;
    monster.graphics.clear();
    if (monster.nameText) monster.nameText.setVisible(false);
    if (monster.hpBar) monster.hpBar.clear();

    const char = window.MIR.character;

    // 经验奖励
    const expGain = monster.data.Exp || 10;
    char.experience += expGain;
    this.showSystemMessage(`击杀 ${monster.data.Name}！获得 ${expGain} 经验`);

    // 检查升级
    this.checkLevelUp();

    // 掉落金币
    const goldDrop = Phaser.Math.Between(1, monster.data.Level || 1) * 5;
    char.gold += goldDrop;

    // 掉落物品（30%概率）
    if (Phaser.Math.Between(0, 100) < 30) {
      this.dropItem(monster);
    }

    this.updateUI();

    // 30秒后重生
    this.time.delayedCall(30000, () => {
      monster.hp = monster.maxHp;
      monster.alive = true;
      monster.x = monster.spawnX;
      monster.y = monster.spawnY;
      this.drawMonster(monster);
      if (monster.nameText) monster.nameText.setVisible(true);
      this.drawMonsterHpBar(monster);
    });
  }

  dropItem(monster) {
    const items = window.MIR.gameData?.items || [];
    if (items.length === 0) return;

    // 随机选择一个物品
    const item = items[Phaser.Math.Between(0, items.length - 1)];
    const char = window.MIR.character;

    // 添加到背包
    if (!char.inventory) char.inventory = [];
    const existing = char.inventory.find(i => i.itemId === item.ID);
    if (existing) {
      existing.count++;
    } else {
      char.inventory.push({
        itemId: item.ID,
        name: item.Name,
        count: 1,
        type: item.ItemType,
        quality: item.quality || 0,
      });
    }

    this.showSystemMessage(`获得: ${item.Name}`);
  }

  checkLevelUp() {
    const char = window.MIR.character;
    const expList = window.MIR.gameData?.expList || [];
    const maxLevel = expList.length;

    while (char.level < maxLevel && char.experience >= expList[char.level - 1]) {
      char.level++;
      char.experience -= expList[char.level - 2] || 0;

      // 升级属性提升
      const baseStats = window.MIR.gameData?.baseStats?.[char.class] || {};
      const perLevel = baseStats.perLevel || {};
      char.stats.MaxHP += (perLevel.MaxHP || 20);
      char.stats.MaxMP += (perLevel.MaxMP || 10);
      char.stats.HP = char.stats.MaxHP;
      char.stats.MP = char.stats.MaxMP;
      char.stats.MinDC += (perLevel.MinDC || 1);
      char.stats.MaxDC += (perLevel.MaxDC || 2);

      this.showSystemMessage(`恭喜升到 ${char.level} 级！`);
      this.updateUI();
    }
  }

  playerDeath() {
    this.showSystemMessage('你已阵亡！3秒后复活...');
    this.time.delayedCall(3000, () => {
      const char = window.MIR.character;
      char.stats.HP = char.stats.MaxHP;
      char.stats.MP = char.stats.MaxMP;
      char.x = 100;
      char.y = 100;
      this.player.x = 100 * GAME_CONFIG.TILE_SIZE;
      this.player.y = 100 * GAME_CONFIG.TILE_SIZE;
      this.player.targetX = this.player.x;
      this.player.targetY = this.player.y;
      this.updateUI();
      this.showSystemMessage('已复活在安全区');
    });
  }

  showDamageText(x, y, text, isCrit, color) {
    const dmgColor = color || (isCrit ? GAME_CONFIG.COLORS.CRITICAL : GAME_CONFIG.COLORS.DAMAGE);
    const fontSize = isCrit ? '20px' : '16px';

    const dmgText = this.add.text(x, y, String(text), {
      fontFamily: 'sans-serif',
      fontSize: fontSize,
      color: dmgColor,
      fontStyle: isCrit ? 'bold' : 'normal',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(50);

    this.tweens.add({
      targets: dmgText,
      y: y - 40,
      alpha: 0,
      duration: 1000,
      ease: 'Cubic.easeOut',
      onComplete: () => dmgText.destroy(),
    });
  }

  showSystemMessage(msg) {
    this.messageLog.push(msg);
    if (this.messageLog.length > 5) this.messageLog.shift();

    this.messageTexts.forEach((t, i) => {
      t.setText(this.messageLog[i] || '');
    });
  }

  useSkill(index) {
    if (index === 0) {
      // 普通攻击 - 攻击最近的怪物
      const nearest = this.monsters
        .filter(m => m.alive)
        .sort((a, b) => {
          const da = Phaser.Math.Distance.Between(this.player.x, this.player.y, a.x, a.y);
          const db = Phaser.Math.Distance.Between(this.player.x, this.player.y, b.x, b.y);
          return da - db;
        })[0];

      if (nearest) {
        this.attackMonster(nearest);
      }
    } else {
      this.showSystemMessage('技能尚未学习');
    }
  }

  updateUI() {
    const char = window.MIR.character;
    if (!char) return;

    const barW = 200;

    // HP
    const hpRatio = char.stats.HP / char.stats.MaxHP;
    this.hpBarFill.width = barW * hpRatio;
    this.hpText.setText(`${char.stats.HP}/${char.stats.MaxHP}`);

    // MP
    const mpRatio = char.stats.MP / char.stats.MaxMP;
    this.mpBarFill.width = barW * mpRatio;
    this.mpText.setText(`${char.stats.MP}/${char.stats.MaxMP}`);

    // EXP
    const expList = window.MIR.gameData?.expList || [];
    const currentLevelExp = expList[char.level - 1] || 100;
    const nextLevelExp = expList[char.level] || 200;
    const expProgress = (char.experience - currentLevelExp) / (nextLevelExp - currentLevelExp);
    this.expBarFill.width = barW * Math.max(0, Math.min(1, expProgress));

    // Level
    this.levelText.setText(`Lv.${char.level}`);

    // Gold
    this.goldText.setText(`金币: ${char.gold}`);

    // Coords
    const tileX = Math.floor(this.player.x / GAME_CONFIG.TILE_SIZE);
    const tileY = Math.floor(this.player.y / GAME_CONFIG.TILE_SIZE);
    this.coordText.setText(`(${tileX}, ${tileY})`);
  }

  drawMap() {
    if (!this.mapGraphics) return;
    this.mapGraphics.clear();

    const mapW = this.mapData.width || 100;
    const mapH = this.mapData.height || 100;
    const tileSize = GAME_CONFIG.TILE_SIZE;

    // 绘制地面（简化版 - 用颜色区分区域）
    for (let y = 0; y < Math.min(mapH, 100); y++) {
      for (let x = 0; x < Math.min(mapW, 100); x++) {
        // 简单的地面颜色
        const isSafe = (x < 20 && y < 20); // 安全区
        const color = isSafe ? 0x2E2E1E : 0x1A1A0F;
        this.mapGraphics.fillStyle(color, 1);
        this.mapGraphics.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);

        // 网格线
        this.mapGraphics.lineStyle(0.5, 0x333333, 0.3);
        this.mapGraphics.strokeRect(x * tileSize, y * tileSize, tileSize, tileSize);
      }
    }

    // 安全区标记
    this.mapGraphics.lineStyle(2, 0xC9A96E, 0.5);
    this.mapGraphics.strokeRect(0, 0, 20 * tileSize, 20 * tileSize);

    const safeText = this.add.text(10 * tileSize, 2 * tileSize, '安全区', {
      fontFamily: 'sans-serif',
      fontSize: '14px',
      color: '#C9A96E',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);
  }

  gameTick() {
    const now = this.time.now;

    // 处理移动
    let dx = 0, dy = 0;
    const speed = 4;

    // 键盘移动
    if (this.cursors.left.isDown || this.wasd.A.isDown) dx -= speed;
    if (this.cursors.right.isDown || this.wasd.D.isDown) dx += speed;
    if (this.cursors.up.isDown || this.wasd.W.isDown) dy -= speed;
    if (this.cursors.down.isDown || this.wasd.S.isDown) dy += speed;

    // 摇杆移动
    if (this.joystickActive && (Math.abs(this.moveDir.x) > 0.1 || Math.abs(this.moveDir.y) > 0.1)) {
      dx += this.moveDir.x * speed;
      dy += this.moveDir.y * speed;
    }

    // 点击移动
    if (dx === 0 && dy === 0) {
      const distToTarget = Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        this.player.targetX, this.player.targetY
      );
      if (distToTarget > 5) {
        const angle = Math.atan2(this.player.targetY - this.player.y, this.player.targetX - this.player.x);
        dx = Math.cos(angle) * speed;
        dy = Math.sin(angle) * speed;
      } else if (this.player.attackTarget) {
        // 到达目标位置，攻击
        if (this.player.attackTarget.alive) {
          this.attackMonster(this.player.attackTarget);
        }
        this.player.attackTarget = null;
      }
    }

    // 应用移动
    if (dx !== 0 || dy !== 0) {
      const newX = this.player.x + dx;
      const newY = this.player.y + dy;

      // 边界检查
      const mapW = (this.mapData.width || 100) * GAME_CONFIG.TILE_SIZE;
      const mapH = (this.mapData.height || 100) * GAME_CONFIG.TILE_SIZE;

      this.player.x = Phaser.Math.Clamp(newX, 0, mapW);
      this.player.y = Phaser.Math.Clamp(newY, 0, mapH);

      this.player.graphics.setPosition(this.player.x, this.player.y);
      this.player.nameText.setPosition(this.player.x, this.player.y - 40);

      // 更新角色数据
      const char = window.MIR.character;
      char.x = Math.floor(this.player.x / GAME_CONFIG.TILE_SIZE);
      char.y = Math.floor(this.player.y / GAME_CONFIG.TILE_SIZE);
    }

    // 怪物AI
    this.monsters.forEach(monster => {
      if (!monster.alive) return;

      const distToPlayer = Phaser.Math.Distance.Between(monster.x, monster.y, this.player.x, this.player.y);

      // 仇恨范围
      if (distToPlayer < monster.aggroRange && monster.state === 'idle') {
        monster.state = 'chase';
      }

      if (monster.state === 'chase') {
        // 追击玩家
        const angle = Math.atan2(this.player.y - monster.y, this.player.x - monster.x);
        monster.x += Math.cos(angle) * 2;
        monster.y += Math.sin(angle) * 2;
        monster.graphics.setPosition(monster.x, monster.y);
        if (monster.nameText) monster.nameText.setPosition(monster.x, monster.y - 35);

        // 攻击距离
        if (distToPlayer < GAME_CONFIG.TILE_SIZE) {
          monster.state = 'attack';
          this.monsterAttack(monster);
        }

        // 脱离仇恨
        if (distToPlayer > monster.aggroRange * 2) {
          monster.state = 'return';
        }
      } else if (monster.state === 'return') {
        // 返回出生点
        const angle = Math.atan2(monster.spawnY - monster.y, monster.spawnX - monster.x);
        monster.x += Math.cos(angle) * 2;
        monster.y += Math.sin(angle) * 2;
        monster.graphics.setPosition(monster.x, monster.y);
        if (monster.nameText) monster.nameText.setPosition(monster.x, monster.y - 35);

        if (Phaser.Math.Distance.Between(monster.x, monster.y, monster.spawnX, monster.spawnY) < 10) {
          monster.state = 'idle';
        }
      } else if (monster.state === 'idle') {
        // 随机巡逻
        monster.moveTimer++;
        if (monster.moveTimer > 60) {
          monster.moveTimer = 0;
          if (Phaser.Math.Between(0, 100) < 30) {
            const patrolX = monster.spawnX + Phaser.Math.Between(-3, 3) * GAME_CONFIG.TILE_SIZE;
            const patrolY = monster.spawnY + Phaser.Math.Between(-3, 3) * GAME_CONFIG.TILE_SIZE;
            monster.targetX = patrolX;
            monster.targetY = patrolY;
          }
        }
        // 移动到目标
        if (Math.abs(monster.x - monster.targetX) > 5 || Math.abs(monster.y - monster.targetY) > 5) {
          const angle = Math.atan2(monster.targetY - monster.y, monster.targetX - monster.x);
          monster.x += Math.cos(angle) * 1;
          monster.y += Math.sin(angle) * 1;
          monster.graphics.setPosition(monster.x, monster.y);
          if (monster.nameText) monster.nameText.setPosition(monster.x, monster.y - 35);
        }
      }

      this.drawMonsterHpBar(monster);
    });

    // 自动攻击（空格键）
    if (this.attackKey.isDown && now - this.lastMoveTime > 300) {
      this.lastMoveTime = now;
      this.useSkill(0);
    }

    // 更新UI
    this.updateUI();
    this.drawMiniMap();
  }

  shutdown() {
    if (this.ws) {
      this.ws.close();
    }
    if (this.tickInterval) {
      this.tickInterval.remove();
    }
  }
}
