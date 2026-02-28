import { TILE_SIZE, OFFICE_WIDTH, OFFICE_HEIGHT } from './engine';

export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  keys: Set<string>;
}

export function createInputHandler(): InputState {
  const state: InputState = {
    up: false,
    down: false,
    left: false,
    right: false,
    keys: new Set(),
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    state.keys.add(e.key.toLowerCase());

    switch (e.key.toLowerCase()) {
      case 'w':
      case 'arrowup':
        state.up = true;
        break;
      case 's':
      case 'arrowdown':
        state.down = true;
        break;
      case 'a':
      case 'arrowleft':
        state.left = true;
        break;
      case 'd':
      case 'arrowright':
        state.right = true;
        break;
    }
  };

  const handleKeyUp = (e: KeyboardEvent) => {
    state.keys.delete(e.key.toLowerCase());

    switch (e.key.toLowerCase()) {
      case 'w':
      case 'arrowup':
        state.up = false;
        break;
      case 's':
      case 'arrowdown':
        state.down = false;
        break;
      case 'a':
      case 'arrowleft':
        state.left = false;
        break;
      case 'd':
      case 'arrowright':
        state.right = false;
        break;
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);

  return state;
}

// Set directional input from touch controls
export function setTouchDirection(state: InputState, direction: string | null) {
  state.up = false;
  state.down = false;
  state.left = false;
  state.right = false;

  if (direction === 'up') state.up = true;
  else if (direction === 'down') state.down = true;
  else if (direction === 'left') state.left = true;
  else if (direction === 'right') state.right = true;
  else if (direction === 'up-left') { state.up = true; state.left = true; }
  else if (direction === 'up-right') { state.up = true; state.right = true; }
  else if (direction === 'down-left') { state.down = true; state.left = true; }
  else if (direction === 'down-right') { state.down = true; state.right = true; }
}

export function cleanupInputHandler() {
  // Remove event listeners if needed
  // Store handlers in closure for cleanup
}

export const MOVE_SPEED = 4; // pixels per frame at 60fps

export function applyMovement(
  character: { x: number; y: number; direction: string },
  input: InputState,
  deltaTime: number
): void {
  const speed = MOVE_SPEED * (deltaTime / 16.67); // Normalize to 60fps

  let moved = false;
  let newDirection = character.direction;

  if (input.up) {
    character.y -= speed;
    newDirection = 'up';
    moved = true;
  }
  if (input.down) {
    character.y += speed;
    newDirection = 'down';
    moved = true;
  }
  if (input.left) {
    character.x -= speed;
    newDirection = 'left';
    moved = true;
  }
  if (input.right) {
    character.x += speed;
    newDirection = 'right';
    moved = true;
  }

  if (moved) {
    character.direction = newDirection;
  }

  // Clamp to world bounds (will be replaced with proper collision later)
  character.x = Math.max(0, Math.min(character.x, OFFICE_WIDTH * TILE_SIZE - TILE_SIZE));
  character.y = Math.max(0, Math.min(character.y, OFFICE_HEIGHT * TILE_SIZE - TILE_SIZE));
}
