export enum GameState {
  MENU = 'MENU',
  INTRO_CUTSCENE = 'INTRO_CUTSCENE',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
  VICTORY = 'VICTORY'
}

export enum EntityType {
  PLAYER_1 = 'PLAYER_1', // Shield
  PLAYER_2 = 'PLAYER_2', // Sword
  ENEMY_NORMAL = 'ENEMY_NORMAL',
  ENEMY_BOMB = 'ENEMY_BOMB',
  ENEMY_FLYER = 'ENEMY_FLYER',
  BOSS = 'BOSS',
  PLATFORM = 'PLATFORM',
  SPIKE = 'SPIKE'
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Vector {
  x: number;
  y: number;
  vx: number;
}

export interface Entity extends Rect {
  id: string;
  type: EntityType;
  vx: number;
  vy: number;
  isGrounded: boolean;
  color: string;
  hp: number;
  maxHp: number;
  facing: 1 | -1; // 1 right, -1 left
  
  // Physics stats
  jumpCount?: number; // Track air jumps
  hurtTimer?: number; // Track knockback stun

  // Combat stats
  attackCooldown: number;
  isAttacking: boolean; // For sword
  isParrying: boolean; // For shield
  parryTimer: number; // How long parry stays active
  
  // Enemy specific
  state?: 'PATROL' | 'CHASE' | 'ATTACK' | 'EXPLODING' | 'DYING' | 'BOSS_IDLE' | 'BOSS_SMASH' | 'BOSS_LASER' | 'BOSS_CHARGE';
  stateTimer?: number;
}

export interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface GameMetrics {
  p1Health: number;
  p2Health: number;
  score: number;
  wave: number;
  bossHp?: number;
  maxBossHp?: number;
}