import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 9091;
const server = http.createServer(app);

// ============================================================
// Middleware
// ============================================================
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ============================================================
// Game Data Loading
// ============================================================
const GAME_DATA_DIR = path.join(__dirname, '../../mir-tools/game-data');
const MAPS_DIR = path.join(__dirname, '../../mir2-database/Jev/Maps');

function loadJSON(filename: string): any {
  const filepath = path.join(GAME_DATA_DIR, filename);
  if (!fs.existsSync(filepath)) {
    console.warn(`[GameData] File not found: ${filepath}`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
  } catch (e) {
    console.error(`[GameData] Failed to parse ${filename}:`, e);
    return null;
  }
}

// Helper: parse numeric value from string or number
function num(val: any, fallback = 0): number {
  if (val === undefined || val === null || val === '') return fallback;
  const n = Number(val);
  return isNaN(n) ? fallback : n;
}

// Load raw data
const monstersRaw = loadJSON('monsters.json') || [];
const stditemsRaw = loadJSON('stditems.json') || [];
const magicsRaw = loadJSON('magics.json') || [];
const expListRaw = loadJSON('exp_list.json') || [];
const baseStatsRaw = loadJSON('base_stats.json') || {};
const monsterDropsRaw = loadJSON('monster_drops.json') || {};
const monsterSpawnsRaw = loadJSON('monster_spawns.json') || [];
const mapInfoRaw = loadJSON('map_info.json') || {};
const merchantsRaw = loadJSON('merchants.json') || [];

// ============================================================
// Normalize Data
// ============================================================

// Monsters: array of objects with string fields -> normalize to numbers
interface MonsterDef {
  id: number;
  name: string;
  level: number;
  hp: number;
  mp: number;
  ac: number;
  mac: number;
  dc: number;
  dcMax: number;
  mc: number;
  sc: number;
  exp: number;
}

const monstersData: MonsterDef[] = (Array.isArray(monstersRaw) ? monstersRaw : []).map((m: any) => ({
  id: num(m.Idx || m.ID || m.Id || m.id),
  name: String(m.Name || m.name || ''),
  level: num(m.Lvl || m.Level || 1),
  hp: num(m.HP || m.MaxHP || 50),
  mp: num(m.MP || 0),
  ac: num(m.AC || 0),
  mac: num(m.MAC || 0),
  dc: num(m.DC || 5),
  dcMax: num(m.DCMAX || m.DC || 5),
  mc: num(m.MC || 0),
  sc: num(m.SC || 0),
  exp: num(m.Exp || m.exp || 10),
}));

// Build lookup maps
const monstersById: Record<number, MonsterDef> = {};
const monstersByName: Record<string, MonsterDef> = {};
for (const m of monstersData) {
  if (m.id) monstersById[m.id] = m;
  if (m.name) monstersByName[m.name] = m;
}

// Items: array
const itemsData = (Array.isArray(stditemsRaw) ? stditemsRaw : []).map((item: any) => ({
  id: num(item.Id || item.ID || item.Idx || item.id),
  name: String(item.Name || item.name || ''),
  type: num(item.StdMode || 0),
  shape: num(item.Shape || 0),
  weight: num(item.Weight || 0),
  duramax: num(item.DuraMax || 0),
  ac: num(item.Ac || 0),
  mac: num(item.Mac || 0),
  dc: num(item.Dc || 0),
  mc: num(item.Mc || 0),
  sc: num(item.Sc || 0),
  price: num(item.Price || item.StdMode || 100),
}));

// Skills: array
const skillsData = (Array.isArray(magicsRaw) ? magicsRaw : []).map((s: any) => ({
  id: num(s.Id || s.ID || s.id),
  name: String(s.Name || s.name || ''),
  level: num(s.Level || 1),
  mpCost: num(s.Need || s.MPCost || 0),
}));

// Exp list: array or dict
const expList: number[] = [];
if (Array.isArray(expListRaw)) {
  for (const e of expListRaw) expList.push(num(e.Exp || e.exp || 0));
} else if (typeof expListRaw === 'object') {
  for (const key of Object.keys(expListRaw).sort((a, b) => num(a) - num(b))) {
    expList.push(num(expListRaw[key]));
  }
}

// Base stats: dict { warrior: {...}, wizard: {...}, taoist: {...} }
const baseStats: Record<string, any> = {};
for (const [cls, stats] of Object.entries(baseStatsRaw as Record<string, any>)) {
  baseStats[cls] = {
    hp: num(stats.HP || stats.hp || 100),
    mp: num(stats.MP || stats.mp || 20),
    hpGain: num(stats.LvGainHP || stats.hpGain || 4),
    mpGain: num(stats.LvGainMP || stats.mpGain || 3),
    baseAttack: num(stats.BaseAttack || stats.baseAttack || stats.Base || 15),
    baseDefence: num(stats.BaseDefence || stats.baseDefence || 10),
  };
}

// Map info: { maps: [...] } or dict
const mapInfoList: any[] = [];
if (mapInfoRaw.maps && Array.isArray(mapInfoRaw.maps)) {
  for (const m of mapInfoRaw.maps) {
    mapInfoList.push({
      id: String(m.file || m.id || m.mapId || ''),
      title: String(m.name || m.title || ''),
      flags: m.flags || [],
    });
  }
} else if (Array.isArray(mapInfoRaw)) {
  for (const m of mapInfoRaw) {
    mapInfoList.push({
      id: String(m.file || m.id || m.mapId || ''),
      title: String(m.name || m.title || ''),
      flags: m.flags || [],
    });
  }
}

const mapsById: Record<string, any> = {};
for (const m of mapInfoList) {
  if (m.id) mapsById[m.id] = m;
}

// Monster spawns: array
const monsterSpawns = (Array.isArray(monsterSpawnsRaw) ? monsterSpawnsRaw : []).map((s: any) => ({
  map: String(s.map || s.mapId || ''),
  x: num(s.x),
  y: num(s.y),
  monster: String(s.monster || s.name || ''),
  range: num(s.range || 5),
  count: num(s.count || 1),
  respawnTime: num(s.respawn_time || s.respawnTime || 60),
}));

// Monster drops: dict { monsterName: [{item, amount, chance}] }
const monsterDrops: Record<string, any[]> = {};
if (typeof monsterDropsRaw === 'object' && !Array.isArray(monsterDropsRaw)) {
  for (const [name, drops] of Object.entries(monsterDropsRaw)) {
    monsterDrops[name] = Array.isArray(drops) ? drops : [];
  }
}

console.log(`[GameData] Monsters: ${monstersData.length}, Items: ${itemsData.length}, Skills: ${skillsData.length}`);
console.log(`[GameData] Maps: ${mapInfoList.length}, Spawns: ${monsterSpawns.length}, Drop tables: ${Object.keys(monsterDrops).length}`);

// ============================================================
// Map Data - Generate simple walkable maps
// ============================================================
interface ParsedMap {
  id: string;
  width: number;
  height: number;
  tiles: number[]; // 0=walkable, 1=wall
}

const parsedMaps: Record<string, ParsedMap> = {};

function generateSimpleMap(mapId: string, width: number, height: number): ParsedMap {
  const tiles: number[] = new Array(width * height).fill(0);
  // Add border walls
  for (let x = 0; x < width; x++) {
    tiles[x] = 1; // top
    tiles[(height - 1) * width + x] = 1; // bottom
  }
  for (let y = 0; y < height; y++) {
    tiles[y * width] = 1; // left
    tiles[y * width + width - 1] = 1; // right
  }
  return { id: mapId, width, height, tiles };
}

// Generate maps for all known map IDs
function loadAllMaps() {
  // Generate maps for all map info entries
  for (const info of mapInfoList) {
    const mapId = info.id;
    if (parsedMaps[mapId]) continue;
    // Determine size based on map type
    let w = 100, h = 80;
    if (mapId.includes('Mine') || mapId.includes('D716')) { w = 80; h = 60; }
    if (mapId === '0' || mapId === '3') { w = 150; h = 120; }
    parsedMaps[mapId] = generateSimpleMap(mapId, w, h);
  }
  
  // Ensure default maps exist
  if (!parsedMaps['3']) parsedMaps['3'] = generateSimpleMap('3', 150, 120);
  if (!parsedMaps['0']) parsedMaps['0'] = generateSimpleMap('0', 120, 100);
  
  console.log(`[GameData] Generated ${Object.keys(parsedMaps).length} maps`);
}

loadAllMaps();

// ============================================================
// In-Memory Storage
// ============================================================
const usersStore = new Map<string, { username: string; password: string; token: string }>();
const charactersStore = new Map<string, any>(); // key: charId, value: character data
const playerByToken = new Map<string, string>(); // token -> username
const playerCharacters = new Map<string, string[]>(); // username -> charId[]
const playerSessions = new Map<string, any>(); // key: token, value: game session

// ============================================================
// Class Base Stats
// ============================================================
const CLASS_BASE_STATS: Record<string, any> = {
  warrior: {
    hp: 110, mp: 12, hpGain: 4, mpGain: 3,
    baseAttack: 15, baseDefence: 10,
  },
  wizard: {
    hp: 70, mp: 40, hpGain: 2, mpGain: 5,
    baseAttack: 8, baseDefence: 5,
  },
  taoist: {
    hp: 90, mp: 25, hpGain: 3, mpGain: 4,
    baseAttack: 10, baseDefence: 8,
  },
};

// Override with loaded data if available
for (const cls of ['warrior', 'wizard', 'taoist']) {
  if (baseStats[cls]) {
    CLASS_BASE_STATS[cls] = { ...CLASS_BASE_STATS[cls], ...baseStats[cls] };
  }
}

// ============================================================
// Combat Formulas (from Crystal source)
// ============================================================
function calcDamage(attacker: any, defender: any): number {
  const attackMin = num(attacker.DC || attacker.atk || 5);
  const attackMax = num(attacker.DCMax || attacker.atkMax || attackMin * 2);
  const defenceMin = num(defender.AC || defender.def || 0);
  const defenceMax = num(defender.ACMax || (defender.AC || 0) + (defender.MaxAC || 0));

  const attackPower = attackMin + Math.floor(Math.random() * Math.max(1, attackMax - attackMin + 1));
  const armour = defenceMin + Math.floor(Math.random() * Math.max(1, defenceMax - defenceMin + 1));

  // Accuracy vs Agility
  const accuracy = num(attacker.Accuracy || 1) + Math.random() * 2;
  const agility = num(defender.Agility || 1) + Math.random() * 2;
  if (accuracy < agility && Math.random() < 0.3) return 0; // Miss

  let damage = Math.max(0, attackPower - armour);

  // Critical hit (10% chance)
  if (Math.random() < 0.1) {
    damage = Math.floor(damage * 1.5);
  }

  // Level difference
  const levelOffset = num(attacker.Level || 1) - num(defender.Level || 1);
  if (levelOffset < 0) damage = Math.floor(damage * (1 - Math.min(0.7, Math.abs(levelOffset) * 0.1)));
  else if (levelOffset > 0) damage = Math.floor(damage * (1 + Math.min(0.3, levelOffset * 0.05)));

  return Math.max(0, damage);
}

function calcExpForLevel(level: number): number {
  if (level < 1) return 0;
  if (expList.length > 0 && level <= expList.length) {
    return expList[level - 1] || level * level * 100;
  }
  return level * level * 100;
}

// ============================================================
// Auth API
// ============================================================
app.post('/api/v1/auth/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: '用户名和密码不能为空' });
  if (username.length < 2 || username.length > 20) return res.status(400).json({ error: '用户名长度2-20' });
  if (password.length < 3) return res.status(400).json({ error: '密码至少3位' });
  if (usersStore.has(username)) return res.status(400).json({ error: '用户名已存在' });

  const token = crypto.randomBytes(32).toString('hex');
  usersStore.set(username, { username, password, token });
  playerByToken.set(token, username);
  playerCharacters.set(username, []);
  res.json({ success: true, token, username });
});

