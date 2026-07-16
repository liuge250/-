// ==========================================
// 游戏数据管理 - 加载已提取的传奇数据
// ==========================================
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  type MonsterDef, type ItemDef, type SkillDef, type MapDef,
  type MonsterSpawn, type MapPortal, type Stats,
  MirClass, ItemType, ItemQuality, createDefaultStats, CLASS_BASE_STATS,
} from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 游戏数据目录
const DATA_DIR = path.resolve(__dirname, '../../../mir-tools/game-data');

class GameDataManager {
  private monsters: Map<number, MonsterDef> = new Map();
  private items: Map<number, ItemDef> = new Map();
  private skills: Map<number, SkillDef> = new Map();
  private maps: Map<string, MapDef> = new Map();
  private expTable: number[] = [];
  private initialized = false;

  init(): void {
    if (this.initialized) return;

    console.log('[GameData] Loading game data...');

    this.loadMonsters();
    this.loadItems();
    this.loadSkills();
    this.loadMaps();
    this.loadExpTable();
    this.loadBaseStats();

    this.initialized = true;
    console.log(`[GameData] Loaded: ${this.monsters.size} monsters, ${this.items.size} items, ${this.skills.size} skills, ${this.maps.size} maps`);
  }

  private loadJSON(filename: string): any {
    const filePath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(filePath)) {
      console.warn(`[GameData] File not found: ${filePath}`);
      return null;
    }
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (e) {
      console.error(`[GameData] Failed to parse ${filename}:`, e);
      return null;
    }
  }

  private loadMonsters(): void {
    const data = this.loadJSON('monsters.json');
    if (!data) return;

    const dropsData = this.loadJSON('monster_drops.json');
    const spawnsData = this.loadJSON('monster_spawns.json');

    // 构建怪物名称到ID的映射
    const nameToId = new Map<string, number>();

    // 构建掉落表索引 (dropsData 是 dict, key=怪物名称)
    const dropMap = new Map<string, any[]>();
    if (dropsData && typeof dropsData === 'object' && !Array.isArray(dropsData)) {
      for (const [monsterName, drops] of Object.entries(dropsData)) {
        if (Array.isArray(drops)) {
          dropMap.set(monsterName, drops.map((d: any) => ({
            itemName: d.item || d.name || '',
            amount: d.amount || 1,
            chance: this.parseChance(d.chance || '10/100'),
          })));
        }
      }
    }

    // 第一遍：建立名称到ID的映射
    for (const m of data) {
      const id = parseInt(m.Idx || m.id || '0', 10) || 0;
      const name = m.Name || m.name || `Monster_${id}`;
      nameToId.set(name, id);
    }

    for (const m of data) {
      const id = parseInt(m.Idx || m.id || '0', 10) || 0;
      const name = m.Name || m.name || `Monster_${id}`;

      // 通过名称查找掉落表
      const drops = (dropMap.get(name) || []).map((d: any) => ({
        itemName: d.itemName,
        amount: d.amount || 1,
        chance: d.chance,
      }));

      // 解析属性 (传奇原始格式: AC="0" 表示 0-0, DC="1" DCMAX="1" 表示 1-1)
      const ac = parseInt(m.AC || '0', 10);
      const mac = parseInt(m.MAC || '0', 10);
      const dc = parseInt(m.DC || '0', 10);
      const dcMax = parseInt(m.DCMAX || m.DC || '0', 10);
      const mc = parseInt(m.MC || '0', 10);
      const sc = parseInt(m.SC || '0', 10);

      const monster: MonsterDef = {
        id,
        name,
        level: parseInt(m.Lvl || m.level || '1', 10) || 1,
        hp: parseInt(m.HP || m.hp || '100', 10) || 100,
        mp: parseInt(m.MP || m.mp || '0', 10) || 0,
        minAC: ac,
        maxAC: ac, // 简化：AC 表示固定值
        minMAC: mac,
        maxMAC: mac,
        minDC: dc,
        maxDC: dcMax,
        minMC: mc,
        maxMC: mc,
        minSC: sc,
        maxSC: sc,
        accuracy: parseInt(m.HIT || m.accuracy || '5', 10) || 5,
        agility: parseInt(m.SPEED || m.agility || '5', 10) || 5,
        attackSpeed: parseInt(m.ATTACK_SPD || m.attackSpeed || '3000', 10) || 3000,
        moveSpeed: parseInt(m.WALK_SPD || m.moveSpeed || '500', 10) || 500,
        viewRange: parseInt(m.ViewRange || m.viewRange || '7', 10) || 7,
        aiType: m.aiType || 'normal',
        experience: parseInt(m.Exp || m.experience || '0', 10) || 0,
        drops,
      };
      this.monsters.set(id, monster);
    }

    // 保存名称到ID的映射供后续使用
    this._monsterNameToId = nameToId;
  }

  private _monsterNameToId = new Map<string, number>();

  // 解析概率字符串 "10/20" -> 0.5
  private parseChance(chance: string | number): number {
    if (typeof chance === 'number') return chance;
    const parts = chance.split('/');
    if (parts.length === 2) {
      const numerator = parseFloat(parts[0]);
      const denominator = parseFloat(parts[1]);
      if (denominator > 0) return numerator / denominator;
    }
    return parseFloat(chance) || 0.01;
  }

  private loadItems(): void {
    const data = this.loadJSON('stditems.json');
    if (!data) return;

    for (const item of data) {
      const id = item.id || item.ID || item.StdMode;
      const type = this.resolveItemType(item);
      const quality = this.resolveItemQuality(item);

      const stats = this.resolveItemStats(item);

      const itemDef: ItemDef = {
        id,
        name: item.name || item.Name || `Item_${id}`,
        type,
        quality,
        shape: item.shape || item.Shape || 0,
        weight: item.weight || item.Weight || 1,
        image: item.image || item.Image || item.Looks || 0,
        requiredClass: item.required_class || item.requiredClass || item.NeedIdentify || 0,
        requiredLevel: item.required_level || item.requiredLevel || item.Need || 0,
        bindOnPickup: item.bind === true || item.BindOnPickup === true,
        stackable: type === ItemType.Potion || type === ItemType.Material || type === ItemType.Gold,
        maxStack: type === ItemType.Gold ? 999999999 : type === ItemType.Potion ? 99 : 1,
        price: item.price || item.Price || item.Weight * 10 || 100,
        stats,
        description: item.description || item.Name || '',
      };
      this.items.set(id, itemDef);
    }
  }

  private resolveItemType(item: any): ItemType {
    const stdMode = item.StdMode || item.stdMode || item.std_mode;
    const type = item.type || item.Type;
    if (type) {
      const typeMap: Record<string, ItemType> = {
        weapon: ItemType.Weapon, armor: ItemType.Armor, helmet: ItemType.Helmet,
        boots: ItemType.Boots, necklace: ItemType.Necklace, ring: ItemType.Ring,
        bracelet: ItemType.Bracelet, belt: ItemType.Belt, stone: ItemType.Stone,
        potion: ItemType.Potion, scroll: ItemType.Scroll, material: ItemType.Material,
      };
      if (typeMap[type]) return typeMap[type];
    }
    // 根据 StdMode 推断 (传奇经典编码)
    if (stdMode >= 1 && stdMode <= 5) return ItemType.Weapon;
    if (stdMode >= 6 && stdMode <= 9) return ItemType.Armor;
    if (stdMode >= 10 && stdMode <= 11) return ItemType.Helmet;
    if (stdMode >= 12 && stdMode <= 13) return ItemType.Boots;
    if (stdMode >= 19 && stdMode <= 21) return ItemType.Necklace;
    if (stdMode >= 22 && stdMode <= 23) return ItemType.Ring;
    if (stdMode >= 24 && stdMode <= 26) return ItemType.Bracelet;
    if (stdMode === 27) return ItemType.Belt;
    if (stdMode === 30 || stdMode === 31) return ItemType.Potion;
    if (stdMode >= 40 && stdMode <= 45) return ItemType.Scroll;
    return ItemType.Material;
  }

  private resolveItemQuality(item: any): ItemQuality {
    const quality = item.quality ?? item.Quality;
    if (quality !== undefined && quality >= 0 && quality <= 4) return quality;
    // 根据 AniCount / Shape 推断
    const aniCount = item.AniCount || item.aniCount || 0;
    if (aniCount >= 5) return ItemQuality.Legendary;
    if (aniCount >= 4) return ItemQuality.Epic;
    if (aniCount >= 3) return ItemQuality.Rare;
    if (aniCount >= 2) return ItemQuality.Superior;
    return ItemQuality.Common;
  }

  private resolveItemStats(item: any): Partial<Stats> {
    const stats: Partial<Stats> = {};
    const s = (key: string, statKey: keyof Stats) => {
      const val = item[key];
      if (val !== undefined && val !== 0) (stats as any)[statKey] = val;
    };
    s('MinDC', 'MinDC'); s('MaxDC', 'MaxDC');
    s('MinMC', 'MinMC'); s('MaxMC', 'MaxMC');
    s('MinSC', 'MinSC'); s('MaxSC', 'MaxSC');
    s('MinAC', 'MinAC'); s('MaxAC', 'MaxAC');
    s('MinMAC', 'MinMAC'); s('MaxMAC', 'MaxMAC');
    s('Accuracy', 'Accuracy'); s('Agility', 'Agility');
    s('AttackSpeed', 'AttackSpeed'); s('HP', 'MaxHP'); s('MP', 'MaxMP');
    s('MagicResist', 'MagicResist'); s('PoisonResist', 'PoisonResist');
    s('HealthRecovery', 'HealthRecovery'); s('ManaRecovery', 'ManaRecovery');
    s('CriticalRate', 'CriticalRate'); s('Lucky', 'Lucky');
    return stats;
  }

  private loadSkills(): void {
    const data = this.loadJSON('magics.json');
    if (!data) return;

    for (const s of data) {
      const id = s.id || s.ID || s.SpellId;
      const classStr = (s.class || s.Class || s.job || '').toString().toLowerCase();
      let mirClass = MirClass.Warrior;
      if (classStr.includes('wizard') || classStr.includes('mage') || classStr === '1') mirClass = MirClass.Wizard;
      else if (classStr.includes('taoist') || classStr.includes('tao') || classStr === '2') mirClass = MirClass.Taoist;

      const skill: SkillDef = {
        id,
        name: s.name || s.Name || `Skill_${id}`,
        class: mirClass,
        level: s.level || s.Level || s.NeedLv || 1,
        mpCost: s.mpCost || s.MPCost || s.NeedMP || 0,
        cooldown: s.cooldown || s.Cooldown || s.Delay || 1000,
        range: s.range || s.Range || 1,
        damage: s.damage || s.Damage || s.Power || 1.0,
        type: s.type || s.Type || 'physical',
        description: s.description || s.Name || '',
      };
      this.skills.set(id, skill);
    }
  }

  private loadMaps(): void {
    const mapInfo = this.loadJSON('map_info.json');
    const spawnsData = this.loadJSON('monster_spawns.json');

    if (!mapInfo) return;

    // 构建地图的怪物刷新索引 (spawnsData 用怪物名称引用)
    const spawnMap = new Map<string, MonsterSpawn[]>();
    if (spawnsData && Array.isArray(spawnsData)) {
      for (const sp of spawnsData) {
        const mapId = (sp.map || sp.mapId || sp.map_id || '').toString();
        const monsterName = sp.monster || sp.monsterName || '';
        // 通过名称查找怪物ID
        const monsterId = this._monsterNameToId.get(monsterName) || 0;
        if (!spawnMap.has(mapId)) spawnMap.set(mapId, []);
        spawnMap.get(mapId)!.push({
          monsterId,
          mapId,
          x: sp.x || sp.X || 0,
          y: sp.y || sp.Y || 0,
          count: sp.count || sp.Count || 1,
          respawnTime: sp.respawn_time || sp.respawnTime || 30,
          range: sp.range || sp.Range || 5,
        });
      }
    }

    // map_info.json 格式: { maps: [...], connections: [...] }
    const mapsArray = Array.isArray(mapInfo) ? mapInfo : (mapInfo.maps || []);
    const connectionsArray = Array.isArray(mapInfo) ? [] : (mapInfo.connections || []);

    for (const m of mapsArray) {
      const id = (m.id || m.file || m.ID || m.filename || '').toString();
      const flags = m.flags || [];
      const mapDef: MapDef = {
        id,
        name: m.name || m.Name || `Map_${id}`,
        width: m.width || m.Width || 100,
        height: m.height || m.Height || 100,
        monsters: spawnMap.get(id) || [],
        portals: [],
        safeZone: flags.includes('safe') || m.safe_zone || false,
      };
      this.maps.set(id, mapDef);
    }

    // 添加传送点 (从 connections 数组)
    for (const conn of connectionsArray) {
      const fromId = (conn.from || conn.fromMap || '').toString();
      const toId = (conn.to || conn.toMap || '').toString();
      const fromMap = this.maps.get(fromId);
      if (fromMap) {
        fromMap.portals.push({
          mapId: fromId,
          x: conn.x || conn.fromX || 0,
          y: conn.y || conn.fromY || 0,
          targetMapId: toId,
          targetX: conn.toX || conn.to_x || 0,
          targetY: conn.toY || conn.to_y || 0,
        });
      }
    }
  }

  private loadExpTable(): void {
    const data = this.loadJSON('exp_list.json');
    if (!data) {
      // 默认经验表 (传奇经典)
      this.expTable = Array.from({ length: 100 }, (_, i) => {
        const level = i + 1;
        return Math.floor(100 * Math.pow(level, 2.5));
      });
      return;
    }
    if (Array.isArray(data)) {
      this.expTable = data.map((e: any) => e.experience || e.exp || e.Exp || 0);
    }
  }

  private loadBaseStats(): void {
    const data = this.loadJSON('base_stats.json');
    if (!data) return;

    // base_stats.json 格式: { warrior: {...}, wizard: {...}, taoist: {...} }
    const classMap: Record<string, MirClass> = {
      warrior: MirClass.Warrior,
      wizard: MirClass.Wizard,
      taoist: MirClass.Taoist,
    };

    for (const [className, stats] of Object.entries(data)) {
      const mirClass = classMap[className.toLowerCase()];
      if (mirClass && typeof stats === 'object' && stats !== null) {
        const s = stats as Record<string, any>;
        // 传奇原始数据格式: Base=15, Gain=20, 等
        // 使用默认值 + 原始数据覆盖
        CLASS_BASE_STATS[mirClass] = {
          MaxHP: s.MaxHP || s.max_hp || (mirClass === MirClass.Warrior ? 100 : mirClass === MirClass.Wizard ? 70 : 85),
          MaxMP: s.MaxMP || s.max_mp || (mirClass === MirClass.Warrior ? 30 : mirClass === MirClass.Wizard ? 100 : 70),
          MinDC: s.MinDC || s.min_dc || (mirClass === MirClass.Warrior ? 5 : 0),
          MaxDC: s.MaxDC || s.max_dc || (mirClass === MirClass.Warrior ? 5 : 0),
          MinMC: s.MinMC || s.min_mc || 0,
          MaxMC: s.MaxMC || s.max_mc || 0,
          MinSC: s.MinSC || s.min_sc || 0,
          MaxSC: s.MaxSC || s.max_sc || 0,
          MinAC: s.MinAC || s.min_ac || 0,
          MaxAC: s.MaxAC || s.max_ac || 0,
          MinMAC: s.MinMAC || s.min_mac || 0,
          MaxMAC: s.MaxMAC || s.max_mac || 0,
          Accuracy: s.Accuracy || s.accuracy || 5,
          Agility: s.Agility || s.agility || 5,
          HPRegen: s.HPRegen || s.HealthRecovery || 5,
          MPRegen: s.MPRegen || s.SpellRecovery || 5,
          CritRate: s.CritRate || s.CriticalRate || 5,
          CritDamage: s.CritDamage || s.CriticalDamage || 50,
          MagicResist: s.MagicResist || 0,
          PoisonResist: s.PoisonResist || 0,
          Freezing: s.Freezing || 0,
        };
      }
    }
  }

  // ====== Public API ======

  getMonster(id: number): MonsterDef | undefined {
    return this.monsters.get(id);
  }

  getAllMonsters(): MonsterDef[] {
    return Array.from(this.monsters.values());
  }

  getItem(id: number): ItemDef | undefined {
    return this.items.get(id);
  }

  getAllItems(): ItemDef[] {
    return Array.from(this.items.values());
  }

  getSkill(id: number): SkillDef | undefined {
    return this.skills.get(id);
  }

  getSkillsForClass(cls: MirClass): SkillDef[] {
    return Array.from(this.skills.values()).filter(s => s.class === cls);
  }

  getMap(id: string): MapDef | undefined {
    return this.maps.get(id);
  }

  getAllMaps(): MapDef[] {
    return Array.from(this.maps.values());
  }

  getExpForLevel(level: number): number {
    if (level <= 0) return 0;
    if (level <= this.expTable.length) return this.expTable[level - 1];
    // 超出范围用公式推算
    return Math.floor(100 * Math.pow(level, 2.5));
  }

  getClassBaseStats(cls: MirClass): Stats {
    const base = createDefaultStats();
    const overrides = CLASS_BASE_STATS[cls];
    Object.assign(base, overrides);
    base.HP = base.MaxHP;
    base.MP = base.MaxMP;
    return base;
  }

  // 获取适合新手村的地图
  getStarterMap(): MapDef | undefined {
    // 优先找比奇/新手地图
    for (const [, map] of this.maps) {
      if (map.id === '0' || map.id === '0122' || map.name.includes('比奇') || map.name.includes('新手')) {
        return map;
      }
    }
    // 返回第一张地图
    return this.maps.values().next().value;
  }

  // 获取适合该等级的怪物刷新点
  getSpawnsForLevel(mapId: string, playerLevel: number): MonsterSpawn[] {
    const map = this.maps.get(mapId);
    if (!map) return [];

    return map.monsters.filter(spawn => {
      const monster = this.monsters.get(spawn.monsterId);
      if (!monster) return false;
      // 怪物等级在玩家等级 ±10 范围内
      return Math.abs(monster.level - playerLevel) <= 10;
    });
  }
}

// 单例
export const gameData = new GameDataManager();
