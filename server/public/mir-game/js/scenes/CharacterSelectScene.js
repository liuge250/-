// ============================================================
// CharacterSelectScene - 角色选择/创建场景
// ============================================================
class CharacterSelectScene extends Phaser.Scene {
  constructor() { super('CharacterSelectScene'); }

  async create() {
    const { width, height } = this.scale;
    const centerX = width / 2;

    // 背景
    this.add.rectangle(0, 0, width, height, 0x0a0a1a).setOrigin(0);

    // 标题
    this.add.text(centerX, 40, '选择职业', {
      fontSize: '32px', fill: '#FFD700', fontFamily: 'serif',
      stroke: '#8B4513', strokeThickness: 2,
    }).setOrigin(0.5);

    // 获取已有角色
    let characters = [];
    try {
      const resp = await fetch(API_BASE + '/api/v1/characters?playerId=' + window.gameData.playerId);
      if (resp.ok) {
        const data = await resp.json();
        characters = data.characters || [];
      }
    } catch (e) {
      console.error('获取角色失败:', e);
    }

    // 如果有角色，显示角色列表
    if (characters.length > 0) {
      this.showCharacterList(characters);
      return;
    }

    // 否则显示职业选择
    this.showClassSelection();
  }

  showCharacterList(characters) {
    const { width, height } = this.scale;
    const centerX = width / 2;

    // 角色卡片
    characters.forEach((char, i) => {
      const cardY = 120 + i * 100;
      const card = this.add.rectangle(centerX, cardY, 300, 80, 0x1a1a2e, 0.9)
        .setStrokeStyle(2, 0xFFD700).setInteractive({ useHandCursor: true });

      const classNames = { warrior: '战士', wizard: '法师', taoist: '道士' };
      this.add.text(centerX - 130, cardY - 20, char.name, {
        fontSize: '20px', fill: '#FFD700', fontFamily: 'serif',
      });
      this.add.text(centerX - 130, cardY + 5, `${classNames[char.class]} Lv.${char.level}`, {
        fontSize: '14px', fill: '#aaaaaa',
      });
      this.add.text(centerX - 130, cardY + 25, `HP:${char.hp}/${char.maxHp} ATK:${char.stats.atk}`, {
        fontSize: '12px', fill: '#888888',
      });

      card.on('pointerdown', () => {
        window.gameData.character = char;
        this.scene.start('GameScene');
      });
      card.on('pointerover', () => card.setFillStyle(0x2a2a4e));
      card.on('pointerout', () => card.setFillStyle(0x1a1a2e));
    });

    // 创建新角色按钮
    const newBtn = this.add.rectangle(centerX, 120 + characters.length * 100 + 40, 200, 45, 0x8B4513, 1)
      .setStrokeStyle(2, 0xFFD700).setInteractive({ useHandCursor: true });
    this.add.text(centerX, 120 + characters.length * 100 + 40, '+ 创建新角色', {
      fontSize: '16px', fill: '#FFD700', fontFamily: 'serif',
    }).setOrigin(0.5);

    newBtn.on('pointerdown', () => this.showClassSelection());
  }

  showClassSelection() {
    const { width, height } = this.scale;
    const centerX = width / 2;

    const classes = [
      { id: 'warrior', name: '战士', desc: '近战物理攻击\n高生命高防御\n武器：刀剑', color: 0xCC3333, sprite: 'warrior' },
      { id: 'wizard', name: '法师', desc: '远程魔法攻击\n高伤害低防御\n武器：法杖', color: 0x3333CC, sprite: 'wizard' },
      { id: 'taoist', name: '道士', desc: '辅助治疗攻击\n均衡型职业\n武器：扇子', color: 0x33CC33, sprite: 'taoist' },
    ];

    const cardW = Math.min(160, (width - 60) / 3);
    const startX = centerX - (cardW * 3 + 20) / 2;

    classes.forEach((cls, i) => {
      const x = startX + i * (cardW + 10) + cardW / 2;
      const y = 200;

      // 卡片背景
      const card = this.add.rectangle(x, y, cardW, 280, 0x1a1a2e, 0.9)
        .setStrokeStyle(2, cls.color).setInteractive({ useHandCursor: true });

      // 职业图标区域
      this.add.rectangle(x, y - 80, cardW - 20, 80, cls.color, 0.3)
        .setStrokeStyle(1, cls.color);

      // 职业名
      this.add.text(x, y - 20, cls.name, {
        fontSize: '24px', fill: '#FFD700', fontFamily: 'serif',
      }).setOrigin(0.5);

      // 描述
      this.add.text(x, y + 30, cls.desc, {
        fontSize: '12px', fill: '#aaaaaa', align: 'center',
      }).setOrigin(0.5);

      // 选择按钮
      const btn = this.add.rectangle(x, y + 100, cardW - 20, 36, cls.color, 0.8)
        .setStrokeStyle(1, 0xFFD700).setInteractive({ useHandCursor: true });
      this.add.text(x, y + 100, '创建', {
        fontSize: '14px', fill: '#ffffff',
      }).setOrigin(0.5);

      // 点击创建
      const doCreate = async () => {
        const name = cls.name + '勇士';
        try {
          const resp = await fetch(API_BASE + '/api/v1/character/create', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + window.gameData.token,
            },
            body: JSON.stringify({
              playerId: window.gameData.playerId,
              name: name,
              class: cls.id,
            }),
          });
          const data = await resp.json();
          if (resp.ok) {
            window.gameData.character = data.character;
            this.scene.start('GameScene');
          } else {
            alert(data.error || '创建失败');
          }
        } catch (e) {
          alert('网络错误: ' + e.message);
        }
      };

      btn.on('pointerdown', doCreate);
      card.on('pointerdown', doCreate);
      btn.on('pointerover', () => btn.setFillStyle(Phaser.Display.Color.GetColor(
        Math.min(255, ((cls.color >> 16) & 0xFF) + 40),
        Math.min(255, ((cls.color >> 8) & 0xFF) + 40),
        Math.min(255, (cls.color & 0xFF) + 40)
      )));
      btn.on('pointerout', () => btn.setFillStyle(cls.color));
    });

    // 返回按钮
    const backBtn = this.add.text(20, 20, '< 返回', {
      fontSize: '16px', fill: '#aaaaaa',
    }).setInteractive({ useHandCursor: true });
    backBtn.on('pointerdown', () => this.scene.start('MenuScene'));
  }
}
