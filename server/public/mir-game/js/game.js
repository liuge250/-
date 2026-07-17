// ============================================================
// AI传奇 - 玛法大陆 | 游戏入口
// ============================================================
const GAME_VERSION = '2.0.0';
// 自动检测API地址：使用当前页面的origin，确保API和页面在同一域名
const API_BASE = window.location.origin;

const config = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  parent: 'game-container',
  backgroundColor: '#000000',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, MenuScene, CharacterSelectScene, GameScene],
  input: {
    activePointers: 3,
  },
  render: {
    pixelArt: true,
    antialias: false,
  },
};

const game = new Phaser.Game(config);

// Global game data
window.gameData = {
  token: null,
  username: null,
  playerId: null,
  character: null,
};
