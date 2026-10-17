export interface Uom {
  id: string;
  tenant_id: string;
  code: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Currency {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  symbol: string | null;
  is_base_currency: boolean;
  exchange_rate_to_base: number;
  effective_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type CostCodeCategory = "labour" | "material" | "plant" | "subcontract" | "overhead";

export interface CostCode {
  id: string;
  tenant_id: string;
  parent_id: string | null;
  code: string;
  description: string | null;
  category: CostCodeCategory;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DocumentType {
  id: string;
  tenant_id: string;
  code: string;
  label: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface NumberingScheme {
  id: string;
  tenant_id: string;
  entity_type: string;
  prefix: string;
  suffix: string;
  next_sequence: number;
  padding: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
