import React, { useEffect, useRef, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Slider } from './components/ui/slider';
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { Card } from './components/ui/card';
import { Button } from './components/ui/button';
import { FileDown, FileUp, Sparkles } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { cn } from './lib/utils';
import { useVCFundStore } from './lib/store';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './components/ui/dialog';
import { Input } from './components/ui/input';

// Import components
import { FundParameters } from './components/fund-parameters';
import { PortfolioManager, StageBadge } from './components/portfolio-manager';
import { ProgressionPresets, ProgressionSourcesInfo } from './components/progression-presets';
import { ShareDialog, LoadSharedParameters, SaveSimulationResults } from './components/share-dialog';
import { SimulatorControl } from './components/simulator';

function App() {
  // Add a ref to capture the results section for saving
  const resultsRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Get states from the store
  const {
    initialStage,
    stageAllocations,
    updateStageAllocation,
    setStageAllocations,
    valuations,
    updateValuation,
    checkSizes,
    updateCheckSize,
    probAdvancement,
    updateProbAdvancement,
    simulationResults,
    isSimulating,
    simulationProgress,
    isPortfolioMode,
    setIsPortfolioMode,
    portfolioSimulationResults,
    portfolioCompanies,
    savePortfolio,
    loadPortfolio,
    exitValuations,
    lossProbabilities,
    updateExitValuation,
    updateLossProbability,
    dilution,
    updateDilution
  } = useVCFundStore();

  // Define stages
  const stages = ["Pre-Seed", "Seed", "Series A", "Series B"];
  const stageIndex = stages.indexOf(initialStage);
  const validStages = stages.slice(stageIndex);

  // State for selected simulation
  const [selectedSim, setSelectedSim] = useState(1);
  const [portfolioUnlocked, setPortfolioUnlocked] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");

  // Handle portfolio import
  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const success = loadPortfolio(content);

        if (success) {
          toast.success("Portfolio loaded successfully");
        } else {
          toast.error("Invalid portfolio file format");
        }
      } catch (error) {
        console.error("Error reading file:", error);
        toast.error("Failed to load portfolio");
      }
    };

    reader.readAsText(file);

    // Reset file input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Handle portfolio export
  const handleExportClick = () => {
    try {
      if (portfolioCompanies.length === 0) {
        toast.error("No companies to export. Add companies to your portfolio first.");
        return;
      }

      const portfolioData = savePortfolio();
      const blob = new Blob([portfolioData], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `vc-portfolio-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();

      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 0);

      toast.success("Portfolio exported successfully");
    } catch (error) {
      console.error("Error exporting portfolio:", error);
      toast.error("Failed to export portfolio");
    }
  };

  // Update allocations when valid stages change
  useEffect(() => {
    console.log("Valid stages changed:", validStages);
    const newAllocations = { ...stageAllocations };
    let remaining = 100;

    // Reset any stages that are no longer valid
    for (const stage of stages) {
      if (!validStages.includes(stage)) {
        newAllocations[stage] = 0;
      }
    }

    // Set default values for valid stages
    for (let i = 0; i < validStages.length; i++) {
      const stage = validStages[i];

      if (i === validStages.length - 1) {
        // Last stage gets whatever is remaining
        newAllocations[stage] = remaining;
      } else {
        // Use existing value or default
        const defaultValue = stageAllocations[stage] || 0;
        const value = Math.min(defaultValue, remaining);
        newAllocations[stage] = value;
        remaining -= value;
      }
    }

    // Only update if allocations have changed
    if (JSON.stringify(newAllocations) !== JSON.stringify(stageAllocations)) {
      console.log("Updating allocations:", newAllocations);
      setStageAllocations(newAllocations);
    }
  }, [initialStage, validStages.length, setStageAllocations, stageAllocations]);

  // Handle slider changes
  const handleSliderChange = (stage: string, value: number[]) => {
    if (value.length > 0) {
      console.log(`Updating ${stage} allocation to ${value[0]}`);
      updateStageAllocation(stage, value[0]);
    }
  };

  const handleValuationChange = (stage: string, value: number[]) => {
    if (value.length === 2) {
      console.log(`Updating ${stage} valuation to [${value[0]}, ${value[1]}]`);
      updateValuation(stage, [value[0], value[1]]);
    }
  };

  const handleCheckSizeChange = (stage: string, value: number[]) => {
    if (value.length === 2) {
      console.log(`Updating ${stage} check size to [${value[0]}, ${value[1]}]`);
      updateCheckSize(stage, [value[0], value[1]]);
    }
  };

  const handleProbabilityChange = (key: string, value: number[]) => {
    if (value.length > 0) {
      console.log(`Updating probability for ${key} to ${value[0]}`);
      updateProbAdvancement(key, value[0]);
    }
  };

  // Generate chart data from simulation results
  const getMoicChartData = () => {
    const results = isPortfolioMode ? portfolioSimulationResults : simulationResults;
    if (!results) return [];

    // Create histogram bins
    const binCount = 10;
    const minMoic = Math.min(...results.moics);
    const maxMoic = Math.max(...results.moics);
    const binSize = (maxMoic - minMoic) / binCount;

    const bins = Array(binCount).fill(0).map((_, i) => ({
      range: `${(minMoic + i * binSize).toFixed(1)}-${(minMoic + (i + 1) * binSize).toFixed(1)}`,
      count: 0,
    }));

    // Fill bins
    results.moics.forEach((moic) => {
      const binIndex = Math.min(
        Math.floor((moic - minMoic) / binSize),
        binCount - 1
      );
      if (binIndex >= 0 && binIndex < bins.length) {
        bins[binIndex].count++;
      }
    });

    return bins;
  };

  const results = isPortfolioMode ? portfolioSimulationResults : simulationResults;

  return (
    <div className="container mx-auto py-6">
      {/* Toast container */}
      <Toaster />
      
      {/* Hidden file input for portfolio import */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".json"
        onChange={handleFileChange}
      />
      
      {/* Component to load shared parameters from URL */}
      <LoadSharedParameters />

      <div className="flex flex-col items-center mb-6">
        <div className="flex items-center justify-between w-full mb-4">
          <div className="flex-1"></div> {/* Empty div for spacing */}
          
          <div className="flex gap-2">
            <Button 
              variant={!isPortfolioMode ? "default" : "outline"} 
              onClick={() => setIsPortfolioMode(false)}
              className={cn(
                "px-6",
                !isPortfolioMode && "shadow-sm"
              )}
            >
              Fund
            </Button>
            <Button 
              variant={isPortfolioMode ? "default" : "outline"} 
              onClick={() => {
                if (portfolioUnlocked) {
                  setIsPortfolioMode(true);
                } else {
                  setShowPasswordDialog(true);
                }
              }}
              className={cn(
                "px-6",
                isPortfolioMode && "shadow-sm"
              )}
            >
              Portfolio
            </Button>
          </div>
          
          <div className="flex-1 flex justify-end">
            <a 
              href="https://siliconroundabout.ventures"
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-100"
            >
              Silicon Roundabout Ventures
              <Sparkles className="h-3.5 w-3.5 opacity-70 group-hover:animate-ping" />
            </a>
          </div>
        </div>
        
        <p className="text-sm text-gray-500 mb-4">
          Simulation developed by{" "}
          <a
            href="https://www.linkedin.com/in/loan-challeat/"
            className="underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Loan Challeat
          </a>{" "}
          (
          <a 
            href="https://siliconroundabout.ventures" 
            className="underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            SRV
          </a>
          ) based on the work of{" "}
          <a
            href="https://www.linkedin.com/in/chandr3w/"
            className="underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Andrew Chan
          </a>{" "}
          (<a 
            href="https://atas.vc/" 
            className="underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Atas VC
          </a>).
        </p>
        
        <h1 className="text-3xl font-bold">
          {isPortfolioMode ? "Specific Portfolio Simulator" : "Global Fund Simulator"}
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Parameters Panel */}
        <Card className="p-4 md:col-span-1">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Parameters</h2>
            <div className="flex flex-col gap-2">
              <ShareDialog />
            </div>
          </div>

          {isPortfolioMode ? (
            // Portfolio mode
            <div>
              <Tabs defaultValue="portfolio">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex flex-col w-full">
                    <TabsList className="grid grid-cols-3 mb-2">
                      <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
                      <TabsTrigger value="valuations">Valuations</TabsTrigger>
                      <TabsTrigger value="progress">Progress</TabsTrigger>
                    </TabsList>
                    <div className="flex flex-col gap-2 w-full">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex items-center gap-1 w-full"
                        onClick={handleImportClick}
                      >
                        <FileUp className="h-4 w-4" />
                        Import
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex items-center gap-1 w-full"
                        onClick={handleExportClick}
                        disabled={portfolioCompanies.length === 0}
                      >
                        <FileDown className="h-4 w-4" />
                        Export
                      </Button>
                    </div>
                  </div>
                </div>

                <TabsContent value="portfolio">
                  <div className="space-y-4">
                    <h2 className="text-lg font-semibold">Your Portfolio Companies</h2>
                    <p className="text-sm text-gray-500">
                      Add your portfolio companies to simulate their growth
                    </p>
                    <PortfolioManager />
                  </div>
                </TabsContent>

                <TabsContent value="valuations">
                  <div className="space-y-4">
                    <h2 className="text-lg font-semibold">Valuations & Parameters</h2>
                    <p className="text-sm text-gray-500">
                      Set dilution, exit valuation, and loss probability for each stage. These parameters apply to all companies at that stage.
                    </p>
                    {stages.map((stage, i) => {
                      if (stage === "Series C") return null;
                      const nextStage = stages[i + 1] || null;
                      const dilutionKey = nextStage ? `${stage} to ${nextStage}` : null;
                      const dilutionVal = (dilutionKey && dilution[dilutionKey]) ? dilution[dilutionKey] : [10, 25];
                      const exitVal = exitValuations[stage] || [4, 10];
                      const lossProb = lossProbabilities[stage] ?? 30;
                      return (
                        <div key={stage} className="space-y-3 mt-4">
                          <div className="flex items-center gap-2">
                            <StageBadge stage={stage} />
                            <h3 className="text-md font-medium">{stage}</h3>
                          </div>
                          {dilutionKey && (
                            <div className="space-y-1">
                              <div className="flex justify-between">
                                <label className="text-sm font-medium">Dilution {stage} → {nextStage} (%)</label>
                                <span className="text-sm font-medium">{dilutionVal[0]}-{dilutionVal[1]}</span>
                              </div>
                              <Slider
                                value={dilutionVal}
                                min={0}
                                max={100}
                                step={1}
                                onValueChange={(values) => {
                                  if (dilutionKey && values.length === 2) updateDilution(dilutionKey, [values[0], values[1]]);
                                }}
                              />
                            </div>
                          )}
                          {stage === "Series B" && (
                            <div className="space-y-1">
                              <div className="flex justify-between">
                                <label className="text-sm font-medium">Dilution Series B → Series C (%)</label>
                                <span className="text-sm font-medium">{(dilution["Series B to Series C"] || [10, 15]).join('-')}</span>
                              </div>
                              <Slider
                                value={dilution["Series B to Series C"] || [10, 15]}
                                min={0}
                                max={100}
                                step={1}
                                onValueChange={(values) => {
                                  if (values.length === 2) updateDilution("Series B to Series C", [values[0], values[1]]);
                                }}
                              />
                            </div>
                          )}
                          <div className="space-y-1">
                            <div className="flex justify-between">
                              <label className="text-sm font-medium">Exit Valuation Range ($MM)</label>
                              <span className="text-sm font-medium">{exitVal[0]}-{exitVal[1]}</span>
                            </div>
                            <Slider
                              value={exitVal}
                              min={2}
                              max={100}
                              step={1}
                              onValueChange={(values) => {
                                if (values.length === 2) updateExitValuation(stage, [values[0], values[1]]);
                              }}
                            />
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between">
                              <label className="text-sm font-medium">Probability of Total Loss at {stage} (%)</label>
                              <span className="text-sm font-medium">{lossProb}%</span>
                            </div>
                            <Slider
                              value={[lossProb]}
                              min={0}
                              max={100}
                              step={1}
                              onValueChange={(values) => updateLossProbability(stage, values[0])}
                            />
                          </div>
                        </div>
                      );
                    })}
                    {/* Add Series C section */}
                    <div className="space-y-3 mt-4">
                      <div className="flex items-center gap-2">
                        <StageBadge stage="Series C" />
                        <h3 className="text-md font-medium">Series C</h3>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <label className="text-sm font-medium">Dilution Series C → Series IPO (%)</label>
                          <span className="text-sm font-medium">{(dilution["Series C to IPO"] || [10, 15]).join('-')}</span>
                        </div>
                        <Slider
                          value={dilution["Series C to IPO"] || [10, 15]}
                          min={0}
                          max={100}
                          step={1}
                          onValueChange={(values) => {
                            if (values.length === 2) updateDilution("Series C to IPO", [values[0], values[1]]);
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <label className="text-sm font-medium">Exit Valuation Range ($MM)</label>
                          <span className="text-sm font-medium">{(exitValuations["Series C"] || [100, 1000]).join('-')}</span>
                        </div>
                        <Slider
                          value={exitValuations["Series C"] || [100, 1000]}
                          min={10}
                          max={2000}
                          step={1}
                          onValueChange={(values) => {
                            if (values.length === 2) updateExitValuation("Series C", [values[0], values[1]]);
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <label className="text-sm font-medium">Probability of Total Loss at Series C (%)</label>
                          <span className="text-sm font-medium">{lossProbabilities["Series C"] ?? 30}%</span>
                        </div>
                        <Slider
                          value={[lossProbabilities["Series C"] ?? 30]}
                          min={0}
                          max={100}
                          step={1}
                          onValueChange={(values) => updateLossProbability("Series C", values[0])}
                        />
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="progress">
                  <div className="space-y-4">
                    <h2 className="text-lg font-semibold">Stage Progression</h2>
                    <p className="text-sm text-gray-500">
                      Configure probabilities of companies advancing to next stages
                    </p>
                    <ProgressionPresets />
                    {[
                      "Pre-Seed to Seed",
                      "Seed to Series A",
                      "Series A to Series B",
                      "Series B to Series C",
                      "Series C to IPO",
                    ].map((key) => {
                      const probability = probAdvancement[key] || 0;
                      return (
                        <div key={key} className="space-y-1">
                          <div className="flex justify-between">
                            <label className="text-sm font-medium">
                              {key.replace(" to ", " → ")}
                            </label>
                            <span className="text-sm font-medium">{probability}%</span>
                          </div>
                          <Slider
                            value={[probability]}
                            min={0}
                            max={100}
                            step={1}
                            onValueChange={(values) => handleProbabilityChange(key, values)}
                          />
                        </div>
                      );
                    })}
                    <ProgressionSourcesInfo />
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          ) : (
            // Classic mode
            <Tabs defaultValue="fund">
              <TabsList className="grid grid-cols-4 mb-4">
                <TabsTrigger value="fund">Fund</TabsTrigger>
                <TabsTrigger value="stages">Stages</TabsTrigger>
                <TabsTrigger value="valuations">Valuations</TabsTrigger>
                <TabsTrigger value="probabilities">Progress</TabsTrigger>
              </TabsList>

              <TabsContent value="fund">
                <FundParameters />
              </TabsContent>

              <TabsContent value="stages" className="space-y-4">
                <h2 className="text-lg font-semibold">Portfolio Allocation (%)</h2>

                {validStages.map((stage, i) => {
                  const isLast = i === validStages.length - 1;
                  const allocation = stageAllocations[stage] || 0;

                  return (
                    <div key={stage} className="space-y-1">
                      <div className="flex justify-between">
                        <label className="text-sm font-medium">Allocation to {
                          stage
                        }</label>
                        <span className="text-sm font-medium">{allocation}%</span>
                      </div>

                      {isLast ? (
                        <div className="text-sm text-gray-500">
                          Auto-set based on remaining allocation
                        </div>
                      ) : (
                        <Slider
                          value={[allocation]}
                          min={0}
                          max={100}
                          step={5}
                          disabled={isLast}
                          onValueChange={(values) =>
                            handleSliderChange(stage, values)
                          }
                        />
                      )}
                    </div>
                  );
                })}

                {/* Warning for allocation total */}
                {Object.values(stageAllocations).reduce((sum, val) => sum + val, 0) !==
                  100 && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">
                    Warning: Stage allocations do not sum to 100%. Please adjust your
                    allocations.
                  </div>
                )}
              </TabsContent>

              <TabsContent value="valuations" className="space-y-4">
                <h2 className="text-lg font-semibold">Valuations & Check Sizes</h2>
                <p className="text-sm text-gray-500">
                  Configure entry valuations, check sizes, dilution, exit valuations, and loss probabilities for each stage
                </p>

                {validStages.map((stage, i) => {
                  const valuation = valuations[stage] || [1, 10];
                  const checkSize = checkSizes[stage] || [0.5, 2];
                  const exitVal = exitValuations[stage] || [1, 10];
                  const lossProb = lossProbabilities[stage] ?? 30;
                  // For dilution, get the transition to the next stage
                  const nextStage = validStages[i + 1] || (stage === "Series B" ? "Series C" : null);
                  const dilutionKey = nextStage ? `${stage} to ${nextStage}` : null;
                  const dilutionVal = (dilutionKey && dilution[dilutionKey]) ? dilution[dilutionKey] : [10, 25];

                  return (
                    <div key={stage} className="space-y-3 mt-4">
                      <div className="flex items-center gap-2">
                        <StageBadge stage={stage} />
                        <h3 className="text-md font-medium">{stage}</h3>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <label className="text-sm font-medium">
                            Entry Valuation Range ($MM)
                          </label>
                          <span className="text-sm font-medium">
                            {valuation[0]}-{valuation[1]}
                          </span>
                        </div>
                        <Slider
                          value={valuation}
                          min={
                            stage === "Pre-Seed"
                              ? 1
                              : stage === "Seed"
                              ? 4
                              : stage === "Series A"
                              ? 20
                              : 50
                          }
                          max={
                            stage === "Pre-Seed"
                              ? 40
                              : stage === "Seed"
                              ? 50
                              : stage === "Series A"
                              ? 200
                              : 400
                          }
                          step={stage === "Series B" ? 5 : 1}
                          onValueChange={(values) =>
                            handleValuationChange(stage, values)
                          }
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <label className="text-sm font-medium">Check Size Range ($MM)</label>
                          <span className="text-sm font-medium">
                            {checkSize[0]}-{checkSize[1]}
                          </span>
                        </div>
                        <Slider
                          value={checkSize}
                          min={
                            stage === "Pre-Seed"
                              ? 0.1
                              : stage === "Seed"
                              ? 0.25
                              : 1
                          }
                          max={
                            stage === "Pre-Seed"
                              ? 3
                              : stage === "Seed"
                              ? 10
                              : stage === "Series A"
                              ? 20
                              : 40
                          }
                          step={stage === "Series A" || stage === "Series B" ? 0.5 : 0.1}
                          onValueChange={(values) =>
                            handleCheckSizeChange(stage, values)
                          }
                        />
                      </div>

                      {/* Dilution per round (if not last stage) */}
                      {dilutionKey && Array.isArray(dilutionVal) && dilutionVal.length === 2 && (
                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <label className="text-sm font-medium">Dilution {stage} → {nextStage} (%)</label>
                            <span className="text-sm font-medium">{dilutionVal[0]}-{dilutionVal[1]}</span>
                          </div>
                          <Slider
                            value={dilutionVal}
                            min={0}
                            max={100}
                            step={1}
                            onValueChange={(values) => {
                              const [min, max] = values;
                              if (dilutionKey && typeof min === 'number' && typeof max === 'number') {
                                updateDilution(dilutionKey, [min, max]);
                              }
                            }}
                          />
                        </div>
                      )}

                      {/* Exit Valuation Range */}
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <label className="text-sm font-medium">Exit Valuation Range ($MM)</label>
                          <span className="text-sm font-medium">{exitVal[0]}-{exitVal[1]}</span>
                        </div>
                        <Slider
                          value={exitVal}
                          min={
                            stage === "Pre-Seed"
                              ? 2
                              : stage === "Seed"
                              ? 2
                              : stage === "Series A"
                              ? 10
                              : stage === "Series B"
                              ? 20
                              : stage === "Series C"
                              ? 100
                              : 1000
                          }
                          max={
                            stage === "Pre-Seed"
                              ? 20
                              : stage === "Seed"
                              ? 40
                              : stage === "Series A"
                              ? 100
                              : stage === "Series B"
                              ? 200
                              : stage === "Series C"
                              ? 1000
                              : 10000
                          }
                          step={stage === "IPO" ? 100 : stage === "Series C" ? 10 : 1}
                          onValueChange={(values) => {
                            const [min, max] = values;
                            if (typeof min === 'number' && typeof max === 'number') {
                              updateExitValuation(stage, [min, max]);
                            }
                          }}
                        />
                      </div>

                      {/* Loss Probability */}
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <label className="text-sm font-medium">Probability of Total Loss at {stage} (%)</label>
                          <span className="text-sm font-medium">{lossProb}%</span>
                        </div>
                        <Slider
                          value={[lossProb]}
                          min={0}
                          max={100}
                          step={1}
                          onValueChange={(values) => updateLossProbability(stage, values[0])}
                        />
                      </div>
                    </div>
                  );
                })}
              </TabsContent>

              <TabsContent value="probabilities" className="space-y-4">
                <h2 className="text-lg font-semibold">Stage Progression</h2>
                <p className="text-sm text-gray-500">
                  Configure probabilities of companies advancing to next stages
                </p>

                {/* Market Data Presets Component */}
                <ProgressionPresets />

                {/* Progression probabilities */}
                {
                  [
                    "Pre-Seed to Seed",
                    "Seed to Series A",
                    "Series A to Series B",
                    "Series B to Series C",
                    "Series C to IPO",
                  ]
                    .filter((key) => {
                      const [fromStage] = key.split(" to ");
                      return stages.indexOf(fromStage) >= stageIndex || fromStage === "Series C";
                    })
                    .map((key) => {
                      const probability = probAdvancement[key] || 0;

                      return (
                        <div key={key} className="space-y-1">
                          <div className="flex justify-between">
                            <label className="text-sm font-medium">
                              {key.replace(" to ", " → ")}
                            </label>
                            <span className="text-sm font-medium">{probability}%</span>
                          </div>
                          <Slider
                            value={[probability]}
                            min={0}
                            max={100}
                            step={1}
                            onValueChange={(values) =>
                              handleProbabilityChange(key, values)
                            }
                          />
                        </div>
                      );
                    })
                }
                
                {/* Data Sources Information */}
                <ProgressionSourcesInfo />
              </TabsContent>
            </Tabs>
          )}

          <div className="mt-6">
            <SimulatorControl />
          </div>
        </Card>

        {/* Results Panel */}
        <Card className="p-4 md:col-span-2">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Simulation Results</h2>
            {results && <SaveSimulationResults resultsRef={resultsRef} />}
          </div>

          {isSimulating ? (
            <div className="flex flex-col items-center justify-center h-[500px]">
              <div className="animate-pulse text-lg mb-4">Simulating...</div>
              <div className="w-full max-w-md mb-4">
                <div className="mb-2 text-sm text-center">
                  {Math.round(simulationProgress)}% complete
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div 
                    className="bg-blue-600 h-2.5 rounded-full" 
                    style={{ width: `${simulationProgress}%` }}
                  ></div>
                </div>
              </div>
              <p className="text-sm text-gray-500 text-center max-w-md">
                Running {useVCFundStore.getState().numSimulations} simulations to calculate fund performance metrics
              </p>
            </div>
          ) : results ? (
            <div className="space-y-6" ref={resultsRef} id="simulation-results">
              {/* Summary metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-100 p-3 rounded-lg">
                  <div className="text-sm text-gray-500">Paid-in ($MM)</div>
                  <div className="text-xl font-semibold">
                    {results.paidIn.toFixed(2)}
                  </div>
                </div>
                <div className="bg-gray-100 p-3 rounded-lg">
                  <div className="text-sm text-gray-500">Distributed ($MM)</div>
                  <div className="text-xl font-semibold">
                    {results.distributed.toFixed(2)}
                  </div>
                </div>
                <div className="bg-gray-100 p-3 rounded-lg">
                  <div className="text-sm text-gray-500">MOIC</div>
                  <div className="text-xl font-semibold">
                    {results.meanMoic.toFixed(2)}
                  </div>
                </div>
                <div className="bg-gray-100 p-3 rounded-lg">
                  <div className="text-sm text-gray-500">Mean IRR %</div>
                  <div className="text-xl font-semibold">
                    {results.meanIrr.toFixed(2)}%
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-100 p-3 rounded-lg">
                  <div className="text-sm text-gray-500">Net DPI</div>
                  <div className="text-xl font-semibold">
                    {(results.distributed / results.paidIn).toFixed(
                      2
                    )}
                  </div>
                </div>
                <div className="bg-gray-100 p-3 rounded-lg">
                  <div className="text-sm text-gray-500"># Investments</div>
                  <div className="text-xl font-semibold">
                    {results.numInvestments}
                  </div>
                </div>
                <div className="bg-gray-100 p-3 rounded-lg">
                  <div className="text-sm text-gray-500">Mgmt Fees ($MM)</div>
                  <div className="text-xl font-semibold">
                    ${results.managementFees.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* MOIC Distribution */}
              <div>
                <h3 className="text-lg font-semibold mb-2">Distribution of Fund MOIC</h3>
                <div className="min-h-[200px] w-full">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={getMoicChartData()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="range" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar
                        dataKey="count"
                        name="Number of Simulations"
                        fill="#8884d8"
                      >
                        {getMoicChartData().map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={index % 2 === 0 ? "#8884d8" : "#82ca9d"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Investment Performance */}
              <div>
                <div className="flex items-center mb-2 gap-4">
                  <h3 className="text-lg font-semibold">
                    Entry Capital vs. Exit Value per Investment (Simulation Details)
                  </h3>
                  <div className="flex items-center gap-2">
                    <label htmlFor="sim-select" className="text-sm">Simulation:</label>
                    <select
                      id="sim-select"
                      className="border rounded px-2 py-1 text-sm"
                      value={selectedSim}
                      onChange={e => setSelectedSim(Number(e.target.value))}
                    >
                      {Array.from({ length: useVCFundStore.getState().numSimulations }, (_, i) => (
                        <option key={i + 1} value={i + 1}>{i + 1}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="min-h-[300px] w-full">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={(() => {
                        // Group investments by simulation
                        const simMap = new Map();
                        results.investments.forEach(inv => {
                          const parts = String(inv.id).split('-');
                          const simIdx = parts[0] ? parseInt(parts[0], 10) : 1;
                          if (!simMap.has(simIdx)) simMap.set(simIdx, []);
                          simMap.get(simIdx).push(inv);
                        });
                        // Only show up to floor(numInvestments)
                        const numToShow = Math.floor(results.numInvestments);
                        const invs = simMap.get(selectedSim) || [];
                        // For portfolio mode, build a map from company id to name
                        let companyNameMap: Record<string, string> = {};
                        if (isPortfolioMode) {
                          const pcs = useVCFundStore.getState().portfolioCompanies;
                          pcs.forEach(pc => { companyNameMap[String(pc.id)] = pc.name; });
                        }
                        return invs.slice(0, numToShow).map((inv, idx) => ({
                          id: idx + 1,
                          entry: inv.entryAmount,
                          exit: inv.exitAmount,
                          gain: Math.max(0, inv.exitAmount - inv.entryAmount),
                          loss: Math.min(0, inv.exitAmount - inv.entryAmount),
                        }));
                      })()}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="id" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="entry" fill="#8884d8" name="Entry" />
                      <Bar dataKey="gain" fill="#82ca9d" name="Gain" stackId="stack" />
                      <Bar dataKey="loss" fill="#ff8042" name="Loss" stackId="stack" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Investments Table */}
              <div>
                <h3 className="text-lg font-semibold mb-2">
                  {isPortfolioMode ? "Portfolio Companies Simulation" : "Sample Simulation Investments (Selected Simulation)"}
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="px-4 py-2 text-left">
                          {isPortfolioMode ? "Company" : "Investment #"}
                        </th>
                        <th className="px-4 py-2 text-left">Entry Stage</th>
                        <th className="px-4 py-2 text-left">Entry Amount ($MM)</th>
                        <th className="px-4 py-2 text-left">Exit Stage</th>
                        <th className="px-4 py-2 text-left">Exit Amount ($MM)</th>
                        <th className="px-4 py-2 text-left">Multiple</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        // Group investments by simulation
                        const simMap = new Map();
                        results.investments.forEach(inv => {
                          const parts = String(inv.id).split('-');
                          const simIdx = parts[0] ? parseInt(parts[0], 10) : 1;
                          if (!simMap.has(simIdx)) simMap.set(simIdx, []);
                          simMap.get(simIdx).push(inv);
                        });
                        const numToShow = Math.floor(results.numInvestments);
                        const invs = simMap.get(selectedSim) || [];
                        // For portfolio mode, build a map from company id to name
                        let companyNameMap: Record<string, string> = {};
                        if (isPortfolioMode) {
                          const pcs = useVCFundStore.getState().portfolioCompanies;
                          pcs.forEach(pc => { companyNameMap[String(pc.id)] = pc.name; });
                        }
                        return invs.slice(0, numToShow).map((inv, idx) => {
                          const entryStage = inv.entryStage || "";
                          const exitStage = inv.exitStage || "";
                          let companyLabel = idx + 1;
                          if (isPortfolioMode) {
                            // inv.id is in the format 'sim-companyId'
                            const idParts = String(inv.id).split('-');
                            const companyId = idParts.length > 1 ? idParts.slice(1).join('-') : idParts[0];
                            companyLabel = companyNameMap[companyId] || companyLabel;
                          }
                          return (
                            <tr key={idx} className="border-b border-gray-200">
                              <td className="px-4 py-2">{companyLabel}</td>
                              <td className="px-4 py-2"><StageBadge stage={entryStage} /></td>
                              <td className="px-4 py-2">${inv.entryAmount.toFixed(2)}</td>
                              <td className="px-4 py-2"><StageBadge stage={exitStage} /></td>
                              <td className="px-4 py-2">${inv.exitAmount.toFixed(2)}</td>
                              <td className="px-4 py-2">{inv.entryAmount > 0 ? (inv.exitAmount / inv.entryAmount).toFixed(2) : "N/A"}</td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[500px] text-center">
              <p className="text-gray-500 mb-4">Run a simulation to see results</p>
              <p className="text-sm text-gray-500 max-w-md">
                {isPortfolioMode 
                  ? "Add your portfolio companies and click 'Run Simulation' to generate performance metrics"
                  : "Configure your fund parameters on the left panel and click 'Run Simulation' to generate portfolio performance metrics"
                }
              </p>
            </div>
          )}
        </Card>
      </div>

      {/* Portfolio Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enter Portfolio Mode Password</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Input
              type="password"
              placeholder="Password"
              value={passwordInput}
              onChange={e => setPasswordInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  if (passwordInput === 'SRV-admin') {
                    setPortfolioUnlocked(true);
                    setIsPortfolioMode(true);
                    setShowPasswordDialog(false);
                    setPasswordInput("");
                    toast.success('Portfolio mode unlocked!');
                  } else {
                    toast.error('Incorrect password.');
                  }
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <button
              className="bg-blue-600 text-white px-4 py-2 rounded mr-2"
              onClick={() => {
                if (passwordInput === 'SRV-admin') {
                  setPortfolioUnlocked(true);
                  setIsPortfolioMode(true);
                  setShowPasswordDialog(false);
                  setPasswordInput("");
                  toast.success('Portfolio mode unlocked!');
                } else {
                  toast.error('Incorrect password.');
                }
              }}
            >
              Confirm
            </button>
            <button
              className="bg-gray-200 text-gray-800 px-4 py-2 rounded"
              onClick={() => {
                setShowPasswordDialog(false);
                setPasswordInput("");
              }}
            >
              Cancel
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default App;