'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  ServiceItem,
} from '@/types/database';
import {
  INITIAL_PROFILES,
  INITIAL_PRACTITIONERS,
  INITIAL_WALLETS,
  INITIAL_BOOKINGS,
  INITIAL_TRANSACTIONS,
  INITIAL_SERVICES,
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
  const [services, setServices] = useState<ServiceItem[]>(INITIAL_SERVICES);

  // Load cached services from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('dongy_services');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setServices(parsed);
          }
        }
      } catch (e) {
        console.warn('Failed to load services from localStorage:', e);
      }
    }
  }, []);

  // Auth state
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [currentPractitioner, setCurrentPractitioner] = useState<PractitionerProfile | null>(null);

  // Supabase live status
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false);
  const [dbTablesExist, setDbTablesExist] = useState<boolean>(false);
  const [connectionNote, setConnectionNote] = useState<string>('Khởi tạo');
  const [isCheckingDb, setIsCheckingDb] = useState<boolean>(false);

  // Anti-duplicate booking lock (ref-based, survives re-renders)
  const bookingLockRef = useRef<boolean>(false);
  const lastBookingTimestampRef = useRef<number>(0);
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

        // Fetch services
        try {
          const { data: srvData } = await supabase.from('services').select('*').order('created_at', { ascending: true });
          if (srvData && srvData.length > 0) {
            setServices(srvData);
            if (typeof window !== 'undefined') {
              localStorage.setItem('dongy_services', JSON.stringify(srvData));
            }
          }
        } catch (srvErr) {
          console.warn('Supabase services fetch error (fallback to local):', srvErr);
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

  // Debounced realtime sync to prevent rapid re-fetches
  const realtimeSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedSync = useCallback(() => {
    if (realtimeSyncTimerRef.current) {
      clearTimeout(realtimeSyncTimerRef.current);
    }
    realtimeSyncTimerRef.current = setTimeout(() => {
      checkSupabaseConnection();
    }, 1000); // Wait 1s after last realtime event before re-fetching
  }, []);

  useEffect(() => {
    checkSupabaseConnection();

    // Supabase Realtime Listener for ALL tables (debounced to prevent duplicate fetches)
    if (isSupabaseConfigured) {
      const channel = supabase
        .channel('public:realtime_sync')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'profiles' },
          (payload) => {
            console.log('Realtime Profile Change detected:', payload);
            debouncedSync();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'practitioner_profiles' },
          (payload) => {
            console.log('Realtime Practitioner Change detected:', payload);
            debouncedSync();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'wallets' },
          (payload) => {
            console.log('Realtime Wallet Change detected:', payload);
            debouncedSync();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'bookings' },
          (payload) => {
            console.log('Realtime Booking Change detected:', payload);
            debouncedSync();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
        if (realtimeSyncTimerRef.current) {
          clearTimeout(realtimeSyncTimerRef.current);
        }
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

  // 3. Create Booking (Chống spam / đúp đơn trùng lặp - Triple-lock protection)
  const handleCreateBooking = useCallback(async (
    newBooking: Partial<Booking>
  ): Promise<{ success: boolean; message?: string; booking?: Booking }> => {
    // === LOCK 1: Ref-based mutex lock (survives re-renders, prevents concurrent calls) ===
    if (bookingLockRef.current) {
      return {
        success: false,
        message: 'Hệ thống đang xử lý đơn khám trước đó, vui lòng đợi...',
      };
    }

    // === LOCK 2: Time-based throttle (minimum 5s between bookings) ===
    const now = Date.now();
    if (now - lastBookingTimestampRef.current < 5000) {
      return {
        success: false,
        message: 'Vui lòng chờ ít nhất 5 giây trước khi đặt lịch tiếp theo.',
      };
    }

    // === LOCK 3: Check existing bookings for duplicates ===
    const recentDuplicate = bookings.find(
      (b) =>
        b.patient_id === newBooking.patient_id &&
        b.service_name === newBooking.service_name &&
        b.address === newBooking.address &&
        ['PENDING', 'CONFIRMED'].includes(b.status) &&
        now - new Date(b.created_at).getTime() < 30000
    );

    if (recentDuplicate) {
      return {
        success: false,
        message: `Đơn khám "${newBooking.service_name}" đã được ghi nhận trước đó (Mã: ${recentDuplicate.booking_code}). Vui lòng không bấm đặt trùng lặp!`,
      };
    }

    // Acquire lock
    bookingLockRef.current = true;
    lastBookingTimestampRef.current = now;

    try {
      const bookingId =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : '55555555-5555-5555-5555-' + Date.now().toString().slice(-12).padStart(12, '0');
      const nowISO = new Date().toISOString();

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
        appointment_time: newBooking.appointment_time || nowISO,
        service_fee: newBooking.service_fee || 400000,
        travel_surcharge: newBooking.travel_surcharge ?? 0,
        commission_rate: newBooking.commission_rate || 15.0,
        commission_amount: newBooking.commission_amount || 60000,
        status: 'PENDING',
        created_at: nowISO,
        updated_at: nowISO,
      };

      if (isLiveConnected) {
        try {
          const { error: bErr } = await supabase.from('bookings').insert([bookingFull]);
          if (bErr) {
            console.error('Supabase insert booking error:', bErr);
            return {
              success: false,
              message: `Lỗi lưu ca khám lên cơ sở dữ liệu: ${bErr.message}`,
            };
          }
        } catch (e: unknown) {
          console.error('Supabase insert booking error:', e);
          const msg = e instanceof Error ? e.message : String(e);
          return { success: false, message: `Lỗi kết nối cơ sở dữ liệu: ${msg}` };
        }
      }

      // Update local state with deduplication by ID
      setBookings((prev) => {
        const filtered = prev.filter((b) => b.id !== bookingFull.id);
        return [bookingFull, ...filtered];
      });

      // DO NOT call checkSupabaseConnection() here!
      // Supabase Realtime will automatically trigger re-fetch via the channel listener.
      // Calling it here caused race conditions where the same booking appeared multiple times.

      return {
        success: true,
        message: `Đặt lịch thành công mã [${bookingFull.booking_code}]!`,
        booking: bookingFull,
      };
    } finally {
      // Release lock after a small delay to prevent rapid re-submission
      setTimeout(() => {
        bookingLockRef.current = false;
      }, 2000);
    }
  }, [bookings, isLiveConnected]);

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

  // 6. Cancel Booking (NO PENALTY - Refund 100% locked fee - Immediate DB persistence & Reason Tracking)
  const handleCancelBooking = async (
    bookingId: string,
    cancelledByRole: 'PATIENT' | 'PRACTITIONER' | 'ADMIN',
    reason?: string
  ): Promise<{ success: boolean; message?: string }> => {
    const target = bookings.find((b) => b.id === bookingId);
    if (!target) return { success: false, message: 'Không tìm thấy ca khám.' };
    if (target.status === 'COMPLETED') return { success: false, message: 'Ca khám đã hoàn tất không thể hủy.' };

    const newStatus =
      cancelledByRole === 'PATIENT' ? 'CANCELLED_PATIENT' : 'CANCELLED_DOCTOR';

    const nowIso = new Date().toISOString();
    const finalReason =
      reason?.trim() ||
      (cancelledByRole === 'PRACTITIONER'
        ? 'Thầy thuốc báo bận / Nghi vấn lừa đảo, bảo vệ an toàn'
        : cancelledByRole === 'ADMIN'
        ? 'Admin điều phối hủy đơn'
        : 'Bệnh nhân có việc bận đột xuất');

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
          created_at: nowIso,
        };
        setTransactions((prev) => [refundTx, ...prev]);
      }
    }

    // Cập nhật ngay lập tức bộ nhớ React để UI cập nhật ngày giờ và lý do hủy tức thì
    setBookings((prev) =>
      prev.map((b) =>
        b.id === bookingId
          ? {
              ...b,
              status: newStatus,
              cancelled_at: nowIso,
              cancel_reason: finalReason,
              updated_at: nowIso,
            }
          : b
      )
    );

    // Lưu vĩnh viễn lên Supabase Cloud
    if (isSupabaseConfigured) {
      try {
        const { error: rpcErr } = await supabase.rpc('cancel_booking_and_refund_lock', {
          p_booking_id: bookingId,
          p_cancelled_by_role: cancelledByRole,
          p_cancel_reason: finalReason,
        });

        if (rpcErr) {
          console.warn('Supabase RPC cancel failed, attempting direct table update:', rpcErr);
          const { error: directErr } = await supabase
            .from('bookings')
            .update({
              status: newStatus,
              cancelled_at: nowIso,
              cancel_reason: finalReason,
              updated_at: nowIso,
            })
            .eq('id', bookingId);

          if (directErr) {
            console.error('Supabase direct cancel error:', directErr);
            return {
              success: false,
              message: `Lỗi cập nhật trạng thái hủy trên Supabase: ${directErr.message}`,
            };
          }
        }
      } catch (err: unknown) {
        console.warn('Supabase cancel exception, attempting direct fallback:', err);
        try {
          await supabase
            .from('bookings')
            .update({
              status: newStatus,
              cancelled_at: nowIso,
              cancel_reason: finalReason,
              updated_at: nowIso,
            })
            .eq('id', bookingId);
        } catch (fallbackErr) {
          console.error('Fallback direct update failed:', fallbackErr);
        }
      }
    }

    return {
      success: true,
      message: `Đã hủy lịch khám ${target.booking_code} thành công (Không phạt cọc).`,
    };
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

  // 14. Reset Password (with custom or default password)
  const handleResetPassword = async (
    userId: string,
    newPassword?: string
  ): Promise<{ success: boolean; message?: string }> => {
    const pwd = newPassword && newPassword.trim() ? newPassword.trim() : '123456';
    const targetUser = profiles.find((p) => p.id === userId);
    const targetName = targetUser ? targetUser.full_name : 'người dùng';
    const now = new Date().toISOString();

    // 1. Cập nhật tức thời vào Supabase Cloud (bảo đảm lưu vĩnh viễn với RLS)
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ password_hash: pwd, updated_at: now })
          .eq('id', userId);

        if (error) {
          console.error('Supabase reset password error:', error);
          return {
            success: false,
            message: `Lỗi lưu mật khẩu trên Supabase: ${error.message}`,
          };
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('Supabase reset password exception:', e);
        return { success: false, message: `Lỗi kết nối cơ sở dữ liệu: ${msg}` };
      }
    }

    // 2. Cập nhật ngay lập tức bộ nhớ React state
    setProfiles((prev) =>
      prev.map((p) => (p.id === userId ? { ...p, password_hash: pwd, updated_at: now } : p))
    );

    if (currentUser?.id === userId) {
      setCurrentUser((prev) => (prev ? { ...prev, password_hash: pwd, updated_at: now } : null));
    }

    return {
      success: true,
      message: `Đã đổi mật khẩu của ${targetName} thành "${pwd}" thành công! Cập nhật Supabase tức thì.`,
    };
  };

  // 14b. Admin Create User

  // ==========================================
  // SERVICE MANAGEMENT HANDLERS (ADMIN)
  // ==========================================
  const handleCreateService = async (
    data: Omit<ServiceItem, 'id' | 'created_at' | 'updated_at'>
  ) => {
    const newId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : 'srv-' + Date.now();
    const now = new Date().toISOString();
    const newService: ServiceItem = {
      ...data,
      id: newId,
      created_at: now,
      updated_at: now,
    };

    setServices((prev) => {
      const updated = [...prev, newService];
      if (typeof window !== 'undefined') {
        localStorage.setItem('dongy_services', JSON.stringify(updated));
      }
      return updated;
    });

    if (isSupabaseConfigured) {
      try {
        await supabase.from('services').insert({
          id: newId,
          name: data.name,
          price: data.price,
          description: data.description || null,
          duration_minutes: data.duration_minutes || 60,
          is_active: data.is_active,
          created_at: now,
          updated_at: now,
        });
      } catch (err) {
        console.warn('Supabase insert service error:', err);
      }
    }

    return { success: true, message: `Đã tạo mới dịch vụ "${data.name}" thành công!` };
  };

  const handleUpdateService = async (
    id: string,
    data: Partial<ServiceItem>
  ) => {
    const now = new Date().toISOString();
    setServices((prev) => {
      const updated = prev.map((s) => (s.id === id ? { ...s, ...data, updated_at: now } : s));
      if (typeof window !== 'undefined') {
        localStorage.setItem('dongy_services', JSON.stringify(updated));
      }
      return updated;
    });

    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('services')
          .update({ ...data, updated_at: now })
          .eq('id', id);
      } catch (err) {
        console.warn('Supabase update service error:', err);
      }
    }

    return { success: true, message: 'Đã cập nhật dịch vụ thành công!' };
  };

  const handleDeleteService = async (id: string) => {
    const target = services.find((s) => s.id === id);
    setServices((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      if (typeof window !== 'undefined') {
        localStorage.setItem('dongy_services', JSON.stringify(updated));
      }
      return updated;
    });

    if (isSupabaseConfigured) {
      try {
        await supabase.from('services').delete().eq('id', id);
      } catch (err) {
        console.warn('Supabase delete service error:', err);
      }
    }

    return { success: true, message: `Đã xóa dịch vụ "${target?.name || ''}" thành công!` };
  };

  const handleCreateUser = async (data: {
    profile: Omit<Profile, 'id' | 'created_at' | 'updated_at'>;
    practitioner?: Partial<PractitionerProfile>;
    initialBalance?: number;
  }): Promise<{ success: boolean; message?: string }> => {
    const trimmedPhone = data.profile.phone.trim();
    const existing = profiles.find((p) => p.phone.trim() === trimmedPhone);
    if (existing) {
      return {
        success: false,
        message: `Số điện thoại "${trimmedPhone}" đã tồn tại trong hệ thống (tài khoản: ${existing.full_name})!`,
      };
    }

    const newId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : '11111111-1111-1111-1111-' + Date.now().toString().slice(-12).padStart(12, '0');
    const now = new Date().toISOString();

    const newProfile: Profile = {
      id: newId,
      phone: trimmedPhone,
      password_hash: data.profile.password_hash || '123456',
      full_name: data.profile.full_name.trim(),
      avatar_url: data.profile.avatar_url || null,
      default_address: data.profile.default_address || null,
      role: data.profile.role,
      is_active: data.profile.is_active ?? true,
      created_at: now,
      updated_at: now,
    };

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
    }

    if (isLiveConnected) {
      try {
        const { error: pErr } = await supabase.from('profiles').insert([newProfile]);
        if (pErr) {
          console.error('Supabase insert profile error:', pErr);
          if (pErr.code === '23505') {
            return {
              success: false,
              message: `Số điện thoại "${trimmedPhone}" đã tồn tại trong cơ sở dữ liệu Supabase!`,
            };
          }
          return {
            success: false,
            message: `Lỗi tạo tài khoản trên Supabase: ${pErr.message}`,
          };
        }

        if (newPrac) {
          const { error: prErr } = await supabase.from('practitioner_profiles').insert([newPrac]);
          if (prErr) {
            console.error('Supabase insert practitioner error:', prErr);
            return {
              success: false,
              message: `Lỗi tạo hồ sơ thầy thuốc trên Supabase: ${prErr.message}`,
            };
          }
        }
        if (newWallet) {
          const { error: wErr } = await supabase.from('wallets').insert([newWallet]);
          if (wErr) {
            console.error('Supabase insert wallet error:', wErr);
            return {
              success: false,
              message: `Lỗi tạo ví tín dụng trên Supabase: ${wErr.message}`,
            };
          }
        }
      } catch (e: unknown) {
        console.error('Supabase live create user error:', e);
        const msg = e instanceof Error ? e.message : String(e);
        return { success: false, message: `Lỗi kết nối cơ sở dữ liệu: ${msg}` };
      }
    }

    setProfiles((prev) => [newProfile, ...prev]);
    if (newPrac) {
      setPractitioners((prev) => ({ ...prev, [newId]: newPrac! }));
    }
    if (newWallet) {
      setWallets((prev) => ({ ...prev, [newId]: newWallet! }));
    }

    if (isLiveConnected) {
      await checkSupabaseConnection();
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
    // 1. Kiểm tra số điện thoại bị trùng với tài khoản khác
    if (data.profile.phone) {
      const cleanPhone = data.profile.phone.trim();
      const duplicateUser = profiles.find(
        (p) => p.phone.trim() === cleanPhone && p.id !== userId
      );
      if (duplicateUser) {
        return {
          success: false,
          message: `Số điện thoại "${cleanPhone}" đã được sử dụng bởi tài khoản "${duplicateUser.full_name}"! Vui lòng nhập số khác.`,
        };
      }
    }

    const now = new Date().toISOString();

    if (isSupabaseConfigured) {
      try {
        if (data.profile && Object.keys(data.profile).length > 0) {
          const profilePayload: Partial<Profile> = {
            ...data.profile,
            updated_at: now,
          };
          if (profilePayload.phone) {
            profilePayload.phone = profilePayload.phone.trim();
          }
          if (profilePayload.full_name) {
            profilePayload.full_name = profilePayload.full_name.trim();
          }

          const { error: pErr } = await supabase
            .from('profiles')
            .update(profilePayload)
            .eq('id', userId);

          if (pErr) {
            console.error('Supabase update profile error:', pErr);
            if (pErr.code === '23505') {
              return {
                success: false,
                message: `Số điện thoại "${data.profile.phone}" đã bị trùng với tài khoản khác trong cơ sở dữ liệu! Vui lòng chọn số khác.`,
              };
            }
            return {
              success: false,
              message: `Lỗi cập nhật Supabase: ${pErr.message}`,
            };
          }
        }

        if (data.practitioner && Object.keys(data.practitioner).length > 0) {
          const { data: existingPrac, error: checkErr } = await supabase
            .from('practitioner_profiles')
            .select('id')
            .eq('user_id', userId)
            .maybeSingle();

          if (checkErr) {
            console.error('Check practitioner error:', checkErr);
          }

          if (existingPrac) {
            const { error: prErr } = await supabase
              .from('practitioner_profiles')
              .update({ ...data.practitioner, updated_at: now })
              .eq('user_id', userId);
            if (prErr) {
              return {
                success: false,
                message: `Lỗi cập nhật chuyên môn thầy thuốc: ${prErr.message}`,
              };
            }
          } else {
            const { error: prErr } = await supabase
              .from('practitioner_profiles')
              .insert([{ ...data.practitioner, user_id: userId, updated_at: now }]);
            if (prErr) {
              return {
                success: false,
                message: `Lỗi tạo chuyên môn thầy thuốc: ${prErr.message}`,
              };
            }
          }
        }
      } catch (e: unknown) {
        console.error('Supabase live update user error:', e);
        const msg = e instanceof Error ? e.message : String(e);
        return { success: false, message: `Lỗi kết nối cơ sở dữ liệu: ${msg}` };
      }
    }

    // Cập nhật React state sau khi Supabase đã lưu thành công
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
      await checkSupabaseConnection();
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
        message: `Không thể xóa tài khoản ${userName} vì đang có ca khám đang diễn ra hoặc chưa hoàn tất!`,
      };
    }

    if (isLiveConnected) {
      try {
        const { error: delErr } = await supabase.from('profiles').delete().eq('id', userId);
        if (delErr) {
          console.error('Supabase delete user error:', delErr);
          return {
            success: false,
            message: `Lỗi xóa tài khoản trên Supabase: ${delErr.message}`,
          };
        }
      } catch (e: unknown) {
        console.error('Supabase live delete user error:', e);
        const msg = e instanceof Error ? e.message : String(e);
        return { success: false, message: `Lỗi kết nối khi xóa: ${msg}` };
      }
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
      await checkSupabaseConnection();
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
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-between gap-2">
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
            services={services}
            onCreateBooking={handleCreateBooking}
            onCancelBooking={(id, reason) => handleCancelBooking(id, 'PATIENT', reason)}
            onSubmitReview={handleSubmitReview}
            onLogout={() => {
              setCurrentUser(null);
              setCurrentPractitioner(null);
            }}
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
            onCancelBooking={(id, reason) => handleCancelBooking(id, 'PRACTITIONER', reason)}
            onDepositWallet={handleDepositWallet}
            onToggleOnline={handleToggleOnline}
            onLogout={() => {
              setCurrentUser(null);
              setCurrentPractitioner(null);
            }}
          />
        ) : (
          <AdminView
            currentUser={currentUser}
            onLogout={() => {
              setCurrentUser(null);
              setCurrentPractitioner(null);
            }}
            profiles={profiles}
            practitioners={practitioners}
            wallets={wallets}
            bookings={bookings}
            transactions={transactions}
            services={services}
            onCreateService={handleCreateService}
            onUpdateService={handleUpdateService}
            onDeleteService={handleDeleteService}
            onVerifyPractitioner={handleVerifyPractitioner}
            onReassignDoctor={handleReassignDoctor}
            onCancelBookingByAdmin={(id, reason) => handleCancelBooking(id, 'ADMIN', reason)}
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
