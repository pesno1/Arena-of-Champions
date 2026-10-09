// tslint:disable
/* eslint-disable */
import {
  Activity,
  ArrowRight,
  Award,
  Bot,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Coins,
  Copy,
  Crown,
  Eye,
  Feather,
  Flame,
  Globe,
  Heart,
  HelpCircle,
  Home,
  Info,
  Layers,
  Link,
  LogIn,
  Menu,
  Play,
  Plus,
  RefreshCw,
  RotateCw,
  Send,
  Share2,
  Shield,
  ShieldAlert,
  Sparkles,
  Swords,
  Target,
  Trash2,
  Trophy,
  User,
  UserCheck,
  UserPlus,
  Users,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  CHAMPION_PROFILES,
  CARD_DECK,
  DIE_FACE_POOL,
  getConfig,
} from './constants';
import type { 
  ChampionProfile, 
  ColiseumCard, 
  DieFace 
} from './constants';
import BackgroundMusic from './utils/BackgroundMusic';
import {
  formatTime,
  gameAudio,
  MenuOverlay,
  Overlay,
  useAssets,
  useAutoFocus,
  useIsMobile,
} from './utils/helper';
import type { GameState } from './utils/helper';
import {
  usePlayground,
  usePlaygroundGameLifecycle,
  useRpc,
} from './utils/usePlayground';

// Coliseum BGM track
const BACKGROUND_MUSIC_URL = '/assets/audio/bgm_coliseum_theme.mp3';

// Grid size for the Coliseum Arena
const GRID_SIZE = 9;

// Turn duration in seconds
const TURN_DURATION_SECONDS = 30;
export const TURN_DURATION_MULTIPLAYER_DEFAULT = 90;
export type TurnTimerOption = '90s' | 'unlimited';

export interface CombatDie {
  id: number;
  face: DieFace;
  locked: boolean;
  rolling: boolean;
  spent: boolean; // true once consumed for an action or card this turn
}

export interface ArenaTile {
  r: number;
  c: number;
  type: 'floor' | 'fountain' | 'pillar' | 'spikes' | 'void';
  charges?: number; // charges for healing pool
  decal?: 'blood' | 'sand_mark' | 'crack' | 'sword_scratch' | 'footsteps' | 'none';
  decalRotation?: number;
  sandRipple?: number;
}

export type SeatIndex = 0 | 1 | 2 | 3;
export type BotDifficulty = 'easy' | 'normal' | 'tactical';
export type LobbyMode = 'solo' | 'online';

export interface LobbySlot {
  seat: SeatIndex;
  type: 'human' | 'bot' | 'empty';
  playerId: string;
  name: string;
  championId: string;
  isReady: boolean;
  isHost: boolean;
  botDifficulty?: BotDifficulty;
}

export interface ChampionState {
  id: string;
  seat: SeatIndex;
  name: string;
  title: string;
  isPlayer: boolean; // true if controlled on this client in current mode
  isBot: boolean;
  botDifficulty?: BotDifficulty;
  assetKey: string;
  color: string;
  seatColor: string;
  seatBadgeBg: string;
  vitality: number;
  maxVitality: number;
  shields: number;
  r: number;
  c: number;
  isAlive: boolean;
  inventory: ColiseumCard[];
  rooted: boolean; // immobilized for 1 turn
  burnTicks: number; // takes 1 DMG per turn
  aresBuff: boolean; // +1 extra damage on attacks this turn
  ironBastionActive: boolean; // capped at 1 DMG per hit this round
  stunImmune: boolean;
  trapImmune: boolean;
  scoreContribution: number;
  profile: ChampionProfile;
}

export interface FloatingText {
  id: string;
  text: string;
  r: number;
  c: number;
  color: string;
  createdAt: number;
}

export interface AmbientParticle {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  speedY: number;
  speedX: number;
  opacity: number;
}

export interface DraftBidderRank {
  champId: string;
  champName: string;
  seat: SeatIndex;
  isPlayer: boolean;
  isBot: boolean;
  bid: number;
  claimedCard: ColiseumCard | null;
}

// Seat styling constants (Seat 1: Red, Seat 2: Blue, Seat 3: Green, Seat 4: Gold)
export const SEAT_COLORS = [
  {name: 'Red (Host)', hex: '#ef4444', ring: 'ring-red-500', border: 'border-red-500', bg: 'bg-red-950/80', badge: 'bg-red-700'},
  {name: 'Blue', hex: '#38bdf8', ring: 'ring-cyan-500', border: 'border-cyan-500', bg: 'bg-cyan-950/80', badge: 'bg-cyan-700'},
  {name: 'Green', hex: '#34d399', ring: 'ring-emerald-500', border: 'border-emerald-500', bg: 'bg-emerald-950/80', badge: 'bg-emerald-700'},
  {name: 'Gold', hex: '#fbbf24', ring: 'ring-amber-500', border: 'border-amber-500', bg: 'bg-amber-950/80', badge: 'bg-amber-700'},
];

// Four corner spawn positions on the 9x9 board
const SPAWN_COORDINATES = [
  {r: 1, c: 1}, // Seat 1: Top-Left
  {r: 1, c: 7}, // Seat 2: Top-Right
  {r: 7, c: 1}, // Seat 3: Bottom-Left
  {r: 7, c: 7}, // Seat 4: Bottom-Right
];

const RESERVED_SPAWN_SAFE_ZONES = new Set([
  '1,1', '1,2', '2,1', '2,2',
  '1,7', '1,6', '2,7', '2,6',
  '7,1', '7,2', '6,1', '6,2',
  '7,7', '7,6', '6,7', '6,6',
]);

// Helper to roll random die face
function getRandomDieFace(): DieFace {
  return DIE_FACE_POOL[Math.floor(Math.random() * DIE_FACE_POOL.length)];
}

