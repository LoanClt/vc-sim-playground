import React, { useEffect, useRef, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Slider } from './components/ui/slider';
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { PieChart, Pie } from 'recharts';
import { Card } from './components/ui/card';
import { Button } from './components/ui/button';
import { FileDown, FileUp, Eye, EyeOff, ExternalLink, Rocket, ArrowLeft, ArrowRight, Star } from 'lucide-react';
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
import type { Investment } from './lib/store';
import { MoonfireSimulator } from './components/moonfire-simulator';
import { Analytics } from "@vercel/analytics/next";

// Update ConfettiBurst to accept x/y coordinates
function ConfettiBurst({ trigger, x, y }: { trigger: boolean; x: number; y: number }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (trigger) {
      setShow(true);
      const timeout = setTimeout(() => setShow(false), 700);
      return () => clearTimeout(timeout);
    }
  }, [trigger]);
  if (!show) return null;
  // 28 blue confetti pieces, smaller, more random, more spread
  const confetti = Array.from({ length: 28 }).map((_, i) => {
    const angle = Math.random() * 2 * Math.PI;
    const distance = 60 + Math.random() * 60;
    const xOffset = Math.cos(angle) * distance;
    const yOffset = Math.sin(angle) * distance;
    const rotate = Math.random() * 360;
    const delay = Math.random() * 0.12;
    const shape = Math.random() > 0.5 ? '50%' : '2px'; // circle or rectangle
    return (
      <div
        key={i}
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 4 + Math.random() * 3,
          height: 8 + Math.random() * 6,
          background: `hsl(210, 90%, ${55 + Math.random() * 25}%)`,
          borderRadius: shape,
          transform: `translate(-50%, -50%) rotate(${rotate}deg)`,
          animation: `confetti-burst 0.55s cubic-bezier(.61,-0.01,.41,1.01) ${delay}s both`,
          '--x': `${xOffset}px`,
          '--y': `${yOffset}px`,
          '--rotate': `${rotate}deg`,
          zIndex: 1000,
        } as React.CSSProperties}
      />
    );
  });
  return (
    <div style={{
      pointerEvents: 'none',
      position: 'fixed',
      left: 0, top: 0, width: '100vw', height: '100vh',
      overflow: 'visible',
      zIndex: 1000,
    }}>
      <div style={{ position: 'absolute', left: x, top: y, width: 0, height: 0 }}>
        {confetti}
      </div>
    </div>
  );
}

