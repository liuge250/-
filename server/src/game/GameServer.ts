// ==========================================
// 游戏服务器 - WebSocket 实时游戏引擎
// ==========================================
import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { gameData } from './GameData.js';
import { mapManager, type MonsterInstance, type DroppedItem } from './GameMap.js';
import {
  playerAttackMonster, monsterAttackPlayer, rollDrops, calculateExpGain,
  getDirection, getDistance, DIRECTION_OFFSETS,
} from './Combat.js';
import {
  type CharacterData, type Stats, type InventoryItem,
  MirClass, MonsterState, Direction,
  createDefaultStats, CLASS_BASE_STATS,
  MSG, type ClientMessage, type ServerMessage,
} from './types.js';

// 玩家会话
interface PlayerSession {
  ws: WebSocket;
  character: CharacterData;
  playerId: string;
  lastMoveAt: number;
  lastAttackAt: number;
  alive: boolean;
  respawnTimer: NodeJS.Timeout | null;
}

// 游戏服务器
class GameServer {
  private wss: WebSocketServer | null = null;
  private sessions: Map<string, PlayerSession> = new Map();
  private cleanupTimer: NodeJS.Timeout | null = null;
  private monsterAITimer: NodeJS.Timeout | null = null;
  private regenTimer: NodeJS.Timeout | null = null;

  init(httpServer: Server): void {
    // 初始化游戏数据
    gameData.init();
    mapManager.initMaps();

    // 创建 WebSocket 服务器
    this.wss = new WebSocketServer({ server: httpServer, path: '/game-ws' });

    this.wss.on('connection', (ws: WebSocket) => {
      this.handleConnection(ws);
    });

    // 怪物 AI 循环 (每秒)
    this.monsterAITimer = setInterval(() => this.updateMonsterAI(), 1000);

    // 生命回复循环 (每3秒)
    this.regenTimer = setInterval(() => this.updateRegeneration(), 3000);

    // 地图清理
    this.cleanupTimer = mapManager.startCleanup();

    console.log('[GameServer] WebSocket game server initialized on /game-ws');
  }

  private handleConnection(ws: WebSocket): void {
    let playerId = '';

    ws.on('message', (data: Buffer) => {
      try {
        const msg: ClientMessage = JSON.parse(data.toString());
        this.handleMessage(ws, msg, playerId);
      } catch (e) {
        console.error('[GameServer] Failed to parse message:', e);
      }
    });

    ws.on('close', () => {
      if (playerId) {
        this.removePlayer(playerId);
      }
    });

    ws.on('error', () => {
      if (playerId) {
        this.removePlayer(playerId);
      }
    });

    // 等待客户端发送初始化消息
    ws.on('message', function initHandler(data: Buffer) {
      try {
        const msg: ClientMessage = JSON.parse(data.toString());
        if (msg.type === MSG.CLIENT.INIT) {
          playerId = msg.data.playerId;
        }
        ws.removeListener('message', initHandler);
      } catch { /* ignore */ }
    });
  }

  private handleMessage(ws: WebSocket, msg: ClientMessage, playerId: string): void {
    switch (msg.type) {
      case MSG.CLIENT.INIT:
        this.handleInit(ws, msg.data);
        break;
      case MSG.CLIENT.MOVE:
        this.handleMove(playerId, msg.data);
        break;
      case MSG.CLIENT.ATTACK:
        this.handleAttack(playerId, msg.data);
        break;
      case MSG.CLIENT.PICKUP:
        this.handlePickup(playerId, msg.data);
        break;
      case MSG.CLIENT.USE_SKILL:
        this.handleUseSkill(playerId, msg.data);
        break;
      case MSG.CLIENT.CHANGE_MAP:
        this.handleChangeMap(playerId, msg.data);
        break;
      case MSG.CLIENT.EQUIP_ITEM:
        this.handleEquipItem(playerId, msg.data);
        break;
      case MSG.CLIENT.USE_ITEM:
        this.handleUseItem(playerId, msg.data);
        break;
      case MSG.CLIENT.DROP_ITEM:
        this.handleDropItem(playerId, msg.data);
        break;
    }
  }

