import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Task, Warning, TaskGroup } from '../types';
import {
  format,
  endOfMonth,
  eachDayOfInterval,
  endOfWeek,
  isSameMonth,
  isSameDay,
  addMonths,
  isBefore,
  isAfter,
  differenceInDays,
  addDays,
} from 'date-fns';
import startOfMonth from 'date-fns/startOfMonth';
import startOfWeek from 'date-fns/startOfWeek';
import subMonths from 'date-fns/subMonths';
import startOfDay from 'date-fns/startOfDay';
import max from 'date-fns/max';
import min from 'date-fns/min';
import { zhTW } from 'date-fns/locale/zh-TW';

interface CalendarViewProps {
  tasks: Task[];
  warnings: Warning[];
  onDragTask: (taskId: number, newStartDate: Date) => void;
  selectedTaskIds: number[];
  onSelectTask: (taskId: number, isCtrlOrMetaKey: boolean) => void;
  onCreateGroup: () => void;
  onOpenAddTaskModal: () => void;
  onUngroupTask: (taskId: number) => void;
  taskGroups: TaskGroup[];
  onEditTask: (task: Task) => void;
  onResizeTask: (taskId: number, newDates: { start: Date; end: Date }) => void;
  onDeleteTask: (taskId: number) => void;
}

interface MonthViewProps extends Omit<CalendarViewProps, 'tasks'> {
  month: Date;
  allTasks: Task[];
  setResizeInfo: React.Dispatch<React.SetStateAction<{ taskId: number; edge: 'start' | 'end'; initialTask: Task; } | null>>;
  resizeInfo: { taskId: number; edge: 'start' | 'end'; initialTask: Task; } | null;
}

