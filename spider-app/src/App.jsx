import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, Calculator, Activity, Newspaper, LogOut, Wallet, Globe, ShieldAlert, BookOpen
} from 'lucide-react';
import Login from './components/Login';
import DashboardTab from './components/DashboardTab';
import CalculatorsTab from './components/CalculatorsTab';
import PracticeTradingTab from './components/PracticeTradingTab';
import NewsTab from './components/NewsTab';
import TradingCalculatorHubTab from './components/TradingCalculatorHubTab';
import './App.css';

// Initial asset base prices
const INITIAL_PRICES = {
  // Equities (INR)
  RELIANCE: 2450.00,
  TCS: 3520.00,
  INFOSYS: 1420.00,
  HDFCBANK: 1550.00,
  ICICIBANK: 1080.00,
  // Futures (INR)
  NIFTY23MAYFUT: 22400.00,
  BANKNIFTY23MAYFUT: 47800.00,
  // Options (INR)
  'NIFTY 22000 CE': 180.00,
  'NIFTY 22000 PE': 150.00,
  'BANKNIFTY 47000 CE': 380.00,
  'BANKNIFTY 47000 PE': 420.00,
  // Commodities (USD)
  GOLD: 2350.00,
  SILVER: 28.50,
  CRUDEOIL: 78.20,
  // Forex (USD)
  'EUR/USD': 1.0850,
  'GBP/USD': 1.2680,
  'USD/INR': 83.35,
  'USD/JPY': 156.20,
  // Crypto (USD)
  'BTC/USD': 66500.00,
  'ETH/USD': 3100.00,
  'SOL/USD': 165.00
};

