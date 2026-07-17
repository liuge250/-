// ============================================================
// MenuScene - 登录/注册场景 (使用HTML输入框，支持手机键盘)
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
    this.add.text(centerX, centerY - 200, 'AI传奇', {
      fontSize: '56px', fill: '#FFD700', fontFamily: 'serif',
      stroke: '#8B4513', strokeThickness: 4,
    }).setOrigin(0.5);

    this.add.text(centerX, centerY - 140, '玛法大陆', {
      fontSize: '28px', fill: '#C0A060', fontFamily: 'serif',
    }).setOrigin(0.5);

    // 创建HTML输入表单
    this.createHTMLForm(centerX, centerY);
  }

  createHTMLForm(centerX, centerY) {
    const gameCanvas = this.game.canvas;
    const canvasRect = gameCanvas.getBoundingClientRect();
    
    // 计算缩放比例
    const scaleX = canvasRect.width / this.game.config.width;
    const scaleY = canvasRect.height / this.game.config.height;

    // 创建表单容器
    const formContainer = document.createElement('div');
    formContainer.id = 'login-form-container';
    formContainer.style.cssText = `
      position: absolute;
      left: ${canvasRect.left + centerX * scaleX - 160 * scaleX}px;
      top: ${canvasRect.top + (centerY - 60) * scaleY}px;
      width: ${320 * scaleX}px;
      z-index: 1000;
      font-family: serif;
    `;

    // Tab 切换
    const tabContainer = document.createElement('div');
    tabContainer.style.cssText = `
      display: flex;
      justify-content: center;
      gap: ${20 * scaleX}px;
      margin-bottom: ${15 * scaleY}px;
    `;

    const tabLogin = document.createElement('span');
    tabLogin.id = 'tab-login';
    tabLogin.textContent = '登录';
    tabLogin.style.cssText = `
      font-size: ${18 * scaleX}px;
      color: #FFD700;
      cursor: pointer;
      padding: ${5 * scaleY}px ${15 * scaleX}px;
    `;

    const tabRegister = document.createElement('span');
    tabRegister.id = 'tab-register';
    tabRegister.textContent = '注册';
    tabRegister.style.cssText = `
      font-size: ${18 * scaleX}px;
      color: #888888;
      cursor: pointer;
      padding: ${5 * scaleY}px ${15 * scaleX}px;
    `;

    tabContainer.appendChild(tabLogin);
    tabContainer.appendChild(tabRegister);

    // 输入面板
    const panel = document.createElement('div');
    panel.style.cssText = `
      background: rgba(26, 26, 46, 0.95);
      border: 2px solid #FFD700;
      border-radius: ${8 * scaleX}px;
      padding: ${20 * scaleX}px;
    `;

    // 用户名输入
    const usernameLabel = document.createElement('div');
    usernameLabel.textContent = '用户名';
    usernameLabel.style.cssText = `
      font-size: ${13 * scaleX}px;
      color: #aaaaaa;
      margin-bottom: ${5 * scaleY}px;
    `;

    const usernameInput = document.createElement('input');
    usernameInput.type = 'text';
    usernameInput.id = 'username-input';
    usernameInput.placeholder = '请输入用户名';
    usernameInput.style.cssText = `
      width: 100%;
      box-sizing: border-box;
      padding: ${10 * scaleX}px;
      font-size: ${15 * scaleX}px;
      background: #2a2a3e;
      border: 1px solid #444466;
      border-radius: ${4 * scaleX}px;
      color: #ffffff;
      outline: none;
      margin-bottom: ${15 * scaleY}px;
    `;

    // 密码输入
    const passwordLabel = document.createElement('div');
    passwordLabel.textContent = '密码';
    passwordLabel.style.cssText = `
      font-size: ${13 * scaleX}px;
      color: #aaaaaa;
      margin-bottom: ${5 * scaleY}px;
    `;

    const passwordInput = document.createElement('input');
    passwordInput.type = 'password';
    passwordInput.id = 'password-input';
    passwordInput.placeholder = '请输入密码';
    passwordInput.style.cssText = `
      width: 100%;
      box-sizing: border-box;
      padding: ${10 * scaleX}px;
      font-size: ${15 * scaleX}px;
      background: #2a2a3e;
      border: 1px solid #444466;
      border-radius: ${4 * scaleX}px;
      color: #ffffff;
      outline: none;
      margin-bottom: ${15 * scaleY}px;
    `;

    // 状态消息
    const statusText = document.createElement('div');
    statusText.id = 'status-text';
    statusText.style.cssText = `
      font-size: ${13 * scaleX}px;
      color: #ff4444;
      text-align: center;
      min-height: ${20 * scaleY}px;
      margin-bottom: ${10 * scaleY}px;
    `;

    // 提交按钮
    const submitBtn = document.createElement('button');
    submitBtn.id = 'submit-btn';
    submitBtn.textContent = '登录';
    submitBtn.style.cssText = `
      width: 100%;
      padding: ${12 * scaleX}px;
      font-size: ${16 * scaleX}px;
      font-family: serif;
      background: #8B4513;
      border: 2px solid #FFD700;
      border-radius: ${4 * scaleX}px;
      color: #FFD700;
      cursor: pointer;
    `;

    panel.appendChild(usernameLabel);
    panel.appendChild(usernameInput);
    panel.appendChild(passwordLabel);
    panel.appendChild(passwordInput);
    panel.appendChild(statusText);
    panel.appendChild(submitBtn);

    formContainer.appendChild(tabContainer);
    formContainer.appendChild(panel);

    // 添加到页面
    document.body.appendChild(formContainer);

    // 事件处理
    let isLogin = true;

    tabLogin.onclick = () => {
      isLogin = true;
      tabLogin.style.color = '#FFD700';
      tabRegister.style.color = '#888888';
      submitBtn.textContent = '登录';
      statusText.textContent = '';
    };

    tabRegister.onclick = () => {
      isLogin = false;
      tabRegister.style.color = '#FFD700';
      tabLogin.style.color = '#888888';
      submitBtn.textContent = '注册';
      statusText.textContent = '';
    };

    submitBtn.onclick = async () => {
      const username = usernameInput.value.trim();
      const password = passwordInput.value.trim();

      if (!username || !password) {
        statusText.textContent = '请输入用户名和密码';
        statusText.style.color = '#ff4444';
        return;
      }

      statusText.textContent = '处理中...';
      statusText.style.color = '#aaaaaa';

      try {
        const endpoint = isLogin ? '/api/v1/auth/login' : '/api/v1/auth/register';
        const resp = await fetch(API_BASE + endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });
        const data = await resp.json();
        if (!resp.ok) {
          statusText.textContent = data.error || '操作失败';
          statusText.style.color = '#ff4444';
          return;
        }
        window.gameData.token = data.token;
        window.gameData.username = data.username;
        window.gameData.playerId = data.username;
        statusText.textContent = '登录成功!';
        statusText.style.color = '#00ff00';
        
        // 延迟跳转
        setTimeout(() => {
          this.scene.start('CharacterSelectScene');
        }, 500);
      } catch (e) {
        statusText.textContent = '网络错误: ' + e.message;
        statusText.style.color = '#ff4444';
      }
    };

    // 保存引用以便清理
    this.formContainer = formContainer;
  }

  shutdown() {
    // 清理HTML表单
    if (this.formContainer && this.formContainer.parentNode) {
      this.formContainer.parentNode.removeChild(this.formContainer);
    }
  }
}
