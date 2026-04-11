import { useState, useEffect } from "react";
import { Phone, LogIn, LogOut, User, Menu, X } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { onAuthStateChanged, signOut, type User as FirebaseUser } from "firebase/auth";
import { auth } from "@/lib/firebase";
import carLiftLogo from "@/assets/carlift-logo-new.png";

const SlidingBanner = () => {
  const location = useLocation();
  if (location.pathname === '/carlift-admin') return null;
  return (
    <div className="sliding-banner-bg overflow-hidden whitespace-nowrap border-b-2 border-primary py-2.5 relative z-50">
      <div className="flex w-max">
        {[0, 1].map((i) => (
          <div key={i} className="inline-block animate-slide whitespace-nowrap pr-8 font-display font-black text-lg md:text-2xl uppercase tracking-wider text-primary-foreground" style={{ textShadow: '2px 2px 0 hsl(0 30% 10%)' }}>
            MONTHLY PACKAGES ONLY &nbsp;&nbsp;|&nbsp;&nbsp; 25K TO 50K + TAX &nbsp;&nbsp;|&nbsp;&nbsp; PREMIUM CAR LIFT
          </div>
        ))}
      </div>
    </div>
  );
};

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = location.pathname === '/carlift-admin';
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  // Close menu on route change
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  if (isAdmin) return null;

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/auth');
    setMenuOpen(false);
  };

  return (
    <nav className="bg-background/95 backdrop-blur-md border-b-2 border-primary sticky top-0 z-[1000]">
      <div className="px-4 md:px-8 py-1 flex justify-between items-center">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3">
          <img
            src={carLiftLogo}
            alt="Car Lift"
            className="h-20 md:h-28 w-auto object-contain drop-shadow-[0_0_12px_hsl(var(--primary)/0.8)]"
          />
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex gap-5 items-center">
          <Link
            to="/"
            className={`font-semibold transition-colors hover:text-primary ${location.pathname === '/' ? 'text-primary border-b-2 border-primary pb-1' : 'text-foreground'}`}
          >
            Book Ride
          </Link>
          <Link
            to="/my-rides"
            className={`font-semibold transition-colors hover:text-primary ${location.pathname === '/my-rides' ? 'text-primary border-b-2 border-primary pb-1' : 'text-foreground'}`}
          >
            My Rides
          </Link>
          <a
            href="https://wa.me/923099926777?text=Hello"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-green-600 hover:bg-green-700 text-primary-foreground px-4 py-2 rounded-full font-bold flex items-center gap-2 text-sm transition-colors"
          >
            <Phone className="w-4 h-4" /> WhatsApp
          </a>

          {user ? (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground bg-primary/10 border border-primary/30 px-3 py-1.5 rounded-full">
                <User className="w-3.5 h-3.5 text-primary" />
                {user.email?.split('@')[0]}
              </span>
              <button
                onClick={handleLogout}
                className="bg-primary/20 hover:bg-primary/30 border border-primary/40 text-primary px-3 py-1.5 rounded-full font-bold flex items-center gap-1.5 text-sm transition-all hover:scale-105"
              >
                <LogOut className="w-4 h-4" /> Logout
              </button>
            </div>
          ) : (
            <Link
              to="/auth"
              className="bg-primary hover:bg-primary/80 text-primary-foreground px-4 py-2 rounded-full font-bold flex items-center gap-2 text-sm transition-all hover:scale-105"
            >
              <LogIn className="w-4 h-4" /> Login
            </Link>
          )}
        </div>

        {/* Mobile: right side */}
        <div className="flex md:hidden items-center gap-2">
          <a
            href="https://wa.me/923099926777?text=Hello"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-green-600 hover:bg-green-700 text-white p-2 rounded-full transition-colors"
            aria-label="WhatsApp"
          >
            <Phone className="w-4 h-4" />
          </a>
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="bg-primary/10 hover:bg-primary/20 border border-primary/30 p-2 rounded-lg transition-colors"
            aria-label="Menu"
          >
            {menuOpen ? <X className="w-5 h-5 text-primary" /> : <Menu className="w-5 h-5 text-primary" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-primary/20 bg-background/98 px-4 py-4 flex flex-col gap-3 animate-fade-in-up">
          <Link
            to="/"
            className={`py-2.5 px-4 rounded-xl font-semibold transition-colors flex items-center gap-2 ${location.pathname === '/' ? 'bg-primary/15 text-primary border border-primary/30' : 'text-foreground hover:bg-primary/10'}`}
          >
            Book Ride
          </Link>
          <Link
            to="/my-rides"
            className={`py-2.5 px-4 rounded-xl font-semibold transition-colors flex items-center gap-2 ${location.pathname === '/my-rides' ? 'bg-primary/15 text-primary border border-primary/30' : 'text-foreground hover:bg-primary/10'}`}
          >
            My Rides
          </Link>

          <div className="border-t border-border pt-3 mt-1">
            {user ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground px-1">
                  <User className="w-4 h-4 text-primary" />
                  {user.email}
                </div>
                <button
                  onClick={handleLogout}
                  className="bg-primary/20 border border-primary/40 text-primary px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 text-sm transition-all"
                >
                  <LogOut className="w-4 h-4" /> Logout
                </button>
              </div>
            ) : (
              <Link
                to="/auth"
                className="bg-primary text-primary-foreground px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 text-sm"
              >
                <LogIn className="w-4 h-4" /> Login
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export { SlidingBanner, Navbar };
