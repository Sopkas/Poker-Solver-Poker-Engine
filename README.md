# Poker Solver

A GTO (Game Theory Optimal) poker solver for No-Limit Texas Hold'em with a complete game engine, hand evaluation, and game tree building capabilities.

## Features

### Core Engine
- **Complete NLHE Implementation**: Full game loop with all betting streets (Preflop, Flop, Turn, River, Showdown)
- **Strict Rules Validation**: Legal action validation (Check, Call, Bet, Raise, Fold, All-In)
- **Hand Evaluator**: High-performance 7-card hand evaluation with kicker support
- **Side Pots**: Correct multi-way pot calculation and distribution
- **Immutable State**: Functional architecture enabling Undo/Redo and replay

### Game Tree Builder
- **Recursive Tree Generation**: Builds complete game trees from any game state
- **Configurable Bet Sizing**: Customizable bet sizes per street (e.g., 33%, 50%, 75%, 100% pot)
- **Raise Limits**: Prevents infinite loops with configurable max raises per street
- **Terminal Node Detection**: Identifies showdown and fold-out terminal states
- **State Hashing**: Unique node identification for tree traversal

### UI / Visualization
- **Interactive Poker Table**: 6-max table with real-time state visualization
- **Replay System**: Step through hand history with VCR-style controls
- **Range Matrix**: 13x13 hand matrix for range analysis
- **God Mode**: Auto-switch between players for testing scenarios

## Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **UI**: [React 19](https://react.dev/) + [Tailwind CSS 4](https://tailwindcss.com/)
- **Testing**: [Jest](https://jestjs.io/)
- **Architecture**: Immutable State Pattern

## Project Structure

```
src/
├── core/
│   ├── engine/      # Game state transitions
│   ├── rules/       # Action validation
│   ├── evaluator/   # Hand strength evaluation
│   ├── showdown/    # Winner determination & pot distribution
│   ├── solver/      # Game Tree Builder
│   │   ├── types.ts
│   │   ├── treeBuilder.ts
│   │   └── treeBuilder.test.ts
│   └── types.ts     # Core type definitions
├── ui/
│   ├── components/  # React components
│   ├── hooks/       # Custom hooks (usePokerEngine)
│   └── layouts/     # Layout components
├── contexts/        # React contexts
└── utils/           # Helper functions
```

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Testing

```bash
npm test
```

## Game Tree Builder Usage

```typescript
import { buildTree } from '@/core/solver/treeBuilder';

const config = {
  betSizes: {
    flop: [0.33, 0.5, 0.75, 1.0],
    turn: [0.5, 0.75, 1.0],
    river: [0.5, 0.75, 1.0]
  },
  maxRaises: 3
};

const tree = buildTree(initialState, config);
```

## Roadmap

- [x] Core poker engine
- [x] Hand evaluation
- [x] Side pots
- [x] Replay system
- [x] Game Tree Builder
- [ ] CFR (Counterfactual Regret Minimization) solver
- [ ] Range vs Range analysis
- [ ] Equity calculator
- [ ] Export/Import hand histories

## License

MIT
