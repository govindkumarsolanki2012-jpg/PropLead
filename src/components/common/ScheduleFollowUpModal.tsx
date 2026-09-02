import React, { useState } from 'react';
import { X, Calendar, Clock, Check, Phone, MessageSquare, Car, Users, FileText } from 'lucide-react';
import { Lead, FollowUpType } from '../../types';

interface ScheduleFollowUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead;
  onSaveFollowUp?: (
    leadId: string,
    date: string,
    time: string,
    type: FollowUpType,
    note: string
  ) => void;
  onSchedule?: (
    leadId: string,
    date: string,
    time: string,
    type: FollowUpType,
    note: string
  ) => void;
}

export const ScheduleFollowUpModal: React.FC<ScheduleFollowUpModalProps> = ({
  isOpen,
  onClose,
  lead,
  onSaveFollowUp,
  onSchedule,
}) => {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const tmrw = new Date(today);
  tmrw.setDate(tmrw.getDate() + 1);
  const tmrwStr = tmrw.toISOString().split('T')[0];

  const in3Days = new Date(today);
  in3Days.setDate(in3Days.getDate() + 3);
  const in3DaysStr = in3Days.toISOString().split('T')[0];

  const [selectedDate, setSelectedDate] = useState<string>(lead.nextFollowUpDate || tmrwStr);
  const [selectedTime, setSelectedTime] = useState<string>(lead.nextFollowUpTime || '11:00');
  const [followUpType, setFollowUpType] = useState<FollowUpType>('call');
  const [note, setNote] = useState<string>(
    lead.nextFollowUpNote || `Follow-up regarding property requirements with ${lead.name}`
  );

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate) {
      alert('Please select a date');
      return;
    }
    const scheduleFn = onSaveFollowUp || onSchedule;
    if (scheduleFn) {
      scheduleFn(lead.id, selectedDate, selectedTime, followUpType, note.trim());
    }
    onClose();
  };

  const types = [
    { id: 'call' as FollowUpType, label: 'Phone Call', icon: Phone },
    { id: 'whatsapp' as FollowUpType, label: 'WhatsApp', icon: MessageSquare },
    { id: 'site_visit' as FollowUpType, label: 'Site Visit', icon: Car },
    { id: 'meeting' as FollowUpType, label: 'Meeting', icon: Users },
    { id: 'document_collection' as FollowUpType, label: 'Docs/Token', icon: FileText },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] flex flex-col overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                Schedule Follow-Up
              </h2>
              <span className="text-[11px] text-slate-400 truncate">{lead.name}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Quick Date Presets */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Select Date
            </label>
            <div className="grid grid-cols-3 gap-1.5 mb-2">
              <button
                type="button"
                onClick={() => setSelectedDate(todayStr)}
                className={`py-2 px-1 text-xs rounded-xl font-bold border transition-all ${
                  selectedDate === todayStr
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setSelectedDate(tmrwStr)}
                className={`py-2 px-1 text-xs rounded-xl font-bold border transition-all ${
                  selectedDate === tmrwStr
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
              >
                Tomorrow
              </button>
              <button
                type="button"
                onClick={() => setSelectedDate(in3DaysStr)}
                className={`py-2 px-1 text-xs rounded-xl font-bold border transition-all ${
                  selectedDate === in3DaysStr
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
              >
                In 3 Days
              </button>
            </div>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium"
            />
          </div>

          {/* Time Picker */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Preferred Time
            </label>
            <div className="grid grid-cols-4 gap-1.5 mb-2">
              {['10:00', '11:30', '16:00', '18:30'].map((time) => (
                <button
                  key={time}
                  type="button"
                  onClick={() => setSelectedTime(time)}
                  className={`py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    selectedTime === time
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-500 font-bold'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {time}
                </button>
              ))}
            </div>
            <input
              type="time"
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium"
            />
          </div>

          {/* Activity Type */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Activity Type
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {types.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setFollowUpType(t.id)}
                    className={`p-2 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition-all ${
                      followUpType === t.id
                        ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-500 font-bold'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes / Agenda */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Reminder Note / Objective
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Call Rahul to confirm site visit on Saturday morning..."
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold rounded-xl shadow-md text-xs flex items-center justify-center gap-1.5 transition-all"
            >
              <Check className="w-4 h-4" />
              <span>Save Reminder</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
