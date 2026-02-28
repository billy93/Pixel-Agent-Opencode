/**
 * Modern RPG-style animated sprite system
 * Features:
 * - 48x48 character sprites (larger for better visibility)
 * - Walk cycle animations (4 frames per direction)
 * - Robot work animations
 * - Modern office tileset
 */

// Sprite dimensions
export const CHAR_SIZE = 48; // Character sprite size
export const TILE_SIZE = 32; // Tile size for map

// Animation frame timing
export const WALK_FRAME_DURATION = 120; // ms per frame
export const WORK_FRAME_DURATION = 200; // ms per frame

// Direction indices for sprite sheets
export type Direction = 'down' | 'left' | 'right' | 'up';
export const DIRECTION_ROW: Record<Direction, number> = {
  down: 0,
  left: 1,
  right: 2,
  up: 3,
};

export interface AnimatedSprite {
  frames: HTMLCanvasElement[];
  frameCount: number;
  frameDuration: number;
}

export interface CharacterSpriteSheet {
  idle: Record<Direction, HTMLCanvasElement>;
  walk: Record<Direction, AnimatedSprite>;
}

export interface RobotSpriteSheet {
  idle: HTMLCanvasElement;
  working: AnimatedSprite;
}

// Color palette for modern pixel art
const PALETTE = {
  // Skin tones
  skin: '#ffecd2',
  skinShadow: '#dbb896',
  skinHighlight: '#fff5e6',
  
  // Hair colors
  hairBrown: '#5c4033',
  hairBlack: '#2c2c2c',
  hairBlonde: '#d4a853',
  
  // Outline
  outline: '#1a1a2e',
  outlineSoft: '#2d3436',
  
  // Robot colors
  robotBody: '#e8e8e8',
  robotBodyShadow: '#b0b0b0',
  robotAccent: '#4a9eff',
  robotAccentGlow: '#7bb8ff',
  robotScreen: '#0f1923',
  robotEye: '#00ff88',
  robotEyeAlt: '#ff6b6b',
  
  // Office colors
  floorWood: '#c4a77d',
  floorWoodLight: '#d4bc9a',
  floorWoodDark: '#a38b65',
  wallBase: '#e8e8e8',
  wallAccent: '#d0d0d0',
  carpet: '#4a5568',
  carpetPattern: '#3d4652',
};

/**
 * Create a single frame of the player character
 */
