/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Settings, Mail, Battery, Wifi, MessageSquare, Users, Crosshair, User, Beaker, Zap } from 'lucide-react';
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
  m4a1: { name: "🔫 M4A1", damage: 24, fireRate: 130, range: 550, ammo: 30, maxAmmo: 120, type: "assault" },
  sniper: { name: "🎯 AWM", damage: 95, fireRate: 900, range: 1000, ammo: 5, maxAmmo: 25, type: "sniper" },
  shotgun: { name: "🔫 M1014", damage: 110, fireRate: 1000, range: 180, ammo: 8, maxAmmo: 32, type: "shotgun" },
  smg: { name: "🔫 MP5", damage: 16, fireRate: 80, range: 220, ammo: 40, maxAmmo: 160, type: "smg" },
  pistol: { name: "🔫 Glock", damage: 15, fireRate: 200, range: 250, ammo: 15, maxAmmo: 60, type: "pistol" }
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
  const [matchmakingPlayers, setMatchmakingPlayers] = useState<string[]>([]);
  const [killFeed, setKillFeed] = useState<{ id: number, killer: string, victim: string }[]>([]);
  
  // Joystick Refs
  const leftJoyRef = useRef({ active: false, x: 0, y: 0, originX: 0, originY: 0, dirX: 0, dirY: 0, identifier: -1 });
  const rightJoyRef = useRef({ active: false, x: 0, y: 0, originX: 0, originY: 0, dirX: 0, dirY: 0, identifier: -1 });
  
  const leftJoyBaseRef = useRef<HTMLDivElement>(null);
  const leftJoyStickRef = useRef<HTMLDivElement>(null);
  const rightJoyBaseRef = useRef<HTMLDivElement>(null);
  const rightJoyStickRef = useRef<HTMLDivElement>(null);
  
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
    
    // Join matchmaking queue
    const matchRef = ref(db, 'matchmaking/' + playerName);
    set(matchRef, { name: playerName, joinedAt: Date.now() });

    // Listen for other players
    const allMatchRef = ref(db, 'matchmaking');
    onValue(allMatchRef, (snapshot) => {
      if (snapshot.exists()) {
        const players = Object.values(snapshot.val()) as any[];
        setMatchmakingPlayers(players.map(p => p.name));
      } else {
        setMatchmakingPlayers([]);
      }
    });
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
    
    // Clear matchmaking queue for this player
    const matchRef = ref(db, 'matchmaking/' + playerName);
    set(matchRef, null);

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
    const totalPlayers = 20;
    const realPlayers = matchmakingPlayers.filter(name => name !== playerName);
    const botNames = ["Ranger", "Scout", "Sniper", "Medic", "Heavy", "Assault", "Recon", "Warrior", "Phantom", "Ghost", "Shadow", "Hunter", "Viper", "Wolf", "Hawk", "Eagle", "Falcon", "Cobra", "Dragon", "Titan"];
    
    const enemies: Enemy[] = [];

    // Add real players as "enemies" (simulated for now)
    realPlayers.forEach((name, i) => {
      enemies.push({
        id: `player_${i}`,
        name: name,
        x: Math.random() * MAP_WIDTH,
        y: Math.random() * MAP_HEIGHT,
        hp: 200,
        armor: 50,
        angle: Math.random() * Math.PI * 2,
        kills: 0,
        weapon: Object.keys(WEAPONS)[Math.floor(Math.random() * 5)],
        lastShoot: 0,
        moveDir: { x: 0, y: 0 }
      });
    });

    // Fill the rest with bots
    const botsNeeded = Math.max(0, totalPlayers - realPlayers.length - 1); // -1 for local player
    for (let i = 0; i < botsNeeded; i++) {
      enemies.push({
        id: `bot_${i}`,
        name: botNames[i % botNames.length] + " (Bot)",
        x: Math.random() * MAP_WIDTH,
        y: Math.random() * MAP_HEIGHT,
        hp: 200,
        armor: Math.random() * 50,
        angle: Math.random() * Math.PI * 2,
        kills: 0,
        weapon: Object.keys(WEAPONS)[Math.floor(Math.random() * 5)],
        lastShoot: 0,
        moveDir: { x: 0, y: 0 }
      });
    }

    state.current.enemies = enemies;
    setKillFeed([]);

    // Generate Vehicles & Loot
    state.current.vehicles = [
      { x: 500, y: 500, type: "car", speed: 12, active: true },
      { x: 2000, y: 800, type: "bike", speed: 15, active: true },
      { x: 800, y: 2200, type: "car", speed: 12, active: true },
      { x: 2500, y: 2000, type: "bike", speed: 15, active: true },
    ];

    state.current.lootItems = [];
    for (let i = 0; i < 80; i++) {
      state.current.lootItems.push({
        x: Math.random() * MAP_WIDTH,
        y: Math.random() * MAP_HEIGHT,
        type: Object.keys(WEAPONS)[Math.floor(Math.random() * 5)],
        itemType: "weapon"
      });
    }
    for (let i = 0; i < 60; i++) {
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

  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    window.addEventListener('resize', handleResize);
    if (screen === 'game') {
      handleResize();
    }
    return () => window.removeEventListener('resize', handleResize);
  }, [screen]);

  // --- Game Loop Systems ---
  const updateLootPickup = () => {
    const p = state.current.localPlayer;
    if (!p || !p.isAlive) return;

    for (let i = 0; i < state.current.lootItems.length; i++) {
      const item = state.current.lootItems[i];
      const dist = Math.hypot(p.x - item.x, p.y - item.y);

      if (dist < 45) {
        if (item.itemType === "weapon") {
          // Swap weapon if it's different or if we want to refresh ammo
          if (p.weapon !== item.type) {
            p.weapon = item.type;
            p.ammo = WEAPONS[item.type].maxAmmo;
            state.current.lootItems.splice(i, 1);
            i--;
            addMessage(`🔫 Picked up ${WEAPONS[item.type].name}`);
          }
        } else if (item.itemType === "consumable") {
          if (item.type === "medkit") {
            if (p.hp < 200) {
              p.hp = Math.min(200, p.hp + 60);
              state.current.lootItems.splice(i, 1);
              i--;
              addMessage("➕ Used Medkit (+60 HP)");
            }
          } else if (item.type === "armor") {
            if (p.armor < 100) {
              p.armor = Math.min(100, p.armor + 50);
              state.current.lootItems.splice(i, 1);
              i--;
              addMessage("🛡️ Picked up Armor (+50)");
            }
          }
        }
      }
    }
  };

  const updateLocalMovement = () => {
    const p = state.current.localPlayer;
    if (!p || !p.isAlive) return;

    let speed = p.isCrouching ? 2.5 : (p.isProne ? 1.5 : 5);
    if (p.speedBuff) speed *= p.speedBuff;

    let moveX = leftJoyRef.current.dirX;
    let moveY = leftJoyRef.current.dirY;
    
    // Fallback to keyboard
    if (moveX === 0 && moveY === 0) {
      if (state.current.keys.w) moveY -= 1;
      if (state.current.keys.s) moveY += 1;
      if (state.current.keys.a) moveX -= 1;
      if (state.current.keys.d) moveX += 1;
    }

    if (moveX !== 0 || moveY !== 0) {
      const len = Math.hypot(moveX, moveY);
      if (len > 1) {
        moveX /= len;
        moveY /= len;
      }
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
    if (rightJoyRef.current.active && Math.hypot(rightJoyRef.current.dirX, rightJoyRef.current.dirY) > 0.1) {
      p.angle = Math.atan2(rightJoyRef.current.dirY, rightJoyRef.current.dirX);
    } else if (canvasRef.current && !('ontouchstart' in window)) {
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
            
            // Add to kill feed
            const newKill = { id: Date.now(), killer: p.name, victim: enemy.name };
            setKillFeed(prev => [newKill, ...prev].slice(0, 5));
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
          
          // Add to kill feed
          const killer = state.current.enemies.find(e => e.id === b.ownerId);
          const newKill = { id: Date.now(), killer: killer ? killer.name : "Enemy", victim: p.name };
          setKillFeed(prev => [newKill, ...prev].slice(0, 5));
          
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
      
      if (l.itemType === 'weapon') {
        ctx.fillStyle = '#D4AF37'; // gold
        ctx.font = 'bold 10px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(WEAPONS[l.type]?.name || 'Weapon', pos.x, pos.y - 10);
        
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 6, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = l.type === 'medkit' ? '#ff4d4d' : '#4d94ff';
        ctx.font = 'bold 10px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(l.type === 'medkit' ? '➕ MEDKIT' : '🛡️ ARMOR', pos.x, pos.y - 10);
        
        ctx.fillRect(pos.x - 5, pos.y - 5, 10, 10);
      }
    });

    // Bullets
    state.current.bullets.forEach(b => {
      const pos = worldToScreen(b.x, b.y);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#D4AF37'; // accent-gold
      ctx.fill();
    });

    // Helper to draw a human character (top-down)
    const drawHuman = (ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, color: string, name: string, hp: number, isLocal: boolean) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);

      // Shoulders/Body
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(0, 0, 12, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Head
      ctx.fillStyle = '#FFDBAC'; // Skin tone
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Arms/Hands (Holding weapon position)
      ctx.fillStyle = color;
      // Left arm
      ctx.beginPath();
      ctx.arc(10, -12, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Right arm (extended for weapon)
      ctx.beginPath();
      ctx.arc(15, 8, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Weapon
      ctx.fillStyle = '#333';
      ctx.fillRect(8, 4, 25, 4);
      ctx.strokeStyle = '#000';
      ctx.strokeRect(8, 4, 25, 4);

      ctx.restore();

      // Name & HP Bar (Not rotated)
      ctx.fillStyle = color;
      ctx.font = isLocal ? 'bold 12px "Inter", sans-serif' : '10px "Inter", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(name, x, y - 35);

      const barWidth = 40;
      ctx.fillStyle = '#2A2A2D';
      ctx.fillRect(x - barWidth / 2, y - 45, barWidth, 4);
      ctx.fillStyle = color;
      ctx.fillRect(x - barWidth / 2, y - 45, barWidth * (hp / 200), 4);
    };

    // Enemies
    state.current.enemies.forEach(enemy => {
      const pos = worldToScreen(enemy.x, enemy.y);
      drawHuman(ctx, pos.x, pos.y, enemy.angle, '#99958F', enemy.name, enemy.hp, false);
    });

    // Player
    const p = state.current.localPlayer;
    if (p && p.isAlive) {
      const pos = worldToScreen(p.x, p.y);
      drawHuman(ctx, pos.x, pos.y, p.angle, '#D4AF37', p.name, p.hp, true);
      
      if (p.shield) {
        ctx.strokeStyle = 'rgba(224, 222, 215, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 30, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  };

  const updateJoysticks = () => {
    if (leftJoyBaseRef.current && leftJoyStickRef.current) {
      if (leftJoyRef.current.active) {
        leftJoyStickRef.current.style.transform = `translate(${leftJoyRef.current.x - leftJoyRef.current.originX}px, ${leftJoyRef.current.y - leftJoyRef.current.originY}px)`;
      } else {
        leftJoyStickRef.current.style.transform = `translate(0px, 0px)`;
      }
    }
    if (rightJoyBaseRef.current && rightJoyStickRef.current) {
      if (rightJoyRef.current.active) {
        rightJoyStickRef.current.style.transform = `translate(${rightJoyRef.current.x - rightJoyRef.current.originX}px, ${rightJoyRef.current.y - rightJoyRef.current.originY}px)`;
      } else {
        rightJoyStickRef.current.style.transform = `translate(0px, 0px)`;
      }
    }
  };

  const gameLoop = (time: number) => {
    if (!state.current.isInGame) return;
    
    updateJoysticks();
    updateLocalMovement();
    updateBotAI();
    updateBullets();
    updateLootPickup();
    checkWin();
    draw();
    
    requestRef.current = requestAnimationFrame(gameLoop);
  };

  // --- Touch Handlers ---
  const handleTouchStart = (e: React.TouchEvent, side: 'left' | 'right') => {
    const joy = side === 'left' ? leftJoyRef.current : rightJoyRef.current;
    const baseRef = side === 'left' ? leftJoyBaseRef.current : rightJoyBaseRef.current;
    
    if (!baseRef) return;
    const rect = baseRef.getBoundingClientRect();
    const originX = rect.left + rect.width / 2;
    const originY = rect.top + rect.height / 2;
    
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const isLeft = touch.clientX < window.innerWidth / 2;
      if ((side === 'left' && isLeft) || (side === 'right' && !isLeft)) {
        joy.active = true;
        joy.identifier = touch.identifier;
        joy.originX = originX;
        joy.originY = originY;
        joy.x = touch.clientX;
        joy.y = touch.clientY;
        
        // Calculate initial direction based on touch relative to fixed origin
        let dx = joy.x - joy.originX;
        let dy = joy.y - joy.originY;
        const dist = Math.hypot(dx, dy);
        const maxDist = 40;
        
        if (dist > maxDist) {
          dx = (dx / dist) * maxDist;
          dy = (dy / dist) * maxDist;
          joy.x = joy.originX + dx;
          joy.y = joy.originY + dy;
        }
        
        joy.dirX = dx / maxDist;
        joy.dirY = dy / maxDist;
        break;
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent, side: 'left' | 'right') => {
    const joy = side === 'left' ? leftJoyRef.current : rightJoyRef.current;
    if (!joy.active) return;
    
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === joy.identifier) {
        joy.x = touch.clientX;
        joy.y = touch.clientY;
        
        let dx = joy.x - joy.originX;
        let dy = joy.y - joy.originY;
        const dist = Math.hypot(dx, dy);
        const maxDist = 40; 
        
        if (dist > maxDist) {
          dx = (dx / dist) * maxDist;
          dy = (dy / dist) * maxDist;
          joy.x = joy.originX + dx;
          joy.y = joy.originY + dy;
        }
        
        joy.dirX = dx / maxDist;
        joy.dirY = dy / maxDist;
        break;
      }
    }
  };

  const autoAimAndShoot = () => {
    const p = state.current.localPlayer;
    if (!p || !p.isAlive) return;
    
    let closestEnemy = null;
    let closestDist = Infinity;
    
    for (let enemy of state.current.enemies) {
      if (enemy.hp <= 0) continue;
      const dist = Math.hypot(enemy.x - p.x, enemy.y - p.y);
      if (dist < closestDist && dist < 600) {
        closestDist = dist;
        closestEnemy = enemy;
      }
    }
    
    if (closestEnemy) {
      p.angle = Math.atan2(closestEnemy.y - p.y, closestEnemy.x - p.x);
      shootBullet();
    }
  };

  const handleTouchEnd = (e: React.TouchEvent, side: 'left' | 'right') => {
    const joy = side === 'left' ? leftJoyRef.current : rightJoyRef.current;
    if (!joy.active) return;
    
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === joy.identifier) {
        if (side === 'right') {
          if (Math.hypot(joy.dirX, joy.dirY) < 0.2) {
            autoAimAndShoot();
          } else {
            shootBullet();
          }
        }
        joy.active = false;
        joy.identifier = -1;
        joy.dirX = 0;
        joy.dirY = 0;
        break;
      }
    }
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
      
      // Clear matchmaking on exit
      if (playerName) {
        const matchRef = ref(db, 'matchmaking/' + playerName);
        set(matchRef, null);
      }
    };
  }, [playerName]);

  // --- Render ---
  return (
    <div className="w-full h-screen overflow-hidden bg-bg-deep text-text-primary font-sans select-none">
      {screen === 'login' && (
        <div className="fixed inset-0 bg-bg-deep flex justify-center items-center z-[200]">
          <div className="bg-bg-card p-[40px_30px] text-center border border-border-dark w-[400px]">
            <h1 className="text-[32px] text-accent-gold mb-2 font-serif italic tracking-[2px] uppercase">Grand Fire Pixel Games</h1>
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
        <div className="fixed inset-0 bg-[#0a0a0c] flex flex-col z-[200] overflow-hidden touch-none" style={{
          backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(212, 175, 55, 0.05) 0%, transparent 60%), linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '100% 100%, 40px 40px, 40px 40px'
        }}>
          {/* Floating Title */}
          <div className="absolute right-4 top-1/4 font-serif text-[32px] md:text-[48px] italic text-white/20 tracking-[4px] uppercase rotate-90 origin-right pointer-events-none whitespace-nowrap mix-blend-overlay">
            Grand Fire Pixel Games
          </div>

          {/* Top Bar */}
          <header className="h-[40px] sm:h-[60px] flex items-center justify-between px-2 md:px-4 shrink-0 mt-2 z-20">
            {/* Top Left: Profile */}
            <div className="flex items-center gap-2 bg-black/40 pr-3 rounded-full border border-white/10 backdrop-blur-sm scale-75 sm:scale-90 md:scale-100 origin-left">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-accent-dim rounded-full flex items-center justify-center font-serif text-white text-[14px] sm:text-[18px] border-2 border-accent-gold shadow-[0_0_10px_rgba(212,175,55,0.5)]">
                {playerName ? playerName[0].toUpperCase() : 'U'}
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-[10px] sm:text-[12px] text-white">{playerName || 'Guest'}</span>
                <span className="text-[8px] sm:text-[9px] text-accent-gold bg-black/50 px-1 rounded-sm w-fit">Lv.{playerData.level}</span>
              </div>
            </div>

            {/* Top Center: Currencies */}
            <div className="flex gap-1 sm:gap-2 scale-75 sm:scale-90 md:scale-100">
              <div className="flex items-center bg-black/40 rounded-full border border-white/10 px-2 py-1 backdrop-blur-sm">
                <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-yellow-500 mr-1 border border-yellow-300 shadow-[0_0_5px_yellow]"></div>
                <span className="font-bold text-[10px] sm:text-[12px] text-white mr-1 sm:mr-2">{playerData.gold.toLocaleString()}</span>
              </div>
              <div className="flex items-center bg-black/40 rounded-full border border-white/10 px-2 py-1 backdrop-blur-sm">
                <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-sm bg-blue-500 mr-1 border border-blue-300 shadow-[0_0_5px_blue] rotate-45 transform scale-75"></div>
                <span className="font-bold text-[10px] sm:text-[12px] text-white mr-1 sm:mr-2">{playerData.diamonds.toLocaleString()}</span>
              </div>
            </div>

            {/* Top Right: Icons */}
            <div className="flex items-center gap-2 sm:gap-3 text-white/80 scale-75 sm:scale-90 md:scale-100 origin-right">
              <Battery size={16} className="sm:w-[18px] sm:h-[18px]" />
              <Wifi size={16} className="sm:w-[18px] sm:h-[18px]" />
              <Settings size={16} className="sm:w-[18px] sm:h-[18px] cursor-pointer hover:text-white" onClick={() => setActiveModal('SETTINGS')} />
            </div>
          </header>

          {/* Main Lobby Area */}
          <div className="flex-1 flex items-center justify-center relative z-10">
            {/* Left Menu - Mobile Optimized */}
            <div className="absolute left-2 top-1/2 -translate-y-1/2 flex flex-col gap-1 sm:gap-2 w-[100px] sm:w-[140px]">
              {['STORE', 'LUCK ROYALE', 'BOOYAH PASS', 'MISSIONS', 'EVENTS'].map((item, idx) => (
                <button 
                  key={item} 
                  onClick={() => setActiveModal(item)}
                  className="p-[6px_8px] sm:p-[8px_10px] bg-gradient-to-r from-black/80 to-transparent border-l-2 border-accent-gold text-white uppercase text-[8px] sm:text-[10px] font-bold tracking-[1px] text-left hover:pl-3 transition-all shadow-lg flex items-center gap-1 sm:gap-2"
                >
                  <div className="w-4 h-4 sm:w-5 sm:h-5 bg-white/10 rounded flex items-center justify-center text-[8px] sm:text-[9px] shrink-0">{idx + 1}</div>
                  <span className="truncate">{item}</span>
                </button>
              ))}
            </div>

            {/* Center Character Card - Mobile Optimized */}
            <div className="w-[200px] h-[300px] sm:w-[260px] sm:h-[380px] md:w-[320px] md:h-[480px] max-h-[50vh] bg-gradient-to-b from-black/60 to-black/90 border border-accent-gold/30 rounded-xl p-3 relative pointer-events-auto backdrop-blur-md shadow-[0_0_50px_rgba(212,175,55,0.15)] flex flex-col items-center justify-end overflow-hidden group transition-transform hover:scale-105">
              <div className="absolute inset-0 bg-[url('https://picsum.photos/seed/grandfire/300/450')] opacity-50 bg-cover bg-center mix-blend-overlay group-hover:opacity-70 transition-opacity"></div>
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent"></div>
              
              <div className="relative z-10 w-full text-center">
                <div className="font-serif text-[28px] sm:text-[36px] md:text-[48px] text-white capitalize font-bold drop-shadow-[0_4px_8px_rgba(0,0,0,0.9)]">{character}</div>
                <div className="text-[10px] sm:text-[12px] md:text-[16px] uppercase tracking-[3px] text-accent-gold mb-2 sm:mb-4 font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">Level {playerData.level}</div>
                
                <select 
                  value={character}
                  onChange={(e) => setCharacter(e.target.value)}
                  className="w-full p-[8px] sm:p-[10px] bg-black/80 border border-accent-gold/50 text-white text-[10px] sm:text-[12px] outline-none appearance-none cursor-pointer uppercase tracking-[2px] hover:border-accent-gold hover:bg-accent-gold/10 transition-colors rounded text-center font-bold backdrop-blur-md"
                >
                  <option value="kelly">Kelly (Speed)</option>
                  <option value="nairi">Nairi (Armor)</option>
                  <option value="alok">Alok (Heal)</option>
                  <option value="chrono">Chrono (Shield)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Bottom Bar - Mobile Optimized */}
          <div className="flex flex-col gap-1 sm:gap-2 px-2 pb-2 shrink-0 z-20">
            {/* Chat & Menus Row */}
            <div className="flex items-center justify-between">
              {/* Chat */}
              <div className="bg-black/60 border border-white/10 rounded p-1 sm:p-2 flex items-center gap-1 sm:gap-2 backdrop-blur-sm w-[120px] sm:w-[150px] md:w-[250px]">
                <MessageSquare size={12} className="text-white/60 sm:w-[14px] sm:h-[14px]" />
                <span className="text-[8px] sm:text-[9px] md:text-[11px] text-white/60 truncate">World | Team Invite...</span>
              </div>

              {/* Menus */}
              <div className="flex gap-1 sm:gap-2">
                <button onClick={() => setActiveModal('WEAPON')} className="flex flex-col items-center gap-1 text-white/80 hover:text-white">
                  <div className="w-8 h-6 sm:w-10 sm:h-8 bg-black/60 border border-white/10 rounded flex items-center justify-center backdrop-blur-sm"><Crosshair size={14} className="sm:w-[16px] sm:h-[16px]" /></div>
                  <span className="text-[6px] sm:text-[8px] uppercase font-bold">Weapon</span>
                </button>
                <button onClick={() => setActiveModal('PRESET')} className="flex flex-col items-center gap-1 text-white/80 hover:text-white">
                  <div className="w-8 h-6 sm:w-10 sm:h-8 bg-black/60 border border-white/10 rounded flex items-center justify-center backdrop-blur-sm"><User size={14} className="sm:w-[16px] sm:h-[16px]" /></div>
                  <span className="text-[6px] sm:text-[8px] uppercase font-bold">Preset</span>
                </button>
                <button onClick={() => setActiveModal('LAB')} className="flex flex-col items-center gap-1 text-white/80 hover:text-white">
                  <div className="w-8 h-6 sm:w-10 sm:h-8 bg-black/60 border border-white/10 rounded flex items-center justify-center backdrop-blur-sm"><Beaker size={14} className="sm:w-[16px] sm:h-[16px]" /></div>
                  <span className="text-[6px] sm:text-[8px] uppercase font-bold">Lab</span>
                </button>
              </div>
            </div>

            {/* Mode & Start Row */}
            <div className="flex items-end justify-between mt-1">
              <div className="bg-black/80 border border-white/20 rounded p-1 sm:p-2 flex flex-col w-[120px] sm:w-[150px] md:w-[200px] backdrop-blur-sm">
                <div className="flex items-center gap-1 sm:gap-2 mb-1">
                  <div className="w-4 h-4 sm:w-5 sm:h-5 bg-accent-gold rounded flex items-center justify-center text-black font-bold text-[8px] sm:text-[9px]">BR</div>
                  <span className="text-white font-bold text-[10px] sm:text-[12px] uppercase">{mode}-RANKED</span>
                </div>
                <div className="flex gap-1 mt-1">
                  {['solo', 'duo', 'squad'].map(m => (
                    <button 
                      key={m}
                      onClick={() => setMode(m)}
                      className={`flex-1 py-1 text-[6px] sm:text-[8px] uppercase font-bold rounded ${mode === m ? 'bg-accent-gold text-black' : 'bg-white/10 text-white'}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <button 
                onClick={startMatchmaking}
                className="h-[40px] sm:h-[50px] md:h-[60px] px-6 sm:px-8 md:px-12 font-bold bg-accent-gold text-black uppercase tracking-[2px] cursor-pointer hover:brightness-110 transition-all text-[16px] sm:text-[20px] md:text-[24px] rounded shadow-[0_0_20px_rgba(212,175,55,0.4)] border-b-4 border-[rgba(0,0,0,0.3)] active:border-b-0 active:translate-y-1"
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
          <div className="font-serif text-[48px] text-text-primary mb-4">00:{matchTimer < 10 ? `0${matchTimer}` : matchTimer}</div>
          
          <div className="bg-bg-card border border-border-dark p-4 rounded w-[300px]">
            <div className="text-[10px] text-accent-gold uppercase mb-2 border-b border-white/10 pb-1">Players Found ({matchmakingPlayers.length})</div>
            <div className="max-h-[150px] overflow-y-auto flex flex-col gap-1">
              {matchmakingPlayers.map((name, i) => (
                <div key={i} className="text-[12px] text-white/80 flex justify-between">
                  <span>{name}</span>
                  <span className="text-accent-gold text-[10px]">READY</span>
                </div>
              ))}
              {matchmakingPlayers.length === 0 && <div className="text-[10px] text-white/40 italic">Waiting for players...</div>}
            </div>
          </div>
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
        <div className="fixed inset-0 bg-black z-[300] touch-none">
          <canvas
            ref={canvasRef}
            className="block w-full h-full"
          />

          {/* Mobile Controls Overlay */}
          <div className="absolute inset-0 pointer-events-none z-[300] touch-none">
            {/* Left Touch Area */}
            <div 
              className="absolute left-0 top-0 w-1/2 h-full pointer-events-auto"
              onTouchStart={(e) => handleTouchStart(e, 'left')}
              onTouchMove={(e) => handleTouchMove(e, 'left')}
              onTouchEnd={(e) => handleTouchEnd(e, 'left')}
              onTouchCancel={(e) => handleTouchEnd(e, 'left')}
            />
            {/* Right Touch Area */}
            <div 
              className="absolute right-0 top-0 w-1/2 h-full pointer-events-auto"
              onTouchStart={(e) => handleTouchStart(e, 'right')}
              onTouchMove={(e) => handleTouchMove(e, 'right')}
              onTouchEnd={(e) => handleTouchEnd(e, 'right')}
              onTouchCancel={(e) => handleTouchEnd(e, 'right')}
            />

            {/* Left Joystick Visual (Always Visible Base) */}
            <div ref={leftJoyBaseRef} className="absolute left-[40px] bottom-[40px] w-[120px] h-[120px] bg-white/10 rounded-full border border-white/20 pointer-events-none flex items-center justify-center">
              <div ref={leftJoyStickRef} className="w-[50px] h-[50px] bg-white/40 rounded-full shadow-[0_0_15px_rgba(255,255,255,0.3)] transition-transform duration-75"></div>
            </div>

            {/* Right Joystick Visual (Always Visible Base) */}
            <div ref={rightJoyBaseRef} className="absolute right-[40px] bottom-[40px] w-[120px] h-[120px] bg-white/10 rounded-full border border-white/20 pointer-events-none flex items-center justify-center">
              <div ref={rightJoyStickRef} className="w-[50px] h-[50px] bg-accent-gold/40 rounded-full shadow-[0_0_15px_rgba(212,175,55,0.3)] transition-transform duration-75 flex items-center justify-center">
                <Crosshair size={24} className="text-white/80" />
              </div>
            </div>

            {/* Super Button */}
            <button 
              onClick={useCharacterSkill}
              className="absolute right-[40px] bottom-[180px] w-[60px] h-[60px] bg-gradient-to-br from-yellow-400 to-orange-600 rounded-full border-2 border-white/50 shadow-[0_0_15px_rgba(255,165,0,0.8)] pointer-events-auto flex items-center justify-center active:scale-90 transition-transform"
            >
              <Zap size={28} className="text-white drop-shadow-md" />
            </button>
            
            {/* Auto Aim Hint */}
            <div className="absolute right-[40px] bottom-[250px] text-white/50 text-[10px] uppercase tracking-[1px] pointer-events-none text-right">
              Tap right side<br/>to Auto-Aim
            </div>
          </div>

          {/* HUD Overlay */}
          <div className="absolute inset-0 pointer-events-none z-[350]">
            {/* HUD Top - Header Style */}
            <header className="absolute top-0 left-0 right-0 h-[50px] md:h-[70px] bg-bg-card/80 backdrop-blur-sm border-b border-border-dark flex items-center justify-between px-4 md:px-10 z-[350] pointer-events-none">
              <div className="font-serif text-[16px] md:text-[24px] italic text-accent-gold tracking-[2px] uppercase">
                Grand Fire Pixel Games
              </div>
            
            {/* Kill Feed */}
            <div className="absolute top-[80px] right-10 flex flex-col gap-2 pointer-events-none">
              {killFeed.map(k => (
                <div key={k.id} className="bg-black/60 border-l-2 border-accent-gold px-4 py-1 flex items-center gap-3 animate-fade-in">
                  <span className="text-accent-gold font-bold text-[12px]">{k.killer}</span>
                  <div className="w-4 h-[1px] bg-white/30"></div>
                  <span className="text-white text-[12px]">{k.victim}</span>
                </div>
              ))}
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

          {/* Zone Timer */}
          <div className="absolute top-[80px] right-4 bg-black/60 p-[10px_15px] border border-white/10 rounded backdrop-blur-sm z-[350] pointer-events-none">
            <div className="font-serif text-[12px] italic text-accent-gold mb-1 border-b border-white/10 pb-1">Safe Zone</div>
            <div className="text-[11px] text-white/80">{hud.zoneTimer}s | {hud.zoneRadius}m</div>
          </div>

          {/* Weapon Panel - Moved to Top Left */}
          <div className="absolute top-[80px] left-4 bg-black/60 p-[10px_15px] border border-white/10 rounded backdrop-blur-sm z-[350] pointer-events-none">
            <div className="font-serif text-[12px] italic text-accent-gold mb-1 border-b border-white/10 pb-1">Equipped</div>
            <div className="text-[11px] text-white/80">{hud.weaponName} | {hud.ammo}/{hud.maxAmmo}</div>
          </div>

          {/* Quick Chat Messages */}
          {hud.messages.map((msg, i) => (
            <div key={msg.id} className="absolute left-4 bg-black/60 p-[8px_12px] border border-white/10 rounded text-white text-[10px] z-[350] pointer-events-none transition-all backdrop-blur-sm" style={{ bottom: `${80 + i * 40}px` }}>
              {msg.text}
            </div>
          ))}

          {/* Booyah Screen */}
          {hud.booyah && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[36px] md:text-[48px] font-serif italic text-accent-gold z-[400] pointer-events-none whitespace-nowrap animate-booyah text-center drop-shadow-[0_0_20px_rgba(212,175,55,0.8)]">
              VICTORY<br/>
              <span className="text-[12px] md:text-[14px] uppercase tracking-[4px] text-white/80 not-italic">The Empire Prevails</span>
            </div>
          )}

          {/* Game Over Screen */}
          {hud.gameOver && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[36px] md:text-[48px] font-serif italic text-red-500 z-[400] pointer-events-none whitespace-nowrap animate-booyah text-center drop-shadow-[0_0_20px_rgba(255,0,0,0.8)]">
              DEFEAT<br/>
              <span className="text-[12px] md:text-[14px] uppercase tracking-[4px] text-white/80 not-italic">Rank #{hud.place}</span>
            </div>
          )}

          {/* Floating Action Buttons */}
          <div className="absolute bottom-[20px] left-1/2 -translate-x-1/2 flex gap-2 md:gap-4 z-[350] pointer-events-auto">
            <button onClick={handleJump} className="w-[40px] h-[40px] md:w-[50px] md:h-[50px] bg-black/50 border border-white/20 rounded-full flex items-center justify-center text-white text-[10px] uppercase backdrop-blur-sm active:bg-white/20">
              JMP
            </button>
            <button onClick={handleCrouch} className="w-[40px] h-[40px] md:w-[50px] md:h-[50px] bg-black/50 border border-white/20 rounded-full flex items-center justify-center text-white text-[10px] uppercase backdrop-blur-sm active:bg-white/20">
              CRH
            </button>
            <button onClick={handleMedkit} className="w-[40px] h-[40px] md:w-[50px] md:h-[50px] bg-black/50 border border-white/20 rounded-full flex items-center justify-center text-white text-[10px] uppercase backdrop-blur-sm active:bg-white/20">
              MED
            </button>
            <button onClick={handleQuickChat} className="w-[40px] h-[40px] md:w-[50px] md:h-[50px] bg-black/50 border border-white/20 rounded-full flex items-center justify-center text-white text-[10px] uppercase backdrop-blur-sm active:bg-white/20">
              MSG
            </button>
          </div>
        </div>
        </div>
      )}
    </div>
  );
}
