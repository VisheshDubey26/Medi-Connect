import { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Clock, User, Heart } from 'lucide-react';

interface Appointment {
  id: number;
  date: string; // YYYY-MM-DD
  startTime: string;
  endTime: string;
  status: string;
  doctorName?: string;
  patientName?: string;
  specialization?: string;
  chiefComplaint?: string;
}

interface AppointmentCalendarProps {
  appointments: Appointment[];
  role: 'patient' | 'doctor' | 'admin';
  onCancelAppointment?: (id: number) => void;
}

export default function AppointmentCalendar({
  appointments,
  role,
  onCancelAppointment,
}: AppointmentCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(
    new Date().toISOString().split('T')[0]
  );

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Helper to format date object to YYYY-MM-DD
  const formatDateString = (y: number, m: number, d: number) => {
    return `${y}-${(m + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
  };

  // Get number of days in the month
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  // Get starting day of the week (0 = Sunday, 6 = Saturday)
  const firstDayIndex = new Date(year, month, 1).getDay();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Generate days array
  const calendarDays = [];
  // Blank days for padding
  for (let i = 0; i < firstDayIndex; i++) {
    calendarDays.push(null);
  }
  // Days of the month
  for (let d = 1; d <= daysInMonth; d++) {
    calendarDays.push(d);
  }

  const getAppointmentsForDate = (dateStr: string) => {
    return appointments.filter((app) => app.date === dateStr);
  };

  const selectedDateAppointments = selectedDateStr ? getAppointmentsForDate(selectedDateStr) : [];

  return (
    <div id="appointment-calendar-root" className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
      {/* Calendar Header */}
      <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-emerald-400" />
          <h3 className="font-bold text-sm tracking-tight">
            {monthNames[month]} {year}
          </h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handlePrevMonth}
            className="p-1 hover:bg-slate-800 rounded-lg transition-all text-gray-300 hover:text-white"
            title="Previous Month"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-2 py-1 text-[10px] bg-slate-800 hover:bg-slate-700 rounded-md font-semibold text-emerald-400 transition-all"
          >
            Today
          </button>
          <button
            onClick={handleNextMonth}
            className="p-1 hover:bg-slate-800 rounded-lg transition-all text-gray-300 hover:text-white"
            title="Next Month"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-gray-100">
        {/* Calendar Grid (3 cols on medium screens) */}
        <div className="md:col-span-3 p-4">
          {/* Weekdays header */}
          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <span key={d} className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                {d[0]}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {calendarDays.map((day, idx) => {
              if (day === null) {
                return <div key={`empty-${idx}`} className="h-10" />;
              }

              const dateStr = formatDateString(year, month, day);
              const dayApps = getAppointmentsForDate(dateStr);
              const isSelected = selectedDateStr === dateStr;
              
              const today = new Date();
              const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;

              const activeApps = dayApps.filter(app => app.status === 'scheduled');
              const hasActive = activeApps.length > 0;
              const hasCompleted = dayApps.some(app => app.status === 'completed');

              return (
                <button
                  key={`day-${day}`}
                  onClick={() => setSelectedDateStr(dateStr)}
                  className={`h-10 relative flex flex-col items-center justify-center rounded-xl transition-all ${
                    isSelected
                      ? 'bg-slate-900 text-white font-bold'
                      : isToday
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-100 font-semibold'
                        : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <span className="text-xs">{day}</span>
                  
                  {/* Status Indicator Dots */}
                  <div className="absolute bottom-1 flex gap-1 justify-center w-full">
                    {hasActive && (
                      <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-emerald-400' : 'bg-emerald-500 animate-pulse'}`} />
                    )}
                    {!hasActive && hasCompleted && (
                      <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-blue-300' : 'bg-blue-500'}`} />
                    )}
                    {dayApps.some(app => app.status === 'cancelled') && !hasActive && !hasCompleted && (
                      <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-red-300' : 'bg-red-400'}`} />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Date Appointments sidebar */}
        <div className="md:col-span-2 p-4 bg-slate-50/50 flex flex-col justify-between">
          <div>
            <div className="border-b border-gray-100 pb-2 mb-3 flex items-center justify-between">
              <span className="text-xs font-bold text-gray-900 uppercase tracking-wide">
                {selectedDateStr ? new Date(selectedDateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'Select a date'}
              </span>
              <span className="text-[10px] bg-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded-full">
                {selectedDateAppointments.length} event{selectedDateAppointments.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
              {selectedDateAppointments.length === 0 ? (
                <div className="py-8 text-center text-gray-400 text-xs">
                  <Heart className="h-5 w-5 text-gray-300 mx-auto mb-1" />
                  No consultations booked.
                </div>
              ) : (
                selectedDateAppointments.map((app) => (
                  <div
                    key={app.id}
                    className="p-3 bg-white border border-gray-100 rounded-xl space-y-1.5 shadow-2xs"
                  >
                    <div className="flex justify-between items-start gap-1">
                      <div>
                        <h4 className="text-xs font-bold text-gray-900">
                          {role === 'patient' ? `Dr. ${app.doctorName || 'Specialist'}` : `Patient: ${app.patientName || 'Anonymous'}`}
                        </h4>
                        {role === 'patient' && app.specialization && (
                          <p className="text-[10px] text-gray-400">{app.specialization}</p>
                        )}
                      </div>
                      <span
                        className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider ${
                          app.status === 'scheduled'
                            ? 'bg-emerald-50 text-emerald-700'
                            : app.status === 'completed'
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {app.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-gray-500 pt-0.5 border-t border-gray-50 mt-1">
                      <Clock className="h-3.5 w-3.5 text-gray-400" />
                      <span>{app.startTime} - {app.endTime}</span>
                    </div>

                    {app.chiefComplaint && (
                      <p className="text-[10px] text-gray-500 bg-slate-50 p-1.5 rounded-lg line-clamp-2 mt-1">
                        <strong className="text-slate-700 font-semibold">Notes:</strong> {app.chiefComplaint}
                      </p>
                    )}

                    {app.status === 'scheduled' && onCancelAppointment && (
                      <div className="flex justify-end pt-1">
                        <button
                          onClick={() => onCancelAppointment(app.id)}
                          className="text-[10px] font-semibold text-red-500 hover:text-red-700 hover:underline"
                        >
                          Cancel Booking
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 text-[11px] text-gray-400 flex items-center gap-2">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500 block" /> Active
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-blue-500 block" /> Completed
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-red-400 block" /> Cancelled
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
