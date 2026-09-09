export interface BlacklistEntry {
  id: number;
  phone: string | null;
  name: string | null;
  address: string | null;
  email: string | null;
  reason: string;
  severity: 'low' | 'medium' | 'high';
  created_at: string;
  added_by: string;
}

export interface CheckRequest {
  phone?: string;
  name?: string;
  address?: string;
  email?: string;
}

export interface CheckMatch {
  entry: BlacklistEntry;
  matched_fields: string[];
}

export interface CheckResult {
  matched: boolean;
  matches: CheckMatch[];
}

export interface CreateEntryRequest {
  phone?: string;
  name?: string;
  address?: string;
  email?: string;
  reason: string;
  severity?: 'low' | 'medium' | 'high';
  added_by?: string;
}

export interface ListQuery {
  page?: string;
  limit?: string;
  q?: string;
}
