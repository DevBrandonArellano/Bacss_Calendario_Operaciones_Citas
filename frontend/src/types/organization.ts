export interface ModuleActivation {
  id: string;
  module_code: string;
  is_active: boolean;
  config: Record<string, unknown>;
  activated_at: string;
  deactivated_at: string | null;
}

export interface Organization {
  id: string;
  name: string;
  legal_name: string;
  tax_id: string;
  timezone: string;
  default_currency: string;
  date_format: string;
  logo_url: string;
  status: string;
  settings: Record<string, unknown>;
  modules: ModuleActivation[];
}