function createPlayerFrame(
  direction: Direction,
  frame: number,
  shirtColor: string = '#4a9eff'
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CHAR_SIZE;
  canvas.height = CHAR_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  const px = (x: number, y: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  };

  // Animation offsets based on frame
  const walkOffset = frame % 2 === 1 ? 1 : 0;
  const armSwing = frame % 4;
  const isMoving = frame > 0;

  // Colors
  const outline = PALETTE.outline;
  const skin = PALETTE.skin;
  const skinShadow = PALETTE.skinShadow;
  const hair = PALETTE.hairBrown;
  const shirt = shirtColor;
  const shirtShadow = adjustColor(shirtColor, -30);
  const pants = '#4a5568';
  const pantsShadow = '#2d3748';
  const shoes = '#1a1a2e';

  // Drop shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(24, 44 - walkOffset, 10, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  if (direction === 'down') {
    // === FACING DOWN (toward camera) ===
    
    // Body/Torso
    px(16, 24, 16, 12, outline);
    px(17, 25, 14, 10, shirt);
    px(17, 32, 14, 3, shirtShadow);

    // Arms
    const leftArmOffset = isMoving ? (armSwing < 2 ? 1 : -1) : 0;
    const rightArmOffset = isMoving ? (armSwing < 2 ? -1 : 1) : 0;
    
    px(12, 25 + leftArmOffset, 5, 10, outline);
    px(13, 26 + leftArmOffset, 3, 8, shirt);
    px(13, 32 + leftArmOffset, 3, 2, skin);
    
    px(31, 25 + rightArmOffset, 5, 10, outline);
    px(32, 26 + rightArmOffset, 3, 8, shirt);
    px(32, 32 + rightArmOffset, 3, 2, skin);

    // Legs
    const legOffset1 = isMoving && frame % 4 < 2 ? 1 : 0;
    const legOffset2 = isMoving && frame % 4 >= 2 ? 1 : 0;
    
    px(17, 35, 6, 8 + legOffset1, outline);
    px(18, 35, 4, 7 + legOffset1, pants);
    px(18, 35, 4, 2, pantsShadow);
    
    px(25, 35, 6, 8 + legOffset2, outline);
    px(26, 35, 4, 7 + legOffset2, pants);
    px(26, 35, 4, 2, pantsShadow);

    // Shoes
    px(16, 42 + legOffset1, 8, 4, outline);
    px(17, 43 + legOffset1, 6, 2, shoes);
    
    px(24, 42 + legOffset2, 8, 4, outline);
    px(25, 43 + legOffset2, 6, 2, shoes);

    // Head
    px(14, 6, 20, 18, outline);
    px(15, 7, 18, 16, skin);
    px(15, 20, 18, 3, skinShadow);

    // Hair
    px(13, 3, 22, 8, outline);
    px(14, 4, 20, 6, hair);
    px(14, 7, 3, 4, hair);
    px(31, 7, 3, 4, hair);
    px(16, 8, 5, 2, hair); // bangs
    px(27, 8, 4, 2, hair); // bangs

    // Eyes
    px(18, 13, 4, 4, '#fff');
    px(19, 14, 2, 3, '#2d3436');
    px(26, 13, 4, 4, '#fff');
    px(27, 14, 2, 3, '#2d3436');

    // Mouth
    px(22, 18, 4, 1, skinShadow);

    // Blush
    px(16, 16, 2, 1, 'rgba(255, 150, 150, 0.5)');
    px(30, 16, 2, 1, 'rgba(255, 150, 150, 0.5)');

  } else if (direction === 'up') {
    // === FACING UP (away from camera) ===
    
    // Body/Torso
    px(16, 24, 16, 12, outline);
    px(17, 25, 14, 10, shirt);
    px(17, 25, 14, 3, shirtShadow);

    // Arms
    const leftArmOffset = isMoving ? (armSwing < 2 ? -1 : 1) : 0;
    const rightArmOffset = isMoving ? (armSwing < 2 ? 1 : -1) : 0;
    
    px(12, 25 + leftArmOffset, 5, 10, outline);
    px(13, 26 + leftArmOffset, 3, 8, shirt);
    
    px(31, 25 + rightArmOffset, 5, 10, outline);
    px(32, 26 + rightArmOffset, 3, 8, shirt);

    // Legs
    const legOffset1 = isMoving && frame % 4 < 2 ? 1 : 0;
    const legOffset2 = isMoving && frame % 4 >= 2 ? 1 : 0;
    
    px(17, 35, 6, 8 + legOffset1, outline);
    px(18, 35, 4, 7 + legOffset1, pants);
    
    px(25, 35, 6, 8 + legOffset2, outline);
    px(26, 35, 4, 7 + legOffset2, pants);

    // Shoes
    px(16, 42 + legOffset1, 8, 4, outline);
    px(17, 43 + legOffset1, 6, 2, shoes);
    
    px(24, 42 + legOffset2, 8, 4, outline);
    px(25, 43 + legOffset2, 6, 2, shoes);

    // Head (back of head)
    px(14, 6, 20, 18, outline);
    px(15, 7, 18, 16, skin);

    // Hair (full coverage from back)
    px(13, 3, 22, 16, outline);
    px(14, 4, 20, 14, hair);
    px(14, 16, 20, 3, adjustColor(hair, -15));

  } else if (direction === 'left') {
    // === FACING LEFT ===
    
    // Body
    px(18, 24, 14, 12, outline);
    px(19, 25, 12, 10, shirt);
    px(19, 32, 12, 3, shirtShadow);

    // Back arm
    const backArmOffset = isMoving ? (armSwing < 2 ? 2 : -1) : 0;
    px(28, 25 + backArmOffset, 5, 10, outline);
    px(29, 26 + backArmOffset, 3, 8, shirtShadow);

    // Legs
    const legOffset1 = isMoving && frame % 4 < 2 ? 2 : 0;
    const legOffset2 = isMoving && frame % 4 >= 2 ? 2 : 0;
    
    px(19, 35 - legOffset1 / 2, 6, 8 + legOffset1, outline);
    px(20, 35, 4, 7 + legOffset1, pants);
    
    px(25, 35 - legOffset2 / 2, 6, 8 + legOffset2, outline);
    px(26, 35, 4, 7 + legOffset2, pantsShadow);

    // Shoes
    px(17, 42 + legOffset1, 8, 4, outline);
    px(18, 43 + legOffset1, 6, 2, shoes);
    
    px(24, 42 + legOffset2, 8, 4, outline);
    px(25, 43 + legOffset2, 6, 2, shoes);

    // Front arm
    const frontArmOffset = isMoving ? (armSwing < 2 ? -1 : 2) : 0;
    px(14, 25 + frontArmOffset, 5, 10, outline);
    px(15, 26 + frontArmOffset, 3, 8, shirt);
    px(15, 32 + frontArmOffset, 3, 2, skin);

    // Head
    px(14, 6, 18, 18, outline);
    px(15, 7, 16, 16, skin);
    px(15, 20, 16, 3, skinShadow);

    // Hair
    px(16, 3, 18, 8, outline);
    px(17, 4, 16, 6, hair);
    px(29, 7, 3, 6, hair);
    px(17, 8, 4, 3, hair);

    // Eye (side view)
    px(17, 13, 3, 4, '#fff');
    px(17, 14, 2, 3, '#2d3436');

    // Nose hint
    px(14, 14, 2, 2, skinShadow);

    // Mouth
    px(16, 18, 3, 1, skinShadow);

    // Blush
    px(19, 16, 2, 1, 'rgba(255, 150, 150, 0.5)');

  } else if (direction === 'right') {
    // === FACING RIGHT ===
    
    // Body
    px(16, 24, 14, 12, outline);
    px(17, 25, 12, 10, shirt);
    px(17, 32, 12, 3, shirtShadow);

    // Back arm
    const backArmOffset = isMoving ? (armSwing < 2 ? 2 : -1) : 0;
    px(15, 25 + backArmOffset, 5, 10, outline);
    px(16, 26 + backArmOffset, 3, 8, shirtShadow);

    // Legs
    const legOffset1 = isMoving && frame % 4 < 2 ? 2 : 0;
    const legOffset2 = isMoving && frame % 4 >= 2 ? 2 : 0;
    
    px(17, 35 - legOffset1 / 2, 6, 8 + legOffset1, outline);
    px(18, 35, 4, 7 + legOffset1, pantsShadow);
    
    px(23, 35 - legOffset2 / 2, 6, 8 + legOffset2, outline);
    px(24, 35, 4, 7 + legOffset2, pants);

    // Shoes
    px(16, 42 + legOffset1, 8, 4, outline);
    px(17, 43 + legOffset1, 6, 2, shoes);
    
    px(22, 42 + legOffset2, 8, 4, outline);
    px(23, 43 + legOffset2, 6, 2, shoes);

    // Front arm
    const frontArmOffset = isMoving ? (armSwing < 2 ? -1 : 2) : 0;
    px(29, 25 + frontArmOffset, 5, 10, outline);
    px(30, 26 + frontArmOffset, 3, 8, shirt);
    px(30, 32 + frontArmOffset, 3, 2, skin);

    // Head
    px(16, 6, 18, 18, outline);
    px(17, 7, 16, 16, skin);
    px(17, 20, 16, 3, skinShadow);

    // Hair
    px(14, 3, 18, 8, outline);
    px(15, 4, 16, 6, hair);
    px(16, 7, 3, 6, hair);
    px(27, 8, 4, 3, hair);

    // Eye (side view)
    px(28, 13, 3, 4, '#fff');
    px(29, 14, 2, 3, '#2d3436');

    // Nose hint
    px(32, 14, 2, 2, skinShadow);

    // Mouth
    px(29, 18, 3, 1, skinShadow);

    // Blush
    px(27, 16, 2, 1, 'rgba(255, 150, 150, 0.5)');
  }

  return canvas;
}

