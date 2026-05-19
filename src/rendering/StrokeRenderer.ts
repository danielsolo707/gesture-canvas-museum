import * as THREE from 'three';
import { StrokeData, StrokePoint } from '../core/types';
import { DRAWING, RENDER } from '../core/constants';

interface PooledGeometry {
  geometry: THREE.BufferGeometry;
  lastUsed: number;
}

const MAX_POOL_SIZE = 200;

export class StrokeRenderer {
  private scene: THREE.Scene;
  private meshes = new Map<string, THREE.Mesh>();
  private glowMeshes = new Map<string, THREE.Mesh>();
  private material: THREE.MeshBasicMaterial;
  private glowMaterial: THREE.MeshBasicMaterial;
  private strokeGroup: THREE.Group;
  private glowGroup: THREE.Group;
  private geometryPool: PooledGeometry[] = [];
  private frameCount = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    this.strokeGroup = new THREE.Group();
    this.strokeGroup.renderOrder = 1;
    this.scene.add(this.strokeGroup);

    this.glowGroup = new THREE.Group();
    this.glowGroup.renderOrder = 0;
    this.scene.add(this.glowGroup);

    this.material = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.glowMaterial = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.15,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
  }

  addStroke(stroke: StrokeData): void {
    if (stroke.points.length < 2) return;
    this.removeStroke(stroke.id);

    const smoothPts = this.catmullRomSmooth(stroke.points, DRAWING.CURVE_QUALITY);
    const widths = this.computeVelocityWidths(smoothPts, stroke.width);

    const geo = this.buildCircularGeometry(smoothPts, widths, stroke.color);
    const mesh = new THREE.Mesh(geo, this.material);
    mesh.renderOrder = 1;
    mesh.frustumCulled = false;
    this.strokeGroup.add(mesh);
    this.meshes.set(stroke.id, mesh);

    if (RENDER.STROKE_GLOW_ENABLED) {
      const glowGeo = this.buildCircularGeometry(smoothPts, widths.map(w => w * 2.5), stroke.color);
      const glow = new THREE.Mesh(glowGeo, this.glowMaterial);
      glow.renderOrder = 0;
      glow.frustumCulled = false;
      this.glowGroup.add(glow);
      this.glowMeshes.set(stroke.id, glow);
    }
  }

  updateStroke(stroke: StrokeData): void {
    const existing = this.meshes.get(stroke.id);
    if (existing) {
      this.recycleGeometry(existing.geometry);
      const smoothPts = this.catmullRomSmooth(stroke.points, DRAWING.CURVE_QUALITY);
      const widths = this.computeVelocityWidths(smoothPts, stroke.width);
      existing.geometry = this.buildCircularGeometry(smoothPts, widths, stroke.color);

      const glow = this.glowMeshes.get(stroke.id);
      if (glow) {
        this.recycleGeometry(glow.geometry);
        glow.geometry = this.buildCircularGeometry(smoothPts, widths.map(w => w * 2.5), stroke.color);
      }
    } else {
      this.addStroke(stroke);
    }
  }

  removeStroke(strokeId: string): void {
    const mesh = this.meshes.get(strokeId);
    if (mesh) {
      this.strokeGroup.remove(mesh);
      this.recycleGeometry(mesh.geometry);
      this.meshes.delete(strokeId);
    }
    const glow = this.glowMeshes.get(strokeId);
    if (glow) {
      this.glowGroup.remove(glow);
      this.recycleGeometry(glow.geometry);
      this.glowMeshes.delete(strokeId);
    }
  }

  clear(): void {
    for (const [, mesh] of this.meshes) {
      this.strokeGroup.remove(mesh);
      this.recycleGeometry(mesh.geometry);
    }
    for (const [, glow] of this.glowMeshes) {
      this.glowGroup.remove(glow);
      this.recycleGeometry(glow.geometry);
    }
    this.meshes.clear();
    this.glowMeshes.clear();
  }

  rebuildAll(strokes: StrokeData[]): void {
    this.clear();
    for (const s of strokes) {
      this.addStroke(s);
    }
  }

  update(_now: number): void {
    this.frameCount++;
    if (this.frameCount % 300 === 0) {
      this.evictPool();
    }
  }

  private recycleGeometry(geo: THREE.BufferGeometry): void {
    if (this.geometryPool.length < MAX_POOL_SIZE) {
      this.geometryPool.push({ geometry: geo, lastUsed: this.frameCount });
    } else {
      geo.dispose();
    }
  }

  private acquireGeometry(): THREE.BufferGeometry {
    if (this.geometryPool.length > 0) {
      const entry = this.geometryPool.pop()!;
      entry.lastUsed = this.frameCount;
      return entry.geometry;
    }
    return new THREE.BufferGeometry();
  }

  private evictPool(): void {
    const threshold = this.frameCount - 600;
    const toRemove = this.geometryPool.filter(p => p.lastUsed <= threshold);
    for (const p of toRemove) {
      p.geometry.dispose();
    }
    this.geometryPool = this.geometryPool.filter(p => p.lastUsed > threshold);
  }

  private catmullRomSmooth(points: StrokePoint[], segmentsPerSpan: number): StrokePoint[] {
    if (points.length < 3) return points;

    const result: StrokePoint[] = [points[0]];
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[Math.min(points.length - 1, i + 1)];
      const p3 = points[Math.min(points.length - 1, i + 2)];

      for (let s = 1; s <= segmentsPerSpan; s++) {
        const t = s / (segmentsPerSpan + 1);
        const t2 = t * t;
        const t3 = t2 * t;

        const x = 0.5 * (
          (2 * p1.x) +
          (-p0.x + p2.x) * t +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
        );
        const y = 0.5 * (
          (2 * p1.y) +
          (-p0.y + p2.y) * t +
          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
          (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
        );
        result.push({ x, y, z: 0 });
      }
    }
    result.push(points[points.length - 1]);
    return result;
  }

  private computeVelocityWidths(points: StrokePoint[], baseWidth: number): number[] {
    const widths: number[] = [];
    const maxWidth = baseWidth * 0.008;
    const minWidth = maxWidth * 0.3;

    for (let i = 0; i < points.length; i++) {
      if (i === 0 || i === points.length - 1) {
        widths.push(maxWidth * 0.6);
        continue;
      }
      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      const speed = Math.sqrt(dx * dx + dy * dy);
      const width = maxWidth - speed * 3;
      widths.push(Math.max(minWidth, Math.min(maxWidth, width)));
    }

    for (let i = 1; i < widths.length - 1; i++) {
      widths[i] = (widths[i - 1] + widths[i] + widths[i + 1]) / 3;
    }

    return widths;
  }

  private buildCircularGeometry(points: StrokePoint[], widths: number[], colorHex: string): THREE.BufferGeometry {
    const SEGMENTS = 8;
    if (points.length < 2) return this.acquireGeometry();

    const color = new THREE.Color(colorHex);
    const count = points.length;
    const vertCount = count * SEGMENTS;
    const idxCount = (count - 1) * SEGMENTS * 6;

    const positions = new Float32Array(vertCount * 3);
    const vertColors = new Float32Array(vertCount * 3);
    const indices = vertCount > 65535 ? new Uint32Array(idxCount) : new Uint16Array(idxCount);

    let ii = 0;
    const r = color.r, g = color.g, b = color.b;

    for (let i = 0; i < count; i++) {
      const p = points[i];
      const w = widths[i];

      for (let j = 0; j < SEGMENTS; j++) {
        const angle = (j / SEGMENTS) * Math.PI * 2;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        const base = (i * SEGMENTS + j) * 3;
        positions[base] = p.x + cos * w;
        positions[base + 1] = p.y + sin * w;
        positions[base + 2] = p.z;
        vertColors[base] = r;
        vertColors[base + 1] = g;
        vertColors[base + 2] = b;

        if (i < count - 1) {
          const curr = i * SEGMENTS + j;
          const next = i * SEGMENTS + (j + 1) % SEGMENTS;
          const nextRing = (i + 1) * SEGMENTS + j;
          const nextRingNext = (i + 1) * SEGMENTS + (j + 1) % SEGMENTS;

          indices[ii++] = curr;
          indices[ii++] = nextRing;
          indices[ii++] = next;
          indices[ii++] = next;
          indices[ii++] = nextRing;
          indices[ii++] = nextRingNext;
        }
      }
    }

    const geo = this.acquireGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(vertColors, 3));
    geo.setIndex(new THREE.BufferAttribute(indices, 1));
    return geo;
  }

  destroy(): void {
    this.clear();
    this.material.dispose();
    this.glowMaterial.dispose();
    this.scene.remove(this.strokeGroup);
    this.scene.remove(this.glowGroup);
    this.geometryPool = [];
  }
}