export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');

  // Balances
  const [inrBalance, setInrBalance] = useState(100000); // 1 Lakh Rupees starting
  const [usdBalance, setUsdBalance] = useState(1000);  // $1000 USD starting

  // Positions & Trade logs
  const [positions, setPositions] = useState([]);
  const [trades, setTrades] = useState([]);

  // Live prices simulator
  const [prices, setPrices] = useState(INITIAL_PRICES);
  const [priceDirections, setPriceDirections] = useState({});

  // Global 2-second simulation timer
  useEffect(() => {
    const interval = setInterval(() => {
      setPrices(prevPrices => {
        const nextPrices = { ...prevPrices };
        const nextDirections = {};

        Object.keys(prevPrices).forEach(sym => {
          const basePrice = prevPrices[sym];
          let changePct = (Math.random() - 0.5) * 0.004; // default +/- 0.2% tick

          // Lower Forex volatility, higher Crypto and Option volatility
          if (sym.includes('/') && !sym.includes('BTC') && !sym.includes('ETH')) {
            changePct = (Math.random() - 0.5) * 0.0006; // Forex
          } else if (sym.includes('CE') || sym.includes('PE')) {
            changePct = (Math.random() - 0.5) * 0.024;  // Options
          } else if (sym.includes('BTC') || sym.includes('ETH') || sym.includes('SOL')) {
            changePct = (Math.random() - 0.5) * 0.008;  // Cryptos
          }

          const nextPrice = Math.max(0.0001, basePrice * (1 + changePct));
          nextPrices[sym] = parseFloat(nextPrice.toFixed(sym.includes('EUR') || sym.includes('GBP') ? 4 : 2));

          if (nextPrices[sym] > basePrice) {
            nextDirections[sym] = 'up';
          } else if (nextPrices[sym] < basePrice) {
            nextDirections[sym] = 'down';
          } else {
            nextDirections[sym] = 'neutral';
          }
        });

        setPriceDirections(nextDirections);
        return nextPrices;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  // Handle Order Placement
  const handleExecuteTrade = (order) => {
    // Deduct margin from appropriate cash balance
    if (order.currency === 'INR') {
      setInrBalance(prev => prev - order.margin);
    } else {
      setUsdBalance(prev => prev - order.margin);
    }

    // Add position
    setPositions(prev => [
      ...prev,
      {
        id: 'pos_' + Math.random().toString(36).substr(2, 9),
        ...order,
        timestamp: new Date().toLocaleTimeString()
      }
    ]);
  };

  // Handle Position Closure
  const handleClosePosition = (posId) => {
    const pos = positions.find(p => p.id === posId);
    if (!pos) return;

    const curPrice = prices[pos.symbol] || pos.entryPrice;
    const priceDiff = pos.direction === 'LONG' ? (curPrice - pos.entryPrice) : (pos.entryPrice - curPrice);
    const pnl = priceDiff * pos.qty;

    // Release margin + P&L back to balance
    const payout = pos.margin + pnl;
    if (pos.currency === 'INR') {
      setInrBalance(prev => prev + payout);
    } else {
      setUsdBalance(prev => prev + payout);
    }

    // Remove position
    setPositions(prev => prev.filter(p => p.id !== posId));

    // Log to trade history
    setTrades(prev => [
      ...prev,
      {
        id: posId,
        symbol: pos.symbol,
        direction: pos.direction,
        qty: pos.qty,
        entryPrice: pos.entryPrice,
        exitPrice: curPrice,
        pnl: pnl,
        currency: pos.currency,
        timestamp: new Date().toLocaleTimeString()
      }
    ]);
  };

  // Render Login page if not authenticated
  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return (
    <div className="app-layout">
      {/* LEFT SIDEBAR */}
      <aside className="sidebar">
        <div className="logo-container">
          <span className="logo-icon">🕷️</span>
          <div className="logo-text">Spider<span>Quant</span></div>
        </div>

        <nav className="nav-links">
          <button 
            className={`nav-link ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <Wallet /> Dashboard Overview
          </button>
          <button 
            className={`nav-link ${activeTab === 'calculators' ? 'active' : ''}`}
            onClick={() => setActiveTab('calculators')}
          >
            <Calculator /> Quant Calculators
          </button>
          <button 
            className={`nav-link ${activeTab === 'practice' ? 'active' : ''}`}
            onClick={() => setActiveTab('practice')}
          >
            <Activity /> Practice Trade Desk
          </button>
          <button 
            className={`nav-link ${activeTab === 'hub' ? 'active' : ''}`}
            onClick={() => setActiveTab('hub')}
          >
            <BookOpen /> Classic Trading Hub
          </button>
          <button 
            className={`nav-link ${activeTab === 'news' ? 'active' : ''}`}
            onClick={() => setActiveTab('news')}
          >
            <Newspaper /> Financial News Hub
          </button>
        </nav>

        <div className="sidebar-footer">
          <div>Quant Terminal v3.0</div>
          <div style={{ color: 'var(--green)', fontSize: '0.65rem', marginTop: '4px' }}>🛡️ ENCRYPTED SESSION</div>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <main className="main-content">
        {/* HEADER */}
        <header className="header">
          {/* Dual Balance Display */}
          <div className="balances-container">
            <div className="balance-card">
              <span className="balance-label">NSE/BSE Balance</span>
              <span className="balance-value inr">₹{inrBalance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
            </div>
            <div className="balance-card">
              <span className="balance-label">USD Balance</span>
              <span className="balance-value usd">${usdBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>

          {/* User profile section */}
          <div className="header-user">
            <div className="user-avatar">{user.name.charAt(0).toUpperCase()}</div>
            <div className="user-name">{user.name}</div>
            <button 
              className="logout-btn" 
              onClick={() => setUser(null)} 
              title="Sign Out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {/* PAGE BODY */}
        <div className="page-body">
          {activeTab === 'dashboard' && (
            <DashboardTab 
              inrBalance={inrBalance}
              usdBalance={usdBalance}
              positions={positions}
              trades={trades}
              prices={prices}
              onClosePosition={handleClosePosition}
            />
          )}

          {activeTab === 'calculators' && (
            <CalculatorsTab prices={prices} />
          )}

          {activeTab === 'practice' && (
            <PracticeTradingTab 
              inrBalance={inrBalance}
              usdBalance={usdBalance}
              positions={positions}
              prices={prices}
              priceDirections={priceDirections}
              onExecuteTrade={handleExecuteTrade}
              onClosePosition={handleClosePosition}
            />
          )}

          {activeTab === 'hub' && (
            <TradingCalculatorHubTab />
          )}

          {activeTab === 'news' && (
            <NewsTab />
          )}
        </div>
      </main>
    </div>
  );
}