app.post('/api/v1/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: '请输入用户名和密码' });
  const user = usersStore.get(username);
  if (!user || user.password !== password) return res.status(401).json({ error: '用户名或密码错误' });
  res.json({ success: true, token: user.token, username });
});

// ============================================================
// Character API
// ============================================================

// Get characters for a player
app.get('/api/v1/characters', (req, res) => {
  const { playerId } = req.query;
  if (!playerId) return res.status(400).json({ error: '缺少playerId' });

  const username = String(playerId);
  const charIds = playerCharacters.get(username) || [];
  const characters = charIds
    .map(id => charactersStore.get(id))
    .filter(Boolean);

  res.json({ characters });
});

// Create character
app.post('/api/v1/character/create', (req, res) => {
  const { playerId, name, class: playerClass } = req.body;
  if (!playerId || !name || !playerClass) return res.status(400).json({ error: '缺少参数' });
  if (!['warrior', 'wizard', 'taoist'].includes(playerClass)) {
    return res.status(400).json({ error: '无效职业' });
  }

  const username = String(playerId);
  const charIds = playerCharacters.get(username) || [];
  if (charIds.length >= 3) return res.status(400).json({ error: '最多创建3个角色' });

  const base = CLASS_BASE_STATS[playerClass] || CLASS_BASE_STATS.warrior;
  const charId = crypto.randomBytes(8).toString('hex');

  // Find spawn position from map info
  let spawnX = 50, spawnY = 50;
  let spawnMapId = '0';

  // Try to find a good spawn point
  const spawnForMap = monsterSpawns.find(s => s.map === '0' || s.map === '3');
  if (spawnForMap) {
    spawnX = spawnForMap.x;
    spawnY = spawnForMap.y;
    spawnMapId = spawnForMap.map;
  }

  // Use center of parsed map if available
  const parsedMap = parsedMaps[spawnMapId] || parsedMaps['0'] || parsedMaps['3'];
  if (parsedMap) {
    spawnX = Math.floor(parsedMap.width / 2);
    spawnY = Math.floor(parsedMap.height / 2);
    // Find walkable tile near center
    for (let r = 0; r < 20; r++) {
      let found = false;
      for (let dx = -r; dx <= r && !found; dx++) {
        for (let dy = -r; dy <= r && !found; dy++) {
          const tx = spawnX + dx;
          const ty = spawnY + dy;
          if (tx >= 0 && tx < parsedMap.width && ty >= 0 && ty < parsedMap.height) {
            if (parsedMap.tiles[ty * parsedMap.width + tx] === 0) {
              spawnX = tx;
              spawnY = ty;
              found = true;
            }
          }
        }
      }
      if (found) break;
    }
  }

  const character = {
    id: charId,
    playerId: username,
    name,
    class: playerClass,
    level: 1,
    exp: 0,
    hp: base.hp,
    maxHp: base.hp,
    mp: base.mp,
    maxMp: base.mp,
    DC: base.baseAttack,
    DCMax: Math.floor(base.baseAttack * 1.5),
    MC: Math.floor(base.baseAttack * 0.7),
    SC: Math.floor(base.baseAttack * 0.5),
    AC: base.baseDefence,
    ACMax: Math.floor(base.baseDefence * 0.5),
    MAC: Math.floor(base.baseDefence * 0.8),
    MACMax: Math.floor(base.baseDefence * 0.3),
    Accuracy: 1,
    Agility: 1,
    x: spawnX,
    y: spawnY,
    mapId: spawnMapId,
    inventory: [],
    equipment: {},
    gold: 100,
    createdAt: Date.now(),
  };

  charactersStore.set(charId, character);
  charIds.push(charId);
  playerCharacters.set(username, charIds);

  res.json({ success: true, character });
});