/**
 * Create robot agent sprite frame
 */
function createRobotFrame(
  frame: number,
  isWorking: boolean = false,
  accentColor: string = PALETTE.robotAccent
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CHAR_SIZE;
  canvas.height = CHAR_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  const px = (x: number, y: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  };

  const outline = PALETTE.outline;
  const body = PALETTE.robotBody;
  const bodyShadow = PALETTE.robotBodyShadow;
  const accent = accentColor;
  const accentGlow = adjustColor(accentColor, 40);
  const screen = PALETTE.robotScreen;
  const eyeColor = isWorking ? PALETTE.robotEye : accentGlow;

  // Working animation - bobbing
  const workBob = isWorking ? Math.sin(frame * 0.5) * 2 : 0;
  const yOffset = Math.floor(workBob);

  // Drop shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(24, 45, 12, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Tracks/wheels
  px(10, 40, 8, 6, outline);
  px(11, 41, 6, 4, '#3d3d3d');
  px(11, 42, 2, 2, '#555');
  px(15, 42, 2, 2, '#555');

  px(30, 40, 8, 6, outline);
  px(31, 41, 6, 4, '#3d3d3d');
  px(31, 42, 2, 2, '#555');
  px(35, 42, 2, 2, '#555');

  // Body (main chassis)
  px(12, 26 + yOffset, 24, 16, outline);
  px(13, 27 + yOffset, 22, 14, body);
  px(13, 38 + yOffset, 22, 3, bodyShadow);

  // Body accent stripe
  px(13, 32 + yOffset, 22, 3, accent);
  px(13, 33 + yOffset, 22, 1, accentGlow);

  // Chest panel
  px(18, 29 + yOffset, 12, 6, screen);
  
  // Chest lights (blink when working)
  if (isWorking) {
    const lightFrame = frame % 4;
    px(20, 31 + yOffset, 2, 2, lightFrame < 2 ? '#00ff88' : '#004422');
    px(24, 31 + yOffset, 2, 2, lightFrame >= 2 ? '#00ff88' : '#004422');
    px(22, 30 + yOffset, 2, 1, '#ffaa00');
  } else {
    px(20, 31 + yOffset, 2, 2, '#00ff88');
    px(24, 31 + yOffset, 2, 2, '#00ff88');
  }

  // Arms
  const armWave = isWorking ? Math.sin(frame * 0.3) * 3 : 0;
  const leftArmY = Math.floor(armWave);
  const rightArmY = Math.floor(-armWave);

  px(6, 28 + yOffset + leftArmY, 7, 12, outline);
  px(7, 29 + yOffset + leftArmY, 5, 10, bodyShadow);
  px(7, 29 + yOffset + leftArmY, 5, 2, body);
  px(6, 38 + yOffset + leftArmY, 7, 4, outline);
  px(7, 39 + yOffset + leftArmY, 5, 2, accent); // hand

  px(35, 28 + yOffset + rightArmY, 7, 12, outline);
  px(36, 29 + yOffset + rightArmY, 5, 10, bodyShadow);
  px(36, 29 + yOffset + rightArmY, 5, 2, body);
  px(35, 38 + yOffset + rightArmY, 7, 4, outline);
  px(36, 39 + yOffset + rightArmY, 5, 2, accent); // hand

  // Head
  px(10, 8 + yOffset, 28, 20, outline);
  px(11, 9 + yOffset, 26, 18, body);
  px(11, 24 + yOffset, 26, 3, bodyShadow);

  // Screen face
  px(14, 12 + yOffset, 20, 12, screen);

  // Eyes
  const eyeBlink = isWorking && frame % 8 === 0;
  if (!eyeBlink) {
    // Left eye
    px(17, 15 + yOffset, 5, 5, eyeColor);
    px(18, 16 + yOffset, 2, 2, '#fff'); // highlight
    
    // Right eye
    px(26, 15 + yOffset, 5, 5, eyeColor);
    px(27, 16 + yOffset, 2, 2, '#fff'); // highlight
  } else {
    // Closed eyes
    px(17, 17 + yOffset, 5, 2, eyeColor);
    px(26, 17 + yOffset, 5, 2, eyeColor);
  }

  // Mouth/speaker
  if (isWorking) {
    // Animated mouth when working
    const mouthHeight = (frame % 3) + 1;
    px(20, 21 + yOffset, 8, mouthHeight, eyeColor);
  } else {
    px(20, 21 + yOffset, 8, 2, accent);
  }

  // Antenna
  px(23, 2 + yOffset, 2, 7, outline);
  px(23, 3 + yOffset, 2, 5, bodyShadow);
  
  // Antenna light
  const antennaColor = isWorking && frame % 2 === 0 ? '#ff4444' : '#ff0000';
  px(21, 1 + yOffset, 6, 3, outline);
  px(22, 2 + yOffset, 4, 1, antennaColor);

  // Ear panels
  px(8, 14 + yOffset, 4, 6, outline);
  px(9, 15 + yOffset, 2, 4, accent);
  
  px(36, 14 + yOffset, 4, 6, outline);
  px(37, 15 + yOffset, 2, 4, accent);

  return canvas;
}

