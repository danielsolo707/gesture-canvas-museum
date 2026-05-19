import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../src/core/EventBus';

describe('EventBus', () => {
  it('should emit and receive events', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('gesture', handler);
    bus.emit('gesture', { type: 'drawing', hand: 'Right', confidence: 0.8, timestamp: 0 });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should support once listeners', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.once('fps_update', handler);
    bus.emit('fps_update', 60);
    bus.emit('fps_update', 30);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should return unsubscribe function from on()', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    const unsub = bus.on('engine_state', handler);
    unsub();
    bus.emit('engine_state', 'running');
    expect(handler).not.toHaveBeenCalled();
  });

  it('should clear all handlers on removeAll', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('error', handler);
    bus.removeAll();
    bus.emit('error', new Error('test'));
    expect(handler).not.toHaveBeenCalled();
  });
});
