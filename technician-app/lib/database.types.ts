export type Profile = {
  id: string;
  company_id: string;
  role: 'owner' | 'admin' | 'technician' | 'operations';
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
};

export type Property = {
  id: string;
  company_id: string;
  customer_name: string;
  address: string;
  gate_code: string | null;
  pool_type: string | null;
  pool_surface: string | null;
};

export type ServiceJob = {
  id: string;
  company_id: string;
  property_id: string;
  technician_id: string | null;
  scheduled_date: string;
  scheduled_time: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'cancelled';
  route_order: number | null;
  estimated_duration_min: number;
  properties?: Property | null;
};
