// ==========================================
// 游戏地图管理 - 怪物刷新、实体管理
// ==========================================
import { gameData } from './GameData.js';
import {
  type MonsterDef, type MonsterSpawn, type Point,
  MonsterState, Direction,
} from './types.js';

// 地图上的怪物实例
export interface MonsterInstance {
  id: string;          // 实例唯一ID
  defId: number;       // 怪物定义ID
  def: MonsterDef;
  mapId: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  direction: Direction;
  state: MonsterState;
  targetId: string | null;  // 追击目标
  spawnX: number;           // 出生点X
  spawnY: number;           // 出生点Y
  spawnRange: number;       // 活动范围
  respawnTime: number;      // 重生时间(秒)
  deadAt: number | null;    // 死亡时间戳
  lastAttackAt: number;     // 上次攻击时间
  lastMoveAt: number;       // 上次移动时间
}

// 地图上的掉落物品
export interface DroppedItem {
  id: string;
  itemId: number;
  count: number;
  mapId: string;
  x: number;
  y: number;
  droppedAt: number;
  ownerPlayerId: string | null; // 归属玩家 (5秒保护期)
  expireAt: number;             // 过期时间 (60秒后消失)
}

// 地图实例
export class GameMapInstance {
  id: string;
  name: string;
  width: number;
  height: number;
  safeZone: boolean;
  monsters: Map<string, MonsterInstance> = new Map();
  droppedItems: Map<string, DroppedItem> = new Map();
  private monsterCounter = 0;
  private itemCounter = 0;
  private spawnTimers: NodeJS.Timeout[] = [];

  constructor(mapDef: { id: string; name: string; width: number; height: number; safeZone: boolean }) {
    this.id = mapDef.id;
    this.name = mapDef.name;
    this.width = mapDef.width;
    this.height = mapDef.height;
    this.safeZone = mapDef.safeZone;
  }

  // 初始化怪物刷新
  initSpawns(): void {
    const mapDef = gameData.getMap(this.id);
    if (!mapDef) return;

    for (const spawn of mapDef.monsters) {
      const monsterDef = gameData.getMonster(spawn.monsterId);
      if (!monsterDef) continue;

      // 按 count 刷新
      for (let i = 0; i < Math.min(spawn.count, 5); i++) {
        this.spawnMonster(spawn, monsterDef);
      }

      // 设置定时刷新
      const timer = setInterval(() => {
        this.respawnMonster(spawn, monsterDef);
      }, spawn.respawnTime * 1000);
      this.spawnTimers.push(timer);
    }
  }

  private spawnMonster(spawn: MonsterSpawn, def: MonsterDef): MonsterInstance | null {
    // 在刷新点附近随机位置
    const x = spawn.x + Math.floor(Math.random() * (spawn.range * 2 + 1)) - spawn.range;
    const y = spawn.y + Math.floor(Math.random() * (spawn.range * 2 + 1)) - spawn.range;

    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return null;

    this.monsterCounter++;
    const instance: MonsterInstance = {
      id: `m_${this.id}_${this.monsterCounter}`,
      defId: def.id,
      def,
      mapId: this.id,
      x: Math.max(0, Math.min(x, this.width - 1)),
      y: Math.max(0, Math.min(y, this.height - 1)),
      hp: def.hp,
      maxHp: def.hp,
      mp: def.mp,
      maxMp: def.mp,
      direction: Direction.Down,
      state: MonsterState.Idle,
      targetId: null,
      spawnX: spawn.x,
      spawnY: spawn.y,
      spawnRange: spawn.range,
      respawnTime: spawn.respawnTime,
      deadAt: null,
      lastAttackAt: 0,
      lastMoveAt: 0,
    };

    this.monsters.set(instance.id, instance);
    return instance;
  }

  private respawnMonster(spawn: MonsterSpawn, def: MonsterDef): void {
    // 检查当前存活数量
    let aliveCount = 0;
    for (const [, m] of this.monsters) {
      if (m.defId === def.id && m.state !== MonsterState.Dead) aliveCount++;
    }

    if (aliveCount < Math.min(spawn.count, 5)) {
      this.spawnMonster(spawn, def);
    }
  }

