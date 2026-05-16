import * as THREE from 'three';
import { StrokeData } from '../core/types';

export class StrokeRenderer {
  private scene: THREE.Scene;
  private meshes: Map<string, THREE.Mesh> = new Map();
  private material: THREE.MeshBasicMaterial;
  private strokeGroup: THREE.Group;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.strokeGroup = new THREE.Group();
    this.strokeGroup.renderOrder = 1;
    this.scene.add(this.strokeGroup);

    this.material = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }

  addStroke(stroke: StrokeData): void {
    if (stroke.points.length < 2) return;

    const geo = this.buildRibbonGeometry(stroke);
    const mesh = new THREE.Mesh(geo, this.material);
    mesh.renderOrder = 1;
    mesh.frustumCulled = false;

    this.strokeGroup.add(mesh);
    this.meshes.set(stroke.id, mesh);
  }

  updateStroke(stroke: StrokeData): void {
    const existing = this.meshes.get(stroke.id);
    if (existing) {
      existing.geometry.dispose();
      existing.geometry = this.buildRibbonGeometry(stroke);
    } else {
      this.addStroke(stroke);
    }
  }

  removeStroke(strokeId: string): void {
    const mesh = this.meshes.get(strokeId);
    if (mesh) {
      this.strokeGroup.remove(mesh);
      mesh.geometry.dispose();
      this.meshes.delete(strokeId);
    }
  }

  clear(): void {
    for (const [, mesh] of this.meshes) {
      this.strokeGroup.remove(mesh);
      mesh.geometry.dispose();
    }
    this.meshes.clear();
  }

  rebuildAll(strokes: StrokeData[]): void {
    this.clear();
    for (const s of strokes) {
      this.addStroke(s);
    }
  }

  update(_now: number): void {}

  private buildRibbonGeometry(stroke: StrokeData): THREE.BufferGeometry {
    const pts = stroke.points;
    const width = stroke.width * 0.005;
    const color = new THREE.Color(stroke.color);

    if (pts.length < 2) {
      return new THREE.BufferGeometry();
    }

    const vertexCount = (pts.length - 1) * 4;
    const positions = new Float32Array(vertexCount * 3);
    const vertColors = new Float32Array(vertexCount * 3);
    const indices = new Uint16Array((pts.length - 1) * 6);

    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[i - 1];
      const p1 = pts[i];

      const dx = p1.x - p0.x;
      const dy = p1.y - p0.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;

      const i0 = (i - 1) * 4;

      positions[i0 * 3] = p0.x + nx * width;
      positions[i0 * 3 + 1] = p0.y + ny * width;
      positions[i0 * 3 + 2] = p0.z ?? 0;

      positions[(i0 + 1) * 3] = p0.x - nx * width;
      positions[(i0 + 1) * 3 + 1] = p0.y - ny * width;
      positions[(i0 + 1) * 3 + 2] = p0.z ?? 0;

      positions[(i0 + 2) * 3] = p1.x + nx * width;
      positions[(i0 + 2) * 3 + 1] = p1.y + ny * width;
      positions[(i0 + 2) * 3 + 2] = p1.z ?? 0;

      positions[(i0 + 3) * 3] = p1.x - nx * width;
      positions[(i0 + 3) * 3 + 1] = p1.y - ny * width;
      positions[(i0 + 3) * 3 + 2] = p1.z ?? 0;

      for (let v = 0; v < 4; v++) {
        vertColors[(i0 + v) * 3] = color.r;
        vertColors[(i0 + v) * 3 + 1] = color.g;
        vertColors[(i0 + v) * 3 + 2] = color.b;
      }

      const ii = (i - 1) * 6;
      indices[ii] = i0;
      indices[ii + 1] = i0 + 1;
      indices[ii + 2] = i0 + 2;
      indices[ii + 3] = i0 + 1;
      indices[ii + 4] = i0 + 3;
      indices[ii + 5] = i0 + 2;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(vertColors, 3));
    geo.setIndex(new THREE.BufferAttribute(indices, 1));
    geo.computeVertexNormals();
    return geo;
  }

  destroy(): void {
    this.clear();
    this.material.dispose();
    this.scene.remove(this.strokeGroup);
  }
}