// Generate unique room ID
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export default function App() {
  const isMobile = useIsMobile();
  const {sdk, isReady} = usePlayground();

  // --- ASSETS MANIFEST ---
  const ASSETS_MANIFEST: Record<string, string> = {
    bg_coliseum: '/assets/images/bg_coliseum.png',
    champion_solar_paladin: '/assets/images/champion_solar_paladin.png',
    champion_storm_berserker: '/assets/images/champion_storm_berserker.png',
    champion_shadow_weaver: '/assets/images/champion_shadow_weaver.png',
    champion_gaia_warden: '/assets/images/champion_gaia_warden.png',
    card_weapon_sunblade: '/assets/images/card_weapon_sunblade.png',
    card_weapon_thunder_axe: '/assets/images/card_weapon_thunder_axe.png',
    card_armor_aegis_plate: '/assets/images/card_armor_aegis_plate.png',
    card_mount_celestial_drake: '/assets/images/card_mount_celestial_drake.png',
    card_artifact_chrono_dial: '/assets/images/card_artifact_chrono_dial.png',
    icon_dice_sword: '/assets/images/icon_dice_sword.png',
    icon_dice_shield: '/assets/images/icon_dice_shield.png',
    icon_dice_wing: '/assets/images/icon_dice_wing.png',
    icon_dice_orb: '/assets/images/icon_dice_orb.png',
    tile_fountain: '/assets/images/tile_fountain.png',
    tile_pillar: '/assets/images/tile_pillar.png',
    tile_spikes: '/assets/images/tile_spikes.png',
    token_vitality_crystal: '/assets/images/token_vitality_crystal.png',
  };
  const {assets, isReady: assetsReady} = useAssets(ASSETS_MANIFEST);

  // --- AUDIO TOGGLES ---
  const [isMusicMuted, setIsMusicMuted] = useState(false);
  const [isSfxMuted, setIsSfxMuted] = useState(false);

  // --- LOCAL USER PROFILE & LOBBY SYSTEM ---
  const [myPlayerId] = useState<string>(() => 'player_' + Math.random().toString(36).substring(2, 9));
  const [myUsername, setMyUsername] = useState<string>('Gladiator Maximus');
  const [myChampionId, setMyChampionId] = useState<string>('solar_paladin');
  const [lobbyMode, setLobbyMode] = useState<LobbyMode>('solo');
  const [multiplayerTimerOption, setMultiplayerTimerOption] = useState<TurnTimerOption>('90s');
  const [roomCode, setRoomCode] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlRoom = params.get('room');
      if (urlRoom) return urlRoom.toUpperCase();
      const hashRoom = window.location.hash.replace('#', '').replace('room=', '');
      if (hashRoom) return hashRoom.toUpperCase();
    }
    return generateRoomCode();
  });
  const [joinInputCode, setJoinInputCode] = useState<string>('');
  const [linkCopied, setLinkCopied] = useState<boolean>(false);
  const [codeCopied, setCodeCopied] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<{
    text: string;
    type: 'success' | 'info' | 'error' | 'idle';
  }>({
    text: 'Active in Room ' + roomCode,
    type: 'info',
  });

  // 4 Lobby Slots (Seat 0: Host, Seats 1-3: Players / Bots)
  const [lobbySlots, setLobbySlots] = useState<LobbySlot[]>([
    {
      seat: 0,
      type: 'human',
      playerId: myPlayerId,
      name: 'Gladiator Maximus',
      championId: 'solar_paladin',
      isReady: true,
      isHost: true,
    },
    {
      seat: 1,
      type: 'bot',
      playerId: 'bot_1',
      name: 'Tempest Bot',
      championId: 'storm_berserker',
      isReady: true,
      isHost: false,
      botDifficulty: 'normal',
    },
    {
      seat: 2,
      type: 'bot',
      playerId: 'bot_2',
      name: 'Sorceress Bot',
      championId: 'shadow_weaver',
      isReady: true,
      isHost: false,
      botDifficulty: 'tactical',
    },
    {
      seat: 3,
      type: 'bot',
      playerId: 'bot_3',
      name: 'Centurion Bot',
      championId: 'gaia_warden',
      isReady: true,
      isHost: false,
      botDifficulty: 'easy',
    },
  ]);

  // Sync my customized name / champion into seat 0
  useEffect(() => {
    setLobbySlots((prev) =>
      prev.map((slot) =>
        slot.playerId === myPlayerId
          ? {...slot, name: myUsername, championId: myChampionId}
          : slot,
      ),
    );
  }, [myUsername, myChampionId, myPlayerId]);

  // --- BROADCAST CHANNEL FOR P2P MULTI-TAB / MULTIPLAYER SYNC ---
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  // Helper to broadcast lobby state
  const broadcastLobbyState = useCallback((slots: LobbySlot[], timerOpt?: TurnTimerOption) => {
    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.postMessage({
          type: 'LOBBY_STATE_SYNC',
          slots,
          timerOption: timerOpt ?? multiplayerTimerOption,
        });
      } catch (e) {
        console.warn('Broadcast error', e);
      }
    }
  }, [multiplayerTimerOption]);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const channel = new BroadcastChannel(`aether_coliseum_room_${roomCode}`);
      broadcastChannelRef.current = channel;

      channel.onmessage = (event) => {
        const data = event.data;
        if (!data || !data.type) return;

        if (data.type === 'LOBBY_STATE_SYNC') {
          setLobbySlots(data.slots);
          setConnectionStatus({
            text: `Synced with Room Host (${roomCode})!`,
            type: 'success',
          });
        } else if (data.type === 'PLAYER_JOIN_REQUEST') {
          // Host receives join request
          setLobbySlots((prev) => {
            const hostSlot = prev.find((s) => s.isHost);
            if (hostSlot?.playerId === myPlayerId) {
              // Find first non-human slot to place new player
              const openSlotIdx = prev.findIndex(
                (s) => s.playerId !== data.player.id && (s.type === 'empty' || s.type === 'bot'),
              );
              let next = [...prev];
              if (openSlotIdx !== -1) {
                next[openSlotIdx] = {
                  seat: openSlotIdx as SeatIndex,
                  type: 'human',
                  playerId: data.player.id,
                  name: data.player.name,
                  championId: data.player.championId,
                  isReady: true,
                  isHost: false,
                };
              }
              // Respond back with full lobby sync
              channel.postMessage({
                type: 'LOBBY_STATE_SYNC',
                slots: next,
              });
              return next;
            }
            return prev;
          });
          setBattleLogs((prev) => [
            `⚔️ Gladiator ${data.player.name} joined Room ${roomCode}!`,
            ...prev.slice(0, 39),
          ]);
        } else if (data.type === 'GAME_START_SYNC') {
          if (subPhase === 'LOBBY' || gameState.status === 'START') {
            startSkirmishMatchFromLobby(data.slots, data.arena);
          }
        } else if (data.type === 'ACTION_LOG_SYNC') {
          setBattleLogs((prev) => [data.message, ...prev.slice(0, 39)]);
        }
      };

      // Announce arrival when entering a room
      channel.postMessage({
        type: 'PLAYER_JOIN_REQUEST',
        player: {
          id: myPlayerId,
          name: myUsername,
          championId: myChampionId,
        },
      });

      return () => {
        channel.close();
      };
    }
  }, [roomCode, myPlayerId, myUsername, myChampionId]);

  // --- GAME LIFE CYCLE STATE ---
  const [gameState, setGameState] = useState<GameState>({
    status: 'START',
    score: 0,
    level: 1,
  });

  const [subPhase, setSubPhase] = useState<
    'LOBBY' | 'DRAFT' | 'SKIRMISH' | 'VICTORY' | 'DEFEAT'
  >('LOBBY');

  // Overlay state
  const [isGameMenuOpen, setIsGameMenuOpen] = useState(false);
  const [isHowToPlayOpen, setIsHowToPlayOpen] = useState(false);
  const [isCustomizingSlot, setIsCustomizingSlot] = useState<number | null>(null);
  const [isMobileHandOpen, setIsMobileHandOpen] = useState(false);

  // --- DRAFT & BIDDING OVERHAUL STATE (3 ROUNDS TOTAL, 4 CARDS PER ROUND) ---
  const [draftRound, setDraftRound] = useState<number>(0);
  const [draftPoolCards, setDraftPoolCards] = useState<ColiseumCard[]>([]);
  const [draftStep, setDraftStep] = useState<'BIDDING' | 'PICKING' | 'ROUND_SUMMARY'>('BIDDING');
  const [playerBid, setPlayerBid] = useState<number>(2);
  const [bidderRanks, setBidderRanks] = useState<DraftBidderRank[]>([]);
  const [currentPickIdx, setCurrentPickIdx] = useState<number>(0);

  // --- PROCEDURAL ARENA GRID GENERATION ---
  const generateProceduralArena = useCallback((): ArenaTile[][] => {
    const grid: ArenaTile[][] = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      const row: ArenaTile[] = [];
      for (let c = 0; c < GRID_SIZE; c++) {
        const isCornerVoid =
          (r === 0 && (c <= 1 || c >= 7)) ||
          (r === 1 && (c === 0 || c === 8)) ||
          (r === 7 && (c === 0 || c === 8)) ||
          (r === 8 && (c <= 1 || c >= 7));

        if (isCornerVoid) {
          row.push({r, c, type: 'void'});
        } else {
          const randDecal = Math.random();
          let decal: 'blood' | 'sand_mark' | 'crack' | 'sword_scratch' | 'footsteps' | 'none' = 'none';
          if (randDecal < 0.12) decal = 'sand_mark';
          else if (randDecal < 0.20) decal = 'crack';
          else if (randDecal < 0.27) decal = 'blood';
          else if (randDecal < 0.35) decal = 'sword_scratch';
          else if (randDecal < 0.42) decal = 'footsteps';

          row.push({
            r,
            c,
            type: 'floor',
            decal,
            decalRotation: Math.floor(Math.random() * 4) * 90,
            sandRipple: Math.random(),
          });
        }
      }
      grid.push(row);
    }

    const validCoords: {r: number; c: number}[] = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const key = `${r},${c}`;
        if (grid[r]?.[c]?.type === 'floor' && !RESERVED_SPAWN_SAFE_ZONES.has(key)) {
          validCoords.push({r, c});
        }
      }
    }

    for (let i = validCoords.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [validCoords[i], validCoords[j]] = [validCoords[j], validCoords[i]];
    }

    // 4 Healing Pools with 5 charges each
    const FOUNTAIN_COUNT = 4;
    for (let i = 0; i < FOUNTAIN_COUNT && validCoords.length > 0; i++) {
      const coord = validCoords.pop()!;
      grid[coord.r][coord.c].type = 'fountain';
      grid[coord.r][coord.c].charges = 5;
    }

    // 4 Spike Traps
    const TRAP_COUNT = 4;
    for (let i = 0; i < TRAP_COUNT && validCoords.length > 0; i++) {
      const coord = validCoords.pop()!;
      grid[coord.r][coord.c].type = 'spikes';
    }

    // 5 Stone Pillars
    const pillarCount = 5;
    for (let i = 0; i < pillarCount && validCoords.length > 0; i++) {
      const coord = validCoords.pop()!;
      grid[coord.r][coord.c].type = 'pillar';
    }

    return grid;
  }, []);

  const [arenaGrid, setArenaGrid] = useState<ArenaTile[][]>(generateProceduralArena);
  const arenaGridRef = useRef<ArenaTile[][]>(arenaGrid);
  arenaGridRef.current = arenaGrid;

  // --- ARENA SKIRMISH STATE ---
  const [champions, setChampions] = useState<ChampionState[]>([]);
  const championsRef = useRef<ChampionState[]>([]);
  championsRef.current = champions;

  const [activeChampIndex, setActiveChampIndex] = useState<number>(0);
  const activeChampIndexRef = useRef<number>(0);
  activeChampIndexRef.current = activeChampIndex;

  const [turnCount, setTurnCount] = useState<number>(1);
  const turnCountRef = useRef<number>(1);
  turnCountRef.current = turnCount;

  const getTurnLimitSeconds = useCallback((): number | null => {
    if (lobbyMode === 'solo') {
      return null;
    }
    return multiplayerTimerOption === 'unlimited' ? null : TURN_DURATION_MULTIPLAYER_DEFAULT;
  }, [lobbyMode, multiplayerTimerOption]);

  // Turn Timer
  const [turnTimerSec, setTurnTimerSec] = useState<number | null>(null);
  const turnTimerRef = useRef<number | null>(null);
  turnTimerRef.current = turnTimerSec;

  // 7 Combat Dice in tray
  const [actionDice, setActionDice] = useState<CombatDie[]>([]);
  const actionDiceRef = useRef<CombatDie[]>([]);
  actionDiceRef.current = actionDice;

  const [rerollsLeft, setRerollsLeft] = useState<number>(1);
  const [diceRolledThisTurn, setDiceRolledThisTurn] = useState<boolean>(false);

  // Turn management & AI safety timers
  const turnTokenRef = useRef<number>(0);
  const aiTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Targeting & highlight overlays
  const [selectedActionType, setSelectedActionType] = useState<
    'basic_move' | 'basic_strike' | 'basic_spell' | 'card_action' | null
  >(null);
  const [pendingCard, setPendingCard] = useState<ColiseumCard | null>(null);
  const [validMoveTiles, setValidMoveTiles] = useState<{r: number; c: number}[]>([]);
  const [validTargetChamps, setValidTargetChamps] = useState<string[]>([]);
  const [validTrapTiles, setValidTrapTiles] = useState<{r: number; c: number}[]>([]);

  // Logs and Floating Elements
  const [battleLogs, setBattleLogs] = useState<string[]>([]);
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);
  const [screenShake, setScreenShake] = useState<boolean>(false);
  const [actionBanner, setActionBanner] = useState<string>('Gladiator Arena: 4-Player Lobby');

  // Ambient Arena Particles
  const [particles] = useState<AmbientParticle[]>(() =>
    Array.from({length: 24}, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 4 + 2,
      color: ['#fbbf24', '#f59e0b', '#dc2626', '#e0e7ff', '#f43f5e', '#d97706'][i % 6],
      speedY: (Math.random() * 0.4 + 0.2) * (Math.random() > 0.5 ? 1 : -1),
      speedX: (Math.random() * 0.3 + 0.1) * (Math.random() > 0.5 ? 1 : -1),
      opacity: Math.random() * 0.6 + 0.2,
    })),
  );

  // Match summary stats
  const [stats, setStats] = useState({
    itemsWon: 0,
    damageDealt: 0,
    knockbackCollisions: 0,
    fountainHeals: 0,
    knockouts: 0,
    turnsSurvived: 0,
  });

  const startBtnRef = useAutoFocus<HTMLButtonElement>(gameState.status === 'START');

  // Integration with Playground SDK
  usePlaygroundGameLifecycle(gameState, sdk);

  // Clear any pending AI timers
  const clearAiTimers = useCallback(() => {
    aiTimersRef.current.forEach((t) => clearTimeout(t));
    aiTimersRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      clearAiTimers();
    };
  }, [clearAiTimers]);

  const addLog = useCallback((msg: string) => {
    setBattleLogs((prev) => [msg, ...prev.slice(0, 39)]);
    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.postMessage({type: 'ACTION_LOG_SYNC', message: msg});
      } catch (e) {}
    }
  }, []);

  const spawnFloatingText = useCallback((text: string, r: number, c: number, color = '#fbbf24') => {
    const id = `${Date.now()}_${Math.random()}`;
    setFloatingTexts((prev) => [...prev, {id, text, r, c, color, createdAt: Date.now()}]);
    setTimeout(() => {
      setFloatingTexts((prev) => prev.filter((ft) => ft.id !== id));
    }, 1800);
  }, []);

  const triggerShake = useCallback(() => {
    setScreenShake(true);
    setTimeout(() => setScreenShake(false), 450);
  }, []);

  // Copy room code to clipboard
  const handleCopyRoomCode = () => {
    gameAudio.playCrispClick();
    if (typeof navigator !== 'undefined' && navigator?.clipboard?.writeText) {
      navigator.clipboard
        .writeText(roomCode)
        .then(() => {
          setCodeCopied(true);
          setConnectionStatus({
            text: `Room Code [${roomCode}] copied to clipboard!`,
            type: 'success',
          });
          setTimeout(() => setCodeCopied(false), 2500);
        })
        .catch(() => {
          setCodeCopied(true);
          setTimeout(() => setCodeCopied(false), 2500);
        });
    } else {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2500);
    }
  };

  // Copy full invite link handler
  const handleCopyInviteLink = () => {
    gameAudio.playCrispClick();
    if (typeof window !== 'undefined') {
      const url = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard
          .writeText(url)
          .then(() => {
            setLinkCopied(true);
            setConnectionStatus({
              text: 'Full Invite URL copied! Share with fellow gladiators.',
              type: 'success',
            });
            setTimeout(() => setLinkCopied(false), 2500);
          })
          .catch(() => {
            setLinkCopied(true);
            setTimeout(() => setLinkCopied(false), 2500);
          });
      } else {
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2500);
      }
    }
  };

  // Create/Generate a brand new Room Code
  const handleCreateNewRoom = () => {
    gameAudio.playPowerupChime();
    const newCode = generateRoomCode();
    setRoomCode(newCode);
    if (typeof window !== 'undefined' && window.history?.replaceState) {
      const url = new URL(window.location.href);
      url.searchParams.set('room', newCode);
      window.history.replaceState({}, '', url.toString());
    }
    // Reset lobby where this player is host
    setLobbySlots([
      {
        seat: 0,
        type: 'human',
        playerId: myPlayerId,
        name: myUsername,
        championId: myChampionId,
        isReady: true,
        isHost: true,
      },
      {
        seat: 1,
        type: 'bot',
        playerId: 'bot_1',
        name: 'Tempest Bot',
        championId: 'storm_berserker',
        isReady: true,
        isHost: false,
        botDifficulty: 'normal',
      },
      {
        seat: 2,
        type: 'bot',
        playerId: 'bot_2',
        name: 'Sorceress Bot',
        championId: 'shadow_weaver',
        isReady: true,
        isHost: false,
        botDifficulty: 'tactical',
      },
      {
        seat: 3,
        type: 'bot',
        playerId: 'bot_3',
        name: 'Centurion Bot',
        championId: 'gaia_warden',
        isReady: true,
        isHost: false,
        botDifficulty: 'easy',
      },
    ]);
    setConnectionStatus({
      text: `Created new arena room: ${newCode}. Share code with players!`,
      type: 'success',
    });
  };

  // Join an existing room via Code input
  const handleJoinRoom = (codeOverride?: string) => {
    const targetCode = (codeOverride || joinInputCode).trim().toUpperCase();
    if (!targetCode || targetCode.length < 3) {
      gameAudio.playErrorBuzz();
      setConnectionStatus({
        text: 'Please enter a valid 4-6 character room code!',
        type: 'error',
      });
      return;
    }

    gameAudio.playConfirmSelect();
    setRoomCode(targetCode);
    setJoinInputCode('');

    if (typeof window !== 'undefined' && window.history?.replaceState) {
      const url = new URL(window.location.href);
      url.searchParams.set('room', targetCode);
      window.history.replaceState({}, '', url.toString());
    }

    // Set non-host challenger lobby state and request sync from host
    setLobbySlots((prev) =>
      prev.map((s, idx) =>
        idx === 1
          ? {
              seat: 1,
              type: 'human',
              playerId: myPlayerId,
              name: myUsername,
              championId: myChampionId,
              isReady: true,
              isHost: false,
            }
          : s,
      ),
    );

    setConnectionStatus({
      text: `Connecting to Room [${targetCode}]... Waiting for Host sync.`,
      type: 'info',
    });

    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.postMessage({
        type: 'PLAYER_JOIN_REQUEST',
        player: {
          id: myPlayerId,
          name: myUsername,
          championId: myChampionId,
        },
      });
    }
  };

  // Paste code from clipboard
  const handlePasteCode = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator?.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          const clean = text.trim().replace(/^.*[?&]room=/, '').substring(0, 10).toUpperCase();
          setJoinInputCode(clean);
          gameAudio.playCrispClick();
        }
      }
    } catch (e) {
      // Clipboard read permission might be denied
    }
  };

  // --- BOT MANAGEMENT IN LOBBY ---
  const handleAddBot = (seatIdx: SeatIndex) => {
    gameAudio.playCrispClick();
    const botNames = ['Spartan Bot', 'Centurion Bot', 'Gladiator Bot', 'Huntress Bot', 'Berserker Bot'];
    const botName = botNames[seatIdx % botNames.length];
    const availableProfile = CHAMPION_PROFILES[seatIdx % CHAMPION_PROFILES.length];

    setLobbySlots((prev) => {
      const next = prev.map((s, idx) => {
        if (idx === seatIdx) {
          return {
            seat: seatIdx,
            type: 'bot' as const,
            playerId: `bot_${seatIdx}_${Date.now()}`,
            name: botName,
            championId: availableProfile.id,
            isReady: true,
            isHost: false,
            botDifficulty: 'normal' as const,
          };
        }
        return s;
      });
      broadcastLobbyState(next);
      return next;
    });
  };

  const handleRemoveSlot = (seatIdx: SeatIndex) => {
    gameAudio.playCrispClick();
    setLobbySlots((prev) => {
      const next = prev.map((s, idx) => {
        if (idx === seatIdx && !s.isHost) {
          return {
            seat: seatIdx,
            type: 'empty' as const,
            playerId: '',
            name: 'Empty Slot',
            championId: 'solar_paladin',
            isReady: false,
            isHost: false,
          };
        }
        return s;
      });
      broadcastLobbyState(next);
      return next;
    });
  };

  const handleBotDifficultyChange = (seatIdx: SeatIndex, diff: BotDifficulty) => {
    gameAudio.playCrispClick();
    setLobbySlots((prev) => {
      const next = prev.map((s, idx) => (idx === seatIdx ? {...s, botDifficulty: diff} : s));
      broadcastLobbyState(next);
      return next;
    });
  };

  const handleToggleReady = (seatIdx: SeatIndex) => {
    gameAudio.playConfirmSelect();
    setLobbySlots((prev) => {
      const next = prev.map((s, idx) => (idx === seatIdx ? {...s, isReady: !s.isReady} : s));
      broadcastLobbyState(next);
      return next;
    });
  };

  // --- COUNT UNSPENT DICE ---
  const unspentCounts = useMemo(() => {
    const counts: Record<DieFace, number> = {strike: 0, wing: 0, shield: 0, spell: 0};
    actionDice.forEach((d) => {
      if (!d.spent && !d.rolling) {
        counts[d.face] = (counts[d.face] || 0) + 1;
      }
    });
    return counts;
  }, [actionDice]);

  // Helper to check if requirements can be satisfied by unspent dice
  const canAffordReq = useCallback((req: DieFace[], dice: CombatDie[]): boolean => {
    const available = {strike: 0, wing: 0, shield: 0, spell: 0};
    dice.forEach((d) => {
      if (!d.spent && !d.rolling) {
        available[d.face]++;
      }
    });
    const needed = {strike: 0, wing: 0, shield: 0, spell: 0};
    req.forEach((f) => {
      needed[f]++;
    });
    return (
      available.strike >= needed.strike &&
      available.wing >= needed.wing &&
      available.shield >= needed.shield &&
      available.spell >= needed.spell
    );
  }, []);

  // Helper to consume dice matching requirement
  const consumeDiceForReq = useCallback((req: DieFace[]) => {
    const needed = [...req];
    setActionDice((prev) => {
      const next = prev.map((d) => ({...d}));
      for (const face of needed) {
        const targetDie = next.find((d) => !d.spent && !d.rolling && d.face === face);
        if (targetDie) {
          targetDie.spent = true;
        }
      }
      actionDiceRef.current = next;
      return next;
    });
  }, []);

  // --- WIN / LOSS CONDITION CHECK ---
  const checkGameOverCondition = useCallback((): boolean => {
    const currentChamps = championsRef.current;
    const livingChamps = currentChamps.filter((c) => c.isAlive && c.vitality > 0);

    if (livingChamps.length <= 1) {
      clearAiTimers();
      const victor = livingChamps[0];
      const isPlayerVictor = victor?.isPlayer;

      if (isPlayerVictor) {
        setGameState((prev) => ({
          ...prev,
          status: 'VICTORY',
          score: prev.score + 3500 + (victor?.vitality || 10) * 150,
        }));
        setSubPhase('VICTORY');
      } else {
        setGameState((prev) => ({...prev, status: 'GAME_OVER'}));
        setSubPhase('DEFEAT');
      }
      return true;
    }

    return false;
  }, [clearAiTimers]);

  // --- DAMAGE & SHIELD ABSORPTION UTILITY ---
  const applyDamageToTarget = useCallback(
    (
      attacker: ChampionState,
      target: ChampionState,
      baseDamage: number,
      options?: {
        ignoreShield?: boolean;
        breakShield?: boolean;
        canKnockback?: boolean;
        knockbackTiles?: number;
        reason?: string;
      },
    ) => {
      let dmg = baseDamage + (attacker.aresBuff ? 1 : 0);

      if (target.ironBastionActive) {
        dmg = Math.min(1, dmg);
      }

      let newShields = target.shields;
      let effectiveDmg = dmg;

      if (options?.breakShield) {
        newShields = 0;
        spawnFloatingText('🛡️ SHIELD BROKEN!', target.r, target.c, '#ef4444');
      } else if (options?.ignoreShield) {
        if (newShields > 0) {
          spawnFloatingText('⚔️ SHIELD BYPASS!', target.r, target.c, '#f59e0b');
        }
      } else if (newShields > 0) {
        if (newShields >= effectiveDmg) {
          newShields -= effectiveDmg;
          effectiveDmg = 0;
          gameAudio.playShieldBlock();
          spawnFloatingText(`🛡️ -${dmg} Shield`, target.r, target.c, '#38bdf8');
        } else {
          effectiveDmg -= newShields;
          spawnFloatingText(`🛡️ -${newShields} Shield`, target.r, target.c, '#38bdf8');
          newShields = 0;
          gameAudio.playShieldBlock();
        }
      }

      // Check Aegis Reflection thorns
      const hasAegisThorns = target.inventory.some((c) => c.id === 'aegis_reflection');
      if (hasAegisThorns && dmg > 0 && attacker.id !== target.id) {
        const attackerRemaining = Math.max(0, attacker.vitality - 1);
        spawnFloatingText('🪞 THORNS 1 DMG', attacker.r, attacker.c, '#38bdf8');
        addLog(`🪞 ${target.name}'s Aegis Reflection countered ${attacker.name} for 1 damage!`);
        championsRef.current = championsRef.current.map((c) =>
          c.id === attacker.id ? {...c, vitality: attackerRemaining, isAlive: attackerRemaining > 0} : c,
        );
      }

      // Knockback calculation
      let targetNewR = target.r;
      let targetNewC = target.c;
      let collisionDmg = 0;

      if (options?.canKnockback) {
        const knockDist = options.knockbackTiles ?? 1;
        const dirR = target.r - attacker.r !== 0 ? Math.sign(target.r - attacker.r) : 0;
        const dirC = target.c - attacker.c !== 0 ? Math.sign(target.c - attacker.c) : 0;

        targetNewR = target.r + dirR * knockDist;
        targetNewC = target.c + dirC * knockDist;

        const isOOB =
          targetNewR < 0 ||
          targetNewR >= GRID_SIZE ||
          targetNewC < 0 ||
          targetNewC >= GRID_SIZE ||
          arenaGridRef.current[targetNewR]?.[targetNewC]?.type === 'void';

        const isPillar = !isOOB && arenaGridRef.current[targetNewR]?.[targetNewC]?.type === 'pillar';
        const isSpike = !isOOB && arenaGridRef.current[targetNewR]?.[targetNewC]?.type === 'spikes';
        const isOccupied =
          !isOOB &&
          championsRef.current.some(
            (ch) => ch.isAlive && ch.id !== target.id && ch.r === targetNewR && ch.c === targetNewC,
          );

        if (isOOB || isPillar || isOccupied) {
          const berserkerBonus = attacker.profile.id === 'storm_berserker' ? 1 : 0;
          collisionDmg = getConfig('pillarSlamDamage') + berserkerBonus;
          gameAudio.playChiptuneExplosion();
          spawnFloatingText(`💥 WALL SLAM +${collisionDmg}!`, target.r, target.c, '#ef4444');
          addLog(`💥 ${target.name} slammed into a wall/obstacle for ${collisionDmg} bonus damage!`);
          targetNewR = target.r;
          targetNewC = target.c;
        } else if (isSpike) {
          const spikeDmg = getConfig('spikeTrapDamage');
          collisionDmg = spikeDmg;
          spawnFloatingText(`🩸 SPIKE PIT +${spikeDmg}!`, targetNewR, targetNewC, '#ef4444');
          gameAudio.playMeleePunch();
        }
      }

      const totalDirectDmg = effectiveDmg + collisionDmg;
      const targetRemainingVit = Math.max(0, target.vitality - totalDirectDmg);
      const isTargetDead = targetRemainingVit <= 0;

      if (totalDirectDmg > 0) {
        spawnFloatingText(`-${totalDirectDmg} HP`, target.r, target.c, '#ef4444');
      }

      if (isTargetDead) {
        gameAudio.playChiptuneExplosion();
        spawnFloatingText(`☠️ VANQUISHED!`, target.r, target.c, '#dc2626');
        addLog(`☠️ ${target.name} was defeated on the Coliseum sands!`);
        if (attacker.isPlayer) {
          setStats((prev) => ({...prev, knockouts: prev.knockouts + 1}));
          setGameState((prev) => ({...prev, score: prev.score + 600}));
        }
      }

      if (attacker.isPlayer) {
        setStats((prev) => ({
          ...prev,
          damageDealt: prev.damageDealt + totalDirectDmg,
          knockbackCollisions: prev.knockbackCollisions + (collisionDmg > 0 ? 1 : 0),
        }));
        setGameState((prev) => ({...prev, score: prev.score + totalDirectDmg * 50}));
      }

      const updated = championsRef.current.map((c) => {
        if (c.id === target.id) {
          return {
            ...c,
            vitality: targetRemainingVit,
            shields: newShields,
            r: targetNewR,
            c: targetNewC,
            isAlive: !isTargetDead,
          };
        }
        return c;
      });

      championsRef.current = updated;
      setChampions(updated);
      checkGameOverCondition();
    },
    [addLog, checkGameOverCondition, spawnFloatingText],
  );

  // --- ADVANCE TURN & HEALING / STATUS RESOLUTION ---
  const advanceTurn = useCallback(() => {
    clearAiTimers();
    setSelectedActionType(null);
    setPendingCard(null);
    setValidMoveTiles([]);
    setValidTargetChamps([]);
    setValidTrapTiles([]);

    const currentChamps = championsRef.current;
    const currentChamp = currentChamps[activeChampIndexRef.current];

    // Healing Pool Resolution with charges system
    if (currentChamp && currentChamp.isAlive) {
      const tile = arenaGridRef.current[currentChamp.r]?.[currentChamp.c];
      if (tile && tile.type === 'fountain') {
        const baseHeal = getConfig('fountainHealing');
        const gaiaBonus = currentChamp.profile.id === 'gaia_warden' ? 1 : 0;
        const totalHeal = baseHeal + gaiaBonus;
        const currentCharges = tile.charges ?? 5;
        const remainingCharges = Math.max(0, currentCharges - 1);

        gameAudio.playPotionGulp();
        spawnFloatingText(`+${totalHeal} HP (${remainingCharges}/5 Charges)`, currentChamp.r, currentChamp.c, '#38bdf8');

        // Update tile charges or despawn if charges reach 0
        const updatedGrid = arenaGridRef.current.map((row, r) =>
          row.map((t, c) => {
            if (r === currentChamp.r && c === currentChamp.c) {
              if (remainingCharges <= 0) {
                return {...t, type: 'floor' as const, charges: undefined};
              }
              return {...t, charges: remainingCharges};
            }
            return t;
          }),
        );
        arenaGridRef.current = updatedGrid;
        setArenaGrid(updatedGrid);

        if (remainingCharges <= 0) {
          addLog(`⛲ The Healing Pool at (${currentChamp.r}, ${currentChamp.c}) exhausted its charges and dried up!`);
        } else {
          addLog(`⛲ ${currentChamp.name} rested at the Healing Pool (+${totalHeal} HP).`);
        }

        const updated = currentChamps.map((c) =>
          c.id === currentChamp.id
            ? {...c, vitality: Math.min(c.maxVitality + 5, c.vitality + totalHeal)}
            : c,
        );
        championsRef.current = updated;
        setChampions(updated);

        if (currentChamp.isPlayer) {
          setStats((prev) => ({...prev, fountainHeals: prev.fountainHeals + 1}));
          setGameState((prev) => ({...prev, score: prev.score + 100}));
        }
      }

      // Burn tick damage
      if (currentChamp.burnTicks > 0) {
        const remainingVit = Math.max(0, currentChamp.vitality - 1);
        spawnFloatingText('🔥 BURN -1 HP', currentChamp.r, currentChamp.c, '#f97316');
        addLog(`🔥 ${currentChamp.name} suffered 1 burn damage!`);
        championsRef.current = championsRef.current.map((c) =>
          c.id === currentChamp.id
            ? {...c, vitality: remainingVit, burnTicks: c.burnTicks - 1, isAlive: remainingVit > 0}
            : c,
        );
        setChampions(championsRef.current);
      }

      // Reset turn transient buffs
      championsRef.current = championsRef.current.map((c) =>
        c.id === currentChamp.id
          ? {
              ...c,
              aresBuff: false,
              ironBastionActive: false,
              rooted: false,
              trapImmune: false,
            }
          : c,
      );
      setChampions(championsRef.current);
    }

    if (checkGameOverCondition()) return;

    let nextIdx = (activeChampIndexRef.current + 1) % championsRef.current.length;
    let safetyCounter = 0;
    while (!championsRef.current[nextIdx]?.isAlive && safetyCounter < championsRef.current.length * 2) {
      nextIdx = (nextIdx + 1) % championsRef.current.length;
      safetyCounter++;
    }

    activeChampIndexRef.current = nextIdx;
    setActiveChampIndex(nextIdx);

    setTurnCount((prev) => {
      const newTurn = prev + 1;
      turnCountRef.current = newTurn;
      return newTurn;
    });

    if (currentChamp?.isPlayer) {
      setStats((prev) => ({...prev, turnsSurvived: prev.turnsSurvived + 1}));
    }

    const nextChamp = championsRef.current[nextIdx];
    if (nextChamp && nextChamp.isAlive) {
      startTurnForChampion(nextChamp.id);
    } else {
      checkGameOverCondition();
    }
  }, [addLog, checkGameOverCondition, clearAiTimers, spawnFloatingText]);

  // --- BOT AI BEHAVIOR ---
  const runBotTurn = useCallback((botId: string, currentToken: number) => {
    const timer1 = setTimeout(() => {
      if (turnTokenRef.current !== currentToken) return;

      const bot = championsRef.current.find((c) => c.id === botId);
      if (!bot || !bot.isAlive) {
        advanceTurn();
        return;
      }

      let currentDice = [...actionDiceRef.current];

      // 1. Try to use Armor cards if has shields needed
      for (const card of bot.inventory) {
        if (card.category === 'Armor' && canAffordReq(card.req, currentDice)) {
          for (const face of card.req) {
            const d = currentDice.find((die) => !die.spent && die.face === face);
            if (d) d.spent = true;
          }
          let shieldGain = 2;
          if (card.id === 'lorica_segmentata') shieldGain = 3;
          if (card.id === 'testudo_formation') shieldGain = 4;
          if (card.id === 'scutum_wall') shieldGain = 2;
          if (card.id === 'corinthian_helm' || card.id === 'aegis_reflection' || card.id === 'myrmidon_guard') shieldGain = 1;

          bot.shields += shieldGain;
          spawnFloatingText(`+${shieldGain} Shield`, bot.r, bot.c, '#38bdf8');
          addLog(`🛡️ ${bot.name} activated ${card.name} (+${shieldGain} Shield)!`);
          gameAudio.playShieldBlock();
          break;
        }
      }

      // 2. Try single shield dice
      const unspentShields = currentDice.filter((d) => !d.spent && d.face === 'shield');
      unspentShields.forEach((d) => {
        d.spent = true;
        const paladinBonus = bot.profile.id === 'solar_paladin' ? 1 : 0;
        const gain = 1 + paladinBonus;
        bot.shields += gain;
        spawnFloatingText(`+${gain} Shield`, bot.r, bot.c, '#38bdf8');
      });

      // Find nearest living foe
      const enemies = championsRef.current.filter((c) => c.isAlive && c.id !== bot.id);
      if (enemies.length === 0) {
        advanceTurn();
        return;
      }

      enemies.sort((a, b) => {
        const distA = Math.abs(a.r - bot.r) + Math.abs(a.c - bot.c);
        const distB = Math.abs(b.r - bot.r) + Math.abs(b.c - bot.c);
        return distA - distB;
      });

      const primaryTarget = enemies[0];
      const targetDist = Math.abs(primaryTarget.r - bot.r) + Math.abs(primaryTarget.c - bot.c);

      // 3. Movement with Mount card or 2 Wing dice
      if (!bot.rooted && targetDist > 1) {
        let moved = false;
        const mountCard = bot.inventory.find((c) => c.category === 'Mount' && canAffordReq(c.req, currentDice));
        if (mountCard) {
          for (const face of mountCard.req) {
            const d = currentDice.find((die) => !die.spent && die.face === face);
            if (d) d.spent = true;
          }
          const dirR = Math.sign(primaryTarget.r - bot.r);
          const dirC = Math.sign(primaryTarget.c - bot.c);
          const newR = Math.max(0, Math.min(GRID_SIZE - 1, bot.r + dirR * 2));
          const newC = Math.max(0, Math.min(GRID_SIZE - 1, bot.c + dirC * 2));
          if (arenaGridRef.current[newR]?.[newC]?.type !== 'pillar' && arenaGridRef.current[newR]?.[newC]?.type !== 'void') {
            bot.r = newR;
            bot.c = newC;
            moved = true;
            addLog(`🐎 ${bot.name} rode ${mountCard.name} towards ${primaryTarget.name}!`);
            gameAudio.playRetroJump();
          }
        }

        if (!moved) {
          const unspentWings = currentDice.filter((d) => !d.spent && d.face === 'wing');
          if (unspentWings.length >= 2) {
            unspentWings[0].spent = true;
            unspentWings[1].spent = true;
            const dirR = Math.sign(primaryTarget.r - bot.r);
            const dirC = Math.sign(primaryTarget.c - bot.c);
            const newR = Math.max(0, Math.min(GRID_SIZE - 1, bot.r + (Math.abs(dirR) > 0 ? dirR : 0)));
            const newC = Math.max(0, Math.min(GRID_SIZE - 1, bot.c + (Math.abs(dirR) === 0 ? dirC : 0)));
            if (arenaGridRef.current[newR]?.[newC]?.type !== 'pillar' && arenaGridRef.current[newR]?.[newC]?.type !== 'void') {
              bot.r = newR;
              bot.c = newC;
              gameAudio.playRetroJump();
            }
          }
        }
      }

      actionDiceRef.current = currentDice;
      setActionDice([...currentDice]);

      const timer2 = setTimeout(() => {
        if (turnTokenRef.current !== currentToken) return;

        const liveBot = championsRef.current.find((c) => c.id === botId);
        if (!liveBot || !liveBot.isAlive) {
          advanceTurn();
          return;
        }

        const liveEnemies = championsRef.current.filter((c) => c.isAlive && c.id !== bot.id);
        const adjFoe = liveEnemies.find(
          (e) => Math.abs(e.r - liveBot.r) <= 1 && Math.abs(e.c - liveBot.c) <= 1 && (e.r !== liveBot.r || e.c !== liveBot.c),
        );

        // 4. Attack with Weapon card or basic 2 Strike dice
        const weaponCard = liveBot.inventory.find((c) => c.category === 'Weapon' && canAffordReq(c.req, currentDice));
        if (adjFoe && weaponCard) {
          for (const face of weaponCard.req) {
            const d = currentDice.find((die) => !die.spent && die.face === face);
            if (d) d.spent = true;
          }
          gameAudio.playSwordClash();
          triggerShake();
          addLog(`⚔️ ${liveBot.name} unleashed ${weaponCard.name} on ${adjFoe.name}!`);
          applyDamageToTarget(liveBot, adjFoe, 2, {canKnockback: true, ignoreShield: weaponCard.id === 'gladius_thrust'});
        } else if (adjFoe) {
          const unspentStrikes = currentDice.filter((d) => !d.spent && d.face === 'strike');
          if (unspentStrikes.length >= 2) {
            unspentStrikes[0].spent = true;
            unspentStrikes[1].spent = true;
            gameAudio.playSwordClash();
            triggerShake();
            addLog(`⚔️ ${liveBot.name} used 2 Strike dice to attack ${adjFoe.name}!`);
            applyDamageToTarget(liveBot, adjFoe, 1, {canKnockback: true});
          }
        } else {
          // 5. Try Spell Card or 2 Spell dice global blast
          const spellCard = liveBot.inventory.find((c) => c.category === 'Spell' && canAffordReq(c.req, currentDice));
          if (spellCard && primaryTarget) {
            for (const face of spellCard.req) {
              const d = currentDice.find((die) => !die.spent && die.face === face);
              if (d) d.spent = true;
            }
            gameAudio.playPowerupChime();
            triggerShake();
            addLog(`🔮 ${liveBot.name} cast ${spellCard.name} on ${primaryTarget.name}!`);
            applyDamageToTarget(liveBot, primaryTarget, 2, {breakShield: false});
          } else {
            const unspentSpells = currentDice.filter((d) => !d.spent && d.face === 'spell');
            if (unspentSpells.length >= 2 && primaryTarget) {
              unspentSpells[0].spent = true;
              unspentSpells[1].spent = true;
              gameAudio.playPowerupChime();
              triggerShake();
              addLog(`🔮 ${liveBot.name} channeled 2 Spell dice to blast ${primaryTarget.name}!`);
              applyDamageToTarget(liveBot, primaryTarget, 1);
            }
          }
        }

        actionDiceRef.current = currentDice;
        setActionDice([...currentDice]);

        const timer3 = setTimeout(() => {
          if (turnTokenRef.current === currentToken) {
            advanceTurn();
          }
        }, 650);
        aiTimersRef.current.push(timer3);
      }, 600);
      aiTimersRef.current.push(timer2);
    }, 700);
    aiTimersRef.current.push(timer1);
  }, [addLog, advanceTurn, applyDamageToTarget, canAffordReq, spawnFloatingText, triggerShake]);

  // --- START TURN FOR CHAMPION (Rolls 7 Dice with 6-face pool) ---
  const startTurnForChampion = useCallback(
    (champId: string) => {
      clearAiTimers();
      const currentToken = ++turnTokenRef.current;

      const champ = championsRef.current.find((c) => c.id === champId);
      if (!champ || !champ.isAlive) {
        advanceTurn();
        return;
      }

      // Reset Turn Timer
      const limit = getTurnLimitSeconds();
      setTurnTimerSec(limit);

      setDiceRolledThisTurn(false);
      setSelectedActionType(null);
      setPendingCard(null);
      setValidMoveTiles([]);
      setValidTargetChamps([]);
      setValidTrapTiles([]);

      const freeRerolls = getConfig('baseRerolls');
      setRerollsLeft(freeRerolls);

      const diceCount = getConfig('maxDiceCount');
      const initialDice: CombatDie[] = Array.from({length: diceCount}, (_, i) => ({
        id: i,
        face: getRandomDieFace(),
        locked: false,
        rolling: true,
        spent: false,
      }));
      setActionDice(initialDice);
      actionDiceRef.current = initialDice;

      const isHumanControlled = champ.isPlayer;
      setActionBanner(
        isHumanControlled
          ? `${champ.name.toUpperCase()}'S TURN (SEAT ${champ.seat + 1})`
          : `${champ.name.toUpperCase()} (BOT) THINKING...`,
      );
      addLog(`🚩 Round ${turnCountRef.current}: ${champ.name}'s turn (Seat ${champ.seat + 1} - ${champ.title}).`);

      if (!isHumanControlled) {
        const watchdog = setTimeout(() => {
          if (turnTokenRef.current === currentToken) {
            console.warn(`[AI Watchdog] Turn timeout triggered for ${champ.name}. Advancing.`);
            advanceTurn();
          }
        }, 6000);
        aiTimersRef.current.push(watchdog);
      }

      const rollTimer = setTimeout(() => {
        if (turnTokenRef.current !== currentToken) return;

        const settledDice = initialDice.map((d) => ({...d, rolling: false}));
        setActionDice(settledDice);
        actionDiceRef.current = settledDice;
        setDiceRolledThisTurn(true);

        if (!isHumanControlled) {
          runBotTurn(champ.id, currentToken);
        } else {
          gameAudio.playConfirmSelect();
        }
      }, 500);
      aiTimersRef.current.push(rollTimer);
    },
    [addLog, advanceTurn, clearAiTimers, lobbyMode, runBotTurn],
  );

  // Turn timer countdown effect
  useEffect(() => {
    if (subPhase !== 'SKIRMISH') return;

    const interval = setInterval(() => {
      setTurnTimerSec((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          // Timeout: auto-advance
          advanceTurn();
          return getTurnLimitSeconds();
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [subPhase, advanceTurn, getTurnLimitSeconds]);

  // --- INITIALIZE DRAFTING ROUND WITH 4 CARDS ---
  const startDraftRound = useCallback((roundIndex: number) => {
    const shuffled = [...CARD_DECK].sort(() => Math.random() - 0.5);
    const roundCards = shuffled.slice(0, 4);

    setDraftRound(roundIndex);
    setDraftPoolCards(roundCards);
    setDraftStep('BIDDING');
    setPlayerBid(2);
    setBidderRanks([]);
    setCurrentPickIdx(0);
    setActionBanner(`DRAFT ROUND ${roundIndex + 1} OF 3 - SUBMIT VITALITY BID`);
  }, []);

  // --- INITIALIZE FULL MATCH FROM LOBBY ---
  const startSkirmishMatchFromLobby = useCallback(
    (slots: LobbySlot[], existingArena?: ArenaTile[][]) => {
      clearAiTimers();
      gameAudio.playVictoryFanfare();
      const startingVit = getConfig('startingVitality');

      const newGrid = existingArena || generateProceduralArena();
      arenaGridRef.current = newGrid;
      setArenaGrid(newGrid);

      // Filter active slots (human or bot)
      const activeSlots = slots.filter((s) => s.type !== 'empty');

      const newChamps: ChampionState[] = activeSlots.map((slot, idx) => {
        const profile =
          CHAMPION_PROFILES.find((p) => p.id === slot.championId) || CHAMPION_PROFILES[0];
        const isPlayer = slot.playerId === myPlayerId;
        const isBot = slot.type === 'bot';
        const pos = SPAWN_COORDINATES[slot.seat % 4];
        const seatStyle = SEAT_COLORS[slot.seat % 4];

        return {
          id: slot.playerId,
          seat: slot.seat,
          name: slot.name,
          title: profile.title,
          isPlayer,
          isBot,
          botDifficulty: slot.botDifficulty || 'normal',
          assetKey: profile.assetKey,
          color: profile.color,
          seatColor: seatStyle.hex,
          seatBadgeBg: seatStyle.badge,
          vitality: startingVit,
          maxVitality: startingVit,
          shields: 0,
          r: pos.r,
          c: pos.c,
          isAlive: true,
          inventory: [],
          rooted: false,
          burnTicks: 0,
          aresBuff: false,
          ironBastionActive: false,
          stunImmune: false,
          trapImmune: false,
          scoreContribution: 0,
          profile,
        };
      });

      championsRef.current = newChamps;
      setChampions(newChamps);

      setBattleLogs([
        '=== 4-Player Match Commenced: Imperial Drafting Phase ===',
        'In each round, 4 antiquity cards are drawn. Submit your secret bid to claim draft pick priority!',
      ]);
      setStats({
        itemsWon: 0,
        damageDealt: 0,
        knockbackCollisions: 0,
        fountainHeals: 0,
        knockouts: 0,
        turnsSurvived: 0,
      });

      setGameState((prev) => ({...prev, status: 'PLAYING', score: 0, level: 1}));
      setSubPhase('DRAFT');

      startDraftRound(0);

      if (sdk) {
        sdk.startGame();
      }

      if (broadcastChannelRef.current) {
        try {
          broadcastChannelRef.current.postMessage({
            type: 'GAME_START_SYNC',
            slots,
            arena: newGrid,
            timerOption: multiplayerTimerOption,
          });
        } catch (e) {}
      }
    },
    [clearAiTimers, generateProceduralArena, multiplayerTimerOption, myPlayerId, sdk, startDraftRound],
  );

  const handleStartBattle = () => {
    // Validate that at least 2 participants exist and all humans are ready
    const active = lobbySlots.filter((s) => s.type !== 'empty');
    if (active.length < 2) {
      gameAudio.playErrorBuzz();
      return;
    }
    const allHumansReady = active.filter((s) => s.type === 'human').every((s) => s.isReady);
    if (!allHumansReady) {
      gameAudio.playErrorBuzz();
      return;
    }

    startSkirmishMatchFromLobby(lobbySlots);
  };

  // Autoplay support for screenshot testing
  const hasAutoplayed = useRef(false);
  useEffect(() => {
    if (
      !hasAutoplayed.current &&
      new URLSearchParams(window.location.search).has('autoplay')
    ) {
      hasAutoplayed.current = true;
      startSkirmishMatchFromLobby(lobbySlots);
    }
  }, [lobbySlots, startSkirmishMatchFromLobby]);

  // Handle Escape Key for Pause Menu
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isHowToPlayOpen) {
          setIsHowToPlayOpen(false);
          return;
        }
        setIsGameMenuOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isHowToPlayOpen]);

  // Win/Loss Sound Effects Hook
  useEffect(() => {
    if (gameState.status === 'GAME_OVER') {
      gameAudio.playDefeatMotif();
    } else if (gameState.status === 'VICTORY') {
      gameAudio.playVictoryFanfare();
    }
  }, [gameState.status]);

  // --- DRAFT BIDDING & PICKING HANDLERS ---
  const handlePlayerBidChange = (delta: number) => {
    gameAudio.playCrispClick();
    const activeChamp = championsRef.current.find((c) => c.isPlayer) || championsRef.current[0];
    const maxAllowed = activeChamp ? activeChamp.vitality - 1 : 10;
    setPlayerBid((prev) => Math.max(1, Math.min(maxAllowed, prev + delta)));
  };

  const handleConfirmBid = () => {
    gameAudio.playCoinPickup();

    const ranks: DraftBidderRank[] = championsRef.current.map((champ) => {
      if (champ.isPlayer) {
        return {
          champId: champ.id,
          champName: champ.name,
          seat: champ.seat,
          isPlayer: champ.isPlayer,
          isBot: champ.isBot,
          bid: playerBid,
          claimedCard: null,
        };
      }

      const vit = champ.vitality;
      const maxBid = Math.max(1, Math.min(5, vit - 3));
      let botBid = Math.floor(Math.random() * 3) + 1;

      if (champ.profile.aiStyle === 'aggressive') {
        botBid = Math.min(maxBid, Math.floor(Math.random() * 3) + 2);
      } else if (champ.profile.aiStyle === 'tactical') {
        botBid = Math.min(maxBid, Math.floor(Math.random() * 4) + 1);
      }

      return {
        champId: champ.id,
        champName: champ.name,
        seat: champ.seat,
        isPlayer: false,
        isBot: true,
        bid: Math.max(1, botBid),
        claimedCard: null,
      };
    });

    ranks.sort((a, b) => {
      if (b.bid !== a.bid) return b.bid - a.bid;
      return a.seat - b.seat;
    });

    const updatedChamps = championsRef.current.map((champ) => {
      const rankEntry = ranks.find((r) => r.champId === champ.id);
      if (rankEntry) {
        return {
          ...champ,
          vitality: Math.max(1, champ.vitality - rankEntry.bid),
        };
      }
      return champ;
    });
    championsRef.current = updatedChamps;
    setChampions(updatedChamps);

    setBidderRanks(ranks);
    setDraftStep('PICKING');
    setCurrentPickIdx(0);
    setActionBanner(`DRAFT PICKING: 1st Pick Priority -> ${ranks[0].champName}`);
    addLog(`📊 Bids Revealed! ${ranks[0].champName} bid ${ranks[0].bid} HP and earned 1st pick!`);

    if (ranks[0].isBot) {
      triggerBotPick(0, ranks, draftPoolCards);
    }
  };

  const triggerBotPick = (
    pickerIdx: number,
    ranksList: DraftBidderRank[],
    availableCards: ColiseumCard[],
  ) => {
    setTimeout(() => {
      const currentRanker = ranksList[pickerIdx];
      if (!currentRanker || !currentRanker.isBot) return;

      const unpicked = availableCards.filter(
        (card) => !ranksList.some((r) => r.claimedCard?.id === card.id),
      );

      if (unpicked.length === 0) return;

      const champ = championsRef.current.find((c) => c.id === currentRanker.champId);
      let chosenCard = unpicked[0];
      if (champ?.profile.aiStyle === 'aggressive') {
        chosenCard = unpicked.find((c) => c.category === 'Weapon') || unpicked[0];
      } else if (champ?.profile.aiStyle === 'tactical') {
        chosenCard = unpicked.find((c) => c.category === 'Armor' || c.category === 'Spell') || unpicked[0];
      } else {
        chosenCard = unpicked[Math.floor(Math.random() * unpicked.length)];
      }

      gameAudio.playConfirmSelect();
      addLog(`🃏 ${currentRanker.champName} drafted ${chosenCard.name}!`);

      const updatedChamps = championsRef.current.map((c) => {
        if (c.id === currentRanker.champId) {
          return {...c, inventory: [...c.inventory, chosenCard]};
        }
        return c;
      });
      championsRef.current = updatedChamps;
      setChampions(updatedChamps);

      const nextRanks = ranksList.map((r, i) =>
        i === pickerIdx ? {...r, claimedCard: chosenCard} : r,
      );
      setBidderRanks(nextRanks);

      const nextIdx = pickerIdx + 1;
      if (nextIdx < nextRanks.length) {
        setCurrentPickIdx(nextIdx);
        const nextPicker = nextRanks[nextIdx];
        setActionBanner(`DRAFT PICKING: ${nextIdx + 1} of 4 -> ${nextPicker.champName}'s Pick`);
        if (nextPicker.isBot) {
          triggerBotPick(nextIdx, nextRanks, availableCards);
        }
      } else {
        setDraftStep('ROUND_SUMMARY');
        setActionBanner(`DRAFT ROUND ${draftRound + 1} COMPLETE!`);
      }
    }, 850);
  };

  const handlePlayerPickCard = (card: ColiseumCard) => {
    const currentRanker = bidderRanks[currentPickIdx];
    const isCurrentPlayerTurn = currentRanker && currentRanker.isPlayer;
    if (!isCurrentPlayerTurn || draftStep !== 'PICKING') return;

    const isClaimed = bidderRanks.some((r) => r.claimedCard?.id === card.id);
    if (isClaimed) {
      gameAudio.playErrorBuzz();
      return;
    }

    gameAudio.playPowerupChime();
    addLog(`🏆 ${currentRanker.champName} drafted ${card.name}! (${card.bonusSummary})`);
    setStats((prev) => ({...prev, itemsWon: prev.itemsWon + 1}));
    setGameState((prev) => ({...prev, score: prev.score + 300}));

    const updatedChamps = championsRef.current.map((c) => {
      if (c.id === currentRanker.champId) {
        return {...c, inventory: [...c.inventory, card]};
      }
      return c;
    });
    championsRef.current = updatedChamps;
    setChampions(updatedChamps);

    const nextRanks = bidderRanks.map((r, i) =>
      i === currentPickIdx ? {...r, claimedCard: card} : r,
    );
    setBidderRanks(nextRanks);

    const nextIdx = currentPickIdx + 1;
    if (nextIdx < nextRanks.length) {
      setCurrentPickIdx(nextIdx);
      const nextPicker = nextRanks[nextIdx];
      setActionBanner(`DRAFT PICKING: ${nextIdx + 1} of 4 -> ${nextPicker.champName}'s Pick`);
      if (nextPicker.isBot) {
        triggerBotPick(nextIdx, nextRanks, draftPoolCards);
      }
    } else {
      setDraftStep('ROUND_SUMMARY');
      setActionBanner(`DRAFT ROUND ${draftRound + 1} COMPLETE!`);
    }
  };

  const handleNextDraftStep = () => {
    gameAudio.playCrispClick();
    const nextRound = draftRound + 1;
    if (nextRound >= 3) {
      gameAudio.playLevelUpStinger();
      setSubPhase('SKIRMISH');
      addLog('=== All 3 Draft Rounds Completed! Skirmish Begins! ===');

      activeChampIndexRef.current = 0;
      setActiveChampIndex(0);
      turnCountRef.current = 1;
      setTurnCount(1);
      const startingChamp = championsRef.current[0];
      if (startingChamp) {
        startTurnForChampion(startingChamp.id);
      }
    } else {
      startDraftRound(nextRound);
    }
  };

  // --- PLAYER REROLL ACTION ---
  const handleRerollDice = () => {
    if (rerollsLeft <= 0 || !diceRolledThisTurn) {
      gameAudio.playErrorBuzz();
      return;
    }

    const currentChamp = championsRef.current[activeChampIndexRef.current];
    const isHumanControlled = currentChamp && currentChamp.isPlayer;
    if (!isHumanControlled) return;

    gameAudio.playCoinPickup();
    setRerollsLeft((prev) => prev - 1);

    setActionDice((prev) =>
      prev.map((d) => {
        if (d.locked || d.spent) return d;
        return {
          ...d,
          face: getRandomDieFace(),
          rolling: true,
        };
      }),
    );

    setTimeout(() => {
      setActionDice((prev) => {
        const resolved = prev.map((d) => ({...d, rolling: false}));
        actionDiceRef.current = resolved;
        return resolved;
      });
      gameAudio.playPowerupChime();
    }, 450);
  };

  const handleToggleDiceLock = (id: number) => {
    if (rerollsLeft <= 0) return;
    const target = actionDice.find((d) => d.id === id);
    if (target?.spent) return;
    gameAudio.playCrispClick();
    setActionDice((prev) =>
      prev.map((d) => (d.id === id ? {...d, locked: !d.locked} : d)),
    );
  };

  // --- BASIC ACTIONS WITH UNSPENT DICE ---
  const handleSelectBasicMove = () => {
    if (unspentCounts.wing < 2) {
      gameAudio.playErrorBuzz();
      return;
    }
    gameAudio.playCrispClick();
    setSelectedActionType('basic_move');
    setPendingCard(null);

    const activeChamp = championsRef.current[activeChampIndexRef.current];
    if (!activeChamp) return;

    const moves: {r: number; c: number}[] = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (arenaGridRef.current[r]?.[c]?.type === 'void') continue;
        if (arenaGridRef.current[r]?.[c]?.type === 'pillar' && activeChamp.profile.id !== 'shadow_weaver') continue;
        if (championsRef.current.some((ch) => ch.isAlive && ch.r === r && ch.c === c)) continue;

        const dist = Math.abs(activeChamp.r - r) + Math.abs(activeChamp.c - c);
        if (dist === 1) {
          moves.push({r, c});
        }
      }
    }
    setValidMoveTiles(moves);
    setValidTargetChamps([]);
    setValidTrapTiles([]);
  };

  const handleSelectBasicStrike = () => {
    if (unspentCounts.strike < 2) {
      gameAudio.playErrorBuzz();
      return;
    }
    gameAudio.playCrispClick();
    setSelectedActionType('basic_strike');
    setPendingCard(null);

    const activeChamp = championsRef.current[activeChampIndexRef.current];
    if (!activeChamp) return;

    const targets = championsRef.current
      .filter((ch) => {
        if (!ch.isAlive || ch.id === activeChamp.id) return false;
        const dr = Math.abs(ch.r - activeChamp.r);
        const dc = Math.abs(ch.c - activeChamp.c);
        return dr <= 1 && dc <= 1 && (dr > 0 || dc > 0);
      })
      .map((ch) => ch.id);

    setValidTargetChamps(targets);
    setValidMoveTiles([]);
    setValidTrapTiles([]);
  };

  const handleSelectBasicSpell = () => {
    if (unspentCounts.spell < 2) {
      gameAudio.playErrorBuzz();
      return;
    }
    gameAudio.playCrispClick();
    setSelectedActionType('basic_spell');
    setPendingCard(null);

    const activeChamp = championsRef.current[activeChampIndexRef.current];
    if (!activeChamp) return;

    const targets = championsRef.current
      .filter((c) => c.isAlive && c.id !== activeChamp.id)
      .map((c) => c.id);

    setValidTargetChamps(targets);
    setValidMoveTiles([]);
    setValidTrapTiles([]);
  };

  const handleSelectBasicShield = () => {
    if (unspentCounts.shield < 1) {
      gameAudio.playErrorBuzz();
      return;
    }
    gameAudio.playShieldBlock();
    consumeDiceForReq(['shield']);

    const activeChamp = championsRef.current[activeChampIndexRef.current];
    if (!activeChamp) return;

    const paladinBonus = activeChamp.profile.id === 'solar_paladin' ? 1 : 0;
    const gain = 1 + paladinBonus;

    const updated = championsRef.current.map((c) =>
      c.id === activeChamp.id ? {...c, shields: c.shields + gain} : c,
    );
    championsRef.current = updated;
    setChampions(updated);
    spawnFloatingText(`+${gain} Shield`, activeChamp.r, activeChamp.c, '#38bdf8');
    addLog(`🛡️ ${activeChamp.name} spent 1 Shield die to gain ${gain} Defense Shield!`);
  };

  // --- CARD ACTIVATION HANDLERS (48 CARDS) ---
  const handleCardClick = (card: ColiseumCard) => {
    const activeChamp = championsRef.current[activeChampIndexRef.current];
    const isHumanControlled = activeChamp && activeChamp.isPlayer;
    if (!isHumanControlled) return;

    if (!canAffordReq(card.req, actionDice)) {
      gameAudio.playErrorBuzz();
      return;
    }

    gameAudio.playCrispClick();

    if (card.targetType === 'none') {
      consumeDiceForReq(card.req);
      executeCardDirectEffect(card, activeChamp);
      return;
    }

    if (card.targetType === 'reroll') {
      consumeDiceForReq(card.req);
      gameAudio.playPowerupChime();
      addLog(`✨ Athena's Wisdom granted a free dice reroll!`);
      setActionDice((prev) =>
        prev.map((d) => (d.spent ? d : {...d, face: getRandomDieFace(), rolling: true})),
      );
      setTimeout(() => {
        setActionDice((prev) => prev.map((d) => ({...d, rolling: false})));
      }, 400);
      return;
    }

    setPendingCard(card);
    setSelectedActionType('card_action');

    if (card.targetType === 'adjacent_enemy') {
      const targets = championsRef.current
        .filter((ch) => {
          if (!ch.isAlive || ch.id === activeChamp.id) return false;
          const dr = Math.abs(ch.r - activeChamp.r);
          const dc = Math.abs(ch.c - activeChamp.c);
          return dr <= 1 && dc <= 1 && (dr > 0 || dc > 0);
        })
        .map((ch) => ch.id);
      setValidTargetChamps(targets);
      setValidMoveTiles([]);
      setValidTrapTiles([]);
    } else if (card.targetType === 'range_straight') {
      const targets = championsRef.current
        .filter((ch) => {
          if (!ch.isAlive || ch.id === activeChamp.id) return false;
          const dr = Math.abs(ch.r - activeChamp.r);
          const dc = Math.abs(ch.c - activeChamp.c);
          const isStraight = (dr === 0 && dc <= 2) || (dc === 0 && dr <= 2);
          return isStraight && (dr > 0 || dc > 0);
        })
        .map((ch) => ch.id);
      setValidTargetChamps(targets);
      setValidMoveTiles([]);
      setValidTrapTiles([]);
    } else if (card.targetType === 'range_any') {
      if (card.id === 'vulcans_trap') {
        const tiles: {r: number; c: number}[] = [];
        for (let r = 0; r < GRID_SIZE; r++) {
          for (let c = 0; c < GRID_SIZE; c++) {
            if (arenaGridRef.current[r]?.[c]?.type === 'void' || arenaGridRef.current[r]?.[c]?.type === 'pillar') continue;
            const dist = Math.abs(activeChamp.r - r) + Math.abs(activeChamp.c - c);
            if (dist > 0 && dist <= 3) {
              tiles.push({r, c});
            }
          }
        }
        setValidTrapTiles(tiles);
        setValidTargetChamps([]);
        setValidMoveTiles([]);
      } else {
        const maxRange = card.id === 'cretan_bow' ? 4 : 3;
        const targets = championsRef.current
          .filter((ch) => {
            if (!ch.isAlive || ch.id === activeChamp.id) return false;
            const dist = Math.abs(ch.r - activeChamp.r) + Math.abs(ch.c - activeChamp.c);
            return dist <= maxRange;
          })
          .map((ch) => ch.id);
        setValidTargetChamps(targets);
        setValidMoveTiles([]);
        setValidTrapTiles([]);
      }
    } else if (card.targetType === 'global_enemy') {
      const targets = championsRef.current
        .filter((ch) => ch.isAlive && ch.id !== activeChamp.id)
        .map((ch) => ch.id);
      setValidTargetChamps(targets);
      setValidMoveTiles([]);
      setValidTrapTiles([]);
    } else if (card.targetType === 'move_tile' || card.targetType === 'charge_target') {
      let maxDist = 2;
      if (card.id === 'thessalian_steed' || card.id === 'pegasus_leap' || card.id === 'war_chariot') maxDist = 3;
      if (card.id === 'roman_quadriga') maxDist = 4;

      const moves: {r: number; c: number}[] = [];
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          if (arenaGridRef.current[r]?.[c]?.type === 'void') continue;
          if (arenaGridRef.current[r]?.[c]?.type === 'pillar' && card.id !== 'pegasus_leap') continue;
          if (championsRef.current.some((ch) => ch.isAlive && ch.r === r && ch.c === c)) continue;

          const dist = Math.abs(activeChamp.r - r) + Math.abs(activeChamp.c - c);
          if (dist > 0 && dist <= maxDist) {
            moves.push({r, c});
          }
        }
      }
      setValidMoveTiles(moves);
      setValidTargetChamps([]);
      setValidTrapTiles([]);
    }
  };

  const executeCardDirectEffect = (card: ColiseumCard, activeChamp: ChampionState) => {
    switch (card.id) {
      case 'scutum_wall':
        gainPlayerShield(2, card.name);
        break;
      case 'lorica_segmentata':
        gainPlayerShield(3, card.name);
        break;
      case 'corinthian_helm':
        gainPlayerShield(1, card.name);
        setChampionImmunity(activeChamp.id, 'stunImmune');
        break;
      case 'aegis_reflection':
        gainPlayerShield(1, card.name);
        addLog(`🪞 Aegis Reflection active: Next attacker will take 1 counter damage!`);
        break;
      case 'bronze_greaves':
        gainPlayerShield(1, card.name);
        setChampionImmunity(activeChamp.id, 'trapImmune');
        break;
      case 'myrmidon_guard':
        gainPlayerShield(1, card.name);
        addLog(`🛡️ Myrmidon Guard ready: +1 bonus Strike next round!`);
        break;
      case 'phalanx_shield':
        gainPlayerShield(2, card.name);
        healPlayer(1);
        break;
      case 'iron_bastion':
        championsRef.current = championsRef.current.map((c) =>
          c.id === activeChamp.id ? {...c, ironBastionActive: true} : c,
        );
        setChampions(championsRef.current);
        spawnFloatingText('🛡️ IRON BASTION', activeChamp.r, activeChamp.c, '#38bdf8');
        addLog(`🏰 Iron Bastion active: All incoming damage this round capped to 1!`);
        break;
      case 'gorgon_bulwark':
        gainPlayerShield(2, card.name);
        addLog(`🐍 Gorgon Bulwark active: +2 Shield & adjacent attackers petrified!`);
        break;
      case 'testudo_formation':
        gainPlayerShield(4, card.name);
        addLog(`🐢 Testudo Formation: Gained 4 Shield points!`);
        break;
      case 'labrys_cleave':
        gameAudio.playSwordClash();
        triggerShake();
        const adjEnemies = championsRef.current.filter(
          (c) =>
            c.isAlive &&
            c.id !== activeChamp.id &&
            Math.abs(c.r - activeChamp.r) <= 1 &&
            Math.abs(c.c - activeChamp.c) <= 1,
        );
        adjEnemies.forEach((foe) => {
          applyDamageToTarget(activeChamp, foe, 1);
        });
        addLog(`🪓 Labrys Cleave whirlwind hit ${adjEnemies.length} adjacent foes!`);
        break;
      case 'apollos_blessing':
        gameAudio.playPotionGulp();
        healPlayer(2);
        addLog(`☀️ Apollo's Blessing restored 2 HP!`);
        break;
      case 'ares_battlecry':
        gameAudio.playPowerupChime();
        championsRef.current = championsRef.current.map((c) =>
          c.id === activeChamp.id ? {...c, aresBuff: true} : c,
        );
        setChampions(championsRef.current);
        spawnFloatingText('⚔️ ARES +1 DMG', activeChamp.r, activeChamp.c, '#ef4444');
        addLog(`🩸 Ares Battlecry: All your attacks this turn deal +1 extra damage!`);
        break;
      case 'hermes_wind':
        gameAudio.playPowerupChime();
        setActionDice((prev) => [
          ...prev,
          {id: Date.now() + 1, face: 'wing', locked: false, rolling: false, spent: false},
          {id: Date.now() + 2, face: 'wing', locked: false, rolling: false, spent: false},
        ]);
        spawnFloatingText('+2 Wing Dice', activeChamp.r, activeChamp.c, '#34d399');
        addLog(`🪽 Hermes Wind granted 2 bonus unspent Wing dice!`);
        break;
      case 'poseidon_wave':
        gameAudio.playChiptuneExplosion();
        triggerShake();
        const foes = championsRef.current.filter(
          (c) =>
            c.isAlive &&
            c.id !== activeChamp.id &&
            Math.abs(c.r - activeChamp.r) <= 1 &&
            Math.abs(c.c - activeChamp.c) <= 1,
        );
        foes.forEach((foe) => {
          applyDamageToTarget(activeChamp, foe, 1, {canKnockback: true, knockbackTiles: 2});
        });
        addLog(`🌊 Poseidon Wave washed foes 2 tiles away dealing 1 damage!`);
        break;
      case 'oracle_clairvoyance':
        gainPlayerShield(1, card.name);
        healPlayer(1);
        addLog(`🔮 Oracle Clairvoyance granted +1 Shield and +1 HP!`);
        break;
      case 'chronos_shift':
        gameAudio.playPowerupChime();
        const extraDice: CombatDie[] = Array.from({length: 3}, (_, i) => ({
          id: Date.now() + i,
          face: getRandomDieFace(),
          locked: false,
          rolling: false,
          spent: false,
        }));
        setActionDice((prev) => [...prev, ...extraDice]);
        spawnFloatingText('+3 Extra Dice!', activeChamp.r, activeChamp.c, '#c084fc');
        addLog(`⏳ Chronos Shift rewound time, granting 3 extra combat dice!`);
        break;
      default:
        break;
    }
  };

  const gainPlayerShield = (amount: number, source: string) => {
    gameAudio.playShieldBlock();
    const activeChamp = championsRef.current[activeChampIndexRef.current];
    if (!activeChamp) return;

    const paladinBonus = activeChamp.profile.id === 'solar_paladin' ? 1 : 0;
    const totalGain = amount + paladinBonus;

    const updated = championsRef.current.map((c) =>
      c.id === activeChamp.id ? {...c, shields: c.shields + totalGain} : c,
    );
    championsRef.current = updated;
    setChampions(updated);
    spawnFloatingText(`+${totalGain} Shield`, activeChamp.r, activeChamp.c, '#38bdf8');
    addLog(`🛡️ ${source} granted ${totalGain} Defense Shield!`);
  };

  const healPlayer = (amount: number) => {
    const activeChamp = championsRef.current[activeChampIndexRef.current];
    if (!activeChamp) return;

    const updated = championsRef.current.map((c) =>
      c.id === activeChamp.id
        ? {...c, vitality: Math.min(c.maxVitality + 5, c.vitality + amount)}
        : c,
    );
    championsRef.current = updated;
    setChampions(updated);
    spawnFloatingText(`+${amount} HP`, activeChamp.r, activeChamp.c, '#34d399');
  };

  const setChampionImmunity = (champId: string, prop: 'stunImmune' | 'trapImmune') => {
    championsRef.current = championsRef.current.map((c) =>
      c.id === champId ? {...c, [prop]: true} : c,
    );
    setChampions(championsRef.current);
  };

  // --- TILE & TARGET CLICK INTERACTION ---
  const handleTileClick = (r: number, c: number) => {
    const activeChamp = championsRef.current[activeChampIndexRef.current];
    const isHumanControlled = activeChamp && activeChamp.isPlayer;
    if (!isHumanControlled) return;

    if (selectedActionType === 'basic_move') {
      const isValid = validMoveTiles.some((m) => m.r === r && m.c === c);
      if (!isValid) return;

      consumeDiceForReq(['wing', 'wing']);
      executeMoveToTile(activeChamp, r, c);
      setSelectedActionType(null);
      setValidMoveTiles([]);
    } else if (selectedActionType === 'card_action' && pendingCard && pendingCard.targetType === 'move_tile') {
      const isValid = validMoveTiles.some((m) => m.r === r && m.c === c);
      if (!isValid) return;

      consumeDiceForReq(pendingCard.req);
      executeMoveToTile(activeChamp, r, c, pendingCard);
      setSelectedActionType(null);
      setPendingCard(null);
      setValidMoveTiles([]);
    } else if (selectedActionType === 'card_action' && pendingCard && pendingCard.id === 'vulcans_trap') {
      const isValid = validTrapTiles.some((m) => m.r === r && m.c === c);
      if (!isValid) return;

      consumeDiceForReq(pendingCard.req);
      gameAudio.playMeleePunch();
      const updatedGrid = arenaGridRef.current.map((row, rowIdx) =>
        row.map((tile, colIdx) => {
          if (rowIdx === r && colIdx === c) {
            return {...tile, type: 'spikes' as const};
          }
          return tile;
        }),
      );
      arenaGridRef.current = updatedGrid;
      setArenaGrid(updatedGrid);
      spawnFloatingText('🔥 VULCAN TRAP', r, c, '#f97316');
      addLog(`🔥 ${activeChamp.name} placed Vulcan's Fire Trap at (${r}, ${c})!`);
      setSelectedActionType(null);
      setPendingCard(null);
      setValidTrapTiles([]);
    }
  };

  const executeMoveToTile = (
    champ: ChampionState,
    r: number,
    c: number,
    card?: ColiseumCard,
  ) => {
    gameAudio.playRetroJump();

    let damageTaken = 0;
    const tileType = arenaGridRef.current[r]?.[c]?.type;

    if (tileType === 'spikes' && !champ.trapImmune && card?.id !== 'winged_sandal' && card?.id !== 'siege_ram_sprint') {
      const spikeDmg = getConfig('spikeTrapDamage');
      damageTaken = spikeDmg;
      gameAudio.playMeleePunch();
      spawnFloatingText(`Spike Pit! -${spikeDmg} HP`, r, c, '#ef4444');
      addLog(`⚠️ Stepped onto Spike Grate, taking ${spikeDmg} trap damage!`);
      triggerShake();
    }

    if (card?.id === 'centaur_gallop') {
      gainPlayerShield(1, 'Centaur Gallop');
    }

    const updated = championsRef.current.map((ch) =>
      ch.id === champ.id
        ? {
            ...ch,
            r,
            c,
            vitality: Math.max(0, ch.vitality - damageTaken),
            isAlive: ch.vitality - damageTaken > 0,
          }
        : ch,
    );
    championsRef.current = updated;
    setChampions(updated);
    checkGameOverCondition();
  };

  const handleTargetChampionClick = (targetId: string) => {
    const activeChamp = championsRef.current[activeChampIndexRef.current];
    const isHumanControlled = activeChamp && activeChamp.isPlayer;
    if (!isHumanControlled) return;

    const target = championsRef.current.find((c) => c.id === targetId);
    if (!target || !target.isAlive) return;

    if (selectedActionType === 'basic_strike') {
      if (!validTargetChamps.includes(targetId)) return;
      consumeDiceForReq(['strike', 'strike']);
      gameAudio.playSwordClash();
      triggerShake();
      addLog(`⚔️ ${activeChamp.name} attacked ${target.name} with 2 Strike dice!`);
      applyDamageToTarget(activeChamp, target, 1, {canKnockback: true});
      setSelectedActionType(null);
      setValidTargetChamps([]);
    } else if (selectedActionType === 'basic_spell') {
      if (!validTargetChamps.includes(targetId)) return;
      consumeDiceForReq(['spell', 'spell']);
      gameAudio.playPowerupChime();
      triggerShake();
      addLog(`🔮 ${activeChamp.name} blasted ${target.name} with 2 Spell dice!`);
      applyDamageToTarget(activeChamp, target, 1);
      setSelectedActionType(null);
      setValidTargetChamps([]);
    } else if (selectedActionType === 'card_action' && pendingCard) {
      if (!validTargetChamps.includes(targetId)) return;

      consumeDiceForReq(pendingCard.req);

      switch (pendingCard.id) {
        case 'gladius_thrust':
          gameAudio.playSwordClash();
          triggerShake();
          addLog(`⚔️ Gladius Thrust struck ${target.name} (ignoring shield)!`);
          applyDamageToTarget(activeChamp, target, 1, {ignoreShield: true});
          break;
        case 'spartan_spear':
          gameAudio.playSwordClash();
          triggerShake();
          addLog(`🗡️ Spartan Spear impaled ${target.name} at range 2!`);
          applyDamageToTarget(activeChamp, target, 1);
          break;
        case 'trident_strike':
          gameAudio.playSwordClash();
          triggerShake();
          addLog(`🔱 Trident Strike struck ${target.name} for 2 damage!`);
          applyDamageToTarget(activeChamp, target, 2);
          break;
        case 'sica_blade':
          gameAudio.playSwordClash();
          triggerShake();
          const bonus = target.vitality === target.maxVitality ? 1 : 0;
          addLog(`🗡️ Sica Blade slashed ${target.name} for ${1 + bonus} damage!`);
          applyDamageToTarget(activeChamp, target, 1 + bonus);
          break;
        case 'net_retiarius':
          gameAudio.playMeleePunch();
          triggerShake();
          target.rooted = true;
          spawnFloatingText('🕸️ IMMOBILIZED', target.r, target.c, '#fbbf24');
          addLog(`🕸️ Net of Retiarius entangled ${target.name} (Immobilized 1 turn)!`);
          applyDamageToTarget(activeChamp, target, 1);
          break;
        case 'falx_execution':
          gameAudio.playSwordClash();
          triggerShake();
          const falxDmg = target.vitality <= 3 ? 3 : 2;
          addLog(`🗡️ Falx Execution struck ${target.name} for ${falxDmg} damage!`);
          applyDamageToTarget(activeChamp, target, falxDmg);
          break;
        case 'centurion_pilum':
          gameAudio.playSwordClash();
          triggerShake();
          addLog(`🗡️ Centurion Pilum broke ${target.name}'s shield!`);
          applyDamageToTarget(activeChamp, target, 1, {breakShield: true});
          break;
        case 'flaming_arrow':
          gameAudio.playPowerupChime();
          triggerShake();
          target.burnTicks = 1;
          spawnFloatingText('🔥 BURN APPLIED', target.r, target.c, '#f97316');
          addLog(`🏹 Flaming Arrow ignited ${target.name} (+1 Burn next turn)!`);
          applyDamageToTarget(activeChamp, target, 1);
          break;
        case 'colosseum_dagger':
          gameAudio.playSwordClash();
          triggerShake();
          setActionDice((prev) => [
            ...prev,
            {id: Date.now(), face: 'wing', locked: false, rolling: false, spent: false},
          ]);
          spawnFloatingText('+1 Wing Refund', activeChamp.r, activeChamp.c, '#34d399');
          addLog(`🗡️ Colosseum Dagger refunded 1 Wing die!`);
          applyDamageToTarget(activeChamp, target, 1);
          break;
        case 'titan_hammer':
          gameAudio.playChiptuneExplosion();
          triggerShake();
          addLog(`🔨 Titan Hammer slammed ${target.name} back 2 tiles!`);
          applyDamageToTarget(activeChamp, target, 2, {canKnockback: true, knockbackTiles: 2});
          break;
        case 'hoplon_stance':
          gainPlayerShield(2, 'Hoplon Stance');
          applyDamageToTarget(activeChamp, target, 1);
          break;
        case 'shield_bash':
          gainPlayerShield(1, 'Shield Bash');
          target.rooted = true;
          spawnFloatingText('💫 STUNNED', target.r, target.c, '#fbbf24');
          addLog(`🛡️ Shield Bash stunned ${target.name} for 1 turn!`);
          break;
        case 'bucephalus_charge':
          gameAudio.playRetroJump();
          triggerShake();
          applyDamageToTarget(activeChamp, target, 1, {canKnockback: true, knockbackTiles: 1});
          addLog(`🐎 Bucephalus Charge trampled ${target.name}!`);
          break;
        case 'cerberus_pounce':
          gameAudio.playMeleePunch();
          triggerShake();
          applyDamageToTarget(activeChamp, target, 1);
          addLog(`🐺 Cerberus Pounce leaped onto ${target.name}!`);
          break;
        case 'zeus_lightning':
          gameAudio.playChiptuneExplosion();
          triggerShake();
          spawnFloatingText('⚡ ZEUS LIGHTNING', target.r, target.c, '#fbbf24');
          addLog(`⚡ Zeus Lightning struck ${target.name} for 2 damage!`);
          applyDamageToTarget(activeChamp, target, 2);
          break;
        case 'hades_siphon':
          gameAudio.playPowerupChime();
          triggerShake();
          healPlayer(1);
          spawnFloatingText('💀 SIPHON 1 HP', target.r, target.c, '#c084fc');
          addLog(`💀 Hades Siphon drained 1 HP from ${target.name}!`);
          applyDamageToTarget(activeChamp, target, 1);
          break;
        case 'dionysus_confusion':
          gameAudio.playPowerupChime();
          spawnFloatingText('🍷 CONFUSION', target.r, target.c, '#f59e0b');
          addLog(`🍷 Dionysus Confusion bewildered ${target.name}!`);
          break;
        case 'medusa_gaze':
          gameAudio.playPowerupChime();
          target.rooted = true;
          spawnFloatingText('🐍 PETRIFIED', target.r, target.c, '#34d399');
          addLog(`🐍 Medusa Gaze turned ${target.name} to stone!`);
          break;
        default:
          break;
      }

      setSelectedActionType(null);
      setPendingCard(null);
      setValidTargetChamps([]);
    }
  };

  const handleEndTurn = () => {
    gameAudio.playCrispClick();
    advanceTurn();
  };

  const activeChampion = champions[activeChampIndex] || champions[0];
  const isHumanTurn = activeChampion && activeChampion.isPlayer;

  const renderDieFaceIcon = (face: DieFace, className = 'w-3 h-3') => {
    switch (face) {
      case 'strike':
        return <Swords className={`${className} text-red-400`} />;
      case 'wing':
        return <Feather className={`${className} text-emerald-400`} />;
      case 'shield':
        return <Shield className={`${className} text-cyan-400`} />;
      case 'spell':
        return <Zap className={`${className} text-purple-400`} />;
    }
  };

  return (
    <div
      className={`fixed inset-0 overflow-hidden touch-none flex flex-col bg-[#0d0906] text-amber-100 font-serif select-none ${
        screenShake ? 'animate-bounce' : ''
      }`}
      style={{
        backgroundImage: `radial-gradient(ellipse at center, rgba(40, 25, 12, 0.8) 0%, rgba(15, 10, 8, 0.98) 100%)`,
      }}>
      <BackgroundMusic url={BACKGROUND_MUSIC_URL} isPlaying={gameState.status === 'PLAYING'} isMuted={isMusicMuted} />

      {/* --- TOP 4-PLAYER HUD BAR --- */}
      <header className="w-full h-14 bg-gradient-to-r from-[#201108] via-[#3a1d0d] to-[#201108] border-b-2 border-amber-500/50 flex items-center justify-between px-2 md:px-4 shrink-0 z-40 shadow-[0_4px_20px_rgba(0,0,0,0.8)] backdrop-blur-md">
        
        {/* Title & Room Badge */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-400/60 flex items-center justify-center shadow-inner">
            <Crown className="w-5 h-5 text-amber-400 drop-shadow" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs md:text-sm font-black text-amber-300 tracking-wider uppercase block leading-none">
                AETHER COLISEUM
              </span>
              <span className="text-[9px] px-1.5 py-0.2 bg-amber-900/60 border border-amber-500/40 rounded text-amber-300 font-mono font-bold">
                ROOM: {roomCode}
              </span>
            </div>
            <span className="text-[8px] text-amber-500/80 font-mono tracking-wider">
              4-PLAYER ARENA
            </span>
          </div>
        </div>

        {/* Center: 4 Players Mini Status Bar during match */}
        {subPhase === 'SKIRMISH' && (
          <div className="hidden sm:flex items-center gap-2 bg-black/60 px-3 py-1 rounded-full border border-amber-500/40 shadow-inner">
            {champions.map((ch, idx) => {
              const isActive = idx === activeChampIndex;
              return (
                <div
                  key={ch.id}
                  className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border transition-all ${
                    isActive
                      ? 'border-amber-400 bg-amber-950/80 ring-2 ring-amber-300 scale-105'
                      : ch.isAlive
                      ? 'border-zinc-800 bg-black/40'
                      : 'border-red-950 bg-red-950/20 opacity-40 grayscale'
                  }`}>
                  <div
                    className="w-4 h-4 rounded-full border flex items-center justify-center text-[8px] font-black text-white"
                    style={{backgroundColor: ch.seatColor}}>
                    {idx + 1}
                  </div>
                  <span className="text-[10px] font-bold text-amber-200 max-w-[60px] truncate">
                    {ch.name}
                  </span>
                  {ch.isPlayer && (
                    <>
                      <span className="text-[9px] font-mono text-emerald-400">
                        {ch.vitality} HP
                      </span>
                      {ch.shields > 0 && (
                        <span className="text-[9px] font-mono text-cyan-400">
                          <Shield className="w-2 h-2 inline fill-current" /> {ch.shields}
                        </span>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Right: Turn Timer & Menu */}
        <div className="flex items-center gap-2">
          {subPhase === 'SKIRMISH' && (
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-black font-mono shadow-inner ${
                turnTimerSec === null
                  ? 'bg-amber-950/60 border-amber-500/40 text-amber-300'
                  : turnTimerSec <= 10
                  ? 'bg-red-950/90 border-red-500 text-red-300 animate-pulse'
                  : 'bg-black/60 border-amber-500/40 text-amber-300'
              }`}>
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>{turnTimerSec === null ? '∞ No Limit' : `${turnTimerSec}s`}</span>
            </div>
          )}

          <button
            onClick={() => setIsGameMenuOpen(true)}
            data-testid="menu-button"
            className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-700/30 hover:bg-amber-600/50 border border-amber-500/50 rounded-lg text-xs font-bold text-amber-200 transition-colors shadow">
            <Menu className="w-4 h-4" />
            <span className="hidden md:inline">MENU</span>
          </button>
        </div>
      </header>

      {/* --- MAIN GAMEPLAY VIEWPORT --- */}
      <main className="flex-1 w-full min-h-0 relative flex flex-col md:flex-row items-center justify-center p-1 md:p-3 gap-2 md:gap-3 overflow-hidden">

        {/* =========================================================================
            1. MULTIPLAYER PRE-GAME LOBBY SYSTEM
            ========================================================================= */}
        {subPhase === 'LOBBY' && (
          <div className="w-full max-w-4xl bg-gradient-to-b from-[#2a170e]/95 via-[#1a0f0a]/95 to-[#120a06]/95 border-2 border-amber-500/60 rounded-3xl p-4 md:p-6 shadow-[0_0_50px_rgba(0,0,0,0.95)] flex flex-col backdrop-blur-md max-h-[92vh] overflow-y-auto animate-fade-in">
            
            {/* Lobby Top Banner */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-amber-500/30 pb-3 mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/60 flex items-center justify-center shadow-inner">
                  <Users className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-lg md:text-xl font-black text-amber-300">
                    4-Player Coliseum Lobby
                  </h2>
                  <p className="text-xs text-amber-200/70">
                    Customize your gladiator, invite friends or manage bot seats!
                  </p>
                </div>
              </div>

              {/* Lobby Mode & Turn Timer Selectors */}
              <div className="flex flex-col sm:flex-row items-center gap-2">
                {/* Lobby Mode Selector */}
                <div className="flex items-center bg-black/60 p-1 rounded-xl border border-amber-500/40 text-xs shadow-inner">
                  <button
                    onClick={() => {
                      gameAudio.playCrispClick();
                      setLobbyMode('solo');
                    }}
                    className={`px-3.5 py-1.5 rounded-lg font-bold transition-all ${
                      lobbyMode === 'solo' ? 'bg-amber-500 text-slate-950 shadow font-black' : 'text-amber-300/80 hover:text-amber-200'
                    }`}>
                    Solo (vs Bots)
                  </button>
                  <button
                    onClick={() => {
                      gameAudio.playCrispClick();
                      setLobbyMode('online');
                    }}
                    className={`px-3.5 py-1.5 rounded-lg font-bold transition-all ${
                      lobbyMode === 'online' ? 'bg-amber-500 text-slate-950 shadow font-black' : 'text-amber-300/80 hover:text-amber-200'
                    }`}>
                    Multiplayer
                  </button>
                </div>

                {/* Turn Timer Selector (Solo shows No Limit; Multiplayer offers 90s vs Unlimited toggle) */}
                <div className="flex items-center bg-black/60 p-1 rounded-xl border border-amber-500/40 text-xs">
                  <span className="text-[10px] font-bold text-amber-400/80 px-2 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-400" /> Timer:
                  </span>
                  {lobbyMode === 'solo' ? (
                    <span className="px-2.5 py-1 rounded-lg font-black text-[10px] bg-emerald-950/80 border border-emerald-500/40 text-emerald-300">
                      ∞ No Time Limit
                    </span>
                  ) : (
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          gameAudio.playCrispClick();
                          setMultiplayerTimerOption('90s');
                          broadcastLobbyState(lobbySlots, '90s');
                        }}
                        className={`px-2.5 py-1 rounded-lg font-bold text-[10px] transition-all ${
                          multiplayerTimerOption === '90s'
                            ? 'bg-amber-500 text-slate-950 font-black shadow'
                            : 'text-amber-300/80 hover:text-amber-200'
                        }`}>
                        90s Turn
                      </button>
                      <button
                        onClick={() => {
                          gameAudio.playCrispClick();
                          setMultiplayerTimerOption('unlimited');
                          broadcastLobbyState(lobbySlots, 'unlimited');
                        }}
                        className={`px-2.5 py-1 rounded-lg font-bold text-[10px] transition-all ${
                          multiplayerTimerOption === 'unlimited'
                            ? 'bg-amber-500 text-slate-950 font-black shadow'
                            : 'text-amber-300/80 hover:text-amber-200'
                        }`}>
                        ∞ No Limit
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Online Room Connection & Code Management Hub */}
            <div className="w-full bg-[#160d08] border-2 border-amber-500/50 rounded-2xl p-3.5 md:p-4 mb-4 shadow-lg">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-amber-500/30 pb-2.5 mb-3">
                <div className="flex items-center gap-2">
                  <Globe className="w-5 h-5 text-cyan-400 animate-pulse" />
                  <div>
                    <h3 className="text-sm font-black text-amber-300 tracking-wide">
                      ONLINE MULTIPLAYER & ROOM CODES
                    </h3>
                    <p className="text-[11px] text-amber-200/70">
                      Host your own arena or enter an opponent's room code to join their gladiatorial skirmish.
                    </p>
                  </div>
                </div>

                {/* Connection Status Pill */}
                <div
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-all ${
                    connectionStatus.type === 'success'
                      ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300'
                      : connectionStatus.type === 'error'
                      ? 'bg-red-950/80 border-red-500 text-red-300 animate-pulse'
                      : 'bg-amber-950/80 border-amber-500/50 text-amber-300'
                  }`}>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      connectionStatus.type === 'success'
                        ? 'bg-emerald-400'
                        : connectionStatus.type === 'error'
                        ? 'bg-red-400'
                        : 'bg-amber-400 animate-ping'
                    }`}
                  />
                  <span className="text-[11px] max-w-[220px] sm:max-w-[320px] truncate">
                    {connectionStatus.text}
                  </span>
                </div>
              </div>

              {/* Two Column Grid: Host Room & Join Room */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                
                {/* 1. Host Room Card */}
                <div className="bg-[#1e110a] border border-amber-600/40 rounded-xl p-3 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                        <Crown className="w-4 h-4 text-amber-400" /> Host Arena (Your Room)
                      </span>
                      <button
                        onClick={handleCreateNewRoom}
                        title="Generate New Room Code"
                        className="px-2 py-0.5 bg-amber-900/50 hover:bg-amber-800/70 border border-amber-500/40 rounded text-[10px] font-bold text-amber-300 flex items-center gap-1 transition-colors">
                        <RefreshCw className="w-3 h-3" /> New Code
                      </button>
                    </div>
                    <p className="text-[10px] text-amber-200/70 mb-2">
                      Give this Room Code to opponents to invite them to this lobby:
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-1">
                    <div className="flex-1 bg-black/80 border-2 border-amber-500/60 rounded-xl px-3 py-1.5 flex items-center justify-center shadow-inner">
                      <span className="text-base sm:text-lg font-black font-mono tracking-widest text-amber-300">
                        {roomCode}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={handleCopyRoomCode}
                        className="flex-1 sm:flex-initial px-3 py-2 bg-amber-600/40 hover:bg-amber-500/50 border border-amber-400/60 rounded-xl text-xs font-bold text-amber-200 flex items-center justify-center gap-1.5 transition-all shadow">
                        {codeCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        {codeCopied ? 'Copied Code!' : 'Copy Code'}
                      </button>

                      <button
                        onClick={handleCopyInviteLink}
                        title="Copy Full Direct URL Link"
                        className="px-3 py-2 bg-amber-950/60 hover:bg-amber-900/80 border border-amber-500/40 rounded-xl text-xs font-bold text-amber-300 flex items-center justify-center gap-1 transition-all shadow">
                        {linkCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Link className="w-3.5 h-3.5" />}
                        <span className="hidden sm:inline">{linkCopied ? 'Link Copied' : 'Invite Link'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* 2. Join Room Card (Prominent Input Field) */}
                <div className="bg-[#1e110a] border border-amber-600/40 rounded-xl p-3 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                        <LogIn className="w-4 h-4 text-cyan-400" /> Join Opponent's Room
                      </span>
                      <button
                        onClick={handlePasteCode}
                        title="Paste from clipboard"
                        className="px-2 py-0.5 bg-amber-900/50 hover:bg-amber-800/70 border border-amber-500/40 rounded text-[10px] font-bold text-amber-300 flex items-center gap-1 transition-colors">
                        <Sparkles className="w-3 h-3" /> Paste Code
                      </button>
                    </div>
                    <p className="text-[10px] text-amber-200/70 mb-2">
                      Have a code from another gladiator? Input it here to join their match:
                    </p>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleJoinRoom();
                    }}
                    className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-1">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={joinInputCode}
                        onChange={(e) => setJoinInputCode(e.target.value.toUpperCase())}
                        placeholder="ENTER ROOM CODE..."
                        maxLength={10}
                        autoCapitalize="characters"
                        autoCorrect="off"
                        spellCheck={false}
                        className="w-full bg-black/80 border-2 border-amber-500/60 focus:border-amber-400 rounded-xl px-3 py-1.5 text-xs sm:text-sm text-amber-200 font-mono font-bold uppercase tracking-wider placeholder:text-zinc-600 focus:outline-none shadow-inner"
                      />
                      {joinInputCode.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setJoinInputCode('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 p-0.5">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={!joinInputCode.trim()}
                      className={`px-4 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-md ${
                        joinInputCode.trim()
                          ? 'bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 cursor-pointer'
                          : 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700'
                      }`}>
                      <ArrowRight className="w-4 h-4" />
                      JOIN ROOM
                    </button>
                  </form>
                </div>
              </div>
            </div>

            {/* Player Customization Drawer (Name & Avatar) */}
            <div className="w-full bg-[#150d09] border border-amber-600/30 rounded-2xl p-3.5 mb-4">
              <div className="text-xs font-bold text-amber-300 mb-2 flex items-center gap-1.5">
                <User className="w-4 h-4 text-amber-400" />
                Player Profile Customization
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] text-amber-200/70 block mb-1">Your Gladiator Name:</label>
                  <input
                    type="text"
                    value={myUsername}
                    onChange={(e) => setMyUsername(e.target.value)}
                    maxLength={18}
                    className="w-full bg-black/70 border border-amber-500/50 rounded-xl px-3 py-1.5 text-xs text-amber-200 font-bold focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-[10px] text-amber-200/70 block mb-1">Choose Gladiator Class:</label>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                    {CHAMPION_PROFILES.map((champ) => {
                      const isSel = champ.id === myChampionId;
                      return (
                        <div
                          key={champ.id}
                          onClick={() => {
                            gameAudio.playCrispClick();
                            setMyChampionId(champ.id);
                          }}
                          className={`p-1.5 rounded-xl border cursor-pointer flex flex-col items-center text-center transition-all ${
                            isSel
                              ? 'border-amber-400 bg-amber-950/80 ring-2 ring-amber-400 scale-105 shadow-md'
                              : 'border-zinc-800 bg-black/40 hover:border-amber-600/60'
                          }`}>
                          <div className="w-8 h-8 overflow-hidden mb-0.5">
                            <img
                              src={ASSETS_MANIFEST[champ.assetKey]}
                              alt={champ.name}
                              className="w-full h-full object-contain"
                            />
                          </div>
                          <span className="text-[9px] font-bold text-amber-200 truncate w-full">
                            {champ.name}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* 4 Seat Slots Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              {lobbySlots.map((slot, idx) => {
                const seatStyle = SEAT_COLORS[slot.seat];
                const champProfile =
                  CHAMPION_PROFILES.find((p) => p.id === slot.championId) || CHAMPION_PROFILES[0];
                const isMySlot = slot.playerId === myPlayerId;

                return (
                  <div
                    key={idx}
                    className={`relative rounded-2xl border-2 p-3 flex flex-col justify-between transition-all bg-[#140c08] ${
                      slot.type !== 'empty' ? seatStyle.border : 'border-dashed border-zinc-700'
                    }`}>
                    
                    {/* Seat Header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white shadow"
                          style={{backgroundColor: seatStyle.hex}}>
                          {slot.seat + 1}
                        </div>
                        <span className="text-[11px] font-bold text-amber-200">
                          Seat {slot.seat + 1}
                        </span>
                      </div>
                      {slot.isHost && (
                        <span className="text-[8px] font-black px-1.5 py-0.5 bg-amber-500 text-slate-950 rounded-full flex items-center gap-0.5">
                          <Crown className="w-2.5 h-2.5 fill-current" /> HOST
                        </span>
                      )}
                    </div>

                    {/* Slot Body */}
                    {slot.type === 'empty' ? (
                      <div className="flex-1 flex flex-col items-center justify-center py-6 text-center">
                        <p className="text-xs text-zinc-500 mb-2 font-medium">Empty Gladiator Slot</p>
                        <button
                          onClick={() => handleAddBot(slot.seat)}
                          className="px-3 py-1.5 bg-amber-600/30 hover:bg-amber-600/50 border border-amber-500/40 rounded-xl text-xs font-bold text-amber-300 transition-all flex items-center gap-1 shadow">
                          <Plus className="w-3.5 h-3.5" /> Add Bot
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center text-center">
                        <div className="w-16 h-16 rounded-2xl overflow-hidden border border-amber-500/40 bg-black/60 p-1 mb-1.5 shadow-md">
                          <img
                            src={ASSETS_MANIFEST[champProfile.assetKey]}
                            alt={champProfile.name}
                            className="w-full h-full object-contain"
                          />
                        </div>

                        <div className="text-xs font-black text-amber-100 truncate w-full">
                          {slot.name}
                        </div>
                        <div className="text-[10px] text-amber-400/80 mb-2 truncate w-full">
                          {champProfile.name} ({champProfile.title})
                        </div>

                        {/* Bot Settings */}
                        {slot.type === 'bot' && (
                          <div className="w-full flex items-center justify-between bg-black/60 px-2 py-1 rounded-lg border border-amber-900/40 mb-2 text-[10px]">
                            <span className="text-zinc-400">AI Level:</span>
                            <div className="flex gap-1">
                              {(['easy', 'normal', 'tactical'] as BotDifficulty[]).map((d) => (
                                <button
                                  key={d}
                                  onClick={() => handleBotDifficultyChange(slot.seat, d)}
                                  className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${
                                    slot.botDifficulty === d ? 'bg-amber-500 text-slate-950 font-black' : 'text-zinc-400 hover:text-white'
                                  }`}>
                                  {d.substring(0, 3)}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Ready Toggle & Remove */}
                        <div className="w-full flex items-center gap-1.5">
                          {slot.type === 'human' ? (
                            <button
                              onClick={() => isMySlot && handleToggleReady(slot.seat)}
                              className={`flex-1 py-1 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all ${
                                slot.isReady
                                  ? 'bg-emerald-600/40 border border-emerald-400 text-emerald-300'
                                  : 'bg-zinc-800 text-zinc-400 hover:text-white'
                              }`}>
                              {slot.isReady ? <CheckCircle className="w-3.5 h-3.5" /> : null}
                              {slot.isReady ? 'READY' : 'NOT READY'}
                            </button>
                          ) : (
                            <div className="flex-1 py-1 bg-emerald-950/40 border border-emerald-500/40 rounded-lg text-xs font-bold text-emerald-300 text-center">
                              BOT READY
                            </div>
                          )}

                          {!slot.isHost && (
                            <button
                              onClick={() => handleRemoveSlot(slot.seat)}
                              className="p-1 rounded-lg bg-red-950/50 hover:bg-red-900/80 border border-red-500/40 text-red-300 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bottom Actions: Start Battle */}
            <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-amber-500/30">
              <button
                onClick={() => setIsHowToPlayOpen(true)}
                className="px-4 py-2 bg-[#1c0f08] hover:bg-[#2c170d] border border-amber-600/40 text-amber-300 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4" /> Rules & 48-Card Guide
              </button>

              <button
                ref={startBtnRef}
                onClick={handleStartBattle}
                className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black rounded-2xl text-sm shadow-xl flex items-center justify-center gap-2 transition-all">
                <Play className="w-5 h-5 fill-current" />
                START BATTLE ({lobbySlots.filter((s) => s.type !== 'empty').length}/4 GLADIATORS)
              </button>
            </div>
          </div>
        )}

        {/* =========================================================================
            2. DRAFTING & BIDDING OVERHAUL (3 ROUNDS, 4 CARDS PER ROUND)
            ========================================================================= */}
        {subPhase === 'DRAFT' && (
          <div className="w-full max-w-4xl bg-gradient-to-b from-[#2a170e]/95 via-[#1a0f0a]/95 to-[#120a06]/95 border-2 border-amber-500/60 rounded-2xl p-3 md:p-5 shadow-[0_0_40px_rgba(0,0,0,0.9)] flex flex-col items-center animate-fade-in backdrop-blur-md max-h-[92vh] overflow-y-auto">
            
            {/* Draft Header */}
            <div className="flex items-center justify-between w-full mb-2 border-b border-amber-500/30 pb-2">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-400" />
                <h2 className="text-base md:text-lg font-bold text-amber-300">
                  Antiquity Draft & Bidding (Round {draftRound + 1} of 3)
                </h2>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1 rounded-md bg-amber-900/60 border border-amber-500/50 text-amber-200">
                <span>Vitality Pool:</span>
                <strong className="text-emerald-400 flex items-center gap-1">
                  <Heart className="w-3.5 h-3.5 fill-current" />
                  {champions.find((c) => c.isPlayer)?.vitality || 20} HP
                </strong>
              </div>
            </div>

            {/* 4 Cards Revealed on Screen */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 w-full my-2">
              {draftPoolCards.map((card) => {
                const claimedByRank = bidderRanks.find((r) => r.claimedCard?.id === card.id);
                const currentRanker = bidderRanks[currentPickIdx];
                const isPlayerTurnToPick =
                  draftStep === 'PICKING' &&
                  currentRanker &&
                  currentRanker.isPlayer &&
                  !claimedByRank;

                return (
                  <div
                    key={card.id}
                    onClick={() => isPlayerTurnToPick && handlePlayerPickCard(card)}
                    style={{borderColor: card.themeColor}}
                    className={`relative flex flex-col items-center bg-[#150d09] p-2 rounded-xl border-2 transition-all ${
                      claimedByRank
                        ? 'border-zinc-700 opacity-50'
                        : isPlayerTurnToPick
                        ? 'bg-amber-950/60 shadow-[0_0_18px_rgba(251,191,36,0.6)] cursor-pointer hover:scale-105 ring-2 ring-amber-300'
                        : 'hover:border-amber-400'
                    }`}>
                    
                    <div className="w-full flex items-center justify-between mb-1">
                      <div className="flex items-center gap-0.5 bg-black/70 px-1 py-0.5 rounded border border-amber-500/40">
                        {card.req.map((face, idx) => (
                          <span key={idx} className="flex items-center">
                            {renderDieFaceIcon(face, 'w-3 h-3')}
                          </span>
                        ))}
                      </div>
                      <span
                        className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded text-white"
                        style={{backgroundColor: card.themeColor}}>
                        {card.category}
                      </span>
                    </div>

                    <div className="w-full text-center text-xs font-bold text-amber-200 mb-1 drop-shadow">
                      {card.name}
                    </div>

                    <p className="text-[9px] text-amber-200/80 text-center italic line-clamp-2 h-6 mb-1">
                      {card.effectDesc}
                    </p>

                    <div className="w-full text-center text-[9px] font-bold text-amber-300 bg-black/60 py-0.5 px-1 rounded border border-amber-500/30">
                      ✨ {card.bonusSummary}
                    </div>

                    {claimedByRank ? (
                      <div className="mt-2 w-full py-0.5 bg-red-950/80 border border-red-500/50 rounded text-center text-[9px] font-bold text-red-300">
                        ✓ {claimedByRank.champName.toUpperCase()}
                      </div>
                    ) : isPlayerTurnToPick ? (
                      <div className="mt-2 w-full py-1 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black rounded text-center text-[9px] animate-pulse">
                        👉 CLICK TO DRAFT
                      </div>
                    ) : (
                      <div className="mt-2 text-[9px] text-amber-400/60 font-medium">
                        {draftStep === 'BIDDING' ? 'Available' : 'Pending Pick'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Step 1: Bidding Panel */}
            {draftStep === 'BIDDING' && (
              <div className="w-full bg-[#180e09] border border-amber-600/40 rounded-xl p-3 mt-2 flex flex-col md:flex-row items-center justify-between gap-3">
                <div className="flex-1">
                  <h3 className="text-xs font-bold text-amber-300 mb-0.5">
                    Submit Secret Vitality Bid (1 to 10 HP)
                  </h3>
                  <p className="text-[10px] text-amber-200/70">
                    Wager Vitality Crystals to secure high pick priority! 1st place picks first from the 4 cards.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 bg-black/60 px-3 py-1 rounded-xl border border-amber-500/40">
                    <button
                      onClick={() => handlePlayerBidChange(-1)}
                      className="w-7 h-7 rounded-full bg-[#2a170e] hover:bg-[#3d2214] border border-amber-500/40 text-sm font-bold text-amber-300 flex items-center justify-center shadow">
                      -
                    </button>
                    <div className="flex flex-col items-center px-2">
                      <span className="text-lg font-black text-amber-400">{playerBid}</span>
                      <span className="text-[8px] text-amber-300/70">HP Wager</span>
                    </div>
                    <button
                      onClick={() => handlePlayerBidChange(1)}
                      className="w-7 h-7 rounded-full bg-[#2a170e] hover:bg-[#3d2214] border border-amber-500/40 text-sm font-bold text-amber-300 flex items-center justify-center shadow">
                      +
                    </button>
                  </div>

                  <button
                    onClick={handleConfirmBid}
                    className="px-5 py-2.5 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black rounded-xl text-xs shadow-lg transition-all flex items-center gap-1.5">
                    <Coins className="w-4 h-4" />
                    LOCK IN BID
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Draft Pick Ranking Order */}
            {draftStep !== 'BIDDING' && (
              <div className="w-full bg-[#180e09] border border-amber-600/40 rounded-xl p-3 mt-2">
                <div className="flex items-center justify-between text-xs font-bold text-amber-400 mb-2">
                  <span>Draft Pick Priority Queue:</span>
                  {draftStep === 'PICKING' && (
                    <span className="text-amber-300 animate-pulse">
                      Currently Picking: {bidderRanks[currentPickIdx]?.champName} ({currentPickIdx + 1}/4)
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  {bidderRanks.map((rank, idx) => (
                    <div
                      key={rank.champId}
                      className={`p-2 rounded-lg border flex flex-col text-xs transition-all ${
                        rank.isPlayer
                          ? 'bg-amber-950/70 border-amber-400 text-amber-200 ring-1 ring-amber-400'
                          : 'bg-black/50 border-amber-900/60 text-amber-100/70'
                      } ${currentPickIdx === idx && draftStep === 'PICKING' ? 'ring-2 ring-emerald-400 bg-emerald-950/40' : ''}`}>
                      <div className="flex items-center justify-between font-bold">
                        <span>
                          #{idx + 1} {rank.champName}
                        </span>
                        <span className="text-amber-400">{rank.bid} HP</span>
                      </div>
                      <div className="text-[9px] mt-1 text-amber-300/80 truncate">
                        {rank.claimedCard ? `Drafted: ${rank.claimedCard.name}` : 'Picking...'}
                      </div>
                    </div>
                  ))}
                </div>

                {draftStep === 'ROUND_SUMMARY' && (
                  <div className="mt-3 flex justify-end">
                    <button
                      onClick={handleNextDraftStep}
                      className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-slate-950 font-black rounded-xl text-xs shadow-lg transition-all flex items-center gap-1.5">
                      {draftRound < 2
                        ? `PROCEED TO DRAFT ROUND ${draftRound + 2} OF 3 ➔`
                        : 'ENTER THE COLISEUM ARENA ⚔️'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            3. ARENA SKIRMISH BOARD (9x9 GRID)
            ========================================================================= */}
        {subPhase === 'SKIRMISH' && (
          <div className="flex-1 w-full h-full min-h-0 relative flex items-center justify-center p-1 md:p-2 select-none">
            <div className="relative w-full max-w-[760px] aspect-square flex items-center justify-center rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.95)] border-4 border-[#52331c]">
              
              {/* Bleachers & Coliseum Ambience */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  backgroundColor: '#1c1009',
                  backgroundImage: `
                    radial-gradient(circle at center, transparent 38%, rgba(20, 10, 6, 0.95) 75%),
                    repeating-conic-gradient(from 0deg at 50% 50%, #26160c 0deg 10deg, #1c1008 10deg 20deg)
                  `,
                }}>
                <div className="absolute inset-0 rounded-full border-[12px] border-[#382012]/80 opacity-90" />
                <div className="absolute inset-4 rounded-full border-[10px] border-[#2c180e]/90 opacity-80" />

                {/* Torches */}
                <div className="absolute top-8 left-8 flex flex-col items-center pointer-events-none">
                  <Flame className="w-4 h-4 text-amber-400 animate-pulse drop-shadow-[0_0_8px_rgba(245,158,11,0.9)]" />
                </div>
                <div className="absolute top-8 right-8 flex flex-col items-center pointer-events-none">
                  <Flame className="w-4 h-4 text-amber-400 animate-pulse drop-shadow-[0_0_8px_rgba(245,158,11,0.9)]" />
                </div>
                <div className="absolute bottom-8 left-8 flex flex-col items-center pointer-events-none">
                  <Flame className="w-4 h-4 text-amber-400 animate-pulse drop-shadow-[0_0_8px_rgba(245,158,11,0.9)]" />
                </div>
                <div className="absolute bottom-8 right-8 flex flex-col items-center pointer-events-none">
                  <Flame className="w-4 h-4 text-amber-400 animate-pulse drop-shadow-[0_0_8px_rgba(245,158,11,0.9)]" />
                </div>
              </div>

              {/* Heavy Perimeter Wall */}
              <div className="absolute inset-4 md:inset-6 rounded-full border-[8px] md:border-[10px] border-[#4a2e19] shadow-[inset_0_8px_16px_rgba(0,0,0,0.9)] pointer-events-none z-10" />

              {/* 9x9 Sand Pit Arena Grid */}
              <div
                className="relative grid grid-cols-9 gap-0.5 md:gap-1 w-[82%] h-[82%] p-1.5 md:p-2 rounded-2xl overflow-visible z-10 shadow-[inset_0_0_30px_rgba(0,0,0,0.85)]"
                style={{
                  backgroundColor: '#d8a85c',
                  backgroundImage: `
                    radial-gradient(circle at center, #f5c77e 0%, #dfa657 55%, #ba8239 85%, #8f5c22 100%),
                    repeating-linear-gradient(45deg, rgba(255, 230, 160, 0.08) 0px, rgba(255, 230, 160, 0.08) 2px, transparent 2px, transparent 10px)
                  `,
                }}>
                {arenaGrid.map((row, r) =>
                  row.map((tile, c) => {
                    if (tile.type === 'void') {
                      return <div key={`${r}-${c}`} className="invisible pointer-events-none" />;
                    }

                    const champOnTile = champions.find((ch) => ch.isAlive && ch.r === r && ch.c === c);
                    const isMoveTarget = validMoveTiles.some((m) => m.r === r && m.c === c);
                    const isTrapTarget = validTrapTiles.some((m) => m.r === r && m.c === c);
                    const isTargetChamp = champOnTile && validTargetChamps.includes(champOnTile.id);

                    return (
                      <div
                        key={`${r}-${c}`}
                        onClick={() => {
                          if (champOnTile) {
                            handleTargetChampionClick(champOnTile.id);
                          } else {
                            handleTileClick(r, c);
                          }
                        }}
                        className={`relative rounded-lg flex items-center justify-center aspect-square transition-all duration-200 cursor-pointer overflow-visible ${
                          tile.type === 'fountain'
                            ? 'bg-[#cf994c]/20 border border-cyan-400/40 hover:border-cyan-300'
                            : tile.type === 'spikes'
                            ? 'bg-[#cf994c]/20 border border-red-500/40 hover:border-red-400'
                            : tile.type === 'pillar'
                            ? 'bg-transparent border-transparent'
                            : 'bg-[#cf994c]/20 border border-[#b8833b]/30 hover:border-amber-300'
                        } ${
                          isMoveTarget
                            ? 'ring-2 ring-emerald-400 bg-emerald-700/50 animate-pulse z-30 shadow-[0_0_16px_rgba(52,211,153,0.8)]'
                            : ''
                        } ${
                          isTrapTarget
                            ? 'ring-2 ring-orange-500 bg-orange-700/50 animate-pulse z-30 shadow-[0_0_16px_rgba(249,115,22,0.8)]'
                            : ''
                        } ${
                          isTargetChamp
                            ? 'ring-2 ring-red-500 bg-red-800/60 animate-bounce z-30 shadow-[0_0_18px_rgba(239,68,68,0.9)]'
                            : ''
                        }`}>
                        
                        {/* Fountain */}
                        {tile.type === 'fountain' && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <img
                              src={ASSETS_MANIFEST.tile_fountain}
                              alt="Healing Pool"
                              className="w-[85%] h-[85%] object-contain drop-shadow-[0_2px_8px_rgba(34,211,238,0.8)]"
                            />
                            <div className="absolute -bottom-1 z-20 px-1 py-0 bg-cyan-950/90 border border-cyan-400/80 rounded-full text-[7px] font-black text-cyan-300">
                              ⛲ {tile.charges ?? 5}/5
                            </div>
                          </div>
                        )}

                        {/* Spikes */}
                        {tile.type === 'spikes' && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <img
                              src={ASSETS_MANIFEST.tile_spikes}
                              alt="Spike Pit"
                              className="w-[85%] h-[85%] object-contain drop-shadow-[0_3px_6px_rgba(0,0,0,0.8)]"
                            />
                          </div>
                        )}

                        {/* Pillar */}
                        {tile.type === 'pillar' && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-20">
                            <img
                              src={ASSETS_MANIFEST.tile_pillar}
                              alt="Stone Pillar"
                              className="w-[78%] h-[92%] object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)]"
                            />
                          </div>
                        )}

                        {/* Target Overlays */}
                        {isMoveTarget && (
                          <div className="absolute inset-1 rounded-md border-2 border-emerald-300 bg-emerald-400/20 flex items-center justify-center pointer-events-none">
                            <Feather className="w-3.5 h-3.5 text-emerald-200 animate-bounce" />
                          </div>
                        )}

                        {isTargetChamp && (
                          <div className="absolute inset-0 rounded-lg border-2 border-red-500 bg-red-600/30 flex items-center justify-center pointer-events-none">
                            <Target className="w-5 h-5 text-red-300 animate-spin" style={{animationDuration: '4s'}} />
                          </div>
                        )}

                        {/* Champion Unit */}
                        {champOnTile && (
                          <div className="relative z-30 w-full h-full flex flex-col items-center justify-end pointer-events-none pb-0.5">
                            <div className="relative w-full h-[115%] -top-0.5 flex items-end justify-center">
                              <img
                                src={ASSETS_MANIFEST[champOnTile.assetKey]}
                                alt={champOnTile.name}
                                className={`w-full h-full object-contain filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.85)] ${
                                  champOnTile.id === activeChampion.id
                                    ? 'scale-110 drop-shadow-[0_0_12px_rgba(251,191,36,0.9)]'
                                    : ''
                                }`}
                              />
                            </div>

                            {/* Overhead HP & Seat Badge Pill */}
<div className="absolute -top-6 md:-top-7 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-[#1c0e08]/95 px-1.5 py-0.5 rounded-full border border-amber-400/90 text-[7px] md:text-[8px] font-black shadow-[0_3px_10px_rgba(0,0,0,0.9)] z-40 whitespace-nowrap">
  <div
    className="w-2.5 h-2.5 rounded-full flex items-center justify-center text-[6px] text-white"
    style={{backgroundColor: champOnTile.seatColor}}>
    {champOnTile.seat + 1}
  </div>
  
  {champOnTile.isPlayer ? (
    <>
      <span className="text-emerald-400 flex items-center gap-0.5">
        <Heart className="w-2 h-2 fill-current" />
        {champOnTile.vitality}
      </span>
      {champOnTile.shields > 0 && (
        <span className="text-cyan-400 flex items-center gap-0.5">
          <Shield className="w-2 h-2 fill-current" />
          {champOnTile.shields}
        </span>
      )}
    </>
  ) : (
    <span className="text-amber-200 px-1">{champOnTile.name}</span>
  )}
</div>
                          </div>
                        )}

                        {/* Floating Damage / Buff Texts */}
                        {floatingTexts
                          .filter((ft) => ft.r === r && ft.c === c)
                          .map((ft) => (
                            <div
                              key={ft.id}
                              className="absolute -top-10 md:-top-11 z-50 text-[10px] md:text-xs font-black drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)] animate-bounce pointer-events-none whitespace-nowrap px-1.5 py-0.5 rounded-md bg-black/85 border border-amber-400/60"
                              style={{color: ft.color}}>
                              {ft.text}
                            </div>
                          ))}
                      </div>
                    );
                  }),
                )}
              </div>

              {/* Ambient Dust Particles */}
              {particles.map((p) => (
                <div
                  key={p.id}
                  className="absolute rounded-full pointer-events-none animate-pulse"
                  style={{
                    left: `${p.x}%`,
                    top: `${p.y}%`,
                    width: `${p.size}px`,
                    height: `${p.size}px`,
                    backgroundColor: p.color,
                    opacity: p.opacity,
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* =========================================================================
            4. TACTICAL COMBAT CONTROL PANEL & DICE DOCK
            ========================================================================= */}
        {subPhase === 'SKIRMISH' && (
          <div className="w-full md:w-84 lg:w-96 bg-gradient-to-b from-[#24130a]/95 via-[#1a0e07]/95 to-[#120a05]/95 border-2 border-amber-500/50 rounded-2xl p-2.5 md:p-3.5 flex flex-col gap-2 shadow-[0_4px_25px_rgba(0,0,0,0.9)] backdrop-blur-md shrink-0 max-h-[92vh] overflow-y-auto">
            {/* Active Turn Header */}
            <div className="flex items-center justify-between border-b border-amber-500/30 pb-1.5">
              <div className="flex items-center gap-2">
                <div
                  className="w-10 h-10 rounded-xl overflow-hidden border-2 border-amber-400 bg-black/70 p-0.5 shadow-md"
                  style={{boxShadow: `0 0 10px ${activeChampion.color}`}}>
                  <img
                    src={ASSETS_MANIFEST[activeChampion.assetKey]}
                    alt={activeChampion.name}
                    className="w-full h-full object-contain"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black text-white"
                      style={{backgroundColor: activeChampion.seatColor}}>
                      {activeChampion.seat + 1}
                    </div>
                    <h3 className="text-xs md:text-sm font-black text-amber-200">
                      {activeChampion.name}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 text-[10px]">
                    {activeChampion.isPlayer ? (
                      <>
                        <span className="flex items-center gap-0.5 text-emerald-400 font-bold">
                          <Heart className="w-3 h-3 fill-current" /> {activeChampion.vitality}/{activeChampion.maxVitality}
                        </span>
                        {activeChampion.shields > 0 && (
                          <span className="flex items-center gap-0.5 text-cyan-400 font-bold bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-500/40">
                            <Shield className="w-3 h-3 fill-current" /> {activeChampion.shields}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-amber-500/80 font-bold tracking-wider">
                        ENEMY GLADIATOR
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-[10px] bg-black/60 px-2 py-0.5 rounded-md text-amber-300 font-black border border-amber-500/30">
                Turn {turnCount}
              </div>
            </div>

            {/* Combat Dice Tray (7 Dice with Unspent / Spent Visuals) */}
            <div className="bg-[#120a05] p-2 rounded-xl border border-amber-600/30 shadow-inner">
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="font-bold text-amber-300 flex items-center gap-1">
                  🎲 Combat Dice Pool ({actionDice.length} Dice)
                </span>
                <span className="text-amber-200/70 text-[10px]">
                  Rerolls: <strong className="text-amber-400 font-bold">{rerollsLeft}</strong>
                </span>
              </div>

              {/* 7 Custom Combat Dice Display */}
              <div className="grid grid-cols-7 gap-1 mb-1.5">
                {actionDice.map((die) => {
                  const iconKey =
                    die.face === 'strike'
                      ? 'icon_dice_sword'
                      : die.face === 'wing'
                      ? 'icon_dice_wing'
                      : die.face === 'shield'
                      ? 'icon_dice_shield'
                      : 'icon_dice_orb';

                  return (
                    <div
                      key={die.id}
                      onClick={() => isHumanTurn && !die.spent && handleToggleDiceLock(die.id)}
                      className={`relative aspect-square rounded-lg p-0.5 flex items-center justify-center transition-all border ${
                        die.spent
                          ? 'border-zinc-800 bg-zinc-900/40 opacity-35 grayscale'
                          : die.locked
                          ? 'border-amber-400 bg-amber-950/90 shadow-[0_0_10px_rgba(251,191,36,0.6)] cursor-pointer'
                          : 'border-amber-900/60 bg-[#1c0f08] hover:border-amber-500/60 cursor-pointer'
                      } ${die.rolling ? 'animate-spin' : ''}`}>
                      <img
                        src={ASSETS_MANIFEST[iconKey]}
                        alt={die.face}
                        className="w-full h-full object-contain"
                      />
                      {die.spent && (
                        <div className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-zinc-500">
                          ✕
                        </div>
                      )}
                      {die.locked && !die.spent && (
                        <div className="absolute -top-1 -right-1 text-[7px] bg-amber-400 text-slate-950 font-black px-1 rounded-full">
                          ✓
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Unspent Available Dice Counters */}
              <div className="grid grid-cols-4 gap-1 text-[9px] text-center bg-black/50 p-1 rounded-lg border border-amber-900/30 mb-1.5">
                <div className="text-red-300 font-bold">⚔️ {unspentCounts.strike} Strikes</div>
                <div className="text-emerald-300 font-bold">🪽 {unspentCounts.wing} Wings</div>
                <div className="text-cyan-300 font-bold">🛡️ {unspentCounts.shield} Shields</div>
                <div className="text-purple-300 font-bold">🔮 {unspentCounts.spell} Spells</div>
              </div>

              {/* Reroll Button (Human Turn Only) */}
              {isHumanTurn && (
                <button
                  onClick={handleRerollDice}
                  disabled={rerollsLeft <= 0}
                  className={`w-full py-1 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    rerollsLeft > 0
                      ? 'bg-amber-600/30 hover:bg-amber-600/50 border border-amber-500/50 text-amber-300 shadow'
                      : 'bg-[#1a0e08] text-amber-100/30 border border-amber-950 cursor-not-allowed'
                  }`}>
                  <RotateCw className="w-3 h-3" />
                  REROLL UNLOCKED DICE ({rerollsLeft} Left)
                </button>
              )}
            </div>

            {/* Basic Actions with Unspent Dice */}
            {isHumanTurn && (
              <div>
                <div className="text-[10px] font-bold text-amber-300/80 mb-1 px-1">
                  ⚡ Standard Actions:
                </div>
                <div className="grid grid-cols-4 gap-1 text-[10px]">
                  <button
                    onClick={handleSelectBasicStrike}
                    disabled={unspentCounts.strike < 2}
                    className={`p-1.5 rounded-lg border flex flex-col items-center justify-center transition-all ${
                      selectedActionType === 'basic_strike'
                        ? 'border-red-400 bg-red-950 text-red-200 ring-2 ring-red-400'
                        : unspentCounts.strike >= 2
                        ? 'border-red-600/50 bg-red-900/30 hover:bg-red-800/40 text-red-300 cursor-pointer'
                        : 'border-zinc-800 bg-[#120a05] text-zinc-600 cursor-not-allowed'
                    }`}>
                    <Swords className="w-3.5 h-3.5 mb-0.5 text-red-400" />
                    <span className="font-bold leading-tight">2 Strike</span>
                    <span className="text-[8px] opacity-75">1 DMG</span>
                  </button>

                  <button
                    onClick={handleSelectBasicMove}
                    disabled={unspentCounts.wing < 2}
                    className={`p-1.5 rounded-lg border flex flex-col items-center justify-center transition-all ${
                      selectedActionType === 'basic_move'
                        ? 'border-emerald-400 bg-emerald-950 text-emerald-200 ring-2 ring-emerald-400'
                        : unspentCounts.wing >= 2
                        ? 'border-emerald-600/50 bg-emerald-900/30 hover:bg-emerald-800/40 text-emerald-300 cursor-pointer'
                        : 'border-zinc-800 bg-[#120a05] text-zinc-600 cursor-not-allowed'
                    }`}>
                    <Feather className="w-3.5 h-3.5 mb-0.5 text-emerald-400" />
                    <span className="font-bold leading-tight">2 Wing</span>
                    <span className="text-[8px] opacity-75">1 Move</span>
                  </button>

                  <button
                    onClick={handleSelectBasicShield}
                    disabled={unspentCounts.shield < 1}
                    className={`p-1.5 rounded-lg border flex flex-col items-center justify-center transition-all ${
                      unspentCounts.shield >= 1
                        ? 'border-cyan-600/50 bg-cyan-900/30 hover:bg-cyan-800/40 text-cyan-300 cursor-pointer'
                        : 'border-zinc-800 bg-[#120a05] text-zinc-600 cursor-not-allowed'
                    }`}>
                    <Shield className="w-3.5 h-3.5 mb-0.5 text-cyan-400" />
                    <span className="font-bold leading-tight">1 Shield</span>
                    <span className="text-[8px] opacity-75">+1 Shield</span>
                  </button>

                  <button
                    onClick={handleSelectBasicSpell}
                    disabled={unspentCounts.spell < 2}
                    className={`p-1.5 rounded-lg border flex flex-col items-center justify-center transition-all ${
                      selectedActionType === 'basic_spell'
                        ? 'border-purple-400 bg-purple-950 text-purple-200 ring-2 ring-purple-400'
                        : unspentCounts.spell >= 2
                        ? 'border-purple-600/50 bg-purple-900/30 hover:bg-purple-800/40 text-purple-300 cursor-pointer'
                        : 'border-zinc-800 bg-[#120a05] text-zinc-600 cursor-not-allowed'
                    }`}>
                    <Zap className="w-3.5 h-3.5 mb-0.5 text-purple-400" />
                    <span className="font-bold leading-tight">2 Spell</span>
                    <span className="text-[8px] opacity-75">Global</span>
                  </button>
                </div>
              </div>
            )}

            {/* DRAFTED CARDS INVENTORY */}
            {isHumanTurn && (
              <div>
                <div className="text-[10px] font-bold text-amber-300/80 mb-1 px-1 flex items-center justify-between">
                  <span>🃏 Drafted Antiquity Cards:</span>
                  <span className="text-[9px] text-amber-400/70">{activeChampion.inventory.length} Cards</span>
                </div>

                <div className="space-y-1 max-h-[125px] overflow-y-auto pr-0.5">
                  {activeChampion.inventory.length === 0 ? (
                    <div className="text-[10px] text-zinc-500 italic text-center py-2 bg-black/30 rounded-lg">
                      No cards drafted.
                    </div>
                  ) : (
                    activeChampion.inventory.map((card, idx) => {
                      const affordable = canAffordReq(card.req, actionDice);
                      const isPending = pendingCard?.id === card.id;

                      return (
                        <div
                          key={`${card.id}-${idx}`}
                          onClick={() => affordable && handleCardClick(card)}
                          style={{borderColor: card.themeColor}}
                          className={`p-1.5 rounded-lg border flex items-center justify-between gap-2 transition-all ${
                            isPending
                              ? 'bg-amber-950 ring-2 ring-amber-300 shadow-md'
                              : affordable
                              ? 'bg-[#180e09] hover:bg-[#25150d] cursor-pointer shadow hover:scale-[1.01]'
                              : 'bg-[#100804] opacity-45 cursor-not-allowed border-zinc-800'
                          }`}>
                          <div className="flex items-center gap-0.5 bg-black/80 px-1 py-0.5 rounded border border-amber-500/30 shrink-0">
                            {card.req.map((face, fIdx) => (
                              <span key={fIdx}>
                                {renderDieFaceIcon(face, 'w-3 h-3')}
                              </span>
                            ))}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold text-amber-200 truncate">
                                {card.name}
                              </span>
                              <span
                                className="text-[7px] font-black uppercase px-1 rounded text-white"
                                style={{backgroundColor: card.themeColor}}>
                                {card.category}
                              </span>
                            </div>
                            <p className="text-[8px] text-amber-300/80 truncate">
                              {card.bonusSummary}
                            </p>
                          </div>

                          <div className="shrink-0">
                            {affordable ? (
                              <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-emerald-600/30 border border-emerald-400/50 text-emerald-300">
                                PLAY
                              </span>
                            ) : (
                              <span className="text-[8px] text-zinc-500">
                                Need dice
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* End Turn Confirmation */}
            {isHumanTurn && (
              <button
                onClick={handleEndTurn}
                className="w-full py-2 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black rounded-xl text-xs tracking-wider shadow-lg flex items-center justify-center gap-1.5 transition-all">
                PASS TURN TO NEXT GLADIATOR ➔
              </button>
            )}

            {/* Battle Chronicle */}
            <div className="min-h-[45px] max-h-[65px] bg-[#100905] border border-amber-900/40 rounded-xl p-1.5 overflow-y-auto text-[9px] space-y-0.5 text-amber-200/80 shadow-inner">
              {battleLogs.slice(0, 5).map((log, i) => (
                <div key={i} className="leading-tight">
                  {log}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* --- IN-GAME PAUSE / SETTINGS MENU --- */}
      {isGameMenuOpen && (
        <MenuOverlay tone="neutral" zIndex={60}>
          <div className="w-full max-w-sm bg-gradient-to-b from-[#2a170e] to-[#140b07] border-2 border-amber-500/50 rounded-2xl p-6 shadow-2xl flex flex-col items-center">
            <h2 className="text-2xl font-black text-amber-400 mb-4 tracking-wider">
              ARENA PAUSE MENU
            </h2>

            <div className="w-full space-y-2.5">
              <button
                onClick={() => setIsGameMenuOpen(false)}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-lg text-sm transition-colors flex items-center justify-center gap-2">
                <Play className="w-4 h-4 fill-current" />
                RESUME DUEL
              </button>

              <div className="grid grid-cols-2 gap-2 my-2">
                <button
                  onClick={() => {
                    const newMuted = gameAudio.toggleMute();
                    setIsSfxMuted(newMuted);
                  }}
                  className={`py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                    isSfxMuted
                      ? 'bg-red-950/60 border-red-500/40 text-red-300'
                      : 'bg-[#201108] border-amber-600/40 text-amber-300'
                  }`}>
                  {isSfxMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  SFX: {isSfxMuted ? 'OFF' : 'ON'}
                </button>

                <button
                  onClick={() => setIsMusicMuted((prev) => !prev)}
                  className={`py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                    isMusicMuted
                      ? 'bg-red-950/60 border-red-500/40 text-red-300'
                      : 'bg-[#201108] border-amber-600/40 text-amber-300'
                  }`}>
                  {isMusicMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  MUSIC: {isMusicMuted ? 'OFF' : 'ON'}
                </button>
              </div>

              {/* Turn Timer Setting in Pause Menu */}
              <div className="w-full bg-[#1c0f08] border border-amber-600/40 rounded-lg p-2.5 my-1 flex items-center justify-between text-xs">
                <span className="text-amber-300 font-bold flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-400" /> Turn Timer:
                </span>
                {lobbyMode === 'solo' ? (
                  <span className="text-[11px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/40">
                    ∞ No Limit (Solo)
                  </span>
                ) : (
                  <button
                    onClick={() => {
                      gameAudio.playCrispClick();
                      const nextOpt: TurnTimerOption = multiplayerTimerOption === '90s' ? 'unlimited' : '90s';
                      setMultiplayerTimerOption(nextOpt);
                      const nextSec = nextOpt === 'unlimited' ? null : TURN_DURATION_MULTIPLAYER_DEFAULT;
                      setTurnTimerSec(nextSec);
                      broadcastLobbyState(lobbySlots, nextOpt);
                    }}
                    className="px-2.5 py-1 bg-amber-600/30 hover:bg-amber-600/50 border border-amber-500/40 rounded text-[11px] font-black text-amber-200 transition-colors">
                    {multiplayerTimerOption === '90s' ? '⏱️ 90s (Click for No Limit)' : '∞ No Limit (Click for 90s)'}
                  </button>
                )}
              </div>

              <button
                onClick={() => {
                  setIsGameMenuOpen(false);
                  setIsHowToPlayOpen(true);
                }}
                className="w-full py-2 bg-[#201108] hover:bg-[#2e190d] border border-amber-600/40 text-amber-300 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5">
                <HelpCircle className="w-4 h-4" />
                ARENA RULES & 48 CARDS GUIDE
              </button>

              <button
                onClick={() => {
                  setIsGameMenuOpen(false);
                  startSkirmishMatchFromLobby(lobbySlots);
                }}
                className="w-full py-2 bg-[#201108] hover:bg-[#2e190d] border border-amber-600/40 text-amber-300 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5">
                <RotateCw className="w-4 h-4" />
                RESTART MATCH
              </button>

              <button
                onClick={() => {
                  setIsGameMenuOpen(false);
                  setSubPhase('LOBBY');
                  setGameState((prev) => ({...prev, status: 'START'}));
                }}
                className="w-full py-2 bg-red-950/60 hover:bg-red-900/80 border border-red-500/40 text-red-300 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5">
                <Home className="w-4 h-4" />
                RETURN TO LOBBY
              </button>
            </div>
          </div>
        </MenuOverlay>
      )}

      {/* --- HOW TO PLAY MODAL --- */}
      {isHowToPlayOpen && (
        <MenuOverlay tone="neutral" zIndex={70}>
          <div className="w-full max-w-lg bg-gradient-to-b from-[#2a170e] to-[#140b07] border-2 border-amber-500/50 rounded-2xl p-5 md:p-6 shadow-2xl flex flex-col text-amber-100">
            <div className="flex items-center justify-between border-b border-amber-500/30 pb-3 mb-3">
              <h2 className="text-xl font-bold text-amber-400 flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-400" />
                4-Player Rules & 48-Card System
              </h2>
              <button
                onClick={() => setIsHowToPlayOpen(false)}
                className="text-amber-300 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs leading-relaxed max-h-[60vh] overflow-y-auto pr-1">
              <div>
                <h3 className="font-bold text-amber-300 mb-0.5">1. 4-Player Turn Cycle</h3>
                <p className="text-amber-200/80">
                  Matches support 2 to 4 gladiators (human & AI bots) in Seat 1 (Red/Host), Seat 2 (Blue), Seat 3 (Green), and Seat 4 (Gold).
                  <br />• <strong>Solo Mode vs Bots:</strong> No turn time limit — take all the time you need to plan your moves.
                  <br />• <strong>Multiplayer Mode:</strong> 90 seconds per turn by default, with an optional "No Time Limit" setting.
                </p>
              </div>

              <div>
                <h3 className="font-bold text-amber-300 mb-0.5">2. 6-Face Dice Allocation</h3>
                <p className="text-amber-200/80">
                  Each turn, you roll 7 dice with 6 faces (2 Strike, 2 Wing, 1 Shield, 1 Spell):
                  <br />• <strong>2 Strike:</strong> Deal 1 DMG adjacent.
                  <br />• <strong>2 Wing:</strong> Move 1 space on the 9x9 arena.
                  <br />• <strong>1 Shield:</strong> Gain +1 Shield (absorbs hits before HP).
                  <br />• <strong>2 Spell:</strong> Deal 1 DMG to any target on the board.
                </p>
              </div>

              <div>
                <h3 className="font-bold text-amber-300 mb-0.5">3. 48 Antiquity Cards & 3 Drafting Rounds</h3>
                <p className="text-amber-200/80">
                  Before entering the sand, participate in 3 drafting rounds. Submit secret Vitality bids to claim priority from the 4 drawn cards!
                </p>
              </div>

              <div>
                <h3 className="font-bold text-amber-300 mb-0.5">4. Healing Pools & Stone Pillars</h3>
                <p className="text-cyan-300">
                  Rest on Healing Pools to recover vitality (5 charges per pool). Slam foes into stone pillars or walls for bonus collision damage!
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsHowToPlayOpen(false)}
              className="mt-4 w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs transition-colors">
              RETURN TO ARENA
            </button>
          </div>
        </MenuOverlay>
      )}

      {/* --- VICTORY OVERLAY --- */}
      {gameState.status === 'VICTORY' && (
        <Overlay
          title="VICTORIA AETERNA"
          description={`You stand as the sole surviving Gladiator of the Coliseum! Final Glory Score: ${gameState.score}`}
          actionLabel="RETURN TO LOBBY"
          onAction={() => {
            setSubPhase('LOBBY');
            setGameState((prev) => ({...prev, status: 'START'}));
          }}
          icon={<RotateCw size={24} />}
          tone="victory"
        />
      )}

      {/* --- GAME OVER OVERLAY --- */}
      {gameState.status === 'GAME_OVER' && (
        <Overlay
          title="GLADIATOR FALLEN"
          description={`Your champion was vanquished on the arena sands. Final Glory Score: ${gameState.score}`}
          actionLabel="RETURN TO LOBBY"
          onAction={() => {
            setSubPhase('LOBBY');
            setGameState((prev) => ({...prev, status: 'START'}));
          }}
          icon={<RotateCw size={24} />}
          tone="danger"
        />
      )}
    </div>
  );
}
