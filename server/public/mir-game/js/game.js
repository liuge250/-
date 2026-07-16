// 传奇先锋 - 游戏主入口
(function () {
  'use strict';

  const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    parent: 'game-container',
    backgroundColor: GAME_CONFIG.COLORS.BACKGROUND,
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [BootScene, MenuScene, CharacterSelectScene, GameScene],
    physics: {
      default: 'arcade',
      arcade: { debug: false },
    },
    input: {
      activePointers: 3, // 支持多点触控
    },
  };

  const game = new Phaser.Game(config);

  // 全局状态
  window.MIR = {
    game: game,
    token: null,
    username: null,
    character: null,
    ws: null,
  };

  // 窗口大小变化
  window.addEventListener('resize', () => {
    game.scale.resize(window.innerWidth, window.innerHeight);
  });
})();
