/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Settings, Mail, Battery, Wifi, MessageSquare, Users, Crosshair, User, Beaker } from 'lucide-react';
import { ref, set, onValue, get } from 'firebase/database';
import { db } from './firebase';

// --- Game Constants & Types ---
const MAP_WIDTH = 3000;
const MAP_HEIGHT = 3000;

type WeaponType = 'assault' | 'sniper' | 'shotgun' | 'smg' | 'pistol';

interface Weapon {
  name: string;
  damage: number;
  fireRate: number;
  range: number;
  ammo: number;
  maxAmmo: number;
  type: WeaponType;
}

const WEAPONS: Record<string, Weapon> = {
  m4a1: { name: "🔫 M4A1", damage: 22, fireRate: 120, range: 400, ammo: 30, maxAmmo: 90, type: "assault" },
  sniper: { name: "🎯 AWM", damage: 85, fireRate: 800, range: 800, ammo: 5, maxAmmo: 25, type: "sniper" },
  shotgun: { name: "🔫 M1014", damage: 95, fireRate: 900, range: 150, ammo: 8, maxAmmo: 32, type: "shotgun" },
  smg: { name: "🔫 UMP", damage: 18, fireRate: 90, range: 250, ammo: 35, maxAmmo: 140, type: "smg" },
  pistol: { name: "🔫 Glock", damage: 15, fireRate: 200, range: 200, ammo: 15, maxAmmo: 60, type: "pistol" }
};

const BUILDINGS = [
  { x: 500, y: 500, w: 300, h: 200 },
  { x: 1200, y: 800, w: 250, h: 250 },
  { x: 2000, y: 600, w: 400, h: 150 },
  { x: 800, y: 1500, w: 200, h: 300 },
  { x: 1600, y: 1800, w: 350, h: 250 },
  { x: 2200, y: 2200, w: 300, h: 300 },
  { x: 400, y: 2400, w: 250, h: 200 },
  { x: 1400, y: 1200, w: 150, h: 150 },
  { x: 2600, y: 400, w: 200, h: 200 },
  { x: 300, y: 1000, w: 150, h: 150 },
];

const ROADS = [
  { x: 0, y: 1450, w: 3000, h: 100 }, // Horizontal main road
  { x: 1450, y: 0, w: 100, h: 3000 }, // Vertical main road
];

const TREES = [
  { x: 300, y: 300 }, { x: 700, y: 400 }, { x: 1000, y: 200 },
  { x: 1800, y: 300 }, { x: 2500, y: 800 }, { x: 2800, y: 1200 },
  { x: 200, y: 1800 }, { x: 600, y: 2200 }, { x: 1000, y: 2600 },
  { x: 1800, y: 2500 }, { x: 2400, y: 2800 }, { x: 2800, y: 2200 },
];

interface Player {
  id: string;
  name: string;
  x: number;
  y: number;
  hp: number;
  armor: number;
  angle: number;
  isAlive: boolean;
  kills: number;
  character: string;
  skillReady: boolean;
  isCrouching: boolean;
  isProne: boolean;
  weapon: string;
  ammo: number;
  speedBuff?: number;
  shield?: number;
}

interface Enemy {
  id: string;
  name: string;
  x: number;
  y: number;
  hp: number;
  armor: number;
  angle: number;
  kills: number;
  weapon: string;
  lastShoot: number;
  moveDir: { x: number; y: number };
}

interface Bullet {
  id: string;
  x: number;
  y: number;
  dx: number;
  dy: number;
  ownerId: string;
  damage: number;
  range?: number;
}

interface GameState {
  isInGame: boolean;
  camera: { x: number; y: number };
  localPlayer: Player | null;
  enemies: Enemy[];
  bullets: Bullet[];
  vehicles: any[];
  airdrops: any[];
  lootItems: any[];
  safeZone: { x: number; y: number; radius: number; shrinkTimer: number; nextRadius: number };
  zoneDamage: number;
  keys: Record<string, boolean>;
  mouse: { x: number; y: number };
  lastShoot: number;
  lastSkillUse: number;
  rankPoints: number;
  booyahDisplay: boolean;
  gameOverDisplay: boolean;
}