// Get single character
app.get('/api/v1/character/:charId', (req, res) => {
  const char = charactersStore.get(req.params.charId);
  if (!char) return res.status(404).json({ error: '角色不存在' });
  res.json(char);
});

// ============================================================
// Game Data API
// ============================================================

// Get maps list
app.get('/api/v1/maps', (_req, res) => {
  const maps = Object.entries(parsedMaps).map(([id, m]) => ({
    id,
    width: m.width,
    height: m.height,
    title: mapsById[id]?.title || mapsById[id]?.name || `地图${id}`,
  }));
  // Sort: put common maps first
  const priority = ['0', '3', '4', '10', '11', '20', '100', '101'];
  maps.sort((a, b) => {
    const ai = priority.indexOf(a.id);
    const bi = priority.indexOf(b.id);
    if (ai >= 0 && bi >= 0) return ai - bi;
    if (ai >= 0) return -1;
    if (bi >= 0) return 1;
    return a.id.localeCompare(b.id);
  });
  res.json(maps.slice(0, 50));
});

// Get single map info
app.get('/api/v1/maps/:id', (req, res) => {
  const map = parsedMaps[req.params.id];
  if (!map) return res.status(404).json({ error: '地图数据不存在' });
  res.json({
    id: req.params.id,
    width: map.width,
    height: map.height,
    title: mapsById[req.params.id]?.title || mapsById[req.params.id]?.name || `地图${req.params.id}`,
  });
});

