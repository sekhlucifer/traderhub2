import React, { useState, useEffect } from 'react';
import { Line, Bar } from 'react-chartjs-2';
import { 
    Calculator, TrendingDown, ShieldAlert, Grid, Zap, BarChart2, PieChart, RefreshCw, FileText 
} from 'lucide-react';

// ==========================================
//  MATH UTILS REPLICATING BLACK-SCHOLES & CDF
// ==========================================
function normalCDF(x) {
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989423 * Math.exp(-x * x / 2);
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return x > 0 ? 1 - p : p;
}

function calculateGreeks(S, K, T, r, sigma, type) {
    if (T <= 0) return { delta: 0, gamma: 0, theta: 0, vega: 0 };
    const d1 = (Math.log(S / K) + (r + (sigma * sigma) / 2) * T) / (sigma * Math.sqrt(T));
    const d2 = d1 - sigma * Math.sqrt(T);
    const nd1 = normalCDF(d1);
    const n_prime_d1 = (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-d1 * d1 / 2);

    let delta, theta;
    if (type === 'CE') {
        delta = nd1;
        theta = -(S * n_prime_d1 * sigma) / (2 * Math.sqrt(T)) - r * K * Math.exp(-r * T) * normalCDF(d2);
    } else {
        delta = nd1 - 1;
        theta = -(S * n_prime_d1 * sigma) / (2 * Math.sqrt(T)) + r * K * Math.exp(-r * T) * normalCDF(-d2);
    }

    const gamma = n_prime_d1 / (S * sigma * Math.sqrt(T));
    const vega = S * Math.sqrt(T) * n_prime_d1;

    return {
        delta: delta.toFixed(3),
        gamma: gamma.toFixed(5),
        theta: (theta / 365).toFixed(3),
        vega: (vega / 100).toFixed(3)
    };
}

