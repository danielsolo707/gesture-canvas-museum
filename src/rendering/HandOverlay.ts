import * as THREE from 'three';
import { HandSnapshot } from '../core/types';
import { LANDMARK_INDICES as L, NUM_LANDMARKS } from '../core/types';
import { Z_LAYERS } from '../core/constants';

interface HexagonDef {
  vertices: number[];
  color: THREE.Color;
}

const HEX_AB: HexagonDef = {
  vertices: [L.INDEX_MCP, L.INDEX_PIP, L.INDEX_TIP, L.MIDDLE_TIP, L.MIDDLE_PIP, L.MIDDLE_MCP],
  color: new THREE.Color(0x4dabf7),
};

const HEX_BC: HexagonDef = {
  vertices: [L.MIDDLE_MCP, L.MIDDLE_PIP, L.MIDDLE_TIP, L.RING_TIP, L.RING_PIP, L.RING_MCP],
  color: new THREE.Color(0x40c057),
};

const HEX_CD: HexagonDef = {
  vertices: [L.RING_MCP, L.RING_PIP, L.RING_TIP, L.PINKY_TIP, L.PINKY_PIP, L.PINKY_MCP],
  color: new THREE.Color(0xbe4bdb),
};

const HEX_PALM: HexagonDef = {
  vertices: [L.WRIST, L.THUMB_MCP, L.INDEX_MCP, L.MIDDLE_MCP, L.RING_MCP, L.PINKY_MCP],
  color: new THREE.Color(0xf7a84d),
};

const ALL_HEXAGONS: HexagonDef[] = [HEX_PALM, HEX_AB, HEX_BC, HEX_CD];

function computeTriangles(hex: HexagonDef): number[] {
  const v = hex.vertices;
  const tris: number[] = [];
  for (let i = 1; i < v.length - 1; i++) {
    tris.push(v[0], v[i], v[i + 1]);
  }
  return tris;
}

function computeEdges(hex: HexagonDef): number[] {
  const v = hex.vertices;
  const edges: number[] = [];
  for (let i = 0; i < v.length; i++) {
    edges.push(v[i], v[(i + 1) % v.length]);
  }
  return edges;
}

const TRIANGLES_PER_HEX = 4;
const VERTICES_PER_TRI = 3;
const EDGES_PER_HEX = 6;
const VERTS_PER_EDGE = 2;

export class HandOverlay {
  private group: THREE.Group;
  private jointMeshes: THREE.InstancedMesh | null = null;
  private fillMesh: THREE.Mesh | null = null;
  private outlineSegments: THREE.LineSegments | null = null;
  private dummy = new THREE.Object3D();
  private jointCount = NUM_LANDMARKS;
  private visible = true;
  private activeHands: HandSnapshot[] = [];
  private readonly MAX_HANDS = 2;

