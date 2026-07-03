import { ShieldAlert, Stethoscope, UserRound, Sparkles, LogOut, ShieldCheck, Terminal } from 'lucide-react';

interface RoleSelectorProps {
  currentRole: string;
  onRoleChange: (role: string) => void;
  userEmail: string;
  userName: string;
  token: string;
  onSignOut: () => void;
}

export default function RoleSelector({ 
  currentRole, 
  onRoleChange, 
  userEmail, 
  userName, 
  token,
  onSignOut 
}: RoleSelectorProps) {
  const isMock = token.startsWith('mock_') || token.startsWith('demo_');

  const roleDetails = {
    patient: { name: 'Patient Care Portal', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: UserRound },
    doctor: { name: 'Doctor Clinical Desk', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: Stethoscope },
    admin: { name: 'Admin Control Center', color: 'bg-indigo-50 text-indigo-700 border-indigo-200', icon: ShieldAlert },
  };

  const activeDetails = roleDetails[currentRole as keyof typeof roleDetails] || {
    name: 'Authorized Portal',
    color: 'bg-gray-50 text-gray-700 border-gray-200',
    icon: ShieldCheck
  };

  const ActiveIcon = activeDetails.icon;

  return (
    <header className="bg-white border-b border-gray-100 py-3.5 px-6 flex flex-col sm:flex-row gap-4 items-center justify-between shadow-xs">
      {/* Brand Logo and Title */}
      <div className="flex items-center gap-2.5">
        <div className="p-2 bg-gradient-to-tr from-emerald-500 to-teal-600 rounded-xl text-white shadow-xs">
          <Sparkles className="h-5 w-5 animate-pulse" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-gray-900 tracking-tight">MediConnect</h1>
        </div>
      </div>



      {/* Right Sector: User Account details & Sign Out action */}
      <div className="flex items-center gap-4">
        <div className="text-right hidden sm:block">
          <div className="text-xs font-bold text-gray-900">{userName}</div>
          <div className="text-[10px] text-gray-400 font-mono">{userEmail}</div>
        </div>

        {/* Dynamic Badge indicating user level */}
        <div className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold border ${activeDetails.color}`}>
          <ActiveIcon className="h-3.5 w-3.5" />
          <span>{activeDetails.name}</span>
        </div>

        {/* Sign Out Button */}
        <button
          onClick={onSignOut}
          className="p-2 bg-gray-50 hover:bg-red-50 text-gray-400 hover:text-red-600 border border-gray-100 rounded-xl transition-all cursor-pointer shadow-2xs"
          title="Sign Out of Session"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
