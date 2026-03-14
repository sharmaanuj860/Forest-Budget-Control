import React, { useState, useMemo, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from 'recharts';
import { IndianRupee, Wallet, TrendingDown, Landmark, Activity, FileText, Map, Plus, Trash2, Download, LogOut, User, Shield, FileBarChart, Filter, Search } from 'lucide-react';
import { 
  auth, db, signInWithPopup, googleProvider, signOut, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail,
  collection, doc, setDoc, getDoc, getDocs, onSnapshot, query, where, orderBy, addDoc, updateDoc, deleteDoc, getDocFromServer
} from './firebase';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { preloadDatabase } from './preloadData';

// --- Types ---
type FinancialYear = { id: string; name: string };
type Range = { id: string; name: string };
type Scheme = { id: string; name: string; fyId: string };
type Sector = { id: string; schemeId: string; name: string };
type ActivityItem = { id: string; sectorId?: string; schemeId?: string; name: string };
type SubActivity = { id: string; activityId: string; name: string };
type SOE = { id: string; activityId?: string; subActivityId?: string; name: string; budgetLimit: number };
type Allocation = { id: string; soeId: string; rangeId: string; amount: number };
type Expense = { id: string; allocationId: string; amount: number; date: string; description: string; activityId?: string };
type AppUser = { id: string; email: string; role: 'admin' | 'deo' };

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email || undefined,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId || undefined,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function App() {
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<'admin' | 'deo' | null>(null);
  const [loading, setLoading] = useState(true);

  // --- State ---
  const [fys, setFys] = useState<FinancialYear[]>([]);
  const [selectedFyId, setSelectedFyId] = useState<string>('');
  const [ranges, setRanges] = useState<Range[]>([]);
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [subActivities, setSubActivities] = useState<SubActivity[]>([]);
  const [soes, setSoes] = useState<SOE[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);

  // --- Filters ---
  const [expDateRange, setExpDateRange] = useState({ start: '', end: '' });
  const [expFilters, setExpFilters] = useState({ schemeId: '', sectorId: '', activityId: '' });
  const [allocFilters, setAllocFilters] = useState({ schemeId: '', activityId: '', rangeId: '' });

  // --- Editing State ---
  const [editingItem, setEditingItem] = useState<{ type: string; item: any } | null>(null);

  // --- Auth & Role Check ---
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
        }
      }
    }
    testConnection();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const email = currentUser.email?.toLowerCase();
        
        // Hardcode roles for specific emails to bypass DB requirement
        if (email === 'admin@rajgarhforest.app' || email === 'sharmaanuj860@gmail.com') {
           setUserRole('admin');
           // Try to save it, ignore if fails
           setDoc(doc(db, 'users', currentUser.uid), { email: currentUser.email, role: 'admin' }, { merge: true }).catch(() => {});
           setLoading(false);
           return;
        } else if (email === 'da123@rajgarhforest.app') {
           setUserRole('deo');
           setDoc(doc(db, 'users', currentUser.uid), { email: currentUser.email, role: 'deo' }, { merge: true }).catch(() => {});
           setLoading(false);
           return;
        }

        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            setUserRole(userDoc.data().role);
          } else {
            // If first user ever, make admin, else wait for admin to assign role
            try {
              const usersSnap = await getDocs(collection(db, 'users'));
              if (usersSnap.empty) {
                const newRole = 'admin';
                await setDoc(doc(db, 'users', currentUser.uid), {
                  email: currentUser.email,
                  role: newRole
                });
                setUserRole(newRole);
              } else {
                setUserRole(null);
              }
            } catch (e) {
               setUserRole(null);
            }
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, 'users');
        }
      } else {
        setUserRole(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- Real-time Data Sync ---
  useEffect(() => {
    if (!user || !userRole) return;

    const unsubFys = onSnapshot(collection(db, 'financialYears'), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as FinancialYear));
      setFys(data);
      if (data.length > 0 && !selectedFyId) setSelectedFyId(data[0].id);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'financialYears'));

    const unsubRanges = onSnapshot(collection(db, 'ranges'), (snap) => {
      setRanges(snap.docs.map(d => ({ id: d.id, ...d.data() } as Range)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'ranges'));

    const unsubSchemes = onSnapshot(collection(db, 'schemes'), (snap) => {
      setSchemes(snap.docs.map(d => ({ id: d.id, ...d.data() } as Scheme)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'schemes'));

    const unsubSectors = onSnapshot(collection(db, 'sectors'), (snap) => {
      setSectors(snap.docs.map(d => ({ id: d.id, ...d.data() } as Sector)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'sectors'));

    const unsubActivities = onSnapshot(collection(db, 'activities'), (snap) => {
      setActivities(snap.docs.map(d => ({ id: d.id, ...d.data() } as ActivityItem)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'activities'));

    const unsubSubActivities = onSnapshot(collection(db, 'subActivities'), (snap) => {
      setSubActivities(snap.docs.map(d => ({ id: d.id, ...d.data() } as SubActivity)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'subActivities'));

    const unsubSoes = onSnapshot(collection(db, 'soeHeads'), (snap) => {
      setSoes(snap.docs.map(d => ({ id: d.id, ...d.data() } as SOE)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'soeHeads'));

    const unsubAllocations = onSnapshot(collection(db, 'allocations'), (snap) => {
      setAllocations(snap.docs.map(d => ({ id: d.id, ...d.data() } as Allocation)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'allocations'));

    const unsubExpenses = onSnapshot(collection(db, 'expenditures'), (snap) => {
      setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Expense)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'expenditures'));

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as AppUser)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));

    return () => {
      unsubFys(); unsubRanges(); unsubSchemes(); unsubSectors(); unsubActivities();
      unsubSubActivities(); unsubSoes(); unsubAllocations(); unsubExpenses(); unsubUsers();
    };
  }, [user, userRole]);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoginError('');
    try {
      let emailToUse = loginEmail;
      if (!emailToUse.includes('@')) {
        emailToUse = `${emailToUse}@rajgarhforest.app`;
      }
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, emailToUse, loginPassword);
      } else {
        await signInWithEmailAndPassword(auth, emailToUse, loginPassword);
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      if (error.code === 'auth/operation-not-allowed') {
        setLoginError('Email/Password authentication is not enabled in your Firebase project. Please go to the Firebase Console -> Authentication -> Sign-in method, and enable "Email/Password".');
      } else if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        setLoginError('User not found or invalid credentials. If this is a new account, please click "Sign Up" below.');
      } else {
        setLoginError(error.message || 'Authentication failed. Please check your credentials.');
      }
    }
  };

  const handleForgotPassword = async () => {
    if (!loginEmail) {
      setLoginError('Please enter your ID/Email first to reset password.');
      return;
    }
    try {
      let emailToUse = loginEmail;
      if (!emailToUse.includes('@')) {
        emailToUse = `${emailToUse}@rajgarhforest.app`;
      }
      await sendPasswordResetEmail(auth, emailToUse);
      alert('Password reset email sent! Check your inbox (or contact admin if using a dummy ID).');
    } catch (error: any) {
      console.error('Reset error:', error);
      setLoginError(error.message || 'Failed to send reset email.');
    }
  };

  const handleLogout = () => signOut(auth);

  // --- Derived Data / Helpers ---
  const currentSchemes = useMemo(() => schemes.filter(s => s.fyId === selectedFyId), [schemes, selectedFyId]);
  const currentSectors = useMemo(() => sectors.filter(sec => currentSchemes.some(s => s.id === sec.schemeId)), [sectors, currentSchemes]);
  const currentActivities = useMemo(() => activities.filter(a => {
    if (a.sectorId) return currentSectors.some(sec => sec.id === a.sectorId);
    if (a.schemeId) return currentSchemes.some(s => s.id === a.schemeId);
    return false;
  }), [activities, currentSectors, currentSchemes]);
  const currentSubActivities = useMemo(() => subActivities.filter(sa => currentActivities.some(a => a.id === sa.activityId)), [subActivities, currentActivities]);
  const currentSoes = useMemo(() => soes.filter(s => 
    (s.activityId && currentActivities.some(a => a.id === s.activityId)) || 
    (s.subActivityId && currentSubActivities.some(sa => sa.id === s.subActivityId))
  ), [soes, currentActivities, currentSubActivities]);
  
  const currentAllocations = useMemo(() => {
    let filtered = allocations.filter(a => currentSoes.some(s => s.id === a.soeId));
    if (allocFilters.schemeId) {
      filtered = filtered.filter(a => {
        const soe = soes.find(s => s.id === a.soeId);
        const act = activities.find(act => act.id === soe?.activityId || act.id === subActivities.find(sa => sa.id === soe?.subActivityId)?.activityId);
        const sec = sectors.find(s => s.id === act?.sectorId);
        const schId = sec ? sec.schemeId : act?.schemeId;
        return schId === allocFilters.schemeId;
      });
    }
    if (allocFilters.activityId) {
      filtered = filtered.filter(a => {
        const soe = soes.find(s => s.id === a.soeId);
        const actId = soe?.activityId || subActivities.find(sa => sa.id === soe?.subActivityId)?.activityId;
        return actId === allocFilters.activityId;
      });
    }
    if (allocFilters.rangeId) {
      filtered = filtered.filter(a => a.rangeId === allocFilters.rangeId);
    }
    return filtered;
  }, [allocations, currentSoes, allocFilters, soes, activities, subActivities, sectors]);
  
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
        return schId === expFilters.schemeId;
      });
    }
    
    if (expFilters.sectorId) {
      filtered = filtered.filter(e => {
        const alloc = allocations.find(a => a.id === e.allocationId);
        const soe = soes.find(s => s.id === alloc?.soeId);
        const act = activities.find(a => a.id === soe?.activityId || a.id === subActivities.find(sa => sa.id === soe?.subActivityId)?.activityId);
        return act?.sectorId === expFilters.sectorId;
      });
    }
    
    if (expFilters.activityId) {
      filtered = filtered.filter(e => {
        const alloc = allocations.find(a => a.id === e.allocationId);
        const soe = soes.find(s => s.id === alloc?.soeId);
        const actId = soe?.activityId || subActivities.find(sa => sa.id === soe?.subActivityId)?.activityId;
        return actId === expFilters.activityId;
      });
    }

    return filtered;
  }, [expenses, currentAllocations, expDateRange, expFilters, allocations, soes, activities, subActivities, sectors]);

  const getSoeAllocated = (soeId: string) => allocations.filter(a => a.soeId === soeId).reduce((sum, a) => sum + a.amount, 0);
  const getAllocSpent = (allocId: string) => expenses.filter(e => e.allocationId === allocId).reduce((sum, e) => sum + e.amount, 0);

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
    columns: {key: string, label: string, render?: (val: any, item: any) => React.ReactNode, searchableText?: (val: any, item: any) => string}[], 
    onAdd: (e: React.FormEvent) => void, 
    onDelete: (id: string) => void,
    formContent: React.ReactNode,
    onEdit: (item: any) => void
  ) => {
    let filteredItems = items;
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      filteredItems = items.filter(item => {
        return columns.some(c => {
          if (c.searchableText) {
            return c.searchableText(item[c.key], item).toLowerCase().includes(lowerSearch);
          }
          const val = c.render ? c.render(item[c.key], item) : item[c.key];
          if (typeof val === 'string' || typeof val === 'number') {
            return String(val).toLowerCase().includes(lowerSearch);
          }
          if (typeof item[c.key] === 'string' || typeof item[c.key] === 'number') {
            return String(item[c.key]).toLowerCase().includes(lowerSearch);
          }
          return false;
        });
      });
    }

    return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {(userRole === 'admin' || title === 'Expenditure') && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-1 h-fit sticky top-6">
          <h3 className="text-lg font-semibold mb-4 border-b pb-2">
            {editingItem?.type === title ? `Edit ${title}` : `Add ${title}`}
          </h3>
          <form key={editingItem?.item?.id || 'new'} onSubmit={onAdd} className="space-y-4">
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
      )}
      <div className={`bg-white p-6 rounded-xl shadow-sm border border-gray-100 ${(userRole === 'admin' || title === 'Expenditure') ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 border-b pb-2">
          <h3 className="text-lg font-semibold">Existing {title}s</h3>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder={`Search ${title}s...`} 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 w-full sm:w-64"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-sm">
                {columns.map(c => <th key={c.key} className="p-3 border-b">{c.label}</th>)}
                {userRole === 'admin' && <th className="p-3 border-b text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filteredItems.map(item => (
                <tr key={item.id} className="border-b last:border-0 hover:bg-gray-50">
                  {columns.map(c => <td key={c.key} className="p-3">{c.render ? c.render(item[c.key], item) : item[c.key]}</td>)}
                  {userRole === 'admin' && (
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
                  )}
                </tr>
              ))}
              {filteredItems.length === 0 && <tr><td colSpan={columns.length + (userRole === 'admin' ? 1 : 0)} className="p-4 text-center text-gray-500">No records found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )};

  // --- PWA Install Logic ---
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
      setIsInstallable(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstallable(false);
      setInstallPrompt(null);
    }
  };

  // --- Handlers ---
  const handleAddFy = async (e: any) => {
    e.preventDefault();
    const name = e.target.name.value;
    try {
      if (editingItem?.type === 'Financial Year') {
        await updateDoc(doc(db, 'financialYears', editingItem.item.id), { name });
        setEditingItem(null);
      } else {
        await addDoc(collection(db, 'financialYears'), { name });
      }
      e.target.reset();
    } catch (error) {
      handleFirestoreError(error, editingItem ? OperationType.UPDATE : OperationType.CREATE, 'financialYears');
    }
  };

  const handleAddRange = async (e: any) => {
    e.preventDefault();
    const name = e.target.name.value;
    try {
      if (editingItem?.type === 'Range') {
        await updateDoc(doc(db, 'ranges', editingItem.item.id), { name });
        setEditingItem(null);
      } else {
        await addDoc(collection(db, 'ranges'), { name });
      }
      e.target.reset();
    } catch (error) {
      handleFirestoreError(error, editingItem?.type === 'Range' ? OperationType.UPDATE : OperationType.CREATE, 'ranges');
    }
  };

  const handleAddScheme = async (e: any) => {
    e.preventDefault();
    const name = e.target.name.value;
    const fyId = e.target.fyId.value;
    try {
      if (editingItem?.type === 'Scheme') {
        await updateDoc(doc(db, 'schemes', editingItem.item.id), { name, fyId });
        setEditingItem(null);
      } else {
        await addDoc(collection(db, 'schemes'), { name, fyId });
      }
      e.target.reset();
    } catch (error) {
      handleFirestoreError(error, editingItem?.type === 'Scheme' ? OperationType.UPDATE : OperationType.CREATE, 'schemes');
    }
  };

  const handleAddSector = async (e: any) => {
    e.preventDefault();
    const name = e.target.name.value;
    const schemeId = e.target.schemeId.value;
    try {
      if (editingItem?.type === 'Sector') {
        await updateDoc(doc(db, 'sectors', editingItem.item.id), { name, schemeId });
        setEditingItem(null);
      } else {
        await addDoc(collection(db, 'sectors'), { name, schemeId });
      }
      e.target.reset();
    } catch (error) {
      handleFirestoreError(error, editingItem?.type === 'Sector' ? OperationType.UPDATE : OperationType.CREATE, 'sectors');
    }
  };

  const handleAddActivity = async (e: any) => {
    e.preventDefault();
    const name = e.target.name.value;
    const sectorId = e.target.sectorId?.value || null;
    const schemeId = e.target.schemeId?.value || null;

    if (!sectorId && !schemeId) {
      alert("Please select either a Sector or a Scheme");
      return;
    }

    try {
      if (editingItem?.type === 'Activity') {
        await updateDoc(doc(db, 'activities', editingItem.item.id), { name, sectorId, schemeId });
        setEditingItem(null);
      } else {
        await addDoc(collection(db, 'activities'), { id: Date.now().toString(), sectorId, schemeId, name });
      }
      e.target.reset();
    } catch (error) {
      handleFirestoreError(error, editingItem?.type === 'Activity' ? OperationType.UPDATE : OperationType.CREATE, 'activities');
    }
  };

  const handleAddSubActivity = async (e: any) => {
    e.preventDefault();
    const name = e.target.name.value;
    const activityId = e.target.activityId.value;
    try {
      if (editingItem?.type === 'Sub-Activity') {
        await updateDoc(doc(db, 'subActivities', editingItem.item.id), { name, activityId });
        setEditingItem(null);
      } else {
        await addDoc(collection(db, 'subActivities'), { activityId, name });
      }
      e.target.reset();
    } catch (error) {
      handleFirestoreError(error, editingItem?.type === 'Sub-Activity' ? OperationType.UPDATE : OperationType.CREATE, 'subActivities');
    }
  };

  const handleAddSoe = async (e: any) => {
    e.preventDefault();
    const name = e.target.name.value;
    const budgetLimit = parseFloat(e.target.budgetLimit.value);
    const subActivityId = e.target.subActivityId.value || null;
    const activityId = subActivityId ? null : (e.target.activityId.value || null);
    
    if (!activityId && !subActivityId) {
      alert("Please select either an Activity or a Sub-Activity");
      return;
    }

    try {
      if (editingItem?.type === 'SOE Head') {
        await updateDoc(doc(db, 'soeHeads', editingItem.item.id), { name, budgetLimit, activityId, subActivityId });
        setEditingItem(null);
      } else {
        await addDoc(collection(db, 'soeHeads'), { activityId, subActivityId, name, budgetLimit });
      }
      e.target.reset();
    } catch (error) {
      handleFirestoreError(error, editingItem?.type === 'SOE Head' ? OperationType.UPDATE : OperationType.CREATE, 'soeHeads');
    }
  };

  const handleAddAllocation = async (e: any) => {
    e.preventDefault();
    const soeId = e.target.soeId.value;
    const rangeId = e.target.rangeId.value;
    const amount = parseFloat(e.target.amount.value);
    
    const soe = soes.find(s => s.id === soeId);
    if (!soe) return;

    const currentAllocated = allocations
      .filter(a => a.soeId === soeId && (editingItem?.type === 'Allocation' ? a.id !== editingItem.item.id : true))
      .reduce((sum, a) => sum + a.amount, 0);

    if (currentAllocated + amount > soe.budgetLimit) {
      alert(`Cannot allocate. Exceeds SOE budget limit of ₹${soe.budgetLimit}. Current allocated: ₹${currentAllocated}`);
      return;
    }

    try {
      if (editingItem?.type === 'Allocation') {
        await updateDoc(doc(db, 'allocations', editingItem.item.id), { soeId, rangeId, amount });
        setEditingItem(null);
      } else {
        await addDoc(collection(db, 'allocations'), { soeId, rangeId, amount });
      }
      e.target.reset();
    } catch (error) {
      handleFirestoreError(error, editingItem?.type === 'Allocation' ? OperationType.UPDATE : OperationType.CREATE, 'allocations');
    }
  };

  const handleAddExpense = async (e: any) => {
    e.preventDefault();
    const allocationId = e.target.allocationId.value;
    const amount = parseFloat(e.target.amount.value);
    const date = e.target.date.value;
    const description = e.target.description.value;
    const activityId = e.target.activityId?.value || null;

    const alloc = allocations.find(a => a.id === allocationId);
    if (!alloc) return;

    const currentSpent = expenses
      .filter(e => e.allocationId === allocationId && (editingItem?.type === 'Expenditure' ? e.id !== editingItem.item.id : true))
      .reduce((sum, e) => sum + e.amount, 0);

    if (currentSpent + amount > alloc.amount) {
      alert(`Cannot add expense. Exceeds allocated budget of ₹${alloc.amount}. Current spent: ₹${currentSpent}`);
      return;
    }

    try {
      if (editingItem?.type === 'Expenditure') {
        await updateDoc(doc(db, 'expenditures', editingItem.item.id), { allocationId, amount, date, description, activityId });
        setEditingItem(null);
      } else {
        await addDoc(collection(db, 'expenditures'), { allocationId, amount, date, description, activityId });
      }
      e.target.reset();
    } catch (error) {
      handleFirestoreError(error, editingItem?.type === 'Expenditure' ? OperationType.UPDATE : OperationType.CREATE, 'expenditures');
    }
  };

  const handleDelete = async (collectionName: string, id: string) => {
    if (window.confirm('Are you sure you want to delete this entry?')) {
      try {
        await deleteDoc(doc(db, collectionName, id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, collectionName);
      }
    }
  };

  const handleUserRoleChange = async (userId: string, newRole: 'admin' | 'deo') => {
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (window.confirm('Delete this user access?')) {
      try {
        await deleteDoc(doc(db, 'users', userId));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, 'users');
      }
    }
  };

  const renderUserManagement = () => (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
      <h3 className="text-lg font-semibold mb-4 border-b pb-2 flex items-center gap-2">
        <Shield className="h-5 w-5 text-emerald-600" /> User Access Management
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 text-gray-600 text-sm">
              <th className="p-3 border-b">Email</th>
              <th className="p-3 border-b">Role</th>
              <th className="p-3 border-b text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-b hover:bg-gray-50">
                <td className="p-3">{u.email}</td>
                <td className="p-3">
                  <select 
                    value={u.role} 
                    onChange={(e) => handleUserRoleChange(u.id, e.target.value as 'admin' | 'deo')}
                    className="p-1 border rounded text-sm"
                  >
                    <option value="admin">Admin</option>
                    <option value="deo">DEO</option>
                  </select>
                </td>
                <td className="p-3 text-right">
                  <button onClick={() => handleDeleteUser(u.id)} className="text-red-500 hover:text-red-700">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderReports = () => {
    const downloadPDF = (title: string, data: any[], headers: string[]) => {
      const doc = new jsPDF('landscape');
      doc.text(title, 14, 15);
      autoTable(doc, {
        head: [headers],
        body: data,
        startY: 20,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [5, 150, 105] }
      });
      doc.save(`${title.toLowerCase().replace(/\s+/g, '_')}.pdf`);
    };

    const downloadExcel = (title: string, data: any[], headers: string[]) => {
      const wsData = [headers, ...data];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Report");
      XLSX.writeFile(wb, `${title.toLowerCase().replace(/\s+/g, '_')}.xlsx`);
    };

    const comprehensiveReportData = currentAllocations.map(a => {
      const soe = soes.find(s => s.id === a.soeId);
      const range = ranges.find(r => r.id === a.rangeId);
      
      let sa = null;
      let act = null;
      let sec = null;
      let sch = null;

      if (soe?.subActivityId) {
        sa = subActivities.find(s => s.id === soe.subActivityId);
        act = activities.find(ac => ac.id === sa?.activityId);
      } else if (soe?.activityId) {
        act = activities.find(ac => ac.id === soe.activityId);
      }

      if (act?.sectorId) {
        sec = sectors.find(s => s.id === act.sectorId);
        sch = schemes.find(s => s.id === sec?.schemeId);
      } else if (act?.schemeId) {
        sch = schemes.find(s => s.id === act.schemeId);
      }

      const totalBudget = soe?.budgetLimit || 0;
      const allocated = a.amount;
      const expenditure = currentExpenses.filter(e => e.allocationId === a.id).reduce((sum, e) => sum + e.amount, 0);
      const remaining = allocated - expenditure;

      return {
        range: range?.name || 'N/A',
        scheme: sch?.name || 'N/A',
        sector: sec?.name || 'N/A',
        activity: act?.name || 'N/A',
        subActivity: sa?.name || 'N/A',
        soe: soe?.name || 'N/A',
        totalBudget,
        allocated,
        expenditure,
        remaining
      };
    });

    const headers = ['Range', 'Scheme', 'Sector', 'Activity', 'Sub-Activity', 'SOE Head', 'Total Budget', 'Allocated', 'Expenditure', 'Remaining'];
    const tableData = comprehensiveReportData.map(row => [
      row.range, row.scheme, row.sector, row.activity, row.subActivity, row.soe, 
      row.totalBudget, row.allocated, row.expenditure, row.remaining
    ]);

    return (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <FileBarChart className="text-emerald-600" /> Comprehensive Budget Report
            </h3>
            <div className="flex gap-2">
              <button 
                onClick={() => downloadPDF('Comprehensive Budget Report', tableData, headers)}
                className="bg-red-600 text-white px-4 py-2 rounded flex items-center justify-center gap-2 hover:bg-red-700 transition-colors"
              >
                <Download className="w-4 h-4" /> Export PDF
              </button>
              <button 
                onClick={() => downloadExcel('Comprehensive Budget Report', tableData, headers)}
                className="bg-emerald-600 text-white px-4 py-2 rounded flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors"
              >
                <Download className="w-4 h-4" /> Export Excel
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {headers.map(h => <th key={h} className="p-3 text-sm font-semibold text-gray-600">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {comprehensiveReportData.map((row, i) => (
                  <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="p-3 text-sm">{row.range}</td>
                    <td className="p-3 text-sm">{row.scheme}</td>
                    <td className="p-3 text-sm">{row.sector}</td>
                    <td className="p-3 text-sm">{row.activity}</td>
                    <td className="p-3 text-sm">{row.subActivity}</td>
                    <td className="p-3 text-sm font-medium">{row.soe}</td>
                    <td className="p-3 text-sm text-right text-gray-500">₹{row.totalBudget.toLocaleString()}</td>
                    <td className="p-3 text-sm text-right text-emerald-600 font-medium">₹{row.allocated.toLocaleString()}</td>
                    <td className="p-3 text-sm text-right text-red-600 font-medium">₹{row.expenditure.toLocaleString()}</td>
                    <td className="p-3 text-sm text-right text-blue-600 font-bold">₹{row.remaining.toLocaleString()}</td>
                  </tr>
                ))}
                {comprehensiveReportData.length === 0 && (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-gray-500">No data available for the selected Financial Year.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50">Loading...</div>;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100 max-w-md w-full text-center space-y-6">
          <Landmark className="h-16 w-16 text-emerald-600 mx-auto" />
          <h1 className="text-3xl font-bold text-gray-900">Forest Budget Control</h1>
          <p className="text-gray-500">Please sign in to access the financial management system.</p>
          
          <form onSubmit={handleLogin} className="space-y-4 text-left">
            {loginError && <div className="p-3 bg-red-50 text-red-600 rounded text-sm">{loginError}</div>}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ID / Email</label>
              <input 
                type="text" 
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="e.g. DA123 or admin@email.com"
                className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input 
                type="password" 
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            
            <div className="flex justify-between items-center">
              <button 
                type="button" 
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-sm text-emerald-600 hover:underline"
              >
                {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
              </button>
              <button 
                type="button" 
                onClick={handleForgotPassword}
                className="text-sm text-emerald-600 hover:underline"
              >
                Forgot Password?
              </button>
            </div>

            <button 
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-3 transition-all transform hover:scale-[1.02]"
            >
              {isSignUp ? 'Sign Up' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (user && !userRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6 text-center">
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100 max-w-md w-full space-y-4">
          <Shield className="h-16 w-16 text-amber-500 mx-auto" />
          <h2 className="text-2xl font-bold">Access Pending</h2>
          <p className="text-gray-500">Your account ({user.email}) is registered but has no assigned role. Please contact an administrator to grant you access.</p>
          <button onClick={handleLogout} className="text-emerald-600 font-semibold hover:underline">Sign Out</button>
        </div>
      </div>
    );
  }

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
                onChange={(e) => setSelectedFyId(e.target.value)}
                className="bg-transparent border-none focus:ring-0 text-emerald-700 font-bold cursor-pointer"
              >
                {fys.map(fy => <option key={fy.id} value={fy.id}>FY {fy.name}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-2">
              {userRole === 'admin' && (
                <button
                  onClick={async () => {
                    await preloadDatabase();
                    alert('Preloaded data added successfully!');
                  }}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
                >
                  Load Preloaded Data
                </button>
              )}
              {isInstallable && (
                <button
                  onClick={handleInstallClick}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  Install
                </button>
              )}
              <button 
                onClick={handleLogout}
                className="flex items-center gap-2 text-gray-600 hover:text-red-600 px-3 py-2 rounded-lg border border-gray-200 bg-white shadow-sm transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex flex-wrap gap-2 bg-gray-800 p-4 rounded-lg shadow-sm">
          {[
            'Dashboard', 'Financial Years', 'Ranges', 'Schemes', 'Sectors', 'Activities', 'Sub-Activities', 
            'SOE Heads', 'Allocations', 'Expenditures', 'Ledger', 'Reports', 
            ...(userRole === 'admin' ? ['Users'] : [])
          ].map((item) => (
            <button 
              key={item} 
              id={`tab-${item}`}
              onClick={() => {
                setActiveTab(item);
                setSearchTerm('');
              }}
              className={`px-4 py-2 text-sm font-medium rounded transition-colors ${activeTab === item ? 'bg-emerald-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
            >
              {item}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'Dashboard' && renderDashboard()}
        
        {activeTab === 'Financial Years' && renderSimpleManager(
          'Financial Year', 
          fys, 
          [{key: 'name', label: 'Financial Year (e.g. 2025-26)'}], 
          handleAddFy, 
          (id) => handleDelete('financialYears', id), 
          <input name="name" required defaultValue={editingItem?.type === 'Financial Year' ? editingItem.item.name : ''} placeholder="Financial Year (e.g. 2025-26)" className="w-full p-2 border rounded" />,
          (item) => setEditingItem({ type: 'Financial Year', item })
        )}

        {activeTab === 'Ranges' && renderSimpleManager(
          'Range', 
          ranges, 
          [{key: 'name', label: 'Range Name'}], 
          handleAddRange, 
          (id) => handleDelete('ranges', id), 
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
          (id) => handleDelete('schemes', id), 
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
            {key: 'schemeId', label: 'Scheme', 
              searchableText: (val) => schemes.find(s => s.id === val)?.name || '',
              render: (val) => schemes.find(s => s.id === val)?.name
            },
            {key: 'name', label: 'Sector Name'}
          ], 
          handleAddSector, 
          (id) => handleDelete('sectors', id), 
          <>
            <div className="flex gap-2">
              <select name="schemeId" required defaultValue={editingItem?.type === 'Sector' ? editingItem.item.schemeId : ''} className="w-full p-2 border rounded">
                <option value="">Select Scheme</option>
                {schemes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <button type="button" onClick={() => document.getElementById('tab-Schemes')?.click()} className="px-3 bg-gray-100 border rounded hover:bg-gray-200 text-gray-600" title="Add Scheme">+</button>
            </div>
            <input name="name" required defaultValue={editingItem?.type === 'Sector' ? editingItem.item.name : ''} placeholder="Sector Name (e.g. CA, NPV)" className="w-full p-2 border rounded" />
          </>,
          (item) => setEditingItem({ type: 'Sector', item })
        )}

        {activeTab === 'Activities' && renderSimpleManager(
          'Activity', 
          activities, 
          [
            {key: 'parent', label: 'Scheme / Sector', 
              searchableText: (_, item) => {
                if (item.sectorId) {
                  const sec = sectors.find(s => s.id === item.sectorId);
                  const sch = schemes.find(s => s.id === sec?.schemeId);
                  return `[${sch?.name}] ${sec?.name}`;
                }
                const sch = schemes.find(s => s.id === item.schemeId);
                return sch?.name || '';
              },
              render: (_, item) => {
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
          (id) => handleDelete('activities', id), 
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
            {key: 'activityId', label: 'Activity', 
              searchableText: (val) => {
                const act = activities.find(a => a.id === val);
                const sec = sectors.find(s => s.id === act?.sectorId);
                return `[${sec?.name}] ${act?.name}`;
              },
              render: (val) => {
              const act = activities.find(a => a.id === val);
              const sec = sectors.find(s => s.id === act?.sectorId);
              return `[${sec?.name}] ${act?.name}`;
            }},
            {key: 'name', label: 'Sub-Activity Name'}
          ], 
          handleAddSubActivity, 
          (id) => handleDelete('subActivities', id), 
          <CascadingDropdowns 
            schemes={schemes} sectors={sectors} activities={activities} subActivities={subActivities} soes={soes} allocations={allocations} ranges={ranges}
            editingItem={editingItem} type="Sub-Activity"
          >
            <input name="name" required defaultValue={editingItem?.type === 'Sub-Activity' ? editingItem.item.name : ''} placeholder="Sub-Activity Name" className="w-full p-2 border rounded" />
          </CascadingDropdowns>,
          (item) => setEditingItem({ type: 'Sub-Activity', item })
        )}

        {activeTab === 'SOE Heads' && renderSimpleManager(
          'SOE Head', 
          soes, 
          [
            {key: 'parent', label: 'Hierarchy', 
              searchableText: (_, item) => {
                let hierarchy = '';
                if (item.subActivityId) {
                  const sa = subActivities.find(sa => sa.id === item.subActivityId);
                  const act = activities.find(a => a.id === sa?.activityId);
                  const sec = sectors.find(sec => sec.id === act?.sectorId);
                  const sch = schemes.find(sc => sc.id === (sec ? sec.schemeId : act?.schemeId));
                  hierarchy = [sch?.name, sec?.name, act?.name, sa?.name].filter(Boolean).join(' -> ');
                } else if (item.activityId) {
                  const act = activities.find(a => a.id === item.activityId);
                  const sec = sectors.find(sec => sec.id === act?.sectorId);
                  const sch = schemes.find(sc => sc.id === (sec ? sec.schemeId : act?.schemeId));
                  hierarchy = [sch?.name, sec?.name, act?.name].filter(Boolean).join(' -> ');
                }
                return hierarchy || 'N/A';
              },
              render: (_, item) => {
              let hierarchy = '';
              if (item.subActivityId) {
                const sa = subActivities.find(sa => sa.id === item.subActivityId);
                const act = activities.find(a => a.id === sa?.activityId);
                const sec = sectors.find(sec => sec.id === act?.sectorId);
                const sch = schemes.find(sc => sc.id === (sec ? sec.schemeId : act?.schemeId));
                hierarchy = [sch?.name, sec?.name, act?.name, sa?.name].filter(Boolean).join(' -> ');
              } else if (item.activityId) {
                const act = activities.find(a => a.id === item.activityId);
                const sec = sectors.find(sec => sec.id === act?.sectorId);
                const sch = schemes.find(sc => sc.id === (sec ? sec.schemeId : act?.schemeId));
                hierarchy = [sch?.name, sec?.name, act?.name].filter(Boolean).join(' -> ');
              }
              return hierarchy || 'N/A';
            }},
            {key: 'name', label: 'SOE Name'},
            {key: 'budgetLimit', label: 'Budget Limit', searchableText: (val) => String(val), render: (val) => `₹${val.toLocaleString()}`}
          ], 
          handleAddSoe, 
          (id) => handleDelete('soeHeads', id), 
          <CascadingDropdowns 
            schemes={schemes} sectors={sectors} activities={activities} subActivities={subActivities} soes={soes} allocations={allocations} ranges={ranges}
            editingItem={editingItem} type="SOE Head"
          >
            <input name="name" required defaultValue={editingItem?.type === 'SOE Head' ? editingItem.item.name : ''} placeholder="SOE Name (e.g. 20 OC)" className="w-full p-2 border rounded" />
            <input name="budgetLimit" type="number" required defaultValue={editingItem?.type === 'SOE Head' ? editingItem.item.budgetLimit : ''} placeholder="Budget Limit (₹)" className="w-full p-2 border rounded" />
          </CascadingDropdowns>,
          (item) => setEditingItem({ type: 'SOE Head', item })
        )}

        {activeTab === 'Allocations' && renderSimpleManager(
          'Allocation', 
          allocations, 
          [
            {key: 'soeId', label: 'FY -> SOE', 
              searchableText: (val) => {
                const s = soes.find(s => s.id === val);
                let hierarchy = '';
                if (s?.subActivityId) {
                  const sa = subActivities.find(sa => sa.id === s.subActivityId);
                  const act = activities.find(a => a.id === sa?.activityId);
                  const sec = sectors.find(sec => sec.id === act?.sectorId);
                  const sch = schemes.find(sc => sc.id === (sec ? sec.schemeId : act?.schemeId));
                  hierarchy = [sch?.name, sec?.name, act?.name, sa?.name].filter(Boolean).join(' -> ');
                } else if (s?.activityId) {
                  const act = activities.find(a => a.id === s.activityId);
                  const sec = sectors.find(sec => sec.id === act?.sectorId);
                  const sch = schemes.find(sc => sc.id === (sec ? sec.schemeId : act?.schemeId));
                  hierarchy = [sch?.name, sec?.name, act?.name].filter(Boolean).join(' -> ');
                }
                return `[${hierarchy || 'N/A'}] ${s?.name || 'N/A'}`;
              },
              render: (val) => {
              const s = soes.find(s => s.id === val);
              let hierarchy = '';
              if (s?.subActivityId) {
                const sa = subActivities.find(sa => sa.id === s.subActivityId);
                const act = activities.find(a => a.id === sa?.activityId);
                const sec = sectors.find(sec => sec.id === act?.sectorId);
                const sch = schemes.find(sc => sc.id === (sec ? sec.schemeId : act?.schemeId));
                hierarchy = [sch?.name, sec?.name, act?.name, sa?.name].filter(Boolean).join(' -> ');
              } else if (s?.activityId) {
                const act = activities.find(a => a.id === s.activityId);
                const sec = sectors.find(sec => sec.id === act?.sectorId);
                const sch = schemes.find(sc => sc.id === (sec ? sec.schemeId : act?.schemeId));
                hierarchy = [sch?.name, sec?.name, act?.name].filter(Boolean).join(' -> ');
              }
              return `[${hierarchy || 'N/A'}] ${s?.name || 'N/A'}`;
            }},
            {key: 'rangeId', label: 'Range', render: (val) => ranges.find(r => r.id === val)?.name},
            {key: 'amount', label: 'Allocated Amount', 
              searchableText: (val) => String(val),
              render: (val, item) => {
              const soe = soes.find(s => s.id === item.soeId);
              const totalAllocatedForSoe = getSoeAllocated(item.soeId);
              const remaining = (soe?.budgetLimit || 0) - totalAllocatedForSoe;
              
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
          (id) => handleDelete('allocations', id), 
          <CascadingDropdowns 
            schemes={schemes} sectors={sectors} activities={activities} subActivities={subActivities} soes={soes} allocations={allocations} ranges={ranges}
            editingItem={editingItem} type="Allocation"
          >
            <select name="rangeId" required defaultValue={editingItem?.type === 'Allocation' ? editingItem.item.rangeId : ''} className="w-full p-2 border rounded">
              <option value="">Select Range</option>
              {ranges.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <input name="amount" type="number" required defaultValue={editingItem?.type === 'Allocation' ? editingItem.item.amount : ''} placeholder="Amount (₹)" className="w-full p-2 border rounded" />
          </CascadingDropdowns>,
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
                    {sectors.filter(s => s.schemeId === expFilters.schemeId).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
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
                      if (expFilters.sectorId) return a.sectorId === expFilters.sectorId;
                      if (expFilters.schemeId) return a.schemeId === expFilters.schemeId;
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
                {key: 'allocationId', label: 'Hierarchy / Range / SOE', 
                  searchableText: (val, item) => {
                    const al = allocations.find(a => a.id === val);
                    const r = ranges.find(r => r.id === al?.rangeId);
                    const s = soes.find(s => s.id === al?.soeId);
                    let hierarchy = '';
                    if (s?.subActivityId) {
                      const sa = subActivities.find(sa => sa.id === s.subActivityId);
                      const act = activities.find(a => a.id === sa?.activityId);
                      const sec = sectors.find(sec => sec.id === act?.sectorId);
                      const sch = schemes.find(sc => sc.id === (sec ? sec.schemeId : act?.schemeId));
                      hierarchy = [sch?.name, sec?.name, act?.name, sa?.name].filter(Boolean).join(' -> ');
                    } else if (s?.activityId) {
                      const act = activities.find(a => a.id === s.activityId);
                      const sec = sectors.find(sec => sec.id === act?.sectorId);
                      const sch = schemes.find(sc => sc.id === (sec ? sec.schemeId : act?.schemeId));
                      hierarchy = [sch?.name, sec?.name, act?.name].filter(Boolean).join(' -> ');
                    }
                    const actName = item.activityId ? activities.find(a => a.id === item.activityId)?.name : '';
                    return `${hierarchy} ${r?.name} ${s?.name} ${actName}`;
                  },
                  render: (val, item) => {
                  const al = allocations.find(a => a.id === val);
                  const r = ranges.find(r => r.id === al?.rangeId);
                  const s = soes.find(s => s.id === al?.soeId);
                  let hierarchy = '';
                  if (s?.subActivityId) {
                    const sa = subActivities.find(sa => sa.id === s.subActivityId);
                    const act = activities.find(a => a.id === sa?.activityId);
                    const sec = sectors.find(sec => sec.id === act?.sectorId);
                    const sch = schemes.find(sc => sc.id === (sec ? sec.schemeId : act?.schemeId));
                    hierarchy = [sch?.name, sec?.name, act?.name, sa?.name].filter(Boolean).join(' -> ');
                  } else if (s?.activityId) {
                    const act = activities.find(a => a.id === s.activityId);
                    const sec = sectors.find(sec => sec.id === act?.sectorId);
                    const sch = schemes.find(sc => sc.id === (sec ? sec.schemeId : act?.schemeId));
                    hierarchy = [sch?.name, sec?.name, act?.name].filter(Boolean).join(' -> ');
                  }
                  return (
                    <div>
                      <div className="text-xs text-gray-500">{hierarchy || 'N/A'}</div>
                      <div className="font-medium">{r?.name || 'N/A'} / {s?.name || 'N/A'}</div>
                      {item.activityId && (
                        <div className="text-[10px] bg-blue-50 text-blue-600 px-1 rounded inline-block mt-1">
                          Activity: {activities.find(a => a.id === item.activityId)?.name}
                        </div>
                      )}
                    </div>
                  );
                }},
                {key: 'description', label: 'Description'},
                {key: 'amount', label: 'Amount', searchableText: (val) => String(val), render: (val) => <span className="text-red-600 font-bold">₹{val.toLocaleString()}</span>},
                {key: 'balance', label: 'Balance', 
                  searchableText: (_, item) => {
                    const alloc = allocations.find(a => a.id === item.allocationId);
                    if (!alloc) return 'N/A';
                    const spentUpTo = expenses
                      .filter(e => e.allocationId === item.allocationId && (new Date(e.date).getTime() < new Date(item.date).getTime() || (e.date === item.date && e.id <= item.id)))
                      .reduce((sum, e) => sum + e.amount, 0);
                    return String(alloc.amount - spentUpTo);
                  },
                  render: (_, item) => {
                  const alloc = allocations.find(a => a.id === item.allocationId);
                  if (!alloc) return 'N/A';
                  const spentUpTo = expenses
                    .filter(e => e.allocationId === item.allocationId && (new Date(e.date).getTime() < new Date(item.date).getTime() || (e.date === item.date && e.id <= item.id)))
                    .reduce((sum, e) => sum + e.amount, 0);
                  return <span className="text-blue-600 font-bold">₹{(alloc.amount - spentUpTo).toLocaleString()}</span>;
                }}
              ], 
              handleAddExpense, 
              (id) => handleDelete('expenditures', id), 
              <CascadingDropdowns 
                schemes={schemes} sectors={sectors} activities={activities} subActivities={subActivities} soes={soes} allocations={allocations} ranges={ranges}
                editingItem={editingItem} type="Expenditure"
              >
                <input name="amount" type="number" required defaultValue={editingItem?.type === 'Expenditure' ? editingItem.item.amount : ''} placeholder="Amount (₹)" className="w-full p-2 border rounded" />
                <input name="date" type="date" required defaultValue={editingItem?.type === 'Expenditure' ? editingItem.item.date : new Date().toISOString().split('T')[0]} className="w-full p-2 border rounded" />
                <textarea name="description" required defaultValue={editingItem?.type === 'Expenditure' ? editingItem.item.description : ''} placeholder="Description / Remarks" className="w-full p-2 border rounded" rows={2} />
              </CascadingDropdowns>,
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

        {activeTab === 'Reports' && renderReports()}
        {activeTab === 'Users' && userRole === 'admin' && renderUserManagement()}

      </div>
    </div>
  );
}

function CascadingDropdowns({ 
  schemes, sectors, activities, subActivities, soes, allocations, ranges,
  editingItem, type, children 
}: any) {
  const [schemeId, setSchemeId] = useState('');
  const [sectorId, setSectorId] = useState('');
  const [activityId, setActivityId] = useState('');
  const [subActivityId, setSubActivityId] = useState('');
  const [soeId, setSoeId] = useState('');
  const [allocationId, setAllocationId] = useState('');

  // Initialize state based on editingItem
  useEffect(() => {
    if (editingItem?.item && editingItem.type === type) {
      const item = editingItem.item;
      let currentSoeId = '';
      let currentSubActivityId = '';
      let currentActivityId = '';
      let currentSectorId = '';
      let currentSchemeId = '';

      if (type === 'Expenditure') {
        const alloc = allocations.find((a: any) => a.id === item.allocationId);
        setAllocationId(item.allocationId);
        currentSoeId = alloc?.soeId || '';
      } else if (type === 'Allocation') {
        currentSoeId = item.soeId;
      } else if (type === 'SOE Head') {
        currentSubActivityId = item.subActivityId || '';
        currentActivityId = item.activityId || '';
      } else if (type === 'Sub-Activity') {
        currentActivityId = item.activityId;
      }

      if (currentSoeId) {
        setSoeId(currentSoeId);
        const soe = soes.find((s: any) => s.id === currentSoeId);
        currentSubActivityId = soe?.subActivityId || '';
        currentActivityId = soe?.activityId || '';
      }

      if (currentSubActivityId) {
        setSubActivityId(currentSubActivityId);
        const sa = subActivities.find((s: any) => s.id === currentSubActivityId);
        currentActivityId = sa?.activityId || '';
      }

      if (currentActivityId) {
        setActivityId(currentActivityId);
        const act = activities.find((a: any) => a.id === currentActivityId);
        currentSectorId = act?.sectorId || '';
        currentSchemeId = act?.schemeId || '';
      }

      if (currentSectorId) {
        setSectorId(currentSectorId);
        const sec = sectors.find((s: any) => s.id === currentSectorId);
        currentSchemeId = sec?.schemeId || '';
      }

      if (currentSchemeId) {
        setSchemeId(currentSchemeId);
      }
    } else {
      setSchemeId('');
      setSectorId('');
      setActivityId('');
      setSubActivityId('');
      setSoeId('');
      setAllocationId('');
    }
  }, [editingItem, type, allocations, soes, subActivities, activities, sectors]);

  const selectedScheme = schemes.find((s: any) => s.id === schemeId);
  const isCampa = selectedScheme?.name.toUpperCase().includes('CAMPA');

  const filteredSectors = sectors.filter((s: any) => s.schemeId === schemeId);
  const filteredActivities = activities.filter((a: any) => 
    isCampa ? a.sectorId === sectorId : a.schemeId === schemeId
  );
  const filteredSubActivities = subActivities.filter((sa: any) => sa.activityId === activityId);
  const filteredSoes = soes.filter((s: any) => 
    subActivityId ? s.subActivityId === subActivityId : s.activityId === activityId
  );
  const filteredAllocations = allocations.filter((a: any) => a.soeId === soeId);

  return (
    <>
      <div className="flex gap-2">
        <select 
          className="w-full p-2 border rounded" 
          value={schemeId} 
          onChange={(e) => { setSchemeId(e.target.value); setSectorId(''); setActivityId(''); setSubActivityId(''); setSoeId(''); setAllocationId(''); }}
          required={type !== 'Activity'}
        >
          <option value="">Select Scheme</option>
          {schemes.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button type="button" onClick={() => document.getElementById('tab-Schemes')?.click()} className="px-3 bg-gray-100 border rounded hover:bg-gray-200 text-gray-600" title="Add Scheme">+</button>
      </div>

      {isCampa && (
        <div className="flex gap-2">
          <select 
            className="w-full p-2 border rounded" 
            value={sectorId} 
            onChange={(e) => { setSectorId(e.target.value); setActivityId(''); setSubActivityId(''); setSoeId(''); setAllocationId(''); }}
            required
          >
            <option value="">Select Sector</option>
            {filteredSectors.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button type="button" onClick={() => document.getElementById('tab-Sectors')?.click()} className="px-3 bg-gray-100 border rounded hover:bg-gray-200 text-gray-600" title="Add Sector">+</button>
        </div>
      )}

      {(type === 'Sub-Activity' || type === 'SOE Head' || type === 'Allocation' || type === 'Expenditure') && (
        <div className="flex gap-2">
          <select 
            className="w-full p-2 border rounded" 
            value={activityId} 
            onChange={(e) => { setActivityId(e.target.value); setSubActivityId(''); setSoeId(''); setAllocationId(''); }}
            required={type !== 'SOE Head'}
          >
            <option value="">Select Activity</option>
            {filteredActivities.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <button type="button" onClick={() => document.getElementById('tab-Activities')?.click()} className="px-3 bg-gray-100 border rounded hover:bg-gray-200 text-gray-600" title="Add Activity">+</button>
        </div>
      )}

      {(type === 'SOE Head' || type === 'Allocation' || type === 'Expenditure') && filteredSubActivities.length > 0 && (
        <div className="flex gap-2">
          <select 
            className="w-full p-2 border rounded" 
            value={subActivityId} 
            onChange={(e) => { setSubActivityId(e.target.value); setSoeId(''); setAllocationId(''); }}
          >
            <option value="">Select Sub-Activity (Optional)</option>
            {filteredSubActivities.map((sa: any) => <option key={sa.id} value={sa.id}>{sa.name}</option>)}
          </select>
          <button type="button" onClick={() => document.getElementById('tab-Sub-Activities')?.click()} className="px-3 bg-gray-100 border rounded hover:bg-gray-200 text-gray-600" title="Add Sub-Activity">+</button>
        </div>
      )}
      
      {/* Hidden inputs to ensure correct fields are submitted */}
      <input type="hidden" name="activityId" value={activityId} />
      <input type="hidden" name="subActivityId" value={subActivityId} />

      {(type === 'Allocation' || type === 'Expenditure') && (
        <div className="flex flex-col gap-1">
          <div className="flex gap-2">
            <select 
              name={type === 'Allocation' ? 'soeId' : undefined}
              className="w-full p-2 border rounded" 
              value={soeId} 
              onChange={(e) => { setSoeId(e.target.value); setAllocationId(''); }}
              required
            >
              <option value="">Select SOE Head</option>
              {filteredSoes.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <button type="button" onClick={() => document.getElementById('tab-SOE Heads')?.click()} className="px-3 bg-gray-100 border rounded hover:bg-gray-200 text-gray-600" title="Add SOE Head">+</button>
          </div>
          {type === 'Allocation' && soeId && (
            <div className="text-xs text-blue-600 px-1 font-medium bg-blue-50 p-1.5 rounded border border-blue-100">
              {(() => {
                const soe = soes.find((s: any) => s.id === soeId);
                const totalAllocated = allocations.filter((a: any) => a.soeId === soeId).reduce((sum: number, a: any) => sum + a.amount, 0);
                const remaining = (soe?.budgetLimit || 0) - totalAllocated;
                return `Budget Limit: ₹${(soe?.budgetLimit || 0).toLocaleString()} | Allocated: ₹${totalAllocated.toLocaleString()} | Remaining: ₹${remaining.toLocaleString()}`;
              })()}
            </div>
          )}
        </div>
      )}

      {type === 'Expenditure' && (
        <div className="flex gap-2">
          <select 
            name="allocationId"
            className="w-full p-2 border rounded" 
            value={allocationId} 
            onChange={(e) => setAllocationId(e.target.value)}
            required
          >
            <option value="">Select Allocation (Range)</option>
            {filteredAllocations.map((a: any) => {
              const r = ranges.find((r: any) => r.id === a.rangeId);
              return <option key={a.id} value={a.id}>{r?.name} (Allocated: ₹{a.amount})</option>
            })}
          </select>
          <button type="button" onClick={() => document.getElementById('tab-Allocations')?.click()} className="px-3 bg-gray-100 border rounded hover:bg-gray-200 text-gray-600" title="Add Allocation">+</button>
        </div>
      )}

      {children}
    </>
  );
}
function ActivityFormContent({ schemes, sectors, editingItem }: { schemes: any[], sectors: any[], editingItem: any }) {
  const [selectedSchemeId, setSelectedSchemeId] = useState(editingItem?.item?.schemeId || (editingItem?.item?.sectorId ? sectors.find((s: any) => s.id === editingItem.item.sectorId)?.schemeId : ''));
  
  const selectedScheme = schemes.find(s => s.id === selectedSchemeId);
  const isCampa = selectedScheme?.name.toUpperCase().includes('CAMPA');

  return (
    <>
      <div className="flex gap-2">
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
        <button type="button" onClick={() => document.getElementById('tab-Schemes')?.click()} className="px-3 bg-gray-100 border rounded hover:bg-gray-200 text-gray-600" title="Add Scheme">+</button>
      </div>
      
      {isCampa && (
        <div className="flex gap-2">
          <select name="sectorId" required defaultValue={editingItem?.item?.sectorId || ''} className="w-full p-2 border rounded">
            <option value="">Select Sector</option>
            {sectors.filter(s => s.schemeId === selectedSchemeId).map(sec => (
              <option key={sec.id} value={sec.id}>{sec.name}</option>
            ))}
          </select>
          <button type="button" onClick={() => document.getElementById('tab-Sectors')?.click()} className="px-3 bg-gray-100 border rounded hover:bg-gray-200 text-gray-600" title="Add Sector">+</button>
        </div>
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
