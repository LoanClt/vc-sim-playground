import { create } from 'zustand';

export type Investment = {
  id: number | string;
  entryStage: string;
  entryAmount: number;
  exitStage: string;
  exitAmount: number;
};

export type SimulationResults = {
  moics: number[];
  irrs: number[];
  meanMoic: number;
  meanIrr: number;
  investments: Investment[];
  paidIn: number;
  distributed: number;
  numInvestments: number;
  managementFees: number;
};

// Portfolio company type
export type PortfolioCompany = {
  id: string;
  name: string;
  stage: string;
  valuation: number;
  checkSize: number;
  ownership: number;
  entryDate: Date;
};

// Type for shareable parameters
export type ShareableParameters = {
  fundSize: number;
  initialStage: string;
  managementFeePct: number;
  managementFeeYears: number;
  deploymentYears: number;
  numSimulations: number;
  stageAllocations: Record<string, number>;
  valuations: Record<string, [number, number]>;
  checkSizes: Record<string, [number, number]>;
  probAdvancement: Record<string, number>;
  dilution: Record<string, [number, number]>;
  // Adding portfolio companies
  portfolioCompanies?: PortfolioCompany[];
};

type VCFundStore = {
  // Fund parameters
  fundSize: number;
  setFundSize: (size: number) => void;
  
  initialStage: string;
  setInitialStage: (stage: string) => void;
  
  managementFeePct: number;
  setManagementFeePct: (fee: number) => void;
  
  managementFeeYears: number;
  setManagementFeeYears: (years: number) => void;
  
  deploymentYears: number;
  setDeploymentYears: (years: number) => void;
  
  numSimulations: number;
  setNumSimulations: (num: number) => void;
  
  // Stage allocations
  stageAllocations: Record<string, number>;
  setStageAllocations: (allocations: Record<string, number>) => void;
  updateStageAllocation: (stage: string, value: number) => void;
  
  // Valuations
  valuations: Record<string, [number, number]>;
  setValuations: (vals: Record<string, [number, number]>) => void;
  updateValuation: (stage: string, values: [number, number]) => void;
  
  // Check sizes
  checkSizes: Record<string, [number, number]>;
  setCheckSizes: (sizes: Record<string, [number, number]>) => void;
  updateCheckSize: (stage: string, values: [number, number]) => void;
  
  // Progression probabilities
  probAdvancement: Record<string, number>;
  setProbAdvancement: (probs: Record<string, number>) => void;
  updateProbAdvancement: (transition: string, value: number) => void;
  
  // Dilution
  dilution: Record<string, [number, number]>;
  setDilution: (dil: Record<string, [number, number]>) => void;
  updateDilution: (transition: string, values: [number, number]) => void;
  
  // Exit valuations
  exitValuations: Record<string, [number, number]>;
  setExitValuations: (vals: Record<string, [number, number]>) => void;
  updateExitValuation: (stage: string, values: [number, number]) => void;
  
  // Loss probabilities
  lossProbabilities: Record<string, number>;
  setLossProbabilities: (probs: Record<string, number>) => void;
  updateLossProbability: (stage: string, value: number) => void;
  
  // Results
  simulationResults: SimulationResults | null;
  setSimulationResults: (results: SimulationResults | null) => void;
  
  // Status
  isSimulating: boolean;
  setIsSimulating: (value: boolean) => void;
  
  // Derived values
  totalMgmtFee: number;
  deployableCapital: number;
  
  // Sharing functionality
  exportParameters: () => string;
  importParameters: (data: string) => boolean;
  simulationProgress: number;
  setSimulationProgress: (value: number) => void;

  // Portfolio companies
  portfolioCompanies: PortfolioCompany[];
  addPortfolioCompany: (company: Omit<PortfolioCompany, 'id'>) => void;
  removePortfolioCompany: (id: string) => void;
  updatePortfolioCompany: (id: string, updates: Partial<Omit<PortfolioCompany, 'id'>>) => void;
  portfolioSimulationResults: SimulationResults | null;
  setPortfolioSimulationResults: (results: SimulationResults | null) => void;
  isPortfolioMode: boolean;
  setIsPortfolioMode: (value: boolean) => void;

  // Portfolio saving functionality
  savePortfolio: () => string;
  loadPortfolio: (data: string) => boolean;
};

