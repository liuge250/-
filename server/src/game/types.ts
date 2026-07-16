// ==========================================
// 传奇游戏核心类型定义
// 参考 Crystal (LOMCN) 源码设计
// ==========================================

// 职业类型
export enum MirClass {
  Warrior = 'warrior',   // 战士
  Wizard = 'wizard',     // 法师
  Taoist = 'taoist',     // 道士
}

// 性别
export enum MirGender {
  Male = 'male',
  Female = 'female',
}

// 装备槽位
export enum EquipSlot {
  Weapon = 'weapon',       // 武器
  Armor = 'armor',         // 衣服
  Helmet = 'helmet',       // 头盔
  Boots = 'boots',         // 鞋子
  Necklace = 'necklace',   // 项链
  Ring1 = 'ring1',         // 戒指1
  Ring2 = 'ring2',         // 戒指2
  Bracelet1 = 'bracelet1', // 手镯1
  Bracelet2 = 'bracelet2', // 手镯2
  Belt = 'belt',           // 腰带
  Amulet = 'amulet',       // 护符
  Stone = 'stone',         // 宝石
  Torch = 'torch',         // 火把
}

// 物品类型
export enum ItemType {
  Weapon = 'weapon',
  Armor = 'armor',
  Helmet = 'helmet',
  Boots = 'boots',
  Necklace = 'necklace',
  Ring = 'ring',
  Bracelet = 'bracelet',
  Belt = 'belt',
  Stone = 'stone',
  Torch = 'torch',
  Amulet = 'amulet',
  Potion = 'potion',         // 药水
  Scroll = 'scroll',         // 卷轴
  Material = 'material',     // 材料
  Quest = 'quest',           // 任务物品
  Gold = 'gold',             // 金币
}

// 物品品质
export enum ItemQuality {
  Common = 0,      // 普通 (白色)
  Superior = 1,    // 优秀 (蓝色)
  Rare = 2,        // 稀有 (黄色)
  Epic = 3,        // 史诗 (紫色)
  Legendary = 4,   // 传说 (红色)
}

// 怪物AI状态
export enum MonsterState {
  Idle = 'idle',           // 待机
  Patrol = 'patrol',       // 巡逻
  Chase = 'chase',         // 追击
  Attack = 'attack',       // 攻击
  Return = 'return',       // 返回出生点
  Dead = 'dead',           // 死亡
}

// 玩家状态
export enum PlayerState {
  Idle = 'idle',
  Walking = 'walking',
  Running = 'running',
  Attacking = 'attacking',
  Casting = 'casting',
  Dead = 'dead',
}

// 方向 (8方向)
export enum Direction {
  Up = 0,
  UpRight = 1,
  Right = 2,
  DownRight = 3,
  Down = 4,
  DownLeft = 5,
  Left = 6,
  UpLeft = 7,
}

// 防御类型 (参考Crystal)
export enum DefenceType {
  ACAgility = 'ACAgility',   // 物理防御 + 敏捷判定
  AC = 'AC',                 // 纯物理防御
  MACAgility = 'MACAgility', // 魔法防御 + 敏捷判定
  MAC = 'MAC',               // 纯魔法防御
  Agility = 'Agility',       // 纯敏捷判定
}

// 属性系统 (参考Crystal Stats)
export interface Stats {
  // 基础属性
  HP: number;
  MP: number;
  MaxHP: number;
  MaxMP: number;

  // 攻击力
  MinDC: number;   // 最小物理攻击 (战士/通用)
  MaxDC: number;   // 最大物理攻击
  MinMC: number;   // 最小魔法攻击 (法师)
  MaxMC: number;   // 最大魔法攻击
  MinSC: number;   // 最小道术攻击 (道士)
  MaxSC: number;   // 最大道术攻击

  // 防御力
  MinAC: number;   // 最小物理防御
  MaxAC: number;   // 最大物理防御
  MinMAC: number;  // 最小魔法防御
  MaxMAC: number;  // 最大魔法防御

  // 其他属性
  Accuracy: number;    // 精准
  Agility: number;     // 敏捷
  AttackSpeed: number; // 攻击速度
  MoveSpeed: number;   // 移动速度

  // 特殊属性
  MagicResist: number;  // 魔法躲避
  PoisonResist: number; // 毒物躲避
  HealthRecovery: number; // HP回复
  ManaRecovery: number;   // MP回复
  PoisonRecovery: number; // 毒物回复
  CriticalRate: number;   // 暴击率
  CriticalDamage: number; // 暴击伤害
  Lucky: number;          // 幸运
  Unluck: number;         // 诅咒
}

