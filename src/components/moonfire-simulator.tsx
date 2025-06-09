import React, { useState, useRef, useEffect, useCallback, Fragment } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ReferenceLine, Legend, ComposedChart, Area, LineChart } from 'recharts';
import { Share2, AlertTriangle, BarChart2, TrendingUp, Sigma, Hash, ArrowDownCircle, PercentCircle, Copy, Info, Search } from 'lucide-react';
import { toast } from 'sonner';
import chroma from 'chroma-js';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Popover, PopoverTrigger, PopoverContent } from './ui/popover';
import { Slider } from './ui/slider';
import { BlockMath, InlineMath } from 'react-katex';
import 'katex/dist/katex.min.css';

// Bounded Pareto distribution (power law) as in the Python code
function boundedParetoRVS(alpha: number, xMin: number, xMax: number, size: number): number[] {
  const samples: number[] = [];
  for (let i = 0; i < size; i++) {
    const u = Math.random();
    if (alpha === 1) {
      samples.push(xMin * Math.pow(xMax / xMin, u));
    } else {
      const term1 = Math.pow(xMin, 1 - alpha);
      const term2 = Math.pow(xMax, 1 - alpha);
      samples.push(Math.pow(term1 - u * (term1 - term2), 1 / (1 - alpha)));
    }
  }
  return samples;
}

function quantile(arr: number[], q: number) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  } else {
    return sorted[base];
  }
}

function runMoonfireSimulation({
  alpha,
  xMin,
  xMax,
  nInvestments,
  nSimulations,
  totalInvestment = 1.0
}: {
  alpha: number;
  xMin: number;
  xMax: number;
  nInvestments: number;
  nSimulations: number;
  totalInvestment?: number;
}) {
  const perInvestmentValue = totalInvestment / nInvestments;
  const portfolioReturns: number[] = [];
  const allInvestmentReturns: number[][] = [];
  let minReturn = Infinity;
  let maxReturn = -Infinity;
  const t0 = performance.now();
  for (let sim = 0; sim < nSimulations; sim++) {
    // Sample N investments
    const rawReturns = boundedParetoRVS(alpha, xMin, xMax + xMin, nInvestments);
    // Adjust: subtract xMin, scale by per-investment value
    const adjustedReturns = rawReturns.map(r => (r - xMin) * perInvestmentValue);
    const portfolioReturn = adjustedReturns.reduce((a, b) => a + b, 0);
    portfolioReturns.push(portfolioReturn);
    if (sim < 1000) allInvestmentReturns.push(adjustedReturns);
    if (portfolioReturn < minReturn) minReturn = portfolioReturn;
    if (portfolioReturn > maxReturn) maxReturn = portfolioReturn;
  }
  const t1 = performance.now();
  // Stats
  const mean = portfolioReturns.reduce((a, b) => a + b, 0) / portfolioReturns.length;
  const std = Math.sqrt(portfolioReturns.reduce((a, b) => a + (b - mean) ** 2, 0) / portfolioReturns.length);
  const median = quantile(portfolioReturns, 0.5);
  const probLoss = portfolioReturns.filter(x => x < totalInvestment).length / portfolioReturns.length;
  const prob2x = portfolioReturns.filter(x => x >= 2 * totalInvestment).length / portfolioReturns.length;
  const prob5x = portfolioReturns.filter(x => x >= 5 * totalInvestment).length / portfolioReturns.length;
  const prob10x = portfolioReturns.filter(x => x >= 10 * totalInvestment).length / portfolioReturns.length;
  const quantile01 = quantile(portfolioReturns, 0.01);
  const quantile05 = quantile(portfolioReturns, 0.05);
  const quantile10 = quantile(portfolioReturns, 0.10);
  const quantile25 = quantile(portfolioReturns, 0.25);
  const quantile75 = quantile(portfolioReturns, 0.75);
  const quantile90 = quantile(portfolioReturns, 0.90);
  const quantile95 = quantile(portfolioReturns, 0.95);
  const quantile99 = quantile(portfolioReturns, 0.99);
  return {
    portfolioReturns,
    mean,
    std,
    median,
    probLoss,
    prob2x,
    prob5x,
    prob10x,
    quantile01,
    quantile05,
    quantile10,
    quantile25,
    quantile75,
    quantile90,
    quantile95,
    quantile99,
    minReturn,
    maxReturn,
    allInvestmentReturns,
    executionTime: (t1 - t0) / 1000
  };
}

