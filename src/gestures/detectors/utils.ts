import { GESTURE } from '../../core/constants';

export function getLandmark(landmarks: Float32Array, index: number): [number, number, number] {
  const i = index * 3;
  return [landmarks[i], landmarks[i + 1], landmarks[i + 2]];
}

export function distance3D(
  x1: number, y1: number, z1: number,
  x2: number, y2: number, z2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dz = z2 - z1;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function distance2D(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

export function getHandScale(landmarks: Float32Array): number {
  const wrist = getLandmark(landmarks, 0);
  const middleMcp = getLandmark(landmarks, 9);
  const d = distance3D(wrist[0], wrist[1], wrist[2], middleMcp[0], middleMcp[1], middleMcp[2]);
  return Math.max(d, 0.05);
}

export function isFingerExtended(
  tip: [number, number, number],
  pip: [number, number, number],
  mcp: [number, number, number],
  margin: number = GESTURE.FINGER_EXTENSION_THRESHOLD,
): boolean {
  const tipDist = distance3D(tip[0], tip[1], tip[2], mcp[0], mcp[1], mcp[2]);
  const pipDist = distance3D(pip[0], pip[1], pip[2], mcp[0], mcp[1], mcp[2]);
  return tipDist > pipDist + margin;
}

export function isThumbExtended(landmarks: Float32Array): boolean {
  const tip = getLandmark(landmarks, 4);
  const ip = getLandmark(landmarks, 3);
  const mcp = getLandmark(landmarks, 2);
  return isFingerExtended(tip, ip, mcp, GESTURE.THUMB_EXTENSION_THRESHOLD);
}

// ─── TRIANGLE / HEXAGON AREA UTILITIES ───

function sub(a: [number, number, number], b: [number, number, number]): [number, number, number] {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross(a: [number, number, number], b: [number, number, number]): [number, number, number] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function mag(v: [number, number, number]): number {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}

function dot(a: [number, number, number], b: [number, number, number]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function triangleArea3D(
  a: [number, number, number],
  b: [number, number, number],
  c: [number, number, number],
): number {
  return 0.5 * mag(cross(sub(b, a), sub(c, a)));
}

export function polygonArea3D(vertices: [number, number, number][]): number {
  if (vertices.length < 3) return 0;
  let area = 0;
  const a = vertices[0];
  for (let i = 1; i < vertices.length - 1; i++) {
    area += triangleArea3D(a, vertices[i], vertices[i + 1]);
  }
  return area;
}

// ─── FINGER ANGLE (rotation-invariant extension metric) ───

export function fingerBendAngle(
  mcp: [number, number, number],
  pip: [number, number, number],
  tip: [number, number, number],
): number {
  const v1 = sub(pip, mcp);
  const v2 = sub(tip, mcp);
  const m1 = mag(v1);
  const m2 = mag(v2);
  if (m1 < 1e-9 || m2 < 1e-9) return 0;
  const cosAngle = Math.max(-1, Math.min(1, dot(v1, v2) / (m1 * m2)));
  return Math.acos(cosAngle);
}

export function fingerExtensionScore(angle: number): number {
  return Math.max(0, Math.min(1, 1 - angle / 0.55));
}

// ─── HAND SHAPE METRICS ───

export interface HandShapeMetrics {
  fingerAngles: { thumb: number; index: number; middle: number; ring: number; pinky: number };
  extensionScores: { thumb: number; index: number; middle: number; ring: number; pinky: number };
  hexAreas: { ab: number; bc: number; cd: number };
  hexAsymmetry: { ab: number; bc: number; cd: number };
  scale: number;
}

export function computeHandShape(landmarks: Float32Array): HandShapeMetrics {
  const W = getLandmark(landmarks, 0);
  const T_MCP = getLandmark(landmarks, 2);
  const T_IP = getLandmark(landmarks, 3);
  const T_TIP = getLandmark(landmarks, 4);
  const I_MCP = getLandmark(landmarks, 5);
  const I_PIP = getLandmark(landmarks, 6);
  const I_TIP = getLandmark(landmarks, 8);
  const M_MCP = getLandmark(landmarks, 9);
  const M_PIP = getLandmark(landmarks, 10);
  const M_TIP = getLandmark(landmarks, 12);
  const R_MCP = getLandmark(landmarks, 13);
  const R_PIP = getLandmark(landmarks, 14);
  const R_TIP = getLandmark(landmarks, 16);
  const P_MCP = getLandmark(landmarks, 17);
  const P_PIP = getLandmark(landmarks, 18);
  const P_TIP = getLandmark(landmarks, 20);

  const scale = Math.max(getHandScale(landmarks), 0.05);
  const scaleSq = scale * scale;

  const fingerAngles = {
    thumb: fingerBendAngle(T_MCP, T_IP, T_TIP),
    index: fingerBendAngle(I_MCP, I_PIP, I_TIP),
    middle: fingerBendAngle(M_MCP, M_PIP, M_TIP),
    ring: fingerBendAngle(R_MCP, R_PIP, R_TIP),
    pinky: fingerBendAngle(P_MCP, P_PIP, P_TIP),
  };

  const extensionScores = {
    thumb: fingerExtensionScore(fingerAngles.thumb),
    index: fingerExtensionScore(fingerAngles.index),
    middle: fingerExtensionScore(fingerAngles.middle),
    ring: fingerExtensionScore(fingerAngles.ring),
    pinky: fingerExtensionScore(fingerAngles.pinky),
  };

  const hexAB = polygonArea3D([I_MCP, I_PIP, I_TIP, M_TIP, M_PIP, M_MCP]) / scaleSq;
  const hexBC = polygonArea3D([M_MCP, M_PIP, M_TIP, R_TIP, R_PIP, R_MCP]) / scaleSq;
  const hexCD = polygonArea3D([R_MCP, R_PIP, R_TIP, P_TIP, P_PIP, P_MCP]) / scaleSq;

  const triAB_left = triangleArea3D(I_MCP, I_PIP, I_TIP);
  const triAB_right = triangleArea3D(M_MCP, M_PIP, M_TIP);
  const triBC_left = triangleArea3D(M_MCP, M_PIP, M_TIP);
  const triBC_right = triangleArea3D(R_MCP, R_PIP, R_TIP);
  const triCD_left = triangleArea3D(R_MCP, R_PIP, R_TIP);
  const triCD_right = triangleArea3D(P_MCP, P_PIP, P_TIP);

  const asymAB = triAB_right > 0.0001 ? triAB_left / triAB_right : (triAB_left > 0.0001 ? 10 : 1);
  const asymBC = triBC_right > 0.0001 ? triBC_left / triBC_right : (triBC_left > 0.0001 ? 10 : 1);
  const asymCD = triCD_right > 0.0001 ? triCD_left / triCD_right : (triCD_left > 0.0001 ? 10 : 1);

  return {
    fingerAngles,
    extensionScores,
    hexAreas: { ab: hexAB, bc: hexBC, cd: hexCD },
    hexAsymmetry: { ab: asymAB, bc: asymBC, cd: asymCD },
    scale,
  };
}
