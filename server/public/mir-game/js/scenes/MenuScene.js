// 传奇先锋 - 菜单场景（登录/注册）
class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
    this.isLogin = true;
  }

  create() {
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const C = GAME_CONFIG.COLORS;

    // 背景
    this.add.rectangle(w / 2, h / 2, w, h, 0x0A0A0F);

    // 装饰粒子
    for (let i = 0; i < 50; i++) {
      const x = Phaser.Math.Between(0, w);
      const y = Phaser.Math.Between(0, h);
      const alpha = Phaser.Math.FloatBetween(0.1, 0.4);
      const size = Phaser.Math.Between(1, 3);
      const star = this.add.rectangle(x, y, size, size, 0xC9A96E, alpha);
      this.tweens.add({
        targets: star,
        alpha: { from: alpha, to: 0 },
        duration: Phaser.Math.Between(2000, 5000),
        repeat: -1,
      });
    }

    // 标题
    this.add.text(w / 2, h * 0.15, '传奇先锋', {
      fontFamily: 'serif',
      fontSize: '48px',
      color: '#C9A96E',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);

    this.add.text(w / 2, h * 0.15 + 50, 'AI时代的致敬版传奇', {
      fontFamily: 'sans-serif',
      fontSize: '16px',
      color: '#888888',
    }).setOrigin(0.5);

    // 登录面板
    const panelW = 360;
    const panelH = 380;
    const panelX = w / 2 - panelW / 2;
    const panelY = h * 0.3;

    const panel = this.add.rectangle(w / 2, panelY + panelH / 2, panelW, panelH, 0x1A1A2E, 0.9);
    panel.setStrokeStyle(2, 0xC9A96E, 0.5);
    panel.setOrigin(0.5);

    // 标题切换
    this.titleText = this.add.text(w / 2, panelY + 30, '账号登录', {
      fontFamily: 'sans-serif',
      fontSize: '20px',
      color: '#C9A96E',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // 用户名输入
    const inputBg1 = this.add.rectangle(w / 2, panelY + 90, 280, 44, 0x0A0A0F, 0.8);
    inputBg1.setStrokeStyle(1, 0x444444);
    inputBg1.setOrigin(0.5);

    this.usernameInput = this.add.dom(w / 2, panelY + 90).createFromHTML(`
      <input type="text" id="username-input" placeholder="请输入账号"
        style="width:260px;height:36px;background:transparent;border:none;color:#E8E8E8;font-size:16px;outline:none;text-align:center;"
        maxlength="20">
    `);

    // 密码输入
    const inputBg2 = this.add.rectangle(w / 2, panelY + 150, 280, 44, 0x0A0A0F, 0.8);
    inputBg2.setStrokeStyle(1, 0x444444);
    inputBg2.setOrigin(0.5);

    this.passwordInput = this.add.dom(w / 2, panelY + 150).createFromHTML(`
      <input type="password" id="password-input" placeholder="请输入密码"
        style="width:260px;height:36px;background:transparent;border:none;color:#E8E8E8;font-size:16px;outline:none;text-align:center;"
        maxlength="20">
    `);

    // 登录按钮
    this.loginBtn = this.createButton(w / 2, panelY + 220, '登 录', () => this.handleSubmit());

    // 切换注册/登录
    this.switchText = this.add.text(w / 2, panelY + 280, '没有账号？点击注册', {
      fontFamily: 'sans-serif',
      fontSize: '14px',
      color: '#C9A96E',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    this.switchText.on('pointerdown', () => {
      this.isLogin = !this.isLogin;
      this.titleText.setText(this.isLogin ? '账号登录' : '账号注册');
      this.loginBtn.setText(this.isLogin ? '登 录' : '注 册');
      this.switchText.setText(this.isLogin ? '没有账号？点击注册' : '已有账号？点击登录');
    });

    // 提示文本
    this.hintText = this.add.text(w / 2, panelY + 330, '', {
      fontFamily: 'sans-serif',
      fontSize: '13px',
      color: '#FF5252',
    }).setOrigin(0.5);

    // 底部信息
    this.add.text(w / 2, h - 30, '基于 OpenMir2 & Crystal 二次开发', {
      fontFamily: 'sans-serif',
      fontSize: '12px',
      color: '#555555',
    }).setOrigin(0.5);

    // 检查是否已登录
    const savedToken = localStorage.getItem('mir_token');
    const savedUsername = localStorage.getItem('mir_username');
    if (savedToken && savedUsername) {
      window.MIR.token = savedToken;
      window.MIR.username = savedUsername;
      this.checkExistingCharacter();
    }
  }

  createButton(x, y, text, callback) {
    const btn = this.add.text(x, y, text, {
      fontFamily: 'sans-serif',
      fontSize: '18px',
      color: '#0A0A0F',
      fontStyle: 'bold',
      backgroundColor: '#C9A96E',
      padding: { x: 40, y: 12 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    btn.on('pointerover', () => btn.setStyle({ backgroundColor: '#D4B87A' }));
    btn.on('pointerout', () => btn.setStyle({ backgroundColor: '#C9A96E' }));
    btn.on('pointerdown', callback);
    return btn;
  }

  async handleSubmit() {
    const usernameEl = document.getElementById('username-input');
    const passwordEl = document.getElementById('password-input');
    const username = usernameEl?.value?.trim();
    const password = passwordEl?.value?.trim();

    if (!username || !password) {
      this.hintText.setText('请输入账号和密码');
      return;
    }

    if (username.length < 3 || password.length < 3) {
      this.hintText.setText('账号和密码至少3个字符');
      return;
    }

    this.hintText.setText('处理中...');
    this.loginBtn.disableInteractive();

    try {
      const endpoint = this.isLogin ? '/api/v1/auth/login' : '/api/v1/auth/register';
      const response = await fetch(`${GAME_CONFIG.API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok && data.token) {
        window.MIR.token = data.token;
        window.MIR.username = username;
        localStorage.setItem('mir_token', data.token);
        localStorage.setItem('mir_username', username);
        this.checkExistingCharacter();
      } else {
        this.hintText.setText(data.error || data.message || '操作失败');
        this.loginBtn.setInteractive();
      }
    } catch (err) {
      this.hintText.setText('网络错误，请重试');
      this.loginBtn.setInteractive();
    }
  }

  async checkExistingCharacter() {
    try {
      const response = await fetch(`${GAME_CONFIG.API_BASE}/api/v1/character/list`, {
        headers: { 'Authorization': `Bearer ${window.MIR.token}` },
      });
      const data = await response.json();

      if (data.characters && data.characters.length > 0) {
        // 有角色，直接进入游戏
        window.MIR.character = data.characters[0];
        this.scene.start('GameScene');
      } else {
        // 没有角色，进入角色创建
        this.scene.start('CharacterSelectScene');
      }
    } catch (err) {
      // 获取角色列表失败，进入角色创建
      this.scene.start('CharacterSelectScene');
    }
  }
}
