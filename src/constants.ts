export interface SpriteConfig {
  url: string;
  frameWidth?: number;
  frameHeight?: number;
  frameCount?: number;
}

/**
 * Configuration for Arena of Champions / Aether Coliseum.
 */
export const CONFIG = {
  // Game Initialization
  title: {
    value: 'Arena of Champions',
    type: 'string',
    label: 'Game Title',
    group: 'GAME',
  },
  baseCanvasWidth: {
    value: 1376,
    type: 'number',
    label: 'Base Canvas Width',
    group: 'GAME',
  },
  baseCanvasHeight: {
    value: 768,
    type: 'number',
    label: 'Base Canvas Height',
    group: 'GAME',
  },

  // System Loop
  targetFPS: {
    value: 60,
    type: 'number',
    label: 'Target FPS',
    group: 'SYSTEM',
  },
  stepMs: {
    value: 1000 / 60,
    type: 'number',
    label: 'Step MS',
    group: 'SYSTEM',
  },
  maxSubSteps: {
    value: 5,
    type: 'number',
    label: 'Max Sub Steps',
    group: 'SYSTEM',
  },

  // Thematic Palette & Audio
  backgroundColor: {
    value: '#0d0906',
    type: 'color',
    label: 'Background Color',
    group: 'THEME',
  },
  primaryColor: {
    value: '#f59e0b',
    type: 'color',
    label: 'Primary Color',
    group: 'THEME',
  },
  fontFamily: {
    value: 'Cinzel, Trajan Pro, serif',
    type: 'string',
    label: 'Font Family',
    group: 'THEME',
  },
  defaultMusicVolume: {
    value: 0.5,
    type: 'number',
    label: 'Default Music Volume',
    group: 'AUDIO',
  },
  defaultSfxVolume: {
    value: 0.65,
    type: 'number',
    label: 'Default SFX Volume',
    group: 'AUDIO',
  },

  // Rules & Gameplay Tuning
  startingVitality: {
    value: 20,
    type: 'number',
    label: 'Starting Vitality Crystals',
    group: 'Rules',
  },
  maxDiceCount: {
    value: 7,
    type: 'number',
    label: 'Dice Per Turn',
    group: 'Rules',
  },
  baseRerolls: {
    value: 1,
    type: 'number',
    label: 'Base Free Rerolls',
    group: 'Rules',
  },
  baseStrikeDamage: {
    value: 1,
    type: 'number',
    label: 'Base Strike Damage',
    group: 'Rules',
  },
  pillarSlamDamage: {
    value: 1,
    type: 'number',
    label: 'Pillar Collision Bonus Damage',
    group: 'Rules',
  },
  spikeTrapDamage: {
    value: 1,
    type: 'number',
    label: 'Spike Trap Direct Damage',
    group: 'Rules',
  },
  fountainHealing: {
    value: 1,
    type: 'number',
    label: 'Fountain Healing Per Turn',
    group: 'Rules',
  },
  gridSize: {
    value: 9,
    type: 'number',
    label: 'Arena Grid Dimension (9x9)',
    group: 'Grid',
  },

  // Asset Dimensions & Aspect Ratios
  assetBgColiseumAspectRatio: {
    value: 1376 / 768,
    type: 'number',
    label: 'Coliseum Background Aspect Ratio',
    group: 'ASSETS',
  },
  assetBgColiseumWidth: {
    value: 1376,
    type: 'number',
    label: 'Coliseum Background Width',
    group: 'ASSETS',
  },
  assetBgColiseumHeight: {
    value: 768,
    type: 'number',
    label: 'Coliseum Background Height',
    group: 'ASSETS',
  },
  assetSolarPaladinAspectRatio: {
    value: 754 / 856,
    type: 'number',
    label: 'Solar Paladin Aspect Ratio',
    group: 'ASSETS',
  },
  assetStormBerserkerAspectRatio: {
    value: 541 / 820,
    type: 'number',
    label: 'Storm Berserker Aspect Ratio',
    group: 'ASSETS',
  },
  assetShadowWeaverAspectRatio: {
    value: 769 / 837,
    type: 'number',
    label: 'Shadow Weaver Aspect Ratio',
    group: 'ASSETS',
  },
  assetGaiaWardenAspectRatio: {
    value: 559 / 918,
    type: 'number',
    label: 'Gaia Warden Aspect Ratio',
    group: 'ASSETS',
  },
  assetPillarAspectRatio: {
    value: 421 / 853,
    type: 'number',
    label: 'Pillar Aspect Ratio',
    group: 'ASSETS',
  },
  assetFountainAspectRatio: {
    value: 880 / 752,
    type: 'number',
    label: 'Fountain Aspect Ratio',
    group: 'ASSETS',
  },
  assetSpikesAspectRatio: {
    value: 965 / 674,
    type: 'number',
    label: 'Spikes Aspect Ratio',
    group: 'ASSETS',
  },

  playerSprite: {
    value: undefined as SpriteConfig | undefined,
    type: 'sprite',
    label: 'Player Sprite',
    group: 'Visuals',
  },
};

