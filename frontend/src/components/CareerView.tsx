import React, { useState, useMemo } from 'react';
import {
  PassedExamItem,
} from '../types';
import {
  BookOpen,
  Plus,
  TrendingUp,
  Award,
  Search,
  ArrowUpDown,
  Edit2,
  Trash2,
  Target,
  Sliders,
} from 'lucide-react';

interface CareerViewProps {
  passedExams: PassedExamItem[];
  onNewPassedExam: () => void;
  onEditPassedExam: (exam: PassedExamItem) => void;
  onDeletePassedExam: (exam: PassedExamItem) => void;
}

type SortField = 'grade' | 'cfu' | 'subject';
type SortOrder = 'asc' | 'desc';

export const CareerView: React.FC<CareerViewProps> = ({
  passedExams,
  onNewPassedExam,
  onEditPassedExam,
  onDeletePassedExam,
}) => {
  // Search and Sort State
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('subject');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Honors Weight Configuration (Standard 30, or 31, or 33)
  const [honorsValue, setHonorsValue] = useState<number>(30);
  const [showConfig, setShowConfig] = useState<boolean>(false);

  // Target Degree CFU (180 for Triennale, 120 for Magistrale, 300 for Ciclo Unico 5y, 360 for 6y)
  const [targetCfu, setTargetCfu] = useState<number>(180);

  // Simulator ("What-If") State
  const [simGrade, setSimGrade] = useState<number>(28);
  const [simIsHonors, setSimIsHonors] = useState<boolean>(false);
  const [simCfu, setSimCfu] = useState<number>(6);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState<boolean>(false);

  // Calculate Core Career Metrics
  const stats = useMemo(() => {
    if (passedExams.length === 0) {
      return {
        totalCfu: 0,
        weightedSum: 0,
        weightedAvg: 0,
        baseDegreeScore: 0,
        honorsCount: 0,
        examsCount: 0,
      };
    }

    let totalCfu = 0;
    let weightedSum = 0;
    let honorsCount = 0;

    for (const exam of passedExams) {
      const effectiveGrade = exam.isHonors && honorsValue > 30 ? honorsValue : exam.grade;
      totalCfu += exam.cfu;
      weightedSum += effectiveGrade * exam.cfu;
      if (exam.isHonors) {
        honorsCount++;
      }
    }

    const weightedAvg = totalCfu > 0 ? weightedSum / totalCfu : 0;
    const baseDegreeScore = (weightedAvg * 110) / 30;

    return {
      totalCfu,
      weightedSum,
      weightedAvg,
      baseDegreeScore,
      honorsCount,
      examsCount: passedExams.length,
    };
  }, [passedExams, honorsValue]);

  // Calculate What-If Simulation Metrics
  const simulatedStats = useMemo(() => {
    if (!isSimulatorOpen) return null;
    const effectiveSimGrade = simIsHonors && honorsValue > 30 ? honorsValue : simGrade;
    const newTotalCfu = stats.totalCfu + simCfu;
    const newWeightedSum = stats.weightedSum + effectiveSimGrade * simCfu;
    const newWeightedAvg = newTotalCfu > 0 ? newWeightedSum / newTotalCfu : 0;
    const newBaseDegree = (newWeightedAvg * 110) / 30;
    const avgDiff = newWeightedAvg - stats.weightedAvg;
    const baseDiff = newBaseDegree - stats.baseDegreeScore;

    return {
      newWeightedAvg,
      newBaseDegree,
      avgDiff,
      baseDiff,
      newTotalCfu,
    };
  }, [isSimulatorOpen, simGrade, simIsHonors, simCfu, stats, honorsValue]);

  // Filtered and Sorted Exam List
  const filteredExams = useMemo(() => {
    let list = [...passedExams];

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((e) => e.subject.toLowerCase().includes(q));
    }

    // Sort list
    list.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'subject':
          comparison = a.subject.localeCompare(b.subject);
          break;
        case 'grade':
          const gradeA = a.isHonors ? 30.5 : a.grade;
          const gradeB = b.isHonors ? 30.5 : b.grade;
          comparison = gradeA - gradeB;
          break;
        case 'cfu':
          comparison = a.cfu - b.cfu;
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return list;
  }, [passedExams, searchQuery, sortField, sortOrder]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Progress percentage toward target degree
  const cfuProgress = Math.min(Math.round((stats.totalCfu / targetCfu) * 100), 100);

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto p-6 space-y-4 bg-slate-50/50">
      {/* Top Metrics & Action Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Weighted Average Card */}
        <div className="p-4 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-white border border-emerald-200/80 rounded-2xl shadow-xs relative overflow-hidden group flex flex-col justify-between min-h-[105px]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
              Media Ponderata
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-700">
              <BookOpen className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-gray-900 tracking-tight">
              {stats.weightedAvg > 0 ? stats.weightedAvg.toFixed(2) : '--'}
            </span>
            <span className="text-sm font-semibold text-gray-400">/ 30</span>
          </div>
        </div>

        {/* Base Graduation Score Card */}
        <div className="p-4 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-white border border-blue-200/80 rounded-2xl shadow-xs relative overflow-hidden group flex flex-col justify-between min-h-[105px]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider">
              Base di Laurea
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center text-blue-700">
              <Target className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-gray-900 tracking-tight">
              {stats.baseDegreeScore > 0 ? stats.baseDegreeScore.toFixed(2) : '--'}
            </span>
            <span className="text-sm font-semibold text-gray-400">/ 110</span>
          </div>
        </div>

        {/* CFU Progress Card */}
        <div className="p-4 bg-white border border-gray-200/80 rounded-2xl shadow-xs relative overflow-hidden group flex flex-col justify-between min-h-[105px]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">
              Avanzamento CFU
            </span>
            <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center text-violet-600">
              <Award className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-2xl font-extrabold text-gray-900 tracking-tight">
                {stats.totalCfu}{' '}
                <span className="text-xs font-semibold text-gray-400">/ {targetCfu} CFU</span>
              </span>
              <span className="text-xs font-bold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full">
                {cfuProgress}%
              </span>
            </div>
            {/* Progress Bar */}
            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-violet-600 rounded-full transition-all duration-500"
                style={{ width: `${cfuProgress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Quick Actions Panel */}
        <div className="p-3 bg-white border border-gray-200/80 rounded-2xl shadow-xs flex flex-col justify-between gap-2 min-h-[105px]">
          <button
            onClick={onNewPassedExam}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl shadow-xs text-xs font-semibold transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Aggiungi Esame</span>
          </button>

          <div className="flex gap-2">
            <button
              onClick={() => setIsSimulatorOpen(!isSimulatorOpen)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl border text-[11px] transition-all cursor-pointer ${
                isSimulatorOpen
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200 shadow-xs font-semibold'
                  : 'bg-gray-50/80 text-gray-700 border-gray-200 hover:bg-gray-100 font-medium'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="truncate">Simulatore</span>
            </button>

            <button
              onClick={() => setShowConfig(!showConfig)}
              title="Impostazioni calcolo"
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl border transition-colors cursor-pointer text-[11px] ${
                showConfig
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 font-semibold'
                  : 'bg-gray-50/80 text-gray-700 border-gray-200 hover:bg-gray-100 font-medium'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 text-gray-600 shrink-0" />
              <span className="truncate">Impostazioni</span>
            </button>
          </div>
        </div>
      </div>

      {/* Settings / Configuration Drawer */}
      {showConfig && (
        <div className="p-4 bg-white border border-emerald-200/80 rounded-2xl shadow-xs animate-fade-in space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-emerald-600" />
              Impostazioni Calcolo Carriera
            </h3>
            <span className="text-xs text-gray-400">Personalizza i parametri dell'ateneo</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Honors value configuration */}
            <div className="p-3 bg-gray-50/80 rounded-xl border border-gray-100 space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 block">
                Valore assegnato alla Lode (30L)
              </label>
              <div className="flex gap-2">
                {[
                  { label: '30 (Standard)', val: 30 },
                  { label: '31 (+1 punto)', val: 31 },
                  { label: '33 (+3 punti)', val: 33 },
                ].map((opt) => (
                  <button
                    key={opt.val}
                    onClick={() => setHonorsValue(opt.val)}
                    className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-lg border transition-all cursor-pointer ${
                      honorsValue === opt.val
                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Target Degree CFU Selection */}
            <div className="p-3 bg-gray-50/80 rounded-xl border border-gray-100 space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 block">
                Obiettivo Corso di Laurea
              </label>
              <div className="flex gap-2">
                {[
                  { label: 'Triennale (180 CFU)', val: 180 },
                  { label: 'Magistrale (120 CFU)', val: 120 },
                  { label: 'Ciclo Unico (300 CFU)', val: 300 },
                ].map((opt) => (
                  <button
                    key={opt.val}
                    onClick={() => setTargetCfu(opt.val)}
                    className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-lg border transition-all cursor-pointer ${
                      targetCfu === opt.val
                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Simulator Section */}
      {isSimulatorOpen && (
        <div className="p-5 bg-gradient-to-r from-indigo-50/70 via-white to-purple-50/50 border border-indigo-200/80 rounded-2xl shadow-xs animate-fade-in space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900">
              Simulatore Prossimo Esame
            </h3>
            <span className="text-xs text-indigo-700 bg-indigo-100/70 px-2.5 py-0.5 rounded-full font-semibold">
              Proiezione Live
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Voto Ipotetico (18 - 30)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="18"
                  max="30"
                  value={simGrade}
                  onChange={(e) => setSimGrade(parseInt(e.target.value, 10) || 18)}
                  className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl text-sm font-semibold text-center focus:ring-2 focus:ring-indigo-100 outline-hidden"
                />
                <button
                  type="button"
                  onClick={() => setSimIsHonors(!simIsHonors)}
                  className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer whitespace-nowrap ${
                    simIsHonors
                      ? 'bg-amber-500 text-white border-amber-600'
                      : 'bg-white text-gray-600 border-indigo-200 hover:bg-gray-50'
                  }`}
                >
                  30L
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Crediti Esame (CFU)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={simCfu}
                  onChange={(e) => setSimCfu(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl text-sm font-semibold text-center focus:ring-2 focus:ring-indigo-100 outline-hidden"
                />
                <div className="flex gap-1">
                  {[6, 9, 12].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setSimCfu(c)}
                      className={`px-2.5 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                        simCfu === c
                          ? 'bg-indigo-600 text-white border-indigo-700'
                          : 'bg-white text-gray-600 border-indigo-200 hover:bg-gray-50'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {simulatedStats && (
              <div className="p-3 bg-white border border-indigo-200 rounded-xl flex items-center justify-around shadow-xs">
                <div className="text-center">
                  <span className="text-[10px] text-gray-500 uppercase font-bold block">
                    Nuova Media
                  </span>
                  <span className="text-base font-extrabold text-indigo-900">
                    {simulatedStats.newWeightedAvg.toFixed(2)}
                  </span>
                  <span
                    className={`text-[11px] ml-1.5 font-bold ${
                      simulatedStats.avgDiff >= 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {simulatedStats.avgDiff >= 0
                      ? `+${simulatedStats.avgDiff.toFixed(2)}`
                      : simulatedStats.avgDiff.toFixed(2)}
                  </span>
                </div>

                <div className="h-8 w-px bg-gray-200" />

                <div className="text-center">
                  <span className="text-[10px] text-gray-500 uppercase font-bold block">
                    Nuova Base Laurea
                  </span>
                  <span className="text-base font-extrabold text-purple-900">
                    {simulatedStats.newBaseDegree.toFixed(2)}
                  </span>
                  <span
                    className={`text-[11px] ml-1.5 font-bold ${
                      simulatedStats.baseDiff >= 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {simulatedStats.baseDiff >= 0
                      ? `+${simulatedStats.baseDiff.toFixed(2)}`
                      : simulatedStats.baseDiff.toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Passed Exams Table / List Section */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs flex flex-col overflow-hidden">
        {/* Table Search & Controls */}
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white">
          <div className="relative w-full sm:w-80">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cerca materia..."
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-hidden transition-all text-gray-800"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <span className="text-xs text-gray-500 font-medium">
              {filteredExams.length} {filteredExams.length === 1 ? 'esame' : 'esami'}
              {stats.honorsCount > 0 && ` • ${stats.honorsCount} con lode`}
            </span>
          </div>
        </div>

        {/* Exams Table Content */}
        {passedExams.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-3xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 mb-4 shadow-xs">
              <BookOpen className="w-8 h-8 stroke-[1.5]" />
            </div>
            <h3 className="text-base font-bold text-gray-800 mb-4">
              Nessun esame nel libretto
            </h3>
            <button
              onClick={onNewPassedExam}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl shadow-xs text-xs font-semibold transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Aggiungi esame</span>
            </button>
          </div>
        ) : filteredExams.length === 0 ? (
          <div className="p-10 text-center text-gray-500 text-xs">
            Nessuna materia trovata per "{searchQuery}".
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/70 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  <th
                    onClick={() => toggleSort('subject')}
                    className="py-3.5 px-6 cursor-pointer hover:text-gray-800 transition-colors select-none"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Materia / Esame</span>
                      <ArrowUpDown className="w-3 h-3 text-gray-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => toggleSort('grade')}
                    className="py-3.5 px-6 text-center cursor-pointer hover:text-gray-800 transition-colors select-none w-32"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>Voto</span>
                      <ArrowUpDown className="w-3 h-3 text-gray-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => toggleSort('cfu')}
                    className="py-3.5 px-6 text-center cursor-pointer hover:text-gray-800 transition-colors select-none w-32"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>CFU</span>
                      <ArrowUpDown className="w-3 h-3 text-gray-400" />
                    </div>
                  </th>
                  <th className="py-3.5 px-6 text-right w-28">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {filteredExams.map((exam) => {
                  return (
                    <tr
                      key={exam.id}
                      className="hover:bg-emerald-50/20 transition-colors group"
                    >
                      {/* Subject Name */}
                      <td className="py-4 px-6 font-semibold text-gray-900">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center shrink-0">
                            <BookOpen className="w-4 h-4" />
                          </div>
                          <span className="truncate max-w-sm md:max-w-md">{exam.subject}</span>
                        </div>
                      </td>

                      {/* Grade Badge */}
                      <td className="py-4 px-6 text-center">
                        {exam.isHonors ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-xs">
                            30L
                          </span>
                        ) : exam.grade >= 28 ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                            {exam.grade}
                          </span>
                        ) : exam.grade >= 24 ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                            {exam.grade}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-800">
                            {exam.grade}
                          </span>
                        )}
                      </td>

                      {/* CFU Badge */}
                      <td className="py-4 px-6 text-center">
                        <span className="font-semibold text-gray-700 bg-gray-100 px-2.5 py-1 rounded-md text-xs">
                          {exam.cfu} CFU
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => onEditPassedExam(exam)}
                            title="Modifica esame"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDeletePassedExam(exam)}
                            title="Elimina esame"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
