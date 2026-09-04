export type InputAction = 'forward' | 'back' | 'left' | 'right' | 'jump' | 'sprint';

const KEY_ACTIONS: Record<string, InputAction> = {
  KeyW: 'forward', KeyS: 'back', KeyA: 'left', KeyD: 'right',
  Space: 'jump', ShiftLeft: 'sprint', ShiftRight: 'sprint',
};

export class InputController {
  private readonly pressed = new Set<InputAction>();

  constructor(private readonly target: Window = window) {
    target.addEventListener('keydown', this.onKeyDown);
    target.addEventListener('keyup', this.onKeyUp);
    target.addEventListener('blur', this.clear);
  }

  isPressed(action: InputAction): boolean {
    return this.pressed.has(action);
  }

  axis(): { x: number; z: number } {
    return {
      x: Number(this.isPressed('right')) - Number(this.isPressed('left')),
      z: Number(this.isPressed('back')) - Number(this.isPressed('forward')),
    };
  }

  dispose(): void {
    this.target.removeEventListener('keydown', this.onKeyDown);
    this.target.removeEventListener('keyup', this.onKeyUp);
    this.target.removeEventListener('blur', this.clear);
    this.clear();
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const action = KEY_ACTIONS[event.code];
    if (action) this.pressed.add(action);
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    const action = KEY_ACTIONS[event.code];
    if (action) this.pressed.delete(action);
  };

  private readonly clear = (): void => {
    this.pressed.clear();
  };
}