/**
 * Create player sprite sheet with all animations
 */
export function createPlayerSpriteSheet(shirtColor: string = '#4a9eff'): CharacterSpriteSheet {
  const directions: Direction[] = ['down', 'left', 'right', 'up'];
  
  const idle: Record<Direction, HTMLCanvasElement> = {} as Record<Direction, HTMLCanvasElement>;
  const walk: Record<Direction, AnimatedSprite> = {} as Record<Direction, AnimatedSprite>;

  for (const dir of directions) {
    // Idle frame (frame 0)
    idle[dir] = createPlayerFrame(dir, 0, shirtColor);

    // Walk animation (4 frames)
    const walkFrames: HTMLCanvasElement[] = [];
    for (let i = 0; i < 4; i++) {
      walkFrames.push(createPlayerFrame(dir, i + 1, shirtColor));
    }
    walk[dir] = {
      frames: walkFrames,
      frameCount: 4,
      frameDuration: WALK_FRAME_DURATION,
    };
  }

  return { idle, walk };
}

/**
 * Create robot sprite sheet with work animation
 */
export function createRobotSpriteSheet(accentColor: string = PALETTE.robotAccent): RobotSpriteSheet {
  const idle = createRobotFrame(0, false, accentColor);
  
  const workFrames: HTMLCanvasElement[] = [];
  for (let i = 0; i < 8; i++) {
    workFrames.push(createRobotFrame(i, true, accentColor));
  }

  return {
    idle,
    working: {
      frames: workFrames,
      frameCount: 8,
      frameDuration: WORK_FRAME_DURATION,
    },
  };
}

