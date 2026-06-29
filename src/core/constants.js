/* ══════════════════════════════════════════════════════════
   CASHFLOW.SYS — constants.js
   All static data: categories, keywords, defaults, demo data.
══════════════════════════════════════════════════════════ */

const CAT_ICONS={
  food:`<path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>`,
  transport:`<rect x="1" y="3" width="15" height="13" rx="2"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>`,
  shopping:`<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>`,
  health:`<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>`,
  bills:`<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>`,
  entertainment:`<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>`,
  education:`<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>`,
  personal:`<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>`,
  home:`<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>`,
  subscription:`<rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>`,
  social:`<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>`,
  other:`<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>`,
  income:`<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>`,
};

/* ── Icon utilities for inline SVG ───────────────────────────── */
const ICON_SVGS = {
  check: `<path d="M20 6L9 17l-5-5"/>`,
  close: `<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>`,
  lightbulb: `<path d="M9 18h6"/><path d="M10 22h4"/><path d="M15 2a7 7 0 1 1-3.5 13h-1A7 7 0 0 1 15 2z"/><path d="M9.5 15a3.5 3.5 0 0 0 0 3"/>`,
  refresh: `<path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>`,
  trendUp: `<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>`,
  trendDown: `<polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/>`,
  repeat: `<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>`,
  wave: `<path d="M5.5 8.5 9 12l-3.5 3.5L2 12l3.5-3.5zM12 2l3.5 3.5L12 9 8.5 5.5 12 2zM18.5 8.5 22 12l-3.5 3.5L15 12l3.5-3.5zM12 15l3.5 3.5L12 22l-3.5-3.5L12 15z"/>`,
  seedling: `<path d="M12 22v-8m0 0c-2.5 0-4.5-2-4.5-4.5C7.5 7 10 5 12 5c0 2.5 2 4.5 4.5 4.5S21 7 21 4.5c0 2.5-2 4.5-4.5 4.5S12 11.5 12 14z"/><path d="M12 14c-2.5 0-4.5-2-4.5-4.5C7.5 7 10 5 12 5"/>`,
  fire: `<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>`,
  party: `<path d="M5.8 11.3L2 22l10.7-3.8M4 3h.01M22 8h.01M15 2h.01M22 20h.01"/><path d="M22 2l-2.24.75a2.9 2.9 0 0 0-1.96 3.12v0c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10"/><path d="M16 16l-2.24.75a2.9 2.9 0 0 0-1.96 3.12v0c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L8 24"/>`,
  warning: `<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>`,
  bolt: `<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>`,
  arrowUp: `<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>`,
  arrowDown: `<line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>`,
  arrowRight: `<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>`,
};

