import { Action, ActionType, GestureEvent, Handedness } from './types';

const DEFAULT_MAP: Record<string, ActionType> = {
  drawing: 'DRAW',
  cursor: 'CURSOR',
  eraser: 'ERASE',
  idle: 'IDLE',
  swipe_left: 'PREV_SCENE',
  swipe_right: 'NEXT_SCENE',
};

export class GestureActionMapper {
  private mapping: Record<string, ActionType>;

  constructor(mapping?: Record<string, ActionType>) {
    this.mapping = { ...DEFAULT_MAP, ...mapping };
  }

  translate(event: GestureEvent): Action {
    const actionType = this.mapping[event.type] ?? 'IDLE';
    return {
      type: actionType,
      payload: event.data ?? {},
      timestamp: event.timestamp,
      source: event.type,
      hand: event.hand,
      confidence: event.confidence,
    };
  }

  registerGesture(gesture: string, action: ActionType): void {
    this.mapping[gesture] = action;
  }

  unregisterGesture(gesture: string): void {
    delete this.mapping[gesture];
  }

  getMapping(): Readonly<Record<string, ActionType>> {
    return this.mapping;
  }
}