// 创建默认属性
export function createDefaultStats(): Stats {
  return {
    HP: 0, MP: 0, MaxHP: 0, MaxMP: 0,
    MinDC: 0, MaxDC: 0, MinMC: 0, MaxMC: 0, MinSC: 0, MaxSC: 0,
    MinAC: 0, MaxAC: 0, MinMAC: 0, MaxMAC: 0,
    Accuracy: 0, Agility: 0, AttackSpeed: 0, MoveSpeed: 0,
    MagicResist: 0, PoisonResist: 0,
    HealthRecovery: 0, ManaRecovery: 0, PoisonRecovery: 0,
    CriticalRate: 0, CriticalDamage: 0,
    Lucky: 0, Unluck: 0,
  };
}

// 职业基础属性 (参考Crystal BaseStats + 已提取的base_stats.json)
export const CLASS_BASE_STATS: Record<MirClass, Partial<Stats>> = {
  [MirClass.Warrior]: {
    MaxHP: 200, MaxMP: 50,
    MinDC: 5, MaxDC: 10,  // 战士物理攻击高
    MinAC: 5, MaxAC: 8,   // 物理防御高
    MinMAC: 2, MaxMAC: 3, // 魔法防御低
    Accuracy: 5, Agility: 8,
    AttackSpeed: 4, MoveSpeed: 3,
    HealthRecovery: 3, ManaRecovery: 1,
  },
  [MirClass.Wizard]: {
    MaxHP: 100, MaxMP: 200,
    MinMC: 8, MaxMC: 15,  // 法师魔法攻击极高
    MinAC: 2, MaxAC: 3,   // 物理防御低
    MinMAC: 5, MaxMAC: 10, // 魔法防御高
    Accuracy: 5, Agility: 10,
    AttackSpeed: 5, MoveSpeed: 4,
    HealthRecovery: 1, ManaRecovery: 5,
  },
  [MirClass.Taoist]: {
    MaxHP: 150, MaxMP: 120,
    MinSC: 5, MaxSC: 12,  // 道士道术攻击
    MinAC: 3, MaxAC: 6,   // 物理防御中
    MinMAC: 4, MaxMAC: 7, // 魔法防御中
    Accuracy: 6, Agility: 12,
    AttackSpeed: 4, MoveSpeed: 4,
    HealthRecovery: 2, ManaRecovery: 3,
  },
};

// 物品定义
export interface ItemDef {
  id: number;
  name: string;
  type: ItemType;
  quality: ItemQuality;
  shape: number;        // 外观ID
  weight: number;
  image: number;        // 图片索引
  requiredClass: number; // 需要职业 (0=全职业, 1=战士, 2=法师, 4=道士)
  requiredLevel: number;
  bindOnPickup: boolean;
  stackable: boolean;
  maxStack: number;
  price: number;         // 购买价格
  stats: Partial<Stats>; // 附加属性
  description: string;
}

// 背包物品实例
export interface InventoryItem {
  uid: string;          // 唯一ID
  itemId: number;       // 物品定义ID
  count: number;        // 数量
  bound: boolean;       // 是否绑定
  stats: Partial<Stats>; // 随机属性 (可变的)
  slot?: EquipSlot;     // 装备槽位 (如果已装备)
}

// 怪物定义
export interface MonsterDef {
  id: number;
  name: string;
  level: number;
  hp: number;
  mp: number;
  minAC: number;
  maxAC: number;
  minMAC: number;
  maxMAC: number;
  minDC: number;
  maxDC: number;
  minMC: number;
  maxMC: number;
  minSC: number;
  maxSC: number;
  accuracy: number;
  agility: number;
  attackSpeed: number;
  moveSpeed: number;
  viewRange: number;     // 视野范围
  aiType: string;        // AI类型
  experience: number;    // 经验值
  drops: MonsterDrop[];  // 掉落表
}

// 怪物掉落
export interface MonsterDrop {
  itemId: number;
  chance: number;       // 掉落概率 (0-1)
  minCount: number;
  maxCount: number;
}

// 怪物刷新点
export interface MonsterSpawn {
  monsterId: number;
  mapId: string;
  x: number;
  y: number;
  count: number;        // 同时存在数量
  respawnTime: number;  // 重生时间(秒)
  range: number;        // 活动范围
}

// 地图传送点
export interface MapPortal {
  mapId: string;
  x: number;
  y: number;
  targetMapId: string;
  targetX: number;
  targetY: number;
}

// 地图定义
export interface MapDef {
  id: string;
  name: string;
  width: number;
  height: number;
  monsters: MonsterSpawn[];
  portals: MapPortal[];
  safeZone: boolean;
}

