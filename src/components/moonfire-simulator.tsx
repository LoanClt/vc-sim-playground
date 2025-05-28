import React, { useState, useRef, useEffect, useCallback, Fragment } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ReferenceLine, Legend, ComposedChart, Area, LineChart } from 'recharts';
import { Share2, AlertTriangle, BarChart2, TrendingUp, Sigma, Hash, ArrowDownCircle, PercentCircle, Copy, Info } from 'lucide-react';
import { toast } from 'sonner';
import chroma from 'chroma-js';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Popover, PopoverTrigger, PopoverContent } from './ui/popover';
import { Slider } from './ui/slider';

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
  let histData: { bin: string; count: number }[] = [];
  let logHistData: { bin: string; count: number }[] = [];
  let cdfData: { x: number; p: number }[] = [];
  if (results) {
    // Linear histogram
    const binCount = 30;
    const min = results.minReturn;
    const max = results.maxReturn;
    const binSize = (max - min) / binCount;
    const bins = Array(binCount).fill(0);
    results.portfolioReturns.forEach((val: number) => {
      let idx = Math.floor((val - min) / binSize);
      if (idx >= binCount) idx = binCount - 1;
      bins[idx]++;
    });
    histData = bins.map((count, i) => ({
      bin: `${(min + i * binSize).toFixed(2)}-${(min + (i + 1) * binSize).toFixed(2)}`,
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

  const DENSITY_COLORS = ['#6366f1', '#f59e42', '#10b981', '#ef4444', '#a78bfa', '#fbbf24'];

  function computeKDE(data: number[], steps = 100) {
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
                <span className="ml-2 text-xs text-gray-500">{alpha.toFixed(2)}</span>
              </div>
              <Slider min={1} max={3} step={0.1} value={[alpha]} onValueChange={v => setAlpha(Number(v[0]))} className="mb-2" />
              <label className="text-xs font-medium">Worst Case Return (%)</label>
              <span className="ml-2 text-xs text-gray-500">{(xMin * 100).toFixed(0)}%</span>
              <Slider min={10} max={50} step={1} value={[xMin * 100]} onValueChange={v => setXMin(Number(v[0]) / 100)} className="mb-2" />
              <label className="text-xs font-medium">Best Case Return (%)</label>
              <Input type="number" step="0.01" min={0} max={100} value={xMax * 100} onChange={e => setXMax(Number(e.target.value) / 100)} />
              <label className="text-xs font-medium"># Investments</label>
              <span className="ml-2 text-xs text-gray-500">{nInvestments}</span>
              <Slider min={50} max={300} step={1} value={[nInvestments]} onValueChange={v => setNInvestments(Number(v[0]))} className="mb-2" />
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium"># Simulations</label>
                <span className="text-sm font-bold">{nSimulations}</span>
              </div>
              {simError && (
                <div className="flex items-center gap-2 mt-1 text-red-600 text-xs bg-red-50 border border-red-200 rounded px-2 py-1">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  {simError}
                </div>
              )}
              <Input type="number" step="1" value={nSimulations} onChange={e => handleSimulationsChange(Number(e.target.value))} />
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
                <Button onClick={handleRunSimulation} disabled={loading} size="sm">
                  {loading ? 'Simulating...' : 'Run Simulation'}
                </Button>
              </div>
              {results && (
                <>
                  <div className="mb-4 flex gap-2 flex-wrap">
                    <button className={`px-3 py-1 rounded ${tab === 'hist' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`} onClick={() => setTab('hist')}>Histogram</button>
                    <button className={`px-3 py-1 rounded ${tab === 'loghist' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`} onClick={() => setTab('loghist')}>Log-Scale Histogram</button>
                    <button className={`px-3 py-1 rounded ${tab === 'cdf' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`} onClick={() => setTab('cdf')}>CDF</button>
                    <button className={`px-3 py-1 rounded ${tab === 'sharpe' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`} onClick={() => { setTab('sharpe'); if (!sizeAnalysis && !sizeLoading) handleSizeAnalysis(); }}>Risk-Adjusted Performance</button>
                    <button className={`px-3 py-1 rounded ${tab === 'quant' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`} onClick={() => setTab('quant')}>Quantiles</button>
                    <button className={`px-3 py-1 rounded ${tab === 'heat' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`} onClick={() => setTab('heat')}>Investment Heatmap</button>
                    <button className={`px-3 py-1 rounded ${tab === 'size' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`} onClick={() => { setTab('size'); if (!sizeAnalysis && !sizeLoading) handleSizeAnalysis(); }}>Portfolio Size Analysis</button>
                    <button className={`px-3 py-1 rounded ${tab === 'violin' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`} onClick={() => { setTab('violin'); if (!sizeAnalysis && !sizeLoading) handleSizeAnalysis(); }}>Return Distribution by Size</button>
                    <button className={`px-3 py-1 rounded ${tab === 'prob' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`} onClick={() => { setTab('prob'); if (!sizeAnalysis && !sizeLoading) handleSizeAnalysis(); }}>Return Probabilities</button>
                  </div>
                  {tab === 'hist' && (
                    <>
                      <h3 className="text-lg font-semibold mb-2">Portfolio Return Distribution</h3>
                      <div className="mb-4" style={{ width: '100%', height: 240 }}>
                        <ResponsiveContainer width="100%" height={240}>
                          <BarChart data={histData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="bin" interval={4} angle={-30} textAnchor="end" height={60} />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="count" fill="#60a5fa" />
                            <ReferenceLine x={results.mean.toFixed(2)} stroke="green" label="Mean" />
                            <ReferenceLine x={results.median.toFixed(2)} stroke="orange" label="Median" />
                            <ReferenceLine x={1} stroke="red" label="Break-even" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </>
                  )}
                  {tab === 'loghist' && (
                    <>
                      <h3 className="text-lg font-semibold mb-2">Log-Scale Portfolio Return Distribution</h3>
                      <div className="mb-4" style={{ width: '100%', height: 240 }}>
                        <ResponsiveContainer width="100%" height={240}>
                          <BarChart data={logHistData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="bin" interval={4} angle={-30} textAnchor="end" height={60} />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="count" fill="#fbbf24" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </>
                  )}
                  {tab === 'cdf' && (
                    <>
                      <h3 className="text-lg font-semibold mb-2">Cumulative Distribution Function (CDF)</h3>
                      <div className="mb-4" style={{ width: '100%', height: 240 }}>
                        <ResponsiveContainer width="100%" height={240}>
                          <ComposedChart data={cdfData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="x" type="number" domain={['auto', 'auto']} />
                            <YAxis dataKey="p" type="number" domain={[0, 1]} />
                            <Tooltip />
                            <Line type="monotone" dataKey="p" stroke="#6366f1" dot={false} />
                            <ReferenceLine x={1} stroke="red" label="Break-even" />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </>
                  )}
                  {tab === 'sharpe' && (
                    <>
                      <h3 className="text-lg font-semibold mb-2">Risk-Adjusted Performance (Sharpe Ratio)</h3>
                      {sizeLoading ? (
                        <div className="py-8 text-center text-gray-500">Simulating...</div>
                      ) : sizeAnalysis ? (
                        (() => {
                          // Filter out invalid or non-finite sharpe values
                          const validSharpeData = sizeAnalysis.filter(r => Number.isFinite(r.sharpe));
                          if (!validSharpeData.length) {
                            return <div className="py-8 text-center text-gray-500">No valid data to plot Sharpe Ratio.</div>;
                          }
                          return (
                            <div className="mb-4" style={{ width: '100%', height: 260 }}>
                              <ResponsiveContainer width="100%" height={260}>
                                <LineChart data={validSharpeData}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="size" />
                                  <YAxis label={{ value: 'Sharpe Ratio', angle: -90, position: 'insideLeft' }} />
                                  <Tooltip />
                                  <Legend />
                                  <Line type="monotone" dataKey="sharpe" stroke="#10b981" name="Sharpe Ratio" />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          );
                        })()
                      ) : (
                        <div className="py-8 text-center text-gray-500">Click the tab to run analysis.</div>
                      )}
                    </>
                  )}
                  {tab === 'quant' && (
                    <>
                      <h3 className="text-lg font-semibold mb-2">Portfolio Return Quantiles</h3>
                      <div className="mb-4" style={{ width: '100%', height: 240 }}>
                        <ResponsiveContainer width="100%" height={240}>
                          <BarChart data={quantileData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="q" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="value" fill="#a78bfa" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </>
                  )}
                  {tab === 'heat' && (
                    <>
                      <h3 className="text-lg font-semibold mb-2">Investment Returns Heatmap (First 50 Simulations)</h3>
                      <div className="mb-4 flex flex-col items-center">
                        {heatmapData && heatmapData.length > 0 ? (
                          <svg width={Math.max(600, 8 * nInvestments)} height={16 * nSimulationsHeatmap + 40} style={{ background: '#fff', borderRadius: 8, border: '1px solid #eee' }}>
                            {/* Color grid */}
                            {heatmapData.map((row, i) =>
                              row.map((val, j) => {
                                // Viridis colormap using chroma-js
                                const color = chroma.scale('viridis').domain([heatmapStats.min, heatmapStats.max])(val).hex();
                                return <rect key={i + '-' + j} x={j * 8} y={i * 16} width={8} height={16} fill={color} />;
                              })
                            )}
                            {/* Axes labels */}
                            <text x={8} y={16 * nSimulationsHeatmap + 20} fontSize={12} fill="#444">Investment Index →</text>
                            <text x={-60} y={16 * nSimulationsHeatmap / 2} fontSize={12} fill="#444" transform={`rotate(-90 0,${16 * nSimulationsHeatmap / 2})`}>Simulation Number ↓</text>
                          </svg>
                        ) : (
                          <div className="py-8 text-center text-gray-500">No data to display heatmap.</div>
                        )}
                        {/* Stats box */}
                        {heatmapStats && (
                          <div className="mt-4 p-2 bg-white border rounded shadow text-xs font-mono text-left" style={{ minWidth: 220 }}>
                            <div><b>Statistics:</b></div>
                            <div>Mean: {heatmapStats.mean.toFixed(4)}x</div>
                            <div>Max: {heatmapStats.max.toFixed(2)}x</div>
                            <div>Min: {heatmapStats.min.toFixed(4)}x</div>
                            <div>Std: {heatmapStats.std.toFixed(4)}</div>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                  {tab === 'size' && (
                    <>
                      <h3 className="text-lg font-semibold mb-2">Portfolio Size Analysis (Mean & Std Dev)</h3>
                      {sizeLoading ? (
                        <div className="py-8 text-center text-gray-500">Simulating...</div>
                      ) : sizeAnalysis ? (
                        <div className="mb-4" style={{ width: '100%', height: 260 }}>
                          <ResponsiveContainer width="100%" height={260}>
                            <ComposedChart data={meanStdData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="size" />
                              <YAxis yAxisId="left" label={{ value: 'Mean', angle: -90, position: 'insideLeft' }} />
                              <YAxis yAxisId="right" orientation="right" label={{ value: 'Std Dev', angle: 90, position: 'insideRight' }} />
                              <Tooltip />
                              <Legend />
                              <Line yAxisId="left" type="monotone" dataKey="mean" stroke="#2563eb" name="Mean" />
                              <Line yAxisId="right" type="monotone" dataKey="std" stroke="#f87171" name="Std Dev" />
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
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
                        <div className="mb-4 flex flex-col items-center">
                          <svg width={480} height={260} style={{ background: '#f9fafb', borderRadius: 8, border: '1px solid #eee' }}>
                            {/* Axes */}
                            <line x1={40} x2={40} y1={20} y2={220} stroke="#888" strokeWidth={1} />
                            <line x1={40} x2={440} y1={220} y2={220} stroke="#888" strokeWidth={1} />
                            {/* Densities */}
                            {violinData.map((d, idx) => {
                              const kde = computeKDE(d.returns, 100);
                              if (!kde.length) return null;
                              const minX = Math.min(...kde.map(p => p.x));
                              const maxX = Math.max(...kde.map(p => p.x));
                              const maxY = Math.max(...kde.map(p => p.y));
                              // Scales
                              const x = (v: number) => 40 + ((v - minX) / (maxX - minX + 1e-8)) * 400;
                              const y = (v: number) => 220 - (v / (maxY + 1e-8)) * 180;
                              // Path
                              const path = kde.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.x)},${y(p.y)}`).join(' ');
                              return (
                                <path key={d.size} d={path} fill="none" stroke={DENSITY_COLORS[idx % DENSITY_COLORS.length]} strokeWidth={3} />
                              );
                            })}
                            {/* X axis ticks/labels */}
                            {Array.from({ length: 6 }, (_, i) => {
                              const v = i / 5;
                              const min = Math.min(...violinData.flatMap(d => d.returns));
                              const max = Math.max(...violinData.flatMap(d => d.returns));
                              const val = min + v * (max - min);
                              return (
                                <g key={i}>
                                  <line x1={40 + v * 400} x2={40 + v * 400} y1={220} y2={225} stroke="#888" />
                                  <text x={40 + v * 400} y={238} fontSize={11} textAnchor="middle" fill="#444">{val.toFixed(2)}</text>
                                </g>
                              );
                            })}
                            {/* Y axis ticks/labels */}
                            {Array.from({ length: 5 }, (_, i) => {
                              const v = i / 4;
                              const maxY = Math.max(...violinData.map(d => {
                                const kde = computeKDE(d.returns, 100);
                                return Math.max(...kde.map(p => p.y));
                              }));
                              const val = v * maxY;
                              return (
                                <g key={i}>
                                  <line x1={35} x2={40} y1={220 - v * 180} y2={220 - v * 180} stroke="#888" />
                                  <text x={28} y={224 - v * 180} fontSize={11} textAnchor="end" fill="#444">{val.toFixed(2)}</text>
                                </g>
                              );
                            })}
                            {/* Axis labels */}
                            <text x={240} y={255} textAnchor="middle" fontSize={13} fill="#444">Return</text>
                            <text x={10} y={120} textAnchor="middle" fontSize={13} fill="#444" transform="rotate(-90 10,120)">Density</text>
                          </svg>
                          {/* Legend */}
                          <div className="flex gap-4 mt-2">
                            {violinData.map((d, idx) => (
                              <div key={d.size} className="flex items-center gap-1">
                                <span style={{ width: 16, height: 4, background: DENSITY_COLORS[idx % DENSITY_COLORS.length], display: 'inline-block', borderRadius: 2 }}></span>
                                <span className="text-xs text-gray-700">Size {d.size}</span>
                              </div>
                            ))}
                          </div>
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
                        <div className="mb-4" style={{ width: '100%', height: 260 }}>
                          <ResponsiveContainer width="100%" height={260}>
                            <LineChart data={probData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="size" />
                              <YAxis label={{ value: 'Probability', angle: -90, position: 'insideLeft' }} domain={[0, 1]} />
                              <Tooltip formatter={v => (v * 100).toFixed(1) + '%'} />
                              <Legend />
                              <Line type="monotone" dataKey="probLoss" stroke="#ef4444" name="Prob(Loss)" />
                              <Line type="monotone" dataKey="prob2x" stroke="#10b981" name="Prob(2x+)" />
                              <Line type="monotone" dataKey="prob10x" stroke="#a21caf" name="Prob(10x+)" />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="py-8 text-center text-gray-500">Click the tab to run analysis.</div>
                      )}
                    </>
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
        <h2 className="text-2xl font-bold mb-2">Moonfire Power-Law Portfolio Simulator</h2>
        <p className="text-sm text-gray-500 mb-4">
          Based on <a href="https://arxiv.org/pdf/2303.11013" target="_blank" rel="noopener noreferrer" className="underline">Venture Capital Portfolio Construction</a> (Moonfire Ventures).
        </p>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
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
            <Input type="number" step="0.01" value={alpha} onChange={e => setAlpha(Number(e.target.value))} />
          </div>
          <div>
            <label className="text-xs font-medium">Worst Case Return (%)</label>
            <Input type="number" step="0.01" min={0} max={100} value={xMin * 100} onChange={e => setXMin(Number(e.target.value) / 100)} />
          </div>
          <div>
            <label className="text-xs font-medium">Best Case Return (%)</label>
            <Input type="number" step="0.01" min={0} max={100} value={xMax * 100} onChange={e => setXMax(Number(e.target.value) / 100)} />
          </div>
          <div>
            <label className="text-xs font-medium"># Investments</label>
            <Input type="number" step="1" value={nInvestments} onChange={e => setNInvestments(Number(e.target.value))} />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium"># Simulations</label>
              <span className="text-sm font-bold">{nSimulations}</span>
            </div>
            {simError && (
              <div className="flex items-center gap-2 mt-1 text-red-600 text-xs bg-red-50 border border-red-200 rounded px-2 py-1">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                {simError}
              </div>
            )}
            <Input type="number" step="1" value={nSimulations} onChange={e => handleSimulationsChange(Number(e.target.value))} />
          </div>
        </div>
        <Button onClick={handleRunSimulation} disabled={loading}>
          {loading ? 'Simulating...' : 'Run Moonfire Simulation'}
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
            <button className={`px-3 py-1 rounded ${tab === 'heat' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`} onClick={() => setTab('heat')}>Investment Heatmap</button>
            <button className={`px-3 py-1 rounded ${tab === 'size' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`} onClick={() => { setTab('size'); if (!sizeAnalysis && !sizeLoading) handleSizeAnalysis(); }}>Portfolio Size Analysis</button>
            <button className={`px-3 py-1 rounded ${tab === 'violin' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`} onClick={() => { setTab('violin'); if (!sizeAnalysis && !sizeLoading) handleSizeAnalysis(); }}>Return Distribution by Size</button>
            <button className={`px-3 py-1 rounded ${tab === 'prob' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`} onClick={() => { setTab('prob'); if (!sizeAnalysis && !sizeLoading) handleSizeAnalysis(); }}>Return Probabilities</button>
          </div>
          {tab === 'hist' && (
            <>
              <h3 className="text-lg font-semibold mb-2">Portfolio Return Distribution</h3>
              <div className="mb-4" style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={histData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="bin" interval={4} angle={-30} textAnchor="end" height={60} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#60a5fa" />
                    <ReferenceLine x={results.mean.toFixed(2)} stroke="green" label="Mean" />
                    <ReferenceLine x={results.median.toFixed(2)} stroke="orange" label="Median" />
                    <ReferenceLine x={1} stroke="red" label="Break-even" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
          {tab === 'loghist' && (
            <>
              <h3 className="text-lg font-semibold mb-2">Log-Scale Portfolio Return Distribution</h3>
              <div className="mb-4" style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={logHistData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="bin" interval={4} angle={-30} textAnchor="end" height={60} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#fbbf24" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
          {tab === 'cdf' && (
            <>
              <h3 className="text-lg font-semibold mb-2">Cumulative Distribution Function (CDF)</h3>
              <div className="mb-4" style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer width="100%" height={240}>
                  <ComposedChart data={cdfData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="x" type="number" domain={['auto', 'auto']} />
                    <YAxis dataKey="p" type="number" domain={[0, 1]} />
                    <Tooltip />
                    <Line type="monotone" dataKey="p" stroke="#6366f1" dot={false} />
                    <ReferenceLine x={1} stroke="red" label="Break-even" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
          {tab === 'sharpe' && (
            <>
              <h3 className="text-lg font-semibold mb-2">Risk-Adjusted Performance (Sharpe Ratio)</h3>
              {sizeLoading ? (
                <div className="py-8 text-center text-gray-500">Simulating...</div>
              ) : sizeAnalysis ? (
                (() => {
                  // Filter out invalid or non-finite sharpe values
                  const validSharpeData = sizeAnalysis.filter(r => Number.isFinite(r.sharpe));
                  if (!validSharpeData.length) {
                    return <div className="py-8 text-center text-gray-500">No valid data to plot Sharpe Ratio.</div>;
                  }
                  return (
                    <div className="mb-4" style={{ width: '100%', height: 260 }}>
                      <ResponsiveContainer width="100%" height={260}>
                        <LineChart data={validSharpeData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="size" />
                          <YAxis label={{ value: 'Sharpe Ratio', angle: -90, position: 'insideLeft' }} />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="sharpe" stroke="#10b981" name="Sharpe Ratio" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  );
                })()
              ) : (
                <div className="py-8 text-center text-gray-500">Click the tab to run analysis.</div>
              )}
            </>
          )}
          {tab === 'quant' && (
            <>
              <h3 className="text-lg font-semibold mb-2">Portfolio Return Quantiles</h3>
              <div className="mb-4" style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={quantileData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="q" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#a78bfa" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
          {tab === 'heat' && (
            <>
              <h3 className="text-lg font-semibold mb-2">Investment Returns Heatmap (First 50 Simulations)</h3>
              <div className="mb-4 flex flex-col items-center">
                {heatmapData && heatmapData.length > 0 ? (
                  <svg width={Math.max(600, 8 * nInvestments)} height={16 * nSimulationsHeatmap + 40} style={{ background: '#fff', borderRadius: 8, border: '1px solid #eee' }}>
                    {/* Color grid */}
                    {heatmapData.map((row, i) =>
                      row.map((val, j) => {
                        // Viridis colormap using chroma-js
                        const color = chroma.scale('viridis').domain([heatmapStats.min, heatmapStats.max])(val).hex();
                        return <rect key={i + '-' + j} x={j * 8} y={i * 16} width={8} height={16} fill={color} />;
                      })
                    )}
                    {/* Axes labels */}
                    <text x={8} y={16 * nSimulationsHeatmap + 20} fontSize={12} fill="#444">Investment Index →</text>
                    <text x={-60} y={16 * nSimulationsHeatmap / 2} fontSize={12} fill="#444" transform={`rotate(-90 0,${16 * nSimulationsHeatmap / 2})`}>Simulation Number ↓</text>
                  </svg>
                ) : (
                  <div className="py-8 text-center text-gray-500">No data to display heatmap.</div>
                )}
                {/* Stats box */}
                {heatmapStats && (
                  <div className="mt-4 p-2 bg-white border rounded shadow text-xs font-mono text-left" style={{ minWidth: 220 }}>
                    <div><b>Statistics:</b></div>
                    <div>Mean: {heatmapStats.mean.toFixed(4)}x</div>
                    <div>Max: {heatmapStats.max.toFixed(2)}x</div>
                    <div>Min: {heatmapStats.min.toFixed(4)}x</div>
                    <div>Std: {heatmapStats.std.toFixed(4)}</div>
                  </div>
                )}
              </div>
            </>
          )}
          {tab === 'size' && (
            <>
              <h3 className="text-lg font-semibold mb-2">Portfolio Size Analysis (Mean & Std Dev)</h3>
              {sizeLoading ? (
                <div className="py-8 text-center text-gray-500">Simulating...</div>
              ) : sizeAnalysis ? (
                <div className="mb-4" style={{ width: '100%', height: 260 }}>
                  <ResponsiveContainer width="100%" height={260}>
                    <ComposedChart data={meanStdData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="size" />
                      <YAxis yAxisId="left" label={{ value: 'Mean', angle: -90, position: 'insideLeft' }} />
                      <YAxis yAxisId="right" orientation="right" label={{ value: 'Std Dev', angle: 90, position: 'insideRight' }} />
                      <Tooltip />
                      <Legend />
                      <Line yAxisId="left" type="monotone" dataKey="mean" stroke="#2563eb" name="Mean" />
                      <Line yAxisId="right" type="monotone" dataKey="std" stroke="#f87171" name="Std Dev" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
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
                <div className="mb-4 flex flex-col items-center">
                  <svg width={480} height={260} style={{ background: '#f9fafb', borderRadius: 8, border: '1px solid #eee' }}>
                    {/* Axes */}
                    <line x1={40} x2={40} y1={20} y2={220} stroke="#888" strokeWidth={1} />
                    <line x1={40} x2={440} y1={220} y2={220} stroke="#888" strokeWidth={1} />
                    {/* Densities */}
                    {violinData.map((d, idx) => {
                      const kde = computeKDE(d.returns, 100);
                      if (!kde.length) return null;
                      const minX = Math.min(...kde.map(p => p.x));
                      const maxX = Math.max(...kde.map(p => p.x));
                      const maxY = Math.max(...kde.map(p => p.y));
                      // Scales
                      const x = (v: number) => 40 + ((v - minX) / (maxX - minX + 1e-8)) * 400;
                      const y = (v: number) => 220 - (v / (maxY + 1e-8)) * 180;
                      // Path
                      const path = kde.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.x)},${y(p.y)}`).join(' ');
                      return (
                        <path key={d.size} d={path} fill="none" stroke={DENSITY_COLORS[idx % DENSITY_COLORS.length]} strokeWidth={3} />
                      );
                    })}
                    {/* X axis ticks/labels */}
                    {Array.from({ length: 6 }, (_, i) => {
                      const v = i / 5;
                      const min = Math.min(...violinData.flatMap(d => d.returns));
                      const max = Math.max(...violinData.flatMap(d => d.returns));
                      const val = min + v * (max - min);
                      return (
                        <g key={i}>
                          <line x1={40 + v * 400} x2={40 + v * 400} y1={220} y2={225} stroke="#888" />
                          <text x={40 + v * 400} y={238} fontSize={11} textAnchor="middle" fill="#444">{val.toFixed(2)}</text>
                        </g>
                      );
                    })}
                    {/* Y axis ticks/labels */}
                    {Array.from({ length: 5 }, (_, i) => {
                      const v = i / 4;
                      const maxY = Math.max(...violinData.map(d => {
                        const kde = computeKDE(d.returns, 100);
                        return Math.max(...kde.map(p => p.y));
                      }));
                      const val = v * maxY;
                      return (
                        <g key={i}>
                          <line x1={35} x2={40} y1={220 - v * 180} y2={220 - v * 180} stroke="#888" />
                          <text x={28} y={224 - v * 180} fontSize={11} textAnchor="end" fill="#444">{val.toFixed(2)}</text>
                        </g>
                      );
                    })}
                    {/* Axis labels */}
                    <text x={240} y={255} textAnchor="middle" fontSize={13} fill="#444">Return</text>
                    <text x={10} y={120} textAnchor="middle" fontSize={13} fill="#444" transform="rotate(-90 10,120)">Density</text>
                  </svg>
                  {/* Legend */}
                  <div className="flex gap-4 mt-2">
                    {violinData.map((d, idx) => (
                      <div key={d.size} className="flex items-center gap-1">
                        <span style={{ width: 16, height: 4, background: DENSITY_COLORS[idx % DENSITY_COLORS.length], display: 'inline-block', borderRadius: 2 }}></span>
                        <span className="text-xs text-gray-700">Size {d.size}</span>
                      </div>
                    ))}
                  </div>
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
                <div className="mb-4" style={{ width: '100%', height: 260 }}>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={probData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="size" />
                      <YAxis label={{ value: 'Probability', angle: -90, position: 'insideLeft' }} domain={[0, 1]} />
                      <Tooltip formatter={v => (v * 100).toFixed(1) + '%'} />
                      <Legend />
                      <Line type="monotone" dataKey="probLoss" stroke="#ef4444" name="Prob(Loss)" />
                      <Line type="monotone" dataKey="prob2x" stroke="#10b981" name="Prob(2x+)" />
                      <Line type="monotone" dataKey="prob10x" stroke="#a21caf" name="Prob(10x+)" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="py-8 text-center text-gray-500">Click the tab to run analysis.</div>
              )}
            </>
          )}
        </Card>
      )}
    </div>
  );
}