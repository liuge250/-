import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";
import http from "http";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 9091;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve AI Legend of MIR game static files
const mirGamePath = path.resolve(__dirname, '../public/mir-game');
app.use('/mir-game', express.static(mirGamePath));

// Serve Expo client static assets (production)
// 优先使用 server/public/client (已提交到git)，回退到 client/dist (开发环境)
const clientDistPath = path.resolve(__dirname, '../public/client');
const clientDevPath = path.resolve(__dirname, '../../client/dist');
const activeClientPath = fs.existsSync(clientDistPath) ? clientDistPath : clientDevPath;
if (fs.existsSync(activeClientPath)) {
  app.use('/_expo', express.static(path.join(activeClientPath, '_expo')));
  app.use('/assets', express.static(path.join(activeClientPath, 'assets')));
}

// Game data API endpoints (serve JSON data for the game client)
const gameDataPath = path.resolve(__dirname, '../../mir-tools/game-data');
app.get('/api/v1/game/data/:filename', (req: any, res: any) => {
  const filename = req.params.filename;
  const filePath = path.join(gameDataPath, filename);
  
  // Security check
  if (!filePath.startsWith(gameDataPath)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Data file not found' });
  }
  
  res.sendFile(filePath);
});

// Serve game map files (MirServer地图文件，仅开发环境可用)
const mapFilePath = path.resolve(__dirname, '../../MirServer/Mir200/Map');
app.get('/api/v1/game/maps/:filename', (req: any, res: any) => {
  if (!fs.existsSync(mapFilePath)) {
    return res.status(404).json({ error: 'Map data not available' });
  }
  const filename = req.params.filename;
  const filePath = path.join(mapFilePath, filename);
  
  if (!filePath.startsWith(mapFilePath)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Map file not found' });
  }
  
  res.sendFile(filePath);
});

app.get('/api/v1/health', (req, res) => {
  console.log('Health check success');
  res.status(200).json({ status: 'ok' });
});

// ==========================================
// 用户认证系统
// ==========================================
interface UserRecord {
  id: string;
  username: string;
  passwordHash: string;
  salt: string;
  email: string;
  createdAt: string;
  lastLoginAt: string;
  characterClass: string;
  level: number;
}

// 使用内存存储用户数据（部署环境文件系统只读）
let usersStore: UserRecord[] = [];

// 加载用户数据（内存）
function loadUsers(): UserRecord[] {
  return usersStore;
}

// 保存用户数据（内存）
function saveUsers(users: UserRecord[]): void {
  usersStore = users;
}

// 密码哈希
function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

// 注册
app.post('/api/v1/auth/register', (req, res) => {
  const { username, password, email } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }
  
  if (username.length < 3 || username.length > 20) {
    return res.status(400).json({ error: '用户名长度需在3-20个字符之间' });
  }
  
  if (password.length < 6) {
    return res.status(400).json({ error: '密码长度至少6个字符' });
  }
  
  const users = loadUsers();
  const existingUser = users.find(u => u.username.toLowerCase() === username.toLowerCase());
  
  if (existingUser) {
    return res.status(409).json({ error: '用户名已存在' });
  }
  
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(password, salt);
  
  const newUser: UserRecord = {
    id: crypto.randomUUID(),
    username: username.toLowerCase(),
    passwordHash,
    salt,
    email: email || '',
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
    characterClass: '',
    level: 1,
  };
  
  users.push(newUser);
  saveUsers(users);
  
  // 返回token（简化版，直接用userId）
  const token = Buffer.from(`${newUser.id}:${newUser.username}`).toString('base64');
  
  res.status(201).json({
    success: true,
    message: '注册成功',
    token,
    user: {
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      level: newUser.level,
      createdAt: newUser.createdAt,
    },
  });
});

// 登录
app.post('/api/v1/auth/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }
  
  const users = loadUsers();
  const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
  
  if (!user) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }
  
  const passwordHash = hashPassword(password, user.salt);
  
  if (passwordHash !== user.passwordHash) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }
  
  // 更新最后登录时间
  user.lastLoginAt = new Date().toISOString();
  saveUsers(users);
  
  const token = Buffer.from(`${user.id}:${user.username}`).toString('base64');
  
  res.json({
    success: true,
    message: '登录成功',
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      level: user.level,
      characterClass: user.characterClass,
    },
  });
});

// 获取用户信息（通过token）
app.get('/api/v1/auth/me', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未授权' });
  }
  
  const token = authHeader.substring(7);
  
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const [userId] = decoded.split(':');
    
    const users = loadUsers();
    const user = users.find(u => u.id === userId);
    
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      level: user.level,
      characterClass: user.characterClass,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    });
  } catch {
    return res.status(401).json({ error: '无效的token' });
  }
});

