// 传奇先锋 - 启动场景
class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // 显示加载进度
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;

    const progressBg = this.add.rectangle(w / 2, h / 2, 400, 30, 0x1A1A2E, 0.8);
    progressBg.setStrokeStyle(2, 0xC9A96E);

    const progressBar = this.add.rectangle(w / 2 - 195, h / 2, 0, 24, 0xC9A96E);
    progressBar.setOrigin(0, 0.5);

    const loadText = this.add.text(w / 2, h / 2 - 40, '传奇先锋', {
      fontFamily: 'serif',
      fontSize: '36px',
      color: '#C9A96E',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const subText = this.add.text(w / 2, h / 2 + 40, 'AI时代的致敬版传奇', {
      fontFamily: 'sans-serif',
      fontSize: '14px',
      color: '#888888',
    }).setOrigin(0.5);

    this.load.on('progress', (value) => {
      progressBar.width = 390 * value;
    });

    this.load.on('complete', () => {
      progressBg.destroy();
      progressBar.destroy();
      loadText.destroy();
      subText.destroy();
    });
  }

  create() {
    this.scene.start('MenuScene');
  }
}