  // ====== 初始化 ======
  private handleInit(ws: WebSocket, data: any): void {
    const { playerId, character } = data;
    if (!playerId || !character) {
      this.send(ws, { type: MSG.SERVER.ERROR, data: { message: 'Invalid init data' } });
      return;
    }

    // 如果已有会话，先移除
    if (this.sessions.has(playerId)) {
      this.removePlayer(playerId);
    }

    const session: PlayerSession = {
      ws,
      character: character as CharacterData,
      playerId,
      lastMoveAt: 0,
      lastAttackAt: 0,
      alive: true,
      respawnTimer: null,
    };

    this.sessions.set(playerId, session);

    // 确保角色在有效地图
    if (!character.mapId) {
      const starterMap = gameData.getStarterMap();
      if (starterMap) {
        character.mapId = starterMap.id;
        character.x = Math.floor(starterMap.width / 2);
        character.y = Math.floor(starterMap.height / 2);
      }
    }

    // 发送初始游戏状态
    this.sendEnterMap(session);

    console.log(`[GameServer] Player ${playerId} (${character.name}) entered game at ${character.mapId}(${character.x},${character.y})`);
  }

  // ====== 移动 ======
  private handleMove(playerId: string, data: any): void {
    const session = this.sessions.get(playerId);
    if (!session || !session.alive) return;

    const now = Date.now();
    if (now - session.lastMoveAt < 150) return; // 移动冷却 150ms
    session.lastMoveAt = now;

    const dir = data.direction as Direction;
    if (dir === undefined || dir === null) return;

    const offset = DIRECTION_OFFSETS[dir];
    if (!offset) return;

    const newX = session.character.x + offset.dx;
    const newY = session.character.y + offset.dy;

    // 边界检查
    const map = mapManager.getMap(session.character.mapId);
    if (!map) return;
    if (newX < 0 || newX >= map.width || newY < 0 || newY >= map.height) return;

    session.character.x = newX;
    session.character.y = newY;
    session.character.direction = dir;

    // 广播移动给附近玩家
    this.broadcastNearby(session, {
      type: MSG.SERVER.ENTITY_MOVE,
      data: {
        id: playerId,
        entityType: 'player',
        x: newX,
        y: newY,
        direction: dir,
      },
    });

    // 检查传送点
    this.checkPortals(session);

    // 发送附近实体信息
    this.sendNearbyEntities(session);
  }

  // ====== 攻击 ======
  private handleAttack(playerId: string, data: any): void {
    const session = this.sessions.get(playerId);
    if (!session || !session.alive) return;

    const now = Date.now();
    const attackSpeed = Math.max(500, 1500 - session.character.stats.AttackSpeed * 50);
    if (now - session.lastAttackAt < attackSpeed) return;
    session.lastAttackAt = now;

    const targetId = data.targetId as string;
    if (!targetId) return;

    // 获取目标怪物
    const map = mapManager.getMap(session.character.mapId);
    if (!map) return;

    const monster = map.monsters.get(targetId);
    if (!monster || monster.state === MonsterState.Dead) return;

    // 距离检查
    const dist = getDistance(session.character.x, session.character.y, monster.x, monster.y);
    if (dist > 2) return;

    // 面向目标
    session.character.direction = getDirection(
      session.character.x, session.character.y,
      monster.x, monster.y,
    );

    // 计算伤害
    const result = playerAttackMonster(session.character, monster.def);

    if (result.miss) {
      // Miss
      this.send(session.ws, {
        type: MSG.SERVER.COMBAT_RESULT,
        data: {
          targetId,
          damage: 0,
          miss: true,
          critical: false,
          attackerX: session.character.x,
          attackerY: session.character.y,
        },
      });
      return;
    }

    // 扣血
    monster.hp = Math.max(0, monster.hp - result.damage);

    // 广播伤害
    this.broadcastNearby(session, {
      type: MSG.SERVER.COMBAT_RESULT,
      data: {
        targetId,
        damage: result.damage,
        miss: false,
        critical: result.critical,
        damageType: result.damageType,
        attackerX: session.character.x,
        attackerY: session.character.y,
        targetX: monster.x,
        targetY: monster.y,
      },
    });

    // 怪物进入战斗状态
    if (monster.state === MonsterState.Idle || monster.state === MonsterState.Walking) {
      monster.state = MonsterState.Attacking;
      monster.targetId = playerId;
    }

    // 怪物死亡
    if (monster.hp <= 0) {
      this.handleMonsterDeath(session, monster);
    }
  }

