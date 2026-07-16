/**
 * AI Legend of MIR - Game Configuration
 * Balance: Easy early game, high exp, BOSS high drop rate
 */
export const CONFIG = {
  // Game world
  TILE_SIZE: 48,
  MAP_TILE_SIZE: 48, // Render size per tile
  VIEWPORT_TILES_X: 20,
  VIEWPORT_TILES_Y: 15,

  // Player defaults
  PLAYER: {
    SPEED: 3,
    BASE_HP: { warrior: 200, wizard: 120, taoist: 160 },
    BASE_MP: { warrior: 50, wizard: 200, taoist: 120 },
    BASE_ATK: { warrior: 25, wizard: 35, taoist: 20 },
    BASE_DEF: { warrior: 15, wizard: 8, taoist: 12 },
    ATTACK_RANGE: { warrior: 1.5, wizard: 5, taoist: 3 },
    ATTACK_SPEED: { warrior: 800, wizard: 1200, taoist: 1000 }, // ms between attacks
  },

  // Experience - HIGH for easy early game
  EXP: {
    MULTIPLIER: 5, // 5x exp rate for fast leveling
    BASE_TABLE: {}, // Loaded from data
    // Quick reference: Level 1-10 needs very little exp
    QUICK_TABLE: {
      1: 0, 2: 100, 3: 200, 4: 400, 5: 700,
      6: 1100, 7: 1600, 8: 2200, 9: 3000, 10: 4000,
      15: 12000, 20: 30000, 25: 60000, 30: 120000,
      35: 250000, 40: 500000, 45: 1000000, 50: 2000000,
    },
  },

  // Monster settings
  MONSTER: {
    RESPAWN_TIME: 15000, // 15 seconds base respawn
    AGGRO_RANGE: 5, // tiles
    BOSS_AGGRO_RANGE: 8,
    // Monster level scaling
    LEVEL_MULTIPLIERS: {
      1: { hp: 1, atk: 1, def: 1, exp: 1 },
      5: { hp: 2, atk: 1.5, def: 1.5, exp: 3 },
      10: { hp: 5, atk: 3, def: 3, exp: 8 },
      20: { hp: 15, atk: 8, def: 6, exp: 20 },
      30: { hp: 40, atk: 20, def: 15, exp: 50 },
    },
  },

  // BOSS settings - Strong but HIGH drop rate
  BOSS: {
    HP_MULTIPLIER: 10, // BOSS has 10x HP
    ATK_MULTIPLIER: 3, // BOSS has 3x attack
    DEF_MULTIPLIER: 2, // BOSS has 2x defense
    DROP_RATE: 0.8, // 80% chance to drop something
    RARE_DROP_RATE: 0.3, // 30% chance for rare item
    EPIC_DROP_RATE: 0.1, // 10% chance for epic item
    LEGENDARY_DROP_RATE: 0.02, // 2% chance for legendary
    RESPAWN_TIME: 300000, // 5 minutes
    EXP_MULTIPLIER: 20, // 20x exp for BOSS
  },

  // Drop rates for normal monsters
  DROP: {
    NORMAL_RATE: 0.3, // 30% chance for normal monster drop
    RARE_RATE: 0.05, // 5% rare
    GOLD_MULTIPLIER: 3, // 3x gold for easier economy start
  },

  // Item rarity
  RARITY: {
    COMMON: { name: '普通', color: '#FFFFFF', statMult: 1 },
    UNCOMMON: { name: '优秀', color: '#00FF00', statMult: 1.3 },
    RARE: { name: '稀有', color: '#0088FF', statMult: 1.8 },
    EPIC: { name: '史诗', color: '#AA00FF', statMult: 2.5 },
    LEGENDARY: { name: '传说', color: '#FF8800', statMult: 4 },
  },

  // Shop - Premium items
  SHOP: {
    PREMIUM_ITEMS: [
      { id: 'exp_boost_50', name: '经验符(50%)', desc: '经验获取+50%，持续1小时', price: 10, currency: 'diamond', duration: 3600000 },
      { id: 'exp_boost_100', name: '经验符(100%)', desc: '经验获取+100%，持续1小时', price: 20, currency: 'diamond', duration: 3600000 },
      { id: 'drop_boost_50', name: '爆率符(50%)', desc: '爆率+50%，持续1小时', price: 15, currency: 'diamond', duration: 3600000 },
      { id: 'hp_potion_large', name: '大太阳水', desc: '瞬间恢复500HP', price: 500, currency: 'gold' },
      { id: 'mp_potion_large', name: '大魔法药', desc: '瞬间恢复300MP', price: 500, currency: 'gold' },
      { id: 'teleport_scroll', name: '随机传送卷', desc: '随机传送到当前地图某处', price: 1000, currency: 'gold' },
      { id: 'town_scroll', name: '回城卷轴', desc: '立即回到安全区', price: 200, currency: 'gold' },
      { id: 'weapon_enhance', name: '武器强化石', desc: '武器强化成功率+20%', price: 50, currency: 'diamond' },
      { id: 'pet_exp_book', name: '神兽经验书', desc: '神兽经验+100%', price: 30, currency: 'diamond' },
      { id: 'vip_card_7d', name: 'VIP卡(7天)', desc: '经验+30% 爆率+20% 专属商店', price: 100, currency: 'diamond', duration: 604800000 },
    ],
    // Free diamond rewards
    DAILY_DIAMONDS: 50, // Login reward
    FIRST_RECHARGE_BONUS: 2.0, // 2x on first purchase
  },

  // Team bonuses - encourage grouping
  TEAM: {
    MIN_SIZE: 2,
    EXP_BONUS: { 2: 0.2, 3: 0.4, 4: 0.6, 5: 0.8, 6: 1.0 }, // % bonus per team size
    DROP_BONUS: { 2: 0.1, 3: 0.2, 4: 0.3, 5: 0.4 }, // % bonus per team size
    MAX_SIZE: 6,
  },

  // Starting map
  START_MAP: '0', // 比奇省
  START_POSITION: { x: 350, y: 350 },
  SAFE_ZONE_RADIUS: 20, // tiles around start point

  // Colors for rendering
  COLORS: {
    GROUND: '#3D2B1F',
    WALL: '#1A1A2E',
    PLAYER_WARRIOR: '#FF4444',
    PLAYER_WIZARD: '#4444FF',
    PLAYER_TAOIST: '#44FF44',
    MONSTER_NORMAL: '#AA6644',
    MONSTER_ELITE: '#FF8800',
    MONSTER_BOSS: '#FF0044',
    ITEM_COMMON: '#FFFFFF',
    ITEM_RARE: '#0088FF',
    ITEM_EPIC: '#AA00FF',
    ITEM_LEGENDARY: '#FF8800',
    GOLD: '#FFD700',
    HP_BAR: '#FF3333',
    MP_BAR: '#3333FF',
    EXP_BAR: '#FFD700',
  },
};
