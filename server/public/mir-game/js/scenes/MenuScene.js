/**
 * Menu Scene - Login/Register + Main Menu
 */
export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create() {
    const { width, height } = this.scale;
    
    // Dark background with gradient
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0a0a1a, 0x0a0a1a, 0x1a0a2e, 0x1a0a2e, 1);
    bg.fillRect(0, 0, width, height);

    // Decorative particles
    for (let i = 0; i < 50; i++) {
      const x = Phaser.Math.Between(0, width);
      const y = Phaser.Math.Between(0, height);
      const alpha = Phaser.Math.FloatBetween(0.1, 0.4);
      const dot = this.add.circle(x, y, Phaser.Math.Between(1, 3), 0xFFD700, alpha);
      this.tweens.add({
        targets: dot,
        alpha: 0,
        y: y - 30,
        duration: Phaser.Math.Between(2000, 5000),
        repeat: -1,
        yoyo: true,
      });
    }

    // Title
    this.add.text(width / 2, height * 0.15, 'AI 传 奇', {
      fontSize: '56px',
      color: '#FFD700',
      fontFamily: 'Microsoft YaHei, PingFang SC, sans-serif',
      fontStyle: 'bold',
      stroke: '#000',
      strokeThickness: 4,
    }).setOrigin(0.5);

    this.add.text(width / 2, height * 0.15 + 50, 'AI LEGEND OF MIR', {
      fontSize: '16px',
      color: '#888',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    // Login form area
    const formX = width / 2;
    const formY = height * 0.45;
    const inputWidth = 260;
    const inputHeight = 40;

    // Username input
    this.add.text(formX, formY - 40, '账号', {
      fontSize: '14px', color: '#AAA',
    }).setOrigin(0.5);

    const usernameBg = this.add.rectangle(formX, formY, inputWidth, inputHeight, 0x1a1a2e)
      .setStrokeStyle(1, 0x333355);
    
    this.usernameInput = this.add.text(formX - inputWidth / 2 + 10, formY, '', {
      fontSize: '16px', color: '#FFFFFF', fontFamily: 'monospace',
    }).setOrigin(0, 0.5);

    // Password input
    this.add.text(formX, formY + 40, '密码', {
      fontSize: '14px', color: '#AAA',
    }).setOrigin(0.5);

    const passwordBg = this.add.rectangle(formX, formY + 80, inputWidth, inputHeight, 0x1a1a2e)
      .setStrokeStyle(1, 0x333355);
    
    this.passwordText = '';
    this.passwordDisplay = this.add.text(formX - inputWidth / 2 + 10, formY + 80, '', {
      fontSize: '16px', color: '#FFFFFF', fontFamily: 'monospace',
    }).setOrigin(0, 0.5);

    // Interactive input zones
    this.inputEnabled = 'username';
    usernameBg.setInteractive().on('pointerdown', () => {
      this.inputEnabled = 'username';
      usernameBg.setStrokeStyle(2, 0xFFD700);
      passwordBg.setStrokeStyle(1, 0x333355);
    });
    passwordBg.setInteractive().on('pointerdown', () => {
      this.inputEnabled = 'password';
      passwordBg.setStrokeStyle(2, 0xFFD700);
      usernameBg.setStrokeStyle(1, 0x333355);
    });
    usernameBg.setStrokeStyle(2, 0xFFD700); // Default active

    // Keyboard input
    this.input.keyboard.on('keydown', (event) => {
      if (event.key === 'Tab') {
        this.inputEnabled = this.inputEnabled === 'username' ? 'password' : 'username';
        if (this.inputEnabled === 'username') {
          usernameBg.setStrokeStyle(2, 0xFFD700);
          passwordBg.setStrokeStyle(1, 0x333355);
        } else {
          passwordBg.setStrokeStyle(2, 0xFFD700);
          usernameBg.setStrokeStyle(1, 0x333355);
        }
        return;
      }
      if (event.key === 'Enter') {
        this.handleLogin();
        return;
      }
      if (event.key === 'Backspace') {
        if (this.inputEnabled === 'username') {
          this.usernameInput.text = this.usernameInput.text.slice(0, -1);
        } else {
          this.passwordText = this.passwordText.slice(0, -1);
          this.passwordDisplay.text = '*'.repeat(this.passwordText.length);
        }
        return;
      }
      if (event.key.length === 1) {
        if (this.inputEnabled === 'username') {
          this.usernameInput.text += event.key;
        } else {
          this.passwordText += event.key;
          this.passwordDisplay.text = '*'.repeat(this.passwordText.length);
        }
      }
    });

    // Login button
    const loginBtn = this.createButton(formX, formY + 150, '登 录', 0xFFD700, 0x1a1a00, () => {
      this.handleLogin();
    });

    // Register button
    const registerBtn = this.createButton(formX, formY + 200, '注 册', 0x888888, 0x1a1a1a, () => {
      this.handleRegister();
    });

    // Status text
    this.statusText = this.add.text(formX, formY + 250, '', {
      fontSize: '14px', color: '#FF4444',
    }).setOrigin(0.5);

    // Version info
    this.add.text(width / 2, height - 30, 'v1.0.0 | AI时代的传奇', {
      fontSize: '12px', color: '#444',
    }).setOrigin(0.5);

    // Quick play button (for testing without login)
    const quickPlayBtn = this.createButton(formX, height - 70, '快速体验 (游客)', 0x44AA44, 0x0a1a0a, () => {
      this.registry.set('playerName', '游客' + Phaser.Math.Between(1000, 9999));
      this.registry.set('playerClass', null);
      this.scene.start('CharacterSelectScene');
    });
  }

  createButton(x, y, text, color, bgColor, callback) {
    const bg = this.add.rectangle(x, y, 200, 40, bgColor)
      .setStrokeStyle(2, color)
      .setInteractive({ useHandCursor: true });
    
    const label = this.add.text(x, y, text, {
      fontSize: '16px',
      color: Phaser.Display.Color.IntegerToColor(color).rgba,
      fontFamily: 'Microsoft YaHei, PingFang SC, sans-serif',
    }).setOrigin(0.5);

    bg.on('pointerover', () => {
      bg.setFillStyle(color, 0.2);
    });
    bg.on('pointerout', () => {
      bg.setFillStyle(bgColor, 1);
    });
    bg.on('pointerdown', () => {
      bg.setFillStyle(color, 0.3);
      callback();
    });
    bg.on('pointerup', () => {
      bg.setFillStyle(color, 0.2);
    });

    return bg;
  }

  async handleLogin() {
    const username = this.usernameInput.text.trim();
    const password = this.passwordText;

    if (!username || !password) {
      this.statusText.setColor('#FF4444').setText('请输入账号和密码');
      return;
    }

    this.statusText.setColor('#FFD700').setText('登录中...');

    try {
      const baseUrl = window.location.origin;
      const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (data.success) {
        this.registry.set('playerName', username);
        this.registry.set('token', data.token);
        this.registry.set('playerData', data.player);
        if (data.player && data.player.class) {
          this.registry.set('playerClass', data.player.class);
          this.scene.start('GameScene');
        } else {
          this.scene.start('CharacterSelectScene');
        }
      } else {
        this.statusText.setColor('#FF4444').setText(data.message || '登录失败');
      }
    } catch (e) {
      this.statusText.setColor('#FF4444').setText('网络错误，请重试');
    }
  }

  async handleRegister() {
    const username = this.usernameInput.text.trim();
    const password = this.passwordText;

    if (!username || !password) {
      this.statusText.setColor('#FF4444').setText('请输入账号和密码');
      return;
    }
    if (password.length < 4) {
      this.statusText.setColor('#FF4444').setText('密码至少4位');
      return;
    }

    this.statusText.setColor('#FFD700').setText('注册中...');

    try {
      const baseUrl = window.location.origin;
      const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (data.success) {
        this.statusText.setColor('#00FF00').setText('注册成功! 请登录');
        this.registry.set('playerName', username);
        this.registry.set('token', data.token);
      } else {
        this.statusText.setColor('#FF4444').setText(data.message || '注册失败');
      }
    } catch (e) {
      this.statusText.setColor('#FF4444').setText('网络错误，请重试');
    }
  }
}
