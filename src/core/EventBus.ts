type EventHandler<T = unknown> = (event: T) => void;

export interface EventMap {
  gesture: import('./types').GestureEvent;
  hand_update: { hands: import('./types').HandSnapshot[] };
  engine_state: import('./types').EngineState;
  error: Error;
  clear_canvas: void;
  stroke_added: import('./types').StrokeData;
  stroke_erased: { strokeId: string };
  undo: void;
  fps_update: number;
}

type EventName = keyof EventMap & string;

export class EventBus {
  private handlers = new Map<string, Set<EventHandler>>();
  private onceHandlers = new Map<string, Set<EventHandler>>();

  on<K extends EventName>(event: K, handler: EventHandler<EventMap[K]>): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler as EventHandler);
    return () => this.handlers.get(event)?.delete(handler as EventHandler);
  }

  once<K extends EventName>(event: K, handler: EventHandler<EventMap[K]>): void {
    if (!this.onceHandlers.has(event)) {
      this.onceHandlers.set(event, new Set());
    }
    this.onceHandlers.get(event)!.add(handler as EventHandler);
  }

  emit<K extends EventName>(event: K, data?: EventMap[K]): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      for (const h of handlers) {
        h(data as any);
      }
    }
    const once = this.onceHandlers.get(event);
    if (once) {
      for (const h of once) {
        h(data as any);
      }
      this.onceHandlers.delete(event);
    }
  }

  removeAll(): void {
    this.handlers.clear();
    this.onceHandlers.clear();
  }
}

export const globalEventBus = new EventBus();
