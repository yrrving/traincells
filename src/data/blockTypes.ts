import type { BlockType } from '../models/types';

// The 8 Bloxels-style block types — colors match the Bloxels color coding
export const BLOCK_TYPES: BlockType[] = [
  {
    id: 'terrain',
    name: 'Terrain',
    color: '#22c55e',
    lightColor: '#86efac',
    description: 'Solid ground, walls and platforms',
    icon: '🟩',
  },
  {
    id: 'hazard',
    name: 'Hazard',
    color: '#ef4444',
    lightColor: '#fca5a5',
    description: 'Spikes, lava — damages the player',
    icon: '🟥',
  },
  {
    id: 'collectible',
    name: 'Collectible',
    color: '#eab308',
    lightColor: '#fde047',
    description: 'Coins and treasures to collect',
    icon: '🟨',
  },
  {
    id: 'liquid',
    name: 'Liquid',
    color: '#3b82f6',
    lightColor: '#93c5fd',
    description: 'Water — slows movement, allows floating',
    icon: '🟦',
  },
  {
    id: 'enemy',
    name: 'Enemy',
    color: '#a855f7',
    lightColor: '#d8b4fe',
    description: 'Enemies that patrol and damage player',
    icon: '🟪',
  },
  {
    id: 'action',
    name: 'Action',
    color: '#f97316',
    lightColor: '#fdba74',
    description: 'Bounce pads and movable blocks',
    icon: '🟧',
  },
  {
    id: 'powerup',
    name: 'Power-Up',
    color: '#ec4899',
    lightColor: '#f9a8d4',
    description: 'Restores health and grants abilities',
    icon: '🩷',
  },
  {
    id: 'story',
    name: 'Story',
    color: '#f1f5f9',
    lightColor: '#ffffff',
    description: 'Checkpoints, spawn points, exits',
    icon: '⬜',
  },
];

export const BLOCK_TYPE_MAP = Object.fromEntries(
  BLOCK_TYPES.map((bt) => [bt.id, bt])
) as Record<string, BlockType>;

// Extra art colors beyond the 8 block types
export const ART_EXTRA_COLORS = [
  '#000000', // Black
  '#1e1e1e', // Very dark gray
  '#6b7280', // Gray
  '#9ca3af', // Light gray
  '#d1d5db', // Very light gray
  '#ffffff', // White
  '#78350f', // Dark brown
  '#92400e', // Brown
  '#b45309', // Medium brown
  '#d97706', // Amber
  '#fbbf24', // Gold
  '#84cc16', // Lime green
  '#14b8a6', // Teal
  '#0ea5e9', // Sky blue
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#d946ef', // Fuchsia
  '#fb7185', // Rose
];

// Build the default art palette: one color per block type + some extra
export function getDefaultArtPalette(): string[] {
  return [
    BLOCK_TYPES[0].color, // terrain green
    BLOCK_TYPES[1].color, // hazard red
    BLOCK_TYPES[2].color, // collectible yellow
    BLOCK_TYPES[3].color, // liquid blue
    BLOCK_TYPES[4].color, // enemy purple
    BLOCK_TYPES[5].color, // action orange
    BLOCK_TYPES[6].color, // powerup pink
    BLOCK_TYPES[7].color, // story white
    '#000000',             // black
    '#78350f',             // brown
    '#9ca3af',             // gray
    '#ffffff',             // white
  ];
}
