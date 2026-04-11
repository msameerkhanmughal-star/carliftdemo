import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { saveUserToFirestore, getUserRoleFromFirestore } from "@/lib/firestoreStore";
import { setCurrentUser, getUsers, saveUsers } from "@/lib/store";
import { Eye, EyeOff, User, Mail, Phone, Lock, Loader2, AlertCircle } from "lucide-react";
import carLiftLogo from "@/assets/carlift-logo-new.png";

const InputField = ({
  type, placeholder, value, onChange, icon, rightEl, disabled
}: {
  type: string; placeholder: string; value: string;
  onChange: (v: string) => void; icon: React.ReactNode;
  rightEl?: React.ReactNode; disabled?: boolean;
}) => (
  <div className="relative flex items-center">
    <span className="absolute left-4 text-primary/70">{icon}</span>
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      className="w-full pl-11 pr-11 py-3.5 bg-input border border-primary/40 rounded-xl text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all hover:border-primary/60 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
    />
    {rightEl && <span className="absolute right-4">{rightEl}</span>}
  </div>
);

const AuthPage = () => {
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [showLoginPass, setShowLoginPass] = useState(false);

  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [signupPass, setSignupPass] = useState('');
  const [showSignupPass, setShowSignupPass] = useState(false);

  const handleFirebaseError = (code: string) => {
    const map: Record<string, string> = {
      'auth/user-not-found': 'No account found with this email.',
      'auth/wrong-password': 'Incorrect password. Please try again.',
      'auth/invalid-credential': 'Invalid email or password.',
      'auth/email-already-in-use': 'This email is already registered.',
      'auth/weak-password': 'Password must be at least 6 characters.',
      'auth/invalid-email': 'Please enter a valid email address.',
      'auth/too-many-requests': 'Too many attempts. Please try again later.',
      'auth/network-request-failed': 'Network error. Check your connection.',
    };
    return map[code] || 'Something went wrong. Please try again.';
  };

  const handleLogin = async () => {
    if (!loginEmail || !loginPass) { setError('Please fill in all fields.'); return; }
    setError('');
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, loginEmail, loginPass);
      const role = await getUserRoleFromFirestore(cred.user.uid);
      const user = {
        name: cred.user.displayName || loginEmail.split('@')[0],
        email: loginEmail,
        phone: '',
        password: '',
        role,
      };
      setCurrentUser(user);
      if (role === 'admin') navigate('/carlift-admin');
      else navigate('/');
    } catch (err: unknown) {
      const code = (err as { code?: string }).code || '';
      try {
        const users = getUsers();
        const localUser = users.find(u => u.email === loginEmail && u.password === loginPass);
        if (localUser) {
          setCurrentUser(localUser);
          if (localUser.role === 'admin') navigate('/carlift-admin');
          else navigate('/');
          return;
        }
      } catch {}
      setError(handleFirebaseError(code));
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    if (!signupName || !signupEmail || !signupPhone || !signupPass) {
      setError('All fields are required.'); return;
    }
    if (signupPass.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setError('');
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, signupEmail, signupPass);
      await updateProfile(cred.user, { displayName: signupName });
      await saveUserToFirestore(cred.user.uid, {
        name: signupName, email: signupEmail, phone: signupPhone, role: 'user',
      });
      const users = getUsers();
      users.push({ name: signupName, email: signupEmail, phone: signupPhone, password: signupPass, role: 'user' });
      saveUsers(users);
      setCurrentUser({ name: signupName, email: signupEmail, phone: signupPhone, password: '', role: 'user' });
      navigate('/');
    } catch (err: unknown) {
      const code = (err as { code?: string }).code || '';
      setError(handleFirebaseError(code));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (tab === 'login') handleLogin();
      else handleSignup();
    }
  };

  return (
    <div className="flex justify-center items-center min-h-[85vh] px-4 py-10 animate-fade-in-up">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/8 rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-md relative">
        {/* Card */}
        <div className="relative bg-card border border-primary/30 rounded-3xl p-8 md:p-10 shadow-2xl shadow-primary/10">
          {/* Top accent line */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent rounded-full" />

          {/* Logo */}
          <div className="flex flex-col items-center gap-3 mb-8">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl scale-150 pointer-events-none" />
              <img
                src={carLiftLogo}
                alt="Car Lift"
                className="relative h-44 w-auto object-contain drop-shadow-[0_0_30px_hsla(0,80%,50%,0.7)]"
              />
            </div>
            <p className="text-muted-foreground text-xs uppercase tracking-widest font-semibold">Premium Monthly Service</p>
          </div>

          {/* Tabs */}
          <div className="relative flex bg-input/60 rounded-xl p-1 mb-7">
            <div
              className="absolute top-1 bottom-1 w-[calc(50%-2px)] bg-primary/90 rounded-lg transition-all duration-300 shadow-md shadow-primary/30"
              style={{ left: tab === 'login' ? '4px' : 'calc(50% + 2px)' }}
            />
            {(['login', 'signup'] as const).map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(''); }}
                className={`relative flex-1 py-2.5 text-sm font-bold rounded-lg transition-colors duration-300 z-10 capitalize ${tab === t ? 'text-white' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {t === 'login' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          {/* Error Banner */}
          {error && (
            <div className="flex items-center gap-2.5 bg-destructive/15 border border-destructive/40 rounded-xl px-4 py-3 mb-5 animate-fade-in-up">
              <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Login Form */}
          {tab === 'login' ? (
            <div className="flex flex-col gap-4" onKeyDown={handleKeyDown}>
              <InputField
                type="email" placeholder="Email address" value={loginEmail}
                onChange={setLoginEmail} icon={<Mail className="w-4 h-4" />} disabled={loading}
              />
              <InputField
                type={showLoginPass ? 'text' : 'password'} placeholder="Password"
                value={loginPass} onChange={setLoginPass}
                icon={<Lock className="w-4 h-4" />} disabled={loading}
                rightEl={
                  <button type="button" onClick={() => setShowLoginPass(p => !p)}
                    className="text-muted-foreground hover:text-primary transition-colors">
                    {showLoginPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
              />
              <button
                onClick={handleLogin}
                disabled={loading}
                className="w-full py-3.5 mt-1 bg-gradient-to-r from-primary to-destructive rounded-xl font-bold text-primary-foreground hover:opacity-90 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-70 disabled:cursor-not-allowed disabled:scale-100 shadow-lg shadow-primary/30"
              >
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</> : 'Sign In'}
              </button>

              <p className="text-center text-xs text-muted-foreground mt-2">
                Don't have an account?{' '}
                <button onClick={() => { setTab('signup'); setError(''); }} className="text-primary font-semibold hover:underline">
                  Create one
                </button>
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4" onKeyDown={handleKeyDown}>
              <InputField
                type="text" placeholder="Full Name" value={signupName}
                onChange={setSignupName} icon={<User className="w-4 h-4" />} disabled={loading}
              />
              <InputField
                type="email" placeholder="Email address" value={signupEmail}
                onChange={setSignupEmail} icon={<Mail className="w-4 h-4" />} disabled={loading}
              />
              <InputField
                type="tel" placeholder="WhatsApp Number (11 digits)" value={signupPhone}
                onChange={setSignupPhone} icon={<Phone className="w-4 h-4" />} disabled={loading}
              />
              <InputField
                type={showSignupPass ? 'text' : 'password'} placeholder="Password (min. 6 characters)"
                value={signupPass} onChange={setSignupPass}
                icon={<Lock className="w-4 h-4" />} disabled={loading}
                rightEl={
                  <button type="button" onClick={() => setShowSignupPass(p => !p)}
                    className="text-muted-foreground hover:text-primary transition-colors">
                    {showSignupPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
              />
              <button
                onClick={handleSignup}
                disabled={loading}
                className="w-full py-3.5 mt-1 bg-gradient-to-r from-primary to-destructive rounded-xl font-bold text-primary-foreground hover:opacity-90 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-70 disabled:cursor-not-allowed disabled:scale-100 shadow-lg shadow-primary/30"
              >
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating account...</> : 'Create Account'}
              </button>

              <p className="text-center text-xs text-muted-foreground mt-2">
                Already have an account?{' '}
                <button onClick={() => { setTab('login'); setError(''); }} className="text-primary font-semibold hover:underline">
                  Sign in
                </button>
              </p>
            </div>
          )}

          {/* Bottom accent */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-[1px] bg-gradient-to-r from-transparent via-primary/40 to-transparent rounded-full" />
        </div>

        <p className="text-center text-xs text-muted-foreground/50 mt-5 uppercase tracking-widest">
          Secure · Reliable · Premium
        </p>
      </div>
    </div>
  );
};

export default AuthPage;