const MonthView: React.FC<MonthViewProps> = ({ month, allTasks, warnings, onDragTask, selectedTaskIds, onSelectTask, onUngroupTask, taskGroups, onEditTask, onResizeTask, onDeleteTask, setResizeInfo, resizeInfo }) => {
    const daysInGrid = useMemo(() => {
        const firstDayOfMonth = startOfMonth(month);
        const lastDayOfMonth = endOfMonth(month);
        const firstDayOfGrid = startOfWeek(firstDayOfMonth, { locale: zhTW });
        const lastDayOfGrid = endOfWeek(lastDayOfMonth, { locale: zhTW });
        return eachDayOfInterval({ start: firstDayOfGrid, end: lastDayOfGrid });
    }, [month]);

    const weeks = useMemo(() => {
        const weekChunks: Date[][] = [];
        for (let i = 0; i < daysInGrid.length; i += 7) {
            weekChunks.push(daysInGrid.slice(i, i + 7));
        }
        return weekChunks;
    }, [daysInGrid]);

    const tasksInMonth = useMemo(() => {
        const monthStart = daysInGrid[0];
        const monthEnd = daysInGrid[daysInGrid.length - 1];
        return allTasks.filter(t => isAfter(t.end, monthStart) && isBefore(t.start, monthEnd));
    }, [allTasks, daysInGrid]);

    const taskGroupMap = useMemo(() => {
        const map = new Map<string, TaskGroup>();
        taskGroups.forEach(group => map.set(group.id, group));
        return map;
    }, [taskGroups]);
    
    const weeklyLayouts = useMemo(() => {
        return weeks.map(week => {
            const weekStart = startOfDay(week[0]);
            const weekEnd = startOfDay(week[6]);
            const tasksInWeek = tasksInMonth.filter(t => isAfter(t.end, weekStart) && isBefore(t.start, weekEnd));
    
            const lanes: { task: Task, startCol: number, span: number }[][] = [];
            tasksInWeek.sort((a,b) => differenceInDays(a.start, b.start) || differenceInDays(b.end, a.end));
            
            for (const task of tasksInWeek) {
            let placed = false;
            const taskStart = startOfDay(task.start);
            const taskEnd = startOfDay(task.end);
            const startCol = differenceInDays(max([taskStart, weekStart]), weekStart);
            const endCol = differenceInDays(min([taskEnd, weekEnd]), weekStart);
            const span = endCol - startCol + 1;
    
            for (const lane of lanes) {
                const isOverlap = lane.some(existingTask => startCol < existingTask.startCol + existingTask.span && startCol + span > existingTask.startCol);
                if (!isOverlap) {
                lane.push({ task, startCol, span });
                placed = true;
                break;
                }
            }
            if (!placed) {
                lanes.push([{ task, startCol, span }]);
            }
            }
            return lanes;
        });
    }, [weeks, tasksInMonth]);

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, taskId: number) => {
        e.dataTransfer.setData('taskId', taskId.toString());
        e.dataTransfer.effectAllowed = 'move';
    };
    
    const handleDrop = (e: React.DragEvent<HTMLDivElement>, day: Date) => {
        e.preventDefault();
        const taskId = parseInt(e.dataTransfer.getData('taskId'), 10);
        if (taskId) {
            onDragTask(taskId, day);
        }
    };
    
    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleResizeStart = useCallback((e: React.MouseEvent, taskId: number, edge: 'start' | 'end') => {
        e.preventDefault();
        e.stopPropagation();
        const task = allTasks.find(t => t.id === taskId);
        if(task) {
            setResizeInfo({ taskId, edge, initialTask: {...task}});
        }
    }, [allTasks, setResizeInfo]);

    return (
        <div className="mb-8">
            <h3 className="text-xl font-bold text-slate-800 sticky top-0 bg-white bg-opacity-80 backdrop-blur-sm py-2 z-20">
                {format(month, 'yyyy年 MMMM', { locale: zhTW })}
            </h3>
            <div className="grid grid-cols-7 gap-px bg-slate-200 border-t border-l border-r border-slate-200">
                {['日', '一', '二', '三', '四', '五', '六'].map(day => (
                <div key={day} className="text-center py-2 bg-slate-50 font-semibold text-sm text-slate-600">
                    {day}
                </div>
                ))}
            </div>
            <div className="calendar-grid-body relative">
                {weeks.map((week, weekIndex) => {
                    const lanes = weeklyLayouts[weekIndex];
                    const weekHeight = Math.max(24, lanes.length * 28) + 32;
                    return (
                        <div key={weekIndex} className="relative grid grid-cols-7" style={{height: `${weekHeight}px`}}>
                            {week.map((day) => {
                                const isCurrentMonth = isSameMonth(day, month);
                                const isToday = isSameDay(day, new Date());
                                return (
                                    <div
                                        key={format(day, 'yyyy-MM-dd')}
                                        className={`border-b border-r border-slate-200 p-2 ${isCurrentMonth ? 'bg-white' : 'bg-slate-50'}`}
                                        onDrop={(e) => handleDrop(e, day)}
                                        onDragOver={handleDragOver}
                                        data-date={day.toISOString()}
                                    >
                                    <span className={`relative z-10 font-semibold ${isToday ? 'bg-blue-500 text-white rounded-full w-7 h-7 flex items-center justify-center' : 'text-slate-600'} ${!isCurrentMonth ? 'text-slate-400' : ''}`}>
                                        {format(day, 'd')}
                                    </span>
                                    </div>
                                )
                            })}
                            {lanes.map((lane, laneIndex) => (
                                lane.map(({task, startCol, span}) => {
                                    const isWarning = warnings.some(w => w.taskId === task.id);
                                    const isSelected = selectedTaskIds.includes(task.id);
                                    const group = task.groupId ? taskGroupMap.get(task.groupId) : undefined;
                                    const isResizing = resizeInfo?.taskId === task.id;
                                    return(
                                        <div key={task.id}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, task.id)}
                                            onClick={(e) => { e.stopPropagation(); onSelectTask(task.id, e.ctrlKey || e.metaKey)}}
                                            onDoubleClick={() => onEditTask(task)}
                                            className={`group absolute text-xs py-0.5 px-2 rounded-md text-white cursor-grab transition-all duration-200 flex items-center ${isWarning ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'} ${isSelected ? 'ring-2 ring-offset-1 ring-yellow-400' : ''}`}
                                            style={{
                                                top: `${laneIndex * 28 + 28}px`,
                                                left: `calc(${(100/7) * startCol}% + 2px)`,
                                                width: `calc(${(100/7) * span}% - 4px)`,
                                                borderLeft: group ? `5px solid ${group.color}` : 'none',
                                                minHeight: '24px',
                                                zIndex: 5
                                            }}
                                        >
                                            <p className="font-semibold whitespace-normal leading-tight">{task.name}</p>
                                            
                                            <div onMouseDown={(e) => handleResizeStart(e, task.id, 'start')} className={`absolute left-0 top-0 h-full w-2 cursor-ew-resize z-10 ${isResizing ? 'bg-yellow-400 opacity-50' : ''}`}/>
                                            <div onMouseDown={(e) => handleResizeStart(e, task.id, 'end')} className={`absolute right-0 top-0 h-full w-2 cursor-ew-resize z-10 ${isResizing ? 'bg-yellow-400 opacity-50' : ''}`}/>
                                            
                                            <div className="absolute top-0.5 right-0.5 flex z-10">
                                            {group && isSelected && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onUngroupTask(task.id); }}
                                                    onMouseDown={(e) => e.stopPropagation()}
                                                    className="w-4 h-4 bg-black bg-opacity-20 rounded-full text-white flex items-center justify-center hover:bg-opacity-50 transition-colors"
                                                    title="解除關聯"
                                                >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                                </button>
                                            )}
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onDeleteTask(task.id); }}
                                                onMouseDown={(e) => e.stopPropagation()}
                                                className="w-4 h-4 ml-1 bg-black bg-opacity-20 rounded-full text-white flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-opacity-50 transition-opacity"
                                                title="刪除任務"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                            </button>
                                            </div>
                                        </div>
                                    )
                                })
                            ))}
                        </div>
                    )
                })}
            </div>
        </div>
    );
};