  // ====== 怪物死亡处理 ======
  private handleMonsterDeath(session: PlayerSession, monster: MonsterInstance): void {
    monster.state = MonsterState.Dead;
    monster.deadAt = Date.now();

    // 计算经验
    const expGain = calculateExpGain(
      session.character.level,
      monster.def.level,
      monster.def.experience,
    );

    // 计算掉落
    const drops = rollDrops(monster.def);

    // 添加掉落物品到地图
    const droppedItems: DroppedItem[] = [];
    for (const drop of drops) {
      const item = mapManager.getOrInitMap(session.character.mapId)
        .addDroppedItem(drop.itemId, drop.count, monster.x, monster.y, session.playerId);
      droppedItems.push(item);
    }

    // 发送击杀信息
    this.send(session.ws, {
      type: MSG.SERVER.MONSTER_KILLED,
      data: {
        monsterId: monster.id,
        expGain,
        drops: droppedItems.map(d => ({
          id: d.id,
          itemId: d.itemId,
          count: d.count,
          x: d.x,
          y: d.y,
        })),
      },
    });

    // 增加经验
    this.addExperience(session, expGain);

    // 广播怪物死亡
    this.broadcastNearby(session, {
      type: MSG.SERVER.ENTITY_DIE,
      data: { id: monster.id, entityType: 'monster' },
    });
  }

  // ====== 经验与升级 ======
  private addExperience(session: PlayerSession, exp: number): void {
    const char = session.character;
    char.experience += exp;

    const expNeeded = gameData.getExpForLevel(char.level);
    while (char.experience >= expNeeded && char.level < 100) {
      char.experience -= expNeeded;
      char.level++;
      this.handleLevelUp(session);
    }

    this.sendStats(session);
  }

  private handleLevelUp(session: PlayerSession): void {
    const char = session.character;

    // 根据职业增加属性 (参考 Crystal BaseStats)
    const baseStats = gameData.getClassBaseStats(char.class as MirClass);
    const levelBonus = char.level - 1;

    // 每级增加的属性 (简化版)
    switch (char.class) {
      case 'warrior':
        char.stats.MaxHP += 14 + levelBonus;
        char.stats.MaxMP += 3;
        char.stats.MinDC += 1;
        char.stats.MaxDC += 2;
        break;
      case 'wizard':
        char.stats.MaxHP += 5;
        char.stats.MaxMP += 12 + levelBonus;
        char.stats.MinMC += 1;
        char.stats.MaxMC += 2;
        break;
      case 'taoist':
        char.stats.MaxHP += 8;
        char.stats.MaxMP += 8;
        char.stats.MinSC += 1;
        char.stats.MaxSC += 2;
        break;
    }

    // 回满血蓝
    char.stats.HP = char.stats.MaxHP;
    char.stats.MP = char.stats.MaxMP;

    // 广播升级特效
    this.broadcastNearby(session, {
      type: MSG.SERVER.LEVEL_UP,
      data: {
        id: session.playerId,
        level: char.level,
      },
    });

    this.send(session.ws, {
      type: MSG.SERVER.SYSTEM_MSG,
      data: { message: `恭喜升级到 ${char.level} 级！`, type: 'levelup' },
    });
  }

  // ====== 拾取物品 ======
  private handlePickup(playerId: string, data: any): void {
    const session = this.sessions.get(playerId);
    if (!session || !session.alive) return;

    const itemId = data.itemId as string;
    if (!itemId) return;

    const map = mapManager.getMap(session.character.mapId);
    if (!map) return;

    const item = map.pickupItem(itemId, playerId);
    if (!item) {
      this.send(session.ws, {
        type: MSG.SERVER.SYSTEM_MSG,
        data: { message: '无法拾取该物品', type: 'error' },
      });
      return;
    }

    // 金币直接加
    if (item.itemId === 0) {
      session.character.gold += item.count;
      this.send(session.ws, {
        type: MSG.SERVER.PICKUP_ITEM,
        data: { itemId: 0, name: '金币', count: item.count, isGold: true },
      });
    } else {
      // 加入背包
      const itemDef = gameData.getItem(item.itemId);
      const invItem: InventoryItem = {
        itemId: item.itemId,
        name: itemDef?.name || `物品#${item.itemId}`,
        count: item.count,
        type: itemDef?.type || 0,
        quality: itemDef?.quality || 0,
        stats: itemDef?.stats || {},
        equipped: false,
      };

      // 尝试堆叠
      const existing = session.character.inventory.find(
        i => i.itemId === item.itemId && i.count < (itemDef?.maxStack || 1),
      );
      if (existing && itemDef?.stackable) {
        existing.count = Math.min(existing.count + item.count, itemDef.maxStack);
      } else if (session.character.inventory.length < 40) {
        session.character.inventory.push(invItem);
      } else {
        // 背包满了，放回地图
        map.addDroppedItem(item.itemId, item.count, session.character.x, session.character.y, null);
        this.send(session.ws, {
          type: MSG.SERVER.SYSTEM_MSG,
          data: { message: '背包已满！', type: 'error' },
        });
        return;
      }

      this.send(session.ws, {
        type: MSG.SERVER.PICKUP_ITEM,
        data: { itemId: item.itemId, name: invItem.name, count: item.count, isGold: false },
      });
    }

    this.sendStats(session);
  }

