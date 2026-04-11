import { useState, useEffect } from "react";
import { Car, MapPin, Clock, User, Phone, CreditCard, CalendarDays, Star, ChevronRight, LogIn, CalendarClock } from "lucide-react";
import { Link } from "react-router-dom";
import { onAuthStateChanged, type User as FBUser } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { subscribeToUserBookings } from "@/lib/firestoreStore";
import type { Booking } from "@/lib/store";

// Format date/time in Pakistan Standard Time (Karachi)
function formatPKT(isoString: string): string {
  if (!isoString) return '';
  try {
    return new Date(isoString).toLocaleString('en-PK', {
      timeZone: 'Asia/Karachi',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return isoString;
  }
}

const MyRides = () => {
  const [fbUser, setFbUser] = useState<FBUser | null | undefined>(undefined);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => {
      setFbUser(u);
      if (!u) setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (fbUser === undefined) return;
    if (!fbUser) {
      setBookings([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeToUserBookings(fbUser.uid, (data) => {
      setBookings(data);
      setLoading(false);
    });
    return () => unsub();
  }, [fbUser]);

  if (fbUser === undefined || loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center animate-fade-in-up">
        <div className="flex flex-col items-center gap-4">
          <Car className="w-12 h-12 text-primary/40 animate-pulse" />
          <p className="text-muted-foreground">Loading your rides…</p>
        </div>
      </div>
    );
  }

  if (!fbUser) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center animate-fade-in-up">
        <div className="glass-card p-10 flex flex-col items-center gap-4">
          <LogIn className="w-16 h-16 text-primary/50" />
          <h3 className="font-display text-xl text-foreground font-bold">Sign in to view your rides</h3>
          <p className="text-muted-foreground text-sm">Your bookings are linked to your account.</p>
          <Link to="/auth" className="bg-primary text-primary-foreground px-8 py-3 rounded-xl font-bold hover:bg-primary/85 transition-all hover:scale-105 inline-flex items-center gap-2">
            <LogIn className="w-4 h-4" /> Sign In
          </Link>
        </div>
      </div>
    );
  }

  const approvedBookings = bookings.filter(b => b.status === 'approved');
  const pendingBookings = bookings.filter(b => b.status === 'pending');

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 animate-fade-in-up">
      <h2 className="font-display text-2xl md:text-3xl text-center mb-2 gradient-text font-bold">My Rides</h2>
      <p className="text-center text-xs text-muted-foreground mb-8">{bookings.length} booking{bookings.length !== 1 ? 's' : ''} for {fbUser.email}</p>

      {bookings.length === 0 ? (
        <div className="text-center py-16 glass-card">
          <Car className="w-16 h-16 text-primary/40 mx-auto mb-4" />
          <h3 className="font-display text-xl text-muted-foreground">No Rides Yet</h3>
          <p className="text-muted-foreground text-sm mt-2">Book your first monthly ride to get started.</p>
          <Link to="/" className="inline-block mt-6 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-bold hover:bg-primary/85 transition-all">Book Now</Link>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {approvedBookings.length > 0 && (
            <div>
              <h3 className="text-green-400 font-semibold text-sm uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                Active Packages
              </h3>
              <div className="flex flex-col gap-3">
                {approvedBookings.map(b => <BookingCard key={b.id} booking={b} />)}
              </div>
            </div>
          )}

          {pendingBookings.length > 0 && (
            <div>
              <h3 className="text-orange-400 font-semibold text-sm uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-orange-400 rounded-full" />
                Pending Approval
              </h3>
              <div className="flex flex-col gap-3">
                {pendingBookings.map(b => <BookingCard key={b.id} booking={b} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const BookingCard = ({ booking: b }: { booking: Booking }) => (
  <div className={`glass-card p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-l-4 ${b.status === 'approved' ? 'border-l-green-500' : 'border-l-orange-500'}`}>
    <div className="flex-1">
      <div className="flex items-center gap-2 mb-3">
        <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
        <h4 className="text-primary font-display text-lg font-bold">{b.pickup}</h4>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
        <h4 className="text-primary font-display text-lg font-bold">{b.dropoff}</h4>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-primary/60" />{b.name}</span>
        <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-primary/60" />{b.whatsapp}</span>
        <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-primary/60" />{b.timing}</span>
        <span className="flex items-center gap-1.5"><Star className="w-3.5 h-3.5 text-primary/60" />{b.class}</span>
        <span className="flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5 text-primary/60" />{b.startDate}</span>
        <span className="flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5 text-primary/60" />{b.fare}</span>
        {b.assignedCar && (
          <span className="flex items-center gap-1.5"><Car className="w-3.5 h-3.5 text-primary/60" />{b.assignedCar}</span>
        )}
      </div>
      {b.createdAt && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground/70 border-t border-border/40 pt-2.5">
          <CalendarClock className="w-3 h-3 text-primary/40" />
          <span>Booked on: <span className="text-muted-foreground font-medium">{formatPKT(b.createdAt)}</span> <span className="text-primary/40">(PKT)</span></span>
        </div>
      )}
    </div>
    <div className={`px-5 py-2 rounded-full font-semibold text-sm border flex-shrink-0 ${b.status === 'approved' ? 'bg-green-500/20 border-green-500 text-green-400' : 'bg-orange-500/20 border-orange-500 text-orange-400'}`}>
      {b.status === 'approved' ? '✓ Approved' : '⏳ Pending'}
    </div>
  </div>
);

export default MyRides;
