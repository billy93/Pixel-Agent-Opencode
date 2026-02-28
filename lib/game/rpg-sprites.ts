/**
 * Create RPG-style character sprites with pixel art (Gather.town style)
 */
export function createCharacterSprite(color: string = '#4a9eff'): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const size = 32; // 32x32 pixel sprite
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  
  ctx.imageSmoothingEnabled = false;
  
  const px = (x: number, y: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  };
  
  // A cute 3/4 top-down character (Gather style)
  const outline = '#2d3436';
  const skin = '#ffdfc4';
  const skinShadow = '#eebfa1';
  const hair = '#5e3c23'; // brown hair
  const pants = '#4b6584'; // blue-grey jeans
  const pantsShadow = '#3c506b';
  const shoes = '#353b48';
  
  const shirt = color;
  const shadow = 'rgba(0,0,0,0.2)';

  // Drop shadow on the floor
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath();
  ctx.ellipse(16, 29, 8, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body/Torso (draw first so it goes behind head)
  // Shirt
  px(10, 16, 12, 8, outline); // shirt outline
  px(11, 17, 10, 6, shirt);   // shirt color
  px(11, 21, 10, 2, shadow);  // shirt shadow

  // Legs/Pants
  px(11, 23, 10, 6, outline); // pants outline
  px(12, 23, 3, 5, pants);    // left leg
  px(17, 23, 3, 5, pants);    // right leg
  px(12, 23, 3, 2, pantsShadow); // left leg shadow
  px(17, 23, 3, 2, pantsShadow); // right leg shadow
  
  // Shoes
  px(10, 28, 5, 3, outline);
  px(11, 28, 3, 2, shoes);
  px(17, 28, 5, 3, outline);
  px(18, 28, 3, 2, shoes);
  
  // Arms
  px(8, 17, 3, 7, outline); // left arm outline
  px(9, 18, 1, 5, shirt);   // left arm sleeve
  px(9, 23, 1, 1, skin);    // left hand
  
  px(21, 17, 3, 7, outline); // right arm outline
  px(22, 18, 1, 5, shirt);   // right arm sleeve
  px(22, 23, 1, 1, skin);    // right hand

  // Head
  px(9, 5, 14, 12, outline); // head outline
  px(10, 6, 12, 10, skin);   // face
  px(10, 14, 12, 2, skinShadow); // face shadow (neck area)

  // Eyes
  const eyeColor = '#2d3436';
  px(12, 10, 2, 3, eyeColor); // left eye
  px(18, 10, 2, 3, eyeColor); // right eye
  
  // Rosy cheeks
  px(11, 13, 2, 1, 'rgba(255, 100, 100, 0.4)');
  px(19, 13, 2, 1, 'rgba(255, 100, 100, 0.4)');

  // Hair
  px(8, 3, 16, 5, outline); // hair outline top
  px(9, 4, 14, 4, hair);    // hair base
  px(8, 5, 2, 5, outline);  // hair sides outline
  px(9, 5, 2, 4, hair);
  px(22, 5, 2, 5, outline);
  px(21, 5, 2, 4, hair);
  
  // Hair fringe/bangs
  px(10, 6, 4, 2, hair);
  px(18, 6, 3, 1, hair);
  
  return canvas;
}

/**
 * Create computer/terminal sprite for agents -> Redesigned as a cute robot
 */
