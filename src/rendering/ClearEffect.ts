import * as THREE from 'three';
import { Z_LAYERS } from '../core/constants';

export class ClearEffect {
  private group: THREE.Group;
  private particles: THREE.Points | null = null;
  private active = false;
  private duration = 800;
  private elapsed = 0;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.group.renderOrder = Z_LAYERS.UI_OVERLAY;
    scene.add(this.group);
  }

  trigger(): void {
    if (this.active) return;
    this.active = true;
    this.elapsed = 0;

    const count = 200;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 3;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 3;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
      colors[i * 3] = Math.random();
      colors[i * 3 + 1] = Math.random() * 0.5;
      colors[i * 3 + 2] = 1;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.02,
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

    this.elapsed += 16;
    const progress = this.elapsed / this.duration;
    const pos = this.particles.geometry.attributes.position;
    const posArr = pos.array as Float32Array;

    for (let i = 0; i < posArr.length / 3; i++) {
      posArr[i * 3] += (Math.random() - 0.5) * 0.01;
      posArr[i * 3 + 1] += (Math.random() - 0.5) * 0.01;
    }
    pos.needsUpdate = true;

    const mat = this.particles.material as THREE.PointsMaterial;
    mat.opacity = Math.max(0, 1 - progress);
    mat.size = 0.02 * (1 + progress * 3);

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
