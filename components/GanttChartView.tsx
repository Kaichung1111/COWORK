import React, { useMemo, useState, useRef, useCallback } from 'react';
import { Task, Warning, TaskGroup, ExecutingUnit } from '../types';
// FIX: The 'startOfDay' function was not found in the main 'date-fns' export.
// It is now imported directly from its submodule to ensure it is resolved correctly.
import { format, differenceInDays, addDays } from 'date-fns';
import startOfDay from 'date-fns/startOfDay';

const ROW_HEIGHT = 40;
const DAY_WIDTH = 40;
const SIDEBAR_WIDTH = 250;

interface GanttTaskBarProps {
  task: Task;
  isWarning: boolean;
  left: number;
  width: number;
  top: number;
  onDragStart: (e: React.MouseEvent<HTMLDivElement>, taskId: number) => void;
  onDoubleClick: (task: Task) => void;
  groupColor?: string;
  unitColor?: string;
  onDelete: (taskId: number) => void;
  onResizeStart: (e: React.MouseEvent<HTMLDivElement>, taskId: number, edge: 'start' | 'end') => void;
}

const GanttTaskBar: React.FC<GanttTaskBarProps> = ({ task, isWarning, left, width, top, onDragStart, onDoubleClick, groupColor, unitColor, onDelete, onResizeStart }) => {
  const bgColor = isWarning ? '#ef4444' : (unitColor || '#3b82f6');
  
  return (
    <div
      onMouseDown={(e) => onDragStart(e, task.id)}
      onDoubleClick={() => onDoubleClick(task)}
      className={`absolute h-8 px-2 flex items-center rounded-lg cursor-grab active:cursor-grabbing transition-all duration-200 group`}
      style={{ left: `${left}px`, width: `${width}px`, top: `${top}px` }}
    >
      <div
        className={`w-full h-full rounded-md flex items-center justify-between text-white`}
        style={{
          backgroundColor: bgColor,
          borderLeft: groupColor ? `5px solid ${groupColor}` : 'none'
        }}
      >
        <div
          className="absolute top-0 left-0 h-full bg-black bg-opacity-20 rounded-l-md"
          style={{ width: `${task.progress}%`, marginLeft: groupColor ? '5px' : '0' }}
        ></div>
         <div 
          onMouseDown={(e) => onResizeStart(e, task.id, 'start')}
          className="absolute left-0 top-0 h-full w-2 cursor-ew-resize z-10"
        />
        <span className="relative text-xs font-semibold truncate px-2 flex-grow">{task.name}</span>
        <span className="relative text-xs font-light pr-2 flex-shrink-0">{task.progress}%</span>
        <button
            onClick={(e) => {
                e.stopPropagation();
                onDelete(task.id);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="relative w-5 h-5 mr-1 bg-black bg-opacity-20 rounded-full text-white flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-opacity-50 transition-opacity flex-shrink-0 z-20"
            title="刪除任務"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg>
        </button>
        <div 
          onMouseDown={(e) => onResizeStart(e, task.id, 'end')}
          className="absolute right-0 top-0 h-full w-2 cursor-ew-resize z-10"
        />
      </div>
    </div>
  );
};


const GanttChartView: React.FC<{
  tasks: Task[];
  warnings: Warning[];
  onDragTask: (taskId: number, newStartDate: Date) => void;
  taskGroups: TaskGroup[];
  executingUnits: ExecutingUnit[];
  onEditTask: (task: Task) => void;
  onResizeTask: (taskId: number, newDates: { start: Date; end: Date }) => void;
  onDeleteTask: (taskId: number) => void;
}> = ({ tasks, warnings, onDragTask, taskGroups, executingUnits, onEditTask, onResizeTask, onDeleteTask }) => {
  const [timelineWidth, setTimelineWidth] = useState(2000);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [dragInfo, setDragInfo] = useState<{ type: 'move' | 'resize', taskId: number, startX: number, initialTask: Task, edge?: 'start' | 'end' } | null>(null);

  const { startDate, endDate, totalDays } = useMemo(() => {
    if (tasks.length === 0) {
      const today = new Date();
      return { startDate: today, endDate: addDays(today, 30), totalDays: 30 };
    }
    const startDates = tasks.map(t => t.start);
    const endDates = tasks.map(t => t.end);
    const minDate = new Date(Math.min(...startDates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...endDates.map(d => d.getTime())));
    return {
      startDate: startOfDay(minDate),
      endDate: startOfDay(addDays(maxDate, 5)), // Add some buffer
      totalDays: differenceInDays(addDays(maxDate, 5), minDate)
    };
  }, [tasks]);

  React.useEffect(() => {
    setTimelineWidth(totalDays * DAY_WIDTH);
  }, [totalDays]);


  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>, taskId: number, type: 'move' | 'resize', edge?: 'start' | 'end') => {
    e.stopPropagation();
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    setDragInfo({ type, taskId, startX: e.clientX, initialTask: { ...task }, edge });
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!dragInfo) return;
        const dx = moveEvent.clientX - dragInfo.startX;
        const dayDelta = Math.round(dx / DAY_WIDTH);
        
        if (dragInfo.type === 'move') {
            const newStartDate = addDays(dragInfo.initialTask.start, dayDelta);
            onDragTask(taskId, newStartDate);
        } else { // resize
            let newStart = dragInfo.initialTask.start;
            let newEnd = dragInfo.initialTask.end;
            if (dragInfo.edge === 'start') {
                newStart = addDays(dragInfo.initialTask.start, dayDelta);
                if (newStart > newEnd) newStart = newEnd;
            } else {
                newEnd = addDays(dragInfo.initialTask.end, dayDelta);
                if (newEnd < newStart) newEnd = newStart;
            }
            onResizeTask(taskId, { start: newStart, end: newEnd });
        }
    };

    const handleMouseUp = () => {
        setDragInfo(null);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [tasks, onDragTask, onResizeTask, dragInfo]);

  const dependencyLines = useMemo(() => {
    return tasks.filter(t => t.predecessorId).map(task => {
        const predecessor = tasks.find(p => p.id === task.predecessorId);
        if (!predecessor) return null;

        const startX = (differenceInDays(predecessor.end, startDate)) * DAY_WIDTH + DAY_WIDTH / 2;
        const startY = tasks.indexOf(predecessor) * ROW_HEIGHT + ROW_HEIGHT / 2;
        const endX = (differenceInDays(task.start, startDate)) * DAY_WIDTH + DAY_WIDTH / 2;
        const endY = tasks.indexOf(task) * ROW_HEIGHT + ROW_HEIGHT / 2;
        const isWarning = warnings.some(w => w.taskId === task.id);

        return {
            id: `${predecessor.id}-${task.id}`,
            isWarning,
            path: `M ${startX} ${startY} L ${startX + 20} ${startY} L ${startX + 20} ${endY} L ${endX} ${endY}`
        };
    }).filter(Boolean);
  }, [tasks, startDate, warnings]);

  const taskGroupMap = useMemo(() => {
    const map = new Map<string, TaskGroup>();
    taskGroups.forEach(group => map.set(group.id, group));
    return map;
  }, [taskGroups]);
  
  const unitMap = useMemo(() => {
    const map = new Map<string, ExecutingUnit>();
    executingUnits.forEach(unit => map.set(unit.id, unit));
    return map;
  }, [executingUnits]);

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {taskGroups.length > 0 && (
        <div className="p-4 border-b border-slate-200 bg-slate-50">
            <h3 className="text-md font-semibold mb-2 text-slate-700">時間關聯群組圖例</h3>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
                {taskGroups.map((group, index) => (
                    <div key={group.id} className="flex items-center">
                        <div className="w-4 h-4 rounded-sm mr-2 shadow-inner" style={{ backgroundColor: group.color }}></div>
                        <span className="text-sm text-slate-600">群組 {index + 1}</span>
                    </div>
                ))}
            </div>
        </div>
      )}
      <div className="flex">
        {/* Sidebar */}
        <div className="flex-shrink-0 bg-slate-50 border-r border-slate-200" style={{ width: `${SIDEBAR_WIDTH}px` }}>
          <div className="h-16 flex items-center px-4 font-semibold text-slate-700 border-b border-slate-200">
            任務名稱
          </div>
          <div className="relative">
            {tasks.map((task, index) => (
              <div key={task.id} className="h-10 flex items-center px-4 text-sm truncate border-b border-slate-200" style={{top: `${index * ROW_HEIGHT}px`}}>
                {task.name}
              </div>
            ))}
          </div>
        </div>

        {/* Chart */}
        <div className="flex-grow overflow-x-auto">
          <div className="relative" style={{ height: `${tasks.length * ROW_HEIGHT + 64}px`, width: `${timelineWidth}px` }} ref={chartContainerRef}>
            {/* Header */}
            <div className="sticky top-0 bg-white z-10">
              <div className="flex h-16 border-b border-slate-200">
                {Array.from({ length: totalDays }).map((_, i) => {
                  const day = addDays(startDate, i);
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                  return (
                    <div key={i} className={`flex-shrink-0 flex flex-col items-center justify-center border-r border-slate-200 ${isWeekend ? 'bg-slate-50' : ''}`} style={{ width: `${DAY_WIDTH}px` }}>
                       <span className="text-xs text-slate-500">{format(day, 'EEE')}</span>
                       <span className="text-sm font-medium">{format(day, 'd')}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Grid */}
             <div className="absolute top-16 left-0 w-full" style={{height: `${tasks.length * ROW_HEIGHT}px`}}>
               {Array.from({ length: totalDays }).map((_, i) => (
                    <div key={i} className="absolute top-0 bottom-0 border-r border-slate-100" style={{ left: `${i * DAY_WIDTH}px`, width: `${DAY_WIDTH}px` }}></div>
                ))}
                {tasks.map((_, i) => (
                     <div key={i} className="absolute left-0 right-0 border-b border-slate-100" style={{ top: `${i * ROW_HEIGHT}px`, height: `${ROW_HEIGHT}px` }}></div>
                ))}
            </div>

            {/* Dependency Lines */}
            <svg className="absolute top-16 left-0 w-full h-full pointer-events-none" style={{height: `${tasks.length * ROW_HEIGHT}px`}}>
                 {dependencyLines.map(line => line && (
                     <path key={line.id} d={line.path} stroke={line.isWarning ? '#ef4444' : '#94a3b8'} strokeWidth="2" fill="none" markerEnd="url(#arrow)"/>
                 ))}
                 <defs>
                     <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                         <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
                     </marker>
                 </defs>
            </svg>

            {/* Task Bars */}
            <div className="absolute top-16 left-0">
            {tasks.map((task, index) => {
              const left = (differenceInDays(task.start, startDate)) * DAY_WIDTH;
              const width = (differenceInDays(task.end, task.start) + 1) * DAY_WIDTH - 4; // a bit of padding
              const isWarning = warnings.some(w => w.taskId === task.id);
              const group = task.groupId ? taskGroupMap.get(task.groupId) : undefined;
              const unit = task.unitId ? unitMap.get(task.unitId) : undefined;

              return (
                <GanttTaskBar
                  key={task.id}
                  task={task}
                  isWarning={isWarning}
                  left={left}
                  width={width}
                  top={index * ROW_HEIGHT + 4}
                  onDragStart={(e, taskId) => handleMouseDown(e, taskId, 'move')}
                  onDoubleClick={onEditTask}
                  groupColor={group?.color}
                  unitColor={unit?.color}
                  onDelete={onDeleteTask}
                  onResizeStart={(e, taskId, edge) => handleMouseDown(e, taskId, 'resize', edge)}
                />
              );
            })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GanttChartView;