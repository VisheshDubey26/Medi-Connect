import { useState, useEffect, FormEvent } from 'react';
import { ClipboardList, Sparkles, AlertTriangle, Pill, Activity, User, Save, Clock, ArrowRight } from 'lucide-react';
import AppointmentCalendar from './AppointmentCalendar.tsx';

export default function DoctorDashboard({ token }: { token: string }) {
  const [appointmentsList, setAppointmentsList] = useState<any[]>([]);
  const [selectedApp, setSelectedApp] = useState<any | null>(null);
  const [triageData, setTriageData] = useState<any | null>(null);
  const [activePatient, setActivePatient] = useState<any | null>(null);
  const [patientHistory, setPatientHistory] = useState<any[]>([]);

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
  
  // Consult form state
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [meds, setMeds] = useState<any[]>([{ name: '', dosage: '', frequency: 'Once daily', duration: '7 days', reminderTime: '08:00' }]);
  
  const [message, setMessage] = useState('');
  const [isLoadingAI, setIsLoadingAI] = useState(false);

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    try {
      const res = await fetch('/api/doctor/appointments', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) setAppointmentsList(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectAppointment = async (app: any) => {
    setSelectedApp(app);
    setTriageData(null);
    setActivePatient(null);
    setPatientHistory([]);
    setClinicalNotes('');
    setMeds([{ name: '', dosage: '', frequency: 'Once daily', duration: '7 days', reminderTime: '08:00' }]);

    // Load AI triage pre-visit summary
    try {
      const resTriage = await fetch(`/api/doctor/appointments/${app.id}/triage`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resTriage.ok) {
        const triage = await resTriage.json();
        setTriageData(triage);
      }
    } catch (err) {
      console.error(err);
    }

    // Load Patient History
    try {
      const resHist = await fetch(`/api/doctor/patients/${app.patientId}/history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resHist.ok) {
        const historyData = await resHist.json();
        if (historyData.patient) {
          setActivePatient(historyData.patient);
        }
        if (Array.isArray(historyData.history)) {
          setPatientHistory(historyData.history);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddMed = () => {
    setMeds([...meds, { name: '', dosage: '', frequency: 'Once daily', duration: '7 days', reminderTime: '08:00' }]);
  };

  const handleMedChange = (index: number, field: string, value: string) => {
    const updated = [...meds];
    updated[index][field] = value;
    setMeds(updated);
  };

  const handleRemoveMed = (index: number) => {
    setMeds(meds.filter((_, i) => i !== index));
  };

  const handleCompleteConsult = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedApp || !clinicalNotes) return;

    setIsLoadingAI(true);
    try {
      const filteredMeds = meds.filter(m => m.name.trim() !== '');
      const res = await fetch(`/api/doctor/appointments/${selectedApp.id}/prescribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          clinicalNotes,
          medicationsList: filteredMeds
        })
      });

      if (res.ok) {
        const data = await res.json();
        setMessage(`Consult completed successfully! AI Post-visit instructions compiled: ${data.aiSyncStatus}`);
        setSelectedApp(null);
        fetchAppointments();
        setTimeout(() => setMessage(''), 5000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingAI(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Banner Feedback */}
      {message && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm font-medium shadow-xs animate-fade-in flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-emerald-600 animate-bounce" />
          {message}
        </div>
      )}

      {/* Hero Welcome block */}
      <div className="bg-gradient-to-tr from-blue-950 to-slate-900 text-white rounded-2xl p-8 shadow-sm">
        <span className="text-blue-400 font-semibold tracking-wider uppercase text-xs">Medical Console</span>
        <h1 className="text-2xl font-bold tracking-tight mt-1 text-white">Practitioner Consult Desk</h1>
        <p className="text-sm text-gray-400 mt-1">Review active bookings, triage AI symptom inputs, and write electronic prescriptions.</p>
      </div>

      {/* Visual calendar integration */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Practice Calendar</h2>
          <p className="text-xs text-gray-400">Interactive visual overview of scheduled consultations and appointments.</p>
        </div>
        <AppointmentCalendar
          appointments={appointmentsList}
          role="doctor"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Appointments Queue column */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Today's Appointment Queue</h2>
            <p className="text-xs text-gray-400">Select a patient to launch assessment desk.</p>
          </div>

          <div className="space-y-3">
            {appointmentsList.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">No scheduled visits in queue today.</p>
            ) : (
              appointmentsList.map((app) => (
                <button
                  key={app.id}
                  onClick={() => handleSelectAppointment(app)}
                  className={`w-full text-left p-4 rounded-xl border transition-all flex justify-between items-center ${
                    selectedApp?.id === app.id
                      ? 'bg-blue-50/50 border-blue-200 shadow-xs ring-1 ring-blue-100'
                      : 'bg-white border-gray-100 hover:border-gray-200'
                  }`}
                >
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold text-gray-900">{app.patientName}</h4>
                    <p className="text-xs text-gray-400">DOB: {app.patientDob || 'N/A'}</p>
                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-gray-500 mt-1">
                      <Clock className="h-3 w-3" />
                      {app.startTime} - {app.endTime}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-md text-[10px] font-medium uppercase tracking-wide">
                      {app.status}
                    </span>
                    <ArrowRight className="h-4 w-4 text-gray-400" />
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Main Consult workspace (Col-span 2) */}
        <div className="lg:col-span-2 space-y-6">
          {selectedApp ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-6 space-y-8 animate-fade-in">
              {/* Patient header info */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-50 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Consult Desk: {selectedApp.patientName}</h3>
                    <p className="text-xs text-gray-400">Scheduled: {selectedApp.date} at {selectedApp.startTime}</p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-100 rounded-full text-xs font-semibold">
                  Active Consultation
                </span>
              </div>

              {/* Patient Profile Demographics Card */}
              {activePatient && (
                <div className="bg-blue-50/50 border border-blue-100/80 rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 font-medium block">Age & DOB</span>
                    <span className="text-slate-800 font-bold">
                      {activePatient.dob ? `${activePatient.dob} (${calculateAge(activePatient.dob)})` : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium block">Gender</span>
                    <span className="text-slate-800 font-bold">{activePatient.gender || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium block">Blood Group</span>
                    <span className="px-1.5 py-0.5 bg-red-50 text-red-600 border border-red-100 rounded-md font-bold inline-block">
                      {activePatient.bloodGroup || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium block">Contact</span>
                    <span className="text-slate-800 font-bold">{activePatient.phone || 'N/A'}</span>
                  </div>
                  {activePatient.medicalHistory && (
                    <div className="col-span-2 md:col-span-4 pt-2 border-t border-blue-100/50">
                      <span className="text-slate-400 font-semibold block">Declared Medical History</span>
                      <p className="text-slate-700 mt-0.5 font-medium leading-relaxed bg-white/60 p-2 rounded-lg border border-slate-100">{activePatient.medicalHistory}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Patient pre-visit AI Symptom Summary */}
              {triageData && (
                <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-5 space-y-4 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-amber-500 animate-spin" />
                      <h4 className="text-sm font-bold text-slate-900">AI Pre-Visit Symptoms Triage</h4>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider ${
                      triageData.urgency === 'High'
                        ? 'bg-red-100 text-red-800'
                        : triageData.urgency === 'Medium'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      Urgency: {triageData.urgency}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Chief Complaint</span>
                      <p className="text-xs text-slate-800 font-medium">{triageData.chiefComplaint}</p>
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Possible Causes</span>
                      <div className="flex flex-wrap gap-1.5">
                        {triageData.possibleCauses?.map((cause: string, i: number) => (
                          <span key={i} className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded-md text-[10px] font-medium border border-slate-300">
                            {cause}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-200 space-y-1.5">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Suggested Intake Questions</span>
                    <ul className="list-disc list-inside text-xs text-slate-700 space-y-1">
                      {triageData.suggestedQuestions?.map((q: string, i: number) => (
                        <li key={i}>{q}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Consultation notes Form */}
              <form onSubmit={handleCompleteConsult} className="space-y-6">
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-gray-900">Clinical Observations & Diagnostics Notes</label>
                  <textarea
                    required
                    placeholder="Patient describes severe acute throbbing headaches accompanied by photophobia. Temperature normal, BP elevated (130/85). Prescribed resting and light diagnostics."
                    value={clinicalNotes}
                    onChange={(e) => setClinicalNotes(e.target.value)}
                    className="w-full min-h-[140px] px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Medications builder */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                      <Pill className="h-4 w-4 text-blue-600" />
                      Prescribed Medications
                    </h4>
                    <button
                      type="button"
                      onClick={handleAddMed}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                    >
                      + Add Drug
                    </button>
                  </div>

                  <div className="space-y-3">
                    {meds.map((med, index) => (
                      <div key={index} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center bg-gray-50/50 p-3 rounded-xl border border-gray-100">
                        <input
                          type="text"
                          required
                          placeholder="e.g. Ibuprofen"
                          value={med.name}
                          onChange={(e) => handleMedChange(index, 'name', e.target.value)}
                          className="px-3 py-2 bg-white rounded-lg border border-gray-200 text-xs focus:outline-none"
                        />
                        <input
                          type="text"
                          placeholder="e.g. 400mg"
                          value={med.dosage}
                          onChange={(e) => handleMedChange(index, 'dosage', e.target.value)}
                          className="px-3 py-2 bg-white rounded-lg border border-gray-200 text-xs focus:outline-none"
                        />
                        <select
                          value={med.frequency}
                          onChange={(e) => handleMedChange(index, 'frequency', e.target.value)}
                          className="px-3 py-2 bg-white rounded-lg border border-gray-200 text-xs focus:outline-none"
                        >
                          <option value="Once daily">Once daily</option>
                          <option value="Twice daily">Twice daily</option>
                          <option value="Three times daily">Three times daily</option>
                          <option value="Every 8 hours">Every 8 hours</option>
                          <option value="As needed">As needed</option>
                        </select>
                        <input
                          type="text"
                          placeholder="e.g. 7 days"
                          value={med.duration}
                          onChange={(e) => handleMedChange(index, 'duration', e.target.value)}
                          className="px-3 py-2 bg-white rounded-lg border border-gray-200 text-xs focus:outline-none"
                        />
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="08:00"
                            value={med.reminderTime}
                            onChange={(e) => handleMedChange(index, 'reminderTime', e.target.value)}
                            className="px-3 py-2 bg-white rounded-lg border border-gray-200 text-xs focus:outline-none w-20"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveMed(index)}
                            className="text-xs text-red-500 hover:text-red-600 px-2"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Save consult buttons */}
                <div className="flex justify-end gap-3 border-t border-gray-100 pt-5">
                  <button
                    type="button"
                    onClick={() => setSelectedApp(null)}
                    className="px-5 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-xs font-semibold rounded-xl"
                  >
                    Postpone Notes
                  </button>
                  <button
                    type="submit"
                    disabled={isLoadingAI}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    {isLoadingAI ? 'Generating Patient AI Summary...' : 'Complete Consult & Sync'}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-8 flex flex-col items-center justify-center text-center space-y-3 min-h-[360px]">
              <ClipboardList className="h-10 w-10 text-gray-300" />
              <h3 className="text-sm font-semibold text-gray-700">No Patient Selected</h3>
              <p className="text-xs text-gray-400 max-w-sm">Choose an active patient in your today's queue to review details, diagnose, and construct summaries.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