// Merge customized config values if present (injected by Playground)
const {playgroundConfig} = globalThis as {
  playgroundConfig?: Record<string, unknown>;
};
if (playgroundConfig) {
  for (const [key, value] of Object.entries(playgroundConfig)) {
    if (key in CONFIG) {
      Object.assign(CONFIG[key as keyof typeof CONFIG], {value});
    }
  }
}

export type ConfigKey = keyof typeof CONFIG;

export function getConfig<K extends ConfigKey>(
  key: K,
): (typeof CONFIG)[K]['value'] {
  return CONFIG[key].value;
}

export type DieFace = 'strike' | 'wing' | 'shield' | 'spell';

export const DIE_FACE_POOL: DieFace[] = [
  'strike',
  'strike',
  'wing',
  'wing',
  'shield',
  'spell',
];

export type CardCategory = 'Weapon' | 'Armor' | 'Mount' | 'Spell';

export interface ColiseumCard {
  id: string;
  name: string;
  category: CardCategory;
  req: DieFace[];
  effectDesc: string;
  bonusSummary: string;
  themeColor: string; 
  badgeBg: string;
  assetKey?: string;
  targetType:
    | 'none'
    | 'adjacent_enemy'
    | 'range_straight'
    | 'range_any'
    | 'global_enemy'
    | 'move_tile'
    | 'charge_target'
    | 'reroll';
}

/**
 * 48 Antiquity Themed Coliseum Cards (12 Red Weapon, 12 Blue Armor, 12 Green Mounts, 12 Orange Spells)
 */