// VIP 商城 API
const VIP_ITEMS = {
  treasure_3d: { id: 'treasure_3d', name: '打宝符(3天)', description: '3天内打怪经验+50%，掉落率+30%，金币+50%', price: 30, effects: { expMultiplier: 1.5, dropMultiplier: 1.3, goldMultiplier: 1.5 } },
  treasure_7d: { id: 'treasure_7d', name: '打宝符(7天)', description: '7天内打怪经验+80%，掉落率+50%，金币+80%。新手推荐！', price: 68, effects: { expMultiplier: 1.8, dropMultiplier: 1.5, goldMultiplier: 1.8 } },
  treasure_30d: { id: 'treasure_30d', name: '打宝符(30天)', description: '30天内打怪经验+100%，掉落率+80%，金币+100%。超值之选！', price: 198, effects: { expMultiplier: 2.0, dropMultiplier: 1.8, goldMultiplier: 2.0 } },
  exp_boost: { id: 'exp_boost', name: '经验丹', description: '使用后1小时内经验获取翻倍', price: 10, effects: { expMultiplier: 2.0, dropMultiplier: 1.0, goldMultiplier: 1.0 } },
  drop_boost: { id: 'drop_boost', name: '掉落符', description: '使用后1小时内掉落率提升100%', price: 10, effects: { expMultiplier: 1.0, dropMultiplier: 2.0, goldMultiplier: 1.0 } },
};

// 获取商城道具列表
app.get('/api/v1/shop', (req, res) => {
  res.json({ items: Object.values(VIP_ITEMS) });
});

// 购买道具（模拟支付）
app.post('/api/v1/shop/purchase', (req, res) => {
  const { itemId, playerId } = req.body;
  const item = VIP_ITEMS[itemId as keyof typeof VIP_ITEMS];
  if (!item) {
    return res.status(400).json({ error: '道具不存在' });
  }
  // 模拟支付成功
  res.json({ success: true, message: `购买${item.name}成功`, item, playerId });
});

// 获取玩家 VIP 状态
app.get('/api/v1/vip/status/:playerId', (req, res) => {
  res.json({ playerId: req.params.playerId, activeItems: [], bonus: { expMultiplier: 1.0, dropMultiplier: 1.0, goldMultiplier: 1.0 } });
});

// 职业信息
const CLASSES = {
  warrior: { id: 'warrior', name: '战士', description: '近战物理攻击，高生命高防御。擅长正面硬刚，是团队的前排坦克。', baseStats: { hp: 200, mp: 50, attack: 15, defense: 12, speed: 8 } },
  mage: { id: 'mage', name: '法师', description: '远程魔法攻击，群体伤害极高。擅长范围清怪，但生命较低。', baseStats: { hp: 100, mp: 200, attack: 25, defense: 5, speed: 10 } },
  taoist: { id: 'taoist', name: '道士', description: '辅助型职业，可召唤神兽、施毒、治疗。全能型，适合单人打宝。', baseStats: { hp: 150, mp: 120, attack: 12, defense: 8, speed: 12 } },
};

app.get('/api/v1/classes', (req, res) => {
  res.json({ classes: Object.values(CLASSES) });
});

// 根路径 → Expo client (登录页)
if (fs.existsSync(activeClientPath)) {
  app.get('/', (req: any, res: any) => {
    res.sendFile(path.join(activeClientPath, 'index.html'));
  });
} else {
  // 没有Expo客户端，根路径返回安装页
  app.get('/', (req: any, res: any) => {
    res.sendFile(path.join(mirGamePath, 'install.html'));
  });
}

// 其他路由 → Expo client SPA (if exists)
if (fs.existsSync(activeClientPath)) {
  app.get('*', (req: any, res: any) => {
    // 如果是 /mir-game/ 下的请求，让静态文件中间件处理
    if (req.path.startsWith('/mir-game')) {
      return res.sendFile(path.join(mirGamePath, 'index.html'));
    }
    res.sendFile(path.join(activeClientPath, 'index.html'));
  });
} else {
  // 没有Expo客户端，根路径返回安装页
  app.get('*', (req: any, res: any) => {
    if (req.path.startsWith('/mir-game')) {
      return res.sendFile(path.join(mirGamePath, 'index.html'));
    }
    res.sendFile(path.join(mirGamePath, 'install.html'));
  });
}

// Create HTTP server
const server = http.createServer(app);

server.listen(port, () => {
  console.log(`🎮 AI Legend of MIR Server running at http://localhost:${port}/`);
  console.log(`🌐 Game: http://localhost:${port}/mir-game/`);
  console.log(`📊 Health: http://localhost:${port}/api/v1/health`);
});
