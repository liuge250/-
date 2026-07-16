// ==========================================
// 战斗系统 - 参考 Crystal 源码的伤害公式
// ==========================================
import {
  type Stats, type MonsterDef, type CharacterData,
  DefenceType, Direction,
} from './types.js';

// 随机数生成器
function random(min: number, max: number): number {
  if (min >= max) return min;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 获取攻击力 (参考 Crystal MapObject.GetAttackPower)
export function getAttackPower(min: number, max: number): number {
  if (min >= max) return max;
  return random(min, max + 1);
}

// 获取防御力 (参考 Crystal MapObject.GetDefencePower)
export function getDefencePower(min: number, max: number): number {
  if (min >= max) return 0;
  return random(min, max + 1);
}

// 命中判定 (参考 Crystal MapObject.GetArmour)
export function rollHit(attackerAccuracy: number, defenderAgility: number): boolean {
  if (defenderAgility <= 0) return true;
  return random(0, defenderAgility + 1) <= attackerAccuracy;
}

// 暴击判定
export function rollCritical(attackerAgility: number, criticalRate: number): boolean {
  const chance = Math.min(0.5, criticalRate / 100 + attackerAgility / 200);
  return Math.random() < chance;
}

// 等级差修正 (参考 Crystal)
export function getLevelOffset(attackerLevel: number, defenderLevel: number): number {
  const diff = attackerLevel - defenderLevel;
  if (diff > 0) return Math.min(diff, 10);  // 最多 +10
  return Math.max(diff, -10); // 最多 -10
}

// 计算伤害 (参考 Crystal HumanObject.Attacked)
export interface DamageResult {
  damage: number;
  hit: boolean;
  critical: boolean;
  miss: boolean;
  damageType: 'physical' | 'magical';
}

export function calculateDamage(
  attacker: { level: number; stats: Stats; class?: string },
  defender: { level: number; stats: Stats },
  attackType: 'physical' | 'magical' = 'physical',
): DamageResult {
  const levelOffset = getLevelOffset(attacker.level, defender.level);

  // 1. 命中判定
  const hit = rollHit(attacker.stats.Accuracy, defender.stats.Agility);
  if (!hit) {
    return { damage: 0, hit: false, critical: false, miss: true, damageType: attackType };
  }

  // 2. 计算攻击力
  let attackPower: number;
  if (attackType === 'magical') {
    // 魔法攻击取 MC (法师) 或 SC (道士)
    const atkMin = Math.max(attacker.stats.MinMC, attacker.stats.MinSC);
    const atkMax = Math.max(attacker.stats.MaxMC, attacker.stats.MaxSC);
    attackPower = getAttackPower(atkMin, atkMax);
  } else {
    // 物理攻击取 DC (战士)
    attackPower = getAttackPower(attacker.stats.MinDC, attacker.stats.MaxDC);
  }

  // 3. 等级修正
  if (levelOffset > 0) {
    attackPower += Math.floor(attackPower * levelOffset * 0.05); // 每级+5%
  } else if (levelOffset < 0) {
    attackPower = Math.max(1, attackPower + Math.floor(attackPower * levelOffset * 0.05));
  }

  // 4. 防御判定
  let defenceType: DefenceType;
  if (attackType === 'magical') {
    defenceType = Math.random() > 0.5 ? DefenceType.MACAgility : DefenceType.MAC;
  } else {
    defenceType = Math.random() > 0.5 ? DefenceType.ACAgility : DefenceType.AC;
  }

  let armour = 0;
  let dodged = false;

  switch (defenceType) {
    case DefenceType.ACAgility:
      if (rollHit(attacker.stats.Accuracy, defender.stats.Agility) === false) {
        dodged = true;
      }
      armour = getDefencePower(defender.stats.MinAC, defender.stats.MaxAC);
      break;
    case DefenceType.AC:
      armour = getDefencePower(defender.stats.MinAC, defender.stats.MaxAC);
      break;
    case DefenceType.MACAgility:
      // 魔法躲避
      if (random(0, 10) < defender.stats.MagicResist) {
        dodged = true;
      }
      armour = getDefencePower(defender.stats.MinMAC, defender.stats.MaxMAC);
      break;
    case DefenceType.MAC:
      if (random(0, 10) < defender.stats.MagicResist) {
        dodged = true;
      }
      armour = getDefencePower(defender.stats.MinMAC, defender.stats.MaxMAC);
      break;
    case DefenceType.Agility:
      if (!rollHit(attacker.stats.Accuracy, defender.stats.Agility)) {
        dodged = true;
      }
      break;
  }

  if (dodged) {
    return { damage: 0, hit: false, critical: false, miss: true, damageType: attackType };
  }

  // 5. 最终伤害 = 攻击力 - 防御力
  let damage = Math.max(0, attackPower - armour);

  // 6. 暴击判定
  const critical = rollCritical(attacker.stats.Agility, attacker.stats.CriticalRate);
  if (critical) {
    const critMultiplier = 1.5 + (attacker.stats.CriticalDamage / 100);
    damage = Math.floor(damage * critMultiplier);
  }

  // 7. 最低伤害保底
  damage = Math.max(1, damage);

  return { damage, hit: true, critical, miss: false, damageType: attackType };
}

// 玩家攻击怪物
export function playerAttackMonster(
  player: CharacterData,
  monster: MonsterDef,
): DamageResult {
  // 判断攻击类型
  const cls = player.class;
  let attackType: 'physical' | 'magical' = 'physical';
  if (cls === 'wizard') attackType = 'magical';
  else if (cls === 'taoist') {
    // 道士根据道术和物理攻击取高者
    attackType = player.stats.MinMC > player.stats.MinDC ? 'magical' : 'physical';
  }

  return calculateDamage(
    { level: player.level, stats: player.stats, class: player.class },
    { level: monster.level, stats: monsterStatsToStats(monster) },
    attackType,
  );
}

// 怪物攻击玩家
export function monsterAttackPlayer(
  monster: MonsterDef,
  player: CharacterData,
): DamageResult {
  // 怪物主要使用物理攻击
  const attackType = monster.minMC > monster.minDC ? 'magical' : 'physical';

  return calculateDamage(
    { level: monster.level, stats: monsterStatsToStats(monster) },
    { level: player.level, stats: player.stats },
    attackType,
  );
}

// 将怪物属性转为 Stats 结构
function monsterStatsToStats(m: MonsterDef): Stats {
  return {
    HP: m.hp, MP: m.mp, MaxHP: m.hp, MaxMP: m.mp,
    MinDC: m.minDC, MaxDC: m.maxDC,
    MinMC: m.minMC, MaxMC: m.maxMC,
    MinSC: m.minSC, MaxSC: m.maxSC,
    MinAC: m.minAC, MaxAC: m.maxAC,
    MinMAC: m.minMAC, MaxMAC: m.maxMAC,
    Accuracy: m.accuracy, Agility: m.agility,
    AttackSpeed: m.attackSpeed, MoveSpeed: m.moveSpeed,
    MagicResist: 0, PoisonResist: 0,
    HealthRecovery: 0, ManaRecovery: 0, PoisonRecovery: 0,
    CriticalRate: 0, CriticalDamage: 0,
    Lucky: 0, Unluck: 0,
  };
}

// 计算掉落物品
export function rollDrops(monster: MonsterDef): Array<{ itemId: number; count: number }> {
  const drops: Array<{ itemId: number; count: number }> = [];

  for (const drop of monster.drops) {
    if (Math.random() < drop.chance) {
      const count = random(drop.minCount, drop.maxCount);
      drops.push({ itemId: drop.itemId, count });
    }
  }

  // 保底掉落金币
  const goldChance = 0.7; // 70% 概率掉金币
  if (Math.random() < goldChance) {
    const goldAmount = random(1, monster.level * 10 + 10);
    drops.push({ itemId: 0, count: goldAmount }); // itemId=0 表示金币
  }

  return drops;
}

// 计算经验获取
export function calculateExpGain(playerLevel: number, monsterLevel: number, baseExp: number): number {
  const levelDiff = playerLevel - monsterLevel;
  let multiplier = 1.0;

  if (levelDiff < -5) multiplier = 1.5;       // 打高级怪经验加成
  else if (levelDiff < 0) multiplier = 1.2;
  else if (levelDiff < 5) multiplier = 1.0;
  else if (levelDiff < 10) multiplier = 0.5;   // 打低级怪经验减少
  else multiplier = 0.1;                        // 等级差太大几乎没经验

  return Math.max(1, Math.floor(baseExp * multiplier));
}

// 获取方向 (从坐标差)
export function getDirection(fromX: number, fromY: number, toX: number, toY: number): Direction {
  const dx = toX - fromX;
  const dy = toY - fromY;

  if (dx === 0 && dy < 0) return Direction.Up;
  if (dx > 0 && dy < 0) return Direction.UpRight;
  if (dx > 0 && dy === 0) return Direction.Right;
  if (dx > 0 && dy > 0) return Direction.DownRight;
  if (dx === 0 && dy > 0) return Direction.Down;
  if (dx < 0 && dy > 0) return Direction.DownLeft;
  if (dx < 0 && dy === 0) return Direction.Left;
  if (dx < 0 && dy < 0) return Direction.UpLeft;

  return Direction.Up;
}

// 两点距离
export function getDistance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.abs(x1 - x2) + Math.abs(y1 - y2); // 曼哈顿距离
}

// 方向对应的坐标偏移
export const DIRECTION_OFFSETS: Record<Direction, { dx: number; dy: number }> = {
  [Direction.Up]: { dx: 0, dy: -1 },
  [Direction.UpRight]: { dx: 1, dy: -1 },
  [Direction.Right]: { dx: 1, dy: 0 },
  [Direction.DownRight]: { dx: 1, dy: 1 },
  [Direction.Down]: { dx: 0, dy: 1 },
  [Direction.DownLeft]: { dx: -1, dy: 1 },
  [Direction.Left]: { dx: -1, dy: 0 },
  [Direction.UpLeft]: { dx: -1, dy: -1 },
};