// 技能定义
export interface SkillDef {
  id: number;
  name: string;
  class: MirClass;
  level: number;         // 需要等级
  mpCost: number;        // MP消耗
  cooldown: number;      // 冷却时间(毫秒)
  range: number;         // 施放范围
  damage: number;        // 基础伤害倍率
  type: string;          // 技能类型 (physical/magical/taoist/support)
  description: string;
}

// ==========================================
// WebSocket 通信协议
// ==========================================

// 客户端 -> 服务端消息
export enum ClientMsgType {
  // 角色相关
  CreateCharacter = 'create_character',
  SelectCharacter = 'select_character',

  // 移动
  Move = 'move',
  Turn = 'turn',

  // 战斗
  Attack = 'attack',
  UseSkill = 'use_skill',

  // 物品
  PickupItem = 'pickup_item',
  DropItem = 'drop_item',
  UseItem = 'use_item',
  EquipItem = 'equip_item',
  UnequipItem = 'unequip_item',

  // NPC
  TalkNPC = 'talk_npc',
  BuyItem = 'buy_item',
  SellItem = 'sell_item',

  // 地图
  EnterMap = 'enter_map',
  UsePortal = 'use_portal',
}

// 服务端 -> 客户端消息
export enum ServerMsgType {
  // 连接
  Connected = 'connected',
  Error = 'error',

  // 角色
  CharacterCreated = 'character_created',
  CharacterList = 'character_list',
  CharacterData = 'character_data',

  // 地图
  MapLoaded = 'map_loaded',
  MapChanged = 'map_changed',

  // 实体
  PlayerJoined = 'player_joined',
  PlayerLeft = 'player_left',
  PlayerMoved = 'player_moved',
  PlayerAttacked = 'player_attacked',
  PlayerDamaged = 'player_damaged',
  PlayerDied = 'player_died',

  MonsterSpawned = 'monster_spawned',
  MonsterMoved = 'monster_moved',
  MonsterDamaged = 'monster_damaged',
  MonsterDied = 'monster_died',

  // 战斗结果
  DamageIndicator = 'damage_indicator',
  ExpGained = 'exp_gained',
  LevelUp = 'level_up',

  // 物品
  ItemDropped = 'item_dropped',
  ItemPickedUp = 'item_picked_up',
  InventoryUpdate = 'inventory_update',
  EquipmentUpdate = 'equipment_update',

  // NPC
  NPCDialog = 'npc_dialog',
  ShopItems = 'shop_items',

  // 系统
  SystemMessage = 'system_message',
  StatsUpdate = 'stats_update',
}

// 消息基础结构
export interface GameMessage {
  type: string;
  data: any;
  timestamp: number;
}

// 消息类型常量
export const MSG = {
  CLIENT: {
    INIT: 'client.init',
    MOVE: 'client.move',
    ATTACK: 'client.attack',
    PICKUP: 'client.pickup',
    USE_SKILL: 'client.use_skill',
    CHANGE_MAP: 'client.change_map',
    EQUIP_ITEM: 'client.equip_item',
    USE_ITEM: 'client.use_item',
    DROP_ITEM: 'client.drop_item',
  },
  SERVER: {
    INIT_COMPLETE: 'server.init_complete',
    ENTITY_MOVE: 'server.entity_move',
    ENTITY_DIE: 'server.entity_die',
    COMBAT_RESULT: 'server.combat_result',
    MONSTER_KILLED: 'server.monster_killed',
    LEVEL_UP: 'server.level_up',
    SYSTEM_MSG: 'server.system_msg',
    PICKUP_ITEM: 'server.pickup_item',
    STATS_UPDATE: 'server.stats_update',
    ERROR: 'server.error',
    MAP_DATA: 'server.map_data',
    MONSTER_SPAWN: 'server.monster_spawn',
    ITEM_DROP: 'server.item_drop',
  },
};

// 客户端消息类型
export interface ClientMessage {
  type: string;
  data: any;
}

// 服务端消息类型
export interface ServerMessage {
  type: string;
  data: any;
}

// 坐标
export interface Point {
  x: number;
  y: number;
}

// 玩家数据 (持久化)
export interface CharacterData {
  id: string;
  userId: string;
  name: string;
  class: MirClass;
  gender: MirGender;
  level: number;
  experience: number;
  mapId: string;
  x: number;
  y: number;
  direction: Direction;
  stats: Stats;
  baseStats: Stats;
  inventory: InventoryItem[];
  equipment: Record<string, InventoryItem | null>;
  gold: number;
  hp: number;
  mp: number;
  skills: number[];  // 已学技能ID列表
  createdAt: string;
  lastLoginAt: string;
}