  // ====== 装备物品 ======
  private handleEquipItem(playerId: string, data: any): void {
    const session = this.sessions.get(playerId);
    if (!session) return;

    const { inventoryIndex } = data;
    const item = session.character.inventory[inventoryIndex];
    if (!item) return;

    if (item.equipped) {
      // 卸下装备
      item.equipped = false;
      // 移除属性加成
      if (item.stats) {
        for (const [key, val] of Object.entries(item.stats)) {
          if (key in session.character.stats) {
            (session.character.stats as any)[key] -= val;
          }
        }
      }
    } else {
      // 装备
      // 先检查职业和等级要求
      const itemDef = gameData.getItem(item.itemId);
      if (itemDef) {
        if (itemDef.requiredLevel > session.character.level) {
          this.send(session.ws, {
            type: MSG.SERVER.SYSTEM_MSG,
            data: { message: `需要 ${itemDef.requiredLevel} 级才能装备`, type: 'error' },
          });
          return;
        }
      }

      // 卸下同部位装备
      const slot = this.getEquipSlot(item.type);
      if (slot !== null) {
        for (const inv of session.character.inventory) {
          if (inv.equipped && this.getEquipSlot(inv.type) === slot) {
            inv.equipped = false;
            if (inv.stats) {
              for (const [key, val] of Object.entries(inv.stats)) {
                if (key in session.character.stats) {
                  (session.character.stats as any)[key] -= val;
                }
              }
            }
          }
        }
      }

      item.equipped = true;
      // 添加属性加成
      if (item.stats) {
        for (const [key, val] of Object.entries(item.stats)) {
          if (key in session.character.stats) {
            (session.character.stats as any)[key] += val;
          }
        }
      }
    }

    this.sendStats(session);
    this.sendInventory(session);
  }

  // ====== 使用物品 ======
  private handleUseItem(playerId: string, data: any): void {
    const session = this.sessions.get(playerId);
    if (!session) return;

    const { inventoryIndex } = data;
    const item = session.character.inventory[inventoryIndex];
    if (!item) return;

    const itemDef = gameData.getItem(item.itemId);
    if (!itemDef) return;

    // 药水
    if (item.type === 6) { // Potion
      const healAmount = itemDef.stats?.MaxHP || 50;
      const manaAmount = itemDef.stats?.MaxMP || 50;

      if (healAmount > 0) {
        session.character.stats.HP = Math.min(
          session.character.stats.MaxHP,
          session.character.stats.HP + healAmount,
        );
      }
      if (manaAmount > 0) {
        session.character.stats.MP = Math.min(
          session.character.stats.MaxMP,
          session.character.stats.MP + manaAmount,
        );
      }

      item.count--;
      if (item.count <= 0) {
        session.character.inventory.splice(inventoryIndex, 1);
      }

      this.sendStats(session);
      this.sendInventory(session);
    }
  }

  // ====== 丢弃物品 ======
  private handleDropItem(playerId: string, data: any): void {
    const session = this.sessions.get(playerId);
    if (!session) return;

    const { inventoryIndex, count } = data;
    const item = session.character.inventory[inventoryIndex];
    if (!item || item.equipped) return;

    const dropCount = Math.min(count || 1, item.count);
    item.count -= dropCount;

    const map = mapManager.getMap(session.character.mapId);
    if (map) {
      map.addDroppedItem(item.itemId, dropCount, session.character.x, session.character.y, null);
    }

    if (item.count <= 0) {
      session.character.inventory.splice(inventoryIndex, 1);
    }

    this.sendInventory(session);
  }

