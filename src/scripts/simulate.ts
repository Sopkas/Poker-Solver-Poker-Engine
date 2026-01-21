import { createInitialState, getTotalChips, checkCardUniqueness } from '../core/state';
import { getLegalActions, validateAction, resolveSidePots } from '../core/rules';
import { ConsistencyAudit } from '../core/audit';
import { HandConfig, ActionType, TableConfig } from '../core/types';

const TABLE_CONFIG: TableConfig = {
    maxSeats: 6,
    smallBlind: 5,
    bigBlind: 10,
    ante: 0,
};

const CONFIG: HandConfig = {
    id: 'sim-1',
    players: [
        { id: 'P1', name: 'Player 1', stack: 1000, seat: 0 },
        { id: 'P2', name: 'Player 2', stack: 1000, seat: 1 },
        { id: 'P3', name: 'Player 3', stack: 1000, seat: 2 },
        { id: 'P4', name: 'Player 4', stack: 1000, seat: 3 },
        { id: 'P5', name: 'Player 5', stack: 1000, seat: 4 },
        { id: 'P6', name: 'Player 6', stack: 1000, seat: 5 }
    ],
    tableConfig: TABLE_CONFIG,
    dealerSeat: 0,
    seed: Date.now(),
};

function runSimulation() {
    console.log("Starting simulation...");

    try {
        const state = createInitialState(CONFIG);
        console.log("Initial state created successfully.");

        // Check invariants
        const cardErrors = checkCardUniqueness(state);
        if (cardErrors.length > 0) {
            console.error("Card uniqueness errors:", cardErrors);
            process.exit(1);
        }

        const auditErrors = ConsistencyAudit.checkInvariants(state);
        if (auditErrors.length > 0) {
            console.error("Audit errors:", auditErrors);
            process.exit(1);
        }

        console.log("Total chips in play:", getTotalChips(state));
        console.log("Legal actions:", getLegalActions(state));
        console.log("Simulation completed successfully.");
    } catch (e: any) {
        console.error("Simulation failed:", e.message);
        process.exit(1);
    }
}

runSimulation();
