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

    this.removeStroke(stroke.id);

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
    const capSegments = 10;

    if (pts.length < 2) {
      return new THREE.BufferGeometry();
    }

    const baseVertexCount = (pts.length - 1) * 4;
    const capVertexCount = pts.length * (capSegments + 1);
    const totalVertexCount = baseVertexCount + capVertexCount;
    const baseIndexCount = (pts.length - 1) * 6;
    const capIndexCount = pts.length * capSegments * 3;
    const totalIndexCount = baseIndexCount + capIndexCount;
    const useUint32 = totalVertexCount > 65535;

    const positions = new Float32Array(totalVertexCount * 3);
    const vertColors = new Float32Array(totalVertexCount * 3);
    const indices = useUint32 ? new Uint32Array(totalIndexCount) : new Uint16Array(totalIndexCount);

    let v = 0;
    let idx = 0;

    const writeVertex = (x: number, y: number, z: number): number => {
      const base = v * 3;
      positions[base] = x;
      positions[base + 1] = y;
      positions[base + 2] = z;
      vertColors[base] = color.r;
      vertColors[base + 1] = color.g;
      vertColors[base + 2] = color.b;
      return v++;
    };

    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[i - 1];
      const p1 = pts[i];

      const dx = p1.x - p0.x;
      const dy = p1.y - p0.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;

      const v0 = writeVertex(p0.x + nx * width, p0.y + ny * width, p0.z ?? 0);
      const v1 = writeVertex(p0.x - nx * width, p0.y - ny * width, p0.z ?? 0);
      const v2 = writeVertex(p1.x + nx * width, p1.y + ny * width, p1.z ?? 0);
      const v3 = writeVertex(p1.x - nx * width, p1.y - ny * width, p1.z ?? 0);

      indices[idx++] = v0;
      indices[idx++] = v1;
      indices[idx++] = v2;
      indices[idx++] = v1;
      indices[idx++] = v3;
      indices[idx++] = v2;
    }

    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const centerIdx = writeVertex(p.x, p.y, p.z ?? 0);
      let firstRing = -1;
      let prevRing = -1;

      for (let s = 0; s < capSegments; s++) {
        const angle = (s / capSegments) * Math.PI * 2;
        const rx = p.x + Math.cos(angle) * width;
        const ry = p.y + Math.sin(angle) * width;
        const ringIdx = writeVertex(rx, ry, p.z ?? 0);

        if (s === 0) {
          firstRing = ringIdx;
        } else {
          indices[idx++] = centerIdx;
          indices[idx++] = prevRing;
          indices[idx++] = ringIdx;
        }

        prevRing = ringIdx;
      }

      if (firstRing !== -1 && prevRing !== -1) {
        indices[idx++] = centerIdx;
        indices[idx++] = prevRing;
        indices[idx++] = firstRing;
      }
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