  // ====== 使用技能 ======
  private handleUseSkill(playerId: string, data: any): void {
    const session = this.sessions.get(playerId);
    if (!session || !session.alive) return;

    const { skillId, targetId } = data;
    const skill = gameData.getSkill(skillId);
    if (!skill) return;

    // 检查MP
    if (session.character.stats.MP < skill.mpCost) {
      this.send(session.ws, {
        type: MSG.SERVER.SYSTEM_MSG,
        data: { message: '魔法值不足', type: 'error' },
      });
      return;
    }

    // 扣MP
    session.character.stats.MP -= skill.mpCost;

    // 技能攻击 (简化为强化版普通攻击)
    if (targetId) {
      const map = mapManager.getMap(session.character.mapId);
      if (!map) return;
      const monster = map.monsters.get(targetId);
      if (!monster || monster.state === MonsterState.Dead) return;

      const dist = getDistance(session.character.x, session.character.y, monster.x, monster.y);
      if (dist > skill.range + 1) return;

      // 技能伤害 = 普通攻击 * 技能倍率
      const baseResult = playerAttackMonster(session.character, monster.def);
      const skillDamage = Math.floor(baseResult.damage * skill.damage);

      if (!baseResult.miss && skillDamage > 0) {
        monster.hp = Math.max(0, monster.hp - skillDamage);

        this.broadcastNearby(session, {
          type: MSG.SERVER.COMBAT_RESULT,
          data: {
            targetId,
            damage: skillDamage,
            miss: false,
            critical: baseResult.critical,
            damageType: skill.type === 'magical' ? 'magical' : 'physical',
            isSkill: true,
            skillId,
          },
        });

        if (monster.hp <= 0) {
          this.handleMonsterDeath(session, monster);
        }
      }
    }

    this.sendStats(session);
  }

  // ====== 切换地图 ======
  private handleChangeMap(playerId: string, data: any): void {
    const session = this.sessions.get(playerId);
    if (!session) return;

    const { targetMapId, targetX, targetY } = data;
    const map = mapManager.getOrInitMap(targetMapId);
    if (!map) return;

    session.character.mapId = targetMapId;
    session.character.x = targetX || Math.floor(map.width / 2);
    session.character.y = targetY || Math.floor(map.height / 2);

    this.sendEnterMap(session);
  }

  // ====== 辅助方法 ======

  private sendEnterMap(session: PlayerSession): void {
    const map = mapManager.getOrInitMap(session.character.mapId);
    if (!map) return;

    // 获取地图上的实体
    const nearbyMonsters = map.getMonstersNear(session.character.x, session.character.y, 20);
    const nearbyItems = map.getItemsNear(session.character.x, session.character.y, 20);

    this.send(session.ws, {
      type: MSG.SERVER.ENTER_MAP,
      data: {
        mapId: map.id,
        mapName: map.name,
        width: map.width,
        height: map.height,
        safeZone: map.safeZone,
        player: this.serializeCharacter(session),
        monsters: nearbyMonsters.map(m => ({
          id: m.id,
          defId: m.defId,
          name: m.def.name,
          level: m.def.level,
          x: m.x,
          y: m.y,
          hp: m.hp,
          maxHp: m.maxHp,
          direction: m.direction,
          state: m.state,
        })),
        items: nearbyItems.map(i => ({
          id: i.id,
          itemId: i.itemId,
          count: i.count,
          x: i.x,
          y: i.y,
        })),
        portals: gameData.getMap(map.id)?.portals || [],
      },
    });
  }

  private sendNearbyEntities(session: PlayerSession): void {
    const map = mapManager.getMap(session.character.mapId);
    if (!map) return;

    const nearbyMonsters = map.getMonstersNear(session.character.x, session.character.y, 15);
    const nearbyItems = map.getItemsNear(session.character.x, session.character.y, 15);

    this.send(session.ws, {
      type: MSG.SERVER.UPDATE_ENTITIES,
      data: {
        monsters: nearbyMonsters.map(m => ({
          id: m.id,
          defId: m.defId,
          name: m.def.name,
          level: m.def.level,
          x: m.x,
          y: m.y,
          hp: m.hp,
          maxHp: m.maxHp,
          direction: m.direction,
          state: m.state,
        })),
        items: nearbyItems.map(i => ({
          id: i.id,
          itemId: i.itemId,
          count: i.count,
          x: i.x,
          y: i.y,
        })),
      },
    });
  }

