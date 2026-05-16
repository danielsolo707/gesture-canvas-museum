import * as THREE from 'three';
import { HandSnapshot } from '../core/types';
import { LANDMARK_INDICES as L, NUM_LANDMARKS } from '../core/types';
import { RENDER, Z_LAYERS } from '../core/constants';

const HAND_CONNECTIONS: [number, number][] = [
  [L.WRIST, L.THUMB_CMC], [L.THUMB_CMC, L.THUMB_MCP], [L.THUMB_MCP, L.THUMB_IP], [L.THUMB_IP, L.THUMB_TIP],
  [L.WRIST, L.INDEX_MCP], [L.INDEX_MCP, L.INDEX_PIP], [L.INDEX_PIP, L.INDEX_DIP], [L.INDEX_DIP, L.INDEX_TIP],
  [L.WRIST, L.MIDDLE_MCP], [L.MIDDLE_MCP, L.MIDDLE_PIP], [L.MIDDLE_PIP, L.MIDDLE_DIP], [L.MIDDLE_DIP, L.MIDDLE_TIP],
  [L.WRIST, L.RING_MCP], [L.RING_MCP, L.RING_PIP], [L.RING_PIP, L.RING_DIP], [L.RING_DIP, L.RING_TIP],
  [L.WRIST, L.PINKY_MCP], [L.PINKY_MCP, L.PINKY_PIP], [L.PINKY_PIP, L.PINKY_DIP], [L.PINKY_DIP, L.PINKY_TIP],
  [L.INDEX_MCP, L.MIDDLE_MCP], [L.MIDDLE_MCP, L.RING_MCP], [L.RING_MCP, L.PINKY_MCP],
];

export class HandOverlay {
  private group: THREE.Group;
  private jointMeshes: THREE.InstancedMesh | null = null;
  private lineSegments: THREE.LineSegments | null = null;
  private dummy = new THREE.Object3D();
  private color = new THREE.Color(0x4dabf7);
  private jointCount = NUM_LANDMARKS;
  private visible = true;
  private activeHands: HandSnapshot[] = [];

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.group.renderOrder = Z_LAYERS.HAND_OVERLAY;
    scene.add(this.group);
    this.createMeshes();
  }

  private createMeshes(): void {
    const sphereGeo = new THREE.SphereGeometry(0.008, 8, 8);
    const mat = new THREE.MeshBasicMaterial({
      color: this.color,
      transparent: true,
      opacity: RENDER.HAND_OVERLAY_OPACITY,
    });
    this.jointMeshes = new THREE.InstancedMesh(sphereGeo, mat, this.jointCount * 2);
    this.jointMeshes.count = 0;
    this.group.add(this.jointMeshes);

    const lineGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(HAND_CONNECTIONS.length * 2 * 3);
    lineGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const lineMat = new THREE.LineBasicMaterial({
      color: this.color,
      transparent: true,
      opacity: RENDER.HAND_OVERLAY_OPACITY * 0.6,
    });
    this.lineSegments = new THREE.LineSegments(lineGeo, lineMat);
    this.lineSegments.frustumCulled = false;
    this.group.add(this.lineSegments);
  }

  setHands(hands: HandSnapshot[]): void {
    this.activeHands = hands;
  }

  update(now: number): void {
    if (!this.jointMeshes || !this.lineSegments) return;

    let meshIndex = 0;

    for (const hand of this.activeHands) {
      const lms = hand.landmarks;
      for (let i = 0; i < NUM_LANDMARKS; i++) {
        const x = (lms[i * 3] - 0.5) * 2;
        const y = -(lms[i * 3 + 1] - 0.5) * 2;
        const z = lms[i * 3 + 2] * 0.1;
        this.dummy.position.set(x, y, z);
        this.dummy.updateMatrix();
        if (meshIndex < this.jointCount * 2) {
          this.jointMeshes.setMatrixAt(meshIndex, this.dummy.matrix);
        }
        meshIndex++;
      }
    }

    this.jointMeshes.count = Math.min(meshIndex, this.jointCount * 2);
    this.jointMeshes.instanceMatrix.needsUpdate = true;

    const posAttr = this.lineSegments.geometry.attributes.position;
    const pos = posAttr.array as Float32Array;
    let lineIdx = 0;
    for (const hand of this.activeHands) {
      const lms = hand.landmarks;
      for (const [i, j] of HAND_CONNECTIONS) {
        if (lineIdx + 5 < pos.length) {
          pos[lineIdx] = (lms[i * 3] - 0.5) * 2;
          pos[lineIdx + 1] = -(lms[i * 3 + 1] - 0.5) * 2;
          pos[lineIdx + 2] = lms[i * 3 + 2] * 0.1;
          pos[lineIdx + 3] = (lms[j * 3] - 0.5) * 2;
          pos[lineIdx + 4] = -(lms[j * 3 + 1] - 0.5) * 2;
          pos[lineIdx + 5] = lms[j * 3 + 2] * 0.1;
          lineIdx += 6;
        }
      }
    }
    posAttr.needsUpdate = true;
  }

  setVisible(v: boolean): void {
    this.visible = v;
    this.group.visible = v;
  }

  destroy(): void {
    if (this.jointMeshes) {
      this.jointMeshes.geometry.dispose();
      (this.jointMeshes.material as THREE.Material).dispose();
    }
    if (this.lineSegments) {
      this.lineSegments.geometry.dispose();
      (this.lineSegments.material as THREE.Material).dispose();
    }
    this.group.parent?.remove(this.group);
  }
}
