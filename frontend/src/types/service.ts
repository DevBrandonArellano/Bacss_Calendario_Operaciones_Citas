export type ServiceStatus = "active" | "inactive";

export interface Service {
  id: string;
  name: string;
  category: string;
  duration_minutes: number;
  price: string;
  status: ServiceStatus;
  branches: string[];
}

export type ServiceInput = Omit<Service, "id">;

export interface Employee {
  id: string;
  user: string | null;
  branch: string | null;
  first_name: string;
  last_name: string;
  full_name: string;
  specialty: string;
  is_active: boolean;
  services: string[];
}

export type EmployeeInput = Omit<Employee, "id" | "full_name">;