// Get monsters for a specific map
app.get('/api/v1/maps/:id/monsters', (req, res) => {
  const mapId = req.params.id;
  const spawns = monsterSpawns.filter(s => s.map === mapId);
  res.json(spawns.slice(0, 50));
});

// Get map terrain data
app.get('/api/v1/maps/:id/terrain', (req, res) => {
  const map = parsedMaps[req.params.id];
  if (!map) return res.status(404).json({ error: '地图数据不存在' });
  res.json({
    id: map.id,
    width: map.width,
    height: map.height,
    tiles: map.tiles,
  });
});

// Health check
app.get('/api/v1/health', (_req, res) => {
  res.json({
    status: 'ok',
    maps: Object.keys(parsedMaps).length,
    monsters: monstersData.length,
    items: itemsData.length,
    skills: skillsData.length,
    players: playerSessions.size,
  });
});

// Game data info
app.get('/api/v1/game/info', (_req, res) => {
  res.json({
    monsters: monstersData.length,
    items: itemsData.length,
    skills: skillsData.length,
    maps: Object.keys(parsedMaps).length,
    spawns: monsterSpawns.length,
  });
});

// ============================================================
// Static Files
// ============================================================
const mirGamePath = path.join(__dirname, '../public/mir-game');
app.use('/mir-game', express.static(mirGamePath));
app.get('/', (_req, res) => res.redirect('/mir-game/'));

