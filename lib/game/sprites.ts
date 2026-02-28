// Placeholder sprite generator until we have real pixel art assets
export function generatePlaceholderSprite(
  width: number,
  height: number,
  color: string
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  
  // Draw a simple colored rectangle
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  
  // Add border
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, width, height);
  
  return canvas;
}

export const PLACEHOLDER_SPRITES = {
  floor: '#e0e0e0',
  wall: '#8b7355',
  desk: '#d4a574',
  chair: '#666666',
  player: '#4a90e2',
  agent: '#50c878',
};

export function createPlaceholderSprites() {
  const sprites: Record<string, HTMLCanvasElement> = {};
  
  Object.entries(PLACEHOLDER_SPRITES).forEach(([key, color]) => {
    sprites[key] = generatePlaceholderSprite(16, 16, color);
  });
  
  return sprites;
}
