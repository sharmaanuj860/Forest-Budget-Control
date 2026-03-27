import React, { useState, useMemo, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from 'recharts';
import { IndianRupee, Wallet, TrendingDown, Landmark, Activity, FileText, Map, MapPin, Plus, Trash2, Download, LogOut, User, Shield, FileBarChart, Filter, Search, Menu, Table, Pencil, Edit2, Home, ChevronUp, ChevronDown, TreePine, Check, X, Unlock, RefreshCcw, RefreshCw, Save, Eye, EyeOff, ShieldCheck, Lock, TrendingUp, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Printer, CornerUpLeft, Calendar, PieChart as PieChartIcon, Maximize2, Minimize2 } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  auth, db, signInWithPopup, googleProvider, signOut, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, setPersistence, browserSessionPersistence, browserLocalPersistence,
  collection, doc, setDoc, getDoc, getDocs, onSnapshot, query, where, or, orderBy, addDoc, updateDoc, deleteDoc, getDocFromServer, firebaseConfig, runTransaction, writeBatch
} from './firebase';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { preloadDatabase } from './preloadData';
import { emergencyRestoreData } from './emergencyRestoreData';

// --- Types ---
type FinancialYear = { id: string; name: string };
type Range = { id: string; name: string };
type Scheme = { id: string; name: string };
type Sector = { id: string; schemeId: string; name: string };
type ActivityItem = { id: string; sectorId?: string; schemeId?: string; name: string };
type SubActivity = { id: string; activityId: string; name: string };
type SOE = { 
  id: string; 
  name: string; 
  isProvisional?: boolean;
  schemeId?: string; 
  sectorId?: string; 
  activityId?: string; 
  subActivityId?: string; 
  approvedBudget: number; 
  receivedInTry: number;
  fyId?: string;
  financialYear?: string;
  approvedBudgetAmount?: number;
  receivedInTryAmount?: number;
  tryAmount?: number;
  updatedAt?: number;
  createdAt?: number;
};

type Allocation = { 
  id: string; 
  rangeId: string; 
  schemeId: string; 
  sectorId?: string; 
  activityId?: string; 
  subActivityId?: string; 
  amount: number; 
  status: 'Pending SOE Funds' | 'Funded'; 
  fundedSOEs: { soeId: string; amount: number }[]; 
  fyId?: string; 
  financialYear?: string; 
  remarks?: string;
  updatedAt?: number;
  createdAt?: number;
};

type Expense = { 
  id: string; 
  allocationId: string; 
  soeId: string; 
  amount: number; 
  date: string; 
  description: string; 
  fyId?: string; 
  financialYear?: string; 
  status: 'pending' | 'approved' | 'rejected'; 
  isLocked: boolean; 
  approvalId?: number;
  updatedAt?: number;
  createdAt?: number;
  approvalReason?: string;
  payeeId?: string;
};

type Bill = {
  id: string;
  billNo: string;
  billDate: string;
  expenseIds: string[];
  fyId: string;
  financialYear: string;
  totalAmount: number;
  status: 'draft' | 'finalized';
  createdAt: number;
  updatedAt: number;
  remarks?: string;
};

type Payee = {
  id: string;
  name: string;
  address: string;
  accountNumber: string;
  rangeId?: string;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
};

type AppUser = { 
  id: string; 
  email: string; 
  role: 'admin' | 'deo' | 'approver' | 'DA' | 'Sarahan' | 'Narag' | 'Habban' | 'Division' | 'Rajgarh'; 
  password?: string;
  maxSessions?: number;
  activeSessions?: string[];
  isDisabled?: boolean;
  updatedAt?: number;
};

type FeatureLock = {
  id: string;
  feature: 'Allocation' | 'Expenditure' | 'Access';
  target: string; // role or rangeId
  isLocked: boolean;
  updatedBy: string;
  updatedAt: number;
};

type Surrender = {
  id: string;
  rangeId: string;
  schemeId: string;
  sectorId: string;
  activityId: string;
  subActivityId: string;
  soeId: string;
  amount: number;
  date: string;
  remarks: string;
  fyId: string;
  financialYear: string;
  createdAt: number;
  updatedAt: number;
};

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

const TryUpdateInput = ({ soeId, initialValue, onUpdate }: { soeId: string, initialValue: number, onUpdate: (id: string, val: number) => void }) => {
  const [val, setVal] = useState(initialValue);
  
  useEffect(() => {
    setVal(initialValue);
  }, [initialValue]);

  return (
    <div className="flex items-center gap-1">
      <input 
        type="number" 
        value={val} 
        onChange={(e) => setVal(parseFloat(e.target.value) || 0)}
        className="w-24 p-1 text-xs border rounded focus:ring-1 focus:ring-indigo-500 outline-none"
      />
      <button 
        onClick={() => onUpdate(soeId, val)}
        className="p-1 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100 transition-colors"
        title="Update Treasury"
      >
        <Check className="w-3 h-3" />
      </button>
    </div>
  );
};

const getApprovedBudget = (s: any) => {
  const val = s.approvedBudget || s.approvedBudgetAmount || s.approved_budget || s.budget || 0;
  return Number(val) || 0;
};

const getReceivedInTry = (s: any) => {
  const val = s.receivedInTry || s.receivedInTryAmount || s.tryAmount || s.received_in_try || 0;
  return Number(val) || 0;
};

const ALLOWED_SOES = ['20 OC', '21 Maint', '30MV', '33M&S', '36M&W', 'Provisional'];

// --- Payee Selector Component ---
const PayeeSelector = ({ 
  payees, 
  selectedPayees, 
  onSelect, 
  onRemove, 
  onAmountChange,
  ranges,
  availableBalance
}: { 
  payees: Payee[], 
  selectedPayees: { payeeId: string, amount: string }[], 
  onSelect: (payeeId: string) => void, 
  onRemove: (payeeId: string) => void, 
  onAmountChange: (payeeId: string, amount: string) => void,
  ranges: Range[],
  availableBalance?: number
}) => {
  const [search, setSearch] = useState('');
  const [showResults, setShowResults] = useState(false);

  const filteredPayees = useMemo(() => {
    const lower = search.toLowerCase();
    return payees.filter(p => 
      p.name.toLowerCase().includes(lower) || 
      p.accountNumber.toLowerCase().includes(lower)
    ).filter(p => !selectedPayees.some(sp => sp.payeeId === p.id));
  }, [search, payees, selectedPayees]);

  const totalAmount = useMemo(() => 
    selectedPayees.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
  , [selectedPayees]);

  return (
    <div className="space-y-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex justify-between items-center">
        <label className="block text-[10px] font-bold text-gray-500 uppercase">Payee Selection (Multiple Allowed)</label>
        {availableBalance !== undefined && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-gray-500 uppercase">Available:</span>
            <span className="text-xs font-bold text-blue-700">₹{availableBalance.toLocaleString()}</span>
          </div>
        )}
      </div>
      
      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search payee by name or account..." 
              value={search}
              onChange={(e) => { setSearch(e.target.value); setShowResults(true); }}
              onFocus={() => setShowResults(true)}
              className="w-full pl-8 p-2 text-sm border rounded bg-white"
            />
          </div>
        </div>

        {showResults && search && (
          <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {filteredPayees.length > 0 ? (
              filteredPayees.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onSelect(p.id);
                    setSearch('');
                    setShowResults(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-emerald-50 border-b last:border-0"
                >
                  <div className="font-medium">{p.name}</div>
                  <div className="text-[10px] text-gray-500">{p.accountNumber} | {ranges.find(r => r.id === p.rangeId)?.name || 'N/A'}</div>
                </button>
              ))
            ) : (
              <div className="px-4 py-2 text-sm text-gray-500 italic">No payees found</div>
            )}
          </div>
        )}
      </div>

      {selectedPayees.length > 0 && (
        <div className="space-y-2">
          {selectedPayees.map(sp => {
            const p = payees.find(payee => payee.id === sp.payeeId);
            return (
              <div key={sp.payeeId} className="flex items-center gap-2 bg-white p-2 rounded border border-gray-200 shadow-sm">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold truncate">{p?.name}</div>
                  <div className="text-[10px] text-gray-400 truncate">{p?.accountNumber}</div>
                </div>
                <div className="w-36 shrink-0">
                  <input 
                    type="text" 
                    inputMode="decimal"
                    placeholder="Amount" 
                    value={sp.amount}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || /^\d*\.?\d*$/.test(val)) {
                        onAmountChange(sp.payeeId, val);
                      }
                    }}
                    className="w-full p-1.5 text-sm border-2 border-emerald-100 rounded text-right font-bold text-emerald-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
                    required
                  />
                </div>
                <div className="shrink-0">
                  <button 
                    type="button"
                    onClick={() => onRemove(sp.payeeId)}
                    className="p-1 text-red-500 hover:bg-red-50 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
          <div className="space-y-1 pt-2 border-t border-gray-200">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold text-gray-500 uppercase">Total Allocated:</span>
              <span className="text-sm font-bold text-emerald-600">₹{totalAmount.toLocaleString()}</span>
            </div>
            {availableBalance !== undefined && (
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-gray-500 uppercase">Remaining Balance:</span>
                <span className={`text-sm font-bold ${availableBalance - totalAmount < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                  ₹{(availableBalance - totalAmount).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [allocationAmount, setAllocationAmount] = useState<string>('');
  const [trackerSearch, setTrackerSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [dashboardSearch, setDashboardSearch] = useState('');
  const [showAllBudget, setShowAllBudget] = useState(false);
  const [rangeSearch, setRangeSearch] = useState('');
  const [soeSearchTerm, setSoeSearchTerm] = useState('');
  const [soeAbstractSearch, setSoeAbstractSearch] = useState('');
  const [showAllRange, setShowAllRange] = useState(false);
  const [isFormExpanded, setIsFormExpanded] = useState(window.innerWidth > 1024);
  const [isSoeTrackerExpanded, setIsSoeTrackerExpanded] = useState(true);
  const [showReconSummary, setShowReconSummary] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<'admin' | 'deo' | 'approver' | 'DA' | 'Sarahan' | 'Narag' | 'Habban' | 'Division' | 'Rajgarh' | null>(null);
  const [loading, setLoading] = useState(true);
  const [fundingAllocation, setFundingAllocation] = useState<Allocation | null>(null);
  const [isSoesLoaded, setIsSoesLoaded] = useState(false);

  const handleLogout = async () => {
    try {
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const activeSessions = userDoc.data().activeSessions || [];
          const updatedSessions = activeSessions.filter((id: string) => id !== sessionId);
          await updateDoc(doc(db, 'users', user.uid), { activeSessions: updatedSessions });
        }
      }
      await signOut(auth);
      setUser(null);
      setUserRole(null);
      setActiveTab('Dashboard');
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const [alertModal, setAlertModal] = useState<{ isOpen: boolean; message: string }>({ isOpen: false, message: '' });
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; message: string; onConfirm: () => void }>({ isOpen: false, message: '', onConfirm: () => {} });

  const showAlert = (message: string) => setAlertModal({ isOpen: true, message });
  const showConfirm = (message: string, onConfirm: () => void) => setConfirmModal({ isOpen: true, message, onConfirm });

  // --- State ---
  const [fys, setFys] = useState<FinancialYear[]>([]);
  const [selectedFY, setSelectedFY] = useState<string>('2025-26');
  const [ranges, setRanges] = useState<Range[]>([]);
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [subActivities, setSubActivities] = useState<SubActivity[]>([]);
  const [soes, setSoes] = useState<SOE[]>([]);
  const [surrenders, setSurrenders] = useState<Surrender[]>([]);
  const [surrenderFilters, setSurrenderFilters] = useState({ schemeId: '', sectorId: '', activityId: '', subActivityId: '', rangeId: '', soeId: '' });
  const hasSeeded = React.useRef(false);

  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [payees, setPayees] = useState<Payee[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [featureLocks, setFeatureLocks] = useState<FeatureLock[]>([]);
  const [sessionId] = useState(() => Math.random().toString(36).substring(2, 15));
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'deo' | 'approver' | 'Sarahan' | 'Narag' | 'Habban' | 'Division' | 'Rajgarh'>('deo');
  const [visiblePasswords, setVisiblePasswords] = useState<{[key: string]: boolean}>({});
  const [editingPasswordId, setEditingPasswordId] = useState<string | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [selectedLockTarget, setSelectedLockTarget] = useState<string>('');

  // --- Filters ---
  const [expDateRange, setExpDateRange] = useState({ start: '', end: '' });
  const [expFilters, setExpFilters] = useState({ schemeId: '', sectorId: '', activityId: '', subActivityId: '', rangeId: '' });
  const [expenditureSubTab, setExpenditureSubTab] = useState<'list' | 'bills' | 'payees'>('list');
  const [selectedExpensesForBill, setSelectedExpensesForBill] = useState<string[]>([]);
  const [billFilters, setBillFilters] = useState({ billNo: '', startDate: '', endDate: '' });
  const [billExpFilters, setBillExpFilters] = useState({ schemeId: '', sectorId: '', activityId: '', subActivityId: '', rangeId: '', soeId: '' });
  const [isBillFormFullScreen, setIsBillFormFullScreen] = useState(false);
  const [isTableFullScreen, setIsTableFullScreen] = useState(false);
  const [viewingBillPdf, setViewingBillPdf] = useState<{ url: string; bill: any } | null>(null);
  const [allocFilters, setAllocFilters] = useState({ schemeId: '', sectorId: '', activityId: '', subActivityId: '', rangeId: '', soeId: '' });
  const [soeFilters, setSoeFilters] = useState({ schemeId: '', sectorId: '', activityId: '', subActivityId: '', rangeId: '', soeName: '' });

  const [reportFilters, setReportFilters] = useState({ scheme: '', sector: '', activity: '', subActivity: '', range: '', soe: '' });
  const [ledgerFilters, setLedgerFilters] = useState({ scheme: '', sector: '', activity: '', subActivity: '', range: '', soe: '' });
  const [showLedgerFilters, setShowLedgerFilters] = useState(false);
  const [ledgerSearchTerm, setLedgerSearchTerm] = useState('');
  const [reportSubTab, setReportSubTab] = useState('summary');
  const [reportSearchTerm, setReportSearchTerm] = useState('');
  const [reportPage, setReportPage] = useState(1);
  const [reportItemsPerPage, setReportItemsPerPage] = useState(25);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [selectedExpenseForApproval, setSelectedExpenseForApproval] = useState<Expense | null>(null);
  const [approvalStatus, setApprovalStatus] = useState<'approved' | 'rejected'>('approved');
  const [approvalReason, setApprovalReason] = useState('');
  const [isExpFilterExpanded, setIsExpFilterExpanded] = useState(false);
  const [isAllocFilterExpanded, setIsAllocFilterExpanded] = useState(false);
  const [isSoeFilterExpanded, setIsSoeFilterExpanded] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const menuItems = useMemo<({ name: string; icon: React.ReactNode; children?: { name: string; icon: React.ReactNode }[] })[]>(() => {
    const adminItems = [
      { name: 'Dashboard', icon: <Home className="w-3 h-3 sm:w-4 sm:h-4" /> },
      { name: 'Financial Years', icon: <Calendar className="w-3 h-3 sm:w-4 sm:h-4" /> },
      { name: 'Ranges', icon: <Map className="w-3 h-3 sm:w-4 sm:h-4" /> },
      { 
        name: 'Manage Scheme', 
        icon: <Landmark className="w-3 h-3 sm:w-4 sm:h-4" />,
        children: [
          { name: 'Schemes', icon: <TreePine className="w-3 h-3 sm:w-4 sm:h-4" /> },
          { name: 'Sectors', icon: <Shield className="w-3 h-3 sm:w-4 sm:h-4" /> },
          { name: 'Activities', icon: <Activity className="w-3 h-3 sm:w-4 sm:h-4" /> },
          { name: 'Sub-Activities', icon: <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" /> }
        ]
      },
      { name: 'SOE Heads', icon: <FileBarChart className="w-3 h-3 sm:w-4 sm:h-4" /> },
      { 
        name: 'Manage Budget', 
        icon: <Wallet className="w-3 h-3 sm:w-4 sm:h-4" />,
        children: [
          { name: 'Allocations', icon: <Wallet className="w-3 h-3 sm:w-4 sm:h-4" /> },
          { name: 'Expenditures', icon: <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4" /> },
          { name: 'Surrender', icon: <CornerUpLeft className="w-3 h-3 sm:w-4 sm:h-4" /> }
        ]
      },
      { name: 'Reconciliation', icon: <RefreshCcw className="w-3 h-3 sm:w-4 sm:h-4" /> },
      { 
        name: 'Reports', 
        icon: <FileBarChart className="w-3 h-3 sm:w-4 sm:h-4" />,
        children: [
          { name: 'Ledger', icon: <FileText className="w-3 h-3 sm:w-4 sm:h-4" /> },
          { name: 'Reports', icon: <FileBarChart className="w-3 h-3 sm:w-4 sm:h-4" /> }
        ]
      },
      { name: 'Users', icon: <User className="w-3 h-3 sm:w-4 sm:h-4" /> }
    ];

    const daItems = [
      { name: 'Dashboard', icon: <Home className="w-3 h-3 sm:w-4 sm:h-4" /> },
      { 
        name: 'Manage Budget', 
        icon: <Wallet className="w-3 h-3 sm:w-4 sm:h-4" />,
        children: [
          { name: 'Allocations', icon: <Wallet className="w-3 h-3 sm:w-4 sm:h-4" /> },
          { name: 'Expenditures', icon: <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4" /> }
        ]
      },
      { name: 'Reconciliation', icon: <RefreshCcw className="w-3 h-3 sm:w-4 sm:h-4" /> },
      { 
        name: 'Reports', 
        icon: <FileBarChart className="w-3 h-3 sm:w-4 sm:h-4" />,
        children: [
          { name: 'Ledger', icon: <FileText className="w-3 h-3 sm:w-4 sm:h-4" /> },
          { name: 'Reports', icon: <FileBarChart className="w-3 h-3 sm:w-4 sm:h-4" /> }
        ]
      }
    ];

    const otherItems = [
      { name: 'Dashboard', icon: <Home className="w-3 h-3 sm:w-4 sm:h-4" /> },
      { 
        name: 'Manage Budget', 
        icon: <Wallet className="w-3 h-3 sm:w-4 sm:h-4" />,
        children: [
          { name: 'Allocations', icon: <Wallet className="w-3 h-3 sm:w-4 sm:h-4" /> },
          { name: 'Expenditures', icon: <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4" /> },
          { name: 'Surrender', icon: <CornerUpLeft className="w-3 h-3 sm:w-4 sm:h-4" /> }
        ]
      },
      { 
        name: 'Reports', 
        icon: <FileBarChart className="w-3 h-3 sm:w-4 sm:h-4" />,
        children: [
          { name: 'Ledger', icon: <FileText className="w-3 h-3 sm:w-4 sm:h-4" /> },
          { name: 'Reports', icon: <FileBarChart className="w-3 h-3 sm:w-4 sm:h-4" /> }
        ]
      }
    ];

    if (userRole === 'admin') return adminItems;
    if (userRole === 'DA') return daItems;
    return otherItems;
  }, [userRole]);

    // Auto-collapse filters and reset all filters on tab change
    useEffect(() => {
      setIsExpFilterExpanded(false);
      setIsAllocFilterExpanded(false);
      setIsSoeFilterExpanded(false);
      setShowReportFilters(false);
      
      // Reset all filters when switching main tabs
      setReportFilters({ scheme: '', sector: '', activity: '', subActivity: '', range: '', soe: '' });
      setLedgerFilters({ scheme: '', sector: '', activity: '', subActivity: '', range: '', soe: '' });
      setReportSearchTerm('');
      setLedgerSearchTerm('');
      setReportPage(1);
      setExpFilters({ schemeId: '', sectorId: '', activityId: '', subActivityId: '', rangeId: '' });
      setAllocFilters({ schemeId: '', sectorId: '', activityId: '', subActivityId: '', rangeId: '', soeId: '' });
      setSoeFilters({ schemeId: '', sectorId: '', activityId: '', subActivityId: '', rangeId: '', soeName: '' });
      setExpDateRange({ start: '', end: '' });
      setSearchTerm('');
      setDashboardSearch('');
      setRangeSearch('');
      setSoeSearchTerm('');
      setSoeAbstractSearch('');
      setTrackerSearch('');
      setReconSearchTerm('');
      setReconSchemeId('');
      setShowLedgerFilters(false);
    }, [activeTab]);
  const [showReportFilters, setShowReportFilters] = useState(false);
  const [surrenderFormSelection, setSurrenderFormSelection] = useState<any>({ schemeId: '', sectorId: '', activityId: '', subActivityId: '', soeId: '', rangeId: '' });
  const [showSoeAbstract, setShowSoeAbstract] = useState(true);
  const [showDetailedReport, setShowDetailedReport] = useState(true);
  const [allocationFormFilters, setAllocationFormFilters] = useState({ schemeId: '', sectorId: '', activityId: '', subActivityId: '', soeId: '', fundingSoeName: '', rangeId: '' });
  const [reconSchemeId, setReconSchemeId] = useState('');
  const [reconSearchTerm, setReconSearchTerm] = useState('');
  const [reconData, setReconData] = useState<any>({});
  const [selectedPayeesForExpense, setSelectedPayeesForExpense] = useState<{ payeeId: string; amount: string }[]>([]);
  const [currentSoeBalance, setCurrentSoeBalance] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (activeTab !== 'Expenditures') {
      setCurrentSoeBalance(undefined);
      setSelectedPayeesForExpense([]);
    }
  }, [activeTab]);

  // --- Editing State ---
  const [editingItem, setEditingItem] = useState<{ type: string; item: any } | null>(null);

  useEffect(() => {
    if (!editingItem) {
      setCurrentSoeBalance(undefined);
      setSelectedPayeesForExpense([]);
    }
  }, [editingItem]);
  const [viewingSoeExp, setViewingSoeExp] = useState<{ soeId: string; soeName: string; hierarchy: string } | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // --- Auth & Role Check ---
  useEffect(() => {
    // Set persistence to local - will keep user logged in even if tab is closed
    // But we will manually check for the 10-minute grace period
    const initAuth = async () => {
      try {
        await setPersistence(auth, browserLocalPersistence);
      } catch (err) {
        console.error("Persistence error:", err);
      }
    };
    initAuth();

    // --- Grace Period Check ---
    const lastClosedTime = localStorage.getItem('lastClosedTime');
    if (lastClosedTime) {
      const timeDiff = Date.now() - parseInt(lastClosedTime);
      if (timeDiff > 10 * 60 * 1000) { // 10 minutes
        signOut(auth).catch(err => console.error("Sign out error:", err));
        localStorage.removeItem('lastClosedTime');
      }
    }

    const handleUnload = () => {
      localStorage.setItem('lastClosedTime', Date.now().toString());
    };

    window.addEventListener('beforeunload', handleUnload);

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
        const email = currentUser.email?.toLowerCase();
        
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          let userData = userDoc.exists() ? userDoc.data() as AppUser : null;

          // Hardcode roles for specific emails
          if (!userData) {
            if (email === 'admin@rajgarhforest.app' || email === 'sharmaanuj860@gmail.com') {
              userData = { id: currentUser.uid, email: currentUser.email!, role: 'admin', maxSessions: 999999, activeSessions: [] };
              await setDoc(doc(db, 'users', currentUser.uid), userData, { merge: true });
            } else if (email === 'da123@rajgarhforest.app') {
              userData = { id: currentUser.uid, email: currentUser.email!, role: 'deo', maxSessions: 999999, activeSessions: [] };
              await setDoc(doc(db, 'users', currentUser.uid), userData, { merge: true });
            } else if (email === 'da789@rajgarhforest.app') {
              userData = { id: currentUser.uid, email: currentUser.email!, role: 'approver', maxSessions: 999999, activeSessions: [] };
              await setDoc(doc(db, 'users', currentUser.uid), userData, { merge: true });
            }
          }

          if (userData) {
            // Check if user is disabled individually
            if (userData.isDisabled) {
              showAlert("Your account has been disabled by the administrator. Please contact support.");
              await signOut(auth);
              setLoading(false);
              return;
            }

            // Check if user's role or range is disabled via featureLocks
            if (userData.role !== 'admin') {
              try {
                const locksSnap = await getDocs(query(
                  collection(db, 'featureLocks'),
                  where('feature', '==', 'Access'),
                  where('isLocked', '==', true)
                ));
                
                const activeAccessLocks = locksSnap.docs.map(d => d.data() as FeatureLock);
                
                // Check individual user lock via featureLocks (legacy or fallback)
                if (activeAccessLocks.some(l => l.target === userData!.id)) {
                  showAlert(`Access for your account has been disabled by the administrator.`);
                  await signOut(auth);
                  setLoading(false);
                  return;
                }
                
                // Check role lock
                if (activeAccessLocks.some(l => l.target === userData!.role)) {
                  showAlert(`Access for the ${userData.role.toUpperCase()} role has been disabled by the administrator.`);
                  await signOut(auth);
                  setLoading(false);
                  return;
                }

                // Check range lock (if role is a range name)
                if (['Sarahan', 'Narag', 'Habban', 'Division', 'Rajgarh'].includes(userData.role)) {
                  const rangesSnap = await getDocs(collection(db, 'ranges'));
                  const userRange = rangesSnap.docs.find(d => d.data().name === userData!.role);
                  if (userRange && activeAccessLocks.some(l => l.target === userRange.id)) {
                    showAlert(`Access for the ${userData.role} range has been disabled by the administrator.`);
                    await signOut(auth);
                    setLoading(false);
                    return;
                  }
                }
              } catch (lockError) {
                console.warn("Could not check feature locks during login:", lockError);
              }
            }

            // Session Validation
            const activeSessions = userData.activeSessions || [];
            if (!activeSessions.includes(sessionId)) {
              // Default to 999999 (unlimited) if not specified, but admins are always unlimited
              const maxSessions = userData.role === 'admin' ? 999999 : (userData.maxSessions || 999999);
              if (activeSessions.length >= maxSessions) {
                showAlert(`Maximum concurrent sessions (${maxSessions}) reached for this account. Please logout from other devices.`);
                await signOut(auth);
                setLoading(false);
                return;
              }
              // Add current session
              const updatedSessions = [...activeSessions, sessionId];
              try {
                await updateDoc(doc(db, 'users', currentUser.uid), { activeSessions: updatedSessions });
              } catch (err) {
                handleFirestoreError(err, OperationType.UPDATE, `users/${currentUser.uid}`);
              }
            }

            setUser(currentUser);
            setUserRole(userData.role);
            setActiveTab('Dashboard');
            // Clear last closed time as user is now active
            localStorage.removeItem('lastClosedTime');
          } else {
            // If first user ever, make admin
            try {
              const usersSnap = await getDocs(collection(db, 'users'));
              if (usersSnap.empty) {
                const newRole = 'admin';
                const newUserData = { email: currentUser.email, role: newRole, maxSessions: 999999, activeSessions: [sessionId] };
                await setDoc(doc(db, 'users', currentUser.uid), newUserData);
                setUser(currentUser);
                setUserRole(newRole);
              } else {
                setUserRole(null);
              }
            } catch (e) {
              console.warn("Could not check for first user (likely permission denied), assuming not first user.");
              setUserRole(null);
            }
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}`);
        }
      } else {
        setUser(null);
        setUserRole(null);
      }
      setLoading(false);
    });
    return () => {
      unsubscribe();
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, []);

  // --- Session Expiry Logic (Activity Timer) ---
  useEffect(() => {
    if (!user || !userRole) return;

    let timeoutId: any;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      // Admin: 20 mins, Others: 15 mins
      const timeoutMinutes = userRole === 'admin' ? 20 : 15;
      timeoutId = setTimeout(() => {
        showAlert(`Session expired due to inactivity (${timeoutMinutes} mins). Please login again.`);
        handleLogout();
      }, timeoutMinutes * 60 * 1000);
    };

    // Initial start
    resetTimer();

    // Listen for activity
    const activityEvents = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    activityEvents.forEach(event => {
      window.addEventListener(event, resetTimer);
    });

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      activityEvents.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [user, userRole]);

  // --- Real-time Data Sync (Master Data) ---
  useEffect(() => {
    if (!user || !userRole) return;

    const unsubFys = onSnapshot(collection(db, 'financialYears'), (snap) => {
      const data = snap.docs.map(d => ({ ...d.data(), id: d.id } as FinancialYear));
      setFys(data.sort((a: any, b: any) => (b.updatedAt || 0) - (a.updatedAt || 0)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'financialYears'));

    const unsubRanges = onSnapshot(collection(db, 'ranges'), (snap) => {
      const data = snap.docs.map(d => ({ ...d.data(), id: d.id } as Range));
      setRanges(data.sort((a: any, b: any) => (b.updatedAt || 0) - (a.updatedAt || 0)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'ranges'));

    const unsubSchemes = onSnapshot(collection(db, 'schemes'), (snap) => {
      const data = snap.docs.map(d => ({ ...d.data(), id: d.id } as Scheme));
      setSchemes(data.sort((a: any, b: any) => (b.updatedAt || 0) - (a.updatedAt || 0)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'schemes'));

    const unsubSectors = onSnapshot(collection(db, 'sectors'), (snap) => {
      const data = snap.docs.map(d => ({ ...d.data(), id: d.id } as Sector));
      setSectors(data.sort((a: any, b: any) => (b.updatedAt || 0) - (a.updatedAt || 0)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'sectors'));

    const unsubActivities = onSnapshot(collection(db, 'activities'), (snap) => {
      const data = snap.docs.map(d => ({ ...d.data(), id: d.id } as ActivityItem));
      setActivities(data.sort((a: any, b: any) => (b.updatedAt || 0) - (a.updatedAt || 0)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'activities'));

    const unsubSubActivities = onSnapshot(collection(db, 'subActivities'), (snap) => {
      const data = snap.docs.map(d => ({ ...d.data(), id: d.id } as SubActivity));
      setSubActivities(data.sort((a: any, b: any) => (b.updatedAt || 0) - (a.updatedAt || 0)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'subActivities'));

    const unsubUsers = userRole === 'admin' ? onSnapshot(collection(db, 'users'), (snap) => {
      const data = snap.docs.map(d => ({ ...d.data(), id: d.id } as AppUser));
      setUsers(data.sort((a: any, b: any) => (b.updatedAt || 0) - (a.updatedAt || 0)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users')) : () => {};

    // Listen to current user's document for real-time disablement (for non-admins)
    const unsubCurrentUser = user && userRole !== 'admin' ? onSnapshot(doc(db, 'users', user.uid), (snap) => {
      const userData = snap.data() as AppUser;
      if (userData?.isDisabled) {
        showAlert("Your account has been disabled by the administrator. Please contact support.");
        handleLogout();
      }
    }, (error) => {
      // Ignore permission errors if user is already disabled and doc becomes unreadable
      if (!error.message.includes('insufficient permissions')) {
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
      }
    }) : () => {};

    const unsubLocks = onSnapshot(collection(db, 'featureLocks'), (snap) => {
      const data = snap.docs.map(d => ({ ...d.data(), id: d.id } as FeatureLock));
      setFeatureLocks(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'featureLocks'));

    const unsubPayees = onSnapshot(collection(db, 'payees'), (snap) => {
      const data = snap.docs.map(d => ({ ...d.data(), id: d.id } as Payee));
      setPayees(data.sort((a: any, b: any) => (b.updatedAt || 0) - (a.updatedAt || 0)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'payees'));

    return () => {
      unsubFys(); unsubRanges(); unsubSchemes(); unsubSectors(); unsubActivities();
      unsubSubActivities(); unsubUsers(); unsubCurrentUser(); unsubPayees(); unsubLocks();
    };
  }, [user, userRole]);

  // --- Real-time Data Sync (Transactional Data filtered by FY) ---
  useEffect(() => {
    if (!user || !userRole || !selectedFY) return;

    setIsSoesLoaded(false);

    const activeFy = fys.find(f => f.name === selectedFY || f.id === selectedFY);
    const fyQueryValues = activeFy ? Array.from(new Set([activeFy.id, activeFy.name])) : [selectedFY];

    const soesQuery = query(
      collection(db, 'soeHeads'), 
      or(where('financialYear', 'in', fyQueryValues), where('fyId', 'in', fyQueryValues))
    );
    const unsubSoes = onSnapshot(soesQuery, (snap) => {
      const data = snap.docs.map(d => ({ ...d.data(), id: d.id } as SOE));
      setSoes(data.sort((a: any, b: any) => (b.updatedAt || 0) - (a.updatedAt || 0)));
      setIsSoesLoaded(true);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'soeHeads'));

    const allocsQuery = query(
      collection(db, 'allocations'), 
      or(where('financialYear', 'in', fyQueryValues), where('fyId', 'in', fyQueryValues))
    );
    const unsubAllocations = onSnapshot(allocsQuery, (snap) => {
      const data = snap.docs.map(d => ({ ...d.data(), id: d.id } as Allocation));
      console.log('Fetched allocations for FY:', fyQueryValues, 'Count:', data.length);
      setAllocations(data.sort((a: any, b: any) => (b.updatedAt || 0) - (a.updatedAt || 0)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'allocations'));

    const expensesQuery = query(
      collection(db, 'expenditures'), 
      or(where('financialYear', 'in', fyQueryValues), where('fyId', 'in', fyQueryValues))
    );
    const unsubExpenses = onSnapshot(expensesQuery, (snap) => {
      const data = snap.docs.map(d => ({ ...d.data(), id: d.id } as Expense));
      setExpenses(data.sort((a: any, b: any) => (b.updatedAt || 0) - (a.updatedAt || 0)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'expenditures'));

    const billsQuery = query(
      collection(db, 'bills'), 
      or(where('financialYear', 'in', fyQueryValues), where('fyId', 'in', fyQueryValues))
    );
    const unsubBills = onSnapshot(billsQuery, (snap) => {
      const data = snap.docs.map(d => ({ ...d.data(), id: d.id } as Bill));
      setBills(data.sort((a: any, b: any) => (b.updatedAt || 0) - (a.updatedAt || 0)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'bills'));

    const surrendersQuery = query(
      collection(db, 'surrenders'), 
      or(where('financialYear', 'in', fyQueryValues), where('fyId', 'in', fyQueryValues))
    );
    const unsubSurrenders = onSnapshot(surrendersQuery, (snap) => {
      const data = snap.docs.map(d => ({ ...d.data(), id: d.id } as Surrender));
      setSurrenders(data.sort((a: any, b: any) => (b.updatedAt || 0) - (a.updatedAt || 0)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'surrenders'));

    return () => {
      unsubSoes(); unsubAllocations(); unsubExpenses(); unsubBills(); unsubSurrenders();
    };
  }, [user, userRole, selectedFY, fys]);

  // --- Silent Auto-Seeding for 2025-26 ---
  useEffect(() => {
    if (!user || !userRole || selectedFY !== '2025-26' || !isSoesLoaded) return;

    if (soes.length === 0 && !hasSeeded.current) {
      hasSeeded.current = true;
      const seedData = async () => {
        try {
          console.log("Silently seeding emergency restore data for FY 2025-26...");
          
          const fy = fys.find(f => f.name === '2025-26');
          const fyId = fy ? fy.id : '2025-26';

          let localSchemes = [...schemes];
          let localSectors = [...sectors];
          let localActivities = [...activities];
          let localSubActivities = [...subActivities];

          for (const item of emergencyRestoreData) {
            // Determine IDs based on hierarchy string
            let schemeId = null;
            let sectorId = null;
            let activityId = null;
            let subActivityId = null;

            const parts = item.hierarchy.split(' -> ');
            
            if (parts.length > 0) {
              let sch = localSchemes.find(s => s.name === parts[0]);
              if (!sch) {
                const docRef = await addDoc(collection(db, 'schemes'), { name: parts[0], createdAt: Date.now(), updatedAt: Date.now() });
                sch = { id: docRef.id, name: parts[0] };
                localSchemes.push(sch);
              }
              schemeId = sch.id;
            }
            if (parts.length > 1) {
              let sec = localSectors.find(s => s.name === parts[1] && s.schemeId === schemeId);
              if (!sec) {
                const docRef = await addDoc(collection(db, 'sectors'), { name: parts[1], schemeId, createdAt: Date.now(), updatedAt: Date.now() });
                sec = { id: docRef.id, name: parts[1], schemeId };
                localSectors.push(sec);
              }
              sectorId = sec.id;
            }
            if (parts.length > 2) {
              let act = localActivities.find(a => a.name === parts[2] && a.sectorId === sectorId);
              if (!act) {
                const docRef = await addDoc(collection(db, 'activities'), { name: parts[2], sectorId, createdAt: Date.now(), updatedAt: Date.now() });
                act = { id: docRef.id, name: parts[2], sectorId };
                localActivities.push(act);
              }
              activityId = act.id;
            }
            if (parts.length > 3) {
              let sa = localSubActivities.find(s => s.name === parts[3] && s.activityId === activityId);
              if (!sa) {
                const docRef = await addDoc(collection(db, 'subActivities'), { name: parts[3], activityId, createdAt: Date.now(), updatedAt: Date.now() });
                sa = { id: docRef.id, name: parts[3], activityId };
                localSubActivities.push(sa);
              }
              subActivityId = sa.id;
            }

            await addDoc(collection(db, 'soeHeads'), {
              name: item.soeName,
              schemeId,
              sectorId,
              activityId,
              subActivityId,
              approvedBudget: item.approvedBudget,
              approvedBudgetAmount: item.approvedBudget,
              receivedInTry: item.receivedInTry,
              receivedInTryAmount: item.receivedInTry,
              tryAmount: item.receivedInTry,
              financialYear: fyId,
              createdAt: Date.now(),
              updatedAt: Date.now()
            });
          }
          console.log("Silent seeding completed successfully.");
        } catch (error) {
          console.error("Failed to silently seed data:", error);
          handleFirestoreError(error, OperationType.CREATE, 'soeHeads');
        }
      };

      seedData();
    }
  }, [user, userRole, selectedFY, isSoesLoaded, soes.length, schemes, sectors, activities, subActivities, fys]);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoginError('');
    if (!navigator.onLine) {
      setLoginError('No internet connection. Please check your network.');
      return;
    }
    setLoading(true);
    try {
      let emailToUse = loginEmail;
      if (!emailToUse.includes('@')) {
        emailToUse = `${emailToUse}@rajgarhforest.app`;
      }
      // Ensure persistence is set before login
      await setPersistence(auth, browserLocalPersistence);
      await signInWithEmailAndPassword(auth, emailToUse, loginPassword);
    } catch (error: any) {
      console.error('Auth error:', error);
      if (error.code === 'auth/network-request-failed') {
        setLoginError('Network request failed. This may be due to a poor connection or browser restrictions. Please refresh and try again.');
      } else if (error.code === 'auth/operation-not-allowed') {
        setLoginError('Email/Password authentication is not enabled in your Firebase project. Please go to the Firebase Console -> Authentication -> Sign-in method, and enable "Email/Password".');
      } else if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        setLoginError('User not found or invalid credentials.');
      } else {
        setLoginError(error.message || 'Authentication failed. Please check your credentials.');
      }
      setLoading(false);
    }
  };


  // --- Derived Data / Helpers ---
  const currentSchemes = schemes;
  const currentSectors = sectors;
  const currentActivities = activities;
  const currentSubActivities = subActivities;
  const userRangeId = useMemo(() => {
    console.log('Calculating userRangeId. userRole:', userRole);
    if (userRole && ['Sarahan', 'Narag', 'Habban', 'Division', 'Rajgarh'].includes(userRole)) {
      const r = ranges.find(r => r.name === userRole);
      console.log('Found range for role:', r);
      return r?.id;
    }
    return null;
  }, [userRole, ranges]);

  // --- Real-time Access Control Enforcement ---
  useEffect(() => {
    if (!user || userRole === 'admin' || featureLocks.length === 0) return;

    const accessLock = featureLocks.find(l => 
      l.feature === 'Access' && 
      l.isLocked && 
      (l.target === userRole || (userRangeId && l.target === userRangeId) || l.target === user.uid)
    );

    if (accessLock) {
      showAlert(`Access for your ${accessLock.target === userRole ? 'role' : (accessLock.target === user.uid ? 'account' : 'range')} has been disabled by the administrator.`);
      handleLogout();
    }
  }, [user, userRole, userRangeId, featureLocks]);

  const currentSoes = useMemo(() => {
    let filtered = soes.filter(s => ALLOWED_SOES.includes(s.name || 'Provisional'));
    
    // SOE Heads don't have rangeId directly, so we don't filter by userRangeId or soeFilters.rangeId
    
    if (soeFilters.schemeId) {
      filtered = filtered.filter(s => s.schemeId === soeFilters.schemeId);
    }
    if (soeFilters.sectorId) {
      filtered = filtered.filter(s => s.sectorId === soeFilters.sectorId);
    }
    if (soeFilters.activityId) {
      filtered = filtered.filter(s => s.activityId === soeFilters.activityId);
    }
    if (soeFilters.subActivityId) {
      filtered = filtered.filter(s => s.subActivityId === soeFilters.subActivityId);
    }
    if (soeFilters.soeName) {
      filtered = filtered.filter(s => s.name === soeFilters.soeName);
    }
    
    return filtered;
  }, [soes, soeFilters]);

  const baseAllocations = useMemo(() => {
    let filtered = allocations;
    if (userRangeId) {
      filtered = filtered.filter(a => a.rangeId === userRangeId);
    }
    return filtered;
  }, [allocations, userRangeId]);

  const baseExpenses = useMemo(() => {
    let filtered = expenses;
    if (userRangeId) {
      const userAllocIds = baseAllocations.map(a => a.id);
      filtered = filtered.filter(e => userAllocIds.includes(e.allocationId));
    }
    return filtered;
  }, [expenses, baseAllocations, userRangeId]);

  const currentAllocations = useMemo(() => {
    let filtered = baseAllocations;
    
    if (userRangeId) {
      filtered = filtered.filter(a => a.rangeId === userRangeId);
    }

    if (allocFilters.schemeId) {
      filtered = filtered.filter(a => a.schemeId === allocFilters.schemeId);
    }
    if (allocFilters.sectorId) {
      filtered = filtered.filter(a => a.sectorId === allocFilters.sectorId);
    }
    if (allocFilters.activityId) {
      filtered = filtered.filter(a => a.activityId === allocFilters.activityId);
    }
    if (allocFilters.subActivityId) {
      filtered = filtered.filter(a => a.subActivityId === allocFilters.subActivityId);
    }
    if (allocFilters.rangeId) {
      filtered = filtered.filter(a => a.rangeId === allocFilters.rangeId);
    }
    if (allocFilters.soeId) {
      filtered = filtered.filter(a => a.fundedSOEs && a.fundedSOEs.some(f => f.soeId === allocFilters.soeId));
    }

    // Filter out "Division" allocations with 0 amount to avoid cluttering as requested
    filtered = filtered.filter(a => {
      const r = ranges.find(range => range.id === a.rangeId);
      const isDivision = r?.name === 'Division' || r?.name === 'Rajgarh Forest Division';
      if (isDivision && a.amount === 0) return false;
      return true;
    });

    console.log('currentAllocations count:', filtered.length);
    return filtered;
  }, [baseAllocations, allocFilters, userRangeId, ranges]);

  const currentExpenses = useMemo(() => {
    let filtered = expenses;
    
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

    if (expFilters.subActivityId) {
      filtered = filtered.filter(e => {
        const alloc = allocations.find(a => a.id === e.allocationId);
        return alloc?.subActivityId === expFilters.subActivityId;
      });
    }

    if (expFilters.rangeId) {
      filtered = filtered.filter(e => {
        const alloc = allocations.find(a => a.id === e.allocationId);
        return alloc?.rangeId === expFilters.rangeId;
      });
    }

    return filtered;
  }, [expenses, currentAllocations, expDateRange, expFilters, allocations, userRangeId]);

  const comprehensiveReportData = useMemo(() => {
    return baseAllocations.map(a => {
      const allocExpenses = baseExpenses.filter(e => e.allocationId === a.id && e.status !== 'rejected');
      const totalExp = allocExpenses.reduce((sum, e) => sum + e.amount, 0);
      const range = ranges.find(r => r.id === a.rangeId);
      const scheme = schemes.find(s => s.id === a.schemeId);
      const sector = sectors.find(s => s.id === a.sectorId);
      const activity = activities.find(act => act.id === a.activityId);
      const subActivity = subActivities.find(sa => sa.id === a.subActivityId);

      const soeBreakdown = soes.reduce((acc: any, soe) => {
        const soeAlloc = a.fundedSOEs?.find(f => f.soeId === soe.id)?.amount || 0;
        const soeExp = allocExpenses
          .filter(e => e.soeId === soe.id)
          .reduce((sum, e) => sum + e.amount, 0);
        acc[soe.name] = { alloc: soeAlloc, exp: soeExp };
        return acc;
      }, {});

      return {
        id: a.id,
        range: range?.name === 'Rajgarh Forest Division' ? 'Division' : (range?.name || 'Unknown'),
        scheme: scheme?.name || 'Unknown',
        sector: sector?.name || 'Unknown',
        activity: activity?.name || 'Unknown',
        subActivity: subActivity?.name || 'Unknown',
        totalAlloc: a.amount,
        totalExp,
        balance: a.amount - totalExp,
        soeBreakdown
      };
    });
  }, [baseAllocations, baseExpenses, ranges, schemes, sectors, activities, subActivities, soes]);

  const allocationExpenditureData = useMemo(() => {
    return currentSoes.map(s => {
      const soeAllocations = baseAllocations.filter(a => 
        a.fundedSOEs?.some(f => f.soeId === s.id)
      );
      const soeExpenses = baseExpenses.filter(e => e.soeId === s.id && e.status !== 'rejected');
      
      const totalAllocated = soeAllocations.reduce((sum, a) => {
        const funded = a.fundedSOEs?.find(f => f.soeId === s.id)?.amount || 0;
        return sum + funded;
      }, 0);
      
      const totalExp = soeExpenses.reduce((sum, e) => sum + e.amount, 0);
      const approvedBudget = getApprovedBudget(s);

      return {
        soeName: s.name,
        approvedBudget,
        totalAllocated,
        totalExp,
        balance: totalAllocated - totalExp,
        treasuryBalance: approvedBudget - totalAllocated
      };
    });
  }, [currentSoes, baseAllocations, baseExpenses]);

  const combinedReportData = useMemo(() => {
    return [...comprehensiveReportData, ...allocationExpenditureData];
  }, [comprehensiveReportData, allocationExpenditureData]);

  const uniqueSchemes = useMemo(() => 
    Array.from(new Set(comprehensiveReportData.map((item: any) => item.scheme).filter(Boolean))).sort()
  , [comprehensiveReportData]);

  const uniqueSectors = useMemo(() => 
    Array.from(new Set(comprehensiveReportData.map((item: any) => item.sector).filter(Boolean))).sort()
  , [comprehensiveReportData]);

  const uniqueActivities = useMemo(() => 
    Array.from(new Set(comprehensiveReportData.map((item: any) => item.activity).filter(Boolean))).sort()
  , [comprehensiveReportData]);

  const uniqueSubActivities = useMemo(() => 
    Array.from(new Set(comprehensiveReportData.map((item: any) => item.subActivity).filter(Boolean))).sort()
  , [comprehensiveReportData]);

  const uniqueRangesList = useMemo(() => 
    Array.from(new Set(comprehensiveReportData.map((item: any) => item.range).filter(Boolean))).sort()
  , [comprehensiveReportData]);

  const uniqueSoes = useMemo(() => 
    Array.from(new Set(soes.map(s => s.name))).sort()
  , [soes]);

  const filteredLedgerData = useMemo(() => {
    const filtered = currentAllocations.filter(alloc => {
      const r = ranges.find(r => r.id === alloc.rangeId);
      const sa = subActivities.find(sa => sa.id === alloc.subActivityId);
      const act = activities.find(a => a.id === (alloc.subActivityId ? sa?.activityId : alloc.activityId));
      const sec = sectors.find(sec => sec.id === act?.sectorId);
      const sch = schemes.find(sc => sc.id === (sec ? sec.schemeId : act?.schemeId));
      const soeNames = alloc.fundedSOEs?.map(f => soes.find(s => s.id === f.soeId)?.name).filter(Boolean) || [];
      
      let hierarchy = '';
      if (alloc.subActivityId) {
        hierarchy = [sch?.name, sec?.name, act?.name, sa?.name].filter(Boolean).join(' -> ');
      } else if (alloc.activityId) {
        hierarchy = [sch?.name, sec?.name, act?.name].filter(Boolean).join(' -> ');
      }

      const searchLower = ledgerSearchTerm.toLowerCase();
      const matchesSearch = !ledgerSearchTerm || (
        hierarchy.toLowerCase().includes(searchLower) ||
        soeNames.join(' ').toLowerCase().includes(searchLower) ||
        r?.name.toLowerCase().includes(searchLower) ||
        alloc.remarks?.toLowerCase().includes(searchLower) ||
        alloc.id.toLowerCase().includes(searchLower)
      );

      const matchesFilters = (
        (!ledgerFilters.scheme || sch?.name === ledgerFilters.scheme) &&
        (!ledgerFilters.sector || sec?.name === ledgerFilters.sector) &&
        (!ledgerFilters.activity || act?.name === ledgerFilters.activity) &&
        (!ledgerFilters.subActivity || sa?.name === ledgerFilters.subActivity) &&
        (!ledgerFilters.range || r?.name === ledgerFilters.range) &&
        (!ledgerFilters.soe || soeNames.includes(ledgerFilters.soe))
      );
      return matchesSearch && matchesFilters;
    });

    let totalCredit = 0;
    let totalDebit = 0;

    filtered.forEach(alloc => {
      totalCredit += alloc.amount;
      const allocExpenses = expenses.filter(e => e.allocationId === alloc.id && e.status !== 'rejected');
      totalDebit += allocExpenses.reduce((sum, e) => sum + e.amount, 0);
    });

    return {
      allocations: filtered,
      totals: {
        credit: totalCredit,
        debit: totalDebit,
        balance: totalCredit - totalDebit
      }
    };
  }, [currentAllocations, ledgerSearchTerm, ledgerFilters, ranges, subActivities, activities, sectors, schemes, soes, expenses]);

    const downloadLedgerPDF = () => {
      const doc = new jsPDF('landscape');
      doc.setFontSize(16);
      doc.text("Passbook Ledger Report", 14, 15);
      doc.setFontSize(10);
      doc.text(`Financial Year: ${fys.find(f => f.id === selectedFY)?.name || selectedFY}`, 14, 22);
      
      const headers = ["Date", "Range", "Hierarchy & SOE", "Description", "Approval ID", "Credit (Rs.)", "Debit (Rs.)", "Balance (Rs.)"];
      const body: any[] = [];
      
      filteredLedgerData.allocations.forEach(alloc => {
        const r = ranges.find(r => r.id === alloc.rangeId);
        const soeNames = alloc.fundedSOEs?.map(f => soes.find(s => s.id === f.soeId)?.name).filter(Boolean).join(', ') || 'Pending Funds';
        
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

        const allocExpenses = expenses.filter(e => e.allocationId === alloc.id && e.status !== 'rejected').sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        let currentBalance = alloc.amount;
        
        // Initial Allocation Row
        body.push([
          "-",
          r?.name || 'N/A',
          `${hierarchy || 'N/A'}\n${soeNames}`,
          "Initial Allocation",
          "-",
          alloc.amount.toLocaleString('en-IN'),
          "-",
          currentBalance.toLocaleString('en-IN')
        ]);

        // Expense Rows
        allocExpenses.forEach(exp => {
          currentBalance -= exp.amount;
          body.push([
            exp.date ? exp.date.split('-').reverse().join('/') : '',
            r?.name || 'N/A',
            `${hierarchy || 'N/A'}\n${soeNames}`,
            exp.description,
            exp.approvalId ? `#${exp.approvalId}` : '-',
            "-",
            exp.amount.toLocaleString('en-IN'),
            currentBalance.toLocaleString('en-IN')
          ]);
        });
      });

      autoTable(doc, {
        head: [headers],
        body: body,
        startY: 30,
        styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak' },
        headStyles: { fillColor: [5, 150, 105] },
        columnStyles: {
          0: { cellWidth: 20 },
          1: { cellWidth: 25 },
          2: { cellWidth: 80 },
          3: { cellWidth: 60 },
          4: { cellWidth: 20 },
          5: { cellWidth: 25, halign: 'right' },
          6: { cellWidth: 25, halign: 'right' },
          7: { cellWidth: 25, halign: 'right' }
        }
      });

      doc.save(`ledger_report_${selectedFY}.pdf`);
    };

    const downloadLedgerExcel = async () => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Passbook Ledger");
      
      const title = `Passbook Ledger Report - FY ${fys.find(f => f.id === selectedFY)?.name || selectedFY}`;
      const titleRow = sheet.addRow([title]);
      titleRow.font = { bold: true, size: 14 };
      sheet.mergeCells(1, 1, 1, 8);
      titleRow.alignment = { horizontal: 'center' };

      const headers = ["Date", "Range", "Hierarchy & SOE", "Description", "Approval ID", "Credit (Rs.)", "Debit (Rs.)", "Balance (Rs.)"];
      const headerRow = sheet.addRow(headers);
      headerRow.eachCell((cell) => {
        cell.font = { bold: true };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' }
        };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });

      filteredLedgerData.allocations.forEach(alloc => {
        const r = ranges.find(r => r.id === alloc.rangeId);
        const soeNames = alloc.fundedSOEs?.map(f => soes.find(s => s.id === f.soeId)?.name).filter(Boolean).join(', ') || 'Pending Funds';
        
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

        const allocExpenses = expenses.filter(e => e.allocationId === alloc.id && e.status !== 'rejected').sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        let currentBalance = alloc.amount;
        
        const row1 = sheet.addRow([
          "-",
          r?.name || 'N/A',
          `${hierarchy || 'N/A'}\n${soeNames}`,
          "Initial Allocation",
          "-",
          alloc.amount,
          "-",
          currentBalance
        ]);
        row1.eachCell(cell => {
          cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
          cell.alignment = { wrapText: true, vertical: 'middle' };
        });

        allocExpenses.forEach(exp => {
          currentBalance -= exp.amount;
          const row = sheet.addRow([
            exp.date ? exp.date.split('-').reverse().join('/') : '',
            r?.name || 'N/A',
            `${hierarchy || 'N/A'}\n${soeNames}`,
            exp.description,
            exp.approvalId ? `#${exp.approvalId}` : '-',
            "-",
            exp.amount,
            currentBalance
          ]);
          row.eachCell(cell => {
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            cell.alignment = { wrapText: true, vertical: 'middle' };
          });
        });
      });

      sheet.columns.forEach((column, i) => {
        column.width = [12, 15, 45, 40, 15, 15, 15, 15][i];
        if (i >= 5) {
          column.alignment = { horizontal: 'right', vertical: 'middle' };
          column.numFmt = '#,##0.00';
        }
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `ledger_report_${selectedFY}.xlsx`);
    };

  const getSoeAllocated = (soeId: string) => baseAllocations.reduce((sum, a) => sum + (a.fundedSOEs?.find(f => f.soeId === soeId)?.amount || 0), 0);
  const getAllocSpent = (allocId: string) => currentExpenses.filter(e => e.allocationId === allocId).reduce((sum, e) => sum + e.amount, 0);

  const totalAllocated = baseAllocations.reduce((sum, a) => sum + a.amount, 0);
  const totalSpent = baseExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalBudget = userRangeId ? totalAllocated : currentSoes.reduce((sum, s) => sum + getApprovedBudget(s), 0);
  const totalReceivedInTry = userRangeId ? 0 : currentSoes.reduce((sum, s) => sum + getReceivedInTry(s), 0);
  const remainingBalance = totalAllocated - totalSpent;
  const totalTryBalance = totalReceivedInTry - totalAllocated;

  const chartData = userRangeId ? [
    { name: 'Allocated (Unspent)', value: Math.max(0, totalAllocated - totalSpent), color: '#007bff' },
    { name: 'Spent', value: totalSpent, color: '#dc3545' }
  ] : [
    { name: 'Allocated (Unspent)', value: Math.max(0, totalAllocated - totalSpent), color: '#007bff' },
    { name: 'Spent', value: totalSpent, color: '#dc3545' },
    { name: 'Unallocated', value: Math.max(0, totalBudget - totalAllocated), color: '#28a745' }
  ];

  const soeAbstractData = useMemo(() => {
    return currentSoes.map(soe => {
      const sch = schemes.find(s => s.id === soe.schemeId);
      const sec = sectors.find(s => s.id === soe.sectorId);
      const act = activities.find(a => a.id === soe.activityId);
      const sa = subActivities.find(s => s.id === soe.subActivityId);
      const hierarchy = [sch?.name, sec?.name, act?.name, sa?.name].filter(Boolean).join(' > ');

      const allocated = baseAllocations.reduce((sum, a) => {
        const funded = a.fundedSOEs?.find(f => f.soeId === soe.id);
        return sum + (funded?.amount || 0);
      }, 0);

      const spent = baseExpenses.filter(e => e.soeId === soe.id).reduce((sum, e) => sum + e.amount, 0);
      const approvedBudget = getApprovedBudget(soe);
      const receivedInTry = getReceivedInTry(soe);

      return {
        id: soe.id,
        soeId: soe.id,
        soeName: soe.name,
        hierarchy,
        schemeName: sch?.name || '',
        sectorName: sec?.name || '',
        activityName: act?.name || '',
        subActivityName: sa?.name || '',
        approvedBudget,
        receivedInTry,
        allocated,
        toBeAllocated: receivedInTry - allocated,
        tryBalance: receivedInTry - allocated,
        spent,
        remainingToSpend: allocated - spent,
        schemeId: soe.schemeId,
        sectorId: soe.sectorId,
        activityId: soe.activityId,
        subActivityId: soe.subActivityId
      };
    })
    .filter(item => !userRangeId || item.allocated > 0)
    .sort((a, b) => a.hierarchy.localeCompare(b.hierarchy) || a.soeName.localeCompare(b.soeName));
  }, [currentSoes, baseAllocations, baseExpenses, schemes, sectors, activities, subActivities, userRangeId]);

  const surrenderBudgetStatus = useMemo(() => {
    const { rangeId, schemeId, sectorId, activityId, subActivityId, soeId } = surrenderFormSelection;
    if (!rangeId || !soeId) return null;

    const relevantAllocations = baseAllocations.filter(a => 
      a.rangeId === rangeId &&
      a.schemeId === schemeId &&
      (!sectorId || a.sectorId === sectorId) &&
      (!activityId || a.activityId === activityId) &&
      (!subActivityId || a.subActivityId === subActivityId)
    );

    let totalAllocated = 0;
    let totalSpent = 0;

    relevantAllocations.forEach(alloc => {
      const funded = alloc.fundedSOEs?.find(f => f.soeId === soeId);
      if (funded) {
        totalAllocated += funded.amount;
        const spent = baseExpenses.filter(e => 
          e.allocationId === alloc.id && 
          e.soeId === soeId &&
          e.status !== 'rejected'
        ).reduce((sum, e) => sum + e.amount, 0);
        totalSpent += spent;
      }
    });

    return {
      allocated: totalAllocated,
      spent: totalSpent,
      balance: totalAllocated - totalSpent
    };
  }, [surrenderFormSelection, baseAllocations, baseExpenses]);

  const masterControlData = useMemo(() => {
    const map: Record<string, any> = {};
    
    baseAllocations.forEach(alloc => {
      // Apply filters
      if (reportFilters.scheme && alloc.schemeId !== reportFilters.scheme) return;
      if (reportFilters.sector && alloc.sectorId !== reportFilters.sector) return;
      if (reportFilters.activity && alloc.activityId !== reportFilters.activity) return;
      if (reportFilters.subActivity && alloc.subActivityId !== reportFilters.subActivity) return;
      if (reportFilters.range && alloc.rangeId !== reportFilters.range) return;

      const range = ranges.find(r => r.id === alloc.rangeId);
      const sch = schemes.find(s => s.id === alloc.schemeId);
      const sec = sectors.find(s => s.id === alloc.sectorId);
      const act = activities.find(a => a.id === alloc.activityId);
      const sa = subActivities.find(s => s.id === alloc.subActivityId);
      
      alloc.fundedSOEs?.forEach(funded => {
        if (reportFilters.soe && funded.soeId !== reportFilters.soe) return;

        const key = `${alloc.rangeId}-${alloc.schemeId}-${alloc.sectorId}-${alloc.activityId}-${alloc.subActivityId}-${funded.soeId}`;
        const spent = baseExpenses.filter(e => 
          e.allocationId === alloc.id && 
          e.soeId === funded.soeId &&
          e.status !== 'rejected'
        ).reduce((sum, e) => sum + e.amount, 0);
        
        if (map[key]) {
          map[key].allocated += funded.amount;
          map[key].expenditure += spent;
          map[key].balance = map[key].allocated - map[key].expenditure;
        } else {
          const soe = soes.find(s => s.id === funded.soeId);
          map[key] = {
            rangeName: range?.name || 'N/A',
            schemeName: sch?.name || 'N/A',
            sectorName: sec?.name || 'N/A',
            activityName: act?.name || 'N/A',
            subActivityName: sa?.name || 'N/A',
            soeName: soe?.name || 'N/A',
            allocated: funded.amount,
            expenditure: spent,
            balance: funded.amount - spent
          };
        }
      });
    });
    
    let result = Object.values(map);
    
    if (reportSearchTerm) {
      const lower = reportSearchTerm.toLowerCase();
      result = result.filter((item: any) => 
        item.rangeName.toLowerCase().includes(lower) ||
        item.schemeName.toLowerCase().includes(lower) ||
        item.soeName.toLowerCase().includes(lower) ||
        item.activityName.toLowerCase().includes(lower)
      );
    }

    return result.sort((a: any, b: any) => 
      a.rangeName.localeCompare(b.rangeName) || 
      a.schemeName.localeCompare(b.schemeName) || 
      a.soeName.localeCompare(b.soeName)
    );
  }, [ranges, baseAllocations, baseExpenses, schemes, sectors, activities, subActivities, soes, reportFilters, reportSearchTerm]);

  const soeAbstractForAllocations = useMemo(() => {
    return soeAbstractData.filter(item => {
      // Apply dynamic filtering based on form selection
      if (allocationFormFilters.soeId && item.id !== allocationFormFilters.soeId) return false;
      if (allocationFormFilters.subActivityId && item.subActivityId !== allocationFormFilters.subActivityId) return false;
      if (allocationFormFilters.activityId && item.activityId !== allocationFormFilters.activityId) return false;
      if (allocationFormFilters.sectorId && item.sectorId !== allocationFormFilters.sectorId) return false;
      if (allocationFormFilters.schemeId && item.schemeId !== allocationFormFilters.schemeId) return false;
      
      if (soeSearchTerm) {
        const lowerSearch = soeSearchTerm.toLowerCase();
        return item.soeName.toLowerCase().includes(lowerSearch) || 
               item.hierarchy.toLowerCase().includes(lowerSearch);
      }
      
      return true;
    });
  }, [soeAbstractData, allocationFormFilters, soeSearchTerm]);


  // --- Render Functions for Tabs ---
  const renderDashboard = () => {
    const rangeAllocationMap: Record<string, any> = {};
    baseAllocations.forEach(alloc => {
      const key = `${alloc.rangeId}-${alloc.schemeId}-${alloc.sectorId}-${alloc.activityId}`;
      const spent = baseExpenses.filter(e => e.allocationId === alloc.id).reduce((sum, e) => sum + e.amount, 0);
      
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
    const expensesByDate = baseExpenses.reduce((acc, exp) => {
      acc[exp.date] = (acc[exp.date] || 0) + exp.amount;
      return acc;
    }, {} as Record<string, number>);
    
    const trendData = Object.keys(expensesByDate).sort().map(date => ({
      date,
      amount: expensesByDate[date]
    }));

    const schemeSummary = currentSchemes.map(sch => {
      const schAllocations = baseAllocations.filter(a => a.schemeId === sch.id);
      const totalAllocated = schAllocations.reduce((sum, a) => sum + a.amount, 0);
      const totalSpent = baseExpenses.filter(e => schAllocations.some(a => a.id === e.allocationId)).reduce((sum, e) => sum + e.amount, 0);
      
      const schemeSoes = currentSoes.filter(s => s.schemeId === sch.id);
      const totalSoeBudget = schemeSoes.reduce((sum, s) => sum + getApprovedBudget(s), 0);

      const displayBudget = userRangeId ? totalAllocated : totalSoeBudget;

      return {
        name: sch.name,
        budget: displayBudget,
        allocated: totalAllocated,
        spent: totalSpent,
        balance: totalAllocated - totalSpent
      };
    }).filter(s => !userRangeId || s.allocated > 0 || s.spent > 0);

    const sectorSummary = currentSectors.map(sec => {
      const secAllocations = baseAllocations.filter(a => a.sectorId === sec.id);
      const totalAllocated = secAllocations.reduce((sum, a) => sum + a.amount, 0);
      const totalSpent = baseExpenses.filter(e => secAllocations.some(a => a.id === e.allocationId)).reduce((sum, e) => sum + e.amount, 0);
      
      return {
        name: sec.name,
        allocated: totalAllocated,
        spent: totalSpent,
        balance: totalAllocated - totalSpent
      };
    }).filter(s => !userRangeId || s.allocated > 0 || s.spent > 0);

    const activitySummary = currentActivities.map(act => {
      const sec = currentSectors.find(s => s.id === act.sectorId);
      const sch = currentSchemes.find(s => s.id === (sec ? sec.schemeId : act.schemeId));

      const actAllocations = baseAllocations.filter(a => a.activityId === act.id);
      const totalAllocated = actAllocations.reduce((sum, a) => sum + a.amount, 0);
      const totalSpent = baseExpenses.filter(e => actAllocations.some(a => a.id === e.allocationId)).reduce((sum, e) => sum + e.amount, 0);
      
      return {
        scheme: sch?.name || 'N/A',
        sector: sec?.name || 'N/A',
        name: act.name,
        allocated: totalAllocated,
        spent: totalSpent,
        balance: totalAllocated - totalSpent
      };
    }).filter(a => !userRangeId || a.allocated > 0 || a.spent > 0).sort((a, b) => {
      const aHasEntry = a.allocated > 0 || a.spent > 0 ? 1 : 0;
      const bHasEntry = b.allocated > 0 || b.spent > 0 ? 1 : 0;
      if (aHasEntry !== bHasEntry) return bHasEntry - aHasEntry;
      return a.scheme.localeCompare(b.scheme) || a.sector.localeCompare(b.sector) || a.name.localeCompare(b.name);
    });

    const soeDashboardSummary = soeAbstractData.filter(item => {
      const lowerSearch = (dashboardSearch || searchTerm).toLowerCase();
      if (lowerSearch) {
        return item.soeName.toLowerCase().includes(lowerSearch) || item.hierarchy.toLowerCase().includes(lowerSearch);
      }
      return true;
    });

    return (
      <div className="space-y-6">
        <div className={`grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 ${userRangeId ? 'lg:grid-cols-4' : 'xl:grid-cols-6 lg:grid-cols-3'} gap-2 sm:gap-3`}>
          <StatCard title={userRangeId ? "Total Allocation" : "Total SOE Budget"} amount={totalBudget} icon={<Wallet />} color="text-blue-600" />
          {!userRangeId && <StatCard title="Total Received (Try)" amount={totalReceivedInTry} icon={<Landmark />} color="text-indigo-500" />}
          <StatCard title="Total Allocated" amount={totalAllocated} icon={<Map />} color="text-indigo-600" />
          {!userRangeId && <StatCard title="To Be Allocated" amount={Math.max(0, totalBudget - totalAllocated)} icon={<IndianRupee />} color="text-orange-500" />}
          <StatCard 
            title="Total Expenditure" 
            amount={totalSpent} 
            icon={<TrendingDown />} 
            color="text-red-600" 
            subtitle={totalBudget > 0 ? `${((totalSpent / totalBudget) * 100).toFixed(1)}% of Budget` : undefined}
          />
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

        {trendData.length > 0 && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold mb-4 border-b pb-2 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-red-600" /> Spending Trend (Expenditure Over Time)
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tickFormatter={(val) => val && typeof val === 'string' ? val.split('-').reverse().slice(0, 2).join('/') : ''} />
                  <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `₹${val/1000}k`} />
                  <Tooltip formatter={(value: number) => `₹${value.toLocaleString()}`} />
                  <Legend />
                  <Line type="monotone" dataKey="amount" name="Expenditure" stroke="#dc3545" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

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
            <table className="w-full text-left border-collapse text-sm min-w-[600px]">
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
                  .filter(act => {
                    const searchStr = (dashboardSearch || searchTerm).toLowerCase();
                    return (
                      act.scheme.toLowerCase().includes(searchStr) ||
                      act.sector.toLowerCase().includes(searchStr) ||
                      act.name.toLowerCase().includes(searchStr) ||
                      act.allocated.toString().includes(searchStr) ||
                      act.spent.toString().includes(searchStr) ||
                      act.balance.toString().includes(searchStr)
                    );
                  })
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

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold mb-4 border-b pb-2 flex items-center gap-2">
            <Activity className="h-5 w-5 text-emerald-600" /> Live SOE Budget Tracker
          </h3>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left border-collapse text-sm min-w-[1000px]">
              <thead className="sticky top-0 bg-white shadow-sm">
                <tr className="bg-gray-50 text-gray-600 font-semibold">
                  <th className="p-3 border-b">Hierarchy (Scheme &gt; Sector &gt; Activity)</th>
                  <th className="p-3 border-b">SOE Head</th>
                  {!userRangeId && <th className="p-3 border-b text-right">Approved Budget</th>}
                  {!userRangeId && <th className="p-3 border-b text-right">Received in Try</th>}
                  <th className="p-3 border-b text-right">Allocated</th>
                  {!userRangeId && <th className="p-3 border-b text-right">To Be Allocated</th>}
                  {!userRangeId && <th className="p-3 border-b text-right">Try Balance</th>}
                  <th className="p-3 border-b text-right">Spent</th>
                  <th className="p-3 border-b text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {soeDashboardSummary.map((item, idx) => (
                  <tr key={idx} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="p-3 text-xs text-gray-500">{item.hierarchy || 'N/A'}</td>
                    <td className="p-3 font-medium text-gray-800">{item.soeName}</td>
                    {!userRangeId && <td className="p-3 text-right text-gray-700">₹{item.approvedBudget.toLocaleString()}</td>}
                    {!userRangeId && <td className="p-3 text-right text-indigo-600">₹{item.receivedInTry.toLocaleString()}</td>}
                    <td className="p-3 text-right text-blue-600">₹{item.allocated.toLocaleString()}</td>
                    {!userRangeId && (
                      <td className={`p-3 text-right font-bold ${item.toBeAllocated > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
                        ₹{item.toBeAllocated.toLocaleString()}
                      </td>
                    )}
                    {!userRangeId && (
                      <td className={`p-3 text-right font-bold ${item.tryBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        ₹{item.tryBalance.toLocaleString()}
                      </td>
                    )}
                    <td className="p-3 text-right text-red-600">₹{item.spent.toLocaleString()}</td>
                    <td className={`p-3 text-right font-bold ${item.remainingToSpend > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
                      ₹{item.remainingToSpend.toLocaleString()}
                    </td>
                  </tr>
                ))}
                {soeDashboardSummary.length === 0 && (
                  <tr>
                    <td colSpan={userRangeId ? 5 : 9} className="p-4 text-center text-gray-500">No SOE data matching current selection.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
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
              <table className="w-full text-left border-collapse text-sm min-w-[600px]">
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
                  placeholder="Search unit..." 
                  value={rangeSearch}
                  onChange={(e) => setRangeSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm min-w-[800px]">
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
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-gray-50 text-gray-600 text-sm">
                    <th className="p-3 border-b">Date</th>
                    <th className="p-3 border-b">Range</th>
                    <th className="p-3 border-b">SOE</th>
                    <th className="p-3 border-b text-right">Approval ID</th>
                    <th className="p-3 border-b text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {currentExpenses.slice().reverse().slice(0, 5).map((exp) => {
                    const alloc = allocations.find(a => a.id === exp.allocationId);
                    const range = ranges.find(r => r.id === alloc?.rangeId);
                    const soe = soes.find(s => s.id === exp.soeId);
                    return (
                      <tr key={exp.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="p-3">{exp.date ? exp.date.split('-').reverse().join('/') : ''}</td>
                        <td className="p-3 font-medium">{range?.name}</td>
                        <td className="p-3 text-gray-600">{soe?.name}</td>
                        <td className="p-3 text-right font-mono text-xs">{exp.approvalId ? `#${exp.approvalId}` : '-'}</td>
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

  const renderMyRangeSummaryTable = () => {
    // Group currentAllocations by SOE Head
    const summaryMap: Record<string, { hierarchy: string, soeName: string, allocated: number, spent: number, remaining: number }> = {};
    
    currentAllocations.forEach(alloc => {
      alloc.fundedSOEs?.forEach(f => {
        const soe = soes.find(s => s.id === f.soeId);
        if (!soe) return;
        
        let hierarchy = '';
        if (alloc.subActivityId) {
          const sa = subActivities.find(sa => sa.id === alloc.subActivityId);
          const act = activities.find(a => a.id === sa?.activityId);
          const sec = sectors.find(sec => sec.id === act?.sectorId);
          const sch = schemes.find(sc => sc.id === (sec ? sec.schemeId : act?.schemeId));
          hierarchy = [sch?.name, sec?.name, act?.name, sa?.name].filter(Boolean).join(' > ');
        } else if (alloc.activityId) {
          const act = activities.find(a => a.id === alloc.activityId);
          const sec = sectors.find(sec => sec.id === act?.sectorId);
          const sch = schemes.find(sc => sc.id === (sec ? sec.schemeId : act?.schemeId));
          hierarchy = [sch?.name, sec?.name, act?.name].filter(Boolean).join(' > ');
        }

        const spent = currentExpenses.filter(e => e.allocationId === alloc.id && e.soeId === f.soeId).reduce((sum, e) => sum + e.amount, 0);
        const key = `${alloc.id}-${f.soeId}`;

        if (summaryMap[key]) {
          summaryMap[key].allocated += f.amount;
          summaryMap[key].spent += spent;
          summaryMap[key].remaining = summaryMap[key].allocated - summaryMap[key].spent;
        } else {
          summaryMap[key] = {
            hierarchy,
            soeName: soe.name,
            allocated: f.amount,
            spent,
            remaining: f.amount - spent
          };
        }
      });
    });

    const summaryData = Object.values(summaryMap).sort((a, b) => a.hierarchy.localeCompare(b.hierarchy) || a.soeName.localeCompare(b.soeName));

    return (
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
        <div className="flex justify-between items-center mb-4 border-b pb-2">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Activity className="h-5 w-5 text-emerald-600" /> My Range Summary
          </h3>
        </div>
        <div className="overflow-x-auto max-h-80">
          <table className="w-full text-left border-collapse text-sm min-w-[800px]">
            <thead className="sticky top-0 bg-white shadow-sm">
              <tr className="bg-gray-50 text-gray-600 font-semibold">
                <th className="p-3 border-b">Hierarchy</th>
                <th className="p-3 border-b">SOE Head</th>
                <th className="p-3 border-b text-right">Allocated to Me</th>
                <th className="p-3 border-b text-right">My Expenditure</th>
                <th className="p-3 border-b text-right">My Remaining Balance</th>
              </tr>
            </thead>
            <tbody>
              {summaryData.map((item, idx) => (
                <tr key={idx} className="border-b hover:bg-gray-50 transition-colors">
                  <td className="p-3 text-xs text-gray-500">{item.hierarchy || 'N/A'}</td>
                  <td className="p-3 font-medium text-gray-800">{item.soeName}</td>
                  <td className="p-3 text-right text-blue-600">₹{item.allocated.toLocaleString()}</td>
                  <td className="p-3 text-right text-red-600">₹{item.spent.toLocaleString()}</td>
                  <td className={`p-3 text-right font-bold ${item.remaining > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
                    ₹{item.remaining.toLocaleString()}
                  </td>
                </tr>
              ))}
              {summaryData.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-gray-500">No allocations found for your unit.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderSoeAbstractTable = () => (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
      <div 
        className="flex justify-between items-center mb-4 border-b pb-2 cursor-pointer hover:bg-gray-50 -mx-6 px-6"
        onClick={() => setIsSoeTrackerExpanded(!isSoeTrackerExpanded)}
      >
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Activity className="h-5 w-5 text-emerald-600" /> Live SOE Budget Tracker
        </h3>
        <div className="flex items-center gap-4">
          {isSoeTrackerExpanded && (
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search tracker..."
                className="pl-9 pr-4 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 w-64"
                value={soeSearchTerm}
                onChange={(e) => setSoeSearchTerm(e.target.value)}
              />
            </div>
          )}
          <button type="button" className="text-gray-500 hover:text-gray-700">
            {isSoeTrackerExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
      </div>
      
      {isSoeTrackerExpanded && (
        <div className="overflow-x-auto max-h-80">
          <table className="w-full text-left border-collapse text-sm min-w-[1000px]">
            <thead className="sticky top-0 bg-white shadow-sm">
              <tr className="bg-gray-50 text-gray-600 font-semibold">
                <th className="p-3 border-b">Hierarchy</th>
                <th className="p-3 border-b">SOE Head</th>
                <th className="p-3 border-b text-right">Approved Budget</th>
                <th className="p-3 border-b text-right">Received in Try</th>
                <th className="p-3 border-b text-right">Allocated</th>
                <th className="p-3 border-b text-right">To Be Allocated</th>
                <th className="p-3 border-b text-right">Try Balance</th>
                <th className="p-3 border-b text-right">Spent</th>
                <th className="p-3 border-b text-right">Remaining to Spend</th>
              </tr>
            </thead>
            <tbody>
              {soeAbstractForAllocations.map((item) => (
                <tr key={item.id} className="border-b hover:bg-gray-50 transition-colors">
                  <td className="p-3 text-xs text-gray-500">{item.hierarchy || 'N/A'}</td>
                  <td className="p-3 font-medium text-gray-800">{item.soeName}</td>
                  <td className="p-3 text-right text-gray-700">₹{item.approvedBudget.toLocaleString()}</td>
                  <td className="p-3 text-right text-indigo-600">₹{item.receivedInTry.toLocaleString()}</td>
                  <td className="p-3 text-right text-blue-600">₹{item.allocated.toLocaleString()}</td>
                  <td className={`p-3 text-right font-bold ${item.toBeAllocated > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
                    ₹{item.toBeAllocated.toLocaleString()}
                  </td>
                  <td className={`p-3 text-right font-bold ${item.tryBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    ₹{item.tryBalance.toLocaleString()}
                  </td>
                  <td className="p-3 text-right text-red-600">₹{item.spent.toLocaleString()}</td>
                  <td className={`p-3 text-right font-bold ${item.remainingToSpend > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
                    ₹{item.remainingToSpend.toLocaleString()}
                  </td>
                </tr>
              ))}
              {soeAbstractForAllocations.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-gray-500">No SOE data matching current selection.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const getHierarchyText = (item: any) => {
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
    return hierarchy || 'Global (No Hierarchy)';
  };

  const formatHierarchyText = (item: any) => {
    const sch = schemes.find(sc => sc.id === item.schemeId);
    const sec = sectors.find(sec => sec.id === item.sectorId);
    const act = activities.find(a => a.id === item.activityId);
    const sa = subActivities.find(sa => sa.id === item.subActivityId);

    const parts = [];
    if (sch) parts.push(`Scheme: ${sch.name}`);
    if (sec) parts.push(`Sector: ${sec.name}`);
    if (act) parts.push(`Activity: ${act.name}`);
    if (sa) parts.push(`Sub-Activity: ${sa.name}`);

    return parts.length > 0 ? parts.join(' | ') : 'Global (No Hierarchy)';
  };

  const renderHierarchy = (item: any) => {
    return <span className="text-xs text-gray-500">{formatHierarchyText(item)}</span>;
  };



  const handleSaveReconciliation = async (allocationId: string) => {
    const distribution = reconData[allocationId] || {};
    const allocation = baseAllocations.find(a => a.id === allocationId);
    if (!allocation) return;

    const totalDistributed = Object.values(distribution).reduce<number>((sum, val) => sum + (parseFloat(val as string) || 0), 0);
    
    if (Math.abs(totalDistributed - allocation.amount) > 0.01) {
      showAlert("Total distributed amount must match the allocated amount.");
      return;
    }

    try {
      const fundedSOEs = Object.entries(distribution)
        .filter(([_, amount]) => (parseFloat(amount as string) || 0) > 0)
        .map(([soeId, amount]) => ({ soeId, amount: parseFloat(amount as string) }));

      await updateDoc(doc(db, 'allocations', allocationId), {
        fundedSOEs,
        status: 'Funded'
      });
      
      const newReconData = { ...reconData };
      delete newReconData[allocationId];
      setReconData(newReconData);
      
      showAlert("Reconciliation saved successfully!");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'allocations');
    }
  };

  const renderBudgetTracker = () => {
    // Flatten all SOEs with their hierarchy for the table
    const flattenedData = currentSoes.map(soe => {
      const scheme = currentSchemes.find(s => s.id === soe.schemeId);
      const sector = currentSectors.find(s => s.id === soe.sectorId);
      
      const sanctioned = getApprovedBudget(soe);
      const approved = getReceivedInTry(soe);
      const allocated = getSoeAllocated(soe.id);
      const balance = approved - allocated;

      return {
        id: soe.id,
        schemeName: scheme?.name || 'Unknown Scheme',
        sectorName: sector?.name || 'Unknown Sector',
        soeName: soe.name,
        sanctioned,
        approved,
        allocated,
        balance
      };
    }).filter(item => item.sanctioned > 0 || item.approved > 0 || item.allocated > 0);

    // Apply search filter
    const filteredData = flattenedData.filter(item => {
      const searchStr = trackerSearch.toLowerCase() || searchTerm.toLowerCase();
      return (
        item.schemeName.toLowerCase().includes(searchStr) ||
        item.sectorName.toLowerCase().includes(searchStr) ||
        item.soeName.toLowerCase().includes(searchStr) ||
        item.sanctioned.toString().includes(searchStr) ||
        item.approved.toString().includes(searchStr) ||
        item.allocated.toString().includes(searchStr) ||
        item.balance.toString().includes(searchStr)
      );
    });

    return (
      <div className="bg-white rounded-xl shadow-sm border border-emerald-100 overflow-hidden mb-6">
        <div 
          className="bg-emerald-50 p-4 flex items-center justify-between cursor-pointer hover:bg-emerald-100 transition-colors"
          onClick={() => setIsSoeTrackerExpanded(!isSoeTrackerExpanded)}
        >
          <div className="flex items-center gap-2">
            <div className="bg-emerald-600 p-1.5 rounded-lg text-white">
              <TrendingDown className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-emerald-900 text-sm">Live Budget Tracker (Abstract Table)</h3>
              <p className="text-[10px] text-emerald-600 font-medium uppercase tracking-wider">Real-time SOE-wise Allocation Status</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-emerald-500" />
              <input
                type="text"
                placeholder="Search budget details..."
                value={trackerSearch}
                onChange={(e) => setTrackerSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs border border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 w-48 md:w-64 bg-white"
              />
            </div>
            <span className="text-[10px] bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
              {filteredData.length} Records
            </span>
            {isSoeTrackerExpanded ? <ChevronUp className="w-5 h-5 text-emerald-600" /> : <ChevronDown className="w-5 h-5 text-emerald-600" />}
          </div>
        </div>

        {isSoeTrackerExpanded && (
          <div className="p-0 overflow-x-auto animate-in fade-in slide-in-from-top-2 duration-300">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="bg-emerald-600 text-white text-[11px] uppercase tracking-wider">
                  <th className="px-4 py-3 font-bold border-r border-emerald-500">Scheme</th>
                  <th className="px-4 py-3 font-bold border-r border-emerald-500">Sector</th>
                  <th className="px-4 py-3 font-bold border-r border-emerald-500">SOE Head</th>
                  <th className="px-4 py-3 font-bold border-r border-emerald-500 text-right">Total Sanction (Approved)</th>
                  <th className="px-4 py-3 font-bold border-r border-emerald-500 text-right">Received Budget (Try)</th>
                  <th className="px-4 py-3 font-bold border-r border-emerald-500 text-right">Allocated to Ranges</th>
                  <th className="px-4 py-3 font-bold text-right">Balance to Allocate</th>
                </tr>
              </thead>
              <tbody className="text-[11px]">
                {filteredData.length > 0 ? (
                  filteredData.map((item, idx) => (
                    <tr key={item.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-emerald-50/30'} hover:bg-emerald-100/50 transition-colors border-b border-emerald-50`}>
                      <td className="px-4 py-2.5 font-medium text-gray-900 border-r border-emerald-50 min-w-[150px]">{item.schemeName}</td>
                      <td className="px-4 py-2.5 text-gray-600 border-r border-emerald-50 min-w-[150px]">{item.sectorName}</td>
                      <td className="px-4 py-2.5 font-bold text-emerald-800 border-r border-emerald-50">{item.soeName}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-gray-500 border-r border-emerald-50">₹{item.sanctioned.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-gray-900 border-r border-emerald-50">₹{item.approved.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-blue-600 border-r border-emerald-50">₹{item.allocated.toLocaleString()}</td>
                      <td className={`px-4 py-2.5 text-right font-bold ${item.balance > 0 ? 'text-orange-600' : 'text-emerald-600'}`}>
                        ₹{item.balance.toLocaleString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-400 italic">
                      No budget records found matching your search.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-emerald-50 font-bold text-emerald-900 text-[11px]">
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-right uppercase tracking-wider border-r border-emerald-100">Grand Total</td>
                  <td className="px-4 py-3 text-right border-r border-emerald-100">₹{filteredData.reduce((sum, i) => sum + i.sanctioned, 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right border-r border-emerald-100">₹{filteredData.reduce((sum, i) => sum + i.approved, 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right border-r border-emerald-100">₹{filteredData.reduce((sum, i) => sum + i.allocated, 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">₹{filteredData.reduce((sum, i) => sum + i.balance, 0).toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    );
  };

  const handleSaveAllReconciliation = async () => {
    const provisionalSchemes = currentSchemes.filter(scheme => 
      soes.some(soe => soe.schemeId === scheme.id && soe.isProvisional)
    );

    const allocationsToSave = baseAllocations.filter(a => 
      (reconSchemeId === 'all' ? provisionalSchemes.some(ps => ps.id === a.schemeId) : a.schemeId === reconSchemeId) && a.status === 'Pending SOE Funds'
    );

    // Validate all variations are 0
    const invalid = allocationsToSave.some(alloc => {
      const distribution = reconData[alloc.id] || {};
      const totalDistributed = Object.values(distribution).reduce<number>((sum, val) => sum + (parseFloat(val as string) || 0), 0);
      return Math.abs(alloc.amount - totalDistributed) >= 0.01;
    });

    if (invalid) {
      showAlert("All rows must have zero variation before saving.");
      return;
    }

    setLoading(true);
    try {
      const promises = allocationsToSave.map(alloc => {
        const distribution = reconData[alloc.id] || {};
        const fundedSOEs = Object.entries(distribution)
          .filter(([_, amount]) => (parseFloat(amount as string) || 0) > 0)
          .map(([soeId, amount]) => ({ soeId, amount: parseFloat(amount as string) }));

        return updateDoc(doc(db, 'allocations', alloc.id), {
          fundedSOEs,
          status: 'Funded'
        });
      });

      await Promise.all(promises);
      setReconData({});
      showAlert("All reconciliations saved successfully!");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'allocations');
    } finally {
      setLoading(false);
    }
  };

  const renderApprovalModal = () => {
    if (!isApprovalModalOpen || !selectedExpenseForApproval) return null;

    const handleConfirm = () => {
      showConfirm(`Are you sure you want to ${approvalStatus} this expenditure? This action will lock the entry.`, async () => {
        await handleUpdateExpenseStatus(selectedExpenseForApproval.id, approvalStatus, true, approvalReason);
        setIsApprovalModalOpen(false);
        setSelectedExpenseForApproval(null);
        setApprovalReason('');
      });
    };

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
          <div className="bg-emerald-600 p-4 text-white flex justify-between items-center">
            <h3 className="font-bold">Expenditure Action</h3>
            <button onClick={() => setIsApprovalModalOpen(false)}><X className="w-5 h-5" /></button>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
              <select 
                value={approvalStatus} 
                onChange={(e) => setApprovalStatus(e.target.value as 'approved' | 'rejected')}
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="approved">Accept / Approve</option>
                <option value="rejected">Reject</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason / Remarks</label>
              <textarea 
                value={approvalReason}
                onChange={(e) => setApprovalReason(e.target.value)}
                placeholder="Enter reason for this action..."
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none min-h-[100px]"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button 
                onClick={handleConfirm}
                className={`flex-1 py-2 rounded-lg font-bold text-white transition-colors ${approvalStatus === 'approved' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}
              >
                Confirm {approvalStatus === 'approved' ? 'Approval' : 'Rejection'}
              </button>
              <button 
                onClick={() => setIsApprovalModalOpen(false)}
                className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-bold transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSoeExpModal = () => {
    if (!viewingSoeExp) return null;

    const relevantExpenses = expenses.filter(e => e.soeId === viewingSoeExp.soeId && e.status !== 'rejected');
    const total = relevantExpenses.reduce((sum, e) => sum + e.amount, 0);

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl overflow-hidden animate-in zoom-in duration-200">
          <div className="bg-emerald-600 p-4 text-white flex justify-between items-center">
            <div>
              <h3 className="font-bold">Expenditure Details</h3>
              <div className="text-[10px] opacity-90 font-medium uppercase tracking-wider">{viewingSoeExp.hierarchy} | {viewingSoeExp.soeName}</div>
            </div>
            <button onClick={() => setViewingSoeExp(null)} className="hover:bg-emerald-700 p-1 rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-6">
            <div className="overflow-y-auto max-h-[60vh]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-600 text-[10px] uppercase font-bold">
                    <th className="p-2 border-b">Date</th>
                    <th className="p-2 border-b">Approval ID</th>
                    <th className="p-2 border-b">Description</th>
                    <th className="p-2 border-b text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {relevantExpenses.map(exp => (
                    <tr key={exp.id} className="border-b hover:bg-gray-50 text-xs">
                      <td className="p-2">{exp.date ? exp.date.split('-').reverse().join('/') : ''}</td>
                      <td className="p-2 font-mono text-gray-500">{exp.approvalId ? `#${exp.approvalId}` : '-'}</td>
                      <td className="p-2">{exp.description}</td>
                      <td className="p-2 text-right font-bold text-red-600">₹{exp.amount.toLocaleString()}</td>
                    </tr>
                  ))}
                  {relevantExpenses.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-gray-500 italic">No expenditures found for this SOE Head.</td>
                    </tr>
                  )}
                </tbody>
                {relevantExpenses.length > 0 && (
                  <tfoot>
                    <tr className="bg-gray-50 font-bold">
                      <td colSpan={3} className="p-2 text-right text-gray-700">TOTAL EXPENDITURE:</td>
                      <td className="p-2 text-right text-red-700">₹{total.toLocaleString()}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            <div className="mt-6 flex justify-end">
              <button 
                onClick={() => setViewingSoeExp(null)}
                className="bg-gray-100 text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors font-medium text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderFundingModal = () => {
    if (!fundingAllocation) return null;

    const alreadyFundedTotal = fundingAllocation.fundedSOEs?.reduce((sum, f) => sum + f.amount, 0) || 0;
    const remainingToFund = fundingAllocation.amount - alreadyFundedTotal;

    // Filter SOEs that are relevant to this allocation's hierarchy
    const relevantSoes = currentSoes.filter(s => {
      if (s.schemeId !== fundingAllocation.schemeId) return false;
      if (fundingAllocation.sectorId && s.sectorId !== fundingAllocation.sectorId) return false;
      if (fundingAllocation.activityId && s.activityId !== fundingAllocation.activityId) return false;
      if (fundingAllocation.subActivityId && s.subActivityId !== fundingAllocation.subActivityId) return false;
      return true;
    });

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
          <div className="bg-emerald-600 p-4 text-white flex justify-between items-center">
            <h3 className="font-bold flex items-center gap-2">
              <Landmark className="w-5 h-5" />
              Assign SOE Funds
            </h3>
            <button onClick={() => setFundingAllocation(null)} className="hover:bg-white/20 rounded-full p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="p-6 space-y-4">
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
              <div className="text-xs text-gray-500 uppercase font-bold mb-2">Allocation Details</div>
              <div className="text-sm font-medium">{renderHierarchy(fundingAllocation)}</div>
              <div className="text-xs text-gray-400 mt-1">Range: {ranges.find(r => r.id === fundingAllocation.rangeId)?.name}</div>
              <div className="mt-3 flex justify-between items-end">
                <div>
                  <div className="text-[10px] text-gray-400 uppercase">Sanctioned</div>
                  <div className="font-bold text-gray-900">₹{fundingAllocation.amount.toLocaleString()}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-gray-400 uppercase">Remaining to Fund</div>
                  <div className="font-bold text-emerald-600">₹{remainingToFund.toLocaleString()}</div>
                </div>
              </div>
            </div>

            <form onSubmit={handleFundAllocation} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Select SOE Head (Budget Source)</label>
                <select name="soeId" required className="w-full p-2 border rounded text-sm">
                  <option value="">Select SOE</option>
                  {relevantSoes.map(s => {
                    const totalReceived = getReceivedInTry(s);
                    const totalFundedFromThisSoe = baseAllocations
                      .reduce((sum, a) => {
                        const funded = a.fundedSOEs?.find(f => f.soeId === s.id);
                        return sum + (funded?.amount || 0);
                      }, 0);
                    const available = totalReceived - totalFundedFromThisSoe;
                    return (
                      <option key={s.id} value={s.id} disabled={available <= 0}>
                        {s.name} (Available: ₹{available.toLocaleString()})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Amount to Assign (₹)</label>
                <input 
                  name="amount" 
                  type="number" 
                  step="0.01"
                  max={remainingToFund}
                  required 
                  placeholder="Enter amount"
                  className="w-full p-2 border rounded text-sm" 
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setFundingAllocation(null)}
                  className="flex-1 px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  Confirm Funding
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  };

  const handleSurrender = async (e: any) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const rangeId = formData.get('rangeId') as string;
    const schemeId = formData.get('schemeId') as string;
    const sectorId = formData.get('sectorId') as string;
    const activityId = formData.get('activityId') as string;
    const subActivityId = formData.get('subActivityId') as string;
    const soeId = formData.get('soeId') as string;
    const amount = Number(formData.get('amount'));
    const remarks = formData.get('remarks') as string;
    const date = formData.get('date') as string;

    if (!rangeId || !soeId || amount <= 0) {
      showAlert("Please fill all required fields and enter a valid amount.");
      return;
    }

    const rangeAlloc = allocations.find(a => 
      a.rangeId === rangeId && 
      a.schemeId === schemeId && 
      a.sectorId === sectorId && 
      a.activityId === activityId && 
      a.subActivityId === subActivityId &&
      a.fundedSOEs.some(s => s.soeId === soeId)
    );

    if (!rangeAlloc) {
      showAlert("No allocation found for this selection in the source unit.");
      return;
    }

    const soeFund = rangeAlloc.fundedSOEs.find(s => s.soeId === soeId);
    if (!soeFund) {
      showAlert("No funds found for this SOE in the selected allocation.");
      return;
    }

    // Validation: Ensure surrender doesn't leave allocation below expenditure for this SOE
    const spentForSoe = expenses
      .filter(e => e.allocationId === rangeAlloc.id && e.soeId === soeId && e.status !== 'rejected')
      .reduce((sum, e) => sum + e.amount, 0);

    if (soeFund.amount - amount < spentForSoe) {
      showAlert(`Cannot surrender ₹${amount.toLocaleString()}. Remaining SOE budget (₹${(soeFund.amount - amount).toLocaleString()}) would be less than expenditure (₹${spentForSoe.toLocaleString()}) for this SOE.`);
      return;
    }

    try {
      const activeFy = fys.find(f => f.name === selectedFY || f.id === selectedFY);
      const fyId = activeFy ? activeFy.id : selectedFY;

      // 1. Add Surrender record
      await addDoc(collection(db, 'surrenders'), {
        rangeId, schemeId, sectorId, activityId, subActivityId, soeId,
        amount, date, remarks, fyId, financialYear: selectedFY,
        createdAt: Date.now(), updatedAt: Date.now()
      });

      // 2. Decrease Source Unit Allocation
      const updatedFundedSOEs = rangeAlloc.fundedSOEs.map(s => 
        s.soeId === soeId ? { ...s, amount: s.amount - amount } : s
      );
      await updateDoc(doc(db, 'allocations', rangeAlloc.id), {
        fundedSOEs: updatedFundedSOEs,
        amount: rangeAlloc.amount - amount,
        updatedAt: Date.now()
      });

      showAlert("Amount surrendered successfully. It is now available for reallocation from the Sector-wide budget.");
      setEditingItem(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'surrenders');
    }
  };

  const renderSurrenderTab = () => {
    const filteredSurrenders = surrenders.filter(s => {
      const r = ranges.find(range => range.id === s.rangeId);
      const sch = schemes.find(scheme => scheme.id === s.schemeId);
      const soe = soes.find(soe => soe.id === s.soeId);

      const matchesSearch = 
        (r?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (sch?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (soe?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.remarks || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesFilters = 
        (!surrenderFilters.rangeId || s.rangeId === surrenderFilters.rangeId) &&
        (!surrenderFilters.schemeId || s.schemeId === surrenderFilters.schemeId) &&
        (!surrenderFilters.sectorId || soe?.sectorId === surrenderFilters.sectorId) &&
        (!surrenderFilters.activityId || soe?.activityId === surrenderFilters.activityId) &&
        (!surrenderFilters.subActivityId || soe?.subActivityId === surrenderFilters.subActivityId) &&
        (!surrenderFilters.soeId || s.soeId === surrenderFilters.soeId);

      return matchesSearch && matchesFilters;
    });

    return renderSimpleManager(
      'Surrender',
      filteredSurrenders,
      [
        { key: 'date', label: 'Date', render: (val) => val ? val.split('-').reverse().join('/') : '' },
        { key: 'rangeId', label: 'Hierarchy / Unit', render: (_, item) => {
          const r = ranges.find(r => r.id === item.rangeId);
          const hText = getHierarchyText(item);
          return (
            <div className="max-w-[200px]">
              <div className="font-bold text-gray-900 truncate leading-tight">{r?.name === 'Rajgarh Forest Division' ? 'Division' : r?.name}</div>
              <div className="text-[9px] text-gray-500 truncate" title={hText}>{hText}</div>
            </div>
          );
        }, searchableText: (_, item) => getHierarchyText(item) },
        { key: 'soeId', label: 'SOE', render: (val) => <span className="font-medium text-gray-700">{soes.find(s => s.id === val)?.name || 'N/A'}</span> },
        { key: 'amount', label: 'Amount', render: (val) => <span className="font-bold text-red-600">₹{val.toLocaleString()}</span> },
        { key: 'remarks', label: 'Remarks', render: (val) => <div className="text-[10px] italic text-gray-500 max-w-[150px] whitespace-normal break-words" title={val}>{val || '-'}</div> }
      ],
      handleSurrender,
      (id) => handleDelete('surrenders', id),
      (
        <div className="space-y-3">
          <CascadingDropdowns 
            schemes={currentSchemes} sectors={currentSectors} activities={currentActivities} subActivities={currentSubActivities} soes={currentSoes} soeBudgets={[]} allocations={baseAllocations} ranges={ranges} expenses={currentExpenses}
            editingItem={editingItem} type="Surrender" userRangeId={userRangeId}
            onSelectionChange={setSurrenderFormSelection}
          >
            {surrenderBudgetStatus && (
              <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100 mb-2">
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center">
                    <p className="text-[9px] font-bold text-emerald-800 uppercase">Allocated</p>
                    <p className="text-xs font-bold text-emerald-700">₹{surrenderBudgetStatus.allocated.toLocaleString()}</p>
                  </div>
                  <div className="text-center border-x border-emerald-100">
                    <p className="text-[9px] font-bold text-red-800 uppercase">Spent</p>
                    <p className="text-xs font-bold text-red-700">₹{surrenderBudgetStatus.spent.toLocaleString()}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] font-bold text-blue-800 uppercase">Balance</p>
                    <p className="text-xs font-bold text-blue-700">₹{surrenderBudgetStatus.balance.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            )}
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Date</label>
              <input type="date" name="date" required className="w-full p-1.5 border rounded text-sm" defaultValue={editingItem?.type === 'Surrender' ? editingItem.item.date : new Date().toISOString().split('T')[0]} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Amount to Surrender</label>
              <input type="number" name="amount" required defaultValue={editingItem?.type === 'Surrender' ? editingItem.item.amount : ''} placeholder="Amount" className="w-full p-1.5 border rounded text-sm" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Remarks</label>
              <textarea name="remarks" defaultValue={editingItem?.type === 'Surrender' ? editingItem.item.remarks : ''} placeholder="Remarks" className="w-full p-1.5 border rounded text-sm" rows={2}></textarea>
            </div>
          </CascadingDropdowns>
        </div>
      ),
      (item) => setEditingItem({ type: 'Surrender', item }),
      undefined,
      undefined,
      null,
      false,
      undefined,
      undefined,
      (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Range</label>
            <select 
              value={surrenderFilters.rangeId}
              onChange={(e) => setSurrenderFilters({ ...surrenderFilters, rangeId: e.target.value })}
              className="w-full p-1.5 border rounded text-xs bg-white"
            >
              <option value="">All Ranges</option>
              {ranges.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Scheme</label>
            <select 
              value={surrenderFilters.schemeId}
              onChange={(e) => setSurrenderFilters({ ...surrenderFilters, schemeId: e.target.value, sectorId: '', activityId: '', subActivityId: '', soeId: '' })}
              className="w-full p-1.5 border rounded text-xs bg-white"
            >
              <option value="">All Schemes</option>
              {schemes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Sector</label>
            <select 
              value={surrenderFilters.sectorId}
              onChange={(e) => setSurrenderFilters({ ...surrenderFilters, sectorId: e.target.value, activityId: '', subActivityId: '', soeId: '' })}
              className="w-full p-1.5 border rounded text-xs bg-white"
            >
              <option value="">All Sectors</option>
              {sectors.filter(s => !surrenderFilters.schemeId || s.schemeId === surrenderFilters.schemeId).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Activity</label>
            <select 
              value={surrenderFilters.activityId}
              onChange={(e) => setSurrenderFilters({ ...surrenderFilters, activityId: e.target.value, subActivityId: '', soeId: '' })}
              className="w-full p-1.5 border rounded text-xs bg-white"
            >
              <option value="">All Activities</option>
              {activities.filter(a => {
                if (surrenderFilters.sectorId) return a.sectorId === surrenderFilters.sectorId;
                if (surrenderFilters.schemeId) return a.schemeId === surrenderFilters.schemeId;
                return true;
              }).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Sub-Activity</label>
            <select 
              value={surrenderFilters.subActivityId}
              onChange={(e) => setSurrenderFilters({ ...surrenderFilters, subActivityId: e.target.value, soeId: '' })}
              className="w-full p-1.5 border rounded text-xs bg-white"
            >
              <option value="">All Sub-Activities</option>
              {subActivities.filter(sa => !surrenderFilters.activityId || sa.activityId === surrenderFilters.activityId).map(sa => <option key={sa.id} value={sa.id}>{sa.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">SOE</label>
            <select 
              value={surrenderFilters.soeId}
              onChange={(e) => setSurrenderFilters({ ...surrenderFilters, soeId: e.target.value })}
              className="w-full p-1.5 border rounded text-xs bg-white"
            >
              <option value="">All SOEs</option>
              {soes.filter(s => {
                if (surrenderFilters.subActivityId) return s.subActivityId === surrenderFilters.subActivityId;
                if (surrenderFilters.activityId) return s.activityId === surrenderFilters.activityId;
                if (surrenderFilters.sectorId) return s.sectorId === surrenderFilters.sectorId;
                if (surrenderFilters.schemeId) return s.schemeId === surrenderFilters.schemeId;
                return true;
              }).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="xl:col-span-6 flex justify-end">
            <button 
              onClick={() => setSurrenderFilters({ schemeId: '', sectorId: '', activityId: '', subActivityId: '', rangeId: '', soeId: '' })}
              className="text-xs text-red-600 hover:text-red-800 font-medium flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Reset Filters
            </button>
          </div>
        </div>
      )
    );
  };

  const renderReconciliation = () => {
    const provisionalSchemes = currentSchemes.filter(scheme => 
      soes.some(soe => soe.schemeId === scheme.id && soe.isProvisional)
    );

    const allocationsToReconcile = baseAllocations.filter(a => 
      (reconSchemeId === 'all' ? currentSchemes.some(ps => ps.id === a.schemeId) : a.schemeId === reconSchemeId) && a.status === 'Pending SOE Funds'
    );

    // Define the 4 SOE columns as requested
    const targetSoeNames = ['20 OC', '36 M&W', '21 Maint', '30MV']; // Mapping 36 M&S to 36 M&W if that's what's in data
    const displaySoeNames = ['20 OC', '36 M&S', '21 Maint', '30 MV'];

    // Hierarchical grouping
    const hierarchy: any[] = [];
    if (reconSchemeId) {
      const schemesToProcess = reconSchemeId === 'all' 
        ? currentSchemes 
        : [currentSchemes.find(s => s.id === reconSchemeId)].filter(Boolean);
      
      schemesToProcess.forEach(scheme => {
        const schemeSectors = currentSectors.filter(s => s.schemeId === scheme.id);
        const sectorRows: any[] = [];
        
        schemeSectors.forEach(sector => {
          const sectorActivities = currentActivities.filter(a => a.sectorId === sector.id);
          const activityRows: any[] = [];

          sectorActivities.forEach(activity => {
            const activitySubActivities = currentSubActivities.filter(sa => sa.activityId === activity.id);
            const subActivityRows: any[] = [];

            activitySubActivities.forEach(subActivity => {
              let subActivityAllocations = allocationsToReconcile.filter(a => a.subActivityId === subActivity.id);
              
              if (reconSearchTerm) {
                const lowerSearch = reconSearchTerm.toLowerCase();
                subActivityAllocations = subActivityAllocations.filter(a => {
                  const range = ranges.find(r => r.id === a.rangeId);
                  return (
                    (a.remarks || '').toLowerCase().includes(lowerSearch) ||
                    a.amount.toString().includes(lowerSearch) ||
                    (range?.name || '').toLowerCase().includes(lowerSearch) ||
                    subActivity.name.toLowerCase().includes(lowerSearch) ||
                    activity.name.toLowerCase().includes(lowerSearch) ||
                    sector.name.toLowerCase().includes(lowerSearch) ||
                    scheme.name.toLowerCase().includes(lowerSearch)
                  );
                });
              }

              if (subActivityAllocations.length > 0) {
                // Find SOE IDs for this sub-activity
                const subActivitySoes = currentSoes.filter(s => s.subActivityId === subActivity.id);
                const soeMap: Record<string, string> = {};
                targetSoeNames.forEach((name, idx) => {
                  const found = subActivitySoes.find(s => (s.name || '').includes(name.replace(/\s/g, '')));
                  if (found) soeMap[displaySoeNames[idx]] = found.id;
                });

                subActivityRows.push({
                  type: 'subActivity',
                  name: subActivity.name,
                  allocations: subActivityAllocations,
                  soeMap
                });
              }
            });

            if (subActivityRows.length > 0) {
              activityRows.push({
                type: 'activity',
                name: activity.name,
                subActivities: subActivityRows
              });
            }
          });

          if (activityRows.length > 0) {
            sectorRows.push({
              type: 'sector',
              name: sector.name,
              activities: activityRows
            });
          }
        });

        if (sectorRows.length > 0) {
          hierarchy.push({
            type: 'scheme',
            name: scheme.name,
            sectors: sectorRows
          });
        }
      });
    }

    const getRowTotals = (allocId: string) => {
      const distribution = reconData[allocId] || {};
      const total = Object.values(distribution).reduce<number>((sum, val) => sum + (parseFloat(val as string) || 0), 0);
      return total;
    };

    const isSchemeReady = allocationsToReconcile.length > 0 && allocationsToReconcile.every(a => {
      const total = getRowTotals(a.id);
      return Math.abs(a.amount - total) < 0.01;
    });

    const renderReconSummary = () => {
      if (!reconSchemeId) return null;
      
      let schemeSoes: any[] = [];
      let schemeAllocations: any[] = [];
      let title = "";

      if (reconSchemeId === 'all') {
        schemeSoes = currentSoes;
        schemeAllocations = baseAllocations;
        title = "All Schemes - SOE-wise Reconciliation Summary";
      } else {
        const scheme = currentSchemes.find(s => s.id === reconSchemeId);
        if (!scheme) return null;
        schemeSoes = currentSoes.filter(s => s.schemeId === reconSchemeId);
        schemeAllocations = baseAllocations.filter(a => a.schemeId === reconSchemeId);
        title = `${scheme.name} - SOE-wise Reconciliation Summary`;
      }

      if (reconSearchTerm) {
        const lowerSearch = reconSearchTerm.toLowerCase();
        schemeSoes = schemeSoes.filter(soe => {
          const schemeName = currentSchemes.find(s => s.id === soe.schemeId)?.name || '';
          return soe.name.toLowerCase().includes(lowerSearch) || schemeName.toLowerCase().includes(lowerSearch);
        });
      }

      return (
        <div className="animate-in fade-in duration-500">
          <div className="bg-emerald-900 text-white p-4 rounded-t-xl flex justify-between items-center">
            <h3 className="font-bold flex items-center gap-2">
              <Table className="w-5 h-5" />
              {title}
            </h3>
            <span className="text-xs bg-emerald-800 px-3 py-1 rounded-full border border-emerald-700">TRY Budget vs Allocated</span>
          </div>
          <div className="bg-white border border-gray-200 rounded-b-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[800px]">
                <thead>
                <tr className="bg-gray-50 text-gray-600 border-b">
                  <th className="p-4 text-left font-bold">SOE Head</th>
                  {reconSchemeId === 'all' && <th className="p-4 text-left font-bold">Scheme</th>}
                  <th className="p-4 text-right font-bold">TRY Budget (A)</th>
                  <th className="p-4 text-right font-bold">Total Reconciled (B)</th>
                  <th className="p-4 text-right font-bold">Balance (A - B)</th>
                  <th className="p-4 text-center font-bold">Utilization</th>
                </tr>
              </thead>
              <tbody>
                {schemeSoes.map(soe => {
                  const budget = getReceivedInTry(soe);
                  const reconciled = schemeAllocations.reduce((sum, alloc) => {
                    const funded = alloc.fundedSOEs?.find(f => f.soeId === soe.id);
                    return sum + (funded?.amount || 0);
                  }, 0);
                  const balance = budget - reconciled;
                  const percent = budget > 0 ? (reconciled / budget) * 100 : 0;
                  const schemeName = currentSchemes.find(s => s.id === soe.schemeId)?.name;

                  return (
                    <tr key={soe.id} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="p-4 font-medium text-gray-900">{soe.name}</td>
                      {reconSchemeId === 'all' && <td className="p-4 text-gray-600 text-xs">{schemeName}</td>}
                      <td className="p-4 text-right font-mono">₹{budget.toLocaleString()}</td>
                      <td className="p-4 text-right font-mono text-blue-600">₹{reconciled.toLocaleString()}</td>
                      <td className={`p-4 text-right font-mono font-bold ${balance < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        ₹{balance.toLocaleString()}
                      </td>
                      <td className="p-4">
                        <div className="w-full bg-gray-100 rounded-full h-2 max-w-[120px] mx-auto overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${percent > 100 ? 'bg-red-500' : 'bg-emerald-500'}`} 
                            style={{ width: `${Math.min(percent, 100)}%` }}
                          />
                        </div>
                        <div className="text-[10px] text-center mt-1 font-bold text-gray-500">{percent.toFixed(1)}%</div>
                      </td>
                    </tr>
                  );
                })}
                {schemeSoes.length === 0 && (
                  <tr>
                    <td colSpan={reconSchemeId === 'all' ? 6 : 5} className="p-10 text-center text-gray-400 italic">No SOE Heads found for this scheme.</td>
                  </tr>
                )}
              </tbody>
              {schemeSoes.length > 0 && (
                <tfoot>
                  <tr className="bg-gray-50 font-bold border-t-2 border-gray-200">
                    <td className="p-4" colSpan={reconSchemeId === 'all' ? 2 : 1}>GRAND TOTAL</td>
                    <td className="p-4 text-right">₹{schemeSoes.reduce((sum, s) => sum + getReceivedInTry(s), 0).toLocaleString()}</td>
                    <td className="p-4 text-right text-blue-600">
                      ₹{schemeAllocations.reduce((sum, alloc) => {
                        return sum + (alloc.fundedSOEs?.reduce((s, f) => s + f.amount, 0) || 0);
                      }, 0).toLocaleString()}
                    </td>
                    <td className="p-4 text-right text-emerald-600">
                      ₹{(schemeSoes.reduce((sum, s) => sum + getReceivedInTry(s), 0) - schemeAllocations.reduce((sum, alloc) => sum + (alloc.fundedSOEs?.reduce((s, f) => s + f.amount, 0) || 0), 0)).toLocaleString()}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
      );
    };

    return (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <RefreshCcw className="w-5 h-5 text-emerald-600" />
              Budget Reconciliation (Provisional to SOE)
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
                <button 
                  onClick={() => setShowReconSummary(false)}
                  className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${!showReconSummary ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Hierarchical Grid
                </button>
                <button 
                  onClick={() => setShowReconSummary(true)}
                  className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${showReconSummary ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Summary View
                </button>
              </div>
              <div className="relative w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input 
                  type="text"
                  placeholder="Search anything..."
                  value={reconSearchTerm}
                  onChange={(e) => setReconSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border rounded-lg shadow-sm focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                />
              </div>
              <div className="w-64">
                <select 
                  value={reconSchemeId} 
                  onChange={(e) => { setReconSchemeId(e.target.value); setReconData({}); }}
                  className="w-full p-2 border rounded-lg shadow-sm focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                >
                  <option value="">-- Select Scheme --</option>
                  <option value="all">All Schemes</option>
                  {provisionalSchemes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
          </div>
          
          {!reconSchemeId ? (
            <div className="text-center py-20 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
              <RefreshCcw className="w-12 h-12 text-gray-300 mx-auto mb-4 animate-spin-slow" />
              <p className="text-gray-500 font-medium">Please select a scheme to start the reconciliation process</p>
            </div>
          ) : showReconSummary ? renderReconSummary() : allocationsToReconcile.length === 0 ? (
            <div className="text-center py-20 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
              <Check className="w-12 h-12 text-emerald-300 mx-auto mb-4" />
              <p className="text-gray-500 font-medium">No pending provisional allocations found for this scheme. Everything is reconciled!</p>
            </div>
          ) : (
            <div className="overflow-x-auto border rounded-xl shadow-sm">
              <table className="w-full border-collapse text-xs min-w-[1200px]">
                <thead>
                  <tr className="bg-emerald-800 text-white">
                    <th className="p-3 border border-emerald-700 text-left sticky left-0 bg-emerald-800 z-10" rowSpan={2}>Hierarchy (Sector/Activity/Sub-Activity)</th>
                    <th className="p-3 border border-emerald-700 text-center" rowSpan={2}>Approved Budget</th>
                    <th className="p-3 border border-emerald-700 text-left" rowSpan={2}>Range Name</th>
                    <th className="p-3 border border-emerald-700 text-right" rowSpan={2}>Amount Allocated</th>
                    <th className="p-3 border border-emerald-700 text-right" rowSpan={2}>Budget to be Allocated</th>
                    <th className="p-3 border border-emerald-700 text-center" colSpan={4}>SOE Distribution (Editable)</th>
                    <th className="p-3 border border-emerald-700 text-right" rowSpan={2}>Try SOE Total</th>
                    <th className="p-3 border border-emerald-700 text-right" rowSpan={2}>Variation</th>
                  </tr>
                  <tr className="bg-emerald-700 text-white">
                    {displaySoeNames.map(name => (
                      <th key={name} className="p-2 border border-emerald-600 text-center">{name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {hierarchy.map((schemeLevel, idx) => (
                    <React.Fragment key={schemeLevel.name}>
                      {/* Scheme Row */}
                      {reconSchemeId === 'all' && (
                        <tr className="bg-gray-300 font-bold text-sm">
                          <td className="p-2 border border-gray-400 sticky left-0 bg-gray-300 z-10" colSpan={11}>SCHEME: {schemeLevel.name}</td>
                        </tr>
                      )}
                      
                      {schemeLevel.sectors.map((sector: any, sIdx: number) => (
                        <React.Fragment key={sector.name}>
                          {/* Sector Row */}
                          <tr className="bg-gray-200 font-bold">
                            <td className="p-2 border border-gray-300 sticky left-0 bg-gray-200 z-10" colSpan={11}>SECTOR: {sector.name}</td>
                          </tr>
                          {sector.activities.map((activity: any, aIdx: number) => (
                            <React.Fragment key={activity.name}>
                              {/* Activity Row */}
                              <tr className="bg-gray-100 font-semibold italic">
                                <td className="p-2 border border-gray-300 pl-6 sticky left-0 bg-gray-100 z-10" colSpan={11}>Activity: {activity.name}</td>
                              </tr>
                              {activity.subActivities.map((subActivity: any, saIdx: number) => {
                                const subActivityAllocations = subActivity.allocations;
                                const approvedBudget = currentSoes.filter(s => s.subActivityId === subActivityAllocations[0].subActivityId).reduce((sum, s) => sum + getReceivedInTry(s), 0);
                                
                                return (
                                  <React.Fragment key={subActivity.name}>
                                    {subActivityAllocations.map((alloc: any, alIdx: number) => {
                                      const distribution = reconData[alloc.id] || {};
                                      const tryTotal = getRowTotals(alloc.id);
                                      const variation = alloc.amount - tryTotal;
                                      const range = ranges.find(r => r.id === alloc.rangeId);
                                      
                                      return (
                                        <tr key={alloc.id} className="hover:bg-emerald-50 transition-colors">
                                          {alIdx === 0 && (
                                            <td className="p-2 border border-gray-300 pl-10 sticky left-0 bg-white z-10 font-medium" rowSpan={subActivityAllocations.length}>
                                              {subActivity.name}
                                            </td>
                                          )}
                                          {alIdx === 0 && (
                                            <td className="p-2 border border-gray-300 text-right font-bold text-emerald-700" rowSpan={subActivityAllocations.length}>
                                              ₹{approvedBudget.toLocaleString()}
                                            </td>
                                          )}
                                          <td className="p-2 border border-gray-300 italic text-gray-600">{range?.name}</td>
                                          <td className="p-2 border border-gray-300 text-right font-bold text-blue-600">₹{alloc.amount.toLocaleString()}</td>
                                          <td className="p-2 border border-gray-300 text-right text-gray-400">₹{(approvedBudget - alloc.amount).toLocaleString()}</td>
                                          
                                          {displaySoeNames.map(soeName => {
                                            const soeId = subActivity.soeMap[soeName];
                                            return (
                                              <td key={soeName} className="p-1 border border-gray-300">
                                                {soeId ? (
                                                  <input 
                                                    type="number"
                                                    value={distribution[soeId] || ''}
                                                    onChange={(e) => {
                                                      const val = e.target.value;
                                                      setReconData((prev: any) => ({
                                                        ...prev,
                                                        [alloc.id]: {
                                                          ...(prev[alloc.id] || {}),
                                                          [soeId]: val
                                                        }
                                                      }));
                                                    }}
                                                    placeholder="0"
                                                    className="w-full p-1 border-none focus:ring-1 focus:ring-emerald-500 text-right bg-transparent"
                                                  />
                                                ) : (
                                                  <div className="text-center text-gray-300">-</div>
                                                )}
                                              </td>
                                            );
                                          })}
                                          
                                          <td className="p-2 border border-gray-300 text-right font-bold text-emerald-600">₹{tryTotal.toLocaleString()}</td>
                                          <td className={`p-2 border border-gray-300 text-right font-bold ${Math.abs(variation) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
                                            ₹{variation.toLocaleString()}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                    {/* Sub-Activity Total Row */}
                                    <tr className="bg-gray-50 font-bold text-[10px]">
                                      <td className="p-2 border border-gray-300 text-right" colSpan={3}>Total for {subActivity.name}</td>
                                      <td className="p-2 border border-gray-300 text-right">₹{subActivityAllocations.reduce((sum: number, a: any) => sum + a.amount, 0).toLocaleString()}</td>
                                      <td className="p-2 border border-gray-300" colSpan={5}></td>
                                      <td className="p-2 border border-gray-300 text-right">₹{subActivityAllocations.reduce((sum: number, a: any) => sum + getRowTotals(a.id), 0).toLocaleString()}</td>
                                      <td className="p-2 border border-gray-300"></td>
                                    </tr>
                                  </React.Fragment>
                                );
                              })}
                              {/* Activity Total Row */}
                              <tr className="bg-blue-50 font-bold text-[11px]">
                                <td className="p-2 border border-gray-300 text-right" colSpan={3}>Total Activity: {activity.name}</td>
                                <td className="p-2 border border-gray-300 text-right">₹{activity.subActivities.reduce((sum: number, sa: any) => sum + sa.allocations.reduce((s: number, a: any) => s + a.amount, 0), 0).toLocaleString()}</td>
                                <td className="p-2 border border-gray-300" colSpan={7}></td>
                              </tr>
                            </React.Fragment>
                          ))}
                          {/* Sector Total Row */}
                          <tr className="bg-emerald-50 font-bold text-xs">
                            <td className="p-2 border border-gray-300 text-right" colSpan={3}>Total Sector: {sector.name}</td>
                            <td className="p-2 border border-gray-300 text-right">₹{sector.activities.reduce((sum: number, act: any) => sum + act.subActivities.reduce((s: number, sa: any) => s + sa.allocations.reduce((ss: number, a: any) => ss + a.amount, 0), 0), 0).toLocaleString()}</td>
                            <td className="p-2 border border-gray-300" colSpan={7}></td>
                          </tr>
                        </React.Fragment>
                      ))}
                      {/* Scheme Total Row (only if 'all' is selected) */}
                      {reconSchemeId === 'all' && (
                        <tr className="bg-emerald-100 font-bold text-sm">
                          <td className="p-2 border border-gray-300 text-right" colSpan={3}>Total Scheme: {schemeLevel.name}</td>
                          <td className="p-2 border border-gray-300 text-right">₹{schemeLevel.sectors.reduce((sum: number, sec: any) => sum + sec.activities.reduce((s: number, act: any) => s + act.subActivities.reduce((ss: number, sa: any) => ss + sa.allocations.reduce((sss: number, a: any) => sss + a.amount, 0), 0), 0), 0).toLocaleString()}</td>
                          <td className="p-2 border border-gray-300" colSpan={7}></td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  {/* Grand Total Row */}
                  <tr className="bg-emerald-900 text-white font-bold text-sm">
                    <td className="p-3 border border-emerald-800 text-right" colSpan={3}>GRAND TOTAL (SCHEME)</td>
                    <td className="p-3 border border-emerald-800 text-right">₹{allocationsToReconcile.reduce((sum, a) => sum + a.amount, 0).toLocaleString()}</td>
                    <td className="p-3 border border-emerald-800" colSpan={5}></td>
                    <td className="p-3 border border-emerald-800 text-right">₹{allocationsToReconcile.reduce((sum, a) => sum + getRowTotals(a.id), 0).toLocaleString()}</td>
                    <td className="p-3 border border-emerald-800 text-right">
                      ₹{allocationsToReconcile.reduce((sum, a) => sum + (a.amount - getRowTotals(a.id)), 0).toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {reconSchemeId && allocationsToReconcile.length > 0 && (
            <div className="mt-8 flex justify-end items-center gap-6 p-6 bg-gray-50 rounded-xl border border-gray-200">
              <div className="text-right">
                <p className="text-xs text-gray-500 uppercase font-bold">Reconciliation Status</p>
                <p className={`text-sm font-bold ${isSchemeReady ? 'text-green-600' : 'text-orange-600'}`}>
                  {isSchemeReady ? '✓ All variations are zero. Ready to save.' : '⚠ Please fix variations to zero to enable saving.'}
                </p>
              </div>
              <button
                disabled={!isSchemeReady || loading}
                onClick={handleSaveAllReconciliation}
                className={`px-8 py-3 rounded-lg font-bold shadow-lg transition-all flex items-center gap-2 ${isSchemeReady ? 'bg-emerald-600 text-white hover:bg-emerald-700 hover:scale-105 active:scale-95' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
              >
                {loading ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                Save All Reconciliation Data
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderSOEHeads = () => {
    const filteredItems = currentSoes.filter(s => {
      // Search filter
      const search = searchTerm.toLowerCase();
      const nameMatch = (s.name || '').toLowerCase().includes(search);
      const schemeMatch = s.schemeId && schemes.find(sch => sch.id === s.schemeId)?.name.toLowerCase().includes(search);
      const sectorMatch = s.sectorId && sectors.find(sec => sec.id === s.sectorId)?.name.toLowerCase().includes(search);
      const activityMatch = s.activityId && activities.find(act => act.id === s.activityId)?.name.toLowerCase().includes(search);
      const subActivityMatch = s.subActivityId && subActivities.find(sub => sub.id === s.subActivityId)?.name.toLowerCase().includes(search);
      const matchesSearch = !searchTerm || nameMatch || schemeMatch || sectorMatch || activityMatch || subActivityMatch;

      // Hierarchy filters
      const matchesScheme = !soeFilters.schemeId || s.schemeId === soeFilters.schemeId;
      const matchesSector = !soeFilters.sectorId || s.sectorId === soeFilters.sectorId;
      const matchesActivity = !soeFilters.activityId || s.activityId === soeFilters.activityId;
      const matchesSubActivity = !soeFilters.subActivityId || s.subActivityId === soeFilters.subActivityId;
      const matchesSoeName = !soeFilters.soeName || s.name === soeFilters.soeName;
      const matchesRange = !soeFilters.rangeId || allocations.some(a => a.rangeId === soeFilters.rangeId && a.fundedSOEs?.some(f => f.soeId === s.id));

      return matchesSearch && matchesScheme && matchesSector && matchesActivity && matchesSubActivity && matchesSoeName && matchesRange;
    });

    return (
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 sticky top-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Add SOE Head</h3>
              <div className="flex items-center gap-2">
                <button onClick={() => setIsFormExpanded(!isFormExpanded)} className="lg:hidden">
                  {isFormExpanded ? <ChevronUp /> : <ChevronDown />}
                </button>
              </div>
            </div>
            
            {isFormExpanded && (
              <form onSubmit={handleAddSoeName} className="space-y-4">
                <CascadingDropdowns 
                  schemes={currentSchemes} sectors={currentSectors} activities={currentActivities} subActivities={currentSubActivities} soes={currentSoes} soeBudgets={[]} allocations={baseAllocations} ranges={ranges} expenses={currentExpenses}
                  editingItem={editingItem} type="SOE Name" userRangeId={userRangeId}
                >
                  <select 
                    name="name" 
                    defaultValue={editingItem?.type === 'SOE Name' ? editingItem.item.name : ''} 
                    className="w-full p-2 border rounded" 
                  >
                    <option value="">Select SOE Head (Optional - defaults to Provisional)</option>
                    {ALLOWED_SOES.filter(n => n !== 'Provisional').map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <input 
                      name="approvedBudget" 
                      type="number" 
                      defaultValue={editingItem?.type === 'SOE Name' ? (getApprovedBudget(editingItem.item) || '') : ''} 
                      placeholder="Approved Budget (₹) (Optional)" 
                      className="w-full p-2 border rounded text-sm" 
                    />
                    <input 
                      name="receivedInTry" 
                      type="number" 
                      defaultValue={editingItem?.type === 'SOE Name' ? (getReceivedInTry(editingItem.item) || '') : ''} 
                      placeholder="Received in TRY (₹) (Optional)" 
                      className="w-full p-2 border rounded text-sm" 
                    />
                  </div>
                </CascadingDropdowns>
                <button type="submit" className="w-full bg-emerald-600 text-white py-2 rounded-lg hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4" />
                  <span>{editingItem?.type === 'SOE Name' ? 'Update SOE Head' : 'Add SOE Head'}</span>
                </button>
                {editingItem && (
                  <button type="button" onClick={() => setEditingItem(null)} className="w-full bg-gray-100 text-gray-600 py-2 rounded-lg hover:bg-gray-200 transition-colors">
                    Cancel Edit
                  </button>
                )}
              </form>
            )}
          </div>
        </div>

        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Search SOE Heads..." 
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <button 
                onClick={() => setIsSoeFilterExpanded(!isSoeFilterExpanded)}
                className={`flex items-center gap-1 px-3 py-2 border rounded-lg text-sm transition-colors ${isSoeFilterExpanded ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-white hover:bg-gray-50'}`}
              >
                <Filter className="w-4 h-4" />
                <span>Filters</span>
                {isSoeFilterExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            {isSoeFilterExpanded && (
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 animate-in fade-in slide-in-from-top-2">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Scheme</label>
                  <select 
                    value={soeFilters.schemeId}
                    onChange={(e) => setSoeFilters({ ...soeFilters, schemeId: e.target.value, sectorId: '', activityId: '', subActivityId: '' })}
                    className="w-full p-1.5 border border-gray-300 rounded text-xs bg-white"
                  >
                    <option value="">All Schemes</option>
                    {schemes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Sector</label>
                  <select 
                    value={soeFilters.sectorId}
                    onChange={(e) => setSoeFilters({ ...soeFilters, sectorId: e.target.value, activityId: '', subActivityId: '' })}
                    className="w-full p-1.5 border border-gray-300 rounded text-xs bg-white"
                  >
                    <option value="">All Sectors</option>
                    {sectors.filter(s => !soeFilters.schemeId || s.schemeId === soeFilters.schemeId).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Activity</label>
                  <select 
                    value={soeFilters.activityId}
                    onChange={(e) => setSoeFilters({ ...soeFilters, activityId: e.target.value, subActivityId: '' })}
                    className="w-full p-1.5 border border-gray-300 rounded text-xs bg-white"
                  >
                    <option value="">All Activities</option>
                    {activities.filter(a => {
                      if (soeFilters.sectorId) return a.sectorId === soeFilters.sectorId;
                      if (soeFilters.schemeId) return a.schemeId === soeFilters.schemeId || sectors.find(s => s.id === a.sectorId)?.schemeId === soeFilters.schemeId;
                      return true;
                    }).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Sub-Activity</label>
                  <select 
                    value={soeFilters.subActivityId}
                    onChange={(e) => setSoeFilters({ ...soeFilters, subActivityId: e.target.value })}
                    className="w-full p-1.5 border border-gray-300 rounded text-xs bg-white"
                  >
                    <option value="">All Sub-Activities</option>
                    {subActivities.filter(sa => {
                      if (soeFilters.activityId) return sa.activityId === soeFilters.activityId;
                      if (soeFilters.sectorId) {
                        const act = activities.find(a => a.id === sa.activityId);
                        return act?.sectorId === soeFilters.sectorId;
                      }
                      if (soeFilters.schemeId) {
                        const act = activities.find(a => a.id === sa.activityId);
                        return act?.schemeId === soeFilters.schemeId || sectors.find(s => s.id === act?.sectorId)?.schemeId === soeFilters.schemeId;
                      }
                      return true;
                    }).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Range</label>
                  <select 
                    value={soeFilters.rangeId}
                    onChange={(e) => setSoeFilters({ ...soeFilters, rangeId: e.target.value })}
                    className="w-full p-1.5 border border-gray-300 rounded text-xs bg-white"
                  >
                    <option value="">All Ranges</option>
                    {ranges.map(s => <option key={s.id} value={s.id}>{s.name === 'Rajgarh Forest Division' ? 'Division' : s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">SOE Name</label>
                  <select 
                    value={soeFilters.soeName}
                    onChange={(e) => setSoeFilters({ ...soeFilters, soeName: e.target.value })}
                    className="w-full p-1.5 border border-gray-300 rounded text-xs bg-white"
                  >
                    <option value="">All SOEs</option>
                    {ALLOWED_SOES.filter(n => {
                      if (!soeFilters.schemeId && !soeFilters.sectorId && !soeFilters.activityId && !soeFilters.subActivityId) return true;
                      return currentSoes.some(s => {
                        const matchesScheme = !soeFilters.schemeId || s.schemeId === soeFilters.schemeId;
                        const matchesSector = !soeFilters.sectorId || s.sectorId === soeFilters.sectorId;
                        const matchesActivity = !soeFilters.activityId || s.activityId === soeFilters.activityId;
                        const matchesSubActivity = !soeFilters.subActivityId || s.subActivityId === soeFilters.subActivityId;
                        return s.name === n && matchesScheme && matchesSector && matchesActivity && matchesSubActivity;
                      });
                    }).map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div className="md:col-span-3 lg:col-span-6 flex justify-end">
                  <button 
                    onClick={() => {
                      setSoeFilters({ schemeId: '', sectorId: '', activityId: '', subActivityId: '', rangeId: '', soeName: '' });
                      setSearchTerm('');
                    }}
                    className="text-[10px] text-red-600 hover:text-red-800 font-bold uppercase flex items-center gap-1"
                  >
                    Reset Filters
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-600 font-medium border-b">
                <tr>
                  <th className="px-4 py-4">SrNo</th>
                  <th className="px-4 py-4">Hierarchy</th>
                  <th className="px-4 py-4">SOE Name</th>
                  <th className="px-4 py-4 text-right">Approved Budget</th>
                  <th className="px-4 py-4 text-right">Received in TRY</th>
                  <th className="px-4 py-4 text-right">Allocated</th>
                  <th className="px-4 py-4 text-right">To Be Allocated</th>
                  <th className="px-4 py-4 text-right">Actions</th>
                </tr>
              </thead>
            <tbody className="divide-y divide-gray-100">
                {filteredItems
                  .sort((a, b) => {
                    // For SOE Heads, we might want to prioritize those with received budget
                    const hasBudgetA = (a.receivedInTry || 0) > 0;
                    const hasBudgetB = (b.receivedInTry || 0) > 0;
                    if (hasBudgetA && !hasBudgetB) return -1;
                    if (!hasBudgetA && hasBudgetB) return 1;

                    return (b.updatedAt || 0) - (a.updatedAt || 0);
                  })
                  .slice((currentPage - 1) * itemsPerPage, itemsPerPage === -1 ? filteredItems.length : currentPage * itemsPerPage)
                  .map((s, index) => {
                  const allocated = allocations.reduce((sum, a) => {
                    const funded = a.fundedSOEs?.find(f => f.soeId === s.id);
                    return sum + (funded?.amount || 0);
                  }, 0);
                  const toBeAllocated = getReceivedInTry(s) - allocated;

                  return (
                    <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-4 text-gray-500 font-medium">{(currentPage - 1) * itemsPerPage + index + 1}</td>
                      <td className="px-4 py-4">{renderHierarchy(s)}</td>
                      <td className="px-4 py-4 font-medium">{s.name || '-'}</td>
                      <td className="px-4 py-4 text-right">₹{getApprovedBudget(s).toLocaleString()}</td>
                      <td className="px-4 py-4 text-right">
                        <TryUpdateInput 
                          soeId={s.id} 
                          initialValue={getReceivedInTry(s)} 
                          onUpdate={handleUpdateSoeTry} 
                        />
                      </td>
                      <td className="px-4 py-4 text-right font-medium text-emerald-600">₹{allocated.toLocaleString()}</td>
                      <td className="px-4 py-4 text-right font-medium text-orange-600">₹{toBeAllocated.toLocaleString()}</td>
                      <td className="px-4 py-4 text-right space-x-2">
                        <button onClick={() => {
                          setEditingItem({ type: 'SOE Name', item: s });
                          setIsFormExpanded(true);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }} className="text-blue-600 hover:text-blue-800"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete('soeHeads', s.id)} className="text-red-600 hover:text-red-800"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination 
            totalEntries={filteredItems.length} 
            currentPage={currentPage} 
            itemsPerPage={itemsPerPage} 
            onPageChange={setCurrentPage} 
          />
          {filteredItems.length > 25 && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-gray-500">Entries per page:</span>
              <select 
                value={itemsPerPage} 
                onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                className="p-1 border rounded text-xs bg-white"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={-1}>All</option>
              </select>
            </div>
          )}
        </div>
      </div>
    );
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchTerm, expFilters, allocFilters, billExpFilters, selectedFY, expDateRange, expenditureSubTab]);

  const renderSimpleManager = (
    title: string, 
    items: any[], 
    columns: {key: string, label: string, render?: (val: any, item: any) => React.ReactNode, searchableText?: (val: any, item: any) => string}[], 
    onAdd: (e: React.FormEvent) => void, 
    onDelete: (id: string) => void,
    formContent: React.ReactNode,
    onEdit?: (item: any) => void,
    canEditDelete?: (item: any) => boolean,
    extraContent?: React.ReactNode,
    customActions?: (item: any) => React.ReactNode,
    isSubmitDisabled: boolean = false,
    isFilterExpanded?: boolean,
    setIsFilterExpanded?: (val: boolean) => void,
    filterContent?: React.ReactNode,
    onResetFilters?: () => void,
    isFullScreen?: boolean,
    setIsFullScreen?: (val: boolean) => void
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
    <div className={`grid grid-cols-1 ${isFullScreen ? '' : 'lg:grid-cols-4'} gap-6 items-start relative`}>
      {(userRole === 'admin' || userRole === 'deo' || (title === 'Expenditure' && (userRole !== 'approver' && userRole !== 'DA')) || (editingItem?.type === title)) && !isTableFullScreen && (
        <div className={`bg-white p-4 rounded-2xl shadow-sm border border-gray-100 ${isFullScreen ? 'lg:col-span-4 z-50 fixed inset-0 m-4 overflow-y-auto' : 'lg:col-span-1 lg:sticky lg:top-6 max-h-[calc(100vh-120px)] overflow-y-auto'} custom-scrollbar transition-all duration-300`}>
          <div 
            className="flex justify-between items-center mb-2 border-b pb-1.5 cursor-pointer hover:bg-gray-50 -mx-3 px-3 pt-0.5" 
            onClick={() => setIsFormExpanded(!isFormExpanded)}
          >
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">
                {editingItem?.type === title ? `Edit ${title}` : `Add ${title}`}
              </h3>
              {editingItem?.type === title && (
                <button 
                  onClick={(e) => { e.stopPropagation(); setEditingItem(null); }}
                  className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded hover:bg-blue-100 font-bold uppercase"
                >
                  New
                </button>
              )}
              {setIsFullScreen && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setIsFullScreen(!isFullScreen); }}
                  className="p-1 hover:bg-gray-100 rounded text-gray-500"
                  title={isFullScreen ? "Exit Full Screen" : "Full Screen"}
                >
                  {isFullScreen ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
            <button type="button" className="text-gray-500 hover:text-gray-700">
              {isFormExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
          <div className={`${isFormExpanded ? 'block' : 'hidden'} pb-2`}>
            <form key={editingItem?.item?.id || 'new'} onSubmit={onAdd} className="space-y-2">
              {formContent}
              <div className="flex gap-2 pt-2 border-t mt-2 sticky bottom-0 bg-white pb-1">
                <button 
                  type="submit" 
                  disabled={isSubmitDisabled}
                  className={`flex-1 py-1.5 rounded text-sm font-medium flex items-center justify-center gap-2 transition-colors ${isSubmitDisabled ? 'bg-gray-300 cursor-not-allowed text-gray-500' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}
                >
                  {editingItem?.type === title ? <Activity className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  {editingItem?.type === title ? 'Update' : 'Add'}
                </button>
                {editingItem?.type === title && (
                  <button 
                    type="button" 
                    onClick={() => setEditingItem(null)}
                    className="px-3 py-1.5 border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                )}
                {isFullScreen && setIsFullScreen && (
                   <button 
                    type="button" 
                    onClick={() => setIsFullScreen(false)}
                    className="px-3 py-1.5 border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-50"
                  >
                    Close
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
      <div className={`space-y-6 ${isTableFullScreen ? 'fixed inset-0 z-[60] bg-white p-6 overflow-y-auto' : (isFullScreen ? 'hidden' : ((userRole === 'admin' || userRole === 'deo' || (title === 'Expenditure' && userRole !== 'approver')) ? 'lg:col-span-3' : 'lg:col-span-4'))}`}>
        {extraContent}
        <div className={`bg-white ${isTableFullScreen ? '' : 'p-4 rounded-2xl shadow-sm border border-gray-100'}`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 border-b pb-3">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-bold text-gray-800">Existing {title}s</h3>
                <button
                  type="button"
                  onClick={() => setIsTableFullScreen(!isTableFullScreen)}
                  className="p-2 hover:bg-gray-100 rounded-xl text-gray-500 transition-colors border border-gray-100"
                  title={isTableFullScreen ? "Exit Full Screen" : "Expand to Full Screen"}
                >
                  {isTableFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
              </div>
            <div className="flex items-center gap-3">
              <div className="relative group">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors" />
                <input 
                  type="text" 
                  placeholder={`Search ${title}s...`} 
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                  className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 w-full sm:w-64 transition-all"
                />
              </div>
              {filterContent && setIsFilterExpanded && (
                <button 
                  onClick={() => setIsFilterExpanded(!isFilterExpanded)}
                  className={`flex items-center gap-1 px-2 py-1.5 border rounded-lg text-xs transition-colors ${isFilterExpanded ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-white hover:bg-gray-50'}`}
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Filters</span>
                  {isFilterExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
          </div>

          {isFilterExpanded && filterContent && (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200 mb-3 animate-in fade-in slide-in-from-top-2">
              {filterContent}
              {onResetFilters && (
                <div className="md:col-span-3 lg:col-span-5 flex justify-end">
                  <button 
                    onClick={onResetFilters}
                    className="text-[9px] text-red-600 hover:text-red-800 font-bold uppercase flex items-center gap-1"
                  >
                    Reset Filters
                  </button>
                </div>
              )}
            </div>
          )}
          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50/50 text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3 border-b border-gray-100 whitespace-nowrap w-12 text-center">#</th>
                  {columns.map(c => <th key={c.key} className="p-3 border-b border-gray-100 whitespace-nowrap">{c.label}</th>)}
                  {(customActions || userRole === 'admin' || userRole === 'deo' || (canEditDelete ? items.some(canEditDelete) : title === 'Expenditure')) && <th className="p-3 border-b border-gray-100 text-right whitespace-nowrap">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredItems
                  .sort((a, b) => {
                    const statusA = a.status === 'Funded' || a.status === 'approved';
                    const statusB = b.status === 'Funded' || b.status === 'approved';
                    if (statusA !== statusB) return statusA ? -1 : 1;
                    return (b.updatedAt || 0) - (a.updatedAt || 0);
                  })
                  .slice((currentPage - 1) * itemsPerPage, itemsPerPage === -1 ? filteredItems.length : currentPage * itemsPerPage)
                  .map((item, index) => (
                  <tr key={item.id} className="hover:bg-emerald-50/30 transition-colors group">
                    <td className="p-3 text-gray-400 font-medium text-center text-[11px]">{(currentPage - 1) * itemsPerPage + index + 1}</td>
                    {columns.map(c => <td key={c.key} className="p-3 text-gray-600 text-[11px] leading-relaxed">{c.render ? c.render(item[c.key], item) : item[c.key]}</td>)}
                    {(customActions || (canEditDelete ? canEditDelete(item) : (userRole === 'admin' || userRole === 'deo' || title === 'Expenditure'))) && (
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-1 transition-opacity">
                          {customActions && customActions(item)}
                          {(canEditDelete ? canEditDelete(item) : (userRole === 'admin' || userRole === 'deo' || (title === 'Expenditure' && userRole !== 'approver'))) && (
                            <>
                              <button 
                                onClick={() => {
                                  if (title === 'Allocation' && isFeatureLocked('Allocation')) {
                                    showAlert("This feature is currently locked by Admin. Please contact Admin for permission.");
                                    return;
                                  }
                                  if (title === 'Expenditure' && isFeatureLocked('Expenditure')) {
                                    showAlert("This feature is currently locked by Admin. Please contact Admin for permission.");
                                    return;
                                  }
                                  onEdit?.(item);
                                  setIsFormExpanded(true);
                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                                }} 
                                className={`rounded-lg p-1.5 transition-colors ${((title === 'Allocation' && isFeatureLocked('Allocation')) || (title === 'Expenditure' && isFeatureLocked('Expenditure'))) ? 'text-gray-300 cursor-not-allowed' : 'text-blue-500 hover:bg-blue-100'}`}
                                title={((title === 'Allocation' && isFeatureLocked('Allocation')) || (title === 'Expenditure' && isFeatureLocked('Expenditure'))) ? "Locked by Admin" : "Edit"}
                              >
                                <Pencil className="w-3.5 h-3.5"/>
                              </button>
                              <button 
                                onClick={() => {
                                  if (title === 'Allocation' && isFeatureLocked('Allocation')) {
                                    showAlert("This feature is currently locked by Admin. Please contact Admin for permission.");
                                    return;
                                  }
                                  if (title === 'Expenditure' && isFeatureLocked('Expenditure')) {
                                    showAlert("This feature is currently locked by Admin. Please contact Admin for permission.");
                                    return;
                                  }
                                  onDelete(item.id);
                                }} 
                                className={`rounded-lg p-1.5 transition-colors ${((title === 'Allocation' && isFeatureLocked('Allocation')) || (title === 'Expenditure' && isFeatureLocked('Expenditure'))) ? 'text-gray-300 cursor-not-allowed' : 'text-red-500 hover:bg-red-100'}`}
                                title={((title === 'Allocation' && isFeatureLocked('Allocation')) || (title === 'Expenditure' && isFeatureLocked('Expenditure'))) ? "Locked by Admin" : "Delete"}
                              >
                                <Trash2 className="w-3.5 h-3.5"/>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {filteredItems.length === 0 && <tr><td colSpan={columns.length + 2} className="p-8 text-center text-gray-400 text-sm italic">No records found matching your criteria.</td></tr>}
              </tbody>
            </table>
          </div>
        <Pagination 
          totalEntries={filteredItems.length} 
          currentPage={currentPage} 
          itemsPerPage={itemsPerPage} 
          onPageChange={setCurrentPage} 
        />
        {filteredItems.length > 25 && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-gray-500">Entries per page:</span>
            <select 
              value={itemsPerPage} 
              onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
              className="p-1 border rounded text-xs bg-white"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={-1}>All</option>
            </select>
          </div>
        )}
      </div>
    </div>
    </div>
    );
  };

  useEffect(() => {
    if (editingItem?.type === 'Allocation') {
      setAllocationAmount(editingItem.item.amount.toString());
    } else if (!editingItem) {
      setAllocationAmount('');
    }
  }, [editingItem]);

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

  const isFeatureLocked = (feature: 'Allocation' | 'Expenditure') => {
    if (userRole === 'admin') return false;
    const roleLock = featureLocks.find(l => l.feature === feature && l.target === userRole);
    if (roleLock?.isLocked) return true;
    if (userRangeId) {
      const rangeLock = featureLocks.find(l => l.feature === feature && l.target === userRangeId);
      if (rangeLock?.isLocked) return true;
    }
    return false;
  };

  // --- Handlers ---
  const handleAddFy = async (e: any) => {
    e.preventDefault();
    const name = e.target.name.value;
    try {
      if (editingItem?.type === 'Financial Year') {
        await updateDoc(doc(db, 'financialYears', editingItem.item.id), { name, updatedAt: Date.now() });
        setEditingItem(null);
      } else {
        await addDoc(collection(db, 'financialYears'), { name, createdAt: Date.now(), updatedAt: Date.now() });
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
        await updateDoc(doc(db, 'ranges', editingItem.item.id), { name, updatedAt: Date.now() });
        setEditingItem(null);
      } else {
        await addDoc(collection(db, 'ranges'), { name, createdAt: Date.now(), updatedAt: Date.now() });
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
        await updateDoc(doc(db, 'schemes', editingItem.item.id), { name, updatedAt: Date.now() });
        setEditingItem(null);
      } else {
        await addDoc(collection(db, 'schemes'), { name, createdAt: Date.now(), updatedAt: Date.now() });
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
        await updateDoc(doc(db, 'sectors', editingItem.item.id), { name, schemeId, updatedAt: Date.now() });
        setEditingItem(null);
      } else {
        await addDoc(collection(db, 'sectors'), { name, schemeId, createdAt: Date.now(), updatedAt: Date.now() });
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
      showAlert("Please select either a Sector or a Scheme");
      return;
    }

    try {
      if (editingItem?.type === 'Activity') {
        await updateDoc(doc(db, 'activities', editingItem.item.id), { name, sectorId, schemeId, updatedAt: Date.now() });
        setEditingItem(null);
      } else {
        await addDoc(collection(db, 'activities'), { sectorId, schemeId, name, createdAt: Date.now(), updatedAt: Date.now() });
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
    
    if (!activityId) {
      showAlert("Activity is mandatory for Sub-Activity.");
      return;
    }

    try {
      if (editingItem?.type === 'Sub-Activity') {
        await updateDoc(doc(db, 'subActivities', editingItem.item.id), { name, activityId, updatedAt: Date.now() });
        setEditingItem(null);
      } else {
        await addDoc(collection(db, 'subActivities'), { activityId, name, createdAt: Date.now(), updatedAt: Date.now() });
      }
      e.target.reset();
    } catch (error) {
      handleFirestoreError(error, editingItem?.type === 'Sub-Activity' ? OperationType.UPDATE : OperationType.CREATE, 'subActivities');
    }
  };

  const handleAddSoeName = async (e: any) => {
    e.preventDefault();
    const rawName = e.target.name.value;
    const name = rawName || 'Provisional';
    const schemeId = e.target.schemeId?.value || null;
    const sectorId = e.target.sectorId?.value || null;
    const activityId = e.target.activityId?.value || null;
    const subActivityId = e.target.subActivityId?.value || null;
    const approvedBudget = parseFloat(e.target.approvedBudget?.value) || 0;
    const receivedInTry = parseFloat(e.target.receivedInTry?.value) || 0;

    if (!schemeId) {
      showAlert("Scheme is mandatory.");
      return;
    }

    try {
      const data = { 
        name, 
        isProvisional: !rawName,
        schemeId, 
        sectorId, 
        activityId, 
        subActivityId, 
        approvedBudget, 
        approvedBudgetAmount: approvedBudget,
        receivedInTry,
        receivedInTryAmount: receivedInTry,
        tryAmount: receivedInTry,
        financialYear: selectedFY,
        updatedAt: Date.now()
      };
      if (editingItem?.type === 'SOE Name') {
        await updateDoc(doc(db, 'soeHeads', editingItem.item.id), { ...data, updatedAt: Date.now() });
        setEditingItem(null);
      } else {
        await addDoc(collection(db, 'soeHeads'), { ...data, createdAt: Date.now(), updatedAt: Date.now() });
      }
      e.target.reset();
    } catch (error) {
      handleFirestoreError(error, editingItem?.type === 'SOE Name' ? OperationType.UPDATE : OperationType.CREATE, 'soeHeads');
    }
  };

  const handleUpdateSoeTry = async (soeId: string, amount: number) => {
    try {
      await updateDoc(doc(db, 'soeHeads', soeId), { 
        receivedInTry: amount,
        receivedInTryAmount: amount,
        tryAmount: amount,
        updatedAt: Date.now()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'soeHeads');
    }
  };



  const allocationBudgetStatus = useMemo(() => {
    if (activeTab !== 'Allocations' || !allocationFormFilters.schemeId) return { isInvalid: false, remaining: 0, availableBudget: 0, currentAllocated: 0 };
    const amount = parseFloat(allocationAmount);
    const isEditing = editingItem?.type === 'Allocation';

    const { schemeId, sectorId, activityId, subActivityId, fundingSoeName } = allocationFormFilters;

    // Check against expenditure if editing
    if (isEditing) {
      const spent = expenses
        .filter(e => e.allocationId === editingItem.item.id && e.status !== 'rejected')
        .reduce((sum, e) => sum + e.amount, 0);
      if (!isNaN(amount) && amount < spent) return { isInvalid: true, remaining: 0, availableBudget: 0, currentAllocated: 0, error: `Amount cannot be less than expenditure (₹${spent.toLocaleString()})` };
    }

    // Get all SOEs in this Sector (or Scheme if no sector)
    const sectorSoes = soes.filter((s: any) => 
      s.schemeId === schemeId && 
      (s.sectorId || null) === (sectorId || null)
    );

    let availableBudget = 0;
    let currentAllocated = 0;

    if (fundingSoeName) {
      const matchedSoes = sectorSoes.filter(s => s.name === fundingSoeName);
      availableBudget = matchedSoes.reduce((sum, s) => sum + getReceivedInTry(s), 0);
      currentAllocated = allocations.reduce((sum, a) => {
        const fundedFromThese = a.fundedSOEs?.filter((f: any) => matchedSoes.some(s => s.id === f.soeId)) || [];
        const currentAllocId = isEditing ? editingItem.item.id : null;
        if (a.id === currentAllocId) return sum;
        return sum + fundedFromThese.reduce((s: number, f: any) => s + f.amount, 0);
      }, 0);
    } else {
      availableBudget = sectorSoes.reduce((sum, s) => sum + getReceivedInTry(s), 0);
      currentAllocated = allocations.reduce((sum, a) => {
        if (a.schemeId !== schemeId || (a.sectorId || null) !== (sectorId || null)) return sum;
        const currentAllocId = isEditing ? editingItem.item.id : null;
        if (a.id === currentAllocId) return sum;
        return sum + a.amount;
      }, 0);
    }

    const remaining = availableBudget - currentAllocated;
    const isInvalid = !isNaN(amount) && amount > 0 && amount > remaining;

    return { isInvalid, remaining, availableBudget, currentAllocated };
  }, [activeTab, allocationAmount, allocationFormFilters, soes, allocations, expenses, editingItem]);

  const isAllocationInvalid = allocationBudgetStatus.isInvalid || !allocationFormFilters.rangeId;

  const handleAddAllocation = async (e: any) => {
    e.preventDefault();
    if (isFeatureLocked('Allocation')) {
      showAlert("This feature is currently locked by Admin. Please contact Admin for permission.");
      return;
    }
    const rangeId = e.target.rangeId.value;
    const amount = parseFloat(e.target.amount.value);
    const remarks = e.target.remarks.value || '';
    const schemeId = e.target.schemeId.value || null;
    const sectorId = e.target.sectorId.value || null;
    const activityId = e.target.activityId.value || null;
    const subActivityId = e.target.subActivityId.value || null;
    const targetFyId = selectedFY;
    
    const fundingSoeName = e.target.fundingSoeName?.value || null;
    
    if (isNaN(amount) || amount <= 0) {
      showAlert("Please enter a valid positive amount.");
      return;
    }

    // Validation: Check against expenditure if editing
    if (editingItem?.type === 'Allocation') {
      const spent = expenses
        .filter(e => e.allocationId === editingItem.item.id && e.status !== 'rejected')
        .reduce((sum, e) => sum + e.amount, 0);
      if (amount < spent) {
        showAlert(`Cannot reduce allocation below expenditure. Already spent: ₹${spent.toLocaleString()}`);
        return;
      }
    }
    
    // Validation: Check against Sector-wide Received Budget
    // Use full 'soes' and 'allocations' for global validation
    const sectorSoes = soes.filter(s => 
      s.schemeId === schemeId && 
      (s.sectorId || null) === sectorId
    );
    
    // If a specific SOE name is selected, validate against that SOE's balance in the sector
    if (fundingSoeName) {
      const matchedSoes = sectorSoes.filter(s => s.name === fundingSoeName);
      const received = matchedSoes.reduce((sum, s) => sum + getReceivedInTry(s), 0);
      const allocated = allocations.reduce((sum, a) => {
        const fundedFromThese = a.fundedSOEs?.filter((f: any) => matchedSoes.some(s => s.id === f.soeId)) || [];
        const currentAllocId = editingItem?.type === 'Allocation' ? editingItem.item.id : null;
        if (a.id === currentAllocId) return sum;
        return sum + fundedFromThese.reduce((s: number, f: any) => s + f.amount, 0);
      }, 0);
      const remaining = received - allocated;

      if (amount > remaining) {
        showAlert(`Cannot allocate. Amount ₹${amount.toLocaleString()} exceeds the remaining balance of SOE ${fundingSoeName} (₹${remaining.toLocaleString()}).`);
        return;
      }
    } else {
      // General sector-wide validation
      const totalReceivedInSector = sectorSoes.reduce((sum, s) => sum + getReceivedInTry(s), 0);
      const totalAllocatedInSector = allocations
        .filter(a => 
          a.schemeId === schemeId && 
          (a.sectorId || null) === sectorId &&
          (editingItem?.type === 'Allocation' ? a.id !== editingItem.item.id : true)
        )
        .reduce((sum, a) => sum + a.amount, 0);

      const remainingInSector = totalReceivedInSector - totalAllocatedInSector;

      if (amount > remainingInSector) {
        showAlert(`Cannot allocate. Amount ₹${amount.toLocaleString()} exceeds the remaining Sector-wide Available Budget of ₹${remainingInSector.toLocaleString()}.`);
        return;
      }
    }

    try {
      let fundedSOEs: any[] = [];
      let status = 'Pending SOE Funds';

      if (fundingSoeName) {
        const matchedSoes = sectorSoes.filter(s => s.name === fundingSoeName);
        let remainingToFund = amount;
        
        for (const soe of matchedSoes) {
          if (remainingToFund <= 0) break;
          const received = getReceivedInTry(soe);
          const allocated = allocations.reduce((sum, a) => {
            const fundedFromThis = a.fundedSOEs?.find((f: any) => f.soeId === soe.id);
            const currentAllocId = editingItem?.type === 'Allocation' ? editingItem.item.id : null;
            if (a.id === currentAllocId) return sum;
            return sum + (fundedFromThis?.amount || 0);
          }, 0);
          const available = received - allocated;
          
          if (available > 0) {
            const fundAmount = Math.min(available, remainingToFund);
            fundedSOEs.push({ soeId: soe.id, amount: fundAmount });
            remainingToFund -= fundAmount;
          }
        }
        
        if (remainingToFund <= 0) {
          status = 'Funded';
        }
      }

      if (editingItem?.type === 'Allocation') {
        await updateDoc(doc(db, 'allocations', editingItem.item.id), { 
          rangeId, amount, remarks, schemeId, sectorId, activityId, subActivityId, financialYear: targetFyId,
          status, fundedSOEs,
          updatedAt: Date.now()
        });
        setEditingItem(null);
      } else {
        // Always create a new entry for every allocation as requested
        await addDoc(collection(db, 'allocations'), { 
          rangeId, amount, remarks, schemeId, sectorId, activityId, subActivityId, financialYear: targetFyId,
          status,
          fundedSOEs,
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
      }
      e.target.reset();
      setAllocationAmount('');
    } catch (error) {
      handleFirestoreError(error, editingItem?.type === 'Allocation' ? OperationType.UPDATE : OperationType.CREATE, 'allocations');
    }
  };

  const handleFundAllocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fundingAllocation) return;

    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const soeId = formData.get('soeId') as string;
    const amount = parseFloat(formData.get('amount') as string);

    if (!soeId || isNaN(amount) || amount <= 0) {
      showAlert("Please select an SOE and enter a valid amount.");
      return;
    }

    // Check treasury availability for this SOE
    const soe = currentSoes.find(s => s.id === soeId);
    const totalReceived = soe ? getReceivedInTry(soe) : 0;

    const totalFundedFromThisSoe = baseAllocations
      .reduce((sum, a) => {
        const funded = a.fundedSOEs?.find(f => f.soeId === soeId);
        return sum + (funded?.amount || 0);
      }, 0);

    const availableInTry = totalReceived - totalFundedFromThisSoe;

    if (amount > availableInTry) {
      showAlert(`Insufficient funds in Treasury for this SOE. Available: ₹${availableInTry.toLocaleString()}`);
      return;
    }

    // Check if this funding exceeds the allocation's remaining amount
    const alreadyFundedTotal = fundingAllocation.fundedSOEs?.reduce((sum, f) => sum + f.amount, 0) || 0;
    const remainingToFund = fundingAllocation.amount - alreadyFundedTotal;

    if (amount > remainingToFund) {
      showAlert(`Funding amount ₹${amount.toLocaleString()} exceeds the remaining allocation requirement of ₹${remainingToFund.toLocaleString()}.`);
      return;
    }

    try {
      const updatedFundedSOEs = [...(fundingAllocation.fundedSOEs || [])];
      const existingIdx = updatedFundedSOEs.findIndex(f => f.soeId === soeId);
      if (existingIdx >= 0) {
        updatedFundedSOEs[existingIdx].amount += amount;
      } else {
        updatedFundedSOEs.push({ soeId, amount });
      }

      const totalFundedNow = updatedFundedSOEs.reduce((sum, f) => sum + f.amount, 0);
      const newStatus = totalFundedNow >= fundingAllocation.amount ? 'Funded' : 'Pending SOE Funds';

      await updateDoc(doc(db, 'allocations', fundingAllocation.id), {
        fundedSOEs: updatedFundedSOEs,
        status: newStatus,
        updatedAt: Date.now()
      });

      setFundingAllocation(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'allocations');
    }
  };

  const handleUpdateExpenseStatus = async (expenseId: string, status: 'approved' | 'rejected' | 'pending', isLocked: boolean, reason?: string) => {
    try {
      if (status === 'approved') {
        await runTransaction(db, async (transaction) => {
          const counterDocRef = doc(db, 'appSettings', 'counters');
          const counterDoc = await transaction.get(counterDocRef);
          
          let nextId = 100;
          if (counterDoc.exists()) {
            nextId = (counterDoc.data().lastApprovalId || 99) + 1;
          }
          
          transaction.set(counterDocRef, { lastApprovalId: nextId }, { merge: true });
          transaction.update(doc(db, 'expenditures', expenseId), { 
            status, 
            isLocked, 
            approvalId: nextId,
            approvalReason: reason || '',
            updatedAt: Date.now()
          });
        });
      } else {
        await updateDoc(doc(db, 'expenditures', expenseId), { 
          status, 
          isLocked,
          approvalReason: reason || '',
          updatedAt: Date.now(),
          ...(status === 'pending' ? { approvalId: null } : {})
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'expenditures');
      showAlert(`Error updating status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleResetUnbilledExpenses = async () => {
    const unbilledApproved = expenses.filter(e => 
      e.status === 'approved' && 
      !bills.some(b => b.expenseIds.includes(e.id))
    );

    if (unbilledApproved.length === 0) {
      showAlert("No unbilled approved expenditures found.");
      return;
    }

    showConfirm(`Are you sure you want to reset ${unbilledApproved.length} unbilled approved expenditures to pending?`, async () => {
      try {
        const batch = writeBatch(db);
        unbilledApproved.forEach(exp => {
          batch.update(doc(db, 'expenditures', exp.id), {
            status: 'pending',
            isLocked: false,
            approvalId: null,
            updatedAt: Date.now()
          });
        });
        await batch.commit();
        showAlert(`Successfully reset ${unbilledApproved.length} expenditures to pending.`);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, 'expenditures');
      }
    });
  };

  const handleAddExpense = async (e: any) => {
    e.preventDefault();
    if (isFeatureLocked('Expenditure')) {
      showAlert("This feature is currently locked by Admin. Please contact Admin for permission.");
      return;
    }
    const allocationId = e.target.allocationId.value;
    const soeId = e.target.soeId.value;
    const amount = parseFloat(e.target.amount?.value || '0');
    const date = e.target.date.value;
    const description = e.target.description.value;
    const targetFyId = selectedFY;

    const today = new Date().toISOString().split('T')[0];
    if (date > today) {
      showAlert("Cannot add expenditure for a future date.");
      return;
    }

    const alloc = allocations.find(a => a.id === allocationId);
    if (!alloc) return;

    const selectedSoe = soes.find(s => s.id === soeId);
    const selectedName = selectedSoe?.name || 'Unnamed SOE';

    // Find all funded SOEs with the same name in this allocation to handle split funding
    const matchedFunded = alloc.fundedSOEs.filter((f: any) => {
      const s = soes.find((soe: any) => soe.id === f.soeId);
      return (s?.name || 'Unnamed SOE') === selectedName;
    });

    const totalFunded = matchedFunded.reduce((sum: number, f: any) => sum + f.amount, 0);
    const matchedSoeIds = matchedFunded.map((f: any) => f.soeId);

    // If we have selected payees, we create multiple expenditures
    if (selectedPayeesForExpense.length > 0 && editingItem?.type !== 'Expenditure') {
      const totalAmount = selectedPayeesForExpense.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
      
      const currentSpentOnSoe = expenses
        .filter(ex => ex.allocationId === allocationId && matchedSoeIds.includes(ex.soeId) && ex.status !== 'rejected')
        .reduce((sum, ex) => sum + ex.amount, 0);

      if (totalAmount > (totalFunded - currentSpentOnSoe)) {
        showAlert(`Insufficient funds in SOE ${selectedName}. Remaining: ₹${(totalFunded - currentSpentOnSoe).toLocaleString()}`);
        return;
      }

      try {
        const batch = writeBatch(db);
        for (const p of selectedPayeesForExpense) {
          const docRef = doc(collection(db, 'expenditures'));
          batch.set(docRef, {
            allocationId, soeId, amount: parseFloat(p.amount) || 0, date, description, financialYear: targetFyId,
            rangeId: alloc.rangeId,
            createdBy: user.uid,
            status: 'pending',
            isLocked: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            payeeId: p.payeeId
          });
        }
        await batch.commit();
        setSelectedPayeesForExpense([]);
        setCurrentSoeBalance(undefined);
        e.target.reset();
        showAlert(`${selectedPayeesForExpense.length} expenditures added successfully.`);
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'expenditures');
      }
      return;
    }

    if (!amount || amount <= 0) {
      showAlert("Please provide a valid amount.");
      return;
    }

    const currentSpentOnSoe = expenses
      .filter(ex => ex.allocationId === allocationId && matchedSoeIds.includes(ex.soeId) && ex.status !== 'rejected' && (editingItem?.type === 'Expenditure' ? ex.id !== editingItem.item.id : true))
      .reduce((sum, ex) => sum + ex.amount, 0);

    if (amount > (totalFunded - currentSpentOnSoe)) {
      showAlert(`Insufficient funds in SOE ${selectedName}. Remaining: ₹${(totalFunded - currentSpentOnSoe).toLocaleString()}`);
      return;
    }

    try {
      if (editingItem?.type === 'Expenditure') {
        const payeeId = e.target.payeeId?.value;
        const payeeName = e.target.payeeName?.value;
        await updateDoc(doc(db, 'expenditures', editingItem.item.id), { 
          allocationId, soeId, amount, date, description, financialYear: targetFyId, rangeId: alloc.rangeId,
          payeeId: payeeId || null,
          payeeName: payeeName || null,
          updatedAt: Date.now()
        });
        setEditingItem(null);
        setCurrentSoeBalance(undefined);
        e.target.reset();
      } else {
        const payeeName = e.target.payeeName?.value;
        await addDoc(collection(db, 'expenditures'), { 
          allocationId, soeId, amount, date, description, financialYear: targetFyId,
          rangeId: alloc.rangeId,
          createdBy: user.uid,
          status: 'pending',
          isLocked: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          payeeName: payeeName || null
        });
        setCurrentSoeBalance(undefined);
        // Clear only the amount field to allow quick entry for same activity/SOE
        if (e.target.amount) e.target.amount.value = '';
      }
    } catch (error) {
      handleFirestoreError(error, editingItem?.type === 'Expenditure' ? OperationType.UPDATE : OperationType.CREATE, 'expenditures');
    }
  };

  const handleAddPayee = async (e: any) => {
    e.preventDefault();
    const name = e.target.name.value;
    const address = e.target.address.value;
    const accountNumber = e.target.accountNumber.value;
    const rangeId = e.target.rangeId.value;

    try {
      if (editingItem?.type === 'Payee') {
        await updateDoc(doc(db, 'payees', editingItem.item.id), {
          name, address, accountNumber, rangeId: rangeId || null,
          updatedAt: Date.now()
        });
        setEditingItem(null);
        e.target.reset();
      } else {
        await addDoc(collection(db, 'payees'), {
          name, address, accountNumber, rangeId: rangeId || null,
          createdBy: user.uid,
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
        e.target.reset();
      }
      showAlert(`Payee ${editingItem?.type === 'Payee' ? 'updated' : 'added'} successfully.`);
    } catch (error) {
      handleFirestoreError(error, editingItem?.type === 'Payee' ? OperationType.UPDATE : OperationType.CREATE, 'payees');
    }
  };

  const handleDelete = (collectionName: string, id: string) => {
    if (collectionName === 'allocations' && isFeatureLocked('Allocation')) {
      showAlert("This feature is currently locked by Admin. Please contact Admin for permission.");
      return;
    }
    if (collectionName === 'expenditures' && isFeatureLocked('Expenditure')) {
      showAlert("This feature is currently locked by Admin. Please contact Admin for permission.");
      return;
    }
    showConfirm(`Are you sure you want to delete this ${collectionName.slice(0, -1)}?`, async () => {
      try {
        await deleteDoc(doc(db, collectionName, id));
        showAlert("Deleted successfully.");
        if (editingItem?.item?.id === id) {
          setEditingItem(null);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, collectionName);
      }
    });
  };

  const handleCreateBill = async (e: any) => {
    e.preventDefault();
    const billNo = e.target.billNo.value;
    const billDate = e.target.billDate.value;
    const remarks = e.target.remarks.value;
    const isFinalizing = e.nativeEvent.submitter?.name === 'finalize';

    if (!billNo || !billDate || selectedExpensesForBill.length === 0) {
      showAlert('Please provide Bill No, Date and select at least one expenditure.');
      return;
    }

    const selectedExpObjects = expenses.filter(ex => selectedExpensesForBill.includes(ex.id));
    
    // Validate same SOE
    const soeIds = new Set(selectedExpObjects.map(ex => ex.soeId));
    if (soeIds.size > 1) {
      showAlert('A bill can only contain expenditures from a single SOE head.');
      return;
    }

    const totalAmount = selectedExpObjects.reduce((sum, ex) => sum + ex.amount, 0);
    const activeFy = fys.find(f => f.name === selectedFY || f.id === selectedFY);

    try {
      const billData = {
        billNo,
        billDate,
        expenseIds: selectedExpensesForBill,
        fyId: activeFy?.id || selectedFY,
        financialYear: activeFy?.name || selectedFY,
        totalAmount,
        status: isFinalizing ? 'finalized' : (editingItem?.type === 'Bill' ? editingItem.item.status : 'draft'),
        remarks: remarks || '',
        updatedAt: Date.now(),
        createdBy: editingItem?.type === 'Bill' ? editingItem.item.createdBy : user.uid
      };

      if (editingItem?.type === 'Bill') {
        await updateDoc(doc(db, 'bills', editingItem.item.id), billData);
        setEditingItem(null);
      } else {
        await addDoc(collection(db, 'bills'), { ...billData, createdAt: Date.now() });
      }
      setSelectedExpensesForBill([]);
      setBillExpFilters({ schemeId: '', sectorId: '', activityId: '', subActivityId: '', rangeId: '', soeId: '' });
      e.target.reset();
    } catch (error) {
      handleFirestoreError(error, editingItem?.type === 'Bill' ? OperationType.UPDATE : OperationType.CREATE, 'bills');
    }
  };

  const handleRemoveExpenseFromBill = async (billId: string, expenseId: string) => {
    const bill = bills.find(b => b.id === billId);
    if (!bill) return;

    const newExpenseIds = bill.expenseIds.filter(id => id !== expenseId);
    if (newExpenseIds.length === 0) {
      showAlert('A bill must have at least one expenditure. Delete the bill instead.');
      return;
    }

    const newTotalAmount = expenses
      .filter(e => newExpenseIds.includes(e.id))
      .reduce((sum, e) => sum + e.amount, 0);

    try {
      await updateDoc(doc(db, 'bills', billId), {
        expenseIds: newExpenseIds,
        totalAmount: newTotalAmount,
        updatedAt: Date.now()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'bills');
    }
  };

  const generateBillPdf = (bill: Bill) => {
    const doc = new jsPDF();
    const activeFy = fys.find(f => f.id === bill.fyId || f.name === bill.financialYear);
    
    // Header
    doc.setFontSize(16);
    doc.text('TREASURY BILL', 105, 15, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Financial Year: ${activeFy?.name || bill.financialYear}`, 105, 22, { align: 'center' });
    
    doc.setFontSize(11);
    doc.text(`Bill No: ${bill.billNo}`, 15, 35);
    doc.text(`Bill Date: ${bill.billDate ? bill.billDate.split('-').reverse().join('/') : 'N/A'}`, 15, 42);
    if (bill.remarks) {
      doc.text(`Remarks: ${bill.remarks}`, 15, 49);
    }

    const billExpenses = expenses.filter(e => bill.expenseIds.includes(e.id));
    
    const tableData = billExpenses.map((exp, index) => {
      const s = soes.find(s => s.id === exp.soeId);
      const al = allocations.find(a => a.id === exp.allocationId);
      const r = ranges.find(r => r.id === al?.rangeId);
      
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

      return [
        index + 1,
        exp.date ? exp.date.split('-').reverse().join('/') : 'N/A',
        r?.name || 'N/A',
        s?.name || 'N/A',
        hierarchy,
        exp.description,
        `Rs. ${exp.amount.toLocaleString()}`
      ];
    });

    autoTable(doc, {
      startY: 55,
      head: [['SrNo', 'Date', 'Range', 'SOE', 'Hierarchy', 'Description', 'Amount']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129] },
      styles: { fontSize: 8 },
      columnStyles: {
        6: { halign: 'right', fontStyle: 'bold' }
      }
    });

    const finalY = (doc as any).lastAutoTable.finalY || 70;
    doc.setFontSize(12);
    doc.text(`Total Amount: Rs. ${bill.totalAmount.toLocaleString()}`, 195, finalY + 10, { align: 'right' });

    return doc;
  };

  const handleDownloadBill = async (bill: Bill) => {
    const doc = generateBillPdf(bill);
    doc.save(`bill_${bill.billNo}.pdf`);
  };

  const handleViewBill = (bill: Bill) => {
    const doc = generateBillPdf(bill);
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    setViewingBillPdf({ url, bill });
  };

  const handleUserRoleChange = async (userId: string, newRole: 'admin' | 'deo' | 'approver' | 'Sarahan' | 'Narag' | 'Habban' | 'Division' | 'Rajgarh') => {
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole, updatedAt: Date.now() });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    }
  };

  const handleDeleteUser = (userId: string) => {
    showConfirm('Delete this user access?', async () => {
      try {
        await deleteDoc(doc(db, 'users', userId));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, 'users');
      }
    });
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
      try {
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          email: emailToUse,
          role: newUserRole,
          password: newUserPassword
        });
      } catch (firestoreError) {
        handleFirestoreError(firestoreError, OperationType.CREATE, 'users');
      }
      
      // Sign out the secondary app
      await secondaryAuth.signOut();
      
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserRole('deo');
      showAlert('User created successfully!');
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        showAlert(`Error: This User ID / Email already exists in the system. If you deleted them previously, they still exist in the authentication database. You cannot recreate them with the same ID.`);
      } else {
        showAlert(`Error creating user: ${error.message}`);
      }
    }
  };

  const handleUpdatePassword = async (userId: string) => {
    if (!newPasswordInput) return;
    try {
      await updateDoc(doc(db, 'users', userId), {
        password: newPasswordInput,
        updatedAt: Date.now()
      });
      setEditingPasswordId(null);
      setNewPasswordInput('');
      showAlert('Password updated in system records. Note: This does not change the actual login password in Firebase Auth. The user should use the forgot password link if they cannot log in.');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    }
  };

  const handleResetPassword = (email: string) => {
    showConfirm(`Send password reset email to ${email}?`, async () => {
      try {
        await sendPasswordResetEmail(auth, email);
        showAlert('Password reset email sent!');
      } catch (error: any) {
        showAlert(`Error sending reset email: ${error.message}`);
      }
    });
  };

  const handleUpdateMaxSessions = async (userId: string, maxSessions: number) => {
    try {
      await updateDoc(doc(db, 'users', userId), { maxSessions, updatedAt: Date.now() });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    }
  };

  const handleClearSessions = async (userId: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), { activeSessions: [], updatedAt: Date.now() });
      showAlert('All active sessions cleared for this user.');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    }
  };

  const handleToggleFeatureLock = async (feature: 'Allocation' | 'Expenditure' | 'Access', target: string) => {
    const existingLock = featureLocks.find(l => l.feature === feature && l.target === target);
    try {
      if (existingLock) {
        await updateDoc(doc(db, 'featureLocks', existingLock.id), {
          isLocked: !existingLock.isLocked,
          updatedBy: user?.email || 'Admin',
          updatedAt: Date.now()
        });
      } else {
        await addDoc(collection(db, 'featureLocks'), {
          feature,
          target,
          isLocked: true,
          updatedBy: user?.email || 'Admin',
          updatedAt: Date.now()
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'featureLocks');
    }
  };

  const handleToggleUserStatus = async (userId: string, isDisabled: boolean) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        isDisabled: !isDisabled,
        updatedAt: Date.now()
      });
      showAlert(`User ${!isDisabled ? 'disabled' : 'enabled'} successfully.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
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
            onChange={(e) => setNewUserRole(e.target.value as any)}
            className="p-2 border rounded"
          >
            <option value="admin">Admin</option>
            <option value="deo">DEO</option>
            <option value="approver">DA</option>
            <option value="Sarahan">Sarahan</option>
            <option value="Narag">Narag</option>
            <option value="Habban">Habban</option>
            <option value="Division">Division</option>
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
              <th className="p-3 border-b">Password</th>
              <th className="p-3 border-b">Role</th>
              <th className="p-3 border-b">Max Sessions</th>
              <th className="p-3 border-b">Active</th>
              <th className="p-3 border-b text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-b hover:bg-gray-50">
                <td className="p-3 font-mono text-xs text-gray-500">{u.id}</td>
                <td className="p-3">{u.email}</td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    {editingPasswordId === u.id ? (
                      <div className="flex items-center gap-1">
                        <input 
                          type="text" 
                          value={newPasswordInput} 
                          onChange={(e) => setNewPasswordInput(e.target.value)}
                          className="p-1 border rounded text-xs w-24"
                          placeholder="New Pwd"
                        />
                        <button 
                          onClick={() => handleUpdatePassword(u.id)}
                          className="bg-emerald-600 text-white px-2 py-1 rounded text-[10px]"
                        >
                          Update
                        </button>
                        <button 
                          onClick={() => setEditingPasswordId(null)}
                          className="bg-gray-200 text-gray-600 px-2 py-1 rounded text-[10px]"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="font-mono text-sm">
                          {visiblePasswords[u.id] ? (u.password || 'Not Set') : '********'}
                        </span>
                        {(userRole === 'admin' || user?.email?.toLowerCase() === 'admin@rajgarhforest.app' || user?.email?.toLowerCase() === 'sharmaanuj860@gmail.com') && (
                          <button 
                            onClick={() => setVisiblePasswords(prev => ({ ...prev, [u.id]: !prev[u.id] }))}
                            className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors"
                            title={visiblePasswords[u.id] ? "Hide Password" : "Show Password"}
                          >
                            {visiblePasswords[u.id] ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </td>
                <td className="p-3">
                  <select 
                    value={u.role} 
                    onChange={(e) => handleUserRoleChange(u.id, e.target.value as 'admin' | 'deo' | 'approver' | 'Sarahan' | 'Narag' | 'Habban' | 'Division' | 'Rajgarh')}
                    className="p-1 border rounded text-sm"
                  >
                    <option value="admin">Admin</option>
                    <option value="deo">DEO</option>
                    <option value="approver">DA</option>
                    <option value="Sarahan">Sarahan</option>
                    <option value="Narag">Narag</option>
                    <option value="Habban">Habban</option>
                    <option value="Division">Division</option>
                    <option value="Rajgarh">Rajgarh</option>
                  </select>
                </td>
                <td className="p-3">
                  <input 
                    type="number" 
                    min="1" 
                    max="999999"
                    value={u.maxSessions || 999999}
                    onChange={(e) => handleUpdateMaxSessions(u.id, parseInt(e.target.value))}
                    className="w-16 p-1 border rounded text-xs"
                  />
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${u.activeSessions?.length ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {u.activeSessions?.length || 0} Active
                    </span>
                    {u.activeSessions?.length ? (
                      <button 
                        onClick={() => handleClearSessions(u.id)}
                        className="text-red-500 hover:text-red-700 p-1"
                        title="Clear all sessions"
                      >
                        <RefreshCw className="w-3 h-3" />
                      </button>
                    ) : null}
                  </div>
                </td>
                <td className="p-3 text-right flex justify-end gap-2">
                  <button 
                    onClick={() => {
                      setEditingPasswordId(u.id);
                      setNewPasswordInput(u.password || '');
                    }} 
                    className="text-blue-500 hover:text-blue-700 text-sm border border-blue-200 px-2 py-1 rounded"
                  >
                    Set New Password
                  </button>
                  <button onClick={() => handleResetPassword(u.email)} className="text-gray-500 hover:text-gray-700 text-sm border border-gray-200 px-2 py-1 rounded">
                    Send Reset Email
                  </button>
                  <button 
                    onClick={() => handleToggleUserStatus(u.id, u.isDisabled || false)}
                    className={`text-sm border px-2 py-1 rounded transition-colors ${u.isDisabled ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' : 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'}`}
                  >
                    {u.isDisabled ? 'Disabled' : 'Enabled'}
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

      <div className="mt-12 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold mb-4 border-b pb-2 flex items-center gap-2">
          <Lock className="h-5 w-5 text-red-600" /> Feature Locking Control
        </h3>
        <p className="text-xs text-gray-500 mb-6">Lock specific features for specific roles or ranges. When locked, users cannot add, edit, or delete records for that feature.</p>

        <div className="space-y-6">
          <div className="flex flex-col md:flex-row gap-4 items-end bg-gray-50 p-4 rounded-lg border border-gray-200">
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Select Range, Role or User</label>
              <select 
                value={selectedLockTarget}
                onChange={(e) => setSelectedLockTarget(e.target.value)}
                className="w-full p-2 border rounded bg-white text-sm"
              >
                <option value="">-- Select Target --</option>
                <optgroup label="Roles">
                  <option value="deo">DEO</option>
                  <option value="approver">DA</option>
                  <option value="Sarahan">Sarahan</option>
                  <option value="Narag">Narag</option>
                  <option value="Habban">Habban</option>
                  <option value="Division">Division</option>
                  <option value="Rajgarh">Rajgarh</option>
                </optgroup>
                <optgroup label="Ranges">
                  {ranges.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </optgroup>
                <optgroup label="Users">
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.email} ({u.role})</option>
                  ))}
                </optgroup>
              </select>
            </div>
            
            <div className="flex gap-2 flex-wrap">
              <button 
                disabled={!selectedLockTarget}
                onClick={() => handleToggleFeatureLock('Allocation', selectedLockTarget)}
                className={`px-3 py-1.5 rounded text-[11px] font-bold transition-colors flex items-center gap-1.5 ${!selectedLockTarget ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : featureLocks.find(l => l.feature === 'Allocation' && l.target === selectedLockTarget)?.isLocked ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
              >
                {featureLocks.find(l => l.feature === 'Allocation' && l.target === selectedLockTarget)?.isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                {featureLocks.find(l => l.feature === 'Allocation' && l.target === selectedLockTarget)?.isLocked ? 'Allocation Locked' : 'Lock Allocation'}
              </button>
              
              <button 
                disabled={!selectedLockTarget}
                onClick={() => handleToggleFeatureLock('Expenditure', selectedLockTarget)}
                className={`px-3 py-1.5 rounded text-[11px] font-bold transition-colors flex items-center gap-1.5 ${!selectedLockTarget ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : featureLocks.find(l => l.feature === 'Expenditure' && l.target === selectedLockTarget)?.isLocked ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
              >
                {featureLocks.find(l => l.feature === 'Expenditure' && l.target === selectedLockTarget)?.isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                {featureLocks.find(l => l.feature === 'Expenditure' && l.target === selectedLockTarget)?.isLocked ? 'Expenditure Locked' : 'Lock Expenditure'}
              </button>

              <button 
                disabled={!selectedLockTarget}
                onClick={() => {
                  const targetUser = users.find(u => u.id === selectedLockTarget);
                  if (targetUser) {
                    handleToggleUserStatus(selectedLockTarget, targetUser.isDisabled || false);
                  } else {
                    handleToggleFeatureLock('Access', selectedLockTarget);
                  }
                }}
                className={`px-3 py-1.5 rounded text-[11px] font-bold transition-colors flex items-center gap-1.5 ${!selectedLockTarget ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : (users.find(u => u.id === selectedLockTarget)?.isDisabled || featureLocks.find(l => l.feature === 'Access' && l.target === selectedLockTarget)?.isLocked) ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
              >
                {(users.find(u => u.id === selectedLockTarget)?.isDisabled || featureLocks.find(l => l.feature === 'Access' && l.target === selectedLockTarget)?.isLocked) ? <Shield className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                {(users.find(u => u.id === selectedLockTarget)?.isDisabled || featureLocks.find(l => l.feature === 'Access' && l.target === selectedLockTarget)?.isLocked) ? 'Disabled' : 'Enabled'}
              </button>
            </div>
          </div>

          {(featureLocks.filter(l => l.isLocked).length > 0 || users.filter(u => u.isDisabled).length > 0) && (
            <div className="mt-4">
              <h4 className="text-sm font-bold mb-2 text-gray-600">Active Restrictions</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-gray-600 text-xs">
                      <th className="p-2 border-b">Target</th>
                      <th className="p-2 border-b">Feature</th>
                      <th className="p-2 border-b">Status</th>
                      <th className="p-2 border-b">Updated By</th>
                      <th className="p-2 border-b">Updated At</th>
                      <th className="p-2 border-b text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {featureLocks.filter(l => l.isLocked).map(l => (
                      <tr key={l.id} className="border-b hover:bg-gray-50 text-xs">
                        <td className="p-2 font-medium uppercase">
                          {ranges.find(r => r.id === l.target)?.name || (l.target === 'approver' ? 'DA' : l.target)}
                        </td>
                        <td className="p-2">{l.feature === 'Access' ? 'Full Access' : l.feature}</td>
                        <td className="p-2">
                          <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">
                            {l.feature === 'Access' ? 'DISABLED' : 'LOCKED'}
                          </span>
                        </td>
                        <td className="p-2 text-gray-500">{l.updatedBy}</td>
                        <td className="p-2 text-gray-500">{new Date(l.updatedAt).toLocaleString()}</td>
                        <td className="p-2 text-right">
                          <button 
                            onClick={() => handleToggleFeatureLock(l.feature as any, l.target)}
                            className="text-emerald-600 hover:text-emerald-700 font-bold"
                          >
                            {l.feature === 'Access' ? 'Enable' : 'Unlock'}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {users.filter(u => u.isDisabled).map(u => (
                      <tr key={u.id} className="border-b hover:bg-gray-50 text-xs">
                        <td className="p-2 font-medium">
                          {u.email} ({u.role})
                        </td>
                        <td className="p-2">User Access</td>
                        <td className="p-2">
                          <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">DISABLED</span>
                        </td>
                        <td className="p-2 text-gray-500">Admin</td>
                        <td className="p-2 text-gray-500">{u.updatedAt ? new Date(u.updatedAt).toLocaleString() : 'N/A'}</td>
                        <td className="p-2 text-right">
                          <button 
                            onClick={() => handleToggleUserStatus(u.id, true)}
                            className="text-emerald-600 hover:text-emerald-700 font-bold"
                          >
                            Enable
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderReports = () => {
    const downloadPDF = (title: string, abstractData: any[], abstractHeaders: string[], detailedData: any[], detailedHeaders: string[]) => {
      const doc = new jsPDF('landscape');
      doc.setFontSize(16);
      doc.text(title, 14, 15);
      
      let finalY = 15;

      if (abstractData.length > 0) {
        doc.setFontSize(12);
        doc.text("SOE Abstract Summary", 14, 25);
        autoTable(doc, {
          head: [abstractHeaders],
          body: abstractData,
          startY: 30,
          styles: { fontSize: 7 },
          headStyles: { fillColor: [5, 150, 105] }
        });
        finalY = (doc as any).lastAutoTable.finalY || 30;
      }

      doc.setFontSize(12);
      doc.text("Detailed Range-wise Report", 14, finalY + 15);
      autoTable(doc, {
        head: [detailedHeaders],
        body: detailedData,
        startY: finalY + 20,
        styles: { fontSize: 7 },
        headStyles: { fillColor: [5, 150, 105] }
      });
      doc.save(`${title.toLowerCase().replace(/\s+/g, '_')}.pdf`);
    };

    const downloadExcel = async (title: string, abstractData: any[], abstractHeaders: string[], detailedData: any[], detailedHeaders: string[]) => {
      const workbook = new ExcelJS.Workbook();
      
      if (abstractData.length > 0) {
        const abstractSheet = workbook.addWorksheet("Abstract Summary");
        
        // Add Title
        const titleRow = abstractSheet.addRow(["SOE Abstract Summary"]);
        titleRow.font = { bold: true, size: 14 };
        abstractSheet.mergeCells(1, 1, 1, abstractHeaders.length);
        titleRow.alignment = { horizontal: 'center' };

        // Add Headers
        const headerRow = abstractSheet.addRow(abstractHeaders);
        headerRow.eachCell((cell) => {
          cell.font = { bold: true };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
          };
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        });

        // Add Data
        abstractData.forEach(row => {
          const dataRow = abstractSheet.addRow(row);
          dataRow.eachCell((cell) => {
            cell.border = {
              top: { style: 'thin' },
              left: { style: 'thin' },
              bottom: { style: 'thin' },
              right: { style: 'thin' }
            };
          });
        });

        // Auto-width columns
        abstractSheet.columns.forEach(column => {
          let maxLength = 0;
          column.eachCell({ includeEmpty: true }, cell => {
            const columnLength = cell.value ? cell.value.toString().length : 10;
            if (columnLength > maxLength) {
              maxLength = columnLength;
            }
          });
          column.width = maxLength < 12 ? 12 : maxLength + 2;
        });
      }

      const detailedSheet = workbook.addWorksheet("Detailed Report");
      
      // Add Title
      const dTitleRow = detailedSheet.addRow(["Detailed Range-wise Report"]);
      dTitleRow.font = { bold: true, size: 14 };
      detailedSheet.mergeCells(1, 1, 1, detailedHeaders.length);
      dTitleRow.alignment = { horizontal: 'center' };

      // Add Headers
      const dHeaderRow = detailedSheet.addRow(detailedHeaders);
      dHeaderRow.eachCell((cell) => {
        cell.font = { bold: true };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' }
        };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });

      // Add Data
      detailedData.forEach(row => {
        const dataRow = detailedSheet.addRow(row);
        dataRow.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        });
      });

      // Auto-width columns
      detailedSheet.columns.forEach(column => {
        let maxLength = 0;
        column.eachCell({ includeEmpty: true }, cell => {
          const columnLength = cell.value ? cell.value.toString().length : 10;
          if (columnLength > maxLength) {
            maxLength = columnLength;
          }
        });
        column.width = maxLength < 12 ? 12 : maxLength + 2;
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `${title.toLowerCase().replace(/\s+/g, '_')}.xlsx`);
    };

    const downloadZip = async () => {
      const zip = new JSZip();
      
      // 1. Allocations
      const allocHeaders = ['ID', 'SOE', 'Range', 'Amount', 'Scheme', 'Sector', 'Activity', 'SubActivity'];
      const allocData = currentAllocations.map(a => [
        a.id,
        a.fundedSOEs?.map(f => soes.find(s => s.id === f.soeId)?.name).join(', ') || 'Pending',
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
      const expHeaders = ['ID', 'Date', 'Amount', 'Description', 'Allocation ID', 'Approval ID'];
      const expData = currentExpenses.map(e => [
        e.id, e.date ? e.date.split('-').reverse().join('/') : '', e.amount, e.description, e.allocationId, e.approvalId ? `#${e.approvalId}` : '-'
      ]);
      const expWs = XLSX.utils.aoa_to_sheet([expHeaders, ...expData]);
      const expCsv = XLSX.utils.sheet_to_csv(expWs);
      zip.file("expenses.csv", expCsv);

      // 3. SOE Summary (Admin/DEO only)
      if (userRole === 'admin' || userRole === 'deo' || userRole === 'approver') {
        const soeHeaders = ['SOE ID', 'Name', 'Approved Budget', 'Received in TRY', 'Allocated', 'Spent', 'Remaining'];
        const soeData = soeAbstractData.map(s => [
          s.soeId, 
          s.soeName, 
          s.approvedBudget, 
          s.receivedInTry, 
          s.allocated, 
          s.spent, 
          s.remainingToSpend
        ]);
        const soeWs = XLSX.utils.aoa_to_sheet([soeHeaders, ...soeData]);
        const soeCsv = XLSX.utils.sheet_to_csv(soeWs);
        zip.file("soe_summary.csv", soeCsv);
      }

      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `financial_data_fy_${selectedFY}.zip`);
    };

    const comprehensiveReportData = baseAllocations.map(a => {
      const soeNames = a.fundedSOEs?.map((f: any) => soes.find(s => s.id === f.soeId)?.name).filter(Boolean).join(', ') || 'Pending Funds';
      const range = ranges.find(r => r.id === a.rangeId);
      
      let sa = subActivities.find(s => s.id === a.subActivityId);
      let act = activities.find(ac => ac.id === a.activityId);
      let sec = sectors.find(s => s.id === a.sectorId);
      let sch = schemes.find(s => s.id === a.schemeId);

      const budget = soes.filter(s => 
        ALLOWED_SOES.includes(s.name || 'Provisional') &&
        s.schemeId === a.schemeId && 
        (s.sectorId || null) === (a.sectorId || null) && 
        (s.activityId || null) === (a.activityId || null) && 
        (s.subActivityId || null) === (a.subActivityId || null)
      ).reduce((sum, s) => sum + getApprovedBudget(s), 0);
      const totalBudget = budget || 0;
      const allocated = a.amount;
      const expenditure = baseExpenses.filter(e => e.allocationId === a.id && e.status !== 'rejected').reduce((sum, e) => sum + e.amount, 0);
      const remaining = allocated - expenditure;

      return {
        soe: soeNames,
        range: range?.name || 'N/A',
        scheme: sch?.name || 'N/A',
        sector: sec?.name || 'N/A',
        activity: act?.name || 'N/A',
        subActivity: sa?.name || 'N/A',
        totalBudget: totalBudget,
        allocated: allocated,
        expenditure: expenditure,
        remaining: remaining,
        balance: remaining // for report consistency
      };
    });

    const allocationExpenditureData: any[] = [];
    baseAllocations.forEach(alloc => {
      const sch = schemes.find(s => s.id === alloc.schemeId);
      const sec = sectors.find(s => s.id === alloc.sectorId);
      const act = activities.find(a => a.id === alloc.activityId);
      const sa = subActivities.find(s => s.id === alloc.subActivityId);
      const range = ranges.find(r => r.id === alloc.rangeId);

      alloc.fundedSOEs?.forEach(f => {
        const soe = soes.find(s => s.id === f.soeId);
        const allocExpenses = baseExpenses.filter(e => e.allocationId === alloc.id && e.soeId === f.soeId && e.status !== 'rejected');
        
        const totalSpentOnSoe = allocExpenses.reduce((sum, e) => sum + e.amount, 0);

        if (allocExpenses.length === 0) {
          allocationExpenditureData.push({
            id: `alloc-${alloc.id}-${f.soeId}`,
            allocationId: alloc.id,
            soeId: f.soeId,
            date: alloc.createdAt ? new Date(alloc.createdAt).toISOString().split('T')[0] : 'N/A',
            scheme: sch?.name || 'N/A',
            sector: sec?.name || 'N/A',
            activity: act?.name || 'N/A',
            subActivity: sa?.name || 'N/A',
            soe: soe?.name || 'N/A',
            range: range?.name || 'N/A',
            allocation: f.amount,
            expenditure: 0,
            balance: f.amount,
            description: 'Initial Allocation',
            status: 'approved'
          });
        } else {
          allocExpenses.forEach(exp => {
            allocationExpenditureData.push({
              id: exp.id,
              allocationId: exp.allocationId,
              soeId: exp.soeId,
              date: exp.date,
              scheme: sch?.name || 'N/A',
              sector: sec?.name || 'N/A',
              activity: act?.name || 'N/A',
              subActivity: sa?.name || 'N/A',
              soe: soe?.name || 'N/A',
              range: range?.name || 'N/A',
              allocation: f.amount,
              expenditure: exp.amount,
              balance: f.amount - totalSpentOnSoe,
              description: exp.description,
              status: exp.status
            });
          });
        }
      });
    });

    const combinedReportData = [...comprehensiveReportData, ...allocationExpenditureData];
    const uniqueSchemes = Array.from(new Set(combinedReportData.map(r => r.scheme))).filter(Boolean).sort();
    const uniqueSectors = Array.from(new Set(combinedReportData.map(r => r.sector))).filter(Boolean).sort();
    const uniqueActivities = Array.from(new Set(combinedReportData.map(r => r.activity))).filter(Boolean).sort();
    const uniqueSubActivities = Array.from(new Set(combinedReportData.map(r => r.subActivity))).filter(Boolean).sort();
    const uniqueSoes = Array.from(new Set(soes.map(s => s.name))).filter(Boolean).sort();
    const uniqueRangesList = Array.from(new Set(ranges.map(r => r.name === 'Rajgarh Forest Division' ? 'Division' : r.name))).filter(Boolean).sort();

    const renderAllocationExpenditureReport = () => {
      const searchLower = reportSearchTerm.toLowerCase();
      const filtered = allocationExpenditureData.filter(row => {
        const matchesSearch = (
          row.scheme.toLowerCase().includes(searchLower) ||
          row.sector.toLowerCase().includes(searchLower) ||
          row.activity.toLowerCase().includes(searchLower) ||
          row.subActivity.toLowerCase().includes(searchLower) ||
          row.soe.toLowerCase().includes(searchLower) ||
          row.range.toLowerCase().includes(searchLower) ||
          row.description.toLowerCase().includes(searchLower)
        );

        const matchesFilters = (
          (!reportFilters.scheme || row.scheme === reportFilters.scheme) &&
          (!reportFilters.sector || row.sector === reportFilters.sector) &&
          (!reportFilters.activity || row.activity === reportFilters.activity) &&
          (!reportFilters.subActivity || row.subActivity === reportFilters.subActivity) &&
          (!reportFilters.range || row.range === reportFilters.range) &&
          (!reportFilters.soe || row.soe.includes(reportFilters.soe))
        );

        return matchesSearch && matchesFilters;
      }).sort((a, b) => {
        // Sort by Activity first, then Sub-Activity, then Date
        if (a.activity !== b.activity) {
          return a.activity.localeCompare(b.activity);
        }
        if (a.subActivity !== b.subActivity) {
          return a.subActivity.localeCompare(b.subActivity);
        }
        // Sort by date (assuming YYYY-MM-DD format)
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      });

      // Totals for searched/filtered items
      // Fix: Calculate total allocation correctly by only counting each unique allocation-SOE pair once
      const uniqueAllocationsInFiltered = Array.from(new Set(filtered.map(r => (r as any).allocationId + '-' + (r as any).soeId)));
      const totalAllocation = uniqueAllocationsInFiltered.reduce((sum, key) => {
        const row = filtered.find(r => ((r as any).allocationId + '-' + (r as any).soeId) === key);
        return sum + (row ? (row as any).allocation : 0);
      }, 0);

      const totalExpenditure = filtered.reduce((sum, r) => sum + r.expenditure, 0);
      const totalBalance = totalAllocation - totalExpenditure;

      // Pagination
      const totalPages = reportItemsPerPage === -1 ? 1 : Math.ceil(filtered.length / reportItemsPerPage);
      const paginatedData = reportItemsPerPage === -1 ? filtered : filtered.slice((reportPage - 1) * reportItemsPerPage, reportPage * reportItemsPerPage);

      const headers = ['Date', 'Range', 'Scheme', 'Sector', 'Activity', 'Sub-Activity', 'SOE', 'Description', 'Allocation', 'Expenditure', 'Balance to Book'];
      const tableData = filtered.map(r => [
        r.date, r.range, r.scheme, r.sector, r.activity, r.subActivity, r.soe, r.description, r.allocation, r.expenditure, r.balance
      ]);

      return (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by scheme, sector, activity, unit, description..."
                  value={reportSearchTerm}
                  onChange={(e) => { setReportSearchTerm(e.target.value); setReportPage(1); }}
                  className="pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 w-full"
                />
              </div>
              <button 
                onClick={() => setShowReportFilters(!showReportFilters)}
                className={`flex items-center gap-1 px-3 py-2 border rounded-lg text-sm transition-colors ${showReportFilters ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-white hover:bg-gray-50'}`}
              >
                <Filter className="w-4 h-4" />
                <span>Filters</span>
                {showReportFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              <select 
                value={reportItemsPerPage} 
                onChange={(e) => { setReportItemsPerPage(Number(e.target.value)); setReportPage(1); }}
                className="p-2 border rounded text-sm bg-white"
              >
                <option value={10}>10 per page</option>
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
                <option value={-1}>View All</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => downloadPDF('Allocation & Expenditure Report', [], [], tableData, headers)}
                className="bg-red-600 text-white px-3 py-1.5 rounded text-xs flex items-center gap-1 hover:bg-red-700 transition-colors"
              >
                <Download className="w-3 h-3" /> PDF
              </button>
              <button 
                onClick={() => downloadExcel('Allocation & Expenditure Report', [], [], tableData, headers)}
                className="bg-emerald-600 text-white px-3 py-1.5 rounded text-xs flex items-center gap-1 hover:bg-emerald-700 transition-colors"
              >
                <Download className="w-3 h-3" /> Excel
              </button>
            </div>
          </div>

              {showReportFilters && (
                <div className="mb-6 animate-in fade-in slide-in-from-top-2">
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 p-4 bg-gray-50 rounded-t-lg border border-gray-200">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Range</label>
                      <select 
                        value={reportFilters.range}
                        onChange={(e) => { setReportFilters({ ...reportFilters, range: e.target.value, scheme: '', sector: '', activity: '', subActivity: '', soe: '' }); setReportPage(1); }}
                        className="w-full p-2 border border-gray-300 rounded text-xs bg-white"
                      >
                        <option value="">All Ranges</option>
                        {uniqueRangesList.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Scheme</label>
                      <select 
                        value={reportFilters.scheme}
                        onChange={(e) => { setReportFilters({ ...reportFilters, scheme: e.target.value, sector: '', activity: '', subActivity: '', soe: '' }); setReportPage(1); }}
                        className="w-full p-2 border border-gray-300 rounded text-xs bg-white"
                      >
                        <option value="">All Schemes</option>
                        {uniqueSchemes.filter(s => {
                          if (!reportFilters.range) return true;
                          return combinedReportData.some(r => r.range === reportFilters.range && r.scheme === s);
                        }).map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Sector</label>
                      <select 
                        value={reportFilters.sector}
                        onChange={(e) => { setReportFilters({ ...reportFilters, sector: e.target.value, activity: '', subActivity: '', soe: '' }); setReportPage(1); }}
                        className="w-full p-2 border border-gray-300 rounded text-xs bg-white"
                      >
                        <option value="">All Sectors</option>
                        {uniqueSectors.filter(s => {
                          if (!reportFilters.range && !reportFilters.scheme) return true;
                          return combinedReportData.some(r => {
                            const rangeMatch = !reportFilters.range || r.range === reportFilters.range;
                            const schemeMatch = !reportFilters.scheme || r.scheme === reportFilters.scheme;
                            return rangeMatch && schemeMatch && r.sector === s;
                          });
                        }).map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Activity</label>
                      <select 
                        value={reportFilters.activity}
                        onChange={(e) => { setReportFilters({ ...reportFilters, activity: e.target.value, subActivity: '', soe: '' }); setReportPage(1); }}
                        className="w-full p-2 border border-gray-300 rounded text-xs bg-white"
                      >
                        <option value="">All Activities</option>
                        {uniqueActivities.filter(a => {
                          if (!reportFilters.range && !reportFilters.scheme && !reportFilters.sector) return true;
                          return combinedReportData.some(r => {
                            const rangeMatch = !reportFilters.range || r.range === reportFilters.range;
                            const schemeMatch = !reportFilters.scheme || r.scheme === reportFilters.scheme;
                            const sectorMatch = !reportFilters.sector || r.sector === reportFilters.sector;
                            return rangeMatch && schemeMatch && sectorMatch && r.activity === a;
                          });
                        }).map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Sub-Activity</label>
                      <select 
                        value={reportFilters.subActivity}
                        onChange={(e) => { setReportFilters({ ...reportFilters, subActivity: e.target.value, soe: '' }); setReportPage(1); }}
                        className="w-full p-2 border border-gray-300 rounded text-xs bg-white"
                      >
                        <option value="">All Sub-Activities</option>
                        {uniqueSubActivities.filter(sa => {
                          if (!reportFilters.range && !reportFilters.scheme && !reportFilters.sector && !reportFilters.activity) return true;
                          return combinedReportData.some(r => {
                            const rangeMatch = !reportFilters.range || r.range === reportFilters.range;
                            const schemeMatch = !reportFilters.scheme || r.scheme === reportFilters.scheme;
                            const sectorMatch = !reportFilters.sector || r.sector === reportFilters.sector;
                            const activityMatch = !reportFilters.activity || r.activity === reportFilters.activity;
                            return rangeMatch && schemeMatch && sectorMatch && activityMatch && r.subActivity === sa;
                          });
                        }).map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">SOE</label>
                      <select 
                        value={reportFilters.soe}
                        onChange={(e) => { setReportFilters({ ...reportFilters, soe: e.target.value }); setReportPage(1); }}
                        className="w-full p-2 border border-gray-300 rounded text-xs bg-white"
                      >
                        <option value="">All SOEs</option>
                        {uniqueSoes.filter(s => {
                          if (!reportFilters.range && !reportFilters.scheme && !reportFilters.sector && !reportFilters.activity && !reportFilters.subActivity) return true;
                          return combinedReportData.some(r => {
                            const rangeMatch = !reportFilters.range || r.range === reportFilters.range;
                            const schemeMatch = !reportFilters.scheme || r.scheme === reportFilters.scheme;
                            const sectorMatch = !reportFilters.sector || r.sector === reportFilters.sector;
                            const activityMatch = !reportFilters.activity || r.activity === reportFilters.activity;
                            const subActivityMatch = !reportFilters.subActivity || r.subActivity === reportFilters.subActivity;
                            return rangeMatch && schemeMatch && sectorMatch && activityMatch && subActivityMatch && (r as any).soe.includes(s);
                          });
                        }).map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="lg:col-span-6 flex justify-end">
                      <button 
                        onClick={() => {
                          setReportFilters({ scheme: '', sector: '', activity: '', subActivity: '', range: '', soe: '' });
                          setReportSearchTerm('');
                          setReportPage(1);
                        }}
                        className="text-xs text-red-600 hover:text-red-800 font-medium flex items-center gap-1"
                      >
                        <X className="w-3 h-3" />
                        Reset Filters
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-emerald-50 rounded-b-lg border-x border-b border-gray-200">
                    <div className="flex justify-between items-center px-2">
                      <span className="text-[10px] font-bold text-emerald-800 uppercase">Total Allocation:</span>
                      <span className="text-sm font-bold text-emerald-700">₹{totalAllocation.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center px-2 border-x border-emerald-100">
                      <span className="text-[10px] font-bold text-red-800 uppercase">Total Expenditure:</span>
                      <span className="text-sm font-bold text-red-700">₹{totalExpenditure.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center px-2">
                      <span className="text-[10px] font-bold text-blue-800 uppercase">Total Balance:</span>
                      <span className="text-sm font-bold text-blue-700">₹{totalBalance.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-2 text-[10px] font-bold text-gray-700 border border-gray-300 uppercase tracking-tight">Date</th>
                  <th className="p-2 text-[10px] font-bold text-gray-700 border border-gray-300 uppercase tracking-tight">
                    <div className="flex items-center justify-between">
                      Range <Filter className="w-3 h-3 cursor-pointer hover:text-emerald-600" onClick={() => setShowReportFilters(!showReportFilters)} />
                    </div>
                  </th>
                  <th className="p-2 text-[10px] font-bold text-gray-700 border border-gray-300 uppercase tracking-tight">
                    <div className="flex items-center justify-between">
                      Scheme <Filter className="w-3 h-3 cursor-pointer hover:text-emerald-600" onClick={() => setShowReportFilters(!showReportFilters)} />
                    </div>
                  </th>
                  <th className="p-2 text-[10px] font-bold text-gray-700 border border-gray-300 uppercase tracking-tight">
                    <div className="flex items-center justify-between">
                      Sector <Filter className="w-3 h-3 cursor-pointer hover:text-emerald-600" onClick={() => setShowReportFilters(!showReportFilters)} />
                    </div>
                  </th>
                  <th className="p-2 text-[10px] font-bold text-gray-700 border border-gray-300 uppercase tracking-tight">
                    <div className="flex items-center justify-between">
                      Activity <Filter className="w-3 h-3 cursor-pointer hover:text-emerald-600" onClick={() => setShowReportFilters(!showReportFilters)} />
                    </div>
                  </th>
                  <th className="p-2 text-[10px] font-bold text-gray-700 border border-gray-300 uppercase tracking-tight">
                    <div className="flex items-center justify-between">
                      Sub-Activity <Filter className="w-3 h-3 cursor-pointer hover:text-emerald-600" onClick={() => setShowReportFilters(!showReportFilters)} />
                    </div>
                  </th>
                  <th className="p-2 text-[10px] font-bold text-gray-700 border border-gray-300 uppercase tracking-tight">
                    <div className="flex items-center justify-between">
                      SOE <Filter className="w-3 h-3 cursor-pointer hover:text-emerald-600" onClick={() => setShowReportFilters(!showReportFilters)} />
                    </div>
                  </th>
                  <th className="p-2 text-[10px] font-bold text-gray-700 border border-gray-300 uppercase tracking-tight">Description</th>
                  <th className="p-2 text-[10px] font-bold text-gray-700 border border-gray-300 uppercase tracking-tight text-right">Allocation</th>
                  <th className="p-2 text-[10px] font-bold text-gray-700 border border-gray-300 uppercase tracking-tight text-right">Expenditure</th>
                  <th className="p-2 text-[10px] font-bold text-gray-700 border border-gray-300 uppercase tracking-tight text-right">Balance to Book</th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50 border-b border-gray-200">
                    <td className="p-2 text-[10px] border border-gray-300">{row.date}</td>
                    <td className="p-2 text-[10px] border border-gray-300">{row.range}</td>
                    <td className="p-2 text-[10px] border border-gray-300">{row.scheme}</td>
                    <td className="p-2 text-[10px] border border-gray-300">{row.sector}</td>
                    <td className="p-2 text-[10px] border border-gray-300">{row.activity}</td>
                    <td className="p-2 text-[10px] border border-gray-300">{row.subActivity}</td>
                    <td className="p-2 text-[10px] border border-gray-300 font-medium">{row.soe}</td>
                    <td className="p-2 text-[10px] border border-gray-300">{row.description}</td>
                    <td className="p-2 text-[10px] border border-gray-300 text-right font-medium text-emerald-700">₹{row.allocation.toLocaleString()}</td>
                    <td className="p-2 text-[10px] border border-gray-300 text-right font-bold text-red-700">₹{row.expenditure.toLocaleString()}</td>
                    <td className="p-2 text-[10px] border border-gray-300 text-right font-bold text-blue-700">₹{row.balance.toLocaleString()}</td>
                  </tr>
                ))}
                {paginatedData.length === 0 && (
                  <tr>
                    <td colSpan={11} className="p-8 text-center text-gray-500 border border-gray-300">No expenditure data found.</td>
                  </tr>
                )}
              </tbody>
              {paginatedData.length > 0 && (
                <tfoot className="bg-gray-100 font-bold">
                  <tr>
                    <td colSpan={8} className="p-2 text-[10px] border border-gray-300 text-right uppercase">Total (Filtered)</td>
                    <td className="p-2 text-[10px] border border-gray-300 text-right text-emerald-700">₹{totalAllocation.toLocaleString()}</td>
                    <td className="p-2 text-[10px] border border-gray-300 text-right text-red-700">₹{totalExpenditure.toLocaleString()}</td>
                    <td className="p-2 text-[10px] border border-gray-300 text-right text-blue-700">₹{totalBalance.toLocaleString()}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {reportItemsPerPage !== -1 && totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-xs text-gray-500">Showing {(reportPage - 1) * reportItemsPerPage + 1} to {Math.min(reportPage * reportItemsPerPage, filtered.length)} of {filtered.length} entries</span>
              <div className="flex gap-1">
                <button
                  onClick={() => setReportPage(p => Math.max(1, p - 1))}
                  disabled={reportPage === 1}
                  className="p-1 rounded border hover:bg-gray-100 disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="flex gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) pageNum = i + 1;
                    else if (reportPage <= 3) pageNum = i + 1;
                    else if (reportPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                    else pageNum = reportPage - 2 + i;
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setReportPage(pageNum)}
                        className={`w-8 h-8 text-xs rounded border ${reportPage === pageNum ? 'bg-emerald-600 text-white border-emerald-600' : 'hover:bg-gray-100'}`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setReportPage(p => Math.min(totalPages, p + 1))}
                  disabled={reportPage === totalPages}
                  className="p-1 rounded border hover:bg-gray-100 disabled:opacity-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      );
    };

    // Calculate total allocated per SOE Head across all ranges to get accurate "To be Allocated"
    const totalAllocatedBySoe: Record<string, number> = {};
    comprehensiveReportData.forEach(a => {
      totalAllocatedBySoe[a.soe] = (totalAllocatedBySoe[a.soe] || 0) + a.allocated;
    });

    // Filtering
    const filteredData = comprehensiveReportData.filter(row => {
      return (
        (!reportFilters.range || row.range === reportFilters.range) &&
        (!reportFilters.scheme || row.scheme === reportFilters.scheme) &&
        (!reportFilters.sector || row.sector === reportFilters.sector) &&
        (!reportFilters.activity || row.activity === reportFilters.activity) &&
        (!reportFilters.subActivity || row.subActivity === reportFilters.subActivity) &&
        (!reportFilters.soe || row.soe.includes(reportFilters.soe))
      );
    });

    const sortedData = [...filteredData].sort((a, b) => {
      if (a.scheme !== b.scheme) return a.scheme.localeCompare(b.scheme);
      if (a.sector !== b.sector) return a.sector.localeCompare(b.sector);
      if (a.activity !== b.activity) return a.activity.localeCompare(b.activity);
      return a.subActivity.localeCompare(b.subActivity);
    });

    const groupedData = [];
    
    // Helper to calculate totals for a group of rows
    const calculateTotals = (rows: any[]) => {
      const distinctSoes: Record<string, number> = {};
      let totalAllocated = 0;
      let totalExpenditure = 0;

      rows.forEach(r => {
        if (!(r.soe in distinctSoes)) {
          distinctSoes[r.soe] = r.totalBudget;
        }
        totalAllocated += r.allocated;
        totalExpenditure += r.expenditure;
      });

      const totalBudget = Object.values(distinctSoes).reduce((sum, b) => sum + b, 0);
      const toBeAllocated = totalBudget - totalAllocated;
      const remaining = totalAllocated - totalExpenditure; // Fix: Balance = Allocated - Expenditure

      return {
        totalBudget,
        allocated: totalAllocated,
        toBeAllocated,
        expenditure: totalExpenditure,
        remaining
      };
    };

    let currentSchemeRows = [];
    let currentSectorRows = [];
    let currentActivityRows = [];
    let currentSubActivityRows = [];

    let currentScheme = null;
    let currentSector = null;
    let currentActivity = null;
    let currentSubActivity = null;

    sortedData.forEach((row, idx) => {
      const totalAllocatedForThisSoe = totalAllocatedBySoe[row.soe] || 0;
      const toBeAllocated = row.totalBudget - totalAllocatedForThisSoe;
      const rowWithCalc = { ...row, toBeAllocated };

      if (idx > 0) {
        if (row.subActivity !== currentSubActivity || row.activity !== currentActivity || row.sector !== currentSector || row.scheme !== currentScheme) {
          const totals = calculateTotals(currentSubActivityRows);
          groupedData.push({ ...totals, range: '', scheme: '', sector: '', activity: '', subActivity: `Total for ${currentSubActivity}`, soe: '', isTotal: true, level: 'subActivity' });
          currentSubActivityRows = [];
        }
        if (row.activity !== currentActivity || row.sector !== currentSector || row.scheme !== currentScheme) {
          const totals = calculateTotals(currentActivityRows);
          groupedData.push({ ...totals, range: '', scheme: '', sector: '', activity: `Total for ${currentActivity}`, subActivity: '', soe: '', isTotal: true, level: 'activity' });
          currentActivityRows = [];
        }
        if (row.sector !== currentSector || row.scheme !== currentScheme) {
          const totals = calculateTotals(currentSectorRows);
          groupedData.push({ ...totals, range: '', scheme: '', sector: `Total for ${currentSector}`, activity: '', subActivity: '', soe: '', isTotal: true, level: 'sector' });
          currentSectorRows = [];
        }
        if (row.scheme !== currentScheme) {
          const totals = calculateTotals(currentSchemeRows);
          groupedData.push({ ...totals, range: '', scheme: `Total for ${currentScheme}`, sector: '', activity: '', subActivity: '', soe: '', isTotal: true, level: 'scheme' });
          currentSchemeRows = [];
        }
      }

      currentScheme = row.scheme;
      currentSector = row.sector;
      currentActivity = row.activity;
      currentSubActivity = row.subActivity;

      groupedData.push(rowWithCalc);
      
      currentSubActivityRows.push(rowWithCalc);
      currentActivityRows.push(rowWithCalc);
      currentSectorRows.push(rowWithCalc);
      currentSchemeRows.push(rowWithCalc);
    });

    if (sortedData.length > 0) {
      const saTotals = calculateTotals(currentSubActivityRows);
      groupedData.push({ ...saTotals, range: '', scheme: '', sector: '', activity: '', subActivity: `Total for ${currentSubActivity}`, soe: '', isTotal: true, level: 'subActivity' });
      
      const actTotals = calculateTotals(currentActivityRows);
      groupedData.push({ ...actTotals, range: '', scheme: '', sector: '', activity: `Total for ${currentActivity}`, subActivity: '', soe: '', isTotal: true, level: 'activity' });
      
      const secTotals = calculateTotals(currentSectorRows);
      groupedData.push({ ...secTotals, range: '', scheme: '', sector: `Total for ${currentSector}`, activity: '', subActivity: '', soe: '', isTotal: true, level: 'sector' });
      
      const schTotals = calculateTotals(currentSchemeRows);
      groupedData.push({ ...schTotals, range: '', scheme: `Total for ${currentScheme}`, sector: '', activity: '', subActivity: '', soe: '', isTotal: true, level: 'scheme' });
      
      const grandTotals = calculateTotals(sortedData);
      groupedData.push({ ...grandTotals, range: '', scheme: '', sector: '', activity: '', subActivity: '', soe: 'Grand Total', isTotal: true, level: 'grand' });
    }

    // --- SOE Abstract Summary Calculation ---
    const abstractRows = soeAbstractData.filter(row => {
      // Apply UI filters
      const matchesFilters = (
        (!reportFilters.scheme || row.schemeName === reportFilters.scheme) &&
        (!reportFilters.sector || row.sectorName === reportFilters.sector) &&
        (!reportFilters.activity || row.activityName === reportFilters.activity) &&
        (!reportFilters.subActivity || row.subActivityName === reportFilters.subActivity)
      );

      if (!matchesFilters) return false;

      if (soeAbstractSearch) {
        const searchStr = soeAbstractSearch.toLowerCase();
        return (
          row.hierarchy.toLowerCase().includes(searchStr) ||
          row.soeName.toLowerCase().includes(searchStr)
        );
      }

      return true;
    }).map(r => ({
      ...r,
      expenditure: r.spent, // Rename for report consistency
      remaining: r.remainingToSpend // Rename for report consistency
    })).sort((a, b) => a.hierarchy.localeCompare(b.hierarchy) || a.soeName.localeCompare(b.soeName));

    const abstractHeaders = ['Hierarchy', 'Name of SOE', 'Approved Budget', 'Received in Try', 'Allocated', 'To be Allocated', 'Try Balance', 'Expenditure', 'Remaining'];
    const abstractTableData = abstractRows.map(r => [
      r.hierarchy, r.soeName, r.approvedBudget, r.receivedInTry, r.allocated, r.toBeAllocated, r.tryBalance, r.expenditure, r.remaining
    ]);

    const isGlobalUser = userRole === 'admin' || userRole === 'deo' || userRole === 'approver';
    const detailedHeaders = ['Range', 'Scheme', 'Sector', 'Activity', 'Sub-Activity', 'SOE Head'];
    if (!userRangeId) detailedHeaders.push('Total Budget');
    detailedHeaders.push('Allocation');
    detailedHeaders.push('Expenditure', 'Balance to Book');
    
    const detailedTableData = groupedData.map(row => {
      const cols = [row.range, row.scheme, row.sector, row.activity, row.subActivity, row.soe];
      if (!userRangeId) cols.push(row.totalBudget);
      cols.push(row.allocated);
      cols.push(row.expenditure, row.remaining);
      return cols;
    });

    return (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex border-b border-gray-200 mb-6">
            <button
              onClick={() => { setReportSubTab('summary'); setReportPage(1); }}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${reportSubTab === 'summary' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              Summary Report
            </button>
            <button
              onClick={() => { setReportSubTab('allocation-expenditure'); setReportPage(1); }}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${reportSubTab === 'allocation-expenditure' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              Allocation & Expenditure Details
            </button>
            <button
              onClick={() => { setReportSubTab('ledger'); setReportPage(1); }}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${reportSubTab === 'ledger' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              Scheme Wise Ledger
            </button>
            {(userRole === 'admin' || userRole === 'Division') && (
              <button
                onClick={() => { setReportSubTab('master-control'); setReportPage(1); }}
                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${reportSubTab === 'master-control' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                Master Control
              </button>
            )}
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <FileBarChart className="text-emerald-600" /> {reportSubTab === 'summary' ? 'Comprehensive Budget Report' : reportSubTab === 'ledger' ? 'Scheme Wise Ledger' : 'Allocation & Expenditure Details'}
            </h3>
            <div className="flex flex-wrap gap-1">
              <button 
                onClick={() => setShowReportFilters(!showReportFilters)}
                className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-[10px] flex items-center justify-center gap-1 hover:bg-gray-200 transition-colors border border-gray-200"
              >
                <Filter className="w-3 h-3" /> {showReportFilters ? 'Hide' : 'Show'} Filters
                {showReportFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              {reportSubTab === 'summary' && (
                <>
                  <button 
                    onClick={() => downloadPDF('Comprehensive Budget Report', (userRole === 'admin' || userRole === 'deo' || userRole === 'approver') ? abstractTableData : [], (userRole === 'admin' || userRole === 'deo' || userRole === 'approver') ? abstractHeaders : [], detailedTableData, detailedHeaders)}
                    className="bg-red-600 text-white px-2 py-0.5 rounded text-[10px] flex items-center justify-center gap-1 hover:bg-red-700 transition-colors shadow-sm"
                  >
                    <Download className="w-3 h-3" /> PDF
                  </button>
                  <button 
                    onClick={() => downloadExcel('Comprehensive Budget Report', (userRole === 'admin' || userRole === 'deo' || userRole === 'approver') ? abstractTableData : [], (userRole === 'admin' || userRole === 'deo' || userRole === 'approver') ? abstractHeaders : [], detailedTableData, detailedHeaders)}
                    className="bg-emerald-600 text-white px-2 py-0.5 rounded text-[10px] flex items-center justify-center gap-1 hover:bg-emerald-700 transition-colors shadow-sm"
                  >
                    <Download className="w-3 h-3" /> Excel
                  </button>
                  <button 
                    onClick={downloadZip}
                    className="bg-blue-600 text-white px-2 py-0.5 rounded text-[10px] flex items-center justify-center gap-1 hover:bg-blue-700 transition-colors shadow-sm"
                  >
                    <Download className="w-3 h-3" /> ZIP
                  </button>
                </>
              )}
              {reportSubTab === 'ledger' && (
                <button 
                  onClick={downloadLedgerPDF}
                  className="bg-red-600 text-white px-2 py-0.5 rounded text-[10px] flex items-center justify-center gap-1 hover:bg-red-700 transition-colors shadow-sm"
                >
                  <Download className="w-3 h-3" /> PDF
                </button>
              )}
              {reportSubTab === 'master-control' && (
                <>
                  <button 
                    onClick={() => {
                      const headers = ["Range", "Scheme", "Sector", "Activity", "Sub-Activity", "SOE", "Allocated", "Expenditure", "Balance"];
                      const data = masterControlData.map(r => [r.rangeName, r.schemeName, r.sectorName, r.activityName, r.subActivityName, r.soeName, r.allocated, r.expenditure, r.balance]);
                      downloadPDF('Master Control Budget Report', [], [], data, headers);
                    }}
                    className="bg-red-600 text-white px-2 py-0.5 rounded text-[10px] flex items-center justify-center gap-1 hover:bg-red-700 transition-colors shadow-sm"
                  >
                    <Download className="w-3 h-3" /> PDF
                  </button>
                  <button 
                    onClick={() => {
                      const headers = ["Range", "Scheme", "Sector", "Activity", "Sub-Activity", "SOE", "Allocated", "Expenditure", "Balance"];
                      const data = masterControlData.map(r => [r.rangeName, r.schemeName, r.sectorName, r.activityName, r.subActivityName, r.soeName, r.allocated, r.expenditure, r.balance]);
                      downloadExcel('Master Control Budget Report', [], [], data, headers);
                    }}
                    className="bg-emerald-600 text-white px-2 py-0.5 rounded text-[10px] flex items-center justify-center gap-1 hover:bg-emerald-700 transition-colors shadow-sm"
                  >
                    <Download className="w-3 h-3" /> Excel
                  </button>
                </>
              )}
            </div>
          </div>

          {showReportFilters && (
            <div className="mb-6 animate-in fade-in slide-in-from-top-2">
                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
                {reportSubTab === 'summary' && (
                  <div className="lg:col-span-1 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                    <h5 className="text-xs font-bold text-gray-700 uppercase mb-3 flex items-center gap-2">
                      <PieChartIcon className="w-3 h-3 text-emerald-600" /> Budget Distribution
                    </h5>
                    <div className="h-40">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie 
                            data={[
                              { name: 'Spent', value: calculateTotals(sortedData).expenditure },
                              { name: 'Balance', value: calculateTotals(sortedData).remaining }
                            ]} 
                            innerRadius={35} 
                            outerRadius={50} 
                            paddingAngle={5} 
                            dataKey="value"
                          >
                            <Cell fill="#dc3545" />
                            <Cell fill="#10b981" />
                          </Pie>
                          <Tooltip formatter={(value: number) => `₹${value.toLocaleString()}`} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex justify-center gap-4 mt-2">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-red-500"></div>
                        <span className="text-[10px] text-gray-500">Spent</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                        <span className="text-[10px] text-gray-500">Balance</span>
                      </div>
                    </div>
                  </div>
                )}
                    
                <div className={`${reportSubTab === 'summary' ? 'lg:col-span-3' : 'lg:col-span-4'} grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200`}>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Range</label>
                    <select 
                      value={reportFilters.range}
                      onChange={(e) => { setReportFilters({ ...reportFilters, range: e.target.value, scheme: '', sector: '', activity: '', subActivity: '', soe: '' }); setReportPage(1); }}
                      className="w-full p-2 border border-gray-300 rounded text-xs bg-white"
                    >
                      <option value="">All Ranges</option>
                      {uniqueRangesList.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Scheme</label>
                    <select 
                      value={reportFilters.scheme}
                      onChange={(e) => { setReportFilters({ ...reportFilters, scheme: e.target.value, sector: '', activity: '', subActivity: '', soe: '' }); setReportPage(1); }}
                      className="w-full p-2 border border-gray-300 rounded text-xs bg-white"
                    >
                      <option value="">All Schemes</option>
                      {uniqueSchemes.filter(s => {
                        if (!reportFilters.range) return true;
                        return combinedReportData.some(r => r.range === reportFilters.range && r.scheme === s);
                      }).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Sector</label>
                    <select 
                      value={reportFilters.sector}
                      onChange={(e) => { setReportFilters({ ...reportFilters, sector: e.target.value, activity: '', subActivity: '', soe: '' }); setReportPage(1); }}
                      className="w-full p-2 border border-gray-300 rounded text-xs bg-white"
                    >
                      <option value="">All Sectors</option>
                      {uniqueSectors.filter(s => {
                        if (!reportFilters.range && !reportFilters.scheme) return true;
                        return combinedReportData.some(r => {
                          const rangeMatch = !reportFilters.range || r.range === reportFilters.range;
                          const schemeMatch = !reportFilters.scheme || r.scheme === reportFilters.scheme;
                          return rangeMatch && schemeMatch && r.sector === s;
                        });
                      }).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Activity</label>
                    <select 
                      value={reportFilters.activity}
                      onChange={(e) => { setReportFilters({ ...reportFilters, activity: e.target.value, subActivity: '', soe: '' }); setReportPage(1); }}
                      className="w-full p-2 border border-gray-300 rounded text-xs bg-white"
                    >
                      <option value="">All Activities</option>
                      {uniqueActivities.filter(a => {
                        if (!reportFilters.range && !reportFilters.scheme && !reportFilters.sector) return true;
                        return combinedReportData.some(r => {
                          const rangeMatch = !reportFilters.range || r.range === reportFilters.range;
                          const schemeMatch = !reportFilters.scheme || r.scheme === reportFilters.scheme;
                          const sectorMatch = !reportFilters.sector || r.sector === reportFilters.sector;
                          return rangeMatch && schemeMatch && sectorMatch && r.activity === a;
                        });
                      }).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Sub-Activity</label>
                    <select 
                      value={reportFilters.subActivity}
                      onChange={(e) => { setReportFilters({ ...reportFilters, subActivity: e.target.value, soe: '' }); setReportPage(1); }}
                      className="w-full p-2 border border-gray-300 rounded text-xs bg-white"
                    >
                      <option value="">All Sub-Activities</option>
                      {uniqueSubActivities.filter(sa => {
                        if (!reportFilters.range && !reportFilters.scheme && !reportFilters.sector && !reportFilters.activity) return true;
                        return combinedReportData.some(r => {
                          const rangeMatch = !reportFilters.range || r.range === reportFilters.range;
                          const schemeMatch = !reportFilters.scheme || r.scheme === reportFilters.scheme;
                          const sectorMatch = !reportFilters.sector || r.sector === reportFilters.sector;
                          const activityMatch = !reportFilters.activity || r.activity === reportFilters.activity;
                          return rangeMatch && schemeMatch && sectorMatch && activityMatch && r.subActivity === sa;
                        });
                      }).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">SOE</label>
                    <select 
                      value={reportFilters.soe}
                      onChange={(e) => { setReportFilters({ ...reportFilters, soe: e.target.value }); setReportPage(1); }}
                      className="w-full p-2 border border-gray-300 rounded text-xs bg-white"
                    >
                      <option value="">All SOEs</option>
                      {uniqueSoes.filter(s => {
                        if (!reportFilters.range && !reportFilters.scheme && !reportFilters.sector && !reportFilters.activity && !reportFilters.subActivity) return true;
                        return combinedReportData.some(r => {
                          const rangeMatch = !reportFilters.range || r.range === reportFilters.range;
                          const schemeMatch = !reportFilters.scheme || r.scheme === reportFilters.scheme;
                          const sectorMatch = !reportFilters.sector || r.sector === reportFilters.sector;
                          const activityMatch = !reportFilters.activity || r.activity === reportFilters.activity;
                          const subActivityMatch = !reportFilters.subActivity || r.subActivity === reportFilters.subActivity;
                          return rangeMatch && schemeMatch && sectorMatch && activityMatch && subActivityMatch && (r as any).soe.includes(s);
                        });
                      }).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  {reportSubTab === 'ledger' && (
                    <div className="lg:col-span-2">
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Search Ledger</label>
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search hierarchy, SOE, range..."
                          value={ledgerSearchTerm}
                          onChange={(e) => setLedgerSearchTerm(e.target.value)}
                          className="pl-9 pr-4 py-2 border border-gray-300 rounded text-xs bg-white w-full"
                        />
                      </div>
                    </div>
                  )}
                  <div className={`${reportSubTab === 'ledger' ? 'lg:col-span-4' : 'lg:col-span-6'} flex justify-end`}>
                    <button 
                      onClick={() => {
                        setReportFilters({ scheme: '', sector: '', activity: '', subActivity: '', range: '', soe: '' });
                        setSoeAbstractSearch('');
                        setLedgerSearchTerm('');
                        setReportPage(1);
                      }}
                      className="text-xs text-red-600 hover:text-red-800 font-medium flex items-center gap-1"
                    >
                      <X className="w-3 h-3" />
                      Reset Filters
                    </button>
                  </div>
                </div>
                  </div>
                  {sortedData.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-3 bg-emerald-50 rounded-lg border border-gray-200">
                      <div className="flex justify-between items-center px-2">
                        <span className="text-[10px] font-bold text-emerald-800 uppercase">Total Allocation:</span>
                        <span className="text-sm font-bold text-emerald-700">₹{calculateTotals(sortedData).allocated.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center px-2 border-x border-emerald-100">
                        <span className="text-[10px] font-bold text-red-800 uppercase">Total Expenditure:</span>
                        <span className="text-sm font-bold text-red-700">₹{calculateTotals(sortedData).expenditure.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center px-2">
                        <span className="text-[10px] font-bold text-blue-800 uppercase">Total Balance:</span>
                        <span className="text-sm font-bold text-blue-700">₹{calculateTotals(sortedData).remaining.toLocaleString()}</span>
                      </div>
                      <div className="px-2">
                        <div className="flex justify-between mb-1">
                          <span className="text-[10px] font-bold text-gray-600 uppercase">Usage:</span>
                          <span className="text-[10px] font-bold text-gray-700">{calculateTotals(sortedData).allocated > 0 ? `${((calculateTotals(sortedData).expenditure / calculateTotals(sortedData).allocated) * 100).toFixed(1)}%` : '0%'}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div 
                            className="bg-emerald-600 h-1.5 rounded-full" 
                            style={{ width: `${Math.min(100, calculateTotals(sortedData).allocated > 0 ? (calculateTotals(sortedData).expenditure / calculateTotals(sortedData).allocated) * 100 : 0)}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {reportSubTab === 'summary' && (
                <>
                  {/* SOE Abstract Summary Table */}
              {(userRole === 'admin' || userRole === 'deo' || userRole === 'approver' || userRole === 'Division') && (
                <div className="mb-10">
                  <div 
                    className="flex justify-between items-center mb-4 cursor-pointer hover:bg-gray-50 p-2 rounded -mx-2"
                    onClick={() => setShowSoeAbstract(!showSoeAbstract)}
                  >
                    <h4 className="text-md font-bold text-gray-800 flex items-center gap-2">
                      <Table className="w-4 h-4 text-emerald-600" /> SOE Abstract Summary
                    </h4>
                    <div className="flex items-center gap-4">
                      {showSoeAbstract && (
                        <div className="relative" onClick={(e) => e.stopPropagation()}>
                          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                          <input
                            type="text"
                            placeholder="Search abstract..."
                            value={soeAbstractSearch}
                            onChange={(e) => setSoeAbstractSearch(e.target.value)}
                            className="pl-9 pr-4 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 w-64"
                          />
                        </div>
                      )}
                      <button type="button" className="text-gray-500 hover:text-gray-700">
                        {showSoeAbstract ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                  
                  {showSoeAbstract && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse border border-gray-300">
                        <thead>
                          <tr className="bg-emerald-50 border-b border-gray-300">
                            {abstractHeaders.map(h => <th key={h} className="p-1.5 text-[9px] font-bold text-emerald-900 border border-gray-300 uppercase tracking-tight">{h}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {abstractRows.map((row, i) => (
                            <tr key={i} className="border-b border-gray-300 hover:bg-emerald-50/30 transition-colors">
                              <td className="p-1.5 text-[10px] border border-gray-300 font-medium text-gray-600">{row.hierarchy}</td>
                              <td className="p-1.5 text-[10px] border border-gray-300 font-bold text-gray-800">{row.soeName}</td>
                              <td className="p-1.5 text-[10px] border border-gray-300 text-right text-gray-700">₹{row.approvedBudget.toLocaleString()}</td>
                              <td className="p-1.5 text-[10px] border border-gray-300 text-right text-indigo-700">₹{row.receivedInTry.toLocaleString()}</td>
                              <td className="p-1.5 text-[10px] border border-gray-300 text-right text-emerald-700 font-medium">₹{row.allocated.toLocaleString()}</td>
                              <td className="p-1.5 text-[10px] border border-gray-300 text-right text-amber-700 font-medium">₹{row.toBeAllocated.toLocaleString()}</td>
                              <td className="p-1.5 text-[10px] border border-gray-300 text-right text-purple-700 font-medium">₹{row.tryBalance.toLocaleString()}</td>
                              <td 
                                className="p-1.5 text-[10px] border border-gray-300 text-right text-red-700 font-medium cursor-pointer hover:underline"
                                onClick={() => setViewingSoeExp({ soeId: row.soeId, soeName: row.soeName, hierarchy: row.hierarchy })}
                                title="Click to view expenditure details"
                              >
                                ₹{row.expenditure.toLocaleString()}
                              </td>
                              <td className={`p-1.5 text-[10px] border border-gray-300 text-right font-bold ${row.remaining < 0 ? 'text-red-600 bg-red-50' : 'text-blue-700'}`}>
                                ₹{row.remaining.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                          {abstractRows.length === 0 && (
                            <tr>
                              <td colSpan={9} className="p-4 text-center text-gray-500 border border-gray-300 text-xs">No abstract data available.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              <div className="mb-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <div 
                  className="flex items-center justify-between cursor-pointer group"
                  onClick={() => setShowDetailedReport(!showDetailedReport)}
                >
                  <h4 className="text-md font-bold text-gray-800 flex items-center gap-2">
                    <Table className="w-4 h-4 text-emerald-600" /> Detailed Range-wise Report
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 group-hover:text-gray-600 transition-colors">
                      {showDetailedReport ? 'Click to collapse' : 'Click to expand'}
                    </span>
                    <button type="button" className="p-1 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-all">
                      {showDetailedReport ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                
                {showDetailedReport && (
                  <div className="overflow-x-auto mt-4 animate-in fade-in slide-in-from-top-1 duration-200">
                    <table className="w-full text-left border-collapse border border-gray-300">
                      <thead>
                        <tr className="bg-gray-100 border-b border-gray-300">
                          {detailedHeaders.map(h => <th key={h} className="p-1.5 text-[10px] font-bold text-gray-700 border border-gray-300 uppercase tracking-tight">{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {groupedData.map((row, i) => {
                          let rowClass = "border-b border-gray-300 hover:bg-gray-50";
                          let textClass = "text-[10px]";
                          if (row.isTotal) {
                            textClass = "text-[9px] uppercase tracking-tight";
                            if (row.level === 'grand') rowClass = "bg-gray-800 text-white font-bold";
                            else if (row.level === 'scheme') rowClass = "bg-amber-50 font-bold";
                            else if (row.level === 'sector') rowClass = "bg-emerald-50 font-bold";
                            else if (row.level === 'activity') rowClass = "bg-blue-50 font-bold";
                            else if (row.level === 'subActivity') rowClass = "bg-gray-100 font-bold";
                          }

                          return (
                            <tr key={i} className={rowClass}>
                              <td className={`p-1.5 border border-gray-300 whitespace-nowrap ${textClass}`}>{row.range}</td>
                              <td className={`p-1.5 border border-gray-300 whitespace-nowrap ${textClass}`}>{row.scheme}</td>
                              <td className={`p-1.5 border border-gray-300 whitespace-nowrap ${textClass}`}>{row.sector}</td>
                              <td className={`p-1.5 border border-gray-300 whitespace-nowrap ${textClass}`}>{row.activity}</td>
                              <td className={`p-1.5 border border-gray-300 whitespace-nowrap ${textClass}`}>{row.subActivity}</td>
                              <td className={`p-1.5 font-medium border border-gray-300 whitespace-nowrap ${textClass}`}>{row.soe}</td>
                              {!userRangeId && <td className={`p-1.5 text-right border border-gray-300 whitespace-nowrap ${textClass} ${row.level === 'grand' ? 'text-white' : 'text-gray-600'}`}>₹{row.totalBudget.toLocaleString()}</td>}
                              <td className={`p-1.5 text-right font-medium border border-gray-300 whitespace-nowrap ${textClass} ${row.level === 'grand' ? 'text-white' : 'text-emerald-700'}`}>₹{row.allocated.toLocaleString()}</td>
                              <td className={`p-1.5 text-right font-medium border border-gray-300 whitespace-nowrap ${textClass} ${row.level === 'grand' ? 'text-white' : 'text-red-700'}`}>₹{row.expenditure.toLocaleString()}</td>
                              <td className={`p-1.5 text-right font-bold border border-gray-300 whitespace-nowrap ${textClass} ${row.level === 'grand' ? 'text-white' : 'text-blue-700'}`}>₹{row.remaining.toLocaleString()}</td>
                            </tr>
                          );
                        })}
                        {groupedData.length === 0 && (
                          <tr>
                            <td colSpan={detailedHeaders.length} className="p-8 text-center text-gray-500 border border-gray-300">No data available for the selected filters.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
          
          {reportSubTab === 'ledger' && renderSchemeWiseLedger()}
          {reportSubTab === 'allocation-expenditure' && renderAllocationExpenditureReport()}
          {reportSubTab === 'master-control' && (
            <>
              <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                  <p className="text-[10px] font-bold text-emerald-800 uppercase">Total Allocated</p>
                  <p className="text-lg font-bold text-emerald-700">₹{masterControlData.reduce((sum: any, r: any) => sum + r.allocated, 0).toLocaleString()}</p>
                </div>
                <div className="bg-red-50 p-3 rounded-lg border border-red-100">
                  <p className="text-[10px] font-bold text-red-800 uppercase">Total Expenditure</p>
                  <p className="text-lg font-bold text-red-700">₹{masterControlData.reduce((sum: any, r: any) => sum + r.expenditure, 0).toLocaleString()}</p>
                </div>
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                  <p className="text-[10px] font-bold text-blue-800 uppercase">Total Balance</p>
                  <p className="text-lg font-bold text-blue-700">₹{masterControlData.reduce((sum: any, r: any) => sum + r.balance, 0).toLocaleString()}</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-emerald-50 border-b border-gray-300">
                      <th className="p-1.5 text-[9px] font-bold text-emerald-900 border border-gray-300 uppercase">Range</th>
                      <th className="p-1.5 text-[9px] font-bold text-emerald-900 border border-gray-300 uppercase">Scheme</th>
                      <th className="p-1.5 text-[9px] font-bold text-emerald-900 border border-gray-300 uppercase">Sector</th>
                      <th className="p-1.5 text-[9px] font-bold text-emerald-900 border border-gray-300 uppercase">Activity</th>
                      <th className="p-1.5 text-[9px] font-bold text-emerald-900 border border-gray-300 uppercase">Sub-Activity</th>
                      <th className="p-1.5 text-[9px] font-bold text-emerald-900 border border-gray-300 uppercase">SOE</th>
                      <th className="p-1.5 text-[9px] font-bold text-emerald-900 border border-gray-300 uppercase text-right">Allocated</th>
                      <th className="p-1.5 text-[9px] font-bold text-emerald-900 border border-gray-300 uppercase text-right">Expenditure</th>
                      <th className="p-1.5 text-[9px] font-bold text-emerald-900 border border-gray-300 uppercase text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {masterControlData.map((row, i) => (
                      <tr key={i} className="border-b border-gray-300 hover:bg-emerald-50/30">
                        <td className="p-1.5 text-[10px] border border-gray-300 text-gray-600">{row.rangeName}</td>
                        <td className="p-1.5 text-[10px] border border-gray-300 text-gray-600">{row.schemeName}</td>
                        <td className="p-1.5 text-[10px] border border-gray-300 text-gray-600">{row.sectorName}</td>
                        <td className="p-1.5 text-[10px] border border-gray-300 text-gray-600">{row.activityName}</td>
                        <td className="p-1.5 text-[10px] border border-gray-300 text-gray-600">{row.subActivityName}</td>
                        <td className="p-1.5 text-[10px] border border-gray-300 font-bold text-gray-800">{row.soeName}</td>
                        <td className="p-1.5 text-[10px] border border-gray-300 text-right text-emerald-700 font-medium">₹{row.allocated.toLocaleString()}</td>
                        <td className="p-1.5 text-[10px] border border-gray-300 text-right text-red-700 font-medium">₹{row.expenditure.toLocaleString()}</td>
                        <td className="p-1.5 text-[10px] border border-gray-300 text-right text-blue-700 font-bold">₹{row.balance.toLocaleString()}</td>
                      </tr>
                    ))}
                    {masterControlData.length === 0 && (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-gray-400 italic">No budget data found for the selected filters.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  const renderSchemeWiseLedger = () => {
    if (userRole !== 'admin' && userRole !== 'deo' && userRole !== 'approver') return null;

    // Group allocations and expenditures by Hierarchy + SOE Head
    const ledgerGroups: Record<string, { hierarchy: string, soeName: string, totalAllocation: number, items: any[] }> = {};

    const filteredAllocations = currentAllocations.filter(alloc => {
      const sch = schemes.find(s => s.id === alloc.schemeId);
      const sec = sectors.find(s => s.id === alloc.sectorId);
      const act = activities.find(a => a.id === alloc.activityId);
      const sa = subActivities.find(s => s.id === alloc.subActivityId);
      const r = ranges.find(r => r.id === alloc.rangeId);
      const rangeName = r?.name === 'Rajgarh Forest Division' ? 'Division' : (r?.name || '');
      
      const matchesFilters = (
        (!reportFilters.scheme || sch?.name === reportFilters.scheme) &&
        (!reportFilters.sector || sec?.name === reportFilters.sector) &&
        (!reportFilters.activity || act?.name === reportFilters.activity) &&
        (!reportFilters.subActivity || sa?.name === reportFilters.subActivity) &&
        (!reportFilters.range || rangeName === reportFilters.range)
      );

      if (!matchesFilters) return false;

      if (ledgerSearchTerm) {
        const searchLower = ledgerSearchTerm.toLowerCase();
        const soeNames = alloc.fundedSOEs?.map(f => soes.find(s => s.id === f.soeId)?.name).filter(Boolean).join(' ') || '';
        const hierarchy = [sch?.name, sec?.name, act?.name, sa?.name].filter(Boolean).join(' > ');
        return (
          hierarchy.toLowerCase().includes(searchLower) ||
          soeNames.toLowerCase().includes(searchLower) ||
          rangeName.toLowerCase().includes(searchLower) ||
          alloc.remarks?.toLowerCase().includes(searchLower)
        );
      }

      return true;
    });

    filteredAllocations.forEach(alloc => {
      alloc.fundedSOEs?.forEach(f => {
        const soe = soes.find(s => s.id === f.soeId);
        if (!soe) return;

        let hierarchy = '';
        if (alloc.subActivityId) {
          const sa = subActivities.find(sa => sa.id === alloc.subActivityId);
          const act = activities.find(a => a.id === sa?.activityId);
          const sec = sectors.find(sec => sec.id === act?.sectorId);
          const sch = schemes.find(sc => sc.id === (sec ? sec.schemeId : act?.schemeId));
          hierarchy = [sch?.name, sec?.name, act?.name, sa?.name].filter(Boolean).join(' > ');
        } else if (alloc.activityId) {
          const act = activities.find(a => a.id === alloc.activityId);
          const sec = sectors.find(sec => sec.id === act?.sectorId);
          const sch = schemes.find(sc => sc.id === (sec ? sec.schemeId : act?.schemeId));
          hierarchy = [sch?.name, sec?.name, act?.name].filter(Boolean).join(' > ');
        }

        const key = `${hierarchy}-${soe.name}`;

        if (!ledgerGroups[key]) {
          ledgerGroups[key] = {
            hierarchy,
            soeName: soe.name,
            totalAllocation: 0,
            items: []
          };
        }

        ledgerGroups[key].totalAllocation += f.amount;
      });
    });

    // Now add expenditures
    currentExpenses.forEach(exp => {
      const alloc = filteredAllocations.find(a => a.id === exp.allocationId);
      if (!alloc) return;
      const soe = soes.find(s => s.id === exp.soeId);
      if (!soe) return;

      let hierarchy = '';
      if (alloc.subActivityId) {
        const sa = subActivities.find(sa => sa.id === alloc.subActivityId);
        const act = activities.find(a => a.id === sa?.activityId);
        const sec = sectors.find(sec => sec.id === act?.sectorId);
        const sch = schemes.find(sc => sc.id === (sec ? sec.schemeId : act?.schemeId));
        hierarchy = [sch?.name, sec?.name, act?.name, sa?.name].filter(Boolean).join(' > ');
      } else if (alloc.activityId) {
        const act = activities.find(a => a.id === alloc.activityId);
        const sec = sectors.find(sec => sec.id === act?.sectorId);
        const sch = schemes.find(sc => sc.id === (sec ? sec.schemeId : act?.schemeId));
        hierarchy = [sch?.name, sec?.name, act?.name].filter(Boolean).join(' > ');
      }

      const key = `${hierarchy}-${soe.name}`;

      if (ledgerGroups[key]) {
        ledgerGroups[key].items.push({
          date: exp.date,
          expenditure: exp.amount,
          status: exp.status || 'pending'
        });
      }
    });

    // Sort groups
    const sortedGroups = Object.values(ledgerGroups).sort((a, b) => a.hierarchy.localeCompare(b.hierarchy) || a.soeName.localeCompare(b.soeName));

    return (
      <div className="mt-10">
        <h4 className="text-md font-bold text-gray-800 mb-4 flex items-center gap-2">
          <FileText className="w-4 h-4 text-emerald-600" /> Scheme Wise Allocation and Expenditure Details
        </h4>
        <div className="space-y-8">
          {sortedGroups.map((group, gIdx) => {
            // Sort items by date
            const sortedItems = group.items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            
            let runningBalance = group.totalAllocation;
            let totalExp = 0;

            return (
              <div key={gIdx} className="border border-gray-300 rounded-lg overflow-hidden">
                <div className="bg-gray-100 p-3 border-b border-gray-300 flex justify-between items-center">
                  <div className="font-bold text-gray-800">
                    <span className="text-emerald-700">{group.soeName}</span> <span className="text-gray-500 font-normal text-sm">[{group.hierarchy}]</span>
                  </div>
                  <div className="font-bold text-blue-700">
                    Total Allocation: ₹{group.totalAllocation.toLocaleString()}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-gray-600">
                        <th className="p-2 border-r border-gray-200">S.No</th>
                        <th className="p-2 border-r border-gray-200">Date</th>
                        <th className="p-2 border-r border-gray-200 text-right">Allocation</th>
                        <th className="p-2 border-r border-gray-200 text-right">Expenditure</th>
                        <th className="p-2 border-r border-gray-200 text-center">Status</th>
                        <th className="p-2 text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Row 1: Initialization */}
                      <tr className="border-b border-gray-200">
                        <td className="p-2 border-r border-gray-200 text-center">1</td>
                        <td className="p-2 border-r border-gray-200 text-gray-500 italic">Allocation Date</td>
                        <td className="p-2 border-r border-gray-200 text-right font-medium text-emerald-600">₹{group.totalAllocation.toLocaleString()}</td>
                        <td className="p-2 border-r border-gray-200 text-right text-gray-400">-</td>
                        <td className="p-2 border-r border-gray-200 text-center text-gray-400">-</td>
                        <td className="p-2 text-right font-bold text-blue-600">₹{runningBalance.toLocaleString()}</td>
                      </tr>
                      {/* Row 2+: Expenditures */}
                      {sortedItems.map((item, i) => {
                        const isRejected = item.status === 'rejected';
                        if (!isRejected) {
                          runningBalance -= item.expenditure;
                          totalExp += item.expenditure;
                        }
                        return (
                          <tr key={i} className={`border-b border-gray-200 hover:bg-gray-50 ${isRejected ? 'opacity-50 grayscale' : ''}`}>
                            <td className="p-2 border-r border-gray-200 text-center">{i + 2}</td>
                            <td className="p-2 border-r border-gray-200">{item.date ? item.date.split('-').reverse().join('/') : ''}</td>
                            <td className="p-2 border-r border-gray-200 text-right text-gray-400">-</td>
                            <td className="p-2 border-r border-gray-200 text-right font-medium text-red-600">₹{item.expenditure.toLocaleString()}</td>
                            <td className="p-2 border-r border-gray-200 text-center">
                              <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full ${
                                item.status === 'approved' ? 'bg-green-100 text-green-800' : 
                                item.status === 'rejected' ? 'bg-red-100 text-red-800' : 
                                'bg-yellow-100 text-yellow-800'
                              }`}>
                                {item.status}
                              </span>
                            </td>
                            <td className="p-2 text-right font-bold text-blue-600">₹{runningBalance.toLocaleString()}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                        <td colSpan={2} className="p-2 border-r border-gray-200 text-right">Total</td>
                        <td className="p-2 border-r border-gray-200 text-right text-emerald-700">₹{group.totalAllocation.toLocaleString()}</td>
                        <td className="p-2 border-r border-gray-200 text-right text-red-700">₹{totalExp.toLocaleString()}</td>
                        <td className="p-2 border-r border-gray-200 text-center text-gray-400">-</td>
                        <td className="p-2 text-right text-blue-700">₹{runningBalance.toLocaleString()}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            );
          })}
          {sortedGroups.length === 0 && (
            <div className="p-8 text-center text-gray-500 border border-gray-300 rounded-lg bg-gray-50">No allocation data available for ledger.</div>
          )}
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
      <div className="max-w-7xl mx-auto space-y-6 overflow-visible">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-3 md:p-4 rounded-xl shadow-sm border border-gray-200">
          <div 
            className="flex items-center gap-2 md:gap-3 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => {
              setActiveTab('Dashboard');
              setSearchTerm('');
              setEditingItem(null);
              setIsFormExpanded(window.innerWidth > 1024);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            <img src="/logo.png" alt="Forest Budget Logo" className="h-8 md:h-10 w-auto object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }} />
            <Landmark className="h-8 md:h-10 w-8 md:w-10 text-emerald-600 hidden" />
            <div>
              <h1 className="text-lg md:text-2xl font-bold text-gray-900 leading-tight">Forest Budget Control</h1>
              <p className="text-[10px] md:text-sm text-gray-500">Financial Management System</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 md:gap-3 justify-between md:justify-end">
            <div className="flex items-center gap-1.5 bg-emerald-50 px-2 md:px-3 py-1.5 md:py-2 rounded-lg border border-emerald-100">
              <span className="text-xs md:text-sm font-semibold text-emerald-800">FY:</span>
              <select 
                value={selectedFY} 
                onChange={(e) => setSelectedFY(e.target.value)}
                className="bg-transparent border-none focus:ring-0 text-emerald-700 font-bold cursor-pointer text-xs md:text-sm"
              >
                {fys.map(fy => <option key={fy.id} value={fy.id}>{fy.name}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
                {activeTab !== 'Dashboard' && (
                  <div className="relative flex-1 md:flex-none">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-xs md:text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 w-full md:w-48 lg:w-64 bg-white shadow-sm"
                    />
                  </div>
                )}
              {userRole === 'admin' && currentSchemes.length === 0 && (
                <button
                  onClick={async () => {
                    await preloadDatabase(selectedFY);
                    showAlert('Preloaded data added successfully!');
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
              <div className="flex items-center gap-2 bg-gray-50 px-2 md:px-3 py-1.5 rounded-lg border border-gray-200">
                <div className="flex items-center gap-1.5 md:gap-2">
                  <div className="bg-emerald-100 p-1 md:p-1.5 rounded-full">
                    <User className="w-3 h-3 md:w-4 md:h-4 text-emerald-600" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs md:text-sm font-bold text-gray-800 leading-none truncate max-w-[80px] md:max-w-none">{user.displayName || user.email?.split('@')[0]}</span>
                    <span className="text-[8px] md:text-[10px] font-medium text-gray-500 uppercase tracking-wider">{userRole}</span>
                  </div>
                </div>
                <div className="w-px h-5 md:h-6 bg-gray-300 mx-0.5 md:mx-1"></div>
                <button 
                  onClick={handleLogout}
                  className="flex items-center gap-1 text-gray-500 hover:text-red-600 transition-colors text-xs md:text-sm font-medium"
                  title="Logout"
                >
                  <LogOut className="w-3.5 h-3.5 md:w-4 md:h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="bg-gray-800 rounded-lg shadow-sm mb-6 sticky top-0 z-50 overflow-visible">
          <div className="lg:hidden flex items-center justify-between p-4 border-b border-gray-700">
            <span className="text-white font-medium">Menu: {activeTab}</span>
            <button 
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-2 text-gray-400 hover:text-white transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>
          
          <div className={`${menuOpen ? 'grid' : 'hidden'} lg:flex grid-cols-2 sm:grid-cols-3 lg:flex-row flex-wrap gap-1 p-2 overflow-visible`}>
            {menuItems.map((item) => {
              if (!item.children) {
                return (
                  <button 
                    key={item.name} 
                    id={`tab-${item.name}`}
                    onClick={() => {
                      setActiveTab(item.name);
                      setSearchTerm('');
                      setEditingItem(null);
                      setMenuOpen(false);
                      setIsFormExpanded(window.innerWidth > 1024);
                      setCurrentPage(1);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className={`px-3 py-2 text-xs sm:text-sm font-medium rounded transition-all text-left lg:text-center flex items-center gap-2 ${activeTab === item.name ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}
                  >
                    {item.icon}
                    <span className="truncate">{item.name}</span>
                  </button>
                );
              } else {
                const isActive = item.children.some(child => child.name === activeTab);
                const isOpen = openDropdown === item.name;
                return (
                  <div 
                    key={item.name}
                    className={`relative group ${isOpen ? 'z-[60]' : 'z-10'} hover:z-[60]`}
                    onMouseEnter={() => setOpenDropdown(item.name)}
                    onMouseLeave={() => setOpenDropdown(null)}
                  >
                    <button 
                      onClick={() => setOpenDropdown(isOpen ? null : item.name)}
                      className={`px-3 py-2 text-xs sm:text-sm font-medium rounded transition-all text-left lg:text-center flex items-center gap-2 w-full ${isActive ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}
                    >
                      {item.icon}
                      <span className="truncate">{item.name}</span>
                      <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                    
                    <div className={`absolute top-full left-0 bg-gray-800 border border-gray-700 rounded shadow-xl min-w-[180px] z-[100] ${isOpen ? 'block' : 'hidden'} group-hover:block`}>
                      {item.children.map(child => (
                        <button
                          key={child.name}
                          onClick={() => {
                            setActiveTab(child.name);
                            setSearchTerm('');
                            setEditingItem(null);
                            setMenuOpen(false);
                            setOpenDropdown(null);
                            setIsFormExpanded(window.innerWidth > 1024);
                            setCurrentPage(1);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className={`w-full px-4 py-2.5 text-xs sm:text-sm font-medium text-left flex items-center gap-2 hover:bg-gray-700 transition-colors ${activeTab === child.name ? 'text-emerald-400 bg-gray-700/50' : 'text-gray-300'}`}
                        >
                          {child.icon}
                          {child.name}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              }
            })}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'Dashboard' && renderDashboard()}
        
        {/* Scroll to Top Button */}
        {showScrollTop && (
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="fixed bottom-8 right-8 bg-emerald-600 text-white p-3 rounded-full shadow-lg hover:bg-emerald-700 transition-all z-[60] animate-in fade-in zoom-in"
            title="Scroll to Top"
          >
            <ChevronUp className="w-6 h-6" />
          </button>
        )}
        
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
          [{key: 'name', label: 'Range Name', render: (val) => val === 'Rajgarh Forest Division' ? 'Division' : val}], 
          handleAddRange, 
          (id) => handleDelete('ranges', id), 
          <input name="name" required defaultValue={editingItem?.type === 'Range' ? editingItem.item.name : ''} placeholder="Range Name" className="w-full p-1.5 border rounded text-sm" />,
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
            <input name="name" required defaultValue={editingItem?.type === 'Scheme' ? editingItem.item.name : ''} placeholder="Scheme Name" className="w-full p-1.5 border rounded text-sm" />
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
              <select name="schemeId" required defaultValue={editingItem?.type === 'Sector' ? editingItem.item.schemeId : ''} className="w-full p-1.5 border rounded text-sm">
                <option value="">Select Scheme</option>
                {currentSchemes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <button type="button" onClick={() => document.getElementById('tab-Schemes')?.click()} className="px-2 bg-gray-100 border rounded hover:bg-gray-200 text-gray-600 text-sm" title="Add Scheme">+</button>
            </div>
            <input name="name" required defaultValue={editingItem?.type === 'Sector' ? editingItem.item.name : ''} placeholder="Sector Name (e.g. CA, NPV)" className="w-full p-1.5 border rounded text-sm" />
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
          (item) => setEditingItem({ type: 'Activity', item }),
          (item) => userRole === 'admin' || userRole === 'deo' || user?.email?.toLowerCase() === 'admin@rajgarhforest.app' || user?.email?.toLowerCase() === 'sharmaanuj860@gmail.com'
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
            schemes={currentSchemes} sectors={currentSectors} activities={currentActivities} subActivities={currentSubActivities} soes={currentSoes} soeBudgets={[]} allocations={baseAllocations} ranges={ranges} expenses={currentExpenses}
            editingItem={editingItem} type="Sub-Activity" userRangeId={userRangeId}
          >
            <input name="name" required defaultValue={editingItem?.type === 'Sub-Activity' ? editingItem.item.name : ''} placeholder="Sub-Activity Name" className="w-full p-1.5 border rounded text-sm" />
          </CascadingDropdowns>,
          (item) => setEditingItem({ type: 'Sub-Activity', item }),
          (item) => userRole === 'admin' || userRole === 'deo' || user?.email?.toLowerCase() === 'admin@rajgarhforest.app' || user?.email?.toLowerCase() === 'sharmaanuj860@gmail.com'
        )}

        {activeTab === 'SOE Heads' && renderSOEHeads()}
        {activeTab === 'Allocations' && (
          <div className="space-y-6">
            {!userRangeId && renderBudgetTracker()}
            {renderSimpleManager(
              'Allocation', 
              currentAllocations, 
              [
                {key: 'hierarchy', label: 'Hierarchy / Unit', render: (_, item) => {
                  const r = ranges.find(r => r.id === item.rangeId);
                  const hText = getHierarchyText(item);
                  return (
                    <div className="max-w-[180px]">
                      <div className="font-bold text-gray-900 truncate leading-tight">{r?.name === 'Rajgarh Forest Division' ? 'Division' : r?.name}</div>
                      <div className="text-[9px] text-gray-500 truncate" title={hText}>{hText}</div>
                    </div>
                  );
                }, searchableText: (_, item) => getHierarchyText(item)},
                {key: 'rangeId', label: 'Range', render: (val) => ranges.find(r => r.id === val)?.name, searchableText: (val) => ranges.find(r => r.id === val)?.name || ''},
                {key: 'amount', label: 'Sanctioned Amount', render: (val, item) => (
                  <div className="flex flex-col min-w-[80px]">
                    <span className="font-bold text-gray-900">₹{val.toLocaleString()}</span>
                    <div className="mt-1 space-y-0.5 border-t pt-1">
                      {item.fundedSOEs && item.fundedSOEs.length > 0 ? (
                        item.fundedSOEs.map((f: any, idx: number) => {
                          const s = soes.find(soe => soe.id === f.soeId);
                          return (
                            <div key={idx} className="text-[8px] text-gray-400 flex justify-between gap-1 leading-none">
                              <span className="truncate max-w-[40px]">{s?.name || 'Unnamed'}:</span>
                              <span>₹{f.amount.toLocaleString()}</span>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-[8px] text-orange-400 italic">No SOE funding</div>
                      )}
                    </div>
                  </div>
                )},
                {
                  key: 'expenditure', 
                  label: 'Expenditure', 
                  render: (_, item) => {
                    // Row-specific expenditure (only expenses linked to this specific allocation ID)
                    const expenditure = baseExpenses
                      .filter(e => e.allocationId === item.id && e.status !== 'rejected')
                      .reduce((sum, e) => sum + e.amount, 0);
                    return <span className="font-medium text-red-600">₹{expenditure.toLocaleString()}</span>;
                  }
                },
                {
                  key: 'balance', 
                  label: 'Total Balance', 
                  render: (_, item) => {
                    const expenditure = baseExpenses
                      .filter(e => e.allocationId === item.id && e.status !== 'rejected')
                      .reduce((sum, e) => sum + e.amount, 0);
                    const balance = item.amount - expenditure;
                    return (
                      <div className="flex flex-col">
                        <span className={`font-bold ${balance < 0 ? 'text-red-700' : 'text-blue-700'}`}>₹{balance.toLocaleString()}</span>
                        <span className="text-[8px] text-gray-400 uppercase leading-none">Row Balance</span>
                      </div>
                    );
                  }
                },
                {key: 'remarks', label: 'Description / Remarks', render: (val) => <div className="text-[10px] italic text-gray-500 max-w-[150px] whitespace-normal break-words" title={val}>{val || '-'}</div>},
                {key: 'status', label: 'Funding Status', render: (val, item) => (
                  <div className="flex flex-col">
                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full w-fit ${val === 'Funded' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>
                      {val}
                    </span>
                    <div className="mt-1 space-y-1">
                      {item.fundedSOEs && item.fundedSOEs.length > 0 ? (
                        item.fundedSOEs.map((f: any, idx: number) => {
                          const s = soes.find(soe => soe.id === f.soeId);
                          return (
                            <div key={idx} className="text-[10px] text-gray-500 flex justify-between gap-2">
                              <span>{s?.name || 'Unnamed SOE'}:</span>
                              <span className="font-medium">₹{f.amount.toLocaleString()}</span>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-[10px] text-orange-400 italic">Pending funding assignment</div>
                      )}
                    </div>
                  </div>
                )},
                {key: 'actions', label: 'Funding', render: (_, item) => (
                  userRole === 'admin' && item.status === 'Pending SOE Funds' && (
                    <button
                      onClick={() => setFundingAllocation(item)}
                      className="bg-emerald-600 text-white px-3 py-1 rounded text-xs hover:bg-emerald-700 transition-colors"
                    >
                      Assign SOE Funds
                    </button>
                  )
                )}
              ], 
              handleAddAllocation, 
              (id) => handleDelete('allocations', id), 
              <div className="space-y-4">
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg flex flex-wrap gap-4 items-center justify-between">
                  <div>
                    <h4 className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">Sector Budget Status</h4>
                    <div className="flex gap-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-blue-900">₹{allocationBudgetStatus.availableBudget.toLocaleString()}</span>
                        <span className="text-[9px] text-blue-500 uppercase">Total Available</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-blue-900">₹{allocationBudgetStatus.currentAllocated.toLocaleString()}</span>
                        <span className="text-[9px] text-blue-500 uppercase">Already Allocated</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-blue-900">₹{allocationBudgetStatus.remaining.toLocaleString()}</span>
                        <span className="text-[9px] text-blue-500 uppercase">Remaining to Allocate</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-[10px] text-blue-400 italic max-w-[200px] leading-tight">
                    * Surrendered budgets are automatically returned to the sector-wide pool and become available for reallocation.
                  </div>
                </div>

                <CascadingDropdowns 
                  schemes={currentSchemes} sectors={currentSectors} activities={currentActivities} subActivities={currentSubActivities} soes={currentSoes} soeBudgets={[]} allocations={baseAllocations} ranges={ranges} expenses={currentExpenses}
                  editingItem={editingItem} type="Allocation" userRangeId={userRangeId}
                  onSelectionChange={setAllocationFormFilters}
                >
                  <input 
                    name="amount" 
                    type="number" 
                    required 
                    value={allocationAmount}
                    onChange={(e) => setAllocationAmount(e.target.value)}
                    placeholder="Amount (₹)" 
                    className={`w-full p-1.5 border rounded text-sm ${isAllocationInvalid ? 'border-red-500 bg-red-50' : ''}`} 
                  />
                  <div className="flex justify-between items-center px-1">
                    <span className="text-[10px] text-gray-500 font-medium">
                      Remaining Budget: ₹{allocationBudgetStatus.remaining.toLocaleString()}
                    </span>
                    {isAllocationInvalid && (
                      <span className="text-[10px] text-red-600 font-bold animate-pulse">
                        {allocationBudgetStatus.error || 'Amount exceeds available budget!'}
                      </span>
                    )}
                  </div>
                  <textarea name="remarks" defaultValue={editingItem?.type === 'Allocation' ? editingItem.item.remarks : ''} placeholder="Remarks / Description (Optional)" className="w-full p-1.5 border rounded text-sm" rows={2} />
                </CascadingDropdowns>
              </div>,
              (item) => setEditingItem({ type: 'Allocation', item }),
              (item) => userRole === 'admin' || userRole === 'deo',
              null,
              null,
              isAllocationInvalid,
              isAllocFilterExpanded,
              setIsAllocFilterExpanded,
              <>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Scheme</label>
                  <select 
                    value={allocFilters.schemeId}
                    onChange={(e) => { setAllocFilters({ ...allocFilters, schemeId: e.target.value, sectorId: '', activityId: '', subActivityId: '', soeId: '' }); setCurrentPage(1); }}
                    className="w-full p-1.5 border border-gray-300 rounded text-xs bg-white"
                  >
                    <option value="">All Schemes</option>
                    {schemes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Sector</label>
                  <select 
                    value={allocFilters.sectorId}
                    onChange={(e) => { setAllocFilters({ ...allocFilters, sectorId: e.target.value, activityId: '', subActivityId: '', soeId: '' }); setCurrentPage(1); }}
                    className="w-full p-1.5 border border-gray-300 rounded text-xs bg-white"
                  >
                    <option value="">All Sectors</option>
                    {sectors.filter(s => !allocFilters.schemeId || s.schemeId === allocFilters.schemeId).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Activity</label>
                  <select 
                    value={allocFilters.activityId}
                    onChange={(e) => { setAllocFilters({ ...allocFilters, activityId: e.target.value, subActivityId: '', soeId: '' }); setCurrentPage(1); }}
                    className="w-full p-1.5 border border-gray-300 rounded text-xs bg-white"
                  >
                    <option value="">All Activities</option>
                    {activities.filter(a => {
                      if (allocFilters.sectorId) return a.sectorId === allocFilters.sectorId;
                      if (allocFilters.schemeId) return a.schemeId === allocFilters.schemeId || sectors.find(s => s.id === a.sectorId)?.schemeId === allocFilters.schemeId;
                      return true;
                    }).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Sub-Activity</label>
                  <select 
                    value={allocFilters.subActivityId}
                    onChange={(e) => { setAllocFilters({ ...allocFilters, subActivityId: e.target.value, soeId: '' }); setCurrentPage(1); }}
                    className="w-full p-1.5 border border-gray-300 rounded text-xs bg-white"
                  >
                    <option value="">All Sub-Activities</option>
                    {subActivities.filter(sa => !allocFilters.activityId || sa.activityId === allocFilters.activityId).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Range</label>
                  <select 
                    value={allocFilters.rangeId}
                    onChange={(e) => { setAllocFilters({ ...allocFilters, rangeId: e.target.value }); setCurrentPage(1); }}
                    className="w-full p-1.5 border border-gray-300 rounded text-xs bg-white"
                  >
                    <option value="">All Ranges</option>
                    {ranges.map(s => <option key={s.id} value={s.id}>{s.name === 'Rajgarh Forest Division' ? 'Division' : s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">SOE Head</label>
                  <select 
                    value={allocFilters.soeId}
                    onChange={(e) => { setAllocFilters({ ...allocFilters, soeId: e.target.value }); setCurrentPage(1); }}
                    className="w-full p-1.5 border border-gray-300 rounded text-xs bg-white"
                  >
                    <option value="">All SOEs</option>
                    {soes.filter(s => {
                      if (allocFilters.subActivityId) return s.subActivityId === allocFilters.subActivityId;
                      if (allocFilters.activityId) return s.activityId === allocFilters.activityId;
                      if (allocFilters.sectorId) return s.sectorId === allocFilters.sectorId;
                      if (allocFilters.schemeId) return s.schemeId === allocFilters.schemeId;
                      return true;
                    }).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </>,
              () => {
                setAllocFilters({ schemeId: '', sectorId: '', activityId: '', subActivityId: '', rangeId: '', soeId: '' });
                setSearchTerm('');
              }
            )}
          </div>
        )}

        {activeTab === 'Expenditures' && (
          <div className="space-y-4">
            <div className="flex gap-4 mb-2 border-b pb-2">
              <button 
                onClick={() => setExpenditureSubTab('list')}
                className={`pb-2 px-4 text-sm font-medium transition-colors relative ${expenditureSubTab === 'list' ? 'text-emerald-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Expenditure List
                {expenditureSubTab === 'list' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500" />}
              </button>
              {(userRole === 'admin' || userRole === 'deo') && (
                <button 
                  onClick={() => setExpenditureSubTab('bills')}
                  className={`pb-2 px-4 text-sm font-medium transition-colors relative ${expenditureSubTab === 'bills' ? 'text-emerald-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Bill Creation
                  {expenditureSubTab === 'bills' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500" />}
                </button>
              )}
              {(userRole === 'admin' || userRole === 'deo') && (
                <button 
                  onClick={() => setExpenditureSubTab('payees')}
                  className={`pb-2 px-4 text-sm font-medium transition-colors relative ${expenditureSubTab === 'payees' ? 'text-emerald-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Add Payee
                  {expenditureSubTab === 'payees' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500" />}
                </button>
              )}
            </div>

            {expenditureSubTab === 'list' && (
              renderSimpleManager(
                'Expenditure', 
                currentExpenses, 
                [
                  {key: 'date', label: 'Date', render: (val) => val ? val.split('-').reverse().join('/') : ''},
                  {key: 'payeeId', label: 'Payee', 
                    searchableText: (val, item) => payees.find(p => p.id === val)?.name || item.payeeName || 'N/A',
                    render: (val, item) => {
                      const p = payees.find(p => p.id === val);
                      if (p) {
                        return (
                          <div>
                            <div className="font-medium text-emerald-700">{p.name}</div>
                            <div className="text-[10px] text-gray-400">{p.accountNumber}</div>
                          </div>
                        );
                      }
                      if (item.payeeName) {
                        return <div className="font-medium text-blue-700">{item.payeeName}</div>;
                      }
                      return <span className="text-gray-400 italic">No Payee</span>;
                    }
                  },
                  {key: 'allocationId', label: 'Unit / Hierarchy / SOE', 
                    searchableText: (val, item) => {
                      const al = allocations.find(a => a.id === val);
                      const r = ranges.find(r => r.id === al?.rangeId);
                      const s = soes.find(s => s.id === item.soeId);
                      const hierarchy = al ? getHierarchyText(al) : 'N/A';
                      return `${hierarchy} ${r?.name} ${s?.name}`;
                    },
                    render: (val, item) => {
                      const al = allocations.find(a => a.id === val);
                      const r = ranges.find(r => r.id === al?.rangeId);
                      const s = soes.find(s => s.id === item.soeId);
                      const hierarchy = al ? getHierarchyText(al) : 'N/A';
                      return (
                        <div className="max-w-[180px]">
                          <div className="font-bold text-gray-900 truncate leading-tight">{r?.name === 'Rajgarh Forest Division' ? 'Division' : r?.name} / {s?.name || 'N/A'}</div>
                          <div className="text-[9px] text-gray-500 truncate" title={hierarchy}>{hierarchy}</div>
                        </div>
                      );
                    }
                  },
                  {key: 'description', label: 'Description', render: (val, item) => (
                    <div className="max-w-[200px] whitespace-normal break-words">
                      <div className="text-xs italic text-gray-500">{val}</div>
                      {item.approvalReason && (
                        <div className="text-[10px] text-gray-400 italic mt-1 border-t pt-1">
                          Action Reason: {item.approvalReason}
                        </div>
                      )}
                    </div>
                  )},
                  {key: 'status', label: 'Status', render: (val) => {
                    const colors = {
                      pending: 'bg-yellow-100 text-yellow-800',
                      approved: 'bg-green-100 text-green-800',
                      rejected: 'bg-red-100 text-red-800'
                    };
                    return (
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${colors[val as keyof typeof colors] || 'bg-gray-100'}`}>
                        {val || 'pending'}
                      </span>
                    );
                  }},
                  {key: 'approvalId', label: 'Approval ID', render: (val) => val ? `#${val}` : '-'},
                  {key: 'isBilled', label: 'Billed', 
                    searchableText: (_, item) => {
                      const bill = bills.find(b => b.expenseIds.includes(item.id));
                      return bill ? `Yes ${bill.billNo}` : 'No';
                    },
                    render: (_, item) => {
                      const bill = bills.find(b => b.expenseIds.includes(item.id));
                      return (
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${bill ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                          {bill ? `Yes (${bill.billNo})` : 'No'}
                        </span>
                      );
                    }
                  },
                  {key: 'amount', label: 'Amount', searchableText: (val) => String(val), render: (val) => <span className="text-red-600 font-bold">₹{val.toLocaleString()}</span>},
                  {key: 'balance', label: 'Balance', 
                    searchableText: (_, item) => {
                      const alloc = allocations.find(a => a.id === item.allocationId);
                      if (!alloc) return 'N/A';
                      
                      const soeName = soes.find(s => s.id === item.soeId)?.name;
                      if (!soeName) return 'N/A';

                      // Aggregate allocation for this hierarchy and SOE Name
                      const totalAllocatedForSoe = baseAllocations.filter(a => 
                        a.rangeId === alloc.rangeId &&
                        a.schemeId === alloc.schemeId &&
                        (a.sectorId || null) === (alloc.sectorId || null) &&
                        (a.activityId || null) === (alloc.activityId || null) &&
                        (a.subActivityId || null) === (alloc.subActivityId || null)
                      ).reduce((sum, a) => {
                        const funded = a.fundedSOEs?.find((f: any) => soes.find(s => s.id === f.soeId)?.name === soeName);
                        return sum + (funded?.amount || 0);
                      }, 0);

                      // Aggregate expenditure for this hierarchy and SOE Name
                      const totalSpentForSoe = baseExpenses.filter(e => {
                        const eAlloc = allocations.find(a => a.id === e.allocationId);
                        const eSoeName = soes.find(s => s.id === e.soeId)?.name;
                        return (
                          eAlloc &&
                          eAlloc.rangeId === alloc.rangeId &&
                          eAlloc.schemeId === alloc.schemeId &&
                          (eAlloc.sectorId || null) === (alloc.sectorId || null) &&
                          (eAlloc.activityId || null) === (alloc.activityId || null) &&
                          (eAlloc.subActivityId || null) === (alloc.subActivityId || null) &&
                          eSoeName === soeName &&
                          e.status !== 'rejected'
                        );
                      }).reduce((sum, e) => sum + e.amount, 0);

                      return String(totalAllocatedForSoe - totalSpentForSoe);
                    },
                    render: (_, item) => {
                      const alloc = allocations.find(a => a.id === item.allocationId);
                      if (!alloc) return 'N/A';
                      
                      const soeName = soes.find(s => s.id === item.soeId)?.name;
                      if (!soeName) return 'N/A';

                      // Aggregate allocation for this hierarchy and SOE Name
                      const totalAllocatedForSoe = baseAllocations.filter(a => 
                        a.rangeId === alloc.rangeId &&
                        a.schemeId === alloc.schemeId &&
                        (a.sectorId || null) === (alloc.sectorId || null) &&
                        (a.activityId || null) === (alloc.activityId || null) &&
                        (a.subActivityId || null) === (alloc.subActivityId || null)
                      ).reduce((sum, a) => {
                        const funded = a.fundedSOEs?.find((f: any) => soes.find(s => s.id === f.soeId)?.name === soeName);
                        return sum + (funded?.amount || 0);
                      }, 0);

                      // Aggregate expenditure for this hierarchy and SOE Name
                      const totalSpentForSoe = baseExpenses.filter(e => {
                        const eAlloc = allocations.find(a => a.id === e.allocationId);
                        const eSoeName = soes.find(s => s.id === e.soeId)?.name;
                        return (
                          eAlloc &&
                          eAlloc.rangeId === alloc.rangeId &&
                          eAlloc.schemeId === alloc.schemeId &&
                          (eAlloc.sectorId || null) === (alloc.sectorId || null) &&
                          (eAlloc.activityId || null) === (alloc.activityId || null) &&
                          (eAlloc.subActivityId || null) === (alloc.subActivityId || null) &&
                          eSoeName === soeName &&
                          e.status !== 'rejected'
                        );
                      }).reduce((sum, e) => sum + e.amount, 0);

                      const balance = totalAllocatedForSoe - totalSpentForSoe;
                      return <span className={`font-bold ${balance < 0 ? 'text-red-700' : 'text-blue-700'}`}>₹{balance.toLocaleString()}</span>;
                    }
                  }
                ], 
                handleAddExpense, 
                (id) => handleDelete('expenditures', id), 
                <CascadingDropdowns 
                  schemes={currentSchemes} sectors={currentSectors} activities={currentActivities} subActivities={currentSubActivities} soes={currentSoes} soeBudgets={[]} allocations={baseAllocations} ranges={ranges} expenses={currentExpenses}
                  editingItem={editingItem} type="Expenditure" userRangeId={userRangeId}
                  onBalanceChange={setCurrentSoeBalance}
                >
                  {editingItem?.type === 'Expenditure' ? (
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-gray-500 uppercase">Payee</label>
                        <select name="payeeId" defaultValue={editingItem.item.payeeId || ''} className="w-full p-2 border rounded text-sm">
                          <option value="">Select Payee (Optional)</option>
                          {payees.map(p => <option key={p.id} value={p.id}>{p.name} ({p.accountNumber})</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-gray-500 uppercase">Manual Payee Name</label>
                        <input name="payeeName" type="text" defaultValue={editingItem.item.payeeName || ''} placeholder="Enter name if no payee selected" className="w-full p-2 border rounded text-sm" />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <PayeeSelector 
                        payees={payees}
                        selectedPayees={selectedPayeesForExpense}
                        onSelect={(payeeId) => setSelectedPayeesForExpense([...selectedPayeesForExpense, { payeeId, amount: '' }])}
                        onRemove={(payeeId) => setSelectedPayeesForExpense(selectedPayeesForExpense.filter(p => p.payeeId !== payeeId))}
                        onAmountChange={(payeeId, amount) => setSelectedPayeesForExpense(selectedPayeesForExpense.map(p => p.payeeId === payeeId ? { ...p, amount } : p))}
                        ranges={ranges}
                        availableBalance={currentSoeBalance}
                      />
                      {selectedPayeesForExpense.length === 0 && (
                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold text-gray-500 uppercase">Manual Payee Name</label>
                          <input name="payeeName" type="text" placeholder="Enter name if no payee selected" className="w-full p-2 border rounded text-sm" />
                        </div>
                      )}
                    </div>
                  )}
                  {selectedPayeesForExpense.length === 0 && (
                    <input name="amount" type="number" required={editingItem?.type === 'Expenditure'} defaultValue={editingItem?.type === 'Expenditure' ? editingItem.item.amount : ''} placeholder="Amount (₹)" className="w-full p-2 border rounded" />
                  )}
                  <input name="date" type="date" max={new Date().toISOString().split('T')[0]} required defaultValue={editingItem?.type === 'Expenditure' ? editingItem.item.date : new Date().toISOString().split('T')[0]} className="w-full p-2 border rounded" />
                  <textarea name="description" required defaultValue={editingItem?.type === 'Expenditure' ? editingItem.item.description : ''} placeholder="Description / Remarks" className="w-full p-2 border rounded" rows={2} />
                </CascadingDropdowns>,
                (item) => setEditingItem({ type: 'Expenditure', item }),
                (item) => {
                  if (item.isLocked && userRole !== 'admin') return false;
                  if (userRole === 'approver' || userRole === 'DA') {
                    // Approvers/DAs can only edit if it's pending and they have range access
                    if (item.status !== 'pending') return false;
                    if (userRangeId) {
                      const alloc = allocations.find(a => a.id === item.allocationId);
                      return alloc?.rangeId === userRangeId;
                    }
                    return item.createdBy === user?.uid;
                  }
                  if (userRole === 'admin' || userRole === 'deo') return true;
                  if (userRangeId) {
                    const alloc = allocations.find(a => a.id === item.allocationId);
                    return alloc?.rangeId === userRangeId;
                  }
                  return item.createdBy === user?.uid;
                },
                (userRole === 'admin' || userRole === 'DA' || userRole === 'approver') && (
                  <div className="flex justify-end mb-2">
                    <button
                      onClick={handleResetUnbilledExpenses}
                      className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 text-orange-700 border border-orange-200 rounded-lg text-xs font-bold hover:bg-orange-100 transition-colors shadow-sm"
                      title="Reset all approved expenditures that are not part of any bill back to pending status"
                    >
                      <RefreshCcw className="w-3.5 h-3.5" />
                      RESET UNBILLED APPROVED TO PENDING
                    </button>
                  </div>
                ),
                (item) => (
                  <div className="flex gap-1">
                    {item.status === 'pending' && (userRole === 'approver' || userRole === 'admin' || userRole === 'DA') && (
                      <button 
                        onClick={() => {
                          setSelectedExpenseForApproval(item);
                          setApprovalStatus('approved');
                          setIsApprovalModalOpen(true);
                        }}
                        className="text-blue-600 hover:text-blue-800 p-1 border border-blue-100 rounded bg-blue-50"
                        title="Take Action"
                      >
                        <ShieldCheck className="w-4 h-4" />
                      </button>
                    )}
                    {item.isLocked && (userRole === 'admin' || ((userRole === 'DA' || userRole === 'approver') && item.status === 'approved' && !bills.some(b => b.expenseIds.includes(item.id)))) && (
                      <button 
                        onClick={() => {
                          const isBilled = bills.some(b => b.expenseIds.includes(item.id));
                          if (isBilled) {
                            showAlert("This expenditure is already part of a bill and cannot be reset.");
                            return;
                          }
                          showConfirm("Reset this approved expenditure to pending?", () => handleUpdateExpenseStatus(item.id, 'pending', false));
                        }}
                        className="text-orange-600 hover:text-orange-800 p-1 border border-orange-100 rounded bg-orange-50"
                        title="Reset to Pending"
                      >
                        <RefreshCcw className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ),
                currentSoeBalance === undefined,
                isExpFilterExpanded,
                setIsExpFilterExpanded,
                <>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Scheme</label>
                    <select 
                      value={expFilters.schemeId}
                      onChange={(e) => setExpFilters({ ...expFilters, schemeId: e.target.value, sectorId: '', activityId: '', subActivityId: '' })}
                      className="w-full p-1.5 border border-gray-300 rounded text-xs bg-white"
                    >
                      <option value="">All Schemes</option>
                      {schemes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Sector</label>
                    <select 
                      value={expFilters.sectorId}
                      onChange={(e) => setExpFilters({ ...expFilters, sectorId: e.target.value, activityId: '', subActivityId: '' })}
                      className="w-full p-1.5 border border-gray-300 rounded text-xs bg-white"
                    >
                      <option value="">All Sectors</option>
                      {sectors.filter(s => !expFilters.schemeId || s.schemeId === expFilters.schemeId).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Activity</label>
                    <select 
                      value={expFilters.activityId}
                      onChange={(e) => setExpFilters({ ...expFilters, activityId: e.target.value, subActivityId: '' })}
                      className="w-full p-1.5 border border-gray-300 rounded text-xs bg-white"
                    >
                      <option value="">All Activities</option>
                      {activities.filter(a => {
                        if (expFilters.sectorId) return a.sectorId === expFilters.sectorId;
                        if (expFilters.schemeId) return a.schemeId === expFilters.schemeId || sectors.find(s => s.id === a.sectorId)?.schemeId === expFilters.schemeId;
                        return true;
                      }).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Sub-Activity</label>
                    <select 
                      value={expFilters.subActivityId}
                      onChange={(e) => setExpFilters({ ...expFilters, subActivityId: e.target.value })}
                      className="w-full p-1.5 border border-gray-300 rounded text-xs bg-white"
                    >
                      <option value="">All Sub-Activities</option>
                      {subActivities.filter(sa => !expFilters.activityId || sa.activityId === expFilters.activityId).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Range</label>
                    <select 
                      value={expFilters.rangeId}
                      onChange={(e) => setExpFilters({ ...expFilters, rangeId: e.target.value })}
                      className="w-full p-1.5 border border-gray-300 rounded text-xs bg-white"
                    >
                      <option value="">All Ranges</option>
                      {ranges.map(s => <option key={s.id} value={s.id}>{s.name === 'Rajgarh Forest Division' ? 'Division' : s.name}</option>)}
                    </select>
                  </div>
                </>,
                () => {
                  setExpFilters({ schemeId: '', sectorId: '', activityId: '', subActivityId: '', rangeId: '' });
                  setSearchTerm('');
                }
              )
            )}

            {expenditureSubTab === 'bills' && (userRole === 'admin' || userRole === 'deo') && (() => {
              const availableApprovedExpenses = expenses.filter(e => e.status === 'approved' && e.financialYear === selectedFY);
              const firstSelectedExp = expenses.find(e => selectedExpensesForBill.includes(e.id));
              const lockedSoeId = firstSelectedExp?.soeId;

              const filteredForSoeList = availableApprovedExpenses.filter(e => {
                const al = allocations.find(a => a.id === e.allocationId);
                if (billExpFilters.rangeId && al?.rangeId !== billExpFilters.rangeId) return false;
                if (billExpFilters.schemeId && al?.schemeId !== billExpFilters.schemeId) return false;
                if (billExpFilters.sectorId && al?.sectorId !== billExpFilters.sectorId) return false;
                if (billExpFilters.activityId && al?.activityId !== billExpFilters.activityId) return false;
                if (billExpFilters.subActivityId && al?.subActivityId !== billExpFilters.subActivityId) return false;
                return true;
              });
              const availableSoeIds = Array.from(new Set(filteredForSoeList.map(e => e.soeId)));
              const availableSoesForBill = soes.filter(s => availableSoeIds.includes(s.id));

              return renderSimpleManager(
                'Bill',
                bills,
                [
                  {key: 'billNo', label: 'Bill No', render: (val) => <span className="font-bold text-emerald-700">{val}</span>},
                  {key: 'billDate', label: 'Bill Date', render: (val) => val ? val.split('-').reverse().join('/') : ''},
                  {key: 'soeId', label: 'SOE', render: (_, item: Bill) => {
                    const firstExp = expenses.find(e => item.expenseIds.includes(e.id));
                    const s = soes.find(s => s.id === firstExp?.soeId);
                    return <span className="text-[10px] font-bold text-gray-600">{s?.name || 'N/A'}</span>
                  }},
                  {key: 'expenseIds', label: 'Expenditures', render: (val: string[], item: Bill) => (
                    <div className="space-y-1">
                      <div className="text-[10px] text-gray-500 font-bold uppercase">{val.length} Entries</div>
                      <div className="max-h-32 overflow-y-auto border rounded p-1 bg-gray-50 space-y-1">
                        {val.map(id => {
                          const exp = expenses.find(e => e.id === id);
                          if (!exp) return null;
                          const s = soes.find(s => s.id === exp.soeId);
                          return (
                            <div key={id} className="text-[9px] flex justify-between items-center bg-white p-1 rounded border border-gray-100">
                              <span className="truncate flex-1">
                                {exp.date ? exp.date.split('-').reverse().join('/') : 'N/A'} - {s?.name} - ₹{exp.amount.toLocaleString()}
                              </span>
                              {(userRole === 'admin' || (userRole === 'deo' && item.status === 'draft')) && (
                                <button 
                                  onClick={() => handleRemoveExpenseFromBill(item.id, id)}
                                  className="text-red-500 hover:text-red-700 ml-1"
                                  title="Remove from Bill"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )},
                  {key: 'totalAmount', label: 'Total Amount', render: (val) => <span className="text-emerald-600 font-bold">₹{val.toLocaleString()}</span>},
                  {key: 'status', label: 'Status', render: (val) => (
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${val === 'finalized' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`}>
                      {val}
                    </span>
                  )}
                ],
                handleCreateBill,
                (id) => handleDelete('bills', id),
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input name="billNo" required defaultValue={editingItem?.type === 'Bill' ? editingItem.item.billNo : ''} placeholder="Bill Number (e.g. TRY-123)" className="p-2 border rounded text-sm" />
                    <input name="billDate" type="date" required defaultValue={editingItem?.type === 'Bill' ? editingItem.item.billDate : new Date().toISOString().split('T')[0]} className="p-2 border rounded text-sm" />
                  </div>
                  <textarea name="remarks" defaultValue={editingItem?.type === 'Bill' ? editingItem.item.remarks : ''} placeholder="Remarks (optional)" className="w-full p-2 border rounded text-sm" rows={2} />
                  
                  <div className="mt-4 border-t pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-bold text-gray-600 uppercase">Select Expenditures</label>
                      <div className="flex gap-1">
                        <select 
                          value={billExpFilters.rangeId} 
                          onChange={(e) => setBillExpFilters({...billExpFilters, rangeId: e.target.value})}
                          className="text-[10px] p-1 border rounded bg-white"
                        >
                          <option value="">All Ranges</option>
                          {ranges.map(r => <option key={r.id} value={r.id}>{r.name === 'Rajgarh Forest Division' ? 'Division' : r.name}</option>)}
                        </select>
                        <select 
                          value={billExpFilters.soeId} 
                          onChange={(e) => setBillExpFilters({...billExpFilters, soeId: e.target.value})}
                          className="text-[10px] p-1 border rounded bg-white"
                        >
                          <option value="">All SOEs</option>
                          {availableSoesForBill.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1 mb-1">
                      <select 
                        value={billExpFilters.schemeId} 
                        onChange={(e) => setBillExpFilters({...billExpFilters, schemeId: e.target.value, sectorId: '', activityId: '', subActivityId: ''})}
                        className="text-[10px] p-1 border rounded bg-white"
                      >
                        <option value="">All Schemes</option>
                        {schemes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                      <select 
                        value={billExpFilters.sectorId} 
                        onChange={(e) => setBillExpFilters({...billExpFilters, sectorId: e.target.value, activityId: '', subActivityId: ''})}
                        className="text-[10px] p-1 border rounded bg-white"
                      >
                        <option value="">All Sectors</option>
                        {sectors.filter(s => !billExpFilters.schemeId || s.schemeId === billExpFilters.schemeId).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-1 mb-2">
                      <select 
                        value={billExpFilters.activityId} 
                        onChange={(e) => setBillExpFilters({...billExpFilters, activityId: e.target.value, subActivityId: ''})}
                        className="text-[10px] p-1 border rounded bg-white"
                      >
                        <option value="">All Activities</option>
                        {activities.filter(a => !billExpFilters.sectorId || a.sectorId === billExpFilters.sectorId).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                      <select 
                        value={billExpFilters.subActivityId} 
                        onChange={(e) => setBillExpFilters({...billExpFilters, subActivityId: e.target.value})}
                        className="text-[10px] p-1 border rounded bg-white"
                      >
                        <option value="">All Sub-Activities</option>
                        {subActivities.filter(sa => !billExpFilters.activityId || sa.activityId === billExpFilters.activityId).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>

                    <div className={`${isBillFormFullScreen ? 'max-h-[60vh]' : 'max-h-60'} overflow-y-auto border rounded divide-y bg-gray-50 custom-scrollbar`}>
                      {expenses
                        .filter(e => e.status === 'approved' && e.financialYear === selectedFY)
                        .filter(e => {
                          const isAlreadyInBill = bills.some(b => b.expenseIds.includes(e.id) && b.id !== editingItem?.item?.id);
                          if (isAlreadyInBill) return false;
                          
                          // SOE Restriction
                          if (lockedSoeId && e.soeId !== lockedSoeId) return false;

                          const al = allocations.find(a => a.id === e.allocationId);
                          if (billExpFilters.rangeId && al?.rangeId !== billExpFilters.rangeId) return false;
                          if (billExpFilters.soeId && e.soeId !== billExpFilters.soeId) return false;
                          if (billExpFilters.schemeId && al?.schemeId !== billExpFilters.schemeId) return false;
                          if (billExpFilters.sectorId && al?.sectorId !== billExpFilters.sectorId) return false;
                          if (billExpFilters.activityId && al?.activityId !== billExpFilters.activityId) return false;
                          if (billExpFilters.subActivityId && al?.subActivityId !== billExpFilters.subActivityId) return false;
                          
                          return true;
                        })
                        .map(exp => {
                          const s = soes.find(s => s.id === exp.soeId);
                          const al = allocations.find(a => a.id === exp.allocationId);
                          const r = ranges.find(r => r.id === al?.rangeId);
                          const isSelected = selectedExpensesForBill.includes(exp.id);
                          
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
                            <div 
                              key={exp.id} 
                              onClick={() => {
                                setSelectedExpensesForBill(prev => 
                                  prev.includes(exp.id) ? prev.filter(id => id !== exp.id) : [...prev, exp.id]
                                );
                              }}
                              className={`p-2 text-[10px] cursor-pointer transition-colors flex items-start gap-2 ${isSelected ? 'bg-emerald-50 border-l-2 border-emerald-500' : 'hover:bg-white'}`}
                            >
                              <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-gray-300'}`}>
                                {isSelected && <Check className="w-3 h-3" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start mb-1">
                                  <span className="font-bold text-gray-900">{exp.date ? exp.date.split('-').reverse().join('/') : 'N/A'}</span>
                                  <span className="font-bold text-emerald-600">₹{exp.amount.toLocaleString()}</span>
                                </div>
                                <div className="text-gray-600 font-medium mb-1">Range: {r?.name} | SOE: {s?.name}</div>
                                <div className="text-gray-500 text-[9px] mb-1 italic">{hierarchy}</div>
                                <div className="text-gray-400 truncate">{exp.description}</div>
                              </div>
                            </div>
                          );
                        })}
                      {expenses.filter(e => e.status === 'approved' && e.financialYear === selectedFY).length === 0 && (
                        <div className="p-4 text-center text-gray-500 italic text-xs">No approved expenditures available.</div>
                      )}
                    </div>
                    <div className="mt-2 p-2 bg-gray-50 rounded flex justify-between items-center">
                      <span className="text-[10px] font-bold text-gray-600 uppercase">
                        {selectedExpensesForBill.length} Selected
                      </span>
                      <span className="text-xs font-bold text-emerald-700">
                        Total: ₹{expenses.filter(e => selectedExpensesForBill.includes(e.id)).reduce((sum, e) => sum + e.amount, 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>,
                (item) => {
                  setEditingItem({ type: 'Bill', item });
                  setSelectedExpensesForBill(item.expenseIds);
                },
                (item) => (userRole === 'admin' || (userRole === 'deo' && item.status === 'draft')),
                undefined,
                (item) => (
                  <div className="flex gap-1">
                    <button 
                      onClick={() => handleViewBill(item)}
                      className="p-1 border border-gray-200 rounded text-emerald-600 hover:bg-emerald-50"
                      title="View Bill PDF"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDownloadBill(item)}
                      className="p-1 border border-gray-200 rounded text-gray-600 hover:bg-gray-50"
                      title="Download Bill PDF"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    {(userRole === 'admin' || userRole === 'deo') && (
                      <button 
                        onClick={() => {
                          const newStatus = item.status === 'draft' ? 'finalized' : 'draft';
                          updateDoc(doc(db, 'bills', item.id), { status: newStatus, updatedAt: Date.now() });
                        }}
                        className={`p-1 border rounded ${item.status === 'finalized' ? 'text-blue-600 border-blue-100 bg-blue-50' : 'text-emerald-600 border-emerald-100 bg-emerald-50'}`}
                        title={item.status === 'finalized' ? 'Mark as Draft' : 'Finalize Bill'}
                      >
                        {item.status === 'finalized' ? <RefreshCcw className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                ),
                false,
                isExpFilterExpanded,
                setIsExpFilterExpanded,
                <>
                  <input 
                    type="text" 
                    placeholder="Bill Number..." 
                    value={billFilters.billNo}
                    onChange={(e) => setBillFilters({ ...billFilters, billNo: e.target.value })}
                    className="w-full p-1.5 border border-gray-300 rounded text-xs bg-white"
                  />
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Bill Date Range</label>
                    <div className="flex gap-2">
                      <input 
                        type="date" 
                        value={billFilters.startDate} 
                        onChange={(e) => setBillFilters({ ...billFilters, startDate: e.target.value })}
                        className="w-full p-1.5 border border-gray-300 rounded text-xs bg-white"
                      />
                      <input 
                        type="date" 
                        value={billFilters.endDate} 
                        onChange={(e) => setBillFilters({ ...billFilters, endDate: e.target.value })}
                        className="w-full p-1.5 border border-gray-300 rounded text-xs bg-white"
                      />
                    </div>
                  </div>
                </>,
                () => setBillFilters({ billNo: '', startDate: '', endDate: '' }),
                isBillFormFullScreen,
                setIsBillFormFullScreen
              )
            })()}

            {expenditureSubTab === 'payees' && (userRole === 'admin' || userRole === 'deo') && (
              renderSimpleManager(
                'Payee',
                payees,
                [
                  { key: 'name', label: 'Name', searchableText: (val) => val },
                  { key: 'address', label: 'Address', searchableText: (val) => val },
                  { key: 'accountNumber', label: 'Account Number', searchableText: (val) => val },
                  { 
                    key: 'rangeId', 
                    label: 'Range', 
                    searchableText: (val) => ranges.find(r => r.id === val)?.name || 'N/A',
                    render: (val) => ranges.find(r => r.id === val)?.name || <span className="text-gray-400 italic">Not Specified</span>
                  }
                ],
                handleAddPayee,
                (id) => handleDelete('payees', id),
                <>
                  <input name="name" type="text" required defaultValue={editingItem?.type === 'Payee' ? editingItem.item.name : ''} placeholder="Payee Name" className="w-full p-2 border rounded" />
                  <input name="address" type="text" required defaultValue={editingItem?.type === 'Payee' ? editingItem.item.address : ''} placeholder="Address" className="w-full p-2 border rounded" />
                  <input name="accountNumber" type="text" required defaultValue={editingItem?.type === 'Payee' ? editingItem.item.accountNumber : ''} placeholder="Account Number" className="w-full p-2 border rounded" />
                  <select name="rangeId" defaultValue={editingItem?.type === 'Payee' ? editingItem.item.rangeId : ''} className="w-full p-2 border rounded">
                    <option value="">Select Range (Optional)</option>
                    {ranges.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </>,
                (item) => setEditingItem({ type: 'Payee', item }),
                () => (userRole === 'admin' || userRole === 'deo')
              )
            )}
          </div>
        )}

        {activeTab === 'Surrender' && renderSurrenderTab()}

        {activeTab === 'Reconciliation' && renderReconciliation()}

        {activeTab === 'Ledger' && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 border-b pb-4">
              <div className="flex items-center gap-4 flex-1">
                <h3 className="text-lg font-semibold whitespace-nowrap">Passbook Ledger</h3>
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by description, approval ID, hierarchy..."
                    value={ledgerSearchTerm}
                    onChange={(e) => setLedgerSearchTerm(e.target.value)}
                    className="pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 w-full"
                  />
                </div>
                <button 
                  onClick={() => setShowLedgerFilters(!showLedgerFilters)}
                  className={`flex items-center gap-1 px-3 py-2 border rounded-lg text-sm transition-colors ${showLedgerFilters ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-white hover:bg-gray-50'}`}
                >
                  <Filter className="w-4 h-4" />
                  <span>Filters</span>
                  {showLedgerFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={downloadLedgerPDF}
                  className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
                  title="Download PDF"
                >
                  <FileText className="w-4 h-4" />
                  <span>PDF</span>
                </button>
                <button 
                  onClick={downloadLedgerExcel}
                  className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
                  title="Download Excel"
                >
                  <FileBarChart className="w-4 h-4" />
                  <span>Excel</span>
                </button>
                <span className="text-sm font-medium text-emerald-600">FY {fys.find(f => f.id === selectedFY)?.name || selectedFY}</span>
              </div>
            </div>

            {showLedgerFilters && (
              <div className="mb-6 animate-in fade-in slide-in-from-top-2">
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 p-4 bg-gray-50 rounded-t-lg border border-gray-200">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Range</label>
                    <select 
                      value={ledgerFilters.range}
                      onChange={(e) => setLedgerFilters({ ...ledgerFilters, range: e.target.value, scheme: '', sector: '', activity: '', subActivity: '', soe: '' })}
                      className="w-full p-2 border border-gray-300 rounded text-xs bg-white"
                    >
                      <option value="">All Ranges</option>
                      {uniqueRangesList.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Scheme</label>
                    <select 
                      value={ledgerFilters.scheme}
                      onChange={(e) => setLedgerFilters({ ...ledgerFilters, scheme: e.target.value, sector: '', activity: '', subActivity: '', soe: '' })}
                      className="w-full p-2 border border-gray-300 rounded text-xs bg-white"
                    >
                      <option value="">All Schemes</option>
                      {uniqueSchemes.filter(s => {
                        if (!ledgerFilters.range) return true;
                        return comprehensiveReportData.some(r => r.range === ledgerFilters.range && r.scheme === s);
                      }).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Sector</label>
                    <select 
                      value={ledgerFilters.sector}
                      onChange={(e) => setLedgerFilters({ ...ledgerFilters, sector: e.target.value, activity: '', subActivity: '', soe: '' })}
                      className="w-full p-2 border border-gray-300 rounded text-xs bg-white"
                    >
                      <option value="">All Sectors</option>
                      {uniqueSectors.filter(s => {
                        if (!ledgerFilters.range && !ledgerFilters.scheme) return true;
                        return comprehensiveReportData.some(r => {
                          const rangeMatch = !ledgerFilters.range || r.range === ledgerFilters.range;
                          const schemeMatch = !ledgerFilters.scheme || r.scheme === ledgerFilters.scheme;
                          return rangeMatch && schemeMatch && r.sector === s;
                        });
                      }).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Activity</label>
                    <select 
                      value={ledgerFilters.activity}
                      onChange={(e) => setLedgerFilters({ ...ledgerFilters, activity: e.target.value, subActivity: '', soe: '' })}
                      className="w-full p-2 border border-gray-300 rounded text-xs bg-white"
                    >
                      <option value="">All Activities</option>
                      {uniqueActivities.filter(a => {
                        if (!ledgerFilters.range && !ledgerFilters.scheme && !ledgerFilters.sector) return true;
                        return comprehensiveReportData.some(r => {
                          const rangeMatch = !ledgerFilters.range || r.range === ledgerFilters.range;
                          const schemeMatch = !ledgerFilters.scheme || r.scheme === ledgerFilters.scheme;
                          const sectorMatch = !ledgerFilters.sector || r.sector === ledgerFilters.sector;
                          return rangeMatch && schemeMatch && sectorMatch && r.activity === a;
                        });
                      }).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Sub-Activity</label>
                    <select 
                      value={ledgerFilters.subActivity}
                      onChange={(e) => setLedgerFilters({ ...ledgerFilters, subActivity: e.target.value, soe: '' })}
                      className="w-full p-2 border border-gray-300 rounded text-xs bg-white"
                    >
                      <option value="">All Sub-Activities</option>
                      {uniqueSubActivities.filter(sa => {
                        if (!ledgerFilters.range && !ledgerFilters.scheme && !ledgerFilters.sector && !ledgerFilters.activity) return true;
                        return comprehensiveReportData.some(r => {
                          const rangeMatch = !ledgerFilters.range || r.range === ledgerFilters.range;
                          const schemeMatch = !ledgerFilters.scheme || r.scheme === ledgerFilters.scheme;
                          const sectorMatch = !ledgerFilters.sector || r.sector === ledgerFilters.sector;
                          const activityMatch = !ledgerFilters.activity || r.activity === ledgerFilters.activity;
                          return rangeMatch && schemeMatch && sectorMatch && activityMatch && r.subActivity === sa;
                        });
                      }).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">SOE</label>
                    <select 
                      value={ledgerFilters.soe}
                      onChange={(e) => setLedgerFilters({ ...ledgerFilters, soe: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded text-xs bg-white"
                    >
                      <option value="">All SOEs</option>
                      {uniqueSoes.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="lg:col-span-6 flex justify-end">
                    <button 
                      onClick={() => {
                        setLedgerFilters({ scheme: '', sector: '', activity: '', subActivity: '', range: '', soe: '' });
                        setLedgerSearchTerm('');
                      }}
                      className="text-xs text-red-600 hover:text-red-800 font-medium flex items-center gap-1"
                    >
                      <X className="w-3 h-3" />
                      Reset Filters
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-emerald-50 rounded-b-lg border-x border-b border-gray-200">
                  <div className="flex justify-between items-center px-2">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase">Total Credit:</span>
                    <span className="text-sm font-bold text-emerald-700">₹{filteredLedgerData.totals.credit.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center px-2 border-x border-emerald-100">
                    <span className="text-[10px] font-bold text-red-800 uppercase">Total Debit:</span>
                    <span className="text-sm font-bold text-red-700">₹{filteredLedgerData.totals.debit.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center px-2">
                    <span className="text-[10px] font-bold text-blue-800 uppercase">Net Balance:</span>
                    <span className="text-sm font-bold text-blue-700">₹{filteredLedgerData.totals.balance.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-600 text-sm">
                    <th className="p-3 border-b">Date</th>
                    <th className="p-3 border-b">Range</th>
                    <th className="p-3 border-b">Hierarchy & SOE</th>
                    <th className="p-3 border-b">Description</th>
                    <th className="p-3 border-b">Approval ID</th>
                    <th className="p-3 border-b text-right">Credit (Allocated)</th>
                    <th className="p-3 border-b text-right">Debit (Expense)</th>
                    <th className="p-3 border-b text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLedgerData.allocations.map(alloc => {
                    const r = ranges.find(r => r.id === alloc.rangeId);
                    const soeNames = alloc.fundedSOEs?.map(f => soes.find(s => s.id === f.soeId)?.name).filter(Boolean).join(', ') || 'Pending Funds';
                    
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
                    
                    const allocExpenses = expenses.filter(e => e.allocationId === alloc.id && e.status !== 'rejected').sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                    
                    let currentBalance = alloc.amount;
                    
                    return (
                      <React.Fragment key={`alloc-${alloc.id}`}>
                        {/* Initial Allocation Row */}
                        <tr className="bg-blue-50/30 border-b">
                          <td className="p-3 text-gray-400">-</td>
                          <td className="p-3 font-medium">{r?.name}</td>
                          <td className="p-3 font-medium">
                            <div className="text-xs text-gray-500">{hierarchy || 'N/A'}</div>
                            <div>{soeNames}</div>
                          </td>
                          <td className="p-3 italic text-gray-600">Initial Allocation</td>
                          <td className="p-3 text-gray-400">-</td>
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
                                <div>{soeNames}</div>
                                {alloc.activityId && (
                                  <div className="text-[10px] bg-blue-50 text-blue-600 px-1 rounded inline-block mt-1">
                                    Activity: {activities.find(a => a.id === alloc.activityId)?.name}
                                  </div>
                                )}
                              </td>
                              <td className="p-3">{exp.description}</td>
                              <td className="p-3 font-mono text-xs">{exp.approvalId ? `#${exp.approvalId}` : '-'}</td>
                              <td className="p-3 text-right">-</td>
                              <td className="p-3 text-right text-red-600">₹{exp.amount.toLocaleString()}</td>
                              <td className="p-3 text-right text-blue-600 font-bold">₹{currentBalance.toLocaleString()}</td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                  {filteredLedgerData.allocations.length === 0 && <tr><td colSpan={8} className="p-4 text-center text-gray-500">No allocations found for this Financial Year.</td></tr>}
                </tbody>
                {filteredLedgerData.allocations.length > 0 && (
                  <tfoot className="bg-gray-50 font-bold border-t-2 border-gray-200">
                    <tr>
                      <td colSpan={5} className="p-3 text-right text-gray-700">GRAND TOTAL:</td>
                      <td className="p-3 text-right text-emerald-700">₹{filteredLedgerData.totals.credit.toLocaleString()}</td>
                      <td className="p-3 text-right text-red-700">₹{filteredLedgerData.totals.debit.toLocaleString()}</td>
                      <td className="p-3 text-right text-blue-700">₹{filteredLedgerData.totals.balance.toLocaleString()}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}

        {activeTab === 'Reports' && renderReports()}
        {activeTab === 'Users' && userRole === 'admin' && renderUserManagement()}

        {renderFundingModal()}
        {renderApprovalModal()}
        {renderSoeExpModal()}

        {/* Global Alert Modal */}
        {alertModal.isOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-200">
              <div className="bg-emerald-600 p-4 text-white flex justify-between items-center">
                <h3 className="font-bold">Notification</h3>
                <button onClick={() => setAlertModal({ ...alertModal, isOpen: false })}><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6">
                <p className="text-gray-700">{alertModal.message}</p>
                <div className="mt-6 flex justify-end">
                  <button 
                    onClick={() => setAlertModal({ ...alertModal, isOpen: false })}
                    className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors font-medium"
                  >
                    OK
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Global Confirm Modal */}
        {confirmModal.isOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-200">
              <div className="bg-amber-500 p-4 text-white flex justify-between items-center">
                <h3 className="font-bold">Confirm Action</h3>
                <button onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6">
                <p className="text-gray-700">{confirmModal.message}</p>
                <div className="mt-6 flex justify-end gap-3">
                  <button 
                    onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => {
                      confirmModal.onConfirm();
                      setConfirmModal({ ...confirmModal, isOpen: false });
                    }}
                    className="bg-amber-500 text-white px-4 py-2 rounded-lg hover:bg-amber-600 transition-colors font-medium"
                  >
                    Confirm
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PDF Viewer Modal */}
        {viewingBillPdf && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200] p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden animate-in zoom-in duration-300">
              <div className="bg-emerald-600 p-4 text-white flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 p-2 rounded-lg">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Bill PDF Viewer</h3>
                    <p className="text-xs text-emerald-100">Bill No: {viewingBillPdf.bill.billNo} | Date: {viewingBillPdf.bill.billDate ? viewingBillPdf.bill.billDate.split('-').reverse().join('/') : 'N/A'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = viewingBillPdf.url;
                      link.download = `bill_${viewingBillPdf.bill.billNo}.pdf`;
                      link.click();
                    }}
                    className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors text-sm font-medium"
                    title="Download PDF"
                  >
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">Download</span>
                  </button>
                  <button 
                    onClick={() => {
                      const printWindow = window.open(viewingBillPdf.url);
                      if (printWindow) printWindow.print();
                    }}
                    className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors text-sm font-medium"
                    title="Print PDF"
                  >
                    <Printer className="w-4 h-4" />
                    <span className="hidden sm:inline">Print</span>
                  </button>
                  <div className="w-px h-6 bg-white/20 mx-1"></div>
                  <button 
                    onClick={() => {
                      URL.revokeObjectURL(viewingBillPdf.url);
                      setViewingBillPdf(null);
                    }}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
              <div className="flex-1 bg-gray-100 p-4 overflow-hidden">
                <iframe 
                  src={`${viewingBillPdf.url}#toolbar=0`} 
                  className="w-full h-full rounded-lg border border-gray-200 shadow-inner bg-white"
                  title="Bill PDF"
                />
              </div>
              <div className="bg-gray-50 p-3 border-t flex justify-center text-[10px] text-gray-400 font-medium uppercase tracking-widest">
                Forest Budget Control System • Treasury Bill Format
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function CascadingDropdowns({ 
  schemes, sectors, activities, subActivities, soes, soeBudgets, allocations, ranges, expenses,
  editingItem, type, children, onSelectionChange, onBalanceChange, userRangeId 
}: any) {
  const [schemeId, setSchemeId] = useState('');
  const [sectorId, setSectorId] = useState('');
  const [activityId, setActivityId] = useState('');
  const [subActivityId, setSubActivityId] = useState('');
  const [soeId, setSoeId] = useState('');
  const [allocationId, setAllocationId] = useState('');
  const [fundingSoeName, setFundingSoeName] = useState('');
  const [rangeId, setRangeId] = useState(userRangeId || '');

  // Notify parent of selection changes
  useEffect(() => {
    if (onSelectionChange) {
      onSelectionChange({ schemeId, sectorId, activityId, subActivityId, soeId, fundingSoeName, rangeId });
    }
  }, [schemeId, sectorId, activityId, subActivityId, soeId, fundingSoeName, rangeId, onSelectionChange]);

  // Calculate and notify parent of balance changes (Expenditure only)
  useEffect(() => {
    if (type === 'Expenditure' && onBalanceChange) {
      if (allocationId && soeId) {
        const alloc = allocations.find((a: any) => a.id === allocationId);
        if (!alloc || !alloc.fundedSOEs) {
          onBalanceChange(undefined);
          return;
        }

        const selectedSoe = soes.find((s: any) => s.id === soeId);
        const selectedName = selectedSoe?.name || 'Unnamed SOE';

        // Find all funded SOEs with the same name in this allocation
        const matchedFunded = alloc.fundedSOEs.filter((f: any) => {
          const s = soes.find((soe: any) => soe.id === f.soeId);
          return (s?.name || 'Unnamed SOE') === selectedName;
        });

        const totalFunded = matchedFunded.reduce((sum: number, f: any) => sum + f.amount, 0);
        
        // Find all expenses for these SOE IDs in this allocation
        const matchedSoeIds = matchedFunded.map((f: any) => f.soeId);
        const spent = expenses
          .filter((e: any) => 
            e.allocationId === allocationId && 
            matchedSoeIds.includes(e.soeId) && 
            e.status !== 'rejected' && 
            (editingItem?.type === 'Expenditure' ? e.id !== editingItem.item.id : true)
          )
          .reduce((sum: number, e: any) => sum + e.amount, 0);

        const balance = totalFunded - spent;
        onBalanceChange(balance);
      } else {
        onBalanceChange(undefined);
      }
    }
  }, [allocationId, soeId, allocations, expenses, type, onBalanceChange, editingItem, soes]);

  // Initialize state based on editingItem
  useEffect(() => {
    if (editingItem?.item && editingItem.type === type) {
      const item = editingItem.item;
      let currentSoeId = '';
      let currentSubActivityId = '';
      let currentActivityId = '';
      let currentSectorId = '';
      let currentSchemeId = '';
      let currentRangeId = userRangeId || '';

      if (type === 'Expenditure') {
        const alloc = allocations.find((a: any) => a.id === item.allocationId);
        setAllocationId(item.allocationId);
        currentSoeId = alloc?.soeId || '';
        currentSubActivityId = alloc?.subActivityId || '';
        currentActivityId = alloc?.activityId || '';
        currentSectorId = alloc?.sectorId || '';
        currentSchemeId = alloc?.schemeId || '';
        currentRangeId = alloc?.rangeId || userRangeId || '';
      } else if (type === 'Allocation') {
        currentSoeId = item.soeId;
        currentSubActivityId = item.subActivityId || '';
        currentActivityId = item.activityId || '';
        currentSectorId = item.sectorId || '';
        currentSchemeId = item.schemeId || '';
        currentRangeId = item.rangeId || userRangeId || '';
        
        // Initialize fundingSoeName if it's an allocation with funded SOEs
        if (item.fundedSOEs && item.fundedSOEs.length > 0) {
          const firstSoe = soes.find((s: any) => s.id === item.fundedSOEs[0].soeId);
          if (firstSoe) {
            setFundingSoeName(firstSoe.name);
          }
        }
      } else if (type === 'Sub-Activity') {
        currentActivityId = item.activityId;
        const act = activities.find((a: any) => a.id === currentActivityId);
        currentSectorId = act?.sectorId || '';
        currentSchemeId = act?.schemeId || '';
        if (!currentSchemeId && currentSectorId) {
          const sec = sectors.find((s: any) => s.id === currentSectorId);
          currentSchemeId = sec?.schemeId || '';
        }
      } else if (type === 'SOE Name') {
        currentSubActivityId = item.subActivityId || '';
        currentActivityId = item.activityId || '';
        currentSectorId = item.sectorId || '';
        currentSchemeId = item.schemeId || '';
      } else if (type === 'Surrender') {
        currentSoeId = item.soeId;
        currentSubActivityId = item.subActivityId || '';
        currentActivityId = item.activityId || '';
        currentSectorId = item.sectorId || '';
        currentSchemeId = item.schemeId || '';
        currentRangeId = item.rangeId || userRangeId || '';
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

      if (currentRangeId) {
        setRangeId(currentRangeId);
      }
    } else {
      // Reset if not editing
      setSchemeId('');
      setSectorId('');
      setActivityId('');
      setSubActivityId('');
      setSoeId('');
      setAllocationId('');
      setFundingSoeName('');
      setRangeId(userRangeId || '');
    }
  }, [editingItem, type]); 

  const filteredSchemes = useMemo(() => (type === 'Expenditure' || type === 'Surrender')
    ? schemes.filter((s: any) => allocations.some((a: any) => a.schemeId === s.id && (!rangeId || a.rangeId === rangeId)))
    : schemes, [schemes, allocations, rangeId, type]);

  // Deduplicate by name to remove repeated items
  const getUniqueByName = (items: any[]) => {
    const seen = new Set();
    return items.filter(item => {
      if (!item.name) return true;
      const duplicate = seen.has(item.name);
      seen.add(item.name);
      return !duplicate;
    });
  };

  const filteredSectors = useMemo(() => sectors.filter((s: any) => {
    if (!schemeId) return false;
    if (s.schemeId !== schemeId) return false;
    if ((type === 'Expenditure' || type === 'Surrender') && !allocations.some((a: any) => 
      a.sectorId === s.id && 
      (!rangeId || a.rangeId === rangeId) &&
      (!schemeId || a.schemeId === schemeId)
    )) return false;
    return true;
  }), [sectors, schemeId, type, allocations, rangeId]);

  const filteredActivities = useMemo(() => activities.filter((a: any) => {
    if (!schemeId) return false;
    if (a.schemeId && a.schemeId !== schemeId) return false;
    if (sectorId && a.sectorId !== sectorId) return false;
    // If activity has no schemeId but has sectorId, check sector's scheme
    if (!a.schemeId && a.sectorId) {
      const sec = sectors.find((s: any) => s.id === a.sectorId);
      if (sec && sec.schemeId !== schemeId) return false;
    }
    if ((type === 'Expenditure' || type === 'Surrender') && !allocations.some((al: any) => 
      al.activityId === a.id && 
      (!rangeId || al.rangeId === rangeId) &&
      (!schemeId || al.schemeId === schemeId) &&
      (!sectorId || al.sectorId === sectorId)
    )) return false;
    return true;
  }), [activities, schemeId, sectorId, type, allocations, rangeId, sectors]);

  const filteredSubActivities = useMemo(() => subActivities.filter((sa: any) => {
    if (!activityId) return false;
    if (sa.activityId !== activityId) return false;
    if ((type === 'Expenditure' || type === 'Surrender') && !allocations.some((al: any) => 
      al.subActivityId === sa.id && 
      (!rangeId || al.rangeId === rangeId) &&
      (!schemeId || al.schemeId === schemeId) &&
      (!sectorId || al.sectorId === sectorId) &&
      (!activityId || al.activityId === activityId)
    )) return false;
    return true;
  }), [subActivities, activityId, type, allocations, rangeId, schemeId, sectorId]);

  const filteredSoes = useMemo(() => soes.filter((s: any) => {
    if (!schemeId) return false;
    if (s.schemeId && s.schemeId !== schemeId) return false;
    if (sectorId && s.sectorId && s.sectorId !== sectorId) return false;
    if (activityId && s.activityId && s.activityId !== activityId) return false;
    if (subActivityId && s.subActivityId && s.subActivityId !== subActivityId) return false;
    if (type === 'Surrender') {
      return allocations.some((al: any) => 
        al.rangeId === rangeId && 
        al.schemeId === schemeId &&
        (!sectorId || al.sectorId === sectorId) &&
        (!activityId || al.activityId === activityId) &&
        (!subActivityId || al.subActivityId === subActivityId) &&
        al.fundedSOEs?.some(f => f.soeId === s.id)
      );
    }
    // Relaxed Expenditure check to show all SOEs matching the hierarchy
    return true;
  }), [soes, schemeId, sectorId, activityId, subActivityId, type, allocations, rangeId]);

  const filteredAllocations = useMemo(() => allocations.filter((a: any) => {
    if (rangeId && a.rangeId !== rangeId) return false;
    if (schemeId && a.schemeId !== schemeId) return false;
    if (sectorId && a.sectorId !== sectorId) return false;
    if (activityId && a.activityId !== activityId) return false;
    if (subActivityId && a.subActivityId !== subActivityId) return false;
    return true;
  }), [allocations, rangeId, schemeId, sectorId, activityId, subActivityId]);

  // Auto-selection logic
  useEffect(() => {
    if (filteredSectors.length === 1 && !sectorId && schemeId && !editingItem) {
      setSectorId(filteredSectors[0].id);
    }
  }, [filteredSectors, sectorId, schemeId, editingItem]);

  useEffect(() => {
    if (filteredActivities.length === 1 && !activityId && sectorId && !editingItem) {
      setActivityId(filteredActivities[0].id);
    }
  }, [filteredActivities, activityId, sectorId, editingItem]);

  useEffect(() => {
    if (filteredSubActivities.length === 1 && !subActivityId && activityId && !editingItem) {
      setSubActivityId(filteredSubActivities[0].id);
    }
  }, [filteredSubActivities, subActivityId, activityId, editingItem]);

  // Auto-selection for allocationId (Expenditure only)
  useEffect(() => {
    if (type === 'Expenditure' && filteredAllocations.length === 1 && !allocationId && !editingItem) {
      setAllocationId(filteredAllocations[0].id);
    }
  }, [filteredAllocations, allocationId, type, editingItem]);

  // Auto-selection for soeId (Expenditure only)
  useEffect(() => {
    if (type === 'Expenditure' && allocationId) {
      const alloc = allocations.find((a: any) => a.id === allocationId);
      if (alloc && alloc.fundedSOEs && alloc.fundedSOEs.length === 1 && !soeId && !editingItem) {
        setSoeId(alloc.fundedSOEs[0].soeId);
      }
    }
  }, [allocationId, soeId, type, allocations, editingItem]);

  return (
    <>
      {(type === 'Surrender') && (
        <div className="flex gap-2">
          {userRangeId ? (
            <div className="w-full p-1.5 bg-gray-50 border rounded text-sm font-medium text-gray-700">
              Range: {ranges.find((r: any) => r.id === userRangeId)?.name || 'Your Range'}
              <input type="hidden" name="rangeId" value={userRangeId} />
            </div>
          ) : (
            <select 
              className="w-full p-1.5 border rounded text-sm" 
              name="rangeId"
              value={rangeId} 
              onChange={(e) => { setRangeId(e.target.value); setSchemeId(''); setSectorId(''); setActivityId(''); setSubActivityId(''); setSoeId(''); setAllocationId(''); }}
              required
            >
              <option value="">Select Range</option>
              {ranges
                .filter((r: any) => (r.name !== 'Division' && r.name !== 'Rajgarh Forest Division'))
                .map((r: any) => (
                  <option key={r.id} value={r.id}>
                    {r.name === 'Rajgarh Forest Division' ? 'Division' : r.name}
                  </option>
                ))}
            </select>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <select 
          className="w-full p-1.5 border rounded text-sm" 
          value={schemeId} 
          onChange={(e) => { setSchemeId(e.target.value); setSectorId(''); setActivityId(''); setSubActivityId(''); setSoeId(''); setAllocationId(''); }}
          required={type !== 'Activity'}
        >
          <option value="">Select Scheme</option>
          {filteredSchemes.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button type="button" onClick={() => document.getElementById('tab-Schemes')?.click()} className="px-2 bg-gray-100 border rounded hover:bg-gray-200 text-gray-600 text-sm" title="Add Scheme">+</button>
      </div>

      {(type === 'Activity' || type === 'Sub-Activity' || type === 'SOE Name' || type === 'Allocation' || type === 'Expenditure' || type === 'Surrender') && (
        <div className="flex gap-2">
          <select 
            className="w-full p-1.5 border rounded text-sm" 
            value={sectorId} 
            onChange={(e) => { setSectorId(e.target.value); setActivityId(''); setSubActivityId(''); setSoeId(''); setAllocationId(''); }}
          >
            <option value="">Select Sector (Optional)</option>
            {filteredSectors.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button type="button" onClick={() => document.getElementById('tab-Sectors')?.click()} className="px-2 bg-gray-100 border rounded hover:bg-gray-200 text-gray-600 text-sm" title="Add Sector">+</button>
        </div>
      )}

      {(type === 'Sub-Activity' || type === 'SOE Name' || type === 'Allocation' || type === 'Expenditure' || type === 'Surrender') && (
        <div className="flex gap-2">
          <select 
            className="w-full p-1.5 border rounded text-sm" 
            value={activityId} 
            onChange={(e) => { setActivityId(e.target.value); setSubActivityId(''); setSoeId(''); setAllocationId(''); }}
            required={type !== 'SOE Name' && type !== 'Allocation' && type !== 'Surrender'}
          >
            <option value="">Select Activity {(type === 'SOE Name' || type === 'Allocation' || type === 'Surrender') ? '(Optional)' : ''}</option>
            {filteredActivities.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <button type="button" onClick={() => document.getElementById('tab-Activities')?.click()} className="px-2 bg-gray-100 border rounded hover:bg-gray-200 text-gray-600 text-sm" title="Add Activity">+</button>
        </div>
      )}

      {(type === 'SOE Name' || type === 'Allocation' || type === 'Expenditure' || type === 'Surrender') && (
        <div className="flex gap-2">
          <select 
            className="w-full p-1.5 border rounded text-sm" 
            value={subActivityId} 
            onChange={(e) => { setSubActivityId(e.target.value); setSoeId(''); setAllocationId(''); }}
          >
            <option value="">Select Sub-Activity (Optional)</option>
            {filteredSubActivities.map((sa: any) => <option key={sa.id} value={sa.id}>{sa.name}</option>)}
          </select>
          <button type="button" onClick={() => document.getElementById('tab-Sub-Activities')?.click()} className="px-2 bg-gray-100 border rounded hover:bg-gray-200 text-gray-600 text-sm" title="Add Sub-Activity">+</button>
        </div>
      )}
      
      {/* Hidden inputs to ensure correct fields are submitted */}
      <input type="hidden" name="schemeId" value={schemeId} />
      <input type="hidden" name="sectorId" value={sectorId} />
      <input type="hidden" name="activityId" value={activityId} />
      <input type="hidden" name="subActivityId" value={subActivityId} />
      <input type="hidden" name="soeId" value={soeId} />
      <input type="hidden" name="allocationId" value={allocationId} />
      {!userRangeId && (type !== 'Surrender' && type !== 'Allocation' && type !== 'Expenditure') && <input type="hidden" name="rangeId" value={rangeId} />}

      {(type === 'Surrender') && (
        <div className="flex gap-2">
          <select 
            className="w-full p-1.5 border rounded text-sm" 
            value={soeId} 
            onChange={(e) => setSoeId(e.target.value)}
            required
          >
            <option value="">Select SOE Head</option>
            {filteredSoes.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      )}

      {type === 'Allocation' && (
        <div className="flex flex-col gap-2">
          <div className="text-xs text-blue-600 px-1 font-medium bg-blue-50 p-2 rounded border border-blue-100">
            {(() => {
              // Get all SOEs in this Sector (or Scheme if no sector)
              const sectorSoes = soes.filter((s: any) => 
                s.schemeId === schemeId && 
                (s.sectorId || null) === (sectorId || null)
              );
              
              const balances = ALLOWED_SOES.map(name => {
                const matchedSoes = sectorSoes.filter(s => s.name === name);
                const received = matchedSoes.reduce((sum, s) => sum + getReceivedInTry(s), 0);
                const allocated = allocations.reduce((sum, a) => {
                  const currentAllocId = editingItem?.type === 'Allocation' ? editingItem.item.id : null;
                  if (a.id === currentAllocId) return sum;
                  const fundedFromThese = a.fundedSOEs?.filter((f: any) => matchedSoes.some(s => s.id === f.soeId)) || [];
                  return sum + fundedFromThese.reduce((s: number, f: any) => s + f.amount, 0);
                }, 0);
                return { name, remaining: received - allocated };
              }).filter(b => b.remaining > 0);

              if (balances.length === 0) return "No budget available in this Sector/Scheme.";

              return (
                <div className="space-y-1">
                  <div className="font-bold border-b border-blue-200 pb-0.5 mb-1">Sector-wide Available SOE Budgets:</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {balances.map(b => (
                      <div key={b.name} className="flex justify-between">
                        <span>{b.name}:</span>
                        <span className="font-bold">₹{b.remaining.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-1 pt-1 border-t border-blue-200 text-[10px] italic">
                    Total Sector Pool: ₹{balances.reduce((s, b) => s + b.remaining, 0).toLocaleString()}
                  </div>
                </div>
              );
            })()}
          </div>
          
          <select 
            name="fundingSoeName" 
            className="w-full p-1.5 border rounded bg-blue-50 border-blue-200 text-blue-800 font-medium text-sm"
            required
            value={fundingSoeName}
            onChange={(e) => setFundingSoeName(e.target.value)}
          >
            <option value="">Select SOE to Fund From</option>
            {(() => {
              const sectorSoes = soes.filter((s: any) => 
                s.schemeId === schemeId && 
                (s.sectorId || null) === (sectorId || null)
              );
              return ALLOWED_SOES.map(name => {
                const matchedSoes = sectorSoes.filter(s => s.name === name);
                const received = matchedSoes.reduce((sum, s) => sum + getReceivedInTry(s), 0);
                const allocated = allocations.reduce((sum, a) => {
                  const currentAllocId = editingItem?.type === 'Allocation' ? editingItem.item.id : null;
                  if (a.id === currentAllocId) return sum;
                  const fundedFromThese = a.fundedSOEs?.filter((f: any) => matchedSoes.some(s => s.id === f.soeId)) || [];
                  return sum + fundedFromThese.reduce((s: number, f: any) => s + f.amount, 0);
                }, 0);
                const remaining = received - allocated;
                return { name, remaining };
              }).filter(b => b.remaining > 0).map(b => (
                <option key={b.name} value={b.name}>{b.name} (Available: ₹{b.remaining.toLocaleString()})</option>
              ));
            })()}
          </select>

          {/* Range selection moved here for Allocation */}
          <div className="flex gap-2">
            {userRangeId ? (
              <div className="w-full p-1.5 bg-gray-50 border rounded text-sm font-medium text-gray-700">
                Range: {ranges.find((r: any) => r.id === userRangeId)?.name || 'Your Range'}
                <input type="hidden" name="rangeId" value={userRangeId} />
              </div>
            ) : (
              <select 
                className="w-full p-1.5 border rounded text-sm" 
                name="rangeId"
                value={rangeId} 
                onChange={(e) => { setRangeId(e.target.value); setSoeId(''); setAllocationId(''); }}
                required
              >
                <option value="">Select Range</option>
                {ranges.map((r: any) => (
                  <option key={r.id} value={r.id}>
                    {r.name === 'Rajgarh Forest Division' ? 'Division' : r.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      )}

      {type === 'Expenditure' && (
        <div className="space-y-2">
          {(!userRangeId || filteredAllocations.length > 1) ? (
            <div className="flex gap-2">
              <select 
                className="w-full p-1.5 border rounded text-sm" 
                value={allocationId} 
                onChange={(e) => { 
                  const val = e.target.value;
                  setAllocationId(val); 
                  setSoeId(''); 
                  if (val) {
                    const alloc = allocations.find((a: any) => a.id === val);
                    if (alloc) setRangeId(alloc.rangeId);
                  }
                }}
                required
              >
                <option value="">Select Allocation (Range)</option>
                {filteredAllocations.map((a: any) => {
                  const r = ranges.find((r: any) => r.id === a.rangeId);
                  return <option key={a.id} value={a.id}>{r?.name} (Limit: ₹{a.amount.toLocaleString()}, Status: {a.status})</option>
                })}
              </select>
              <button type="button" onClick={() => document.getElementById('tab-Allocations')?.click()} className="px-2 bg-gray-100 border rounded hover:bg-gray-200 text-gray-600 text-sm" title="Add Allocation">+</button>
            </div>
          ) : (
            <>
              <input type="hidden" name="allocationId" value={allocationId} />
              {allocationId && (
                <div className="text-[10px] text-emerald-600 font-bold bg-emerald-50 p-1.5 rounded border border-emerald-100 flex items-center justify-between">
                  <span>Range: {ranges.find((r: any) => r.id === userRangeId)?.name}</span>
                  <span>Limit: ₹{allocations.find((a: any) => a.id === allocationId)?.amount.toLocaleString()}</span>
                </div>
              )}
            </>
          )}

          {allocationId && (
            <div className="flex flex-col gap-1">
              <div className="flex gap-2">
                <select 
                  className="w-full p-1.5 border rounded text-sm" 
                  value={soeId} 
                  onChange={(e) => setSoeId(e.target.value)}
                  required
                >
                  <option value="">Select Funded SOE</option>
                  {(() => {
                    if (type === 'Expenditure' && allocationId) {
                      const alloc = allocations.find((a: any) => a.id === allocationId);
                      if (alloc && alloc.fundedSOEs) {
                        // Group by SOE name to handle split funding (e.g. same name, different IDs)
                        const groups: Record<string, { name: string, totalAmount: number, totalSpent: number, primarySoeId: string }> = {};
                        
                        alloc.fundedSOEs.forEach((f: any) => {
                          const s = soes.find((soe: any) => soe.id === f.soeId);
                          const name = s?.name || 'Unnamed SOE';
                          const spent = expenses
                            .filter((e: any) => e.allocationId === allocationId && e.soeId === f.soeId && e.status !== 'rejected' && (editingItem?.type === 'Expenditure' ? e.id !== editingItem.item.id : true))
                            .reduce((sum: number, e: any) => sum + e.amount, 0);
                          
                          if (!groups[name]) {
                            groups[name] = { name, totalAmount: 0, totalSpent: 0, primarySoeId: f.soeId };
                          }
                          groups[name].totalAmount += f.amount;
                          groups[name].totalSpent += spent;
                        });

                        return Object.values(groups)
                          .filter(g => g.totalAmount - g.totalSpent > 0)
                          .map(g => (
                            <option key={g.name} value={g.primarySoeId}>
                              {g.name} (Available: ₹{(g.totalAmount - g.totalSpent).toLocaleString()})
                            </option>
                          ));
                      }
                    }
                    return filteredSoes.map((s: any) => <option key={s.id} value={s.id}>{s.name || 'Unnamed SOE'}</option>);
                  })()}
                </select>
                <button type="button" onClick={() => document.getElementById('tab-SOE Heads')?.click()} className="px-2 bg-gray-100 border rounded hover:bg-gray-200 text-gray-600 text-sm" title="Manage SOE Heads">+</button>
              </div>

              {/* Range selection moved here for Expenditure */}
              <div className="flex gap-2">
                {userRangeId ? (
                  <div className="w-full p-1.5 bg-gray-50 border rounded text-sm font-medium text-gray-700">
                    Range: {ranges.find((r: any) => r.id === userRangeId)?.name || 'Your Range'}
                    <input type="hidden" name="rangeId" value={userRangeId} />
                  </div>
                ) : (
                  <select 
                    className="w-full p-1.5 border rounded text-sm" 
                    name="rangeId"
                    value={rangeId} 
                    onChange={(e) => { setRangeId(e.target.value); setSoeId(''); setAllocationId(''); }}
                    required
                  >
                    <option value="">Select Range</option>
                    {ranges.map((r: any) => (
                      <option key={r.id} value={r.id}>
                        {r.name === 'Rajgarh Forest Division' ? 'Division' : r.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              
              {soeId && (
                <div className="text-xs text-blue-600 px-1 font-medium bg-blue-50 p-1.5 rounded border border-blue-100">
                  {(() => {
                    const alloc = allocations.find((a: any) => a.id === allocationId);
                    const fundedSoe = alloc?.fundedSOEs?.find((f: any) => f.soeId === soeId);
                    if (fundedSoe) {
                      const spent = expenses
                        .filter((e: any) => e.allocationId === allocationId && e.soeId === soeId && e.status !== 'rejected' && (editingItem?.type === 'Expenditure' ? e.id !== editingItem.item.id : true))
                        .reduce((sum: number, e: any) => sum + e.amount, 0);
                      return `SOE Funding: ₹${fundedSoe.amount.toLocaleString()} | Spent: ₹${spent.toLocaleString()} | Remaining: ₹${(fundedSoe.amount - spent).toLocaleString()}`;
                    }
                    return 'Select an SOE to see balance';
                  })()}
                </div>
              )}
            </div>
          )}
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
          className="w-full p-1.5 border rounded text-sm"
        >
          <option value="">Select Scheme</option>
          {schemes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button type="button" onClick={() => document.getElementById('tab-Schemes')?.click()} className="px-2 bg-gray-100 border rounded hover:bg-gray-200 text-gray-600 text-sm" title="Add Scheme">+</button>
      </div>
      
      <div className="flex gap-2">
        <select name="sectorId" defaultValue={editingItem?.item?.sectorId || ''} className="w-full p-1.5 border rounded text-sm">
          <option value="">Select Sector (Optional)</option>
          {sectors.filter(s => s.schemeId === selectedSchemeId).map(sec => (
            <option key={sec.id} value={sec.id}>{sec.name}</option>
          ))}
        </select>
        <button type="button" onClick={() => document.getElementById('tab-Sectors')?.click()} className="px-2 bg-gray-100 border rounded hover:bg-gray-200 text-gray-600 text-sm" title="Add Sector">+</button>
      </div>
      
      <input name="name" required defaultValue={editingItem?.type === 'Activity' ? editingItem.item.name : ''} placeholder="Activity Name" className="w-full p-1.5 border rounded text-sm" />
    </>
  );
}

function Pagination({ 
  totalEntries, 
  currentPage, 
  itemsPerPage, 
  onPageChange 
}: { 
  totalEntries: number, 
  currentPage: number, 
  itemsPerPage: number, 
  onPageChange: (page: number) => void 
}) {
  const isAll = itemsPerPage === -1;
  const totalPages = isAll ? 1 : Math.ceil(totalEntries / itemsPerPage);
  
  if (totalPages <= 1 && totalEntries <= itemsPerPage && !isAll) return null;

  const startEntry = isAll ? 1 : (currentPage - 1) * itemsPerPage + 1;
  const endEntry = isAll ? totalEntries : Math.min(currentPage * itemsPerPage, totalEntries);

  const pages = [];
  const maxVisiblePages = 5;
  
  let startPage = Math.max(1, currentPage - 2);
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
  
  if (endPage - startPage < maxVisiblePages - 1) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 pt-4 border-t">
      <p className="text-sm text-gray-600">
        Showing <span className="font-medium">{startEntry}</span> to <span className="font-medium">{endEntry}</span> of <span className="font-medium">{totalEntries}</span> entries
      </p>
      {!isAll && totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button 
            onClick={() => onPageChange(1)} 
            disabled={currentPage === 1}
            className="p-1.5 rounded border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="First Page"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>
          <button 
            onClick={() => onPageChange(currentPage - 1)} 
            disabled={currentPage === 1}
            className="p-1.5 rounded border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Previous Page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          {startPage > 1 && <span className="px-2 text-gray-400">...</span>}
          
          {pages.map(page => (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`min-w-[32px] h-8 flex items-center justify-center rounded border text-sm font-medium transition-colors ${
                currentPage === page 
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm' 
                  : 'hover:bg-gray-50 text-gray-600 border-gray-200'
              }`}
            >
              {page}
            </button>
          ))}
          
          {endPage < totalPages && <span className="px-2 text-gray-400">...</span>}
          
          <button 
            onClick={() => onPageChange(currentPage + 1)} 
            disabled={currentPage === totalPages}
            className="p-1.5 rounded border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Next Page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button 
            onClick={() => onPageChange(totalPages)} 
            disabled={currentPage === totalPages}
            className="p-1.5 rounded border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Last Page"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, amount, icon, color, subtitle }: { title: string, amount: number, icon: React.ReactNode, color: string, subtitle?: string }) {
  return (
    <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3 min-w-0">
      <div className={`p-2.5 rounded-full bg-gray-50 ${color} shrink-0`}>
        {React.cloneElement(icon as React.ReactElement<any>, { className: 'w-4 h-4' })}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tight truncate" title={title}>{title}</p>
        <p className={`text-base font-bold ${color} truncate`}>₹{amount.toLocaleString()}</p>
        {subtitle && <p className="text-[9px] text-gray-400 font-medium truncate">{subtitle}</p>}
      </div>
    </div>
  );
}
