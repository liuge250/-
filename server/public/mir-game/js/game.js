/**
 * AI Legend of MIR - Game Entry Point
 * Phaser.js initialization
 */
import { BootScene } from './scenes/BootScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { CharacterSelectScene } from './scenes/CharacterSelectScene.js';
import { GameScene } from './scenes/GameScene.js';
import { ShopScene } from './scenes/ShopScene.js';

// Responsive game config
const gameWidth = Math.min(window.innerWidth, 1280);
const gameHeight = Math.min(window.innerHeight, 720);

const config = {
  type: Phaser.AUTO,
  width: gameWidth,
  height: gameHeight,
  parent: 'game-container',
  backgroundColor: '#0a0a1a',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, MenuScene, CharacterSelectScene, GameScene, ShopScene],
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false,
    },
  },
  input: {
    activePointers: 3, // Support multi-touch
  },
  render: {
    pixelArt: true,
    antialias: false,
  },
};

// Create game instance
const game = new Phaser.Game(config);

// Handle window resize
window.addEventListener('resize', () => {
  const newWidth = Math.min(window.innerWidth, 1280);
  const newHeight = Math.min(window.innerHeight, 720);
  game.scale.resize(newWidth, newHeight);
});

// Prevent default touch behaviors
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());

// Global game reference
window.mirGame = game;

console.log('🎮 AI Legend of MIR - Game Engine Initialized');
console.log(`📐 Resolution: ${gameWidth}x${gameHeight}`);
