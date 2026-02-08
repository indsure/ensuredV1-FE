# UI Component Specification

## 1. ScoreCard
**Purpose**: Display the final audit score and verdict.
**Props**:
```typescript
interface ScoreCardProps {
  score: number; // 0-100
  verdict: "SAFE" | "BORDERLINE" | "RISKY";
  isLoading: boolean;
}
```
**Motion Rules**: 
- Score counter may animate on load (0 -> final).
- **NEVER** animate the verdict label (Concept of "Final Judgment").

## 2. RiskTable
**Purpose**: Display risk analysis items (Room Rent, Co-pay, etc.).
**Props**:
```typescript
interface RiskTableProps {
  items: Array<{
    category: string;
    risk_level: "low" | "medium" | "high" | "critical";
    value: string;
    clause_ref: ClauseReference;
  }>;
}
```
**States**:
- Empty: "No Risks Identified" (Grey state).
- Error: "Analysis Failed".

## 3. ClauseViewer
**Purpose**: display the specific text snippet from policy wordings.
**Props**:
```typescript
interface ClauseViewerProps {
  clauseId: string;
  text: string;
  page: number;
  highlighted: boolean;
}
```

## 4. PenaltyBreakdown
**Purpose**: Detailed ledger of score deductions.
**Props**:
```typescript
interface PenaltyBreakdownProps {
  entries: Array<{
    reason: string;
    points: number; // Negative integer
    clause_ref: ClauseReference;
  }>;
}
```

## 5. DataQualityBanner
**Purpose**: Warn about missing wordings or low confidence.
**Props**:
```typescript
interface DataQualityBannerProps {
  quality: "high" | "medium" | "low";
  missing_sources: string[];
}
```
**Logic**: Must appear if quality != "high".
