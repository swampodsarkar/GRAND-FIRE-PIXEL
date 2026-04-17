/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, Mail, Battery, Wifi, MessageSquare, Users, Crosshair, User, Beaker, Zap, Shield, Activity, Luggage, Skull, Sword, Map, Target, CloudRain } from 'lucide-react';
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

// DENSE BUILDINGS (for 3000 x 3000 Map)
const BUILDINGS = [
  // AERODROME (Top Left Town)
  { x: 300, y: 300, w: 200, h: 100, isDoorOpen: false }, { x: 550, y: 300, w: 150, h: 200, isDoorOpen: false }, { x: 300, y: 450, w: 200, h: 150, isDoorOpen: false },
  { x: 750, y: 350, w: 120, h: 120, isDoorOpen: false }, { x: 400, y: 650, w: 300, h: 100, isDoorOpen: false },
  
  // FORGE (Top Right Town)
  { x: 2200, y: 300, w: 250, h: 150, isDoorOpen: false }, { x: 2500, y: 250, w: 150, h: 200, isDoorOpen: false }, { x: 2200, y: 500, w: 200, h: 200, isDoorOpen: false },
  { x: 2450, y: 500, w: 150, h: 150, isDoorOpen: false }, { x: 2650, y: 400, w: 200, h: 250, isDoorOpen: false }, { x: 2100, y: 750, w: 350, h: 100, isDoorOpen: false },
  
  // CATHEDRAL (Bottom Left Town)
  { x: 300, y: 2300, w: 200, h: 200, isDoorOpen: false }, { x: 550, y: 2300, w: 150, h: 100, isDoorOpen: false }, { x: 300, y: 2550, w: 250, h: 150, isDoorOpen: false },
  { x: 600, y: 2450, w: 200, h: 200, isDoorOpen: false }, { x: 350, y: 2750, w: 150, h: 150, isDoorOpen: false },
  
  // ESTATE (Bottom Right Town)
  { x: 2300, y: 2300, w: 150, h: 150, isDoorOpen: false }, { x: 2500, y: 2300, w: 200, h: 100, isDoorOpen: false }, { x: 2300, y: 2500, w: 300, h: 200, isDoorOpen: false },
  { x: 2650, y: 2450, w: 150, h: 250, isDoorOpen: false }, { x: 2200, y: 2750, w: 200, h: 150, isDoorOpen: false },

  // CENTRAL PEAK (Middle High-Density Area)
  { x: 1300, y: 1300, w: 200, h: 200, isDoorOpen: false }, { x: 1550, y: 1300, w: 150, h: 250, isDoorOpen: false }, { x: 1300, y: 1550, w: 300, h: 150, isDoorOpen: false },
  { x: 1650, y: 1600, w: 200, h: 200, isDoorOpen: false }, { x: 1400, y: 1750, w: 150, h: 150, isDoorOpen: false }, { x: 1200, y: 1400, w: 100, h: 100, isDoorOpen: false },
  
  // OUTSKIRT WAREHOUSES
  { x: 1200, y: 600, w: 200, h: 150, isDoorOpen: false }, { x: 1600, y: 600, w: 200, h: 150, isDoorOpen: false },
  { x: 1200, y: 2200, w: 200, h: 150, isDoorOpen: false }, { x: 1600, y: 2200, w: 200, h: 150, isDoorOpen: false },
  { x: 600, y: 1400, w: 150, h: 200, isDoorOpen: false }, { x: 2200, y: 1400, w: 150, h: 200, isDoorOpen: false },
];

const ROADS = [
  // Main Highways
  { x: 0, y: 1450, w: 3000, h: 100 }, // Horizontal main
  { x: 1450, y: 0, w: 100, h: 3000 }, // Vertical main
  // Aerodrome to Forge
  { x: 400, y: 550, w: 2000, h: 60 }, 
  // Cathedral to Estate
  { x: 400, y: 2400, w: 2000, h: 60 },
  // Vertical Connecting
  { x: 600, y: 600, w: 60, h: 1800 },
  { x: 2350, y: 600, w: 60, h: 1800 },
];