// ============================================================
// WebSocket Game Server
// ============================================================
const wss = new WebSocketServer({ server, path: '/ws' });

interface GameSession {
  ws: WebSocket;
  token: string;
  username: string;
  charId: string;
  character: any;
  mapId: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  level: number;
  exp: number;
  lastAttack: number;
  targetId: string | null;
}

interface MonsterInstance {
  id: string;
  monsterDef: MonsterDef;
  mapId: string;
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  hp: number;
  maxHp: number;
  state: 'idle' | 'patrol' | 'chase' | 'attack' | 'dead';
  lastMove: number;
  lastAttack: number;
  deathTime: number;
}

// Active monsters per map
const mapMonsters: Record<string, MonsterInstance[]> = {};

function getMapMonsterList(mapId: string): MonsterInstance[] {
  if (!mapMonsters[mapId]) {
    spawnMonstersForMap(mapId);
  }
  return mapMonsters[mapId] || [];
}

function spawnMonstersForMap(mapId: string) {
  const map = parsedMaps[mapId];
  if (!map) {
    mapMonsters[mapId] = [];
    return;
  }

  const list: MonsterInstance[] = [];

  // Find walkable tiles
  const walkableTiles: number[] = [];
  for (let i = 0; i < map.tiles.length; i++) {
    if (map.tiles[i] === 0) walkableTiles.push(i);
  }
  if (walkableTiles.length === 0) {
    mapMonsters[mapId] = [];
    return;
  }

  // Find spawn data for this map
  const spawns = monsterSpawns.filter(s => s.map === mapId);

  // Determine monster count
  const monsterCount = Math.min(30, Math.max(5, Math.floor(walkableTiles.length / 200)));

  for (let i = 0; i < monsterCount; i++) {
    let tx: number, ty: number;

    if (spawns.length > 0) {
      const spawn = spawns[i % spawns.length];
      tx = spawn.x + Math.floor(Math.random() * spawn.range * 2) - spawn.range;
      ty = spawn.y + Math.floor(Math.random() * spawn.range * 2) - spawn.range;
      tx = Math.max(0, Math.min(map.width - 1, tx));
      ty = Math.max(0, Math.min(map.height - 1, ty));
      // Ensure walkable
      if (map.tiles[ty * map.width + tx] !== 0) {
        const tileIdx = walkableTiles[Math.floor(Math.random() * walkableTiles.length)];
        tx = tileIdx % map.width;
        ty = Math.floor(tileIdx / map.width);
      }
    } else {
      const tileIdx = walkableTiles[Math.floor(Math.random() * walkableTiles.length)];
      tx = tileIdx % map.width;
      ty = Math.floor(tileIdx / map.width);
    }

    // Pick monster type
    let monsterDef: MonsterDef | null = null;
    if (spawns.length > 0) {
      const spawn = spawns[i % spawns.length];
      monsterDef = monstersByName[spawn.monster] || null;
    }
    if (!monsterDef) {
      // Random monster from available
      const idx = Math.floor(Math.random() * Math.min(monstersData.length, 50));
      monsterDef = monstersData[idx] || null;
    }
    if (!monsterDef) continue;

    list.push({
      id: `m_${mapId}_${i}_${Date.now()}`,
      monsterDef,
      mapId,
      x: tx,
      y: ty,
      homeX: tx,
      homeY: ty,
      hp: monsterDef.hp,
      maxHp: monsterDef.hp,
      state: 'idle',
      lastMove: Date.now(),
      lastAttack: 0,
      deathTime: 0,
    });
  }

  mapMonsters[mapId] = list;
  console.log(`[GameMap] Spawned ${list.length} monsters on map ${mapId}`);
}

function isWalkable(mapId: string, x: number, y: number): boolean {
  const map = parsedMaps[mapId];
  if (!map) return x >= 0 && y >= 0; // No map data = allow
  if (x < 0 || x >= map.width || y < 0 || y >= map.height) return false;
  return map.tiles[y * map.width + x] === 0;
}