/**
 * Create modern office floor tile
 */
export function createModernFloorTile(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = TILE_SIZE;
  canvas.height = TILE_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  const px = (x: number, y: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  };

  // Modern wood floor with warm tones
  const base = '#c9a66b';
  const light = '#d4b57a';
  const dark = '#a88b56';
  const grain = 'rgba(139, 109, 62, 0.3)';

  // Base color
  px(0, 0, 32, 32, base);

  // Plank divisions
  for (let y = 0; y < 32; y += 8) {
    px(0, y, 32, 1, dark);
    px(0, y + 1, 32, 1, light);
  }

  // Vertical joints (staggered)
  px(16, 0, 1, 8, dark);
  px(8, 8, 1, 8, dark);
  px(24, 8, 1, 8, dark);
  px(16, 16, 1, 8, dark);
  px(8, 24, 1, 8, dark);
  px(24, 24, 1, 8, dark);

  // Wood grain details
  px(3, 3, 8, 1, grain);
  px(20, 5, 6, 1, grain);
  px(5, 11, 10, 1, grain);
  px(18, 13, 8, 1, grain);
  px(2, 19, 9, 1, grain);
  px(22, 21, 5, 1, grain);
  px(8, 27, 12, 1, grain);

  return canvas;
}

/**
 * Create carpet tile for meeting areas
 */
