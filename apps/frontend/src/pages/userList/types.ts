export interface PaginationState {
  page: number;
  per_page: number;
  total: number;
  pages: number;
}

export interface FormData {
  name: string;
  gender: string;
  class_name: string;
  phone: string;
  parent_info: string;
  father_name: string;
  father_phone: string;
  mother_name: string;
  mother_phone: string;
  guardian_name: string;
  guardian_phone: string;
  guardian_relation: string;
  card_id: string;
  current_score: number;
}

export interface Rule {
  id: number;
  name: string;
  score: number;
  description?: string;
  is_active: boolean;
  daily_limit?: number;
  min_interval?: number;
}
