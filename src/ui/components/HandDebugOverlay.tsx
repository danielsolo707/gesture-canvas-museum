import { useStore } from '../../store/useStore';
import { LANDMARK_INDICES as L } from '../../core/types';

const CONNECTIONS: [number, number][] = [
  [L.WRIST, L.THUMB_CMC], [L.THUMB_CMC, L.THUMB_MCP], [L.THUMB_MCP, L.THUMB_IP], [L.THUMB_IP, L.THUMB_TIP],
  [L.WRIST, L.INDEX_MCP], [L.INDEX_MCP, L.INDEX_PIP], [L.INDEX_PIP, L.INDEX_DIP], [L.INDEX_DIP, L.INDEX_TIP],
  [L.WRIST, L.MIDDLE_MCP], [L.MIDDLE_MCP, L.MIDDLE_PIP], [L.MIDDLE_PIP, L.MIDDLE_DIP], [L.MIDDLE_DIP, L.MIDDLE_TIP],
  [L.WRIST, L.RING_MCP], [L.RING_MCP, L.RING_PIP], [L.RING_PIP, L.RING_DIP], [L.RING_DIP, L.RING_TIP],
  [L.WRIST, L.PINKY_MCP], [L.PINKY_MCP, L.PINKY_PIP], [L.PINKY_PIP, L.PINKY_DIP], [L.PINKY_DIP, L.PINKY_TIP],
  [L.INDEX_MCP, L.MIDDLE_MCP], [L.MIDDLE_MCP, L.RING_MCP], [L.RING_MCP, L.PINKY_MCP],
];

export function HandDebugOverlay() {
  const hands = useStore((s) => s.hands);
  const mode = useStore((s) => s.mode);

  if (mode !== 'camera') return null;

  return (
    <svg className="hand-debug-overlay" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
      {hands.map((hand, handIndex) => {
        const color = hand.handedness === 'Left' ? '#4dabf7' : '#ffa94d';
        return (
          <g key={`${hand.handedness}-${handIndex}`}>
            {CONNECTIONS.map(([from, to]) => (
              <line
                key={`${from}-${to}`}
                x1={hand.landmarks![from * 3]}
                y1={hand.landmarks![from * 3 + 1]}
                x2={hand.landmarks![to * 3]}
                y2={hand.landmarks![to * 3 + 1]}
                stroke={color}
                strokeWidth={0.006}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {Array.from({ length: 21 }, (_, i) => (
              <circle
                key={i}
                cx={hand.landmarks![i * 3]}
                cy={hand.landmarks![i * 3 + 1]}
                r={0.008}
                fill={color}
                stroke="#0a0a0f"
                strokeWidth={0.003}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
        );
      })}
    </svg>
  );
}
