/**
 * Character Select Scene - Choose class (Warrior/Wizard/Taoist)
 */
export class CharacterSelectScene extends Phaser.Scene {
  constructor() {
    super({ key: 'CharacterSelectScene' });
  }

  create() {
    const { width, height } = this.scale;
    
    // Background
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0a0a1a, 0x0a0a1a, 0x1a0a2e, 0x1a0a2e, 1);
    bg.fillRect(0, 0, width, height);

    // Title
    this.add.text(width / 2, 60, '选择你的职业', {
      fontSize: '32px',
      color: '#FFD700',
      fontFamily: 'Microsoft YaHei, PingFang SC, sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(width / 2, 95, '每个职业都有独特的AI进化路线', {
      fontSize: '14px',
      color: '#888',
    }).setOrigin(0.5);

    // Class cards
    const classes = [
      {
        key: 'warrior',
        name: '战 士',
        color: 0xFF4444,
        desc: '近战之王，高血量高防御',
        stats: { hp: '★★★★★', atk: '★★★★☆', def: '★★★★★', speed: '★★★☆☆' },
        skills: ['烈火剑法', '野蛮冲撞', '逐日剑法'],
        aiFeature: '战意共鸣：AI分析敌人模式，提示闪避时机',
      },
      {
        key: 'wizard',
        name: '法 师',
        color: 0x4444FF,
        desc: '远程魔法，毁天灭地',
        stats: { hp: '★★☆☆☆', atk: '★★★★★', def: '★★☆☆☆', speed: '★★★★☆' },
        skills: ['雷电术', '冰咆哮', '火墙'],
        aiFeature: '元素洞察：AI识别弱点，推荐最优法术',
      },
      {
        key: 'taoist',
        name: '道 士',
        color: 0x44FF44,
        desc: '辅助治疗，召唤神兽',
        stats: { hp: '★★★☆☆', atk: '★★★☆☆', def: '★★★★☆', speed: '★★★☆☆' },
        skills: ['治愈术', '召唤神兽', '施毒术'],
        aiFeature: '灵契进化：神兽AI自主进化形态',
      },
    ];

    const cardWidth = Math.min(200, (width - 80) / 3);
    const cardHeight = 380;
    const startX = width / 2 - (cardWidth * 3 + 40) / 2;
    const cardY = 130;

    classes.forEach((cls, i) => {
      const x = startX + i * (cardWidth + 20) + cardWidth / 2;
      const y = cardY + cardHeight / 2;

      // Card background
      const card = this.add.rectangle(x, y, cardWidth, cardHeight, 0x111122)
        .setStrokeStyle(2, cls.color)
        .setInteractive({ useHandCursor: true });

      // Class icon (generated texture)
      this.add.image(x, cardY + 50, `player_${cls.key}`).setScale(2);

      // Class name
      this.add.text(x, cardY + 100, cls.name, {
        fontSize: '24px',
        color: Phaser.Display.Color.IntegerToColor(cls.color).rgba,
        fontFamily: 'Microsoft YaHei, PingFang SC, sans-serif',
        fontStyle: 'bold',
      }).setOrigin(0.5);

      // Description
      this.add.text(x, cardY + 130, cls.desc, {
        fontSize: '12px',
        color: '#AAA',
      }).setOrigin(0.5);

      // Stats
      let statY = cardY + 160;
      for (const [stat, value] of Object.entries(cls.stats)) {
        const labels = { hp: '生命', atk: '攻击', def: '防御', speed: '速度' };
        this.add.text(x - cardWidth / 2 + 15, statY, labels[stat], {
          fontSize: '11px', color: '#888',
        });
        this.add.text(x + cardWidth / 2 - 15, statY, value, {
          fontSize: '11px', color: '#FFD700',
        }).setOrigin(1, 0);
        statY += 20;
      }

      // Skills
      this.add.text(x, statY + 10, '初始技能', {
        fontSize: '11px', color: '#666',
      }).setOrigin(0.5);
      cls.skills.forEach((skill, si) => {
        this.add.text(x, statY + 28 + si * 18, `· ${skill}`, {
          fontSize: '11px', color: '#CCC',
        }).setOrigin(0.5);
      });

      // AI Feature
      const aiY = cardY + cardHeight - 60;
      this.add.text(x, aiY, 'AI 觉醒', {
        fontSize: '10px', color: '#FFD700',
      }).setOrigin(0.5);
      this.add.text(x, aiY + 16, cls.aiFeature, {
        fontSize: '9px', color: '#888',
        wordWrap: { width: cardWidth - 20 },
        align: 'center',
      }).setOrigin(0.5);

      // Click handler
      card.on('pointerover', () => {
        card.setStrokeStyle(3, 0xFFD700);
        card.setFillStyle(cls.color, 0.1);
      });
      card.on('pointerout', () => {
        card.setStrokeStyle(2, cls.color);
        card.setFillStyle(0x111122, 1);
      });
      card.on('pointerdown', () => {
        this.selectedClass = cls.key;
        this.selectedClassName = cls.name.replace(/\s/g, '');
        this.selectText.setColor('#00FF00').setText(`已选择: ${this.selectedClassName}`);
        this.selectText.setAlpha(1);
        this.confirmBtn.setVisible(true);
      });
    });

    // Selection status
    this.selectText = this.add.text(width / 2, cardY + cardHeight + 20, '请点击选择职业', {
      fontSize: '16px', color: '#888',
    }).setOrigin(0.5);

    // Confirm button (hidden initially)
    this.confirmBtn = this.add.rectangle(width / 2, cardY + cardHeight + 70, 180, 44, 0x1a1a00)
      .setStrokeStyle(2, 0xFFD700)
      .setInteractive({ useHandCursor: true })
      .setVisible(false);

    this.add.text(width / 2, cardY + cardHeight + 70, '进入玛法大陆', {
      fontSize: '18px', color: '#FFD700',
      fontFamily: 'Microsoft YaHei, PingFang SC, sans-serif',
    }).setOrigin(0.5).setVisible(false).setName('confirmLabel');

    this.confirmBtn.on('pointerover', () => this.confirmBtn.setFillStyle(0xFFD700, 0.2));
    this.confirmBtn.on('pointerout', () => this.confirmBtn.setFillStyle(0x1a1a00, 1));
    this.confirmBtn.on('pointerdown', () => {
      if (this.selectedClass) {
        this.registry.set('playerClass', this.selectedClass);
        this.registry.set('playerClassName', this.selectedClassName);
        this.scene.start('GameScene');
      }
    });
  }
}
