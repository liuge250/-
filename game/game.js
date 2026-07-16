// ============================================================
// 致敬传奇 - 2D MMORPG Demo (Phaser 3)
// ============================================================
const TILE_SIZE = 48;
const MAP_COLS = 60;
const MAP_ROWS = 60;
const MAP_WIDTH = MAP_COLS * TILE_SIZE;
const MAP_HEIGHT = MAP_ROWS * TILE_SIZE;

const MONSTER_TYPES = {
  chicken: { name: '鸡', color: 0xFFFFFF, hp: 30, atk: 3, def: 0, exp: 10, speed: 0.8, aggroRange: 0, size: 14 },
  deer: { name: '鹿', color: 0xC4A265, hp: 50, atk: 5, def: 1, exp: 20, speed: 1.2, aggroRange: 0, size: 16 },
  spider: { name: '蜘蛛', color: 0x4A0080, hp: 80, atk: 12, def: 3, exp: 40, speed: 1.0, aggroRange: 150, size: 18 },
  orc: { name: '半兽人', color: 0x8B0000, hp: 150, atk: 20, def: 8, exp: 80, speed: 1.2, aggroRange: 200, size: 22 },
  skeleton: { name: '骷髅', color: 0xDCDCCC, hp: 200, atk: 28, def: 12, exp: 120, speed: 1.0, aggroRange: 180, size: 22 },
  boss: { name: '触龙神', color: 0xFF0000, hp: 800, atk: 50, def: 25, exp: 500, speed: 0.8, aggroRange: 300, size: 32 },
};

const ITEM_DEFS = {
  gold_coin: { name: '金币', color: 0xFFD700, type: 'currency' },
  hp_potion: { name: '金创药', color: 0xFF4444, type: 'consumable', heal: 50 },
  mp_potion: { name: '魔法药', color: 0x4444FF, type: 'consumable', mana: 30 },
  wood_sword: { name: '木剑', color: 0x8B6914, type: 'weapon', atk: 5 },
  iron_sword: { name: '铁剑', color: 0xC0C0C0, type: 'weapon', atk: 12 },
  bronze_armor: { name: '青铜盔甲', color: 0xCD7F32, type: 'armor', def: 5 },
  iron_armor: { name: '铁盔甲', color: 0xA8A8A8, type: 'armor', def: 10 },
  magic_ring: { name: '魔力戒指', color: 0x9932CC, type: 'accessory', atk: 3, def: 3 },
};

const DROP_TABLES = {
  chicken: [{ item: 'gold_coin', chance: 0.5, qty: [1, 5] }, { item: 'hp_potion', chance: 0.1 }],
  deer: [{ item: 'gold_coin', chance: 0.5, qty: [2, 8] }, { item: 'hp_potion', chance: 0.2 }],
  spider: [{ item: 'gold_coin', chance: 0.6, qty: [5, 15] }, { item: 'hp_potion', chance: 0.3 }, { item: 'wood_sword', chance: 0.1 }],
  orc: [{ item: 'gold_coin', chance: 0.7, qty: [10, 30] }, { item: 'hp_potion', chance: 0.3 }, { item: 'iron_sword', chance: 0.08 }, { item: 'bronze_armor', chance: 0.08 }],
  skeleton: [{ item: 'gold_coin', chance: 0.8, qty: [15, 50] }, { item: 'mp_potion', chance: 0.3 }, { item: 'iron_armor', chance: 0.06 }, { item: 'magic_ring', chance: 0.04 }],
  boss: [{ item: 'gold_coin', chance: 1.0, qty: [100, 300] }, { item: 'iron_sword', chance: 0.5 }, { item: 'iron_armor', chance: 0.5 }, { item: 'magic_ring', chance: 0.3 }],
};

const SKILLS = {
  basic: { name: '普攻', key: 'J', cost: 0, cd: 500, dmg: 1.0, range: 55, color: 0xFFFFFF },
  fire: { name: '烈火剑法', key: 'K', cost: 10, cd: 2000, dmg: 2.5, range: 60, color: 0xFF4500, lvl: 3 },
  thunder: { name: '雷电术', key: 'L', cost: 20, cd: 3000, dmg: 3.0, range: 200, color: 0x00BFFF, lvl: 5, aoe: 80 },
  heal: { name: '治愈术', key: 'H', cost: 15, cd: 5000, healVal: 100, color: 0x00FF00, lvl: 7 },
};

const LEVEL_EXP = [0, 100, 250, 500, 900, 1500, 2400, 3600, 5200, 7500, 10000, 14000, 19000, 25000, 33000];

