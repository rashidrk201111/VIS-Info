/*
  # Create Voters Information System Table

  1. New Tables
    - `voters_table`
      - `epicNo` (text, primary key) - Unique EPIC voter ID
      - `name` (text) - Voter's full name
      - `age` (integer) - Voter's age
      - `gender` (text) - Gender (M/F/O)
      - `parentSpouseName` (text) - Name of parent or spouse
      - `assemblyConstituency` (text) - Assembly constituency name
      - `parliamentaryConstituency` (text) - Parliamentary constituency name
      - `district` (text) - District name
      - `state` (text) - State name
      - `partNo` (text) - Part number
      - `partName` (text) - Part name
      - `serialNo` (text) - Serial number in the list
      - `pollingStation` (jsonb) - Polling station details (name, address)
      - `lastUpdated` (timestamptz) - Last update timestamp
      - `created_at` (timestamptz) - Record creation timestamp

  2. Security
    - Enable Row Level Security (RLS) on `voters_table`
    - Add policy for public read access (for demo purposes)
    - Add policy for public insert/update access (for demo purposes)
    - Note: In production, these should be restricted to authenticated users only

  3. Indexes
    - Create index on epicNo for fast lookups
    - Create index on name for search functionality
    - Create GIN index on pollingStation JSONB field
*/

-- Create voters_table if it doesn't exist
CREATE TABLE IF NOT EXISTS voters_table (
  "epicNo" text PRIMARY KEY,
  name text NOT NULL,
  age integer NOT NULL DEFAULT 0,
  gender text NOT NULL DEFAULT 'O' CHECK (gender IN ('M', 'F', 'O')),
  "parentSpouseName" text NOT NULL DEFAULT '',
  "assemblyConstituency" text NOT NULL DEFAULT '',
  "parliamentaryConstituency" text NOT NULL DEFAULT '',
  district text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT '',
  "partNo" text NOT NULL DEFAULT '',
  "partName" text NOT NULL DEFAULT '',
  "serialNo" text NOT NULL DEFAULT '',
  "pollingStation" jsonb DEFAULT '{"name": "", "address": ""}'::jsonb,
  "lastUpdated" timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_voters_name ON voters_table USING btree (name);
CREATE INDEX IF NOT EXISTS idx_voters_epic ON voters_table USING btree ("epicNo");
CREATE INDEX IF NOT EXISTS idx_voters_polling_station ON voters_table USING gin ("pollingStation");

-- Enable Row Level Security
ALTER TABLE voters_table ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read access" ON voters_table;
DROP POLICY IF EXISTS "Allow public insert access" ON voters_table;
DROP POLICY IF EXISTS "Allow public update access" ON voters_table;
DROP POLICY IF EXISTS "Allow public delete access" ON voters_table;

-- Create policies for public access (suitable for demo/development)
-- Note: In production, restrict these to authenticated users with proper checks
CREATE POLICY "Allow public read access"
  ON voters_table
  FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert access"
  ON voters_table
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update access"
  ON voters_table
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access"
  ON voters_table
  FOR DELETE
  USING (true);