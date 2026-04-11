import { useState, useEffect } from "react";
import {
  MapPin, Clock, Star, CalendarDays, CreditCard, User, Phone,
  ChevronLeft, ChevronRight, CheckCircle2, X, Navigation, Copy, Check, Car,
  Sunrise, Sunset, Loader2, Route
} from "lucide-react";
import {
  getPickupLocations, getDropoffMapping, savePickupLocations, saveDropoffMapping,
  ROUTES_DATA, calculateFare, getBookings, saveBookings,
  addNotification, type Booking, type RouteData, type PaymentInfo,
  getDistanceFromOSRM, getFarePerKmLocal,
  getWorkingDaysLocal,
  type WeekendOption, weekendExtraDays
} from "@/lib/store";
import {
  saveBookingToFirestore, addNotificationToFirestore,
  subscribeToRoutes, subscribeToPaymentInfo, subscribeToUserBookings,
  subscribeToFarePerKm, subscribeToWorkingDays, subscribeToLocations
} from "@/lib/firestoreStore";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, type User as FBUser } from "firebase/auth";

// ─── Attractive Route Carousel ───────────────────────────────────────────────

const RouteCarousel = ({ routes }: { routes: RouteData[] }) => {
  const [current, setCurrent] = useState(0);
  const list = routes.length ? routes : ROUTES_DATA;

  useEffect(() => {
    const timer = setInterval(() => setCurrent(c => (c + 1) % list.length), 4500);
    return () => clearInterval(timer);
  }, [list.length]);

  const [from, to] = list[current]?.title.split(' → ') ?? ['', ''];
  const route = list[current];

  return (
    <div className="mb-10">
      <h2 className="font-display text-2xl md:text-3xl text-center mb-6 gradient-text font-bold">Our Routes</h2>

      {/* Main card */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/40" style={{ background: 'linear-gradient(135deg, hsl(0 0% 4%), hsl(0 35% 9%))' }}>
        {/* Decorative glows */}
        <div className="absolute top-0 left-0 w-56 h-56 bg-primary/15 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-56 h-56 bg-primary/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative px-8 sm:px-14 py-8 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-primary/15 border border-primary/40 rounded-full px-4 py-1.5 mb-7">
            <Navigation className="w-3.5 h-3.5 text-primary animate-pulse" />
            <span className="text-xs text-primary font-bold uppercase tracking-widest">Active Route</span>
            <span className="text-xs text-muted-foreground ml-1">{current + 1}/{list.length}</span>
          </div>

          {/* Route display — UNBOXED */}
          <div className="flex flex-col md:flex-row items-center justify-center gap-3 md:gap-5 mb-8">
            <div className="text-center">
              <p className="text-[9px] text-muted-foreground uppercase tracking-[0.2em] mb-1 font-semibold">From</p>
              <p className="font-display text-2xl md:text-3xl text-primary font-black leading-tight drop-shadow-[0_0_18px_hsl(var(--primary)/0.5)]">{from}</p>
            </div>
            <div className="flex flex-col items-center gap-0.5 px-2">
              <div className="w-5 h-px bg-primary/50" />
              <ChevronRight className="w-8 h-8 text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.8)]" />
              <div className="w-5 h-px bg-primary/50" />
            </div>
            <div className="text-center">
              <p className="text-[9px] text-muted-foreground uppercase tracking-[0.2em] mb-1 font-semibold">To</p>
              <p className="font-display text-2xl md:text-3xl text-foreground font-black leading-tight">{to}</p>
            </div>
          </div>

          {/* Morning + Evening slots side by side */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-5">
            {route?.morningSlots && route.morningSlots.length > 0 && (
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <Sunrise className="w-4 h-4 text-amber-400" />
                  <span className="text-[10px] text-amber-400 font-bold uppercase tracking-widest">Morning Pickup</span>
                </div>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {route.morningSlots.map((t, i) => (
                    <span key={i} className="bg-amber-500/15 border border-amber-500/40 text-amber-300 px-3 py-1 rounded-full text-xs font-semibold">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {route?.morningSlots && route.morningSlots.length > 0 && route?.eveningSlots && route.eveningSlots.length > 0 && (
              <div className="hidden sm:block w-px h-12 bg-primary/20" />
            )}

            {route?.eveningSlots && route.eveningSlots.length > 0 && (
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <Sunset className="w-4 h-4 text-blue-400" />
                  <span className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">Evening Drop-off</span>
                </div>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {route.eveningSlots.map((t, i) => (
                    <span key={i} className="bg-blue-500/15 border border-blue-500/40 text-blue-300 px-3 py-1 rounded-full text-xs font-semibold">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Nav arrows */}
        <button
          onClick={() => setCurrent(c => (c - 1 + list.length) % list.length)}
          className="absolute left-3 top-1/2 -translate-y-1/2 bg-primary/90 hover:bg-primary hover:scale-110 p-2.5 rounded-full transition-all shadow-lg shadow-primary/30"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          onClick={() => setCurrent(c => (c + 1) % list.length)}
          className="absolute right-3 top-1/2 -translate-y-1/2 bg-primary/90 hover:bg-primary hover:scale-110 p-2.5 rounded-full transition-all shadow-lg shadow-primary/30"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Dots */}
      <div className="flex justify-center gap-2 mt-4">
        {list.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`h-2 rounded-full transition-all duration-300 ${i === current ? 'bg-primary w-8 shadow-[0_0_6px_hsl(var(--primary)/0.8)]' : 'bg-primary/30 w-2.5 hover:bg-primary/60'}`}
          />
        ))}
      </div>
    </div>
  );
};

// ─── Active Package Banner ────────────────────────────────────────────────────

const ActivePackageBanner = ({ booking }: { booking: Booking }) => {
  const [from, to] = [booking.pickup, booking.dropoff];
  return (
    <div className="mb-8 relative overflow-hidden rounded-2xl border border-green-500/50 bg-green-500/5 p-5">
      <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full blur-2xl pointer-events-none" />
      <div className="flex items-start gap-4">
        <div className="bg-green-500/20 p-3 rounded-xl flex-shrink-0">
          <CheckCircle2 className="w-6 h-6 text-green-400" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold uppercase tracking-widest text-green-400 bg-green-500/20 border border-green-500/40 px-2 py-0.5 rounded-full">Active Package</span>
            {booking.assignedCar && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Car className="w-3 h-3" />{booking.assignedCar.split(' ').slice(0, 3).join(' ')}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="font-display text-lg font-bold text-green-300">{from}</span>
            <ChevronRight className="w-4 h-4 text-green-500" />
            <span className="font-display text-lg font-bold text-green-300">{to}</span>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-green-500" />{booking.timing}</span>
            <span className="flex items-center gap-1"><Star className="w-3 h-3 text-green-500" />{booking.class}</span>
            <span className="flex items-center gap-1"><CreditCard className="w-3 h-3 text-green-500" />{booking.fare}</span>
            <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3 text-green-500" />Since {booking.startDate}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Payment Info Popup ──────────────────────────────────────────────────────

const PaymentPopup = ({
  method, info, onClose
}: {
  method: 'easypaisa' | 'jazzcash' | 'bankTransfer';
  info: PaymentInfo;
  onClose: () => void;
}) => {
  const [copied, setCopied] = useState(false);
  const labels: Record<string, string> = { easypaisa: 'Easypaisa', jazzcash: 'JazzCash', bankTransfer: 'Bank Transfer' };
  const colors: Record<string, string> = { easypaisa: 'text-green-400 border-green-500/50 bg-green-500/10', jazzcash: 'text-red-400 border-red-500/50 bg-red-500/10', bankTransfer: 'text-blue-400 border-blue-500/50 bg-blue-500/10' };
  const data = info[method];

  const copyNumber = () => {
    navigator.clipboard.writeText(data.accNumber).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 bg-background/90 z-[3000] flex justify-center items-center p-4" onClick={onClose}>
      <div className="bg-card border-2 border-primary/50 rounded-2xl p-6 max-w-sm w-full animate-fade-in-up shadow-2xl shadow-primary/20" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <h3 className="font-display text-lg font-bold text-primary">{labels[method]} Payment</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className={`border rounded-2xl p-5 mb-4 ${colors[method]}`}>
          <p className="text-xs uppercase tracking-widest opacity-70 mb-1">Account Name</p>
          <p className="text-xl font-bold mb-4">{data.accName || '—'}</p>
          <p className="text-xs uppercase tracking-widest opacity-70 mb-1">Account Number</p>
          <div className="flex items-center gap-3">
            <p className="text-2xl font-bold font-mono tracking-wider flex-1">{data.accNumber || '—'}</p>
            <button
              onClick={copyNumber}
              className="bg-white/10 hover:bg-white/20 border border-white/20 p-2.5 rounded-xl transition-all hover:scale-110 flex-shrink-0"
              title="Copy number"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          {copied && <p className="text-xs mt-2 opacity-80">Copied to clipboard!</p>}
        </div>

        <p className="text-xs text-muted-foreground text-center">Send payment to this account and mention your booking ID.</p>
      </div>
    </div>
  );
};

// ─── Selection Modal ─────────────────────────────────────────────────────────

const SelectionModal = ({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-background/95 z-[2000] flex justify-center items-center p-4" onClick={onClose}>
      <div className="bg-card border-2 border-primary rounded-2xl p-5 max-w-lg w-full max-h-[80vh] overflow-y-auto animate-fade-in-up" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center border-b border-primary pb-3 mb-4">
          <h3 className="text-primary font-display text-lg font-bold">{title}</h3>
          <button onClick={onClose} className="text-primary hover:text-primary/70 transition-colors"><X className="w-6 h-6" /></button>
        </div>
        {children}
      </div>
    </div>
  );
};

const OptionButton = ({ label, onClick, icon }: { label: string; onClick: () => void; icon?: React.ReactNode }) => (
  <button onClick={onClick} className="w-full p-3.5 my-1.5 bg-primary/10 border border-border rounded-lg hover:bg-primary/25 hover:border-primary hover:scale-[1.02] transition-all text-left text-sm font-medium flex items-center gap-3">
    {icon} {label}
  </button>
);

// ─── Calendar Modal ──────────────────────────────────────────────────────────

const CalendarModal = ({ open, onClose, onSelect }: { open: boolean; onClose: () => void; onSelect: (date: string) => void }) => {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [selected, setSelected] = useState('');
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const firstDay = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();

  const changeMonth = (delta: number) => {
    let m = month + delta, y = year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setMonth(m); setYear(y);
  };

  const selectDate = (d: number) => {
    const dateStr = `${d} ${months[month]} ${year}`;
    setSelected(dateStr);
    onSelect(dateStr);
    onClose();
  };

  if (!open) return null;
  return (
    <SelectionModal open={open} onClose={onClose} title="Select Start Date">
      <div className="flex justify-between items-center mb-4">
        <button onClick={() => changeMonth(-1)} className="bg-primary hover:bg-primary/80 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors">Prev</button>
        <span className="font-bold text-lg">{months[month]} {year}</span>
        <button onClick={() => changeMonth(1)} className="bg-primary hover:bg-primary/80 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors">Next</button>
      </div>
      <div className="grid grid-cols-7 gap-2 text-center">
        {days.map(d => <div key={d} className="font-bold text-primary text-xs py-1">{d}</div>)}
        {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
        {Array.from({ length: lastDate }).map((_, i) => {
          const dateStr = `${i + 1} ${months[month]} ${year}`;
          return (
            <button key={i} onClick={() => selectDate(i + 1)} className={`p-2 rounded-lg text-sm transition-all hover:scale-105 ${dateStr === selected ? 'bg-primary text-primary-foreground' : 'bg-primary/10 hover:bg-primary/30'}`}>
              {i + 1}
            </button>
          );
        })}
      </div>
    </SelectionModal>
  );
};

// ─── Main BookRide Page ──────────────────────────────────────────────────────

const BookRide = () => {
  const [fbUser, setFbUser] = useState<FBUser | null>(null);
  const [routes, setRoutes] = useState<RouteData[]>(ROUTES_DATA);
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null);
  const [paymentPopup, setPaymentPopup] = useState<'easypaisa' | 'jazzcash' | 'bankTransfer' | null>(null);

  const [fullName, setFullName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [timing, setTiming] = useState('');
  const [carClass, setCarClass] = useState('');
  const [startDate, setStartDate] = useState('');
  const [payments, setPayments] = useState<string[]>([]);

  const [modal, setModal] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [pickups, setPickups] = useState<string[]>([]);
  const [dropMap, setDropMap] = useState<Record<string, string[]>>({});
  const [farePerKm, setFarePerKm] = useState<number>(getFarePerKmLocal());
  const [workingDays, setWorkingDays] = useState<number>(getWorkingDaysLocal());
  const [weekendOption, setWeekendOption] = useState<WeekendOption>('none');
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [distanceLoading, setDistanceLoading] = useState(false);

  // Load from localStorage initially, then subscribe to Firestore for live updates
  useEffect(() => {
    setPickups(getPickupLocations());
    setDropMap(getDropoffMapping());
  }, []);

  useEffect(() => {
    const unsub = subscribeToLocations((firestorePickups, firestoreDropMap) => {
      if (firestorePickups.length > 0) {
        setPickups(firestorePickups);
        savePickupLocations(firestorePickups);
      }
      if (Object.keys(firestoreDropMap).length > 0) {
        setDropMap(firestoreDropMap);
        saveDropoffMapping(firestoreDropMap);
      }
    });
    return () => unsub();
  }, []);

  // Subscribe to Firebase auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => setFbUser(u));
    return () => unsub();
  }, []);

  // Subscribe to routes from Firestore
  useEffect(() => {
    const unsub = subscribeToRoutes(r => { if (r.length) setRoutes(r); });
    return () => unsub();
  }, []);

  // Subscribe to payment info
  useEffect(() => {
    const unsub = subscribeToPaymentInfo(info => setPaymentInfo(info));
    return () => unsub();
  }, []);

  // Subscribe to user's active booking
  useEffect(() => {
    if (!fbUser) { setActiveBooking(null); return; }
    const unsub = subscribeToUserBookings(fbUser.uid, (bookings) => {
      const approved = bookings.find(b => b.status === 'approved');
      setActiveBooking(approved || null);
    });
    return () => unsub();
  }, [fbUser]);

  // Subscribe to fare per km from Firestore
  useEffect(() => {
    const unsub = subscribeToFarePerKm(rate => {
      setFarePerKm(rate);
      localStorage.setItem('carlift_fare_per_km', String(rate));
    });
    return () => unsub();
  }, []);

  // Subscribe to working days from Firestore
  useEffect(() => {
    const unsub = subscribeToWorkingDays(days => {
      setWorkingDays(days);
      localStorage.setItem('carlift_working_days', String(days));
    });
    return () => unsub();
  }, []);

  // Fetch real driving distance when pickup + dropoff are set
  useEffect(() => {
    if (!pickup || !dropoff) { setDistanceKm(null); return; }
    setDistanceLoading(true);
    setDistanceKm(null);
    getDistanceFromOSRM(pickup, dropoff).then(km => {
      setDistanceKm(km);
      setDistanceLoading(false);
    });
  }, [pickup, dropoff]);

  const totalDays = workingDays + weekendExtraDays(weekendOption);
  const fare = calculateFare(pickup, dropoff, farePerKm, distanceKm ?? undefined, totalDays);

  const handlePaymentClick = (method: string) => {
    const keyMap: Record<string, 'easypaisa' | 'jazzcash' | 'bankTransfer'> = {
      'Easypaisa': 'easypaisa',
      'JazzCash': 'jazzcash',
      'Bank Transfer': 'bankTransfer',
    };
    const key = keyMap[method];
    // Toggle selection
    setPayments(prev => prev.includes(method) ? prev.filter(x => x !== method) : [...prev, method]);
    // Show popup if admin has set payment info
    if (paymentInfo && key && (paymentInfo[key]?.accNumber || paymentInfo[key]?.accName)) {
      setPaymentPopup(key);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fbUser) { alert('Please sign in to submit a booking'); return; }
    if (!fullName || whatsapp.length !== 11) { alert('Valid name and 11-digit WhatsApp required'); return; }
    if (!pickup || !dropoff || !timing || !carClass || !startDate) { alert('Complete all fields'); return; }
    if (payments.length === 0) { alert('Select payment method'); return; }

    const bookingId = Date.now();
    const newBooking: Booking = {
      id: bookingId,
      userId: fbUser.uid,
      name: fullName, whatsapp, pickup, dropoff, timing,
      class: carClass, startDate, payment: payments.join(', '),
      fare: fare ? `Rs ${fare.total.toLocaleString()}/month (${totalDays} days${weekendOption !== 'none' ? `, incl. ${weekendOption === 'saturday' ? 'Saturdays' : 'Sat & Sun'}` : ''})` : 'TBD',
      status: 'pending', assignedCar: '',
      createdAt: new Date().toISOString(),
    };

    const bookings = getBookings();
    bookings.unshift(newBooking);
    saveBookings(bookings);

    await saveBookingToFirestore(newBooking);

    const notifMsg = `New booking from ${fullName} (${pickup} → ${dropoff})`;
    addNotification(notifMsg, bookingId);
    await addNotificationToFirestore(notifMsg, bookingId);

    setShowSuccess(true);
    setFullName(''); setWhatsapp(''); setPickup(''); setDropoff('');
    setTiming(''); setCarClass(''); setStartDate(''); setPayments([]);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 animate-fade-in-up">
      <RouteCarousel routes={routes} />

      {/* Active package banner */}
      {activeBooking && <ActivePackageBanner booking={activeBooking} />}

      <div className="glass-card p-6 md:p-8">
        <h2 className="font-display text-xl md:text-2xl text-center mb-8 gradient-text font-bold">Monthly Plan Booking</h2>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-primary text-xs uppercase tracking-wider flex items-center gap-1.5"><User className="w-3.5 h-3.5" />Full Name</label>
              <input value={fullName} onChange={e => setFullName(e.target.value)} className="px-4 py-3 bg-input border border-primary/50 rounded-lg text-foreground focus:border-primary focus:outline-none transition-colors hover:border-primary/70" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-primary text-xs uppercase tracking-wider flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />WhatsApp (11 digits)</label>
              <input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} maxLength={11} className="px-4 py-3 bg-input border border-primary/50 rounded-lg text-foreground focus:border-primary focus:outline-none transition-colors hover:border-primary/70" required />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-primary text-xs uppercase tracking-wider flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />Pickup Location</label>
              <button type="button" onClick={() => setModal('pickup')} className={`px-4 py-3 bg-input border rounded-lg text-left transition-all hover:border-primary hover:bg-primary/5 ${pickup ? 'border-primary bg-primary/10' : 'border-primary/50'}`}>
                {pickup || 'Select pickup'}
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-primary text-xs uppercase tracking-wider flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />Drop-off Location</label>
              <button type="button" onClick={() => { if (!pickup) { alert('Select pickup first'); return; } setModal('dropoff'); }} className={`px-4 py-3 bg-input border rounded-lg text-left transition-all hover:border-primary hover:bg-primary/5 ${dropoff ? 'border-primary bg-primary/10' : 'border-primary/50'}`}>
                {dropoff || 'Select dropoff'}
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-primary text-xs uppercase tracking-wider flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />Timing Slot</label>
              <button type="button" onClick={() => { if (!pickup || !dropoff) { alert('Select route first'); return; } setModal('timing'); }} className={`px-4 py-3 bg-input border rounded-lg text-left transition-all hover:border-primary hover:bg-primary/5 ${timing ? 'border-primary bg-primary/10' : 'border-primary/50'}`}>
                {timing || 'Select timing'}
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-primary text-xs uppercase tracking-wider flex items-center gap-1.5"><Star className="w-3.5 h-3.5" />Vehicle Class</label>
              <button type="button" onClick={() => setModal('class')} className={`px-4 py-3 bg-input border rounded-lg text-left transition-all hover:border-primary hover:bg-primary/5 ${carClass ? 'border-primary bg-primary/10' : 'border-primary/50'}`}>
                {carClass || 'Select class'}
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-primary text-xs uppercase tracking-wider flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" />Start Date</label>
              <button type="button" onClick={() => setModal('calendar')} className={`px-4 py-3 bg-input border rounded-lg text-left transition-all hover:border-primary hover:bg-primary/5 ${startDate ? 'border-primary bg-primary/10' : 'border-primary/50'}`}>
                {startDate || 'Select start date'}
              </button>
            </div>
          </div>

          {/* Select Weekends */}
          <div className="mt-5">
            <label className="font-semibold text-primary text-xs uppercase tracking-wider flex items-center gap-1.5 mb-3">
              <CalendarDays className="w-3.5 h-3.5" />Select Weekends
              <span className="text-muted-foreground font-normal normal-case tracking-normal text-[11px] ml-1">(optional — adds to monthly days)</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: 'none',     label: 'Weekdays Only',       sub: `${workingDays} days`,                 icon: '📅' },
                { value: 'saturday', label: '+ Saturday',          sub: `${workingDays} + 4 = ${workingDays + 4} days`, icon: '🗓️' },
                { value: 'both',     label: '+ Sat & Sun',         sub: `${workingDays} + 8 = ${workingDays + 8} days`, icon: '📆' },
              ] as { value: WeekendOption; label: string; sub: string; icon: string }[]).map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setWeekendOption(opt.value)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all hover:scale-[1.02] ${
                    weekendOption === opt.value
                      ? 'border-primary bg-primary/15 shadow-[0_0_12px_hsl(var(--primary)/0.3)]'
                      : 'border-primary/30 bg-input hover:border-primary/60 hover:bg-primary/5'
                  }`}
                >
                  <span className="text-lg">{opt.icon}</span>
                  <span className={`text-xs font-bold ${weekendOption === opt.value ? 'text-primary' : 'text-foreground'}`}>{opt.label}</span>
                  <span className={`text-[10px] ${weekendOption === opt.value ? 'text-primary/80' : 'text-muted-foreground'}`}>{opt.sub}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Fare */}
          <div className="mt-5">
            <label className="font-semibold text-primary text-xs uppercase tracking-wider flex items-center gap-1.5 mb-2"><CreditCard className="w-3.5 h-3.5" />Monthly Fare (incl. 11% SRB Tax)</label>
            <div className="bg-input border border-primary/50 rounded-xl p-4">
              {pickup && dropoff ? (
                distanceLoading ? (
                  <div className="flex items-center justify-center gap-2 text-muted-foreground py-1">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span className="text-sm">Calculating route distance...</span>
                  </div>
                ) : fare ? (
                  <div className="text-center">
                    <div className="text-primary text-2xl font-bold mb-3">
                      Rs {fare.total.toLocaleString()}
                      <span className="text-sm font-normal text-muted-foreground">/month</span>
                    </div>

                    {/* Calculation breakdown */}
                    <div className="bg-card border border-border rounded-lg p-3 text-left text-xs space-y-1.5 mb-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground flex items-center gap-1.5"><Route className="w-3 h-3 text-primary" />Driving distance</span>
                        <span className="font-semibold">{fare.km} km</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Rate per km</span>
                        <span className="font-semibold">Rs {farePerKm}/km</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground flex items-center gap-1">
                          Total days
                          {weekendOption !== 'none' && (
                            <span className="text-primary text-[10px]">
                              ({workingDays}wd + {weekendExtraDays(weekendOption)}we)
                            </span>
                          )}
                        </span>
                        <span className="font-semibold text-primary">{totalDays} days</span>
                      </div>
                      <div className="border-t border-border pt-1.5 flex justify-between">
                        <span className="text-muted-foreground">Base fare</span>
                        <span className="font-semibold">Rs {fare.base.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">SRB Tax (11%)</span>
                        <span className="font-semibold">Rs {fare.tax.toLocaleString()}</span>
                      </div>
                      <div className="border-t border-primary/30 pt-1.5 flex justify-between font-bold">
                        <span className="text-primary">Monthly Total</span>
                        <span className="text-primary">Rs {fare.total.toLocaleString()}</span>
                      </div>
                    </div>

                    {distanceKm !== null && (
                      <div className="flex flex-col items-center gap-1.5">
                        <p className="text-[10px] text-muted-foreground/60">Distance via OpenStreetMap routing</p>
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(pickup + ', Karachi, Pakistan')}&destination=${encodeURIComponent(dropoff + ', Karachi, Pakistan')}&travelmode=driving`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-[11px] bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:text-blue-300 hover:border-blue-400/50 hover:bg-blue-500/15 px-3 py-1.5 rounded-full transition-all font-medium"
                        >
                          <MapPin className="w-3 h-3" />
                          Verify on Google Maps
                        </a>
                      </div>
                    )}
                  </div>
                ) : null
              ) : (
                <p className="text-center text-muted-foreground text-sm py-1">Select pickup & drop-off to see fare</p>
              )}
            </div>
          </div>

          {/* Payment */}
          <div className="mt-6">
            <label className="font-semibold text-primary text-xs uppercase tracking-wider mb-1 block">Payment Method</label>
            <p className="text-xs text-muted-foreground mb-3">Tap a method to see payment details</p>
            <div className="flex flex-wrap gap-3">
              {(['Easypaisa', 'JazzCash', 'Bank Transfer'] as const).map(p => (
                <button key={p} type="button" onClick={() => handlePaymentClick(p)}
                  className={`px-5 py-3 border rounded-lg font-medium text-sm transition-all hover:scale-105 ${payments.includes(p) ? 'bg-primary/30 border-primary shadow-[0_0_10px_hsla(0,70%,45%,0.4)]' : 'bg-input border-primary/50 hover:border-primary hover:bg-primary/10'}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" className="w-full mt-8 py-4 bg-primary border-none rounded-xl font-display font-bold text-lg text-primary-foreground hover:bg-primary/85 hover:scale-[1.01] transition-all shadow-lg shadow-primary/30">
            Confirm Booking
          </button>
        </form>
      </div>

      {/* Modals */}
      <SelectionModal open={modal === 'pickup'} onClose={() => setModal(null)} title="Select Pickup">
        {pickups.map(l => <OptionButton key={l} label={l} icon={<MapPin className="w-4 h-4 text-primary" />} onClick={() => { setPickup(l); setDropoff(''); setTiming(''); setModal(null); }} />)}
      </SelectionModal>
      <SelectionModal open={modal === 'dropoff'} onClose={() => setModal(null)} title="Select Drop-off">
        {(dropMap[pickup] || []).map(d => <OptionButton key={d} label={d} icon={<MapPin className="w-4 h-4 text-primary" />} onClick={() => { setDropoff(d); setModal(null); }} />)}
      </SelectionModal>
      <SelectionModal open={modal === 'timing'} onClose={() => setModal(null)} title="Select Timing">
        {(routes.find(r => r.title === `${pickup} → ${dropoff}`)?.timings || []).map(t => <OptionButton key={t} label={t} icon={<Clock className="w-4 h-4 text-primary" />} onClick={() => { setTiming(t); setModal(null); }} />)}
      </SelectionModal>
      <SelectionModal open={modal === 'class'} onClose={() => setModal(null)} title="Vehicle Class">
        {['Executive', 'Pro Executive'].map(c => <OptionButton key={c} label={c} icon={<Star className="w-4 h-4 text-primary" />} onClick={() => { setCarClass(c); setModal(null); }} />)}
      </SelectionModal>
      <CalendarModal open={modal === 'calendar'} onClose={() => setModal(null)} onSelect={setStartDate} />

      {/* Payment popup */}
      {paymentPopup && paymentInfo && (
        <PaymentPopup method={paymentPopup} info={paymentInfo} onClose={() => setPaymentPopup(null)} />
      )}

      {/* Success Modal */}
      {showSuccess && (
        <div className="fixed inset-0 bg-background/95 z-[2000] flex justify-center items-center p-4">
          <div className="bg-card border-2 border-primary rounded-2xl p-8 max-w-md w-full text-center animate-fade-in-up">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="font-display text-2xl text-primary font-bold mb-2">Booking Confirmed!</h3>
            <p className="text-muted-foreground mb-6">Your monthly package request is pending approval.</p>
            <button onClick={() => setShowSuccess(false)} className="bg-primary text-primary-foreground px-8 py-3 rounded-lg font-bold hover:opacity-90 transition-all hover:scale-105">Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookRide;