export function createCarpetTile(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = TILE_SIZE;
  canvas.height = TILE_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  const px = (x: number, y: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  };

  // Modern dark carpet
  const base = '#3d4652';
  const pattern1 = '#454f5d';
  const pattern2 = '#353d47';

  px(0, 0, 32, 32, base);

  // Subtle pattern
  for (let y = 0; y < 32; y += 4) {
    for (let x = 0; x < 32; x += 4) {
      if ((x + y) % 8 === 0) {
        px(x, y, 2, 2, pattern1);
      } else if ((x + y) % 8 === 4) {
        px(x + 1, y + 1, 2, 2, pattern2);
      }
    }
  }

  return canvas;
}

/**
 * Create modern wall tile
 */
export function createModernWallTile(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = TILE_SIZE;
  canvas.height = TILE_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  const px = (x: number, y: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  };

  // Clean modern wall
  const wallBase = '#f0f0f0';
  const wallShadow = '#d8d8d8';
  const baseboard = '#2d3436';
  const baseboardTop = '#636e72';

  // Main wall
  px(0, 0, 32, 26, wallBase);
  
  // Subtle vertical panels
  px(0, 0, 1, 26, wallShadow);
  px(15, 0, 1, 26, wallShadow);
  px(31, 0, 1, 26, wallShadow);

  // Top molding
  px(0, 0, 32, 3, wallShadow);
  px(0, 2, 32, 1, '#e8e8e8');

  // Baseboard
  px(0, 26, 32, 6, baseboard);
  px(0, 26, 32, 1, baseboardTop);
  px(0, 31, 32, 1, '#1a1a2e');

  return canvas;
}

/**
 * Create glass wall/window tile
 */
export function createGlassWallTile(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = TILE_SIZE;
  canvas.height = TILE_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  const px = (x: number, y: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  };

  // Glass panel
  const frame = '#636e72';
  const glass = 'rgba(200, 220, 255, 0.4)';
  const glassHighlight = 'rgba(255, 255, 255, 0.3)';

  // Frame
  px(0, 0, 32, 32, frame);
  
  // Glass
  px(2, 2, 28, 28, glass);
  
  // Reflection
  px(4, 4, 2, 20, glassHighlight);
  px(6, 4, 1, 16, 'rgba(255, 255, 255, 0.15)');

  // Frame details
  px(0, 15, 32, 2, frame);

  return canvas;
}

/**
 * Create modern desk tile (larger, L-shaped workstation feel)
 */
