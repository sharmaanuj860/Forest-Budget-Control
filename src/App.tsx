import React, { useState, useMemo, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from 'recharts';
import { IndianRupee, Wallet, TrendingDown, Landmark, Activity, FileText, Map, Plus, Trash2, Download } from 'lucide-react';

// --- Types ---
type FinancialYear = { id: number; name: string };
type Range = { id: number; name: string };
type Scheme = { id: number; name: string; fyId: number };
type Sector = { id: number; schemeId: number; name: string };
type ActivityItem = { id: number; sectorId?: number; schemeId?: number; name: string };
type SubActivity = { id: number; activityId: number; name: string };
type SOE = { id: number; activityId?: number; subActivityId?: number; name: string; budgetLimit: number };
type Allocation = { id: number; soeId: number; rangeId: number; amount: number };
type Expense = { id: number; allocationId: number; amount: number; date: string; description: string; activityId?: number };

// --- Initial Mock Data ---
const initialFYs: FinancialYear[] = [{ id: 1, name: '2025-26' }, { id: 2, name: '2026-27' }];
const initialRanges: Range[] = [{ id: 1, name: 'Rajgarh' }, { id: 2, name: 'Habban' }];
const initialSchemes: Scheme[] = [{ id: 1, name: 'CAMPA', fyId: 1 }];
const initialSectors: Sector[] = [
  { id: 1, schemeId: 1, name: 'CA (Compensatory Afforestation)' },
  { id: 2, schemeId: 1, name: 'NPV (Net Present Value)' }
];
const initialActivities: ActivityItem[] = [
  { id: 1, sectorId: 1, name: 'Plantation' },
  { id: 2, sectorId: 2, name: 'SMC Works' },
  { id: 3, sectorId: 2, name: 'Nursery works' }
];
const initialSubActivities: SubActivity[] = [
  { id: 1, activityId: 2, name: 'Check Dam' },
  { id: 2, activityId: 2, name: 'Water Pond' },
  { id: 3, activityId: 3, name: '1st year activity' },
  { id: 4, activityId: 3, name: '2nd year activity' }
];
const initialSoes: SOE[] = [
  { id: 1, activityId: 1, name: '20 OC', budgetLimit: 50000 },
  { id: 2, subActivityId: 1, name: '36 MW', budgetLimit: 150000 }
];
const initialAllocations: Allocation[] = [
  { id: 1, soeId: 1, rangeId: 1, amount: 25000 },
  { id: 2, soeId: 1, rangeId: 2, amount: 25000 }
];
const initialExpenses: Expense[] = [
  { id: 1, allocationId: 1, amount: 5000, date: '2026-03-10', description: 'Site clearance' }
];

export default function App() {
  const [activeTab, setActiveTab] = useState('Dashboard');

  // --- State ---
  const [fys, setFys] = useState<FinancialYear[]>(initialFYs);
  const [selectedFyId, setSelectedFyId] = useState<number>(1);
  const [ranges, setRanges] = useState<Range[]>(initialRanges);
  const [schemes, setSchemes] = useState<Scheme[]>(initialSchemes);
  const [sectors, setSectors] = useState<Sector[]>(initialSectors);
  const [activities, setActivities] = useState<ActivityItem[]>(initialActivities);
  const [subActivities, setSubActivities] = useState<SubActivity[]>(initialSubActivities);
  const [soes, setSoes] = useState<SOE[]>(initialSoes);
  const [allocations, setAllocations] = useState<Allocation[]>(initialAllocations);
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);

  // --- Filters ---
  const [expDateRange, setExpDateRange] = useState({ start: '', end: '' });
  const [expFilters, setExpFilters] = useState({ schemeId: '', sectorId: '', activityId: '' });

  // --- Editing State ---
  const [editingItem, setEditingItem] = useState<{ type: string; item: any } | null>(null);

  // --- PWA Install State ---
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Update UI notify the user they can install the PWA
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    // Show the install prompt
    deferredPrompt.prompt();
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }
    // We've used the prompt, and can't use it again, throw it away
    setDeferredPrompt(null);
    setIsInstallable(false);
  };

  // --- Derived Data / Helpers ---
  const currentSchemes = useMemo(() => schemes.filter(s => s.fyId === selectedFyId), [schemes, selectedFyId]);
  const currentSectors = useMemo(() => sectors.filter(sec => currentSchemes.some(s => s.id === sec.schemeId)), [sectors, currentSchemes]);
  const currentActivities = useMemo(() => activities.filter(a => currentSectors.some(sec => sec.id === a.sectorId)), [activities, currentSectors]);
  const currentSubActivities = useMemo(() => subActivities.filter(sa => currentActivities.some(a => a.id === sa.activityId)), [subActivities, currentActivities]);
  const currentSoes = useMemo(() => soes.filter(s => 
    (s.activityId && currentActivities.some(a => a.id === s.activityId)) || 
    (s.subActivityId && currentSubActivities.some(sa => sa.id === s.subActivityId))
  ), [soes, currentActivities, currentSubActivities]);
  
  const currentAllocations = useMemo(() => allocations.filter(a => currentSoes.some(s => s.id === a.soeId)), [allocations, currentSoes]);
  
  const currentExpenses = useMemo(() => {
    let filtered = expenses.filter(e => currentAllocations.some(a => a.id === e.allocationId));
    
    if (expDateRange.start) filtered = filtered.filter(e => e.date >= expDateRange.start);
    if (expDateRange.end) filtered = filtered.filter(e => e.date <= expDateRange.end);
    
    if (expFilters.schemeId) {
      filtered = filtered.filter(e => {
        const alloc = allocations.find(a => a.id === e.allocationId);
        const soe = soes.find(s => s.id === alloc?.soeId);
        const act = activities.find(a => a.id === soe?.activityId || a.id === subActivities.find(sa => sa.id === soe?.subActivityId)?.activityId);
        const sec = sectors.find(s => s.id === act?.sectorId);
        const schId = sec ? sec.schemeId : act?.schemeId;
        return schId === parseInt(expFilters.schemeId);
      });
    }
    
    if (expFilters.sectorId) {
      filtered = filtered.filter(e => {
        const alloc = allocations.find(a => a.id === e.allocationId);
        const soe = soes.find(s => s.id === alloc?.soeId);
        const act = activities.find(a => a.id === soe?.activityId || a.id === subActivities.find(sa => sa.id === soe?.subActivityId)?.activityId);
        return act?.sectorId === parseInt(expFilters.sectorId);
      });
    }
    
    if (expFilters.activityId) {
      filtered = filtered.filter(e => {
        const alloc = allocations.find(a => a.id === e.allocationId);
        const soe = soes.find(s => s.id === alloc?.soeId);
        const actId = soe?.activityId || subActivities.find(sa => sa.id === soe?.subActivityId)?.activityId;
        return actId === parseInt(expFilters.activityId);
      });
    }

    return filtered;
  }, [expenses, currentAllocations, expDateRange, expFilters, allocations, soes, activities, subActivities, sectors]);

  const getSoeAllocated = (soeId: number) => allocations.filter(a => a.soeId === soeId).reduce((sum, a) => sum + a.amount, 0);
  const getAllocSpent = (allocId: number) => expenses.filter(e => e.allocationId === allocId).reduce((sum, e) => sum + e.amount, 0);

  const totalBudget = currentSoes.reduce((sum, s) => sum + s.budgetLimit, 0);
  const totalAllocated = currentAllocations.reduce((sum, a) => sum + a.amount, 0);
  const totalSpent = currentExpenses.reduce((sum, e) => sum + e.amount, 0);
  const remainingBalance = totalAllocated - totalSpent;

  const chartData = [
    { name: 'Allocated (Unspent)', value: Math.max(0, totalAllocated - totalSpent), color: '#007bff' },
    { name: 'Spent', value: totalSpent, color: '#dc3545' },
    { name: 'Unallocated', value: Math.max(0, totalBudget - totalAllocated), color: '#28a745' }
  ];

  // --- Render Functions for Tabs ---
  const renderDashboard = () => {
    const rangeStatus = ranges.map(r => {
      const rAllocs = currentAllocations.filter(a => a.rangeId === r.id);
      const rAllocTotal = rAllocs.reduce((sum, a) => sum + a.amount, 0);
      const rSpentTotal = rAllocs.reduce((sum, a) => sum + getAllocSpent(a.id), 0);
      return { 
        name: r.name, 
        allocated: rAllocTotal, 
        spent: rSpentTotal,
        remaining: rAllocTotal - rSpentTotal
      };
    });

    // Group expenses by date for trend chart
    const expensesByDate = currentExpenses.reduce((acc, exp) => {
      acc[exp.date] = (acc[exp.date] || 0) + exp.amount;
      return acc;
    }, {} as Record<string, number>);
    
    const trendData = Object.keys(expensesByDate).sort().map(date => ({
      date,
      amount: expensesByDate[date]
    }));

    const activitySummary = currentActivities.map(act => {
      const actSoes = currentSoes.filter(s => s.activityId === act.id || (s.subActivityId && subActivities.find(sa => sa.id === s.subActivityId)?.activityId === act.id));
      const totalBudgetLimit = actSoes.reduce((sum, s) => sum + s.budgetLimit, 0);
      const totalAllocated = allocations.filter(a => actSoes.some(s => s.id === a.soeId)).reduce((sum, a) => sum + a.amount, 0);
      const totalSpent = expenses.filter(e => allocations.some(a => a.id === e.allocationId && actSoes.some(s => s.id === a.soeId))).reduce((sum, e) => sum + e.amount, 0);
      
      return {
        name: act.name,
        budget: totalBudgetLimit,
        allocated: totalAllocated,
        spent: totalSpent,
        remaining: totalBudgetLimit - totalAllocated
      };
    });

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard title="Total SOE Budget" amount={totalBudget} icon={<Wallet />} color="text-blue-600" />
          <StatCard title="Total Allocated" amount={totalAllocated} icon={<Map />} color="text-indigo-600" />
          <StatCard title="Total Expenditure" amount={totalSpent} icon={<TrendingDown />} color="text-red-600" />
          <StatCard title="Remaining Balance" amount={remainingBalance} icon={<IndianRupee />} color="text-emerald-600" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-1">
            <h3 className="text-lg font-semibold mb-4 border-b pb-2">Budget Overview</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={chartData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(value: number) => `₹${value.toLocaleString()}`} />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-2">
            <h3 className="text-lg font-semibold mb-4 border-b pb-2 flex items-center gap-2">
              <Activity className="h-5 w-5 text-gray-500" /> Activity-wise Summary
            </h3>
            <div className="overflow-y-auto max-h-64">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-600">
                    <th className="p-2 border-b">Activity</th>
                    <th className="p-2 border-b text-right">Budget Limit</th>
                    <th className="p-2 border-b text-right">Allocated</th>
                    <th className="p-2 border-b text-right">Spent</th>
                  </tr>
                </thead>
                <tbody>
                  {activitySummary.map((act, idx) => (
                    <tr key={idx} className="border-b hover:bg-gray-50">
                      <td className="p-2 font-medium">{act.name}</td>
                      <td className="p-2 text-right">₹{act.budget.toLocaleString()}</td>
                      <td className="p-2 text-right text-indigo-600">₹{act.allocated.toLocaleString()}</td>
                      <td className="p-2 text-right text-red-600">₹{act.spent.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-2">
            <h3 className="text-lg font-semibold mb-4 border-b pb-2 flex items-center gap-2">
              <Activity className="h-5 w-5 text-gray-500" /> Range-wise Budget (Allocated vs Spent)
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rangeStatus} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `₹${val/1000}k`} />
                  <Tooltip formatter={(value: number) => `₹${value.toLocaleString()}`} cursor={{fill: '#f3f4f6'}} />
                  <Legend />
                  <Bar dataKey="allocated" name="Allocated" fill="#007bff" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="spent" name="Spent" fill="#dc3545" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="remaining" name="Remaining" fill="#28a745" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold mb-4 border-b pb-2 flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-gray-500" /> Expenditure Trend
            </h3>
            <div className="h-64">
              {trendData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `₹${val/1000}k`} />
                    <Tooltip formatter={(value: number) => `₹${value.toLocaleString()}`} />
                    <Line type="monotone" dataKey="amount" name="Daily Expense" stroke="#dc3545" strokeWidth={3} dot={{r: 4, fill: '#dc3545', strokeWidth: 2, stroke: '#fff'}} activeDot={{r: 6}} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400">No expenditure data available</div>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold mb-4 border-b pb-2 flex items-center gap-2">
              <FileText className="h-5 w-5 text-gray-500" /> Latest Expenditures
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-600 text-sm">
                    <th className="p-3 border-b">Date</th>
                    <th className="p-3 border-b">Range</th>
                    <th className="p-3 border-b">SOE</th>
                    <th className="p-3 border-b text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.slice().reverse().slice(0, 5).map((exp) => {
                    const alloc = allocations.find(a => a.id === exp.allocationId);
                    const range = ranges.find(r => r.id === alloc?.rangeId);
                    const soe = soes.find(s => s.id === alloc?.soeId);
                    return (
                      <tr key={exp.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="p-3">{exp.date}</td>
                        <td className="p-3 font-medium">{range?.name}</td>
                        <td className="p-3 text-gray-600">{soe?.name}</td>
                        <td className="p-3 text-right font-bold text-red-600">₹{exp.amount.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                  {expenses.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-gray-500">No expenditures yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSimpleManager = (
    title: string, 
    items: any[], 
    columns: {key: string, label: string, render?: (val: any, item: any) => React.ReactNode}[], 
    onAdd: (e: React.FormEvent) => void, 
    onDelete: (id: number) => void,
    formContent: React.ReactNode,
    onEdit: (item: any) => void
  ) => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-1 h-fit sticky top-6">
        <h3 className="text-lg font-semibold mb-4 border-b pb-2">
          {editingItem?.type === title ? `Edit ${title}` : `Add ${title}`}
        </h3>
        <form onSubmit={onAdd} className="space-y-4">
          {formContent}
          <div className="flex gap-2">
            <button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded font-medium flex items-center justify-center gap-2">
              {editingItem?.type === title ? <Activity className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {editingItem?.type === title ? 'Update' : 'Add'}
            </button>
            {editingItem?.type === title && (
              <button 
                type="button" 
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 border border-gray-300 rounded text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-2">
        <h3 className="text-lg font-semibold mb-4 border-b pb-2">Existing {title}s</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-sm">
                {columns.map(c => <th key={c.key} className="p-3 border-b">{c.label}</th>)}
                <th className="p-3 border-b text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id} className="border-b last:border-0 hover:bg-gray-50">
                  {columns.map(c => <td key={c.key} className="p-3">{c.render ? c.render(item[c.key], item) : item[c.key]}</td>)}
                  <td className="p-3 text-right flex justify-end gap-2">
                    <button 
                      onClick={() => onEdit(item)} 
                      className="text-blue-500 hover:text-blue-700 p-1"
                      title="Edit"
                    >
                      <Activity className="w-4 h-4"/>
                    </button>
                    <button 
                      onClick={() => onDelete(item.id)} 
                      className="text-red-500 hover:text-red-700 p-1"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4"/>
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={columns.length + 1} className="p-4 text-center text-gray-500">No records found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // --- Handlers ---
  const handleAddRange = (e: any) => {
    e.preventDefault();
    const name = e.target.name.value;
    if (editingItem?.type === 'Range') {
      setRanges(ranges.map(r => r.id === editingItem.item.id ? { ...r, name } : r));
      setEditingItem(null);
    } else {
      setRanges([...ranges, { id: Date.now(), name }]);
    }
    e.target.reset();
  };

  const handleAddScheme = (e: any) => {
    e.preventDefault();
    const name = e.target.name.value;
    const fyId = parseInt(e.target.fyId.value);
    if (editingItem?.type === 'Scheme') {
      setSchemes(schemes.map(s => s.id === editingItem.item.id ? { ...s, name, fyId } : s));
      setEditingItem(null);
    } else {
      setSchemes([...schemes, { id: Date.now(), name, fyId }]);
    }
    e.target.reset();
  };

  const handleAddSector = (e: any) => {
    e.preventDefault();
    const name = e.target.name.value;
    const schemeId = parseInt(e.target.schemeId.value);
    if (editingItem?.type === 'Sector') {
      setSectors(sectors.map(s => s.id === editingItem.item.id ? { ...s, name, schemeId } : s));
      setEditingItem(null);
    } else {
      setSectors([...sectors, { id: Date.now(), schemeId, name }]);
    }
    e.target.reset();
  };

  const handleAddActivity = (e: any) => {
    e.preventDefault();
    const name = e.target.name.value;
    const sectorId = e.target.sectorId?.value ? parseInt(e.target.sectorId.value) : undefined;
    const schemeId = e.target.schemeId?.value ? parseInt(e.target.schemeId.value) : undefined;

    if (!sectorId && !schemeId) {
      alert("Please select either a Sector or a Scheme");
      return;
    }

    if (editingItem?.type === 'Activity') {
      setActivities(activities.map(a => a.id === editingItem.item.id ? { ...a, name, sectorId, schemeId } : a));
      setEditingItem(null);
    } else {
      setActivities([...activities, { id: Date.now(), sectorId, schemeId, name }]);
    }
    e.target.reset();
  };

  const handleAddSubActivity = (e: any) => {
    e.preventDefault();
    const name = e.target.name.value;
    const activityId = parseInt(e.target.activityId.value);
    if (editingItem?.type === 'Sub-Activity') {
      setSubActivities(subActivities.map(sa => sa.id === editingItem.item.id ? { ...sa, name, activityId } : sa));
      setEditingItem(null);
    } else {
      setSubActivities([...subActivities, { id: Date.now(), activityId, name }]);
    }
    e.target.reset();
  };

  const handleAddSoe = (e: any) => {
    e.preventDefault();
    const name = e.target.name.value;
    const budgetLimit = parseFloat(e.target.budgetLimit.value);
    const activityId = e.target.activityId.value ? parseInt(e.target.activityId.value) : undefined;
    const subActivityId = e.target.subActivityId.value ? parseInt(e.target.subActivityId.value) : undefined;
    
    if (!activityId && !subActivityId) {
      alert("Please select either an Activity or a Sub-Activity");
      return;
    }

    if (editingItem?.type === 'SOE Head') {
      setSoes(soes.map(s => s.id === editingItem.item.id ? { ...s, name, budgetLimit, activityId, subActivityId } : s));
      setEditingItem(null);
    } else {
      setSoes([...soes, { id: Date.now(), activityId, subActivityId, name, budgetLimit }]);
    }
    e.target.reset();
  };

  const handleAddAllocation = (e: any) => {
    e.preventDefault();
    const soeId = parseInt(e.target.soeId.value);
    const rangeId = parseInt(e.target.rangeId.value);
    const amount = parseFloat(e.target.amount.value);
    
    const soe = soes.find(s => s.id === soeId);
    if (!soe) return;

    // Validation
    const currentAllocated = allocations
      .filter(a => a.soeId === soeId && (editingItem?.type === 'Allocation' ? a.id !== editingItem.item.id : true))
      .reduce((sum, a) => sum + a.amount, 0);

    if (currentAllocated + amount > soe.budgetLimit) {
      alert(`Cannot allocate. Exceeds SOE budget limit of ₹${soe.budgetLimit}. Current allocated: ₹${currentAllocated}`);
      return;
    }

    if (editingItem?.type === 'Allocation') {
      setAllocations(allocations.map(a => a.id === editingItem.item.id ? { ...a, soeId, rangeId, amount } : a));
      setEditingItem(null);
    } else {
      setAllocations([...allocations, { id: Date.now(), soeId, rangeId, amount }]);
    }
    e.target.reset();
  };

  const handleAddExpense = (e: any) => {
    e.preventDefault();
    const allocationId = parseInt(e.target.allocationId.value);
    const amount = parseFloat(e.target.amount.value);
    const date = e.target.date.value;
    const description = e.target.description.value;
    const activityId = e.target.activityId?.value ? parseInt(e.target.activityId.value) : undefined;

    const alloc = allocations.find(a => a.id === allocationId);
    if (!alloc) return;

    // Validation
    const currentSpent = expenses
      .filter(e => e.allocationId === allocationId && (editingItem?.type === 'Expenditure' ? e.id !== editingItem.item.id : true))
      .reduce((sum, e) => sum + e.amount, 0);

    if (currentSpent + amount > alloc.amount) {
      alert(`Cannot add expense. Exceeds allocated budget of ₹${alloc.amount}. Current spent: ₹${currentSpent}`);
      return;
    }

    if (editingItem?.type === 'Expenditure') {
      setExpenses(expenses.map(exp => exp.id === editingItem.item.id ? { ...exp, allocationId, amount, date, description, activityId } : exp));
      setEditingItem(null);
    } else {
      setExpenses([...expenses, { id: Date.now(), allocationId, amount, date, description, activityId }]);
    }
    e.target.reset();
  };

  // --- Main Render ---
  return (
    <div className="min-h-screen bg-gray-50 p-6 font-sans text-gray-800">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Landmark className="h-10 w-10 text-emerald-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Forest Budget Control</h1>
              <p className="text-sm text-gray-500">Financial Management System</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-sm">
              <span className="text-sm font-semibold text-gray-600">Financial Year:</span>
              <select 
                value={selectedFyId} 
                onChange={(e) => setSelectedFyId(parseInt(e.target.value))}
                className="bg-transparent border-none focus:ring-0 text-emerald-700 font-bold cursor-pointer"
              >
                {fys.map(fy => <option key={fy.id} value={fy.id}>FY {fy.name}</option>)}
              </select>
            </div>

            {isInstallable && (
              <button
                onClick={handleInstallClick}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
              >
                <Download className="w-4 h-4" />
                Install
              </button>
            )}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex flex-wrap gap-2 bg-gray-800 p-4 rounded-lg shadow-sm">
          {['Dashboard', 'Ranges', 'Schemes', 'Sectors', 'Activities', 'Sub-Activities', 'SOE Heads', 'Allocations', 'Expenditures', 'Ledger'].map((item) => (
            <button 
              key={item} 
              onClick={() => setActiveTab(item)}
              className={`px-4 py-2 text-sm font-medium rounded transition-colors ${activeTab === item ? 'bg-emerald-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
            >
              {item}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'Dashboard' && renderDashboard()}
        
        {activeTab === 'Ranges' && renderSimpleManager(
          'Range', 
          ranges, 
          [{key: 'name', label: 'Range Name'}], 
          handleAddRange, 
          (id) => setRanges(ranges.filter(r => r.id !== id)), 
          <input name="name" required defaultValue={editingItem?.type === 'Range' ? editingItem.item.name : ''} placeholder="Range Name" className="w-full p-2 border rounded" />,
          (item) => setEditingItem({ type: 'Range', item })
        )}

        {activeTab === 'Schemes' && renderSimpleManager(
          'Scheme', 
          schemes, 
          [
            {key: 'fyId', label: 'FY', render: (val) => fys.find(f => f.id === val)?.name},
            {key: 'name', label: 'Scheme Name'}
          ], 
          handleAddScheme, 
          (id) => setSchemes(schemes.filter(s => s.id !== id)), 
          <>
            <select name="fyId" required defaultValue={editingItem?.type === 'Scheme' ? editingItem.item.fyId : selectedFyId} className="w-full p-2 border rounded">
              {fys.map(fy => <option key={fy.id} value={fy.id}>FY {fy.name}</option>)}
            </select>
            <input name="name" required defaultValue={editingItem?.type === 'Scheme' ? editingItem.item.name : ''} placeholder="Scheme Name" className="w-full p-2 border rounded" />
          </>,
          (item) => setEditingItem({ type: 'Scheme', item })
        )}

        {activeTab === 'Sectors' && renderSimpleManager(
          'Sector', 
          sectors, 
          [
            {key: 'schemeId', label: 'Scheme', render: (val) => schemes.find(s => s.id === val)?.name},
            {key: 'name', label: 'Sector Name'}
          ], 
          handleAddSector, 
          (id) => setSectors(sectors.filter(s => s.id !== id)), 
          <>
            <select name="schemeId" required defaultValue={editingItem?.type === 'Sector' ? editingItem.item.schemeId : ''} className="w-full p-2 border rounded">
              <option value="">Select Scheme</option>
              {schemes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input name="name" required defaultValue={editingItem?.type === 'Sector' ? editingItem.item.name : ''} placeholder="Sector Name (e.g. CA, NPV)" className="w-full p-2 border rounded" />
          </>,
          (item) => setEditingItem({ type: 'Sector', item })
        )}

        {activeTab === 'Activities' && renderSimpleManager(
          'Activity', 
          activities, 
          [
            {key: 'parent', label: 'Scheme / Sector', render: (_, item) => {
              if (item.sectorId) {
                const sec = sectors.find(s => s.id === item.sectorId);
                const sch = schemes.find(s => s.id === sec?.schemeId);
                return `[${sch?.name}] ${sec?.name}`;
              } else {
                const sch = schemes.find(s => s.id === item.schemeId);
                return `[${sch?.name}] (Direct)`;
              }
            }},
            {key: 'name', label: 'Activity Name'}
          ], 
          handleAddActivity, 
          (id) => setActivities(activities.filter(a => a.id !== id)), 
          <ActivityFormContent 
            schemes={schemes} 
            sectors={sectors} 
            editingItem={editingItem} 
          />,
          (item) => setEditingItem({ type: 'Activity', item })
        )}

        {activeTab === 'Sub-Activities' && renderSimpleManager(
          'Sub-Activity', 
          subActivities, 
          [
            {key: 'activityId', label: 'Activity', render: (val) => {
              const act = activities.find(a => a.id === val);
              const sec = sectors.find(s => s.id === act?.sectorId);
              return `[${sec?.name}] ${act?.name}`;
            }},
            {key: 'name', label: 'Sub-Activity Name'}
          ], 
          handleAddSubActivity, 
          (id) => setSubActivities(subActivities.filter(sa => sa.id !== id)), 
          <>
            <select name="activityId" required defaultValue={editingItem?.type === 'Sub-Activity' ? editingItem.item.activityId : ''} className="w-full p-2 border rounded">
              <option value="">Select Activity</option>
              {activities.map(act => {
                const sec = sectors.find(s => s.id === act.sectorId);
                return <option key={act.id} value={act.id}>[{sec?.name}] {act.name}</option>
              })}
            </select>
            <input name="name" required defaultValue={editingItem?.type === 'Sub-Activity' ? editingItem.item.name : ''} placeholder="Sub-Activity Name" className="w-full p-2 border rounded" />
          </>,
          (item) => setEditingItem({ type: 'Sub-Activity', item })
        )}

        {activeTab === 'SOE Heads' && renderSimpleManager(
          'SOE Head', 
          soes, 
          [
            {key: 'parent', label: 'Hierarchy', render: (_, item) => {
              if (item.subActivityId) {
                const sa = subActivities.find(s => s.id === item.subActivityId);
                const act = activities.find(a => a.id === sa?.activityId);
                const sec = sectors.find(s => s.id === act?.sectorId);
                return `${sec?.name} -> ${act?.name} -> ${sa?.name}`;
              } else {
                const act = activities.find(a => a.id === item.activityId);
                const sec = sectors.find(s => s.id === act?.sectorId);
                return `${sec?.name} -> ${act?.name}`;
              }
            }},
            {key: 'name', label: 'SOE Name'},
            {key: 'budgetLimit', label: 'Budget Limit', render: (val) => `₹${val.toLocaleString()}`}
          ], 
          handleAddSoe, 
          (id) => setSoes(soes.filter(s => s.id !== id)), 
          <>
            <div className="text-xs text-gray-500 mb-1">Select either Activity OR Sub-Activity</div>
            <select name="activityId" defaultValue={editingItem?.type === 'SOE Head' ? editingItem.item.activityId : ''} className="w-full p-2 border rounded">
              <option value="">Select Activity (Optional if Sub-Activity selected)</option>
              {activities.map(a => {
                const sec = sectors.find(s => s.id === a.sectorId);
                return <option key={a.id} value={a.id}>{sec?.name} {'->'} {a.name}</option>
              })}
            </select>
            <select name="subActivityId" defaultValue={editingItem?.type === 'SOE Head' ? editingItem.item.subActivityId : ''} className="w-full p-2 border rounded">
              <option value="">Select Sub-Activity (Optional if Activity selected)</option>
              {subActivities.map(sa => {
                const act = activities.find(a => a.id === sa.activityId);
                const sec = sectors.find(s => s.id === act?.sectorId);
                return <option key={sa.id} value={sa.id}>{sec?.name} {'->'} {act?.name} {'->'} {sa.name}</option>
              })}
            </select>
            <input name="name" required defaultValue={editingItem?.type === 'SOE Head' ? editingItem.item.name : ''} placeholder="SOE Name (e.g. 20 OC)" className="w-full p-2 border rounded" />
            <input name="budgetLimit" type="number" required defaultValue={editingItem?.type === 'SOE Head' ? editingItem.item.budgetLimit : ''} placeholder="Budget Limit (₹)" className="w-full p-2 border rounded" />
          </>,
          (item) => setEditingItem({ type: 'SOE Head', item })
        )}

        {activeTab === 'Allocations' && renderSimpleManager(
          'Allocation', 
          allocations, 
          [
            {key: 'soeId', label: 'FY -> SOE', render: (val) => {
              const s = soes.find(s => s.id === val);
              let hierarchy = '';
              if (s?.subActivityId) {
                const sa = subActivities.find(sa => sa.id === s.subActivityId);
                const act = activities.find(a => a.id === sa?.activityId);
                const sec = sectors.find(sec => sec.id === act?.sectorId);
                const sch = schemes.find(sc => sc.id === (sec ? sec.schemeId : act?.schemeId));
                hierarchy = `${sch?.name} -> ${sec ? sec.name + ' -> ' : ''}${act?.name} -> ${sa?.name}`;
              } else if (s?.activityId) {
                const act = activities.find(a => a.id === s.activityId);
                const sec = sectors.find(sec => sec.id === act?.sectorId);
                const sch = schemes.find(sc => sc.id === (sec ? sec.schemeId : act?.schemeId));
                hierarchy = `${sch?.name} -> ${sec ? sec.name + ' -> ' : ''}${act?.name}`;
              }
              return `[${hierarchy}] ${s?.name}`;
            }},
            {key: 'rangeId', label: 'Range', render: (val) => ranges.find(r => r.id === val)?.name},
            {key: 'amount', label: 'Allocated Amount', render: (val, item) => {
              const soe = soes.find(s => s.id === item.soeId);
              const totalAllocatedForSoe = getSoeAllocated(item.soeId);
              const remaining = (soe?.budgetLimit || 0) - totalAllocatedForSoe;
              
              // Find other allocations for the same range and same parent (activity/subactivity)
              const parentId = soe?.subActivityId || soe?.activityId;
              const isSub = !!soe?.subActivityId;
              
              const relatedAllocs = allocations.filter(a => {
                const aSoe = soes.find(s => s.id === a.soeId);
                const aParentId = aSoe?.subActivityId || aSoe?.activityId;
                const aIsSub = !!aSoe?.subActivityId;
                return a.rangeId === item.rangeId && aParentId === parentId && aIsSub === isSub;
              });
              
              const totalForParentRange = relatedAllocs.reduce((sum, a) => sum + a.amount, 0);
              const breakdown = relatedAllocs.map(a => {
                const aSoe = soes.find(s => s.id === a.soeId);
                return `${aSoe?.name} ${a.amount}`;
              }).join(', ');

              return (
                <div className="space-y-1">
                  <div className="text-emerald-600 font-bold">₹{val.toLocaleString()}</div>
                  <div className="text-[10px] text-gray-400 bg-gray-50 p-1 rounded">
                    <div className="font-semibold text-gray-600">Range Summary:</div>
                    <div>{breakdown}</div>
                    <div className="border-t mt-1 pt-1 font-bold">Total: ₹{totalForParentRange.toLocaleString()}</div>
                  </div>
                  <div className="text-[10px] text-blue-400">SOE Remaining: ₹{remaining.toLocaleString()}</div>
                </div>
              );
            }}
          ], 
          handleAddAllocation, 
          (id) => setAllocations(allocations.filter(a => a.id !== id)), 
          <>
            <select name="soeId" required defaultValue={editingItem?.type === 'Allocation' ? editingItem.item.soeId : ''} className="w-full p-2 border rounded">
              <option value="">Select SOE</option>
              {soes.map(s => {
                let hierarchy = '';
                if (s.subActivityId) {
                  const sa = subActivities.find(sa => sa.id === s.subActivityId);
                  const act = activities.find(a => a.id === sa?.activityId);
                  const sec = sectors.find(sec => sec.id === act?.sectorId);
                  const sch = schemes.find(sc => sc.id === (sec ? sec.schemeId : act?.schemeId));
                  hierarchy = `${sch?.name} -> ${sec ? sec.name + ' -> ' : ''}${act?.name} -> ${sa?.name}`;
                } else if (s.activityId) {
                  const act = activities.find(a => a.id === s.activityId);
                  const sec = sectors.find(sec => sec.id === act?.sectorId);
                  const sch = schemes.find(sc => sc.id === (sec ? sec.schemeId : act?.schemeId));
                  hierarchy = `${sch?.name} -> ${sec ? sec.name + ' -> ' : ''}${act?.name}`;
                }
                const avail = s.budgetLimit - getSoeAllocated(s.id) + (editingItem?.type === 'Allocation' && editingItem.item.soeId === s.id ? editingItem.item.amount : 0);
                return <option key={s.id} value={s.id}>[{hierarchy}] {s.name} (Avail: ₹{avail})</option>
              })}
            </select>
            <select name="rangeId" required defaultValue={editingItem?.type === 'Allocation' ? editingItem.item.rangeId : ''} className="w-full p-2 border rounded">
              <option value="">Select Range</option>
              {ranges.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <input name="amount" type="number" required defaultValue={editingItem?.type === 'Allocation' ? editingItem.item.amount : ''} placeholder="Amount (₹)" className="w-full p-2 border rounded" />
          </>,
          (item) => setEditingItem({ type: 'Allocation', item })
        )}

        {activeTab === 'Expenditures' && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-4">
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Start Date</label>
                  <input 
                    type="date" 
                    value={expDateRange.start} 
                    onChange={(e) => setExpDateRange(prev => ({ ...prev, start: e.target.value }))}
                    className="p-2 border rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">End Date</label>
                  <input 
                    type="date" 
                    value={expDateRange.end} 
                    onChange={(e) => setExpDateRange(prev => ({ ...prev, end: e.target.value }))}
                    className="p-2 border rounded text-sm"
                  />
                </div>
                <button 
                  onClick={() => {
                    setExpDateRange({ start: '', end: '' });
                    setExpFilters({ schemeId: '', sectorId: '', activityId: '' });
                  }}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border rounded bg-gray-50"
                >
                  Clear All Filters
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Filter by Scheme</label>
                  <select 
                    value={expFilters.schemeId} 
                    onChange={(e) => setExpFilters(prev => ({ ...prev, schemeId: e.target.value, sectorId: '', activityId: '' }))}
                    className="w-full p-2 border rounded text-sm"
                  >
                    <option value="">All Schemes</option>
                    {schemes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Filter by Sector</label>
                  <select 
                    value={expFilters.sectorId} 
                    disabled={!expFilters.schemeId}
                    onChange={(e) => setExpFilters(prev => ({ ...prev, sectorId: e.target.value, activityId: '' }))}
                    className="w-full p-2 border rounded text-sm disabled:bg-gray-50"
                  >
                    <option value="">All Sectors</option>
                    {sectors.filter(s => s.schemeId === parseInt(expFilters.schemeId)).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Filter by Activity</label>
                  <select 
                    value={expFilters.activityId} 
                    disabled={!expFilters.schemeId}
                    onChange={(e) => setExpFilters(prev => ({ ...prev, activityId: e.target.value }))}
                    className="w-full p-2 border rounded text-sm disabled:bg-gray-50"
                  >
                    <option value="">All Activities</option>
                    {activities.filter(a => {
                      if (expFilters.sectorId) return a.sectorId === parseInt(expFilters.sectorId);
                      if (expFilters.schemeId) return a.schemeId === parseInt(expFilters.schemeId);
                      return true;
                    }).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
            {renderSimpleManager(
              'Expenditure', 
              currentExpenses, 
              [
                {key: 'date', label: 'Date'},
                {key: 'allocationId', label: 'Hierarchy / Range / SOE', render: (val, item) => {
                  const al = allocations.find(a => a.id === val);
                  const r = ranges.find(r => r.id === al?.rangeId);
                  const s = soes.find(s => s.id === al?.soeId);
                  let hierarchy = '';
                  if (s?.subActivityId) {
                    const sa = subActivities.find(sa => sa.id === s.subActivityId);
                    const act = activities.find(a => a.id === sa?.activityId);
                    const sec = sectors.find(sec => sec.id === act?.sectorId);
                    const sch = schemes.find(sc => sc.id === (sec ? sec.schemeId : act?.schemeId));
                    hierarchy = `${sch?.name} -> ${sec ? sec.name + ' -> ' : ''}${act?.name} -> ${sa?.name}`;
                  } else if (s?.activityId) {
                    const act = activities.find(a => a.id === s.activityId);
                    const sec = sectors.find(sec => sec.id === act?.sectorId);
                    const sch = schemes.find(sc => sc.id === (sec ? sec.schemeId : act?.schemeId));
                    hierarchy = `${sch?.name} -> ${sec ? sec.name + ' -> ' : ''}${act?.name}`;
                  }
                  return (
                    <div>
                      <div className="text-xs text-gray-500">{hierarchy}</div>
                      <div className="font-medium">{r?.name} / {s?.name}</div>
                      {item.activityId && (
                        <div className="text-[10px] bg-blue-50 text-blue-600 px-1 rounded inline-block mt-1">
                          Activity: {activities.find(a => a.id === item.activityId)?.name}
                        </div>
                      )}
                    </div>
                  );
                }},
                {key: 'description', label: 'Description'},
                {key: 'amount', label: 'Amount', render: (val) => <span className="text-red-600 font-bold">₹{val.toLocaleString()}</span>}
              ], 
              handleAddExpense, 
              (id) => setExpenses(expenses.filter(e => e.id !== id)), 
              <>
                <select name="allocationId" required defaultValue={editingItem?.type === 'Expenditure' ? editingItem.item.allocationId : ''} className="w-full p-2 border rounded">
                  <option value="">Select Allocation</option>
                  {allocations.map(a => {
                    const r = ranges.find(r => r.id === a.rangeId);
                    const s = soes.find(s => s.id === a.soeId);
                    const avail = a.amount - getAllocSpent(a.id) + (editingItem?.type === 'Expenditure' && editingItem.item.allocationId === a.id ? editingItem.item.amount : 0);
                    return <option key={a.id} value={a.id}>{r?.name} - {s?.name} (Avail: ₹{avail})</option>
                  })}
                </select>
                <select name="activityId" defaultValue={editingItem?.type === 'Expenditure' ? editingItem.item.activityId : ''} className="w-full p-2 border rounded">
                  <option value="">Select Activity (Optional)</option>
                  {activities.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <input name="amount" type="number" required defaultValue={editingItem?.type === 'Expenditure' ? editingItem.item.amount : ''} placeholder="Amount (₹)" className="w-full p-2 border rounded" />
                <input name="date" type="date" required defaultValue={editingItem?.type === 'Expenditure' ? editingItem.item.date : new Date().toISOString().split('T')[0]} className="w-full p-2 border rounded" />
                <textarea name="description" required defaultValue={editingItem?.type === 'Expenditure' ? editingItem.item.description : ''} placeholder="Description / Remarks" className="w-full p-2 border rounded" rows={2} />
              </>,
              (item) => setEditingItem({ type: 'Expenditure', item })
            )}
          </div>
        )}

        {activeTab === 'Ledger' && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4 border-b pb-2">
              <h3 className="text-lg font-semibold">Passbook Ledger</h3>
              <span className="text-sm font-medium text-emerald-600">FY {fys.find(f => f.id === selectedFyId)?.name}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-600 text-sm">
                    <th className="p-3 border-b">Date</th>
                    <th className="p-3 border-b">Range</th>
                    <th className="p-3 border-b">SOE</th>
                    <th className="p-3 border-b">Description</th>
                    <th className="p-3 border-b text-right">Credit (Allocated)</th>
                    <th className="p-3 border-b text-right">Debit (Expense)</th>
                    <th className="p-3 border-b text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {currentAllocations.map(alloc => {
                    const r = ranges.find(r => r.id === alloc.rangeId);
                    const s = soes.find(s => s.id === alloc.soeId);
                    const allocExpenses = expenses.filter(e => e.allocationId === alloc.id).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                    
                    let currentBalance = alloc.amount;
                    
                    return (
                      <React.Fragment key={`alloc-${alloc.id}`}>
                        {/* Initial Allocation Row */}
                        <tr className="bg-blue-50/30 border-b">
                          <td className="p-3 text-gray-400">-</td>
                          <td className="p-3 font-medium">{r?.name}</td>
                          <td className="p-3 font-medium">{s?.name}</td>
                          <td className="p-3 italic text-gray-600">Initial Allocation</td>
                          <td className="p-3 text-right text-emerald-600 font-bold">₹{alloc.amount.toLocaleString()}</td>
                          <td className="p-3 text-right">-</td>
                          <td className="p-3 text-right text-blue-600 font-bold">₹{currentBalance.toLocaleString()}</td>
                        </tr>
                        {/* Expense Rows */}
                        {allocExpenses.map(exp => {
                          currentBalance -= exp.amount;
                          return (
                            <tr key={`exp-${exp.id}`} className="border-b hover:bg-gray-50">
                              <td className="p-3">{exp.date}</td>
                              <td className="p-3">{r?.name}</td>
                              <td className="p-3">{s?.name}</td>
                              <td className="p-3">{exp.description}</td>
                              <td className="p-3 text-right">-</td>
                              <td className="p-3 text-right text-red-600">₹{exp.amount.toLocaleString()}</td>
                              <td className="p-3 text-right text-blue-600 font-bold">₹{currentBalance.toLocaleString()}</td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                  {currentAllocations.length === 0 && <tr><td colSpan={7} className="p-4 text-center text-gray-500">No allocations found for this Financial Year.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function ActivityFormContent({ schemes, sectors, editingItem }: { schemes: any[], sectors: any[], editingItem: any }) {
  const [selectedSchemeId, setSelectedSchemeId] = useState(editingItem?.item?.schemeId || editingItem?.item?.sectorId ? sectors.find((s: any) => s.id === editingItem.item.sectorId)?.schemeId : '');
  
  const selectedScheme = schemes.find(s => s.id === parseInt(selectedSchemeId as string));
  const isCampa = selectedScheme?.name.toUpperCase().includes('CAMPA');

  return (
    <>
      <select 
        name="schemeId" 
        required 
        value={selectedSchemeId}
        onChange={(e) => setSelectedSchemeId(e.target.value)}
        className="w-full p-2 border rounded"
      >
        <option value="">Select Scheme</option>
        {schemes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      
      {isCampa && (
        <select name="sectorId" required defaultValue={editingItem?.item?.sectorId || ''} className="w-full p-2 border rounded">
          <option value="">Select Sector</option>
          {sectors.filter(s => s.schemeId === parseInt(selectedSchemeId as string)).map(sec => (
            <option key={sec.id} value={sec.id}>{sec.name}</option>
          ))}
        </select>
      )}
      
      <input name="name" required defaultValue={editingItem?.type === 'Activity' ? editingItem.item.name : ''} placeholder="Activity Name" className="w-full p-2 border rounded" />
    </>
  );
}

function StatCard({ title, amount, icon, color }: { title: string, amount: number, icon: React.ReactNode, color: string }) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
      <div className={`p-4 rounded-full bg-gray-50 ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-gray-500 font-medium">{title}</p>
        <p className={`text-2xl font-bold ${color}`}>₹{amount.toLocaleString()}</p>
      </div>
    </div>
  );
}
