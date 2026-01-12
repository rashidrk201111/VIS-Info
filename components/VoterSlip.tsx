
import React, { useState } from 'react';
import { VoterRecord } from '../types';
import { VoterApi } from '../api';
import { verifyVoterRecord } from '../geminiService';

interface VoterSlipProps {
  voter: VoterRecord;
  onClose?: () => void;
  onDelete?: (epicNo: string) => void;
}

export const VoterSlip: React.FC<VoterSlipProps> = ({ voter, onClose, onDelete }) => {
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{text: string, sources: any[]} | null>(null);

  const handlePrint = () => {
    window.print();
  };

  const handleVerify = async () => {
    setIsVerifying(true);
    try {
      const result = await verifyVoterRecord(voter);
      setVerificationResult(result);
    } catch (err: any) {
      const msg = err?.message || "";
      // According to GenAI guidelines: If the request fails with 'Requested entity was not found.', prompt the user to select a key again via openSelectKey()
      if (msg.includes("Requested entity was not found")) {
        try {
          // @ts-ignore
          await window.aistudio.openSelectKey();
        } catch (e) {
          console.error("Failed to open key selection dialog", e);
        }
      } else {
        alert("Verification service failed. Please check your API connectivity.");
      }
    } finally {
      setIsVerifying(false);
    }
  };

  // Fixed: Replaced deprecated db.deleteVoter with VoterApi.deleteVoter and made the function async
  const handleDelete = async () => {
    if (confirm(`Are you sure you want to delete the record for ${voter.name} (${voter.epicNo})?`)) {
      await VoterApi.deleteVoter(voter.epicNo);
      if (onDelete) onDelete(voter.epicNo);
      if (onClose) onClose();
    }
  };

  return (
    <div className="bg-white p-4 max-w-sm mx-auto shadow-2xl border border-gray-100 rounded-lg overflow-hidden relative">
      <div className="flex justify-between items-center mb-4 no-print relative z-10">
        <button 
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <i className="fa-solid fa-xmark text-xl"></i>
        </button>
        <div className="flex gap-2">
          <button 
            onClick={handleVerify}
            disabled={isVerifying}
            className={`px-3 py-1 rounded-full text-xs font-black transition-all flex items-center gap-2 ${
              isVerifying ? 'bg-slate-100 text-slate-400' : 'bg-amber-50 text-amber-600 hover:bg-amber-100'
            }`}
          >
            <i className={`fa-solid ${isVerifying ? 'fa-spinner animate-spin' : 'fa-shield-check'}`}></i>
            {isVerifying ? 'Verifying...' : 'Verify API'}
          </button>
          <button 
            onClick={handleDelete}
            className="bg-red-50 text-red-600 px-3 py-1 rounded-full text-xs font-black hover:bg-red-100 transition-all flex items-center gap-2"
          >
            <i className="fa-solid fa-trash-can"></i>
          </button>
          <button 
            onClick={handlePrint}
            className="bg-indigo-600 text-white px-4 py-1 rounded-full text-xs font-black hover:bg-indigo-700 transition-all flex items-center gap-2"
          >
            <i className="fa-solid fa-print"></i>
          </button>
        </div>
      </div>

      <div className="voter-slip-content border-t-4 border-indigo-600 pt-6 relative">
        {verificationResult && (
          <div className="mb-4 p-3 bg-amber-50 rounded-xl border border-amber-100 text-[10px] no-print">
             <p className="font-black text-amber-800 uppercase tracking-widest mb-1 flex items-center gap-1">
               <i className="fa-solid fa-globe"></i> Grounding Verification Result
             </p>
             <p className="text-amber-700 leading-relaxed italic">{verificationResult.text}</p>
             {verificationResult.sources.length > 0 && (
               <div className="mt-2 flex flex-wrap gap-1">
                 {verificationResult.sources.map((chunk: any, i: number) => (
                    chunk.web && <a key={i} href={chunk.web.uri} target="_blank" className="bg-white px-2 py-0.5 rounded border border-amber-200 text-indigo-500 hover:underline">Source</a>
                 ))}
               </div>
             )}
          </div>
        )}

        <div className="flex flex-col items-center mb-6">
          <h1 className="text-xs text-gray-400 font-medium uppercase tracking-widest">मतदाता हेल्पलाइन</h1>
        </div>

        <div className="mb-6 text-center">
          <div className="inline-block border-2 border-dashed border-gray-300 px-10 py-4 rounded-xl">
            <p className="text-2xl font-black text-gray-900 tracking-tight">{voter.epicNo}</p>
            <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mt-1">(EPIC NO.)</p>
          </div>
        </div>

        <div className="space-y-4 px-2 mb-8">
          <DetailRow label="Name" value={voter.name} />
          <DetailRow label="Age" value={voter.age.toString()} />
          <DetailRow label="Gender" value={voter.gender} />
          <DetailRow label="Parent/Spouse" value={voter.parentSpouseName} />
          <DetailRow label="Part Name" value={voter.partName} />
        </div>

        <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl mb-8">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">POLLING STATION</p>
           <p className="font-black text-slate-800 leading-tight mb-2">{voter.pollingStation.name || 'Station Not Specified'}</p>
           <p className="text-xs text-slate-500 font-medium">{voter.pollingStation.address || 'Address Not Specified'}</p>
        </div>

        <div className="pt-6 border-t border-slate-100 flex justify-between items-start mb-6">
          <div>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">REFERENCE</p>
            <p className="text-xs text-slate-900 font-black">#VIS-{voter.serialNo || voter.epicNo.slice(-4)}</p>
          </div>
          <div className="text-right">
             <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">VERIFIED</p>
             <p className={`text-xs font-black ${verificationResult ? 'text-emerald-600' : 'text-slate-500'}`}>
               {verificationResult ? 'SUCCESS' : 'PENDING'}
             </p>
          </div>
        </div>

        {/* Detailed 3D Diamond Icon Section at the absolute bottom */}
        <div className="flex justify-center pt-2 pb-4">
          <svg viewBox="0 0 100 80" className="w-24 h-auto text-slate-900 opacity-90" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
            {/* The Crown (Top Part) */}
            <path d="M15 30 L50 5 L85 30 L50 35 L15 30 Z" />
            <path d="M15 30 L30 15 L50 5 L70 15 L85 30" />
            <path d="M30 15 L50 22 L70 15" />
            <path d="M50 5 L50 22" />
            <path d="M15 30 L50 22" />
            <path d="M85 30 L50 22" />
            
            {/* The Girdle (Middle Line) */}
            <path d="M5 30 L15 30 L50 35 L85 30 L95 30" strokeWidth="1.5" />
            <path d="M5 30 L20 10 L50 5 L80 10 L95 30" />
            <path d="M5 30 L50 5 L95 30" opacity="0.3" />
            
            {/* The Pavilion (Bottom Part) */}
            <path d="M5 30 L50 75 L95 30" />
            <path d="M15 30 L50 75 L85 30" />
            <path d="M50 35 L50 75" />
            <path d="M50 35 L30 45 L50 75 L70 45 L50 35" />
            <path d="M15 30 L30 45" />
            <path d="M85 30 L70 45" />
            <path d="M5 30 L30 45" strokeOpacity="0.3" />
            <path d="M95 30 L70 45" strokeOpacity="0.3" />
            
            {/* Additional Facets for Detail */}
            <path d="M30 15 L15 30" />
            <path d="M70 15 L85 30" />
          </svg>
        </div>
      </div>
    </div>
  );
};

const DetailRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex justify-between items-center gap-4">
    <span className="text-slate-500 font-bold text-sm">{label}</span>
    <span className="text-slate-900 font-black text-right">{value || 'N/A'}</span>
  </div>
);
