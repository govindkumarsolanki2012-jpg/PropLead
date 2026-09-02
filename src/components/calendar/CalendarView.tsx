import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Car,
  Phone,
  MessageSquare,
  Users,
  Calendar as CalendarIcon,
  Plus,
  Check,
} from 'lucide-react';
import { Lead } from '../../types';
import { formatDisplayPhone, formatBudgetRange } from '../../utils/formatters';
import { openDialer } from '../../utils/whatsapp';
import { useTranslation } from '../../context/LanguageContext';

interface CalendarViewProps {
  leads: Lead[];
  onOpenLeadDetail: (lead: Lead) => void;
  onOpenWhatsApp: (lead: Lead) => void;
  onOpenSchedule: (lead: Lead) => void;
  onOpenQuickAdd: () => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  leads,
  onOpenLeadDetail,
  onOpenWhatsApp,
  onOpenSchedule,
  onOpenQuickAdd,
}) => {
  const { t, language } = useTranslation();
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  // Month navigation
  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const localeCode = language === 'hi' ? 'hi-IN' : 'en-IN';
  const monthName = currentMonth.toLocaleDateString(localeCode, {
    month: 'long',
    year: 'numeric',
  });

  // Calculate calendar grid days
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const daysArray: (number | null)[] = [];
  for (let i = 0; i < firstDayIndex; i++) {
    daysArray.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    daysArray.push(i);
  }

  // Helper to format date string YYYY-MM-DD
  const formatYMD = (day: number) => {
    const m = String(month + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${year}-${m}-${d}`;
  };

  // Leads scheduled on selected date
  const selectedDateLeads = leads.filter((l) => l.nextFollowUpDate === selectedDateStr);

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="flex-1 overflow-y-auto pb-20 p-4 space-y-4">
      {/* Month Header with Nav */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-2xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white capitalize">
              {monthName}
            </h2>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setSelectedDateStr(todayStr)}
              className="px-2.5 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 rounded-lg hover:bg-emerald-100 mr-1"
            >
              {t('cal_today_btn')}
            </button>
            <button
              onClick={prevMonth}
              className="w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={nextMonth}
              className="w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Days of Week */}
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-slate-400 mb-2">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>

        {/* Month Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {daysArray.map((day, idx) => {
            if (!day) {
              return <div key={`empty-${idx}`} className="h-10 rounded-xl" />;
            }

            const dateStr = formatYMD(day);
            const isSelected = selectedDateStr === dateStr;
            const isToday = todayStr === dateStr;

            // Check events on this day
            const dayLeads = leads.filter((l) => l.nextFollowUpDate === dateStr);
            const hasVisits = dayLeads.some(
              (l) => l.status === 'site_visit_scheduled' || l.status === 'site_visit_completed'
            );
            const hasCalls = dayLeads.length > 0;

            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDateStr(dateStr)}
                className={`h-11 rounded-xl flex flex-col items-center justify-center relative transition-all text-xs font-semibold ${
                  isSelected
                    ? 'bg-emerald-600 text-white shadow-md font-bold'
                    : isToday
                    ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-300 dark:border-emerald-700'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                <span>{day}</span>

                {/* Event Dots */}
                {hasCalls && (
                  <div className="flex gap-0.5 mt-0.5">
                    {hasVisits ? (
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isSelected ? 'bg-amber-300' : 'bg-amber-500'
                        }`}
                      />
                    ) : (
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isSelected ? 'bg-white' : 'bg-emerald-500'
                        }`}
                      />
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/60 text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>{t('cal_legend_call')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>{t('cal_legend_visit')}</span>
          </div>
        </div>
      </div>

      {/* Selected Date Schedule Header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
            {t('cal_schedule_for')}{' '}
            {new Date(selectedDateStr).toLocaleDateString(localeCode, {
              day: 'numeric',
              month: 'short',
              weekday: 'short',
            })}
            {selectedDateStr === todayStr && ` (${t('cal_today_btn')})`}
          </h3>

          <span className="text-xs font-semibold text-slate-400">
            {selectedDateLeads.length} {t('cal_activities')}
          </span>
        </div>

        {/* Selected Date Items List */}
        {selectedDateLeads.length === 0 ? (
          <div className="p-8 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 text-center">
            <CalendarIcon className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {t('cal_no_activities')}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {t('cal_no_activities_desc')}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {selectedDateLeads.map((lead) => {
              const isVisit =
                lead.status === 'site_visit_scheduled' || lead.status === 'site_visit_completed';
              return (
                <div
                  key={lead.id}
                  onClick={() => onOpenLeadDetail(lead)}
                  className="p-3.5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3 shadow-2xs hover:border-emerald-400 transition-all cursor-pointer"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        isVisit
                          ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                          : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                      }`}
                    >
                      {isVisit ? <Car className="w-5 h-5" /> : <Phone className="w-5 h-5" />}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {lead.name}
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                          {lead.nextFollowUpTime || '11:00 AM'}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        {lead.bhk || lead.propertyType} • {formatBudgetRange(lead.budgetMin, lead.budgetMax)}
                      </div>

                      {lead.nextFollowUpNote && (
                        <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium truncate mt-0.5">
                          📌 {lead.nextFollowUpNote}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => openDialer(lead.phone)}
                      className="p-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-bold"
                      title={t('dash_call')}
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onOpenWhatsApp(lead)}
                      className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-2xs"
                      title={t('dash_whatsapp')}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
