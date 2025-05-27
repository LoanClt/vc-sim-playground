import React, { useEffect } from 'react';
import { useVCFundStore, type SimulationResults, type Investment } from '../lib/store';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { toast } from 'sonner';
import { useState } from 'react';

export function SimulatorControl() {
  const {
    fundSize,
    initialStage,
    managementFeePct,
    managementFeeYears,
    deploymentYears,
    numSimulations,
    stageAllocations,
    valuations,
    checkSizes,
    probAdvancement,
    dilution,
    exitValuations,
    lossProbabilities,
    totalMgmtFee,
    deployableCapital,
    setSimulationResults,
    isSimulating,
    setIsSimulating,
    simulationProgress,
    setSimulationProgress,
    isPortfolioMode,
    portfolioCompanies,
    setPortfolioSimulationResults,
    followOn,
    followOnAB,
  } = useVCFundStore();

  const stages = ["Pre-Seed", "Seed", "Series A", "Series B"];
  const stageIndex = stages.indexOf(initialStage);
  const validStages = stages.slice(stageIndex);

  useEffect(() => {
    // Debug log to ensure state updates are being detected
    console.log("State updated:", {
      fundSize,
      initialStage,
      totalMgmtFee,
      deployableCapital,
      isPortfolioMode,
      portfolioCompaniesCount: portfolioCompanies.length,
      followOn,
      followOnAB,
    });
  }, [
    fundSize,
    initialStage,
    managementFeePct,
    managementFeeYears,
    totalMgmtFee,
    deployableCapital,
    isPortfolioMode,
    portfolioCompanies,
    followOn,
    followOnAB,
  ]);

  // Simulate portfolio mode
  const simulatePortfolio = () => {
    console.log("Running portfolio simulation with companies:", portfolioCompanies);

    setIsSimulating(true);
    setSimulationProgress(0);

    // Simulate a backend processing time with progress updates
    const totalSteps = 10;
    let currentStep = 0;

    const simulationStep = () => {
      currentStep++;
      setSimulationProgress(Math.min((currentStep / totalSteps) * 100, 100));

      if (currentStep < totalSteps) {
        setTimeout(simulationStep, 200);
      } else {
        try {
          if (portfolioCompanies.length === 0) {
            toast.error("Please add at least one portfolio company");
            setIsSimulating(false);
            return;
          }

          // Run numSimulations Monte Carlo runs
          const allInvestments: Investment[] = [];
          const moics: number[] = [];
          const irrs: number[] = [];
          let paidInTotal = 0;
          let distributedTotal = 0;

          for (let sim = 0; sim < numSimulations; sim++) {
            let simInvestments: Investment[] = [];
            let paidIn = 0;
            let distributed = 0;

            for (const company of portfolioCompanies) {
              let entryStage = company.stage;
              let entryAmount = company.checkSize || 1;
              let equity = 1; // 100% of the investment at entry
              let currentStage = entryStage;
              let exitStage = entryStage;
              let exitAmount = 0;
              let reachedIPO = false;

              // Use the same stage sequence as fund simulation
              const stagesSequence = ["Pre-Seed", "Seed", "Series A", "Series B", "Series C", "IPO"];
              let stageIdx = stagesSequence.indexOf(entryStage);

              // Track if forced follow-on has been applied for this company at each stage
              let forcedSeedFollow = false;
              let forcedABFollow = false;

              for (let i = stageIdx; i < stagesSequence.length - 1; i++) {
                const fromStage = stagesSequence[i];
                const toStage = stagesSequence[i + 1];
                // 1. Forced follow-on logic: only force if this is the ticked follow-on stage for this company and not already forced
                let forceAdvance = false;
                if (!forcedSeedFollow && fromStage === "Seed" && followOn && followOn.selected && followOn.selected[company.id] && currentStage === "Seed") {
                  forceAdvance = true;
                  forcedSeedFollow = true;
                }
                if (!forcedABFollow && fromStage === "Series A" && followOnAB && followOnAB.selected && followOnAB.selected[company.id] && currentStage === "Series A") {
                  forceAdvance = true;
                  forcedABFollow = true;
                }
                // 2. Progression probability
                const progressionKey = `${fromStage} to ${toStage}`;
                const progressionProb = probAdvancement[progressionKey] ?? 0;
                if (forceAdvance) {
                  // Forced promotion: always advance, set valuation
                  const dilutionRange = dilution[progressionKey] || [10, 25];
                  const dilutionPct = (dilutionRange[0] + Math.random() * (dilutionRange[1] - dilutionRange[0])) / 100;
                  equity *= (1 - dilutionPct);
                  currentStage = toStage;
                  if (fromStage === "Seed") entryAmount = followOn.avgVal;
                  if (fromStage === "Series A") entryAmount = followOnAB.avgVal;
                  // If reached IPO, exit
                  if (toStage === "IPO") {
                    exitStage = "IPO";
                    const exitRange = exitValuations["Series C"] || [100, 1000];
                    const exitValuation = exitRange[0] + Math.random() * (exitRange[1] - exitRange[0]);
                    exitAmount = equity * exitValuation * entryAmount;
                    reachedIPO = true;
                    break;
                  }
                  continue; // skip normal progression logic
                }
                if (Math.random() * 100 < progressionProb) {
                  // 3. Apply dilution
                  const dilutionRange = dilution[progressionKey] || [10, 25];
                  const dilutionPct = (dilutionRange[0] + Math.random() * (dilutionRange[1] - dilutionRange[0])) / 100;
                  equity *= (1 - dilutionPct);
                  currentStage = toStage;
                  // 5. If reached IPO, exit
                  if (toStage === "IPO") {
                    exitStage = "IPO";
                    const exitRange = exitValuations["Series C"] || [100, 1000];
                    const exitValuation = exitRange[0] + Math.random() * (exitRange[1] - exitRange[0]);
                    exitAmount = equity * exitValuation * entryAmount;
                    reachedIPO = true;
                    break;
                  }
                } else {
                  // Did not progress, break out of the loop
                  break;
                }
              }
              // After progression, check loss probability at the final stage
              const lossProb = lossProbabilities[currentStage] ?? 30;
              if (Math.random() * 100 < lossProb) {
                exitStage = currentStage;
                exitAmount = 0;
              } else if (!reachedIPO) {
                // Not lost and not IPO, use exit valuation for current stage
                const exitRange = exitValuations[currentStage] || [4, 10];
                const exitValuation = exitRange[0] + Math.random() * (exitRange[1] - exitRange[0]);
                exitAmount = equity * exitValuation * entryAmount;
                exitStage = currentStage;
              }

              simInvestments.push({
                id: `${sim}-${company.id}`,
                entryStage,
                entryAmount,
                exitStage,
                exitAmount,
              });
              paidIn += entryAmount;
              distributed += exitAmount;
            }

            allInvestments.push(...simInvestments);
            paidInTotal += paidIn;
            distributedTotal += distributed;
            moics.push(paidIn > 0 ? distributed / paidIn : 0);
            // IRR: simple 5-year assumption
            const irr = paidIn > 0 ? Math.min(Math.max((Math.pow(distributed / paidIn, 1/5) - 1) * 100, -50), 100) : 0;
            irrs.push(irr);
          }

          const meanMoic = moics.reduce((a, b) => a + b, 0) / moics.length;
          const meanIrr = irrs.reduce((a, b) => a + b, 0) / irrs.length;

          const results: SimulationResults = {
            moics,
            irrs,
            meanMoic,
            meanIrr,
            investments: allInvestments,
            paidIn: paidInTotal / numSimulations,
            distributed: distributedTotal / numSimulations,
            numInvestments: portfolioCompanies.length,
            managementFees: totalMgmtFee,
          };

          setPortfolioSimulationResults(results);
          toast.success("Portfolio simulation completed successfully!");
        } catch (error) {
          console.error("Portfolio simulation error:", error);
          toast.error("Simulation failed. Please check your companies and try again.");
        } finally {
          setIsSimulating(false);
        }
      }
    };

    setTimeout(simulationStep, 200);
  };

  // Run simulation for standard fund mode
  const runStandardSimulation = () => {
    console.log("Running simulation with parameters:", {
      fundSize,
      initialStage,
      managementFeePct,
      managementFeeYears,
      deploymentYears,
      numSimulations,
      stageAllocations,
      validStages,
    });

    setIsSimulating(true);
    setSimulationProgress(0);

    // Simulate a backend processing time with progress updates
    const totalSteps = 10;
    let currentStep = 0;

    const simulationStep = () => {
      currentStep++;
      setSimulationProgress(Math.min((currentStep / totalSteps) * 100, 100));

      if (currentStep < totalSteps) {
        setTimeout(simulationStep, 200);
      } else {
        // Final step - complete the simulation
        try {
          // --- NEW LOGIC: Run numSimulations full-fund simulations ---
          const allMoics: number[] = [];
          const allIrRs: number[] = [];
          let allInvestments: Investment[] = [];
          let totalPaidIn = 0;
          let totalDistributed = 0;

          for (let sim = 0; sim < numSimulations; sim++) {
            const sampleInvestments: Investment[] = [];
            let investmentId = 1;

            for (const stage of validStages) {
              const allocation = (stageAllocations[stage] / 100) * deployableCapital;
              let deployedInStage = 0;

              while (deployedInStage < allocation) {
                // Random valuation and check size within ranges
                const valRange = valuations[stage] || [1, 10];
                const checkRange = checkSizes[stage] || [0.5, 2];

                const valuation = valRange[0] + Math.random() * (valRange[1] - valRange[0]);
                let checkSize = checkRange[0] + Math.random() * (checkRange[1] - checkRange[0]);

                // Cap check size by remaining allocation
                checkSize = Math.min(checkSize, allocation - deployedInStage);
                if (checkSize < 0.1) break; // Too small to be meaningful

                deployedInStage += checkSize;

                // Calculate equity
                let equity = checkSize / valuation;

                // Determine exit stage
                let currentStage = stage;

                const stagesSequence = [...stages.slice(stages.indexOf(stage)), "Series C", "IPO"];

                for (let i = 0; i < stagesSequence.length - 1; i++) {
                  const prevStage = stagesSequence[i];
                  const nextStage = stagesSequence[i + 1];
                  const key = `${prevStage} to ${nextStage}`;

                  // Check if company advances to next stage
                  if (Math.random() * 100 <= (probAdvancement[key] || 0)) {
                    // Apply dilution from user config
                    const dilutionRange = dilution[key] || [10, 20];
                    const dilutionPct = (dilutionRange[0] + Math.random() * (dilutionRange[1] - dilutionRange[0])) / 100;
                    equity *= (1 - dilutionPct);
                    currentStage = nextStage;
                  } else {
                    break;
                  }
                }

                // Determine exit amount (including possibility of total loss)
                let exitAmount = 0;
                // Use user-configured loss probability
                const lossProb = lossProbabilities[currentStage] ?? 30;
                if (Math.random() * 100 > lossProb) {
                  // Use user-configured exit valuation
                  const exitRange = exitValuations[currentStage] || [10, 90];
                  const exitValuation = exitRange[0] + Math.random() * (exitRange[1] - exitRange[0]);
                  exitAmount = equity * exitValuation;
                }

                // Add to investments
                sampleInvestments.push({
                  id: `${sim + 1}-${investmentId++}`,
                  entryStage: stage,
                  entryAmount: checkSize,
                  exitStage: currentStage,
                  exitAmount: exitAmount,
                });
              }
            }

            // Fund-level paid-in and distributed
            const paidIn = sampleInvestments.reduce((sum, inv) => sum + inv.entryAmount, 0);
            const distributed = sampleInvestments.reduce((sum, inv) => sum + inv.exitAmount, 0);
            totalPaidIn += paidIn;
            totalDistributed += distributed;
            allInvestments = allInvestments.concat(sampleInvestments);

            // MOIC for this simulation
            const moic = paidIn > 0 ? distributed / paidIn : 0;
            allMoics.push(moic);

            // IRR calculation (simple, as in your JS code)
            // For a more accurate IRR, you could implement a cash flow schedule as in your Python code
            const simplifiedIrr = Math.min(Math.max((Math.pow(moic, 1/5) - 1) * 100, -50), 100);
            allIrRs.push(simplifiedIrr);
          }

          // Aggregate metrics
          const meanMoic = allMoics.reduce((a, b) => a + b, 0) / allMoics.length;
          const meanIrr = allIrRs.reduce((a, b) => a + b, 0) / allIrRs.length;

          // Set results
          const results: SimulationResults = {
            moics: allMoics,
            irrs: allIrRs,
            meanMoic,
            meanIrr,
            investments: allInvestments,
            paidIn: totalPaidIn / numSimulations,
            distributed: totalDistributed / numSimulations,
            numInvestments: allInvestments.length / numSimulations,
            managementFees: totalMgmtFee,
          };

          console.log("Simulation completed with results:", {
            meanMoic,
            meanIrr,
            paidIn: results.paidIn,
            distributed: results.distributed,
            numInvestments: results.numInvestments,
          });

          setSimulationResults(results);
          toast.success("Simulation completed successfully!");
        } catch (error) {
          console.error("Simulation error:", error);
          toast.error("Simulation failed. Please check your parameters and try again.");
        } finally {
          setIsSimulating(false);
        }
      }
    };

    // Start simulation steps
    setTimeout(simulationStep, 200);
  };

  // Choose which simulation to run based on mode
  const runSimulation = () => {
    if (isPortfolioMode) {
      simulatePortfolio();
    } else {
      runStandardSimulation();
    }
  };

  return (
    <div className="space-y-4">
      <Button
        className="w-full"
        onClick={runSimulation}
        disabled={isSimulating}
      >
        {isSimulating ? "Simulating..." : "Run Simulation"}
      </Button>

      {isSimulating && (
        <div className="space-y-2">
          <Progress value={simulationProgress} className="w-full h-2" />
          <p className="text-sm text-gray-500 text-center">
            Simulating {isPortfolioMode ? "portfolio" : `${numSimulations} funds`}... {Math.round(simulationProgress)}%
          </p>
        </div>
      )}
    </div>
  );
}