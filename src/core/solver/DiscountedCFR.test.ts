import { DiscountedCFRTrainer, DEFAULT_DCFR_CONFIG } from './DiscountedCFR';

describe('DiscountedCFRTrainer', () => {
    describe('initialization', () => {
        it('should create trainer with correct dimensions', () => {
            const trainer = new DiscountedCFRTrainer(3, 10);

            expect(trainer.numActions).toBe(3);
            expect(trainer.numHands).toBe(10);
        });

        it('should use default config when not provided', () => {
            const trainer = new DiscountedCFRTrainer(2, 5);

            // Default config should be used
            expect(trainer.numActions).toBe(2);
        });

        it('should accept custom config', () => {
            const trainer = new DiscountedCFRTrainer(2, 5, {
                alpha: 2.0,
                beta: 0.3
            });

            expect(trainer.numActions).toBe(2);
        });
    });

    describe('getCurrentStrategy', () => {
        it('should return uniform strategy when no regrets', () => {
            const trainer = new DiscountedCFRTrainer(3, 2);
            const strategy = trainer.getCurrentStrategy();

            // For 3 actions, uniform = 1/3
            const uniform = 1 / 3;

            // Check all values are close to uniform
            for (let i = 0; i < strategy.length; i++) {
                expect(strategy[i]).toBeCloseTo(uniform, 5);
            }
        });

        it('should have correct length', () => {
            const trainer = new DiscountedCFRTrainer(3, 10);
            const strategy = trainer.getCurrentStrategy();

            expect(strategy.length).toBe(30); // 3 actions * 10 hands
        });
    });

    describe('getAverageStrategy', () => {
        it('should return uniform strategy when no updates', () => {
            const trainer = new DiscountedCFRTrainer(2, 5);
            const avgStrategy = trainer.getAverageStrategy();

            // Uniform strategy
            for (let i = 0; i < avgStrategy.length; i++) {
                expect(avgStrategy[i]).toBeCloseTo(0.5, 5);
            }
        });
    });

    describe('updateRegrets', () => {
        it('should update regrets without errors', () => {
            const trainer = new DiscountedCFRTrainer(2, 3);
            const regrets = new Float64Array(6); // 2 actions * 3 hands
            regrets[0] = 1.0;
            regrets[1] = -0.5;
            regrets[2] = 0.5;
            regrets[3] = -1.0;
            regrets[4] = 2.0;
            regrets[5] = 0.0;

            // Should not throw
            expect(() => trainer.updateRegrets(regrets, 1)).not.toThrow();
        });

        it('should change strategy after positive regret update', () => {
            const trainer = new DiscountedCFRTrainer(2, 1);

            // Initial uniform strategy
            const initialStrategy = trainer.getCurrentStrategy();
            expect(initialStrategy[0]).toBeCloseTo(0.5, 5);
            expect(initialStrategy[1]).toBeCloseTo(0.5, 5);

            // Add positive regret for action 0
            const regrets = new Float64Array([1.0, 0.0]);
            trainer.updateRegrets(regrets, 1);

            // After update, action 0 should have higher probability
            const updatedStrategy = trainer.getCurrentStrategy();
            expect(updatedStrategy[0]).toBeGreaterThan(0.5);
            expect(updatedStrategy[1]).toBeLessThan(0.5);
        });

        it('should properly discount regrets over iterations', () => {
            const trainer = new DiscountedCFRTrainer(2, 1);

            // Add regret
            const regrets = new Float64Array([1.0, 0.0]);
            trainer.updateRegrets(regrets, 1);
            const strategyAfter1 = trainer.getCurrentStrategy()[0];

            // Add more regret (accumulated)
            trainer.updateRegrets(regrets, 2);
            const strategyAfter2 = trainer.getCurrentStrategy()[0];

            // With discounting, both strategies should favor action 0
            // After multiple updates, action 0 should still be preferred
            expect(strategyAfter1).toBeGreaterThan(0.5);
            expect(strategyAfter2).toBeGreaterThan(0.5);

            // Both should be 1.0 since only action 0 has positive regrets
            expect(strategyAfter1).toBe(1);
            expect(strategyAfter2).toBe(1);
        });
    });

    describe('setEVs', () => {
        it('should set EVs', () => {
            const trainer = new DiscountedCFRTrainer(2, 3);
            const evs = new Float64Array([1.0, 2.0, 3.0, 4.0, 5.0, 6.0]);

            expect(() => trainer.setEVs(evs)).not.toThrow();

            const retrieved = trainer.getEVs();
            expect(retrieved.length).toBe(6);
        });

        it('should throw on size mismatch', () => {
            const trainer = new DiscountedCFRTrainer(2, 3);
            const evs = new Float64Array([1.0, 2.0]); // Wrong size

            expect(() => trainer.setEVs(evs)).toThrow();
        });
    });

    describe('copyFrom', () => {
        it('should copy strategy from another trainer', () => {
            const trainer1 = new DiscountedCFRTrainer(2, 2);
            const trainer2 = new DiscountedCFRTrainer(2, 2);

            // Update trainer1
            const regrets = new Float64Array([1.0, -0.5, 0.5, 0.0]);
            trainer1.updateRegrets(regrets, 1);

            // Strategies differ initially
            const s1Before = Array.from(trainer1.getCurrentStrategy());
            const s2Before = Array.from(trainer2.getCurrentStrategy());
            expect(s1Before[0]).not.toEqual(s2Before[0]);

            // Copy
            trainer2.copyFrom(trainer1);

            // Now they should match
            const s1After = Array.from(trainer1.getCurrentStrategy());
            const s2After = Array.from(trainer2.getCurrentStrategy());
            expect(s2After[0]).toBeCloseTo(s1After[0], 10);
        });

        it('should throw on dimension mismatch', () => {
            const trainer1 = new DiscountedCFRTrainer(2, 2);
            const trainer2 = new DiscountedCFRTrainer(3, 2); // Different actions

            expect(() => trainer2.copyFrom(trainer1)).toThrow();
        });
    });

    describe('isAllZeros', () => {
        it('should return true for fresh trainer', () => {
            const trainer = new DiscountedCFRTrainer(2, 2);
            expect(trainer.isAllZeros()).toBe(true);
        });

        it('should return false after updates', () => {
            const trainer = new DiscountedCFRTrainer(2, 2);
            const regrets = new Float64Array([1.0, 0.0, 0.0, 0.0]);
            trainer.updateRegrets(regrets, 1);

            expect(trainer.isAllZeros()).toBe(false);
        });
    });

    describe('getStrategyForHand', () => {
        it('should return strategy for specific hand', () => {
            const trainer = new DiscountedCFRTrainer(3, 2);

            const handStrategy = trainer.getStrategyForHand(0);

            expect(handStrategy.length).toBe(3); // 3 actions
            expect(handStrategy.reduce((a, b) => a + b, 0)).toBeCloseTo(1.0, 5);
        });
    });

    describe('convergence behavior', () => {
        it('should produce valid probabilities that sum to 1', () => {
            const trainer = new DiscountedCFRTrainer(4, 5);

            // Run some iterations with random regrets
            for (let iter = 1; iter <= 100; iter++) {
                const regrets = new Float64Array(20);
                for (let i = 0; i < 20; i++) {
                    regrets[i] = Math.random() * 2 - 1; // Random [-1, 1]
                }
                trainer.updateRegrets(regrets, iter);
            }

            // Check average strategy for each hand
            const avgStrategy = trainer.getAverageStrategy();

            for (let hand = 0; hand < 5; hand++) {
                let sum = 0;
                for (let action = 0; action < 4; action++) {
                    const prob = avgStrategy[action * 5 + hand];
                    expect(prob).toBeGreaterThanOrEqual(0);
                    expect(prob).toBeLessThanOrEqual(1);
                    sum += prob;
                }
                expect(sum).toBeCloseTo(1.0, 5);
            }
        });
    });
});

describe('DEFAULT_DCFR_CONFIG', () => {
    it('should have expected values from TexasSolver', () => {
        expect(DEFAULT_DCFR_CONFIG.alpha).toBe(1.5);
        expect(DEFAULT_DCFR_CONFIG.beta).toBe(0.5);
        expect(DEFAULT_DCFR_CONFIG.gamma).toBe(2.0);
        expect(DEFAULT_DCFR_CONFIG.theta).toBe(0.9);
    });
});
