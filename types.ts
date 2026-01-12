
export interface VoterRecord {
  epicNo: string;
  name: string;
  age: number;
  gender: 'M' | 'F' | 'O';
  parentSpouseName: string;
  assemblyConstituency: string;
  parliamentaryConstituency: string;
  district: string;
  state: string;
  partNo: string;
  partName: string;
  serialNo: string;
  pollingStation: {
    name: string;
    address: string;
  };
  lastUpdated: string;
}

export type AppView = 'SEARCH' | 'PROCESS' | 'DATABASE';

export interface ExtractionResponse {
  voters: VoterRecord[];
  meta?: {
    assemblyConstituency?: string;
    parliamentaryConstituency?: string;
    district?: string;
    state?: string;
    partNo?: string;
    partName?: string;
    pollingStation?: {
      name: string;
      address: string;
    };
  };
}
