import React, { useState, useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from 'recharts';
import { IndianRupee, Wallet, TrendingDown, Landmark, Activity, FileText, Map, Plus, Trash2 } from 'lucide-react';

// --- Types ---
type Range = { id: number; name: string };
type Scheme = { id: number; name: string };
type ActivityItem = { id: number; schemeId: number; name: string };
type SOE = { id: number; activityId: number; name: string; budgetLimit: number };
type Allocation = { id: number; soeId: number; rangeId: number; amount: number };
type Expense = { id: number; allocationId: number; amount: number; date: string; description: string };

// --- Initial Mock Data ---
const initialRanges: Range[] = [{ id: 1, name: 'Rajgarh' }, { id: 2, name: 'Habban' }];
const initialSchemes: Scheme[] = [{ id: 1, name: 'CA (Compensatory Afforestation)' }];
const initialActivities: ActivityItem[] = [{ id: 1, schemeId: 1, name: 'Plantation' }];
const initialSoes: SOE[] = [
  { id: 1, activityId: 1, name: '20 OC', budgetLimit: 50000 },
  { id: 2, activityId: 1, name: '36 MW', budgetLimit: 150000 }
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
  const [ranges, setRanges] = useState<Range[]>(initialRanges);
  const [schemes, setSchemes] = useState<Scheme[]>(initialSchemes);
  const [activities, setActivities] = useState<ActivityItem[]>(initialActivities);
  const [soes, setSoes] = useState<SOE[]>(initialSoes);
  const [allocations, setAllocations] = useState<Allocation[]>(initialAllocations);
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);

  // --- Derived Data / Helpers ---
  const getSoeAllocated = (soeId: number) => allocations.filter(a => a.soeId === soeId).reduce((sum, a) => sum + a.amount, 0);
  const getAllocSpent = (allocId: number) => expenses.filter(e => e.allocationId === allocId).reduce((sum, e) => sum + e.amount, 0);

  const totalBudget = soes.reduce((sum, s) => sum + s.budgetLimit, 0);
  const totalAllocated = allocations.reduce((sum, a) => sum + a.amount, 0);
  const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
  const remainingBalance = totalAllocated - totalSpent;

  const chartData = [
    { name: 'Allocated (Unspent)', value: totalAllocated - totalSpent, color: '#007bff' },
    { name: 'Spent', value: totalSpent, color: '#dc3545' },
    { name: 'Unallocated', value: totalBudget - totalAllocated, color: '#28a745' }
  ];

  // --- Render Functions for Tabs ---
  const renderDashboard = () => {
    const rangeStatus = ranges.map(r => {
      const rAllocs = allocations.filter(a => a.rangeId === r.id);
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
    const expensesByDate = expenses.reduce((acc, exp) => {
      acc[exp.date] = (acc[exp.date] || 0) + exp.amount;
      return acc;
    }, {} as Record<string, number>);
    
    const trendData = Object.keys(expensesByDate).sort().map(date => ({
      date,
      amount: expensesByDate[date]
    }));

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
    formContent: React.ReactNode
  ) => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-1 h-fit">
        <h3 className="text-lg font-semibold mb-4 border-b pb-2">Add {title}</h3>
        <form onSubmit={onAdd} className="space-y-4">
          {formContent}
          <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded font-medium flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" /> Add
          </button>
        </form>
      </div>
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-2">
        <h3 className="text-lg font-semibold mb-4 border-b pb-2">Existing {title}s</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-sm">
                {columns.map(c => <th key={c.key} className="p-3 border-b">{c.label}</th>)}
                <th className="p-3 border-b text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id} className="border-b last:border-0 hover:bg-gray-50">
                  {columns.map(c => <td key={c.key} className="p-3">{c.render ? c.render(item[c.key], item) : item[c.key]}</td>)}
                  <td className="p-3 text-right">
                    <button onClick={() => onDelete(item.id)} className="text-red-500 hover:text-red-700 p-1"><Trash2 className="w-4 h-4"/></button>
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
    setRanges([...ranges, { id: Date.now(), name }]);
    e.target.reset();
  };

  const handleAddScheme = (e: any) => {
    e.preventDefault();
    const name = e.target.name.value;
    setSchemes([...schemes, { id: Date.now(), name }]);
    e.target.reset();
  };

  const handleAddActivity = (e: any) => {
    e.preventDefault();
    const name = e.target.name.value;
    const schemeId = parseInt(e.target.schemeId.value);
    setActivities([...activities, { id: Date.now(), schemeId, name }]);
    e.target.reset();
  };

  const handleAddSoe = (e: any) => {
    e.preventDefault();
    const name = e.target.name.value;
    const budgetLimit = parseFloat(e.target.budgetLimit.value);
    const activityId = parseInt(e.target.activityId.value);
    setSoes([...soes, { id: Date.now(), activityId, name, budgetLimit }]);
    e.target.reset();
  };

  const handleAddAllocation = (e: any) => {
    e.preventDefault();
    const soeId = parseInt(e.target.soeId.value);
    const rangeId = parseInt(e.target.rangeId.value);
    const amount = parseFloat(e.target.amount.value);
    
    const soe = soes.find(s => s.id === soeId);
    if (!soe) return;
    if (getSoeAllocated(soeId) + amount > soe.budgetLimit) {
      alert(`Cannot allocate. Exceeds SOE budget limit of ₹${soe.budgetLimit}.`);
      return;
    }
    setAllocations([...allocations, { id: Date.now(), soeId, rangeId, amount }]);
    e.target.reset();
  };

  const handleAddExpense = (e: any) => {
    e.preventDefault();
    const allocationId = parseInt(e.target.allocationId.value);
    const amount = parseFloat(e.target.amount.value);
    const date = e.target.date.value;
    const description = e.target.description.value;

    const alloc = allocations.find(a => a.id === allocationId);
    if (!alloc) return;
    if (getAllocSpent(allocationId) + amount > alloc.amount) {
      alert(`Cannot add expense. Exceeds allocated budget of ₹${alloc.amount}.`);
      return;
    }
    setExpenses([...expenses, { id: Date.now(), allocationId, amount, date, description }]);
    e.target.reset();
  };

  // --- Main Render ---
  return (
    <div className="min-h-screen bg-gray-50 p-6 font-sans text-gray-800">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Landmark className="h-8 w-8 text-emerald-600" />
            Forest Division Budget Portal
          </h1>
        </div>

        {/* Navigation */}
        <div className="flex flex-wrap gap-2 bg-gray-800 p-4 rounded-lg shadow-sm">
          {['Dashboard', 'Ranges', 'Schemes', 'Activities', 'SOE Heads', 'Allocations', 'Expenditures', 'Ledger'].map((item) => (
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
        
        {activeTab === 'Ranges' && renderSimpleManager('Range', ranges, [{key: 'name', label: 'Range Name'}], handleAddRange, (id) => setRanges(ranges.filter(r => r.id !== id)), 
          <input name="name" required placeholder="Range Name" className="w-full p-2 border rounded" />
        )}

        {activeTab === 'Schemes' && renderSimpleManager('Scheme', schemes, [{key: 'name', label: 'Scheme Name'}], handleAddScheme, (id) => setSchemes(schemes.filter(s => s.id !== id)), 
          <input name="name" required placeholder="Scheme Name" className="w-full p-2 border rounded" />
        )}

        {activeTab === 'Activities' && renderSimpleManager('Activity', activities, [
            {key: 'schemeId', label: 'Scheme', render: (val) => schemes.find(s => s.id === val)?.name},
            {key: 'name', label: 'Activity Name'}
          ], handleAddActivity, (id) => setActivities(activities.filter(a => a.id !== id)), 
          <>
            <select name="schemeId" required className="w-full p-2 border rounded">
              <option value="">Select Scheme</option>
              {schemes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input name="name" required placeholder="Activity Name" className="w-full p-2 border rounded" />
          </>
        )}

        {activeTab === 'SOE Heads' && renderSimpleManager('SOE Head', soes, [
            {key: 'activityId', label: 'Scheme -> Activity', render: (val) => {
              const act = activities.find(a => a.id === val);
              const sch = schemes.find(s => s.id === act?.schemeId);
              return `${sch?.name} -> ${act?.name}`;
            }},
            {key: 'name', label: 'SOE Name'},
            {key: 'budgetLimit', label: 'Budget Limit', render: (val) => `₹${val.toLocaleString()}`}
          ], handleAddSoe, (id) => setSoes(soes.filter(s => s.id !== id)), 
          <>
            <select name="activityId" required className="w-full p-2 border rounded">
              <option value="">Select Activity</option>
              {activities.map(a => {
                const sch = schemes.find(s => s.id === a.schemeId);
                return <option key={a.id} value={a.id}>{sch?.name} {'->'} {a.name}</option>
              })}
            </select>
            <input name="name" required placeholder="SOE Name (e.g. 20 OC)" className="w-full p-2 border rounded" />
            <input name="budgetLimit" type="number" required placeholder="Budget Limit (₹)" className="w-full p-2 border rounded" />
          </>
        )}

        {activeTab === 'Allocations' && renderSimpleManager('Allocation', allocations, [
            {key: 'soeId', label: 'SOE', render: (val) => soes.find(s => s.id === val)?.name},
            {key: 'rangeId', label: 'Range', render: (val) => ranges.find(r => r.id === val)?.name},
            {key: 'amount', label: 'Allocated Amount', render: (val) => <span className="text-emerald-600 font-bold">₹{val.toLocaleString()}</span>}
          ], handleAddAllocation, (id) => setAllocations(allocations.filter(a => a.id !== id)), 
          <>
            <select name="soeId" required className="w-full p-2 border rounded">
              <option value="">Select SOE</option>
              {soes.map(s => {
                const act = activities.find(a => a.id === s.activityId);
                const sch = schemes.find(sc => sc.id === act?.schemeId);
                const avail = s.budgetLimit - getSoeAllocated(s.id);
                return <option key={s.id} value={s.id}>{sch?.name} {'->'} {act?.name} {'->'} {s.name} (Avail: ₹{avail})</option>
              })}
            </select>
            <select name="rangeId" required className="w-full p-2 border rounded">
              <option value="">Select Range</option>
              {ranges.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <input name="amount" type="number" required placeholder="Amount (₹)" className="w-full p-2 border rounded" />
          </>
        )}

        {activeTab === 'Expenditures' && renderSimpleManager('Expenditure', expenses, [
            {key: 'date', label: 'Date'},
            {key: 'allocationId', label: 'Range / SOE', render: (val) => {
              const al = allocations.find(a => a.id === val);
              const r = ranges.find(r => r.id === al?.rangeId);
              const s = soes.find(s => s.id === al?.soeId);
              return `${r?.name} / ${s?.name}`;
            }},
            {key: 'description', label: 'Description'},
            {key: 'amount', label: 'Amount', render: (val) => <span className="text-red-600 font-bold">₹{val.toLocaleString()}</span>}
          ], handleAddExpense, (id) => setExpenses(expenses.filter(e => e.id !== id)), 
          <>
            <select name="allocationId" required className="w-full p-2 border rounded">
              <option value="">Select Allocation</option>
              {allocations.map(a => {
                const r = ranges.find(r => r.id === a.rangeId);
                const s = soes.find(s => s.id === a.soeId);
                const avail = a.amount - getAllocSpent(a.id);
                return <option key={a.id} value={a.id}>{r?.name} - {s?.name} (Avail: ₹{avail})</option>
              })}
            </select>
            <input name="amount" type="number" required placeholder="Amount (₹)" className="w-full p-2 border rounded" />
            <input name="date" type="date" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full p-2 border rounded" />
            <textarea name="description" required placeholder="Description / Remarks" className="w-full p-2 border rounded" rows={2} />
          </>
        )}

        {activeTab === 'Ledger' && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold mb-4 border-b pb-2">Passbook Ledger</h3>
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
                  {allocations.map(alloc => {
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
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
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