export const CARD_DECK: ColiseumCard[] = [
  // ==================== 12 RED WEAPON CARDS ====================
  {
    id: 'gladius_thrust',
    name: 'Gladius Thrust',
    category: 'Weapon',
    req: ['strike'],
    effectDesc: 'Deal 1 DMG to adjacent foe, ignores 1 shield.',
    bonusSummary: '1 DMG (ignores 1 Shield)',
    themeColor: '#d32f2f',
    badgeBg: 'bg-red-900/80',
    targetType: 'adjacent_enemy',
  },
  {
    id: 'spartan_spear',
    name: 'Spartan Spear',
    category: 'Weapon',
    req: ['strike', 'wing'],
    effectDesc: 'Deal 1 DMG at range 2 in a straight line.',
    bonusSummary: '1 DMG at straight range 2',
    themeColor: '#d32f2f',
    badgeBg: 'bg-red-900/80',
    targetType: 'range_straight',
  },
  {
    id: 'trident_strike',
    name: 'Trident Strike',
    category: 'Weapon',
    req: ['strike', 'strike'],
    effectDesc: 'Deal 2 DMG to adjacent foe.',
    bonusSummary: '2 DMG adjacent',
    themeColor: '#d32f2f',
    badgeBg: 'bg-red-900/80',
    targetType: 'adjacent_enemy',
  },
  {
    id: 'labrys_cleave',
    name: 'Labrys Cleave',
    category: 'Weapon',
    req: ['strike', 'strike'],
    effectDesc: 'Deal 1 DMG to all adjacent enemies.',
    bonusSummary: '1 DMG to all adjacent foes',
    themeColor: '#d32f2f',
    badgeBg: 'bg-red-900/80',
    targetType: 'none',
  },
  {
    id: 'cretan_bow',
    name: 'Cretan Bow',
    category: 'Weapon',
    req: ['strike', 'spell'],
    effectDesc: 'Deal 1 DMG to any foe up to 4 tiles away.',
    bonusSummary: '1 DMG up to 4 range',
    themeColor: '#d32f2f',
    badgeBg: 'bg-red-900/80',
    targetType: 'range_any',
  },
  {
    id: 'sica_blade',
    name: 'Sica Blade',
    category: 'Weapon',
    req: ['strike'],
    effectDesc: 'Deal 1 DMG; if target has full HP, deal +1 bonus DMG.',
    bonusSummary: '1 DMG (+1 if full HP)',
    themeColor: '#d32f2f',
    badgeBg: 'bg-red-900/80',
    targetType: 'adjacent_enemy',
  },
  {
    id: 'net_retiarius',
    name: 'Net of Retiarius',
    category: 'Weapon',
    req: ['strike', 'shield'],
    effectDesc: 'Deal 1 DMG and immobilize target for 1 turn.',
    bonusSummary: '1 DMG + Immobilize 1 turn',
    themeColor: '#d32f2f',
    badgeBg: 'bg-red-900/80',
    targetType: 'adjacent_enemy',
  },
  {
    id: 'falx_execution',
    name: 'Falx Execution',
    category: 'Weapon',
    req: ['strike', 'strike'],
    effectDesc: 'Deal 2 DMG; if target HP <= 3, deal 3 DMG.',
    bonusSummary: '2 DMG (3 DMG if target HP ≤ 3)',
    themeColor: '#d32f2f',
    badgeBg: 'bg-red-900/80',
    targetType: 'adjacent_enemy',
  },
  {
    id: 'centurion_pilum',
    name: 'Centurion Pilum',
    category: 'Weapon',
    req: ['strike', 'wing'],
    effectDesc: 'Throw spear range 3 for 1 DMG and break target\'s shield.',
    bonusSummary: '1 DMG range 3 + Break Shield',
    themeColor: '#d32f2f',
    badgeBg: 'bg-red-900/80',
    targetType: 'range_any',
  },
  {
    id: 'flaming_arrow',
    name: 'Flaming Arrow',
    category: 'Weapon',
    req: ['strike', 'spell'],
    effectDesc: 'Deal 1 DMG range 3 and apply 1 burn next turn.',
    bonusSummary: '1 DMG range 3 + 1 Burn',
    themeColor: '#d32f2f',
    badgeBg: 'bg-red-900/80',
    targetType: 'range_any',
  },
  {
    id: 'colosseum_dagger',
    name: 'Colosseum Dagger',
    category: 'Weapon',
    req: ['strike'],
    effectDesc: 'Deal 1 DMG and refund 1 unspent wing die.',
    bonusSummary: '1 DMG + Refund 1 Wing Die',
    themeColor: '#d32f2f',
    badgeBg: 'bg-red-900/80',
    targetType: 'adjacent_enemy',
  },
  {
    id: 'titan_hammer',
    name: 'Titan Hammer',
    category: 'Weapon',
    req: ['strike', 'strike'],
    effectDesc: 'Deal 2 DMG and knock back target 2 tiles.',
    bonusSummary: '2 DMG + 2 Tile Knockback',
    themeColor: '#d32f2f',
    badgeBg: 'bg-red-900/80',
    targetType: 'adjacent_enemy',
  },

  // ==================== 12 BLUE ARMOR CARDS ====================
  {
    id: 'scutum_wall',
    name: 'Scutum Wall',
    category: 'Armor',
    req: ['shield'],
    effectDesc: 'Gain 2 Shield points.',
    bonusSummary: '+2 Shield',
    themeColor: '#1976d2',
    badgeBg: 'bg-blue-900/80',
    targetType: 'none',
  },
  {
    id: 'lorica_segmentata',
    name: 'Lorica Segmentata',
    category: 'Armor',
    req: ['shield', 'shield'],
    effectDesc: 'Gain 3 Shield points.',
    bonusSummary: '+3 Shield',
    themeColor: '#1976d2',
    badgeBg: 'bg-blue-900/80',
    targetType: 'none',
  },
  {
    id: 'corinthian_helm',
    name: 'Corinthian Helm',
    category: 'Armor',
    req: ['shield'],
    effectDesc: 'Gain 1 Shield and become immune to stun/immobilize.',
    bonusSummary: '+1 Shield + Stun Immunity',
    themeColor: '#1976d2',
    badgeBg: 'bg-blue-900/80',
    targetType: 'none',
  },
  {
    id: 'aegis_reflection',
    name: 'Aegis Reflection',
    category: 'Armor',
    req: ['shield', 'spell'],
    effectDesc: 'Gain 1 Shield; next time damaged this turn, deal 1 DMG back.',
    bonusSummary: '+1 Shield + Thorns Counter',
    themeColor: '#1976d2',
    badgeBg: 'bg-blue-900/80',
    targetType: 'none',
  },
  {
    id: 'hoplon_stance',
    name: 'Hoplon Stance',
    category: 'Armor',
    req: ['shield', 'strike'],
    effectDesc: 'Gain 2 Shield and deal 1 DMG to adjacent foe.',
    bonusSummary: '+2 Shield & 1 DMG adjacent',
    themeColor: '#1976d2',
    badgeBg: 'bg-blue-900/80',
    targetType: 'adjacent_enemy',
  },
  {
    id: 'bronze_greaves',
    name: 'Bronze Greaves',
    category: 'Armor',
    req: ['shield', 'wing'],
    effectDesc: 'Gain 1 Shield and ignore trap damage this turn.',
    bonusSummary: '+1 Shield + Trap Immunity',
    themeColor: '#1976d2',
    badgeBg: 'bg-blue-900/80',
    targetType: 'none',
  },
  {
    id: 'myrmidon_guard',
    name: 'Myrmidon Guard',
    category: 'Armor',
    req: ['shield'],
    effectDesc: 'Gain 1 Shield and gain +1 strike die next turn.',
    bonusSummary: '+1 Shield + 1 Strike next turn',
    themeColor: '#1976d2',
    badgeBg: 'bg-blue-900/80',
    targetType: 'none',
  },
  {
    id: 'phalanx_shield',
    name: 'Phalanx Shield',
    category: 'Armor',
    req: ['shield', 'shield'],
    effectDesc: 'Gain 2 Shield and heal 1 HP.',
    bonusSummary: '+2 Shield & Heal 1 HP',
    themeColor: '#1976d2',
    badgeBg: 'bg-blue-900/80',
    targetType: 'none',
  },
  {
    id: 'iron_bastion',
    name: 'Iron Bastion',
    category: 'Armor',
    req: ['shield'],
    effectDesc: 'Incoming damage capped to max 1 per hit this round.',
    bonusSummary: 'Damage cap 1 per hit',
    themeColor: '#1976d2',
    badgeBg: 'bg-blue-900/80',
    targetType: 'none',
  },
  {
    id: 'shield_bash',
    name: 'Shield Bash',
    category: 'Armor',
    req: ['shield', 'strike'],
    effectDesc: 'Stun adjacent foe and gain 1 Shield.',
    bonusSummary: 'Stun adjacent foe + 1 Shield',
    themeColor: '#1976d2',
    badgeBg: 'bg-blue-900/80',
    targetType: 'adjacent_enemy',
  },
  {
    id: 'gorgon_bulwark',
    name: 'Gorgon Bulwark',
    category: 'Armor',
    req: ['shield', 'spell'],
    effectDesc: 'Gain 2 Shield and petrify adjacent attacker for 1 turn.',
    bonusSummary: '+2 Shield + Petrify Attacker',
    themeColor: '#1976d2',
    badgeBg: 'bg-blue-900/80',
    targetType: 'none',
  },
  {
    id: 'testudo_formation',
    name: 'Testudo Formation',
    category: 'Armor',
    req: ['shield', 'shield'],
    effectDesc: 'Gain 4 Shield; movement speed reduced by 1.',
    bonusSummary: '+4 Shield (Speed -1)',
    themeColor: '#1976d2',
    badgeBg: 'bg-blue-900/80',
    targetType: 'none',
  },

  // ==================== 12 GREEN MOUNT & MOBILITY CARDS ====================
  {
    id: 'thessalian_steed',
    name: 'Thessalian Steed',
    category: 'Mount',
    req: ['wing', 'wing'],
    effectDesc: 'Move up to 3 tiles.',
    bonusSummary: 'Move up to 3 tiles',
    themeColor: '#388e3c',
    badgeBg: 'bg-emerald-900/80',
    targetType: 'move_tile',
  },
  {
    id: 'war_chariot',
    name: 'War Chariot',
    category: 'Mount',
    req: ['wing', 'wing'],
    effectDesc: 'Move 3 tiles in straight line, deal 1 DMG to foes in path.',
    bonusSummary: 'Charge 3 tiles + 1 DMG Trample',
    themeColor: '#388e3c',
    badgeBg: 'bg-emerald-900/80',
    targetType: 'move_tile',
  },
  {
    id: 'pegasus_leap',
    name: 'Pegasus Leap',
    category: 'Mount',
    req: ['wing', 'spell'],
    effectDesc: 'Jump over any obstacle/pillar/trap to a tile up to 3 away.',
    bonusSummary: 'Leap 3 tiles over obstacles',
    themeColor: '#388e3c',
    badgeBg: 'bg-emerald-900/80',
    targetType: 'move_tile',
  },
  {
    id: 'bucephalus_charge',
    name: 'Bucephalus Charge',
    category: 'Mount',
    req: ['wing', 'strike'],
    effectDesc: 'Move 2 tiles and push the target in destination 1 space for 1 DMG.',
    bonusSummary: 'Move 2 + Push & 1 DMG',
    themeColor: '#388e3c',
    badgeBg: 'bg-emerald-900/80',
    targetType: 'charge_target',
  },
  {
    id: 'roman_quadriga',
    name: 'Roman Quadriga',
    category: 'Mount',
    req: ['wing', 'wing'],
    effectDesc: 'Move up to 4 tiles.',
    bonusSummary: 'Move up to 4 tiles',
    themeColor: '#388e3c',
    badgeBg: 'bg-emerald-900/80',
    targetType: 'move_tile',
  },
  {
    id: 'winged_sandal',
    name: 'Winged Sandal',
    category: 'Mount',
    req: ['wing'],
    effectDesc: 'Move 2 tiles ignoring terrain and traps.',
    bonusSummary: 'Move 2 ignoring traps',
    themeColor: '#388e3c',
    badgeBg: 'bg-emerald-900/80',
    targetType: 'move_tile',
  },
  {
    id: 'gladiator_sprint',
    name: 'Gladiator Sprint',
    category: 'Mount',
    req: ['wing'],
    effectDesc: 'Move 2 tiles.',
    bonusSummary: 'Move 2 tiles',
    themeColor: '#388e3c',
    badgeBg: 'bg-emerald-900/80',
    targetType: 'move_tile',
  },
  {
    id: 'gryphon_swiftness',
    name: 'Gryphon Swiftness',
    category: 'Mount',
    req: ['wing', 'spell'],
    effectDesc: 'Teleport to any unoccupied tile within 2 tiles radius.',
    bonusSummary: 'Teleport 2 tiles',
    themeColor: '#388e3c',
    badgeBg: 'bg-emerald-900/80',
    targetType: 'move_tile',
  },
  {
    id: 'cerberus_pounce',
    name: 'Cerberus Pounce',
    category: 'Mount',
    req: ['wing', 'strike'],
    effectDesc: 'Leap 2 tiles to adjacent enemy and deal 1 DMG.',
    bonusSummary: 'Leap 2 tiles + 1 DMG',
    themeColor: '#388e3c',
    badgeBg: 'bg-emerald-900/80',
    targetType: 'charge_target',
  },
  {
    id: 'centaur_gallop',
    name: 'Centaur Gallop',
    category: 'Mount',
    req: ['wing', 'wing'],
    effectDesc: 'Move 2 tiles and gain 1 Shield.',
    bonusSummary: 'Move 2 tiles + 1 Shield',
    themeColor: '#388e3c',
    badgeBg: 'bg-emerald-900/80',
    targetType: 'move_tile',
  },
  {
    id: 'siege_ram_sprint',
    name: 'Siege Ram Sprint',
    category: 'Mount',
    req: ['wing', 'shield'],
    effectDesc: 'Move 2 tiles, smashing any trap in path without taking damage.',
    bonusSummary: 'Move 2 + Smash Traps',
    themeColor: '#388e3c',
    badgeBg: 'bg-emerald-900/80',
    targetType: 'move_tile',
  },
  {
    id: 'acrobatic_vault',
    name: 'Acrobatic Vault',
    category: 'Mount',
    req: ['wing'],
    effectDesc: 'Vault over an adjacent enemy or pillar to land on opposite side.',
    bonusSummary: 'Vault over obstacle/foe',
    themeColor: '#388e3c',
    badgeBg: 'bg-emerald-900/80',
    targetType: 'move_tile',
  },

  // ==================== 12 ORANGE SPELL CARDS ====================
  {
    id: 'zeus_lightning',
    name: 'Zeus Lightning',
    category: 'Spell',
    req: ['spell', 'spell'],
    effectDesc: 'Deal 2 DMG to any unit anywhere on the board.',
    bonusSummary: '2 DMG Global Target',
    themeColor: '#f57c00',
    badgeBg: 'bg-amber-900/80',
    targetType: 'global_enemy',
  },
  {
    id: 'apollos_blessing',
    name: 'Apollo\'s Blessing',
    category: 'Spell',
    req: ['spell'],
    effectDesc: 'Heal 2 HP to self.',
    bonusSummary: 'Heal 2 HP to self',
    themeColor: '#f57c00',
    badgeBg: 'bg-amber-900/80',
    targetType: 'none',
  },
  {
    id: 'ares_battlecry',
    name: 'Ares Battlecry',
    category: 'Spell',
    req: ['spell', 'strike'],
    effectDesc: 'All your attacks this turn deal +1 extra DMG.',
    bonusSummary: '+1 DMG on all attacks this turn',
    themeColor: '#f57c00',
    badgeBg: 'bg-amber-900/80',
    targetType: 'none',
  },
  {
    id: 'hermes_wind',
    name: 'Hermes Wind',
    category: 'Spell',
    req: ['spell', 'wing'],
    effectDesc: 'Gain 2 unspent wing dice this turn.',
    bonusSummary: '+2 Unspent Wing Dice',
    themeColor: '#f57c00',
    badgeBg: 'bg-amber-900/80',
    targetType: 'none',
  },
  {
    id: 'hades_siphon',
    name: 'Hades Siphon',
    category: 'Spell',
    req: ['spell', 'spell'],
    effectDesc: 'Deal 1 DMG to a foe and heal self for 1 HP.',
    bonusSummary: '1 DMG to foe + Drain 1 HP',
    themeColor: '#f57c00',
    badgeBg: 'bg-amber-900/80',
    targetType: 'global_enemy',
  },
  {
    id: 'poseidon_wave',
    name: 'Poseidon Wave',
    category: 'Spell',
    req: ['spell', 'wing'],
    effectDesc: 'Push all adjacent enemies 2 tiles away and deal 1 DMG.',
    bonusSummary: '1 DMG + Push adjacent foes 2 tiles',
    themeColor: '#f57c00',
    badgeBg: 'bg-amber-900/80',
    targetType: 'none',
  },
  {
    id: 'dionysus_confusion',
    name: 'Dionysus Confusion',
    category: 'Spell',
    req: ['spell'],
    effectDesc: 'Target enemy loses 2 random unspent dice this turn.',
    bonusSummary: 'Drain 2 Dice from target',
    themeColor: '#f57c00',
    badgeBg: 'bg-amber-900/80',
    targetType: 'global_enemy',
  },
  {
    id: 'athenas_wisdom',
    name: 'Athena\'s Wisdom',
    category: 'Spell',
    req: ['spell', 'shield'],
    effectDesc: 'Reroll any number of unspent dice.',
    bonusSummary: 'Free Reroll Unspent Dice',
    themeColor: '#f57c00',
    badgeBg: 'bg-amber-900/80',
    targetType: 'reroll',
  },
  {
    id: 'vulcans_trap',
    name: 'Vulcan\'s Trap',
    category: 'Spell',
    req: ['spell'],
    effectDesc: 'Place a fire trap on any visible tile within 3 range (deals 2 DMG).',
    bonusSummary: 'Place 2 DMG Trap (3 range)',
    themeColor: '#f57c00',
    badgeBg: 'bg-amber-900/80',
    targetType: 'range_any',
  },
  {
    id: 'oracle_clairvoyance',
    name: 'Oracle Clairvoyance',
    category: 'Spell',
    req: ['spell'],
    effectDesc: 'Gain 1 Shield and 1 HP.',
    bonusSummary: '+1 Shield & +1 HP',
    themeColor: '#f57c00',
    badgeBg: 'bg-amber-900/80',
    targetType: 'none',
  },
  {
    id: 'chronos_shift',
    name: 'Chronos Shift',
    category: 'Spell',
    req: ['spell', 'spell'],
    effectDesc: 'Take an immediate extra roll of 3 dice this turn.',
    bonusSummary: 'Roll +3 Extra Dice this turn',
    themeColor: '#f57c00',
    badgeBg: 'bg-amber-900/80',
    targetType: 'none',
  },
  {
    id: 'medusa_gaze',
    name: 'Medusa Gaze',
    category: 'Spell',
    req: ['spell', 'spell'],
    effectDesc: 'Choose an enemy anywhere on the board; they cannot move next turn.',
    bonusSummary: 'Petrify target (Immobilize 1 turn)',
    themeColor: '#f57c00',
    badgeBg: 'bg-amber-900/80',
    targetType: 'global_enemy',
  },
];

