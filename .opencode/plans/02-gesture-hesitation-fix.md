# Gesture Hesitation & Confusion Fix

## Root Cause: Double-damped confidence kills gesture activation

4 cascading issues, all in `src/model/GestureClassifier.ts`:

---

### Fix 1: Remove double-damping from heuristicConfidence (line 150)

**Current:**
```typescript
heuristicConfidence = rawConf * (0.5 + 0.5 * edgeDamping) * (0.5 + 0.5 * smoothedConfidence);
```

**Problem:** Multiplies by TWO dampers. `rawConf=0.7` → `0.7 × 0.8 × 0.75 = 0.42` — drops below 0.5 state machine threshold.

**Fix:**
```typescript
heuristicConfidence = rawConf * (0.5 + 0.5 * edgeDamping);
```

The `smoothedConfidence` factor is removed. Edge damping alone is sufficient (it only activates near viewport edges). The smoothed confidence is already used in the confidence gate above.

---

### Fix 2: Lower state machine confidence threshold (line 268)

**Current:**
```typescript
if (confidence >= 0.5) {
```

**Problem:** After edge damping, confidence can be ~0.35-0.42. The state machine rejects these as "not confident enough" and goes to deactivation branch.

**Fix:**
```typescript
if (confidence >= 0.35) {
```

This matches the `baseConfidenceThreshold: 0.35` in `ADAPTIVE.BASE_CONFIDENCE_THRESHOLD` constant.

---

### Fix 3: Remove extraFrames from deactivation (line 266)

**Current:**
```typescript
const effectiveDeactivate = GESTURE.DEACTIVATE_FRAMES + (extraFrames > 0 ? 1 : 0);
```

**Problem:** edge/integrity penalties slow down BOTH entering and leaving a gesture. Penalties should only make it HARDER to enter a new gesture (activation), not harder to stay.

**Fix:**
```typescript
const effectiveDeactivate = GESTURE.DEACTIVATE_FRAMES;
```

---

### Fix 4: Lower confidence gate threshold (line 138 + CONSTANTS)

**Current:**
```typescript
const effectiveConfidence = smoothedConfidence * (0.3 + 0.7 * gestureSpecificScore);
const confidenceGate = effectiveConfidence >= CONFIDENCE.GATE_THRESHOLD; // 0.30
```

**Problem:** `gestureSpecificScore` returns 0.5 with just 1 finger visible. `smoothedConfidence` is often ~0.5-0.6. So `effectiveConfidence = 0.6 × (0.3 + 0.7 × 0.5) = 0.6 × 0.65 = 0.39`. With 0.30 threshold it barely passes. This means partial hand visibility blocks all gesture detection.

**Fix in `src/core/constants.ts`:**
```typescript
GATE_THRESHOLD: 0.30  →  GATE_THRESHOLD: 0.20
```

---

### Fix 5: Extra — also smooth the gate computation

**Add** a minimum gestureSpecificScore:
```typescript
const gestureSpecificScore = Math.max(0.3, this.getBestGestureScore(...));
```

This guarantees at least 0.3 even when almost no fingers visible, so the gate doesn't oscillate wildly.

---

## Summary of changes

| File | Line | Change |
|------|------|--------|
| `src/model/GestureClassifier.ts` | 150 | Remove `* (0.5 + 0.5 * smoothedConfidence)` |
| `src/model/GestureClassifier.ts` | 268 | `0.5` → `0.35` |
| `src/model/GestureClassifier.ts` | 266 | Remove `+ (extraFrames > 0 ? 1 : 0)` |
| `src/model/GestureClassifier.ts` | 132-135 | Wrap `getBestGestureScore()` with `Math.max(0.3, ...)` |
| `src/core/constants.ts` | (CONFIDENCE block) | `GATE_THRESHOLD: 0.30` → `0.20` |
