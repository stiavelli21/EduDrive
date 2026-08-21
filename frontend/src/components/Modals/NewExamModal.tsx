import React, { useState, useEffect, useRef } from 'react';
import { GraduationCap, X, Calendar, BookOpen } from 'lucide-react';
import { getExamUrgencyInfo } from '../../utils/formatters';

interface NewExamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (subject: string, examDate: string) => void;
}

export const NewExamModal: React.FC<NewExamModalProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const [subject, setSubject] = useState('');
  const [examDate, setExamDate] = useState('');
  const [error, setError] = useState('');
  const subjectInputRef = useRef<HTMLInputElement>(null);

  // Format today as YYYY-MM-DD for min date attribute
  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (isOpen) {
      setSubject('');
      // Default date to 30 days from now
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 30);
      setExamDate(defaultDate.toISOString().split('T')[0]);
      setError('');
      setTimeout(() => {
        if (subjectInputRef.current) {
          subjectInputRef.current.focus();
        }
      }, 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedSubject = subject.trim();
    if (!trimmedSubject) {
      setError("Inserisci il nome della materia o dell'esame.");
      return;
    }

    if (!examDate) {
      setError("Seleziona la data dell'esame.");
      return;
    }

    onCreate(trimmedSubject, examDate);
    onClose();
  };

  // Compute live preview of urgency
  const urgencyPreview = examDate ? getExamUrgencyInfo(examDate) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-modal w-full max-w-md overflow-hidden border border-gray-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-violet-50 flex items-center justify-center text-violet-600">
              <GraduationCap className="w-4 h-4" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Nuova data esame</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            {/* Subject input */}
            <div>
              <label className="block text-xs font-medium text-gray-700 uppercase tracking-wider mb-2">
                Nome materia / Esame *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <BookOpen className="w-4 h-4" />
                </div>
                <input
                  ref={subjectInputRef}
                  type="text"
                  value={subject}
                  onChange={(e) => {
                    setSubject(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="es. Analisi Matematica, Fisica I, Ingegneria..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 focus:border-violet-500 focus:ring-2 focus:ring-violet-100 outline-hidden text-sm text-gray-900 transition-all"
                />
              </div>
              {error && <p className="text-xs text-rose-500 mt-1.5">{error}</p>}
            </div>

            {/* Date input */}
            <div>
              <label className="block text-xs font-medium text-gray-700 uppercase tracking-wider mb-2">
                Data dell'esame *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Calendar className="w-4 h-4" />
                </div>
                <input
                  type="date"
                  value={examDate}
                  min={todayStr}
                  onChange={(e) => setExamDate(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 focus:border-violet-500 focus:ring-2 focus:ring-violet-100 outline-hidden text-sm text-gray-900 transition-all font-sans"
                />
              </div>
            </div>

            {/* Live Urgency Indicator Preview */}
            {urgencyPreview && (
              <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200/80 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-gray-700">Indicatore scadenza:</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${urgencyPreview.badgeClass}`}>
                    {urgencyPreview.statusLabel}
                  </span>
                </div>

                {/* Progress color bar */}
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className={`h-full ${urgencyPreview.barColorClass} rounded-full transition-all duration-300`} />
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-6 py-4 bg-gray-50 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200/60 rounded-xl transition-colors cursor-pointer"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={!subject.trim() || !examDate}
              className="px-5 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Salva data esame
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