export function createModernDeskTile(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = TILE_SIZE * 2;
  canvas.height = TILE_SIZE * 2;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  const px = (x: number, y: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  };

  // Desk colors
  const deskTop = '#f5f5f5';
  const deskEdge = '#e0e0e0';
  const deskShadow = '#bdbdbd';
  const leg = '#424242';

  // Shadow
  px(4, 52, 56, 8, 'rgba(0,0,0,0.2)');

  // Desk legs
  px(6, 32, 4, 24, leg);
  px(54, 32, 4, 24, leg);

  // Desk surface
  px(2, 28, 60, 8, deskEdge);
  px(2, 28, 60, 4, deskTop);
  px(2, 34, 60, 2, deskShadow);

  // Monitor
  px(24, 10, 16, 2, '#1a1a2e'); // stand base
  px(30, 4, 4, 8, '#1a1a2e'); // stand neck
  px(16, 2, 32, 10, '#2d3436'); // monitor frame
  px(18, 3, 28, 7, '#0d1117'); // screen
  px(20, 4, 4, 2, '#4a9eff'); // screen content
  px(26, 4, 14, 1, '#666');
  px(26, 6, 10, 1, '#555');

  // Keyboard
  px(22, 18, 20, 6, '#333');
  px(23, 19, 18, 4, '#444');

  // Mouse
  px(46, 20, 6, 4, '#333');
  px(47, 21, 4, 2, '#555');

  // Coffee mug
  px(8, 16, 6, 8, '#ff6b6b');
  px(13, 18, 2, 4, '#ff6b6b');
  px(9, 17, 4, 1, '#4a3728');

  // Small plant
  px(50, 14, 8, 10, '#2d3436'); // pot
  px(51, 16, 6, 6, '#c0392b');
  px(51, 15, 6, 2, '#e74c3c');
  px(52, 10, 2, 6, '#27ae60');
  px(54, 8, 3, 8, '#2ecc71');
  px(50, 11, 2, 4, '#27ae60');

  return canvas;
}

/**
 * Create attention indicator with glow effect
 */
export function createAttentionIndicator(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const size = 24;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  
  ctx.imageSmoothingEnabled = true;

  // Glow effect
  const gradient = ctx.createRadialGradient(
    size / 2, size / 2, 0,
    size / 2, size / 2, size / 2
  );
  gradient.addColorStop(0, 'rgba(255, 71, 87, 0.8)');
  gradient.addColorStop(0.5, 'rgba(255, 71, 87, 0.4)');
  gradient.addColorStop(1, 'rgba(255, 71, 87, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  // Main circle
  ctx.fillStyle = '#ff4757';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, 8, 0, Math.PI * 2);
  ctx.fill();

  // Inner highlight
  ctx.fillStyle = '#ff6b81';
  ctx.beginPath();
  ctx.arc(size / 2 - 1, size / 2 - 1, 5, 0, Math.PI * 2);
  ctx.fill();

  // Exclamation mark
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('!', size / 2, size / 2);

  return canvas;
}

/**
 * Create action bubble
 */
export function createActionBubble(text: string, width: number = 120): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const height = 28;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;

  // Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
  ctx.beginPath();
  ctx.roundRect(2, 2, width - 4, height - 6, 10);
  ctx.fill();

  // Bubble background
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(0, 0, width - 4, height - 6, 10);
  ctx.fill();

  // Border
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Pointer
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(width / 2 - 6, height - 6);
  ctx.lineTo(width / 2, height - 1);
  ctx.lineTo(width / 2 + 6, height - 6);
  ctx.closePath();
  ctx.fill();

  // Text
  ctx.fillStyle = '#2d3436';
  ctx.font = 'bold 11px "Inter", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, (width - 4) / 2, (height - 6) / 2);

  return canvas;
}

/**
 * Helper function to adjust color brightness
 */
function adjustColor(color: string, amount: number): string {
  const hex = color.replace('#', '');
  const r = Math.max(0, Math.min(255, parseInt(hex.substr(0, 2), 16) + amount));
  const g = Math.max(0, Math.min(255, parseInt(hex.substr(2, 2), 16) + amount));
  const b = Math.max(0, Math.min(255, parseInt(hex.substr(4, 2), 16) + amount));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Main sprite creation function
 */
export function createAllSprites() {
  return {
    player: createPlayerSpriteSheet('#4a9eff'),
    robot: createRobotSpriteSheet('#4a9eff'),
    floor: createModernFloorTile(),
    carpet: createCarpetTile(),
    wall: createModernWallTile(),
    glassWall: createGlassWallTile(),
    desk: createModernDeskTile(),
    attention: createAttentionIndicator(),
  };
}

export type AllSprites = ReturnType<typeof createAllSprites>;