const CalendarView: React.FC<CalendarViewProps> = (props) => {
  const [resizeInfo, setResizeInfo] = useState<{ taskId: number, edge: 'start' | 'end', initialTask: Task } | null>(null);
  const { tasks, onResizeTask, onCreateGroup, onOpenAddTaskModal, selectedTaskIds } = props;
  
  const monthRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [viewStartDate] = useState(startOfMonth(subMonths(new Date(), 3)));
  const [viewEndDate] = useState(endOfMonth(addMonths(new Date(), 8))); // Approx 1 year view

  const allMonths = useMemo(() => {
    const months = [];
    let current = viewStartDate;
    while (!isAfter(current, viewEndDate)) {
      months.push(current);
      current = addMonths(current, 1);
    }
    return months;
  }, [viewStartDate, viewEndDate]);

  useEffect(() => {
    const todayKey = format(new Date(), 'yyyy-MM');
    const todayEl = monthRefs.current[todayKey];
    if (todayEl && scrollContainerRef.current) {
        const offset = todayEl.offsetTop - (scrollContainerRef.current.offsetTop);
        scrollContainerRef.current.scrollTo({ top: offset, behavior: 'smooth' });
    }
  }, []); // Run only on mount

  const handleGoToToday = () => {
    const todayKey = format(new Date(), 'yyyy-MM');
    const todayEl = monthRefs.current[todayKey];
    if (todayEl && scrollContainerRef.current) {
        const offset = todayEl.offsetTop - (scrollContainerRef.current.offsetTop);
        scrollContainerRef.current.scrollTo({ top: offset, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
        if (!resizeInfo) return;

        const dayCell = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-date]');
        if (dayCell && dayCell.dataset.date) {
            const newDate = startOfDay(new Date(dayCell.dataset.date));
            const { initialTask, edge } = resizeInfo;
            let newStart = initialTask.start;
            let newEnd = initialTask.end;
            if (edge === 'start' && !isAfter(newDate, initialTask.end)) {
                newStart = newDate;
            } else if (edge === 'end' && !isBefore(newDate, initialTask.start)) {
                newEnd = newDate;
            }
            onResizeTask(resizeInfo.taskId, { start: newStart, end: newEnd });
        }
    };
    const handleMouseUp = () => {
        setResizeInfo(null);
    };
    if (resizeInfo) {
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizeInfo, onResizeTask]);

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 relative select-none flex flex-col" style={{height: 'calc(100vh - 120px)'}}>
      {/* Header */}
      <div className="flex justify-between items-center mb-4 flex-shrink-0">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-800">
          月曆檢視
        </h2>
        <div className="flex items-center space-x-4">
            <button
                onClick={handleGoToToday}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 px-4 rounded-lg transition duration-300 text-sm flex items-center"
            >
              回到今天
            </button>
            {selectedTaskIds.length > 1 && (
                <button
                    onClick={onCreateGroup}
                    className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 px-4 rounded-lg transition-all duration-300 text-sm flex items-center z-10"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                    時間關聯 ({selectedTaskIds.length})
                </button>
            )}
        </div>
      </div>
      
      {/* Scrollable Container */}
      <div ref={scrollContainerRef} className="overflow-y-auto flex-grow">
        {allMonths.map(month => (
            <div key={month.toISOString()} ref={el => { monthRefs.current[format(month, 'yyyy-MM')] = el; }}>
                <MonthView 
                    month={month}
                    allTasks={tasks}
                    {...props}
                    resizeInfo={resizeInfo}
                    setResizeInfo={setResizeInfo}
                />
            </div>
        ))}
      </div>

       {/* Floating Add Button */}
       <button 
        onClick={onOpenAddTaskModal}
        className="absolute bottom-6 right-6 w-14 h-14 bg-blue-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-blue-600 transition-transform transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 z-30"
        aria-label="新增任務"
       >
           <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
           </svg>
       </button>
    </div>
  );
};

export default CalendarView;