/**
 * Champion Profiles
 */
export interface ChampionProfile {
  id: string;
  name: string;
  title: string;
  assetKey: string;
  color: string;
  accentColor: string;
  bgGradient: string;
  lore: string;
  innateTrait: string;
  specialSkillName: string;
  specialSkillDesc: string;
  aiStyle: 'balanced' | 'aggressive' | 'elusive' | 'tactical';
}

export const CHAMPION_PROFILES: ChampionProfile[] = [
  {
    id: 'solar_paladin',
    name: 'Spartan Hoplite',
    title: 'Radiant Spear of Ares',
    assetKey: 'champion_solar_paladin',
    color: '#fbbf24',
    accentColor: '#d97706',
    bgGradient: 'from-amber-600/30 to-yellow-900/40',
    lore: 'An unbreakable Spartan warrior shielded by solar discipline and bronze valor.',
    innateTrait: 'Shield Mastery: +1 extra shield per Shield die',
    specialSkillName: 'Phalanx Smite',
    specialSkillDesc: 'Deals 3 unblockable radiant damage and gains 1 shield.',
    aiStyle: 'balanced',
  },
  {
    id: 'storm_berserker',
    name: 'Barbarian Berserker',
    title: 'Tempest Warlord',
    assetKey: 'champion_storm_berserker',
    color: '#38bdf8',
    accentColor: '#0284c7',
    bgGradient: 'from-cyan-600/30 to-blue-900/40',
    lore: 'Channels thunderstorm fury with crushing twin battle hammers.',
    innateTrait: 'Tempest Rage: +1 damage when target hits obstacle',
    specialSkillName: 'Thunder Slam',
    specialSkillDesc: 'Hits all adjacent foes for 2 damage and knocks them back 2 tiles.',
    aiStyle: 'aggressive',
  },
  {
    id: 'shadow_weaver',
    name: 'Mythic Sorceress',
    title: 'Shadow Weaver & Priestess',
    assetKey: 'champion_shadow_weaver',
    color: '#c084fc',
    accentColor: '#9333ea',
    bgGradient: 'from-purple-600/30 to-slate-900/40',
    lore: 'Dances across ethereal shadows wielding crystalline daggers and void magic.',
    innateTrait: 'Shadow Step: Can pass through obstacles and enemies while moving',
    specialSkillName: 'Blink Strike',
    specialSkillDesc: 'Teleports behind any target within 3 tiles and strikes for 3 damage.',
    aiStyle: 'elusive',
  },
  {
    id: 'gaia_warden',
    name: 'Roman Centurion',
    title: 'Legion Commander',
    assetKey: 'champion_gaia_warden',
    color: '#4ade80',
    accentColor: '#16a34a',
    bgGradient: 'from-emerald-600/30 to-teal-900/40',
    lore: 'Veteran commander of the Imperial legions with tactical mastery and iron discipline.',
    innateTrait: 'Verdant Bond: Restores +1 additional Vitality on the Fountain',
    specialSkillName: 'Legion Rally',
    specialSkillDesc: 'Heals self for 2 Vitality and immobilizes nearest enemy for 1 turn.',
    aiStyle: 'tactical',
  },
  {
    id: 'gladiator_champion',
    name: 'Gladiator Champion',
    title: 'Coliseum Victor',
    assetKey: 'champion_solar_paladin',
    color: '#f87171',
    accentColor: '#dc2626',
    bgGradient: 'from-rose-600/30 to-red-900/40',
    lore: 'Undefeated veteran of the blood sands, master of dual gladius strikes.',
    innateTrait: 'Bloodthirst: Slaying an enemy refunds 2 unspent Strike dice',
    specialSkillName: 'Glory Strike',
    specialSkillDesc: 'Executes high damage to low health opponents.',
    aiStyle: 'aggressive',
  },
  {
    id: 'amazon_warrior',
    name: 'Amazon Huntress',
    title: 'Daughter of Artemis',
    assetKey: 'champion_shadow_weaver',
    color: '#fb923c',
    accentColor: '#ea580c',
    bgGradient: 'from-orange-600/30 to-amber-900/40',
    lore: 'Swift archer and huntress endowed with eagle vision and swift reflexes.',
    innateTrait: 'Windstride: Mount movements cost 1 less Wing die',
    specialSkillName: 'Artemis Volley',
    specialSkillDesc: 'Fires piercing arrows at up to 4 range dealing 2 damage.',
    aiStyle: 'elusive',
  },
];