// Add a simple heatmap component for the first 50 simulations x N investments
function SimpleHeatmap({ data }: { data: number[][] }) {
  // data: [sim][investment]
  const nSims = data.length;
  const nInv = data[0]?.length || 0;
  const max = Math.max(...data.flat());
  const min = Math.min(...data.flat());
  // Color scale: blue (low) to yellow (high)
  function color(val: number) {
    const t = (val - min) / (max - min + 1e-8);
    const c = Math.floor(255 * t);
    return `rgb(${255},${255},${255 - c})`;
  }
  return (
    <div style={{ overflowX: 'auto', border: '1px solid #eee', borderRadius: 4 }}>
      <table style={{ borderCollapse: 'collapse' }}>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>
              {row.map((val, j) => (
                <td key={j} style={{ width: 8, height: 8, background: color(val), border: '1px solid #eee' }} title={`Sim ${i + 1}, Inv ${j + 1}: ${val.toFixed(2)}`}></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Helper to run simulation for a given portfolio size
function runPortfolioSizeAnalysis(alpha: number, xMin: number, xMax: number, nSimulations: number, sizes: number[]) {
  const results = sizes.map(size => {
    const sim = runMoonfireSimulation({ alpha, xMin, xMax, nInvestments: size, nSimulations });
    // Compute Sharpe-like ratio (mean - 1) / std, as in the Python code
    const sharpe = sim.std > 0 ? (sim.mean - 1) / sim.std : 0;
    return {
      size,
      mean: sim.mean,
      std: sim.std,
      probLoss: sim.probLoss,
      prob2x: sim.prob2x,
      prob10x: sim.prob10x,
      returns: sim.portfolioReturns,
      sharpe,
    };
  });
  return results;
}

// Add this before the first use of violinSizes (before line 206)
const violinSizes = [10, 25, 50, 100, 200, 500];

// Add a function to generate heatmap data for investment returns
function generateHeatmapData(alpha: number, xMin: number, xMax: number, nInvestments: number, nSimulations: number) {
  const data: number[][] = [];
  for (let i = 0; i < nSimulations; i++) {
    const rawReturns = boundedParetoRVS(alpha, xMin, xMax + xMin, nInvestments);
    const adjustedReturns = rawReturns.map(r => (r - xMin) * (1.0 / nInvestments));
    data.push(adjustedReturns);
  }
  return data;
}

export function MoonfireSimulator({ layout }: { layout?: 'split' }) {
  const [alpha, setAlpha] = useState(2.05);
  const [xMin, setXMin] = useState(0.35);
  const [xMax, setXMax] = useState(1000);
  const [nInvestments, setNInvestments] = useState(100);
  const [nSimulations, setNSimulations] = useState(10000);
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('hist');
  const [sizeAnalysis, setSizeAnalysis] = useState<any[] | null>(null);
  const [sizeLoading, setSizeLoading] = useState(false);
  const MAX_SIMULATIONS = 1000000;
  const [simError, setSimError] = useState<string | null>(null);
  const [heatmapData, setHeatmapData] = useState<number[][] | null>(null);
  const [heatmapStats, setHeatmapStats] = useState<any>(null);
  const nSimulationsHeatmap = 50;
  const quantileOptions = [
    { label: '1% Quantile', value: 'quantile01' },
    { label: '5% Quantile', value: 'quantile05' },
    { label: '10% Quantile', value: 'quantile10' },
    { label: '25% Quantile', value: 'quantile25' },
    { label: '50% Quantile (Median)', value: 'median' },
    { label: '75% Quantile', value: 'quantile75' },
    { label: '90% Quantile', value: 'quantile90' },
    { label: '95% Quantile', value: 'quantile95' },
    { label: '99% Quantile', value: 'quantile99' },
  ];
  const [selectedQuantile, setSelectedQuantile] = useState('quantile01');
  const probabilityOptions = [
    { label: 'Prob. Loss', value: 'probLoss', display: 'Probability of Loss (Return < 1x)' },
    { label: 'Prob. 2x+', value: 'prob2x', display: 'Probability of 2x+' },
    { label: 'Prob. 5x+', value: 'prob5x', display: 'Probability of 5x+' },
    { label: 'Prob. 10x+', value: 'prob10x', display: 'Probability of 10x+' },
  ];
  const [selectedProbability, setSelectedProbability] = useState('probLoss');
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [showInfo, setShowInfo] = useState(false);
  // Add state for histogram x-axis range
  const [histXMin, setHistXMin] = useState<number | null>(null);
  const [histXMax, setHistXMax] = useState<number | null>(null);
  // Add local state for input fields
  const [pendingHistXMin, setPendingHistXMin] = useState<string>('');
  const [pendingHistXMax, setPendingHistXMax] = useState<string>('');
  // Add state for toggling reference lines on the histogram
  const [showMean, setShowMean] = useState(true);
  const [showMedian, setShowMedian] = useState(true);
  const [showBreakEven, setShowBreakEven] = useState(true);
  // Add state for interactive legend highlight
  const [highlightedSize, setHighlightedSize] = useState<number | null>(null);
  const chartRef = useRef<any>(null);
  const [batchSimIndex, setBatchSimIndex] = useState(0); // For batch overview navigation

  // Sync input fields to results or histXMin/Max when results change
  useEffect(() => {
    if (results) {
      setPendingHistXMin((histXMin !== null ? histXMin : results.minReturn).toString());
      setPendingHistXMax((histXMax !== null ? histXMax : results.maxReturn).toString());
    }
    // eslint-disable-next-line
  }, [results]);

  // Only run simulation when user clicks the button
  const handleRunSimulation = () => {
    setLoading(true);
    setSizeLoading(true);
    setTimeout(() => {
      const simResults = runMoonfireSimulation({
        alpha: Number(alpha),
        xMin: Number(xMin),
        xMax: Number(xMax),
        nInvestments: Number(nInvestments),
        nSimulations: Number(nSimulations),
      });
      setResults(simResults);
      const res = runPortfolioSizeAnalysis(alpha, xMin, xMax, 2000, [10, 25, 50, 100, 200, 500]);
      setSizeAnalysis(res);
      // Generate heatmap data
      const hData = generateHeatmapData(Number(alpha), Number(xMin), Number(xMax), Number(nInvestments), nSimulationsHeatmap);
      setHeatmapData(hData);
      // Compute stats
      const flat = hData.flat();
      setHeatmapStats({
        mean: flat.length ? flat.reduce((a, b) => a + b, 0) / flat.length : 0,
        min: flat.length ? Math.min(...flat) : 0,
        max: flat.length ? Math.max(...flat) : 0,
        std: flat.length ? Math.sqrt(flat.reduce((a, b) => a + (b - (flat.reduce((a, b) => a + b, 0) / flat.length)) ** 2, 0) / flat.length) : 0,
      });
      setLoading(false);
      setSizeLoading(false);
    }, 100);
  };

  // Data for mean/std plot
  const meanStdData = sizeAnalysis ? sizeAnalysis.map(r => ({
    size: r.size,
    mean: r.mean,
    std: r.std,
  })) : [];

  // Data for violin/box plot
  const violinData = sizeAnalysis ? violinSizes.map(size => {
    const found = sizeAnalysis.find(r => r.size === size);
    if (!found) return { size, returns: [] };
    return { size, returns: found.returns };
  }) : [];

  // Histogram data (linear)
  let histData: { bin: string; binStart: number; count: number }[] = [];
  let logHistData: { bin: string; count: number }[] = [];
  let cdfData: { x: number; p: number }[] = [];
  if (results) {
    // Linear histogram
    const binCount = 30;
    // Use user-selected range if set, else full range
    const min = histXMin !== null ? histXMin : results.minReturn;
    const max = histXMax !== null ? histXMax : results.maxReturn;
    const binSize = (max - min) / binCount;
    const bins = Array(binCount).fill(0);
    results.portfolioReturns.forEach((val: number) => {
      if (val < min || val > max) return;
      let idx = Math.floor((val - min) / binSize);
      if (idx >= binCount) idx = binCount - 1;
      bins[idx]++;
    });
    histData = bins.map((count, i) => ({
      bin: `${(min + i * binSize).toFixed(2)}-${(min + (i + 1) * binSize).toFixed(2)}`,
      binStart: min + i * binSize,
      count
    }));
    // Log-scale histogram
    const logReturns = results.portfolioReturns.filter((x: number) => x > 0).map((x: number) => Math.log10(x));
    const logMin = Math.min(...logReturns);
    const logMax = Math.max(...logReturns);
    const logBinSize = (logMax - logMin) / binCount;
    const logBins = Array(binCount).fill(0);
    logReturns.forEach((val: number) => {
      let idx = Math.floor((val - logMin) / logBinSize);
      if (idx >= binCount) idx = binCount - 1;
      logBins[idx]++;
    });
    logHistData = logBins.map((count, i) => ({
      bin: `${(logMin + i * logBinSize).toFixed(2)}-${(logMin + (i + 1) * logBinSize).toFixed(2)}`,
      count
    }));
    // CDF
    const sorted = [...results.portfolioReturns].sort((a: number, b: number) => a - b);
    cdfData = sorted.map((x: number, i: number) => ({ x, p: (i + 1) / sorted.length }));
  }

  // Risk metrics bar chart data
  const riskData = results ? [
    { metric: 'Prob(Loss)', value: results.probLoss },
    { metric: 'Prob(2x+)', value: results.prob2x },
    { metric: 'Prob(5x+)', value: results.prob5x },
    { metric: 'Prob(10x+)', value: results.prob10x },
  ] : [];

  // Quantile bar chart data
  const quantileData = results ? [
    { q: '1%', value: results.quantile01 },
    { q: '5%', value: results.quantile05 },
    { q: '10%', value: results.quantile10 },
    { q: '25%', value: results.quantile25 },
    { q: '50%', value: results.median },
    { q: '75%', value: results.quantile75 },
    { q: '90%', value: results.quantile90 },
    { q: '95%', value: results.quantile95 },
    { q: '99%', value: results.quantile99 },
  ] : [];

  // Probability data
  const probData = sizeAnalysis ? sizeAnalysis.map(r => ({
    size: r.size,
    probLoss: r.probLoss,
    prob2x: r.prob2x,
    prob10x: r.prob10x
  })) : [];

  // In the Parameters Panel, clamp and alert on nSimulations input
  const handleSimulationsChange = (value: number) => {
    if (value > MAX_SIMULATIONS) {
      setSimError('Maximum allowed simulations is 1,000,000.');
      setNSimulations(MAX_SIMULATIONS);
    } else {
      setSimError(null);
      setNSimulations(value);
    }
  };

  const DENSITY_COLORS = [
    '#6366f1', // indigo
    '#f59e42', // orange
    '#10b981', // green
    '#ef4444', // red
    '#a78bfa', // purple
    '#fbbf24', // yellow
    '#0ea5e9', // blue
    '#f472b6', // pink
  ];

  function computeKDE(data: number[], steps = 200) {
    if (!data.length) return [];
    const sorted = [...data].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const bandwidth = (max - min) / 20;
    function kernel(x: number, xi: number) {
      return Math.exp(-0.5 * ((x - xi) / bandwidth) ** 2);
    }
    return Array.from({ length: steps }, (_, i) => {
      const x = min + (i / (steps - 1)) * (max - min);
      const y = sorted.reduce((sum, xi) => sum + kernel(x, xi), 0) / (sorted.length * bandwidth * Math.sqrt(2 * Math.PI));
      return { x, y };
    });
  }

  // Implement share parameters logic
  const handleShareParameters = useCallback(() => {
    const paramObj = {
      alpha,
      xMin,
      xMax,
      nInvestments,
      nSimulations,
    };
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(paramObj))));
    const url = `${window.location.origin}${window.location.pathname}?params=${encoded}`;
    setShareUrl(url);
    setShareDialogOpen(true);
  }, [alpha, xMin, xMax, nInvestments, nSimulations]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      const params = url.searchParams.get('params');
      if (params) {
        try {
          const decoded = JSON.parse(decodeURIComponent(escape(atob(params))));
          if (decoded.alpha) setAlpha(Number(decoded.alpha));
          if (decoded.xMin) setXMin(Number(decoded.xMin));
          if (decoded.xMax) setXMax(Number(decoded.xMax));
          if (decoded.nInvestments) setNInvestments(Number(decoded.nInvestments));
          if (decoded.nSimulations) setNSimulations(Number(decoded.nSimulations));
        } catch (e) {
          // ignore
        }
      }
    }
  }, []);

  if (layout === 'split') {
    return (
      <>
        <h1 className="text-3xl font-bold mb-6 text-center">Power-Law & Pareto Simulation</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Parameters Panel */}
          <Card className="p-6 md:col-span-1">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Parameters</h2>
              <Button size="sm" variant="outline" className="flex items-center gap-1" onClick={handleShareParameters}>
                <Share2 className="w-4 h-4 mr-1" />
                Share Parameters
              </Button>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1">
                  <label className="text-xs font-medium">Pareto α</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <span
                        tabIndex={0}
                        className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-xs font-bold cursor-pointer border border-blue-200 select-none"
                        onMouseEnter={e => e.currentTarget.click()}
                        onFocus={e => e.currentTarget.click()}
                        onMouseLeave={e => document.activeElement === e.currentTarget && e.currentTarget.blur()}
                        aria-label="Alpha info"
                      >i</span>
                    </PopoverTrigger>
                    <PopoverContent className="max-w-xs text-sm p-4" side="right" align="start">
                      <div className="font-semibold mb-2">What Alpha Controls</div>
                      <div className="mb-2">Alpha (α) determines the "heaviness" of the tail in the power-law distribution of investment returns.</div>
                      <div className="font-semibold mb-2">What Different Alpha Values Mean:</div>
                      <ul className="list-disc pl-4 mb-2">
                        <li><b>α = 2.5:</b> Lighter tail; extreme returns (e.g., 10x–20x) are less probable, and returns are more evenly distributed across investments.</li>
                        <li><b>α = 2.0:</b> Heavier tail; a small percentage of investments may yield very high returns (e.g., 100x), significantly impacting overall fund performance.</li>
                        <li><b>α = 1.5:</b> Very heavy tail; fund performance is dominated by a few exceptionally high-return investments, making it crucial for VCs to identify and invest in potential "unicorns."</li>
                      </ul>
                    </PopoverContent>
                  </Popover>
                </div>
                <span className="text-sm font-bold">{alpha.toFixed(2)}</span>
              </div>
              <Slider min={1} max={3} step={0.1} value={[alpha]} onValueChange={v => setAlpha(Number(v[0]))} className="mb-2" />
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium">Worst Case Return (%)</label>
                <span className="text-sm font-bold">{(xMin * 100).toFixed(0)}%</span>
              </div>
              <Slider min={10} max={50} step={1} value={[xMin * 100]} onValueChange={v => setXMin(Number(v[0]) / 100)} className="mb-2" />
              <label className="text-xs font-medium">Best Case Return (%)</label>
              <Input type="number" step="0.01" min={0} max={100} value={xMax * 100} onChange={e => setXMax(Number(e.target.value) / 100)} />
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium"># Investments</label>
                <span className="text-sm font-bold">{nInvestments}</span>
              </div>
              <Slider min={50} max={300} step={1} value={[nInvestments]} onValueChange={v => setNInvestments(Number(v[0]))} className="mb-2" />
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium"># Simulations</label>
                <span className="text-sm font-bold">{nSimulations}</span>
              </div>
              {simError && (
                <div className="flex items-center gap-2 mt-1 text-red-600 text-xs bg-red-50 border border-red-200 rounded px-2 py-1">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  {simError}
                </div>
              )}
              <Slider min={10000} max={100000} step={1000} value={[nSimulations]} onValueChange={v => handleSimulationsChange(Number(v[0]))} className="mb-2" />
            </div>
            <Button onClick={handleRunSimulation} disabled={loading} className="mt-6 w-full">
              {loading ? 'Simulating...' : 'Run Simulation'}
            </Button>
            <div className="text-xs text-gray-500 mt-3">
              Based on <a href="https://arxiv.org/pdf/2303.11013" target="_blank" rel="noopener noreferrer" className="underline">Venture Capital Portfolio Construction</a> (Moonfire Ventures).
            </div>
          </Card>
          {/* Results Panel */}
          <div className="md:col-span-2">
            <Card className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Simulation Results</h2>
                <div className="flex gap-2 items-center">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleRunSimulation}
                    disabled={loading}
                  >
                    {loading ? 'Simulating...' : 'Run Simulation'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowInfo(true)}
                    className="flex items-center gap-1"
                    aria-label="Simulation Info"
                  >
                    <Info className="w-4 h-4" /> Info
                  </Button>
                </div>
              </div>
              {results && (
                <>
                  <div className="mb-4 flex gap-2 flex-wrap">
                    <button className={`px-3 py-1 rounded ${tab === 'hist' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`} onClick={() => setTab('hist')}>Histogram</button>
                    <button className={`px-3 py-1 rounded ${tab === 'loghist' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`} onClick={() => setTab('loghist')}>Log-Scale Histogram</button>
                    <button className={`px-3 py-1 rounded ${tab === 'cdf' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`} onClick={() => setTab('cdf')}>CDF</button>
                    <button className={`px-3 py-1 rounded ${tab === 'sharpe' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`} onClick={() => { setTab('sharpe'); if (!sizeAnalysis && !sizeLoading) handleSizeAnalysis(); }}>Risk-Adjusted Performance</button>
                    <button className={`px-3 py-1 rounded ${tab === 'quant' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`} onClick={() => setTab('quant')}>Quantiles</button>
                    <button className={`px-3 py-1 rounded ${tab === 'size' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`} onClick={() => { setTab('size'); if (!sizeAnalysis && !sizeLoading) handleSizeAnalysis(); }}>Portfolio Size Analysis</button>
                    <button className={`px-3 py-1 rounded ${tab === 'violin' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`} onClick={() => { setTab('violin'); if (!sizeAnalysis && !sizeLoading) handleSizeAnalysis(); }}>Return Distribution by Size</button>
                    <button className={`px-3 py-1 rounded ${tab === 'prob' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`} onClick={() => { setTab('prob'); if (!sizeAnalysis && !sizeLoading) handleSizeAnalysis(); }}>Return Probabilities</button>
                    <button className={`px-3 py-1 rounded ${tab === 'batch' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`} onClick={() => setTab('batch')}>Investment Batch Overview</button>
                  </div>
                  {tab === 'hist' && (
                    <>
                      <h3 className="text-lg font-semibold mb-2">Portfolio Return Distribution</h3>
                      {/* Reference line toggles */}
                      <div className="flex items-center gap-4 mb-2">
                        <label className="flex items-center gap-1 text-xs">
                          <input type="checkbox" checked={showMean} onChange={e => setShowMean(e.target.checked)} /> Show Mean
                        </label>
                        <label className="flex items-center gap-1 text-xs">
                          <input type="checkbox" checked={showMedian} onChange={e => setShowMedian(e.target.checked)} /> Show Median
                        </label>
                        <label className="flex items-center gap-1 text-xs">
                          <input type="checkbox" checked={showBreakEven} onChange={e => setShowBreakEven(e.target.checked)} /> Show Break-even
                        </label>
                      </div>
                      {/* X-axis range controls */}
                      {results && (
                        <div className="flex items-center gap-2 mb-2">
                          <label className="text-xs font-medium">X-axis Range:</label>
                          <input
                            type="number"
                            className="border rounded px-2 py-1 text-xs w-20"
                            value={pendingHistXMin}
                            min={results.minReturn}
                            max={pendingHistXMax || results.maxReturn}
                            step="0.01"
                            onChange={e => setPendingHistXMin(e.target.value)}
                          />
                          <span className="text-xs">to</span>
                          <input
                            type="number"
                            className="border rounded px-2 py-1 text-xs w-20"
                            value={pendingHistXMax}
                            min={pendingHistXMin || results.minReturn}
                            max={results.maxReturn}
                            step="0.01"
                            onChange={e => setPendingHistXMax(e.target.value)}
                          />
                          <button
                            className="ml-2 px-2 py-1 text-xs rounded bg-blue-100 border border-blue-300 hover:bg-blue-200 text-blue-700"
                            onClick={() => {
                              setHistXMin(Number(pendingHistXMin));
                              setHistXMax(Number(pendingHistXMax));
                            }}
                          >Update</button>
                          <button
                            className="ml-1 px-2 py-1 text-xs rounded bg-gray-100 border border-gray-300 hover:bg-gray-200 text-gray-700"
                            onClick={() => {
                              setHistXMin(null);
                              setHistXMax(null);
                              setPendingHistXMin(results.minReturn.toString());
                              setPendingHistXMax(results.maxReturn.toString());
                            }}
                          >Reset</button>
                        </div>
                      )}
                      <div className="mb-1" style={{ width: '100%', height: 240 }}>
                        <ResponsiveContainer width="100%" height={240}>
                          <BarChart data={histData} margin={{ left: 80, right: 20, top: 20, bottom: 40 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                              dataKey="binStart"
                              type="number"
                              domain={[(histXMin !== null ? histXMin : results?.minReturn) || 0, (histXMax !== null ? histXMax : results?.maxReturn) || 1]}
                              // label={{ value: 'Portfolio Return', position: 'bottom', offset: 20 }}
                              tickFormatter={v => v.toFixed(2)}
                              allowDataOverflow={true}
                            />
                            <YAxis /*label={{ value: 'Count', angle: -90, position: 'left', offset: 40 }}*/ />
                            <Tooltip labelFormatter={(_, i) => histData[i]?.bin || ''} />
                            <Bar dataKey="count" fill="#60a5fa" name="Count" />
                            {showMean && <ReferenceLine x={results.mean} stroke="green" label="Mean" />}
                            {showMedian && <ReferenceLine x={results.median} stroke="orange" label="Median" />}
                            {showBreakEven && <ReferenceLine x={1} stroke="red" label="Break-even" />}
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="text-xs text-gray-500 mb-4">X: Portfolio Return, Y: Count</div>
                    </>
                  )}
                  {tab === 'loghist' && (
                    <>
                      <h3 className="text-lg font-semibold mb-2">Log-Scale Portfolio Return Distribution</h3>
                      <div className="mb-1" style={{ width: '100%', height: 240 }}>
                        <ResponsiveContainer width="100%" height={240}>
                          <BarChart data={logHistData} margin={{ left: 60, right: 20, top: 20, bottom: 30 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="bin" interval={4} angle={-30} textAnchor="end" height={60} /*label={{ value: 'Log Portfolio Return', position: 'insideBottom', offset: -5 }}*/ />
                            <YAxis /*label={{ value: 'Count', angle: -90, position: 'insideLeft', offset: 20 }}*/ />
                            <Tooltip />
                            <Bar dataKey="count" fill="#fbbf24" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="text-xs text-gray-500 mb-4">X: Log Portfolio Return, Y: Count</div>
                    </>
                  )}
                  {tab === 'cdf' && (
                    <>
                      <h3 className="text-lg font-semibold mb-2">Cumulative Distribution Function (CDF)</h3>
                      <div className="mb-1" style={{ width: '100%', height: 240 }}>
                        <ResponsiveContainer width="100%" height={240}>
                          <ComposedChart data={cdfData} margin={{ left: 60, right: 20, top: 20, bottom: 30 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="x" type="number" domain={['auto', 'auto']} /*label={{ value: 'Portfolio Return', position: 'insideBottom', offset: -5 }}*/ />
                            <YAxis dataKey="p" type="number" domain={[0, 1]} /*label={{ value: 'Cumulative Probability', angle: -90, position: 'insideLeft', offset: 20 }}*/ />
                            <Tooltip />
                            <Line type="monotone" dataKey="p" stroke="#6366f1" dot={false} />
                            <ReferenceLine x={1} stroke="red" label="Break-even" />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="text-xs text-gray-500 mb-4">X: Portfolio Return, Y: Cumulative Probability</div>
                    </>
                  )}
                  {tab === 'sharpe' && (
                    <>
                      <h3 className="text-lg font-semibold mb-2">Risk-Adjusted Performance (Sharpe Ratio)</h3>
                      {sizeLoading ? (
                        <div className="py-8 text-center text-gray-500">Simulating...</div>
                      ) : sizeAnalysis ? (
                        <>
                          <div className="mb-1" style={{ width: '100%', height: 340 }}>
                          <ResponsiveContainer width="100%" height={340}>
                            <LineChart data={sizeAnalysis} margin={{ left: 60, right: 20, top: 20, bottom: 30 }}>
                              <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="size" /*label={{ value: 'Portfolio Size', position: 'insideBottom', offset: -5 }}*/ />
                                <YAxis /*label={{ value: 'Sharpe Ratio', angle: -90, position: 'insideLeft', offset: 20 }}*/ />
                              <Tooltip />
                              <Legend />
                              <Line type="monotone" dataKey="sharpe" stroke="#10b981" name="Sharpe Ratio" />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                          <div className="text-xs text-gray-500 mb-4">X: Portfolio Size, Y: Sharpe Ratio</div>
                        </>
                      ) : (
                        <div className="py-8 text-center text-gray-500">Click the tab to run analysis.</div>
                      )}
                    </>
                  )}
                  {tab === 'quant' && (
                    <>
                      <h3 className="text-lg font-semibold mb-2">Portfolio Return Quantiles</h3>
                      <div className="mb-1" style={{ width: '100%', height: 240 }}>
                        <ResponsiveContainer width="100%" height={240}>
                          <BarChart data={quantileData} margin={{ left: 60, right: 20, top: 20, bottom: 30 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="q" /*label={{ value: 'Quantile', position: 'insideBottom', offset: -5 }}*/ />
                            <YAxis /*label={{ value: 'Return', angle: -90, position: 'insideLeft', offset: 20 }}*/ />
                            <Tooltip />
                            <Bar dataKey="value" fill="#a78bfa" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="text-xs text-gray-500 mb-4">X: Quantile, Y: Return</div>
                    </>
                  )}
                  {tab === 'size' && (
                    <>
                      <h3 className="text-lg font-semibold mb-2">Portfolio Size Analysis (Mean & Std Dev)</h3>
                      {sizeLoading ? (
                        <div className="py-8 text-center text-gray-500">Simulating...</div>
                      ) : sizeAnalysis ? (
                        <>
                          <div className="mb-1" style={{ width: '100%', height: 260 }}>
                          <ResponsiveContainer width="100%" height={260}>
                            <ComposedChart data={meanStdData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="size" />
                                <YAxis yAxisId="left" /*label={{ value: 'Mean', angle: -90, position: 'insideLeft' }}*/ />
                                <YAxis yAxisId="right" orientation="right" /*label={{ value: 'Std Dev', angle: 90, position: 'insideRight' }}*/ />
                              <Tooltip />
                              <Legend />
                              <Line yAxisId="left" type="monotone" dataKey="mean" stroke="#2563eb" name="Mean" />
                              <Line yAxisId="right" type="monotone" dataKey="std" stroke="#f87171" name="Std Dev" />
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                          <div className="text-xs text-gray-500 mb-4">X: Portfolio Size, Y (left): Mean, Y (right): Std Dev</div>
                        </>
                      ) : (
                        <div className="py-8 text-center text-gray-500">Click the tab to run analysis.</div>
                      )}
                    </>
                  )}
                  {tab === 'violin' && (
                    <>
                      <h3 className="text-lg font-semibold mb-2">Return Distribution by Portfolio Size</h3>
                      {sizeLoading ? (
                        <div className="py-8 text-center text-gray-500">Simulating...</div>
                      ) : sizeAnalysis ? (
                        <div className="mb-1 flex flex-col items-center gap-8">
                          {/* Render one chart per portfolio size */}
                          {violinData.map((d, idx) => {
                            const kde = computeKDE(d.returns, 200);
                            // Find x domain where density > 0.01
                            let minX = Infinity, maxX = -Infinity;
                            kde.forEach(pt => {
                              if (pt.y > 0.01) {
                                if (pt.x < minX) minX = pt.x;
                                if (pt.x > maxX) maxX = pt.x;
                              }
                            });
                            const range = maxX - minX;
                            minX = Math.max(0, minX - range * 0.05);
                            maxX = maxX + range * 0.05;
                            if (!isFinite(minX) || !isFinite(maxX) || minX >= maxX) {
                              minX = 0;
                              maxX = 1.5;
                            }
                            return (
                              <div key={d.size} className="w-full">
                                <div className="text-sm font-semibold mb-1">Portfolio Size: {d.size}</div>
                                <ResponsiveContainer width="100%" height={180}>
                                  <LineChart data={kde} margin={{ left: 40, right: 20, top: 20, bottom: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis type="number" dataKey="x" domain={[minX, maxX]} />
                                    <YAxis type="number" />
                                    <Tooltip formatter={(v: number) => v.toFixed(4)} labelFormatter={(v: number) => v.toFixed(3)} />
                                    <Line
                                      dataKey="y"
                                      stroke={DENSITY_COLORS[idx % DENSITY_COLORS.length]}
                                      dot={false}
                                      isAnimationActive={false}
                                      type="monotone"
                                      strokeWidth={2.5}
                                      activeDot={{ r: 5 }}
                                    />
                                    <ReferenceLine x={1} stroke="#ef4444" strokeDasharray="4 2" strokeWidth={2} label={{ value: 'Break-even', position: 'top', fill: '#ef4444', fontSize: 12 }} />
                                  </LineChart>
                                </ResponsiveContainer>
                              </div>
                            );
                          })}
                          <div className="text-xs text-gray-500 mt-2 mb-4">X: Return, Y: Density</div>
                        </div>
                      ) : (
                        <div className="py-8 text-center text-gray-500">Click the tab to run analysis.</div>
                      )}
                    </>
                  )}
                  {tab === 'prob' && (
                    <>
                      <h3 className="text-lg font-semibold mb-2">Return Probabilities</h3>
                      {sizeLoading ? (
                        <div className="py-8 text-center text-gray-500">Simulating...</div>
                      ) : sizeAnalysis ? (
                        <>
                          <div className="mb-1" style={{ width: '100%', height: 340 }}>
                          <ResponsiveContainer width="100%" height={340}>
                            <LineChart data={probData} margin={{ left: 60, right: 20, top: 20, bottom: 30 }}>
                              <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="size" /*label={{ value: 'Portfolio Size', position: 'insideBottom', offset: -5 }}*/ />
                                <YAxis /*label={{ value: 'Probability', angle: -90, position: 'insideLeft', offset: 20 }}*/ domain={[0, 1]} />
                                <Tooltip formatter={v => (typeof v === 'number' ? (v * 100).toFixed(1) + '%' : v)} />
                              <Legend />
                              <Line type="monotone" dataKey="probLoss" stroke="#ef4444" name="Prob(Loss)" />
                              <Line type="monotone" dataKey="prob2x" stroke="#10b981" name="Prob(2x+)" />
                              <Line type="monotone" dataKey="prob10x" stroke="#a21caf" name="Prob(10x+)" />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                          <div className="text-xs text-gray-500 mb-4">X: Portfolio Size, Y: Probability</div>
                        </>
                      ) : (
                        <div className="py-8 text-center text-gray-500">Click the tab to run analysis.</div>
                      )}
                    </>
                  )}
                  {tab === 'batch' && results && results.allInvestmentReturns && results.allInvestmentReturns.length > 0 && (
                    (() => {
                      // Use batchSimIndex for navigation
                      const nSims = results.allInvestmentReturns.length;
                      const investment_returns = results.allInvestmentReturns[batchSimIndex] as number[];
                      const n_investments = investment_returns.length;
                      const per_investment_value = 1.0 / n_investments;
                      // Performance tiers
                      const points = investment_returns.map((ret: number, i: number) => {
                        let tier = 'Loss', color = '#ef4444';
                        if (ret < per_investment_value) {
                          tier = 'Loss'; color = '#ef4444';
                        } else if (ret < 1.5 * per_investment_value) {
                          tier = 'Break-even'; color = '#f59e42';
                        } else if (ret < 3 * per_investment_value) {
                          tier = 'Modest'; color = '#fbbf24';
                        } else if (ret < 10 * per_investment_value) {
                          tier = 'Good'; color = '#10b981';
                        } else {
                          tier = 'Excellent'; color = '#166534';
                        }
                        // Size: log scale for better visualization
                        const size = 20 + 100 * Math.log10(Math.max(ret, 0.001) / per_investment_value + 1);
                        return { i, ret, tier, color, size };
                      });
                      // Reference lines
                      const refLines = [per_investment_value, 2 * per_investment_value, 5 * per_investment_value];
                      const refLineMeta = [
                        { color: '#ef4444', label: 'Break-even (1x)' },
                        { color: '#2563eb', label: '2x return' },
                        { color: '#22c55e', label: '5x return' },
                      ];
                      // Y scale: log if needed
                      const max_return = Math.max(...investment_returns);
                      const min_return = Math.min(...investment_returns.filter((x: number) => x > 0)) || 0.001;
                      const useLog = max_return / min_return > 100;
                      // Stats
                      const winners = investment_returns.filter((x: number) => x >= per_investment_value).length;
                      const losers = investment_returns.filter((x: number) => x < per_investment_value).length;
                      const top_return = Math.max(...investment_returns) / per_investment_value;
                      const avg_return = investment_returns.reduce((a: number, b: number) => a + b, 0) / n_investments / per_investment_value;
                      const total_portfolio = investment_returns.reduce((a: number, b: number) => a + b, 0);
                      // SVG layout
                      const svgWidth = 750;
                      const svgHeight = 420;
                      const leftPad = 60;
                      const rightPad = 28;
                      const topPad = 28;
                      const bottomPad = 56;
                      const plotWidth = svgWidth - leftPad - rightPad;
                      const plotHeight = svgHeight - topPad - bottomPad;
                      // X scale: fit all investments in plotWidth
                      const getX = (idx: number) => leftPad + (plotWidth * idx) / (n_investments - 1 || 1);
                      // Y scale
                      const getY = (ret: number) => {
                        if (useLog) {
                          return topPad + plotHeight - plotHeight * (Math.log10(ret) - Math.log10(min_return)) / (Math.log10(max_return) - Math.log10(min_return));
                        } else {
                          return topPad + plotHeight - plotHeight * (ret - min_return) / (max_return - min_return);
                        }
                      };
                      return (
                        <div className="mb-1 flex flex-col items-center w-full">
                          {/* Navigation arrows */}
                          <div className="flex items-center gap-2 mb-2">
                            <button
                              className="px-2 py-1 rounded bg-gray-100 border border-gray-300 hover:bg-gray-200 text-gray-700 disabled:opacity-50"
                              onClick={() => setBatchSimIndex(i => Math.max(0, i - 1))}
                              disabled={batchSimIndex === 0}
                              aria-label="Previous simulation"
                            >
                              &#8592;
                            </button>
                            <span className="text-sm font-semibold">Simulation #{batchSimIndex + 1} of {nSims}</span>
                            <button
                              className="px-2 py-1 rounded bg-gray-100 border border-gray-300 hover:bg-gray-200 text-gray-700 disabled:opacity-50"
                              onClick={() => setBatchSimIndex(i => Math.min(nSims - 1, i + 1))}
                              disabled={batchSimIndex === nSims - 1}
                              aria-label="Next simulation"
                            >
                              &#8594;
                            </button>
                          </div>
                          <h3 className="text-lg font-semibold mb-2">Investment Batch Overview (Simulation #{batchSimIndex + 1})</h3>
                          <div style={{ width: svgWidth, overflowX: 'auto' }}>
                            <svg width={svgWidth} height={svgHeight} style={{ background: '#fff', borderRadius: 8, border: '1px solid #eee', display: 'block' }}>
                              {/* Points */}
                              {points.map((pt: { i: number; ret: number; tier: string; color: string; size: number }, idx: number) => {
                                const x = getX(idx);
                                const y = getY(pt.ret);
                                return (
                                  <circle
                                    key={idx}
                                    cx={x}
                                    cy={y}
                                    r={pt.size / 20}
                                    fill={pt.color}
                                    stroke="#222"
                                    strokeWidth={0.5}
                                    opacity={0.7}
                                  >
                                    <title>
                                      {`Investment #${idx + 1}\nReturn: ${pt.ret.toFixed(4)}\nTier: ${pt.tier}`}
                                    </title>
                                  </circle>
                                );
                              })}
                              {/* Axes */}
                              <line x1={leftPad} x2={leftPad} y1={topPad} y2={svgHeight - bottomPad} stroke="#222" strokeWidth={1.5} />
                              <line x1={leftPad} x2={svgWidth - rightPad} y1={svgHeight - bottomPad} y2={svgHeight - bottomPad} stroke="#222" strokeWidth={1.5} />
                              {/* X ticks */}
                              {[0, Math.floor(n_investments / 2), n_investments - 1].map((i: number) => {
                                const x = getX(i);
                                return (
                                  <g key={i}>
                                    <line x1={x} x2={x} y1={svgHeight - bottomPad} y2={svgHeight - bottomPad + 8} stroke="#222" />
                                    <text x={x} y={svgHeight - bottomPad + 22} fontSize={12} textAnchor="middle">{i + 1}</text>
                                  </g>
                                );
                              })}
                              {/* Y ticks */}
                              {(useLog
                                ? [min_return, per_investment_value, 2 * per_investment_value, 5 * per_investment_value, max_return]
                                : [min_return, per_investment_value, 2 * per_investment_value, 5 * per_investment_value, max_return]
                              ).map((y: number, i: number) => {
                                const yPos = getY(y);
                                return (
                                  <g key={i}>
                                    <line x1={leftPad - 5} x2={leftPad} y1={yPos} y2={yPos} stroke="#222" />
                                    <text x={leftPad - 10} y={yPos + 4} fontSize={12} textAnchor="end">{y.toFixed(2)}</text>
                                  </g>
                                );
                              })}
                              {/* Axis labels */}
                              <text x={leftPad + plotWidth / 2} y={svgHeight - 18} fontSize={14} textAnchor="middle" fontWeight="bold">Investment Index</text>
                              <text x={18} y={topPad + plotHeight / 2} fontSize={14} textAnchor="middle" fontWeight="bold" transform={`rotate(-90 18,${topPad + plotHeight / 2})`}>{useLog ? 'Return Value (log scale)' : 'Return Value'}</text>
                            </svg>
                          </div>
                          {/* Summary statistics box */}
                          <div className="mt-4 p-2 bg-white border rounded shadow text-xs font-mono text-left" style={{ minWidth: 220 }}>
                            <div><b>Summary Statistics:</b></div>
                            <div>Winners: {winners} ({((winners / n_investments) * 100).toFixed(1)}%)</div>
                            <div>Losers: {losers} ({((losers / n_investments) * 100).toFixed(1)}%)</div>
                            <div>Top Return: {top_return.toFixed(1)}x</div>
                            <div>Avg Return: {avg_return.toFixed(2)}x</div>
                            <div>Total Portfolio: {total_portfolio.toFixed(2)}x initial</div>
                          </div>
                          <div className="text-xs text-gray-500 mt-2 mb-4">X: Investment Index, Y: Return Value</div>
                        </div>
                      );
                    })()
                  )}
                  {/* Summary stats table (always visible) */}
                  <div className="mt-6 bg-gray-50 rounded-lg shadow-sm p-4 flex flex-col gap-2">
                    {/* 1st line: Mean, Std Deviation, Median */}
                    <div className="flex flex-wrap gap-6 items-center">
                      <TrendingUp className="w-5 h-5 text-blue-500 mr-2" />
                      <span className="text-sm text-gray-500">Mean</span><span className="text-xl font-semibold">{results.mean.toFixed(3)}</span>
                      <span className="text-sm text-gray-500 ml-6">Std Dev</span><span className="text-xl font-semibold">{results.std.toFixed(3)}</span>
                      <span className="text-sm text-gray-500 ml-6">Median</span><span className="text-xl font-semibold">{results.median.toFixed(3)}</span>
                    </div>
                    {/* 2nd line: Probability dropdown */}
                    <div className="flex flex-wrap gap-6 items-center">
                      <PercentCircle className="w-5 h-5 text-red-500 mr-2" />
                      <span className="text-sm text-gray-500">Probability</span>
                      <select
                        className="text-sm rounded border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                        value={selectedProbability}
                        onChange={e => setSelectedProbability(e.target.value)}
                      >
                        {probabilityOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      <span className="text-xl font-semibold">
                        {((results[selectedProbability] ?? 0) * 100).toFixed(2)}%
                      </span>
                    </div>
                    {/* 3rd line: Max Return, Min Return */}
                    <div className="flex flex-wrap gap-6 items-center">
                      <ArrowDownCircle className="w-5 h-5 text-yellow-500 mr-2" />
                      <span className="text-sm text-gray-500">Max Return</span><span className="text-xl font-semibold">{results.maxReturn.toFixed(3)}</span>
                      <span className="text-sm text-gray-500 ml-6">Min Return</span><span className="text-xl font-semibold">{results.minReturn.toFixed(3)}</span>
                    </div>
                    {/* 4th line: Quantile, Execution Time */}
                    <div className="flex flex-wrap gap-6 items-center">
                      <BarChart2 className="w-5 h-5 text-gray-400 mr-2" />
                      <span className="text-sm text-gray-500">Quantile</span>
                      <select className="text-sm rounded border-gray-300 focus:ring-blue-500 focus:border-blue-500" value={selectedQuantile} onChange={e => setSelectedQuantile(e.target.value)}>{quantileOptions.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}</select>
                      <span className="text-xl font-semibold">{results[selectedQuantile]?.toFixed(3)}</span>
                      <span className="text-sm text-gray-500 ml-6">Execution Time</span><span className="text-xl font-semibold">{results.executionTime.toFixed(2)}s</span>
                    </div>
                  </div>
                </>
              )}
            </Card>
            {/* Power-Law Simulation Info Dialog */}
            <Dialog open={showInfo} onOpenChange={setShowInfo}>
              <DialogContent className="max-w-2xl p-0">
                <DialogHeader className="bg-blue-600 rounded-t-lg p-4">
                  <DialogTitle className="text-white text-2xl">Power-Law Simulation: Principles & Math</DialogTitle>
                </DialogHeader>
                <div className="max-h-[60vh] overflow-y-auto p-6">
                  <div className="prose max-w-none text-sm">
                    <h3 className="text-blue-700 text-lg font-bold mt-0">The Portfolio Simulator</h3>
                    <p>The Portfolio Simulator models venture capital investment returns using Monte Carlo simulation based on empirically-observed power-law distributions. This approach reflects the fundamental asymmetry of startup outcomes, where most investments underperform while a small fraction generate outsized returns.</p>
                    <h3 className="text-blue-700 text-lg font-bold mb-2">Mathematical Foundation</h3>
                    <h4 className="font-semibold mt-4 mb-1">Bounded Pareto Distribution</h4>
                    <p>Investment returns follow a bounded Pareto distribution with probability density function:</p>
                    <BlockMath math={String.raw`f(x) = \frac{\alpha C}{x^{\alpha + 1}} \quad \text{for } x_{\min} \leq x \leq x_{\max}`}/>
                    <ul>
                      <li><InlineMath math={String.raw`\alpha > 1`} /> is the shape parameter (power-law exponent)</li>
                      <li><InlineMath math={String.raw`x_{\min}`} /> is the minimum return multiple (downside protection)</li>
                      <li><InlineMath math={String.raw`x_{\max}`} /> is the maximum return multiple (upside cap)</li>
                      <li><InlineMath math={String.raw`C`} /> is the normalization constant</li>
                    </ul>
                    <h4 className="font-semibold mt-4 mb-1">Normalization Constant</h4>
                    <p>The normalization constant ensures the PDF integrates to 1:</p>
                    <BlockMath math={String.raw`C = \begin{cases}
\frac{\alpha - 1}{x_{\min}^{1-\alpha} - x_{\max}^{1-\alpha}} & \text{if } \alpha \neq 1 \\
\frac{1}{\ln(x_{\max}/x_{\min})} & \text{if } \alpha = 1
\end{cases}`}/>
                    <h4 className="font-semibold mt-4 mb-1">Inverse Transform Sampling</h4>
                    <p>Random samples are generated using the inverse CDF method:</p>
                    <BlockMath math={String.raw`X = F^{-1}(U) = \begin{cases}
\left(x_{\min}^{1-\alpha} - U(x_{\min}^{1-\alpha} - x_{\max}^{1-\alpha})\right)^{\frac{1}{1-\alpha}} & \text{if } \alpha \neq 1 \\
x_{\min} \left(\frac{x_{\max}}{x_{\min}}\right)^U & \text{if } \alpha = 1
\end{cases}`}/>
                    <p>where <InlineMath math={String.raw`U \sim \text{Uniform}(0,1)`} />.</p>
                    <h3 className="text-blue-700 text-lg font-bold mb-2">Model Parameters</h3>
                    <h4 className="font-semibold mt-4 mb-1">Default Configuration</h4>
                    <BlockMath math={String.raw`
\begin{align}
\alpha &= 2.05 \quad \text{(Ultra-heavy tail distribution)} \\
x_{\min} &= 0.35 \quad \text{(Minimum 35\% recovery)} \\
x_{\max} &= 1000 \quad \text{(Maximum 1000x return)} \\
n &= 100 \quad \text{(Portfolio size)}
\end{align}`}/>
                    <h4 className="font-semibold mt-4 mb-1">Parameter Interpretation</h4>
                    <b>Downside Protection (<InlineMath math={String.raw`x_{\min}`} />):</b>
                    <ul>
                      <li>Represents realistic asset recovery in startup failures</li>
                      <li>Accounts for IP value, equipment liquidation, and acqui-hires</li>
                      <li>Based on empirical VC liquidation data</li>
                    </ul>
                    <b>Upside Potential (<InlineMath math={String.raw`x_{\max}`} />):</b>
                    <ul>
                      <li>Caps extreme outlier scenarios for mathematical stability</li>
                      <li>Reflects historical maximum returns in venture capital</li>
                      <li>Prevents infinite tail behavior in simulations</li>
                    </ul>
                    <h3 className="text-blue-700 text-lg font-bold mb-2">Portfolio Construction</h3>
                    <h4 className="font-semibold mt-4 mb-1">Individual Investment Returns</h4>
                    <p>Each investment <InlineMath math={String.raw`i`} /> generates a return <InlineMath math={String.raw`R_i`} /> sampled from the bounded Pareto distribution:</p>
                    <BlockMath math={String.raw`R_i \sim \text{BoundedPareto}(\alpha, x_{\min}, x_{\max})`}/>
                    <h4 className="font-semibold mt-4 mb-1">Portfolio Return Calculation</h4>
                    <p>The total portfolio return is computed as:</p>
                    <BlockMath math={String.raw`R_{\text{portfolio}} = \sum_{i=1}^{n} \frac{(R_i - x_{\min})}{n}`}/>
                    <p>where the adjustment <InlineMath math={String.raw`(R_i - x_{\min})`} /> transforms the bounded Pareto samples to represent actual investment outcomes.</p>
                    <h3 className="text-blue-700 text-lg font-bold mb-2">Monte Carlo Simulation</h3>
                    <h4 className="font-semibold mt-4 mb-1">Simulation Process</h4>
                    <p>For each of <InlineMath math={String.raw`N`} /> simulation runs:</p>
                    <ol>
                      <li>Generate <InlineMath math={String.raw`n`} /> independent samples from bounded Pareto distribution</li>
                      <li>Calculate portfolio return using equation above</li>
                      <li>Record outcome for statistical analysis</li>
                    </ol>
                    <h4 className="font-semibold mt-4 mb-1">Key Metrics</h4>
                    <p>The simulation computes several probability metrics:</p>
                    <BlockMath math={String.raw`P(\text{Loss}) = P(R_{\text{portfolio}} < 1.0)`}/>
                    <BlockMath math={String.raw`P(\text{2x+}) = P(R_{\text{portfolio}} \geq 2.0)`}/>
                    <BlockMath math={String.raw`P(\text{10x+}) = P(R_{\text{portfolio}} \geq 10.0)`}/>
                    <p>And statistical measures:</p>
                    <BlockMath math={String.raw`
\mathbb{E}[R] = \frac{1}{N} \sum_{j=1}^{N} R_{\text{portfolio}}^{(j)}
`}/>
                    <BlockMath math={String.raw`
\text{Var}[R] = \frac{1}{N-1} \sum_{j=1}^{N} (R_{\text{portfolio}}^{(j)} - \mathbb{E}[R])^2
`}/>
                    <h3 className="text-blue-700 text-lg font-bold mb-2">Economic Interpretation</h3>
                    <h4 className="font-semibold mt-4 mb-1">Power Law Economics</h4>
                    <ul>
                      <li><b>Fat tail:</b> Small probability of extremely large returns</li>
                      <li><b>Heavy concentration:</b> Few investments drive most returns</li>
                      <li><b>Scale invariance:</b> Similar patterns across different investment stages</li>
                    </ul>
                    <h4 className="font-semibold mt-4 mb-1">Portfolio Implications</h4>
                    <ol>
                      <li><b>Diversification necessity:</b> Large portfolios required to capture tail events</li>
                      <li><b>Patience requirement:</b> Returns dominated by rare, high-impact outcomes</li>
                      <li><b>Risk tolerance:</b> High probability of underperformance in short term</li>
                    </ol>
                    <h3 className="text-blue-700 text-lg font-bold mb-2">Model Validation</h3>
                    <ul>
                      <li>Historical venture capital return data</li>
                      <li>Academic research on startup outcome distributions</li>
                      <li>Empirical studies of power-law behavior in innovation economics</li>
                    </ul>
                    <h3 className="text-blue-700 text-lg font-bold mb-2">Limitations and Assumptions</h3>
                    <h4 className="font-semibold mt-4 mb-1">Key Assumptions</h4>
                    <ul>
                      <li>Investment returns are independent and identically distributed</li>
                      <li>No correlation between portfolio companies</li>
                      <li>Constant market conditions across investment horizon</li>
                      <li>No selection bias in investment opportunities</li>
                    </ul>
                    <h4 className="font-semibold mt-4 mb-1">Model Limitations</h4>
                    <ul>
                      <li>Does not account for vintage year effects</li>
                      <li>Ignores portfolio construction strategies</li>
                      <li>Assumes static parameter values over time</li>
                      <li>No modeling of follow-on investment decisions</li>
                    </ul>
                  </div>
                </div>
                <DialogFooter className="bg-blue-50 rounded-b-lg p-4 flex justify-end">
                  <Button onClick={() => setShowInfo(false)} variant="default">Close</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Share Simulation Parameters</DialogTitle>
              <DialogDescription>
                Share this URL to allow others to run the same simulation with your exact parameters.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2 mb-2 mt-2">
              <Input
                type="text"
                className="flex-1 text-sm font-normal"
                value={shareUrl}
                readOnly
                onFocus={e => e.target.select()}
              />
              <Button size="icon" variant="outline" onClick={() => { navigator.clipboard.writeText(shareUrl); toast.success('URL copied to clipboard!'); }}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <DialogFooter>
              <div className="text-xs text-gray-500 mt-2">
                Anyone with this link can view and run your simulation with the exact same parameters.
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }
  return (
    <div className="max-w-3xl mx-auto py-8">
      <Card className="p-6 mb-6">
        <h2 className="text-2xl font-bold mb-2">Power-Law Portfolio Simulator</h2>
        <p className="text-sm text-gray-500 mb-4">
          Based on <a href="https://arxiv.org/pdf/2303.11013" target="_blank" rel="noopener noreferrer" className="underline">Venture Capital Portfolio Construction</a> (Moonfire Ventures).
        </p>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1">
                <label className="text-xs font-medium">Pareto α</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <span
                      tabIndex={0}
                      className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-xs font-bold cursor-pointer border border-blue-200 select-none"
                      onMouseEnter={e => e.currentTarget.click()}
                      onFocus={e => e.currentTarget.click()}
                      onMouseLeave={e => document.activeElement === e.currentTarget && e.currentTarget.blur()}
                      aria-label="Alpha info"
                    >i</span>
                  </PopoverTrigger>
                  <PopoverContent className="max-w-xs text-sm p-4" side="right" align="start">
                    <div className="font-semibold mb-2">What Alpha Controls</div>
                    <div className="mb-2">Alpha (α) determines the "heaviness" of the tail in the power-law distribution of investment returns.</div>
                    <div className="font-semibold mb-2">What Different Alpha Values Mean:</div>
                    <ul className="list-disc pl-4 mb-2">
                      <li><b>α = 2.5:</b> Lighter tail; extreme returns (e.g., 10x–20x) are less probable, and returns are more evenly distributed across investments.</li>
                      <li><b>α = 2.0:</b> Heavier tail; a small percentage of investments may yield very high returns (e.g., 100x), significantly impacting overall fund performance.</li>
                      <li><b>α = 1.5:</b> Very heavy tail; fund performance is dominated by a few exceptionally high-return investments, making it crucial for VCs to identify and invest in potential "unicorns."</li>
                    </ul>
                  </PopoverContent>
                </Popover>
              </div>
              <span className="text-sm font-bold">{alpha.toFixed(2)}</span>
            </div>
            <Slider min={1} max={3} step={0.1} value={[alpha]} onValueChange={v => setAlpha(Number(v[0]))} className="mb-2" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium">Worst Case Return (%)</label>
              <span className="text-sm font-bold">{(xMin * 100).toFixed(0)}%</span>
            </div>
            <Slider min={10} max={50} step={1} value={[xMin * 100]} onValueChange={v => setXMin(Number(v[0]) / 100)} className="mb-2" />
          </div>
          <div>
            <label className="text-xs font-medium">Best Case Return (%)</label>
            <Input type="number" step="0.01" min={0} max={100} value={xMax * 100} onChange={e => setXMax(Number(e.target.value) / 100)} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium"># Investments</label>
              <span className="text-sm font-bold">{nInvestments}</span>
            </div>
            <Slider min={50} max={300} step={1} value={[nInvestments]} onValueChange={v => setNInvestments(Number(v[0]))} className="mb-2" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium"># Simulations</label>
              <span className="text-sm font-bold">{nSimulations}</span>
            </div>
            {simError && (
              <div className="flex items-center gap-2 mt-1 text-red-600 text-xs bg-red-50 border border-red-200 rounded px-2 py-1">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                {simError}
              </div>
            )}
            <Slider min={10000} max={100000} step={1000} value={[nSimulations]} onValueChange={v => handleSimulationsChange(Number(v[0]))} className="mb-2" />
          </div>
        </div>
        <Button onClick={handleRunSimulation} disabled={loading}>
          {loading ? 'Simulating...' : 'Run Simulation'}
        </Button>
      </Card>
      {results && (
        <Card className="p-6">
          <div className="mb-4 flex gap-2 flex-wrap">
            <button className={`px-3 py-1 rounded ${tab === 'hist' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`} onClick={() => setTab('hist')}>Histogram</button>
            <button className={`px-3 py-1 rounded ${tab === 'loghist' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`} onClick={() => setTab('loghist')}>Log-Scale Histogram</button>
            <button className={`px-3 py-1 rounded ${tab === 'cdf' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`} onClick={() => setTab('cdf')}>CDF</button>
            <button className={`px-3 py-1 rounded ${tab === 'sharpe' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`} onClick={() => { setTab('sharpe'); if (!sizeAnalysis && !sizeLoading) handleSizeAnalysis(); }}>Risk-Adjusted Performance</button>
            <button className={`px-3 py-1 rounded ${tab === 'quant' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`} onClick={() => setTab('quant')}>Quantiles</button>
            <button className={`px-3 py-1 rounded ${tab === 'size' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`} onClick={() => { setTab('size'); if (!sizeAnalysis && !sizeLoading) handleSizeAnalysis(); }}>Portfolio Size Analysis</button>
            <button className={`px-3 py-1 rounded ${tab === 'violin' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`} onClick={() => { setTab('violin'); if (!sizeAnalysis && !sizeLoading) handleSizeAnalysis(); }}>Return Distribution by Size</button>
            <button className={`px-3 py-1 rounded ${tab === 'prob' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`} onClick={() => { setTab('prob'); if (!sizeAnalysis && !sizeLoading) handleSizeAnalysis(); }}>Return Probabilities</button>
            <button className={`px-3 py-1 rounded ${tab === 'batch' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`} onClick={() => setTab('batch')}>Investment Batch Overview</button>
          </div>
          {tab === 'hist' && (
            <>
              <h3 className="text-lg font-semibold mb-2">Portfolio Return Distribution</h3>
              {/* Reference line toggles */}
              <div className="flex items-center gap-4 mb-2">
                <label className="flex items-center gap-1 text-xs">
                  <input type="checkbox" checked={showMean} onChange={e => setShowMean(e.target.checked)} /> Show Mean
                </label>
                <label className="flex items-center gap-1 text-xs">
                  <input type="checkbox" checked={showMedian} onChange={e => setShowMedian(e.target.checked)} /> Show Median
                </label>
                <label className="flex items-center gap-1 text-xs">
                  <input type="checkbox" checked={showBreakEven} onChange={e => setShowBreakEven(e.target.checked)} /> Show Break-even
                </label>
              </div>
              {/* X-axis range controls */}
              {results && (
                <div className="flex items-center gap-2 mb-2">
                  <label className="text-xs font-medium">X-axis Range:</label>
                  <input
                    type="number"
                    className="border rounded px-2 py-1 text-xs w-20"
                    value={pendingHistXMin}
                    min={results.minReturn}
                    max={pendingHistXMax || results.maxReturn}
                    step="0.01"
                    onChange={e => setPendingHistXMin(e.target.value)}
                  />
                  <span className="text-xs">to</span>
                  <input
                    type="number"
                    className="border rounded px-2 py-1 text-xs w-20"
                    value={pendingHistXMax}
                    min={pendingHistXMin || results.minReturn}
                    max={results.maxReturn}
                    step="0.01"
                    onChange={e => setPendingHistXMax(e.target.value)}
                  />
                  <button
                    className="ml-2 px-2 py-1 text-xs rounded bg-blue-100 border border-blue-300 hover:bg-blue-200 text-blue-700"
                    onClick={() => {
                      setHistXMin(Number(pendingHistXMin));
                      setHistXMax(Number(pendingHistXMax));
                    }}
                  >Update</button>
                  <button
                    className="ml-1 px-2 py-1 text-xs rounded bg-gray-100 border border-gray-300 hover:bg-gray-200 text-gray-700"
                    onClick={() => {
                      setHistXMin(null);
                      setHistXMax(null);
                      setPendingHistXMin(results.minReturn.toString());
                      setPendingHistXMax(results.maxReturn.toString());
                    }}
                  >Reset</button>
                </div>
              )}
              <div className="mb-1" style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={histData} margin={{ left: 80, right: 20, top: 20, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="binStart"
                      type="number"
                      domain={[(histXMin !== null ? histXMin : results?.minReturn) || 0, (histXMax !== null ? histXMax : results?.maxReturn) || 1]}
                      // label={{ value: 'Portfolio Return', position: 'bottom', offset: 20 }}
                      tickFormatter={v => v.toFixed(2)}
                      allowDataOverflow={true}
                    />
                    <YAxis /*label={{ value: 'Count', angle: -90, position: 'left', offset: 40 }}*/ />
                    <Tooltip labelFormatter={(_, i) => histData[i]?.bin || ''} />
                    <Bar dataKey="count" fill="#60a5fa" name="Count" />
                    {showMean && <ReferenceLine x={results.mean} stroke="green" label="Mean" />}
                    {showMedian && <ReferenceLine x={results.median} stroke="orange" label="Median" />}
                    {showBreakEven && <ReferenceLine x={1} stroke="red" label="Break-even" />}
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="text-xs text-gray-500 mb-4">X: Portfolio Return, Y: Count</div>
            </>
          )}
          {tab === 'loghist' && (
            <>
              <h3 className="text-lg font-semibold mb-2">Log-Scale Portfolio Return Distribution</h3>
              <div className="mb-1" style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={logHistData} margin={{ left: 60, right: 20, top: 20, bottom: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="bin" interval={4} angle={-30} textAnchor="end" height={60} /*label={{ value: 'Log Portfolio Return', position: 'insideBottom', offset: -5 }}*/ />
                    <YAxis /*label={{ value: 'Count', angle: -90, position: 'insideLeft', offset: 20 }}*/ />
                    <Tooltip />
                    <Bar dataKey="count" fill="#fbbf24" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="text-xs text-gray-500 mb-4">X: Log Portfolio Return, Y: Count</div>
            </>
          )}
          {tab === 'cdf' && (
            <>
              <h3 className="text-lg font-semibold mb-2">Cumulative Distribution Function (CDF)</h3>
              <div className="mb-1" style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer width="100%" height={240}>
                  <ComposedChart data={cdfData} margin={{ left: 60, right: 20, top: 20, bottom: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="x" type="number" domain={['auto', 'auto']} /*label={{ value: 'Portfolio Return', position: 'insideBottom', offset: -5 }}*/ />
                    <YAxis dataKey="p" type="number" domain={[0, 1]} /*label={{ value: 'Cumulative Probability', angle: -90, position: 'insideLeft', offset: 20 }}*/ />
                    <Tooltip />
                    <Line type="monotone" dataKey="p" stroke="#6366f1" dot={false} />
                    <ReferenceLine x={1} stroke="red" label="Break-even" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="text-xs text-gray-500 mb-4">X: Portfolio Return, Y: Cumulative Probability</div>
            </>
          )}
          {tab === 'sharpe' && (
            <>
              <h3 className="text-lg font-semibold mb-2">Risk-Adjusted Performance (Sharpe Ratio)</h3>
              {sizeLoading ? (
                <div className="py-8 text-center text-gray-500">Simulating...</div>
              ) : sizeAnalysis ? (
                <>
                  <div className="mb-1" style={{ width: '100%', height: 340 }}>
                  <ResponsiveContainer width="100%" height={340}>
                    <LineChart data={sizeAnalysis} margin={{ left: 60, right: 20, top: 20, bottom: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="size" /*label={{ value: 'Portfolio Size', position: 'insideBottom', offset: -5 }}*/ />
                        <YAxis /*label={{ value: 'Sharpe Ratio', angle: -90, position: 'insideLeft', offset: 20 }}*/ />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="sharpe" stroke="#10b981" name="Sharpe Ratio" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                  <div className="text-xs text-gray-500 mb-4">X: Portfolio Size, Y: Sharpe Ratio</div>
                </>
              ) : (
                <div className="py-8 text-center text-gray-500">Click the tab to run analysis.</div>
              )}
            </>
          )}
          {tab === 'quant' && (
            <>
              <h3 className="text-lg font-semibold mb-2">Portfolio Return Quantiles</h3>
              <div className="mb-1" style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={quantileData} margin={{ left: 60, right: 20, top: 20, bottom: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="q" /*label={{ value: 'Quantile', position: 'insideBottom', offset: -5 }}*/ />
                    <YAxis /*label={{ value: 'Return', angle: -90, position: 'insideLeft', offset: 20 }}*/ />
                    <Tooltip />
                    <Bar dataKey="value" fill="#a78bfa" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="text-xs text-gray-500 mb-4">X: Quantile, Y: Return</div>
            </>
          )}
          {tab === 'size' && (
            <>
              <h3 className="text-lg font-semibold mb-2">Portfolio Size Analysis (Mean & Std Dev)</h3>
              {sizeLoading ? (
                <div className="py-8 text-center text-gray-500">Simulating...</div>
              ) : sizeAnalysis ? (
                <>
                  <div className="mb-1" style={{ width: '100%', height: 260 }}>
                  <ResponsiveContainer width="100%" height={260}>
                    <ComposedChart data={meanStdData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="size" />
                        <YAxis yAxisId="left" /*label={{ value: 'Mean', angle: -90, position: 'insideLeft' }}*/ />
                        <YAxis yAxisId="right" orientation="right" /*label={{ value: 'Std Dev', angle: 90, position: 'insideRight' }}*/ />
                      <Tooltip />
                      <Legend />
                      <Line yAxisId="left" type="monotone" dataKey="mean" stroke="#2563eb" name="Mean" />
                      <Line yAxisId="right" type="monotone" dataKey="std" stroke="#f87171" name="Std Dev" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                  <div className="text-xs text-gray-500 mb-4">X: Portfolio Size, Y (left): Mean, Y (right): Std Dev</div>
                </>
              ) : (
                <div className="py-8 text-center text-gray-500">Click the tab to run analysis.</div>
              )}
            </>
          )}
          {tab === 'violin' && (
            <>
              <h3 className="text-lg font-semibold mb-2">Return Distribution by Portfolio Size</h3>
              {sizeLoading ? (
                <div className="py-8 text-center text-gray-500">Simulating...</div>
              ) : sizeAnalysis ? (
                <div className="mb-1 flex flex-col items-center gap-8">
                  {/* Render one chart per portfolio size */}
                  {violinData.map((d, idx) => {
                    const kde = computeKDE(d.returns, 200);
                    // Find x domain where density > 0.01
                    let minX = Infinity, maxX = -Infinity;
                    kde.forEach(pt => {
                      if (pt.y > 0.01) {
                        if (pt.x < minX) minX = pt.x;
                        if (pt.x > maxX) maxX = pt.x;
                      }
                    });
                    const range = maxX - minX;
                    minX = Math.max(0, minX - range * 0.05);
                    maxX = maxX + range * 0.05;
                    if (!isFinite(minX) || !isFinite(maxX) || minX >= maxX) {
                      minX = 0;
                      maxX = 1.5;
                    }
                    return (
                      <div key={d.size} className="w-full">
                        <div className="text-sm font-semibold mb-1">Portfolio Size: {d.size}</div>
                        <ResponsiveContainer width="100%" height={180}>
                          <LineChart data={kde} margin={{ left: 40, right: 20, top: 20, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" dataKey="x" domain={[minX, maxX]} />
                            <YAxis type="number" />
                            <Tooltip formatter={(v: number) => v.toFixed(4)} labelFormatter={(v: number) => v.toFixed(3)} />
                            <Line
                              dataKey="y"
                              stroke={DENSITY_COLORS[idx % DENSITY_COLORS.length]}
                              dot={false}
                              isAnimationActive={false}
                              type="monotone"
                              strokeWidth={2.5}
                              activeDot={{ r: 5 }}
                            />
                            <ReferenceLine x={1} stroke="#ef4444" strokeDasharray="4 2" strokeWidth={2} label={{ value: 'Break-even', position: 'top', fill: '#ef4444', fontSize: 12 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    );
                  })}
                  <div className="text-xs text-gray-500 mt-2 mb-4">X: Return, Y: Density</div>
                </div>
              ) : (
                <div className="py-8 text-center text-gray-500">Click the tab to run analysis.</div>
              )}
            </>
          )}
          {tab === 'prob' && (
            <>
              <h3 className="text-lg font-semibold mb-2">Return Probabilities</h3>
              {sizeLoading ? (
                <div className="py-8 text-center text-gray-500">Simulating...</div>
              ) : sizeAnalysis ? (
                <>
                  <div className="mb-1" style={{ width: '100%', height: 340 }}>
                  <ResponsiveContainer width="100%" height={340}>
                    <LineChart data={probData} margin={{ left: 60, right: 20, top: 20, bottom: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="size" /*label={{ value: 'Portfolio Size', position: 'insideBottom', offset: -5 }}*/ />
                        <YAxis /*label={{ value: 'Probability', angle: -90, position: 'insideLeft', offset: 20 }}*/ domain={[0, 1]} />
                        <Tooltip formatter={v => (typeof v === 'number' ? (v * 100).toFixed(1) + '%' : v)} />
                      <Legend />
                      <Line type="monotone" dataKey="probLoss" stroke="#ef4444" name="Prob(Loss)" />
                      <Line type="monotone" dataKey="prob2x" stroke="#10b981" name="Prob(2x+)" />
                      <Line type="monotone" dataKey="prob10x" stroke="#a21caf" name="Prob(10x+)" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                  <div className="text-xs text-gray-500 mb-4">X: Portfolio Size, Y: Probability</div>
                </>
              ) : (
                <div className="py-8 text-center text-gray-500">Click the tab to run analysis.</div>
              )}
            </>
          )}
          {tab === 'batch' && results && results.allInvestmentReturns && results.allInvestmentReturns.length > 0 && (
            (() => {
              // Use batchSimIndex for navigation
              const nSims = results.allInvestmentReturns.length;
              const investment_returns = results.allInvestmentReturns[batchSimIndex] as number[];
              const n_investments = investment_returns.length;
              const per_investment_value = 1.0 / n_investments;
              // Performance tiers
              const points = investment_returns.map((ret: number, i: number) => {
                let tier = 'Loss', color = '#ef4444';
                if (ret < per_investment_value) {
                  tier = 'Loss'; color = '#ef4444';
                } else if (ret < 1.5 * per_investment_value) {
                  tier = 'Break-even'; color = '#f59e42';
                } else if (ret < 3 * per_investment_value) {
                  tier = 'Modest'; color = '#fbbf24';
                } else if (ret < 10 * per_investment_value) {
                  tier = 'Good'; color = '#10b981';
                } else {
                  tier = 'Excellent'; color = '#166534';
                }
                // Size: log scale for better visualization
                const size = 20 + 100 * Math.log10(Math.max(ret, 0.001) / per_investment_value + 1);
                return { i, ret, tier, color, size };
              });
              // Reference lines
              const refLines = [per_investment_value, 2 * per_investment_value, 5 * per_investment_value];
              const refLineMeta = [
                { color: '#ef4444', label: 'Break-even (1x)' },
                { color: '#2563eb', label: '2x return' },
                { color: '#22c55e', label: '5x return' },
              ];
              // Y scale: log if needed
              const max_return = Math.max(...investment_returns);
              const min_return = Math.min(...investment_returns.filter((x: number) => x > 0)) || 0.001;
              const useLog = max_return / min_return > 100;
              // Stats
              const winners = investment_returns.filter((x: number) => x >= per_investment_value).length;
              const losers = investment_returns.filter((x: number) => x < per_investment_value).length;
              const top_return = Math.max(...investment_returns) / per_investment_value;
              const avg_return = investment_returns.reduce((a: number, b: number) => a + b, 0) / n_investments / per_investment_value;
              const total_portfolio = investment_returns.reduce((a: number, b: number) => a + b, 0);
              // SVG layout
              const svgWidth = 750;
              const svgHeight = 420;
              const leftPad = 60;
              const rightPad = 28;
              const topPad = 28;
              const bottomPad = 56;
              const plotWidth = svgWidth - leftPad - rightPad;
              const plotHeight = svgHeight - topPad - bottomPad;
              // X scale: fit all investments in plotWidth
              const getX = (idx: number) => leftPad + (plotWidth * idx) / (n_investments - 1 || 1);
              // Y scale
              const getY = (ret: number) => {
                if (useLog) {
                  return topPad + plotHeight - plotHeight * (Math.log10(ret) - Math.log10(min_return)) / (Math.log10(max_return) - Math.log10(min_return));
                } else {
                  return topPad + plotHeight - plotHeight * (ret - min_return) / (max_return - min_return);
                }
              };
              return (
                <div className="mb-1 flex flex-col items-center w-full">
                  {/* Navigation arrows */}
                  <div className="flex items-center gap-2 mb-2">
                    <button
                      className="px-2 py-1 rounded bg-gray-100 border border-gray-300 hover:bg-gray-200 text-gray-700 disabled:opacity-50"
                      onClick={() => setBatchSimIndex(i => Math.max(0, i - 1))}
                      disabled={batchSimIndex === 0}
                      aria-label="Previous simulation"
                    >
                      &#8592;
                    </button>
                    <span className="text-sm font-semibold">Simulation #{batchSimIndex + 1} of {nSims}</span>
                    <button
                      className="px-2 py-1 rounded bg-gray-100 border border-gray-300 hover:bg-gray-200 text-gray-700 disabled:opacity-50"
                      onClick={() => setBatchSimIndex(i => Math.min(nSims - 1, i + 1))}
                      disabled={batchSimIndex === nSims - 1}
                      aria-label="Next simulation"
                    >
                      &#8594;
                    </button>
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Investment Batch Overview (Simulation #{batchSimIndex + 1})</h3>
                  <div style={{ width: svgWidth, overflowX: 'auto' }}>
                    <svg width={svgWidth} height={svgHeight} style={{ background: '#fff', borderRadius: 8, border: '1px solid #eee', display: 'block' }}>
                      {/* Points */}
                      {points.map((pt: { i: number; ret: number; tier: string; color: string; size: number }, idx: number) => {
                        const x = getX(idx);
                        const y = getY(pt.ret);
                        return (
                          <circle
                            key={idx}
                            cx={x}
                            cy={y}
                            r={pt.size / 20}
                            fill={pt.color}
                            stroke="#222"
                            strokeWidth={0.5}
                            opacity={0.7}
                          >
                            <title>
                              {`Investment #${idx + 1}\nReturn: ${pt.ret.toFixed(4)}\nTier: ${pt.tier}`}
                            </title>
                          </circle>
                        );
                      })}
                      {/* Axes */}
                      <line x1={leftPad} x2={leftPad} y1={topPad} y2={svgHeight - bottomPad} stroke="#222" strokeWidth={1.5} />
                      <line x1={leftPad} x2={svgWidth - rightPad} y1={svgHeight - bottomPad} y2={svgHeight - bottomPad} stroke="#222" strokeWidth={1.5} />
                      {/* X ticks */}
                      {[0, Math.floor(n_investments / 2), n_investments - 1].map((i: number) => {
                        const x = getX(i);
                        return (
                          <g key={i}>
                            <line x1={x} x2={x} y1={svgHeight - bottomPad} y2={svgHeight - bottomPad + 8} stroke="#222" />
                            <text x={x} y={svgHeight - bottomPad + 22} fontSize={12} textAnchor="middle">{i + 1}</text>
                          </g>
                        );
                      })}
                      {/* Y ticks */}
                      {(useLog
                        ? [min_return, per_investment_value, 2 * per_investment_value, 5 * per_investment_value, max_return]
                        : [min_return, per_investment_value, 2 * per_investment_value, 5 * per_investment_value, max_return]
                      ).map((y: number, i: number) => {
                        const yPos = getY(y);
                        return (
                          <g key={i}>
                            <line x1={leftPad - 5} x2={leftPad} y1={yPos} y2={yPos} stroke="#222" />
                            <text x={leftPad - 10} y={yPos + 4} fontSize={12} textAnchor="end">{y.toFixed(2)}</text>
                          </g>
                        );
                      })}
                      {/* Axis labels */}
                      <text x={leftPad + plotWidth / 2} y={svgHeight - 18} fontSize={14} textAnchor="middle" fontWeight="bold">Investment Index</text>
                      <text x={18} y={topPad + plotHeight / 2} fontSize={14} textAnchor="middle" fontWeight="bold" transform={`rotate(-90 18,${topPad + plotHeight / 2})`}>{useLog ? 'Return Value (log scale)' : 'Return Value'}</text>
                    </svg>
                  </div>
                  {/* Summary statistics box */}
                  <div className="mt-4 p-2 bg-white border rounded shadow text-xs font-mono text-left" style={{ minWidth: 220 }}>
                    <div><b>Summary Statistics:</b></div>
                    <div>Winners: {winners} ({((winners / n_investments) * 100).toFixed(1)}%)</div>
                    <div>Losers: {losers} ({((losers / n_investments) * 100).toFixed(1)}%)</div>
                    <div>Top Return: {top_return.toFixed(1)}x</div>
                    <div>Avg Return: {avg_return.toFixed(2)}x</div>
                    <div>Total Portfolio: {total_portfolio.toFixed(2)}x initial</div>
                  </div>
                  <div className="text-xs text-gray-500 mt-2 mb-4">X: Investment Index, Y: Return Value</div>
                </div>
              );
            })()
          )}
          {/* Summary stats table (always visible) */}
          <div className="mt-6 bg-gray-50 rounded-lg shadow-sm p-4 flex flex-col gap-2">
            {/* 1st line: Mean, Std Deviation, Median */}
            <div className="flex flex-wrap gap-6 items-center">
              <TrendingUp className="w-5 h-5 text-blue-500 mr-2" />
              <span className="text-sm text-gray-500">Mean</span><span className="text-xl font-semibold">{results.mean.toFixed(3)}</span>
              <span className="text-sm text-gray-500 ml-6">Std Dev</span><span className="text-xl font-semibold">{results.std.toFixed(3)}</span>
              <span className="text-sm text-gray-500 ml-6">Median</span><span className="text-xl font-semibold">{results.median.toFixed(3)}</span>
            </div>
            {/* 2nd line: Probability dropdown */}
            <div className="flex flex-wrap gap-6 items-center">
              <PercentCircle className="w-5 h-5 text-red-500 mr-2" />
              <span className="text-sm text-gray-500">Probability</span>
              <select
                className="text-sm rounded border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                value={selectedProbability}
                onChange={e => setSelectedProbability(e.target.value)}
              >
                {probabilityOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <span className="text-xl font-semibold">
                {((results[selectedProbability] ?? 0) * 100).toFixed(2)}%
              </span>
            </div>
            {/* 3rd line: Max Return, Min Return */}
            <div className="flex flex-wrap gap-6 items-center">
              <ArrowDownCircle className="w-5 h-5 text-yellow-500 mr-2" />
              <span className="text-sm text-gray-500">Max Return</span><span className="text-xl font-semibold">{results.maxReturn.toFixed(3)}</span>
              <span className="text-sm text-gray-500 ml-6">Min Return</span><span className="text-xl font-semibold">{results.minReturn.toFixed(3)}</span>
            </div>
            {/* 4th line: Quantile, Execution Time */}
            <div className="flex flex-wrap gap-6 items-center">
              <BarChart2 className="w-5 h-5 text-gray-400 mr-2" />
              <span className="text-sm text-gray-500">Quantile</span>
              <select className="text-sm rounded border-gray-300 focus:ring-blue-500 focus:border-blue-500" value={selectedQuantile} onChange={e => setSelectedQuantile(e.target.value)}>{quantileOptions.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}</select>
              <span className="text-xl font-semibold">{results[selectedQuantile]?.toFixed(3)}</span>
              <span className="text-sm text-gray-500 ml-6">Execution Time</span><span className="text-xl font-semibold">{results.executionTime.toFixed(2)}s</span>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

// Add a no-op handleSizeAnalysis to fix missing reference error
function handleSizeAnalysis() {}