// ---- Boot Scene ----
class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  create() {
    this.genTerrain();
    this.genEntities();
    this.genItems();
    this.genEffects();
    this.scene.start('Game');
  }
  genTerrain() {
    const tiles = {
      grass: [0x3A7D44, (g) => { for (let i = 0; i < 8; i++) { g.fillStyle(0x2E6B38); g.fillRect(Phaser.Math.Between(2, 44), Phaser.Math.Between(2, 44), 2, 4); } }],
      dark_grass: [0x2D5A35, (g) => { for (let i = 0; i < 6; i++) { g.fillStyle(0x1F4A28); g.fillRect(Phaser.Math.Between(2, 44), Phaser.Math.Between(2, 44), 3, 3); } }],
      dirt: [0x8B7355, (g) => { for (let i = 0; i < 5; i++) { g.fillStyle(0x7A6348); g.fillCircle(Phaser.Math.Between(4, 44), Phaser.Math.Between(4, 44), 2); } }],
      water: [0x1565C0, (g) => { g.fillStyle(0x1E88E5, 0.4); g.fillRect(5, 10, 20, 3); g.fillRect(25, 25, 15, 3); }],
      sand: [0xD2B48C, (g) => { for (let i = 0; i < 4; i++) { g.fillStyle(0xC4A675); g.fillCircle(Phaser.Math.Between(4, 44), Phaser.Math.Between(4, 44), 1.5); } }],
      tree: [0x3A7D44, (g) => { g.fillStyle(0x5D4037); g.fillRect(20, 28, 8, 20); g.fillStyle(0x1B5E20); g.fillCircle(24, 20, 16); g.fillStyle(0x2E7D32, 0.7); g.fillCircle(20, 16, 10); }],
      rock: [0x3A7D44, (g) => { g.fillStyle(0x757575); g.fillRoundedRect(8, 12, 32, 28, 8); g.fillStyle(0x9E9E9E, 0.5); g.fillRoundedRect(12, 14, 16, 12, 4); }],
      flower: [0x3A7D44, (g) => { const c = [0xFF6B6B, 0xFFD93D, 0xFFA07A]; for (let i = 0; i < 3; i++) { g.fillStyle(c[i]); g.fillCircle(Phaser.Math.Between(8, 40), Phaser.Math.Between(8, 40), 3); } }],
    };
    for (const [name, [bg, detail]] of Object.entries(tiles)) {
      const g = this.make.graphics(0, 0);
      g.fillStyle(bg); g.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
      detail(g);
      g.generateTexture('t_' + name, TILE_SIZE, TILE_SIZE);
      g.destroy();
    }
  }
  genEntities() {
    // Player
    const p = this.make.graphics(0, 0);
    p.fillStyle(0xDAA520); p.fillRoundedRect(-12, -8, 24, 28, 4);
    p.fillStyle(0xFFDBAC); p.fillCircle(0, -14, 10);
    p.fillStyle(0xC0C0C0); p.fillRoundedRect(-10, -22, 20, 12, 4);
    p.fillStyle(0xFFD700); p.fillRect(-2, -24, 4, 6);
    p.fillStyle(0x000); p.fillRect(-5, -16, 3, 3); p.fillRect(2, -16, 3, 3);
    p.fillStyle(0xC0C0C0); p.fillRect(14, -10, 3, 24);
    p.fillStyle(0x8B4513); p.fillRect(12, 10, 7, 4);
    p.fillStyle(0x8B6914); p.fillRect(-8, 20, 7, 10); p.fillRect(1, 20, 7, 10);
    p.generateTexture('player', 40, 56); p.destroy();

    // Monsters
    for (const [key, cfg] of Object.entries(MONSTER_TYPES)) {
      const g = this.make.graphics(0, 0);
      const s = cfg.size;
      if (key === 'chicken') {
        g.fillStyle(cfg.color); g.fillCircle(0, 0, s);
        g.fillStyle(0xFF0000); g.fillRect(-2, -s - 4, 4, 6);
        g.fillStyle(0xFFA500); g.fillTriangle(s, 0, s + 6, -2, s + 6, 2);
        g.fillStyle(0x000); g.fillCircle(-4, -3, 2); g.fillCircle(4, -3, 2);
      } else if (key === 'deer') {
        g.fillStyle(cfg.color); g.fillEllipse(0, 0, s * 1.5, s);
        g.fillStyle(0xA08050); g.fillRect(-2, -s - 10, 3, 12); g.fillRect(4, -s - 10, 3, 12);
        g.fillStyle(0x000); g.fillCircle(-6, -4, 2); g.fillCircle(6, -4, 2);
      } else if (key === 'spider') {
        g.fillStyle(cfg.color); g.fillCircle(0, 0, s);
        for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; g.lineStyle(2, cfg.color); g.beginPath(); g.moveTo(Math.cos(a) * s, Math.sin(a) * s); g.lineTo(Math.cos(a) * (s + 12), Math.sin(a) * (s + 12)); g.strokePath(); }
        g.fillStyle(0xFF0000); g.fillCircle(-5, -4, 3); g.fillCircle(5, -4, 3);
      } else if (key === 'boss') {
        g.fillStyle(cfg.color); g.fillEllipse(0, 0, s * 1.8, s * 1.2);
        g.fillStyle(0xCC0000); g.fillTriangle(-s, -s, -s - 15, -s - 20, -s + 10, -s); g.fillTriangle(s, -s, s + 15, -s - 20, s - 10, -s);
        g.fillStyle(0xFFFF00); g.fillCircle(-10, -8, 5); g.fillCircle(10, -8, 5);
        g.fillStyle(0xAA0000, 0.6); g.fillTriangle(-s, 0, -s * 2.5, -s, -s * 2, s * 0.5); g.fillTriangle(s, 0, s * 2.5, -s, s * 2, s * 0.5);
      } else {
        g.fillStyle(cfg.color); g.fillRoundedRect(-s / 2, -s / 2, s, s * 1.2, 4);
        g.fillStyle(key === 'skeleton' ? 0xEEEEEE : cfg.color); g.fillCircle(0, -s / 2 - 6, 8);
        g.fillStyle(0xFF0000); g.fillCircle(-4, -s / 2 - 8, 2); g.fillCircle(4, -s / 2 - 8, 2);
        g.fillStyle(0x808080); g.fillRect(s / 2 + 2, -s / 2, 3, s);
      }
      g.generateTexture('m_' + key, s * 3, s * 3); g.destroy();
    }
  }
  genItems() {
    const shapes = {
      coin: (g, c) => { g.fillStyle(c); g.fillCircle(10, 10, 8); g.fillStyle(0xB8860B); g.fillCircle(10, 10, 5); },
      potion: (g, c) => { g.fillStyle(0x808080); g.fillRect(7, 2, 6, 4); g.fillStyle(c); g.fillRoundedRect(4, 6, 12, 14, 3); },
      sword: (g, c) => { g.fillStyle(c); g.fillRect(9, 2, 3, 16); g.fillStyle(0x8B4513); g.fillRect(5, 16, 10, 3); },
      armor: (g, c) => { g.fillStyle(c); g.fillRoundedRect(4, 4, 12, 16, 3); g.fillRoundedRect(2, 4, 6, 8, 2); g.fillRoundedRect(12, 4, 6, 8, 2); },
      ring: (g, c) => { g.lineStyle(3, c); g.strokeCircle(10, 10, 7); g.fillStyle(0x00FFFF); g.fillCircle(10, 3, 3); },
    };
    const iconMap = { gold_coin: 'coin', hp_potion: 'potion', mp_potion: 'potion', wood_sword: 'sword', iron_sword: 'sword', bronze_armor: 'armor', iron_armor: 'armor', magic_ring: 'ring' };
    for (const [key, def] of Object.entries(ITEM_DEFS)) {
      const g = this.make.graphics(0, 0);
      shapes[iconMap[key]](g, def.color);
      g.generateTexture('i_' + key, 20, 24); g.destroy();
    }
  }
  genEffects() {
    const make = (key, fn, w, h) => { const g = this.make.graphics(0, 0); fn(g); g.generateTexture(key, w, h); g.destroy(); };
    make('e_slash', g => { g.lineStyle(3, 0xFFFFFF, 0.8); g.beginPath(); g.arc(0, 0, 25, -0.5, 1.5); g.strokePath(); }, 60, 60);
    make('e_fire', g => { g.fillStyle(0xFF4500, 0.8); g.fillCircle(0, 0, 15); g.fillStyle(0xFFD700, 0.6); g.fillCircle(0, -3, 10); }, 40, 40);
    make('e_thunder', g => { g.fillStyle(0x00BFFF, 0.9); g.fillTriangle(0, -20, -8, 0, -2, 0); g.fillTriangle(-2, 0, -10, 20, 4, 5); g.fillTriangle(4, 5, 12, -5, 2, -2); }, 30, 50);
    make('e_heal', g => { g.fillStyle(0x00FF00, 0.6); g.fillCircle(0, 0, 20); g.fillStyle(0x90EE90, 0.4); for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.fillCircle(Math.cos(a) * 15, Math.sin(a) * 15, 4); } }, 50, 50);
    make('e_glow', g => { g.fillStyle(0xFFD700, 0.3); g.fillCircle(10, 12, 14); }, 28, 28);
    make('e_lvl', g => { g.fillStyle(0xFFD700, 0.5); g.fillCircle(0, 0, 30); g.lineStyle(2, 0xFFFF00, 0.8); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; g.beginPath(); g.moveTo(Math.cos(a) * 20, Math.sin(a) * 20); g.lineTo(Math.cos(a) * 35, Math.sin(a) * 35); g.strokePath(); } }, 80, 80);
  }
}

