import React, { useState, useEffect } from 'react';
import { IndianRupee, Sliders, Plus, Minus, Check, ArrowRight } from 'lucide-react';
import { RequirementType } from '../../types';
import { formatIndianCurrency } from '../../utils/formatters';

interface BudgetCustomizerProps {
  requirement: RequirementType;
  budgetMin?: number;
  budgetMax: number;
  onChange: (min: number | undefined, max: number) => void;
}

type BudgetUnit = 'lakh' | 'crore' | 'thousand' | 'exact';

export const BudgetCustomizer: React.FC<BudgetCustomizerProps> = ({
  requirement,
  budgetMin,
  budgetMax,
  onChange,
}) => {
  const isRent = requirement === 'rent' || requirement === 'lease';

  const [isCustomOpen, setIsCustomOpen] = useState<boolean>(false);
  const [isRangeMode, setIsRangeMode] = useState<boolean>(!!budgetMin && budgetMin < budgetMax);

  // Unit selection
  const [unit, setUnit] = useState<BudgetUnit>(() => {
    if (isRent) {
      return budgetMax >= 100000 ? 'lakh' : 'thousand';
    }
    return budgetMax >= 10000000 ? 'crore' : 'lakh';
  });

  // Numeric inputs based on selected unit
  const getUnitValue = (rupees: number, u: BudgetUnit): string => {
    if (!rupees || isNaN(rupees)) return '0';
    if (u === 'crore') return (rupees / 10000000).toString();
    if (u === 'lakh') return (rupees / 100000).toString();
    if (u === 'thousand') return (rupees / 1000).toString();
    return rupees.toString();
  };

  const [customValInput, setCustomValInput] = useState<string>(() =>
    getUnitValue(budgetMax, unit)
  );
  const [customMinInput, setCustomMinInput] = useState<string>(() =>
    budgetMin ? getUnitValue(budgetMin, unit) : ''
  );

  // Synchronize input when budgetMax/budgetMin changes from external presets
  useEffect(() => {
    setCustomValInput(getUnitValue(budgetMax, unit));
    if (budgetMin) {
      setCustomMinInput(getUnitValue(budgetMin, unit));
    }
  }, [budgetMax, budgetMin, unit]);

  // Quick preset options
  const buyPresets = [
    { label: '₹35L', max: 3500000, min: 3000000 },
    { label: '₹50L', max: 5000000, min: 4500000 },
    { label: '₹75L', max: 7500000, min: 6500000 },
    { label: '₹1 Cr', max: 10000000, min: 9000000 },
    { label: '₹1.5 Cr', max: 15000000, min: 12500000 },
    { label: '₹2 Cr+', max: 20000000, min: 18000000 },
    { label: '₹3 Cr+', max: 30000000, min: 25000000 },
  ];

  const rentPresets = [
    { label: '₹15k', max: 15000, min: 12000 },
    { label: '₹25k', max: 25000, min: 20000 },
    { label: '₹35k', max: 35000, min: 30000 },
    { label: '₹50k', max: 50000, min: 45000 },
    { label: '₹75k', max: 75000, min: 65000 },
    { label: '₹1 Lakh', max: 100000, min: 85000 },
    { label: '₹1.5L+', max: 150000, min: 125000 },
  ];

  const presets = isRent ? rentPresets : buyPresets;

  const parseToRupees = (val: string, u: BudgetUnit): number => {
    const num = parseFloat(val);
    if (isNaN(num) || num <= 0) return 0;
    if (u === 'crore') return Math.round(num * 10000000);
    if (u === 'lakh') return Math.round(num * 100000);
    if (u === 'thousand') return Math.round(num * 1000);
    return Math.round(num);
  };

  const handleApplyCustom = (maxValStr: string, minValStr: string, u: BudgetUnit) => {
    const maxRupees = parseToRupees(maxValStr, u);
    let minRupees: number | undefined = undefined;

    if (isRangeMode && minValStr.trim()) {
      const parsedMin = parseToRupees(minValStr, u);
      if (parsedMin > 0 && parsedMin <= maxRupees) {
        minRupees = parsedMin;
      }
    }

    if (maxRupees > 0) {
      onChange(minRupees, maxRupees);
    }
  };

  const handleUnitChange = (newUnit: BudgetUnit) => {
    setUnit(newUnit);
    setCustomValInput(getUnitValue(budgetMax, newUnit));
    if (budgetMin) {
      setCustomMinInput(getUnitValue(budgetMin, newUnit));
    }
  };

  const handleStepDelta = (delta: number) => {
    let currentRupees = budgetMax;
    let newRupees = Math.max(1000, currentRupees + delta);
    let newMin = budgetMin;
    if (budgetMin && isRangeMode) {
      newMin = Math.max(1000, budgetMin + delta);
      if (newMin >= newRupees) newMin = Math.round(newRupees * 0.85);
    }
    onChange(newMin, newRupees);
  };

  // Convert number to full words representation
  const formatInIndianWords = (amount: number): string => {
    if (!amount) return 'Zero';
    if (amount >= 10000000) {
      const cr = (amount / 10000000).toFixed(2).replace(/\.00$/, '');
      return `${cr} Crore${parseFloat(cr) > 1 ? 's' : ''}`;
    }
    if (amount >= 100000) {
      const lk = (amount / 100000).toFixed(2).replace(/\.00$/, '');
      return `${lk} Lakh${parseFloat(lk) > 1 ? 's' : ''}`;
    }
    if (amount >= 1000) {
      const th = (amount / 1000).toFixed(1).replace(/\.0$/, '');
      return `${th} Thousand`;
    }
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const isCurrentPreset = presets.some((p) => p.max === budgetMax && (!isRangeMode || budgetMin === p.min));

  return (
    <div className="space-y-2.5">
      {/* Header with Title and Current Value Display */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
            <IndianRupee className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Target Budget</span>
          </label>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/70 px-2.5 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800/60 shadow-2xs">
            {budgetMin && budgetMin < budgetMax
              ? `${formatIndianCurrency(budgetMin)} - ${formatIndianCurrency(budgetMax)}`
              : formatIndianCurrency(budgetMax)}
            {isRent ? ' / mo' : ''}
          </span>
          <button
            type="button"
            onClick={() => setIsCustomOpen(!isCustomOpen)}
            className={`p-1 rounded-lg border transition-all ${
              isCustomOpen || !isCurrentPreset
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
            title="Customize Exact Budget"
          >
            <Sliders className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Quick Presets Grid */}
      <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
        {presets.map((preset) => {
          const isSelected = budgetMax === preset.max;
          return (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                const minVal = isRangeMode ? preset.min : undefined;
                onChange(minVal, preset.max);
                setCustomValInput(getUnitValue(preset.max, unit));
                if (minVal) setCustomMinInput(getUnitValue(minVal, unit));
              }}
              className={`py-1.5 px-1 rounded-xl text-xs font-semibold border transition-all text-center ${
                isSelected && !isCustomOpen
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs scale-[1.02]'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/60'
              }`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      {/* Custom Budget Details Panel (Always accessible or expandable) */}
      <div
        className={`p-3 rounded-2xl border transition-all ${
          isCustomOpen || !isCurrentPreset
            ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/70 shadow-xs'
            : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
              Custom Amount & Unit
            </span>
          </div>

          {/* Range Toggle */}
          <button
            type="button"
            onClick={() => {
              const nextMode = !isRangeMode;
              setIsRangeMode(nextMode);
              if (nextMode && !budgetMin) {
                const autoMin = Math.round(budgetMax * 0.85);
                onChange(autoMin, budgetMax);
                setCustomMinInput(getUnitValue(autoMin, unit));
              } else if (!nextMode) {
                onChange(undefined, budgetMax);
              }
            }}
            className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border transition-all flex items-center gap-1 ${
              isRangeMode
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600'
            }`}
          >
            <span>{isRangeMode ? '✓ Min-Max Range' : '+ Add Min Range'}</span>
          </button>
        </div>

        {/* Unit Selection Pills */}
        <div className="flex items-center gap-1 mb-2.5">
          {[
            { id: 'lakh' as BudgetUnit, label: 'Lakhs (₹ L)' },
            { id: 'crore' as BudgetUnit, label: 'Crores (₹ Cr)' },
            { id: 'thousand' as BudgetUnit, label: 'Thousands (k)' },
            { id: 'exact' as BudgetUnit, label: 'Exact ₹' },
          ].map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => handleUnitChange(u.id)}
              className={`flex-1 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                unit === u.id
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                  : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-100'
              }`}
            >
              {u.label}
            </button>
          ))}
        </div>

        {/* Custom Input Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {isRangeMode && (
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-0.5">
                Minimum Budget ({unit === 'crore' ? 'Cr' : unit === 'lakh' ? 'Lakhs' : unit === 'thousand' ? 'k' : '₹'})
              </label>
              <div className="relative">
                <input
                  type="number"
                  step={unit === 'crore' ? '0.05' : unit === 'lakh' ? '0.5' : unit === 'thousand' ? '1' : '10000'}
                  value={customMinInput}
                  onChange={(e) => {
                    setCustomMinInput(e.target.value);
                    handleApplyCustom(customValInput, e.target.value, unit);
                  }}
                  placeholder="e.g. 50"
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-xs font-bold focus:ring-2 focus:ring-emerald-500 outline-hidden"
                />
              </div>
            </div>
          )}

          <div className={isRangeMode ? '' : 'sm:col-span-2'}>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-0.5">
              {isRangeMode ? 'Maximum Budget' : 'Target Budget'} ({unit === 'crore' ? 'Cr' : unit === 'lakh' ? 'Lakhs' : unit === 'thousand' ? 'k' : '₹'})
            </label>
            <div className="relative">
              <input
                type="number"
                step={unit === 'crore' ? '0.05' : unit === 'lakh' ? '0.5' : unit === 'thousand' ? '1' : '10000'}
                value={customValInput}
                onChange={(e) => {
                  setCustomValInput(e.target.value);
                  handleApplyCustom(e.target.value, customMinInput, unit);
                }}
                placeholder="e.g. 75"
                className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-xs font-bold focus:ring-2 focus:ring-emerald-500 outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* Quick Stepper Adjustments */}
        <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-700/80">
          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
            Quick Adjust:
          </span>
          <div className="flex items-center gap-1">
            {isRent ? (
              <>
                <button
                  type="button"
                  onClick={() => handleStepDelta(-5000)}
                  className="px-2 py-0.5 text-[11px] font-bold bg-white dark:bg-slate-700 hover:bg-slate-100 rounded-md border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300"
                >
                  - ₹5k
                </button>
                <button
                  type="button"
                  onClick={() => handleStepDelta(5000)}
                  className="px-2 py-0.5 text-[11px] font-bold bg-white dark:bg-slate-700 hover:bg-slate-100 rounded-md border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300"
                >
                  + ₹5k
                </button>
                <button
                  type="button"
                  onClick={() => handleStepDelta(10000)}
                  className="px-2 py-0.5 text-[11px] font-bold bg-white dark:bg-slate-700 hover:bg-slate-100 rounded-md border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300"
                >
                  + ₹10k
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => handleStepDelta(-500000)}
                  className="px-2 py-0.5 text-[11px] font-bold bg-white dark:bg-slate-700 hover:bg-slate-100 rounded-md border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300"
                >
                  - ₹5L
                </button>
                <button
                  type="button"
                  onClick={() => handleStepDelta(500000)}
                  className="px-2 py-0.5 text-[11px] font-bold bg-white dark:bg-slate-700 hover:bg-slate-100 rounded-md border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300"
                >
                  + ₹5L
                </button>
                <button
                  type="button"
                  onClick={() => handleStepDelta(1000000)}
                  className="px-2 py-0.5 text-[11px] font-bold bg-white dark:bg-slate-700 hover:bg-slate-100 rounded-md border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300"
                >
                  + ₹10L
                </button>
                <button
                  type="button"
                  onClick={() => handleStepDelta(2500000)}
                  className="px-2 py-0.5 text-[11px] font-bold bg-white dark:bg-slate-700 hover:bg-slate-100 rounded-md border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300"
                >
                  + ₹25L
                </button>
              </>
            )}
          </div>
        </div>

        {/* Real-time description */}
        <div className="mt-2 text-center text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
          Target:{' '}
          <span className="font-extrabold">
            {formatInIndianWords(budgetMax)}
          </span>{' '}
          ({formatIndianCurrency(budgetMax)})
          {budgetMin && budgetMin < budgetMax && (
            <span className="text-slate-500 dark:text-slate-400">
              {' '}
              • Range starts from {formatInIndianWords(budgetMin)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
