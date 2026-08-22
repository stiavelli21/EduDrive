import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, X, Hash } from 'lucide-react';
import { PassedExamItem } from '../../types';

interface PassedExamModalProps {
  isOpen: boolean;
  examToEdit: PassedExamItem | null;
  onClose: () => void;
  onSave: (data: {
    id?: string;
    subject: string;
    grade: number;
    isHonors: boolean;
    cfu: number;
    examDate: string;
  }) => void;
}

export const PassedExamModal: React.FC<PassedExamModalProps> = ({
  isOpen,
  examToEdit,
  onClose,
  onSave,
}) => {
  const [subject, setSubject] = useState('');
  const [grade, setGrade] = useState<number>(28);
  const [isHonors, setIsHonors] = useState<boolean>(false);
  const [cfu, setCfu] = useState<number>(6);
  const [error, setError] = useState('');
  const subjectInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (examToEdit) {
        setSubject(examToEdit.subject);
        setGrade(examToEdit.grade);
        setIsHonors(examToEdit.isHonors);
        setCfu(examToEdit.cfu);
      } else {
        setSubject('');
        setGrade(28);
        setIsHonors(false);
        setCfu(6);
      }
      setError('');
      setTimeout(() => {
        if (subjectInputRef.current) {
          subjectInputRef.current.focus();
        }
      }, 50);
    }
  }, [isOpen, examToEdit]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedSubject = subject.trim();
    if (!trimmedSubject) {
      setError("Inserisci il nome della materia o dell'esame.");
      return;
    }

    if (grade < 18 || grade > 30) {
      setError('Il voto deve essere compreso tra 18 e 30.');
      return;
    }

    if (cfu < 1 || cfu > 60) {
      setError('I CFU devono essere compresi tra 1 e 60.');
      return;
    }

    onSave({
      id: examToEdit?.id,
      subject: trimmedSubject,
      grade: isHonors ? 30 : grade,
      isHonors,
      cfu,
      examDate: examToEdit?.examDate || '',
    });
    onClose();
  };

  const handleHonorsToggle = () => {
    if (!isHonors) {
      setIsHonors(true);
      setGrade(30);
    } else {
      setIsHonors(false);
    }
  };

  const handleGradeChange = (newGrade: number) => {
    setGrade(newGrade);
    if (newGrade < 30) {
      setIsHonors(false);
    }
  };

  const quickCfuOptions = [3, 6, 9, 12];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-modal w-full max-w-md overflow-hidden border border-gray-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
              <BookOpen className="w-4 h-4" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">
              {examToEdit ? 'Modifica Esame' : 'Nuovo Esame'}
            </h3>
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
            {/* Subject Name Input */}
            <div>
              <label className="block text-xs font-medium text-gray-700 uppercase tracking-wider mb-2">
                Nome Materia / Esame *
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
                  placeholder="es. Analisi Matematica 1, Economia Aziendale..."
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-hidden transition-all text-gray-800"
                />
              </div>
            </div>

            {/* Grade & Honors Toggle */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 uppercase tracking-wider mb-2">
                  Voto (18 - 30) *
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="18"
                    max="30"
                    value={grade}
                    onChange={(e) => handleGradeChange(parseInt(e.target.value, 10) || 18)}
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-center focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-hidden transition-all text-gray-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 uppercase tracking-wider mb-2">
                  Lode (30L)
                </label>
                <button
                  type="button"
                  onClick={handleHonorsToggle}
                  className={`w-full py-2.5 px-3 rounded-xl border text-sm font-semibold flex items-center justify-center transition-all cursor-pointer ${
                    isHonors
                      ? 'bg-amber-500 text-white border-amber-600 shadow-xs shadow-amber-200'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <span>30 e Lode</span>
                </button>
              </div>
            </div>

            {/* CFU Input & Quick Chips */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Crediti (CFU) *
                </label>
                <span className="text-xs text-gray-500 font-medium">{cfu} CFU</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <Hash className="w-4 h-4" />
                  </div>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={cfu}
                    onChange={(e) => setCfu(parseInt(e.target.value, 10) || 1)}
                    className="w-full pl-10 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-hidden transition-all text-gray-800"
                  />
                </div>

                <div className="flex gap-1.5">
                  {quickCfuOptions.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setCfu(opt)}
                      className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                        cfu === opt
                          ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                          : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
                {error}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-200/60 rounded-xl transition-colors cursor-pointer"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={!subject.trim() || !cfu}
              className="px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              {examToEdit ? 'Salva Modifiche' : 'Aggiungi Esame'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