const TREES = [
  // Forests scattered randomly between towns
  { x: 150, y: 150 }, { x: 250, y: 180 }, { x: 180, y: 250 }, { x: 900, y: 200 }, { x: 1000, y: 150 },
  { x: 1100, y: 250 }, { x: 1800, y: 200 }, { x: 1900, y: 300 }, { x: 2800, y: 150 }, { x: 2900, y: 250 },
  { x: 200, y: 800 }, { x: 300, y: 900 }, { x: 150, y: 1000 }, { x: 900, y: 800 }, { x: 1050, y: 900 },
  { x: 1100, y: 1100 }, { x: 1800, y: 900 }, { x: 1950, y: 1000 }, { x: 2800, y: 800 }, { x: 2900, y: 950 },
  { x: 2850, y: 1100 }, { x: 250, y: 1200 }, { x: 100, y: 1300 }, { x: 800, y: 1200 }, { x: 900, y: 1350 },
  { x: 2000, y: 1200 }, { x: 2100, y: 1300 }, { x: 2800, y: 1250 }, { x: 2900, y: 1350 }, { x: 150, y: 1800 },
  { x: 250, y: 1900 }, { x: 900, y: 1800 }, { x: 1050, y: 1900 }, { x: 1100, y: 2100 }, { x: 1800, y: 1950 },
  { x: 1950, y: 1850 }, { x: 2800, y: 1800 }, { x: 2900, y: 1900 }, { x: 2850, y: 2050 }, { x: 150, y: 2800 },
  { x: 250, y: 2900 }, { x: 180, y: 2750 }, { x: 900, y: 2850 }, { x: 1000, y: 2900 }, { x: 1100, y: 2750 },
  { x: 1800, y: 2800 }, { x: 1900, y: 2900 }, { x: 2800, y: 2850 }, { x: 2900, y: 2750 }, { x: 1200, y: 1000 },
  { x: 1300, y: 950 }, { x: 1650, y: 1050 }, { x: 1250, y: 1950 }, { x: 1700, y: 1900 }, { x: 1500, y: 1100 },
  { x: 1550, y: 1950 }, { x: 1000, y: 1500 }, { x: 2000, y: 1550 },
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
  isBot: boolean;
  dressColor: string;
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
  matchTime: number;
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
  const [showModeSelect, setShowModeSelect] = useState(false);
  const [matchType] = useState<'solo'>('solo');
  const [gameMode, setGameMode] = useState<'classic' | 'rank'>('classic');
  const [character, setCharacter] = useState('kelly');
  const [matchTimer, setMatchTimer] = useState(30);
  const [dropPoint, setDropPoint] = useState({ x: 1500, y: 1500 });
  const [playerData, setPlayerData] = useState({ 
    gold: 500, 
    diamonds: 0, 
    level: 1, 
    exp: 0, 
    unlockedCharacters: ['kelly'] as string[], 
    unlockedSkins: [] as string[],
    equippedSkin: 'default' as string 
  });
  const [matchRewards, setMatchRewards] = useState<{ exp: number, gold: number, rankValue: number } | null>(null);
  const [nearBuilding, setNearBuilding] = useState(false);
  const [dropTimer, setDropTimer] = useState(10);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [matchmakingPlayers, setMatchmakingPlayers] = useState<string[]>([]);
  const matchmakingPlayersRef = useRef<string[]>([]);
  const [matchmakingBots, setMatchmakingBots] = useState<string[]>([]);

  useEffect(() => {
    matchmakingPlayersRef.current = matchmakingPlayers;
  }, [matchmakingPlayers]);
  const [lastJoined, setLastJoined] = useState<string>('');
  const [killFeed, setKillFeed] = useState<{ id: number, killer: string, victim: string, weapon?: string }[]>([]);
  
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
    playerPos: { x: 1500, y: 1500, angle: 0 },
    safeZone: { x: 1500, y: 1500, radius: 1500 },
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
    safeZone: { x: 1500, y: 1500, radius: 1500, shrinkTimer: 60, nextRadius: 900 },
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
        const data = snapshot.val();
        setPlayerData({
          ...data,
          unlockedCharacters: data.unlockedCharacters || ['kelly'],
          unlockedSkins: data.unlockedSkins || [],
          exp: data.exp || 0
        });
      } else {
        const newData = { gold: 500, diamonds: 0, level: 1, exp: 0, unlockedCharacters: ['kelly'], unlockedSkins: [] };
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
    setMatchmakingBots([]);
    
    // Join matchmaking queue
    const matchRef = ref(db, 'matchmaking/' + playerName);
    set(matchRef, { name: playerName, joinedAt: Date.now() });
  };

  // --- Matchmaking Sync ---
  useEffect(() => {
    if (screen === 'matchmaking') {
      const allMatchRef = ref(db, 'matchmaking');
      const unsubscribe = onValue(allMatchRef, (snapshot) => {
        if (snapshot.exists()) {
          const players = Object.values(snapshot.val()) as any[];
          setMatchmakingPlayers(players.map(p => p.name));
        } else {
          setMatchmakingPlayers([]);
        }
      });
      return () => unsubscribe();
    }
  }, [screen, db]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (screen === 'matchmaking') {
      interval = setInterval(() => {
        setMatchTimer(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            setScreen('drop_selection');
            setDropTimer(15);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (screen === 'drop_selection') {
      const botPool = ["Ranger", "Scout", "Sniper", "Medic", "Heavy", "Assault", "Recon", "Warrior", "Phantom", "Ghost", "Shadow", "Hunter", "Viper", "Wolf", "Hawk", "Eagle", "Falcon", "Cobra", "Dragon", "Titan"];
      
      interval = setInterval(() => {
        const totalCount = matchmakingPlayers.length + matchmakingBots.length;
        
        // Trigger: If 2 or more real players join, start 10s countdown
        if (matchmakingPlayers.length >= 2 && dropTimer > 10) {
          setDropTimer(10);
        }

        if (totalCount < 20) {
          // Add bots rapidly
          setMatchmakingBots(prev => {
            if (prev.length + matchmakingPlayers.length < 20) {
              const nextBot = botPool[prev.length % botPool.length];
              if (!prev.includes(nextBot)) {
                setLastJoined(nextBot);
                // Clear notification after 1.5s
                setTimeout(() => setLastJoined(''), 1500);
                return [...prev, nextBot];
              }
            }
            return prev;
          });
        }
        
        setDropTimer(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            setTimeout(startGame, 500);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [screen, matchmakingPlayers.length]);

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (MAP_WIDTH / rect.width);
    const y = (e.clientY - rect.top) * (MAP_HEIGHT / rect.height);
    setDropPoint({ x, y });
  };

  const [isRespawning, setIsRespawning] = useState(false);
  const [respawnUsed, setRespawnUsed] = useState(false);

  const handlePlayerDeath = () => {
    // Check if player can respawn (Only once per match)
    if (!respawnUsed) {
      setIsRespawning(true);
      setRespawnUsed(true);
      setScreen('drop_selection');
      setDropTimer(20);
      addMessage("⚠️ YOU DIED! Respawning in 20s...");
    } else {
      triggerGameOver();
    }
  };

  const startGame = () => {
    if (isRespawning) {
      const p = state.current.localPlayer;
      if (p) {
        p.x = dropPoint.x;
        p.y = dropPoint.y;
        p.hp = 200;
        p.armor = 0;
        p.isAlive = true;
        p.ammo = WEAPONS[p.weapon].maxAmmo;
      }
      setScreen('game');
      setIsRespawning(false);
      addMessage("🚀 RESPAYWNED! Get back in the fight!");
      return;
    }

    setScreen('game');
    setRespawnUsed(false);
    setIsRespawning(false);
    
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
    state.current.matchTime = 0;

    // Generate Enemies
    const totalPlayers = 20;
    const realPlayers = matchmakingPlayersRef.current.filter(name => name !== playerName);
    const botNames = ["Ranger", "Scout", "Sniper", "Medic", "Heavy", "Assault", "Recon", "Warrior", "Phantom", "Ghost", "Shadow", "Hunter", "Viper", "Wolf", "Hawk", "Eagle", "Falcon", "Cobra", "Dragon", "Titan"];
    
    const enemies: Enemy[] = [];

    // Add real players as "enemies"
    const REAL_PLAYER_COLOR = '#FF5733'; // Consistent color for real players
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
        moveDir: { x: 0, y: 0 },
        isBot: false,
        dressColor: REAL_PLAYER_COLOR
      });
    });

    // Fill the rest with bots
    const getRandomColor = () => {
        const colors = ['#33FF57', '#3357FF', '#FF33A1', '#A133FF', '#33FFF5', '#FF8C33', '#8CFF33'];
        return colors[Math.floor(Math.random() * colors.length)];
    };
    const botsNeeded = Math.max(0, totalPlayers - realPlayers.length - 1); // -1 for local player
    for (let i = 0; i < botsNeeded; i++) {
      enemies.push({
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
        moveDir: { x: 0, y: 0 },
        isBot: true,
        dressColor: getRandomColor()
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
      
      state.current.matchTime++;
      
      // Zone only starts shrinking and damaging after 1 minute (60s)
      if (state.current.matchTime > 60) {
        state.current.safeZone.shrinkTimer--;
        
        if (state.current.safeZone.shrinkTimer <= 0) {
          state.current.safeZone.radius = Math.max(100, state.current.safeZone.radius - 80);
          state.current.safeZone.shrinkTimer = 45;
          state.current.zoneDamage += 1;
        }

        const zone = state.current.safeZone;
        const damage = state.current.zoneDamage;

        // Player Zone Damage
        const p = state.current.localPlayer;
        if (p) {
          const distToZone = Math.hypot(p.x - zone.x, p.y - zone.y);
          if (distToZone > zone.radius && p.isAlive) {
            p.hp = Math.max(0, p.hp - damage);
            if (p.hp <= 0) {
              p.isAlive = false;
              handlePlayerDeath();
            }
          }
        }

        // Bot Zone Damage
        state.current.enemies.forEach(bot => {
          if (bot.hp > 0) {
            const dist = Math.hypot(bot.x - zone.x, bot.y - zone.y);
            if (dist > zone.radius) {
              bot.hp = Math.max(0, bot.hp - damage);
              if (bot.hp <= 0) {
                // Add to kill feed
                const newKill = { id: Date.now() + Math.random(), killer: "The Zone", victim: bot.name, weapon: "environment" };
                setKillFeed(prev => [newKill, ...prev].slice(0, 5));
              }
            }
          }
        });
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
          playerPos: { x: p.x, y: p.y, angle: p.angle },
          safeZone: { x: state.current.safeZone.x, y: state.current.safeZone.y, radius: state.current.safeZone.radius },
        }));
      }
    }, 100);

    // Start Loop
    lastTimeRef.current = performance.now();
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    requestRef.current = requestAnimationFrame(gameLoop);
  };

  // --- Audio System ---
  const audioCtxRef = useRef<AudioContext | null>(null);

  const initAudio = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  };

  const playGunSound = (weaponType: string) => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();
    
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    if (weaponType === 'sniper') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.3);
      gain.gain.setValueAtTime(1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
      osc.start(now);
      osc.stop(now + 0.5);
    } else if (weaponType === 'shotgun') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(100, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.2);
      gain.gain.setValueAtTime(0.8, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    } else {
      osc.type = 'square';
      osc.frequency.setValueAtTime(250, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
    }
  };

  const playHitSound = () => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.05);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    osc.start(now);
    osc.stop(now + 0.1);
  };

  const triggerGameOver = () => {
    const p = state.current.localPlayer;
    if (!p) return;
    
    state.current.gameOverDisplay = true;
    const place = state.current.enemies.length + 1;
    setHud(prev => ({ ...prev, gameOver: true, place }));
    
    // Rewards
    let expGained = 0;
    let goldGained = 0;
    let rankChange = 0;
    
    if (gameMode === 'rank') {
      rankChange = Math.floor(p.kills * 10 - place * 2 + 10);
      state.current.rankPoints = Math.max(0, state.current.rankPoints + rankChange);
    } else {
      expGained = 50 + (p.kills * 20) + Math.max(0, (20 - place) * 10);
      goldGained = 20 + (p.kills * 15) + Math.max(0, (20 - place) * 5);
      
      const newExp = playerData.exp + expGained;
      const newLevel = Math.floor(newExp / 1000) + 1;
      
      const newPlayerData = {
        ...playerData, 
        exp: newExp, 
        level: newLevel,
        gold: playerData.gold + goldGained
      };
      setPlayerData(newPlayerData);
      set(ref(db, 'users/' + playerName), newPlayerData);
    }
    
    setMatchRewards({ exp: expGained, gold: goldGained, rankValue: rankChange });

    setRespawnUsed(false);
    setIsRespawning(false);

    setTimeout(() => {
      setScreen('lobby');
      state.current.isInGame = false;
      setHud(prev => ({ ...prev, gameOver: false }));
      setMatchRewards(null);
    }, 5000);
  };

  const triggerBooyah = () => {
    const p = state.current.localPlayer;
    if (!p) return;

    state.current.booyahDisplay = true;
    setHud(prev => ({ ...prev, booyah: true }));
    
    // Rewards
    let expGained = 0;
    let goldGained = 0;
    let rankChange = 0;
    
    if (gameMode === 'rank') {
      rankChange = 50 + p.kills * 15;
      state.current.rankPoints += rankChange;
    } else {
      expGained = 500 + p.kills * 50;
      goldGained = 300 + p.kills * 25;
      
      const newExp = playerData.exp + expGained;
      const newLevel = Math.floor(newExp / 1000) + 1;
      
      const newPlayerData = {
        ...playerData, 
        exp: newExp, 
        level: newLevel,
        gold: playerData.gold + goldGained
      };
      setPlayerData(newPlayerData);
      set(ref(db, 'users/' + playerName), newPlayerData);
    }
    
    setMatchRewards({ exp: expGained, gold: goldGained, rankValue: rankChange });

    setRespawnUsed(false);
    setIsRespawning(false);

    setTimeout(() => {
      setScreen('lobby');
      state.current.isInGame = false;
      setHud(prev => ({ ...prev, booyah: false }));
      setMatchRewards(null);
    }, 6000);
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
    playGunSound(weapon.type);

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

const checkProximityToBuildings = (p: Player) => {
  let near = null;
  for (let b of BUILDINGS) {
    const cx = Math.max(b.x, Math.min(p.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(p.y, b.y + b.h));
    const dist = Math.hypot(p.x - cx, p.y - cy);
    if (dist < 60) {
      if (!b.isDoorOpen) {
        b.isDoorOpen = true;
        addMessage("🚪 Automatically entered house!");
      }
      near = b;
      break;
    }
  }
  setNearBuilding(!!near);
};

const updateLocalMovement = () => {
    const p = state.current.localPlayer;
    if (!p || !p.isAlive) return;

    checkProximityToBuildings(p);
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

      // Find nearest target (Player or another Bot)
      let target: { x: number, y: number, id: string, isAlive?: boolean } | null = null;
      let minTargetDist = 200; // Aggro range

      // Check Player
      const distToPlayer = Math.hypot(p.x - bot.x, p.y - bot.y);
      if (p.isAlive && distToPlayer < minTargetDist) {
        target = p;
        minTargetDist = distToPlayer;
      }

      // Check other Bots (only if player is not already the closest target within range)
      // To prevent too much bot-on-bot violence too fast, we can make them less likely to target each other
      if (!target || Math.random() < 0.1) {
        state.current.enemies.forEach(other => {
          if (other.id === bot.id || other.hp <= 0) return;
          const d = Math.hypot(other.x - bot.x, other.y - bot.y);
          if (d < minTargetDist) {
            target = other;
            minTargetDist = d;
          }
        });
      }

      if (target) {
        const dx = target.x - bot.x;
        const dy = target.y - bot.y;
        const dist = Math.hypot(dx, dy);
        const angleToTarget = Math.atan2(dy, dx);
        
        // Normalize Bot: Aggressive movement
        bot.x += Math.cos(angleToTarget) * 1.5; 
        bot.y += Math.sin(angleToTarget) * 1.5;
        bot.angle = angleToTarget;

        const botWeapon = WEAPONS[bot.weapon];
        // Normalize Bot: Improved fire rate
        const isBotTarget = target.id !== "player";
        const shootDelayFactor = gameMode === 'rank' ? (isBotTarget ? 4 : 2) : (isBotTarget ? 6 : 3);
        
        if (now - bot.lastShoot > ((botWeapon?.fireRate || 200) * shootDelayFactor) && dist < 300) { 
          bot.lastShoot = now;
          
          // Normalize Bot: Higher accuracy
          const inaccuracy = (Math.random() - 0.5) * 0.1; 
          const shotAngle = bot.angle + inaccuracy;

          state.current.bullets.push({
            id: Date.now() + "_bot_" + Math.random(),
            x: bot.x + Math.cos(shotAngle) * 30,
            y: bot.y + Math.sin(shotAngle) * 30,
            dx: Math.cos(shotAngle) * 12,
            dy: Math.sin(shotAngle) * 12,
            ownerId: bot.id,
            damage: (botWeapon?.damage || 20) * (gameMode === 'classic' ? 0.7 : 0.9) // Lower damage in classic
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
        // Bullet hits enemy if owner is player OR a different bot
        if (b.ownerId !== enemy.id && enemy.hp > 0 && Math.hypot(b.x - enemy.x, b.y - enemy.y) < 28) {
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
            // Credit local player if they were the owner
            if (b.ownerId === "player") {
              p.kills++;
              state.current.rankPoints += 15;
            }
            
            // Add to kill feed
            const killerName = b.ownerId === "player" ? p.name : (state.current.enemies.find(e => e.id === b.ownerId)?.name || "Enemy");
            const newKill = { id: Date.now() + Math.random(), killer: killerName, victim: enemy.name, weapon: b.type };
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
          const newKill = { id: Date.now() + Math.random(), killer: killer ? killer.name : "Enemy", victim: p.name, weapon: b.type };
          setKillFeed(prev => [newKill, ...prev].slice(0, 5));
          
          handlePlayerDeath();
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

    // Ground - Lush Green
    ctx.fillStyle = '#1e3d2b'; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const worldToScreen = (x: number, y: number) => ({
      x: x - state.current.camera.x,
      y: y - state.current.camera.y
    });

    // Terrain Details (Optional: add some speckles for texture)
    ctx.fillStyle = '#1b3827';
    for(let i=0; i<500; i++) {
       // Simple hash-based speckles based on world coords would be better but let's just do static positions relative to camera
       // for better static feel.
    }

    // Roads
    ctx.fillStyle = '#2a2a2e';
    ROADS.forEach(r => {
      const pos = worldToScreen(r.x, r.y);
      ctx.fillRect(pos.x, pos.y, r.w, r.h);
      // Road markings
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
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

    // Safe zone - only visible after 1 minute
    if (state.current.matchTime >= 60) {
      const zonePos = worldToScreen(state.current.safeZone.x, state.current.safeZone.y);
      ctx.beginPath();
      ctx.arc(zonePos.x, zonePos.y, state.current.safeZone.radius, 0, Math.PI * 2);
      ctx.strokeStyle = '#D4AF37'; // accent-gold
      ctx.lineWidth = 3;
      ctx.stroke();
      
      // Outside zone effect
      ctx.beginPath();
      ctx.arc(zonePos.x, zonePos.y, state.current.safeZone.radius, 0, Math.PI * 2);
      ctx.rect(canvas.width, 0, -canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(212, 175, 55, 0.1)';
      ctx.fill();
    }

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
      drawHuman(ctx, pos.x, pos.y, enemy.angle, enemy.dressColor, enemy.name, enemy.hp, false);
    });

    // Player
    const p = state.current.localPlayer;
    if (p && p.isAlive) {
      const pos = worldToScreen(p.x, p.y);
      const clothColors: Record<string, string> = {
        'cloth-red': '#FF5733',
        'cloth-blue': '#3357FF',
        'cloth-green': '#33FF57',
        'cloth-purple': '#A133FF'
      };
      const playerColor = playerData.equippedSkin === 'default' ? '#FF5733' : (clothColors[playerData.equippedSkin] || '#3357FF');
      drawHuman(ctx, pos.x, pos.y, p.angle, playerColor, p.name, p.hp, true);
      
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

  const handleBuy = (type: 'character' | 'skin', itemId: string, cost: number, currency: 'gold' | 'diamonds') => {
    if (playerData[currency] >= cost) {
      const newPlayerData = {
        ...playerData,
        [currency]: playerData[currency] - cost,
        [type === 'character' ? 'unlockedCharacters' : 'unlockedSkins']: [...playerData[type === 'character' ? 'unlockedCharacters' : 'unlockedSkins'], itemId]
      };
      setPlayerData(newPlayerData);
      set(ref(db, 'users/' + playerName), newPlayerData);
      alert('Purchase successful!');
    } else {
      alert(`Not enough ${currency}!`);
    }
  };

  const handleEquip = (skinId: string) => {
    const newPlayerData = {
      ...playerData,
      equippedSkin: skinId
    };
    setPlayerData(newPlayerData);
    set(ref(db, 'users/' + playerName), newPlayerData);
  };

  // --- Render ---
  return (
    <div className="w-full h-screen overflow-hidden bg-bg-deep text-text-primary font-sans select-none">
      <AnimatePresence mode="wait">
        {screen === 'login' && (
          <motion.div 
            key="login"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="fixed inset-0 bg-bg-deep flex justify-center items-center z-[200]"
          >
          <div className="bg-bg-card p-[60px_40px] text-center border border-accent-gold/20 w-[400px] rounded-[32px] shadow-[0_20px_60px_rgba(0,0,0,0.8)] relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[6px] bg-gradient-to-r from-transparent via-accent-gold to-transparent"></div>
            <h1 className="text-[36px] sm:text-[42px] text-white mb-2 font-black italic tracking-[3px] uppercase drop-shadow-[0_4px_12px_rgba(212,175,55,0.4)]">FIRESTRIKEx</h1>
            <div className="text-[10px] text-accent-gold uppercase font-bold tracking-[6px] mb-12 opacity-80">Battle Foundation</div>
            
            <div className="relative mb-10 group">
              <input 
                type="text" 
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="PLAYER IDENTITY" 
                maxLength={15}
                className="w-full p-[18px] bg-black/40 border border-white/10 text-white text-[14px] outline-none text-center rounded-[18px] focus:border-accent-gold transition-all duration-300 font-bold tracking-[2px] placeholder:opacity-30 group-focus-within:shadow-[0_0_20px_rgba(212,175,55,0.1)]"
              />
            </div>
            
            <button 
              onClick={() => { initAudio(); goToLobby(); }}
              className="w-full p-[18px] bg-accent-gold text-bg-deep text-[16px] font-black uppercase tracking-[4px] cursor-pointer hover:brightness-110 active:scale-95 transition-all rounded-[20px] shadow-[0_10px_30px_rgba(212,175,55,0.3)] border-b-4 border-black/20"
            >
              IDENTITY CONFIRMED
            </button>
            <div className="mt-8 text-[9px] text-white/20 uppercase tracking-[2px]">Secured Connection Established</div>
          </div>
        </motion.div>
      )}

        {screen === 'lobby' && (
          <motion.div 
            key="lobby"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#0a0a0c] flex flex-col z-[200] overflow-hidden touch-none" 
            style={{
              backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(212, 175, 55, 0.05) 0%, transparent 60%), linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
              backgroundSize: '100% 100%, 40px 40px, 40px 40px'
            }}
          >
          {/* Floating Title */}
          <div className="absolute right-4 top-1/4 font-serif text-[32px] md:text-[48px] italic text-white/20 tracking-[6px] uppercase rotate-90 origin-right pointer-events-none whitespace-nowrap mix-blend-overlay">
            FIRESTRIKEx
          </div>

          {/* Top Bar */}
          <header className="h-[35px] sm:h-[50px] flex items-center justify-between px-2 md:px-4 shrink-0 mt-1 z-20">
            {/* Top Left: Profile */}
            <div className="flex items-center gap-1 bg-black/40 pr-2 rounded-full border border-white/10 backdrop-blur-sm scale-75 sm:scale-85 md:scale-100 origin-left">
              <div className="w-7 h-7 sm:w-9 sm:h-9 bg-accent-dim rounded-full flex items-center justify-center font-serif text-white text-[12px] sm:text-[16px] border-2 border-accent-gold shadow-[0_0_8px_rgba(212,175,55,0.5)]">
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

            {/* Top Bar Logo Idea (Centerized Title) */}
            <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
              <span className="text-white font-black text-[14px] sm:text-[18px] tracking-[3px] italic uppercase drop-shadow-[0_0_10px_rgba(212,175,55,0.5)]">FIRESTRIKEx</span>
              <div className="h-0.5 w-[40px] bg-accent-gold rounded-full"></div>
            </div>
          </header>

          {/* Main Lobby Area */}
          <div className="flex-1 flex items-center justify-center relative z-10">
            {/* Left Menu - Mobile Optimized */}
            <div className="absolute left-2 top-1/2 -translate-y-1/2 flex flex-col gap-1 sm:gap-2 w-[100px] sm:w-[140px]">
              {['STORE', 'INVENTORY', 'EVENTS'].map((item, idx) => (
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
            <div className="w-[140px] h-[220px] sm:w-[200px] sm:h-[300px] md:w-[280px] md:h-[400px] max-h-[35vh] bg-gradient-to-b from-black/60 to-black/90 border border-accent-gold/30 rounded-xl p-1.5 relative pointer-events-auto backdrop-blur-md shadow-[0_0_30px_rgba(212,175,55,0.1)] flex flex-col items-center justify-end overflow-hidden group transition-transform hover:scale-105">
              <div className="absolute inset-0 bg-[url('https://picsum.photos/seed/firestrike/300/450')] opacity-50 bg-cover bg-center mix-blend-overlay group-hover:opacity-60 transition-opacity"></div>
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>
              
              <div className="relative z-10 w-full text-center">
                <div className="font-serif text-[18px] sm:text-[24px] md:text-[36px] text-white capitalize font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] truncate px-1">{character}</div>
                <div className="text-[7px] sm:text-[9px] md:text-[12px] uppercase tracking-[1px] text-accent-gold mb-1 sm:mb-2 font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">Lv.{playerData.level} (EXP: {playerData.exp})</div>
                
                <select 
                   value={character}
                   onChange={(e) => setCharacter(e.target.value)}
                   className="w-full p-[4px] sm:p-[6px] bg-black/80 border border-accent-gold/40 text-white text-[7px] sm:text-[9px] outline-none appearance-none cursor-pointer uppercase tracking-[1px] hover:border-accent-gold hover:bg-accent-gold/10 transition-colors rounded text-center font-bold backdrop-blur-sm"
                >
                  {playerData.unlockedCharacters.map(char => (
                    <option key={char} value={char}>{char}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Bottom Bar - Mobile Optimized */}
          <div className="flex flex-col gap-1 sm:gap-2 px-2 pb-1 shrink-0 z-20">
            {/* Chat & Menus Row */}
            <div className="flex items-center justify-between h-[35px] sm:h-[45px]">
              {/* Chat */}
              <div className="bg-black/60 border border-white/10 rounded p-1 sm:p-2 flex items-center gap-1 backdrop-blur-sm w-[100px] sm:w-[130px] md:w-[250px]">
                <MessageSquare size={10} className="text-white/60 sm:w-[14px] sm:h-[14px]" />
                <span className="text-[7px] sm:text-[9px] md:text-[11px] text-white/60 truncate">World | Team Invite...</span>
              </div>

              {/* Menus */}
              <div className="flex gap-1 sm:gap-2 h-full items-center">
              </div>
            </div>

            {/* Mode & Start Row - Popup style UI */}
            <div className="flex items-end justify-between mt-0.5 gap-1.5 sm:gap-2 relative">
              <div className="flex flex-col gap-0.5 flex-1 max-w-[140px] sm:max-w-none">
                {/* Mode Select Popup */}
                {showModeSelect && (
                  <div className="absolute bottom-[45px] sm:bottom-[65px] left-0 w-full bg-black/90 border border-accent-gold/40 rounded p-1 sm:p-2 z-[60] flex flex-col gap-1 backdrop-blur-md animate-in fade-in slide-in-from-bottom-2">
                    <button 
                      onClick={() => { setGameMode('classic'); setShowModeSelect(false); startMatchmaking(); }}
                      className="w-full p-2 text-[10px] sm:text-[12px] uppercase font-bold text-white hover:bg-accent-gold hover:text-black border border-white/5 rounded transition-all"
                    >
                      Classic Match (Solo)
                    </button>
                    <button 
                      onClick={() => { setGameMode('rank'); setShowModeSelect(false); startMatchmaking(); }}
                      className="w-full p-2 text-[10px] sm:text-[12px] uppercase font-bold text-white hover:bg-red-600 border border-white/5 rounded transition-all"
                    >
                      Rank Match (Solo)
                    </button>
                  </div>
                )}

                {/* Match Info Display */}
                <div className="bg-black/80 border border-white/20 rounded p-1.5 sm:p-2.5 flex flex-col backdrop-blur-sm">
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 sm:w-5 sm:h-5 bg-accent-gold rounded flex items-center justify-center text-black font-extrabold text-[8px] sm:text-[10px]">
                      {gameMode === 'classic' ? 'CL' : 'RN'}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-white/60 text-[6px] sm:text-[8px] uppercase tracking-tighter">Current Mode</span>
                      <span className="text-white font-black text-[9px] sm:text-[11px] uppercase tracking-wide truncate">
                        {gameMode === 'classic' ? 'Classic' : 'Rank'} Match
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => setShowModeSelect(!showModeSelect)}
                className="h-[38px] sm:h-[55px] md:h-[65px] px-5 sm:px-10 md:px-14 font-black bg-accent-gold text-black uppercase tracking-[2px] cursor-pointer hover:brightness-110 active:scale-95 transition-all text-[14px] sm:text-[20px] md:text-[26px] rounded shadow-[0_0_20px_rgba(212,175,55,0.4)] border-b-2 sm:border-b-4 border-[rgba(0,0,0,0.3)]"
              >
                {showModeSelect ? 'CANCEL' : 'START'}
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Modal Overlay */}
      <AnimatePresence>
        {activeModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-[500] backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className={`bg-bg-card border border-accent-gold/50 ${(activeModal === 'STORE' || activeModal === 'EVENTS') ? 'max-w-[700px] p-6' : 'max-w-[400px] p-8'} rounded-xl w-[95%] w-full shadow-[0_0_30px_rgba(212,175,55,0.15)] relative max-h-[90vh] flex flex-col`}
            >
              <h3 className="text-accent-gold font-serif text-[24px] uppercase tracking-[2px] mb-4 text-center shrink-0">{activeModal}</h3>
              
              <div className="flex-1 overflow-y-auto min-h-0 text-left mb-6 pr-2">
                {activeModal === 'STORE' ? (                
                  <div className="space-y-6">
                    <div className="flex justify-between items-center bg-black/40 p-3 border border-white/10 rounded">
                      <span className="text-white text-sm">Your Gold: <span className="text-accent-gold font-bold">{playerData.gold}</span></span>
                      <span className="text-white text-sm">Your Diamonds: <span className="text-cyan-400 font-bold">{playerData.diamonds}</span></span>
                    </div>
                    
                    <div>
                      <h4 className="text-white font-bold uppercase tracking-[2px] mb-3 text-sm border-b border-white/10 pb-1">Characters</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {['nairi', 'alok', 'chrono'].map(char => (
                          <div key={char} className="border border-white/10 bg-black/40 p-3 rounded flex flex-col justify-between">
                            <div>
                               <h5 className="text-white font-bold capitalize mb-1">{char}</h5>
                               <p className="text-accent-gold text-xs font-bold mb-3">{char === 'alok' ? '5000' : '2000'} Gold</p>
                            </div>
                            {playerData.unlockedCharacters.includes(char) 
                              ? <button disabled className="bg-white/20 text-white/50 w-full py-1.5 text-xs font-bold uppercase rounded cursor-not-allowed">Owned</button>
                              : <button onClick={() => handleBuy('character', char, char === 'alok' ? 5000 : 2000, 'gold')} className="bg-accent-gold text-black w-full py-1.5 text-xs font-bold uppercase rounded hover:brightness-110">Buy</button>
                            }
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-white font-bold uppercase tracking-[2px] mb-3 text-sm border-b border-white/10 pb-1">Clothing Skins</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {[
                          { id: 'cloth-red', name: 'Red Suit', cost: 2, type: 'gold', color: '#FF5733' },
                          { id: 'cloth-blue', name: 'Blue Suit', cost: 2, type: 'gold', color: '#3357FF' },
                          { id: 'cloth-green', name: 'Green Suit', cost: 3, type: 'gold', color: '#33FF57' },
                          { id: 'cloth-purple', name: 'Purple Suit', cost: 3, type: 'gold', color: '#A133FF' }
                        ].map(skin => (
                          <div key={skin.id} className="border border-white/10 bg-black/40 p-3 rounded flex flex-col justify-between">
                            <div className="flex items-center gap-2 mb-2">
                               <div className="w-4 h-4 rounded-full" style={{ backgroundColor: skin.color }}></div>
                               <h5 className="text-white font-bold truncate">{skin.name}</h5>
                            </div>
                            <p className="text-accent-gold text-xs font-bold mb-3">{skin.cost} Gold</p>
                            {playerData.unlockedSkins.includes(skin.id) 
                              ? (playerData.equippedSkin === skin.id 
                                  ? <button disabled className="bg-green-600/50 text-white w-full py-1.5 text-xs font-bold uppercase rounded cursor-default">Equipped</button>
                                  : <button onClick={() => handleEquip(skin.id)} className="bg-blue-600 text-white w-full py-1.5 text-xs font-bold uppercase rounded hover:brightness-110">Equip</button>
                                )
                               : <button onClick={() => handleBuy('skin', skin.id, skin.cost, 'gold')} className="bg-accent-gold text-black w-full py-1.5 text-xs font-bold uppercase rounded hover:brightness-110">Buy</button>
                            }
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : activeModal === 'INVENTORY' ? (
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-white font-bold uppercase tracking-[2px] mb-3 text-sm border-b border-white/10 pb-1">Your Characters</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {playerData.unlockedCharacters.map(char => (
                          <div key={char} className="border border-white/10 bg-black/40 p-3 rounded text-center">
                            <h5 className="text-white font-bold capitalize">{char}</h5>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-white font-bold uppercase tracking-[2px] mb-3 text-sm border-b border-white/10 pb-1">Your Skins</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {[
                          { id: 'm4a1-gold', name: 'Golden M4A1' },
                          { id: 'awm-dragon', name: 'Dragon AWM' },
                          { id: 'mp5-toxic', name: 'Toxic MP5' }
                        ].filter(skin => playerData.unlockedSkins.includes(skin.id)).map(skin => (
                          <div key={skin.id} className="border border-white/10 bg-black/40 p-3 rounded flex flex-col justify-between">
                            <h5 className="text-white font-bold mb-3">{skin.name}</h5>
                            {playerData.equippedSkin === skin.id 
                                  ? <button disabled className="bg-green-600/50 text-white w-full py-1.5 text-xs font-bold uppercase rounded cursor-default">Equipped</button>
                                  : <button onClick={() => handleEquip(skin.id)} className="bg-blue-600 text-white w-full py-1.5 text-xs font-bold uppercase rounded hover:brightness-110">Equip</button>
                            }
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : activeModal === 'EVENTS' ? (
                  <div className="space-y-4">
                    {[
                      { title: 'Top Reward Drop', desc: 'Play 3 Classic matches today and get 500 Gold!', status: 'IN PROGRESS' },
                      { title: 'Ranked Warrior', desc: 'Secure Booyah in Rank mode for a chance to win 50 Diamonds.', status: 'ACTIVE' },
                      { title: 'Weekend Challenge', desc: 'Coming this weekend: 2x EXP and Gold limit increased.', status: 'UPCOMING' },
                    ].map((ev, i) => (
                      <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between border border-accent-gold/20 bg-black/40 p-4 rounded-lg gap-4">
                        <div>
                          <h4 className="text-accent-gold font-bold text-lg mb-1">{ev.title}</h4>
                          <p className="text-white/70 text-sm">{ev.desc}</p>
                        </div>
                        <button className="px-6 py-2 bg-white/10 text-white text-xs font-bold rounded uppercase whitespace-nowrap border border-white/20 hover:bg-white/20">
                          {ev.status}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-text-secondary text-[14px] mb-8">This feature is currently under development. Check back later for updates!</p>
                  </div>
                )}
              </div>
              
              <button 
                onClick={() => setActiveModal(null)}
                className="px-8 py-3 w-full sm:w-auto self-center bg-accent-gold text-black font-bold uppercase tracking-[2px] rounded hover:brightness-110 transition-all shrink-0 mt-auto"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {screen === 'matchmaking' && (
        <motion.div 
          key="matchmaking"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-bg-deep flex flex-col items-center justify-center z-[200]"
        >
          <div className="w-[60px] h-[60px] border-4 border-border-dark border-t-accent-gold rounded-full animate-spin mb-6"></div>
          <h2 className="text-[20px] text-accent-gold mb-1 font-serif italic uppercase tracking-[2px]">Matchmaking</h2>
          <div className="text-[12px] text-text-secondary uppercase tracking-[2px] mb-4">Searching for session...</div>
          <div className="font-serif text-[48px] text-text-primary mb-3">00:{matchTimer < 10 ? `0${matchTimer}` : matchTimer}</div>
          <div className="mt-4 text-white/30 text-[10px] uppercase tracking-widest animate-pulse">Wait for transition</div>
        </motion.div>
      )}

        {screen === 'drop_selection' && (
          <motion.div 
            key="drop_selection"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="fixed inset-0 bg-bg-deep flex flex-col items-center justify-center z-[200] px-4 overflow-hidden"
          >
            {/* Top Right DROP button */}
            <div className="fixed top-4 right-4 z-[300]">
              <motion.button 
                whileTap={{ scale: 0.9 }}
                onClick={() => { setDropTimer(0); startGame(); }}
                className="px-6 py-2 bg-accent-gold text-bg-deep font-black uppercase tracking-[2px] rounded-full shadow-[0_5px_15px_rgba(212,175,55,0.4)] border-b-2 border-black/20"
              >
                DROP
              </motion.button>
            </div>

            <div className="flex flex-col items-center justify-center w-full max-w-[400px]">
              {/* Header Area */}
              <div className="flex flex-col items-center mb-4 shrink-0">
                <h2 className="text-[18px] sm:text-[24px] text-accent-gold mb-1 font-serif italic uppercase tracking-[2px] drop-shadow-md">
                  {isRespawning ? 'Respawn Drop' : 'Select Drop Point'}
                </h2>
                <div className="flex items-center gap-3 mb-1">
                  <div className="bg-black/60 px-3 py-1 rounded-full border border-white/10 flex items-center gap-2">
                    <Users size={12} className="text-accent-gold" />
                    <span className="text-[11px] sm:text-[13px] text-white font-black">{matchmakingPlayers.length + matchmakingBots.length} / 20</span>
                  </div>
                  <div className="text-[9px] sm:text-[11px] text-white/40 uppercase tracking-[1px]">{isRespawning ? 'Respawning' : 'Players joining'}</div>
                </div>
                
                {/* Last Joined Notification Bubble */}
                {!isRespawning && (
                  <div className={`transition-all duration-300 h-5 ${lastJoined ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'}`}>
                    <span className="text-[9px] bg-white/5 border border-white/10 px-2.5 py-0.5 rounded-full text-white/50">
                      <span className="text-accent-gold font-bold">{lastJoined}</span> joined
                    </span>
                  </div>
                )}
              </div>

              {/* Map Container - Full size / larger for better selection */}
              <div className="relative flex flex-col items-center group shrink-0 w-full max-w-[400px]">
                <div 
                  className="w-[90vw] h-[90vw] max-w-[400px] max-h-[400px] bg-[#1e3d2b] border-[3px] border-accent-gold/40 relative cursor-crosshair overflow-hidden rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] transition-all"
                  onClick={handleMapClick}
                >
                  <svg width="400" height="400" viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} className="absolute inset-0 pointer-events-none">
                    {/* Lush Ground Pattern with slight texture */}
                    <rect x="0" y="0" width={MAP_WIDTH} height={MAP_HEIGHT} fill="#1e3d2b" />
                    <defs>
                      <radialGradient id="landGrad" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#254a34" />
                        <stop offset="100%" stopColor="#1e3d2b" />
                      </radialGradient>
                    </defs>
                    <rect x="0" y="0" width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#landGrad)" />
                    
                    {ROADS.map((r, i) => (
                      <rect key={`road-${i}`} x={r.x} y={r.y} width={r.w} height={r.h} fill="#2a2a2e" opacity="0.9" />
                    ))}
                    {BUILDINGS.map((b, i) => (
                      <rect key={`bldg-${i}`} x={b.x} y={b.y} width={b.w} height={b.h} fill="#151517" stroke="#3a3a3e" strokeWidth="3" />
                    ))}
                    {TREES.map((t, i) => (
                      <circle key={`tree-${i}`} cx={t.x} cy={t.y} r="30" fill="#0D2B1D" stroke="#153625" strokeWidth="2" />
                    ))}

                    {/* Highly Stylized Landmark Labels (Zone specific) */}
                    <g opacity="0.2">
                      <text x="600" y="600" fill="white" fontSize="140" fontWeight="900" textAnchor="middle" style={{ fontStyle: 'italic', letterSpacing: '4px' }}>AERODROME</text>
                      <text x="2400" y="600" fill="white" fontSize="140" fontWeight="900" textAnchor="middle" style={{ fontStyle: 'italic', letterSpacing: '4px' }}>FORGE</text>
                      <text x="600" y="2400" fill="white" fontSize="140" fontWeight="900" textAnchor="middle" style={{ fontStyle: 'italic', letterSpacing: '4px' }}>CATHEDRAL</text>
                      <text x="2400" y="2400" fill="white" fontSize="140" fontWeight="900" textAnchor="middle" style={{ fontStyle: 'italic', letterSpacing: '4px' }}>ESTATE</text>
                      <text x="1500" y="1500" fill="white" fontSize="180" fontWeight="900" textAnchor="middle" style={{ fontStyle: 'italic', letterSpacing: '8px' }}>CENTRAL PEAK</text>
                    </g>

                    {/* Grid lines for "Real Map" feel */}
                    <path d={`M ${MAP_WIDTH/2} 0 V ${MAP_HEIGHT}`} stroke="white" strokeWidth="2" opacity="0.05" />
                    <path d={`M 0 ${MAP_HEIGHT/2} H ${MAP_WIDTH}`} stroke="white" strokeWidth="2" opacity="0.05" />
                  </svg>

                  {/* Scanline Effect */}
                  <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-white/5 to-transparent h-[40%] animate-scanline" />

                  {/* Marker */}
                  <div 
                    className="absolute w-6 h-6 sm:w-8 sm:h-8 border-[2px] sm:border-4 border-white rounded-full transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none transition-all duration-200"
                    style={{ left: `${(dropPoint.x / MAP_WIDTH) * 100}%`, top: `${(dropPoint.y / MAP_HEIGHT) * 100}%` }}
                  >
                    <div className="absolute inset-0 bg-white/30 rounded-full animate-ping"></div>
                    <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 bg-white rounded-full shadow-[0_0_10px_white]"></div>
                  </div>
                </div>

                {/* Timer Overlay */}
                <div className="absolute -top-2 -right-2 w-10 h-10 sm:w-16 sm:h-16 bg-bg-deep border-[2px] border-accent-gold rounded-full flex flex-col items-center justify-center shadow-2xl z-20">
                  <span className="text-[7px] sm:text-[10px] text-accent-gold uppercase font-black leading-none">SEC</span>
                  <span className="text-[14px] sm:text-[20px] text-white font-serif font-black leading-none">{dropTimer}</span>
                </div>

                {isRespawning && (
                  <div className="mt-4 text-[12px] text-red-500 font-bold animate-pulse uppercase tracking-[2px]">
                    Respawn Available
                  </div>
                )}
                
                <div className="mt-6 text-white/30 text-[9px] uppercase tracking-widest font-bold">Touch Map to Aim</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {screen === 'game' && (
        <div className="fixed inset-0 bg-black z-[300] touch-none overflow-hidden">
          <canvas
            ref={canvasRef}
            className="block w-full h-full"
          />

          {/* MiniMap Overlay - Solid Non-Transparent background */}
          <div className="absolute top-4 left-4 w-[90px] h-[90px] sm:w-[130px] sm:h-[130px] bg-[#1a3626] border-2 border-accent-gold rounded-lg overflow-hidden z-[350] shadow-2xl">
            <div className="relative w-full h-full">
              <svg 
                viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} 
                className="w-full h-full transition-transform duration-100 ease-out"
                style={{
                  transform: `scale(4) translate(${-(hud.playerPos.x/MAP_WIDTH)*100 + 12.5}%, ${-(hud.playerPos.y/MAP_HEIGHT)*100 + 12.5}%)`
                }}
              >
                <rect x="0" y="0" width={MAP_WIDTH} height={MAP_HEIGHT} fill="#1e3d2b" />
                <defs>
                  <radialGradient id="miniLandGrad" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#254a34" />
                    <stop offset="100%" stopColor="#1e3d2b" />
                  </radialGradient>
                </defs>
                <rect x="0" y="0" width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#miniLandGrad)" />

                {ROADS.map((r, i) => (
                  <rect key={`mini-road-${i}`} x={r.x} y={r.y} width={r.w} height={r.h} fill="#2a2a2e" opacity="0.9" />
                ))}
                {BUILDINGS.map((b, i) => (
                  <rect key={`mini-bldg-${i}`} x={b.x} y={b.y} width={b.w} height={b.h} fill="#151517" stroke="#3a3a3e" strokeWidth="3" />
                ))}
                {TREES.map((t, i) => (
                  <circle key={`mini-tree-${i}`} cx={t.x} cy={t.y} r="30" fill="#0D2B1D" stroke="#153625" strokeWidth="2" />
                ))}

                {/* Highly Stylized Landmark Labels (Zone specific) */}
                <g opacity="0.4">
                  <text x="600" y="600" fill="white" fontSize="140" fontWeight="900" textAnchor="middle" style={{ fontStyle: 'italic', letterSpacing: '4px' }}>AERODROME</text>
                  <text x="2400" y="600" fill="white" fontSize="140" fontWeight="900" textAnchor="middle" style={{ fontStyle: 'italic', letterSpacing: '4px' }}>FORGE</text>
                  <text x="600" y="2400" fill="white" fontSize="140" fontWeight="900" textAnchor="middle" style={{ fontStyle: 'italic', letterSpacing: '4px' }}>CATHEDRAL</text>
                  <text x="2400" y="2400" fill="white" fontSize="140" fontWeight="900" textAnchor="middle" style={{ fontStyle: 'italic', letterSpacing: '4px' }}>ESTATE</text>
                  <text x="1500" y="1500" fill="white" fontSize="180" fontWeight="900" textAnchor="middle" style={{ fontStyle: 'italic', letterSpacing: '8px' }}>CENTRAL PEAK</text>
                </g>

                {/* Grid lines for MiniMap */}
                <path d={`M ${MAP_WIDTH/2} 0 V ${MAP_HEIGHT}`} stroke="white" strokeWidth="2" opacity="0.05" />
                <path d={`M 0 ${MAP_HEIGHT/2} H ${MAP_WIDTH}`} stroke="white" strokeWidth="2" opacity="0.05" />
                
                {/* Safe Zone on MiniMap */}
                {state.current.matchTime >= 60 && (
                  <circle 
                    cx={hud.safeZone.x} 
                    cy={hud.safeZone.y} 
                    r={hud.safeZone.radius} 
                    fill="transparent" 
                    stroke="rgba(255,255,255,0.4)" 
                    strokeWidth="15"
                    strokeDasharray="30,30"
                  />
                )}
                
                {/* Enemies on MiniMap - Radar feel */}
                {state.current.enemies.map(e => (
                  e.hp > 0 && Math.hypot(e.x - hud.playerPos.x, e.y - hud.playerPos.y) < 500 && (
                    <circle key={`radar-${e.id}`} cx={e.x} cy={e.y} r="15" fill="#ff4444" className="animate-pulse" />
                  )
                ))}

                {/* Player Navigation Arrow */}
                <g transform={`translate(${hud.playerPos.x}, ${hud.playerPos.y}) rotate(${hud.playerPos.angle * 180 / Math.PI})`}>
                  <path d="M -20, -20 L 30, 0 L -20, 20 Z" fill="#FFD700" stroke="#000" strokeWidth="3" />
                </g>
              </svg>
              
              {/* Overlay HUD elements for MiniMap */}
              <div className="absolute inset-0 pointer-events-none ring-1 ring-inset ring-white/20">
                <div className="absolute top-1 left-1.5 text-[7px] text-white/40 font-black tracking-tighter uppercase">GPS Signal</div>
                {/* Scanning Effect */}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-accent-gold/5 to-transparent h-[20%] w-full animate-scanline opacity-30" />
              </div>
            </div>
          </div>

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

            {/* Bottom Left: Backpack & Movement Joystick */}
            <div className="absolute left-[30px] bottom-[30px] pointer-events-none z-[310]">
               {/* Backpack */}
               <button className="w-10 h-10 bg-black/40 border border-white/20 rounded-md flex items-center justify-center text-white mb-4 pointer-events-auto active:scale-95 shadow-lg backdrop-blur-sm">
                 <Luggage size={20} />
               </button>

               {/* Movement Joystick Visual */}
               <div ref={leftJoyBaseRef} className="w-[100px] h-[100px] bg-white/5 rounded-full border-2 border-white/10 flex items-center justify-center">
                 <div ref={leftJoyStickRef} className="w-[45px] h-[45px] bg-white/20 rounded-full border border-white/30 shadow-[0_0_10px_rgba(255,255,255,0.2)]"></div>
               </div>
            </div>

            {/* Bottom Right: Attack & Action Buttons */}
            <div className="absolute right-[30px] bottom-[30px] w-[140px] h-[140px] pointer-events-none z-[310]">
               {/* Right Joystick Visual (Now the Fire Joystick) */}
               <div ref={rightJoyBaseRef} className="absolute right-0 bottom-0 w-[110px] h-[110px] bg-white/5 rounded-full border-4 border-white/10 flex items-center justify-center transition-all">
                  <div ref={rightJoyStickRef} className="w-[65px] h-[65px] bg-white/15 rounded-full border-2 border-white/20 shadow-[0_0_20px_rgba(255,255,255,0.15)] flex items-center justify-center backdrop-blur-sm transition-transform duration-75">
                    <Sword size={32} className="text-white fill-white/10" />
                  </div>
               </div>

               {/* Skill Button (Remains) */}
               <button 
                 onClick={useCharacterSkill}
                 className="absolute right-[85px] bottom-[100px] w-12 h-12 bg-gradient-to-tr from-accent-gold to-yellow-600 border border-white/30 rounded-full pointer-events-auto flex items-center justify-center active:scale-90 transition-transform shadow-[0_0_15px_gold] z-[320]"
               >
                 <Target size={22} className="text-white" />
               </button>
            </div>
            
            {/* Auto Aim Hint - Floating */}
            <div className="absolute right-[25px] bottom-[210px] text-white/40 text-[9px] uppercase tracking-[1.5px] pointer-events-none text-right font-bold italic">
              Touch Area Right for AIM & AUTO
            </div>
          </div>

          {/* HUD Overlay */}
          <div className="absolute inset-0 pointer-events-none z-[350]">
            {/* HUD Top Left: Mini Map Placeholder */}
            <div className="absolute top-2 left-2 w-[100px] h-[100px] sm:w-[130px] sm:h-[130px] bg-black/40 border-2 border-white/20 rounded shadow-lg overflow-hidden flex items-center justify-center">
               <div className="absolute inset-0 opacity-40 bg-[url('https://picsum.photos/seed/map/200/200')] bg-cover"></div>
               <div className="relative z-10 text-[10px] text-white/60 font-black uppercase tracking-widest text-center px-1">
                 <Map size={16} className="mx-auto mb-1 opacity-60" />
                 Sector {state.current.safeZone.radius > 500 ? 'A1' : 'B2'}
               </div>
               {/* Player dot on mini map */}
               <div className="absolute w-2 h-2 bg-accent-gold rounded-full border border-white animate-pulse" />
            </div>

            {/* HUD Top Right: Game Info */}
            <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
               <div className="flex gap-2 items-center scale-90 sm:scale-100">
                  <div className="flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded border border-white/10">
                     <Users size={12} className="text-accent-gold" />
                     <span className="text-white text-[12px] font-bold">{hud.alive}</span>
                  </div>
                  <div className="flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded border border-white/10">
                     <Skull size={12} className="text-red-500" />
                     <span className="text-white text-[12px] font-bold">{hud.kills}</span>
                  </div>
                  <Settings size={18} className="text-white/60 pointer-events-auto cursor-pointer ml-1" onClick={() => setScreen('lobby')} />
               </div>
               <div className="text-[9px] text-white/40 uppercase tracking-widest">FPS: 60 | Ping: 24ms</div>
            </div>

            {/* HUD Top Center: Safe Zone Info */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center">
               <div className="bg-black/60 border border-accent-gold/50 px-6 py-1 rounded-full text-white text-[10px] font-bold tracking-[2px] uppercase backdrop-blur-md shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                 Safe Zone Shrinking: {hud.zoneTimer}s
               </div>
               <div className="mt-1 text-accent-gold text-[9px] font-black tracking-widest uppercase animate-pulse">
                 Time-limited auto-revival: Enabled
               </div>
            </div>
            
            {/* HUD Bottom Center: HP & Armor Bar */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[200px] sm:w-[300px] flex flex-col items-center gap-1">
               {/* Armor Bar */}
               {hud.armor > 0 && (
                 <div className="w-full h-1 bg-black/40 rounded-full overflow-hidden border border-white/10">
                    <div className="h-full bg-blue-500 transition-all duration-300 shadow-[0_0_10px_rgba(59,130,246,0.5)]" style={{ width: `${(hud.armor / 200) * 100}%` }} />
                 </div>
               )}
               {/* HP Bar Container */}
               <div className="w-full h-3 sm:h-4 bg-black/50 border-2 border-white/20 rounded overflow-hidden relative shadow-2xl backdrop-blur-sm">
                  <div className="h-full bg-accent-gold transition-all duration-300" style={{ width: `${(hud.hp / 200) * 100}%` }} />
                  <div className="absolute inset-0 flex items-center justify-center text-[8px] sm:text-[10px] font-black text-white mix-blend-difference uppercase tracking-widest">
                    HP {Math.max(0, hud.hp)} / 200
                  </div>
               </div>
            </div>

            {/* Kill Feed - Professional Battle Royale Style */}
            <div className="absolute top-[80px] left-4 flex flex-col gap-2 pointer-events-none">
              <AnimatePresence>
                {killFeed.map((k, i) => (
                  <motion.div 
                    key={k.id}
                    initial={{ opacity: 0, x: -20, scale: 0.9 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="flex items-center gap-2"
                  >
                    {/* Dark translucent background with sleek border */}
                    <div className="bg-black/80 ring-1 ring-white/10 px-3 py-1 rounded flex items-center gap-3 shadow-xl backdrop-blur-md">
                      <span className={`font-black uppercase tracking-[1px] text-[10px] ${k.killer === playerData.username ? 'text-accent-gold' : 'text-white'}`}>
                        {k.killer}
                      </span>
                      
                      <div className="bg-white/10 p-1 rounded-sm">
                        {k.weapon === 'sniper' ? <Target size={12} className="text-accent-gold" /> :
                         k.weapon === 'shotgun' ? <Zap size={12} className="text-accent-gold" /> :
                         k.weapon === 'environment' ? <CloudRain size={12} className="text-white/40" /> :
                         <Sword size={12} className="text-accent-gold" />}
                      </div>
                      
                      <Skull size={12} className="text-red-500" />

                      <span className={`font-black uppercase tracking-[1px] text-[10px] ${k.victim === playerData.username ? 'text-red-500' : 'text-white'}`}>
                        {k.victim}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Weapon Panel - Bottom Right Area above Joystick */}
            <div className="absolute bottom-[220px] right-4 bg-black/60 p-2 border border-white/10 rounded flex flex-col items-end backdrop-blur-sm shadow-xl">
               <div className="text-[10px] font-black text-accent-gold uppercase mb-0.5 tracking-wider">{hud.weaponName}</div>
               <div className="flex items-center gap-2">
                 <div className="h-1 w-12 bg-white/20 rounded-full overflow-hidden">
                    <div className="h-full bg-white transition-all" style={{ width: `${(hud.ammo / hud.maxAmmo) * 100}%` }} />
                 </div>
                 <div className="text-[14px] font-black text-white italic">{hud.ammo}<span className="text-[10px] text-white/50 not-italic ml-0.5">/{hud.maxAmmo}</span></div>
               </div>
            </div>

            {/* Quick Messages */}
            <div className="absolute left-4 bottom-[150px] flex flex-col gap-1 z-[360] pointer-events-auto">
               <button onClick={handleQuickChat} className="w-8 h-8 bg-black/60 rounded-full border border-white/20 flex items-center justify-center text-white/80 active:scale-90 transition-transform">
                  <MessageSquare size={14} />
               </button>
            </div>

            {/* Booyah Screen */}
            {hud.booyah && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[400] pointer-events-none flex flex-col items-center animate-booyah">
                <div className="text-[48px] md:text-[64px] font-serif italic text-accent-gold whitespace-nowrap text-center drop-shadow-[0_0_30px_rgba(212,175,55,0.8)] leading-none">
                  BOOYAH!<br/>
                  <span className="text-[14px] md:text-[18px] uppercase tracking-[8px] text-white font-bold not-italic">Victory Royale</span>
                </div>
                {matchRewards && (
                  <div className="mt-8 bg-black/80 border border-accent-gold/40 p-4 rounded-xl backdrop-blur-md min-w-[250px] text-center shadow-[0_0_30px_rgba(212,175,55,0.2)]">
                    <h3 className="text-white text-[12px] uppercase tracking-widest font-bold mb-3 border-b border-white/10 pb-2">Match Rewards</h3>
                    {gameMode === 'rank' ? (
                      <div className="text-accent-gold text-[20px] font-black uppercase tracking-widest">
                        Rank Points: <span className="text-green-400">+{matchRewards.rankValue}</span>
                      </div>
                    ) : (
                      <div className="flex justify-around items-center gap-4">
                        <div className="flex flex-col">
                           <span className="text-white/60 text-[10px] uppercase font-bold tracking-widest">EXP</span>
                           <span className="text-white text-[20px] font-black">+{matchRewards.exp}</span>
                        </div>
                        <div className="w-[1px] h-8 bg-white/20"></div>
                        <div className="flex flex-col">
                           <span className="text-white/60 text-[10px] uppercase font-bold tracking-widest">Gold</span>
                           <span className="text-accent-gold text-[20px] font-black">+{matchRewards.gold}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Game Over Screen */}
            {hud.gameOver && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[400] pointer-events-none flex flex-col items-center animate-booyah">
                <div className="text-[48px] md:text-[64px] font-serif italic text-red-500 whitespace-nowrap text-center drop-shadow-[0_0_30px_rgba(255,0,0,0.8)] leading-none">
                  DEFEAT<br/>
                  <span className="text-[14px] md:text-[18px] uppercase tracking-[8px] text-white font-bold not-italic">Rank #{hud.place}</span>
                </div>
                {matchRewards && (
                  <div className="mt-8 bg-black/80 border border-white/20 p-4 rounded-xl backdrop-blur-md min-w-[250px] text-center">
                    <h3 className="text-white text-[12px] uppercase tracking-widest font-bold mb-3 border-b border-white/10 pb-2">Match Report</h3>
                    {gameMode === 'rank' ? (
                      <div className="text-white/80 text-[20px] font-black uppercase tracking-widest">
                        Rank Points: <span className={matchRewards.rankValue >= 0 ? "text-green-400" : "text-red-500"}>
                          {matchRewards.rankValue > 0 ? '+' : ''}{matchRewards.rankValue}
                        </span>
                      </div>
                    ) : (
                      <div className="flex justify-around items-center gap-4">
                        <div className="flex flex-col">
                           <span className="text-white/60 text-[10px] uppercase font-bold tracking-widest">EXP</span>
                           <span className="text-white text-[20px] font-black">+{matchRewards.exp}</span>
                        </div>
                        <div className="w-[1px] h-8 bg-white/20"></div>
                        <div className="flex flex-col">
                           <span className="text-white/60 text-[10px] uppercase font-bold tracking-widest">Gold</span>
                           <span className="text-accent-gold text-[20px] font-black">+{matchRewards.gold}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
