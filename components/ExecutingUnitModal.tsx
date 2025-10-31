import React, { useState, useEffect } from 'react';
import { ExecutingUnit } from '../types';

interface ExecutingUnitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (units: ExecutingUnit[]) => void;
  units: ExecutingUnit[];
}

const ExecutingUnitModal: React.FC<ExecutingUnitModalProps> = ({ isOpen, onClose, onSave, units }) => {
  const [editedUnits, setEditedUnits] = useState<ExecutingUnit[]>([]);

  useEffect(() => {
    if (isOpen) {
      // Create a deep copy to avoid mutating the original state directly
      setEditedUnits(JSON.parse(JSON.stringify(units)));
    }
  }, [isOpen, units]);

  const handleAddUnit = () => {
    const newUnit: ExecutingUnit = {
      id: `unit-${Date.now()}`,
      name: '新單位',
      color: '#60a5fa', // Default blue color
    };
    setEditedUnits(prev => [...prev, newUnit]);
  };

  const handleUpdateUnit = (id: string, field: keyof ExecutingUnit, value: string) => {
    setEditedUnits(prev => prev.map(unit => (unit.id === id ? { ...unit, [field]: value } : unit)));
  };

  const handleDeleteUnit = (id: string) => {
    setEditedUnits(prev => prev.filter(unit => unit.id !== id));
  };

  const handleSave = () => {
    onSave(editedUnits);
  };
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 transition-opacity" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg transform transition-all" onClick={e => e.stopPropagation()}>
        <h2 className="text-2xl font-bold mb-4 text-slate-800">管理執行單位</h2>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
          {editedUnits.map(unit => (
            <div key={unit.id} className="flex items-center space-x-3 p-2 bg-slate-50 rounded-lg">
              <input
                type="color"
                value={unit.color}
                onChange={e => handleUpdateUnit(unit.id, 'color', e.target.value)}
                className="w-10 h-10 p-1 border-none rounded-md cursor-pointer flex-shrink-0"
                style={{ backgroundColor: unit.color }}
              />
              <input
                type="text"
                value={unit.name}
                onChange={e => handleUpdateUnit(unit.id, 'name', e.target.value)}
                className="flex-grow px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="單位名稱"
              />
              <button
                onClick={() => handleDeleteUnit(unit.id)}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-100 rounded-full transition flex-shrink-0"
                title="刪除單位"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={handleAddUnit}
          className="mt-4 w-full flex items-center justify-center py-2 px-4 border border-dashed border-slate-300 text-sm font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          新增單位
        </button>
        <div className="mt-6 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition"
          >
            儲存變更
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExecutingUnitModal;