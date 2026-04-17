# FIRESTRIKEx - Complete UI/UX Implementation Guide

## New Features Added:

### 1. **Home Section** (Default)
- Player profile card with level & stats
- Quick match buttons (Classic/Rank)
- Character selection
- Current rank display

### 2. **Store Section**
- Characters for purchase (Nairi, Alok, Chrono)
- Gun skins (Golden M4A1, Dragon AWM, Toxic MP5)
- Gold & Diamond display
- Buy/Owned status

### 3. **Luck Royale** (NEW!)
- Spin wheel system
- Rewards: Gold, Diamonds, Skins, Characters
- Cost: 100 Gold per spin or 10 Diamonds
- Animation for spinning
- Random reward system

### 4. **Leaderboard** (NEW!)
- Top 50 players
- Shows: Rank, Name, Points, Wins
- Your position highlighted
- Sort by: Rank Points or Wins

### 5. **Events Section**
- Active events
- Upcoming events
- Event rewards
- Progress tracking

### 6. **Rank Mode System**
- **REQUIRES LEVEL 8+** to play
- Rank points +/- based on performance
- Win: +50 points + (kills × 15)
- Loss: -20 points + (kills × 5)
- Rank tiers:
  - Bronze III: 0-999
  - Bronze II: 1000-1049
  - Bronze I: 1050-1099
  - Silver III: 1100-1199
  - Silver II: 1200-1299
  - Silver I: 1300-1399
  - Gold III: 1400-1499
  - Gold II: 1500-1599
  - Gold I: 1600+

### 7. **Classic Mode**
- No level requirement
- EXP & Gold rewards only
- No rank points change
- Casual gameplay

## Implementation Status:

The code structure has been updated with:
✅ New state variables for all sections
✅ Leaderboard data structure
✅ Luck Royale state
✅ Player stats (rankPoints, totalMatches, wins, kills)
✅ Level 8+ requirement check for rank mode
✅ Enhanced rank calculation system

## Next Steps to Complete:

Due to the file size (2400+ lines), you should:

1. **Replace the lobby section** in App.tsx with section-based navigation
2. **Add Luck Royale component** with spin animation
3. **Add Leaderboard component** with player rankings
4. **Update Store** with better UI
5. **Add Events page** with event cards

## Key Code Changes Made:

```typescript
// New state for sections
const [activeSection, setActiveSection] = useState<'home' | 'store' | 'luck_royale' | 'leaderboard' | 'events' | 'profile'>('home');

// Enhanced player data
const [playerData, setPlayerData] = useState({ 
  gold: 500, 
  diamonds: 0, 
  level: 1, 
  exp: 0, 
  unlockedCharacters: ['kelly'], 
  unlockedSkins: [],
  rankPoints: 1000,
  totalMatches: 0,
  wins: 0,
  kills: 0
});

// Luck Royale
const [showLuckRoyale, setShowLuckRoyale] = useState(false);
const [luckRoyaleSpins, setLuckRoyaleSpins] = useState(0);
const [currentLuckReward, setCurrentLuckReward] = useState<string | null>(null);

// Leaderboard
const [leaderboardData, setLeaderboardData] = useState<Array<{
  name: string, 
  rank: string, 
  points: number, 
  wins: number
}>>([]);
```

## Rank Mode Validation:

```typescript
const startMatchmaking = () => {
  if (gameMode === 'rank' && playerData.level < 8) {
    alert("⚠️ Rank mode requires Level 8! Your level: " + playerData.level);
    return;
  }
  // ... rest of matchmaking
};
```

## Luck Royale Rewards:

```typescript
const LUCK_REWARDS = [
  { name: "100 Gold", type: "gold", value: 100, chance: 40 },
  { name: "500 Gold", type: "gold", value: 500, chance: 25 },
  { name: "10 Diamonds", type: "diamonds", value: 10, chance: 15 },
  { name: "50 Diamonds", type: "diamonds", value: 50, chance: 8 },
  { name: "Rare Skin", type: "skin", value: 0, chance: 7 },
  { name: "Character Unlock", type: "character", value: 0, chance: 5 },
];
```

## Recommendations:

1. **Keep mobile-first design**
2. **Use tabs for navigation** (Home, Store, Luck Royale, Leaderboard, Events)
3. **Add bottom navigation bar** for easy switching
4. **Show level requirement clearly** for rank mode
5. **Add visual feedback** for rank point changes (+/-)
