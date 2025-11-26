import React, { useEffect, useRef, useCallback } from 'react';
import { GameState, Entity, EntityType, Particle, GameMetrics, Rect } from '../types';
import * as C from '../constants';

interface GameLoopProps {
  gameState: GameState;
  setGameState: (state: GameState) => void;
  onMetricsUpdate: (metrics: GameMetrics) => void;
  p1Color: string;
  p2Color: string;
}

const GameLoop: React.FC<GameLoopProps> = ({ gameState, setGameState, onMetricsUpdate, p1Color, p2Color }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
  
  // Game State Refs (Mutable for performance)
  const entities = useRef<Entity[]>([]);
  const particles = useRef<Particle[]>([]);
  const keys = useRef<Set<string>>(new Set());
  const score = useRef(0);
  const wave = useRef(1);
  const frameCount = useRef(0);
  const bossSpawned = useRef(false);

  // Room Logic Refs
  const enemiesSpawnedInRoom = useRef(0);
  const enemiesTargetForRoom = useRef(20); // Initial target

  // Jump Request Refs (for single press detection)
  const p1JumpReq = useRef(false);
  const p2JumpReq = useRef(false);

  // Helper to create a random enemy
  const createRandomEnemy = (idSuffix: string | number): Entity => {
    const typeRoll = Math.random();
    let newType = EntityType.ENEMY_NORMAL;
    let col = C.COLORS.ENEMY_NORMAL;
    let hp = 30;
    
    if (typeRoll > 0.7) {
      newType = EntityType.ENEMY_BOMB;
      col = C.COLORS.ENEMY_BOMB;
      hp = 1; 
    } else if (typeRoll > 0.4) {
      newType = EntityType.ENEMY_FLYER;
      col = '#94a3b8'; // Ghost Grey
      hp = 20; // Slightly tankier ghost
    }

    const spawnX = Math.random() * (C.CANVAS_WIDTH - 100) + 50;
    const spawnY = Math.random() * (C.CANVAS_HEIGHT - 300);

    return {
      id: `enemy_${idSuffix}`,
      type: newType,
      x: spawnX, y: spawnY, w: 40, h: 40,
      vx: 0, vy: 0, isGrounded: false, color: col,
      hp, maxHp: hp, facing: Math.random() > 0.5 ? 1 : -1,
      attackCooldown: 0, isAttacking: false, isParrying: false, parryTimer: 0,
      hurtTimer: 0
    };
  };

  // --- LEVEL GENERATION ---

  const createWalls = (): Entity[] => {
    return [
      { id: 'wall_left', type: EntityType.PLATFORM, x: -50, y: -C.CANVAS_HEIGHT, w: 50, h: C.CANVAS_HEIGHT * 3, vx: 0, vy: 0, isGrounded: true, color: C.COLORS.PLATFORM, hp: 1, maxHp: 1, facing: 1, attackCooldown: 0, isAttacking: false, isParrying: false, parryTimer: 0 },
      { id: 'wall_right', type: EntityType.PLATFORM, x: C.CANVAS_WIDTH, y: -C.CANVAS_HEIGHT, w: 50, h: C.CANVAS_HEIGHT * 3, vx: 0, vy: 0, isGrounded: true, color: C.COLORS.PLATFORM, hp: 1, maxHp: 1, facing: 1, attackCooldown: 0, isAttacking: false, isParrying: false, parryTimer: 0 },
      { id: 'ceiling', type: EntityType.PLATFORM, x: 0, y: -50, w: C.CANVAS_WIDTH, h: 50, vx: 0, vy: 0, isGrounded: true, color: C.COLORS.PLATFORM, hp: 1, maxHp: 1, facing: 1, attackCooldown: 0, isAttacking: false, isParrying: false, parryTimer: 0 },
      { id: 'floor', type: EntityType.PLATFORM, x: 0, y: C.CANVAS_HEIGHT - 40, w: C.CANVAS_WIDTH, h: 40, vx: 0, vy: 0, isGrounded: true, color: C.COLORS.PLATFORM, hp: 1, maxHp: 1, facing: 1, attackCooldown: 0, isAttacking: false, isParrying: false, parryTimer: 0 }
    ];
  };

  const generateBossArena = () => {
      // Clean slate
      const p1 = entities.current.find(e => e.type === EntityType.PLAYER_1);
      const p2 = entities.current.find(e => e.type === EntityType.PLAYER_2);
      entities.current = [...createWalls()];

      // Boss Arena Platforms (2 sturdy ones on sides)
      entities.current.push({
         id: 'boss_plat_left', type: EntityType.PLATFORM,
         x: 200, y: C.CANVAS_HEIGHT - 300, w: 400, h: 40,
         vx: 0, vy: 0, isGrounded: true, color: C.COLORS.PLATFORM, hp: 1, maxHp: 1, facing: 1, attackCooldown: 0, isAttacking: false, isParrying: false, parryTimer: 0 
      });
      entities.current.push({
         id: 'boss_plat_right', type: EntityType.PLATFORM,
         x: C.CANVAS_WIDTH - 600, y: C.CANVAS_HEIGHT - 300, w: 400, h: 40,
         vx: 0, vy: 0, isGrounded: true, color: C.COLORS.PLATFORM, hp: 1, maxHp: 1, facing: 1, attackCooldown: 0, isAttacking: false, isParrying: false, parryTimer: 0 
      });

      // Spawn Boss
      const boss: Entity = {
        id: 'boss', type: EntityType.BOSS, 
        x: C.CANVAS_WIDTH / 2 - 100, y: 200, w: 200, h: 200,
        vx: 0, vy: 0, isGrounded: false, color: C.COLORS.BOSS,
        hp: 2000, maxHp: 2000, facing: 1,
        attackCooldown: 120, isAttacking: false, isParrying: false, parryTimer: 0,
        state: 'BOSS_IDLE', stateTimer: 0,
        hurtTimer: 0
      };
      entities.current.push(boss);
      spawnParticles(C.CANVAS_WIDTH/2, 300, C.COLORS.BOSS, 100, 20);

      // Re-add Players at Safe Spots
      if (p1) { p1.x = 300; p1.y = C.CANVAS_HEIGHT - 400; p1.vx = 0; p1.vy = 0; p1.hurtTimer = 0; entities.current.push(p1); }
      if (p2) { p2.x = C.CANVAS_WIDTH - 300; p2.y = C.CANVAS_HEIGHT - 400; p2.vx = 0; p2.vy = 0; p2.hurtTimer = 0; entities.current.push(p2); }

      bossSpawned.current = true;
  };

  const generateLevel = (roomNum: number) => {
      // Find Players to preserve them
      let p1 = entities.current.find(e => e.type === EntityType.PLAYER_1);
      let p2 = entities.current.find(e => e.type === EntityType.PLAYER_2);

      // Reset array with basic walls/floor
      entities.current = [...createWalls()];
      
      // Random Platforms
      const numPlatforms = 20 + Math.random() * 5;
      for (let i = 0; i < numPlatforms; i++) {
        const w = 250 + Math.random() * 200;
        const h = 30;
        const x = Math.random() * (C.CANVAS_WIDTH - w);
        const y = Math.random() * (C.CANVAS_HEIGHT - 300) + 100;
        
        entities.current.push({
          id: `plat_${roomNum}_${i}`, type: EntityType.PLATFORM,
          x, y, w, h,
          vx: 0, vy: 0, isGrounded: true, color: C.COLORS.PLATFORM,
          hp: 1, maxHp: 1, facing: 1, attackCooldown: 0, isAttacking: false, isParrying: false, parryTimer: 0
        });

        // Spikes (30% chance)
        if (Math.random() < 0.3) { 
           const spikeW = 60 + Math.random() * 40;
           const spikeX = x + Math.random() * (w - spikeW);
           entities.current.push({
             id: `spike_${roomNum}_${i}`, type: EntityType.SPIKE,
             x: spikeX, y: y - 30, w: spikeW, h: 30,
             vx: 0, vy: 0, isGrounded: true, color: C.COLORS.SPIKE,
             hp: 1, maxHp: 1, facing: 1, attackCooldown: 0, isAttacking: false, isParrying: false, parryTimer: 0
           });
        }
      }

      // Re-add or Create Players
      if (!p1) {
          p1 = {
            id: 'p1', type: EntityType.PLAYER_1, x: 200, y: C.CANVAS_HEIGHT - 200, w: C.PLAYER_SIZE, h: C.PLAYER_SIZE,
            vx: 0, vy: 0, isGrounded: false, color: p1Color, hp: 100, maxHp: 100, facing: 1, attackCooldown: 0, isAttacking: false, isParrying: false, parryTimer: 0, jumpCount: 0, hurtTimer: 0
          };
      } else {
          p1.x = 200; p1.y = C.CANVAS_HEIGHT - 200; p1.vx = 0; p1.vy = 0; p1.hurtTimer = 0;
      }
      entities.current.push(p1);

      if (!p2) {
          p2 = {
            id: 'p2', type: EntityType.PLAYER_2, x: C.CANVAS_WIDTH - 200, y: C.CANVAS_HEIGHT - 200, w: C.PLAYER_SIZE, h: C.PLAYER_SIZE,
            vx: 0, vy: 0, isGrounded: false, color: p2Color, hp: 100, maxHp: 100, facing: -1, attackCooldown: 0, isAttacking: false, isParrying: false, parryTimer: 0, jumpCount: 0, hurtTimer: 0
          };
      } else {
          p2.x = C.CANVAS_WIDTH - 200; p2.y = C.CANVAS_HEIGHT - 200; p2.vx = 0; p2.vy = 0; p2.hurtTimer = 0;
      }
      entities.current.push(p2);

      // Reset Wave Stats
      wave.current = roomNum;
      enemiesSpawnedInRoom.current = 0;
      // Double the enemies per room (approx 16-28 enemies)
      enemiesTargetForRoom.current = (8 + Math.floor(Math.random() * 5)) * 2; 
  };

  // Initialize Game
  const initGame = useCallback(() => {
    score.current = 0;
    frameCount.current = 0;
    bossSpawned.current = false;
    particles.current = [];
    entities.current = [];
    
    // Clear Inputs to prevent stuck keys
    keys.current.clear();
    p1JumpReq.current = false;
    p2JumpReq.current = false;

    generateLevel(1);
    
    // Initial spawns for first room (more of them)
    entities.current.push(createRandomEnemy('start_1'));
    entities.current.push(createRandomEnemy('start_2'));
    entities.current.push(createRandomEnemy('start_3'));
    entities.current.push(createRandomEnemy('start_4'));
    enemiesSpawnedInRoom.current = 4;

  }, [p1Color, p2Color]);

  // Helper: Rect Collision
  const checkRectCollision = (r1: Rect, r2: Rect) => {
    return (
      r1.x < r2.x + r2.w &&
      r1.x + r1.w > r2.x &&
      r1.y < r2.y + r2.h &&
      r1.y + r1.h > r2.y
    );
  };
  
  // Helper: Inclusive Collision for Touch Damage (Spikes)
  const checkTouchCollision = (r1: Rect, r2: Rect) => {
      return (
        r1.x < r2.x + r2.w + 2 &&
        r1.x + r1.w > r2.x - 2 &&
        r1.y < r2.y + r2.h + 2 &&
        r1.y + r1.h > r2.y - 2
      );
  };

  // Helper: Spawn Particles
  const spawnParticles = (x: number, y: number, color: string, count: number, speed = 12) => {
    for (let i = 0; i < count; i++) {
      particles.current.push({
        id: Math.random().toString(),
        x, y,
        vx: (Math.random() - 0.5) * speed,
        vy: (Math.random() - 0.5) * speed,
        life: 40 + Math.random() * 20,
        maxLife: 60,
        color,
        size: 3 + Math.random() * 5
      });
    }
  };

  const update = useCallback(() => {
    frameCount.current++;
    const currentKeys = keys.current;
    
    // ----------------------
    // 0. Spawning & Level Logic
    // ----------------------
    
    if (!bossSpawned.current) {
        // Are there enemies left to spawn in this room?
        if (enemiesSpawnedInRoom.current < enemiesTargetForRoom.current) {
             if (frameCount.current % C.ENEMY_SPAWN_RATE === 0) {
                entities.current.push(createRandomEnemy(`${wave.current}_${enemiesSpawnedInRoom.current}`));
                enemiesSpawnedInRoom.current++;
             }
        } else {
             // All enemies for this room spawned. Are they dead?
             const activeEnemies = entities.current.filter(e => e.type.startsWith('ENEMY') && e.state !== 'DYING');
             if (activeEnemies.length === 0) {
                 // Room Clear!
                 if (score.current >= C.BOSS_TRIGGER_SCORE) {
                     generateBossArena();
                 } else {
                     generateLevel(wave.current + 1);
                 }
             }
        }
    }

    // ----------------------
    // 1. Entity Logic
    // ----------------------
    entities.current.forEach((entity, index) => {
      // Handle Dying State
      if (entity.state === 'DYING') {
         if (entity.stateTimer) entity.stateTimer--;
         // Physics for dying entities (simple fall if not flying)
         if (entity.type !== EntityType.ENEMY_FLYER) {
             entity.x += entity.vx;
             entity.y += entity.vy;
             if (!entity.isGrounded) entity.vy += C.GRAVITY;
         } else {
             // Ghosts drift up when dying
             entity.y -= 1;
         }
         return; // Skip other logic
      }

      // --- PLAYER 1 (WASD + Space) ---
      if (entity.type === EntityType.PLAYER_1) {
        if ((entity.hurtTimer || 0) > 0) {
           entity.hurtTimer!--;
           entity.vx *= 0.9; // Apply friction during stun
        } else {
            // Normal Movement
            // ACCELERATION PHYSICS
            if (currentKeys.has('a')) { 
               entity.vx -= C.ACCELERATION;
               entity.facing = -1; 
            }
            else if (currentKeys.has('d')) { 
               entity.vx += C.ACCELERATION;
               entity.facing = 1; 
            }
            else { entity.vx *= C.FRICTION; }
            
            // Clamp speed
            entity.vx = Math.max(Math.min(entity.vx, C.MOVE_SPEED), -C.MOVE_SPEED);

            // Double Jump Logic
            if (p1JumpReq.current) {
              if (entity.isGrounded) {
                 entity.vy = C.JUMP_FORCE;
                 entity.isGrounded = false;
                 entity.jumpCount = 1;
                 spawnParticles(entity.x + entity.w/2, entity.y + entity.h, '#fff', 5);
              } else if ((entity.jumpCount || 0) < 2) {
                 entity.vy = C.JUMP_FORCE;
                 entity.jumpCount = (entity.jumpCount || 0) + 1;
                 spawnParticles(entity.x + entity.w/2, entity.y + entity.h, '#fff', 8); // Air jump puff
              }
              p1JumpReq.current = false;
            }

            // Parry
            if (currentKeys.has(' ') && entity.attackCooldown <= 0 && !entity.isParrying) {
              entity.isParrying = true;
              entity.parryTimer = C.PARRY_DURATION;
              entity.attackCooldown = C.ATTACK_COOLDOWN;
            }
        }

        if (entity.isParrying) {
          entity.parryTimer--;
          if (entity.parryTimer <= 0) entity.isParrying = false;
        }
        if (entity.attackCooldown > 0) entity.attackCooldown--;
      }

      // --- PLAYER 2 (Arrows + Enter) ---
      if (entity.type === EntityType.PLAYER_2) {
        if ((entity.hurtTimer || 0) > 0) {
            entity.hurtTimer!--;
            entity.vx *= 0.9;
        } else {
            // ACCELERATION PHYSICS
            if (currentKeys.has('arrowleft')) { 
               entity.vx -= C.ACCELERATION;
               entity.facing = -1; 
            }
            else if (currentKeys.has('arrowright')) { 
               entity.vx += C.ACCELERATION;
               entity.facing = 1; 
            }
            else { entity.vx *= C.FRICTION; }
            
            // Clamp speed
            entity.vx = Math.max(Math.min(entity.vx, C.MOVE_SPEED), -C.MOVE_SPEED);

            // Double Jump Logic
            if (p2JumpReq.current) {
              if (entity.isGrounded) {
                 entity.vy = C.JUMP_FORCE;
                 entity.isGrounded = false;
                 entity.jumpCount = 1;
                 spawnParticles(entity.x + entity.w/2, entity.y + entity.h, '#fff', 5);
              } else if ((entity.jumpCount || 0) < 2) {
                 entity.vy = C.JUMP_FORCE;
                 entity.jumpCount = (entity.jumpCount || 0) + 1;
                 spawnParticles(entity.x + entity.w/2, entity.y + entity.h, '#fff', 8);
              }
              p2JumpReq.current = false;
            }

            // Attack
            if (currentKeys.has('enter') && entity.attackCooldown <= 0) {
              entity.isAttacking = true;
              entity.stateTimer = C.ATTACK_DURATION;
              entity.attackCooldown = C.ATTACK_COOLDOWN;
            }
        }

        if (entity.isAttacking) {
          entity.stateTimer = (entity.stateTimer || 0) - 1;
          if (entity.stateTimer <= 0) entity.isAttacking = false;
        }
        if (entity.attackCooldown > 0) entity.attackCooldown--;
      }

      // --- ENEMY AI (SMARTER) ---
      if ([EntityType.ENEMY_NORMAL, EntityType.ENEMY_BOMB, EntityType.ENEMY_FLYER].includes(entity.type)) {
        if ((entity.hurtTimer || 0) > 0) {
           entity.hurtTimer!--;
           // Stunned: No AI movement, just physics friction
           entity.vx *= 0.9;
        } else {
            const p1 = entities.current.find(e => e.type === EntityType.PLAYER_1);
            const p2 = entities.current.find(e => e.type === EntityType.PLAYER_2);
            
            let target = p1;
            if (p1 && p2) {
              const d1 = Math.hypot(p1.x - entity.x, p1.y - entity.y);
              const d2 = Math.hypot(p2.x - entity.x, p2.y - entity.y);
              target = d1 < d2 ? p1 : p2;
            }

            // AI Logic
            if (target) {
              const dx = target.x - entity.x;
              const dy = target.y - entity.y;
              const dist = Math.hypot(dx, dy);
              
              // Trigger Attack Animation if close
              if (dist < 60) {
                  entity.isAttacking = true;
              } else {
                  entity.isAttacking = false;
              }

              // Separation Force (Avoid stacking)
              let sepX = 0;
              let sepY = 0;
              entities.current.forEach((other, otherIdx) => {
                 if (index !== otherIdx && other.type.startsWith('ENEMY') && other.state !== 'DYING') {
                    const ox = entity.x - other.x;
                    const oy = entity.y - other.y;
                    const odist = Math.hypot(ox, oy);
                    if (odist < 60 && odist > 0) {
                       sepX += (ox / odist) * 2.0; // Stronger separation
                       sepY += (oy / odist) * 2.0;
                    }
                 }
              });

              // Ground Enemy: Mummy / Bomb
              if (entity.type === EntityType.ENEMY_NORMAL || entity.type === EntityType.ENEMY_BOMB) {
                 if (entity.type === EntityType.ENEMY_BOMB && entity.state === 'EXPLODING') {
                     // Bomb Exploding... Stop moving
                     entity.vx = 0;
                     entity.stateTimer = (entity.stateTimer || 0) - 1;
                     if (entity.stateTimer <= 0) {
                       entity.hp = 0; // BOOM
                       entity.state = 'DYING'; // Just for cleanup
                       entity.stateTimer = 1;
                       spawnParticles(entity.x + entity.w/2, entity.y + entity.h/2, '#ef4444', 50);
                     }
                 } else {
                     // Chase Logic
                     const speed = entity.type === EntityType.ENEMY_NORMAL ? 4 : 6;
                     let dir = dx > 0 ? 1 : -1;
                     
                     // Stop jittering if close (only if also vertically aligned)
                     // If target is far below, don't stop moving, so we can fall off the edge
                     if (Math.abs(dx) < 10 && Math.abs(dy) < 50) dir = 0;
                     
                     // Acceleration
                     entity.vx += dir * C.ACCELERATION;
                     if (sepX) entity.vx += sepX * 0.1;
                     
                     entity.vx = Math.max(Math.min(entity.vx, speed), -speed);

                     entity.facing = dx > 0 ? 1 : -1;

                     // ** SMART OBSTACLE AVOIDANCE **
                     if (entity.isGrounded) {
                        const lookAhead = 40;
                        const probeX = entity.facing === 1 ? entity.x + entity.w : entity.x - lookAhead;
                        
                        // 1. Check for Walls/Obstacles Ahead
                        const wallProbe: Rect = { x: probeX, y: entity.y, w: lookAhead, h: entity.h - 10 };
                        const hasWall = entities.current.some(e => 
                           (e.type === EntityType.PLATFORM || e.type === EntityType.SPIKE) && 
                           checkRectCollision(wallProbe, e)
                        );

                        // 2. Check for Gap Ahead (Ledge)
                        // Probe slightly below floor level
                        const gapProbe: Rect = { x: probeX, y: entity.y + entity.h + 20, w: lookAhead, h: 20 };
                        const hasFloor = entities.current.some(e => 
                           e.type === EntityType.PLATFORM && checkRectCollision(gapProbe, e)
                        );
                        
                        // If player is significantly below (>100px), we want to go down
                        const targetIsBelow = dy > 100;

                        // Jump if Wall ahead OR (Gap ahead AND Target is not below)
                        // If target IS below and there is a gap, we do NOTHING (no jump) to walk off the edge.
                        if (hasWall) {
                             // Must jump walls
                             entity.vy = C.JUMP_FORCE * 1.2;
                             entity.vx = entity.facing * (speed + 2);
                        } else if (!hasFloor) {
                             // Gap detected.
                             if (targetIsBelow) {
                                 // Drop down. Don't jump.
                             } else {
                                 // Target is level or above, jump across gap.
                                 entity.vy = C.JUMP_FORCE * 1.2;
                                 entity.vx = entity.facing * (speed + 2);
                             }
                        }

                        // Also jump if target is significantly above (original logic)
                        const targetIsAbove = dy < -100; // Negative dy means target is above
                        const stuck = Math.abs(entity.vx) < 1 && Math.abs(dx) > 50; 
                        
                        // Don't double jump if already jumping from wall logic
                        if (entity.isGrounded && (targetIsAbove || stuck)) {
                             if (Math.random() < 0.1) entity.vy = C.JUMP_FORCE * 1.1;
                        }
                     }

                     // Bomb trigger
                     if (entity.type === EntityType.ENEMY_BOMB && dist < 100) {
                        entity.state = 'EXPLODING';
                        entity.stateTimer = 60;
                        entity.color = '#fff';
                     }
                 }
              } 
              // Flying Enemy: Ghost
              else if (entity.type === EntityType.ENEMY_FLYER) {
                 // Drift / Steering behavior
                 const desiredVx = (dx / dist) * 5;
                 const desiredVy = (dy / dist) * 5;
                 
                 // Interpolate current velocity towards desired (Smooth turning)
                 entity.vx += (desiredVx - entity.vx) * 0.1 + (sepX * 0.1);
                 entity.vy += (desiredVy - entity.vy) * 0.1 + (sepY * 0.1);

                 // Sine wave bob integration
                 entity.vy += Math.sin(frameCount.current * 0.1 + index) * 0.2;

                 entity.facing = dx > 0 ? 1 : -1;

                 // Ghost trail particles
                 if (frameCount.current % 4 === 0) {
                    particles.current.push({
                      id: Math.random().toString(),
                      x: entity.x + entity.w/2, y: entity.y + entity.h/2,
                      vx: 0, vy: 0, life: 20, maxLife: 20, 
                      color: 'rgba(148, 163, 184, 0.5)', size: 5
                    });
                 }
              }
            }
        }
      }

      // --- BOSS AI ---
      if (entity.type === EntityType.BOSS && entity.state !== 'DYING') {
         // Simple State Machine
         if (!entity.stateTimer) entity.stateTimer = 0;
         entity.stateTimer--;

         const p1 = entities.current.find(e => e.type === EntityType.PLAYER_1);
         const p2 = entities.current.find(e => e.type === EntityType.PLAYER_2);
         const target = p1 || p2;

         if (entity.stateTimer <= 0) {
            // Pick new state
            const roll = Math.random();
            if (roll < 0.4) {
               entity.state = 'BOSS_SMASH';
               entity.stateTimer = 120;
               entity.vy = -25; // Jump high
            } else if (roll < 0.7) {
               entity.state = 'BOSS_LASER';
               entity.stateTimer = 180;
            } else {
               entity.state = 'BOSS_CHARGE';
               entity.stateTimer = 120;
            }
         }

         // Action Execution
         if (entity.state === 'BOSS_CHARGE' && target) {
             const dx = target.x - entity.x;
             entity.vx = dx > 0 ? 8 : -8;
             entity.facing = dx > 0 ? 1 : -1;
         } else if (entity.state === 'BOSS_SMASH') {
             // While in air, move towards center or player
             if (!entity.isGrounded) {
                if (target) {
                   entity.vx = (target.x - entity.x) * 0.05;
                }
             } else {
                entity.vx = 0;
             }
         } else if (entity.state === 'BOSS_LASER') {
             entity.vx = 0;
         }
      }

      // --- PHYSICS & COLLISION RESOLUTION ---
      const isStatic = [EntityType.PLATFORM, EntityType.SPIKE].includes(entity.type);
      const isFlyer = entity.type === EntityType.ENEMY_FLYER;
      const isBoss = entity.type === EntityType.BOSS;

      // Apply Gravity
      if (!isStatic && !isFlyer) {
        entity.vy += C.GRAVITY;
      }

      if (isFlyer) {
         // Flyer Physics: No collision with walls (Pass Through)
         // Only apply velocity
         entity.x += entity.vx;
         entity.y += entity.vy;
      } 
      else {
          // Regular Physics (Players, Ground Enemies, Boss)
          entity.x += entity.vx;
          entity.y += entity.vy;

          if (!isStatic) {
            entity.isGrounded = false;
            entities.current.forEach(other => {
              // CHANGE: Spikes now count as solid ground/walls
              if ((other.type === EntityType.PLATFORM || other.type === EntityType.SPIKE) && checkRectCollision(entity, other)) {
                // Determine previous position relative to the platform
                const prevY = entity.y - entity.vy;
                
                // Check if we were previously 'above' the platform (for landing)
                const wasAbove = prevY + entity.h <= other.y + (other.vy || 0) + 15; // Tolerance
                const wasBelow = prevY >= other.y + other.h - 10;
                
                // Vertical Resolution
                if (wasAbove && entity.vy >= 0) {
                  // Landed on top
                  entity.y = other.y - entity.h;
                  entity.vy = 0;
                  entity.isGrounded = true;
                  entity.jumpCount = 0; // Reset jumps on landing
                  
                  // Boss Shockwave on Land
                  if (isBoss && entity.state === 'BOSS_SMASH' && entity.stateTimer && entity.stateTimer > 10) {
                     spawnParticles(entity.x + entity.w/2, entity.y + entity.h, '#fff', 30);
                     // Screen Shake
                     shakeScreen(20);
                  }
                } else if (wasBelow && entity.vy < 0) {
                   // Hit ceiling
                   entity.y = other.y + other.h;
                   entity.vy = 0;
                } else {
                   // Horizontal Resolution (Wall Hit)
                   if (entity.vx > 0) {
                       entity.x = other.x - entity.w;
                       entity.vx = 0;
                   } else if (entity.vx < 0) {
                       entity.x = other.x + other.w;
                       entity.vx = 0;
                   }
                }
              }
            });
          }
      }

      // Bounds check
      if (entity.y > C.CANVAS_HEIGHT + 100) {
        if (entity.type === EntityType.PLAYER_1 || entity.type === EntityType.PLAYER_2) {
          entity.hp = 0;
        } else if (entity.type !== EntityType.BOSS) {
          entity.hp = 0;
        }
      }
    });

    // ----------------------
    // 2. Combat
    // ----------------------
    const activeEntities = entities.current.filter(e => e.hp > 0 && e.state !== 'DYING');
    const p1 = activeEntities.find(e => e.type === EntityType.PLAYER_1);
    const p2 = activeEntities.find(e => e.type === EntityType.PLAYER_2);
    const enemies = activeEntities.filter(e => e.type.startsWith('ENEMY'));
    const boss = activeEntities.find(e => e.type === EntityType.BOSS);
    const spikes = activeEntities.filter(e => e.type === EntityType.SPIKE);

    const allHostiles = boss ? [...enemies, boss] : enemies;

    // Check Co-op Link
    let isCoopLinked = false;
    if (p1 && p2) {
        const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        if (dist < C.COOP_LINK_DISTANCE) {
            isCoopLinked = true;
        }
    }
    const damageMultiplier = isCoopLinked ? 2 : 1;

    // -- Player 2 Sword --
    if (p2 && p2.isAttacking) {
      // Calculate hitbox based on facing direction
      const swordHitbox: Rect = {
        x: p2.facing === 1 ? p2.x + p2.w : p2.x - C.SWORD_RANGE,
        y: p2.y - 10,
        w: C.SWORD_RANGE,
        h: p2.h + 20
      };
      
      allHostiles.forEach(enemy => {
        if (checkRectCollision(swordHitbox, enemy) && enemy.type !== EntityType.ENEMY_BOMB) {
            if (enemy.hp > 0 && enemy.state !== 'DYING') {
              // Apply Damage Multiplier
              enemy.hp -= C.SWORD_DAMAGE * damageMultiplier; 
              
              enemy.vx += p2.facing * 10;
              enemy.hurtTimer = 10; // Stun Enemy
              
              // Visual Feedback for Critical Hit
              spawnParticles(enemy.x, enemy.y, isCoopLinked ? '#fbbf24' : '#fca5a5', isCoopLinked ? 15 : 5);
              shakeScreen(isCoopLinked ? 5 : 2); // Screen shake on hit
              
              if (enemy.hp <= 0 && enemy.type !== EntityType.BOSS) {
                  score.current += 1;
                  enemy.state = 'DYING';
                  enemy.stateTimer = 30;
              }
            }
        } else if (checkRectCollision(swordHitbox, enemy) && enemy.type === EntityType.ENEMY_BOMB) {
            // Defuse bomb with sword
             if (enemy.hp > 0 && enemy.state !== 'DYING') {
                enemy.hp = 0;
                score.current += 1;
                enemy.state = 'DYING';
                enemy.stateTimer = 30;
                spawnParticles(enemy.x, enemy.y, '#94a3b8', 10);
             }
        }
      });
    }

    // -- Enemies/Boss vs Players --
    allHostiles.forEach(enemy => {
      if (enemy.state === 'DYING') return;

      // 1. P1 Collision
      if (p1 && checkRectCollision(enemy, p1)) {
        if (p1.isParrying) {
          spawnParticles(p1.x + (p1.facing * p1.w), p1.y, '#60a5fa', 10);
          if (enemy.type === EntityType.ENEMY_BOMB) {
            // Shield hits bomb -> Defuse
            enemy.hp = 0; score.current += 1;
            enemy.state = 'DYING';
            enemy.stateTimer = 30;
          } else {
             // Reflect damage (Shield Damage * Multiplier)
            const dmg = C.SHIELD_DAMAGE * damageMultiplier;
            enemy.hp -= dmg;
            enemy.vx = p1.facing * 20;
            enemy.hurtTimer = 20; // Stun Enemy on Parry
            
            spawnParticles(enemy.x, enemy.y, isCoopLinked ? '#fbbf24' : '#93c5fd', 5);
            shakeScreen(3);

            if (enemy.hp <= 0 && enemy.type !== EntityType.BOSS) {
                score.current += 1;
                enemy.state = 'DYING';
                enemy.stateTimer = 30;
            }
          }
        } else {
          // HIT P1
          // Check if player is already hurt/invincible
          if ((p1.hurtTimer || 0) === 0) {
              let takenDmg = 0;
              if (enemy.type === EntityType.ENEMY_BOMB) {
                 if (enemy.state === 'EXPLODING' && (enemy.stateTimer || 0) < 5) takenDmg = C.DMG_BOMB;
              } else if (enemy.type === EntityType.BOSS) {
                 takenDmg = C.DMG_BOSS_TOUCH;
              } else {
                 takenDmg = enemy.type === EntityType.ENEMY_NORMAL ? C.DMG_NORMAL : C.DMG_FLYER;
              }

              if (takenDmg > 0) {
                 p1.hp -= takenDmg;
                 // Apply Knockback
                 const dx = (p1.x + p1.w/2) - (enemy.x + enemy.w/2);
                 const dir = dx >= 0 ? 1 : -1;
                 const force = 12;
                 
                 p1.vx = dir * force;
                 p1.vy = -6; 
                 p1.hurtTimer = 20; // Stun & Invulnerability window
                 
                 shakeScreen(5);

                 // Bounce enemy too
                 if (enemy.type !== EntityType.BOSS) {
                    enemy.vx = -dir * force;
                    enemy.vy = -6;
                    enemy.hurtTimer = 20; 
                 }
              }
          }
        }
      }

      // 2. P2 Collision
      if (p2 && checkRectCollision(enemy, p2)) {
         // Check invulnerability
         if ((p2.hurtTimer || 0) === 0) {
             let takenDmg = 0;
             if (enemy.type === EntityType.ENEMY_BOMB) {
                 if (enemy.state === 'EXPLODING' && (enemy.stateTimer || 0) < 5) takenDmg = C.DMG_BOMB;
             } else if (enemy.type === EntityType.BOSS) {
                 takenDmg = C.DMG_BOSS_TOUCH;
             } else {
                 takenDmg = enemy.type === EntityType.ENEMY_NORMAL ? C.DMG_NORMAL : C.DMG_FLYER; 
             }

             if (takenDmg > 0) {
                 p2.hp -= takenDmg;
                 
                 const dx = (p2.x + p2.w/2) - (enemy.x + enemy.w/2);
                 const dir = dx >= 0 ? 1 : -1;
                 const force = 12;
                 
                 p2.vx = dir * force;
                 p2.vy = -6;
                 p2.hurtTimer = 20; // Stun & Invulnerability window
                 
                 shakeScreen(5);

                 if (enemy.type !== EntityType.BOSS) {
                    enemy.vx = -dir * force;
                    enemy.vy = -6;
                    enemy.hurtTimer = 20; 
                 }
             }
         }
      }
      
      // Bomb AoE
      if (enemy.type === EntityType.ENEMY_BOMB && enemy.state === 'EXPLODING' && (enemy.stateTimer || 0) <= 0) {
        const explosionRect = { x: enemy.x - 100, y: enemy.y - 100, w: enemy.w + 200, h: enemy.h + 200 };
        if (p1 && checkRectCollision(explosionRect, p1) && !p1.isParrying) p1.hp -= C.DMG_BOMB;
        if (p2 && checkRectCollision(explosionRect, p2)) p2.hp -= C.DMG_BOMB;
        shakeScreen(15);
      }
    });

    // -- Spikes vs Players AND Enemies --
    spikes.forEach(spike => {
      // Players - using checkTouchCollision to catch touching even if resting on solid spike
      if (p1 && checkTouchCollision(spike, p1) && (p1.hurtTimer || 0) === 0) {
          p1.hp -= C.DMG_SPIKE;
          // Spike Knockback
          p1.vy = -12;
          p1.vx = (p1.x < spike.x ? -1 : 1) * 8;
          p1.hurtTimer = 30; // Longer stun for spike
          spawnParticles(p1.x + p1.w/2, p1.y + p1.h, '#ef4444', 5);
          shakeScreen(5);
      }
      if (p2 && checkTouchCollision(spike, p2) && (p2.hurtTimer || 0) === 0) {
          p2.hp -= C.DMG_SPIKE;
          // Spike Knockback
          p2.vy = -12;
          p2.vx = (p2.x < spike.x ? -1 : 1) * 8;
          p2.hurtTimer = 30;
          spawnParticles(p2.x + p2.w/2, p2.y + p2.h, '#ef4444', 5);
          shakeScreen(5);
      }
      
      // Enemies
      allHostiles.forEach(enemy => {
         // Flying enemies do not hit spikes
         if (enemy.type !== EntityType.BOSS && enemy.type !== EntityType.ENEMY_FLYER && checkTouchCollision(spike, enemy) && frameCount.current % 30 === 0 && enemy.state !== 'DYING') {
             enemy.hp -= 30; // Spikes hurt enemies a lot
             spawnParticles(enemy.x, enemy.y, enemy.color, 3);
             if (enemy.hp <= 0) {
                 score.current += 1;
                 enemy.state = 'DYING';
                 enemy.stateTimer = 30;
             }
         }
      });
    });

    // -- Boss Special Attacks --
    if (boss && boss.state === 'BOSS_LASER') {
        // Shoot laser horizontally from center
        const laserY = boss.y + boss.h/2;
        const laserH = 40;
        // Hit players
        if (p1 && p1.y < laserY + laserH && p1.y + p1.h > laserY && !p1.isParrying) p1.hp -= 1;
        if (p2 && p2.y < laserY + laserH && p2.y + p2.h > laserY) p2.hp -= 1;
    }

    // ----------------------
    // 4. Cleanup
    // ----------------------
    // Keep entities that are ALIVE or DYING (with timer left)
    entities.current = entities.current.filter(e => {
        if (e.hp > 0) return true;
        if (e.type === EntityType.BOSS) return false; // Boss <= 0 triggers victory, handled below
        
        // For dying enemies, keep them until timer expires
        if (e.state === 'DYING' && (e.stateTimer || 0) > 0) return true;
        
        return false;
    });
    
    particles.current.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
    });
    particles.current = particles.current.filter(p => p.life > 0);

    // Update Screen Shake
    if (screenShake.current > 0) {
       screenShake.current *= C.SCREEN_SHAKE_DECAY;
       if (screenShake.current < 0.5) screenShake.current = 0;
    }

    // Victory/Defeat
    if (boss && boss.hp <= 0) {
       setGameState(GameState.VICTORY);
    } else if (p1 && p2) {
       // Check if both players dead
       if (p1.hp <= 0 && p2.hp <= 0) {
           setGameState(GameState.GAME_OVER);
       } else {
           onMetricsUpdate({
            p1Health: Math.max(0, p1.hp),
            p2Health: Math.max(0, p2.hp),
            score: score.current,
            wave: wave.current,
            bossHp: boss ? boss.hp : undefined,
            maxBossHp: boss ? boss.maxHp : undefined
          });
       }
    } else {
      setGameState(GameState.GAME_OVER);
    }

  }, [onMetricsUpdate, setGameState]);

  // Screen Shake Ref
  const screenShake = useRef(0);
  const shakeScreen = (amount: number) => {
     screenShake.current = Math.min(screenShake.current + amount, 30);
  };

  // --- DRAWING FUNCTIONS ---

  const drawDyingEnemy = (ctx: CanvasRenderingContext2D, e: Entity) => {
      const progress = e.stateTimer! / 30; // 1 -> 0
      const centerX = e.x + e.w/2;
      const centerY = e.y + e.h/2;

      ctx.save();
      ctx.globalAlpha = progress; // Fade out

      if (e.type === EntityType.ENEMY_NORMAL) {
          // Mummy: Crumble (Squash vertically)
          const scaleY = progress; 
          ctx.translate(e.x + e.w/2, e.y + e.h);
          ctx.scale(1, scaleY);
          ctx.translate(-(e.x + e.w/2), -(e.y + e.h));
          
          // Draw simplified mummy
          ctx.fillStyle = '#94a3b8';
          ctx.fillRect(e.x, e.y, e.w, e.h);
          
          // Particles crumbling
          if (frameCount.current % 5 === 0) {
              particles.current.push({
                  id: Math.random().toString(),
                  x: e.x + Math.random()*e.w, y: e.y + e.h - (Math.random()*20),
                  vx: (Math.random()-0.5)*2, vy: -1,
                  life: 15, maxLife: 15, color: '#94a3b8', size: 3
              });
          }
      } 
      else if (e.type === EntityType.ENEMY_FLYER) {
          // Ghost: Evaporate (Scale Up, Drift Up)
          const scale = 1 + (1 - progress); 
          ctx.translate(centerX, centerY);
          ctx.scale(scale, scale);
          ctx.translate(-centerX, -centerY);
          
          drawGhostEnemy(ctx, e); // Draw the ghost
      }
      else if (e.type === EntityType.ENEMY_BOMB) {
          // Bomb Defused: Jitter and Shrink
          const shake = (Math.random() - 0.5) * 10;
          const scale = progress; 
          
          ctx.translate(centerX + shake, centerY);
          ctx.scale(scale, scale);
          ctx.translate(-centerX, -centerY);
          
          // Draw Bomb Body (Grey, broken)
          ctx.fillStyle = '#475569';
          ctx.beginPath();
          ctx.arc(centerX, centerY, 15, 0, Math.PI*2);
          ctx.fill();
          
          // Debris
          if (frameCount.current % 4 === 0) {
              particles.current.push({
                  id: Math.random().toString(),
                  x: centerX, y: centerY,
                  vx: (Math.random()-0.5)*5, vy: (Math.random()-0.5)*5,
                  life: 10, maxLife: 10, color: '#334155', size: 4
              });
          }
      }

      ctx.restore();
  };

  const drawShadowClaw = (ctx: CanvasRenderingContext2D, x: number, y: number, facing: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(facing, 1);
      
      // Spectral Claw Swipe Shape
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(20, -10);
      ctx.lineTo(30, 0);
      ctx.lineTo(25, 10);
      ctx.lineTo(0, 5);
      ctx.fill();

      // Sharp tips
      ctx.fillStyle = '#ef4444';
      ctx.shadowBlur = 5;
      ctx.shadowColor = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(30, 0); ctx.lineTo(40, -5); ctx.lineTo(32, -2); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(25, 10); ctx.lineTo(35, 15); ctx.lineTo(28, 12); ctx.fill();

      ctx.restore();
  };

  const drawGhostEnemy = (ctx: CanvasRenderingContext2D, e: Entity) => {
     // Pixel art ghost
     const bob = Math.sin(frameCount.current * 0.15) * 4;
     const baseX = e.x;
     const baseY = e.y + bob;
     
     ctx.save();
     
     // Flip if facing left
     if (e.facing === -1) {
         ctx.translate(baseX + e.w/2, baseY);
         ctx.scale(-1, 1);
         ctx.translate(-(baseX + e.w/2), -baseY);
     }
     
     // Hood/Body (Dark Grey)
     ctx.fillStyle = '#64748b';
     // Main cowl
     ctx.beginPath();
     ctx.arc(baseX + 20, baseY + 15, 18, Math.PI, 0); // Top dome
     ctx.lineTo(baseX + 38, baseY + 45); // Right side down
     
     // Tattered bottom
     for (let i = 0; i < 4; i++) {
        const tatLen = 5 + Math.random() * 5;
        ctx.lineTo(baseX + 38 - (i*10), baseY + 35 + tatLen);
        ctx.lineTo(baseX + 33 - (i*10), baseY + 35);
     }
     ctx.lineTo(baseX + 2, baseY + 45); // Left side bottom
     ctx.lineTo(baseX + 2, baseY + 15); // Left side up
     ctx.fill();

     // Skull Mask (Bone White)
     ctx.fillStyle = '#e2e8f0';
     ctx.fillRect(baseX + 12, baseY + 10, 20, 22);
     
     // Eyes (Red Glow) - Only if alive
     if (e.hp > 0) {
        ctx.fillStyle = '#ef4444';
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 10;
        ctx.fillRect(baseX + 16, baseY + 16, 4, 4); // Left eye
        ctx.fillRect(baseX + 24, baseY + 16, 4, 4); // Right eye
        ctx.shadowBlur = 0;
     } else {
        // Dead eyes (Black)
        ctx.fillStyle = '#000';
        ctx.fillRect(baseX + 16, baseY + 16, 4, 4);
        ctx.fillRect(baseX + 24, baseY + 16, 4, 4);
     }

     // Mouth/Nose slits
     ctx.fillStyle = '#1e293b';
     ctx.fillRect(baseX + 20, baseY + 24, 4, 4); // Nose
     // Teeth
     ctx.fillRect(baseX + 16, baseY + 30, 2, 4);
     ctx.fillRect(baseX + 20, baseY + 30, 2, 4);
     ctx.fillRect(baseX + 24, baseY + 30, 2, 4);

     // ATTACK ANIMATION: CLAW
     if (e.isAttacking) {
         drawShadowClaw(ctx, baseX + 35, baseY + 25, 1);
     }

     // Health Bar (Only if alive)
     if (e.hp > 0 && e.state !== 'DYING') {
         ctx.restore(); // Undo flip for HP bar
         ctx.fillStyle = '#1e293b';
         ctx.fillRect(e.x, e.y - 25, e.w, 4);
         ctx.fillStyle = '#ef4444';
         ctx.fillRect(e.x, e.y - 25, e.w * (e.hp / e.maxHp), 4);
     } else {
         ctx.restore();
     }
  };

  const drawSynergyLink = (ctx: CanvasRenderingContext2D, p1: Entity, p2: Entity) => {
     const cx1 = p1.x + p1.w/2;
     const cy1 = p1.y + p1.h/2;
     const cx2 = p2.x + p2.w/2;
     const cy2 = p2.y + p2.h/2;
     
     // Electric Beam
     ctx.save();
     ctx.beginPath();
     ctx.strokeStyle = '#fbbf24'; // Amber/Gold Electricity
     ctx.lineWidth = 4;
     ctx.shadowColor = '#fbbf24';
     ctx.shadowBlur = 15;
     
     // Jagged line
     ctx.moveTo(cx1, cy1);
     const segments = 10;
     const dx = (cx2 - cx1) / segments;
     const dy = (cy2 - cy1) / segments;
     
     for (let i = 1; i < segments; i++) {
        const jitterX = (Math.random() - 0.5) * 10;
        const jitterY = (Math.random() - 0.5) * 10;
        ctx.lineTo(cx1 + dx*i + jitterX, cy1 + dy*i + jitterY);
     }
     ctx.lineTo(cx2, cy2);
     ctx.stroke();
     ctx.restore();
     
     // Center icon
     ctx.fillStyle = '#fff';
     ctx.font = 'bold 20px monospace';
     ctx.fillText('⚡2x DMG⚡', (cx1+cx2)/2 - 50, (cy1+cy2)/2 - 20);
  };

  const drawHoodedCharacter = (ctx: CanvasRenderingContext2D, e: Entity) => {
    const pixelScale = 1;
    const centerX = e.x + e.w / 2;
    const bottomY = e.y + e.h;
    
    const isMoving = Math.abs(e.vx) > 0.5;
    
    // SMOOTH ANIMATION: Use continuous sine waves instead of discrete frames
    // Bob speed: faster when moving
    const bobSpeed = isMoving ? 0.4 : 0.15;
    const bobAmp = isMoving ? 3 : 2;
    const bobY = Math.sin(frameCount.current * bobSpeed) * bobAmp;

    ctx.save();
    
    // Facing Flip
    if (e.facing === -1) {
       ctx.translate(centerX, e.y);
       ctx.scale(-1, 1);
       ctx.translate(-centerX, -e.y);
    }

    const baseX = e.x;
    const baseY = e.y + bobY;

    // -- SHADOW --
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(centerX, bottomY, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // -- ROBE / BODY (Uses Player Color) --
    ctx.fillStyle = e.color;
    // Hood Top
    ctx.fillRect(baseX + 6, baseY + 2, 28, 14); 
    // Hood Point (Left side since facing right)
    ctx.fillRect(baseX + 2, baseY + 6, 4, 8);
    // Main Robe Body
    ctx.fillRect(baseX + 8, baseY + 16, 24, 20);
    // Bottom Robe Flare
    ctx.fillRect(baseX + 4, baseY + 30, 32, 10);
    
    // -- FACE VOID (Black) --
    ctx.fillStyle = '#000';
    // The "Face" is an oval shape on the right side of the hood
    ctx.fillRect(baseX + 20, baseY + 6, 10, 12); 

    // -- EYES (Glowing White) --
    ctx.fillStyle = '#fff';
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 8;
    
    // Simple Blink Logic
    const isBlinking = frameCount.current % 180 > 175;
    if (!isBlinking) {
       // Left Eye
       ctx.fillRect(baseX + 22, baseY + 9, 2, 3);
       // Right Eye
       ctx.fillRect(baseX + 27, baseY + 9, 2, 3);
    }
    ctx.shadowBlur = 0; // Reset glow

    // -- LEGS (Black Sticks) --
    // Smooth leg movement using continuous sine based on velocity
    ctx.fillStyle = '#000';
    if (isMoving) {
        const legSpeed = 0.3;
        const leftLegOffset = Math.sin(frameCount.current * legSpeed) * 5;
        const rightLegOffset = Math.sin(frameCount.current * legSpeed + Math.PI) * 5; // Opposite phase
        
        ctx.fillRect(centerX - 5 + leftLegOffset, bottomY - 6 + bobY * 0.5, 3, 6);
        ctx.fillRect(centerX + 2 + rightLegOffset, bottomY - 6 + bobY * 0.5, 3, 6);
    } else {
        // Idle legs
        ctx.fillRect(centerX - 5, bottomY - 6 + bobY * 0.5, 3, 6);
        ctx.fillRect(centerX + 2, bottomY - 6 + bobY * 0.5, 3, 6);
    }

    // -- ARMS (Hidden in sleeves, just hint of sleeve) --
    ctx.fillStyle = e.color;
    // Sleeve position moves slightly with walk
    const armSwing = isMoving ? Math.sin(frameCount.current * 0.3) * 2 : 0;
    ctx.fillRect(baseX + 18 + armSwing, baseY + 22, 6, 6);

    ctx.restore();
  };

  const drawEntity = (ctx: CanvasRenderingContext2D, e: Entity) => {
    ctx.shadowBlur = 0;
    
    // Check Death Animation
    if (e.state === 'DYING') {
        drawDyingEnemy(ctx, e);
        return;
    }

    // Flash white if hurt
    if ((e.hurtTimer || 0) > 0) {
      if (Math.floor(Date.now() / 50) % 2 === 0) {
         ctx.save();
         ctx.globalCompositeOperation = 'source-over';
         ctx.fillStyle = '#ffffff';
         ctx.fillRect(e.x, e.y, e.w, e.h);
         ctx.restore();
         return; // Skip normal draw if flashing white
      }
    }

    // -- PLAYERS (New Graphic) --
    if (e.type === EntityType.PLAYER_1 || e.type === EntityType.PLAYER_2) {
       drawHoodedCharacter(ctx, e);

       // Draw Equipment
       ctx.save();
       if (e.type === EntityType.PLAYER_1) {
          // SHIELD (Orbiting Hexagon)
          const shieldX = e.x + e.w/2 + (e.facing * 20);
          const shieldY = e.y + e.h/2;
          
          if (e.isParrying) {
             ctx.strokeStyle = '#60a5fa';
             ctx.lineWidth = 3;
             ctx.shadowColor = '#60a5fa';
             ctx.shadowBlur = 15;
             ctx.beginPath();
             // Draw Hexagon
             for(let i=0; i<6; i++) {
                 const angle = (Math.PI/3) * i + (frameCount.current * 0.1);
                 const r = 30;
                 ctx.lineTo(shieldX + Math.cos(angle)*r, shieldY + Math.sin(angle)*r);
             }
             ctx.closePath();
             ctx.stroke();
             ctx.fillStyle = 'rgba(96, 165, 250, 0.3)';
             ctx.fill();
          } else {
             // Passive Shield
             ctx.fillStyle = '#1e3a8a';
             ctx.strokeStyle = '#60a5fa';
             ctx.lineWidth = 2;
             ctx.beginPath();
             ctx.arc(shieldX, shieldY + Math.sin(frameCount.current * 0.1)*5, 12, 0, Math.PI*2);
             ctx.fill();
             ctx.stroke();
          }
       } else {
          // SWORD
          const swordX = e.x + e.w/2 + (e.facing * 15);
          const swordY = e.y + e.h/2 + 5;
          
          if (e.isAttacking) {
             ctx.save();
             ctx.translate(swordX, swordY);
             ctx.scale(e.facing, 1); // Flip based on facing
             
             // Easing function for swing "Snap"
             // t goes from 0 to 1
             const t = 1 - (e.stateTimer! / C.ATTACK_DURATION);
             // BackOut Easing: Overshoots slightly then settles
             const easeOutBack = (x: number): number => {
                const c1 = 1.70158;
                const c3 = c1 + 1;
                return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
             };
             
             const progress = easeOutBack(t);
             const startAngle = -Math.PI / 3; // -60 deg
             const endAngle = Math.PI * 0.8;  // 144 deg
             const currentRotation = startAngle + (progress * (endAngle - startAngle));
             
             // Dynamic Swoosh Effect (Fade out at end)
             const alpha = 1 - Math.pow(t, 4); 
             if (t > 0.1) {
                 ctx.save();
                 ctx.rotate(currentRotation - 0.5); // Trail slightly behind blade
                 ctx.beginPath();
                 ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.6})`;
                 ctx.moveTo(0, 0);
                 ctx.arc(0, 0, 70, -0.2, 0.5, false); // Crescent shape
                 ctx.fill();
                 ctx.restore();
             }

             // Rotate Sword
             ctx.rotate(currentRotation);
             
             // Better Blade Graphic
             // Blade
             const grad = ctx.createLinearGradient(0, -50, 10, -50);
             grad.addColorStop(0, '#e2e8f0');
             grad.addColorStop(0.5, '#cbd5e1'); // Central ridge
             grad.addColorStop(1, '#94a3b8');
             
             ctx.fillStyle = grad;
             ctx.beginPath();
             ctx.moveTo(-2, 0);
             ctx.lineTo(-3, -55); // Tip left
             ctx.lineTo(0, -65);  // Point
             ctx.lineTo(3, -55);  // Tip right
             ctx.lineTo(2, 0);
             ctx.fill();

             // Crossguard
             ctx.fillStyle = '#1e293b'; // Dark Iron
             ctx.fillRect(-10, -5, 20, 6);
             // Grip
             ctx.fillStyle = '#475569'; 
             ctx.fillRect(-3, 0, 6, 12);
             // Pommel
             ctx.fillStyle = '#cbd5e1';
             ctx.beginPath();
             ctx.arc(0, 14, 4, 0, Math.PI*2);
             ctx.fill();
             
             ctx.restore();
          } else {
             // Idle Sword
             ctx.save();
             ctx.translate(swordX, swordY);
             // Breathing rotation
             ctx.rotate((e.facing === 1 ? -0.5 : 0.5) + Math.sin(frameCount.current * 0.05) * 0.05);
             
             ctx.fillStyle = '#94a3b8';
             ctx.fillRect(-2, -30, 4, 30); // Blade vertical
             ctx.fillStyle = '#1e293b';
             ctx.fillRect(-8, 0, 16, 4); // Guard
             ctx.fillStyle = '#475569';
             ctx.fillRect(-2, 4, 4, 8); // Grip
             ctx.restore();
          }
       }
       ctx.restore();
       return; 
    }

    // -- BOSS --
    if (e.type === EntityType.BOSS) {
       ctx.shadowBlur = 30;
       ctx.shadowColor = e.color;
       ctx.fillStyle = e.color;
       ctx.fillRect(e.x, e.y, e.w, e.h);
       
       // Face
       ctx.fillStyle = '#000';
       // Eyes
       ctx.fillStyle = '#fca5a5';
       ctx.shadowColor = '#f00';
       ctx.fillRect(e.x + 40, e.y + 50, 30, 30); // Left Eye
       ctx.fillRect(e.x + e.w - 70, e.y + 50, 30, 30); // Right Eye
       
       // Mouth
       ctx.fillStyle = '#450a0a';
       const mouthOpen = Math.sin(frameCount.current * 0.1) * 20;
       ctx.fillRect(e.x + 50, e.y + 120, e.w - 100, 20 + mouthOpen);
       
       return;
    }

    // -- ENEMIES (Mummy, Flyer, Bomb) --
    if (e.type === EntityType.ENEMY_NORMAL) {
       // Mummy Style
       const walkCycle = Math.sin(frameCount.current * 0.2);
       
       // Body (Bandages)
       ctx.fillStyle = '#94a3b8'; // Light Grey Bandages
       ctx.fillRect(e.x + 5, e.y, 30, 40);
       
       // Stripes (Detail)
       ctx.fillStyle = '#475569';
       for(let i=5; i<35; i+=6) {
           ctx.fillRect(e.x + 5, e.y + i, 30, 2);
       }

       // Head
       ctx.fillStyle = '#cbd5e1';
       ctx.fillRect(e.x + 2, e.y - 10, 36, 25);
       
       // Eyes (Red)
       ctx.fillStyle = '#ef4444';
       ctx.shadowColor = '#ef4444';
       ctx.shadowBlur = 10;
       const eyeDir = e.facing === 1 ? 4 : -4;
       ctx.fillRect(e.x + 18 + eyeDir - 6, e.y - 2, 6, 4);
       ctx.fillRect(e.x + 18 + eyeDir + 2, e.y - 2, 6, 4);
       ctx.shadowBlur = 0;

       // Arms (Zombie pose + Attack Animation)
       ctx.fillStyle = '#94a3b8';
       let armY = e.y + 15 + (walkCycle * 2);
       
       ctx.save();
       // Pivot at shoulder
       const shoulderX = e.facing === 1 ? e.x + 25 : e.x + 15;
       const shoulderY = e.y + 15;
       ctx.translate(shoulderX, shoulderY);

       if (e.isAttacking) {
           // Attack Swipe
           const attackAngle = Math.sin(frameCount.current * 0.5) * 1.5; // Fast swing
           ctx.rotate(attackAngle * e.facing);
       }

       ctx.translate(-shoulderX, -shoulderY);
       
       if (e.facing === 1) {
          ctx.fillRect(e.x + 25, armY, 20, 8);
       } else {
          ctx.fillRect(e.x - 5, armY, 20, 8);
       }
       ctx.restore();

       // Health Bar
       ctx.fillStyle = '#1e293b';
       ctx.fillRect(e.x, e.y - 20, e.w, 6);
       ctx.fillStyle = '#ef4444';
       ctx.fillRect(e.x, e.y - 20, e.w * (e.hp / e.maxHp), 6);
       return;
    }

    if (e.type === EntityType.ENEMY_FLYER) {
       drawGhostEnemy(ctx, e);
       return;
    }

    if (e.type === EntityType.ENEMY_BOMB) {
       const cx = e.x + e.w/2;
       const cy = e.y + e.h/2;
       const bottom = e.y + e.h;
       
       // Warn if Exploding
       if (e.state === 'EXPLODING') {
           if (Math.floor(frameCount.current / 4) % 2 === 0) {
                ctx.strokeStyle = '#ef4444';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(cx, cy, 25, 0, Math.PI*2);
                ctx.stroke();
           }
       }

       // Walking Animation for Feet
       const walk = Math.abs(e.vx) > 0.1 ? Math.sin(frameCount.current * 0.5) * 6 : 0;
       
       // Draw Feet (Yellow/Orange)
       ctx.fillStyle = '#f59e0b'; // Amber
       // Left Foot
       ctx.fillRect(cx - 14 - (walk), bottom - 8, 12, 8);
       // Right Foot
       ctx.fillRect(cx + 2 + (walk), bottom - 8, 12, 8);

       // Bomb Body (Black circle-ish)
       ctx.fillStyle = '#1e293b'; // Dark Slate
       ctx.beginPath();
       ctx.arc(cx, cy, 18, 0, Math.PI*2);
       ctx.fill();

       // Highlight (Blueish top-left)
       ctx.fillStyle = '#334155';
       ctx.beginPath();
       ctx.arc(cx - 6, cy - 6, 12, 0, Math.PI*2);
       ctx.fill();

       // Metal Cap
       ctx.fillStyle = '#94a3b8';
       ctx.fillRect(cx - 8, cy - 22, 16, 6);

       // Fuse
       ctx.strokeStyle = '#020617';
       ctx.lineWidth = 2;
       ctx.beginPath();
       ctx.moveTo(cx, cy - 22);
       ctx.quadraticCurveTo(cx + 4, cy - 30, cx + 10, cy - 28);
       ctx.stroke();

       // Spark / Flame
       const frame = Math.floor(frameCount.current / 4) % 2;
       ctx.fillStyle = frame === 0 ? '#ef4444' : '#fbbf24'; // Red / Yellow swap
       // Pixel flame shape
       ctx.beginPath();
       ctx.moveTo(cx + 10, cy - 28);
       ctx.lineTo(cx + 14, cy - 35);
       ctx.lineTo(cx + 18, cy - 28);
       ctx.lineTo(cx + 14, cy - 24);
       ctx.fill();

       // Eyes (White vertical ovals)
       ctx.fillStyle = '#f8fafc';
       ctx.fillRect(cx - 8, cy - 4, 6, 10);
       ctx.fillRect(cx + 2, cy - 4, 6, 10);

       // Pupils (Light Blue tint)
       ctx.fillStyle = '#3b82f6';
       ctx.globalAlpha = 0.3;
       ctx.fillRect(cx - 8, cy - 4, 6, 10);
       ctx.fillRect(cx + 2, cy - 4, 6, 10);
       ctx.globalAlpha = 1.0;

       return;
    }

    if (e.type === EntityType.PLATFORM) {
        // Tech Platform Look
        ctx.fillStyle = '#1e293b'; // Base Dark Slate
        ctx.fillRect(e.x, e.y, e.w, e.h);
        
        // Top Highlight (Surface)
        ctx.fillStyle = '#334155';
        ctx.fillRect(e.x, e.y, e.w, 6);

        // Pattern (Tech Bricks)
        ctx.fillStyle = '#0f172a';
        for(let px = e.x; px < e.x + e.w; px += 40) {
            ctx.fillRect(px, e.y + 10, 2, e.h - 15);
            ctx.fillRect(px + 20, e.y + 20, 10, 4);
        }
        return;
    }

    if (e.type === EntityType.SPIKE) {
       // Metallic Spikes
       const spikesCount = Math.floor(e.w / 20);
       for(let i=0; i<spikesCount; i++) {
           const sx = e.x + (i * 20);
           const sy = e.y + e.h; // Bottom
           
           // Gradient fill for 3D look
           const gradient = ctx.createLinearGradient(sx, sy - 30, sx + 20, sy);
           gradient.addColorStop(0, '#ef4444'); // Red Tip
           gradient.addColorStop(0.3, '#991b1b'); // Dark Red
           gradient.addColorStop(1, '#450a0a'); // Dark Base
           
           ctx.fillStyle = gradient;
           ctx.beginPath();
           ctx.moveTo(sx, sy);
           ctx.lineTo(sx + 10, sy - 30); // Tip
           ctx.lineTo(sx + 20, sy);
           ctx.closePath();
           ctx.fill();
       }
       return;
    }

    // Default Fallback
    ctx.fillStyle = e.color;
    ctx.fillRect(e.x, e.y, e.w, e.h);
    ctx.restore();
  };

  const drawParticles = (ctx: CanvasRenderingContext2D) => {
    particles.current.forEach(p => {
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.fillStyle = p.color;
      
      // Add Glow
      ctx.shadowBlur = 10;
      ctx.shadowColor = p.color;
      
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1.0;
    });
  };

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Shake transform
    const shakeX = (Math.random() - 0.5) * screenShake.current;
    const shakeY = (Math.random() - 0.5) * screenShake.current;

    ctx.save();
    ctx.translate(shakeX, shakeY);

    // Clear Canvas
    ctx.fillStyle = C.COLORS.BACKGROUND;
    ctx.fillRect(-shakeX, -shakeY, C.CANVAS_WIDTH, C.CANVAS_HEIGHT);
    
    // ---------------------------------
    // BACKGROUND - SYNTHWAVE / CYBERPUNK
    // ---------------------------------
    
    // 1. Horizon Line
    const horizonY = C.CANVAS_HEIGHT * 0.7;
    
    // 2. Retro Sun
    const sunGrad = ctx.createLinearGradient(0, horizonY - 400, 0, horizonY);
    sunGrad.addColorStop(0, '#facc15'); // Yellow Top
    sunGrad.addColorStop(0.5, '#f43f5e'); // Pink Mid
    sunGrad.addColorStop(1, '#a855f7'); // Purple Bottom
    
    const sunX = C.CANVAS_WIDTH / 2;
    const sunY = horizonY - 50;
    const sunRadius = 300;
    
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // Sun Blinds (Horizontal Lines cutting the sun)
    ctx.fillStyle = C.COLORS.BACKGROUND;
    for (let i = 0; i < 10; i++) {
        const h = 5 + (i * 3);
        const y = sunY + 50 + (i * 20);
        ctx.fillRect(sunX - sunRadius, y, sunRadius * 2, h);
    }
    ctx.restore();

    // 3. Parallax Mountains
    const drawMountains = (speed: number, color: string, heightMult: number, offset: number) => {
       const scroll = frameCount.current * speed;
       ctx.fillStyle = color;
       ctx.beginPath();
       ctx.moveTo(0, C.CANVAS_HEIGHT);
       for (let x = 0; x <= C.CANVAS_WIDTH; x += 100) {
           const noise = Math.sin((x + scroll + offset) * 0.005) * 100 + Math.sin((x + scroll) * 0.02) * 50;
           ctx.lineTo(x, horizonY - Math.abs(noise) * heightMult);
       }
       ctx.lineTo(C.CANVAS_WIDTH, C.CANVAS_HEIGHT);
       ctx.fill();
    };

    drawMountains(0.5, '#312e81', 1.5, 0); // Back (Indigo)
    drawMountains(1.2, '#1e1b4b', 0.8, 500); // Front (Darker Indigo)

    // 4. Perspective Grid (Moving Floor)
    ctx.save();
    const gridSpeed = (frameCount.current * 4) % 100;
    
    // Vertical Lines (Perspective)
    ctx.strokeStyle = '#c026d3'; // Fuchsia
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.5;
    ctx.shadowColor = '#d946ef';
    ctx.shadowBlur = 10;
    
    ctx.beginPath();
    // Vanishing Point is center horizon
    const vpX = C.CANVAS_WIDTH / 2;
    const vpY = horizonY;
    
    for (let i = -20; i <= 40; i++) {
       // X position at bottom of screen
       const xBot = (i * 200); 
       ctx.moveTo(vpX, vpY);
       ctx.lineTo(xBot, C.CANVAS_HEIGHT);
    }
    ctx.stroke();

    // Horizontal Lines (Moving forward)
    ctx.strokeStyle = '#ec4899'; // Pink
    ctx.beginPath();
    // Draw logarithmic horizontal lines for depth perception
    for (let i = 0; i < 20; i++) {
        // As i increases, lines get closer to horizon
        const yOffset = Math.pow(i, 2.5) + gridSpeed; 
        const y = C.CANVAS_HEIGHT - yOffset;
        if (y > horizonY) {
            ctx.moveTo(0, y);
            ctx.lineTo(C.CANVAS_WIDTH, y);
        }
    }
    ctx.stroke();
    
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1.0;
    ctx.restore();

    // 5. Stars
    ctx.fillStyle = '#fff';
    for(let i=0; i<50; i++) {
        const starX = (i * 137 + frameCount.current * 0.2) % C.CANVAS_WIDTH;
        const starY = (i * 67) % (horizonY);
        const size = (i % 3) + 1;
        ctx.fillRect(starX, starY, size, size);
    }

    // ---------------------------------
    // END BACKGROUND
    // ---------------------------------

    // Draw Synergy Link
    const p1 = entities.current.find(e => e.type === EntityType.PLAYER_1);
    const p2 = entities.current.find(e => e.type === EntityType.PLAYER_2);
    if (p1 && p2) {
         const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
         if (dist < C.COOP_LINK_DISTANCE) {
             drawSynergyLink(ctx, p1, p2);
         }
    }

    // Draw Entities
    entities.current.forEach(e => drawEntity(ctx, e));
    
    // Draw Particles
    drawParticles(ctx);

    ctx.restore(); // Undo Shake

  }, []);

  const gameLoop = useCallback(() => {
    if (gameState === GameState.PLAYING) {
      update();
      render();
      requestRef.current = requestAnimationFrame(gameLoop);
    }
  }, [gameState, update, render]);

  useEffect(() => {
    if (gameState === GameState.PLAYING) {
      // ALWAYS reset game when entering playing state (fixes restart bug)
      initGame();
      requestRef.current = requestAnimationFrame(gameLoop);
    } else {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [gameState, gameLoop, initGame]);

  // Input Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keys.current.add(e.key.toLowerCase());
      
      // Single Press Jump Logic
      if (e.key.toLowerCase() === 'w') {
        if (!keys.current.has('w_held')) {
           p1JumpReq.current = true;
           keys.current.add('w_held');
        }
      }
      if (e.key === 'ArrowUp') {
        if (!keys.current.has('arrowup_held')) {
           p2JumpReq.current = true;
           keys.current.add('arrowup_held');
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keys.current.delete(e.key.toLowerCase());
      if (e.key.toLowerCase() === 'w') keys.current.delete('w_held');
      if (e.key === 'ArrowUp') keys.current.delete('arrowup_held');
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={C.CANVAS_WIDTH}
      height={C.CANVAS_HEIGHT}
      className="w-full h-full object-contain bg-slate-950 shadow-2xl"
    />
  );
};

export default GameLoop;