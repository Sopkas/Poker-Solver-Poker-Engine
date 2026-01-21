/**
 * A Linear Congruential Generator (LCG) for deterministic pseudo-random number generation.
 * Uses the Park-Miller parameters.
 * This is a pure, serializable implementation.
 */

export interface PRNGState {
    seed: number;
    state: number;
}

const M = 0x80000000; // 2^31
const A = 1103515245;
const C = 12345;

/**
 * Creates an initial PRNG state from a seed.
 */
export const createPRNG = (seed: number): PRNGState => ({
    seed,
    state: seed > 0 ? seed : 1, // Avoid 0 state
});

/**
 * Advances the PRNG state and returns the next random number (0-1 float) along with the new state.
 * This is a pure function.
 */
export const nextRandom = (prngState: PRNGState): { value: number; nextState: PRNGState } => {
    const newState = (A * prngState.state + C) % M;
    return {
        value: newState / (M - 1),
        nextState: { ...prngState, state: newState },
    };
};

/**
 * Generates a random integer in the range [0, max).
 * This is a pure function.
 */
export const randomInt = (prngState: PRNGState, max: number): { value: number; nextState: PRNGState } => {
    const { value, nextState } = nextRandom(prngState);
    return { value: Math.floor(value * max), nextState };
};
