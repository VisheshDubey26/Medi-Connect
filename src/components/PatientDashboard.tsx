import { useState, useEffect, FormEvent } from 'react';
import { CalendarRange, Sparkles, User, Search, Pill, ShieldCheck, Clock, CheckCircle2, XCircle, ChevronRight } from 'lucide-react';
import AppointmentCalendar from './AppointmentCalendar.tsx';

export default function PatientDashboard({ token }: { token: string }) {
  const [profile, setProfile] = useState<any>(null);
  const [doctorsList, setDoctorsList] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [medications, setMedications] = useState<any[]>([]);

  const calculateAge = (dobString: string) => {
    if (!dobString) return 'N/A';
    const birthDate = new Date(dobString);
    if (isNaN(birthDate.getTime())) return 'N/A';
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age >= 0 ? `${age} years` : 'N/A';
  };
  
  // Profile Form state
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('Male');
  const [bloodGroup, setBloodGroup] = useState('O+');
  const [medHistory, setMedHistory] = useState('');
  
  // Booking Form state
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);
  const [bookDate, setBookDate] = useState('');
  const [bookTime, setBookTime] = useState('09:00');
  const [chiefComplaint, setChiefComplaint] = useState('');
  
  // Slot Hold countdown state
  const [activeHold, setActiveHold] = useState<any | null>(null);
  const [countdown, setCountdown] = useState<number>(0);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const availableSlots = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'];

  useEffect(() => {
    fetchProfile();
    fetchDoctors();
    fetchAppointments();
    fetchMedications();
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (activeHold && countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    } else if (countdown === 0 && activeHold) {
      setActiveHold(null);
      setMessage('Your slot reservation hold has expired. Please reserve again.');
    }
    return () => clearTimeout(timer);
  }, [countdown, activeHold]);

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/patient/profile', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.id) {
        setProfile(data);
        setPhone(data.phone || '');
        setDob(data.dob || '');
        setGender(data.gender || 'Male');
        setBloodGroup(data.bloodGroup || 'O+');
        setMedHistory(data.medicalHistory || '');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDoctors = async () => {
    try {
      const res = await fetch('/api/patient/doctors', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) setDoctorsList(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAppointments = async () => {
    try {
      const res = await fetch('/api/patient/appointments', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) setAppointments(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMedications = async () => {
    try {
      const res = await fetch('/api/patient/medications', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) setMedications(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateProfile = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/patient/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ phone, dob, gender, bloodGroup, medicalHistory: medHistory })
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data.profile);
        setMessage('Medical profile updated successfully!');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleReserveSlotHold = async () => {
    if (!selectedDoc || !bookDate || !bookTime) {
      setMessage('Please select a Specialist, Date and Time Slot first.');
      return;
    }

    try {
      const res = await fetch('/api/appointments/hold', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ doctorId: selectedDoc.id, date: bookDate, startTime: bookTime })
      });

      const data = await res.json();
      if (res.ok) {
        setActiveHold(data.hold);
        setCountdown(300); // 5 minutes = 300 seconds
        setMessage('Slot hold placed! Complete booking details below within 5 minutes.');
      } else {
        setMessage(`Reservation failed: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleBookAppointment = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedDoc || !bookDate || !bookTime || !chiefComplaint) return;

    setIsLoading(true);
    // Calculate end-time based on slot duration
    const startMins = parseInt(bookTime.split(':')[0]) * 60 + parseInt(bookTime.split(':')[1]);
    const endMins = startMins + (selectedDoc.slotDuration || 30);
    const endHours = Math.floor(endMins / 60).toString().padStart(2, '0');
    const endMinutes = (endMins % 60).toString().padStart(2, '0');
    const endTime = `${endHours}:${endMinutes}`;

    try {
      const res = await fetch('/api/appointments/book', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          doctorId: selectedDoc.id,
          date: bookDate,
          startTime: bookTime,
          endTime,
          chiefComplaint
        })
      });

      const data = await res.json();
      if (res.ok) {
        setBookDate('');
        setChiefComplaint('');
        setSelectedDoc(null);
        setActiveHold(null);
        setMessage(`Booking secured successfully! A confirmation email has been sent to your registered mail (${data.patientEmail || 'associated with your account'}). AI Diagnostics: ${data.aiTriageStatus}`);
        fetchAppointments();
        setTimeout(() => setMessage(''), 7500);
      } else {
        setMessage(`Booking failed: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelAppointment = async (appId: number) => {
    if (!confirm('Are you sure you want to cancel this appointment?')) return;

    try {
      const res = await fetch(`/api/appointments/${appId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ reason: 'Patient requested cancellation via portal' })
      });

      if (res.ok) {
        setMessage('Appointment cancelled and calendars cleaned.');
        fetchAppointments();
        setTimeout(() => setMessage(''), 4000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Banner message alert */}
      {message && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm font-medium shadow-xs animate-fade-in flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-emerald-600" />
          {message}
        </div>
      )}

      {/* Hero Header block */}
      <div className="bg-gradient-to-tr from-emerald-950 to-slate-900 text-white rounded-2xl p-8 shadow-sm">
        <span className="text-emerald-400 font-semibold tracking-wider uppercase text-xs">Patient Portal</span>
        <h1 className="text-2xl font-bold tracking-tight mt-1 text-white">Your Health Headquarters</h1>
        <p className="text-sm text-gray-400 mt-1">Book virtual/clinical consults with secure slot-locking, view prescriptions, and sync calendars.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Col: Specialities Booking form */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6 space-y-6">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Secure Consultation Booking</h2>
            <p className="text-xs text-gray-400">Lock desired slots for 5 minutes before booking.</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Select Specialist</label>
              <select
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-emerald-500"
                value={selectedDoc?.id || ''}
                onChange={(e) => {
                  const doc = doctorsList.find(d => d.id === parseInt(e.target.value));
                  setSelectedDoc(doc || null);
                }}
              >
                <option value="">-- Choose practitioner --</option>
                {doctorsList.map(doc => (
                  <option key={doc.id} value={doc.id}>{doc.name} - {doc.specialization}</option>
                ))}
              </select>
            </div>

            {selectedDoc && (
              <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl space-y-1.5 text-xs animate-fade-in">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-emerald-800">{selectedDoc.name}</span>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md font-mono text-[10px] font-bold">
                    Fee: ${selectedDoc.consultantFee || 100}
                  </span>
                </div>
                <div className="text-gray-600 space-y-0.5">
                  <p><span className="font-medium text-gray-500">Qualifications:</span> {selectedDoc.qualifications || 'MBBS, MD'}</p>
                  <p><span className="font-medium text-gray-500">Experience:</span> {selectedDoc.experienceYears || '5'}+ years</p>
                  <p><span className="font-medium text-gray-500">Specialization:</span> {selectedDoc.specialization}</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Appointment Date</label>
                <input
                  type="date"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-emerald-500"
                  value={bookDate}
                  onChange={(e) => setBookDate(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Preferred Time</label>
                <select
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-emerald-500"
                  value={bookTime}
                  onChange={(e) => setBookTime(e.target.value)}
                >
                  {availableSlots.map(slot => (
                    <option key={slot} value={slot}>{slot}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Countdown timer lock button */}
            {activeHold ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center">
                <span className="text-xs font-semibold text-amber-800">
                  Temporary slot locked: {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')} remaining
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleReserveSlotHold}
                className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5"
              >
                <Clock className="h-4 w-4" />
                Reserve Slot (5 Min Hold)
              </button>
            )}

            {/* Detailed booking completion form */}
            <form onSubmit={handleBookAppointment} className="space-y-4 pt-4 border-t border-gray-50">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Describe Symptoms (Chief Complaint)</label>
                <textarea
                  required
                  placeholder="Describe what you are feeling (e.g., severe migraine and sinus pressure for 2 days). AI will evaluate triage urgency."
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:border-emerald-500 min-h-[90px]"
                  value={chiefComplaint}
                  onChange={(e) => setChiefComplaint(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50"
              >
                {isLoading ? 'Triggering AI pre-visit assessment...' : 'Confirm Booked Appointment'}
              </button>
            </form>
          </div>
        </div>

        {/* Right Columns: Split layout for history & meds */}
        <div className="lg:col-span-2 space-y-8">
          {/* Medical Record Profile */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Personal Health Dossier</h2>
              <p className="text-xs text-gray-400">View and update your demographics, contact, and medical background for diagnostics.</p>
            </div>

            {/* Read-only profile overview card */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 border border-slate-100 rounded-xl text-xs">
              <div>
                <span className="text-slate-400 font-medium block">Patient Name</span>
                <span className="text-slate-900 font-bold text-sm">{profile?.name || 'Anonymous Patient'}</span>
              </div>
              <div>
                <span className="text-slate-400 font-medium block">DOB (Age)</span>
                <span className="text-slate-900 font-bold text-sm">
                  {dob ? `${dob} (${calculateAge(dob)})` : 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 font-medium block">Gender</span>
                <span className="text-slate-900 font-bold text-sm">{gender || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 font-medium block">Blood Group</span>
                <span className="px-2 py-0.5 bg-red-50 text-red-600 border border-red-100 rounded-md font-bold inline-block mt-0.5">
                  {bloodGroup || 'N/A'}
                </span>
              </div>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Contact Phone</label>
                  <input
                    type="text"
                    placeholder="+1 (555) 019-2834"
                    className="w-full px-3 py-1.5 rounded-xl border border-gray-200 text-xs focus:outline-none focus:border-emerald-500"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Date of Birth</label>
                  <input
                    type="date"
                    className="w-full px-3 py-1.5 rounded-xl border border-gray-200 text-xs focus:outline-none focus:border-emerald-500"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Gender</label>
                  <select
                    className="w-full px-3 py-1.5 rounded-xl border border-gray-200 text-xs focus:outline-none focus:border-emerald-500"
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Blood Group</label>
                  <select
                    className="w-full px-3 py-1.5 rounded-xl border border-gray-200 text-xs focus:outline-none focus:border-emerald-500"
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value)}
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

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Medical Background / History</label>
                <textarea
                  placeholder="Chronic conditions (e.g. Hypertension), allergies (e.g. Penicillin), or long-term medication background."
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:border-emerald-500 min-h-[75px]"
                  value={medHistory}
                  onChange={(e) => setMedHistory(e.target.value)}
                />
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-black text-white text-xs font-semibold rounded-xl transition-all shadow-xs"
                >
                  Save Dossier Credentials
                </button>
              </div>
            </form>
          </div>

          {/* Active Appointments */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Booked Consultations</h2>
              <p className="text-xs text-gray-400">View upcoming calendars and doctor feedback notes.</p>
            </div>

            {/* Calendar Integration */}
            <div className="py-1">
              <AppointmentCalendar
                appointments={appointments}
                role="patient"
                onCancelAppointment={handleCancelAppointment}
              />
            </div>

            <div className="space-y-3 pt-4 border-t border-gray-100">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">All Consultations List</h3>
              {appointments.length === 0 ? (
                <p className="text-xs text-gray-400 py-6 text-center">No current appointments logged.</p>
              ) : (
                appointments.map(app => (
                  <div key={app.id} className="p-4 rounded-xl border border-gray-50 flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h4 className="text-sm font-semibold text-gray-900">Dr. {app.doctorName}</h4>
                      <p className="text-[11px] text-gray-400 font-medium">{app.specialization} specialist</p>
                      <div className="flex items-center gap-1 text-[11px] font-mono text-gray-500 pt-1">
                        <Clock className="h-3.5 w-3.5" />
                        {app.date} at {app.startTime} - {app.endTime}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider ${
                        app.status === 'scheduled'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          : app.status === 'completed'
                            ? 'bg-blue-50 text-blue-700 border border-blue-100'
                            : 'bg-red-50 text-red-700 border border-red-100'
                      }`}>
                        {app.status}
                      </span>
                      {app.status === 'scheduled' && (
                        <button
                          onClick={() => handleCancelAppointment(app.id)}
                          className="text-xs text-red-500 hover:text-red-700 font-semibold px-2"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Prescribed Medications */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6 space-y-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Active Prescriptions & Alerts</h2>
              <p className="text-xs text-gray-400">Automatic daily alerts scheduled for prescribed medication.</p>
            </div>

            <div className="space-y-3">
              {medications.length === 0 ? (
                <p className="text-xs text-gray-400 py-6 text-center">No prescribed medicines listed.</p>
              ) : (
                medications.map(med => (
                  <div key={med.id} className="p-4 bg-gray-50/50 rounded-xl border border-gray-100/60 flex flex-wrap gap-4 items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                        <Pill className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-gray-900">{med.name}</h4>
                        <p className="text-xs text-gray-400">{med.dosage} - {med.frequency}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Duration: {med.duration}</p>
                        <p className="text-[10px] font-mono text-emerald-600">Daily alarm: {med.reminderTime || 'None'}</p>
                      </div>
                      <ShieldCheck className="h-4.5 w-4.5 text-emerald-600" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
