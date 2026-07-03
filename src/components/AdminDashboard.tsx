import { useState, useEffect, FormEvent } from 'react';
import { Plus, Trash2, CalendarRange, Clock, Sparkles, Building, UserCheck, ShieldAlert, Heart, Calendar } from 'lucide-react';

export default function AdminDashboard({ token }: { token: string }) {
  const [doctors, setDoctors] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({ summary: { doctors: 0, patients: 0, appointments: 0, completed: 0, cancelled: 0 }, specializations: [] });
  const [showAddForm, setShowAddForm] = useState(false);
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [message, setMessage] = useState('');
  
  // Doctor form state
  const [docName, setDocName] = useState('');
  const [docEmail, setDocEmail] = useState('');
  const [docSpec, setDocSpec] = useState('Cardiology');
  const [docSlot, setDocSlot] = useState(30);

  // Leave form state
  const [selectedDocId, setSelectedDocId] = useState('');
  const [leaveStart, setLeaveStart] = useState('');
  const [leaveEnd, setLeaveEnd] = useState('');
  const [leaveReason, setLeaveReason] = useState('');

  const specializations = ['Cardiology', 'Dermatology', 'Neurology', 'Pediatrics', 'General Medicine', 'Orthopedics'];

  useEffect(() => {
    fetchStats();
    fetchDoctors();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/dashboard-stats', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.summary) setStats(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDoctors = async () => {
    try {
      const res = await fetch('/api/admin/doctors', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) setDoctors(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddDoctor = async (e: FormEvent) => {
    e.preventDefault();
    if (!docName || !docEmail) return;

    try {
      const res = await fetch('/api/admin/doctors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: docName,
          email: docEmail,
          specialization: docSpec,
          slotDuration: docSlot,
          uid: `doc_${Date.now()}`
        })
      });

      if (res.ok) {
        setDocName('');
        setDocEmail('');
        setShowAddForm(false);
        setMessage('Doctor registered successfully!');
        fetchDoctors();
        fetchStats();
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleApplyLeave = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedDocId || !leaveStart || !leaveEnd) return;

    try {
      const res = await fetch('/api/admin/leaves', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          doctorId: parseInt(selectedDocId),
          startDate: leaveStart,
          endDate: leaveEnd,
          reason: leaveReason
        })
      });

      const data = await res.json();
      if (res.ok) {
        setSelectedDocId('');
        setLeaveStart('');
        setLeaveEnd('');
        setLeaveReason('');
        setShowLeaveForm(false);
        setMessage(`Leave recorded successfully. Cancelled appointments: ${data.appointmentsCancelled || 0}. Patients notified: ${data.patientsNotified || 0}`);
        fetchStats();
        setTimeout(() => setMessage(''), 6000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Feedback Banner */}
      {message && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm font-medium shadow-xs animate-fade-in flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-emerald-600" />
          {message}
        </div>
      )}

      {/* Hero Welcome banner */}
      <div className="bg-gradient-to-tr from-gray-950 to-slate-900 text-white rounded-2xl p-8 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-emerald-400 font-semibold tracking-wider uppercase text-xs">Admin Panel</span>
          <h1 className="text-2xl font-bold tracking-tight mt-1 text-white">Healthcare System Dashboard</h1>
          <p className="text-sm text-gray-400 mt-1">Manage specialist rosters, leaves conflict synchronization, and system metrics.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowLeaveForm(true)}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-gray-200 border border-slate-700 text-xs font-semibold rounded-xl transition-all"
          >
            Schedule Specialist Leave
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Add Specialist
          </button>
        </div>
      </div>

      {/* Bento Grid Analytics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-teal-50 rounded-xl text-teal-600">
            <UserCheck className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs text-gray-400 font-medium">Active Specialists</span>
            <h3 className="text-2xl font-bold text-gray-900 mt-0.5">{stats.summary.doctors}</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
            <Heart className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs text-gray-400 font-medium">Registered Patients</span>
            <h3 className="text-2xl font-bold text-gray-900 mt-0.5">{stats.summary.patients}</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
            <Calendar className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs text-gray-400 font-medium">Total Appointments</span>
            <h3 className="text-2xl font-bold text-gray-900 mt-0.5">{stats.summary.appointments}</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-red-50 rounded-xl text-red-600">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs text-gray-400 font-medium">Cancellations Rate</span>
            <h3 className="text-2xl font-bold text-gray-900 mt-0.5">
              {stats.summary.appointments > 0 ? Math.round((stats.summary.cancelled / stats.summary.appointments) * 100) : 0}%
            </h3>
          </div>
        </div>
      </div>

      {/* Main Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Doctors Roster (Col-span 2) */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6 lg:col-span-2 space-y-6">
          <div className="flex justify-between items-center border-b border-gray-50 pb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Medical Specialists Roster</h2>
              <p className="text-xs text-gray-400">Available practitioners and operational slot profiles.</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-500">
              <thead className="bg-gray-50 text-xs text-gray-700 uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3 rounded-l-lg">Practitioner</th>
                  <th className="px-4 py-3">Specialization</th>
                  <th className="px-4 py-3">Slot Duration</th>
                  <th className="px-4 py-3 rounded-r-lg">Working Hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {doctors.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50/50 transition-all">
                    <td className="px-4 py-4 font-semibold text-gray-900">{doc.name}</td>
                    <td className="px-4 py-4">
                      <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[11px] font-medium border border-emerald-100">
                        {doc.specialization}
                      </span>
                    </td>
                    <td className="px-4 py-4 font-mono text-xs">{doc.slotDuration} minutes</td>
                    <td className="px-4 py-4 text-xs font-mono text-gray-600">
                      Mon-Fri: {doc.workingHours?.start || "09:00"} - {doc.workingHours?.end || "17:00"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Specialization Distribution bento card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6 space-y-6">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Specializations</h2>
            <p className="text-xs text-gray-400">Practitioner density by medical domain.</p>
          </div>

          <div className="space-y-4">
            {stats.specializations.map((spec: any, idx: number) => (
              <div key={idx} className="flex flex-col gap-1">
                <div className="flex justify-between text-xs font-semibold text-gray-700">
                  <span>{spec.specialization}</span>
                  <span>{spec.count} Specialist(s)</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${(spec.count / (stats.summary.doctors || 1)) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add Doctor Modal Overlay */}
      {showAddForm && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-xl max-w-md w-full p-6 space-y-6 animate-scale-in">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Add Medical Specialist</h3>
              <p className="text-xs text-gray-400">Register new doctor account with default scheduling profiles.</p>
            </div>

            <form onSubmit={handleAddDoctor} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Doctor Name</label>
                <input
                  type="text"
                  required
                  placeholder="Dr. Alexander Pierce"
                  value={docName}
                  onChange={(e) => setDocName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Doctor Email</label>
                <input
                  type="email"
                  required
                  placeholder="alexander.pierce@hospital.com"
                  value={docEmail}
                  onChange={(e) => setDocEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Specialization</label>
                  <select
                    value={docSpec}
                    onChange={(e) => setDocSpec(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none"
                  >
                    {specializations.map((spec) => (
                      <option key={spec} value={spec}>{spec}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Slot Duration</label>
                  <select
                    value={docSlot}
                    onChange={(e) => setDocSlot(parseInt(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none"
                  >
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={45}>45 minutes</option>
                    <option value={60}>60 minutes</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-50">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-xl"
                >
                  Register Doctor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Leave Application Modal Overlay */}
      {showLeaveForm && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-xl max-w-md w-full p-6 space-y-6 animate-scale-in">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Schedule Specialist Leave</h3>
              <p className="text-xs text-gray-400">Mark practitioner leaves. System will auto-reschedule conflicting appointments, notify patients, and clear calendar syncs.</p>
            </div>

            <form onSubmit={handleApplyLeave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Select Doctor</label>
                <select
                  required
                  value={selectedDocId}
                  onChange={(e) => setSelectedDocId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none"
                >
                  <option value="">-- Select Specialist --</option>
                  {doctors.map((doc) => (
                    <option key={doc.id} value={doc.id}>{doc.name} ({doc.specialization})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={leaveStart}
                    onChange={(e) => setLeaveStart(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    required
                    value={leaveEnd}
                    onChange={(e) => setLeaveEnd(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Reason (Optional)</label>
                <textarea
                  placeholder="Medical Conference or Annual Leave"
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none min-h-[80px]"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-50">
                <button
                  type="button"
                  onClick={() => setShowLeaveForm(false)}
                  className="flex-1 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-xl"
                >
                  Apply & Notify Patients
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