wss.on('connection', (ws: WebSocket) => {
  let session: GameSession | null = null;

  ws.on('message', (data: Buffer) => {
    try {
      const msg = JSON.parse(data.toString());

      switch (msg.type) {
        case 'join': {
          const { token, characterId, mapId } = msg;

          // Find user by token
          const username = playerByToken.get(token);
          if (!username) {
            ws.send(JSON.stringify({ type: 'error', message: '无效的token' }));
            return;
          }

          // Find character
          let character: any = null;
          if (characterId) {
            character = charactersStore.get(characterId);
          }
          if (!character) {
            // Use first character
            const charIds = playerCharacters.get(username) || [];
            if (charIds.length > 0) character = charactersStore.get(charIds[0]);
          }
          if (!character) {
            ws.send(JSON.stringify({ type: 'error', message: '角色不存在' }));
            return;
          }

          session = {
            ws,
            token,
            username,
            charId: character.id,
            character,
            mapId: mapId || character.mapId || '0',
            x: character.x || 50,
            y: character.y || 50,
            hp: character.hp || character.maxHp,
            maxHp: character.maxHp,
            mp: character.mp || character.maxMp,
            maxMp: character.maxMp,
            level: character.level || 1,
            exp: character.exp || 0,
            lastAttack: 0,
            targetId: null,
          };

          playerSessions.set(token, session);

          // Ensure position is walkable
          if (!isWalkable(session.mapId, session.x, session.y)) {
            const map = parsedMaps[session.mapId];
            if (map) {
              for (let r = 1; r < 30; r++) {
                let found = false;
                for (let dx = -r; dx <= r && !found; dx++) {
                  for (let dy = -r; dy <= r && !found; dy++) {
                    if (isWalkable(session.mapId, session.x + dx, session.y + dy)) {
                      session.x += dx;
                      session.y += dy;
                      found = true;
                    }
                  }
                }
                if (found) break;
              }
            }
          }

          // Get map info
          const map = parsedMaps[session.mapId];
          const monsters = getMapMonsterList(session.mapId).filter(m => m.state !== 'dead');

          // Send initial state
          ws.send(JSON.stringify({
            type: 'gameState',
            player: {
              x: session.x,
              y: session.y,
              hp: session.hp,
              maxHp: session.maxHp,
              mp: session.mp,
              maxMp: session.maxMp,
              level: session.level,
              exp: session.exp,
              expNext: calcExpForLevel(session.level),
              name: character.name,
              class: character.class,
              atk: character.DC,
              def: character.AC,
            },
            map: {
              id: session.mapId,
              width: map?.width || 100,
              height: map?.height || 100,
              name: mapsById[session.mapId]?.title || `地图${session.mapId}`,
            },
            monsters: monsters.map(m => ({
              id: m.id,
              name: m.monsterDef.name,
              x: m.x,
              y: m.y,
              hp: m.hp,
              maxHp: m.maxHp,
              level: m.monsterDef.level,
            })),
          }));
          break;
        }

        case 'move': {
          if (!session) return;
          const { x, y } = msg;
          if (typeof x !== 'number' || typeof y !== 'number') return;
          if (isWalkable(session.mapId, Math.floor(x), Math.floor(y))) {
            session.x = Math.floor(x);
            session.y = Math.floor(y);
          }
          break;
        }

        case 'attack': {
          if (!session) return;
          const now = Date.now();
          if (now - session.lastAttack < 500) return;
          session.lastAttack = now;

          const { targetId } = msg;
          const monsters = getMapMonsterList(session.mapId);
          const monster = monsters.find(m => m.id === targetId);
          if (!monster || monster.state === 'dead') return;

          // Check distance
          const dist = Math.abs(session.x - monster.x) + Math.abs(session.y - monster.y);
          if (dist > 3) {
            ws.send(JSON.stringify({ type: 'systemMsg', message: '距离太远，无法攻击' }));
            return;
          }

          // Calculate damage
          const damage = calcDamage(
            { DC: session.character.DC, DCMax: session.character.DCMax, Level: session.level, Accuracy: session.character.Accuracy },
            { AC: monster.monsterDef.ac, ACMax: monster.monsterDef.ac + 5, Level: monster.monsterDef.level, Agility: 1 },
          );

          monster.hp -= damage;

          if (damage > 0) {
            ws.send(JSON.stringify({
              type: 'damage',
              targetId,
              damage,
              isCrit: damage > (session.character.DC || 5),
              x: monster.x,
              y: monster.y,
            }));
          } else {
            ws.send(JSON.stringify({ type: 'miss', targetId, x: monster.x, y: monster.y }));
          }

          if (monster.hp <= 0) {
            monster.state = 'dead';
            monster.deathTime = now;

            // Grant exp
            const expGain = monster.monsterDef.exp;
            session.exp += expGain;
            const expNeeded = calcExpForLevel(session.level);
            let leveledUp = false;
            while (session.level < 100 && session.exp >= calcExpForLevel(session.level)) {
              session.exp -= calcExpForLevel(session.level);
              session.level++;
              leveledUp = true;

              const base = CLASS_BASE_STATS[session.character.class] || CLASS_BASE_STATS.warrior;
              session.maxHp += base.hpGain;
              session.maxMp += base.mpGain;
              session.hp = session.maxHp;
              session.mp = session.maxMp;
              session.character.DC += Math.floor(base.baseAttack * 0.1) + 1;
              session.character.DCMax = Math.floor(session.character.DC * 1.5);
              session.character.AC += 1;
              session.character.ACMax = Math.floor(session.character.AC * 0.5);
            }

            // Update character
            session.character.level = session.level;
            session.character.exp = session.exp;
            session.character.hp = session.hp;
            session.character.maxHp = session.maxHp;
            session.character.mp = session.mp;
            session.character.maxMp = session.maxMp;

            // Gold drop
            const goldDrop = Math.floor(Math.random() * monster.monsterDef.level * 10) + 1;
            session.character.gold = (session.character.gold || 0) + goldDrop;

            ws.send(JSON.stringify({
              type: 'monsterDead',
              targetId,
              exp: expGain,
              gold: goldDrop,
              level: session.level,
              hp: session.hp,
              maxHp: session.maxHp,
              expTotal: session.exp,
              expNext: calcExpForLevel(session.level),
              leveledUp,
            }));

            // Respawn after 30 seconds
            setTimeout(() => {
              const rMap = parsedMaps[monster.mapId];
              if (rMap) {
                const wTiles: number[] = [];
                for (let i = 0; i < rMap.tiles.length; i++) {
                  if (rMap.tiles[i] === 0) wTiles.push(i);
                }
                if (wTiles.length > 0) {
                  const tileIdx = wTiles[Math.floor(Math.random() * wTiles.length)];
                  monster.x = tileIdx % rMap.width;
                  monster.y = Math.floor(tileIdx / rMap.width);
                  monster.homeX = monster.x;
                  monster.homeY = monster.y;
                }
              }
              monster.hp = monster.monsterDef.hp;
              monster.maxHp = monster.hp;
              monster.state = 'idle';
            }, 30000);
          } else {
            // Monster fights back
            const monsterDmg = calcDamage(
              { DC: monster.monsterDef.dc, DCMax: monster.monsterDef.dcMax, Level: monster.monsterDef.level, Accuracy: 1 },
              { AC: session.character.AC, ACMax: session.character.ACMax, Level: session.level, Agility: session.character.Agility },
            );
            session.hp -= monsterDmg;

            if (monsterDmg > 0) {
              ws.send(JSON.stringify({
                type: 'playerHit',
                damage: monsterDmg,
                hp: session.hp,
                maxHp: session.maxHp,
              }));
            }

            if (session.hp <= 0) {
              session.hp = Math.floor(session.maxHp * 0.3);
              session.character.hp = session.hp;
              ws.send(JSON.stringify({
                type: 'playerDead',
                hp: session.hp,
                maxHp: session.maxHp,
                message: '你已阵亡，已自动复活',
              }));
            }
          }

          // Send monster update
          ws.send(JSON.stringify({
            type: 'monsterUpdate',
            targetId: monster.id,
            hp: monster.hp,
            maxHp: monster.maxHp,
            x: monster.x,
            y: monster.y,
          }));
          break;
        }

        case 'getMapData': {
          if (!session) return;
          const mapId = msg.mapId || session.mapId;
          const map = parsedMaps[mapId];
          if (!map) {
            ws.send(JSON.stringify({ type: 'error', message: '地图数据不存在' }));
            return;
          }
          // RLE encode
          const rle: number[] = [];
          let current = map.tiles[0];
          let count = 1;
          for (let i = 1; i < map.tiles.length; i++) {
            if (map.tiles[i] === current && count < 255) {
              count++;
            } else {
              rle.push(current, count);
              current = map.tiles[i];
              count = 1;
            }
          }
          rle.push(current, count);

          ws.send(JSON.stringify({
            type: 'mapData',
            id: map.id,
            width: map.width,
            height: map.height,
            rle,
          }));
          break;
        }

        case 'monster_killed': {
          // Client-side kill notification (for client-driven combat)
          if (!session) return;
          // Just acknowledge
          break;
        }
      }
    } catch (e) {
      console.error('[WS] Error:', e);
    }
  });

  ws.on('close', () => {
    if (session) {
      // Save character state
      const char = charactersStore.get(session.charId);
      if (char) {
        char.x = session.x;
        char.y = session.y;
        char.hp = session.hp;
        char.mp = session.mp;
        char.level = session.level;
        char.exp = session.exp;
        char.maxHp = session.maxHp;
        char.maxMp = session.maxMp;
        char.DC = session.character.DC;
        char.DCMax = session.character.DCMax;
        char.AC = session.character.AC;
        char.ACMax = session.character.ACMax;
      }
      playerSessions.delete(session.token);
    }
  });
});