  private sendStats(session: PlayerSession): void {
    this.send(session.ws, {
      type: MSG.SERVER.STATS_UPDATE,
      data: {
        level: session.character.level,
        experience: session.character.experience,
        expNeeded: gameData.getExpForLevel(session.character.level),
        gold: session.character.gold,
        stats: session.character.stats,
      },
    });
  }

  private sendInventory(session: PlayerSession): void {
    this.send(session.ws, {
      type: MSG.SERVER.INVENTORY_UPDATE,
      data: { inventory: session.character.inventory },
    });
  }

  private serializeCharacter(session: PlayerSession) {
    return {
      id: session.playerId,
      name: session.character.name,
      class: session.character.class,
      level: session.character.level,
      x: session.character.x,
      y: session.character.y,
      direction: session.character.direction,
      stats: session.character.stats,
      experience: session.character.experience,
      expNeeded: gameData.getExpForLevel(session.character.level),
      gold: session.character.gold,
      inventory: session.character.inventory,
      skills: session.character.skills,
      mapId: session.character.mapId,
    };
  }

  private send(ws: WebSocket, msg: ServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  private broadcastNearby(session: PlayerSession, msg: ServerMessage): void {
    // 发送给附近玩家 (暂时只发给自己，后续多人时扩展)
    this.send(session.ws, msg);
  }

  private removePlayer(playerId: string): void {
    const session = this.sessions.get(playerId);
    if (session) {
      if (session.respawnTimer) clearTimeout(session.respawnTimer);
      this.sessions.delete(playerId);
      console.log(`[GameServer] Player ${playerId} disconnected`);
    }
  }

  private checkPortals(session: PlayerSession): void {
    const mapDef = gameData.getMap(session.character.mapId);
    if (!mapDef) return;

    for (const portal of mapDef.portals) {
      if (
        Math.abs(session.character.x - portal.x) <= 1 &&
        Math.abs(session.character.y - portal.y) <= 1
      ) {
        // 触发传送
        this.send(session.ws, {
          type: MSG.SERVER.PORTAL_INFO,
          data: {
            targetMapId: portal.targetMapId,
            targetX: portal.targetX,
            targetY: portal.targetY,
          },
        });
        break;
      }
    }
  }

  // ====== 怪物 AI ======
  private updateMonsterAI(): void {
    const now = Date.now();

    for (const map of mapManager.getAllMaps()) {
      for (const [, monster] of map.monsters) {
        if (monster.state === MonsterState.Dead) {
          // 检查是否该重生
          if (monster.deadAt && now - monster.deadAt > monster.respawnTime * 1000) {
            monster.state = MonsterState.Idle;
            monster.hp = monster.maxHp;
            monster.mp = monster.maxMp;
            monster.x = monster.spawnX + Math.floor(Math.random() * 5) - 2;
            monster.y = monster.spawnY + Math.floor(Math.random() * 5) - 2;
            monster.deadAt = null;
            monster.targetId = null;
          }
          continue;
        }

        // 有目标时追击攻击
        if (monster.state === MonsterState.Attacking && monster.targetId) {
          const session = this.sessions.get(monster.targetId);
          if (!session || !session.alive) {
            monster.state = MonsterState.Idle;
            monster.targetId = null;
            continue;
          }

          const dist = getDistance(monster.x, monster.y, session.character.x, session.character.y);

          if (dist <= 1) {
            // 攻击
            if (now - monster.lastAttackAt >= monster.def.attackSpeed) {
              monster.lastAttackAt = now;
              const result = monsterAttackPlayer(monster.def, session.character);

              if (!result.miss && result.damage > 0) {
                session.character.stats.HP = Math.max(0, session.character.stats.HP - result.damage);

                this.send(session.ws, {
                  type: MSG.SERVER.PLAYER_HIT,
                  data: {
                    damage: result.damage,
                    monsterId: monster.id,
                    critical: result.critical,
                  },
                });

                // 玩家死亡
                if (session.character.stats.HP <= 0) {
                  this.handlePlayerDeath(session);
                }
              }
            }
          } else if (dist <= monster.def.viewRange) {
            // 追击
            if (now - monster.lastMoveAt >= monster.def.moveSpeed) {
              monster.lastMoveAt = now;
              const dir = getDirection(monster.x, monster.y, session.character.x, session.character.y);
              const offset = DIRECTION_OFFSETS[dir];
              const newX = monster.x + offset.dx;
              const newY = monster.y + offset.dy;
              if (newX >= 0 && newX < map.width && newY >= 0 && newY < map.height) {
                monster.x = newX;
                monster.y = newY;
                monster.direction = dir;
              }
            }
          } else {
            // 目标太远，返回
            monster.state = MonsterState.Idle;
            monster.targetId = null;
          }
          continue;
        }

        // 空闲状态 - 随机巡逻
        if (monster.state === MonsterState.Idle) {
          if (now - monster.lastMoveAt >= monster.def.moveSpeed * 2) {
            monster.lastMoveAt = now;

            // 30% 概率移动
            if (Math.random() < 0.3) {
              const dir = Math.floor(Math.random() * 8) as Direction;
              const offset = DIRECTION_OFFSETS[dir];
              const newX = monster.x + offset.dx;
              const newY = monster.y + offset.dy;

              // 不超过出生点范围
              if (
                newX >= 0 && newX < map.width && newY >= 0 && newY < map.height &&
                Math.abs(newX - monster.spawnX) <= monster.spawnRange * 2 &&
                Math.abs(newY - monster.spawnY) <= monster.spawnRange * 2
              ) {
                monster.x = newX;
                monster.y = newY;
                monster.direction = dir;
                monster.state = MonsterState.Walking;
              }
            } else {
              monster.state = MonsterState.Walking;
            }
          }
        } else if (monster.state === MonsterState.Walking) {
          if (now - monster.lastMoveAt >= monster.def.moveSpeed) {
            monster.lastMoveAt = now;
            monster.state = MonsterState.Idle;
          }
        }
      }
    }
  }

  // ====== 玩家死亡 ======
  private handlePlayerDeath(session: PlayerSession): void {
    session.alive = false;

    this.send(session.ws, {
      type: MSG.SERVER.PLAYER_DIED,
      data: {
        message: '你已阵亡！',
        respawnTime: 5,
      },
    });

    // 5秒后自动复活
    session.respawnTimer = setTimeout(() => {
      session.alive = true;
      session.character.stats.HP = Math.floor(session.character.stats.MaxHP * 0.5);
      session.character.stats.MP = Math.floor(session.character.stats.MaxMP * 0.5);

      // 回到安全区
      const starterMap = gameData.getStarterMap();
      if (starterMap) {
        session.character.mapId = starterMap.id;
        session.character.x = Math.floor(starterMap.width / 2);
        session.character.y = Math.floor(starterMap.height / 2);
      }

      this.send(session.ws, {
        type: MSG.SERVER.PLAYER_RESPAWN,
        data: {
          x: session.character.x,
          y: session.character.y,
          mapId: session.character.mapId,
          stats: session.character.stats,
        },
      });

      this.sendEnterMap(session);
    }, 5000);
  }

  // ====== 生命回复 ======
  private updateRegeneration(): void {
    for (const [, session] of this.sessions) {
      if (!session.alive) continue;

      const stats = session.character.stats;
      if (stats.HP < stats.MaxHP) {
        const recovery = Math.max(1, stats.HealthRecovery + Math.floor(stats.MaxHP * 0.01));
        stats.HP = Math.min(stats.MaxHP, stats.HP + recovery);
      }
      if (stats.MP < stats.MaxMP) {
        const recovery = Math.max(1, stats.ManaRecovery + Math.floor(stats.MaxMP * 0.02));
        stats.MP = Math.min(stats.MaxMP, stats.MP + recovery);
      }

      this.sendStats(session);
    }
  }

  // ====== 装备部位映射 ======
  private getEquipSlot(itemType: number): number | null {
    // 0=weapon, 1=armor, 2=helmet, 3=boots, 4=necklace, 5=ring, 6=bracelet, 7=belt
    const slotMap: Record<number, number> = {
      1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 7,
    };
    return slotMap[itemType] ?? null;
  }

  // 获取玩家会话 (供 REST API 使用)
  getSession(playerId: string): PlayerSession | undefined {
    return this.sessions.get(playerId);
  }

  // 关闭
  shutdown(): void {
    if (this.monsterAITimer) clearInterval(this.monsterAITimer);
    if (this.regenTimer) clearInterval(this.regenTimer);
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    if (this.wss) this.wss.close();
  }
}

export const gameServer = new GameServer();