export const useVCFundStore = create<VCFundStore>((set, get) => ({
  // Fund parameters
  fundSize: 100,
  setFundSize: (size) => set((state) => ({
    fundSize: size,
    // Recalculate derived values
    totalMgmtFee: size * (state.managementFeePct / 100) * state.managementFeeYears,
    deployableCapital: size - (size * (state.managementFeePct / 100) * state.managementFeeYears)
  })),
  
  initialStage: 'Pre-Seed',
  setInitialStage: (stage) => {
    // When stage changes, we need to recompute allocations
    set({ initialStage: stage });
    
    // This will trigger useEffect in App.tsx to recompute allocations
  },
  
  managementFeePct: 2.0,
  setManagementFeePct: (fee) => set((state) => ({
    managementFeePct: fee,
    // Recalculate derived values
    totalMgmtFee: state.fundSize * (fee / 100) * state.managementFeeYears,
    deployableCapital: state.fundSize - (state.fundSize * (fee / 100) * state.managementFeeYears)
  })),
  
  managementFeeYears: 10,
  setManagementFeeYears: (years) => set((state) => ({
    managementFeeYears: years,
    // Recalculate derived values
    totalMgmtFee: state.fundSize * (state.managementFeePct / 100) * years,
    deployableCapital: state.fundSize - (state.fundSize * (state.managementFeePct / 100) * years)
  })),
  
  deploymentYears: 5,
  setDeploymentYears: (years) => set({ deploymentYears: years }),
  
  numSimulations: 100,
  setNumSimulations: (num) => set({ numSimulations: num }),
  
  // Stage allocations
  stageAllocations: {
    'Pre-Seed': 20,
    'Seed': 60,
    'Series A': 10,
    'Series B': 10
  },
  setStageAllocations: (allocations) => set({ stageAllocations: allocations }),
  updateStageAllocation: (stage, value) => {
    const { stageAllocations } = get();
    const newAllocations = { ...stageAllocations };
    const stages = ['Pre-Seed', 'Seed', 'Series A', 'Series B'];
    const stageIndex = stages.indexOf(get().initialStage);
    const validStages = stages.slice(stageIndex);
    
    const oldValue = stageAllocations[stage] || 0;
    newAllocations[stage] = value;
    
    // Calculate remaining allocation
    let sumAllocations = 0;
    validStages.forEach(s => {
      if (s !== validStages[validStages.length - 1]) {
        sumAllocations += s === stage ? value : (newAllocations[s] || 0);
      }
    });
    
    // Adjust last stage allocation
    const lastStage = validStages[validStages.length - 1];
    newAllocations[lastStage] = Math.max(0, 100 - sumAllocations);
    
    set({ stageAllocations: newAllocations });
  },
  
  // Valuations - defaults
  valuations: {
    'Pre-Seed': [3, 6],
    'Seed': [8, 15],
    'Series A': [40, 80],
    'Series B': [100, 150]
  },
  setValuations: (vals) => set({ valuations: vals }),
  updateValuation: (stage, values) => {
    const { valuations } = get();
    const newValuations = { ...valuations };
    newValuations[stage] = values;
    set({ valuations: newValuations });
  },
  
  // Check sizes - defaults
  checkSizes: {
    'Pre-Seed': [1.0, 1.5],
    'Seed': [2.0, 5.0],
    'Series A': [5.0, 10.0],
    'Series B': [5, 10]
  },
  setCheckSizes: (sizes) => set({ checkSizes: sizes }),
  updateCheckSize: (stage, values) => {
    const { checkSizes } = get();
    const newCheckSizes = { ...checkSizes };
    newCheckSizes[stage] = values;
    set({ checkSizes: newCheckSizes });
  },
  
  // Progression probabilities - defaults
  probAdvancement: {
    'Pre-Seed to Seed': 50,
    'Seed to Series A': 33,
    'Series A to Series B': 48,
    'Series B to Series C': 43,
    'Series C to IPO': 28
  },
  setProbAdvancement: (probs) => set({ probAdvancement: probs }),
  updateProbAdvancement: (transition, value) => {
    const { probAdvancement } = get();
    const newProbs = { ...probAdvancement };
    newProbs[transition] = value;
    set({ probAdvancement: newProbs });
  },
  
  // Dilution - defaults
  dilution: {
    'Pre-Seed to Seed': [10, 25],
    'Seed to Series A': [10, 25],
    'Series A to Series B': [10, 25],
    'Series B to Series C': [10, 15],
    'Series C to IPO': [10, 15]
  },
  setDilution: (dil) => set({ dilution: dil }),
  updateDilution: (transition, values) => {
    const { dilution } = get();
    const newDilution = { ...dilution };
    newDilution[transition] = values;
    set({ dilution: newDilution });
  },
  
  // Exit valuations - defaults
  exitValuations: {
    'Pre-Seed': [4, 10],
    'Seed': [5, 10],
    'Series A': [20, 40],
    'Series B': [40, 120],
    'Series C': [200, 500],
    'IPO': [1000, 2000]
  },
  setExitValuations: (vals) => set({ exitValuations: vals }),
  updateExitValuation: (stage, values) => {
    const { exitValuations } = get();
    const newVals = { ...exitValuations };
    newVals[stage] = values;
    set({ exitValuations: newVals });
  },
  
  // Loss probabilities - defaults
  lossProbabilities: {
    'Pre-Seed': 30,
    'Seed': 30,
    'Series A': 30,
    'Series B': 20,
    'Series C': 20,
    'IPO': 0
  },
  setLossProbabilities: (probs) => set({ lossProbabilities: probs }),
  updateLossProbability: (stage, value) => {
    const { lossProbabilities } = get();
    const newProbs = { ...lossProbabilities };
    newProbs[stage] = value;
    set({ lossProbabilities: newProbs });
  },
  
  // Results
  simulationResults: null,
  setSimulationResults: (results) => set({ simulationResults: results }),
  
  // Status
  isSimulating: false,
  setIsSimulating: (value) => set({ isSimulating: value }),
  
  // Initial derived values
  totalMgmtFee: 20, // Initial value: 100 * 0.02 * 10
  deployableCapital: 80, // Initial value: 100 - 20
  
  // Simulation progress
  simulationProgress: 0,
  setSimulationProgress: (value) => set({ simulationProgress: value }),
  
  // Share functionality
  exportParameters: () => {
    const state = get();
    const exportData: ShareableParameters = {
      fundSize: state.fundSize,
      initialStage: state.initialStage,
      managementFeePct: state.managementFeePct,
      managementFeeYears: state.managementFeeYears,
      deploymentYears: state.deploymentYears,
      numSimulations: state.numSimulations,
      stageAllocations: state.stageAllocations,
      valuations: state.valuations,
      checkSizes: state.checkSizes,
      probAdvancement: state.probAdvancement,
      dilution: state.dilution,
      portfolioCompanies: state.portfolioCompanies
    };
    
    // Convert to base64 encoded JSON
    return btoa(JSON.stringify(exportData));
  },
  
  importParameters: (data: string) => {
    try {
      const importData = JSON.parse(atob(data)) as ShareableParameters;
      
      // Update all parameters including portfolio companies
      set((state) => ({
        fundSize: importData.fundSize,
        initialStage: importData.initialStage,
        managementFeePct: importData.managementFeePct,
        managementFeeYears: importData.managementFeeYears,
        deploymentYears: importData.deploymentYears,
        numSimulations: importData.numSimulations,
        stageAllocations: importData.stageAllocations,
        valuations: importData.valuations,
        checkSizes: importData.checkSizes,
        probAdvancement: importData.probAdvancement,
        dilution: importData.dilution,
        portfolioCompanies: importData.portfolioCompanies || [],
        // Recalculate derived values
        totalMgmtFee: importData.fundSize * (importData.managementFeePct / 100) * importData.managementFeeYears,
        deployableCapital: importData.fundSize - (importData.fundSize * (importData.managementFeePct / 100) * importData.managementFeeYears)
      }));
      
      return true;
    } catch (error) {
      console.error('Error importing portfolio:', error);
      return false;
    }
  },

  // Portfolio companies
  portfolioCompanies: [],
  addPortfolioCompany: (company) => set((state) => ({
    portfolioCompanies: [
      ...state.portfolioCompanies,
      {
        ...company,
        id: crypto.randomUUID()
      }
    ]
  })),
  removePortfolioCompany: (id) => set((state) => ({
    portfolioCompanies: state.portfolioCompanies.filter(company => company.id !== id)
  })),
  updatePortfolioCompany: (id, updates) => set((state) => ({
    portfolioCompanies: state.portfolioCompanies.map(company => 
      company.id === id
        ? { ...company, ...updates }
        : company
    )
  })),
  portfolioSimulationResults: null,
  setPortfolioSimulationResults: (results) => set({ portfolioSimulationResults: results }),
  isPortfolioMode: false,
  setIsPortfolioMode: (value) => set({ isPortfolioMode: value }),
  
  // Portfolio saving functionality
  savePortfolio: () => {
    const state = get();
    const portfolioData = {
      portfolioCompanies: state.portfolioCompanies,
      probAdvancement: state.probAdvancement,
      timestamp: new Date().toISOString()
    };
    
    return JSON.stringify(portfolioData, null, 2);
  },
  
  loadPortfolio: (data: string) => {
    try {
      const portfolioData = JSON.parse(data);
      
      if (!portfolioData.portfolioCompanies || !Array.isArray(portfolioData.portfolioCompanies)) {
        console.error('Invalid portfolio data format');
        return false;
      }
      
      // Update the store with the loaded portfolio companies
      set((state) => ({
        portfolioCompanies: portfolioData.portfolioCompanies,
        probAdvancement: portfolioData.probAdvancement || state.probAdvancement,
        isPortfolioMode: true
      }));
      
      return true;
    } catch (error) {
      console.error('Error loading portfolio:', error);
      return false;
    }
  }
}));