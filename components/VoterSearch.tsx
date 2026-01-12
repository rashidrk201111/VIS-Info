
import React, { useState, useEffect } from 'react';
import { VoterApi } from '../api';
import { VoterRecord } from '../types';
import { VoterSlip } from './VoterSlip';

interface VoterSearchProps {
  onUpdateCount?: () => void;
}

export const VoterSearch: React.FC<VoterSearchProps> = ({ onUpdateCount }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<VoterRecord[]>([]);
  const [selectedVoter, setSelectedVoter] = useState<VoterRecord | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const refreshResults = async () => {
    if (query.length >= 2) {
      setIsSearching(true);
      const searchData = await VoterApi.search(query);
      setResults(searchData);
      setIsSearching(false);
    } else {
      setResults([]);
    }
    if (onUpdateCount) onUpdateCount();
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      refreshResults();
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const handleDelete = async (epicNo: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (confirm(`Remove record ${epicNo} from the server?`)) {
      await VoterApi.deleteVoter(epicNo);
      if (selectedVoter?.epicNo === epicNo) {
        setSelectedVoter(null);
      }
      refreshResults();
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
      <div className="bg-white rounded-[40px] p-10 shadow-sm border border-slate-100 no-print">
        <div className="flex justify-between items-start mb-10">
          <div>
            <h2 className="text-4xl font-black text-slate-900 tracking-tight mb-2">Registry Search</h2>
            <p className="text-slate-500 font-medium">Query the centralized SQL voter database.</p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-2xl border border-slate-100">
             <i className="fa-solid fa-circle text-[6px] text-emerald-500 animate-pulse"></i>
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Server Live</span>
          </div>
        </div>
        
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
            <i className={`fa-solid ${isSearching ? 'fa-spinner animate-spin text-indigo-500' : 'fa-magnifying-glass text-slate-300'} text-xl transition-colors`}></i>
          </div>
          <input 
            type="text"
            className="block w-full pl-16 pr-6 py-8 bg-slate-50 border-2 border-transparent rounded-[32px] text-2xl font-black focus:ring-0 focus:border-indigo-600 focus:bg-white transition-all placeholder:text-slate-200 text-slate-900 shadow-inner"
            placeholder="Search Name or EPIC ID..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
        <div className="space-y-6 no-print">
          {results.length > 0 ? (
            results.map((voter) => (
              <div 
                key={voter.epicNo}
                onClick={() => setSelectedVoter(voter)}
                className={`p-8 rounded-[32px] cursor-pointer transition-all border-2 relative group/item ${
                  selectedVoter?.epicNo === voter.epicNo 
                  ? 'border-indigo-600 bg-indigo-50/30 shadow-2xl shadow-indigo-100/50 scale-[1.02]' 
                  : 'border-white bg-white hover:border-slate-100 hover:scale-[1.01] shadow-sm'
                }`}
              >
                <button 
                  onClick={(e) => handleDelete(voter.epicNo, e)}
                  className="absolute top-6 right-6 w-10 h-10 rounded-xl bg-white border border-slate-100 text-slate-200 opacity-0 group-hover/item:opacity-100 hover:text-red-500 hover:border-red-100 transition-all flex items-center justify-center"
                >
                  <i className="fa-solid fa-trash-can text-sm"></i>
                </button>

                <div className="flex justify-between items-start mb-4">
                  <span className="px-4 py-1.5 bg-slate-900 text-white text-[10px] font-black rounded-xl uppercase tracking-widest font-mono">
                    {voter.epicNo}
                  </span>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1">Row Ref</span>
                    <span className="text-sm font-black text-slate-900 font-mono">#{voter.serialNo}</span>
                  </div>
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-2">{voter.name}</h3>
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <i className="fa-solid fa-user-friends text-[10px] text-slate-400"></i>
                    <p className="text-xs font-bold text-slate-500">{voter.parentSpouseName}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <i className="fa-solid fa-cake-candles text-[10px] text-slate-400"></i>
                    <p className="text-xs font-bold text-slate-500">{voter.age}yr • {voter.gender}</p>
                  </div>
                </div>
              </div>
            ))
          ) : query.length >= 2 && !isSearching ? (
            <div className="bg-white py-24 rounded-[40px] border border-slate-100 text-center shadow-sm">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                 <i className="fa-solid fa-ghost text-slate-200 text-xl"></i>
              </div>
              <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">No Server Match Found</p>
            </div>
          ) : null}
        </div>

        <div className="lg:sticky lg:top-24">
          {selectedVoter ? (
            <VoterSlip 
              voter={selectedVoter} 
              onClose={() => setSelectedVoter(null)}
              onDelete={refreshResults}
            />
          ) : (
            <div className="bg-slate-50/50 rounded-[40px] py-40 border-2 border-dashed border-slate-100 text-center no-print">
               <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                  <i className="fa-solid fa-id-card-clip text-2xl text-slate-100"></i>
               </div>
               <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">Select a Registry Entry</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
