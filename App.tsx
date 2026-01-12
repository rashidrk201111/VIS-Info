
import React, { useState, useEffect, useRef } from 'react';
import { AppView, VoterRecord } from './types';
import { DataProcessor } from './components/DataProcessor';
import { VoterSearch } from './components/VoterSearch';
import { Login } from './components/Login';
import { VoterApi } from './api';
import { getDatabaseInsights } from './analyticsService';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [activeView, setActiveView] = useState<AppView | 'INSIGHTS'>('SEARCH');
  const [dbCount, setDbCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'IDLE' | 'CHECKING' | 'CONNECTED' | 'ERROR'>('IDLE');
  const [hasCustomKey, setHasCustomKey] = useState(false);

  useEffect(() => {
    const auth = sessionStorage.getItem('vis_auth');
    if (auth === 'true') {
      setIsAuthenticated(true);
      verifyAndRefresh();
      checkKeyStatus();
    }
  }, []);

  const verifyAndRefresh = async () => {
    setConnectionStatus('CHECKING');
    const check = await VoterApi.testConnection();
    if (check.success) {
      setConnectionStatus('CONNECTED');
      refreshData();
    } else {
      setConnectionStatus('ERROR');
      console.error(check.message);
    }
  };

  const checkKeyStatus = async () => {
    try {
      // @ts-ignore
      const hasKey = await window.aistudio.hasSelectedApiKey();
      setHasCustomKey(hasKey);
    } catch (e) {
      console.debug("Key selection API not available");
    }
  };

  const handleOpenKeyDialog = async () => {
    try {
      // @ts-ignore
      await window.aistudio.openSelectKey();
      setHasCustomKey(true);
    } catch (e) {
      console.error("Failed to open key selection dialog", e);
    }
  };

  const refreshData = async () => {
    setIsSyncing(true);
    try {
      const voters = await VoterApi.getVoters();
      setDbCount(voters.length);
    } catch (err) {
      console.error("Failed to fetch from Supabase", err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleNav = (view: AppView | 'INSIGHTS') => {
    setActiveView(view);
    refreshData();
  };

  const handleLogout = () => {
    sessionStorage.removeItem('vis_auth');
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return <Login onLogin={() => {
      setIsAuthenticated(true);
      verifyAndRefresh();
      checkKeyStatus();
    }} />;
  }

  return (
    <div className="min-h-screen bg-[#FDFDFF]">
      <header className="bg-white border-b border-slate-100 sticky top-0 z-50 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20 items-center">
            <div className="flex items-center gap-4">
              <div className="bg-indigo-600 w-11 h-11 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-200">
                <i className="fa-solid fa-cloud text-white text-lg"></i>
              </div>
              <div className="hidden sm:block">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-black text-slate-900 tracking-tight">VIS <span className="text-indigo-600">Enterprise</span></h1>
                  <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border transition-colors ${
                    connectionStatus === 'CONNECTED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                    connectionStatus === 'CHECKING' ? 'bg-amber-50 text-amber-600 border-amber-100 animate-pulse' :
                    connectionStatus === 'ERROR' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-slate-50 text-slate-400 border-slate-100'
                  }`}>
                    {connectionStatus === 'CONNECTED' ? 'Supabase Live' : connectionStatus === 'CHECKING' ? 'Verifying...' : 'No Connection'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">PostgreSQL Cloud Database • v3.0.0</p>
              </div>
            </div>
            
            <nav className="flex gap-1 bg-slate-50 p-1 rounded-2xl border border-slate-100">
              <NavButton active={activeView === 'SEARCH'} onClick={() => handleNav('SEARCH')} icon="fa-magnifying-glass" label="Explore" />
              <NavButton active={activeView === 'PROCESS'} onClick={() => handleNav('PROCESS')} icon="fa-cloud-arrow-up" label="Ingest" />
              <NavButton active={activeView === 'DATABASE'} onClick={() => handleNav('DATABASE')} icon="fa-table" label={`Vault (${dbCount})`} />
              <NavButton active={activeView === 'INSIGHTS'} onClick={() => handleNav('INSIGHTS')} icon="fa-chart-simple" label="Analytics" />
            </nav>

            <div className="flex items-center gap-3">
              <button 
                onClick={handleOpenKeyDialog}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all border ${
                  hasCustomKey 
                  ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
                  : 'bg-white text-slate-400 border-slate-200 hover:border-indigo-400 hover:text-indigo-600'
                }`}
              >
                <i className={`fa-solid ${hasCustomKey ? 'fa-bolt' : 'fa-bolt-slash'}`}></i>
                <span className="hidden lg:inline">{hasCustomKey ? 'AI Engine: Active' : 'AI Engine: System'}</span>
              </button>

              <button onClick={handleLogout} className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all flex items-center justify-center border border-slate-100">
                <i className="fa-solid fa-power-off"></i>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {connectionStatus === 'ERROR' && (
          <div className="max-w-2xl mx-auto mb-10 p-8 bg-red-50 border border-red-100 rounded-[32px] text-red-800 text-center animate-fade-in">
             <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-red-100">
               <i className="fa-solid fa-triangle-exclamation text-2xl text-red-500"></i>
             </div>
             <h2 className="text-xl font-black mb-2">Supabase Verification Failed</h2>
             <p className="font-medium text-red-600/80 mb-6">We could not detect the "voters_table" in your project. Please ensure you ran the SQL query in your Supabase SQL Editor.</p>
             <button onClick={verifyAndRefresh} className="px-8 py-3 bg-red-600 text-white rounded-xl font-black text-xs hover:bg-red-700 transition-all shadow-lg shadow-red-200">
                Retry Connection
             </button>
          </div>
        )}
        {activeView === 'SEARCH' && <VoterSearch onUpdateCount={refreshData} />}
        {activeView === 'PROCESS' && <DataProcessor onUpdateCount={refreshData} />}
        {activeView === 'DATABASE' && <DatabaseView onUpdate={refreshData} />}
        {activeView === 'INSIGHTS' && <InsightsView />}
      </main>

      <footer className="py-12 bg-white border-t border-slate-100 no-print">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
             <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
             <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">Real-Time Cloud PostgreSQL Connection</p>
          </div>
          <p className="text-xs text-slate-300 font-medium">Data is stored securely in your Supabase database</p>
        </div>
      </footer>
    </div>
  );
};

const NavButton: React.FC<{ active: boolean; onClick: () => void; icon: string; label: string }> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap ${
    active ? 'bg-white text-indigo-600 shadow-sm border border-slate-100' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
  }`}>
    <i className={`fa-solid ${icon}`}></i>
    <span className="hidden md:inline">{label}</span>
  </button>
);

const InsightsView: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInsights = async () => {
      try {
        const voters = await VoterApi.getVoters();
        const result = await getDatabaseInsights(voters);
        setData(result);
      } catch (e: any) {
        console.error("Insights fetch failed", e);
        if (e?.message?.includes("Requested entity was not found")) {
           try {
             // @ts-ignore
             await window.aistudio.openSelectKey();
           } catch (err) {
             console.error("Failed to open key selection dialog", err);
           }
        }
      } finally {
        setLoading(false);
      }
    };
    fetchInsights();
  }, []);

  if (loading) return (
    <div className="text-center py-24">
      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
        <i className="fa-solid fa-microchip animate-pulse text-2xl text-indigo-600"></i>
      </div>
      <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Querying Supabase Analytics...</p>
    </div>
  );

  if (!data || data.stats.total === 0) return (
    <div className="text-center py-24 bg-white rounded-[40px] border border-slate-100">
      <i className="fa-solid fa-layer-group text-4xl text-slate-100 mb-4"></i>
      <p className="text-slate-400 font-bold">Supabase table is currently empty.</p>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard icon="fa-users" label="Live Registered" value={data.stats.total} color="bg-indigo-600" />
          <StatCard icon="fa-venus-mars" label="Gender Representation" value={`${Math.round((data.stats.genderSplit.F / data.stats.total) * 100)}% Female`} color="bg-rose-500" />
          <StatCard icon="fa-cake-candles" label="Demographic Mean" value={`${Math.round(data.stats.avgAge)} Yrs`} color="bg-amber-500" />
       </div>

       <div className="bg-white rounded-[40px] p-10 border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <i className="fa-solid fa-brain text-9xl"></i>
          </div>
          <h3 className="text-2xl font-black text-slate-900 mb-8 flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
              <i className="fa-solid fa-wand-magic-sparkles"></i>
            </div>
            AI Strategic Intelligence
          </h3>
          <div className="prose prose-slate max-w-none">
            {data.aiInsights.split('\n').map((line: string, i: number) => (
              <p key={i} className="text-slate-600 leading-relaxed font-medium mb-4 pl-4 border-l-2 border-indigo-100">
                {line.replace(/^[•\-\*]\s*/, '')}
              </p>
            ))}
          </div>
       </div>
    </div>
  );
};

const StatCard: React.FC<{ icon: string; label: string; value: string | number; color: string }> = ({ icon, label, value, color }) => (
  <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm transition-transform hover:scale-[1.02]">
     <div className={`w-14 h-14 ${color} rounded-2xl flex items-center justify-center text-white mb-6 shadow-xl`}>
        <i className={`fa-solid ${icon} text-xl`}></i>
     </div>
     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
     <p className="text-3xl font-black text-slate-900 tracking-tight">{value}</p>
  </div>
);

const DatabaseView: React.FC<{ onUpdate: () => void }> = ({ onUpdate }) => {
  const [voters, setVoters] = useState<VoterRecord[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    load();
  }, []);

  const addLog = (msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 5));
  };

  const load = async () => {
    setIsSyncing(true);
    addLog("SUPABASE: SELECT * FROM voters_table;");
    try {
      const data = await VoterApi.getVoters();
      setVoters(data);
    } catch (e: any) {
      addLog(`ERROR: ${e.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDelete = async (epicNo: string) => {
    if (confirm('Permanently remove this entry from Supabase cloud?')) {
      setIsSyncing(true);
      addLog(`SUPABASE: DELETE FROM voters WHERE epicNo='${epicNo}';`);
      try {
        await VoterApi.deleteVoter(epicNo);
        await load();
        onUpdate();
      } catch (e: any) {
        addLog(`ERROR: ${e.message}`);
      } finally {
        setIsSyncing(false);
      }
    }
  };

  const handleClearAll = async () => {
    if (confirm('SUPABASE: This will erase all remote records in the cloud table. Are you sure?')) {
      setIsSyncing(true);
      addLog("SUPABASE: DELETE FROM voters_table;");
      try {
        await VoterApi.truncateTable();
        setVoters([]);
        onUpdate();
      } catch (e: any) {
        addLog(`ERROR: ${e.message}`);
      } finally {
        setIsSyncing(false);
      }
    }
  };

  const handleBackup = () => {
    addLog("APP: EXPORT FROM SUPABASE TO JSON;");
    VoterApi.exportSqlDump();
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsSyncing(true);
    addLog(`SUPABASE: UPSERTING FROM '${file.name}';`);
    try {
      await VoterApi.importSqlDump(file);
      await load();
      onUpdate();
    } catch (err: any) {
      alert(`Import failed: ${err.message}`);
    } finally {
      setIsSyncing(false);
      if (importRef.current) importRef.current.value = '';
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
       <div className="bg-white rounded-[40px] p-10 shadow-sm border border-slate-100">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">Cloud Infrastructure</h2>
                <div className={`w-2 h-2 rounded-full ${isSyncing ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'}`}></div>
              </div>
              <p className="text-slate-500 font-medium">Currently managing <span className="text-indigo-600 font-black">{voters.length}</span> verified entries in Supabase.</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={handleBackup} className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-xs hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 flex items-center gap-2">
                 <i className="fa-solid fa-file-export"></i> Cloud Export
              </button>
              
              <input type="file" ref={importRef} onChange={handleRestore} accept=".json" className="hidden" />
              <button onClick={() => importRef.current?.click()} className="bg-white border border-slate-200 text-slate-600 px-8 py-4 rounded-2xl font-black text-xs hover:bg-slate-50 transition-all flex items-center gap-2">
                 <i className="fa-solid fa-file-import"></i> Cloud Restore
              </button>

              <button onClick={handleClearAll} className="text-red-500 hover:text-white font-black text-xs px-6 py-4 rounded-2xl border border-red-50 hover:bg-red-500 hover:border-red-500 transition-all">
                 Wipe Table
              </button>
            </div>
          </div>

          <div className="mt-8 bg-slate-50 rounded-2xl p-4 border border-slate-100">
             <div className="flex items-center gap-2 mb-2">
               <i className="fa-solid fa-cloud-bolt text-[10px] text-slate-400"></i>
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">PostgreSQL Query Logs</span>
             </div>
             <div className="space-y-1">
               {logs.length > 0 ? logs.map((log, i) => (
                 <div key={i} className="text-[10px] font-mono text-slate-500 flex gap-2">
                   <span className="text-indigo-500 font-black">❯</span> {log}
                 </div>
               )) : (
                 <div className="text-[10px] font-mono text-slate-300 italic">Listening for database events...</div>
               )}
             </div>
          </div>
       </div>

       <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden">
          {voters.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-50">
                    <th className="px-10 py-6">Unique EPIC ID</th>
                    <th className="px-10 py-6">Metadata</th>
                    <th className="px-10 py-6">Polling Site</th>
                    <th className="px-10 py-6 text-right">Ops</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {voters.slice(0, 100).map((voter) => (
                    <tr key={voter.epicNo} className="hover:bg-slate-50/30 transition-colors group">
                      <td className="px-10 py-6">
                        <span className="font-black text-slate-900 font-mono tracking-tighter text-sm">{voter.epicNo}</span>
                      </td>
                      <td className="px-10 py-6">
                        <div className="font-black text-slate-800 text-sm mb-0.5">{voter.name}</div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{voter.age}yr • {voter.gender}</div>
                      </td>
                      <td className="px-10 py-6">
                         <div className="text-xs font-bold text-slate-600 truncate max-w-[200px]">{voter.pollingStation?.name || 'Unmapped'}</div>
                      </td>
                      <td className="px-10 py-6 text-right">
                        <button onClick={() => handleDelete(voter.epicNo)} className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-200 group-hover:text-red-500 transition-all hover:bg-red-50">
                          <i className="fa-solid fa-xmark"></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {voters.length > 100 && (
                <div className="p-6 text-center text-slate-400 text-[10px] font-black uppercase tracking-widest border-t border-slate-50">
                  Showing top 100 records from Supabase
                </div>
              )}
            </div>
          ) : (
            <div className="p-32 text-center flex flex-col items-center">
               <div className="w-24 h-24 bg-slate-50 rounded-[32px] flex items-center justify-center text-slate-200 mb-8 border border-slate-100 shadow-inner">
                  <i className="fa-solid fa-cloud-arrow-down text-3xl"></i>
               </div>
               <p className="text-slate-900 font-black text-lg mb-2">Supabase Cloud is Ready</p>
               <p className="text-sm text-slate-400 max-w-sm mx-auto leading-relaxed">The table is initialized in the cloud. Upload files in the Ingest tab to populate your centralized database.</p>
            </div>
          )}
       </div>
    </div>
  );
};

export default App;
