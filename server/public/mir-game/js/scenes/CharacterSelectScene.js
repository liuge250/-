// 传奇先锋 - 角色选择/创建场景
class CharacterSelectScene extends Phaser.Scene {
  constructor() {
    super({ key: 'CharacterSelectScene' });
    this.selectedClass = null;
  }

  create() {
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const C = GAME_CONFIG.COLORS;

    // 背景
    this.add.rectangle(w / 2, h / 2, w, h, 0x0A0A0F);

    // 标题
    this.add.text(w / 2, 40, '创建角色', {
      fontFamily: 'serif',
      fontSize: '32px',
      color: '#C9A96E',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // 职业卡片
    const classes = [
      { id: 'warrior', name: '战士', color: 0xE53935, desc: '近战物理·高生命高防御', stats: 'HP:200 | 攻击:5-8 | 防御:3-5' },
      { id: 'mage', name: '法师', color: 0x7B1FA2, desc: '远程魔法·群体伤害极高', stats: 'HP:100 | 魔法:5-8 | 防御:1-3' },
      { id: 'taoist', name: '道士', color: 0x2E7D32, desc: '辅助召唤·施毒治疗全能', stats: 'HP:150 | 道术:5-8 | 防御:2-4' },
    ];

    this.classCards = [];
    const cardW = 200;
    const cardH = 280;
    const startX = w / 2 - (classes.length * cardW + (classes.length - 1) * 20) / 2;

    classes.forEach((cls, i) => {
      const x = startX + i * (cardW + 20) + cardW / 2;
      const y = h * 0.35;

      // 卡片背景
      const card = this.add.rectangle(x, y, cardW, cardH, 0x1A1A2E, 0.9);
      card.setStrokeStyle(2, 0x444444);
      card.setOrigin(0.5);

      // 职业图标（用圆形+文字代替）
      const iconBg = this.add.circle(x, y - 80, 40, cls.color, 0.3);
      iconBg.setStrokeStyle(3, cls.color);

      const iconText = this.add.text(x, y - 80, cls.name[0], {
        fontFamily: 'serif',
        fontSize: '36px',
        color: Phaser.Display.Color.IntegerToColor(cls.color).rgba,
        fontStyle: 'bold',
      }).setOrigin(0.5);

      // 职业名
      this.add.text(x, y - 20, cls.name, {
        fontFamily: 'serif',
        fontSize: '24px',
        color: Phaser.Display.Color.IntegerToColor(cls.color).rgba,
        fontStyle: 'bold',
      }).setOrigin(0.5);

      // 描述
      this.add.text(x, y + 20, cls.desc, {
        fontFamily: 'sans-serif',
        fontSize: '12px',
        color: '#AAAAAA',
        wordWrap: { width: cardW - 20 },
        align: 'center',
      }).setOrigin(0.5);

      // 基础属性
      this.add.text(x, y + 60, cls.stats, {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#888888',
      }).setOrigin(0.5);

      // 交互区域
      const hitArea = this.add.rectangle(x, y, cardW, cardH, 0x000000, 0.001);
      hitArea.setInteractive({ useHandCursor: true });
      hitArea.on('pointerdown', () => this.selectClass(cls.id));
      hitArea.on('pointerover', () => card.setStrokeStyle(2, cls.color));
      hitArea.on('pointerout', () => {
        if (this.selectedClass !== cls.id) {
          card.setStrokeStyle(2, 0x444444);
        }
      });

      this.classCards.push({ id: cls.id, card, hitArea, color: cls.color });
    });

    // 角色名输入
    const inputY = h * 0.7;
    this.add.text(w / 2, inputY - 30, '角色名称', {
      fontFamily: 'sans-serif',
      fontSize: '16px',
      color: '#C9A96E',
    }).setOrigin(0.5);

    const nameInputBg = this.add.rectangle(w / 2, inputY + 10, 280, 44, 0x1A1A2E, 0.8);
    nameInputBg.setStrokeStyle(1, 0xC9A96E, 0.5);

    this.nameInput = this.add.dom(w / 2, inputY + 10).createFromHTML(`
      <input type="text" id="char-name-input" placeholder="请输入角色名"
        style="width:260px;height:36px;background:transparent;border:none;color:#E8E8E8;font-size:16px;outline:none;text-align:center;"
        maxlength="12">
    `);

    // 创建按钮
    this.createBtn = this.add.text(w / 2, inputY + 80, '进入玛法大陆', {
      fontFamily: 'sans-serif',
      fontSize: '18px',
      color: '#0A0A0F',
      fontStyle: 'bold',
      backgroundColor: '#C9A96E',
      padding: { x: 40, y: 12 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    this.createBtn.on('pointerdown', () => this.handleCreate());

    // 提示
    this.hintText = this.add.text(w / 2, inputY + 130, '', {
      fontFamily: 'sans-serif',
      fontSize: '13px',
      color: '#FF5252',
    }).setOrigin(0.5);

    // 返回按钮
    const backBtn = this.add.text(20, 20, '← 返回', {
      fontFamily: 'sans-serif',
      fontSize: '16px',
      color: '#888888',
    }).setInteractive({ useHandCursor: true });
    backBtn.on('pointerdown', () => this.scene.start('MenuScene'));
  }

  selectClass(classId) {
    this.selectedClass = classId;
    this.classCards.forEach(({ card, id, color }) => {
      card.setStrokeStyle(2, id === classId ? color : 0x444444);
    });
  }

  async handleCreate() {
    if (!this.selectedClass) {
      this.hintText.setText('请选择一个职业');
      return;
    }

    const nameEl = document.getElementById('char-name-input');
    const name = nameEl?.value?.trim();

    if (!name || name.length < 2) {
      this.hintText.setText('角色名至少2个字符');
      return;
    }

    this.hintText.setText('创建中...');
    this.createBtn.disableInteractive();

    try {
      const response = await fetch(`${GAME_CONFIG.API_BASE}/api/v1/character/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${window.MIR.token}`,
        },
        body: JSON.stringify({
          playerId: window.MIR.username,
          name: name,
          class: this.selectedClass,
        }),
      });

      const data = await response.json();

      if (data.success && data.character) {
        window.MIR.character = data.character;
        this.scene.start('GameScene');
      } else {
        this.hintText.setText(data.error || '创建失败');
        this.createBtn.setInteractive();
      }
    } catch (err) {
      this.hintText.setText('网络错误');
      this.createBtn.setInteractive();
    }
  }
}