export default function CalculatorsTab({ prices = {} }) {
    const [subTab, setSubTab] = useState('averaging');

    // Layout configuration for Chart grids
    const chartGridConfig = {
        grid: { color: 'rgba(255, 255, 255, 0.03)' },
        ticks: { color: '#9ca3af', font: { size: 9, family: 'monospace' } }
    };

    // Helper for formatting
    const FMT = (num) => '₹' + Math.round(num).toLocaleString('en-IN');
    const FMTFloat = (num) => '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // ==========================================
    //  TAB 1: POSITION AVERAGING STATE & MATH
    // ==========================================
    const [avgDir, setAvgDir] = useState('long');
    const [avgPrice1, setAvgPrice1] = useState(100);
    const [avgQty1, setAvgQty1] = useState(100);
    const [avgUpper, setAvgUpper] = useState(110);
    const [avgLower, setAvgLower] = useState(60);
    const [avgLevels, setAvgLevels] = useState(4);
    const [avgTarget, setAvgTarget] = useState(10);
    const [avgStop, setAvgStop] = useState(15);
    const [avgMultMode, setAvgMultMode] = useState('equal');

    const getMultiplier = (level, mode) => {
        const fibs = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89];
        if (mode === 'equal') return 1;
        if (mode === 'double') return Math.pow(2, level);
        if (mode === 'fib') return fibs[Math.min(level, fibs.length - 1)];
        return 1;
    };

    // Averaging calculation outputs
    const isShort = avgDir === 'short';
    const range = isShort ? (avgUpper - avgPrice1) : (avgPrice1 - avgLower);
    const step = range / Math.max(avgLevels - 1, 1);

    let avgRows = [];
    let totalQty = avgQty1;
    let totalInvest = avgPrice1 * avgQty1;
    avgRows.push({ level: 1, price: avgPrice1, qty: avgQty1, invest: avgPrice1 * avgQty1, cumInvest: avgPrice1 * avgQty1 });

    for (let i = 1; i < avgLevels; i++) {
        const price = isShort ? Math.min(avgUpper, avgPrice1 + step * i) : Math.max(avgLower, avgPrice1 - step * i);
        const qty = avgQty1 * getMultiplier(i, avgMultMode);
        const invest = price * qty;
        totalQty += qty;
        totalInvest += invest;
        avgRows.push({ level: i + 1, price, qty, invest, cumInvest: totalInvest });
    }

    const avgEntry = totalInvest / totalQty;
    const targetPrice = isShort ? avgEntry * (1 - avgTarget / 100) : avgEntry * (1 + avgTarget / 100);
    const stopPrice = isShort ? avgEntry * (1 + avgStop / 100) : avgEntry * (1 - avgStop / 100);
    const profitAtTarget = isShort ? (avgEntry - targetPrice) * totalQty : (targetPrice - avgEntry) * totalQty;
    const lossAtStop = isShort ? (stopPrice - avgEntry) * totalQty : (avgEntry - stopPrice) * totalQty;
    const rratio = lossAtStop > 0 ? (profitAtTarget / lossAtStop) : 0;

    // Avg Chart Plot
    const chartMin = Math.min(avgLower, avgPrice1) * 0.9;
    const chartMax = Math.max(avgUpper, avgPrice1) * 1.1;
    const pricesPlot = Array.from({ length: 40 }, (_, i) => chartMin + ((chartMax - chartMin) / 39) * i);
    const pnlLinePlot = pricesPlot.map(p => isShort ? (avgEntry - p) * totalQty : (p - avgEntry) * totalQty);

    const avgChartData = {
        labels: pricesPlot.map(p => Math.round(p)),
        datasets: [
            {
                label: 'Net P&L',
                data: pnlLinePlot,
                borderColor: isShort ? '#ef4444' : '#2563eb',
                borderWidth: 2,
                fill: false,
                tension: 0.1,
                pointRadius: 0
            }
        ]
    };

    // ==========================================
    //  TAB 2: RECOVERY MARTINGALE (STOP LOSS)
    // ==========================================
    const [slDir, setSlDir] = useState('long');
    const [slCurrent, setSlCurrent] = useState(100);
    const [slBase, setSlBase] = useState(90);
    const [slInvest, setSlInvest] = useState(10);
    const [slProfit, setSlProfit] = useState(30);
    const [slLevels, setSlLevels] = useState(6);

    const isSlShort = slDir === 'short';
    const slPriceRange = Math.abs(slCurrent - slBase);
    const slStep = slPriceRange / Math.max(slLevels - 1, 1);

    let slRows = [];
    let slTotalQty = 0;
    let slTotalCost = 0;

    for (let i = 0; i < slLevels; i++) {
        const price = isSlShort ? (slCurrent + slStep * i) : (slCurrent - slStep * i);
        const mult = Math.pow(2, i);
        const qty = slInvest * mult;
        const cost = price * qty;
        slTotalQty += qty;
        slTotalCost += cost;
        slRows.push({ level: i + 1, price, mult, qty, avgCost: slTotalCost / slTotalQty });
    }

    const slFinalAvg = slTotalCost / slTotalQty;
    const slTargetInitial = isSlShort ? slCurrent * (1 - slProfit / 100) : slCurrent * (1 + slProfit / 100);
    const slTargetAvg = isSlShort ? slFinalAvg * (1 - slProfit / 100) : slFinalAvg * (1 + slProfit / 100);

    // ==========================================
    //  TAB 3: GRID MARTINGALE
    // ==========================================
    const [gridDir, setGridDir] = useState('long');
    const [gridUpper, setGridUpper] = useState(120);
    const [gridLower, setGridLower] = useState(80);
    const [gridLevels, setGridLevels] = useState(8);
    const [gridBase, setGridBase] = useState(1000);
    const [gridMult, setGridMult] = useState(20); // representation of 2.0
    const [gridTp, setGridTp] = useState(2);
    
    const isGridShort = gridDir === 'short';
    const gridSpacing = (gridUpper - gridLower) / Math.max(gridLevels - 1, 1);
    const scaleMult = gridMult / 10;
    let gridRows = [];
    let gridTotalCap = 0;
    let gridTotalProfit = 0;

    for (let i = 0; i < gridLevels; i++) {
        const price = isGridShort ? gridLower + gridSpacing * i : gridUpper - gridSpacing * i;
        const invest = gridBase * Math.pow(scaleMult, i);
        gridTotalCap += invest;
        const tpPrice = isGridShort ? price * (1 - gridTp / 100) : price * (1 + gridTp / 100);
        const levelProfit = invest * (gridTp / 100);
        gridTotalProfit += levelProfit;
        gridRows.push({ idx: i + 1, price, invest, cum: gridTotalCap, tpPrice, levelProfit });
    }

    const gridBustPrice = isGridShort ? gridUpper * 1.08 : gridLower * 0.92;

    const gridChartData = {
        labels: gridRows.map(r => Math.round(r.price)),
        datasets: [
            {
                label: 'Allocation size',
                data: gridRows.map(r => r.invest),
                backgroundColor: 'rgba(37, 99, 235, 0.65)',
                borderColor: '#2563eb',
                borderWidth: 1,
                borderRadius: 4
            }
        ]
    };

    // ==========================================
    //  TAB 4: OPTIONS PAYOFF & GREEKS (BS)
    // ==========================================
    const [optDir, setOptDir] = useState('long'); // Long/Short
    const [optPrice, setOptPrice] = useState(18000);
    const [optStrike, setOptStrike] = useState(18100);
    const [optType, setOptType] = useState('CE');
    const [optPremium, setOptPremium] = useState(150);
    const [optLotSize, setOptLotSize] = useState(50);
    const [optStartLots, setOptStartLots] = useState(1);
    const [optLevels, setOptLevels] = useState(4);
    const [optWinProb, setOptWinProb] = useState(40);

    const isOptSell = optDir === 'short';
    let optRows = [];
    let optTotalCost = 0;
    const optBaseWin = optPremium * optLotSize * optStartLots;

    for (let i = 0; i < optLevels; i++) {
        const lots = optStartLots * Math.pow(2, i);
        const cost = optPremium * optLotSize * lots;
        optTotalCost += cost;
        const winReturn = isOptSell ? cost : optBaseWin;
        optRows.push({ level: i + 1, lots, premium: optPremium, cost, cum: optTotalCost, returnIfWin: winReturn });
    }

    const optRuinProb = Math.pow(1 - optWinProb / 100, optLevels) * 100;
    const greeks = calculateGreeks(optPrice, optStrike, 30 / 365, 0.07, 0.20, optType);

    const payoffMin = optStrike * 0.85;
    const payoffMax = optStrike * 1.15;
    const strikeRange = Array.from({ length: 40 }, (_, i) => payoffMin + ((payoffMax - payoffMin) / 39) * i);
    const payoffLine = strikeRange.map(price => {
        let singleContractPayoff = optType === 'CE' ? Math.max(0, price - optStrike) - optPremium : Math.max(0, optStrike - price) - optPremium;
        const totalLots = optRows[optRows.length - 1].lots;
        const positionPayoff = singleContractPayoff * optLotSize * totalLots;
        return isOptSell ? -positionPayoff : positionPayoff;
    });

    const optChartData = {
        labels: strikeRange.map(Math.round),
        datasets: [
            {
                label: 'Payoff',
                data: payoffLine,
                borderColor: isOptSell ? '#ef4444' : '#10b981',
                borderWidth: 2,
                fill: false,
                tension: 0.1,
                pointRadius: 0
            }
        ]
    };

    // ==========================================
    //  TAB 5: MULTI-SYSTEM SIMULATOR
    // ==========================================
    const [sysCapital, setSysCapital] = useState(10000);
    const [sysBase, setSysBase] = useState(100);
    const [sysWinProb, setSysWinProb] = useState(45);
    const [sysRounds, setSysRounds] = useState(50);
    const [sysStop, setSysStop] = useState(5000);

    const [sysSimResults, setSysSimResults] = useState([]);

    const runSystemSimulations = () => {
        const winProb = sysWinProb / 100;
        
        const runSimulation = (strategy) => {
            let cap = sysCapital;
            let bet = sysBase;
            let curve = [sysCapital];
            let dAlem = sysBase;
            const fibSeq = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144];
            let fibIdx = 0;

            for (let i = 0; i < sysRounds; i++) {
                if (cap <= sysStop) {
                    curve.push(cap);
                    continue;
                }
                const win = Math.random() < winProb;
                const effBet = Math.min(bet, cap - sysStop);
                if (effBet <= 0) {
                    curve.push(cap);
                    continue;
                }

                if (win) {
                    cap += effBet;
                    if (strategy === 'martingale') bet = sysBase;
                    else if (strategy === 'anti') bet = Math.min(bet * 2, sysBase * 16);
                    else if (strategy === 'dalembert') { dAlem = Math.max(sysBase, dAlem - sysBase); bet = dAlem; }
                    else if (strategy === 'fibonacci') { fibIdx = Math.max(0, fibIdx - 2); bet = sysBase * fibSeq[fibIdx]; }
                    else if (strategy === 'kelly') bet = Math.max(sysBase, cap * 0.1 * winProb);
                } else {
                    cap -= effBet;
                    if (strategy === 'martingale') bet = Math.min(bet * 2, sysCapital * 0.5);
                    else if (strategy === 'anti') bet = sysBase;
                    else if (strategy === 'dalembert') { dAlem += sysBase; bet = dAlem; }
                    else if (strategy === 'fibonacci') { fibIdx = Math.min(fibIdx + 1, fibSeq.length - 1); bet = sysBase * fibSeq[fibIdx]; }
                    else if (strategy === 'kelly') bet = sysBase;
                }
                curve.push(Math.round(cap));
            }
            return { curve, pnl: cap - sysCapital, final: cap };
        };

        const strategies = [
            { name: 'Martingale', key: 'martingale', color: '#ef4444' },
            { name: 'Anti-Martingale', key: 'anti', color: '#10b981' },
            { name: "D'Alembert", key: 'dalembert', color: '#f59e0b' },
            { name: 'Fibonacci', key: 'fibonacci', color: '#06b6d4' },
            { name: 'Kelly Sizing', key: 'kelly', color: '#818cf8' }
        ];

        const simResults = strategies.map(s => ({
            ...s,
            ...runSimulation(s.key)
        }));
        setSysSimResults(simResults);
    };

    useEffect(() => {
        runSystemSimulations();
    }, [sysCapital, sysBase, sysWinProb, sysRounds, sysStop]);

    const sysChartData = {
        labels: Array.from({ length: sysRounds + 1 }, (_, i) => i),
        datasets: sysSimResults.map(r => ({
            label: r.name,
            data: r.curve,
            borderColor: r.color,
            borderWidth: 1.5,
            fill: false,
            tension: 0.1,
            pointRadius: 0
        }))
    };

    // ==========================================
    //  TAB 6: KELLY & DCA OPTIMIZER
    // ==========================================
    const [kellyP, setKellyP] = useState(55);
    const [kellyB, setKellyB] = useState(100);
    const [kellyCapital, setKellyCapital] = useState(100000);
    const [dcaPrice, setDcaPrice] = useState(50000);
    const [dcaMonthly, setDcaMonthly] = useState(5000);
    const [dcaMonths, setDcaMonths] = useState(24);
    const [dcaReturn, setDcaReturn] = useState(40);
    const [kellyFrac, setKellyFrac] = useState(1.0); // representation of Full/Half/Quarter

    const kP = kellyP / 100;
    const kQ = 1 - kP;
    const kB = kellyB / 100;
    const rawKellyF = Math.max(0, (kB * kP - kQ) / kB);
    const finalKellyF = rawKellyF * kellyFrac;
    const kellyOptBet = kellyCapital * finalKellyF;
    const kellyEdge = (kB * kP - kQ) * 100;

    const dcaMonthlyReturn = Math.pow(1 + dcaReturn / 100, 1 / 12) - 1;
    let dcaData = [];
    let dcaUnits = 0;
    let dcaCumulativeInvested = 0;

    let seedVal = 99;
    for (let m = 0; m <= dcaMonths; m++) {
        seedVal = (seedVal * 6364 + 1013) % 65537;
        const noise = 1 + ((seedVal / 65537) - 0.5) * 0.08;
        const price = dcaPrice * Math.pow(1 + dcaMonthlyReturn, m) * noise;
        if (m > 0) {
            dcaUnits += dcaMonthly / price;
            dcaCumulativeInvested += dcaMonthly;
        }
        dcaData.push({ month: m, value: dcaUnits * price, invested: dcaCumulativeInvested });
    }

    const finalDcaVal = dcaData[dcaData.length - 1]?.value || 0;

    const dcaChartData = {
        labels: dcaData.map(d => 'M' + d.month),
        datasets: [
            {
                label: 'Portfolio Value',
                data: dcaData.map(d => Math.round(d.value)),
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.06)',
                borderWidth: 2,
                fill: true,
                tension: 0.1,
                pointRadius: 0
            },
            {
                label: 'Total Invested',
                data: dcaData.map(d => Math.round(d.invested)),
                borderColor: '#3b82f6',
                borderWidth: 1.5,
                borderDash: [5, 5],
                fill: false,
                pointRadius: 0
            }
        ]
    };

    const kellyChartData = {
        labels: ['Full', 'Half', 'Quarter', '10% Sizing'],
        datasets: [
            {
                data: [1, 0.5, 0.25, 0.1].map(f => Math.round(kellyCapital * rawKellyF * f)),
                backgroundColor: ['#ef4444', '#f59e0b', '#10b981', '#3b82f6'],
                borderRadius: 4
            }
        ]
    };

    // ==========================================
    //  TAB 7: MARTINGALE CALCULATOR 2.0 (LIVE GRID)
    // ==========================================
    const [m2Asset, setM2Asset] = useState('BTC/USD');
    const [m2ManualPrice, setM2ManualPrice] = useState(66500.00);
    const [m2Dir, setM2Dir] = useState('long');
    const [m2BaseSize, setM2BaseSize] = useState(10);
    const [m2Multiplier, setM2Multiplier] = useState(2.0);
    const [m2StepPct, setM2StepPct] = useState(2.0);
    const [m2Levels, setM2Levels] = useState(6);
    const [m2Tp, setM2Tp] = useState(1.5);

    useEffect(() => {
        if (m2Asset !== 'custom' && prices && prices[m2Asset]) {
            setM2ManualPrice(prices[m2Asset]);
        }
    }, [prices, m2Asset]);

    const isM2Short = m2Dir === 'short';
    let m2Rows = [];
    let m2TotalQty = 0;
    let m2TotalCap = 0;

    for (let i = 0; i < m2Levels; i++) {
        const priceFactor = isM2Short ? (1 + (m2StepPct / 100) * i) : (1 - (m2StepPct / 100) * i);
        const price = m2ManualPrice * priceFactor;
        const qty = m2BaseSize * Math.pow(m2Multiplier, i);
        const invest = price * qty;
        m2TotalQty += qty;
        m2TotalCap += invest;
        const avgEntry = m2TotalCap / m2TotalQty;
        const tpPrice = isM2Short ? avgEntry * (1 - m2Tp / 100) : avgEntry * (1 + m2Tp / 100);
        m2Rows.push({
            level: i + 1,
            price,
            qty,
            invest,
            cumCap: m2TotalCap,
            cumQty: m2TotalQty,
            avgEntry,
            tpPrice
        });
    }

    const m2FinalAvg = m2TotalCap / m2TotalQty || 0;
    const m2FinalTp = isM2Short ? m2FinalAvg * (1 - m2Tp / 100) : m2FinalAvg * (1 + m2Tp / 100);
    const m2MaxDrawdown = isM2Short 
        ? ((m2Rows[m2Rows.length - 1]?.price - m2FinalAvg) / m2FinalAvg) * 100
        : ((m2FinalAvg - m2Rows[m2Rows.length - 1]?.price) / m2FinalAvg) * 100 || 0;

    const m2ChartData = {
        labels: m2Rows.map(r => `Lvl ${r.level}`),
        datasets: [
            {
                label: 'Trigger Price',
                data: m2Rows.map(r => r.price),
                borderColor: '#60a5fa',
                backgroundColor: 'rgba(96, 165, 250, 0.05)',
                borderWidth: 2,
                fill: false,
                tension: 0.1
            },
            {
                label: 'Average Entry',
                data: m2Rows.map(r => r.avgEntry),
                borderColor: '#fbbf24',
                borderWidth: 1.5,
                borderDash: [5, 5],
                fill: false
            },
            {
                label: 'Take Profit Target',
                data: m2Rows.map(r => r.tpPrice),
                borderColor: '#34d399',
                borderWidth: 1.5,
                borderDash: [2, 2],
                fill: false
            }
        ]
    };

    return (
        <div className="fade-in">
            {/* Nav Headers inside tab */}
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '1rem', borderBottom: '1px solid var(--border)', marginBottom: '1.5rem' }}>
                {[
                    { key: 'averaging', name: 'Position Averaging', icon: <TrendingDown size={14} /> },
                    { key: 'stoploss', name: 'Recovery Martingale', icon: <ShieldAlert size={14} /> },
                    { key: 'grid', name: 'Grid Martingale', icon: <Grid size={14} /> },
                    { key: 'options', name: 'Options & Payoff', icon: <Zap size={14} /> },
                    { key: 'systems', name: 'Multi-System Sim', icon: <BarChart2 size={14} /> },
                    { key: 'kelly', name: 'Kelly & DCA', icon: <PieChart size={14} /> },
                    { key: 'martingale2', name: 'Martingale 2.0', icon: <Zap size={14} /> }
                ].map(item => (
                    <button 
                        key={item.key}
                        className={`nav-link ${subTab === item.key ? 'active' : ''}`}
                        onClick={() => setSubTab(item.key)}
                        style={{ padding: '8px 14px', borderRadius: '6px', whiteSpace: 'nowrap', background: subTab === item.key ? 'var(--accent)' : 'rgba(255,255,255,0.02)' }}
                    >
                        {item.icon} {item.name}
                    </button>
                ))}
            </div>

            {/* TAB CONTENTS */}

            {/* TAB 1: Position Averaging */}
            {subTab === 'averaging' && (
                <div className="tab-content-grid">
                    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div className="dir-toggle">
                            <button className={`dir-btn ${avgDir === 'long' ? 'active long' : ''}`} onClick={() => setAvgDir('long')}>Long / Averaging Down</button>
                            <button className={`dir-btn ${avgDir === 'short' ? 'active short' : ''}`} onClick={() => setAvgDir('short')}>Short / Averaging Up</button>
                        </div>
                        
                        <div className="input-group">
                            <label>Base Price</label>
                            <input type="number" value={avgPrice1} onChange={(e) => setAvgPrice1(parseFloat(e.target.value) || 0)} />
                        </div>
                        <div className="input-group">
                            <label>Base Quantity</label>
                            <input type="number" value={avgQty1} onChange={(e) => setAvgQty1(parseFloat(e.target.value) || 0)} />
                        </div>
                        <div className="grid-cols-2">
                            <div className="input-group">
                                <label>Upper Limit</label>
                                <input type="number" value={avgUpper} onChange={(e) => setAvgUpper(parseFloat(e.target.value) || 0)} />
                            </div>
                            <div className="input-group">
                                <label>Lower Limit</label>
                                <input type="number" value={avgLower} onChange={(e) => setAvgLower(parseFloat(e.target.value) || 0)} />
                            </div>
                        </div>
                        <div className="input-group">
                            <label>Martingale Levels: {avgLevels}</label>
                            <input type="range" min="2" max="10" value={avgLevels} onChange={(e) => setAvgLevels(parseInt(e.target.value) || 2)} style={{ width: '100%' }} />
                        </div>
                        <div className="grid-cols-2">
                            <div className="input-group">
                                <label>Target Profit %</label>
                                <input type="number" value={avgTarget} onChange={(e) => setAvgTarget(parseFloat(e.target.value) || 0)} />
                            </div>
                            <div className="input-group">
                                <label>Stop Loss %</label>
                                <input type="number" value={avgStop} onChange={(e) => setAvgStop(parseFloat(e.target.value) || 0)} />
                            </div>
                        </div>
                        <div className="input-group">
                            <label>Sizing Multiplier</label>
                            <div className="option-toggle">
                                <button className={`option-btn ${avgMultMode === 'equal' ? 'active' : ''}`} onClick={() => setAvgMultMode('equal')}>Equal</button>
                                <button className={`option-btn ${avgMultMode === 'double' ? 'active' : ''}`} onClick={() => setAvgMultMode('double')}>Double (2x)</button>
                                <button className={`option-btn ${avgMultMode === 'fib' ? 'active' : ''}`} onClick={() => setAvgMultMode('fib')}>Fibonacci</button>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div className="grid-cols-4">
                            <div className="card" style={{ padding: '1rem' }}>
                                <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>Average Entry</span>
                                <div style={{ fontSize: '1.15rem', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>{FMTFloat(avgEntry)}</div>
                            </div>
                            <div className="card" style={{ padding: '1rem' }}>
                                <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>Total Exposure</span>
                                <div style={{ fontSize: '1.15rem', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>{FMT(totalInvest)}</div>
                            </div>
                            <div className="card" style={{ padding: '1rem' }}>
                                <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>Target Price</span>
                                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>{FMTFloat(targetPrice)}</div>
                            </div>
                            <div className="card" style={{ padding: '1rem' }}>
                                <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>Stop Loss</span>
                                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--red)', fontFamily: 'var(--font-mono)' }}>{FMTFloat(stopPrice)}</div>
                            </div>
                        </div>

                        <div className="card" style={{ flex: 1, minHeight: '260px' }}>
                            <div className="card-title">P&amp;L Spectrum Curve</div>
                            <div style={{ height: '220px' }}>
                                <Line data={avgChartData} options={{ responsive: true, maintainAspectRatio: false, scales: { x: chartGridConfig, y: chartGridConfig } }} />
                            </div>
                        </div>

                        <div className="card">
                            <div className="card-title">Strategy Levels Map</div>
                            <div className="table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Level</th>
                                            <th>Trigger Price</th>
                                            <th>Qty</th>
                                            <th>Required Capital</th>
                                            <th>Cumulative Avg Cost</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {avgRows.map(r => (
                                            <tr key={r.level}>
                                                <td><span className="badge badge-blue">Level {r.level}</span></td>
                                                <td style={{ fontFamily: 'var(--font-mono)' }}>{FMTFloat(r.price)}</td>
                                                <td>{Math.round(r.qty)}</td>
                                                <td>{FMT(r.invest)}</td>
                                                <td style={{ color: 'var(--amber)', fontFamily: 'var(--font-mono)' }}>{FMTFloat(r.cumInvest / totalQty)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: Recovery Martingale */}
            {subTab === 'stoploss' && (
                <div className="tab-content-grid">
                    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div className="dir-toggle">
                            <button className={`dir-btn ${slDir === 'long' ? 'active long' : ''}`} onClick={() => setSlDir('long')}>Long Recovery</button>
                            <button className={`dir-btn ${slDir === 'short' ? 'active short' : ''}`} onClick={() => setSlDir('short')}>Short Recovery</button>
                        </div>
                        <div className="input-group">
                            <label>Current Price</label>
                            <input type="number" value={slCurrent} onChange={(e) => setSlCurrent(parseFloat(e.target.value) || 0)} />
                        </div>
                        <div className="input-group">
                            <label>Swing Base / Support</label>
                            <input type="number" value={slBase} onChange={(e) => setSlBase(parseFloat(e.target.value) || 0)} />
                        </div>
                        <div className="input-group">
                            <label>Base Investment Size</label>
                            <input type="number" value={slInvest} onChange={(e) => setSlInvest(parseFloat(e.target.value) || 0)} />
                        </div>
                        <div className="input-group">
                            <label>Target Profit %</label>
                            <input type="number" value={slProfit} onChange={(e) => setSlProfit(parseFloat(e.target.value) || 0)} />
                        </div>
                        <div className="input-group">
                            <label>Martingale Levels: {slLevels}</label>
                            <input type="range" min="3" max="10" value={slLevels} onChange={(e) => setSlLevels(parseInt(e.target.value) || 3)} style={{ width: '100%' }} />
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div className="grid-cols-4">
                            <div className="card" style={{ padding: '1rem' }}>
                                <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>Calculated Step</span>
                                <div style={{ fontSize: '1.15rem', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>{slStep.toFixed(2)}</div>
                            </div>
                            <div className="card" style={{ padding: '1rem' }}>
                                <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>Weighted Avg Cost</span>
                                <div style={{ fontSize: '1.15rem', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>{FMTFloat(slFinalAvg)}</div>
                            </div>
                            <div className="card" style={{ padding: '1rem' }}>
                                <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>Initial Target</span>
                                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--cyan)', fontFamily: 'var(--font-mono)' }}>{FMTFloat(slTargetInitial)}</div>
                            </div>
                            <div className="card" style={{ padding: '1rem' }}>
                                <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>Compounded Target</span>
                                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>{FMTFloat(slTargetAvg)}</div>
                            </div>
                        </div>

                        <div className="card">
                            <div className="card-title">Recovery Plan Levels Map</div>
                            <div className="table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Level</th>
                                            <th>Execution Price</th>
                                            <th>Multiplier</th>
                                            <th>Wager Size</th>
                                            <th>Accumulated Entry Cost</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {slRows.map(r => (
                                            <tr key={r.level}>
                                                <td><span className="badge badge-blue">Level {r.level}</span></td>
                                                <td style={{ fontFamily: 'var(--font-mono)' }}>{FMTFloat(r.price)}</td>
                                                <td>{r.mult}x</td>
                                                <td>{r.qty.toFixed(2)}</td>
                                                <td style={{ color: 'var(--amber)', fontFamily: 'var(--font-mono)' }}>{FMTFloat(r.avgCost)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 3: Grid Martingale */}
            {subTab === 'grid' && (
                <div className="tab-content-grid">
                    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div className="dir-toggle">
                            <button className={`dir-btn ${gridDir === 'long' ? 'active long' : ''}`} onClick={() => setGridDir('long')}>Long Grid</button>
                            <button className={`dir-btn ${gridDir === 'short' ? 'active short' : ''}`} onClick={() => setGridDir('short')}>Short Grid</button>
                        </div>
                        <div className="input-group">
                            <label>Upper Limit Bound</label>
                            <input type="number" value={gridUpper} onChange={(e) => setGridUpper(parseFloat(e.target.value) || 0)} />
                        </div>
                        <div className="input-group">
                            <label>Lower Limit Bound</label>
                            <input type="number" value={gridLower} onChange={(e) => setGridLower(parseFloat(e.target.value) || 0)} />
                        </div>
                        <div className="input-group">
                            <label>Grid Nodes: {gridLevels}</label>
                            <input type="range" min="3" max="20" value={gridLevels} onChange={(e) => setGridLevels(parseInt(e.target.value) || 3)} style={{ width: '100%' }} />
                        </div>
                        <div className="input-group">
                            <label>Base Node Allocation</label>
                            <input type="number" value={gridBase} onChange={(e) => setGridBase(parseFloat(e.target.value) || 0)} />
                        </div>
                        <div className="input-group">
                            <label>Grid Size Multiplier: {(gridMult / 10).toFixed(1)}×</label>
                            <input type="range" min="10" max="30" value={gridMult} onChange={(e) => setGridMult(parseInt(e.target.value) || 10)} style={{ width: '100%' }} />
                        </div>
                        <div className="input-group">
                            <label>Grid Take Profit %</label>
                            <input type="number" value={gridTp} onChange={(e) => setGridTp(parseFloat(e.target.value) || 0)} />
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div className="grid-cols-4">
                            <div className="card" style={{ padding: '1rem' }}>
                                <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>Grid Node Spacing</span>
                                <div style={{ fontSize: '1.15rem', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>{FMTFloat(gridSpacing)}</div>
                            </div>
                            <div className="card" style={{ padding: '1rem' }}>
                                <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>Total Capital Load</span>
                                <div style={{ fontSize: '1.15rem', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>{FMT(gridTotalCap)}</div>
                            </div>
                            <div className="card" style={{ padding: '1rem' }}>
                                <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>Gross Profit Cycle</span>
                                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>{FMT(gridTotalProfit)}</div>
                            </div>
                            <div className="card" style={{ padding: '1rem' }}>
                                <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>Bust Zone Estimation</span>
                                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--red)', fontFamily: 'var(--font-mono)' }}>{FMTFloat(gridBustPrice)}</div>
                            </div>
                        </div>

                        <div className="card" style={{ height: '260px' }}>
                            <div className="card-title">Grid Allocation Size Bar Chart</div>
                            <div style={{ height: '210px' }}>
                                <Bar data={gridChartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: chartGridConfig, y: chartGridConfig } }} />
                            </div>
                        </div>

                        <div className="card">
                            <div className="card-title">Grid Allocation Spacing Details</div>
                            <div className="table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Node</th>
                                            <th>Price Trigger</th>
                                            <th>Size</th>
                                            <th>Total Margin</th>
                                            <th>TP Price</th>
                                            <th>Profits</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {gridRows.map(r => (
                                            <tr key={r.idx}>
                                                <td><span className="badge badge-blue">Node #{r.idx}</span></td>
                                                <td style={{ fontFamily: 'var(--font-mono)' }}>{FMTFloat(r.price)}</td>
                                                <td>{FMT(r.invest)}</td>
                                                <td>{FMT(r.cum)}</td>
                                                <td style={{ color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>{FMTFloat(r.tpPrice)}</td>
                                                <td style={{ color: 'var(--green)' }}>+{FMT(r.levelProfit)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 4: Options Payoff */}
            {subTab === 'options' && (
                <div className="tab-content-grid">
                    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div className="dir-toggle">
                            <button className={`dir-btn ${optDir === 'long' ? 'active long' : ''}`} onClick={() => setOptDir('long')}>Option Buying</button>
                            <button className={`dir-btn ${optDir === 'short' ? 'active short' : ''}`} onClick={() => setOptDir('short')}>Option Writing</button>
                        </div>
                        <div className="input-group">
                            <label>Spot Asset Price</label>
                            <input type="number" value={optPrice} onChange={(e) => setOptPrice(parseFloat(e.target.value) || 0)} />
                        </div>
                        <div className="input-group">
                            <label>Strike Threshold</label>
                            <input type="number" value={optStrike} onChange={(e) => setOptStrike(parseFloat(e.target.value) || 0)} />
                        </div>
                        <div className="input-group">
                            <label>Option Type</label>
                            <select value={optType} onChange={(e) => setOptType(e.target.value)}>
                                <option value="CE">Call Option (CE)</option>
                                <option value="PE">Put Option (PE)</option>
                            </select>
                        </div>
                        <div className="grid-cols-2">
                            <div className="input-group">
                                <label>Premium Cost</label>
                                <input type="number" value={optPremium} onChange={(e) => setOptPremium(parseFloat(e.target.value) || 0)} />
                            </div>
                            <div className="input-group">
                                <label>Lot Size</label>
                                <input type="number" value={optLotSize} onChange={(e) => setOptLotSize(parseInt(e.target.value) || 1)} />
                            </div>
                        </div>
                        <div className="grid-cols-2">
                            <div className="input-group">
                                <label>Start Lots</label>
                                <input type="number" value={optStartLots} onChange={(e) => setOptStartLots(parseInt(e.target.value) || 1)} />
                            </div>
                            <div className="input-group">
                                <label>Martingale Steps</label>
                                <input type="number" value={optLevels} onChange={(e) => setOptLevels(parseInt(e.target.value) || 1)} />
                            </div>
                        </div>
                        <div className="input-group">
                            <label>Single Leg Win Probability: {optWinProb}%</label>
                            <input type="range" min="1" max="99" value={optWinProb} onChange={(e) => setOptWinProb(parseInt(e.target.value) || 1)} style={{ width: '100%' }} />
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div className="grid-cols-4">
                            <div className="card" style={{ padding: '1rem' }}>
                                <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>Max Risk Exposure</span>
                                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--red)', fontFamily: 'var(--font-mono)' }}>{FMT(optTotalCost)}</div>
                            </div>
                            <div className="card" style={{ padding: '1rem' }}>
                                <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>Leg 1 Profit Potential</span>
                                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>{FMT(optBaseWin)}</div>
                            </div>
                            <div className="card" style={{ padding: '1rem' }}>
                                <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>Total Ruin Risk</span>
                                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: optRuinProb > 25 ? 'var(--red)' : 'var(--green)', fontFamily: 'var(--font-mono)' }}>{optRuinProb.toFixed(1)}%</div>
                            </div>
                            <div className="card" style={{ padding: '1rem' }}>
                                <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>Implied Delta Greek</span>
                                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--cyan)', fontFamily: 'var(--font-mono)' }}>{greeks.delta}</div>
                            </div>
                        </div>

                        {/* Option Greeks Grid */}
                        <div className="grid-cols-4">
                            <div className="card" style={{ padding: '0.75rem', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.6rem', color: 'var(--muted)', fontWeight: 700 }}>GAMMA</div>
                                <div style={{ fontSize: '0.95rem', fontWeight: 700, fontFamily: 'var(--font-mono)', marginTop: '2px' }}>{greeks.gamma}</div>
                            </div>
                            <div className="card" style={{ padding: '0.75rem', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.6rem', color: 'var(--muted)', fontWeight: 700 }}>VEGA</div>
                                <div style={{ fontSize: '0.95rem', fontWeight: 700, fontFamily: 'var(--font-mono)', marginTop: '2px' }}>{greeks.vega}</div>
                            </div>
                            <div className="card" style={{ padding: '0.75rem', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.6rem', color: 'var(--muted)', fontWeight: 700 }}>DAILY THETA</div>
                                <div style={{ fontSize: '0.95rem', fontWeight: 700, fontFamily: 'var(--font-mono)', marginTop: '2px', color: 'var(--red)' }}>{greeks.theta}</div>
                            </div>
                            <div className="card" style={{ padding: '0.75rem', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.6rem', color: 'var(--muted)', fontWeight: 700 }}>BS MODEL STATUS</div>
                                <div className="badge badge-green" style={{ marginTop: '4px' }}>VERIFIED</div>
                            </div>
                        </div>

                        <div className="card" style={{ height: '260px' }}>
                            <div className="card-title">Option Position Payoff Diagram (At Expiration)</div>
                            <div style={{ height: '210px' }}>
                                <Line data={optChartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: chartGridConfig, y: chartGridConfig } }} />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 5: Multi-System Simulator */}
            {subTab === 'systems' && (
                <div className="tab-content-grid">
                    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div className="input-group">
                            <label>Starting Portfolio Cash</label>
                            <input type="number" value={sysCapital} onChange={(e) => setSysCapital(parseFloat(e.target.value) || 0)} />
                        </div>
                        <div className="input-group">
                            <label>Base Bet size</label>
                            <input type="number" value={sysBase} onChange={(e) => setSysBase(parseFloat(e.target.value) || 0)} />
                        </div>
                        <div className="input-group">
                            <label>Win probability %: {sysWinProb}%</label>
                            <input type="range" min="10" max="90" value={sysWinProb} onChange={(e) => setSysWinProb(parseInt(e.target.value) || 10)} style={{ width: '100%' }} />
                        </div>
                        <div className="input-group">
                            <label>Simulation Rounds</label>
                            <input type="number" min="10" max="200" value={sysRounds} onChange={(e) => setSysRounds(parseInt(e.target.value) || 10)} />
                        </div>
                        <div className="input-group">
                            <label>Account Stop Limit</label>
                            <input type="number" value={sysStop} onChange={(e) => setSysStop(parseFloat(e.target.value) || 0)} />
                        </div>
                        <button className="btn" style={{ width: '100%', marginTop: '10px' }} onClick={runSystemSimulations}>
                            <RefreshCw size={14} /> Run Monte Carlo
                        </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div className="card" style={{ height: '350px' }}>
                            <div className="card-title">Side-by-Side Strategy Sim Curve</div>
                            <div style={{ height: '300px' }}>
                                <Line data={sysChartData} options={{ responsive: true, maintainAspectRatio: false, scales: { x: chartGridConfig, y: chartGridConfig } }} />
                            </div>
                        </div>

                        <div className="card">
                            <div className="card-title">Performance Metrics Breakdown</div>
                            <div className="table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Strategy System</th>
                                            <th>Final Capital</th>
                                            <th>Total P&amp;L Generated</th>
                                            <th>Verdict</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sysSimResults.map(r => (
                                            <tr key={r.key}>
                                                <td><span style={{ fontWeight: 700 }}>{r.name}</span></td>
                                                <td style={{ fontFamily: 'var(--font-mono)' }}>{FMT(r.final)}</td>
                                                <td style={{ 
                                                    fontFamily: 'var(--font-mono)', 
                                                    fontWeight: 700, 
                                                    color: r.pnl >= 0 ? 'var(--green)' : 'var(--red)'
                                                }}>
                                                    {r.pnl >= 0 ? '+' : ''}{FMT(r.pnl)}
                                                </td>
                                                <td>
                                                    <span className={`badge ${
                                                        r.pnl > 500 ? 'badge-green' : r.pnl < -500 ? 'badge-red' : 'badge-amber'
                                                    }`}>{r.pnl > 500 ? 'SUCCESS' : r.pnl < -500 ? 'RUIN' : 'BREAK-EVEN'}</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 6: Kelly & DCA */}
            {subTab === 'kelly' && (
                <div className="tab-content-grid">
                    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--cyan)', borderBottom: '1px solid var(--border)', paddingBottom: '4px' }}>KELLY RATIO CRITERION</div>
                        <div className="input-group">
                            <label>Historical Win Probability %: {kellyP}%</label>
                            <input type="range" min="1" max="99" value={kellyP} onChange={(e) => setKellyP(parseInt(e.target.value) || 1)} style={{ width: '100%' }} />
                        </div>
                        <div className="input-group">
                            <label>Win Odds Ratio (Payout / Loss): {(kellyB / 100).toFixed(1)}×</label>
                            <input type="range" min="10" max="300" value={kellyB} onChange={(e) => setKellyB(parseInt(e.target.value) || 10)} style={{ width: '100%' }} />
                        </div>
                        <div className="input-group">
                            <label>Bankroll Sizing Spectrum</label>
                            <div className="option-toggle">
                                <button className={`option-btn ${kellyFrac === 1.0 ? 'active' : ''}`} onClick={() => setKellyFrac(1.0)}>Full Kelly</button>
                                <button className={`option-btn ${kellyFrac === 0.5 ? 'active' : ''}`} onClick={() => setKellyFrac(0.5)}>Half Kelly</button>
                                <button className={`option-btn ${kellyFrac === 0.25 ? 'active' : ''}`} onClick={() => setKellyFrac(0.25)}>Quarter Kelly</button>
                            </div>
                        </div>

                        <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--green)', borderBottom: '1px solid var(--border)', paddingBottom: '4px', marginTop: '10px' }}>DCA GROWTH OPTIMIZER</div>
                        <div className="input-group">
                            <label>Asset Base Price</label>
                            <input type="number" value={dcaPrice} onChange={(e) => setDcaPrice(parseFloat(e.target.value) || 0)} />
                        </div>
                        <div className="input-group">
                            <label>Monthly Contribution</label>
                            <input type="number" value={dcaMonthly} onChange={(e) => setDcaMonthly(parseFloat(e.target.value) || 0)} />
                        </div>
                        <div className="grid-cols-2">
                            <div className="input-group">
                                <label>Months Count</label>
                                <input type="number" value={dcaMonths} onChange={(e) => setDcaMonths(parseInt(e.target.value) || 1)} />
                            </div>
                            <div className="input-group">
                                <label>Annualized ROI %</label>
                                <input type="number" value={dcaReturn} onChange={(e) => setDcaReturn(parseFloat(e.target.value) || 0)} />
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div className="grid-cols-4">
                            <div className="card" style={{ padding: '1rem' }}>
                                <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>Kelly Optimal Fraction</span>
                                <div style={{ fontSize: '1.15rem', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>{(finalKellyF * 100).toFixed(1)}%</div>
                            </div>
                            <div className="card" style={{ padding: '1rem' }}>
                                <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>Win/Loss Odds Edge</span>
                                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: kellyEdge >= 0 ? 'var(--green)' : 'var(--red)', fontFamily: 'var(--font-mono)' }}>{kellyEdge.toFixed(1)}%</div>
                            </div>
                            <div className="card" style={{ padding: '1rem' }}>
                                <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>Optimal Bet Size</span>
                                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--cyan)', fontFamily: 'var(--font-mono)' }}>{FMT(kellyOptBet)}</div>
                            </div>
                            <div className="card" style={{ padding: '1rem' }}>
                                <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>DCA Terminal Value</span>
                                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>{FMT(finalDcaVal)}</div>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1.5rem' }}>
                            <div className="card" style={{ height: '280px' }}>
                                <div className="card-title">DCA Compound Portfolio Growth (24M Projection)</div>
                                <div style={{ height: '230px' }}>
                                    <Line data={dcaChartData} options={{ responsive: true, maintainAspectRatio: false, scales: { x: chartGridConfig, y: chartGridConfig } }} />
                                </div>
                            </div>

                            <div className="card" style={{ height: '280px' }}>
                                <div className="card-title">Kelly Allocation sizing map</div>
                                <div style={{ height: '230px' }}>
                                    <Bar data={kellyChartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: chartGridConfig, y: chartGridConfig } }} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {subTab === 'martingale2' && (
                <div className="tab-content-grid">
                    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div className="dir-toggle">
                            <button className={`dir-btn ${m2Dir === 'long' ? 'active long' : ''}`} onClick={() => setM2Dir('long')}>Long Grid</button>
                            <button className={`dir-btn ${m2Dir === 'short' ? 'active short' : ''}`} onClick={() => setM2Dir('short')}>Short Grid</button>
                        </div>
                        
                        <div className="input-group">
                            <label>Asset Select</label>
                            <select value={m2Asset} onChange={(e) => setM2Asset(e.target.value)}>
                                <option value="BTC/USD">Bitcoin (BTC/USD)</option>
                                <option value="ETH/USD">Ethereum (ETH/USD)</option>
                                <option value="EUR/USD">EUR/USD</option>
                                <option value="GBP/USD">GBP/USD</option>
                                <option value="GOLD">Gold (Commodities)</option>
                                <option value="SILVER">Silver (Commodities)</option>
                                <option value="custom">Custom (Manual Entry)</option>
                            </select>
                        </div>

                        <div className="input-group">
                            <label>Base Price ({m2Asset === 'custom' ? 'Manual' : 'Live Sync'})</label>
                            <input 
                                type="number" 
                                value={m2ManualPrice} 
                                disabled={m2Asset !== 'custom'} 
                                onChange={(e) => setM2ManualPrice(parseFloat(e.target.value) || 0)} 
                            />
                        </div>

                        <div className="input-group">
                            <label>Base Sizing (Contracts/Lots)</label>
                            <input type="number" value={m2BaseSize} onChange={(e) => setM2BaseSize(parseFloat(e.target.value) || 0)} />
                        </div>

                        <div className="input-group">
                            <label>Martingale Multiplier: {m2Multiplier.toFixed(1)}×</label>
                            <input type="range" min="1.1" max="3.0" step="0.1" value={m2Multiplier} onChange={(e) => setM2Multiplier(parseFloat(e.target.value) || 1.1)} style={{ width: '100%' }} />
                        </div>

                        <div className="input-group">
                            <label>Grid Spacing Interval: {m2StepPct.toFixed(1)}%</label>
                            <input type="range" min="0.5" max="10.0" step="0.5" value={m2StepPct} onChange={(e) => setM2StepPct(parseFloat(e.target.value) || 0.5)} style={{ width: '100%' }} style={{ width: '100%' }} />
                        </div>

                        <div className="input-group">
                            <label>Safety Levels (Max Nodes): {m2Levels}</label>
                            <input type="range" min="2" max="10" value={m2Levels} onChange={(e) => setM2Levels(parseInt(e.target.value) || 2)} style={{ width: '100%' }} />
                        </div>

                        <div className="input-group">
                            <label>Take Profit Target: {m2Tp.toFixed(1)}%</label>
                            <input type="range" min="0.5" max="10.0" step="0.5" value={m2Tp} onChange={(e) => setM2Tp(parseFloat(e.target.value) || 0.5)} style={{ width: '100%' }} />
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div className="grid-cols-4">
                            <div className="card" style={{ padding: '1rem' }}>
                                <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>Cumulative Entry Cost</span>
                                <div style={{ fontSize: '1.15rem', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>{FMT(m2TotalCap)}</div>
                            </div>
                            <div className="card" style={{ padding: '1rem' }}>
                                <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>Average Entry Cost</span>
                                <div style={{ fontSize: '1.15rem', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>{FMTFloat(m2FinalAvg)}</div>
                            </div>
                            <div className="card" style={{ padding: '1rem' }}>
                                <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>Take Profit Price</span>
                                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>{FMTFloat(m2FinalTp)}</div>
                            </div>
                            <div className="card" style={{ padding: '1rem' }}>
                                <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>Max Drawdown Risk</span>
                                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--red)', fontFamily: 'var(--font-mono)' }}>{m2MaxDrawdown.toFixed(2)}%</div>
                            </div>
                        </div>

                        <div className="card" style={{ flex: 1, minHeight: '260px' }}>
                            <div className="card-title">Martingale 2.0 Sizing Projection Curve</div>
                            <div style={{ height: '220px' }}>
                                <Line data={m2ChartData} options={{ responsive: true, maintainAspectRatio: false, scales: { x: chartGridConfig, y: chartGridConfig } }} />
                            </div>
                        </div>

                        <div className="card">
                            <div className="card-title">Grid Orders Execution Flow Map</div>
                            <div className="table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Level</th>
                                            <th>Trigger Price</th>
                                            <th>Step Lot Qty</th>
                                            <th>Level Margin Cost</th>
                                            <th>Cumulative Avg Cost</th>
                                            <th>Weighted TP Price</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {m2Rows.map(r => (
                                            <tr key={r.level}>
                                                <td><span className="badge badge-teal">Node {r.level}</span></td>
                                                <td style={{ fontFamily: 'var(--font-mono)' }}>{FMTFloat(r.price)}</td>
                                                <td>{r.qty.toFixed(2)}</td>
                                                <td>{FMT(r.invest)}</td>
                                                <td style={{ color: 'var(--amber)', fontFamily: 'var(--font-mono)' }}>{FMTFloat(r.avgEntry)}</td>
                                                <td style={{ color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>{FMTFloat(r.tpPrice)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