export default function App() {
  // --- UI State ---
  const [screen, setScreen] = useState<'login' | 'lobby' | 'matchmaking' | 'drop_selection' | 'game'>('login');
  const [playerName, setPlayerName] = useState('');
  const [mode, setMode] = useState('solo');
  const [character, setCharacter] = useState('kelly');
  const [matchTimer, setMatchTimer] = useState(30);
  const [dropPoint, setDropPoint] = useState({ x: 1500, y: 1500 });
  const [playerData, setPlayerData] = useState({ gold: 0, diamonds: 0, level: 1 });
  const [dropTimer, setDropTimer] = useState(10);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  
  // HUD State (Synced from GameState periodically to avoid massive re-renders)
  const [hud, setHud] = useState({
    hp: 200,
    armor: 0,
    alive: 0,
    zoneTimer: 60,
    zoneRadius: 800,
    weaponName: WEAPONS.m4a1.name,
    ammo: 90,
    maxAmmo: WEAPONS.m4a1.maxAmmo,
    rank: 'Bronze I',
    messages: [] as { id: number; text: string }[],
    booyah: false,
    gameOver: false,
    place: 0,
  });

  // --- Refs ---
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(null);
  const lastTimeRef = useRef<number>(0);
  const zoneIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const airdropIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hudUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Core Game State (Mutable to avoid React render cycle overhead in 60FPS loop)
  const state = useRef<GameState>({
    isInGame: false,
    camera: { x: 0, y: 0 },
    localPlayer: null,
    enemies: [],
    bullets: [],
    vehicles: [],
    airdrops: [],
    lootItems: [],
    safeZone: { x: 1500, y: 1500, radius: 800, shrinkTimer: 60, nextRadius: 600 },
    zoneDamage: 5,
    keys: { w: false, s: false, a: false, d: false, space: false, shift: false },
    mouse: { x: 0, y: 0 },
    lastShoot: 0,
    lastSkillUse: 0,
    rankPoints: 1000,
    booyahDisplay: false,
    gameOverDisplay: false,
  });

  // --- Game Logic ---

  const getRankName = (points: number) => {
    if (points >= 1200) return "Silver III";
    if (points >= 1100) return "Silver II";
    if (points >= 1050) return "Silver I";
    if (points >= 1000) return "Bronze III";
    return "Bronze II";
  };

  const addMessage = (text: string) => {
    const id = Date.now();
    setHud(prev => ({ ...prev, messages: [...prev.messages, { id, text }] }));
    setTimeout(() => {
      setHud(prev => ({ ...prev, messages: prev.messages.filter(m => m.id !== id) }));
    }, 2000);
  };

  const goToLobby = async () => {
    if (!playerName.trim()) {
      alert("দয়া করে আপনার নাম দিন!");
      return;
    }
    
    // Firebase Integration: Save/Load player data
    const playerRef = ref(db, 'users/' + playerName);
    try {
      const snapshot = await get(playerRef);
      if (snapshot.exists()) {
        setPlayerData(snapshot.val());
      } else {
        const newData = { gold: 0, diamonds: 0, level: 1 };
        await set(playerRef, newData);
        setPlayerData(newData);
      }
    } catch (error) {
      console.error("Firebase error:", error);
    }

    setScreen('lobby');
  };

  const startMatchmaking = () => {
    setScreen('matchmaking');
    setMatchTimer(30);
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (screen === 'matchmaking') {
      interval = setInterval(() => {
        setMatchTimer(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            setScreen('drop_selection');
            setDropTimer(10);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (screen === 'drop_selection') {
      interval = setInterval(() => {
        setDropTimer(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            startGame();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [screen]);

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (MAP_WIDTH / rect.width);
    const y = (e.clientY - rect.top) * (MAP_HEIGHT / rect.height);
    setDropPoint({ x, y });
  };

  const startGame = () => {
    setScreen('game');
    
    // Initialize Player
    state.current.localPlayer = {
      id: "player",
      name: playerName,
      x: dropPoint.x,
      y: dropPoint.y,
      hp: 200,
      armor: 0,
      angle: 0,
      isAlive: true,
      kills: 0,
      character: character,
      skillReady: true,
      isCrouching: false,
      isProne: false,
      weapon: "m4a1",
      ammo: 90
    };

    state.current.isInGame = true;
    state.current.booyahDisplay = false;
    state.current.gameOverDisplay = false;
    state.current.safeZone = { x: 1500, y: 1500, radius: 800, shrinkTimer: 60, nextRadius: 600 };
    state.current.zoneDamage = 5;

    // Generate Enemies
    const enemyCount = mode === "solo" ? 9 : (mode === "duo" ? 8 : 7);
    const botNames = ["Ranger", "Scout", "Sniper", "Medic", "Heavy", "Assault", "Recon", "Warrior", "Phantom"];
    state.current.enemies = Array.from({ length: enemyCount }).map((_, i) => ({
      id: `bot_${i}`,
      name: botNames[i % botNames.length],
      x: Math.random() * MAP_WIDTH,
      y: Math.random() * MAP_HEIGHT,
      hp: 200,
      armor: Math.random() * 50,
      angle: Math.random() * Math.PI * 2,
      kills: 0,
      weapon: Object.keys(WEAPONS)[Math.floor(Math.random() * 5)],
      lastShoot: 0,
      moveDir: { x: 0, y: 0 }
    }));

    // Generate Vehicles & Loot
    state.current.vehicles = [
      { x: 500, y: 500, type: "car", speed: 12, active: true },
      { x: 2000, y: 800, type: "bike", speed: 15, active: true },
      { x: 800, y: 2200, type: "car", speed: 12, active: true },
      { x: 2500, y: 2000, type: "bike", speed: 15, active: true },
    ];

    state.current.lootItems = [];
    for (let i = 0; i < 50; i++) {
      state.current.lootItems.push({
        x: Math.random() * MAP_WIDTH,
        y: Math.random() * MAP_HEIGHT,
        type: Object.keys(WEAPONS)[Math.floor(Math.random() * 5)],
        itemType: "weapon"
      });
    }
    for (let i = 0; i < 30; i++) {
      state.current.lootItems.push({
        x: Math.random() * MAP_WIDTH,
        y: Math.random() * MAP_HEIGHT,
        type: Math.random() > 0.5 ? "medkit" : "armor",
        itemType: "consumable"
      });
    }

    state.current.bullets = [];
    state.current.airdrops = [];

    // Start Timers
    if (zoneIntervalRef.current) clearInterval(zoneIntervalRef.current);
    zoneIntervalRef.current = setInterval(() => {
      if (!state.current.isInGame || !state.current.localPlayer?.isAlive) return;
      
      state.current.safeZone.shrinkTimer--;
      
      if (state.current.safeZone.shrinkTimer <= 0) {
        state.current.safeZone.radius = Math.max(100, state.current.safeZone.radius - 80);
        state.current.safeZone.shrinkTimer = 45;
        state.current.zoneDamage += 1;
      }

      // Zone Damage
      const p = state.current.localPlayer;
      const distToZone = Math.hypot(p.x - state.current.safeZone.x, p.y - state.current.safeZone.y);
      if (distToZone > state.current.safeZone.radius && p.isAlive) {
        p.hp = Math.max(0, p.hp - state.current.zoneDamage);
        if (p.hp <= 0) {
          p.isAlive = false;
          triggerGameOver();
        }
      }
    }, 1000);

    if (airdropIntervalRef.current) clearInterval(airdropIntervalRef.current);
    airdropIntervalRef.current = setInterval(() => {
      if (state.current.isInGame && state.current.localPlayer?.isAlive) {
        state.current.airdrops.push({
          x: 500 + Math.random() * (MAP_WIDTH - 1000),
          y: 500 + Math.random() * (MAP_HEIGHT - 1000),
          loot: Object.keys(WEAPONS)[Math.floor(Math.random() * 5)],
          active: true,
          fallTime: 30
        });
      }
    }, 45000);

    // Sync HUD periodically
    if (hudUpdateIntervalRef.current) clearInterval(hudUpdateIntervalRef.current);
    hudUpdateIntervalRef.current = setInterval(() => {
      const p = state.current.localPlayer;
      if (p) {
        setHud(prev => ({
          ...prev,
          hp: Math.floor(p.hp),
          armor: Math.floor(p.armor),
          alive: state.current.enemies.filter(e => e.hp > 0).length + (p.isAlive ? 1 : 0),
          zoneTimer: state.current.safeZone.shrinkTimer,
          zoneRadius: Math.floor(state.current.safeZone.radius),
          weaponName: WEAPONS[p.weapon]?.name || '',
          ammo: p.ammo,
          maxAmmo: WEAPONS[p.weapon]?.maxAmmo || 0,
          rank: getRankName(state.current.rankPoints),
        }));
      }
    }, 100);

    // Start Loop
    lastTimeRef.current = performance.now();
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    requestRef.current = requestAnimationFrame(gameLoop);
  };

  const triggerGameOver = () => {
    state.current.gameOverDisplay = true;
    setHud(prev => ({ ...prev, gameOver: true, place: state.current.enemies.length + 1 }));
    setTimeout(() => {
      setScreen('lobby');
      state.current.isInGame = false;
      setHud(prev => ({ ...prev, gameOver: false }));
    }, 4000);
  };

  const triggerBooyah = () => {
    state.current.booyahDisplay = true;
    state.current.rankPoints += 50;
    setHud(prev => ({ ...prev, booyah: true }));
    setTimeout(() => {
      setScreen('lobby');
      state.current.isInGame = false;
      setHud(prev => ({ ...prev, booyah: false }));
    }, 4000);
  };

  // --- Actions ---
  const handleJump = () => {
    const p = state.current.localPlayer;
    if (p && p.isAlive) {
      p.isCrouching = false;
      p.isProne = false;
    }
  };

  const handleCrouch = () => {
    const p = state.current.localPlayer;
    if (p && p.isAlive) {
      p.isCrouching = !p.isCrouching;
      if (p.isCrouching) p.isProne = false;
    }
  };

  const handleMedkit = () => {
    const p = state.current.localPlayer;
    if (p && p.isAlive && p.hp < 200 && p.hp > 0) {
      p.hp = Math.min(200, p.hp + 40);
    }
  };

  const handleQuickChat = () => {
    const p = state.current.localPlayer;
    if (p && p.isAlive) {
      const chats = ["🔥 Attack!", "📦 Need loot!", "⚠️ Enemy spotted!", "🏃 Let's go!", "🎯 I got this!"];
      const chat = chats[Math.floor(Math.random() * chats.length)];
      addMessage(`💬 ${p.name}: ${chat}`);
    }
  };

  const useCharacterSkill = () => {
    const p = state.current.localPlayer;
    if (!p || !p.isAlive) return;
    
    const now = Date.now();
    if (now - state.current.lastSkillUse < 30000) return;
    state.current.lastSkillUse = now;

    switch(p.character) {
      case "kelly":
        p.speedBuff = 1.5;
        setTimeout(() => { if (state.current.localPlayer) delete state.current.localPlayer.speedBuff; }, 5000);
        break;
      case "nairi":
        p.armor += 20;
        break;
      case "alok":
        p.hp = Math.min(200, p.hp + 30);
        break;
      case "chrono":
        p.shield = 50;
        setTimeout(() => { if (state.current.localPlayer) delete state.current.localPlayer.shield; }, 8000);
        break;
    }
  };

  const shootBullet = () => {
    const p = state.current.localPlayer;
    if (!p || !p.isAlive) return;

    const now = Date.now();
    const weapon = WEAPONS[p.weapon];
    if (now - state.current.lastShoot < weapon.fireRate) return;
    if (p.ammo <= 0) return;

    state.current.lastShoot = now;
    p.ammo--;

    // Auto aim assist
    let aimAngle = p.angle;
    let closestEnemy = null;
    let closestDist = 300;

    for (let enemy of state.current.enemies) {
      if (enemy.hp <= 0) continue;
      const dist = Math.hypot(enemy.x - p.x, enemy.y - p.y);
      const angleDiff = Math.abs(aimAngle - Math.atan2(enemy.y - p.y, enemy.x - p.x));
      if (dist < closestDist && angleDiff < 0.3) {
        closestDist = dist;
        closestEnemy = enemy;
      }
    }

    if (closestEnemy) {
      aimAngle = Math.atan2(closestEnemy.y - p.y, closestEnemy.x - p.x);
    }

    state.current.bullets.push({
      id: Date.now() + "_" + Math.random(),
      x: p.x + Math.cos(aimAngle) * 35,
      y: p.y + Math.sin(aimAngle) * 35,
      dx: Math.cos(aimAngle) * 14,
      dy: Math.sin(aimAngle) * 14,
      ownerId: "player",
      damage: weapon.damage,
      range: weapon.range
    });
  };

  // --- Game Loop Systems ---
  const updateLocalMovement = () => {
    const p = state.current.localPlayer;
    if (!p || !p.isAlive) return;

    let speed = p.isCrouching ? 2.5 : (p.isProne ? 1.5 : 5);
    if (p.speedBuff) speed *= p.speedBuff;

    let moveX = 0, moveY = 0;
    
    if (state.current.keys.w) moveY -= 1;
    if (state.current.keys.s) moveY += 1;
    if (state.current.keys.a) moveX -= 1;
    if (state.current.keys.d) moveX += 1;

    if (moveX !== 0 || moveY !== 0) {
      const len = Math.hypot(moveX, moveY);
      moveX /= len;
      moveY /= len;
    }

    p.x += moveX * speed;
    p.y += moveY * speed;
    p.x = Math.min(Math.max(p.x, 50), MAP_WIDTH - 50);
    p.y = Math.min(Math.max(p.y, 50), MAP_HEIGHT - 50);

    // Resolve collisions with buildings
    const resolveCollisions = (ent: {x: number, y: number}, radius: number) => {
      for (let b of BUILDINGS) {
        let cx = Math.max(b.x, Math.min(ent.x, b.x + b.w));
        let cy = Math.max(b.y, Math.min(ent.y, b.y + b.h));
        let dx = ent.x - cx;
        let dy = ent.y - cy;
        let distSq = dx*dx + dy*dy;
        if (distSq < radius*radius) {
          let dist = Math.sqrt(distSq);
          if (dist === 0) { ent.y = b.y - radius; } 
          else {
            let overlap = radius - dist;
            ent.x += (dx/dist) * overlap;
            ent.y += (dy/dist) * overlap;
          }
        }
      }
    };
    resolveCollisions(p, 20);

    // Update angle
    if (canvasRef.current) {
      const mouseWorldX = state.current.mouse.x + state.current.camera.x;
      const mouseWorldY = state.current.mouse.y + state.current.camera.y;
      p.angle = Math.atan2(mouseWorldY - p.y, mouseWorldX - p.x);
    }

    // Update Camera
    if (canvasRef.current) {
      state.current.camera.x = p.x - canvasRef.current.width / 2;
      state.current.camera.y = p.y - canvasRef.current.height / 2;
      state.current.camera.x = Math.min(Math.max(state.current.camera.x, 0), MAP_WIDTH - canvasRef.current.width);
      state.current.camera.y = Math.min(Math.max(state.current.camera.y, 0), MAP_HEIGHT - canvasRef.current.height);
    }
    
    // Auto-shoot if button held
    if (state.current.keys.space) {
      shootBullet();
    }
  };

  const updateBotAI = () => {
    const now = Date.now();
    const p = state.current.localPlayer;
    if (!p) return;

    state.current.enemies.forEach(bot => {
      if (bot.hp <= 0) return;

      const dx = p.x - bot.x;
      const dy = p.y - bot.y;
      const dist = Math.hypot(dx, dy);

      if (dist < 250 && p.isAlive) { // Reduced aggro range
        const angleToPlayer = Math.atan2(dy, dx);
        bot.x += Math.cos(angleToPlayer) * 1.5; // Slower movement
        bot.y += Math.sin(angleToPlayer) * 1.5;
        bot.angle = angleToPlayer;

        const botWeapon = WEAPONS[bot.weapon];
        if (now - bot.lastShoot > ((botWeapon?.fireRate || 300) * 4) && dist < 200) { // Shoot less often, closer range
          bot.lastShoot = now;
          state.current.bullets.push({
            id: Date.now() + "_bot_" + Math.random(),
            x: bot.x + Math.cos(bot.angle) * 30,
            y: bot.y + Math.sin(bot.angle) * 30,
            dx: Math.cos(bot.angle) * 12,
            dy: Math.sin(bot.angle) * 12,
            ownerId: bot.id,
            damage: botWeapon?.damage || 20
          });
        }
      } else {
        if (!bot.moveDir || Math.random() < 0.02) {
          bot.moveDir = { x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2 };
          const mag = Math.hypot(bot.moveDir.x, bot.moveDir.y);
          if (mag > 0) { bot.moveDir.x /= mag; bot.moveDir.y /= mag; }
        }
        bot.x += bot.moveDir.x * 2.0; // Slower wander
        bot.y += bot.moveDir.y * 2.0;
        bot.angle = Math.atan2(bot.moveDir.y, bot.moveDir.x);
      }

      bot.x = Math.min(Math.max(bot.x, 30), MAP_WIDTH - 30);
      bot.y = Math.min(Math.max(bot.y, 30), MAP_HEIGHT - 30);
      
      // Resolve collisions with buildings
      const resolveCollisions = (ent: {x: number, y: number}, radius: number) => {
        for (let b of BUILDINGS) {
          let cx = Math.max(b.x, Math.min(ent.x, b.x + b.w));
          let cy = Math.max(b.y, Math.min(ent.y, b.y + b.h));
          let dx = ent.x - cx;
          let dy = ent.y - cy;
          let distSq = dx*dx + dy*dy;
          if (distSq < radius*radius) {
            let dist = Math.sqrt(distSq);
            if (dist === 0) { ent.y = b.y - radius; } 
            else {
              let overlap = radius - dist;
              ent.x += (dx/dist) * overlap;
              ent.y += (dy/dist) * overlap;
            }
          }
        }
      };
      resolveCollisions(bot, 20);
    });

    // Remove dead enemies
    state.current.enemies = state.current.enemies.filter(e => e.hp > 0);
  };

  const updateBullets = () => {
    const p = state.current.localPlayer;
    if (!p) return;

    for (let i = 0; i < state.current.bullets.length; i++) {
      const b = state.current.bullets[i];
      b.x += b.dx;
      b.y += b.dy;

      if (b.x < -200 || b.x > MAP_WIDTH + 200 || b.y < -200 || b.y > MAP_HEIGHT + 200) {
        state.current.bullets.splice(i, 1);
        i--;
        continue;
      }

      // Hit buildings
      let hitBuilding = false;
      for (let bldg of BUILDINGS) {
        if (b.x >= bldg.x && b.x <= bldg.x + bldg.w && b.y >= bldg.y && b.y <= bldg.y + bldg.h) {
          hitBuilding = true;
          break;
        }
      }
      if (hitBuilding) {
        state.current.bullets.splice(i, 1);
        i--;
        continue;
      }

      // Hit enemies
      let hit = false;
      for (let j = 0; j < state.current.enemies.length; j++) {
        const enemy = state.current.enemies[j];
        if (b.ownerId === "player" && enemy.hp > 0 && Math.hypot(b.x - enemy.x, b.y - enemy.y) < 28) {
          let damage = b.damage;
          if (enemy.armor > 0) {
            let armorBlock = Math.min(enemy.armor, damage * 0.5);
            enemy.armor -= armorBlock;
            damage -= armorBlock;
          }
          enemy.hp = Math.max(0, enemy.hp - damage);
          state.current.bullets.splice(i, 1);
          i--;
          hit = true;
          if (enemy.hp <= 0) {
            p.kills++;
            state.current.rankPoints += 15;
          }
          break;
        }
      }
      if (hit) continue;

      // Hit player
      if (b.ownerId !== "player" && p.isAlive && Math.hypot(b.x - p.x, b.y - p.y) < 28) {
        let damage = b.damage || 22;
        if (p.shield) {
          p.shield -= damage;
          damage = 0;
          if (p.shield <= 0) delete p.shield;
        }
        if (p.armor > 0 && damage > 0) {
          let armorBlock = Math.min(p.armor, damage * 0.4);
          p.armor -= armorBlock;
          damage -= armorBlock;
        }
        p.hp = Math.max(0, p.hp - damage);
        state.current.bullets.splice(i, 1);
        i--;
        if (p.hp <= 0) {
          p.isAlive = false;
          triggerGameOver();
        }
      }
    }
  };

  const checkWin = () => {
    const p = state.current.localPlayer;
    if (state.current.enemies.length === 0 && p?.isAlive && !state.current.booyahDisplay) {
      triggerBooyah();
    }
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Ground
    ctx.fillStyle = '#0A0A0B'; // bg-deep
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const worldToScreen = (x: number, y: number) => ({
      x: x - state.current.camera.x,
      y: y - state.current.camera.y
    });

    // Roads
    ctx.fillStyle = '#151517';
    ROADS.forEach(r => {
      const pos = worldToScreen(r.x, r.y);
      ctx.fillRect(pos.x, pos.y, r.w, r.h);
      // Road markings
      ctx.strokeStyle = '#333';
      ctx.setLineDash([20, 20]);
      ctx.beginPath();
      if (r.w > r.h) {
        ctx.moveTo(pos.x, pos.y + r.h / 2);
        ctx.lineTo(pos.x + r.w, pos.y + r.h / 2);
      } else {
        ctx.moveTo(pos.x + r.w / 2, pos.y);
        ctx.lineTo(pos.x + r.w / 2, pos.y + r.h);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    });

    // Trees
    TREES.forEach(t => {
      const pos = worldToScreen(t.x, t.y);
      ctx.fillStyle = '#0D2B1D';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#143D2A';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 10, 0, Math.PI * 2);
      ctx.fill();
    });

    // Buildings
    ctx.fillStyle = '#1A1A1D';
    ctx.strokeStyle = '#2A2A2D';
    ctx.lineWidth = 2;
    BUILDINGS.forEach(b => {
      const pos = worldToScreen(b.x, b.y);
      ctx.fillRect(pos.x, pos.y, b.w, b.h);
      ctx.strokeRect(pos.x, pos.y, b.w, b.h);
      ctx.fillStyle = '#151517';
      ctx.fillRect(pos.x + 10, pos.y + 10, b.w - 20, b.h - 20);
      ctx.fillStyle = '#1A1A1D';
    });

    // Safe zone
    const zonePos = worldToScreen(state.current.safeZone.x, state.current.safeZone.y);
    ctx.beginPath();
    ctx.arc(zonePos.x, zonePos.y, state.current.safeZone.radius, 0, Math.PI * 2);
    ctx.strokeStyle = '#8E793E'; // accent-dim
    ctx.lineWidth = 2;
    ctx.stroke();

    // Vehicles
    state.current.vehicles.forEach(v => {
      const pos = worldToScreen(v.x, v.y);
      ctx.fillStyle = '#2A2A2D'; // border-dark
      ctx.fillRect(pos.x - 15, pos.y - 10, 30, 20);
      ctx.strokeStyle = '#8E793E';
      ctx.lineWidth = 1;
      ctx.strokeRect(pos.x - 15, pos.y - 10, 30, 20);
    });

    // Airdrops
    state.current.airdrops.forEach(a => {
      const pos = worldToScreen(a.x, a.y);
      ctx.fillStyle = '#151517'; // bg-card
      ctx.fillRect(pos.x - 12, pos.y - 12, 24, 24);
      ctx.strokeStyle = '#D4AF37'; // accent-gold
      ctx.lineWidth = 1;
      ctx.strokeRect(pos.x - 12, pos.y - 12, 24, 24);
      ctx.fillStyle = '#D4AF37';
      ctx.font = '10px Georgia, serif';
      ctx.fillText('A', pos.x - 4, pos.y + 4);
    });

    // Loot items
    state.current.lootItems.forEach(l => {
      const pos = worldToScreen(l.x, l.y);
      ctx.fillStyle = '#E0DED7'; // text-primary
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    // Bullets
    state.current.bullets.forEach(b => {
      const pos = worldToScreen(b.x, b.y);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#D4AF37'; // accent-gold
      ctx.fill();
    });

    // Enemies
    state.current.enemies.forEach(enemy => {
      const pos = worldToScreen(enemy.x, enemy.y);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 20, 0, Math.PI * 2);
      ctx.fillStyle = '#151517'; // bg-card
      ctx.fill();
      ctx.strokeStyle = '#99958F'; // text-secondary
      ctx.lineWidth = 2;
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.lineTo(pos.x + Math.cos(enemy.angle) * 28, pos.y + Math.sin(enemy.angle) * 28);
      ctx.strokeStyle = '#99958F';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      ctx.fillStyle = '#99958F';
      ctx.font = '10px "Helvetica Neue", Helvetica, sans-serif';
      ctx.fillText(enemy.name, pos.x - 15, pos.y - 25);
      
      ctx.fillStyle = '#2A2A2D';
      ctx.fillRect(pos.x - 20, pos.y - 32, 40, 4);
      ctx.fillStyle = '#8E793E';
      ctx.fillRect(pos.x - 20, pos.y - 32, 40 * (enemy.hp / 200), 4);
    });

    // Player
    const p = state.current.localPlayer;
    if (p && p.isAlive) {
      const pos = worldToScreen(p.x, p.y);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 20, 0, Math.PI * 2);
      ctx.fillStyle = '#151517'; // bg-card
      ctx.fill();
      ctx.strokeStyle = '#D4AF37'; // accent-gold
      ctx.lineWidth = 2;
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.lineTo(pos.x + Math.cos(p.angle) * 30, pos.y + Math.sin(p.angle) * 30);
      ctx.strokeStyle = '#D4AF37';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      ctx.fillStyle = '#D4AF37';
      ctx.font = 'italic 12px Georgia, serif';
      ctx.fillText(p.name, pos.x - 20, pos.y - 28);
      
      ctx.fillStyle = '#2A2A2D';
      ctx.fillRect(pos.x - 25, pos.y - 38, 50, 4);
      ctx.fillStyle = '#D4AF37';
      ctx.fillRect(pos.x - 25, pos.y - 38, 50 * (p.hp / 200), 4);
      
      if (p.shield) {
        ctx.strokeStyle = '#E0DED7';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 28, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  };

  const gameLoop = (time: number) => {
    if (!state.current.isInGame) return;
    
    updateLocalMovement();
    updateBotAI();
    updateBullets();
    checkWin();
    draw();
    
    requestRef.current = requestAnimationFrame(gameLoop);
  };

  // --- Event Listeners ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!state.current.isInGame) return;
      const key = e.key.toLowerCase();
      if (key === 'w') state.current.keys.w = true;
      if (key === 's') state.current.keys.s = true;
      if (key === 'a') state.current.keys.a = true;
      if (key === 'd') state.current.keys.d = true;
      if (key === ' ') { state.current.keys.space = true; handleJump(); e.preventDefault(); }
      if (key === 'shift') state.current.keys.shift = true;
      
      const p = state.current.localPlayer;
      if (p) {
        if (key === '1') p.weapon = "m4a1";
        if (key === '2') p.weapon = "sniper";
        if (key === '3') p.weapon = "shotgun";
        if (key === '4') p.weapon = "smg";
      }
      
      if (key === 'q') useCharacterSkill();
      if (key === 'f') handleMedkit();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!state.current.isInGame) return;
      const key = e.key.toLowerCase();
      if (key === 'w') state.current.keys.w = false;
      if (key === 's') state.current.keys.s = false;
      if (key === 'a') state.current.keys.a = false;
      if (key === 'd') state.current.keys.d = false;
      if (key === ' ') state.current.keys.space = false;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!state.current.isInGame) return;
      state.current.mouse.x = e.clientX;
      state.current.mouse.y = e.clientY;
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (!state.current.isInGame) return;
      if (e.button === 0) shootBullet();
    };

    const handleResize = () => {
      if (canvasRef.current && state.current.isInGame) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Initialize canvas size when entering game
  useEffect(() => {
    if (screen === 'game' && canvasRef.current) {
      canvasRef.current.width = window.innerWidth;
      canvasRef.current.height = window.innerHeight;
    }
  }, [screen]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (zoneIntervalRef.current) clearInterval(zoneIntervalRef.current);
      if (airdropIntervalRef.current) clearInterval(airdropIntervalRef.current);
      if (hudUpdateIntervalRef.current) clearInterval(hudUpdateIntervalRef.current);
    };
  }, []);

  // --- Render ---
  return (
    <div className="w-full h-screen overflow-hidden bg-bg-deep text-text-primary font-sans select-none">
      {screen === 'login' && (
        <div className="fixed inset-0 bg-bg-deep flex justify-center items-center z-[200]">
          <div className="bg-bg-card p-[40px_30px] text-center border border-border-dark w-[400px]">
            <h1 className="text-[32px] text-accent-gold mb-2 font-serif italic tracking-[2px] uppercase">FREE FIRE</h1>
            <div className="text-[10px] text-text-secondary uppercase tracking-[4px] mb-8">Aetheris Edition</div>
            
            <input 
              type="text" 
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter Username" 
              maxLength={15}
              className="w-full p-[15px] my-4 bg-bg-deep border border-border-dark text-text-primary text-[14px] outline-none text-center focus:border-accent-dim transition-colors"
            />
            
            <button 
              onClick={goToLobby}
              className="w-full p-[12px_30px] mt-4 text-[12px] font-bold bg-accent-gold border border-accent-gold text-bg-deep uppercase tracking-[2px] cursor-pointer hover:opacity-90 transition-opacity"
            >
              Login
            </button>
          </div>
        </div>
      )}

      {screen === 'lobby' && (
        <div className="fixed inset-0 bg-[#0a0a0c] flex flex-col z-[200] overflow-hidden" style={{
          backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(212, 175, 55, 0.05) 0%, transparent 60%), linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '100% 100%, 40px 40px, 40px 40px'
        }}>
          {/* Top Bar */}
          <header className="h-[60px] flex items-center justify-between px-4 shrink-0 mt-2">
            {/* Top Left: Profile */}
            <div className="flex items-center gap-2 bg-black/40 pr-4 rounded-full border border-white/10 backdrop-blur-sm">
              <div className="w-12 h-12 bg-accent-dim rounded-full flex items-center justify-center font-serif text-white text-[20px] border-2 border-accent-gold shadow-[0_0_10px_rgba(212,175,55,0.5)]">
                {playerName ? playerName[0].toUpperCase() : 'U'}
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-[14px] text-white">{playerName || 'Guest'}</span>
                <span className="text-[10px] text-accent-gold bg-black/50 px-2 rounded-sm w-fit">Lv.{playerData.level}</span>
              </div>
            </div>

            {/* Top Center: Currencies */}
            <div className="flex gap-4">
              <div className="flex items-center bg-black/40 rounded-full border border-white/10 px-3 py-1 backdrop-blur-sm">
                <div className="w-5 h-5 rounded-full bg-yellow-500 mr-2 border border-yellow-300 shadow-[0_0_5px_yellow]"></div>
                <span className="font-bold text-[14px] text-white mr-4">{playerData.gold.toLocaleString()}</span>
                <button className="w-5 h-5 bg-white/20 rounded-sm flex items-center justify-center text-white text-[14px] leading-none hover:bg-white/40">+</button>
              </div>
              <div className="flex items-center bg-black/40 rounded-full border border-white/10 px-3 py-1 backdrop-blur-sm">
                <div className="w-5 h-5 rounded-sm bg-blue-500 mr-2 border border-blue-300 shadow-[0_0_5px_blue] rotate-45 transform scale-75"></div>
                <span className="font-bold text-[14px] text-white mr-4">{playerData.diamonds.toLocaleString()}</span>
                <button className="w-5 h-5 bg-white/20 rounded-sm flex items-center justify-center text-white text-[14px] leading-none hover:bg-white/40">+</button>
              </div>
            </div>

            {/* Top Right: Icons */}
            <div className="flex items-center gap-4">
              <div className="flex gap-3 text-white/80">
                <Battery size={20} />
                <Wifi size={20} />
                <Settings size={20} onClick={() => setActiveModal('SETTINGS')} className="cursor-pointer hover:text-white" />
                <Mail size={20} onClick={() => setActiveModal('MAIL')} className="cursor-pointer hover:text-white" />
              </div>
              <div className="font-serif text-[24px] italic text-white tracking-[2px] uppercase ml-4 drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]">
                FREE FIRE
              </div>
            </div>
          </header>

          {/* Main Lobby Area */}
          <div className="flex-1 flex justify-between p-4 relative">
            {/* Left Menu */}
            <div className="flex flex-col gap-2 w-[180px] z-10 mt-10">
              {['STORE', 'LUCK ROYALE', 'BOOYAH PASS', 'MISSIONS', 'EVENTS'].map((item, idx) => (
                <button 
                  key={item} 
                  onClick={() => setActiveModal(item)}
                  className="p-[10px_15px] bg-gradient-to-r from-black/80 to-transparent border-l-4 border-accent-gold text-white uppercase text-[12px] font-bold tracking-[1px] text-left hover:pl-5 transition-all shadow-lg flex items-center gap-3"
                >
                  <div className="w-6 h-6 bg-white/10 rounded flex items-center justify-center text-[10px]">{idx + 1}</div>
                  {item}
                </button>
              ))}
            </div>

            {/* Center Character Card */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="w-[320px] h-[480px] bg-gradient-to-b from-black/60 to-black/90 border border-accent-gold/30 rounded-xl p-4 relative pointer-events-auto backdrop-blur-md shadow-[0_0_50px_rgba(212,175,55,0.15)] flex flex-col items-center justify-end overflow-hidden group transition-transform hover:scale-105">
                <div className="absolute inset-0 bg-[url('https://picsum.photos/seed/freefire/300/450')] opacity-50 bg-cover bg-center mix-blend-overlay group-hover:opacity-70 transition-opacity"></div>
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent"></div>
                
                <div className="relative z-10 w-full text-center">
                  <div className="font-serif text-[48px] text-white capitalize font-bold drop-shadow-[0_4px_8px_rgba(0,0,0,0.9)]">{character}</div>
                  <div className="text-[16px] uppercase tracking-[3px] text-accent-gold mb-6 font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">Level {playerData.level}</div>
                  
                  <select 
                    value={character}
                    onChange={(e) => setCharacter(e.target.value)}
                    className="w-full p-[12px] bg-black/80 border border-accent-gold/50 text-white text-[14px] outline-none appearance-none cursor-pointer uppercase tracking-[2px] hover:border-accent-gold hover:bg-accent-gold/10 transition-colors rounded text-center font-bold backdrop-blur-md"
                  >
                    <option value="kelly">Kelly (Speed)</option>
                    <option value="nairi">Nairi (Armor)</option>
                    <option value="alok">Alok (Heal)</option>
                    <option value="chrono">Chrono (Shield)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Right Side (Empty for balance, mode selector is at bottom right) */}
            <div className="w-[250px] z-10"></div>
          </div>

          {/* Bottom Bar */}
          <div className="h-[80px] flex items-end justify-between px-4 pb-4 shrink-0 z-10">
            {/* Bottom Left: Chat */}
            <div className="flex flex-col gap-2 w-[300px]">
              <div className="bg-black/60 border border-white/10 rounded p-2 flex items-center gap-2 backdrop-blur-sm">
                <MessageSquare size={16} className="text-white/60" />
                <span className="text-[11px] text-white/60">World | Team Invite...</span>
              </div>
            </div>

            {/* Bottom Center: Menus */}
            <div className="flex gap-4">
              <button onClick={() => setActiveModal('WEAPON')} className="flex flex-col items-center gap-1 text-white/80 hover:text-white hover:-translate-y-1 transition-transform">
                <div className="w-12 h-10 bg-black/60 border border-white/10 rounded flex items-center justify-center backdrop-blur-sm"><Crosshair size={20} /></div>
                <span className="text-[10px] uppercase font-bold">Weapon</span>
              </button>
              <button onClick={() => setActiveModal('PRESET')} className="flex flex-col items-center gap-1 text-white/80 hover:text-white hover:-translate-y-1 transition-transform">
                <div className="w-12 h-10 bg-black/60 border border-white/10 rounded flex items-center justify-center backdrop-blur-sm"><User size={20} /></div>
                <span className="text-[10px] uppercase font-bold">Preset</span>
              </button>
              <button onClick={() => setActiveModal('LAB')} className="flex flex-col items-center gap-1 text-white/80 hover:text-white hover:-translate-y-1 transition-transform">
                <div className="w-12 h-10 bg-black/60 border border-white/10 rounded flex items-center justify-center backdrop-blur-sm"><Beaker size={20} /></div>
                <span className="text-[10px] uppercase font-bold">Lab</span>
              </button>
            </div>

            {/* Bottom Right: Mode & Start */}
            <div className="flex items-end gap-2">
              <div className="bg-black/80 border border-white/20 rounded p-2 flex flex-col min-w-[150px] backdrop-blur-sm">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 bg-accent-gold rounded flex items-center justify-center text-black font-bold text-[10px]">BR</div>
                  <span className="text-white font-bold text-[14px] uppercase">{mode}-RANKED</span>
                </div>
                <div className="text-[10px] text-white/60 uppercase">Random Map</div>
                <div className="flex gap-1 mt-2">
                  {['solo', 'duo', 'squad'].map(m => (
                    <button 
                      key={m}
                      onClick={() => setMode(m)}
                      className={`flex-1 py-1 text-[9px] uppercase font-bold rounded ${mode === m ? 'bg-accent-gold text-black' : 'bg-white/10 text-white hover:bg-white/20'}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <button 
                onClick={startMatchmaking}
                className="h-[60px] px-10 font-bold bg-accent-gold text-black uppercase tracking-[2px] cursor-pointer hover:brightness-110 transition-all text-[24px] rounded shadow-[0_0_20px_rgba(212,175,55,0.4)] border-b-4 border-[rgba(0,0,0,0.3)] active:border-b-0 active:translate-y-1"
              >
                START
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Overlay */}
      {activeModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[500] backdrop-blur-sm">
          <div className="bg-bg-card border border-accent-gold/50 p-8 rounded-xl max-w-[400px] w-full text-center shadow-[0_0_30px_rgba(212,175,55,0.15)]">
            <h3 className="text-accent-gold font-serif text-[24px] uppercase tracking-[2px] mb-4">{activeModal}</h3>
            <p className="text-text-secondary text-[14px] mb-8">This feature is currently under development. Check back later for updates!</p>
            <button 
              onClick={() => setActiveModal(null)}
              className="px-8 py-2 bg-accent-gold text-black font-bold uppercase tracking-[2px] rounded hover:brightness-110 transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {screen === 'matchmaking' && (
        <div className="fixed inset-0 bg-bg-deep flex flex-col items-center justify-center z-[200]">
          <div className="w-[80px] h-[80px] border-4 border-border-dark border-t-accent-gold rounded-full animate-spin mb-8"></div>
          <h2 className="text-[24px] text-accent-gold mb-2 font-serif italic uppercase tracking-[2px]">Matchmaking</h2>
          <div className="text-[12px] text-text-secondary uppercase tracking-[2px] mb-4">Searching for players...</div>
          <div className="font-serif text-[48px] text-text-primary mb-8">00:{matchTimer < 10 ? `0${matchTimer}` : matchTimer}</div>
        </div>
      )}

      {screen === 'drop_selection' && (
        <div className="fixed inset-0 bg-bg-deep flex flex-col items-center justify-center z-[200]">
          <h2 className="text-[24px] text-accent-gold mb-2 font-serif italic uppercase tracking-[2px]">Select Drop Point</h2>
          <div className="text-[12px] text-text-secondary uppercase tracking-[2px] mb-4">Click on the map to choose your starting location</div>
          <div className="font-serif text-[32px] text-text-primary mb-8">00:{dropTimer < 10 ? `0${dropTimer}` : dropTimer}</div>
          
          <div 
            className="w-[400px] h-[400px] bg-bg-card border border-accent-dim relative cursor-crosshair overflow-hidden"
            onClick={handleMapClick}
            style={{
              backgroundImage: 'linear-gradient(rgba(212, 175, 55, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(212, 175, 55, 0.1) 1px, transparent 1px)',
              backgroundSize: '40px 40px'
            }}
          >
            {/* Marker */}
            <div 
              className="absolute w-4 h-4 border-2 border-accent-gold rounded-full transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none transition-all duration-200"
              style={{ left: `${(dropPoint.x / MAP_WIDTH) * 100}%`, top: `${(dropPoint.y / MAP_HEIGHT) * 100}%` }}
            >
              <div className="w-1 h-1 bg-accent-gold rounded-full"></div>
            </div>
          </div>

          <button 
            onClick={() => { setDropTimer(0); startGame(); }}
            className="mt-8 p-[12px_40px] font-bold bg-accent-gold border border-accent-gold text-bg-deep uppercase tracking-[2px] cursor-pointer hover:opacity-90 transition-opacity text-[14px]"
          >
            Confirm Drop
          </button>
        </div>
      )}

      {screen === 'game' && (
        <div className="fixed inset-0 bg-bg-deep z-[300] flex flex-col">
          {/* HUD Top - Header Style */}
          <header className="h-[70px] bg-bg-card border-b border-border-dark flex items-center justify-between px-10 z-[350] pointer-events-none shrink-0">
            <div className="font-serif text-[24px] italic text-accent-gold tracking-[2px] uppercase">
              FREE FIRE
            </div>
            <div className="flex gap-[30px]">
              <div className="flex flex-col items-end">
                <span className="text-[10px] uppercase text-text-secondary tracking-[1px]">Health</span>
                <span className="font-serif text-[18px] text-accent-gold">{hud.hp} / {hud.armor}</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[10px] uppercase text-text-secondary tracking-[1px]">Alive</span>
                <span className="font-serif text-[18px] text-accent-gold">{hud.alive}</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[10px] uppercase text-text-secondary tracking-[1px]">Rank</span>
                <span className="font-serif text-[18px] text-accent-gold">{hud.rank}</span>
              </div>
            </div>
          </header>

          <div className="relative flex-1 bg-border-dark">
            <canvas 
              ref={canvasRef} 
              className="block w-full h-full cursor-crosshair"
            />

            {/* Zone Timer */}
            <div className="absolute top-5 right-10 bg-bg-deep p-[15px_20px] border border-border-dark z-[350] pointer-events-none">
              <div className="font-serif text-[14px] italic text-accent-gold mb-2 border-b border-border-dark pb-1">Safe Zone</div>
              <div className="text-[13px] text-text-secondary">{hud.zoneTimer}s | {hud.zoneRadius}m</div>
            </div>

            {/* Weapon Panel */}
            <div className="absolute bottom-5 left-10 bg-bg-deep p-[15px_20px] border border-border-dark z-[350] pointer-events-none">
              <div className="font-serif text-[14px] italic text-accent-gold mb-2 border-b border-border-dark pb-1">Equipped</div>
              <div className="text-[13px] text-text-secondary">{hud.weaponName} | {hud.ammo}/{hud.maxAmmo}</div>
            </div>

            {/* Quick Chat Messages */}
            {hud.messages.map((msg, i) => (
              <div key={msg.id} className="absolute left-10 bg-bg-deep p-[10px_15px] border border-border-dark text-text-primary text-[12px] z-[350] pointer-events-none transition-all" style={{ bottom: `${100 + i * 45}px` }}>
                {msg.text}
              </div>
            ))}

            {/* Booyah Screen */}
            {hud.booyah && (
              <div className="absolute top-1/2 left-1/2 text-[48px] font-serif italic text-accent-gold z-[400] pointer-events-none whitespace-nowrap animate-booyah text-center">
                VICTORY<br/>
                <span className="text-[14px] uppercase tracking-[4px] text-text-secondary not-italic">The Empire Prevails</span>
              </div>
            )}

            {/* Game Over Screen */}
            {hud.gameOver && (
              <div className="absolute top-1/2 left-1/2 text-[48px] font-serif italic text-accent-dim z-[400] pointer-events-none whitespace-nowrap animate-booyah text-center">
                DEFEAT<br/>
                <span className="text-[14px] uppercase tracking-[4px] text-text-secondary not-italic">Rank #{hud.place}</span>
              </div>
            )}
          </div>

          {/* Action Buttons - Footer Style */}
          <footer className="h-[60px] bg-bg-card border-t border-border-dark flex items-center justify-center gap-5 z-[350] shrink-0">
            <button onClick={handleJump} className="bg-transparent border border-accent-gold text-accent-gold px-[30px] py-[8px] uppercase text-[11px] tracking-[2px] cursor-pointer hover:bg-[rgba(212,175,55,0.05)]">
              Jump
            </button>
            <button onClick={handleCrouch} className="bg-transparent border border-accent-gold text-accent-gold px-[30px] py-[8px] uppercase text-[11px] tracking-[2px] cursor-pointer hover:bg-[rgba(212,175,55,0.05)]">
              Crouch
            </button>
            <button onClick={handleMedkit} className="bg-transparent border border-accent-gold text-accent-gold px-[30px] py-[8px] uppercase text-[11px] tracking-[2px] cursor-pointer hover:bg-[rgba(212,175,55,0.05)]">
              Medkit
            </button>
            <button onClick={handleQuickChat} className="bg-accent-gold border border-accent-gold text-bg-deep font-bold px-[30px] py-[8px] uppercase text-[11px] tracking-[2px] cursor-pointer hover:opacity-90">
              Quick Chat
            </button>
          </footer>
        </div>
      )}
    </div>
  );
}
