'use client';

import React, { useState, useEffect } from 'react';
import {
  Stethoscope,
  ShieldCheck,
  User,
  LogOut,
  Sparkles,
  Database,
  ArrowRightLeft,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import {
  Profile,
  PractitionerProfile,
  Booking,
  Wallet,
  WalletTransaction,
} from '@/types/database';
import {
  INITIAL_PROFILES,
  INITIAL_PRACTITIONERS,
  INITIAL_WALLETS,
  INITIAL_BOOKINGS,
  INITIAL_TRANSACTIONS,
} from '@/lib/mock-data';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import AuthPortal from '@/components/AuthPortal';
import PatientView from '@/components/PatientView';
import PractitionerView from '@/components/PractitionerView';
import AdminView from '@/components/AdminView';

export default function Home() {
  // Master state
  const [profiles, setProfiles] = useState<Profile[]>(INITIAL_PROFILES);
  const [practitioners, setPractitioners] = useState<Record<string, PractitionerProfile>>(
    INITIAL_PRACTITIONERS
  );
  const [wallets, setWallets] = useState<Record<string, Wallet>>(INITIAL_WALLETS);
  const [bookings, setBookings] = useState<Booking[]>(INITIAL_BOOKINGS);
  const [transactions, setTransactions] = useState<WalletTransaction[]>(INITIAL_TRANSACTIONS);

  // Auth state
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [currentPractitioner, setCurrentPractitioner] = useState<PractitionerProfile | null>(null);

  // Supabase live status
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false);
  const [dbTablesExist, setDbTablesExist] = useState<boolean>(false);
  const [connectionNote, setConnectionNote] = useState<string>('Khởi tạo');
  const [isCheckingDb, setIsCheckingDb] = useState<boolean>(false);
  const [showDbModal, setShowDbModal] = useState<boolean>(false);

  // Check Supabase connection and tables
  const checkSupabaseConnection = async () => {
    setIsCheckingDb(true);
    if (!isSupabaseConfigured) {
      setConnectionNote('Chế độ Local State (Cần thêm Supabase Anon Key vào .env.local để đồng bộ Cloud)');
      setIsCheckingDb(false);
      return;
    }

    try {
      setConnectionNote('Đang kiểm tra kết nối Supabase Cloud hvkwepswkgqnbneqagno...');
      const { data: profData, error: profErr } = await supabase.from('profiles').select('*');

      if (profErr) {
        if (profErr.code === 'PGRST205') {
          setDbTablesExist(false);
          setIsLiveConnected(false);
          setConnectionNote('Key hợp lệ! Database chưa có bảng (Cần chạy file SQL trên Supabase)');
        } else {
          setConnectionNote(`Lỗi truy vấn: ${profErr.message}`);
          setIsLiveConnected(false);
        }
        setIsCheckingDb(false);
        return;
      }

      // Tables exist!
      setDbTablesExist(true);
      setIsLiveConnected(true);
      setConnectionNote('Đã kết nối Supabase Cloud hvkwepswkgqnbneqagno (Đồng bộ trực tiếp)');

      if (profData && profData.length > 0) {
        setProfiles(profData);

        // Fetch practitioner profiles
        const { data: pracData } = await supabase.from('practitioner_profiles').select('*');
        const pracMap: Record<string, PractitionerProfile> = {};
        if (pracData) {
          pracData.forEach((p) => {
            pracMap[p.user_id] = p;
          });
          setPractitioners(pracMap);
        }

        // Keep currentUser and currentPractitioner fresh if they exist
        setCurrentUser((prevCur) => {
          if (!prevCur) return null;
          const updated = profData.find((p) => p.id === prevCur.id);
          return updated || prevCur;
        });

        setCurrentPractitioner((prevPrac) => {
          if (!prevPrac) return null;
          return pracMap[prevPrac.user_id] || prevPrac;
        });

        // Fetch wallets
        const { data: walletData } = await supabase.from('wallets').select('*');
        if (walletData) {
          const wMap: Record<string, Wallet> = {};
          walletData.forEach((w) => {
            wMap[w.user_id] = w;
          });
          setWallets(wMap);
        }

        // Fetch bookings
        const { data: bData } = await supabase
          .from('bookings')
          .select('*')
          .order('created_at', { ascending: false });
        if (bData) {
          setBookings(bData);
        }

        // Fetch wallet transactions
        const { data: txData } = await supabase
          .from('wallet_transactions')
          .select('*')
          .order('created_at', { ascending: false });
        if (txData) {
          setTransactions(txData);
        }
      }
    } catch (err: unknown) {
      console.warn('Supabase connect error fallback:', err);
      setIsLiveConnected(false);
      setConnectionNote('Chế độ Local Fallback (Vui lòng chạy SQL trên Supabase Dashboard)');
    } finally {
      setIsCheckingDb(false);
    }
  };

  useEffect(() => {
    checkSupabaseConnection();

    // Supabase Realtime Listener for ALL tables
    if (isSupabaseConfigured) {
      const channel = supabase
        .channel('public:realtime_sync')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'profiles' },
          (payload) => {
            console.log('Realtime Profile Change detected:', payload);
            checkSupabaseConnection();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'practitioner_profiles' },
          (payload) => {
            console.log('Realtime Practitioner Change detected:', payload);
            checkSupabaseConnection();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'wallets' },
          (payload) => {
            console.log('Realtime Wallet Change detected:', payload);
            checkSupabaseConnection();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'bookings' },
          (payload) => {
            console.log('Realtime Booking Change detected:', payload);
            checkSupabaseConnection();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, []);

  // Quick switch user helper for testing 1-1 isolation
  const handleQuickSwitchUser = (phone: string) => {
    const user = profiles.find((p) => p.phone === phone);
    if (user) {
      setCurrentUser(user);
      setCurrentPractitioner(practitioners[user.id] || null);
    }
  };

  // 1. Patient Register
  const handleRegisterPatient = async (data: {
    fullName: string;
    phone: string;
    password: string;
    address: string;
  }) => {
    const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : '11111111-1111-1111-1111-' + Date.now().toString().slice(-12).padStart(12, '0');
    const newProfile: Profile = {
      id: newId,
      phone: data.phone,
      password_hash: data.password,
      full_name: data.fullName,
      default_address: data.address,
      role: 'PATIENT',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setProfiles((prev) => [newProfile, ...prev]);
    setCurrentUser(newProfile);
    setCurrentPractitioner(null);

    if (isLiveConnected) {
      try {
        await supabase.from('profiles').insert([newProfile]);
      } catch (e) {
        console.error('Supabase insert profile error:', e);
      }
    }
  };

  // 2. Practitioner Register (eKYC Legal requirements)
  const handleRegisterPractitioner = async (data: {
    fullName: string;
    phone: string;
    password: string;
    specialties: string[];
    baseFee: number;
    licenseNumber: string;
    issuedBy: string;
    licenseImageUrl: string;
  }) => {
    const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : '22222222-2222-2222-2222-' + Date.now().toString().slice(-12).padStart(12, '0');
    const newPracId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : '33333333-3333-3333-3333-' + Date.now().toString().slice(-12).padStart(12, '0');
    const newWalletId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : '44444444-4444-4444-4444-' + Date.now().toString().slice(-12).padStart(12, '0');

    const newProfile: Profile = {
      id: newId,
      phone: data.phone,
      password_hash: data.password,
      full_name: data.fullName,
      role: 'PRACTITIONER',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const newPractitioner: PractitionerProfile = {
      id: newPracId,
      user_id: newId,
      specialties: data.specialties,
      license_number: data.licenseNumber,
      license_image_url: data.licenseImageUrl,
      issued_by: data.issuedBy,
      years_of_experience: 5,
      base_service_fee: data.baseFee,
      commission_rate: 15.0,
      is_verified: false, // BẮT BUỘC CHỜ ADMIN DUYỆT
      is_online: false,
      rating_avg: 5.0,
      total_reviews: 0,
      completed_jobs: 0,
      cancelled_jobs: 0,
      updated_at: new Date().toISOString(),
    };

    const newWallet: Wallet = {
      id: newWalletId,
      user_id: newId,
      available_balance: 0,
      locked_balance: 0,
      updated_at: new Date().toISOString(),
    };

    setProfiles((prev) => [newProfile, ...prev]);
    setPractitioners((prev) => ({ ...prev, [newId]: newPractitioner }));
    setWallets((prev) => ({ ...prev, [newId]: newWallet }));

    setCurrentUser(newProfile);
    setCurrentPractitioner(newPractitioner);

    if (isLiveConnected) {
      try {
        await supabase.from('profiles').insert([newProfile]);
        await supabase.from('practitioner_profiles').insert([newPractitioner]);
        await supabase.from('wallets').insert([newWallet]);
      } catch (e) {
        console.error('Supabase register practitioner error:', e);
      }
    }
  };

  // 3. Create Booking
  const handleCreateBooking = async (newBooking: Partial<Booking>) => {
    const bookingId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : '55555555-5555-5555-5555-' + Date.now().toString().slice(-12).padStart(12, '0');
    const bookingFull: Booking = {
      id: bookingId,
      booking_code: newBooking.booking_code || `KB-${Date.now().toString().slice(-6)}`,
      patient_id: newBooking.patient_id!,
      practitioner_id: newBooking.practitioner_id || null,
      service_name: newBooking.service_name || 'Khám chữa bệnh tại nhà',
      address: newBooking.address || '',
      patient_phone: newBooking.patient_phone || '',
      lat: newBooking.lat || 10.7769,
      lng: newBooking.lng || 106.7009,
      symptom_notes: newBooking.symptom_notes || '',
      appointment_time: newBooking.appointment_time || new Date().toISOString(),
      service_fee: newBooking.service_fee || 400000,
      travel_surcharge: newBooking.travel_surcharge || 30000,
      commission_rate: newBooking.commission_rate || 15.0,
      commission_amount: newBooking.commission_amount || 60000,
      status: 'PENDING',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setBookings((prev) => [bookingFull, ...prev]);

    if (isLiveConnected) {
      try {
        await supabase.from('bookings').insert([bookingFull]);
      } catch (e) {
        console.error('Supabase insert booking error:', e);
      }
    }
  };

  // 4. Accept Booking (RPC accept_booking_with_escrow logic)
  const handleAcceptBooking = async (bookingId: string): Promise<boolean> => {
    const targetBooking = bookings.find((b) => b.id === bookingId);
    if (!targetBooking || !currentUser) return false;

    const userWallet = wallets[currentUser.id];
    if (!userWallet || userWallet.available_balance < targetBooking.commission_amount) {
      return false;
    }

    // Escrow lock: reduce available, increase locked
    const newAvail = userWallet.available_balance - targetBooking.commission_amount;
    const newLock = userWallet.locked_balance + targetBooking.commission_amount;

    setWallets((prev) => ({
      ...prev,
      [currentUser.id]: {
        ...userWallet,
        available_balance: newAvail,
        locked_balance: newLock,
        updated_at: new Date().toISOString(),
      },
    }));

    setBookings((prev) =>
      prev.map((b) =>
        b.id === bookingId
          ? {
              ...b,
              practitioner_id: currentUser.id,
              status: 'CONFIRMED',
              updated_at: new Date().toISOString(),
            }
          : b
      )
    );

    const newTx: WalletTransaction = {
      id: `tx-${Date.now()}`,
      wallet_id: userWallet.id,
      booking_id: bookingId,
      amount: targetBooking.commission_amount,
      type: 'LOCK_COMMISSION',
      balance_after: newAvail,
      description: `Tạm giữ phí nền tảng (${targetBooking.commission_rate}%) cho đơn ${targetBooking.booking_code}`,
      created_at: new Date().toISOString(),
    };

    setTransactions((prev) => [newTx, ...prev]);

    // Live RPC to Supabase
    if (isLiveConnected) {
      try {
        await supabase.rpc('accept_booking_with_escrow', {
          p_booking_id: bookingId,
          p_practitioner_id: currentUser.id,
        });
      } catch (err) {
        console.warn('Supabase RPC accept error, synced locally:', err);
      }
    }

    return true;
  };

  // 5. Complete Booking & Deduct Commission (RPC complete_booking_and_deduct_commission)
  const handleCompleteBooking = async (
    bookingId: string,
    diag: string,
    treat: string,
    adv: string
  ): Promise<boolean> => {
    const targetBooking = bookings.find((b) => b.id === bookingId);
    if (!targetBooking || !currentUser) return false;

    const userWallet = wallets[currentUser.id];
    if (userWallet) {
      const newLock = Math.max(0, userWallet.locked_balance - targetBooking.commission_amount);
      setWallets((prev) => ({
        ...prev,
        [currentUser.id]: {
          ...userWallet,
          locked_balance: newLock,
          updated_at: new Date().toISOString(),
        },
      }));

      const newTx: WalletTransaction = {
        id: `tx-${Date.now()}`,
        wallet_id: userWallet.id,
        booking_id: bookingId,
        amount: targetBooking.commission_amount,
        type: 'DEDUCT_COMMISSION',
        balance_after: userWallet.available_balance,
        description: `Quyết toán phí kết nối nền tảng đơn ${targetBooking.booking_code}`,
        created_at: new Date().toISOString(),
      };
      setTransactions((prev) => [newTx, ...prev]);
    }

    setBookings((prev) =>
      prev.map((b) =>
        b.id === bookingId
          ? {
              ...b,
              status: 'COMPLETED',
              medical_diagnosis: diag,
              treatment_notes: treat,
              doctor_advice: adv,
              updated_at: new Date().toISOString(),
            }
          : b
      )
    );

    // Update completed count
    if (currentPractitioner) {
      setPractitioners((prev) => ({
        ...prev,
        [currentUser.id]: {
          ...currentPractitioner,
          completed_jobs: currentPractitioner.completed_jobs + 1,
        },
      }));
    }

    // Live RPC to Supabase
    if (isLiveConnected) {
      try {
        await supabase.rpc('complete_booking_and_deduct_commission', {
          p_booking_id: bookingId,
          p_practitioner_id: currentUser.id,
          p_diagnosis: diag,
          p_treatment: treat,
          p_advice: adv,
        });
      } catch (err) {
        console.warn('Supabase RPC complete error, synced locally:', err);
      }
    }

    return true;
  };

  // 6. Cancel Booking (NO PENALTY - Refund 100% locked fee)
  const handleCancelBooking = (bookingId: string, cancelledByRole: 'PATIENT' | 'PRACTITIONER' | 'ADMIN') => {
    const target = bookings.find((b) => b.id === bookingId);
    if (!target || target.status === 'COMPLETED') return;

    // Refund locked commission if it was locked
    if (
      ['CONFIRMED', 'ON_THE_WAY', 'IN_PROGRESS'].includes(target.status) &&
      target.practitioner_id
    ) {
      const docWallet = wallets[target.practitioner_id];
      if (docWallet) {
        const refundedAvail = docWallet.available_balance + target.commission_amount;
        const refundedLock = Math.max(0, docWallet.locked_balance - target.commission_amount);

        setWallets((prev) => ({
          ...prev,
          [target.practitioner_id!]: {
            ...docWallet,
            available_balance: refundedAvail,
            locked_balance: refundedLock,
          },
        }));

        const refundTx: WalletTransaction = {
          id: `tx-${Date.now()}`,
          wallet_id: docWallet.id,
          booking_id: bookingId,
          amount: target.commission_amount,
          type: 'REFUND_LOCK',
          balance_after: refundedAvail,
          description: `Hoàn trả 100% phí tạm giữ do hủy đơn ${target.booking_code} (Không phạt cọc)`,
          created_at: new Date().toISOString(),
        };
        setTransactions((prev) => [refundTx, ...prev]);
      }
    }

    const newStatus =
      cancelledByRole === 'PATIENT' ? 'CANCELLED_PATIENT' : 'CANCELLED_DOCTOR';

    setBookings((prev) =>
      prev.map((b) =>
        b.id === bookingId
          ? { ...b, status: newStatus, updated_at: new Date().toISOString() }
          : b
      )
    );

    // Live RPC to Supabase
    if (isLiveConnected) {
      try {
        supabase.rpc('cancel_booking_and_refund_lock', {
          p_booking_id: bookingId,
          p_cancelled_by_role: cancelledByRole,
        });
      } catch (err) {
        console.warn('Supabase RPC cancel error:', err);
      }
    }
  };

  // 7. Check-in GPS
  const handleCheckInGPS = (bookingId: string, lat: number, lng: number, distance: number) => {
    setBookings((prev) =>
      prev.map((b) =>
        b.id === bookingId
          ? {
              ...b,
              checkin_lat: lat,
              checkin_lng: lng,
              checkin_distance_meters: distance,
              updated_at: new Date().toISOString(),
            }
          : b
      )
    );

    if (isLiveConnected) {
      supabase.from('bookings').update({
        checkin_lat: lat,
        checkin_lng: lng,
        checkin_distance_meters: distance,
      }).eq('id', bookingId);
    }
  };

  // 8. Update status
  const handleUpdateStatus = (bookingId: string, status: Booking['status']) => {
    setBookings((prev) =>
      prev.map((b) => (b.id === bookingId ? { ...b, status, updated_at: new Date().toISOString() } : b))
    );

    if (isLiveConnected) {
      supabase.from('bookings').update({ status }).eq('id', bookingId);
    }
  };

  // 9. Submit review
  const handleSubmitReview = (bookingId: string, rating: number, review: string) => {
    setBookings((prev) =>
      prev.map((b) =>
        b.id === bookingId
          ? { ...b, patient_rating: rating, patient_review: review, updated_at: new Date().toISOString() }
          : b
      )
    );

    if (isLiveConnected) {
      supabase.from('bookings').update({ patient_rating: rating, patient_review: review }).eq('id', bookingId);
    }
  };

  // 10. Deposit to wallet
  const handleDepositWallet = (amount: number) => {
    if (!currentUser) return;
    const newWalletId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : '44444444-4444-4444-4444-' + Date.now().toString().slice(-12).padStart(12, '0');
    const userWallet = wallets[currentUser.id] || {
      id: newWalletId,
      user_id: currentUser.id,
      available_balance: 0,
      locked_balance: 0,
      updated_at: new Date().toISOString(),
    };

    const newBal = userWallet.available_balance + amount;
    setWallets((prev) => ({
      ...prev,
      [currentUser.id]: {
        ...userWallet,
        available_balance: newBal,
        updated_at: new Date().toISOString(),
      },
    }));

    const txId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : '66666666-6666-6666-6666-' + Date.now().toString().slice(-12).padStart(12, '0');
    const tx: WalletTransaction = {
      id: txId,
      wallet_id: userWallet.id,
      booking_id: null,
      amount,
      type: 'DEPOSIT',
      balance_after: newBal,
      description: `Nạp tiền vào Ví Tín Dụng qua VietQR VCB (+${amount / 1000}k)`,
      created_at: new Date().toISOString(),
    };
    setTransactions((prev) => [tx, ...prev]);

    if (isLiveConnected) {
      supabase.from('wallets').update({ available_balance: newBal }).eq('user_id', currentUser.id);
      supabase.from('wallet_transactions').insert([tx]);
    }
  };

  // 11. Toggle Online status
  const handleToggleOnline = (isOnline: boolean) => {
    if (!currentUser) return;
    setPractitioners((prev) => {
      const cur = prev[currentUser.id];
      if (!cur) return prev;
      return {
        ...prev,
        [currentUser.id]: {
          ...cur,
          is_online: isOnline,
        },
      };
    });
    if (currentPractitioner) {
      setCurrentPractitioner({ ...currentPractitioner, is_online: isOnline });
    }

    if (isLiveConnected) {
      supabase.from('practitioner_profiles').update({ is_online: isOnline }).eq('user_id', currentUser.id);
    }
  };

  // 12. Admin verify eKYC
  const handleVerifyPractitioner = (userId: string, isVerified: boolean) => {
    setPractitioners((prev) => {
      const cur = prev[userId];
      if (!cur) return prev;
      return {
        ...prev,
        [userId]: {
          ...cur,
          is_verified: isVerified,
          is_online: isVerified ? true : false,
        },
      };
    });
    if (currentUser?.id === userId && currentPractitioner) {
      setCurrentPractitioner({
        ...currentPractitioner,
        is_verified: isVerified,
        is_online: isVerified,
      });
    }

    if (isLiveConnected) {
      supabase.from('practitioner_profiles').update({ is_verified: isVerified, is_online: isVerified }).eq('user_id', userId);
    }
  };

  // 13. Admin Reassign doctor
  const handleReassignDoctor = (bookingId: string, newDoctorId: string) => {
    setBookings((prev) =>
      prev.map((b) =>
        b.id === bookingId
          ? {
              ...b,
              practitioner_id: newDoctorId || null,
              status: newDoctorId ? 'CONFIRMED' : 'PENDING',
              updated_at: new Date().toISOString(),
            }
          : b
      )
    );

    if (isLiveConnected) {
      supabase.from('bookings').update({
        practitioner_id: newDoctorId || null,
        status: newDoctorId ? 'CONFIRMED' : 'PENDING',
      }).eq('id', bookingId);
    }
  };

  // 14. Reset Password
  // 14. Reset Password (with custom or default password)
  const handleResetPassword = (userId: string, newPassword?: string) => {
    const pwd = newPassword && newPassword.trim() ? newPassword.trim() : '123456';
    setProfiles((prev) =>
      prev.map((p) => (p.id === userId ? { ...p, password_hash: pwd } : p))
    );

    if (currentUser?.id === userId) {
      setCurrentUser((prev) => (prev ? { ...prev, password_hash: pwd } : null));
    }

    if (isLiveConnected) {
      supabase.from('profiles').update({ password_hash: pwd }).eq('id', userId).then(() => {
        checkSupabaseConnection();
      });
    }
  };

  // 14b. Admin Create User
  const handleCreateUser = async (data: {
    profile: Omit<Profile, 'id' | 'created_at' | 'updated_at'>;
    practitioner?: Partial<PractitionerProfile>;
    initialBalance?: number;
  }): Promise<{ success: boolean; message?: string }> => {
    if (profiles.some((p) => p.phone === data.profile.phone)) {
      return { success: false, message: 'Số điện thoại này đã tồn tại trong hệ thống!' };
    }

    const newId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : '11111111-1111-1111-1111-' + Date.now().toString().slice(-12).padStart(12, '0');
    const now = new Date().toISOString();

    const newProfile: Profile = {
      id: newId,
      phone: data.profile.phone,
      password_hash: data.profile.password_hash || '123456',
      full_name: data.profile.full_name,
      avatar_url: data.profile.avatar_url || null,
      default_address: data.profile.default_address || null,
      role: data.profile.role,
      is_active: data.profile.is_active ?? true,
      created_at: now,
      updated_at: now,
    };

    setProfiles((prev) => [newProfile, ...prev]);

    let newPrac: PractitionerProfile | null = null;
    let newWallet: Wallet | null = null;

    if (data.profile.role === 'PRACTITIONER') {
      const pracId =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : '22222222-2222-2222-2222-' + Date.now().toString().slice(-12).padStart(12, '0');
      newPrac = {
        id: pracId,
        user_id: newId,
        specialties: data.practitioner?.specialties || ['Châm cứu', 'Xoa bóp bấm huyệt'],
        license_number:
          data.practitioner?.license_number ||
          'CCHN-2026-' + Math.floor(1000 + Math.random() * 9000),
        license_image_url:
          data.practitioner?.license_image_url ||
          'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600&auto=format&fit=crop&q=80',
        issued_by: data.practitioner?.issued_by || 'Sở Y Tế TP.HCM',
        years_of_experience: data.practitioner?.years_of_experience || 5,
        bio: data.practitioner?.bio || 'Bác sĩ / Lương y Y học Cổ truyền chuyên nghiệp',
        base_service_fee: data.practitioner?.base_service_fee || 400000,
        commission_rate: data.practitioner?.commission_rate || 15.0,
        is_verified: data.practitioner?.is_verified ?? true,
        rejection_reason: null,
        is_online: data.practitioner?.is_verified ?? true,
        current_lat: 10.7769,
        current_lng: 106.7009,
        rating_avg: 5.0,
        total_reviews: 1,
        completed_jobs: 0,
        cancelled_jobs: 0,
        updated_at: now,
      };

      const walletId =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : '33333333-3333-3333-3333-' + Date.now().toString().slice(-12).padStart(12, '0');
      newWallet = {
        id: walletId,
        user_id: newId,
        available_balance: data.initialBalance ?? 500000,
        locked_balance: 0,
        updated_at: now,
      };

      setPractitioners((prev) => ({ ...prev, [newId]: newPrac! }));
      setWallets((prev) => ({ ...prev, [newId]: newWallet! }));
    }

    if (isLiveConnected) {
      try {
        const { error: pErr } = await supabase.from('profiles').insert([newProfile]);
        if (pErr) console.error('Supabase insert profile error:', pErr);

        if (newPrac) {
          const { error: prErr } = await supabase.from('practitioner_profiles').insert([newPrac]);
          if (prErr) console.error('Supabase insert practitioner error:', prErr);
        }
        if (newWallet) {
          const { error: wErr } = await supabase.from('wallets').insert([newWallet]);
          if (wErr) console.error('Supabase insert wallet error:', wErr);
        }
        await checkSupabaseConnection();
      } catch (e) {
        console.error('Supabase live create user error:', e);
      }
    }

    return {
      success: true,
      message: `Tạo tài khoản ${newProfile.full_name} (${newProfile.phone}) thành công!`,
    };
  };

  // 14c. Admin Update User
  const handleUpdateUser = async (
    userId: string,
    data: {
      profile: Partial<Profile>;
      practitioner?: Partial<PractitionerProfile>;
    }
  ): Promise<{ success: boolean; message?: string }> => {
    const now = new Date().toISOString();

    setProfiles((prev) =>
      prev.map((p) => {
        if (p.id === userId) {
          return {
            ...p,
            ...data.profile,
            updated_at: now,
          };
        }
        return p;
      })
    );

    if (currentUser?.id === userId) {
      setCurrentUser((prev) => (prev ? { ...prev, ...data.profile, updated_at: now } : null));
    }

    if (data.practitioner && practitioners[userId]) {
      setPractitioners((prev) => ({
        ...prev,
        [userId]: {
          ...prev[userId],
          ...data.practitioner,
          updated_at: now,
        },
      }));
    }

    if (isLiveConnected) {
      try {
        if (data.profile && Object.keys(data.profile).length > 0) {
          await supabase
            .from('profiles')
            .update({ ...data.profile, updated_at: now })
            .eq('id', userId);
        }
        if (data.practitioner && Object.keys(data.practitioner).length > 0) {
          const { data: existingPrac } = await supabase
            .from('practitioner_profiles')
            .select('id')
            .eq('user_id', userId)
            .maybeSingle();

          if (existingPrac) {
            await supabase
              .from('practitioner_profiles')
              .update({ ...data.practitioner, updated_at: now })
              .eq('user_id', userId);
          } else {
            await supabase
              .from('practitioner_profiles')
              .insert([{ ...data.practitioner, user_id: userId, updated_at: now }]);
          }
        }
        await checkSupabaseConnection();
      } catch (e) {
        console.error('Supabase live update user error:', e);
      }
    }

    return { success: true, message: 'Cập nhật thông tin tài khoản thành công!' };
  };

  // 14d. Admin Delete User
  const handleDeleteUser = async (
    userId: string
  ): Promise<{ success: boolean; message?: string }> => {
    if (currentUser?.id === userId) {
      return { success: false, message: 'Không thể tự xóa tài khoản Quản trị viên đang đăng nhập!' };
    }

    const targetUser = profiles.find((p) => p.id === userId);
    const userName = targetUser ? targetUser.full_name : userId;

    // Check active bookings
    const hasActiveBookings = bookings.some(
      (b) =>
        (b.patient_id === userId || b.practitioner_id === userId) &&
        !['COMPLETED', 'CANCELLED_PATIENT', 'CANCELLED_DOCTOR'].includes(b.status)
    );
    if (hasActiveBookings) {
      return {
        success: false,
        message: `Không thể xóa ${userName} vì đang có ca khám đang diễn ra hoặc chưa hoàn tất!`,
      };
    }

    setProfiles((prev) => prev.filter((p) => p.id !== userId));
    setPractitioners((prev) => {
      const copy = { ...prev };
      delete copy[userId];
      return copy;
    });
    setWallets((prev) => {
      const copy = { ...prev };
      delete copy[userId];
      return copy;
    });

    if (isLiveConnected) {
      try {
        await supabase.from('profiles').delete().eq('id', userId);
        await checkSupabaseConnection();
      } catch (e) {
        console.error('Supabase live delete user error:', e);
      }
    }

    return { success: true, message: `Đã xóa tài khoản ${userName} thành công.` };
  };

  // 15. Adjust Wallet by Admin
  const handleAdjustWallet = (userId: string, amount: number) => {
    const curWallet = wallets[userId] || {
      id: `w-${Date.now()}`,
      user_id: userId,
      available_balance: 0,
      locked_balance: 0,
      updated_at: new Date().toISOString(),
    };
    const newBal = curWallet.available_balance + amount;
    setWallets((prev) => ({
      ...prev,
      [userId]: {
        ...curWallet,
        available_balance: newBal,
      },
    }));

    if (isLiveConnected) {
      supabase.from('wallets').update({ available_balance: newBal }).eq('user_id', userId);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-teal-50/20 to-slate-100 text-slate-900 font-sans">
      {/* Top System Bar & Quick User Switch Bar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
          {/* Logo Brand */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-xs">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                ĐÔNG Y HOMECARE
              </div>
            </div>
          </div>

          {/* Current User Pill & Switcher */}
          {currentUser ? (
            <div className="flex items-center gap-2">
              <div className="hidden lg:flex items-center gap-2 mr-1">
                <div className="flex items-center text-xs font-semibold text-emerald-950 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200/80 shadow-2xs gap-1.5">
                  <span className="text-emerald-800 font-bold">Sáng lập:</span>
                  <span className="text-slate-900 font-bold">Mr.Tưởng</span>
                  <a
                    href="tel:0917719794"
                    className="text-emerald-700 hover:text-emerald-800 font-extrabold tracking-wide hover:underline ml-0.5"
                  >
                    09.1771.9794
                  </a>
                </div>
                <div className="flex items-center text-xs font-semibold text-slate-700 bg-amber-50/90 px-3 py-1 rounded-full border border-amber-200/80 shadow-2xs gap-1.5">
                  <span className="text-amber-800 font-bold">Design App:</span>
                  <span className="text-slate-900 font-bold">Mr.Luân</span>
                  <a
                    href="tel:0969798896"
                    className="text-emerald-700 hover:text-emerald-800 font-extrabold tracking-wide hover:underline ml-0.5"
                  >
                    09.6979.8896
                  </a>
                </div>
              </div>

              <div className="text-right hidden sm:block">
                <div className="text-xs font-bold text-slate-900 flex items-center justify-end gap-1">
                  {currentUser.full_name}
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                      currentUser.role === 'ADMIN'
                        ? 'bg-purple-100 text-purple-900'
                        : currentUser.role === 'PRACTITIONER'
                        ? 'bg-teal-100 text-teal-900'
                        : 'bg-emerald-100 text-emerald-900'
                    }`}
                  >
                    {currentUser.role}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono">{currentUser.phone}</div>
              </div>

              {/* Quick Switch Dropdown */}
              <div className="relative flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
                <ArrowRightLeft className="w-3.5 h-3.5 text-slate-500 ml-1 shrink-0" />
                <select
                  aria-label="Chuyển nhanh tài khoản test"
                  value={currentUser.phone}
                  onChange={(e) => handleQuickSwitchUser(e.target.value)}
                  className="bg-transparent font-bold text-xs text-slate-800 focus:outline-none cursor-pointer pr-1"
                >
                  {profiles.map((p) => {
                    const prac = practitioners[p.id];
                    const label =
                      p.role === 'ADMIN'
                        ? `Admin: ${p.full_name}`
                        : p.role === 'PRACTITIONER'
                        ? `${p.full_name} (${prac?.is_verified ? 'Đã duyệt' : 'Chờ duyệt'})`
                        : `BN. ${p.full_name}`;
                    return (
                      <option key={p.id} value={p.phone}>
                        {label} ({p.phone})
                      </option>
                    );
                  })}
                </select>
              </div>

              <button
                type="button"
                onClick={() => {
                  setCurrentUser(null);
                  setCurrentPractitioner(null);
                }}
                className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                title="Đăng xuất"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-xs font-semibold text-emerald-950 bg-gradient-to-r from-emerald-50 to-teal-50 px-3.5 py-1.5 rounded-full border border-emerald-200 shadow-2xs flex items-center gap-1.5">
                <span className="text-emerald-800 font-bold">Sáng lập :</span>
                <span className="text-slate-900 font-bold">Mr.Tưởng</span>
                <span className="text-emerald-300">•</span>
                <a
                  href="tel:0917719794"
                  className="text-emerald-700 hover:text-emerald-800 font-extrabold tracking-wide hover:underline"
                >
                  09.1771.9794
                </a>
              </div>

              <div className="text-xs font-semibold text-slate-800 bg-gradient-to-r from-amber-50 to-orange-50 px-3.5 py-1.5 rounded-full border border-amber-200 shadow-2xs flex items-center gap-1.5">
                <span className="text-amber-800 font-bold">Design App :</span>
                <span className="text-slate-900 font-bold">Mr.Luân</span>
                <span className="text-amber-300">•</span>
                <a
                  href="tel:0969798896"
                  className="text-emerald-700 hover:text-emerald-800 font-extrabold tracking-wide hover:underline"
                >
                  09.6979.8896
                </a>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <div className="py-6 sm:py-8">
        {!currentUser ? (
          <AuthPortal
            onLoginSuccess={(prof, prac) => {
              setCurrentUser(prof);
              setCurrentPractitioner(prac || practitioners[prof.id] || null);
            }}
            profiles={profiles}
            practitioners={practitioners}
            onRegisterPatient={handleRegisterPatient}
            onRegisterPractitioner={handleRegisterPractitioner}
          />
        ) : currentUser.role === 'PATIENT' ? (
          <PatientView
            currentUser={currentUser}
            practitioners={practitioners}
            profiles={profiles}
            bookings={bookings}
            onCreateBooking={handleCreateBooking}
            onCancelBooking={(id) => handleCancelBooking(id, 'PATIENT')}
            onSubmitReview={handleSubmitReview}
          />
        ) : currentUser.role === 'PRACTITIONER' ? (
          <PractitionerView
            currentUser={currentUser}
            practitioner={currentPractitioner || practitioners[currentUser.id]}
            wallet={
              wallets[currentUser.id] || {
                id: `w-${currentUser.id}`,
                user_id: currentUser.id,
                available_balance: 0,
                locked_balance: 0,
                updated_at: new Date().toISOString(),
              }
            }
            transactions={transactions.filter((tx) => {
              const w = wallets[currentUser.id];
              return w ? tx.wallet_id === w.id : false;
            })}
            bookings={bookings}
            profiles={profiles}
            onAcceptBooking={handleAcceptBooking}
            onCheckInGPS={handleCheckInGPS}
            onUpdateStatus={handleUpdateStatus}
            onCompleteBooking={handleCompleteBooking}
            onCancelBooking={(id) => handleCancelBooking(id, 'PRACTITIONER')}
            onDepositWallet={handleDepositWallet}
            onToggleOnline={handleToggleOnline}
          />
        ) : (
          <AdminView
            currentUser={currentUser}
            profiles={profiles}
            practitioners={practitioners}
            wallets={wallets}
            bookings={bookings}
            transactions={transactions}
            onVerifyPractitioner={handleVerifyPractitioner}
            onReassignDoctor={handleReassignDoctor}
            onCancelBookingByAdmin={(id) => handleCancelBooking(id, 'ADMIN')}
            onResetPassword={handleResetPassword}
            onAdjustWallet={handleAdjustWallet}
            onCreateUser={handleCreateUser}
            onUpdateUser={handleUpdateUser}
            onDeleteUser={handleDeleteUser}
            onUpdateCommissionRate={(userId, newRate) => {
              setPractitioners((prev) => {
                const cur = prev[userId];
                if (!cur) return prev;
                return {
                  ...prev,
                  [userId]: { ...cur, commission_rate: newRate },
                };
              });
            }}
          />
        )}
      </div>

      {/* SUPABASE STATUS & SETUP MODAL */}
      {showDbModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-slate-900 uppercase">
                    Trạng Thái Supabase Cloud
                  </h4>
                  <p className="text-[11px] text-slate-500 font-mono">
                    Project: hvkwepswkgqnbneqagno
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDbModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Supabase URL:</span>
                <span className="font-mono text-slate-800 text-[11px]">
                  https://hvkwepswkgqnbneqagno.supabase.co
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Anon Public Key:</span>
                <span className="font-bold text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Đã nhận diện hợp lệ
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Database Tables:</span>
                {dbTablesExist ? (
                  <span className="font-bold text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Đã sẵn sàng (Live)
                  </span>
                ) : (
                  <span className="font-bold text-amber-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> Chưa tạo bảng
                  </span>
                )}
              </div>
            </div>

            {!dbTablesExist ? (
              <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 space-y-2">
                <div className="font-bold flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  Hướng dẫn kích hoạt Live Cloud (1 phút):
                </div>
                <ol className="list-decimal pl-4 space-y-1 text-[11px] text-amber-800">
                  <li>
                    Mở{' '}
                    <a
                      href="https://supabase.com/dashboard/project/hvkwepswkgqnbneqagno/sql/new"
                      target="_blank"
                      rel="noreferrer"
                      className="font-bold text-blue-700 underline"
                    >
                      Supabase SQL Editor
                    </a>
                  </li>
                  <li>
                    Copy toàn bộ mã trong file{' '}
                    <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">
                      supabase/schema.sql
                    </code>{' '}
                    dán vào và bấm <strong>Run</strong>.
                  </li>
                  <li>
                    Quay lại đây bấm nút <strong>Kiểm Tra Lại Kết Nối</strong> bên dưới.
                  </li>
                </ol>
                <p className="text-[10px] text-slate-500 italic mt-1">
                  * Hệ thống hiện đang chạy trên bộ dữ liệu Local State Fallback chuẩn y khoa nên bạn có thể thử nghiệm toàn bộ tính năng bình thường.
                </p>
              </div>
            ) : (
              <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>
                  Tuyệt vời! Toàn bộ 5 bảng và các hàm RPC lưu bệnh án, tạm giữ và quyết toán phí Grab đã kết nối trực tiếp với Supabase Cloud.
                </span>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowDbModal(false)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Đóng
              </button>
              <button
                type="button"
                disabled={isCheckingDb}
                onClick={checkSupabaseConnection}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md flex items-center justify-center gap-1.5"
              >
                <Database className={`w-3.5 h-3.5 ${isCheckingDb ? 'animate-spin' : ''}`} />
                {isCheckingDb ? 'Đang kiểm tra...' : 'Kiểm Tra Lại'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