// ---- Game Scene ----
class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  create() {
    this.P = { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2, level: 1, exp: 0, hp: 100, maxHp: 100, mp: 50, maxMp: 50, atk: 10, def: 5, speed: 3, gold: 0, weapon: null, armor: null, acc: null, inv: [], cds: {}, target: null };
    this.monsters = []; this.drops = []; this.msgs = []; this.mapData = []; this.collMap = [];
    this.moveTarget = null; this.gameTime = 0;

    this.genMap();
    this.cameras.main.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);
    this.visTiles = new Map();
    this.createPlayer();
    this.spawnAllMonsters();
    this.setupInput();
    this.createUI();
    this.addMsg('欢迎来到玛法大陆！WASD移动，J攻击，K/L技能，H治愈');
    this.addMsg('点击怪物锁定攻击，1/2使用药水');
  }

  genMap() {
    const seed = Phaser.Math.Between(0, 9999);
    for (let r = 0; r < MAP_ROWS; r++) {
      this.mapData[r] = []; this.collMap[r] = [];
      for (let c = 0; c < MAP_COLS; c++) {
        const nx = c / MAP_COLS - 0.5, ny = r / MAP_ROWS - 0.5;
        const v = this.noise(nx * 4 + seed, ny * 4 + seed);
        const m = this.noise(nx * 3 + seed + 100, ny * 3 + seed + 100);
        let t;
        if (v < -0.3) t = 'water';
        else if (v < -0.15) t = 'sand';
        else if (v < 0.2) { t = m > 0.1 ? 'dark_grass' : 'grass'; if (Phaser.Math.Between(0, 30) === 0) t = 'flower'; }
        else if (v < 0.4) { t = 'dirt'; if (Phaser.Math.Between(0, 15) === 0) t = 'tree'; }
        else { t = 'dark_grass'; if (Phaser.Math.Between(0, 8) === 0) t = 'tree'; else if (Phaser.Math.Between(0, 20) === 0) t = 'rock'; }
        if (Math.abs(c - MAP_COLS / 2) < 5 && Math.abs(r - MAP_ROWS / 2) < 5) t = 'grass';
        this.mapData[r][c] = t;
        this.collMap[r][c] = (t === 'water' || t === 'tree' || t === 'rock') ? 1 : 0;
      }
    }
  }
  noise(x, y) { const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; const n2 = Math.sin(x * 25.123 + y * 41.789) * 23456.789; return (n - Math.floor(n)) + (n2 - Math.floor(n2)) - 1; }

  updateTiles() {
    const cam = this.cameras.main, pad = 2;
    const sc = Math.max(0, Math.floor(cam.scrollX / TILE_SIZE) - pad);
    const ec = Math.min(MAP_COLS, Math.ceil((cam.scrollX + cam.width / cam.zoom) / TILE_SIZE) + pad);
    const sr = Math.max(0, Math.floor(cam.scrollY / TILE_SIZE) - pad);
    const er = Math.min(MAP_ROWS, Math.ceil((cam.scrollY + cam.height / cam.zoom) / TILE_SIZE) + pad);
    const needed = new Set();
    for (let r = sr; r < er; r++) for (let c = sc; c < ec; c++) {
      const k = r + '_' + c; needed.add(k);
      if (!this.visTiles.has(k)) { const s = this.add.image(c * TILE_SIZE + TILE_SIZE / 2, r * TILE_SIZE + TILE_SIZE / 2, 't_' + this.mapData[r][c]).setDepth(0); this.visTiles.set(k, s); }
    }
    for (const [k, s] of this.visTiles) { if (!needed.has(k)) { s.destroy(); this.visTiles.delete(k); } }
  }

  createPlayer() {
    this.pSprite = this.add.sprite(this.P.x, this.P.y, 'player').setDepth(10).setOrigin(0.5, 0.7);
    this.pName = this.add.text(this.P.x, this.P.y - 40, '勇士', { fontSize: '12px', color: '#FFF', fontStyle: 'bold', stroke: '#000', strokeThickness: 2 }).setOrigin(0.5).setDepth(11);
    this.pHpGfx = this.add.graphics().setDepth(12);
  }

  spawnAllMonsters() {
    const zones = [
      { type: 'chicken', n: 15, a: { x1: 10, y1: 10, x2: 25, y2: 25 } },
      { type: 'deer', n: 12, a: { x1: 10, y1: 30, x2: 25, y2: 45 } },
      { type: 'spider', n: 10, a: { x1: 30, y1: 10, x2: 45, y2: 25 } },
      { type: 'orc', n: 8, a: { x1: 35, y1: 35, x2: 50, y2: 50 } },
      { type: 'skeleton', n: 6, a: { x1: 10, y1: 40, x2: 25, y2: 55 } },
      { type: 'boss', n: 1, a: { x1: 45, y1: 45, x2: 50, y2: 50 } },
    ];
    for (const z of zones) for (let i = 0; i < z.n; i++) this.spawnMonster(z.type, z.a);
  }

  spawnMonster(type, area) {
    const cfg = MONSTER_TYPES[type];
    let col, row, x, y, tries = 0;
    do { col = Phaser.Math.Between(area.x1, area.x2); row = Phaser.Math.Between(area.y1, area.y2); x = col * TILE_SIZE + TILE_SIZE / 2; y = row * TILE_SIZE + TILE_SIZE / 2; tries++; } while (this.collMap[row]?.[col] && tries < 20);
    const m = { id: Phaser.Math.RND.uuid(), type, cfg, x, y, hp: cfg.hp, maxHp: cfg.hp, sx: x, sy: y, state: 'idle', stateTimer: 0, wanderAngle: Math.random() * Math.PI * 2, atkCd: 0, dead: false };
    m.sprite = this.add.sprite(x, y, 'm_' + type).setDepth(5).setOrigin(0.5, 0.6);
    const prefix = type === 'boss' ? '[BOSS] ' : '';
    const nc = type === 'boss' ? '#FF4444' : '#FFCC00';
    const fs = type === 'boss' ? '14px' : '11px';
    m.nameTxt = this.add.text(x, y - cfg.size - 16, prefix + cfg.name, { fontSize: fs, color: nc, fontStyle: 'bold', stroke: '#000', strokeThickness: 2 }).setOrigin(0.5).setDepth(6);
    m.hpGfx = this.add.graphics().setDepth(7);
    this.monsters.push(m);
    return m;
  }

  setupInput() {
    this.keys = this.input.keyboard.addKeys('W,A,S,D');
    this.input.on('pointerdown', (ptr) => {
      const wx = ptr.worldX, wy = ptr.worldY;
      let clicked = null;
      for (const m of this.monsters) { if (m.dead) continue; if (Phaser.Math.Distance.Between(wx, wy, m.x, m.y) < m.cfg.size + 15) { clicked = m; break; } }
      if (clicked) { this.P.target = clicked; this.addMsg('锁定: ' + clicked.cfg.name); }
      else { this.P.target = null; this.moveTarget = { x: wx, y: wy }; }
    });
    this.input.keyboard.on('keydown-J', () => this.useSkill('basic'));
    this.input.keyboard.on('keydown-K', () => this.useSkill('fire'));
    this.input.keyboard.on('keydown-L', () => this.useSkill('thunder'));
    this.input.keyboard.on('keydown-H', () => this.useSkill('heal'));
    this.input.keyboard.on('keydown-1', () => this.usePotion('hp_potion'));
    this.input.keyboard.on('keydown-2', () => this.usePotion('mp_potion'));
  }

  useSkill(id) {
    const sk = SKILLS[id]; if (!sk) return;
    if (sk.lvl && this.P.level < sk.lvl) { this.addMsg('需要' + sk.lvl + '级'); return; }
    if (this.P.mp < sk.cost) { this.addMsg('魔法不足！'); return; }
    if (this.P.cds[id] && this.time.now < this.P.cds[id]) return;
    this.P.mp -= sk.cost;
    this.P.cds[id] = this.time.now + sk.cd;

    if (id === 'heal') {
      const h = Math.min(sk.healVal, this.P.maxHp - this.P.hp); this.P.hp += h;
      this.showEffect(this.P.x, this.P.y, 'e_heal'); this.showDmg(this.P.x, this.P.y - 30, '+' + h, '#00FF00');
      this.addMsg('治愈术 恢复' + h + 'HP'); return;
    }

    let tgt = this.P.target;
    if (!tgt || tgt.dead) {
      let best = null, bd = Infinity;
      for (const m of this.monsters) { if (m.dead) continue; const d = Phaser.Math.Distance.Between(this.P.x, this.P.y, m.x, m.y); if (d < sk.range + m.cfg.size && d < bd) { best = m; bd = d; } }
      tgt = best;
    }
    if (!tgt) { this.addMsg('附近没有目标'); return; }
    const dist = Phaser.Math.Distance.Between(this.P.x, this.P.y, tgt.x, tgt.y);
    if (dist > sk.range + tgt.cfg.size + 20) { this.P.target = tgt; this.moveTarget = { x: tgt.x, y: tgt.y }; this.addMsg('目标太远...'); return; }

    this.pSprite.setFlipX(tgt.x < this.P.x);
    const baseDmg = this.P.atk * sk.dmg;
    let dmg = Math.max(1, Math.floor(baseDmg - tgt.cfg.def * 0.5 + Phaser.Math.Between(-3, 3)));
    const crit = Phaser.Math.Between(0, 100) < 15;
    if (crit) dmg = Math.floor(dmg * 1.5);
    tgt.hp -= dmg;

    if (id === 'thunder' && sk.aoe) {
      this.showEffect(tgt.x, tgt.y, 'e_thunder');
      for (const m of this.monsters) { if (m.dead || m === tgt) continue; if (Phaser.Math.Distance.Between(tgt.x, tgt.y, m.x, m.y) < sk.aoe) { const ad = Math.max(1, Math.floor(dmg * 0.5)); m.hp -= ad; this.showDmg(m.x, m.y - 20, '' + ad, '#00BFFF'); if (m.hp <= 0) this.killMonster(m); } }
    } else if (id === 'fire') { this.showEffect(tgt.x, tgt.y, 'e_fire'); }
    else { this.showEffect(tgt.x, tgt.y, 'e_slash'); }

    this.showDmg(tgt.x, tgt.y - 20, (crit ? '暴击! ' : '') + dmg, crit ? '#FFFF00' : '#FFF');
    if (tgt.hp <= 0) this.killMonster(tgt);
  }

  killMonster(m) {
    m.dead = true; m.hp = 0;
    this.tweens.add({ targets: m.sprite, alpha: 0, duration: 300, onComplete: () => { m.sprite?.destroy(); m.nameTxt?.destroy(); m.hpGfx?.destroy(); } });
    this.P.exp += m.cfg.exp;
    this.addMsg('击杀 ' + m.cfg.name + ' +' + m.cfg.exp + '经验');
    this.checkLevelUp();
    this.genDrops(m);
    if (this.P.target === m) this.P.target = null;
    const area = this.getArea(m.type);
    this.time.delayedCall(15000, () => { const i = this.monsters.indexOf(m); if (i !== -1) this.monsters.splice(i, 1); if (area) this.spawnMonster(m.type, area); });
  }

  getArea(type) {
    const m = { chicken: { x1: 10, y1: 10, x2: 25, y2: 25 }, deer: { x1: 10, y1: 30, x2: 25, y2: 45 }, spider: { x1: 30, y1: 10, x2: 45, y2: 25 }, orc: { x1: 35, y1: 35, x2: 50, y2: 50 }, skeleton: { x1: 10, y1: 40, x2: 25, y2: 55 }, boss: { x1: 45, y1: 45, x2: 50, y2: 50 } };
    return m[type];
  }

  genDrops(m) {
    const table = DROP_TABLES[m.type]; if (!table) return;
    for (const d of table) {
      if (Math.random() > d.chance) continue;
      const qty = d.qty ? Phaser.Math.Between(d.qty[0], d.qty[1]) : 1;
      const ox = Phaser.Math.Between(-30, 30), oy = Phaser.Math.Between(-30, 30);
      if (d.item === 'gold_coin') { this.P.gold += qty; this.showDmg(m.x + ox, m.y + oy - 10, '+' + qty + ' 金币', '#FFD700'); }
      else {
        const def = ITEM_DEFS[d.item];
        const item = { id: Phaser.Math.RND.uuid(), type: d.item, x: m.x + ox, y: m.y + oy, qty };
        item.glow = this.add.sprite(m.x + ox, m.y + oy, 'e_glow').setDepth(3);
        item.sprite = this.add.sprite(m.x + ox, m.y + oy, 'i_' + d.item).setDepth(4).setInteractive();
        this.tweens.add({ targets: item.sprite, y: m.y + oy - 5, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        item.sprite.on('pointerdown', () => this.pickup(item));
        this.drops.push(item);
        this.time.delayedCall(30000, () => { item.sprite?.destroy(); item.glow?.destroy(); const i = this.drops.indexOf(item); if (i !== -1) this.drops.splice(i, 1); });
      }
    }
  }

  pickup(item) {
    if (!item.sprite) return;
    if (Phaser.Math.Distance.Between(this.P.x, this.P.y, item.x, item.y) > 80) { this.addMsg('距离太远'); return; }
    const def = ITEM_DEFS[item.type];
    if (def.type === 'consumable' || def.type === 'currency') {
      const ex = this.P.inv.find(i => i.type === item.type);
      if (ex) ex.qty += item.qty; else this.P.inv.push({ type: item.type, name: def.name, qty: item.qty });
      this.addMsg('拾取 ' + def.name + ' x' + item.qty);
    } else { this.equipItem(item.type); }
    item.sprite.destroy(); item.glow?.destroy();
    const i = this.drops.indexOf(item); if (i !== -1) this.drops.splice(i, 1);
  }

  equipItem(type) {
    const def = ITEM_DEFS[type];
    const slot = def.type === 'weapon' ? 'weapon' : def.type === 'armor' ? 'armor' : 'acc';
    const cur = this.P[slot]; const curDef = cur ? ITEM_DEFS[cur] : null;
    const nv = (def.atk || 0) + (def.def || 0); const cv = curDef ? ((curDef.atk || 0) + (curDef.def || 0)) : 0;
    if (nv > cv) { this.P[slot] = type; this.recalc(); this.addMsg('装备 ' + def.name); }
    else { this.addMsg(def.name + ' 不如当前装备'); const ex = this.P.inv.find(i => i.type === type); if (ex) ex.qty++; else this.P.inv.push({ type, name: def.name, qty: 1 }); }
  }

  recalc() {
    const p = this.P;
    p.atk = 10 + (p.level - 1) * 2; p.def = 5 + (p.level - 1);
    p.maxHp = 100 + (p.level - 1) * 20; p.maxMp = 50 + (p.level - 1) * 10;
    for (const s of ['weapon', 'armor', 'acc']) { if (p[s]) { const d = ITEM_DEFS[p[s]]; p.atk += d.atk || 0; p.def += d.def || 0; } }
    p.hp = Math.min(p.hp, p.maxHp); p.mp = Math.min(p.mp, p.maxMp);
  }

  checkLevelUp() {
    const p = this.P;
    while (p.level < LEVEL_EXP.length && p.exp >= LEVEL_EXP[p.level]) {
      p.level++; this.recalc(); p.hp = p.maxHp; p.mp = p.maxMp;
      this.addMsg('升级！当前 ' + p.level + ' 级！'); this.showEffect(p.x, p.y, 'e_lvl');
      for (const [id, sk] of Object.entries(SKILLS)) { if (sk.lvl === p.level) this.addMsg('解锁技能: ' + sk.name + '(' + sk.key + ')'); }
    }
  }

  usePotion(type) {
    const inv = this.P.inv.find(i => i.type === type);
    if (!inv || inv.qty <= 0) { this.addMsg('没有' + ITEM_DEFS[type].name + '了！'); return; }
    const def = ITEM_DEFS[type]; inv.qty--;
    if (inv.qty <= 0) { const i = this.P.inv.indexOf(inv); this.P.inv.splice(i, 1); }
    if (def.heal) { const h = Math.min(def.heal, this.P.maxHp - this.P.hp); this.P.hp += h; this.showDmg(this.P.x, this.P.y - 30, '+' + h, '#00FF00'); }
    if (def.mana) { const m = Math.min(def.mana, this.P.maxMp - this.P.mp); this.P.mp += m; this.showDmg(this.P.x, this.P.y - 40, '+' + m + ' MP', '#4444FF'); }
    this.addMsg('使用 ' + def.name);
  }

  showEffect(x, y, tex) { const e = this.add.sprite(x, y, tex).setDepth(20).setAlpha(0.8); this.tweens.add({ targets: e, alpha: 0, scale: 1.5, duration: 400, onComplete: () => e.destroy() }); }
  showDmg(x, y, text, color) { const t = this.add.text(x, y, text, { fontSize: '16px', color, fontStyle: 'bold', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setDepth(25); this.tweens.add({ targets: t, y: y - 40, alpha: 0, duration: 1000, ease: 'Cubic.easeOut', onComplete: () => t.destroy() }); }
  addMsg(msg) { this.msgs.push({ text: msg, time: this.time.now }); if (this.msgs.length > 50) this.msgs.shift(); }

  drawBar(gfx, x, y, cur, max, w, color) {
    gfx.clear(); gfx.fillStyle(0x000000, 0.7); gfx.fillRoundedRect(x - w / 2 - 1, y - 1, w + 2, 6, 2);
    gfx.fillStyle(color, 0.9); gfx.fillRoundedRect(x - w / 2, y, w * Math.max(0, cur / max), 4, 2);
  }

  createUI() {
    this.uiGfx = this.add.graphics().setDepth(100).setScrollFactor(0);
    this.uiTexts = {};
    const mkTxt = (x, y, style) => { const t = this.add.text(x, y, '', style).setDepth(101).setScrollFactor(0); return t; };
    this.uiTexts.lvl = mkTxt(20, 18, { fontSize: '14px', color: '#FFD700', fontStyle: 'bold' });
    this.uiTexts.hp = mkTxt(20, 54, { fontSize: '11px', color: '#FF6666' });
    this.uiTexts.mp = mkTxt(20, 70, { fontSize: '11px', color: '#6666FF' });
    this.uiTexts.exp = mkTxt(20, 86, { fontSize: '11px', color: '#AAA' });
    this.uiTexts.gold = mkTxt(20, 100, { fontSize: '11px', color: '#FFD700' });
    this.uiTexts.atk = mkTxt(130, 86, { fontSize: '11px', color: '#FF8888' });
    this.uiTexts.def = mkTxt(130, 100, { fontSize: '11px', color: '#88AAFF' });
    this.uiHpGfx = this.add.graphics().setDepth(101).setScrollFactor(0);
    this.uiMpGfx = this.add.graphics().setDepth(101).setScrollFactor(0);
    this.uiExpGfx = this.add.graphics().setDepth(101).setScrollFactor(0);
    this.skillGfx = this.add.graphics().setDepth(100).setScrollFactor(0);
    this.skillTxts = [];
    this.mmGfx = this.add.graphics().setDepth(100).setScrollFactor(0);
    this.mmBg = this.add.graphics().setDepth(99).setScrollFactor(0);
    this.msgGfx = this.add.graphics().setDepth(100).setScrollFactor(0);
    this.msgTxts = [];
    this.tgtBg = this.add.graphics().setDepth(100).setScrollFactor(0);
    this.tgtName = this.add.text(0, 0, '', { fontSize: '13px', color: '#FF4444', fontStyle: 'bold', stroke: '#000', strokeThickness: 2 }).setOrigin(0.5, 0).setDepth(101).setScrollFactor(0);
    this.tgtHpGfx = this.add.graphics().setDepth(101).setScrollFactor(0);
  }

  updateUI() {
    const p = this.P, cam = this.cameras.main, sw = cam.width, sh = cam.height;

    // Player info panel
    this.uiGfx.clear();
    this.uiGfx.fillStyle(0x1a1a2e, 0.85); this.uiGfx.fillRoundedRect(10, 10, 220, 108, 8);
    this.uiGfx.lineStyle(1, 0x4a4a6a); this.uiGfx.strokeRoundedRect(10, 10, 220, 108, 8);

    this.uiTexts.lvl.setText('Lv.' + p.level + ' 战士');
    this.uiTexts.hp.setText('HP: ' + Math.floor(p.hp) + '/' + p.maxHp);
    this.uiTexts.mp.setText('MP: ' + Math.floor(p.mp) + '/' + p.maxMp);
    const ne = LEVEL_EXP[p.level] || '---';
    this.uiTexts.exp.setText('EXP: ' + p.exp + '/' + ne);
    this.uiTexts.gold.setText('金币: ' + p.gold);
    this.uiTexts.atk.setText('攻击: ' + p.atk);
    this.uiTexts.def.setText('防御: ' + p.def);

    // HP/MP bars
    this.uiHpGfx.clear(); this.uiHpGfx.fillStyle(0x333, 0.8); this.uiHpGfx.fillRoundedRect(130, 54, 90, 10, 3);
    this.uiHpGfx.fillStyle(0xCC0000, 0.9); this.uiHpGfx.fillRoundedRect(130, 54, 90 * (p.hp / p.maxHp), 10, 3);
    this.uiMpGfx.clear(); this.uiMpGfx.fillStyle(0x333, 0.8); this.uiMpGfx.fillRoundedRect(130, 70, 90, 10, 3);
    this.uiMpGfx.fillStyle(0x0000CC, 0.9); this.uiMpGfx.fillRoundedRect(130, 70, 90 * (p.mp / p.maxMp), 10, 3);

    // EXP bar
    this.uiExpGfx.clear();
    const er = LEVEL_EXP[p.level] ? p.exp / LEVEL_EXP[p.level] : 0;
    this.uiExpGfx.fillStyle(0x333, 0.5); this.uiExpGfx.fillRoundedRect(10, 122, 220, 6, 2);
    this.uiExpGfx.fillStyle(0xAAAA00, 0.7); this.uiExpGfx.fillRoundedRect(10, 122, 220 * Math.min(1, er), 6, 2);

    // Skill bar
    const sbw = 310, sbx = (sw - sbw) / 2, sby = sh - 60;
    this.skillGfx.clear();
    this.skillGfx.fillStyle(0x1a1a2e, 0.85); this.skillGfx.fillRoundedRect(sbx, sby, sbw, 50, 8);
    this.skillGfx.lineStyle(1, 0x4a4a6a); this.skillGfx.strokeRoundedRect(sbx, sby, sbw, 50, 8);

    this.skillTxts.forEach(t => t.destroy()); this.skillTxts = [];
    let sx = sbx + 8;
    for (const id of ['basic', 'fire', 'thunder', 'heal']) {
      const sk = SKILLS[id]; const locked = sk.lvl && p.level < sk.lvl;
      const onCd = p.cds[id] && this.time.now < p.cds[id];
      const cdR = onCd ? (p.cds[id] - this.time.now) / sk.cd : 0;
      this.skillGfx.fillStyle(locked ? 0x333 : 0x2a2a4e, 0.9); this.skillGfx.fillRoundedRect(sx, sby + 6, 40, 38, 4);
      if (onCd) { this.skillGfx.fillStyle(0x000, 0.5); this.skillGfx.fillRoundedRect(sx, sby + 6 + 38 * (1 - cdR), 40, 38 * cdR, 4); }
      if (!locked) { this.skillGfx.fillStyle(sk.color, 0.6); this.skillGfx.fillCircle(sx + 20, sby + 20, 8); }
      this.skillTxts.push(this.add.text(sx + 20, sby + 38, locked ? 'Lv' + sk.lvl : sk.key, { fontSize: '10px', color: locked ? '#666' : '#FFF', align: 'center' }).setOrigin(0.5).setDepth(102).setScrollFactor(0));
      this.skillTxts.push(this.add.text(sx + 20, sby + 2, sk.name.substring(0, 4), { fontSize: '9px', color: locked ? '#555' : '#CCC', align: 'center' }).setOrigin(0.5).setDepth(102).setScrollFactor(0));
      sx += 46;
    }
    // Potions
    this.skillGfx.lineStyle(1, 0x4a4a6a); this.skillGfx.lineBetween(sx + 2, sby + 8, sx + 2, sby + 42);
    sx += 10;
    for (const pid of ['hp_potion', 'mp_potion']) {
      const def = ITEM_DEFS[pid]; const inv = p.inv.find(i => i.type === pid); const qty = inv ? inv.qty : 0;
      const kl = pid === 'hp_potion' ? '1' : '2';
      this.skillGfx.fillStyle(0x2a2a4e, 0.9); this.skillGfx.fillRoundedRect(sx, sby + 6, 40, 38, 4);
      this.skillGfx.fillStyle(def.color, 0.5); this.skillGfx.fillCircle(sx + 20, sby + 20, 8);
      this.skillTxts.push(this.add.text(sx + 20, sby + 38, kl + '(' + qty + ')', { fontSize: '10px', color: '#FFF', align: 'center' }).setOrigin(0.5).setDepth(102).setScrollFactor(0));
      sx += 46;
    }

    // Mini map
    const ms = 120, mx = sw - ms - 10, my = sh - ms - 10;
    this.mmBg.clear(); this.mmBg.fillStyle(0x000, 0.7); this.mmBg.fillRoundedRect(mx - 2, my - 2, ms + 4, ms + 4, 4);
    this.mmBg.lineStyle(1, 0x4a4a6a); this.mmBg.strokeRoundedRect(mx - 2, my - 2, ms + 4, ms + 4, 4);
    this.mmGfx.clear(); const msc = ms / MAP_WIDTH;
    this.mmGfx.fillStyle(0x00FF00); this.mmGfx.fillCircle(mx + p.x * msc, my + p.y * msc, 3);
    for (const m of this.monsters) { if (m.dead) continue; this.mmGfx.fillStyle(m.type === 'boss' ? 0xFF0000 : 0xFF6600); this.mmGfx.fillCircle(mx + m.x * msc, my + m.y * msc, m.type === 'boss' ? 3 : 1.5); }

    // Messages
    const msgX = 10, msgY = sh - 160, msgW = 280, msgH = 90;
    this.msgGfx.clear(); this.msgGfx.fillStyle(0x000, 0.5); this.msgGfx.fillRoundedRect(msgX, msgY, msgW, msgH, 4);
    this.msgTxts.forEach(t => t.destroy()); this.msgTxts = [];
    const recent = this.msgs.filter(m => this.time.now - m.time < 10000).slice(-5);
    recent.forEach((m, i) => {
      const alpha = Math.max(0.3, 1 - (this.time.now - m.time) / 10000);
      this.msgTxts.push(this.add.text(msgX + 8, msgY + msgH - 16 - i * 16, m.text, { fontSize: '11px', color: '#DDD' }).setAlpha(alpha).setDepth(101).setScrollFactor(0));
    });

    // Target info
    if (p.target && !p.target.dead) {
      const t = p.target;
      this.tgtBg.clear();
      this.tgtBg.fillStyle(0x1a1a2e, 0.85); this.tgtBg.fillRoundedRect(sw / 2 - 80, 10, 160, 36, 6);
      this.tgtBg.lineStyle(1, 0xFF4444); this.tgtBg.strokeRoundedRect(sw / 2 - 80, 10, 160, 36, 6);
      this.tgtName.setPosition(sw / 2, 14).setText(t.cfg.name + ' Lv.' + Math.ceil(t.maxHp / 50));
      this.tgtHpGfx.clear(); this.tgtHpGfx.fillStyle(0x333, 0.8); this.tgtHpGfx.fillRoundedRect(sw / 2 - 70, 32, 140, 8, 3);
      this.tgtHpGfx.fillStyle(0xCC0000, 0.9); this.tgtHpGfx.fillRoundedRect(sw / 2 - 70, 32, 140 * Math.max(0, t.hp / t.maxHp), 8, 3);
    } else {
      this.tgtBg.clear(); this.tgtName.setText(''); this.tgtHpGfx.clear();
    }
  }

  update(time, delta) {
    const p = this.P;
    this.gameTime += delta;

    // Player movement
    let dx = 0, dy = 0;
    if (this.keys.W.isDown) dy = -1;
    if (this.keys.S.isDown) dy = 1;
    if (this.keys.A.isDown) dx = -1;
    if (this.keys.D.isDown) dx = 1;

    if (dx !== 0 || dy !== 0) {
      this.moveTarget = null;
      const len = Math.sqrt(dx * dx + dy * dy);
      dx /= len; dy /= len;
    } else if (this.moveTarget) {
      const dist = Phaser.Math.Distance.Between(p.x, p.y, this.moveTarget.x, this.moveTarget.y);
      if (dist > 5) {
        dx = (this.moveTarget.x - p.x) / dist;
        dy = (this.moveTarget.y - p.y) / dist;
      } else { this.moveTarget = null; }
    } else if (p.target && !p.target.dead) {
      const dist = Phaser.Math.Distance.Between(p.x, p.y, p.target.x, p.target.y);
      if (dist > SKILLS.basic.range) {
        dx = (p.target.x - p.x) / dist;
        dy = (p.target.y - p.y) / dist;
      }
    }

    if (dx !== 0 || dy !== 0) {
      const nx = p.x + dx * p.speed;
      const ny = p.y + dy * p.speed;
      const col = Math.floor(nx / TILE_SIZE);
      const row = Math.floor(ny / TILE_SIZE);
      if (col >= 0 && col < MAP_COLS && row >= 0 && row < MAP_ROWS && !this.collMap[row][col]) {
        p.x = Phaser.Math.Clamp(nx, 20, MAP_WIDTH - 20);
        p.y = Phaser.Math.Clamp(ny, 20, MAP_HEIGHT - 20);
      }
      if (dx > 0) this.pSprite.setFlipX(false);
      else if (dx < 0) this.pSprite.setFlipX(true);
    }

    this.pSprite.setPosition(p.x, p.y);
    this.pName.setPosition(p.x, p.y - 40);
    this.drawBar(this.pHpGfx, p.x, p.y - 30, p.hp, p.maxHp, 40, 0x00FF00);
    this.cameras.main.scrollX = p.x - this.cameras.main.width / 2;
    this.cameras.main.scrollY = p.y - this.cameras.main.height / 2;

    // Auto-attack target
    if (p.target && !p.target.dead) {
      const dist = Phaser.Math.Distance.Between(p.x, p.y, p.target.x, p.target.y);
      if (dist <= SKILLS.basic.range + p.target.cfg.size) {
        if (!p.cds.auto || this.time.now >= p.cds.auto) {
          p.cds.auto = this.time.now + 800;
          const dmg = Math.max(1, Math.floor(p.atk - p.target.cfg.def * 0.5 + Phaser.Math.Between(-2, 2)));
          p.target.hp -= dmg;
          this.showEffect(p.target.x, p.target.y, 'e_slash');
          this.showDmg(p.target.x, p.target.y - 20, '' + dmg, '#FFF');
          if (p.target.hp <= 0) this.killMonster(p.target);
        }
      }
    }

    // MP regen
    if (this.gameTime % 2000 < delta) { p.mp = Math.min(p.maxMp, p.mp + 1); }

    // Monster AI
    for (const m of this.monsters) {
      if (m.dead) continue;
      const distToPlayer = Phaser.Math.Distance.Between(m.x, m.y, p.x, p.y);

      if (m.cfg.aggroRange > 0 && distToPlayer < m.cfg.aggroRange) {
        // Chase player
        m.state = 'chase';
        const d = Phaser.Math.Distance.Between(m.x, m.y, p.x, p.y);
        if (d > 35) {
          const mx = (p.x - m.x) / d * m.cfg.speed;
          const my = (p.y - m.y) / d * m.cfg.speed;
          const nc = Math.floor((m.x + mx) / TILE_SIZE);
          const nr = Math.floor((m.y + my) / TILE_SIZE);
          if (nc >= 0 && nc < MAP_COLS && nr >= 0 && nr < MAP_ROWS && !this.collMap[nr][nc]) {
            m.x += mx; m.y += my;
          }
        }
        // Attack
        if (distToPlayer < 45 && (!m.atkCd || this.time.now >= m.atkCd)) {
          m.atkCd = this.time.now + 1200;
          const dmg = Math.max(1, m.cfg.atk - p.def * 0.3 + Phaser.Math.Between(-2, 2));
          p.hp -= dmg;
          this.showDmg(p.x + Phaser.Math.Between(-15, 15), p.y - 20, '' + Math.floor(dmg), '#FF4444');
          if (p.hp <= 0) { p.hp = p.maxHp; p.mp = p.maxMp; p.x = MAP_WIDTH / 2; p.y = MAP_HEIGHT / 2; this.addMsg('你已阵亡，已自动复活'); }
        }
      } else {
        // Wander
        m.stateTimer -= delta;
        if (m.stateTimer <= 0) {
          m.stateTimer = Phaser.Math.Between(1000, 3000);
          m.wanderAngle = Math.random() * Math.PI * 2;
        }
        const wx = Math.cos(m.wanderAngle) * m.cfg.speed * 0.3;
        const wy = Math.sin(m.wanderAngle) * m.cfg.speed * 0.3;
        const nc = Math.floor((m.x + wx) / TILE_SIZE);
        const nr = Math.floor((m.y + wy) / TILE_SIZE);
        const distFromSpawn = Phaser.Math.Distance.Between(m.x, m.y, m.sx, m.sy);
        if (nc >= 0 && nc < MAP_COLS && nr >= 0 && nr < MAP_ROWS && !this.collMap[nr][nc] && distFromSpawn < 200) {
          m.x += wx; m.y += wy;
        } else { m.wanderAngle += Math.PI; }
      }

      m.sprite?.setPosition(m.x, m.y);
      m.nameTxt?.setPosition(m.x, m.y - m.cfg.size - 16);
      this.drawBar(m.hpGfx, m.x, m.y - m.cfg.size - 6, m.hp, m.maxHp, 36, 0xFF0000);
    }

    // Update tiles
    this.updateTiles();

    // Update UI
    this.updateUI();
  }
}

// ---- Game Config ----
const config = {
  type: Phaser.AUTO,
  width: 960,
  height: 640,
  parent: 'game-container',
  backgroundColor: '#000000',
  scene: [BootScene, GameScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  pixelArt: true,
};

const game = new Phaser.Game(config);
