// Shared source of truth for both dashboards and the summary

export const CURRENT_BTC_PRICE = 87400;
export const BASE_UNIT = 25;

// === DCA Bot buy events ===
export const dcaBuyEvents = [
  { date: '2024-05-06',  price: 64200,  usdtSpent: 25.00,   trigger: '7d MA',   multiplier: 1   },
  { date: '2024-06-17',  price: 67100,  usdtSpent: 50.00,   trigger: '30d MA',  multiplier: 2   },
  { date: '2024-07-01',  price: 62900,  usdtSpent: 75.00,   trigger: '100d MA', multiplier: 3   },
  { date: '2024-07-15',  price: 61100,  usdtSpent: 50.00,   trigger: '30d MA',  multiplier: 2   },
  { date: '2024-08-12',  price: 59200,  usdtSpent: 75.00,   trigger: '100d MA', multiplier: 3   },
  { date: '2024-08-26',  price: 57700,  usdtSpent: 112.50,  trigger: '200d MA', multiplier: 4.5 },
  { date: '2024-09-09',  price: 60300,  usdtSpent: 50.00,   trigger: '30d MA',  multiplier: 2   },
  { date: '2024-09-23',  price: 64100,  usdtSpent: 25.00,   trigger: '7d MA',   multiplier: 1   },
  { date: '2024-10-07',  price: 68200,  usdtSpent: 25.00,   trigger: '7d MA',   multiplier: 1   },
  { date: '2024-10-21',  price: 70400,  usdtSpent: 25.00,   trigger: '7d MA',   multiplier: 1   },
  { date: '2024-11-04',  price: 73900,  usdtSpent: 25.00,   trigger: '7d MA',   multiplier: 1   },
  { date: '2024-11-18',  price: 81200,  usdtSpent: 25.00,   trigger: '7d MA',   multiplier: 1   },
  { date: '2024-12-02',  price: 89600,  usdtSpent: 25.00,   trigger: '7d MA',   multiplier: 1   },
  { date: '2024-12-16',  price: 97800,  usdtSpent: 25.00,   trigger: '7d MA',   multiplier: 1   },
  { date: '2025-01-13',  price: 96300,  usdtSpent: 25.00,   trigger: '7d MA',   multiplier: 1   },
  { date: '2025-01-27',  price: 91800,  usdtSpent: 25.00,   trigger: '7d MA',   multiplier: 1   },
  { date: '2025-02-10',  price: 88100,  usdtSpent: 50.00,   trigger: '30d MA',  multiplier: 2   },
  { date: '2025-02-24',  price: 84500,  usdtSpent: 75.00,   trigger: '100d MA', multiplier: 3   },
  { date: '2025-03-10',  price: 82400,  usdtSpent: 75.00,   trigger: '100d MA', multiplier: 3   },
  { date: '2025-03-24',  price: 85200,  usdtSpent: 50.00,   trigger: '30d MA',  multiplier: 2   },
  { date: '2026-01-19',  price: 92837,  usdtSpent: 337.50,  trigger: '200d MA', multiplier: 4.5 },
];

// === Crash Bot buy events ===
export const crashBuyEvents = [
  { date: '2022-05-12', price: 28600,  dipPct: -13.2, tier: 'Tier 1 (-10%)', units: 2,   usdtSpent: 50.00  },
  { date: '2022-05-19', price: 28900,  dipPct: -11.8, tier: 'Tier 1 (-10%)', units: 2,   usdtSpent: 50.00  },
  { date: '2022-06-13', price: 22500,  dipPct: -21.4, tier: 'Tier 3 (-20%)', units: 4.5, usdtSpent: 112.50 },
  { date: '2022-06-18', price: 19400,  dipPct: -16.9, tier: 'Tier 2 (-15%)', units: 3,   usdtSpent: 75.00  },
  { date: '2022-09-13', price: 20300,  dipPct: -10.6, tier: 'Tier 1 (-10%)', units: 2,   usdtSpent: 50.00  },
  { date: '2022-11-09', price: 15900,  dipPct: -22.1, tier: 'Tier 3 (-20%)', units: 4.5, usdtSpent: 112.50 },
  { date: '2023-03-03', price: 22100,  dipPct: -10.9, tier: 'Tier 1 (-10%)', units: 2,   usdtSpent: 50.00  },
  { date: '2023-04-26', price: 27900,  dipPct: -11.4, tier: 'Tier 1 (-10%)', units: 2,   usdtSpent: 50.00  },
  { date: '2023-08-17', price: 26300,  dipPct: -10.2, tier: 'Tier 1 (-10%)', units: 2,   usdtSpent: 50.00  },
  { date: '2024-03-19', price: 61900,  dipPct: -10.5, tier: 'Tier 1 (-10%)', units: 2,   usdtSpent: 50.00  },
  { date: '2024-08-05', price: 53700,  dipPct: -17.3, tier: 'Tier 2 (-15%)', units: 3,   usdtSpent: 75.00  },
  { date: '2025-02-26', price: 82400,  dipPct: -10.8, tier: 'Tier 1 (-10%)', units: 2,   usdtSpent: 50.00  },
  { date: '2025-03-03', price: 86100,  dipPct: -12.6, tier: 'Tier 1 (-10%)', units: 2,   usdtSpent: 50.00  },
  { date: '2026-02-05', price: 62700,  dipPct: -14.3, tier: 'Tier 2 (-15%)', units: 3,   usdtSpent: 75.00  },
];
