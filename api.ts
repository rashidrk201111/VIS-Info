
import { createClient } from '@supabase/supabase-js';
import { VoterRecord } from './types';

/**
 * SUPABASE CONFIGURATION
 * Connected to Project: xdrmvswdwhjewemgwtof
 */
const SUPABASE_URL = 'https://xdrmvswdwhjewemgwtof.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhkcm12c3dkd2hqZXdlbWd3dG9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyMjE0MTcsImV4cCI6MjA4Mzc5NzQxN30.WHmBrLBUHT1Lt-BSyd4Ni9cbJmF3f2sCiOwwX-HVEdk';

// Initialize the Supabase Client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const TABLE_NAME = 'voters_table';

export const VoterApi = {
  /**
   * VERIFY Connection & Table Existence
   */
  testConnection: async (): Promise<{ success: boolean; message: string }> => {
    try {
      const { data, error, count } = await supabase
        .from(TABLE_NAME)
        .select('*', { count: 'exact', head: true });
      
      if (error) throw error;
      return { success: true, message: `Connected to Supabase. Table "${TABLE_NAME}" found.` };
    } catch (err: any) {
      console.error('Connection Test Failed:', err);
      return { success: false, message: err.message || 'Could not reach Supabase table.' };
    }
  },

  /**
   * GET all voters from Supabase
   */
  getVoters: async (): Promise<VoterRecord[]> => {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .order('lastUpdated', { ascending: false });

    if (error) {
      console.error('Supabase fetch error:', error);
      throw new Error(error.message);
    }
    return data || [];
  },

  /**
   * UPSERT voters (Insert or Update if EPIC No exists)
   */
  bulkCreate: async (voters: VoterRecord[]): Promise<{ success: boolean; count: number }> => {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .upsert(voters, { onConflict: 'epicNo' });

    if (error) {
      console.error('Supabase upsert error:', error);
      throw new Error(error.message);
    }

    return { success: true, count: voters.length };
  },

  /**
   * DELETE a specific voter record
   */
  deleteVoter: async (epicNo: string): Promise<void> => {
    const { error } = await supabase
      .from(TABLE_NAME)
      .delete()
      .eq('epicNo', epicNo);

    if (error) {
      console.error('Supabase delete error:', error);
      throw new Error(error.message);
    }
  },

  /**
   * TRUNCATE table logic (Delete all records)
   */
  truncateTable: async (): Promise<void> => {
    const { error } = await supabase
      .from(TABLE_NAME)
      .delete()
      .neq('epicNo', 'TRUNCATE_PLACEHOLDER_ZERO');

    if (error) {
      console.error('Supabase clear error:', error);
      throw new Error(error.message);
    }
  },

  /**
   * SEARCH voters using PostgreSQL Full Text or ILIKE
   */
  search: async (query: string): Promise<VoterRecord[]> => {
    if (!query) return [];
    
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .or(`name.ilike.%${query}%,epicNo.ilike.%${query}%`)
      .limit(50);

    if (error) {
      console.error('Supabase search error:', error);
      throw new Error(error.message);
    }

    return data || [];
  },

  /**
   * EXPORT entire database to JSON
   */
  exportSqlDump: async () => {
    const data = await VoterApi.getVoters();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SUPABASE_BACKUP_${new Date().getTime()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  /**
   * IMPORT JSON backup
   */
  importSqlDump: async (file: File) => {
    const text = await file.text();
    const data = JSON.parse(text) as VoterRecord[];
    return await VoterApi.bulkCreate(data);
  }
};
