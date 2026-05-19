import * as THREE from 'three';
import { Z_LAYERS } from '../core/constants';

export class ClearEffect {
  private group: THREE.Group;
  private particles: THREE.Points | null = null;
  private active = false;
  private duration = 800;
  private elapsed = 0;
  private lastTime = 0;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.group.renderOrder = Z_LAYERS.UI_OVERLAY;
    scene.add(this.group);
  }

  trigger(): void {
    if (this.active) return;
    this.active = true;
    this.elapsed = 0;
    this.lastTime = performance.now();

    const count = 120;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 2);

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 0.5;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = Math.sin(angle) * radius;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
      colors[i * 3] = 0.3 + Math.random() * 0.7;
      colors[i * 3 + 1] = 0.1 + Math.random() * 0.4;
      colors[i * 3 + 2] = 0.6 + Math.random() * 0.4;
      velocities[i * 2] = Math.cos(angle) * (0.3 + Math.random() * 0.7);
      velocities[i * 2 + 1] = Math.sin(angle) * (0.3 + Math.random() * 0.7);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    (geo as any).userData = { velocities };

    const mat = new THREE.PointsMaterial({
      size: 0.015,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.particles = new THREE.Points(geo, mat);
    this.group.add(this.particles);
  }

  update(now: number): void {
    if (!this.active || !this.particles) return;

    const dt = this.lastTime > 0 ? Math.min(now - this.lastTime, 32) : 16;
    this.lastTime = now;
    this.elapsed += dt;
    const progress = this.elapsed / this.duration;

    const pos = this.particles.geometry.attributes.position;
    const posArr = pos.array as Float32Array;
    const velocities = (this.particles.geometry as any).userData?.velocities;

    if (velocities) {
      for (let i = 0; i < posArr.length / 3; i++) {
        posArr[i * 3] += velocities[i * 2] * dt * 0.001;
        posArr[i * 3 + 1] += velocities[i * 2 + 1] * dt * 0.001;
        velocities[i * 2] *= 0.98;
        velocities[i * 2 + 1] *= 0.98;
      }
    }
    pos.needsUpdate = true;

    const mat = this.particles.material as THREE.PointsMaterial;
    mat.opacity = Math.max(0, 1 - progress);
    mat.size = 0.015 * (1 + progress * 2);

    if (progress >= 1) this.finish();
  }

  private finish(): void {
    this.active = false;
    if (this.particles) {
      this.group.remove(this.particles);
      this.particles.geometry.dispose();
      (this.particles.material as THREE.Material).dispose();
      this.particles = null;
    }
  }

  destroy(): void {
    this.finish();
    this.group.parent?.remove(this.group);
  }
}
