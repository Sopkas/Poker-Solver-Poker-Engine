# Poker Solver v2.0

A GTO (Game Theory Optimal) poker solver for No-Limit Texas Hold'em with a complete game engine, hand evaluation, and game tree building capabilities.

## Features

### Core Engine (Rust + WASM) ⚡
- **High-Performance Solver**: Core logic migrated to Rust and compiled to WebAssembly for near-native speed.
- **Complete NLHE Implementation**: Full game loop with all betting streets (Preflop, Flop, Turn, River, Showdown).
- **Strict Rules Validation**: Legal action validation (Check, Call, Bet, Raise, Fold, All-In).
- **Hand Evaluator**: Optimized 7-card hand evaluation.
- **Immutable State**: Functional architecture enabling Undo/Redo and replay.

### GTO Solver
- **CFR+ Engine**: Advanced Counterfactual Regret Minimization for Nash Equilibrium approximation.
- **Heads-Up River Solver**: Specialized solver for river subgames.
- **Standard GTO Ranges**: Built-in asymmetric ranges (OOP Capped vs IP Polarized) for realistic simulation.
- **Strategy Visualization**: Heatmaps and range visualization.

### UI / Visualization
- **Interactive Poker Table**: 6-max table with real-time state visualization.
- **Analysis Studio**: Professional split-view layout for deep game analysis.
- **Scenario Builder (God Mode)**: Create custom scenarios, edit stacks, cards, and board state on the fly.
- **Replay System**: Step through hand history with VCR-style controls.
- **Range Matrix**: 13x13 hand matrix for range analysis.

## Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
- **Core Logic**: [Rust](https://www.rust-lang.org/) (compiled to WASM)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **UI**: [React 19](https://react.dev/) + [Tailwind CSS 4](https://tailwindcss.com/)
- **Testing**: [Jest](https://jestjs.io/)
- **Architecture**: Immutable State Pattern + Web Workers

## Project Structure

```
src/
├── core/            # TypeScript Game Engine (Rules, State)
├── core-rs/         # Rust Solver Core (WASM source)
├── ui/              # React Components & Hooks
├── utils/           # Helper functions (including standardRanges.ts)
├── workers/         # Web Workers for Solver
└── public/wasm/     # Compiled WASM binaries
```

## Getting Started

### Prerequisites
- Node.js 18+
- Rust (cargo) - *Optional, only if modifying core-rs*
- wasm-pack - *Optional, only if modifying core-rs*

### Installation

```bash
npm install
```

### Development

1. **Run the App**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000)

2. **Build WASM (if modifying Rust core)**:
   ```bash
   npm run build:wasm
   ```

### Testing

```bash
npm test
```

## Roadmap

- [x] Core poker engine
- [x] Hand evaluation
- [x] Side pots
- [x] Replay system
- [x] Game Tree Builder
- [x] CFR Solver (Rust/WASM)
- [x] Standard GTO Ranges (OOP Capped / IP Polarized)
- [x] Scenario Builder
- [x]  Range vs Range analysis
- [x]  Equity calculator
- [x]  Export/Import hand histories

## License

MIT
