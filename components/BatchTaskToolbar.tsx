import React from 'react';
import { ExecutingUnit } from '../types';

interface BatchTaskToolbarProps {
  selectedTaskCount: number;
  units: ExecutingUnit[];
  onAssign: (unitId: string | null) => void;
}

const BatchTaskToolbar: React.FC<BatchTaskToolbarProps> = ({ selectedTaskCount, units, onAssign }) => {
  if (selectedTaskCount === 0) {
    return null;
  }

  const handleAssign = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === 'unassign') {
      onAssign(null);
    } else if (value) {
      onAssign(value);
    }
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-auto max-w-lg bg-white rounded-lg shadow-2xl p-3 flex items-center space-x-4 z-40 transition-transform transform animate-fade-in-up">
      <div className="flex-shrink-0 bg-blue-100 text-blue-800 text-sm font-bold rounded-full px-3 py-1">
        已選取 {selectedTaskCount} 個任務
      </div>
      <div className="flex-grow">
        <select
          onChange={handleAssign}
          defaultValue=""
          className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
        >
          <option value="" disabled>指派給...</option>
          {units.map(unit => (
            <option key={unit.id} value={unit.id} className="font-semibold" style={{ color: unit.color }}>
              {unit.name}
            </option>
          ))}
          <option value="unassign" className="text-red-500">取消指派</option>
        </select>
      </div>
    </div>
  );
};

export default BatchTaskToolbar;