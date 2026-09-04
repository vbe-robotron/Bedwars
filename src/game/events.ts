export type GameEventMap = {
  'mode:changed': { mode: string };
  'player:damaged': { targetUid: string; amount: number };
  'player:respawned': { uid: string };
  'world:block-placed': { x: number; y: number; z: number; type: string };
  'world:block-broken': { x: number; y: number; z: number; type: string };
};

type Listener<T> = (payload: T) => void;

export class GameEvents {
  private readonly listeners = new Map<keyof GameEventMap, Set<Listener<never>>>();

  on<K extends keyof GameEventMap>(event: K, listener: Listener<GameEventMap[K]>): () => void {
    const listeners = this.listeners.get(event) ?? new Set<Listener<never>>();
    listeners.add(listener as Listener<never>);
    this.listeners.set(event, listeners);
    return () => listeners.delete(listener as Listener<never>);
  }

  emit<K extends keyof GameEventMap>(event: K, payload: GameEventMap[K]): void {
    this.listeners.get(event)?.forEach((listener) => listener(payload as never));
  }

  clear(): void {
    this.listeners.clear();
  }
}
