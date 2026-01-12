
import { createWorker } from 'tesseract.js';
import { VoterRecord } from './types';

/**
 * Legacy OCR function. Primarily replaced by Excel/Sheet processing.
 */
export async function extractVotersOffline(
  imageSource: string | HTMLCanvasElement, 
  onProgress?: (progress: number) => void
): Promise<VoterRecord[]> {
  const worker = await createWorker('eng+mar', 1, {
    logger: m => {
      if (m.status === 'recognizing text' && onProgress) {
        onProgress(m.progress);
      }
    }
  });

  const { data: { text } } = await worker.recognize(imageSource);
  await worker.terminate();

  return parseVoterText(text);
}

function parseVoterText(text: string): VoterRecord[] {
  const lines = text.split('\n');
  const voters: VoterRecord[] = [];
  const epicRegex = /[A-Z]{3}[0-9]{7}/;
  
  lines.forEach((line, index) => {
    const epicMatch = line.match(epicRegex);
    if (epicMatch) {
      const epicNo = epicMatch[0];
      const serialMatch = line.match(/(\d+)/);
      const nameLine = lines[index + 1] || '';
      const parentLine = lines[index + 2] || '';

      // Fix: Removed 'id' property as it does not exist on VoterRecord type (line 40)
      voters.push({
        epicNo: epicNo,
        name: nameLine.replace(/[0-9]/g, '').trim() || 'Extracted Name',
        age: parseInt(line.match(/Age:\s*(\d+)/i)?.[1] || '0') || 25,
        gender: line.toLowerCase().includes('female') ? 'F' : 'M',
        parentSpouseName: parentLine.trim() || 'Unknown Parent',
        assemblyConstituency: '',
        parliamentaryConstituency: '',
        district: '',
        state: '',
        partNo: '',
        partName: '',
        serialNo: serialMatch ? serialMatch[1] : '0',
        pollingStation: { name: '', address: '' },
        lastUpdated: new Date().toISOString()
      });
    }
  });

  return voters;
}