// Portfolio Overview Panel for Portfolio Mode
function PortfolioOverviewPanel({ companies, followOn, followOnAB }: { companies: any[], followOn: any, followOnAB: any }) {
  // Group by stage
  const stages = ['Pre-Seed', 'Seed', 'Series A', 'Series B', 'Series C'];
  const stageData = stages.map(stage => {
    const comps = companies.filter(c => c.stage === stage);
    return {
      stage,
      count: comps.length,
      totalCheck: comps.reduce((a: number, b: any) => a + b.checkSize, 0),
      totalVal: comps.reduce((a: number, b: any) => a + b.valuation, 0),
      avgCheck: comps.length ? comps.reduce((a: number, b: any) => a + b.checkSize, 0) / comps.length : 0,
      avgVal: comps.length ? comps.reduce((a: number, b: any) => a + b.valuation, 0) / comps.length : 0,
      avgOwn: comps.length ? comps.reduce((a: number, b: any) => a + b.ownership, 0) / comps.length : 0,
    };
  });
  const numFollowOnInvestments = followOn.selected ? (Object.values(followOn.selected) as number[]).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0 as number) : 0;
  const numFollowOnABInvestments = followOnAB.selected ? (Object.values(followOnAB.selected) as number[]).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0 as number) : 0;
  const totalDeployed = companies.reduce((a: number, b: any) => a + b.checkSize, 0) + (followOn.avgCheck * Number(numFollowOnInvestments)) + (followOnAB.avgCheck * Number(numFollowOnABInvestments));
  // Pie data for stage distribution
  const pieData = stageData.filter(d => d.count > 0).map(d => ({ name: d.stage, value: d.count }));
  const COLORS = ['#60a5fa','#34d399','#a78bfa','#fbbf24','#f87171'];

  // Total deployed per stage
  const deployedByStage = stages.map(stage => {
    const comps = companies.filter(c => c.stage === stage);
    return {
      stage,
      total: comps.reduce((a: number, b: any) => a + b.checkSize, 0)
    };
  });

  return (
    <div className="space-y-6">
      {/* Summary metrics grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <div className="bg-gray-100 p-4 rounded-lg">
          <div className="text-sm text-gray-500">Total Capital Deployed</div>
          <div className="text-2xl font-bold">{totalDeployed.toFixed(2)} $MM</div>
        </div>
        <div className="bg-gray-100 p-4 rounded-lg">
          <div className="text-sm text-gray-500"># of Companies</div>
          <div className="text-2xl font-bold">{companies.length}</div>
        </div>
        <div className="bg-gray-100 p-4 rounded-lg">
          <div className="text-sm text-gray-500"># Follow-ons (Seed-A)</div>
          <div className="text-2xl font-bold">{Number(numFollowOnInvestments)}</div>
        </div>
        <div className="bg-gray-100 p-4 rounded-lg">
          <div className="text-sm text-gray-500"># Follow-ons (A-B)</div>
          <div className="text-2xl font-bold">{Number(numFollowOnABInvestments)}</div>
        </div>
        {/* Per-stage deployed */}
        {deployedByStage.map(({ stage, total }) => (
          <div key={stage} className="bg-gray-100 p-4 rounded-lg flex flex-col justify-between items-center">
            <div className="mb-2"><StageBadge stage={stage} /></div>
            <div className="text-2xl font-bold">{total.toFixed(2)} $MM</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-4 flex flex-col items-center">
          <h3 className="font-semibold mb-2">Companies by Stage</h3>
          <PieChart width={220} height={220}>
            <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
              {pieData.map((entry, idx) => (
                <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
          {/* Legend */}
          <div className="flex flex-wrap justify-center mt-2 gap-2">
            {pieData.map((entry, idx) => (
              <span key={entry.name} className="flex items-center text-xs">
                <span className="inline-block w-3 h-3 rounded-full mr-1" style={{ background: COLORS[idx % COLORS.length] }}></span>
                {entry.name}
              </span>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold mb-2">Avg Check Size by Stage</h3>
          <BarChart width={260} height={220} data={stageData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="stage" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="avgCheck" fill="#60a5fa" name="Avg Check Size" />
          </BarChart>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold mb-2">Avg Valuation by Stage</h3>
          <BarChart width={260} height={220} data={stageData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="stage" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="avgVal" fill="#a78bfa" name="Avg Valuation" />
          </BarChart>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold mb-2">Avg Ownership by Stage</h3>
          <BarChart width={260} height={220} data={stageData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="stage" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="avgOwn" fill="#34d399" name="Avg Ownership %" />
          </BarChart>
        </div>
      </div>
      <div className="mt-4 text-right font-medium">
        <div className="mb-2 text-sm text-gray-700">
          <span className="font-semibold">Follow-ons (Seed-A):</span> {Number(numFollowOnInvestments)} investments × {followOn.avgCheck.toFixed(2)}$MM = <span className="text-blue-700">{(followOn.avgCheck * Number(numFollowOnInvestments)).toFixed(2)} $MM</span>
        </div>
        <div className="mb-2 text-sm text-gray-700">
          <span className="font-semibold">Follow-ons (A-B):</span> {Number(numFollowOnABInvestments)} investments × {followOnAB.avgCheck.toFixed(2)}$MM = <span className="text-blue-700">{(followOnAB.avgCheck * Number(numFollowOnABInvestments)).toFixed(2)} $MM</span>
        </div>
        Total Capital Deployed: <span className="text-blue-700">{totalDeployed.toFixed(2)} $MM</span>
      </div>
    </div>
  );
}

function runSimulationFromApp() {
  const store = useVCFundStore.getState();
  if (store.isSimulating) return;
  store.setIsSimulating(true);
  store.setSimulationProgress(0);
  const totalSteps = 10;
  let currentStep = 0;
  const simulationStep = () => {
    currentStep++;
    store.setSimulationProgress(Math.min((currentStep / totalSteps) * 100, 100));
    if (currentStep < totalSteps) {
      setTimeout(simulationStep, 200);
    } else {
      // Call the same logic as SimulatorControl
      if (store.isPortfolioMode) {
        // Portfolio simulation logic
        const { portfolioCompanies, numSimulations, totalMgmtFee, probAdvancement, dilution, exitValuations, lossProbabilities, followOn, followOnAB, setPortfolioSimulationResults } = store;
        if (portfolioCompanies.length === 0) {
          toast.error("Please add at least one portfolio company");
          store.setIsSimulating(false);
          return;
        }
        const allInvestments = [];
        const moics = [];
        const irrs = [];
        let paidInTotal = 0;
        let distributedTotal = 0;
        for (let sim = 0; sim < numSimulations; sim++) {
          let simInvestments = [];
          let paidIn = 0;
          let distributed = 0;
          for (const company of portfolioCompanies) {
            let entryStage = company.stage;
            let entryAmount = company.checkSize || 1;
            let equity = 1;
            let currentStage = entryStage;
            let exitStage = entryStage;
            let exitAmount = 0;
            let reachedIPO = false;
            const stagesSequence = ["Pre-Seed", "Seed", "Series A", "Series B", "Series C", "IPO"];
            let stageIdx = stagesSequence.indexOf(entryStage);
            let forcedSeedFollow = false;
            let forcedABFollow = false;
            for (let i = stageIdx; i < stagesSequence.length - 1; i++) {
              const fromStage = stagesSequence[i];
              const toStage = stagesSequence[i + 1];
              let forceAdvance = false;
              if (!forcedSeedFollow && fromStage === "Seed" && followOn && followOn.selected && followOn.selected[company.id] && currentStage === "Seed") {
                forceAdvance = true;
                forcedSeedFollow = true;
              }
              if (!forcedABFollow && fromStage === "Series A" && followOnAB && followOnAB.selected && followOnAB.selected[company.id] && currentStage === "Series A") {
                forceAdvance = true;
                forcedABFollow = true;
              }
              const progressionKey = `${fromStage} to ${toStage}`;
              const progressionProb = probAdvancement[progressionKey] ?? 0;
              if (forceAdvance) {
                const dilutionRange = dilution[progressionKey] || [10, 25];
                const dilutionPct = (dilutionRange[0] + Math.random() * (dilutionRange[1] - dilutionRange[0])) / 100;
                equity *= (1 - dilutionPct);
                currentStage = toStage;
                if (fromStage === "Seed") entryAmount = followOn.avgVal;
                if (fromStage === "Series A") entryAmount = followOnAB.avgVal;
                if (toStage === "IPO") {
                  exitStage = "IPO";
                  const exitRange = exitValuations["Series C"] || [100, 1000];
                  const exitValuation = exitRange[0] + Math.random() * (exitRange[1] - exitRange[0]);
                  exitAmount = equity * exitValuation * entryAmount;
                  reachedIPO = true;
                  break;
                }
                continue;
              }
              if (Math.random() * 100 < progressionProb) {
                const dilutionRange = dilution[progressionKey] || [10, 25];
                const dilutionPct = (dilutionRange[0] + Math.random() * (dilutionRange[1] - dilutionRange[0])) / 100;
                equity *= (1 - dilutionPct);
                currentStage = toStage;
                if (toStage === "IPO") {
                  exitStage = "IPO";
                  const exitRange = exitValuations["Series C"] || [100, 1000];
                  const exitValuation = exitRange[0] + Math.random() * (exitRange[1] - exitRange[0]);
                  exitAmount = equity * exitValuation * entryAmount;
                  reachedIPO = true;
                  break;
                }
              } else {
                break;
              }
            }
            const lossProb = lossProbabilities[currentStage] ?? 30;
            if (Math.random() * 100 < lossProb) {
              exitStage = currentStage;
              exitAmount = 0;
            } else if (!reachedIPO) {
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
          const irr = paidIn > 0 ? Math.min(Math.max((Math.pow(distributed / paidIn, 1/5) - 1) * 100, -50), 100) : 0;
          irrs.push(irr);
        }
        const meanMoic = moics.reduce((a, b) => a + b, 0) / moics.length;
        const meanIrr = irrs.reduce((a, b) => a + b, 0) / irrs.length;
        const results = {
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
        store.setIsSimulating(false);
      } else {
        // Fund simulation logic
        const { fundSize, initialStage, managementFeePct, managementFeeYears, deploymentYears, numSimulations, stageAllocations, valuations, checkSizes, probAdvancement, dilution, exitValuations, lossProbabilities, totalMgmtFee, deployableCapital, setSimulationResults } = store;
        const stages = ["Pre-Seed", "Seed", "Series A", "Series B"];
        const stageIndex = stages.indexOf(initialStage);
        const validStages = stages.slice(stageIndex);
        const allMoics = [];
        const allIrRs = [];
        let allInvestments = [];
        let totalPaidIn = 0;
        let totalDistributed = 0;
        for (let sim = 0; sim < numSimulations; sim++) {
          const sampleInvestments = [];
          let investmentId = 1;
          for (const stage of validStages) {
            const allocation = (stageAllocations[stage] / 100) * deployableCapital;
            let deployedInStage = 0;
            while (deployedInStage < allocation) {
              const valRange = valuations[stage] || [1, 10];
              const checkRange = checkSizes[stage] || [0.5, 2];
              const valuation = valRange[0] + Math.random() * (valRange[1] - valRange[0]);
              let checkSize = checkRange[0] + Math.random() * (checkRange[1] - checkRange[0]);
              checkSize = Math.min(checkSize, allocation - deployedInStage);
              if (checkSize < 0.1) break;
              deployedInStage += checkSize;
              let equity = checkSize / valuation;
              let currentStage = stage;
              const stagesSequence = [...stages.slice(stages.indexOf(stage)), "Series C", "IPO"];
              for (let i = 0; i < stagesSequence.length - 1; i++) {
                const prevStage = stagesSequence[i];
                const nextStage = stagesSequence[i + 1];
                const key = `${prevStage} to ${nextStage}`;
                if (Math.random() * 100 <= (probAdvancement[key] || 0)) {
                  const dilutionRange = dilution[key] || [10, 20];
                  const dilutionPct = (dilutionRange[0] + Math.random() * (dilutionRange[1] - dilutionRange[0])) / 100;
                  equity *= (1 - dilutionPct);
                  currentStage = nextStage;
                } else {
                  break;
                }
              }
              let exitAmount = 0;
              const lossProb = lossProbabilities[currentStage] ?? 30;
              if (Math.random() * 100 > lossProb) {
                const exitRange = exitValuations[currentStage] || [10, 90];
                const exitValuation = exitRange[0] + Math.random() * (exitRange[1] - exitRange[0]);
                exitAmount = equity * exitValuation;
              }
              sampleInvestments.push({
                id: `${sim + 1}-${investmentId++}`,
                entryStage: stage,
                entryAmount: checkSize,
                exitStage: currentStage,
                exitAmount: exitAmount,
              });
            }
          }
          const paidIn = sampleInvestments.reduce((sum, inv) => sum + inv.entryAmount, 0);
          const distributed = sampleInvestments.reduce((sum, inv) => sum + inv.exitAmount, 0);
          totalPaidIn += paidIn;
          totalDistributed += distributed;
          allInvestments = allInvestments.concat(sampleInvestments);
          const moic = paidIn > 0 ? distributed / paidIn : 0;
          allMoics.push(moic);
          const simplifiedIrr = Math.min(Math.max((Math.pow(moic, 1/5) - 1) * 100, -50), 100);
          allIrRs.push(simplifiedIrr);
        }
        const meanMoic = allMoics.reduce((a, b) => a + b, 0) / allMoics.length;
        const meanIrr = allIrRs.reduce((a, b) => a + b, 0) / allIrRs.length;
        const results = {
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
        setSimulationResults(results);
        toast.success("Simulation completed successfully!");
        store.setIsSimulating(false);
      }
    }
  };
  setTimeout(simulationStep, 200);
}

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
  const [showPassword, setShowPassword] = useState(false);
  const [confettiTrigger, setConfettiTrigger] = useState(false);
  const [confettiPos, setConfettiPos] = useState<{x: number, y: number}>({x: 0, y: 0});
  const srvBtnRef = useRef<HTMLAnchorElement>(null);
  const [showPortfolioOverview, setShowPortfolioOverview] = useState(false);
  const [followOn, setFollowOn] = useState({
    avgCheck: 1,
    numInvestments: 0,
    avgVal: 10,
    ownership: 10,
    inputMode: 'checkSize' as 'checkSize' | 'ownership',
    selected: {} as Record<string, number>,
  });
  const [followOnAB, setFollowOnAB] = useState({
    avgCheck: 1,
    numInvestments: 0,
    avgVal: 10,
    ownership: 10,
    inputMode: 'checkSize' as 'checkSize' | 'ownership',
    selected: {} as Record<string, number>,
  });
  const [showMoonfire, setShowMoonfire] = useState(false);
  const [isFundMode, setIsFundMode] = useState(true);

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
      {/* GitHub button: top left absolute */}
      <div className="absolute left-8 top-6 z-10">
        <a 
          href="https://github.com/LoanClt/vc-sim-playground/tree/main"
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex items-center gap-1.5 rounded-md bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-100 border border-gray-200"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-github w-4 h-4 mr-1"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 21.13V22"/></svg>
          GitHub
        </a>
      </div>
      {/* SRV website button: top right absolute */}
      <div className="absolute right-8 top-6 z-10">
        <a 
          href="https://siliconroundabout.ventures"
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-100"
        >
          <ExternalLink className="h-4 w-4 mr-1" />
          Silicon Roundabout Ventures
        </a>
      </div>
      {/* Navigation row: only Fund, Portfolio, Power-Law buttons centered */}
      <div className="flex justify-center gap-2 mb-6">
        <Button 
          variant={!isPortfolioMode && !showMoonfire ? 'default' : 'outline'}
          onClick={() => { setIsPortfolioMode(false); setShowMoonfire(false); setIsFundMode(true); }}
          className="px-6"
        >
          Fund
        </Button>
        <Button 
          variant={isPortfolioMode && !showMoonfire ? 'default' : 'outline'}
          onClick={() => {
            if (portfolioUnlocked) {
              setIsPortfolioMode(true);
              setShowMoonfire(false);
              setIsFundMode(false);
            } else {
              setShowPasswordDialog(true);
            }
          }}
          className="px-6"
        >
          Portfolio
        </Button>
        <Button
          variant={showMoonfire ? 'default' : 'outline'}
          onClick={() => { setShowMoonfire(true); setIsPortfolioMode(false); setIsFundMode(false); }}
          className="px-6"
        >
          Power-Law
        </Button>
      </div>
      {showMoonfire ? (
        <MoonfireSimulator layout="split" />
      ) : (
        <>
          {/* Confetti keyframes */}
          <style>{`
            @keyframes confetti-burst {
              0% { opacity: 1; transform: translate(-50%, -50%) scale(1) rotate(var(--rotate, 0deg)); }
              80% { opacity: 1; }
              100% { opacity: 0; transform: translate(calc(-50% + var(--x, 0px)), calc(-50% + var(--y, 0px))) scale(0.7) rotate(var(--rotate, 0deg)); }
            }
          `}</style>
          {/* Confetti burst overlay */}
          <ConfettiBurst trigger={confettiTrigger} x={confettiPos.x} y={confettiPos.y} />
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
                        <div className="flex items-center justify-between mb-2">
                          <h2 className="text-lg font-semibold">Your Portfolio Companies</h2>
                          <Button
                            variant={showPortfolioOverview ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => {
                              if (portfolioCompanies.length === 0) {
                                toast.error('Portfolio is empty. Add companies before viewing the overview.');
                                return;
                              }
                              setShowPortfolioOverview(v => !v);
                            }}
                          >
                            {showPortfolioOverview ? 'Back to Results' : 'Portfolio Overview'}
                          </Button>
                        </div>
                        <p className="text-sm text-gray-500 mb-2">
                          Add your portfolio companies to simulate their growth
                        </p>
                        <PortfolioManager />
                        <Card className="p-4 mt-0">
                          <div className="mb-3">
                            <h3 className="text-sm font-medium">Follow-ons (Seed-A)</h3>
                            <div className="flex items-center mt-2">
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={followOn.inputMode === 'ownership'}
                                  onChange={e => setFollowOn(f => ({ ...f, inputMode: e.target.checked ? 'ownership' : 'checkSize' }))}
                                  className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:bg-blue-600 transition-all duration-200"></div>
                                <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 peer-checked:translate-x-5"></div>
                              </label>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3 mb-3">
                            <div>
                              <label className="text-xs font-medium block mb-1">Avg Check Size ($MM)</label>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={followOn.avgCheck}
                                readOnly={followOn.inputMode === 'ownership'}
                                className={followOn.inputMode === 'ownership' ? 'bg-gray-100 cursor-not-allowed' : ''}
                                onChange={e => {
                                  const avgCheck = parseFloat(e.target.value) || 0;
                                  let ownership = followOn.ownership;
                                  let avgVal = followOn.avgVal;
                                  if (followOn.inputMode === 'checkSize') {
                                    ownership = avgVal > 0 ? (avgCheck / avgVal) * 100 : 0;
                                  }
                                  setFollowOn(f => ({ ...f, avgCheck, ownership }));
                                }}
                              />
                            </div>
                            <div>
                              <label className="text-xs font-medium block mb-1">Avg Valuation ($MM)</label>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={followOn.avgVal}
                                onChange={e => {
                                  const avgVal = parseFloat(e.target.value) || 0;
                                  let avgCheck = followOn.avgCheck;
                                  let ownership = followOn.ownership;
                                  if (followOn.inputMode === 'checkSize') {
                                    ownership = avgVal > 0 ? (avgCheck / avgVal) * 100 : 0;
                                  } else {
                                    avgCheck = (ownership / 100) * avgVal;
                                  }
                                  setFollowOn(f => ({ ...f, avgVal, avgCheck, ownership }));
                                }}
                              />
                            </div>
                            {followOn.inputMode === 'checkSize' ? (
                              <>
                                <div>
                                  <label className="text-xs font-medium block mb-1">Ownership (%)</label>
                                  <Input
                                    type="number"
                                    value={followOn.ownership.toFixed(2)}
                                    readOnly
                                    className="bg-gray-100 cursor-not-allowed"
                                  />
                                </div>
                              </>
                            ) : (
                              <>
                                <div>
                                  <label className="text-xs font-medium block mb-1">Ownership (%)</label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max="100"
                                    value={followOn.ownership}
                                    onChange={e => {
                                      const ownership = parseFloat(e.target.value) || 0;
                                      const avgCheck = (ownership / 100) * followOn.avgVal;
                                      setFollowOn(f => ({ ...f, ownership, avgCheck }));
                                    }}
                                  />
                                </div>
                              </>
                            )}
                          </div>
                          <div className="mb-2">
                            <label className="text-xs font-medium block mb-1">Select Seed Companies for Follow-ons</label>
                            <div className="max-h-40 overflow-y-auto border rounded p-2 bg-gray-50">
                              {portfolioCompanies.filter(c => c.stage === 'Seed').length === 0 ? (
                                <div className="text-xs text-gray-400">No Seed companies in portfolio.</div>
                              ) : (
                                portfolioCompanies.filter(c => c.stage === 'Seed').map((company, idx) => (
                                  <div key={company.id} className="flex items-center gap-2 mb-1">
                                    <input
                                      type="checkbox"
                                      checked={!!(followOn.selected && followOn.selected[company.id])}
                                      onChange={e => {
                                        const selected = { ...(followOn.selected || {}) };
                                        if (e.target.checked) {
                                          selected[company.id] = 1;
                                        } else {
                                          delete selected[company.id];
                                        }
                                        setFollowOn(f => ({ ...f, selected }));
                                      }}
                                    />
                                    <span className="text-xs font-medium flex-1">{company.name}</span>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                          {/* Number of investments above capital deployed */}
                          <div className="text-xs text-gray-700 mt-2 text-right">
                            Number of Investments: <span className="font-semibold">{(() => {
                              const selected = followOn.selected || {};
                              return Object.values(selected).reduce((a: number, b: number) => a + (typeof b === 'number' ? b : 0), 0);
                            })()}</span>
                          </div>
                          <div className="text-xs text-gray-700 text-right">
                            Capital Deployed: <span className="font-semibold">{(() => {
                              const selected = followOn.selected || {};
                              const numInvestments = Object.values(selected).reduce((a: number, b: number) => a + (typeof b === 'number' ? b : 0), 0);
                              return (followOn.avgCheck * numInvestments).toFixed(2);
                            })()} $MM</span>
                          </div>
                        </Card>
                        {/* Follow-ons (A-B) */}
                        <Card className="p-4 mt-0">
                          <div className="mb-3">
                            <h3 className="text-sm font-medium">Follow-ons (A-B)</h3>
                            <div className="flex items-center mt-2">
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={followOnAB.inputMode === 'ownership'}
                                  onChange={e => setFollowOnAB(f => ({ ...f, inputMode: e.target.checked ? 'ownership' : 'checkSize' }))}
                                  className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:bg-blue-600 transition-all duration-200"></div>
                                <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 peer-checked:translate-x-5"></div>
                              </label>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3 mb-3">
                            <div>
                              <label className="text-xs font-medium block mb-1">Avg Check Size ($MM)</label>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={followOnAB.avgCheck}
                                readOnly={followOnAB.inputMode === 'ownership'}
                                className={followOnAB.inputMode === 'ownership' ? 'bg-gray-100 cursor-not-allowed' : ''}
                                onChange={e => {
                                  const avgCheck = parseFloat(e.target.value) || 0;
                                  let ownership = followOnAB.ownership;
                                  let avgVal = followOnAB.avgVal;
                                  if (followOnAB.inputMode === 'checkSize') {
                                    ownership = avgVal > 0 ? (avgCheck / avgVal) * 100 : 0;
                                  }
                                  setFollowOnAB(f => ({ ...f, avgCheck, ownership }));
                                }}
                              />
                            </div>
                            <div>
                              <label className="text-xs font-medium block mb-1">Avg Valuation ($MM)</label>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={followOnAB.avgVal}
                                onChange={e => {
                                  const avgVal = parseFloat(e.target.value) || 0;
                                  let avgCheck = followOnAB.avgCheck;
                                  let ownership = followOnAB.ownership;
                                  if (followOnAB.inputMode === 'checkSize') {
                                    ownership = avgVal > 0 ? (avgCheck / avgVal) * 100 : 0;
                                  } else {
                                    avgCheck = (ownership / 100) * avgVal;
                                  }
                                  setFollowOnAB(f => ({ ...f, avgVal, avgCheck, ownership }));
                                }}
                              />
                            </div>
                            {followOnAB.inputMode === 'checkSize' ? (
                              <>
                                <div>
                                  <label className="text-xs font-medium block mb-1">Ownership (%)</label>
                                  <Input
                                    type="number"
                                    value={followOnAB.ownership.toFixed(2)}
                                    readOnly
                                    className="bg-gray-100 cursor-not-allowed"
                                  />
                                </div>
                              </>
                            ) : (
                              <>
                                <div>
                                  <label className="text-xs font-medium block mb-1">Ownership (%)</label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max="100"
                                    value={followOnAB.ownership}
                                    onChange={e => {
                                      const ownership = parseFloat(e.target.value) || 0;
                                      const avgCheck = (ownership / 100) * followOnAB.avgVal;
                                      setFollowOnAB(f => ({ ...f, ownership, avgCheck }));
                                    }}
                                  />
                                </div>
                              </>
                            )}
                          </div>
                          <div className="mb-2">
                            <label className="text-xs font-medium block mb-1">Select Series A Companies for Follow-ons</label>
                            <div className="max-h-40 overflow-y-auto border rounded p-2 bg-gray-50">
                              {portfolioCompanies.filter(c => c.stage === 'Series A').length === 0 ? (
                                <div className="text-xs text-gray-400">No Series A companies in portfolio.</div>
                              ) : (
                                portfolioCompanies.filter(c => c.stage === 'Series A').map((company, idx) => (
                                  <div key={company.id} className="flex items-center gap-2 mb-1">
                                    <input
                                      type="checkbox"
                                      checked={!!(followOnAB.selected && followOnAB.selected[company.id])}
                                      onChange={e => {
                                        const selected = { ...(followOnAB.selected || {}) };
                                        if (e.target.checked) {
                                          selected[company.id] = 1;
                                        } else {
                                          delete selected[company.id];
                                        }
                                        setFollowOnAB(f => ({ ...f, selected }));
                                      }}
                                    />
                                    <span className="text-xs font-medium flex-1">{company.name}</span>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                          {/* Number of investments above capital deployed */}
                          <div className="text-xs text-gray-700 mt-2 text-right">
                            Number of Investments: <span className="font-semibold">{(() => {
                              const selected = followOnAB.selected || {};
                              return Object.values(selected).reduce((a: number, b: number) => a + (typeof b === 'number' ? b : 0), 0);
                            })()}</span>
                          </div>
                          <div className="text-xs text-gray-700 text-right">
                            Capital Deployed: <span className="font-semibold">{(() => {
                              const selected = followOnAB.selected || {};
                              const numInvestments = Object.values(selected).reduce((a: number, b: number) => a + (typeof b === 'number' ? b : 0), 0);
                              return (followOnAB.avgCheck * numInvestments).toFixed(2);
                            })()} $MM</span>
                          </div>
                        </Card>
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

            {/* Results Panel or Portfolio Overview */}
            <div className="md:col-span-2">
              {isPortfolioMode && showPortfolioOverview ? (
                <Card className="p-4">
                  <h2 className="text-xl font-semibold mb-4">Portfolio Overview</h2>
                  <PortfolioOverviewPanel companies={portfolioCompanies} followOn={followOn} followOnAB={followOnAB} />
                </Card>
              ) : (
                <Card className="p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold">Simulation Results</h2>
                    <div className="flex gap-2 items-center">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={runSimulationFromApp}
                        disabled={useVCFundStore.getState().isSimulating}
                      >
                        {useVCFundStore.getState().isSimulating ? 'Simulating...' : 'Run Simulation'}
                      </Button>
                      {results && <SaveSimulationResults resultsRef={resultsRef} />}
                    </div>
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
                        {/* DPI for Fund Mode */}
                        {!isPortfolioMode && (
                          <div className="bg-gray-100 p-3 rounded-lg">
                            <div className="text-sm text-gray-500">DPI</div>
                            <div className="text-xl font-semibold">
                              {(results.paidIn > 0 ? (results.distributed / results.paidIn) : 0).toFixed(2)}
                            </div>
                          </div>
                        )}
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
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setSelectedSim(s => Math.max(1, s - 1))}
                              disabled={selectedSim === 1}
                              className="px-1"
                            >
                              <ArrowLeft className="w-4 h-4" />
                            </Button>
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
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setSelectedSim(s => Math.min(useVCFundStore.getState().numSimulations, s + 1))}
                              disabled={selectedSim === useVCFundStore.getState().numSimulations}
                              className="px-1"
                            >
                              <ArrowRight className="w-4 h-4" />
                            </Button>
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
                                return invs.slice(0, numToShow).map((inv: Investment, idx: number) => ({
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
                                return invs.slice(0, numToShow).map((inv: Investment, idx: number) => {
                                  const entryStage = inv.entryStage || "";
                                  const exitStage = inv.exitStage || "";
                                  let companyLabel: string = String(idx + 1);
                                  let showFollowOnStar = false;
                                  if (isPortfolioMode) {
                                    // inv.id is in the format 'sim-companyId'
                                    const idParts = String(inv.id).split('-');
                                    const companyId = idParts.length > 1 ? idParts.slice(1).join('-') : idParts[0];
                                    companyLabel = companyNameMap[companyId] || companyLabel;
                                    // Use followOn and followOnAB from closure (App state)
                                    showFollowOnStar = !!((followOn.selected && followOn.selected[companyId]) || (followOnAB.selected && followOnAB.selected[companyId]));
                                  }
                                  return (
                                    <tr key={idx} className="border-b border-gray-200">
                                      <td className="px-4 py-2 flex items-center gap-1">
                                        {/* Rocket icon if multiple > 2 */}
                                        {inv.entryAmount > 0 && (inv.exitAmount / inv.entryAmount) > 2 && (
                                          <Rocket className="w-4 h-4 text-orange-500" />
                                        )}
                                        {isPortfolioMode && showFollowOnStar && (
                                          <Star className="w-4 h-4 text-yellow-400" />
                                        )}
                                        {companyLabel}
                                      </td>
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
              )}
            </div>
          </div>

          {/* Portfolio Password Dialog */}
          <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Portfolio mode</DialogTitle>
              </DialogHeader>
              <div className="py-2">
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
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
                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    onClick={() => setShowPassword(prev => !prev)}
                    tabIndex={-1}
                    style={{ background: 'none', border: 'none', padding: 0 }}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <div className="text-xs text-gray-500 mt-2">This feature is in beta.</div>
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
        </>
      )}
      <Analytics />
    </div>
  );
}

export default App;