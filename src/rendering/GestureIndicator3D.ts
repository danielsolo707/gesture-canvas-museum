import * as THREE from 'three';
import { GestureType } from '../core/types';
import { RENDER, Z_LAYERS } from '../core/constants';

const GESTURE_COLORS: Record<string, string> = {
  idle: '#4a4a5a', drawing: '#4dabf7', color_select: '#ffd43b',
  clear_canvas: '#69db7c', eraser: '#ffa94d',
};

export class GestureIndicator3D {
  private group: THREE.Group;
  private ring: THREE.Mesh;
  private pulsePhase = 0;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.group.renderOrder = Z_LAYERS.GESTURE_INDICATOR;

    const geo = new THREE.RingGeometry(0.04, 0.05, 16);
    const mat = new THREE.MeshBasicMaterial({
      color: GESTURE_COLORS.idle, transparent: true, opacity: 0.6,
      side: THREE.DoubleSide, depthWrite: false,
    });
    this.ring = new THREE.Mesh(geo, mat);
    this.ring.position.set(0, 0.85, 0);
    this.group.add(this.ring);
    scene.add(this.group);
  }

  setGesture(type: GestureType, progress = 0): void {
    const color = GESTURE_COLORS[type] ?? GESTURE_COLORS.idle;
    (this.ring.material as THREE.MeshBasicMaterial).color.set(color);
    if (type === 'clear_canvas' && progress > 0) {
      this.ring.scale.setScalar(1 + progress * 0.5);
      (this.ring.material as THREE.MeshBasicMaterial).opacity = 0.3 + progress * 0.7;
    } else {
      this.ring.scale.setScalar(1);
      (this.ring.material as THREE.MeshBasicMaterial).opacity = 0.6;
    }
  }

  update(now: number): void {
    this.pulsePhase += 0.03;
    this.ring.rotation.z = this.pulsePhase;
  }

  destroy(): void {
    this.ring.geometry.dispose();
    (this.ring.material as THREE.Material).dispose();
    this.group.parent?.remove(this.group);
  }
}