// Helper function to create inline SVG icons
function icon(name, className = '', size = 16) {
  const paths = ICON_SVGS[name] || '';
  return `<svg class="${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}

const CATS=[
  {id:'food',         label:'Food & Drink',   color:'#c2714f'},
  {id:'transport',    label:'Transport',       color:'#5b8db8'},
  {id:'shopping',     label:'Shopping',        color:'#9b6bb5'},
  {id:'health',       label:'Health',          color:'#4a9e6b'},
  {id:'bills',        label:'Bills',           color:'#c4a032'},
  {id:'entertainment',label:'Entertainment',   color:'#b85b7a'},
  {id:'education',    label:'Education',       color:'#4a8faa'},
  {id:'personal',     label:'Personal',        color:'#7a9e44'},
  {id:'home',         label:'Housing',         color:'#c08a3c'},
  {id:'subscription', label:'Subscriptions',   color:'#7a6bb5'},
  {id:'social',       label:'Social',          color:'#b55b5b'},
  {id:'saving',       label:'Saving',          color:'#27ae60'},
  {id:'other',        label:'Other',           color:'#6b7280'},
];

const DEF_BUDGETS={food:2000000,transport:500000,shopping:1000000,health:300000,bills:500000,entertainment:500000,education:200000,personal:300000,home:1800000,subscription:200000,social:300000,saving:500000,other:200000};
const DEF_PERCENTS={food:25,transport:8,shopping:10,health:4,bills:10,entertainment:5,education:4,personal:5,home:22,subscription:3,social:3,other:1};

const CAT_KW={
  food:['makan','minum','nasi','ayam','bakso','mie','coffee','kopi','boba','pizza','burger','sate','resto','cafe','warung','grab food','gofood','shopeefood','seafood','sushi','ramen','martabak','gorengan','es','jus','snack','cemilan','padang','warteg','geprek','mie ayam', 'sun'],
  transport:['grab','gojek','ojek','taxi','taksi','bensin','parkir','tol','busway','mrt','commuter','kereta','pesawat','tiket','bbm','pertamax','pertalite','transjakarta','shell','goride'],
  shopping:['tokopedia','shopee','lazada','toko','belanja','baju','sepatu','celana','beli','alfamart','indomaret','supermarket','hypermart','carrefour','ikea','fashion'],
  health:['dokter','obat','apotek','klinik','rumah sakit','lab','vitamin','suplemen','masker','bpjs kesehatan', 'tennis'],
  bills:['listrik','air','pdam','internet','wifi','indihome','telkom','gas','iuran','pbb','pajak','bpjs','pulsa','tagihan'],
  entertainment:['bioskop','netflix','spotify','youtube','steam','game','konser','nonton','disney','hbo','cgv','xxl','cinemax'],
  education:['kursus','buku','seminar','pelatihan','sekolah','kampus','les','bimbel','udemy','gramedia','online'],
  personal:['salon','potong','barber','spa','gym','fitness','laundry','barbershop','skincare'],
  home:['sewa','kos','kontrakan','furnitur','renovasi','cat','cleaning','bulanan'],
  subscription:['icloud','google one','premium','membership','langganan','canva'],
  social:['hadiah','kado','arisan','sumbangan','donasi','sedekah','wedding','dinner','ulang tahun','anniversary','valentine'],
};

const INCOME_KW=[
  'gaji','salary','pemasukan','income','bonus','freelance','dapat uang',
  'transfer masuk','dibayar','tunjangan','komisi','dividen','investasi cair',
  'honorarium','fee project','reimburse','refund kembali','cashback','topup saldo masuk',
  'hasil usaha','laba','keuntungan','pendapatan','upah','penggajian',
];

const SHORTHANDS={rb:1000,ribu:1000,k:1000,jt:1000000,juta:1000000,m:1000000};

/* ── MULTI-CURRENCY SUPPORT ────────────────────────────────── */
const CURRENCIES = {
  IDR: { symbol: 'Rp', name: 'Indonesian Rupiah', locale: 'id-ID', decimals: 0 },
  USD: { symbol: '$', name: 'US Dollar', locale: 'en-US', decimals: 2 },
  SGD: { symbol: 'S$', name: 'Singapore Dollar', locale: 'en-SG', decimals: 2 },
  EUR: { symbol: '€', name: 'Euro', locale: 'de-DE', decimals: 2 },
  GBP: { symbol: '£', name: 'British Pound', locale: 'en-GB', decimals: 2 },
  JPY: { symbol: '¥', name: 'Japanese Yen', locale: 'ja-JP', decimals: 0 },
  MYR: { symbol: 'RM', name: 'Malaysian Ringgit', locale: 'ms-MY', decimals: 2 },
  THB: { symbol: '฿', name: 'Thai Baht', locale: 'th-TH', decimals: 2 },
  AUD: { symbol: 'A$', name: 'Australian Dollar', locale: 'en-AU', decimals: 2 },
  CNY: { symbol: '¥', name: 'Chinese Yuan', locale: 'zh-CN', decimals: 2 },
};

// Default exchange rates to IDR (approximate, user can update)
const DEFAULT_EXCHANGE_RATES = {
  IDR: 1,
  USD: 15800,
  SGD: 11800,
  EUR: 17200,
  GBP: 20000,
  JPY: 105,
  MYR: 3400,
  THB: 440,
  AUD: 10500,
  CNY: 2200,
};

/* ── Demo data ─────────────────────────────────────────────── */
const DUMMY_TX = (() => {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const todayDay = now.getDate();

  // Returns YYYY-MM-DD for a given month offset (0=current, -1=last, -2=two months ago) and day.
  // Caps current-month days at today so we never produce future dates.
  const d = (monthOffset, day) => {
    const capped = (monthOffset === 0) ? Math.min(day, todayDay) : day;
    const dt = new Date(y, m + monthOffset, capped);
    return dt.toISOString().split('T')[0];
  };

  return [
    // ── Current month ────────────────────────────────────────
    {date:d(0,1), description:'This Month Salary',         type:'income', category:'income',       amount:8500000,note:'BCA transfer'},
    {date:d(0,15),description:'Q1 Project Bonus',          type:'income', category:'income',       amount:1500000,note:''},
    {date:d(0,19),description:'Nasi Goreng Spesial',       type:'expense',category:'food',         amount:28000, note:''},
    {date:d(0,19),description:'Grab to Office',            type:'expense',category:'transport',    amount:32000, note:''},
    {date:d(0,18),description:'Kopi Jiwa',                 type:'expense',category:'food',         amount:28000, note:''},
    {date:d(0,18),description:'Shopee Work Clothes',       type:'expense',category:'shopping',     amount:289000,note:''},
    {date:d(0,17),description:'Pertamax Full Tank',        type:'expense',category:'transport',    amount:150000,note:'',recurring:true,recurringId:'rec_fuel'},
    {date:d(0,17),description:'Netflix Premium',           type:'expense',category:'subscription', amount:54000, note:'monthly',recurring:true,recurringId:'rec_netflix'},
    {date:d(0,16),description:'Lunch at Warteg',           type:'expense',category:'food',         amount:25000, note:''},
    {date:d(0,16),description:'Gym Fitness First',         type:'expense',category:'personal',     amount:350000,note:'monthly',recurring:true,recurringId:'rec_gym'},
    {date:d(0,15),description:'Sushi Tei Grand Indonesia', type:'expense',category:'food',         amount:195000,note:'dinner'},
    {date:d(0,15),description:'Grand Indonesia Parking',   type:'expense',category:'transport',    amount:15000, note:''},
    {date:d(0,14),description:'PLN Electricity Bill',      type:'expense',category:'bills',        amount:387000,note:'this month',recurring:true,recurringId:'rec_pln'},
    {date:d(0,14),description:'Tokopedia Laptop Charger',  type:'expense',category:'shopping',     amount:245000,note:''},
    {date:d(0,13),description:'GP Doctor Visit',           type:'expense',category:'health',       amount:150000,note:'clinic'},
    {date:d(0,13),description:'Pharmacy K24',              type:'expense',category:'health',       amount:87500, note:''},
    {date:d(0,12),description:'Bakso Akung',               type:'expense',category:'food',         amount:35000, note:''},
    {date:d(0,12),description:'Spotify Premium',           type:'expense',category:'subscription', amount:54000, note:'monthly',recurring:true,recurringId:'rec_spotify'},
    {date:d(0,11),description:'Gojek GoRide',              type:'expense',category:'transport',    amount:18000, note:''},
    {date:d(0,10),description:'Monthly Rent',              type:'expense',category:'home',         amount:1800000,note:'this month',recurring:true,recurringId:'rec_rent'},
    {date:d(0,10),description:'IndiHome Internet',         type:'expense',category:'bills',        amount:325000,note:'',recurring:true,recurringId:'rec_indihome'},
    {date:d(0,9), description:"Budi's Birthday Dinner",    type:'expense',category:'social',       amount:320000,note:'restaurant'},
    {date:d(0,8), description:'Indomaret Monthly Shop',    type:'expense',category:'shopping',     amount:178000,note:''},
    {date:d(0,7), description:'Udemy React Course',        type:'expense',category:'education',    amount:249000,note:''},
    {date:d(0,6), description:'Freelance Web Project',     type:'income', category:'income',       amount:2500000,note:'e-commerce client'},
    {date:d(0,5), description:'Mie Geprek Bensu',          type:'expense',category:'food',         amount:35000, note:''},
    {date:d(0,4), description:'iCloud Storage',            type:'expense',category:'subscription', amount:15000, note:'50GB',recurring:true,recurringId:'rec_icloud'},
    {date:d(0,3), description:'Skincare Tokopedia',        type:'expense',category:'personal',     amount:185000,note:''},
    {date:d(0,2), description:'Haircut Barbershop',        type:'expense',category:'personal',     amount:65000, note:''},
    {date:d(0,1), description:'Disney+ Subscription',      type:'expense',category:'subscription', amount:49000, note:'monthly',recurring:true,recurringId:'rec_disney'},
    // ── Last month ───────────────────────────────────────────
    {date:d(-1,1), description:'Last Month Salary',        type:'income', category:'income',       amount:8500000,note:'BCA transfer'},
    {date:d(-1,20),description:'Freelance Mobile App',     type:'income', category:'income',       amount:3000000,note:'startup client'},
    {date:d(-1,28),description:'Grocery Superindo',        type:'expense',category:'shopping',     amount:312000,note:''},
    {date:d(-1,27),description:'Grab to Client',           type:'expense',category:'transport',    amount:55000, note:''},
    {date:d(-1,26),description:'Coffee Shop Meeting',      type:'expense',category:'food',         amount:85000, note:''},
    {date:d(-1,25),description:'BPJS Health',              type:'expense',category:'health',       amount:150000,note:'monthly',recurring:true,recurringId:'rec_bpjs'},
    {date:d(-1,24),description:'Shopee Desk Lamp',         type:'expense',category:'shopping',     amount:220000,note:'WFH setup'},
    {date:d(-1,22),description:'Cinema CGV',               type:'expense',category:'entertainment',amount:95000, note:''},
    {date:d(-1,20),description:'Pertamax Full Tank',       type:'expense',category:'transport',    amount:155000,note:'',recurring:true,recurringId:'rec_fuel'},
    {date:d(-1,19),description:'Dinner at Plataran',       type:'expense',category:'social',       amount:680000,note:'anniversary'},
    {date:d(-1,18),description:'Monthly Rent',             type:'expense',category:'home',         amount:1800000,note:'last month',recurring:true,recurringId:'rec_rent'},
    {date:d(-1,15),description:'Shopee Fashion Sale',      type:'expense',category:'shopping',     amount:412000,note:''},
    {date:d(-1,12),description:'Laundry 5kg',              type:'expense',category:'personal',     amount:72000, note:''},
    {date:d(-1,10),description:'IndiHome Internet',        type:'expense',category:'bills',        amount:325000,note:'',recurring:true,recurringId:'rec_indihome'},
    {date:d(-1,8), description:'Tokopedia Bluetooth Headset',type:'expense',category:'shopping',  amount:389000,note:''},
    {date:d(-1,5), description:'Mie Geprek Bensu',         type:'expense',category:'food',         amount:35000, note:''},
    {date:d(-1,3), description:'Netflix Premium',          type:'expense',category:'subscription', amount:54000, note:'monthly',recurring:true,recurringId:'rec_netflix'},
    {date:d(-1,1), description:'Spotify Premium',          type:'expense',category:'subscription', amount:54000, note:'monthly',recurring:true,recurringId:'rec_spotify'},
    // ── Two months ago ───────────────────────────────────────
    {date:d(-2,1), description:'Two Months Ago Salary',    type:'income', category:'income',       amount:8500000,note:'BCA transfer'},
    {date:d(-2,20),description:'Freelance Landing Page',   type:'income', category:'income',       amount:1800000,note:'e-commerce client'},
    {date:d(-2,30),description:'Nasi Goreng Spesial',      type:'expense',category:'food',         amount:30000, note:''},
    {date:d(-2,28),description:'GoFood Delivery',          type:'expense',category:'food',         amount:65000, note:'inc. delivery fee'},
    {date:d(-2,25),description:'Monthly Rent',             type:'expense',category:'home',         amount:1800000,note:'two months ago',recurring:true,recurringId:'rec_rent'},
    {date:d(-2,23),description:'Pick-up Laundry',          type:'expense',category:'personal',     amount:95000, note:'7kg'},
    {date:d(-2,20),description:'Cinema CGV Avatar',        type:'expense',category:'entertainment',amount:95000, note:''},
    {date:d(-2,18),description:'PLN Electricity',          type:'expense',category:'bills',        amount:298000,note:'',recurring:true,recurringId:'rec_pln'},
    {date:d(-2,15),description:'Udemy React Course',       type:'expense',category:'education',    amount:249000,note:''},
    {date:d(-2,12),description:'Sushi Nori Kelapa Gading', type:'expense',category:'food',         amount:220000,note:''},
    {date:d(-2,10),description:'Tokopedia Skincare Set',   type:'expense',category:'personal',     amount:285000,note:''},
    {date:d(-2,8), description:'Pertamax Full Tank',       type:'expense',category:'transport',    amount:200000,note:'',recurring:true,recurringId:'rec_fuel'},
    {date:d(-2,5), description:"Sarah's Birthday Gift",    type:'expense',category:'social',       amount:250000,note:''},
    {date:d(-2,3), description:'IndiHome Internet',        type:'expense',category:'bills',        amount:325000,note:'',recurring:true,recurringId:'rec_indihome'},
    {date:d(-2,2), description:'Netflix Premium',          type:'expense',category:'subscription', amount:54000, note:'monthly',recurring:true,recurringId:'rec_netflix'},
  ];
})()

/* ─── ESM window bridge (auto-generated) ─── */
Object.assign(window, { CAT_ICONS, ICON_SVGS, icon, CATS, DEF_BUDGETS, DEF_PERCENTS, CAT_KW, INCOME_KW, SHORTHANDS, CURRENCIES, DEFAULT_EXCHANGE_RATES, DUMMY_TX });
