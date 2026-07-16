// ============================================================
// MenuScene - 登录/注册场景
// ============================================================
class MenuScene extends Phaser.Scene {
  constructor() { super('MenuScene'); }

  create() {
    const { width, height } = this.scale;
    const centerX = width / 2;
    const centerY = height / 2;

    // 背景
    this.add.rectangle(0, 0, width, height, 0x0a0a1a).setOrigin(0);

    // 装饰粒子
    for (let i = 0; i < 50; i++) {
      const star = this.add.circle(
        Math.random() * width,
        Math.random() * height,
        Math.random() * 2 + 0.5,
        0xFFD700,
        Math.random() * 0.5 + 0.2
      );
      this.tweens.add({
        targets: star, alpha: 0, duration: 2000 + Math.random() * 3000,
        yoyo: true, repeat: -1,
      });
    }

    // 标题
    this.add.text(centerX, centerY - 180, 'AI传奇', {
      fontSize: '56px', fill: '#FFD700', fontFamily: 'serif',
      stroke: '#8B4513', strokeThickness: 4,
    }).setOrigin(0.5);

    this.add.text(centerX, centerY - 120, '玛法大陆', {
      fontSize: '28px', fill: '#C0A060', fontFamily: 'serif',
    }).setOrigin(0.5);

    // 登录面板
    const panelW = Math.min(360, width - 40);
    const panelH = 320;
    const panelX = centerX - panelW / 2;
    const panelY = centerY - 60;

    this.add.rectangle(panelX, panelY, panelW, panelH, 0x1a1a2e, 0.9)
      .setOrigin(0).setStrokeStyle(2, 0xFFD700);

    // Tab 切换
    let isLogin = true;
    const tabLogin = this.add.text(centerX - 60, panelY + 15, '登录', {
      fontSize: '18px', fill: '#FFD700', fontFamily: 'serif',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    const tabRegister = this.add.text(centerX + 60, panelY + 15, '注册', {
      fontSize: '18px', fill: '#888888', fontFamily: 'serif',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    const inputW = panelW - 60;
    const inputX = panelX + 30;

    // 用户名
    this.add.text(inputX, panelY + 55, '用户名', { fontSize: '13px', fill: '#aaaaaa' });
    const usernameBg = this.add.rectangle(inputX, panelY + 75, inputW, 36, 0x2a2a3e, 1)
      .setOrigin(0).setStrokeStyle(1, 0x444466);
    const usernameText = this.add.text(inputX + 10, panelY + 82, '', {
      fontSize: '15px', fill: '#ffffff', fontFamily: 'monospace',
    });

    // 密码
    this.add.text(inputX, panelY + 120, '密码', { fontSize: '13px', fill: '#aaaaaa' });
    const passwordBg = this.add.rectangle(inputX, panelY + 140, inputW, 36, 0x2a2a3e, 1)
      .setOrigin(0).setStrokeStyle(1, 0x444466);
    const passwordText = this.add.text(inputX + 10, panelY + 147, '', {
      fontSize: '15px', fill: '#ffffff', fontFamily: 'monospace',
    });

    // 状态消息
    const statusText = this.add.text(centerX, panelY + 200, '', {
      fontSize: '13px', fill: '#ff4444',
    }).setOrigin(0.5);

    // 提交按钮
    const btnW = 200;
    const btnH = 42;
    const btnBg = this.add.rectangle(centerX, panelY + 250, btnW, btnH, 0x8B4513, 1)
      .setOrigin(0.5).setStrokeStyle(2, 0xFFD700).setInteractive({ useHandCursor: true });
    const btnText = this.add.text(centerX, panelY + 250, '登录', {
      fontSize: '16px', fill: '#FFD700', fontFamily: 'serif',
    }).setOrigin(0.5);

    // 输入状态
    let activeInput = 'username';
    let username = '';
    let password = '';

    // 高亮当前输入框
    const updateHighlight = () => {
      usernameBg.setStrokeStyle(1, activeInput === 'username' ? 0xFFD700 : 0x444466);
      passwordBg.setStrokeStyle(1, activeInput === 'password' ? 0xFFD700 : 0x444466);
    };

    // 点击切换输入框
    usernameBg.on('pointerdown', () => { activeInput = 'username'; updateHighlight(); });
    passwordBg.on('pointerdown', () => { activeInput = 'password'; updateHighlight(); });

    // Tab 切换
    tabLogin.on('pointerdown', () => {
      isLogin = true;
      tabLogin.setColor('#FFD700');
      tabRegister.setColor('#888888');
      btnText.setText('登录');
      statusText.setText('');
    });
    tabRegister.on('pointerdown', () => {
      isLogin = false;
      tabRegister.setColor('#FFD700');
      tabLogin.setColor('#888888');
      btnText.setText('注册');
      statusText.setText('');
    });

    // 键盘输入
    this.input.keyboard.on('keydown', (event) => {
      if (event.key === 'Tab') {
        activeInput = activeInput === 'username' ? 'password' : 'username';
        updateHighlight();
        return;
      }
      if (event.key === 'Enter') {
        btnBg.emit('pointerdown');
        return;
      }
      if (event.key === 'Backspace') {
        if (activeInput === 'username') username = username.slice(0, -1);
        else password = password.slice(0, -1);
      } else if (event.key.length === 1) {
        if (activeInput === 'username' && username.length < 20) username += event.key;
        else if (activeInput === 'password' && password.length < 20) password += event.key;
      }
      usernameText.setText(username || (activeInput === 'username' ? '|' : ''));
      passwordText.setText(password ? '*'.repeat(password.length) : (activeInput === 'password' ? '|' : ''));
    });

    // 提交
    btnBg.on('pointerdown', async () => {
      if (!username || !password) {
        statusText.setText('请输入用户名和密码');
        return;
      }
      statusText.setText('处理中...');
      statusText.setColor('#aaaaaa');

      try {
        const endpoint = isLogin ? '/api/v1/auth/login' : '/api/v1/auth/register';
        const resp = await fetch(API_BASE + endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });
        const data = await resp.json();
        if (!resp.ok) {
          statusText.setText(data.error || '操作失败');
          statusText.setColor('#ff4444');
          return;
        }
        window.gameData.token = data.token;
        window.gameData.username = data.username;
        window.gameData.playerId = data.username;
        statusText.setText('登录成功!');
        statusText.setColor('#00ff00');
        this.time.delayedCall(500, () => this.scene.start('CharacterSelectScene'));
      } catch (e) {
        statusText.setText('网络错误: ' + e.message);
        statusText.setColor('#ff4444');
      }
    });

    btnBg.on('pointerover', () => btnBg.setFillStyle(0xA0522D));
    btnBg.on('pointerout', () => btnBg.setFillStyle(0x8B4513));

    // 版本信息
    this.add.text(10, height - 20, `v${GAME_VERSION}`, {
      fontSize: '11px', fill: '#555555',
    });
  }
}
