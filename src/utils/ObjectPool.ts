export class ObjectPool<T> {
  private pool: T[] = [];
  private factory: () => T;
  private reset: (obj: T) => void;
  private initialSize: number;

  constructor(factory: () => T, reset: (obj: T) => void, initialSize = 64) {
    this.factory = factory;
    this.reset = reset;
    this.initialSize = initialSize;
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(factory());
    }
  }

  acquire(): T {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    return this.factory();
  }

  release(obj: T): void {
    this.reset(obj);
    this.pool.push(obj);
  }

  releaseAll(objects: T[]): void {
    for (let i = 0; i < objects.length; i++) {
      this.reset(objects[i]);
      this.pool.push(objects[i]);
    }
    objects.length = 0;
  }

  get size(): number {
    return this.pool.length;
  }

  preallocate(count: number): void {
    while (this.pool.length < count) {
      this.pool.push(this.factory());
    }
  }

  destroy(): void {
    this.pool.length = 0;
  }
}
