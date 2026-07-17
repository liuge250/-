// ============================================================
// GameScene - 游戏主场景 (完整实现)
// ============================================================
class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  init() {
    this.char = window.gameData.character;
    this.tileSize = 48;
    this.mapWidth = 60;
    this.mapHeight = 60;
    this.mapData = [];
    this.monsters = [];
    this.monsterById = {};
    this.messages = [];
    this.targetMonster = null;
    this.lastAttackTime = 0;
    this.attackCooldown = 600;
    this.ws = null;
    this.cursors = null;
    this.moveDir = { x: 0, y: 0 };
    this.moveTarget = null;
    this.playerX = 30;
    this.playerY = 30;
    this.playerSpeed = 5;
    this.mapId = '0';
    this.mapName = '未知地图';
    this.hpBar = null;
    this.mpBar = null;
    this.expBar = null;
    this.hpText = null;
    this.mpText = null;
    this.expText = null;
    this.mmPlayer = null;
    this.mmMonsters = [];
    this.msgTexts = [];
    this.joyHandle = null;
    this.player = null;
    this.wallGraphics = null;
    this.groundGraphics = null;
  }

  async create() {
    const { width, height } = this.scale;

    // Show loading
    const loadText = this.add.text(width / 2, height / 2, '正在进入地图...', {
      fontSize: '20px', fill: '#FFD700',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(999);

    // Load map data from server
    await this.loadMapFromServer();

    // Create the game world
    this.createMap();
    this.createPlayer();
    this.createUI();
    this.setupInput();

    // Connect WebSocket
    this.connectWebSocket();

    // Camera
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setBounds(0, 0, this.mapWidth * this.tileSize, this.mapHeight * this.tileSize);

    // Remove loading text
    loadText.destroy();

    this.addMessage(`欢迎来到${this.mapName}!`);
    this.addMessage(`Lv.${this.char.level} ${this.char.name} 准备战斗!`);
  }

  async loadMapFromServer() {
    try {
      // Get maps list - server returns array directly
      const mapsResp = await fetch(API_BASE + '/api/v1/maps');
      const maps = await mapsResp.json();

      // Use character's mapId if available
      let targetMapId = this.char.mapId || '3';
      const foundMap = maps.find(m => m.id === targetMapId) || maps.find(m => m.id === '0') || maps[0];
      if (foundMap) {
        this.mapId = foundMap.id;
        this.mapName = foundMap.title || '未知地图';
      }

      // Try to get terrain data
      try {
        const terrainResp = await fetch(API_BASE + `/api/v1/maps/${this.mapId}/terrain`);
        if (terrainResp.ok) {
          const terrainData = await terrainResp.json();
          this.mapWidth = terrainData.width;
          this.mapHeight = terrainData.height;
          this.mapData = [];
          for (let y = 0; y < this.mapHeight; y++) {
            this.mapData[y] = [];
            for (let x = 0; x < this.mapWidth; x++) {
              this.mapData[y][x] = terrainData.tiles[y * this.mapWidth + x] || 0;
            }
          }
          // Set player spawn to center walkable area
          this.findSpawnPoint();
          return;
        }
      } catch (e) {
        console.warn('Terrain load failed, using generated map');
      }

      // Fallback: generate map
      this.mapData = this.generateMapData(this.mapId);
      this.findSpawnPoint();
    } catch (e) {
      console.error('Map load error:', e);
      this.mapData = this.generateMapData('0');
      this.findSpawnPoint();
    }
  }

  findSpawnPoint() {
    // Use character position if valid
    if (this.char.x && this.char.y &&
        this.char.x >= 0 && this.char.x < this.mapWidth &&
        this.char.y >= 0 && this.char.y < this.mapHeight &&
        this.mapData[this.char.y] && this.mapData[this.char.y][this.char.x] === 0) {
      this.playerX = this.char.x;
      this.playerY = this.char.y;
      return;
    }
    // Find center walkable
    const cx = Math.floor(this.mapWidth / 2);
    const cy = Math.floor(this.mapHeight / 2);
    for (let r = 0; r < 30; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          const tx = cx + dx;
          const ty = cy + dy;
          if (tx >= 0 && tx < this.mapWidth && ty >= 0 && ty < this.mapHeight &&
              this.mapData[ty] && this.mapData[ty][tx] === 0) {
            this.playerX = tx;
            this.playerY = ty;
            return;
          }
        }
      }
    }
    this.playerX = cx;
    this.playerY = cy;
  }

  generateMapData(mapId) {
    const w = this.mapWidth;
    const h = this.mapHeight;
    const data = [];
    const seed = parseInt(mapId) || 0;
    let s = seed + 1;
    const rng = () => { s = (s * 1664525 + 1013904223) & 0xFFFFFFFF; return (s >>> 0) / 0xFFFFFFFF; };

    for (let y = 0; y < h; y++) {
      data[y] = [];
      for (let x = 0; x < w; x++) {
        if (x === 0 || y === 0 || x === w - 1 || y === h - 1) {
          data[y][x] = 1;
        } else if (rng() < 0.05) {
          data[y][x] = 1;
        } else if (rng() < 0.07) {
          data[y][x] = 2;
        } else {
          data[y][x] = 0;
        }
      }
    }
    // Clear spawn area
    const cx = Math.floor(w / 2);
    const cy = Math.floor(h / 2);
    for (let dy = -3; dy <= 3; dy++)
      for (let dx = -3; dx <= 3; dx++)
        if (cy+dy >= 0 && cy+dy < h && cx+dx >= 0 && cx+dx < w) data[cy+dy][cx+dx] = 0;
    return data;
  }

  createMap() {
    const ts = this.tileSize;
    const w = this.mapWidth;
    const h = this.mapHeight;

    const mapIdNum = parseInt(this.mapId) || 0;
    let groundColor, wallColor, decoColor;

    if (mapIdNum >= 100 && mapIdNum < 200) {
      groundColor = 0x2a2a3a; wallColor = 0x3a3a4a; decoColor = 0x4a4a5a;
    } else if (mapIdNum >= 300 && mapIdNum < 400) {
      groundColor = 0x5a4a2a; wallColor = 0x6a5a3a; decoColor = 0x7a6a4a;
    } else {
      groundColor = 0x3a5a2a; wallColor = 0x4a3a2a; decoColor = 0x2a4a1a;
    }

    this.groundGraphics = this.add.graphics();
    this.wallGraphics = this.add.graphics();

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const px = x * ts;
        const py = y * ts;
        const tile = this.mapData[y][x];

        if (tile === 0) {
          const shade = ((x + y) % 2 === 0) ? groundColor : Phaser.Display.Color.GetColor(
            Math.max(0, ((groundColor >> 16) & 0xFF) - 8),
            Math.max(0, ((groundColor >> 8) & 0xFF) - 8),
            Math.max(0, (groundColor & 0xFF) - 8)
          );
          this.groundGraphics.fillStyle(shade, 1);
          this.groundGraphics.fillRect(px, py, ts, ts);
        } else if (tile === 1) {
          this.wallGraphics.fillStyle(wallColor, 1);
          this.wallGraphics.fillRect(px, py, ts, ts);
          this.wallGraphics.lineStyle(1, 0x000000, 0.3);
          this.wallGraphics.strokeRect(px, py, ts, ts);
        } else if (tile === 2) {
          this.groundGraphics.fillStyle(groundColor, 1);
          this.groundGraphics.fillRect(px, py, ts, ts);
          this.wallGraphics.fillStyle(decoColor, 0.8);
          this.wallGraphics.fillCircle(px + ts / 2, py + ts / 2, ts / 3);
        }
      }
    }

    this.wallGraphics.lineStyle(3, 0xFFD700, 0.5);
    this.wallGraphics.strokeRect(0, 0, w * ts, h * ts);
  }

  createPlayer() {
    const ts = this.tileSize;
    const classColors = { warrior: 0xCC3333, wizard: 0x3333CC, taoist: 0x33CC33 };
    const color = classColors[this.char.class] || 0xFFD700;

    this.player = this.add.container(this.playerX * ts + ts / 2, this.playerY * ts + ts / 2);

    const body = this.add.rectangle(0, 0, ts * 0.7, ts * 0.7, color, 1)
      .setStrokeStyle(2, 0xFFD700);
    this.player.add(body);

    const nameText = this.add.text(0, -ts * 0.6, this.char.name, {
      fontSize: '12px', fill: '#FFD700', fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.player.add(nameText);

    const levelText = this.add.text(0, -ts * 0.4, `Lv.${this.char.level}`, {
      fontSize: '10px', fill: '#ffffff',
    }).setOrigin(0.5);
    this.player.add(levelText);

    // Spawn monsters around player
    this.spawnLocalMonsters();
  }

  spawnLocalMonsters() {
    const ts = this.tileSize;
    this.monsters = [];
    this.monsterById = {};

    const count = Math.min(25, Math.max(8, Math.floor(this.mapWidth * this.mapHeight / 500)));

    for (let i = 0; i < count; i++) {
      let mx, my, attempts = 0;
      do {
        mx = Math.floor(Math.random() * (this.mapWidth - 4)) + 2;
        my = Math.floor(Math.random() * (this.mapHeight - 4)) + 2;
        attempts++;
      } while ((this.mapData[my]?.[mx] !== 0 || (Math.abs(mx - this.playerX) < 5 && Math.abs(my - this.playerY) < 5)) && attempts < 50);

      if (attempts >= 50) continue;

      const monsterTypes = [
        { name: '鸡', hp: 20, atk: 2, def: 0, exp: 5, color: 0xCCCC00, size: 0.4 },
        { name: '鹿', hp: 40, atk: 5, def: 2, exp: 10, color: 0xAA8844, size: 0.5 },
        { name: '狼', hp: 80, atk: 15, def: 5, exp: 25, color: 0x666666, size: 0.6 },
        { name: '蜘蛛', hp: 60, atk: 12, def: 3, exp: 20, color: 0x333333, size: 0.5 },
        { name: '半兽人', hp: 150, atk: 25, def: 10, exp: 50, color: 0x44AA44, size: 0.7 },
        { name: '骷髅', hp: 120, atk: 20, def: 8, exp: 40, color: 0xCCCCAA, size: 0.65 },
        { name: '沃玛卫士', hp: 300, atk: 40, def: 20, exp: 100, color: 0x8844AA, size: 0.8 },
      ];

      const maxIdx = Math.min(monsterTypes.length - 1, Math.floor(this.char.level / 3) + 2);
      const type = monsterTypes[Math.floor(Math.random() * (maxIdx + 1))];
      const mId = `local_m_${i}_${Date.now()}`;

      const container = this.add.container(mx * ts + ts / 2, my * ts + ts / 2);

      const body = this.add.rectangle(0, 0, ts * type.size, ts * type.size, type.color, 1)
        .setStrokeStyle(1, 0x000000);
      container.add(body);

      const nameText = this.add.text(0, -ts * 0.5, type.name, {
        fontSize: '10px', fill: '#ff8888',
      }).setOrigin(0.5);
      container.add(nameText);

      // HP bar
      const hpBg = this.add.rectangle(0, -ts * 0.35, ts * 0.6, 4, 0x333333, 1);
      container.add(hpBg);
      const hpBar = this.add.rectangle(-ts * 0.3, -ts * 0.35, ts * 0.6, 4, 0xCC0000, 1).setOrigin(0, 0.5);
      container.add(hpBar);

      const monster = {
        id: mId,
        container, body, hpBar,
        x: mx, y: my,
        homeX: mx, homeY: my,
        type,
        hp: type.hp, maxHp: type.hp,
        state: 'idle',
        lastMove: 0, lastAttack: 0,
        alive: true,
      };

      this.monsters.push(monster);
      this.monsterById[mId] = monster;
    }
  }

  createUI() {
    const { width, height } = this.scale;
    const char = this.char;

    // === Top Status Bar ===
    const topBar = this.add.container(0, 0).setScrollFactor(0).setDepth(100);
    topBar.add(this.add.rectangle(width / 2, 25, width, 50, 0x000000, 0.7));

    const classNames = { warrior: '战士', wizard: '法师', taoist: '道士' };
    topBar.add(this.add.text(10, 8, `${char.name}  Lv.${char.level}  ${classNames[char.class] || ''}`, {
      fontSize: '14px', fill: '#FFD700', fontFamily: 'monospace',
    }));

    const barW = Math.min(140, width * 0.22);
    const barH = 14;
    const barX = 10;

    // HP
    topBar.add(this.add.rectangle(barX, 30, barW, barH, 0x333333, 1).setOrigin(0, 0.5));
    this.hpBar = this.add.rectangle(barX, 30, barW * (char.hp / char.maxHp), barH, 0xCC0000, 1).setOrigin(0, 0.5);
    topBar.add(this.hpBar);
    this.hpText = this.add.text(barX + barW + 5, 30, `${char.hp}/${char.maxHp}`, {
      fontSize: '11px', fill: '#ff6666',
    }).setOrigin(0, 0.5);
    topBar.add(this.hpText);

    // MP
    topBar.add(this.add.rectangle(barX, 48, barW, barH, 0x333333, 1).setOrigin(0, 0.5));
    this.mpBar = this.add.rectangle(barX, 48, barW * (char.mp / char.maxMp), barH, 0x3366CC, 1).setOrigin(0, 0.5);
    topBar.add(this.mpBar);
    this.mpText = this.add.text(barX + barW + 5, 48, `${char.mp}/${char.maxMp}`, {
      fontSize: '11px', fill: '#6699ff',
    }).setOrigin(0, 0.5);
    topBar.add(this.mpText);

    // EXP
    const expBarX = barX + barW + 80;
    topBar.add(this.add.text(expBarX, 8, 'EXP', { fontSize: '10px', fill: '#aaaaaa' }));
    topBar.add(this.add.rectangle(expBarX, 25, barW, 10, 0x333333, 1).setOrigin(0, 0.5));
    const expNeeded = char.level * 100;
    this.expBar = this.add.rectangle(expBarX, 25, barW * Math.min(1, char.exp / expNeeded), 10, 0xCCCC00, 1).setOrigin(0, 0.5);
    topBar.add(this.expBar);
    this.expText = this.add.text(expBarX + barW + 5, 25, `${char.exp}/${expNeeded}`, {
      fontSize: '10px', fill: '#CCCC00',
    }).setOrigin(0, 0.5);
    topBar.add(this.expText);

    // Gold
    topBar.add(this.add.text(width - 120, 8, `金币: ${char.gold || 0}`, {
      fontSize: '12px', fill: '#FFD700',
    }));

    // === Minimap ===
    const mmSize = Math.min(110, width * 0.18);
    const mmX = width - mmSize - 10;
    const mmY = 10;

    this.add.rectangle(mmX + mmSize / 2, mmY + mmSize / 2, mmSize, mmSize, 0x000000, 0.8)
      .setScrollFactor(0).setDepth(100).setStrokeStyle(1, 0xFFD700);
    this.add.text(mmX + mmSize / 2, mmY - 2, this.mapName, {
      fontSize: '10px', fill: '#FFD700',
    }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(100);

    this.mmPlayer = this.add.circle(mmX + mmSize / 2, mmY + mmSize / 2, 3, 0x00FF00)
      .setScrollFactor(0).setDepth(101);
    this.mmMonsters = [];
    this.mmSize = mmSize;
    this.mmX = mmX;
    this.mmY = mmY;

    // === Skill Bar ===
    const skillBar = this.add.container(0, 0).setScrollFactor(0).setDepth(100);
    const skillY = height - 50;
    const skillSize = 44;
    const skills = [
      { name: '普攻', key: 'Space', color: 0xCC3333 },
      { name: '技能1', key: '1', color: 0x3333CC },
      { name: '技能2', key: '2', color: 0x33CC33 },
      { name: '药水', key: 'Q', color: 0xCC33CC },
    ];
    const skillStartX = width / 2 - (skills.length * (skillSize + 6)) / 2;
    skills.forEach((skill, i) => {
      const sx = skillStartX + i * (skillSize + 6) + skillSize / 2;
      skillBar.add(this.add.rectangle(sx, skillY, skillSize, skillSize, skill.color, 0.6)
        .setStrokeStyle(2, 0xFFD700));
      skillBar.add(this.add.text(sx, skillY - 5, skill.name, {
        fontSize: '10px', fill: '#ffffff',
      }).setOrigin(0.5));
      skillBar.add(this.add.text(sx, skillY + 12, `[${skill.key}]`, {
        fontSize: '9px', fill: '#aaaaaa',
      }).setOrigin(0.5));
    });

    // === Message Log ===
    this.msgContainer = this.add.container(0, 0).setScrollFactor(0).setDepth(100);
    this.msgTexts = [];
    const msgX = 10;
    const msgY = height - 140;
    for (let i = 0; i < 5; i++) {
      const t = this.add.text(msgX, msgY + i * 18, '', {
        fontSize: '12px', fill: '#cccccc', fontFamily: 'monospace',
        backgroundColor: 'rgba(0,0,0,0.5)', padding: { x: 4, y: 2 },
      });
      this.msgContainer.add(t);
      this.msgTexts.push(t);
    }

    // === Virtual Joystick ===
    this.createJoystick();
  }

  createJoystick() {
    const { width, height } = this.scale;
    const joyX = 80;
    const joyY = height - 100;
    const joyRadius = 50;

    const joyBase = this.add.circle(joyX, joyY, joyRadius, 0x333333, 0.5)
      .setScrollFactor(0).setDepth(100).setStrokeStyle(2, 0x666666);

    this.joyHandle = this.add.circle(joyX, joyY, 20, 0xFFD700, 0.7)
      .setScrollFactor(0).setDepth(101);

    let joyActive = false;
    joyBase.setInteractive();
    this.joyHandle.setInteractive({ draggable: true });

    this.joyHandle.on('dragstart', () => { joyActive = true; });
    this.joyHandle.on('dragend', () => {
      joyActive = false;
      this.joyHandle.setPosition(joyX, joyY);
      this.moveDir = { x: 0, y: 0 };
    });
    this.joyHandle.on('drag', (_pointer, dragX, dragY) => {
      const dx = dragX - joyX;
      const dy = dragY - joyY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxDist = joyRadius - 10;
      if (dist > maxDist) {
        const angle = Math.atan2(dy, dx);
        this.joyHandle.setPosition(joyX + Math.cos(angle) * maxDist, joyY + Math.sin(angle) * maxDist);
        this.moveDir = { x: Math.cos(angle), y: Math.sin(angle) };
      } else if (dist > 5) {
        this.joyHandle.setPosition(dragX, dragY);
        this.moveDir = { x: dx / maxDist, y: dy / maxDist };
      } else {
        this.joyHandle.setPosition(joyX, joyY);
        this.moveDir = { x: 0, y: 0 };
      }
    });

    // Attack button
    const atkBtn = this.add.circle(width - 70, height - 100, 35, 0xCC3333, 0.7)
      .setScrollFactor(0).setDepth(100).setStrokeStyle(2, 0xFFD700)
      .setInteractive({ useHandCursor: true });
    this.add.text(width - 70, height - 100, '攻击', {
      fontSize: '14px', fill: '#ffffff',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(101);
    atkBtn.on('pointerdown', () => this.doAttack());
  }

  setupInput() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,Q,1,2,3,Space');

    this.input.on('pointerdown', (pointer) => {
      if (pointer.y < 60 || pointer.y > this.scale.height - 70) return;
      if (pointer.x > this.scale.width - 140 && pointer.y < 140) return;

      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const tileX = Math.floor(worldPoint.x / this.tileSize);
      const tileY = Math.floor(worldPoint.y / this.tileSize);

      // Check if clicked on a monster
      const clickedMonster = this.monsters.find(m =>
        m.alive && Math.abs(m.x - tileX) <= 1 && Math.abs(m.y - tileY) <= 1
      );

      if (clickedMonster) {
        this.targetMonster = clickedMonster;
        this.addMessage(`锁定: ${clickedMonster.type.name}`);
      } else if (tileX >= 0 && tileX < this.mapWidth && tileY >= 0 && tileY < this.mapHeight) {
        this.targetMonster = null;
        this.moveTarget = { x: tileX, y: tileY };
      }
    });
  }

  connectWebSocket() {
    try {
      // 使用当前页面的origin，确保WebSocket和页面在同一域名
      const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${location.host}/ws`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[WS] Connected');
        this.ws.send(JSON.stringify({
          type: 'join',
          token: window.gameData.token,
          characterId: this.char.id,
          mapId: this.mapId,
        }));
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleServerMessage(msg);
        } catch (e) { /* ignore */ }
      };

      this.ws.onclose = () => {
        console.log('[WS] Disconnected, reconnecting...');
        this.time.delayedCall(5000, () => {
          if (this.scene.isActive()) this.connectWebSocket();
        });
      };

      this.ws.onerror = () => { /* ignore */ };
    } catch (e) {
      console.error('[WS] Error:', e);
    }
  }

  handleServerMessage(msg) {
    switch (msg.type) {
      case 'gameState':
        if (msg.player) {
          this.char.hp = msg.player.hp;
          this.char.maxHp = msg.player.maxHp;
          this.char.mp = msg.player.mp;
          this.char.maxMp = msg.player.maxMp;
          this.char.level = msg.player.level;
          this.char.exp = msg.player.exp;
          this.updateUI();
        }
        if (msg.map) {
          this.mapId = msg.map.id;
          this.mapName = msg.map.name || this.mapName;
        }
        break;

      case 'damage':
        this.showDamageText(msg.x, msg.y, msg.damage, msg.isCrit);
        break;

      case 'miss':
        this.showDamageText(msg.x, msg.y, 0, false, true);
        break;

      case 'playerHit':
        this.char.hp = Math.max(0, msg.hp);
        this.showDamageText(this.playerX, this.playerY, msg.damage, false, false, true);
        this.updateUI();
        this.player.setAlpha(0.5);
        this.time.delayedCall(200, () => { if (this.player) this.player.setAlpha(1); });
        break;

      case 'playerDead':
        this.char.hp = msg.hp;
        this.addMessage(msg.message || '你已阵亡!');
        this.updateUI();
        break;

      case 'monsterDead':
        this.char.exp = msg.expTotal || (this.char.exp + msg.exp);
        this.char.level = msg.level;
        this.char.hp = msg.hp;
        this.char.maxHp = msg.maxHp;
        this.char.gold = (this.char.gold || 0) + (msg.gold || 0);
        this.updateUI();
        if (msg.leveledUp) {
          this.addMessage(`恭喜! 升级到 Lv.${msg.level}!`);
          if (this.player) {
            this.tweens.add({ targets: this.player, scaleX: 1.3, scaleY: 1.3, duration: 300, yoyo: true, repeat: 2 });
          }
        }
        break;

      case 'monsterUpdate':
        // Update monster HP from server
        const sm = this.monsterById[msg.targetId];
        if (sm) {
          sm.hp = msg.hp;
          sm.maxHp = msg.maxHp;
          if (sm.hp <= 0 && sm.alive) {
            this.killMonsterLocal(sm);
          }
        }
        break;

      case 'systemMsg':
        this.addMessage(msg.message || '');
        break;

      case 'error':
        this.addMessage('错误: ' + (msg.message || '未知错误'));
        break;
    }
  }

  update(time, delta) {
    if (!this.player) return;
    const dt = delta / 1000;
    const ts = this.tileSize;

    // === Player Movement ===
    let dx = 0, dy = 0;
    if (this.cursors.left.isDown || (this.keys && this.keys.A.isDown)) dx -= 1;
    if (this.cursors.right.isDown || (this.keys && this.keys.D.isDown)) dx += 1;
    if (this.cursors.up.isDown || (this.keys && this.keys.W.isDown)) dy -= 1;
    if (this.cursors.down.isDown || (this.keys && this.keys.S.isDown)) dy += 1;

    if (Math.abs(this.moveDir.x) > 0.1 || Math.abs(this.moveDir.y) > 0.1) {
      dx = this.moveDir.x;
      dy = this.moveDir.y;
    }

    if (this.moveTarget && dx === 0 && dy === 0) {
      const tdx = this.moveTarget.x - this.playerX;
      const tdy = this.moveTarget.y - this.playerY;
      const dist = Math.sqrt(tdx * tdx + tdy * tdy);
      if (dist > 0.5) { dx = tdx / dist; dy = tdy / dist; }
      else this.moveTarget = null;
    }

    // Follow target monster
    if (this.targetMonster && this.targetMonster.alive && dx === 0 && dy === 0) {
      const tdx = this.targetMonster.x - this.playerX;
      const tdy = this.targetMonster.y - this.playerY;
      const dist = Math.sqrt(tdx * tdx + tdy * tdy);
      if (dist > 1.5) { dx = tdx / dist; dy = tdy / dist; }
      else this.doAttack();
    }

    if (dx !== 0 || dy !== 0) {
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0) { dx /= len; dy /= len; }
      const speed = this.playerSpeed * dt;
      const newX = this.playerX + dx * speed;
      const newY = this.playerY + dy * speed;

      const checkX = Math.floor(newX + (dx > 0 ? 0.3 : -0.3));
      const checkY = Math.floor(newY + (dy > 0 ? 0.3 : -0.3));

      if (checkX >= 0 && checkX < this.mapWidth && this.mapData[Math.floor(this.playerY)]?.[checkX] === 0) {
        this.playerX = newX;
      }
      if (checkY >= 0 && checkY < this.mapHeight && this.mapData[checkY]?.[Math.floor(this.playerX)] === 0) {
        this.playerY = newY;
      }

      this.player.setPosition(this.playerX * ts + ts / 2, this.playerY * ts + ts / 2);

      // Notify server
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'move', x: Math.floor(this.playerX), y: Math.floor(this.playerY) }));
      }
    }

    // === Monster AI ===
    this.updateMonsters(time, dt);

    // === Minimap ===
    this.updateMinimap();

    // === Auto-attack (Space) ===
    if (this.keys && this.keys.Space.isDown) this.doAttack();
  }

  updateMonsters(time, dt) {
    const ts = this.tileSize;

    for (const monster of this.monsters) {
      if (!monster.alive) continue;

      const distToPlayer = Math.sqrt((monster.x - this.playerX) ** 2 + (monster.y - this.playerY) ** 2);

      if (distToPlayer < 8 && monster.state === 'idle') monster.state = 'chase';
      else if (distToPlayer > 12 && monster.state === 'chase') monster.state = 'idle';

      switch (monster.state) {
        case 'idle':
          if (time - monster.lastMove > 2000 + Math.random() * 3000) {
            monster.lastMove = time;
            const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
            const dir = dirs[Math.floor(Math.random() * 4)];
            const nx = monster.x + dir[0];
            const ny = monster.y + dir[1];
            if (Math.abs(nx - monster.homeX) < 5 && Math.abs(ny - monster.homeY) < 5 &&
                nx >= 0 && nx < this.mapWidth && ny >= 0 && ny < this.mapHeight &&
                this.mapData[ny]?.[nx] === 0) {
              monster.x = nx; monster.y = ny;
            }
          }
          break;

        case 'chase':
          if (time - monster.lastMove > 500) {
            monster.lastMove = time;
            const cdx = this.playerX - monster.x;
            const cdy = this.playerY - monster.y;
            if (Math.abs(cdx) > Math.abs(cdy)) {
              const nx = monster.x + Math.sign(cdx);
              if (nx >= 0 && nx < this.mapWidth && this.mapData[monster.y]?.[nx] === 0) monster.x = nx;
            } else {
              const ny = monster.y + Math.sign(cdy);
              if (ny >= 0 && ny < this.mapHeight && this.mapData[ny]?.[monster.x] === 0) monster.y = ny;
            }
            if (distToPlayer < 1.5 && time - monster.lastAttack > 1500) {
              monster.lastAttack = time;
              const dmg = Math.max(1, monster.type.atk - (this.char.stats ? this.char.stats.def : this.char.AC || 5));
              this.char.hp = Math.max(0, this.char.hp - dmg);
              this.showDamageText(this.playerX, this.playerY, dmg, false, false, true);
              this.updateUI();
              this.player.setAlpha(0.5);
              this.time.delayedCall(200, () => { if (this.player) this.player.setAlpha(1); });
              if (this.char.hp <= 0) {
                this.addMessage('你已阵亡! 正在复活...');
                this.time.delayedCall(3000, () => {
                  this.char.hp = this.char.maxHp;
                  this.playerX = Math.floor(this.mapWidth / 2);
                  this.playerY = Math.floor(this.mapHeight / 2);
                  this.player.setPosition(this.playerX * ts + ts / 2, this.playerY * ts + ts / 2);
                  this.updateUI();
                  this.addMessage('已复活');
                });
              }
            }
          }
          break;
      }

      monster.container.setPosition(monster.x * ts + ts / 2, monster.y * ts + ts / 2);
      monster.hpBar.width = ts * 0.6 * (monster.hp / monster.maxHp);
    }
  }

  doAttack() {
    const now = this.time.now;
    if (now - this.lastAttackTime < this.attackCooldown) return;
    this.lastAttackTime = now;

    let target = this.targetMonster;
    if (!target || !target.alive) {
      target = this.monsters.filter(m => m.alive)
        .sort((a, b) => ((a.x - this.playerX) ** 2 + (a.y - this.playerY) ** 2) - ((b.x - this.playerX) ** 2 + (b.y - this.playerY) ** 2))[0];
    }
    if (!target) { this.addMessage('附近没有怪物'); return; }

    const dist = Math.sqrt((target.x - this.playerX) ** 2 + (target.y - this.playerY) ** 2);
    if (dist > 2) { this.targetMonster = target; this.addMessage(`靠近 ${target.type.name}`); return; }

    const playerAtk = this.char.stats ? this.char.stats.atk : (this.char.DC || this.char.level * 3 + 10);
    const monsterDef = target.type.def;
    let damage = Math.max(1, playerAtk - monsterDef + Math.floor(Math.random() * 5));
    const isCrit = Math.random() < 0.15;
    if (isCrit) damage = Math.floor(damage * 1.5);

    if (Math.random() > 0.85 + this.char.level * 0.01) {
      this.addMessage(`攻击 ${target.type.name} Miss!`);
      this.showDamageText(target.x, target.y, 0, false, true);
      return;
    }

    target.hp -= damage;
    this.showDamageText(target.x, target.y, damage, isCrit);
    this.addMessage(`攻击 ${target.type.name} -${damage}${isCrit ? ' [暴击!]' : ''}`);
    target.state = 'chase';

    // Send to server
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'attack', targetId: target.id }));
    }

    if (target.hp <= 0) this.killMonsterLocal(target);
  }

  killMonsterLocal(monster) {
    monster.alive = false;
    monster.state = 'dead';

    this.tweens.add({
      targets: monster.container, alpha: 0, duration: 500,
      onComplete: () => {
        monster.container.setVisible(false);
        this.time.delayedCall(30000, () => {
          monster.hp = monster.maxHp;
          monster.alive = true;
          monster.state = 'idle';
          monster.x = monster.homeX;
          monster.y = monster.homeY;
          monster.container.setAlpha(1).setVisible(true);
        });
      },
    });

    const exp = monster.type.exp;
    this.char.exp += exp;
    this.addMessage(`击杀 ${monster.type.name}! +${exp}EXP`);
    this.checkLevelUp();

    if (Math.random() < 0.3) this.dropItem(monster.x, monster.y);
    if (this.targetMonster === monster) this.targetMonster = null;
    this.updateUI();
  }

  checkLevelUp() {
    const expNeeded = this.char.level * 100;
    while (this.char.exp >= expNeeded) {
      this.char.exp -= expNeeded;
      this.char.level++;
      this.char.maxHp += 20;
      this.char.hp = this.char.maxHp;
      this.char.maxMp += 10;
      this.char.mp = this.char.maxMp;
      if (this.char.stats) { this.char.stats.atk += 3; this.char.stats.def += 2; }
      if (this.char.DC) { this.char.DC += 3; this.char.AC = (this.char.AC || 0) + 2; }
      this.addMessage(`升级! Lv.${this.char.level}!`);
      if (this.player) {
        this.tweens.add({ targets: this.player, scaleX: 1.3, scaleY: 1.3, duration: 300, yoyo: true, repeat: 2 });
      }
    }
  }

  showDamageText(tileX, tileY, damage, isCrit, isMiss, isPlayer) {
    const ts = this.tileSize;
    const x = tileX * ts + ts / 2;
    const y = tileY * ts;
    let text, color, size;
    if (isMiss) { text = 'Miss'; color = '#aaaaaa'; size = '14px'; }
    else if (isCrit) { text = `-${damage}!`; color = '#FF4444'; size = '22px'; }
    else if (isPlayer) { text = `-${damage}`; color = '#FF8800'; size = '16px'; }
    else { text = `-${damage}`; color = '#FFD700'; size = '16px'; }

    const dmgText = this.add.text(x, y, text, {
      fontSize: size, fill: color, fontFamily: 'monospace', fontStyle: isCrit ? 'bold' : 'normal',
    }).setOrigin(0.5).setDepth(200);

    this.tweens.add({ targets: dmgText, y: y - 40, alpha: 0, duration: 1000, onComplete: () => dmgText.destroy() });
  }

  dropItem(x, y) {
    const items = [
      { name: '金创药', color: 0xFF6666 }, { name: '魔法药', color: 0x6666FF },
      { name: '金币', color: 0xFFD700 }, { name: '铁剑', color: 0xCCCCCC },
    ];
    const item = items[Math.floor(Math.random() * items.length)];
    const ts = this.tileSize;
    const gfx = this.add.rectangle(x * ts + ts / 2, y * ts + ts / 2, 16, 16, item.color, 1)
      .setStrokeStyle(1, 0xFFFFFF).setDepth(50);
    this.tweens.add({ targets: gfx, y: y * ts + ts / 2 - 5, duration: 500, yoyo: true, repeat: -1 });
    this.addMessage(`${item.name} 掉落`);
    this.time.delayedCall(30000, () => { if (gfx.active) gfx.destroy(); });
  }

  updateUI() {
    const char = this.char;
    const barW = Math.min(140, this.scale.width * 0.22);
    if (this.hpBar) this.hpBar.width = barW * Math.max(0, char.hp / char.maxHp);
    if (this.hpText) this.hpText.setText(`${Math.max(0,char.hp)}/${char.maxHp}`);
    if (this.mpBar) this.mpBar.width = barW * Math.max(0, char.mp / char.maxMp);
    if (this.mpText) this.mpText.setText(`${Math.max(0,char.mp)}/${char.maxMp}`);
    const expNeeded = char.level * 100;
    if (this.expBar) this.expBar.width = barW * Math.min(1, char.exp / expNeeded);
    if (this.expText) this.expText.setText(`${char.exp}/${expNeeded}`);
  }

  updateMinimap() {
    if (!this.mmPlayer) return;
    const px = this.mmX + (this.playerX / this.mapWidth) * this.mmSize;
    const py = this.mmY + (this.playerY / this.mapHeight) * this.mmSize;
    this.mmPlayer.setPosition(px, py);

    for (const dot of this.mmMonsters) dot.destroy();
    this.mmMonsters = [];
    for (const m of this.monsters) {
      if (!m.alive) continue;
      const mx = this.mmX + (m.x / this.mapWidth) * this.mmSize;
      const my = this.mmY + (m.y / this.mapHeight) * this.mmSize;
      this.mmMonsters.push(this.add.circle(mx, my, 2, 0xFF0000, 0.8).setScrollFactor(0).setDepth(101));
    }
  }

  addMessage(text) {
    this.messages.push(text);
    if (this.messages.length > 50) this.messages.shift();
    const visible = this.messages.slice(-5);
    for (let i = 0; i < 5; i++) {
      if (i < visible.length) {
        this.msgTexts[i].setText(visible[i]);
        this.msgTexts[i].setAlpha(0.5 + (i / 5) * 0.5);
      } else {
        this.msgTexts[i].setText('');
      }
    }
  }
}
