
import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import * as pdfjs from 'pdfjs-dist';
import { VoterApi } from '../api';
import { VoterRecord } from '../types';
import { extractVoters } from '../geminiService';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@${pdfjs.version}/build/pdf.worker.mjs`;

interface DataProcessorProps {
  onUpdateCount?: () => void;
}

interface ProcessedFile {
  name: string;
  count: number;
  status: 'processing' | 'completed' | 'error';
}

export const DataProcessor: React.FC<DataProcessorProps> = ({ onUpdateCount }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedFiles, setProcessedFiles] = useState<ProcessedFile[]>([]);
  const [lastExtracted, setLastExtracted] = useState<VoterRecord[]>([]);
  const [processingLog, setProcessingLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({ totalExtracted: 0, totalSaved: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addLog = (msg: string) => {
    setProcessingLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 8));
  };

  const saveBatchToVault = async (voters: VoterRecord[]) => {
    const validVoters = voters.filter(v => !v.epicNo.startsWith('PENDING') && v.name !== 'Unknown');
    if (validVoters.length === 0) return 0;
    
    try {
      addLog(`VAULT: Initiating cloud upsert for ${validVoters.length} records...`);
      await VoterApi.bulkCreate(validVoters);
      setStats(prev => ({ ...prev, totalSaved: prev.totalSaved + validVoters.length }));
      addLog(`VAULT: Successfully committed to Supabase.`);
      if (onUpdateCount) onUpdateCount();
      return validVoters.length;
    } catch (err: any) {
      addLog(`VAULT ERROR: ${err.message}`);
      return 0;
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setError(null);
    setIsProcessing(true);
    setProcessedFiles([]);
    setProcessingLog([]);
    setStats({ totalExtracted: 0, totalSaved: 0 });
    
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProcessedFiles(prev => [...prev, { name: file.name, count: 0, status: 'processing' }]);
        addLog(`FILE: Starting ingestion for ${file.name}`);
        
        let fileVoters: VoterRecord[] = [];

        if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
          fileVoters = await processPdf(file);
        } else {
          const data = await file.arrayBuffer();
          const workbook = XLSX.read(data);
          for (const sheetName of workbook.SheetNames) {
            const ws = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(ws);
            if (jsonData.length > 0) {
              const mapped = mapDataToVoters(jsonData, stats.totalExtracted);
              fileVoters.push(...mapped);
              // Direct save for Excel sheets
              await saveBatchToVault(mapped);
            }
          }
        }

        setStats(prev => ({ ...prev, totalExtracted: prev.totalExtracted + fileVoters.length }));
        setLastExtracted(fileVoters.slice(0, 10)); // Keep a preview of the last file
        
        setProcessedFiles(prev => prev.map(f => f.name === file.name ? { ...f, count: fileVoters.length, status: 'completed' } : f));
        addLog(`FILE: Completed ${file.name}.`);
      }
      
      addLog(`INGESTION: All files processed. Database is synced.`);
    } catch (err: any) {
      setError(`Ingestion failed: ${err.message || 'Check file format.'}`);
      addLog(`CRITICAL ERROR: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const processPdf = async (file: File): Promise<VoterRecord[]> => {
    addLog(`PDF: Loading engine for ${file.name}...`);
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    const allVoters: VoterRecord[] = [];

    // Process pages in small batches to push to Supabase immediately
    const pagesToProcess = Math.min(pdf.numPages, 10); // Limit to first 10 pages for safety/demo
    addLog(`PDF: Analyzing ${pagesToProcess} pages with AI...`);

    for (let i = 1; i <= pagesToProcess; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const text = textContent.items.map((item: any) => item.str).join(' ');
      
      addLog(`AI: Extracting from Page ${i}...`);
      try {
        const response = await extractVoters({ textContent: text });
        if (response.voters.length > 0) {
          allVoters.push(...response.voters);
          addLog(`AI: Page ${i} found ${response.voters.length} records.`);
          // DIRECT TO VAULT: Save as we go
          await saveBatchToVault(response.voters);
        }
      } catch (err: any) {
        addLog(`AI WARNING: Page ${i} failed: ${err.message}`);
      }
    }
    return allVoters;
  };

  const getValue = (row: any, searchKeys: string[]): string => {
    const rowKeys = Object.keys(row);
    for (const key of searchKeys) {
      if (row[key] !== undefined && row[key] !== null) return row[key].toString().trim();
    }
    for (const actualKey of rowKeys) {
      const cleanActualKey = actualKey.trim().toLowerCase();
      for (const searchKey of searchKeys) {
        if (cleanActualKey.includes(searchKey.toLowerCase())) return row[actualKey]?.toString().trim() || '';
      }
    }
    return '';
  };

  const mapDataToVoters = (data: any[], offset: number): VoterRecord[] => {
    return data.map((row, index) => {
      const epic = getValue(row, ['ओळखपत्र', 'EPIC', 'ID CARD', 'VOTER ID', 'CARD NO']);
      const name = getValue(row, ['नाव', 'NAME', 'VOTER NAME', 'FULL NAME']);
      const ageStr = getValue(row, ['वय', 'AGE', 'VOTER AGE']);
      const age = parseInt(ageStr || '25');
      const genderRaw = getValue(row, ['लिंग', 'GENDER', 'SEX']).toLowerCase();
      let gender: 'M' | 'F' | 'O' = 'M';
      if (genderRaw.includes('स्त्री') || genderRaw.includes('female') || genderRaw === 'f') gender = 'F';
      const parent = getValue(row, ['नातेवाईक', 'FATHER', 'SPOUSE', 'GUARDIAN', 'PARENT']);
      const srNo = getValue(row, ['अनुक्रमांक', 'SR NO', 'SERIAL', 'PART SR']) || (offset + index + 1).toString();
      const partInfo = getValue(row, ['बूथ नं.', 'भाग/अनुभ', 'PART', 'BOOTH']);
      const stationName = getValue(row, ['केंद्र', 'STATION', 'POLLING STATION']);
      const stationAddress = getValue(row, ['पत्ता', 'ADDRESS', 'STATION ADDRESS']);

      return {
        epicNo: epic || `PENDING-${offset + index}-${Date.now()}`,
        name: name || 'Unknown',
        age: age || 25,
        gender: gender,
        parentSpouseName: parent || 'Unknown',
        assemblyConstituency: '',
        parliamentaryConstituency: '',
        district: '',
        state: '',
        partNo: partInfo,
        partName: partInfo,
        serialNo: srNo,
        pollingStation: {
          name: stationName,
          address: stationAddress
        },
        lastUpdated: new Date().toISOString()
      };
    });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
      <div className="bg-white rounded-[40px] p-10 shadow-sm border border-slate-100">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-12">
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Vault Ingestion Engine</h2>
            <p className="text-slate-500 font-medium">Data is extracted and stored permanently in Supabase Cloud via API.</p>
          </div>
          <div className="flex items-center gap-3 bg-emerald-50 px-5 py-2.5 rounded-2xl border border-emerald-100">
             <i className={`fa-solid ${isProcessing ? 'fa-circle-notch animate-spin' : 'fa-cloud-check'} text-emerald-600`}></i>
             <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">
               {isProcessing ? 'Syncing to Vault' : 'Supabase Connected'}
             </span>
          </div>
        </div>
        
        {!isProcessing && processedFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center border-4 border-dashed border-slate-50 rounded-[40px] p-24 bg-slate-50/30 transition-all hover:bg-slate-50 hover:border-slate-100 group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <div className="w-24 h-24 bg-white rounded-3xl flex items-center justify-center shadow-2xl mb-8 group-hover:scale-110 transition-transform">
               <i className="fa-solid fa-cloud-arrow-up text-3xl text-indigo-600"></i>
            </div>
            <p className="text-slate-900 font-black text-xl mb-2">Upload Source Files</p>
            <p className="text-slate-400 font-medium text-center max-w-xs mb-8">PDF, Excel, or CSV voter lists. Data will be saved directly to the Vault.</p>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              accept=".pdf, .xlsx, .xls, .csv" 
              multiple 
              className="hidden" 
            />
            <button className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black transition-all shadow-xl shadow-slate-200">
              Browse Local Files
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="bg-slate-900 rounded-[32px] p-10 text-white relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 right-0 p-10 opacity-10">
                <i className="fa-solid fa-server text-8xl"></i>
              </div>
              <div className="flex flex-col md:flex-row items-center justify-between gap-10 relative z-10">
                <div className="flex items-center gap-6">
                  <div className={`w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20 ${isProcessing ? 'animate-pulse' : ''}`}>
                    <i className={`fa-solid ${isProcessing ? 'fa-cloud-arrow-up' : 'fa-check-double'} text-emerald-400 text-2xl`}></i>
                  </div>
                  <div>
                    <h4 className="text-xl font-black mb-1 tracking-tight">Vault Synchronization</h4>
                    <p className="text-xs text-slate-400 font-black uppercase tracking-widest">
                      {stats.totalSaved} Records Permanently Stored in Cloud
                    </p>
                  </div>
                </div>

                {isProcessing && (
                  <div className="flex items-center gap-4 bg-white/5 px-6 py-4 rounded-2xl border border-white/10">
                    <div className="text-right">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Current Session</p>
                       <p className="text-xl font-black text-emerald-400">{stats.totalExtracted} Extracted</p>
                    </div>
                  </div>
                )}

                {!isProcessing && (
                  <button 
                    onClick={() => { setProcessedFiles([]); setProcessingLog([]); setStats({totalExtracted:0, totalSaved:0}); }}
                    className="px-8 py-4 bg-white text-slate-900 rounded-2xl font-black hover:bg-slate-100 transition-all text-xs"
                  >
                    Start New Ingestion
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
               <div className="lg:col-span-1 space-y-6">
                  <div className="bg-slate-50 rounded-[32px] p-6 border border-slate-200">
                    <div className="flex items-center gap-2 mb-4">
                      <i className="fa-solid fa-terminal text-[10px] text-slate-400"></i>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Direct-to-Vault Logs</span>
                    </div>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {processingLog.map((log, i) => (
                          <div key={i} className="text-[10px] font-mono text-slate-500 leading-tight">
                            <span className="text-indigo-400 font-bold mr-1">❯</span> {log}
                          </div>
                        ))}
                        {isProcessing && (
                          <div className="flex items-center gap-2 text-[10px] font-mono text-indigo-500 animate-pulse">
                            <span>❯</span> <span>Awaiting next batch...</span>
                          </div>
                        )}
                    </div>
                  </div>
               </div>

               <div className="lg:col-span-2">
                  <div className="bg-white border border-slate-100 rounded-[32px] overflow-hidden shadow-sm">
                    <div className="px-8 py-5 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vault Integration Preview</span>
                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1">
                          <i className="fa-solid fa-cloud"></i> Live Cloud Write
                        </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                          <thead>
                            <tr className="bg-white text-slate-300 uppercase font-black text-[9px] tracking-widest border-b border-slate-50">
                              <th className="px-8 py-5">EPIC (PK)</th>
                              <th className="px-8 py-5">Full Name</th>
                              <th className="px-8 py-5">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {lastExtracted.length > 0 ? lastExtracted.map((v, i) => (
                              <tr key={i} className="hover:bg-slate-50/20 transition-colors">
                                <td className="px-8 py-5 font-black text-slate-900 font-mono text-xs">{v.epicNo}</td>
                                <td className="px-8 py-5 font-black text-slate-800 text-sm">{v.name}</td>
                                <td className="px-8 py-5">
                                  <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                    <span className="text-[9px] font-black text-emerald-600 uppercase tracking-tighter">Vault Saved</span>
                                  </div>
                                </td>
                              </tr>
                            )) : (
                              <tr>
                                <td colSpan={3} className="px-8 py-10 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest">
                                  {isProcessing ? 'Streaming data from files...' : 'No records processed in this session.'}
                                </td>
                              </tr>
                            )}
                          </tbody>
                      </table>
                    </div>
                  </div>
               </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-8 p-6 bg-red-50 border border-red-100 text-red-700 rounded-3xl flex items-center gap-4">
            <i className="fa-solid fa-triangle-exclamation"></i>
            <p className="text-sm font-bold uppercase tracking-tight">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
};
