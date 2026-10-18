export type UserRole = 'PATIENT' | 'PRACTITIONER' | 'ADMIN';

export type BookingStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'ON_THE_WAY'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED_PATIENT'
  | 'CANCELLED_DOCTOR';

export type TxType =
  | 'DEPOSIT'
  | 'LOCK_COMMISSION'
  | 'DEDUCT_COMMISSION'
  | 'REFUND_LOCK';

export interface Profile {
  id: string;
  phone: string;
  password_hash: string;
  full_name: string;
  avatar_url?: string | null;
  default_address?: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PractitionerProfile {
  id: string;
  user_id: string;
  specialties: string[];
  license_number: string;
  license_image_url: string;
  issued_by: string;
  years_of_experience: number;
  bio?: string | null;
  base_service_fee: number;
  commission_rate: number;
  is_verified: boolean;
  rejection_reason?: string | null;
  is_online: boolean;
  current_lat?: number;
  current_lng?: number;
  rating_avg: number;
  total_reviews: number;
  completed_jobs: number;
  cancelled_jobs: number;
  updated_at: string;
  // Join helper
  profile?: Profile;
}

export interface Wallet {
  id: string;
  user_id: string;
  available_balance: number;
  locked_balance: number;
  updated_at: string;
}

export interface Booking {
  id: string;
  booking_code: string;
  patient_id: string;
  practitioner_id: string | null;
  service_name: string;
  address: string;
  patient_phone: string;
  lat: number;
  lng: number;
  symptom_notes?: string | null;
  appointment_time: string;
  service_fee: number;
  travel_surcharge: number;
  commission_rate: number;
  commission_amount: number;
  status: BookingStatus;
  medical_diagnosis?: string | null;
  treatment_notes?: string | null;
  doctor_advice?: string | null;
  patient_rating?: number | null;
  patient_review?: string | null;
  checkin_lat?: number | null;
  checkin_lng?: number | null;
  checkin_distance_meters?: number | null;
  cancelled_at?: string | null;
  cancel_reason?: string | null;
  created_at: string;
  updated_at: string;

  // Joined fields for display
  patient?: Profile;
  practitioner?: Profile & { practitioner_profile?: PractitionerProfile };
}

export interface WalletTransaction {
  id: string;
  wallet_id: string;
  booking_id?: string | null;
  amount: number;
  type: TxType;
  balance_after: number;
  description?: string | null;
  created_at: string;
}

export interface ServiceItem {
  id: string;
  name: string;
  price: number;
  description?: string | null;
  duration_minutes?: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}