// Monster AI tick (every 2 seconds)
setInterval(() => {
  for (const [mapId, monsters] of Object.entries(mapMonsters)) {
    const map = parsedMaps[mapId];
    if (!map) continue;

    for (const monster of monsters) {
      if (monster.state === 'dead') continue;

      const now = Date.now();
      if (now - monster.lastMove < 2000) continue;
      monster.lastMove = now;

      // Check if any player is nearby
      let nearestPlayer: GameSession | null = null;
      let nearestDist = Infinity;
      for (const [, sess] of playerSessions) {
        if (sess.mapId !== mapId) continue;
        const d = Math.abs(sess.x - monster.x) + Math.abs(sess.y - monster.y);
        if (d < nearestDist) {
          nearestDist = d;
          nearestPlayer = sess;
        }
      }

      if (nearestPlayer && nearestDist < 8) {
        // Chase player
        monster.state = 'chase';
        const dx = Math.sign(nearestPlayer.x - monster.x);
        const dy = Math.sign(nearestPlayer.y - monster.y);

        if (nearestDist <= 1) {
          // Attack player
          if (now - monster.lastAttack > 1500) {
            monster.lastAttack = now;
            const damage = calcDamage(
              { DC: monster.monsterDef.dc, DCMax: monster.monsterDef.dcMax, Level: monster.monsterDef.level, Accuracy: 1 },
              { AC: nearestPlayer.character.AC, ACMax: nearestPlayer.character.ACMax, Level: nearestPlayer.level, Agility: nearestPlayer.character.Agility },
            );
            if (damage > 0) {
              nearestPlayer.hp -= damage;
              nearestPlayer.ws.send(JSON.stringify({
                type: 'playerHit',
                damage,
                hp: nearestPlayer.hp,
                maxHp: nearestPlayer.maxHp,
              }));
              if (nearestPlayer.hp <= 0) {
                nearestPlayer.hp = Math.floor(nearestPlayer.maxHp * 0.3);
                nearestPlayer.character.hp = nearestPlayer.hp;
                nearestPlayer.ws.send(JSON.stringify({
                  type: 'playerDead',
                  hp: nearestPlayer.hp,
                  maxHp: nearestPlayer.maxHp,
                  message: '你已阵亡，已自动复活',
                }));
              }
            }
          }
        } else {
          // Move toward player
          if (dx !== 0) {
            const nx = monster.x + dx;
            if (nx >= 0 && nx < map.width && map.tiles[monster.y * map.width + nx] === 0) {
              monster.x = nx;
            }
          } else if (dy !== 0) {
            const ny = monster.y + dy;
            if (ny >= 0 && ny < map.height && map.tiles[ny * map.width + monster.x] === 0) {
              monster.y = ny;
            }
          }
        }
      } else {
        // Idle patrol
        monster.state = 'idle';
        const pdx = Math.floor(Math.random() * 3) - 1;
        const pdy = Math.floor(Math.random() * 3) - 1;
        const nx = monster.x + pdx;
        const ny = monster.y + pdy;

        // Don't wander too far from home
        if (Math.abs(nx - monster.homeX) < 8 && Math.abs(ny - monster.homeY) < 8 &&
            nx >= 0 && nx < map.width && ny >= 0 && ny < map.height &&
            map.tiles[ny * map.width + nx] === 0) {
          monster.x = nx;
          monster.y = ny;
        }
      }
    }
  }
}, 2000);

// ============================================================
// Start Server
// ============================================================
server.listen(port, () => {
  console.log(`[Server] Running on port ${port}`);
  console.log(`[Server] Maps: ${Object.keys(parsedMaps).length}`);
  console.log(`[Server] Monsters: ${monstersData.length}`);
  console.log(`[Server] Items: ${itemsData.length}`);
  console.log(`[Server] Skills: ${skillsData.length}`);
  console.log(`[Server] Game URL: http://localhost:${port}/mir-game/`);
});
