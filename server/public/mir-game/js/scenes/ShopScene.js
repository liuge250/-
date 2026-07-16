/**
 * Shop Scene - Premium items shop
 */
import { CONFIG } from '../config.js';

export class ShopScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ShopScene' });
  }

  create() {
    const { width, height } = this.scale;
    
    // Semi-transparent overlay
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.85);

    // Shop title
    this.add.text(width / 2, 40, '玛法商城', {
      fontSize: '28px',
      color: '#FFD700',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(width / 2, 70, 'VIP专属 · 快速变强', {
      fontSize: '12px',
      color: '#888',
    }).setOrigin(0.5);

    // Player currency display
    const playerData = this.registry.get('playerData') || {};
    this.add.text(width / 2, 100, 
      `💰 ${playerData.gold || 0} 金币  |  💎 ${playerData.diamonds || 0} 钻石`, {
      fontSize: '14px', color: '#FFD700',
    }).setOrigin(0.5);

    // Shop items
    const items = CONFIG.SHOP.PREMIUM_ITEMS;
    const startY = 130;
    const itemHeight = 55;
    const maxVisible = Math.floor((height - 200) / itemHeight);

    items.forEach((item, i) => {
      if (i >= maxVisible) return;
      
      const y = startY + i * itemHeight;
      
      // Item row
      const row = this.add.rectangle(width / 2, y + itemHeight / 2, width - 40, itemHeight - 4, 0x111122, 0.8)
        .setStrokeStyle(1, 0x333355)
        .setInteractive({ useHandCursor: true });

      // Item name
      this.add.text(30, y + 8, item.name, {
        fontSize: '14px',
        color: item.currency === 'diamond' ? '#00BFFF' : '#FFFFFF',
        fontStyle: 'bold',
      });

      // Item description
      this.add.text(30, y + 28, item.desc, {
        fontSize: '10px',
        color: '#888',
      });

      // Price
      const priceIcon = item.currency === 'diamond' ? '💎' : '💰';
      const priceColor = item.currency === 'diamond' ? '#00BFFF' : '#FFD700';
      this.add.text(width - 100, y + 18, `${priceIcon} ${item.price}`, {
        fontSize: '14px',
        color: priceColor,
        fontStyle: 'bold',
      }).setOrigin(0.5);

      // Buy button
      const buyBtn = this.add.rectangle(width - 40, y + 18, 50, 28, 0x224400)
        .setStrokeStyle(1, 0x44AA00)
        .setInteractive({ useHandCursor: true });
      
      this.add.text(width - 40, y + 18, '购买', {
        fontSize: '11px', color: '#44FF44',
      }).setOrigin(0.5);

      buyBtn.on('pointerover', () => buyBtn.setFillStyle(0x44AA00, 0.3));
      buyBtn.on('pointerout', () => buyBtn.setFillStyle(0x224400, 1));
      buyBtn.on('pointerdown', () => this.buyItem(item));
    });

    // Close button
    const closeBtn = this.add.rectangle(width / 2, height - 40, 150, 36, 0x330000)
      .setStrokeStyle(1, 0xFF4444)
      .setInteractive({ useHandCursor: true });
    
    this.add.text(width / 2, height - 40, '关闭商城', {
      fontSize: '14px', color: '#FF4444',
    }).setOrigin(0.5);

    closeBtn.on('pointerdown', () => this.scene.stop());

    // Daily reward notice
    this.add.text(width / 2, height - 75, '每日登录赠送 50 钻石 | 首充双倍', {
      fontSize: '11px', color: '#FFD700',
    }).setOrigin(0.5);
  }

  buyItem(item) {
    // This would connect to backend in production
    this.showBuyResult(`购买 ${item.name} 成功！`);
  }

  showBuyResult(msg) {
    const { width, height } = this.scale;
    const text = this.add.text(width / 2, height / 2, msg, {
      fontSize: '18px', color: '#00FF00', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(2000);

    this.time.delayedCall(2000, () => {
      this.tweens.add({ targets: text, alpha: 0, duration: 500, onComplete: () => text.destroy() });
    });
  }
}
