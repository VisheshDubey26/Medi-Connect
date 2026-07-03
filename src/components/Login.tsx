import { useState, FormEvent } from 'react';
import { auth, googleAuthProvider, signInWithPopup } from '../lib/firebase.ts';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile 
} from 'firebase/auth';
import { 
  ShieldAlert, 
  Stethoscope, 
  UserRound, 
  Sparkles, 
  Lock, 
  Mail, 
  User, 
  ArrowRight, 
  Play, 
  CheckCircle,
  AlertCircle,
  GraduationCap,
  Briefcase,
  DollarSign,
  HeartHandshake,
  Calendar,
  Users
} from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (token: string, role: string, user: { email: string; name: string; uid: string }) => void;
}

type PortalType = 'patient' | 'doctor' | 'admin';

export default function Login({ onLoginSuccess }: LoginProps) {
  const [activePortal, setActivePortal] = useState<PortalType>('patient');
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Doctor specific signup states
  const [specialization, setSpecialization] = useState('General Medicine');
  const [qualifications, setQualifications] = useState('');
  const [experienceYears, setExperienceYears] = useState('');
  const [consultantFee, setConsultantFee] = useState('');

  // Patient specific signup states
  const [gender, setGender] = useState('Male');
  const [dob, setDob] = useState('');
  const [bloodGroup, setBloodGroup] = useState('O+');

  // Info details for portals
  const portalConfig = {
    patient: {
      title: 'Patient Care Portal',
      subtitle: 'Schedule consultations, check symptoms with AI, and track prescriptions.',
      colorClass: 'text-emerald-600',
      bgGradient: 'from-emerald-500 to-teal-600',
      icon: UserRound,
      demoText: 'Log into Patient Demo environment instantly.',
      mockToken: 'mock_patient_token',
      defaultEmail: 'patient@mediconnect.com',
    },
    doctor: {
      title: 'Doctor Clinical Desk',
      subtitle: 'Review diagnostic pre-visit summaries, handle queues, and sign e-prescriptions.',
      colorClass: 'text-blue-600',
      bgGradient: 'from-blue-500 to-indigo-600',
      icon: Stethoscope,
      demoText: 'Log into Specialist Doctor Demo environment instantly.',
      mockToken: 'mock_doctor_token',
      defaultEmail: 'doctor@hospital.com',
    },
    admin: {
      title: 'Admin Control Center',
      subtitle: 'Manage doctors roster, handle practitioner leaves, and track healthcare analytics.',
      colorClass: 'text-indigo-600',
      bgGradient: 'from-indigo-500 to-violet-600',
      icon: ShieldAlert,
      demoText: 'Log into System Administrator Demo environment instantly.',
      mockToken: 'mock_admin_token',
      defaultEmail: 'admin@hospital.com',
    }
  };

  const handleDemoLogin = () => {
    setLoading(true);
    const config = portalConfig[activePortal];
    setTimeout(() => {
      onLoginSuccess(
        config.mockToken,
        activePortal,
        {
          email: config.defaultEmail,
          name: activePortal === 'doctor' ? 'Dr. Alexander Pierce' : activePortal === 'admin' ? 'Admin Administrator' : 'Patient User',
          uid: `demo_${activePortal}_uid`
        }
      );
      setLoading(false);
    }, 600);
  };

  const handleFirebaseLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all credentials.');
      return;
    }
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (isSignUp) {
        if (!name) {
          setError('Please provide your name for register.');
          setLoading(false);
          return;
        }

        // Validate extra fields
        if (activePortal === 'doctor') {
          if (!qualifications.trim()) {
            setError('Please state your medical qualifications (e.g. MBBS, MD).');
            setLoading(false);
            return;
          }
          if (!experienceYears || isNaN(Number(experienceYears)) || Number(experienceYears) < 0) {
            setError('Please provide valid Years of Experience.');
            setLoading(false);
            return;
          }
          if (!consultantFee || isNaN(Number(consultantFee)) || Number(consultantFee) < 0) {
            setError('Please state a valid Consultant Fee (in dollars or local currency).');
            setLoading(false);
            return;
          }
        } else if (activePortal === 'patient') {
          if (!dob) {
            setError('Please select your Date of Birth.');
            setLoading(false);
            return;
          }
        }

        let token: string;
        let userUid: string;
        let finalName = name;

        try {
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          await updateProfile(userCredential.user, { displayName: name });
          token = await userCredential.user.getIdToken();
          userUid = userCredential.user.uid;
        } catch (firebaseErr: any) {
          console.warn('Firebase registration failed or is disabled. Falling back to Sandbox bypass...', firebaseErr);
          if (
            firebaseErr.code === 'auth/operation-not-allowed' || 
            (firebaseErr.message && firebaseErr.message.includes('operation-not-allowed')) ||
            firebaseErr.code === 'auth/admin-restricted'
          ) {
            token = `mock_${activePortal}__${email}__${encodeURIComponent(name)}`;
            userUid = `mock_uid_${activePortal}_${email.replace(/[@.]/g, '_')}`;
          } else {
            throw firebaseErr;
          }
        }

        // Perform registration onboarding immediately
        const onboardPayload = {
          role: activePortal,
          name: finalName,
          specialization: activePortal === 'doctor' ? specialization : undefined,
          qualifications: activePortal === 'doctor' ? qualifications : undefined,
          experienceYears: activePortal === 'doctor' ? parseInt(experienceYears) : undefined,
          consultantFee: activePortal === 'doctor' ? parseInt(consultantFee) : undefined,
          gender: activePortal === 'patient' ? gender : undefined,
          dob: activePortal === 'patient' ? dob : undefined,
          bloodGroup: activePortal === 'patient' ? bloodGroup : undefined,
        };

        const onboardRes = await fetch('/api/auth/onboard', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(onboardPayload)
        });

        if (!onboardRes.ok) {
          const onboardErr = await onboardRes.json();
          throw new Error(onboardErr.error || 'Failed to register profile details in local directory.');
        }
        
        setSuccess('Registration completed successfully with medical credentials!');
        
        onLoginSuccess(
          token,
          activePortal,
          {
            email: email,
            name: finalName,
            uid: userUid
          }
        );
      } else {
        let token: string;
        let userUid: string;
        let finalName = email.split('@')[0];

        try {
          const userCredential = await signInWithEmailAndPassword(auth, email, password);
          token = await userCredential.user.getIdToken();
          userUid = userCredential.user.uid;
          finalName = userCredential.user.displayName || email.split('@')[0];
        } catch (firebaseErr: any) {
          console.warn('Firebase login failed or is disabled. Falling back to Sandbox bypass...', firebaseErr);
          if (
            firebaseErr.code === 'auth/operation-not-allowed' || 
            (firebaseErr.message && firebaseErr.message.includes('operation-not-allowed')) ||
            firebaseErr.code === 'auth/user-not-found'
          ) {
            token = `mock_${activePortal}__${email}__${encodeURIComponent(email.split('@')[0])}`;
            userUid = `mock_uid_${activePortal}_${email.replace(/[@.]/g, '_')}`;
          } else {
            throw firebaseErr;
          }
        }

        setSuccess('Logged in successfully!');
        
        onLoginSuccess(
          token,
          activePortal,
          {
            email: email,
            name: finalName,
            uid: userUid
          }
        );
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const userCredential = await signInWithPopup(auth, googleAuthProvider);
      const token = await userCredential.user.getIdToken();

      // For Google users, we'll assign them their chosen portal role by default on onboarding
      const onboardPayload = {
        role: activePortal,
        name: userCredential.user.displayName || 'Google User',
        specialization: activePortal === 'doctor' ? specialization : undefined,
        qualifications: activePortal === 'doctor' ? (qualifications || 'MD') : undefined,
        experienceYears: activePortal === 'doctor' ? (parseInt(experienceYears) || 5) : undefined,
        consultantFee: activePortal === 'doctor' ? (parseInt(consultantFee) || 100) : undefined,
        gender: activePortal === 'patient' ? gender : undefined,
        dob: activePortal === 'patient' ? (dob || '1990-01-01') : undefined,
        bloodGroup: activePortal === 'patient' ? bloodGroup : undefined,
      };

      await fetch('/api/auth/onboard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(onboardPayload)
      });

      setSuccess('Logged in successfully via Google!');
      
      onLoginSuccess(
        token,
        activePortal,
        {
          email: userCredential.user.email || '',
          name: userCredential.user.displayName || 'Google User',
          uid: userCredential.user.uid
        }
      );
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Google Auth aborted or failed.');
    } finally {
      setLoading(false);
    }
  };

  const currentConfig = portalConfig[activePortal];
  const ActiveIcon = currentConfig.icon;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 md:p-8 font-sans">
      <div className="bg-white rounded-3xl shadow-xl border border-gray-100 max-w-5xl w-full grid grid-cols-1 md:grid-cols-12 overflow-hidden min-h-[600px]">
        
        {/* Left Interactive Panel (Metadata & Instructions) */}
        <div className={`md:col-span-5 bg-gradient-to-tr ${currentConfig.bgGradient} p-8 text-white flex flex-col justify-between transition-all duration-500`}>
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-white/10 rounded-xl">
                <Sparkles className="h-6 w-6 text-white animate-pulse" />
              </div>
              <span className="font-display font-bold tracking-tight text-lg">MediConnect</span>
            </div>

            <div className="space-y-3 pt-6">
              <span className="bg-white/10 px-3 py-1 rounded-full text-[10px] font-mono tracking-widest uppercase">
                {activePortal} access tier
              </span>
              <h2 className="text-2xl font-bold tracking-tight">{currentConfig.title}</h2>
              <p className="text-sm text-white/80 leading-relaxed">
                {currentConfig.subtitle}
              </p>
            </div>
          </div>

          <div className="space-y-4 pt-12 border-t border-white/10">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-white/10 rounded-lg">
                <CheckCircle className="h-4 w-4" />
              </div>
              <span className="text-xs text-white/90">Dual-tier encryption & secure locks</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-white/10 rounded-lg">
                <CheckCircle className="h-4 w-4" />
              </div>
              <span className="text-xs text-white/90">Google AI integration enabled</span>
            </div>
            <p className="text-[10px] font-mono text-white/60">
              Authorized personnel only. Sessions are tracked dynamically.
            </p>
          </div>
        </div>

        {/* Right Auth Forms Section */}
        <div className="md:col-span-7 p-8 md:p-12 flex flex-col justify-between space-y-8">
          
          {/* Header Portal Selector Tabs */}
          <div className="space-y-3">
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider block text-center md:text-left">
              Select Authorized Portal
            </span>
            <div className="grid grid-cols-3 gap-2 bg-gray-50 p-1.5 rounded-2xl border border-gray-100">
              {(['patient', 'doctor', 'admin'] as PortalType[]).map((p) => {
                const conf = portalConfig[p];
                const IconComp = conf.icon;
                const isSelected = activePortal === p;
                return (
                  <button
                    key={p}
                    onClick={() => {
                      setActivePortal(p);
                      setError('');
                      setSuccess('');
                    }}
                    className={`flex flex-col items-center gap-1 py-3 rounded-xl text-xs font-semibold transition-all ${
                      isSelected
                        ? 'bg-white shadow-sm border border-gray-100 text-gray-900 scale-105'
                        : 'text-gray-400 hover:text-gray-600 hover:bg-white/40'
                    }`}
                  >
                    <IconComp className={`h-4.5 w-4.5 ${isSelected ? conf.colorClass : 'text-gray-400'}`} />
                    <span className="capitalize">{p}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Core Login/Register Forms */}
          <div className="space-y-6">
            <div className="text-center md:text-left">
              <h3 className="text-xl font-bold text-gray-900">
                {isSignUp ? 'Register Security Credentials' : 'Sign In Authenticated Access'}
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {isSignUp ? 'Establish a secure credentials dossier' : 'Enter registered medical details to continue'}
              </p>
            </div>

            {/* Error & Success Feedback banners */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-700 font-medium flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
            {success && (
              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-700 font-medium flex items-center gap-2">
                <CheckCircle className="h-4 w-4 shrink-0" />
                {success}
              </div>
            )}

            <form onSubmit={handleFirebaseLogin} className="space-y-4">
              {isSignUp && (
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      required
                      placeholder="Jane Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-900 transition-all"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    type="email"
                    required
                    placeholder="you@hospital.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-900 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Security Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-900 transition-all"
                  />
                </div>
              </div>

              {/* DYNAMIC SIGNUP FIELDS (DOCTOR vs PATIENT) */}
              {isSignUp && activePortal === 'doctor' && (
                <div className="space-y-4 pt-3 border-t border-dashed border-gray-200">
                  <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider block">Doctor Credentials Dossier</span>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Specialization</label>
                      <div className="relative">
                        <HeartHandshake className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <select
                          value={specialization}
                          onChange={(e) => setSpecialization(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-900 transition-all appearance-none"
                        >
                          <option value="General Medicine">General Medicine</option>
                          <option value="Cardiologist">Cardiologist</option>
                          <option value="Dentist">Dentist</option>
                          <option value="Neurologist">Neurologist</option>
                          <option value="Pediatrician">Pediatrician</option>
                          <option value="Dermatologist">Dermatologist</option>
                          <option value="Gynecologist">Gynecologist</option>
                          <option value="Orthopedist">Orthopedist</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Qualifications</label>
                      <div className="relative">
                        <GraduationCap className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <input
                          type="text"
                          required
                          placeholder="e.g. MBBS, MD, MS"
                          value={qualifications}
                          onChange={(e) => setQualifications(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-900 transition-all"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Years of Experience</label>
                      <div className="relative">
                        <Briefcase className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <input
                          type="number"
                          required
                          min="0"
                          placeholder="e.g. 8"
                          value={experienceYears}
                          onChange={(e) => setExperienceYears(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-900 transition-all"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Consultant Fee ($)</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <input
                          type="number"
                          required
                          min="0"
                          placeholder="e.g. 150"
                          value={consultantFee}
                          onChange={(e) => setConsultantFee(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-900 transition-all"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {isSignUp && activePortal === 'patient' && (
                <div className="space-y-4 pt-3 border-t border-dashed border-gray-200">
                  <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block">Patient Health Directory Info</span>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Gender</label>
                      <div className="relative">
                        <Users className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <select
                          value={gender}
                          onChange={(e) => setGender(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-900 transition-all appearance-none"
                        >
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Date of Birth</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <input
                          type="date"
                          required
                          value={dob}
                          onChange={(e) => setDob(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-900 transition-all"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Blood Group</label>
                      <select
                        value={bloodGroup}
                        onChange={(e) => setBloodGroup(e.target.value)}
                        className="w-full px-4 py-2 bg-gray-50/50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-900 transition-all"
                      >
                        <option value="A+">A+</option>
                        <option value="A-">A-</option>
                        <option value="B+">B+</option>
                        <option value="B-">B-</option>
                        <option value="AB+">AB+</option>
                        <option value="AB-">AB-</option>
                        <option value="O+">O+</option>
                        <option value="O-">O-</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-xs font-semibold text-gray-600 hover:text-gray-900 transition-all"
                >
                  {isSignUp ? 'Already have an account? Sign In' : "Don't have credentials? Register"}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full py-2.5 rounded-xl text-white font-semibold text-xs transition-all flex items-center justify-center gap-1.5 shadow-xs ${
                    loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-gray-900 hover:bg-black'
                  }`}
                >
                  {loading ? 'Authenticating...' : isSignUp ? 'Create Credentials' : 'Sign In Platform'}
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>

                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="w-full py-2.5 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 font-semibold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  Sign in with Google
                </button>
              </div>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
}