export function createComputerSprite(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const size = 32;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  
  ctx.imageSmoothingEnabled = false;
  
  const px = (x: number, y: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  };
  
  // Robot avatar (Agent)
  const outline = '#1e272e';
  const bodyBase = '#d2dae2';
  const bodyShadow = '#808e9b';
  const screenBg = '#1e272e';
  const screenGlow = '#0be881'; // green glowing eyes
  const screenGlowAlt = '#05c46b';
  
  // Drop shadow on the floor
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath();
  ctx.ellipse(16, 29, 9, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Antenna
  px(15, 2, 2, 4, outline);
  px(15, 3, 2, 3, bodyShadow);
  px(14, 1, 4, 3, outline);
  px(15, 2, 2, 1, '#ff3f34'); // red antenna tip
  
  // Body (cube shape)
  px(8, 16, 16, 10, outline);
  px(9, 17, 14, 8, bodyBase);
  px(9, 23, 14, 2, bodyShadow);
  
  // Tracks / Wheels
  px(7, 25, 6, 6, outline);
  px(8, 26, 4, 4, '#485460'); // left wheel
  px(19, 25, 6, 6, outline);
  px(20, 26, 4, 4, '#485460'); // right wheel
  
  // Head (Monitor)
  px(6, 6, 20, 12, outline);
  px(7, 7, 18, 10, bodyBase);
  px(7, 15, 18, 2, bodyShadow); // monitor bottom lip
  
  // Screen
  px(9, 9, 14, 6, screenBg);
  
  // Robot Eyes (Happy / Agent working)
  px(11, 11, 3, 2, screenGlow); // left eye
  px(18, 11, 3, 2, screenGlow); // right eye
  px(14, 12, 4, 1, screenGlowAlt); // mouth/connection line
  
  // Robot arms
  px(5, 17, 4, 6, outline);
  px(6, 18, 2, 4, bodyShadow);
  px(23, 17, 4, 6, outline);
  px(24, 18, 2, 4, bodyShadow);
  
  return canvas;
}

/**
 * Create RPG-style floor tiles (Gather wood style)
 */
export function createFloorTile(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const size = 32;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  
  const px = (x: number, y: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  };
  
  // Nice warm wooden planks
  const woodBase = '#d2a679';
  const woodLine = '#a68059';
  const woodHighlight = '#e0b88f';
  
  // Base
  px(0, 0, 32, 32, woodBase);
  
  // Horizontal plank lines
  for (let i = 0; i < 32; i += 8) {
    px(0, i, 32, 1, woodLine);
    px(0, i + 1, 32, 1, woodHighlight); // highlight for depth
  }
  
  // Vertical staggers
  px(12, 0, 1, 8, woodLine);
  px(28, 0, 1, 8, woodLine);
  px(6, 8, 1, 8, woodLine);
  px(22, 8, 1, 8, woodLine);
  px(16, 16, 1, 8, woodLine);
  px(30, 16, 1, 8, woodLine);
  px(8, 24, 1, 8, woodLine);
  px(24, 24, 1, 8, woodLine);
  
  // Wood grain details
  const grain = 'rgba(166, 128, 89, 0.3)';
  px(2, 3, 6, 1, grain);
  px(18, 5, 8, 1, grain);
  px(8, 11, 10, 1, grain);
  px(24, 13, 5, 1, grain);
  px(4, 19, 8, 1, grain);
  px(20, 21, 6, 1, grain);
  px(12, 27, 9, 1, grain);
  px(28, 29, 3, 1, grain);
  
  return canvas;
}

/**
 * Create wall tile
 */
export function createWallTile(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const size = 32;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  
  const px = (x: number, y: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  };
  
  // Wallpaper top (Gather often uses pastel colors for office walls)
  const wallBase = '#f1f2f6';
  const wallStripe = '#dfe4ea';
  const baseboard = '#ced6e0';
  const baseboardTop = '#a4b0be';
  
  // Main wall background
  px(0, 0, 32, 26, wallBase);
  
  // Vertical wallpaper stripes
  for (let x = 0; x < 32; x += 8) {
    px(x, 0, 4, 26, wallStripe);
  }
  
  // The top edge of the wall (giving 3D thickness)
  px(0, 0, 32, 4, '#dcdde1');
  px(0, 4, 32, 1, '#b2bec3'); // shadow under top edge
  
  // Baseboard at the bottom
  px(0, 26, 32, 6, baseboard);
  px(0, 26, 32, 1, baseboardTop);
  px(0, 31, 32, 1, 'rgba(0,0,0,0.1)'); // shadow on the floor
  
  return canvas;
}

/**
 * Create desk tile
 */
export function createDeskTile(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const size = 32;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  
  const px = (x: number, y: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  };
  
  // Transparent bg
  ctx.clearRect(0, 0, 32, 32);
  
  // Shadow on floor
  px(2, 22, 28, 8, 'rgba(0,0,0,0.2)');
  
  // Desk Legs
  const legColor = '#7f8fa6';
  px(3, 10, 2, 18, legColor);
  px(27, 10, 2, 18, legColor);
  
  // Desk Surface (Light wood)
  const deskBase = '#f8c291';
  const deskDark = '#b78a44';
  
  px(1, 10, 30, 12, deskBase); // top surface
  px(1, 22, 30, 2, deskDark);  // front lip
  px(1, 10, 30, 1, '#ffddb3'); // highlight
  
  // A sleek laptop
  const laptopSilver = '#dcdde1';
  const laptopDark = '#718093';
  const screenGlow = '#82ccdd';
  
  // Laptop base
  px(10, 16, 10, 5, laptopSilver);
  px(11, 17, 8, 3, '#2f3640'); // keyboard
  // Laptop screen (open facing back/up)
  px(10, 11, 10, 5, laptopDark);
  px(11, 12, 8, 3, screenGlow);
  
  // Coffee Mug
  px(24, 14, 3, 4, '#eb2f06'); // red mug
  px(27, 15, 1, 2, '#eb2f06'); // handle
  px(24, 14, 3, 1, '#3d3d3d'); // coffee inside
  
  // Potted Plant
  px(3, 11, 6, 5, '#1e272e'); // pot back
  px(4, 13, 4, 4, '#c23616'); // terracotta pot
  px(4, 12, 4, 1, '#b71540'); // pot rim
  // Leaves
  px(4, 7, 2, 2, '#44bd32');
  px(6, 6, 2, 3, '#4cd137');
  px(5, 9, 3, 3, '#4cd137');
  px(2, 9, 2, 2, '#44bd32');
  px(7, 9, 2, 2, '#44bd32');
  
  // Tucked-in Chair (seen from front)
  const chairBase = '#353b48';
  const chairCushion = '#00a8ff';
  
  px(9, 25, 14, 3, chairBase); // chair back top
  px(10, 25, 12, 6, chairCushion); // back cushion
  px(11, 22, 10, 4, chairCushion); // seat (tucked under desk)
  // Armrests
  px(7, 23, 2, 4, chairBase);
  px(23, 23, 2, 4, chairBase);
  
  return canvas;
}

/**
 * Create action bubble background (Gather style clean bubbles)
 */
export function createActionBubble(text: string, width: number = 120): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const height = 24;
  
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  
  ctx.imageSmoothingEnabled = true;
  
  // Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
  ctx.beginPath();
  ctx.roundRect(1, 1, width - 2, height - 4, 8);
  ctx.fill();
  
  // Bubble background
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(0, 0, width - 2, height - 5, 8);
  ctx.fill();
  
  // Bubble pointer (small triangle pointing down)
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(width / 2 - 4, height - 5);
  ctx.lineTo(width / 2, height - 1);
  ctx.lineTo(width / 2 + 4, height - 5);
  ctx.closePath();
  ctx.fill();
  
  // Text
  ctx.fillStyle = '#2f3542';
  ctx.font = 'bold 10px "Inter", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, (width - 2) / 2, (height - 5) / 2);
  
  return canvas;
}

/**
 * Create attention indicator (exclamation mark in a circle) for agents needing action
 */
export function createAttentionIndicator(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const size = 20;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  
  ctx.imageSmoothingEnabled = true;
  
  // Outer glow
  ctx.shadowColor = '#ff4757';
  ctx.shadowBlur = 8;
  
  // Circle background (red/orange)
  ctx.fillStyle = '#ff4757';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
  ctx.fill();
  
  // Reset shadow
  ctx.shadowBlur = 0;
  
  // Inner highlight
  ctx.fillStyle = '#ff6b81';
  ctx.beginPath();
  ctx.arc(size / 2 - 1, size / 2 - 1, size / 2 - 4, 0, Math.PI * 2);
  ctx.fill();
  
  // Exclamation mark
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('!', size / 2, size / 2);
  
  return canvas;
}

/**
 * Create all RPG sprites
 */
export function createRPGSprites() {
  return {
    player: createCharacterSprite('#4a9eff'), // Blue player
    agent: createComputerSprite(), // Cute robot agent
    floor: createFloorTile(),
    wall: createWallTile(),
    desk: createDeskTile(),
    attention: createAttentionIndicator(), // Attention indicator for agents needing action
  };
}
