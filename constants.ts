
export const GRAVITY = 0.6;
export const FRICTION = 0.8;
export const ACCELERATION = 1.5;
export const MOVE_SPEED = 10;
export const JUMP_FORCE = -16;
export const SCREEN_SHAKE_DECAY = 0.9;

export const CANVAS_WIDTH = 3000;
export const CANVAS_HEIGHT = 1500;

export const PARRY_DURATION = 30; // Frames (approx 0.5s at 60fps)
export const ATTACK_DURATION = 20; // Frames - slightly longer for animation
export const ATTACK_COOLDOWN = 40; // Frames

export const PLAYER_SIZE = 40;
export const SWORD_RANGE = 80; // Increased range
export const SWORD_DAMAGE = 40; // Increased from 20
export const SHIELD_DAMAGE = 10; // New constant for shield reflect damage

export const COOP_LINK_DISTANCE = 300; // Pixel distance for double damage synergy

export const ENEMY_SPAWN_RATE = 120; // 2 seconds (60fps * 2) - Much faster spawn
export const BOSS_TRIGGER_SCORE = 100;

export const DMG_NORMAL = 15;
export const DMG_BOMB = 30;
export const DMG_SPIKE = 10;
export const DMG_FLYER = 10;
export const DMG_BOSS_SMASH = 40;
export const DMG_BOSS_TOUCH = 20;

// Colors
export const COLORS = {
  P1_DEFAULT: '#3b82f6', // Blue
  P1_SHIELD: '#60a5fa', // Lighter Blue
  P2_DEFAULT: '#ef4444', // Red
  P2_SWORD: '#f87171', // Light Red
  ENEMY_NORMAL: '#64748b', // Slate-500 (Mummy Base)
  ENEMY_BOMB: '#a855f7', // Purple
  ENEMY_FLYER: '#f59e0b', // Amber
  BOSS: '#7f1d1d', // Deep Red
  PLATFORM: '#1e293b', // Slate-800
  SPIKE: '#dc2626', // Red-600
  BACKGROUND: '#020617' // Slate-950 (Darker)
};

export const PLAYER_COLOR_OPTIONS = [
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#22c55e', // Green
  '#a855f7', // Purple
  '#f59e0b', // Amber
  '#06b6d4', // Cyan
  '#ec4899', // Pink
  '#eab308', // Yellow
];