  // 获取附近的怪物 (用于客户端加载)
  getMonstersNear(x: number, y: number, range: number = 15): MonsterInstance[] {
    const result: MonsterInstance[] = [];
    for (const [, m] of this.monsters) {
      if (m.state === MonsterState.Dead) continue;
      const dist = Math.abs(m.x - x) + Math.abs(m.y - y);
      if (dist <= range) {
        result.push(m);
      }
    }
    return result;
  }

  // 获取附近的掉落物品
  getItemsNear(x: number, y: number, range: number = 15): DroppedItem[] {
    const result: DroppedItem[] = [];
    const now = Date.now();
    for (const [id, item] of this.droppedItems) {
      if (item.expireAt <= now) {
        this.droppedItems.delete(id);
        continue;
      }
      const dist = Math.abs(item.x - x) + Math.abs(item.y - y);
      if (dist <= range) {
        result.push(item);
      }
    }
    return result;
  }

  // 添加掉落物品
  addDroppedItem(itemId: number, count: number, x: number, y: number, ownerId: string | null): DroppedItem {
    this.itemCounter++;
    const now = Date.now();
    const item: DroppedItem = {
      id: `item_${this.id}_${this.itemCounter}`,
      itemId,
      count,
      mapId: this.id,
      x,
      y,
      droppedAt: now,
      ownerPlayerId: ownerId,
      expireAt: now + 60000, // 60秒后消失
    };
    this.droppedItems.set(item.id, item);
    return item;
  }

  // 拾取物品
  pickupItem(itemId: string, playerId: string): DroppedItem | null {
    const item = this.droppedItems.get(itemId);
    if (!item) return null;

    const now = Date.now();
    if (item.expireAt <= now) {
      this.droppedItems.delete(itemId);
      return null;
    }

    // 保护期内只能归属玩家拾取
    if (item.ownerPlayerId && item.ownerPlayerId !== playerId && now - item.droppedAt < 5000) {
      return null;
    }

    this.droppedItems.delete(itemId);
    return item;
  }

  // 清理过期物品
  cleanup(): void {
    const now = Date.now();
    for (const [id, item] of this.droppedItems) {
      if (item.expireAt <= now) {
        this.droppedItems.delete(id);
      }
    }
  }

  // 销毁
  destroy(): void {
    for (const timer of this.spawnTimers) {
      clearInterval(timer);
    }
    this.spawnTimers = [];
  }
}

// 地图管理器
class MapManager {
  private maps: Map<string, GameMapInstance> = new Map();

  initMaps(): void {
    const allMaps = gameData.getAllMaps();
    for (const mapDef of allMaps) {
      const instance = new GameMapInstance(mapDef);
      this.maps.set(mapDef.id, instance);
    }

    // 只初始化前几张地图的怪物 (避免内存占用过大)
    let count = 0;
    for (const [, map] of this.maps) {
      if (count >= 3) break;
      map.initSpawns();
      count++;
    }

    console.log(`[MapManager] Initialized ${this.maps.size} maps, ${count} with monsters`);
  }

  getMap(mapId: string): GameMapInstance | undefined {
    return this.maps.get(mapId);
  }

  getOrInitMap(mapId: string): GameMapInstance {
    let map = this.maps.get(mapId);
    if (!map) {
      const mapDef = gameData.getMap(mapId);
      if (mapDef) {
        map = new GameMapInstance(mapDef);
        map.initSpawns();
        this.maps.set(mapId, map);
      }
    }
    return map!;
  }

  getAllMaps(): GameMapInstance[] {
    return Array.from(this.maps.values());
  }

  // 定期清理
  startCleanup(): NodeJS.Timeout {
    return setInterval(() => {
      for (const [, map] of this.maps) {
        map.cleanup();
      }
    }, 10000); // 每10秒清理一次
  }
}

export const mapManager = new MapManager();