  private leftColor = new THREE.Color(0x4dabf7);
  private rightColor = new THREE.Color(0xf7a84d);

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.group.renderOrder = Z_LAYERS.HAND_OVERLAY;
    scene.add(this.group);
    this.createMeshes();
  }

  private createMeshes(): void {
    const sphereGeo = new THREE.SphereGeometry(0.012, 8, 8);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.8,
    });
    const totalJoints = this.jointCount * this.MAX_HANDS;
    this.jointMeshes = new THREE.InstancedMesh(sphereGeo, mat, totalJoints);
    (this.jointMeshes as any).count = 0;
    this.jointMeshes.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(totalJoints * 3), 3,
    );
    this.group.add(this.jointMeshes);

    const hexCount = ALL_HEXAGONS.length;
    const triPerHand = hexCount * TRIANGLES_PER_HEX * VERTICES_PER_TRI;
    const totalTris = triPerHand * this.MAX_HANDS;

    const fillGeo = new THREE.BufferGeometry();
    const fillPos = new Float32Array(totalTris * 3);
    const fillCol = new Float32Array(totalTris * 3);
    fillGeo.setAttribute('position', new THREE.BufferAttribute(fillPos, 3));
    fillGeo.setAttribute('color', new THREE.BufferAttribute(fillCol, 3));
    const fillMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.fillMesh = new THREE.Mesh(fillGeo, fillMat);
    this.fillMesh.frustumCulled = false;
    this.group.add(this.fillMesh);

    const edgePerHand = hexCount * EDGES_PER_HEX * VERTS_PER_EDGE;
    const totalEdges = edgePerHand * this.MAX_HANDS;

    const edgeGeo = new THREE.BufferGeometry();
    const edgePos = new Float32Array(totalEdges * 3);
    const edgeCol = new Float32Array(totalEdges * 3);
    edgeGeo.setAttribute('position', new THREE.BufferAttribute(edgePos, 3));
    edgeGeo.setAttribute('color', new THREE.BufferAttribute(edgeCol, 3));
    const edgeMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      linewidth: 2,
    });
    this.outlineSegments = new THREE.LineSegments(edgeGeo, edgeMat);
    this.outlineSegments.frustumCulled = false;
    this.group.add(this.outlineSegments);
  }

  setHands(hands: HandSnapshot[]): void {
    this.activeHands = hands;
  }

  update(_now: number): void {
    if (!this.jointMeshes || !this.fillMesh || !this.outlineSegments) return;
    const aspect = window.innerWidth / window.innerHeight;

    const jm = this.jointMeshes;
    const colorArr = jm.instanceColor!.array as Float32Array;
    let meshIndex = 0;

    const fillPos = (this.fillMesh.geometry.attributes.position.array as Float32Array);
    const fillCol = (this.fillMesh.geometry.attributes.color.array as Float32Array);
    let fillIdx = 0;

    const edgePos = (this.outlineSegments.geometry.attributes.position.array as Float32Array);
    const edgeCol = (this.outlineSegments.geometry.attributes.color.array as Float32Array);
    let edgeIdx = 0;

    for (const hand of this.activeHands) {
      const lms = hand.landmarks;
      const isLeft = hand.handedness === 'Left';
      const handColor = isLeft ? this.leftColor : this.rightColor;

      for (let i = 0; i < NUM_LANDMARKS; i++) {
        const x = (lms[i * 3] - 0.5) * 2 * aspect;
        const y = -(lms[i * 3 + 1] - 0.5) * 2;
        const z = Math.max(-0.5, Math.min(0.5, lms[i * 3 + 2] * 0.1));
        this.dummy.position.set(x, y, z);
        this.dummy.updateMatrix();
        if (meshIndex < this.jointCount * this.MAX_HANDS) {
          jm.setMatrixAt(meshIndex, this.dummy.matrix);
          colorArr[meshIndex * 3] = handColor.r;
          colorArr[meshIndex * 3 + 1] = handColor.g;
          colorArr[meshIndex * 3 + 2] = handColor.b;
        }
        meshIndex++;
      }

      for (const hex of ALL_HEXAGONS) {
        const tris = computeTriangles(hex);
        for (const lmIdx of tris) {
          if (fillIdx + 2 < fillPos.length) {
            fillPos[fillIdx] = (lms[lmIdx * 3] - 0.5) * 2 * aspect;
            fillPos[fillIdx + 1] = -(lms[lmIdx * 3 + 1] - 0.5) * 2;
            fillPos[fillIdx + 2] = Math.max(-0.5, Math.min(0.5, lms[lmIdx * 3 + 2] * 0.1));
            fillCol[fillIdx] = hex.color.r * handColor.r * 1.2;
            fillCol[fillIdx + 1] = hex.color.g * handColor.g * 1.2;
            fillCol[fillIdx + 2] = hex.color.b * handColor.b * 1.2;
          }
          fillIdx += 3;
        }

        const edges = computeEdges(hex);
        for (const lmIdx of edges) {
          if (edgeIdx + 2 < edgePos.length) {
            edgePos[edgeIdx] = (lms[lmIdx * 3] - 0.5) * 2 * aspect;
            edgePos[edgeIdx + 1] = -(lms[lmIdx * 3 + 1] - 0.5) * 2;
            edgePos[edgeIdx + 2] = Math.max(-0.5, Math.min(0.5, lms[lmIdx * 3 + 2] * 0.1));
            edgeCol[edgeIdx] = handColor.r * 0.9;
            edgeCol[edgeIdx + 1] = handColor.g * 0.9;
            edgeCol[edgeIdx + 2] = handColor.b * 0.9;
          }
          edgeIdx += 3;
        }
      }
    }

    (jm as any).count = Math.min(meshIndex, this.jointCount * this.MAX_HANDS);
    jm.instanceMatrix.needsUpdate = true;
    jm.instanceColor!.needsUpdate = true;

    this.fillMesh.geometry.setDrawRange(0, fillIdx / 3);
    this.fillMesh.geometry.attributes.position.needsUpdate = true;
    this.fillMesh.geometry.attributes.color.needsUpdate = true;

    this.outlineSegments.geometry.setDrawRange(0, edgeIdx / 3);
    this.outlineSegments.geometry.attributes.position.needsUpdate = true;
    this.outlineSegments.geometry.attributes.color.needsUpdate = true;
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
    if (this.fillMesh) {
      this.fillMesh.geometry.dispose();
      (this.fillMesh.material as THREE.Material).dispose();
    }
    if (this.outlineSegments) {
      this.outlineSegments.geometry.dispose();
      (this.outlineSegments.material as THREE.Material).dispose();
    }
    this.group.parent?.remove(this.group);
  }
}
