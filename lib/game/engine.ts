import { Character } from '@/types';

export const TILE_SIZE = 32;
export const OFFICE_WIDTH = 60;   // Compact width
export const OFFICE_HEIGHT = 80;  // Tall enough for stacked workspace rooms

export interface GameEngine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  camera: { x: number; y: number };
  lastFrameTime: number;
  isRunning: boolean;
}

export function createGameEngine(canvas: HTMLCanvasElement): GameEngine {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas 2D context');
  }

  // Disable image smoothing for pixel-perfect rendering
  ctx.imageSmoothingEnabled = false;

  return {
    canvas,
    ctx,
    camera: { x: 0, y: 0 },
    lastFrameTime: 0,
    isRunning: false,
  };
}

export function startGameLoop(
  engine: GameEngine,
  render: (deltaTime: number) => void
) {
  engine.isRunning = true;

  function gameLoop(currentTime: number) {
    if (!engine.isRunning) return;

    const deltaTime = currentTime - engine.lastFrameTime;
    engine.lastFrameTime = currentTime;

    // Clear canvas
    engine.ctx.clearRect(0, 0, engine.canvas.width, engine.canvas.height);

    // Render game
    render(deltaTime);

    // Request next frame
    requestAnimationFrame(gameLoop);
  }

  engine.lastFrameTime = performance.now();
  requestAnimationFrame(gameLoop);
}

export function stopGameLoop(engine: GameEngine) {
  engine.isRunning = false;
}

export function worldToScreen(
  worldX: number,
  worldY: number,
  camera: { x: number; y: number }
): { x: number; y: number } {
  return {
    x: worldX - camera.x,
    y: worldY - camera.y,
  };
}

export function screenToWorld(
  screenX: number,
  screenY: number,
  camera: { x: number; y: number }
): { x: number; y: number } {
  return {
    x: screenX + camera.x,
    y: screenY + camera.y,
  };
}

export function centerCameraOnCharacter(
  camera: { x: number; y: number },
  character: Character,
  canvasWidth: number,
  canvasHeight: number
) {
  camera.x = character.x - canvasWidth / 2;
  camera.y = character.y - canvasHeight / 2;

  // Clamp camera to world bounds
  const worldWidth = OFFICE_WIDTH * TILE_SIZE;
  const worldHeight = OFFICE_HEIGHT * TILE_SIZE;

  camera.x = Math.max(0, Math.min(camera.x, worldWidth - canvasWidth));
  camera.y = Math.max(0, Math.min(camera.y, worldHeight - canvasHeight));
}
