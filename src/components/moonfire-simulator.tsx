import React, { useState, useRef, useEffect } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ReferenceLine, Legend, ComposedChart, Area } from 'recharts';
import { Share2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

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
    return {
      size,
      mean: sim.mean,
      std: sim.std,
      probLoss: sim.probLoss,
      returns: sim.portfolioReturns,
    };
  });
  return results;
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

  const handleRun = () => {
    setLoading(true);
    setTimeout(() => {
      const simResults = runMoonfireSimulation({
        alpha: Number(alpha),
        xMin: Number(xMin),
        xMax: Number(xMax),
        nInvestments: Number(nInvestments),
        nSimulations: Number(nSimulations),
      });
      setResults(simResults);
      setLoading(false);
    }, 100);
  };

  // Portfolio size analysis (mean/std vs size)
  const portfolioSizes = [10, 25, 50, 100, 200, 500];
  const violinSizes = [25, 50, 100, 200];

  const handleSizeAnalysis = () => {
    setSizeLoading(true);
    setTimeout(() => {
      const res = runPortfolioSizeAnalysis(alpha, xMin, xMax, 2000, portfolioSizes);
      setSizeAnalysis(res);
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

  if (layout === 'split') {
    return (
      <>
        <h1 className="text-3xl font-bold mb-6 text-center">Power-Law & Pareto Simulation</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Parameters Panel */}
          <Card className="p-6 md:col-span-1">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Parameters</h2>
              <Button size="sm" variant="outline" className="flex items-center gap-1" onClick={() => { /* TODO: implement share logic */ }}>
                <Share2 className="w-4 h-4 mr-1" />
                Share Parameters
              </Button>
            </div>
            <div className="flex flex-col gap-3">
              <label className="text-xs font-medium">Pareto α</label>
              <Input type="number" step="0.01" value={alpha} onChange={e => setAlpha(Number(e.target.value))} />
              <label className="text-xs font-medium">xMin</label>
              <Input type="number" step="0.01" value={xMin} onChange={e => setXMin(Number(e.target.value))} />
              <label className="text-xs font-medium">xMax</label>
              <Input type="number" step="0.01" value={xMax} onChange={e => setXMax(Number(e.target.value))} />
              <label className="text-xs font-medium"># Investments</label>
              <Input type="number" step="1" value={nInvestments} onChange={e => setNInvestments(Number(e.target.value))} />
              <label className="text-xs font-medium"># Simulations</label>
              {simError && (
                <div className="flex items-center gap-2 mt-1 text-red-600 text-xs bg-red-50 border border-red-200 rounded px-2 py-1">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  {simError}
                </div>
              )}
              <Input type="number" step="1" value={nSimulations} onChange={e => handleSimulationsChange(Number(e.target.value))} />
            </div>
            <Button onClick={handleRun} disabled={loading} className="mt-6 w-full">
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
                <Button onClick={handleRun} disabled={loading} size="sm">
                  {loading ? 'Simulating...' : 'Run Simulation'}
                </Button>
              </div>
              {results && (
                <>
                  <div className="mb-4 flex gap-2 flex-wrap">
                    <button className={`px-3 py-1 rounded ${tab === 'hist' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`} onClick={() => setTab('hist')}>Histogram</button>
                    <button className={`px-3 py-1 rounded ${tab === 'loghist' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`} onClick={() => setTab('loghist')}>Log-Scale Histogram</button>
                    <button className={`px-3 py-1 rounded ${tab === 'cdf' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`} onClick={() => setTab('cdf')}>CDF</button>
                    <button className={`px-3 py-1 rounded ${tab === 'risk' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`} onClick={() => setTab('risk')}>Risk Metrics</button>
                    <button className={`px-3 py-1 rounded ${tab === 'quant' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`} onClick={() => setTab('quant')}>Quantiles</button>
                    <button className={`px-3 py-1 rounded ${tab === 'heat' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`} onClick={() => setTab('heat')}>Investment Heatmap</button>
                    <button className={`px-3 py-1 rounded ${tab === 'size' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`} onClick={() => { setTab('size'); if (!sizeAnalysis && !sizeLoading) handleSizeAnalysis(); }}>Portfolio Size Analysis</button>
                    <button className={`px-3 py-1 rounded ${tab === 'violin' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`} onClick={() => { setTab('violin'); if (!sizeAnalysis && !sizeLoading) handleSizeAnalysis(); }}>Return Distribution by Size</button>
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
                  {tab === 'risk' && (
                    <>
                      <h3 className="text-lg font-semibold mb-2">Risk Metrics</h3>
                      <div className="mb-4" style={{ width: '100%', height: 240 }}>
                        <ResponsiveContainer width="100%" height={240}>
                          <BarChart data={riskData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="metric" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="value" fill="#f87171">
                              {/* Add value labels */}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
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
                      <div className="mb-4">
                        <CanvasHeatmap data={results.allInvestmentReturns.slice(0, 50)} />
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
                  {/* Summary stats table (always visible) */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                    <div>
                      <div className="text-sm text-gray-500">Mean</div>
                      <div className="text-xl font-semibold">{results.mean.toFixed(3)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Std Deviation</div>
                      <div className="text-xl font-semibold">{results.std.toFixed(3)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Median</div>
                      <div className="text-xl font-semibold">{results.median.toFixed(3)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Probability of Loss (Return &lt; 1x)</div>
                      <div className="text-xl font-semibold">{(results.probLoss * 100).toFixed(2)}%</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Probability of 2x+</div>
                      <div className="text-xl font-semibold">{(results.prob2x * 100).toFixed(2)}%</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Probability of 5x+</div>
                      <div className="text-xl font-semibold">{(results.prob5x * 100).toFixed(2)}%</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Probability of 10x+</div>
                      <div className="text-xl font-semibold">{(results.prob10x * 100).toFixed(2)}%</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">1% Quantile</div>
                      <div className="text-xl font-semibold">{results.quantile01.toFixed(3)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">5% Quantile</div>
                      <div className="text-xl font-semibold">{results.quantile05.toFixed(3)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">10% Quantile</div>
                      <div className="text-xl font-semibold">{results.quantile10.toFixed(3)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">25% Quantile</div>
                      <div className="text-xl font-semibold">{results.quantile25.toFixed(3)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">75% Quantile</div>
                      <div className="text-xl font-semibold">{results.quantile75.toFixed(3)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">90% Quantile</div>
                      <div className="text-xl font-semibold">{results.quantile90.toFixed(3)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">95% Quantile</div>
                      <div className="text-xl font-semibold">{results.quantile95.toFixed(3)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">99% Quantile</div>
                      <div className="text-xl font-semibold">{results.quantile99.toFixed(3)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Min Return</div>
                      <div className="text-xl font-semibold">{results.minReturn.toFixed(3)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Max Return</div>
                      <div className="text-xl font-semibold">{results.maxReturn.toFixed(3)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Execution Time</div>
                      <div className="text-xl font-semibold">{results.executionTime.toFixed(2)}s</div>
                    </div>
                  </div>
                </>
              )}
            </Card>
          </div>
        </div>
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
            <label className="text-xs font-medium">Pareto α</label>
            <Input type="number" step="0.01" value={alpha} onChange={e => setAlpha(Number(e.target.value))} />
          </div>
          <div>
            <label className="text-xs font-medium">xMin</label>
            <Input type="number" step="0.01" value={xMin} onChange={e => setXMin(Number(e.target.value))} />
          </div>
          <div>
            <label className="text-xs font-medium">xMax</label>
            <Input type="number" step="0.01" value={xMax} onChange={e => setXMax(Number(e.target.value))} />
          </div>
          <div>
            <label className="text-xs font-medium"># Investments</label>
            <Input type="number" step="1" value={nInvestments} onChange={e => setNInvestments(Number(e.target.value))} />
          </div>
          <div>
            <label className="text-xs font-medium"># Simulations</label>
            {simError && (
              <div className="flex items-center gap-2 mt-1 text-red-600 text-xs bg-red-50 border border-red-200 rounded px-2 py-1">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                {simError}
              </div>
            )}
            <Input type="number" step="1" value={nSimulations} onChange={e => handleSimulationsChange(Number(e.target.value))} />
          </div>
        </div>
        <Button onClick={handleRun} disabled={loading}>
          {loading ? 'Simulating...' : 'Run Moonfire Simulation'}
        </Button>
      </Card>
      {results && (
        <Card className="p-6">
          <div className="mb-4 flex gap-2 flex-wrap">
            <button className={`px-3 py-1 rounded ${tab === 'hist' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`} onClick={() => setTab('hist')}>Histogram</button>
            <button className={`px-3 py-1 rounded ${tab === 'loghist' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`} onClick={() => setTab('loghist')}>Log-Scale Histogram</button>
            <button className={`px-3 py-1 rounded ${tab === 'cdf' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`} onClick={() => setTab('cdf')}>CDF</button>
            <button className={`px-3 py-1 rounded ${tab === 'risk' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`} onClick={() => setTab('risk')}>Risk Metrics</button>
            <button className={`px-3 py-1 rounded ${tab === 'quant' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`} onClick={() => setTab('quant')}>Quantiles</button>
            <button className={`px-3 py-1 rounded ${tab === 'heat' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`} onClick={() => setTab('heat')}>Investment Heatmap</button>
            <button className={`px-3 py-1 rounded ${tab === 'size' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`} onClick={() => { setTab('size'); if (!sizeAnalysis && !sizeLoading) handleSizeAnalysis(); }}>Portfolio Size Analysis</button>
            <button className={`px-3 py-1 rounded ${tab === 'violin' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`} onClick={() => { setTab('violin'); if (!sizeAnalysis && !sizeLoading) handleSizeAnalysis(); }}>Return Distribution by Size</button>
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
          {tab === 'risk' && (
            <>
              <h3 className="text-lg font-semibold mb-2">Risk Metrics</h3>
              <div className="mb-4" style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={riskData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="metric" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#f87171">
                      {/* Add value labels */}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
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
              <div className="mb-4">
                <CanvasHeatmap data={results.allInvestmentReturns.slice(0, 50)} />
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
          {/* Summary stats table (always visible) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div>
              <div className="text-sm text-gray-500">Mean</div>
              <div className="text-xl font-semibold">{results.mean.toFixed(3)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Std Deviation</div>
              <div className="text-xl font-semibold">{results.std.toFixed(3)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Median</div>
              <div className="text-xl font-semibold">{results.median.toFixed(3)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Probability of Loss (Return &lt; 1x)</div>
              <div className="text-xl font-semibold">{(results.probLoss * 100).toFixed(2)}%</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Probability of 2x+</div>
              <div className="text-xl font-semibold">{(results.prob2x * 100).toFixed(2)}%</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Probability of 5x+</div>
              <div className="text-xl font-semibold">{(results.prob5x * 100).toFixed(2)}%</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Probability of 10x+</div>
              <div className="text-xl font-semibold">{(results.prob10x * 100).toFixed(2)}%</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">1% Quantile</div>
              <div className="text-xl font-semibold">{results.quantile01.toFixed(3)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">5% Quantile</div>
              <div className="text-xl font-semibold">{results.quantile05.toFixed(3)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">10% Quantile</div>
              <div className="text-xl font-semibold">{results.quantile10.toFixed(3)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">25% Quantile</div>
              <div className="text-xl font-semibold">{results.quantile25.toFixed(3)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">75% Quantile</div>
              <div className="text-xl font-semibold">{results.quantile75.toFixed(3)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">90% Quantile</div>
              <div className="text-xl font-semibold">{results.quantile90.toFixed(3)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">95% Quantile</div>
              <div className="text-xl font-semibold">{results.quantile95.toFixed(3)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">99% Quantile</div>
              <div className="text-xl font-semibold">{results.quantile99.toFixed(3)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Min Return</div>
              <div className="text-xl font-semibold">{results.minReturn.toFixed(3)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Max Return</div>
              <div className="text-xl font-semibold">{results.maxReturn.toFixed(3)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Execution Time</div>
              <div className="text-xl font-semibold">{results.executionTime.toFixed(2)}s</div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

// Simple boxplot component for a single array of numbers
function BoxPlot({ data }: { data: number[] }) {
  if (!data || data.length === 0) return <div className="text-xs text-gray-400">No data</div>;
  const sorted = [...data].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const q1 = quantile(sorted, 0.25);
  const median = quantile(sorted, 0.5);
  const q3 = quantile(sorted, 0.75);
  // Render a horizontal boxplot
  return (
    <div style={{ display: 'flex', alignItems: 'center', height: 24 }}>
      <div style={{ position: 'relative', width: 300, height: 16, background: '#f3f4f6', borderRadius: 4 }}>
        {/* Whiskers */}
        <div style={{ position: 'absolute', left: `${((q1 - min) / (max - min + 1e-8)) * 100}%`, width: `${((q3 - q1) / (max - min + 1e-8)) * 100}%`, height: 16, background: '#a78bfa', borderRadius: 4 }} />
        {/* Median */}
        <div style={{ position: 'absolute', left: `${((median - min) / (max - min + 1e-8)) * 100}%`, width: 2, height: 16, background: '#2563eb' }} />
        {/* Min/Max ticks */}
        <div style={{ position: 'absolute', left: 0, width: 2, height: 16, background: '#6b7280' }} />
        <div style={{ position: 'absolute', right: 0, width: 2, height: 16, background: '#6b7280' }} />
      </div>
      <div className="ml-4 text-xs text-gray-500">
        Min: {min.toFixed(2)} | Q1: {q1.toFixed(2)} | Median: {median.toFixed(2)} | Q3: {q3.toFixed(2)} | Max: {max.toFixed(2)}
      </div>
    </div>
  );
}

// Replace ImprovedHeatmap with CanvasHeatmap
function CanvasHeatmap({ data }: { data: number[][] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  if (!data || !data.length) return null;
  const nSims = data.length;
  const nInv = data[0]?.length || 0;
  const flat = data.flat();
  const min = Math.min(...flat);
  const max = Math.max(...flat);
  const mean = flat.reduce((a, b) => a + b, 0) / flat.length;
  const std = Math.sqrt(flat.reduce((a, b) => a + (b - mean) ** 2, 0) / flat.length);
  const median = flat.length ? [...flat].sort((a, b) => a - b)[Math.floor(flat.length / 2)] : 0;

  // Viridis color scale (256 stops)
  const viridis = [
    [68, 1, 84],[71, 44, 122],[59, 81, 139],[44, 113, 142],[33, 144, 141],[39, 173, 129],[92, 200, 99],[170, 220, 50],[253, 231, 37]
  ];
  function getViridisColor(t: number) {
    // t in [0,1]
    if (t <= 0) return `rgb(${viridis[0].join(',')})`;
    if (t >= 1) return `rgb(${viridis[viridis.length-1].join(',')})`;
    const idx = t * (viridis.length - 1);
    const i = Math.floor(idx);
    const frac = idx - i;
    const c0 = viridis[i];
    const c1 = viridis[i + 1];
    const r = Math.round(c0[0] + frac * (c1[0] - c0[0]));
    const g = Math.round(c0[1] + frac * (c1[1] - c0[1]));
    const b = Math.round(c0[2] + frac * (c1[2] - c0[2]));
    return `rgb(${r},${g},${b})`;
  }

  // Draw heatmap on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Set canvas size
    const cellW = 12, cellH = 12;
    canvas.width = nInv * cellW;
    canvas.height = nSims * cellH;
    // Draw cells
    for (let i = 0; i < nSims; i++) {
      for (let j = 0; j < nInv; j++) {
        const val = data[i][j];
        const t = (val - min) / (max - min + 1e-8);
        ctx.fillStyle = getViridisColor(t);
        ctx.fillRect(j * cellW, i * cellH, cellW, cellH);
      }
    }
    // Draw grid
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    for (let i = 0; i <= nSims; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * cellH);
      ctx.lineTo(nInv * cellW, i * cellH);
      ctx.stroke();
    }
    for (let j = 0; j <= nInv; j++) {
      ctx.beginPath();
      ctx.moveTo(j * cellW, 0);
      ctx.lineTo(j * cellW, nSims * cellH);
      ctx.stroke();
    }
  }, [data, nSims, nInv, min, max]);

  // Colorbar as SVG
  const colorbarStops = 120;
  const colorbar = Array.from({ length: colorbarStops }, (_, i) => getViridisColor(i / (colorbarStops - 1)));

  return (
    <div className="w-full flex flex-col items-center">
      <div className="mb-2 text-xs text-gray-600 text-center font-medium">
        Each cell shows the return for a given simulation (row) and investment (column). Colors: purple/blue (low), green (mid), yellow (high).
      </div>
      <div className="flex flex-col items-center border rounded bg-white p-2 shadow-sm">
        <div className="flex items-center justify-between w-full mb-1">
          <span className="text-xs text-gray-500">Simulation Number (↓)</span>
          <span className="text-xs text-gray-500">Investment Index (→)</span>
        </div>
        <div style={{ overflow: 'auto', border: '1px solid #eee', borderRadius: 4, background: '#f9fafb', maxWidth: '100%' }}>
          <canvas ref={canvasRef} style={{ display: 'block', maxWidth: '100%', height: nSims * 12, width: nInv * 12 }} />
        </div>
        {/* Colorbar */}
        <div className="flex items-center gap-2 mt-2 w-full">
          <span className="text-xs text-gray-500">Low</span>
          <svg width={colorbarStops} height={12} style={{ borderRadius: 4, border: '1px solid #eee' }}>
            {colorbar.map((c, i) => (
              <rect key={i} x={i} y={0} width={1} height={12} fill={c} />
            ))}
          </svg>
          <span className="text-xs text-gray-500">High</span>
          <span className="text-xs text-gray-500 ml-4">Min: {min.toFixed(2)}</span>
          <span className="text-xs text-gray-500">Mean: {mean.toFixed(2)}</span>
          <span className="text-xs text-gray-500">Max: {max.toFixed(2)}</span>
        </div>
        {/* Stats box */}
        <div className="mt-2 p-2 bg-gray-50 border border-gray-200 rounded text-xs text-gray-700 font-mono w-full max-w-xs">
          <div><b>Statistics:</b></div>
          <div>Mean: {mean.toFixed(4)}x</div>
          <div>Median: {median.toFixed(4)}x</div>
          <div>Max: {max.toFixed(2)}x</div>
          <div>Min: {min.toFixed(4)}x</div>
          <div>Std: {std.toFixed(4)}</div>
        </div>
      </div>
    </div>
  );
} 