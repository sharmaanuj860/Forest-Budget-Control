import React, { useState, useMemo, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from 'recharts';
import { IndianRupee, Wallet, TrendingDown, Landmark, Activity, FileText, Map, Plus, Trash2, Download, LogOut, User, Shield, FileBarChart, Filter, Search, Menu, Table, Pencil, Home, ChevronUp, ChevronDown, TreePine } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  auth, db, signInWithPopup, googleProvider, signOut, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail,
  collection, doc, setDoc, getDoc, getDocs, onSnapshot, query, where, orderBy, addDoc, updateDoc, deleteDoc, getDocFromServer, firebaseConfig
} from './firebase';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { preloadDatabase } from './preloadData';

// --- Types ---
type FinancialYear = { id: string; name: string };
type Range = { id: string; name: string };
type Scheme = { id: string; name: string };
type Sector = { id: string; schemeId: string; name: string };
type ActivityItem = { id: string; sectorId?: string; schemeId?: string; name: string };
type SubActivity = { id: string; activityId: string; name: string };
type SOE = { id: string; schemeId?: string; sectorId?: string; activityId?: string; subActivityId?: string; name: string };
type SOEBudget = { id: string; soeId: string; fyId: string; budgetLimit: number };
type Allocation = { id: string; soeId: string; rangeId: string; amount: number; schemeId?: string; sectorId?: string; activityId?: string; subActivityId?: string; fyId: string };
type Expense = { id: string; allocationId: string; amount: number; date: string; description: string; activityId?: string; fyId: string };
type AppUser = { id: string; email: string; role: 'admin' | 'deo' | 'Sarahan' | 'Narag' | 'Habban' | 'Rajgarh' };

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
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dashboardSearch, setDashboardSearch] = useState('');
  const [showAllBudget, setShowAllBudget] = useState(false);
  const [rangeSearch, setRangeSearch] = useState('');
  const [showAllRange, setShowAllRange] = useState(false);
  const [isFormExpanded, setIsFormExpanded] = useState(window.innerWidth > 1024);
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<'admin' | 'deo' | 'Sarahan' | 'Narag' | 'Habban' | 'Rajgarh' | null>(null);
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
  const [soeBudgets, setSoeBudgets] = useState<SOEBudget[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'deo' | 'Sarahan' | 'Narag' | 'Habban' | 'Rajgarh'>('deo');

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
      if (currentUser) {
        setLoading(true);
        setUser(currentUser);
        setActiveTab('Dashboard');
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
        setUser(null);
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

    const unsubSoeBudgets = onSnapshot(collection(db, 'soeBudgets'), (snap) => {
      setSoeBudgets(snap.docs.map(d => ({ id: d.id, ...d.data() } as SOEBudget)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'soeBudgets'));

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
      unsubSubActivities(); unsubSoes(); unsubSoeBudgets(); unsubAllocations(); unsubExpenses(); unsubUsers();
    };
  }, [user, userRole]);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoginError('');
    setLoading(true);
    try {
      let emailToUse = loginEmail;
      if (!emailToUse.includes('@')) {
        emailToUse = `${emailToUse}@rajgarhforest.app`;
      }
      await signInWithEmailAndPassword(auth, emailToUse, loginPassword);
    } catch (error: any) {
      console.error('Auth error:', error);
      if (error.code === 'auth/operation-not-allowed') {
        setLoginError('Email/Password authentication is not enabled in your Firebase project. Please go to the Firebase Console -> Authentication -> Sign-in method, and enable "Email/Password".');
      } else if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        setLoginError('User not found or invalid credentials.');
      } else {
        setLoginError(error.message || 'Authentication failed. Please check your credentials.');
      }
      setLoading(false);
    }
  };


  const handleLogout = () => signOut(auth);

  // --- Session Expiry ---
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      if (user) {
        timeoutId = setTimeout(() => {
          handleLogout();
        }, 15 * 60 * 1000); // 15 minutes
      }
    };

    if (user) {
      resetTimer();
      window.addEventListener('mousemove', resetTimer);
      window.addEventListener('keydown', resetTimer);
      window.addEventListener('click', resetTimer);
      window.addEventListener('scroll', resetTimer);
    }

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('click', resetTimer);
      window.removeEventListener('scroll', resetTimer);
    };
  }, [user]);

  // --- Derived Data / Helpers ---
  const currentSchemes = schemes;
  const currentSectors = sectors;
  const currentActivities = activities;
  const currentSubActivities = subActivities;
  const currentSoes = soes;
  const currentSoeBudgets = useMemo(() => soeBudgets.filter(b => (b.fyId || fys[0]?.id) === selectedFyId), [soeBudgets, selectedFyId, fys]);
  
  const userRangeId = useMemo(() => {
    if (userRole && ['Sarahan', 'Narag', 'Habban', 'Rajgarh'].includes(userRole)) {
      return ranges.find(r => r.name === userRole)?.id;
    }
    return null;
  }, [userRole, ranges]);

  const baseAllocations = useMemo(() => {
    let filtered = allocations.filter(a => (a.fyId || fys[0]?.id) === selectedFyId);
    if (userRangeId) {
      filtered = filtered.filter(a => a.rangeId === userRangeId);
    }
    return filtered;
  }, [allocations, selectedFyId, userRangeId]);

  const currentAllocations = useMemo(() => {
    let filtered = baseAllocations;
    
    if (allocFilters.schemeId) {
      filtered = filtered.filter(a => a.schemeId === allocFilters.schemeId);
    }
    if (allocFilters.activityId) {
      filtered = filtered.filter(a => a.activityId === allocFilters.activityId);
    }
    if (allocFilters.rangeId) {
      filtered = filtered.filter(a => a.rangeId === allocFilters.rangeId);
    }
    return filtered;
  }, [baseAllocations, allocFilters]);
  
  const currentExpenses = useMemo(() => {
    let filtered = expenses.filter(e => (e.fyId || fys[0]?.id) === selectedFyId);
    
    if (userRangeId) {
      const userAllocIds = currentAllocations.map(a => a.id);
      filtered = filtered.filter(e => userAllocIds.includes(e.allocationId));
    }

    if (expDateRange.start) filtered = filtered.filter(e => e.date >= expDateRange.start);
    if (expDateRange.end) filtered = filtered.filter(e => e.date <= expDateRange.end);
    
    if (expFilters.schemeId) {
      filtered = filtered.filter(e => {
        const alloc = allocations.find(a => a.id === e.allocationId);
        return alloc?.schemeId === expFilters.schemeId;
      });
    }
    
    if (expFilters.sectorId) {
      filtered = filtered.filter(e => {
        const alloc = allocations.find(a => a.id === e.allocationId);
        return alloc?.sectorId === expFilters.sectorId;
      });
    }
    
    if (expFilters.activityId) {
      filtered = filtered.filter(e => {
        const alloc = allocations.find(a => a.id === e.allocationId);
        return alloc?.activityId === expFilters.activityId;
      });
    }

    return filtered;
  }, [expenses, currentAllocations, expDateRange, expFilters, allocations, userRangeId, selectedFyId]);

  const getSoeAllocated = (soeId: string) => currentAllocations.filter(a => a.soeId === soeId).reduce((sum, a) => sum + a.amount, 0);
  const getAllocSpent = (allocId: string) => currentExpenses.filter(e => e.allocationId === allocId).reduce((sum, e) => sum + e.amount, 0);

  const totalAllocated = currentAllocations.reduce((sum, a) => sum + a.amount, 0);
  const totalSpent = currentExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalBudget = userRangeId ? totalAllocated : currentSoeBudgets.reduce((sum, s) => sum + s.budgetLimit, 0);
  const remainingBalance = userRangeId ? totalAllocated - totalSpent : totalBudget - totalSpent;

  const chartData = userRangeId ? [
    { name: 'Allocated (Unspent)', value: Math.max(0, totalAllocated - totalSpent), color: '#007bff' },
    { name: 'Spent', value: totalSpent, color: '#dc3545' }
  ] : [
    { name: 'Allocated (Unspent)', value: Math.max(0, totalAllocated - totalSpent), color: '#007bff' },
    { name: 'Spent', value: totalSpent, color: '#dc3545' },
    { name: 'Unallocated', value: Math.max(0, totalBudget - totalAllocated), color: '#28a745' }
  ];

  // --- Render Functions for Tabs ---
  const renderDashboard = () => {
    const rangeAllocationMap: Record<string, any> = {};
    currentAllocations.forEach(alloc => {
      const key = `${alloc.rangeId}-${alloc.schemeId}-${alloc.sectorId}-${alloc.activityId}`;
      const spent = currentExpenses.filter(e => e.allocationId === alloc.id).reduce((sum, e) => sum + e.amount, 0);
      
      if (rangeAllocationMap[key]) {
        const existing = rangeAllocationMap[key];
        existing.allocated += alloc.amount;
        existing.spent += spent;
        existing.balance = existing.allocated - existing.spent;
      } else {
        const r = ranges.find(r => r.id === alloc.rangeId);
        const sch = currentSchemes.find(s => s.id === alloc.schemeId);
        const sec = currentSectors.find(s => s.id === alloc.sectorId);
        const act = currentActivities.find(a => a.id === alloc.activityId);
        
        rangeAllocationMap[key] = {
          range: r?.name || 'N/A',
          scheme: sch?.name || 'N/A',
          sector: sec?.name || 'N/A',
          activity: act?.name || 'N/A',
          allocated: alloc.amount,
          spent: spent,
          balance: alloc.amount - spent
        };
      }
    });
    
    const rangeAllocationSummary = Object.values(rangeAllocationMap).sort((a, b) => {
      return a.range.localeCompare(b.range) || a.scheme.localeCompare(b.scheme) || a.sector.localeCompare(b.sector) || a.activity.localeCompare(b.activity);
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

    const schemeSummary = currentSchemes.map(sch => {
      const schAllocations = currentAllocations.filter(a => a.schemeId === sch.id);
      const totalAllocated = schAllocations.reduce((sum, a) => sum + a.amount, 0);
      const totalSpent = currentExpenses.filter(e => schAllocations.some(a => a.id === e.allocationId)).reduce((sum, e) => sum + e.amount, 0);
      
      const schemeSoes = currentSoes.filter(s => {
        if (s.schemeId === sch.id) return true;
        if (s.sectorId) return currentSectors.find(sec => sec.id === s.sectorId)?.schemeId === sch.id;
        if (s.activityId) {
          const act = currentActivities.find(a => a.id === s.activityId);
          return act?.schemeId === sch.id || currentSectors.find(sec => sec.id === act?.sectorId)?.schemeId === sch.id;
        }
        if (s.subActivityId) {
          const sa = currentSubActivities.find(sa => sa.id === s.subActivityId);
          const act = currentActivities.find(a => a.id === sa?.activityId);
          return act?.schemeId === sch.id || currentSectors.find(sec => sec.id === act?.sectorId)?.schemeId === sch.id;
        }
        return false;
      });

      const totalSoeBudget = schemeSoes.reduce((sum, s) => {
        const b = currentSoeBudgets.find(b => b.soeId === s.id);
        return sum + (b?.budgetLimit || 0);
      }, 0);

      const displayBudget = userRangeId ? totalAllocated : totalSoeBudget;

      return {
        name: sch.name,
        budget: displayBudget,
        allocated: totalAllocated,
        spent: totalSpent,
        balance: totalAllocated - totalSpent
      };
    });

    const sectorSummary = currentSectors.map(sec => {
      const secAllocations = currentAllocations.filter(a => a.sectorId === sec.id);
      const totalAllocated = secAllocations.reduce((sum, a) => sum + a.amount, 0);
      const totalSpent = currentExpenses.filter(e => secAllocations.some(a => a.id === e.allocationId)).reduce((sum, e) => sum + e.amount, 0);
      
      return {
        name: sec.name,
        allocated: totalAllocated,
        spent: totalSpent,
        balance: totalAllocated - totalSpent
      };
    });

    const activitySummary = currentActivities.map(act => {
      const sec = currentSectors.find(s => s.id === act.sectorId);
      const sch = currentSchemes.find(s => s.id === (sec ? sec.schemeId : act.schemeId));

      const actAllocations = currentAllocations.filter(a => a.activityId === act.id);
      const totalAllocated = actAllocations.reduce((sum, a) => sum + a.amount, 0);
      const totalSpent = currentExpenses.filter(e => actAllocations.some(a => a.id === e.allocationId)).reduce((sum, e) => sum + e.amount, 0);
      
      return {
        scheme: sch?.name || 'N/A',
        sector: sec?.name || 'N/A',
        name: act.name,
        allocated: totalAllocated,
        spent: totalSpent,
        balance: totalAllocated - totalSpent
      };
    }).sort((a, b) => {
      const aHasEntry = a.allocated > 0 || a.spent > 0 ? 1 : 0;
      const bHasEntry = b.allocated > 0 || b.spent > 0 ? 1 : 0;
      if (aHasEntry !== bHasEntry) return bHasEntry - aHasEntry;
      return a.scheme.localeCompare(b.scheme) || a.sector.localeCompare(b.sector) || a.name.localeCompare(b.name);
    });

    return (
      <div className="space-y-6">
        <div className={`grid grid-cols-1 md:grid-cols-2 ${userRangeId ? 'lg:grid-cols-4' : 'lg:grid-cols-5'} gap-6`}>
          <StatCard title={userRangeId ? "Total Allocation" : "Total SOE Budget"} amount={totalBudget} icon={<Wallet />} color="text-blue-600" />
          <StatCard title="Total Allocated" amount={totalAllocated} icon={<Map />} color="text-indigo-600" />
          {!userRangeId && <StatCard title="To Be Allocated" amount={Math.max(0, totalBudget - totalAllocated)} icon={<IndianRupee />} color="text-orange-500" />}
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
              <Activity className="h-5 w-5 text-gray-500" /> Scheme-wise Budget
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={schemeSummary} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `₹${val/1000}k`} />
                  <Tooltip formatter={(value: number) => `₹${value.toLocaleString()}`} cursor={{fill: '#f3f4f6'}} />
                  <Legend />
                  <Bar dataKey="allocated" name="Allocated" fill="#007bff" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="spent" name="Spent" fill="#dc3545" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="balance" name="Balance" fill="#28a745" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 border-b pb-2">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Table className="h-5 w-5 text-gray-500" /> Budget Abstract (Scheme/Sector/Activity)
            </h3>
            <div className="relative w-full md:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search budget..." 
                value={dashboardSearch}
                onChange={(e) => setDashboardSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-600 font-semibold">
                  <th className="p-3 border-b">Scheme</th>
                  <th className="p-3 border-b">Sector</th>
                  <th className="p-3 border-b">Activity</th>
                  <th className="p-3 border-b text-right">Allocated</th>
                  <th className="p-3 border-b text-right">Spent</th>
                  <th className="p-3 border-b text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {activitySummary
                  .filter(act => 
                    act.scheme.toLowerCase().includes(dashboardSearch.toLowerCase()) ||
                    act.sector.toLowerCase().includes(dashboardSearch.toLowerCase()) ||
                    act.name.toLowerCase().includes(dashboardSearch.toLowerCase())
                  )
                  .slice(0, showAllBudget ? undefined : 5)
                  .map((act, idx) => (
                    <tr key={idx} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="p-3 text-xs text-gray-500">{act.scheme}</td>
                      <td className="p-3 text-xs text-gray-500">{act.sector}</td>
                      <td className="p-3 font-medium text-gray-800">{act.name}</td>
                      <td className="p-3 text-right font-mono text-blue-600">₹{act.allocated.toLocaleString()}</td>
                      <td className="p-3 text-right font-mono text-red-600">₹{act.spent.toLocaleString()}</td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-600">₹{act.balance.toLocaleString()}</td>
                    </tr>
                  ))}
                {activitySummary.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-400 italic">No budget data found for this Financial Year.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {activitySummary.length > 5 && (
            <div className="mt-4 text-center">
              <button 
                onClick={() => setShowAllBudget(!showAllBudget)}
                className="text-emerald-600 font-semibold hover:text-emerald-700 transition-colors flex items-center gap-1 mx-auto"
              >
                {showAllBudget ? 'Show Less' : 'Read More'}
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold mb-4 border-b pb-2 flex items-center gap-2">
              <Activity className="h-5 w-5 text-gray-500" /> Sector-wise Budget
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sectorSummary} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `₹${val/1000}k`} />
                  <Tooltip formatter={(value: number) => `₹${value.toLocaleString()}`} cursor={{fill: '#f3f4f6'}} />
                  <Legend />
                  <Bar dataKey="allocated" name="Allocated" fill="#007bff" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="spent" name="Spent" fill="#dc3545" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="balance" name="Balance" fill="#28a745" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold mb-4 border-b pb-2 flex items-center gap-2">
              <Table className="h-5 w-5 text-gray-500" /> Scheme-wise Budget
            </h3>
            <div className="overflow-x-auto h-64">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="sticky top-0 bg-white shadow-sm">
                  <tr className="bg-gray-50 text-gray-600 font-semibold">
                    <th className="p-3 border-b">Scheme</th>
                    {!userRangeId && <th className="p-3 border-b text-right">SOE Budget</th>}
                    <th className="p-3 border-b text-right">Allocation</th>
                    <th className="p-3 border-b text-right">Expenditure</th>
                    <th className="p-3 border-b text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {schemeSummary.map((sch, idx) => (
                    <tr key={idx} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-medium text-gray-800">{sch.name}</td>
                      {!userRangeId && <td className="p-3 text-right">₹{sch.budget.toLocaleString()}</td>}
                      <td className="p-3 text-right text-blue-600">₹{sch.allocated.toLocaleString()}</td>
                      <td className="p-3 text-right text-red-600">₹{sch.spent.toLocaleString()}</td>
                      <td className="p-3 text-right text-emerald-600 font-medium">₹{sch.balance.toLocaleString()}</td>
                    </tr>
                  ))}
                  {schemeSummary.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-gray-500">No scheme data available</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-2">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 border-b pb-2">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Table className="h-5 w-5 text-gray-500" /> Range-wise Allocation Summary
              </h3>
              <div className="relative w-full md:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Search range..." 
                  value={rangeSearch}
                  onChange={(e) => setRangeSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-600 font-semibold">
                    <th className="p-3 border-b">Range</th>
                    <th className="p-3 border-b">Scheme</th>
                    <th className="p-3 border-b">Sector</th>
                    <th className="p-3 border-b">Activity</th>
                    <th className="p-3 border-b text-right">Allocated</th>
                    <th className="p-3 border-b text-right">Spent</th>
                    <th className="p-3 border-b text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {rangeAllocationSummary
                    .filter(r => 
                      r.range.toLowerCase().includes(rangeSearch.toLowerCase()) ||
                      r.scheme.toLowerCase().includes(rangeSearch.toLowerCase()) ||
                      r.sector.toLowerCase().includes(rangeSearch.toLowerCase()) ||
                      r.activity.toLowerCase().includes(rangeSearch.toLowerCase())
                    )
                    .slice(0, showAllRange ? undefined : 5)
                    .map((r, idx) => (
                      <tr key={idx} className="border-b hover:bg-gray-50 transition-colors">
                        <td className="p-3 font-medium text-gray-800">{r.range}</td>
                        <td className="p-3 text-xs text-gray-500">{r.scheme}</td>
                        <td className="p-3 text-xs text-gray-500">{r.sector}</td>
                        <td className="p-3 text-xs text-gray-500">{r.activity}</td>
                        <td className="p-3 text-right font-mono text-blue-600">₹{r.allocated.toLocaleString()}</td>
                        <td className="p-3 text-right font-mono text-red-600">₹{r.spent.toLocaleString()}</td>
                        <td className="p-3 text-right font-mono font-bold text-emerald-600">₹{r.balance.toLocaleString()}</td>
                      </tr>
                    ))}
                  {rangeAllocationSummary.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-4 text-center text-gray-500">No allocations found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {rangeAllocationSummary.length > 5 && (
              <div className="mt-4 text-center">
                <button 
                  onClick={() => setShowAllRange(!showAllRange)}
                  className="text-emerald-600 hover:text-emerald-700 font-medium text-sm"
                >
                  {showAllRange ? 'Show Less' : `View All (${rangeAllocationSummary.length})`}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-2">
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
                        <td className="p-3">{exp.date ? exp.date.split('-').reverse().join('/') : ''}</td>
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
    onEdit: (item: any) => void,
    canEditDelete?: (item: any) => boolean
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
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-1 h-fit lg:sticky lg:top-6">
          <div 
            className="flex justify-between items-center mb-4 border-b pb-2 cursor-pointer hover:bg-gray-50 -mx-6 px-6 pt-2" 
            onClick={() => setIsFormExpanded(!isFormExpanded)}
          >
            <h3 className="text-lg font-semibold">
              {editingItem?.type === title ? `Edit ${title}` : `Add ${title}`}
            </h3>
            <button type="button" className="text-gray-500 hover:text-gray-700">
              {isFormExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
          </div>
          <div className={`${isFormExpanded ? 'block' : 'hidden'}`}>
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
                {(canEditDelete ? items.some(canEditDelete) : (userRole === 'admin' || title === 'Expenditure')) && <th className="p-3 border-b text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filteredItems.map(item => (
                <tr key={item.id} className="border-b last:border-0 hover:bg-gray-50">
                  {columns.map(c => <td key={c.key} className="p-3">{c.render ? c.render(item[c.key], item) : item[c.key]}</td>)}
                  {(canEditDelete ? items.some(canEditDelete) : (userRole === 'admin' || title === 'Expenditure')) && (
                    <td className="p-3 text-right flex justify-end gap-2">
                      {(canEditDelete ? canEditDelete(item) : (userRole === 'admin' || title === 'Expenditure')) && (
                        <>
                          <button 
                            onClick={() => {
                              onEdit(item);
                              setIsFormExpanded(true);
                            }} 
                            className="text-blue-500 hover:text-blue-700 p-1"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4"/>
                          </button>
                          <button 
                            onClick={() => onDelete(item.id)} 
                            className="text-red-500 hover:text-red-700 p-1"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4"/>
                          </button>
                        </>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {filteredItems.length === 0 && <tr><td colSpan={columns.length + ((canEditDelete ? items.some(canEditDelete) : (userRole === 'admin' || title === 'Expenditure')) ? 1 : 0)} className="p-4 text-center text-gray-500">No records found.</td></tr>}
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
    try {
      if (editingItem?.type === 'Scheme') {
        await updateDoc(doc(db, 'schemes', editingItem.item.id), { name });
        setEditingItem(null);
      } else {
        await addDoc(collection(db, 'schemes'), { name });
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
        await addDoc(collection(db, 'activities'), { sectorId, schemeId, name });
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
    const schemeId = e.target.schemeId.value || null;
    const sectorId = e.target.sectorId.value || null;
    const activityId = e.target.activityId.value || null;
    const subActivityId = e.target.subActivityId.value || null;
    const targetFyId = selectedFyId || fys[0]?.id;

    try {
      let soeId = editingItem?.item?.id;
      if (editingItem?.type === 'SOE Head') {
        await updateDoc(doc(db, 'soeHeads', soeId), { name, schemeId, sectorId, activityId, subActivityId });
        // Find existing budget for this FY
        const existingBudget = soeBudgets.find(b => b.soeId === soeId && (b.fyId || fys[0]?.id) === targetFyId);
        if (existingBudget) {
          await updateDoc(doc(db, 'soeBudgets', existingBudget.id), { budgetLimit });
        } else {
          await addDoc(collection(db, 'soeBudgets'), { soeId, fyId: targetFyId, budgetLimit });
        }
        setEditingItem(null);
      } else {
        // Check if SOE Head already exists globally
        const existingSoe = soes.find(s => 
          s.name.toLowerCase() === name.toLowerCase() && 
          (s.schemeId || null) === schemeId && 
          (s.sectorId || null) === sectorId && 
          (s.activityId || null) === activityId && 
          (s.subActivityId || null) === subActivityId
        );
        if (existingSoe) {
          soeId = existingSoe.id;
        } else {
          const newSoeRef = await addDoc(collection(db, 'soeHeads'), { name, schemeId, sectorId, activityId, subActivityId });
          soeId = newSoeRef.id;
        }
        
        // Add or update budget for this FY
        const existingBudget = soeBudgets.find(b => b.soeId === soeId && (b.fyId || fys[0]?.id) === targetFyId);
        if (existingBudget) {
          await updateDoc(doc(db, 'soeBudgets', existingBudget.id), { budgetLimit });
        } else {
          await addDoc(collection(db, 'soeBudgets'), { soeId, fyId: targetFyId, budgetLimit });
        }
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
    const schemeId = e.target.schemeId.value || null;
    const sectorId = e.target.sectorId.value || null;
    const activityId = e.target.activityId.value || null;
    const subActivityId = e.target.subActivityId.value || null;
    const targetFyId = selectedFyId || fys[0]?.id;
    
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid positive amount.");
      return;
    }
    
    const soe = soes.find(s => s.id === soeId);
    if (!soe) return;
    const soeBudget = currentSoeBudgets.find(b => b.soeId === soeId)?.budgetLimit || 0;

    const currentAllocated = baseAllocations
      .filter(a => a.soeId === soeId && (editingItem?.type === 'Allocation' ? a.id !== editingItem.item.id : true))
      .reduce((sum, a) => sum + a.amount, 0);

    const remainingBudget = soeBudget - currentAllocated;

    if (amount > remainingBudget) {
      alert(`Cannot allocate. Amount ₹${amount.toLocaleString()} exceeds the remaining SOE budget of ₹${remainingBudget.toLocaleString()}.`);
      return;
    }

    try {
      if (editingItem?.type === 'Allocation') {
        await updateDoc(doc(db, 'allocations', editingItem.item.id), { soeId, rangeId, amount, schemeId, sectorId, activityId, subActivityId, fyId: targetFyId });
        setEditingItem(null);
      } else {
        await addDoc(collection(db, 'allocations'), { soeId, rangeId, amount, schemeId, sectorId, activityId, subActivityId, fyId: targetFyId });
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
    const targetFyId = selectedFyId || fys[0]?.id;

    const today = new Date().toISOString().split('T')[0];
    if (date > today) {
      alert("Cannot add expenditure for a future date.");
      return;
    }

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
        await updateDoc(doc(db, 'expenditures', editingItem.item.id), { allocationId, amount, date, description, activityId, fyId: targetFyId, rangeId: alloc.rangeId });
        setEditingItem(null);
      } else {
        await addDoc(collection(db, 'expenditures'), { allocationId, amount, date, description, activityId, createdBy: user.uid, fyId: targetFyId, rangeId: alloc.rangeId });
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
        if (collectionName === 'soeHeads') {
          // Also delete associated budgets
          const budgetsToDelete = soeBudgets.filter(b => b.soeId === id);
          for (const b of budgetsToDelete) {
            await deleteDoc(doc(db, 'soeBudgets', b.id));
          }
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, collectionName);
      }
    }
  };

  const handleUserRoleChange = async (userId: string, newRole: 'admin' | 'deo' | 'Sarahan' | 'Narag' | 'Habban' | 'Rajgarh') => {
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

  const handleCreateNewUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail || !newUserPassword) return;
    
    let emailToUse = newUserEmail.trim();
    // If user enters an 8-digit number or any ID without @, append the default domain
    if (!emailToUse.includes('@')) {
      emailToUse = `${emailToUse}@rajgarhforest.app`;
    }

    try {
      // Initialize a secondary app to create user without logging out the admin
      const secondaryApp = initializeApp(firebaseConfig, "Secondary");
      const secondaryAuth = getAuth(secondaryApp);
      
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, emailToUse, newUserPassword);
      
      // Add user to firestore
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        email: emailToUse,
        role: newUserRole
      });
      
      // Sign out the secondary app
      await secondaryAuth.signOut();
      
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserRole('deo');
      alert('User created successfully!');
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        alert(`Error: This User ID / Email already exists in the system. If you deleted them previously, they still exist in the authentication database. You cannot recreate them with the same ID.`);
      } else {
        alert(`Error creating user: ${error.message}`);
      }
    }
  };

  const handleResetPassword = async (email: string) => {
    if (window.confirm(`Send password reset email to ${email}?`)) {
      try {
        await sendPasswordResetEmail(auth, email);
        alert('Password reset email sent!');
      } catch (error: any) {
        alert(`Error sending reset email: ${error.message}`);
      }
    }
  };

  const renderUserManagement = () => (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
      <h3 className="text-lg font-semibold mb-4 border-b pb-2 flex items-center gap-2">
        <Shield className="h-5 w-5 text-emerald-600" /> User Access Management
      </h3>
      
      <div className="mb-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <h4 className="text-md font-medium mb-3">Create New User</h4>
        <form onSubmit={handleCreateNewUser} className="flex flex-col md:flex-row gap-3">
          <input 
            type="text" 
            placeholder="User ID (e.g. 12345678) or Email" 
            value={newUserEmail}
            onChange={(e) => setNewUserEmail(e.target.value)}
            className="p-2 border rounded flex-1"
            required
          />
          <input 
            type="password" 
            placeholder="Password" 
            value={newUserPassword}
            onChange={(e) => setNewUserPassword(e.target.value)}
            className="p-2 border rounded flex-1"
            required
            minLength={6}
          />
          <select 
            value={newUserRole}
            onChange={(e) => setNewUserRole(e.target.value as 'admin' | 'deo' | 'Sarahan' | 'Narag' | 'Habban' | 'Rajgarh')}
            className="p-2 border rounded"
          >
            <option value="admin">Admin</option>
            <option value="deo">DEO</option>
            <option value="Sarahan">Sarahan</option>
            <option value="Narag">Narag</option>
            <option value="Habban">Habban</option>
            <option value="Rajgarh">Rajgarh</option>
          </select>
          <button type="submit" className="bg-emerald-600 text-white px-4 py-2 rounded hover:bg-emerald-700">
            Create User
          </button>
        </form>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 text-gray-600 text-sm">
              <th className="p-3 border-b">User ID</th>
              <th className="p-3 border-b">Email</th>
              <th className="p-3 border-b">Role</th>
              <th className="p-3 border-b text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-b hover:bg-gray-50">
                <td className="p-3 font-mono text-xs text-gray-500">{u.id}</td>
                <td className="p-3">{u.email}</td>
                <td className="p-3">
                  <select 
                    value={u.role} 
                    onChange={(e) => handleUserRoleChange(u.id, e.target.value as 'admin' | 'deo' | 'Sarahan' | 'Narag' | 'Habban' | 'Rajgarh')}
                    className="p-1 border rounded text-sm"
                  >
                    <option value="admin">Admin</option>
                    <option value="deo">DEO</option>
                    <option value="Sarahan">Sarahan</option>
                    <option value="Narag">Narag</option>
                    <option value="Habban">Habban</option>
                    <option value="Rajgarh">Rajgarh</option>
                  </select>
                </td>
                <td className="p-3 text-right flex justify-end gap-2">
                  <button onClick={() => handleResetPassword(u.email)} className="text-blue-500 hover:text-blue-700 text-sm border border-blue-200 px-2 py-1 rounded">
                    Reset Password
                  </button>
                  <button onClick={() => handleDeleteUser(u.id)} className="text-red-500 hover:text-red-700 p-1">
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

    const downloadZip = async () => {
      const zip = new JSZip();
      
      // 1. Allocations
      const allocHeaders = ['ID', 'SOE', 'Range', 'Amount', 'Scheme', 'Sector', 'Activity', 'SubActivity'];
      const allocData = currentAllocations.map(a => [
        a.id,
        soes.find(s => s.id === a.soeId)?.name || 'N/A',
        ranges.find(r => r.id === a.rangeId)?.name || 'N/A',
        a.amount,
        schemes.find(s => s.id === a.schemeId)?.name || 'N/A',
        sectors.find(s => s.id === a.sectorId)?.name || 'N/A',
        activities.find(ac => ac.id === a.activityId)?.name || 'N/A',
        subActivities.find(sa => sa.id === a.subActivityId)?.name || 'N/A'
      ]);
      const allocWs = XLSX.utils.aoa_to_sheet([allocHeaders, ...allocData]);
      const allocCsv = XLSX.utils.sheet_to_csv(allocWs);
      zip.file("allocations.csv", allocCsv);

      // 2. Expenses
      const expHeaders = ['ID', 'Date', 'Amount', 'Description', 'Allocation ID'];
      const expData = currentExpenses.map(e => [
        e.id, e.date ? e.date.split('-').reverse().join('/') : '', e.amount, e.description, e.allocationId
      ]);
      const expWs = XLSX.utils.aoa_to_sheet([expHeaders, ...expData]);
      const expCsv = XLSX.utils.sheet_to_csv(expWs);
      zip.file("expenses.csv", expCsv);

      // 3. SOE Summary
      const soeHeaders = ['SOE ID', 'Name', 'Budget Limit', 'Allocated', 'Spent', 'Remaining'];
      const soeData = currentSoes.map(s => {
        const allocated = getSoeAllocated(s.id);
        const spent = currentAllocations.filter(a => a.soeId === s.id).reduce((sum, a) => sum + getAllocSpent(a.id), 0);
        return [s.id, s.name, currentSoeBudgets.find(b => b.soeId === s.id)?.budgetLimit || 0, allocated, spent, (currentSoeBudgets.find(b => b.soeId === s.id)?.budgetLimit || 0) - allocated];
      });
      const soeWs = XLSX.utils.aoa_to_sheet([soeHeaders, ...soeData]);
      const soeCsv = XLSX.utils.sheet_to_csv(soeWs);
      zip.file("soe_summary.csv", soeCsv);

      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `financial_data_fy_${fys.find(f => f.id === selectedFyId)?.name || 'export'}.zip`);
    };

    const comprehensiveReportData = currentAllocations.map(a => {
      const soe = soes.find(s => s.id === a.soeId);
      const range = ranges.find(r => r.id === a.rangeId);
      
      let sa = subActivities.find(s => s.id === a.subActivityId);
      let act = activities.find(ac => ac.id === a.activityId);
      let sec = sectors.find(s => s.id === a.sectorId);
      let sch = schemes.find(s => s.id === a.schemeId);

      const totalBudget = userRangeId ? a.amount : (currentSoeBudgets.find(b => b.soeId === soe?.id)?.budgetLimit || 0);
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

    const sortedData = [...comprehensiveReportData].sort((a, b) => {
      if (a.scheme !== b.scheme) return a.scheme.localeCompare(b.scheme);
      if (a.sector !== b.sector) return a.sector.localeCompare(b.sector);
      if (a.activity !== b.activity) return a.activity.localeCompare(b.activity);
      return a.subActivity.localeCompare(b.subActivity);
    });

    const groupedData = [];
    let currentScheme = null;
    let schemeTotal = { allocated: 0, expenditure: 0, remaining: 0, totalBudget: 0 };

    sortedData.forEach(row => {
      if (currentScheme !== null && currentScheme !== row.scheme) {
        groupedData.push({ 
          range: '', 
          scheme: `${currentScheme} Total`, 
          sector: '', 
          activity: '', 
          subActivity: '', 
          soe: '', 
          ...schemeTotal, 
          isTotal: true 
        });
        schemeTotal = { allocated: 0, expenditure: 0, remaining: 0, totalBudget: 0 };
      }
      currentScheme = row.scheme;
      groupedData.push(row);
      schemeTotal.allocated += row.allocated;
      schemeTotal.expenditure += row.expenditure;
      schemeTotal.remaining += row.remaining;
      schemeTotal.totalBudget += row.totalBudget;
    });
    if (currentScheme !== null) {
      groupedData.push({ 
        range: '', 
        scheme: `${currentScheme} Total`, 
        sector: '', 
        activity: '', 
        subActivity: '', 
        soe: '', 
        ...schemeTotal, 
        isTotal: true 
      });
    }

    const headers = userRangeId 
      ? ['Range', 'Scheme', 'Sector', 'Activity', 'Sub-Activity', 'SOE Head', 'Allocated', 'Expenditure', 'Remaining']
      : ['Range', 'Scheme', 'Sector', 'Activity', 'Sub-Activity', 'SOE Head', 'Total Budget', 'Allocated', 'Expenditure', 'Remaining'];
    
    const tableData = groupedData.map(row => userRangeId 
      ? [row.range, row.scheme, row.sector, row.activity, row.subActivity, row.soe, row.allocated, row.expenditure, row.remaining]
      : [row.range, row.scheme, row.sector, row.activity, row.subActivity, row.soe, row.totalBudget, row.allocated, row.expenditure, row.remaining]
    );

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
              <button 
                onClick={downloadZip}
                className="bg-blue-600 text-white px-4 py-2 rounded flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors"
              >
                <Download className="w-4 h-4" /> Export All Data (ZIP)
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-300">
                  {headers.map(h => <th key={h} className="p-3 text-sm font-semibold text-gray-700 border border-gray-300">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {groupedData.map((row, i) => (
                  <tr key={i} className={`border-b border-gray-300 ${row.isTotal ? 'bg-gray-100 font-bold' : 'hover:bg-gray-50'}`}>
                    <td className="p-3 text-sm border border-gray-300">{row.range}</td>
                    <td className="p-3 text-sm border border-gray-300">{row.scheme}</td>
                    <td className="p-3 text-sm border border-gray-300">{row.sector}</td>
                    <td className="p-3 text-sm border border-gray-300">{row.activity}</td>
                    <td className="p-3 text-sm border border-gray-300">{row.subActivity}</td>
                    <td className="p-3 text-sm font-medium border border-gray-300">{row.soe}</td>
                    {!userRangeId && <td className="p-3 text-sm text-right text-gray-600 border border-gray-300">₹{row.totalBudget.toLocaleString()}</td>}
                    <td className="p-3 text-sm text-right text-emerald-700 font-medium border border-gray-300">₹{row.allocated.toLocaleString()}</td>
                    <td className="p-3 text-sm text-right text-red-700 font-medium border border-gray-300">₹{row.expenditure.toLocaleString()}</td>
                    <td className="p-3 text-sm text-right text-blue-700 font-bold border border-gray-300">₹{row.remaining.toLocaleString()}</td>
                  </tr>
                ))}
                {groupedData.length === 0 && (
                  <tr>
                    <td colSpan={userRangeId ? 9 : 10} className="p-8 text-center text-gray-500 border border-gray-300">No data available for the selected Financial Year.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-emerald-50">
        <div className="animate-pulse flex flex-col items-center">
          <TreePine className="h-20 w-20 text-emerald-600 mb-4" />
          <h2 className="text-xl font-semibold text-emerald-800">Forest Budget Control</h2>
          <p className="text-emerald-600/70 mt-2">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100 max-w-md w-full text-center space-y-6">
          <img src="/logo.png" alt="Forest Budget Logo" className="h-16 w-auto mx-auto object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }} />
          <Landmark className="h-16 w-16 text-emerald-600 mx-auto hidden" />
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
            </div>

            <button 
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-3 transition-all transform hover:scale-[1.02]"
            >
              Sign In
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
    <div className="min-h-screen bg-gray-50 p-4 md:p-6 font-sans text-gray-800">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div 
            className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => {
              setActiveTab('Dashboard');
              setSearchTerm('');
              setIsFormExpanded(window.innerWidth > 1024);
            }}
          >
            <img src="/logo.png" alt="Forest Budget Logo" className="h-10 w-auto object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }} />
            <Landmark className="h-10 w-10 text-emerald-600 hidden" />
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 leading-tight">Forest Budget Control</h1>
              <p className="text-xs md:text-sm text-gray-500">Financial Management System</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 justify-between md:justify-end">
            <div className="flex items-center gap-2 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-100">
              <span className="text-sm font-semibold text-emerald-800">FY:</span>
              <select 
                value={selectedFyId} 
                onChange={(e) => setSelectedFyId(e.target.value)}
                className="bg-transparent border-none focus:ring-0 text-emerald-700 font-bold cursor-pointer text-sm"
              >
                {fys.map(fy => <option key={fy.id} value={fy.id}>{fy.name}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-2">
              {userRole === 'admin' && currentSchemes.length === 0 && (
                <button
                  onClick={async () => {
                    await preloadDatabase(selectedFyId);
                    alert('Preloaded data added successfully!');
                  }}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm text-sm"
                >
                  Load Preloaded Data
                </button>
              )}
              {isInstallable && (
                <button
                  onClick={handleInstallClick}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm text-sm"
                >
                  <Download className="w-4 h-4" />
                  Install
                </button>
              )}
              <div className="flex items-center gap-3 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200 ml-2">
                <div className="flex items-center gap-2">
                  <div className="bg-emerald-100 p-1.5 rounded-full">
                    <User className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-gray-800 leading-none">{user.displayName || user.email?.split('@')[0]}</span>
                    <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">{userRole}</span>
                  </div>
                </div>
                <div className="w-px h-6 bg-gray-300 mx-1"></div>
                <button 
                  onClick={handleLogout}
                  className="flex items-center gap-1 text-gray-500 hover:text-red-600 transition-colors text-sm font-medium"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="bg-gray-800 rounded-lg shadow-sm mb-6 overflow-hidden">
          <div className="lg:hidden flex items-center justify-between p-4 border-b border-gray-700">
            <span className="text-white font-medium">Menu: {activeTab}</span>
            <button 
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-2 text-gray-400 hover:text-white transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>
          
          <div className={`${menuOpen ? 'flex' : 'hidden'} lg:flex flex-col lg:flex-row flex-wrap gap-1 p-2`}>
            {(userRole === 'admin' ? [
              'Dashboard', 'Financial Years', 'Ranges', 'Schemes', 'Sectors', 'Activities', 'Sub-Activities', 
              'SOE Heads', 'Allocations', 'Expenditures', 'Ledger', 'Reports', 'Users'
            ] : [
              'Dashboard', 'Allocations', 'Expenditures', 'Ledger', 'Reports'
            ]).map((item) => (
              <button 
                key={item} 
                id={`tab-${item}`}
                onClick={() => {
                  setActiveTab(item);
                  setSearchTerm('');
                  setMenuOpen(false);
                  setIsFormExpanded(window.innerWidth > 1024);
                }}
                className={`px-4 py-2.5 text-sm font-medium rounded transition-all text-left lg:text-center flex items-center gap-2 ${activeTab === item ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}
              >
                {item === 'Dashboard' && <Home className="w-4 h-4" />}
                {item}
              </button>
            ))}
          </div>
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
            {key: 'name', label: 'Scheme Name'}
          ], 
          handleAddScheme, 
          (id) => handleDelete('schemes', id), 
          <>
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
                {currentSchemes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
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
            schemes={currentSchemes} 
            sectors={currentSectors} 
            editingItem={editingItem} 
          />,
          (item) => setEditingItem({ type: 'Activity', item })
        )}

        {activeTab === 'Sub-Activities' && renderSimpleManager(
          'Sub-Activity', 
          subActivities, 
          [
            {key: 'activityId', label: 'Hierarchy', 
              searchableText: (val) => {
                const act = activities.find(a => a.id === val);
                const sec = sectors.find(s => s.id === act?.sectorId);
                const sch = schemes.find(s => s.id === (act?.schemeId || sec?.schemeId));
                let text = '';
                if (sch) text += `[${sch.name}] `;
                if (sec) text += `${sec.name} > `;
                if (act) text += act.name;
                return text;
              },
              render: (val) => {
                const act = activities.find(a => a.id === val);
                const sec = sectors.find(s => s.id === act?.sectorId);
                const sch = schemes.find(s => s.id === (act?.schemeId || sec?.schemeId));
                return (
                  <div className="text-xs text-gray-500">
                    {sch && <div className="font-medium text-gray-700">{sch.name}</div>}
                    {sec && <div>Sector: {sec.name}</div>}
                    {act && <div>Activity: {act.name}</div>}
                  </div>
                );
            }},
            {key: 'name', label: 'Sub-Activity Name'}
          ], 
          handleAddSubActivity, 
          (id) => handleDelete('subActivities', id), 
          <CascadingDropdowns 
            schemes={currentSchemes} sectors={currentSectors} activities={currentActivities} subActivities={currentSubActivities} soes={soes} soeBudgets={currentSoeBudgets} allocations={baseAllocations} ranges={ranges} expenses={currentExpenses}
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
            {key: 'hierarchy', label: 'Hierarchy', render: (_, item) => {
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
              } else if (item.sectorId) {
                const sec = sectors.find(sec => sec.id === item.sectorId);
                const sch = schemes.find(sc => sc.id === sec?.schemeId);
                hierarchy = [sch?.name, sec?.name].filter(Boolean).join(' -> ');
              } else if (item.schemeId) {
                const sch = schemes.find(sc => sc.id === item.schemeId);
                hierarchy = sch?.name || '';
              }
              return <span className="text-xs text-gray-500">{hierarchy || 'Global (No Hierarchy)'}</span>;
            }},
            {key: 'name', label: 'SOE Name'},
            {key: 'budgetLimit', label: 'Budget Limit', searchableText: (val, item) => String(currentSoeBudgets.find(b => b.soeId === item.id)?.budgetLimit || 0), render: (_, item) => `₹${(currentSoeBudgets.find(b => b.soeId === item.id)?.budgetLimit || 0).toLocaleString()}`},
            {key: 'allocated', label: 'Allocated', render: (_, item) => {
                const allocated = currentAllocations.filter(a => a.soeId === item.id).reduce((sum, a) => sum + a.amount, 0);
                return `₹${allocated.toLocaleString()}`;
            }},
            {key: 'remaining', label: 'Remaining', render: (_, item) => {
                const limit = currentSoeBudgets.find(b => b.soeId === item.id)?.budgetLimit || 0;
                const allocated = currentAllocations.filter(a => a.soeId === item.id).reduce((sum, a) => sum + a.amount, 0);
                return `₹${(limit - allocated).toLocaleString()}`;
            }}
          ], 
          handleAddSoe, 
          (id) => handleDelete('soeHeads', id), 
          <CascadingDropdowns 
            schemes={currentSchemes} sectors={currentSectors} activities={currentActivities} subActivities={currentSubActivities} soes={soes} soeBudgets={currentSoeBudgets} allocations={baseAllocations} ranges={ranges} expenses={currentExpenses}
            editingItem={editingItem} type="SOE Head"
          >
            <input name="name" required defaultValue={editingItem?.type === 'SOE Head' ? editingItem.item.name : ''} placeholder="SOE Name (e.g. 20 OC)" className="w-full p-2 border rounded" />
            <input name="budgetLimit" type="number" required defaultValue={editingItem?.type === 'SOE Head' ? (currentSoeBudgets.find(b => b.soeId === editingItem.item.id)?.budgetLimit || '') : ''} placeholder="Budget Limit (₹)" className="w-full p-2 border rounded" />
          </CascadingDropdowns>,
          (item) => setEditingItem({ type: 'SOE Head', item })
        )}

        {activeTab === 'Allocations' && renderSimpleManager(
          'Allocation', 
          currentAllocations, 
          [
            {key: 'soeId', label: 'Hierarchy & SOE', 
              searchableText: (val, item) => {
                const s = soes.find(s => s.id === val);
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
                return `[${hierarchy || 'N/A'}] ${s?.name || 'N/A'}`;
              },
              render: (val, item) => {
              const s = soes.find(s => s.id === val);
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
              return (
                <div className="flex flex-col">
                  <span className="text-xs text-gray-500">{hierarchy || 'N/A'}</span>
                  <span className="font-medium text-gray-800">{s?.name || 'N/A'}</span>
                </div>
              );
            }},
            {key: 'rangeId', label: 'Range', render: (val) => ranges.find(r => r.id === val)?.name},
            {key: 'amount', label: 'Allocation Details', 
              searchableText: (val) => String(val),
              render: (val, item) => {
              const soe = soes.find(s => s.id === item.soeId);
              const totalAllocatedForSoe = getSoeAllocated(item.soeId);
              const remaining = (currentSoeBudgets.find(b => b.soeId === soe?.id)?.budgetLimit || 0) - totalAllocatedForSoe;
              
              const parentId = item.subActivityId || item.activityId;
              const isSub = !!item.subActivityId;
              
              const relatedAllocs = currentAllocations.filter(a => {
                const aParentId = a.subActivityId || a.activityId;
                const aIsSub = !!a.subActivityId;
                return a.rangeId === item.rangeId && aParentId === parentId && aIsSub === isSub;
              });
              
              const totalForParentRange = relatedAllocs.reduce((sum, a) => sum + a.amount, 0);
              const breakdown = relatedAllocs.map(a => {
                const aSoe = soes.find(s => s.id === a.soeId);
                return `${aSoe?.name} ${a.amount}`;
              }).join(', ');

              return (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Allocated to Range:</span>
                    <span className="text-emerald-600 font-bold text-base">₹{val.toLocaleString()}</span>
                  </div>
                  <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded border border-gray-100">
                    <div className="flex justify-between mb-1">
                      <span>SOE Total Budget:</span>
                      <span className="font-medium">₹{(currentSoeBudgets.find(b => b.soeId === soe?.id)?.budgetLimit || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between mb-1">
                      <span>Total Allocated (All Ranges):</span>
                      <span className="font-medium text-blue-600">₹{totalAllocatedForSoe.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between border-t pt-1 mt-1">
                      <span className="font-semibold">SOE Balance:</span>
                      <span className={`font-bold ${remaining < 0 ? 'text-red-600' : 'text-emerald-600'}`}>₹{remaining.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="text-[10px] text-gray-400 bg-gray-50 p-1 rounded">
                    <div className="font-semibold text-gray-600">Range Summary:</div>
                    <div>{breakdown}</div>
                    <div className="border-t mt-1 pt-1 font-bold">Total: ₹{totalForParentRange.toLocaleString()}</div>
                  </div>
                </div>
              );
            }}
          ], 
          handleAddAllocation, 
          (id) => handleDelete('allocations', id), 
          <CascadingDropdowns 
            schemes={currentSchemes} sectors={currentSectors} activities={currentActivities} subActivities={currentSubActivities} soes={soes} soeBudgets={currentSoeBudgets} allocations={baseAllocations} ranges={ranges} expenses={currentExpenses}
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
                    {currentSchemes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
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
                    {currentSectors.filter(s => s.schemeId === expFilters.schemeId).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
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
                    {currentActivities.filter(a => {
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
                {key: 'date', label: 'Date', render: (val) => val ? val.split('-').reverse().join('/') : ''},
                {key: 'allocationId', label: 'Hierarchy / Range / SOE', 
                  searchableText: (val, item) => {
                    const al = allocations.find(a => a.id === val);
                    const r = ranges.find(r => r.id === al?.rangeId);
                    const s = soes.find(s => s.id === al?.soeId);
                    let hierarchy = '';
                    if (al?.subActivityId) {
                      const sa = subActivities.find(sa => sa.id === al.subActivityId);
                      const act = activities.find(a => a.id === sa?.activityId);
                      const sec = sectors.find(sec => sec.id === act?.sectorId);
                      const sch = schemes.find(sc => sc.id === (sec ? sec.schemeId : act?.schemeId));
                      hierarchy = [sch?.name, sec?.name, act?.name, sa?.name].filter(Boolean).join(' -> ');
                    } else if (al?.activityId) {
                      const act = activities.find(a => a.id === al.activityId);
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
                  if (al?.subActivityId) {
                    const sa = subActivities.find(sa => sa.id === al.subActivityId);
                    const act = activities.find(a => a.id === sa?.activityId);
                    const sec = sectors.find(sec => sec.id === act?.sectorId);
                    const sch = schemes.find(sc => sc.id === (sec ? sec.schemeId : act?.schemeId));
                    hierarchy = [sch?.name, sec?.name, act?.name, sa?.name].filter(Boolean).join(' -> ');
                  } else if (al?.activityId) {
                    const act = activities.find(a => a.id === al.activityId);
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
                schemes={currentSchemes} sectors={currentSectors} activities={currentActivities} subActivities={currentSubActivities} soes={soes} soeBudgets={currentSoeBudgets} allocations={baseAllocations} ranges={ranges} expenses={currentExpenses}
                editingItem={editingItem} type="Expenditure"
              >
                <input name="amount" type="number" required defaultValue={editingItem?.type === 'Expenditure' ? editingItem.item.amount : ''} placeholder="Amount (₹)" className="w-full p-2 border rounded" />
                <input name="date" type="date" max={new Date().toISOString().split('T')[0]} required defaultValue={editingItem?.type === 'Expenditure' ? editingItem.item.date : new Date().toISOString().split('T')[0]} className="w-full p-2 border rounded" />
                <textarea name="description" required defaultValue={editingItem?.type === 'Expenditure' ? editingItem.item.description : ''} placeholder="Description / Remarks" className="w-full p-2 border rounded" rows={2} />
              </CascadingDropdowns>,
              (item) => setEditingItem({ type: 'Expenditure', item }),
              (item) => {
                if (userRole === 'admin' || userRole === 'deo') return true;
                if (userRangeId) {
                  const alloc = allocations.find(a => a.id === item.allocationId);
                  return alloc?.rangeId === userRangeId;
                }
                return item.createdBy === user?.uid;
              }
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
                    <th className="p-3 border-b">Hierarchy & SOE</th>
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
                    
                    let hierarchy = '';
                    if (alloc.subActivityId) {
                      const sa = subActivities.find(sa => sa.id === alloc.subActivityId);
                      const act = activities.find(a => a.id === sa?.activityId);
                      const sec = sectors.find(sec => sec.id === act?.sectorId);
                      const sch = schemes.find(sc => sc.id === (sec ? sec.schemeId : act?.schemeId));
                      hierarchy = [sch?.name, sec?.name, act?.name, sa?.name].filter(Boolean).join(' -> ');
                    } else if (alloc.activityId) {
                      const act = activities.find(a => a.id === alloc.activityId);
                      const sec = sectors.find(sec => sec.id === act?.sectorId);
                      const sch = schemes.find(sc => sc.id === (sec ? sec.schemeId : act?.schemeId));
                      hierarchy = [sch?.name, sec?.name, act?.name].filter(Boolean).join(' -> ');
                    }
                    
                    const allocExpenses = expenses.filter(e => e.allocationId === alloc.id).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                    
                    let currentBalance = alloc.amount;
                    
                    return (
                      <React.Fragment key={`alloc-${alloc.id}`}>
                        {/* Initial Allocation Row */}
                        <tr className="bg-blue-50/30 border-b">
                          <td className="p-3 text-gray-400">-</td>
                          <td className="p-3 font-medium">{r?.name}</td>
                          <td className="p-3 font-medium">
                            <div className="text-xs text-gray-500">{hierarchy || 'N/A'}</div>
                            <div>{s?.name}</div>
                          </td>
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
                              <td className="p-3">{exp.date ? exp.date.split('-').reverse().join('/') : ''}</td>
                              <td className="p-3">{r?.name}</td>
                              <td className="p-3">
                                <div className="text-xs text-gray-500">{hierarchy || 'N/A'}</div>
                                <div>{s?.name}</div>
                                {exp.activityId && (
                                  <div className="text-[10px] bg-blue-50 text-blue-600 px-1 rounded inline-block mt-1">
                                    Activity: {activities.find(a => a.id === exp.activityId)?.name}
                                  </div>
                                )}
                              </td>
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
  schemes, sectors, activities, subActivities, soes, soeBudgets, allocations, ranges, expenses,
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
        currentSubActivityId = alloc?.subActivityId || '';
        currentActivityId = alloc?.activityId || '';
        currentSectorId = alloc?.sectorId || '';
        currentSchemeId = alloc?.schemeId || '';
      } else if (type === 'Allocation') {
        currentSoeId = item.soeId;
        currentSubActivityId = item.subActivityId || '';
        currentActivityId = item.activityId || '';
        currentSectorId = item.sectorId || '';
        currentSchemeId = item.schemeId || '';
      } else if (type === 'Sub-Activity') {
        currentActivityId = item.activityId;
      } else if (type === 'SOE Head') {
        currentSubActivityId = item.subActivityId || '';
        currentActivityId = item.activityId || '';
        currentSectorId = item.sectorId || '';
        currentSchemeId = item.schemeId || '';
      }

      if (currentSoeId) {
        setSoeId(currentSoeId);
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

  const filteredSchemes = type === 'Expenditure' 
    ? schemes.filter((s: any) => allocations.some((a: any) => a.schemeId === s.id))
    : schemes;

  const filteredSectors = sectors.filter((s: any) => {
    if (s.schemeId !== schemeId) return false;
    if (type === 'Expenditure') return allocations.some((a: any) => a.schemeId === schemeId && a.sectorId === s.id);
    return true;
  });

  const filteredActivities = activities.filter((a: any) => {
    if (sectorId && a.sectorId !== sectorId) return false;
    if (schemeId && a.schemeId !== schemeId) return false;
    if (type === 'Expenditure') return allocations.some((al: any) => al.schemeId === schemeId && al.activityId === a.id && (!sectorId || al.sectorId === sectorId));
    return true;
  });

  const filteredSubActivities = subActivities.filter((sa: any) => {
    if (sa.activityId !== activityId) return false;
    if (type === 'Expenditure') return allocations.some((al: any) => al.schemeId === schemeId && al.activityId === activityId && al.subActivityId === sa.id && (!sectorId || al.sectorId === sectorId));
    return true;
  });

  const filteredSoes = soes.filter((s: any) => {
    if (schemeId && s.schemeId && s.schemeId !== schemeId) return false;
    if (sectorId && s.sectorId && s.sectorId !== sectorId) return false;
    if (activityId && s.activityId && s.activityId !== activityId) return false;
    if (subActivityId && s.subActivityId && s.subActivityId !== subActivityId) return false;
    if (type === 'Expenditure') return allocations.some((al: any) => 
      al.schemeId === schemeId && 
      (!sectorId || al.sectorId === sectorId) && 
      al.activityId === activityId && 
      (!subActivityId || al.subActivityId === subActivityId) && 
      al.soeId === s.id
    );
    return true;
  });
  const filteredAllocations = allocations.filter((a: any) => {
    if (a.soeId !== soeId) return false;
    if (schemeId && a.schemeId !== schemeId) return false;
    if (sectorId && a.sectorId !== sectorId) return false;
    if (activityId && a.activityId !== activityId) return false;
    if (subActivityId && a.subActivityId !== subActivityId) return false;
    return true;
  });

  return (
    <>
      <div className="flex gap-2">
        <select 
          className="w-full p-2 border rounded" 
          value={schemeId} 
          onChange={(e) => { setSchemeId(e.target.value); setSectorId(''); setActivityId(''); setSubActivityId(''); setSoeId(''); setAllocationId(''); }}
          required={type !== 'Activity' && type !== 'SOE Head'}
        >
          <option value="">Select Scheme {type === 'SOE Head' ? '(Optional)' : ''}</option>
          {filteredSchemes.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button type="button" onClick={() => document.getElementById('tab-Schemes')?.click()} className="px-3 bg-gray-100 border rounded hover:bg-gray-200 text-gray-600" title="Add Scheme">+</button>
      </div>

      {(type === 'Activity' || type === 'Sub-Activity' || type === 'SOE Head' || type === 'Allocation' || type === 'Expenditure') && (
        <div className="flex gap-2">
          <select 
            className="w-full p-2 border rounded" 
            value={sectorId} 
            onChange={(e) => { setSectorId(e.target.value); setActivityId(''); setSubActivityId(''); setSoeId(''); setAllocationId(''); }}
          >
            <option value="">Select Sector (Optional)</option>
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
            <option value="">Select Activity {type === 'SOE Head' ? '(Optional)' : ''}</option>
            {filteredActivities.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <button type="button" onClick={() => document.getElementById('tab-Activities')?.click()} className="px-3 bg-gray-100 border rounded hover:bg-gray-200 text-gray-600" title="Add Activity">+</button>
        </div>
      )}

      {(type === 'SOE Head' || type === 'Allocation' || type === 'Expenditure') && (
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
      <input type="hidden" name="schemeId" value={schemeId} />
      <input type="hidden" name="sectorId" value={sectorId} />
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
                const totalAllocated = allocations
                  .filter((a: any) => a.soeId === soeId && (editingItem?.type === 'Allocation' ? a.id !== editingItem.item.id : true))
                  .reduce((sum: number, a: any) => sum + a.amount, 0);
                const limit = soeBudgets.find((b: any) => b.soeId === soe?.id)?.budgetLimit || 0;
                const remaining = limit - totalAllocated;
                return `Budget Limit: ₹${limit.toLocaleString()} | Allocated: ₹${totalAllocated.toLocaleString()} | Remaining: ₹${remaining.toLocaleString()}`;
              })()}
            </div>
          )}
          {type === 'Expenditure' && soeId && (
            <div className="text-xs text-blue-600 px-1 font-medium bg-blue-50 p-1.5 rounded border border-blue-100">
              {(() => {
                if (allocationId) {
                  const alloc = allocations.find((a: any) => a.id === allocationId);
                  if (alloc) {
                    const spent = expenses
                      .filter((e: any) => e.allocationId === allocationId && (editingItem?.type === 'Expenditure' ? e.id !== editingItem.item.id : true))
                      .reduce((sum: number, e: any) => sum + e.amount, 0);
                    return `Allocation Budget: ₹${alloc.amount.toLocaleString()} | Spent: ₹${spent.toLocaleString()} | Remaining: ₹${(alloc.amount - spent).toLocaleString()}`;
                  }
                }
                const soeAllocations = allocations.filter((a: any) => a.soeId === soeId);
                const totalAllocated = soeAllocations.reduce((sum: number, a: any) => sum + a.amount, 0);
                const totalSpent = expenses
                  .filter((e: any) => soeAllocations.some(a => a.id === e.allocationId) && (editingItem?.type === 'Expenditure' ? e.id !== editingItem.item.id : true))
                  .reduce((sum: number, e: any) => sum + e.amount, 0);
                const remaining = totalAllocated - totalSpent;
                return `Allocated: ₹${totalAllocated.toLocaleString()} | Expenditure: ₹${totalSpent.toLocaleString()} | Remaining: ₹${remaining.toLocaleString()}`;
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
      
      <div className="flex gap-2">
        <select name="sectorId" defaultValue={editingItem?.item?.sectorId || ''} className="w-full p-2 border rounded">
          <option value="">Select Sector (Optional)</option>
          {sectors.filter(s => s.schemeId === selectedSchemeId).map(sec => (
            <option key={sec.id} value={sec.id}>{sec.name}</option>
          ))}
        </select>
        <button type="button" onClick={() => document.getElementById('tab-Sectors')?.click()} className="px-3 bg-gray-100 border rounded hover:bg-gray-200 text-gray-600" title="Add Sector">+</button>
      </div>
      
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
