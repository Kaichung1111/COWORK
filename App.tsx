import React, { useState, useCallback, useEffect } from 'react';
import { Task, ViewMode, Warning, TaskGroup, Project, ExecutingUnit } from './types';
import * as db from './services/db';
import { parseMppFile } from './services/mppParser';
import { parseMdFiles } from './services/mdParser';
import Header from './components/Header';
import GanttChartView from './components/GanttChartView';
import CalendarView from './components/CalendarView';
import TaskFormModal from './components/AddTaskModal';
import Notification from './components/Notification';
import GroupRelationshipView from './components/GroupRelationshipView';
import ProjectListView from './components/ProjectListView';
import ProjectFormModal from './components/ProjectFormModal';
import ConfirmationModal from './components/ConfirmationModal';
import ExecutingUnitModal from './components/ExecutingUnitModal';
import BatchTaskToolbar from './components/BatchTaskToolbar';
import { addDays, differenceInBusinessDays, differenceInDays } from 'date-fns';
import startOfDay from 'date-fns/startOfDay';

interface NotificationState {
  message: string;
  type: 'success' | 'error' | 'info';
}

// Helper to revive dates from JSON serialization
const reviveDates = (project: any): Project => ({
  ...project,
  startDate: new Date(project.startDate),
  endDate: new Date(project.endDate),
  tasks: project.tasks.map((task: any) => ({
    ...task,
    start: new Date(task.start),
    end: new Date(task.end),
  })),
  taskGroups: project.taskGroups || [],
  executingUnits: project.executingUnits || [],
});

const App: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Calendar);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  const [selectedTaskIds, setSelectedTaskIds] = useState<number[]>([]);
  
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [isProjectFormOpen, setIsProjectFormOpen] = useState(false);
  const [isExecutingUnitModalOpen, setIsExecutingUnitModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [newTaskDefaultDates, setNewTaskDefaultDates] = useState<{ start: Date; end: Date } | null>(null);
  const [notification, setNotification] = useState<NotificationState | null>(null);
  
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [taskToDeleteId, setTaskToDeleteId] = useState<number | null>(null);

  const showNotification = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    const timer = setTimeout(() => setNotification(null), 4000);
    return () => clearTimeout(timer);
  }, []);

  // Load projects from Neon DB on initial render
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        await db.initDb();
        let dbProjects = await db.getAllProjects();

        if (dbProjects.length === 0) {
          const today = startOfDay(new Date());
          const sampleProject: Project = {
              id: `proj-${Date.now()}`, name: '範例專案', startDate: today, endDate: addDays(today, 60),
              tasks: [
                  { id: 1, name: '專案啟動與規劃', start: addDays(today, 0), end: addDays(today, 4), progress: 100 },
                  { id: 2, name: '需求訪談與分析', start: addDays(today, 2), end: addDays(today, 7), progress: 85, predecessorId: 1 },
                  { id: 3, name: '系統架構設計', start: addDays(today, 8), end: addDays(today, 12), progress: 60, predecessorId: 2 },
                  { id: 4, name: 'UI/UX 設計', start: addDays(today, 8), end: addDays(today, 15), progress: 75, predecessorId: 2 },
                  { id: 5, name: '資料庫設計', start: addDays(today, 13), end: addDays(today, 18), progress: 40, predecessorId: 3 },
                  { id: 6, name: '前端開發', start: addDays(today, 16), end: addDays(today, 28), progress: 20, predecessorId: 4 },
                  { id: 7, name: '後端開發', start: addDays(today, 19), end: addDays(today, 30), progress: 15, predecessorId: 5 },
                  { id: 8, name: '整合測試', start: addDays(today, 31), end: addDays(today, 35), progress: 0, predecessorId: 7 },
                  { id: 9, name: '使用者驗收測試 (UAT)', start: addDays(today, 36), end: addDays(today, 39), progress: 0, predecessorId: 8 },
                  { id: 10, name: '部署上線', start: addDays(today, 40), end: addDays(today, 40), progress: 0, predecessorId: 9 },
              ],
              taskGroups: [], executingUnits: [],
          };
          await db.saveProject(sampleProject);
          dbProjects = [sampleProject];
        }

        const revivedProjects = dbProjects.map(reviveDates);
        setProjects(revivedProjects);
        if (!currentProjectId && revivedProjects.length > 0) {
          setCurrentProjectId(revivedProjects[0].id);
        }
      } catch (error) {
        console.error("無法從資料庫載入專案:", error);
        showNotification("無法從資料庫載入專案。", "error");
        setProjects([]);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [showNotification, currentProjectId]);

  const currentProject = projects.find(p => p.id === currentProjectId);
  
  const checkForWarnings = useCallback((updatedTasks: Task[]) => {
    const newWarnings: Warning[] = [];
    for (const task of updatedTasks) {
      if (task.predecessorId) {
        const predecessor = updatedTasks.find(p => p.id === task.predecessorId);
        if (predecessor && task.start < predecessor.end) {
          newWarnings.push({
            taskId: task.id,
            message: `"${task.name}" 的開始時間早於其前置作業 "${predecessor.name}" 的結束時間。`,
          });
        }
      }
    }
    setWarnings(newWarnings);
  }, []);

  const updateAndSaveProjectData = useCallback(async (updater: (project: Project) => Partial<Project> | null) => {
    if (!currentProject) return null;
    try {
        const partialUpdate = updater(currentProject);
        if (partialUpdate === null) return null;
        
        const updatedProject = { ...currentProject, ...partialUpdate };
        await db.saveProject(updatedProject);
        setProjects(prev => prev.map(p => p.id === currentProjectId ? updatedProject : p));
        return partialUpdate;
    } catch (error) {
        console.error("更新專案失敗:", error);
        showNotification("更新專案失敗。", "error");
        return null;
    }
  }, [currentProject, showNotification, currentProjectId]);
  
  const handleFileImport = async (file: File) => {
    setIsLoading(true);
    try {
      const parsedTasks = await parseMppFile(file);
      const updateResult = await updateAndSaveProjectData(() => ({ tasks: parsedTasks, name: file.name.replace(/\.mpp$/i, '') }));
      if (updateResult?.tasks) checkForWarnings(updateResult.tasks);
    } catch (error) {
      console.error("檔案解析失敗:", error);
      showNotification("無法解析此檔案。請確認格式是否正確。", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMdFileImport = async (files: FileList) => {
    setIsLoading(true);
    try {
      const parsedTasksData = await parseMdFiles(Array.from(files));
      if (parsedTasksData.length === 0) {
        showNotification("未找到可匯入的有效任務。", "info");
        return;
      }
      const updateResult = await updateAndSaveProjectData(proj => {
          let maxId = proj.tasks.length > 0 ? Math.max(...proj.tasks.map(t => t.id)) : 0;
          const newTasks: Task[] = parsedTasksData.map(data => ({ ...data, id: ++maxId }));
          return { tasks: [...proj.tasks, ...newTasks] };
      });
      if (updateResult?.tasks) {
          checkForWarnings(updateResult.tasks);
          showNotification(`${parsedTasksData.length} 個任務已成功匯入。`, 'success');
      }
    } catch (error) {
      console.error("MD 檔案解析失敗:", error);
      showNotification("無法解析 Markdown 檔案。", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragTask = useCallback(async (taskId: number, newStartDate: Date) => {
    const updateResult = await updateAndSaveProjectData(proj => {
        const taskToMove = proj.tasks.find(t => t.id === taskId);
        if (!taskToMove) return null;
        const deltaDays = differenceInDays(newStartDate, taskToMove.start);
        if (deltaDays === 0) return null;
        let updatedTasks: Task[];
        if (taskToMove.groupId) {
            const group = proj.taskGroups.find(g => g.id === taskToMove.groupId);
            if (!group) return null;
            const groupTaskIds = new Set(group.taskIds);
            updatedTasks = proj.tasks.map(task => 
                groupTaskIds.has(task.id) 
                    ? { ...task, start: addDays(task.start, deltaDays), end: addDays(task.end, deltaDays) } 
                    : task
            );
        } else {
            updatedTasks = proj.tasks.map(task =>
                task.id === taskId ? { ...task, start: newStartDate, end: addDays(newStartDate, differenceInBusinessDays(task.end, task.start)) } : task
            );
        }
        return { tasks: updatedTasks };
    });
    if (updateResult?.tasks) checkForWarnings(updateResult.tasks);
  }, [updateAndSaveProjectData, checkForWarnings]);

  const handleResizeTask = useCallback(async (taskId: number, newDates: { start: Date; end: Date }) => {
    const updateResult = await updateAndSaveProjectData(proj => ({
        tasks: proj.tasks.map(t => t.id === taskId ? { ...t, start: newDates.start, end: newDates.end } : t)
    }));
    if (updateResult?.tasks) checkForWarnings(updateResult.tasks);
  }, [updateAndSaveProjectData, checkForWarnings]);
  
  const confirmDeleteTask = useCallback(async () => {
    if (!currentProject || taskToDeleteId === null) return;
    const taskToDelete = currentProject.tasks.find(t => t.id === taskToDeleteId);
    if (!taskToDelete) return;

    const updateResult = await updateAndSaveProjectData(proj => {
      const remainingTasks = proj.tasks.filter(t => t.id !== taskToDeleteId);
      const newTasks = remainingTasks.map(t => t.predecessorId === taskToDeleteId ? { ...t, predecessorId: undefined } : t);
      const newGroups = proj.taskGroups
        .map(g => ({ ...g, taskIds: g.taskIds.filter(id => id !== taskToDeleteId) }))
        .filter(g => g.taskIds.length > 1);
      const dissolvedGroupIds = new Set(proj.taskGroups.filter(g => !newGroups.some(ng => ng.id === g.id)).map(g => g.id));
      const finalTasks = newTasks.map(t => dissolvedGroupIds.has(t.groupId || '') ? { ...t, groupId: undefined } : t);
      return { tasks: finalTasks, taskGroups: newGroups };
    });

    if (updateResult?.tasks) {
      checkForWarnings(updateResult.tasks);
      showNotification(`任務 "${taskToDelete.name}" 已刪除`, 'info');
    }
  }, [currentProject, taskToDeleteId, showNotification, checkForWarnings, updateAndSaveProjectData]);

  const handleDeleteTask = useCallback((taskId: number) => {
    setTaskToDeleteId(taskId);
    setIsConfirmModalOpen(true);
  }, []);

  const handleSelectTask = useCallback((taskId: number, isCtrlOrMetaKey: boolean) => {
    setSelectedTaskIds(prev => isCtrlOrMetaKey ? (prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]) : [taskId]);
  }, []);

  const handleCreateGroup = useCallback(async () => {
    if (!currentProject || selectedTaskIds.length < 2) return;
    const isDuplicate = selectedTaskIds.some(id => currentProject.tasks.find(t => t.id === id)?.groupId);
    if (isDuplicate) {
        showNotification('選取的任務中，有任務已被關聯，無法重複關聯。', 'error');
        return;
    }
    await updateAndSaveProjectData(proj => {
        const newGroupId = `group-${Date.now()}`;
        const colors = ['#f87171', '#fb923c', '#fbbf24', '#a3e635', '#4ade80', '#34d399', '#22d3ee', '#60a5fa', '#818cf8', '#c084fc'];
        const randomColor = colors[proj.taskGroups.length % colors.length];
        const newGroup: TaskGroup = { id: newGroupId, taskIds: selectedTaskIds, color: randomColor };
        return {
            tasks: proj.tasks.map(task => selectedTaskIds.includes(task.id) ? { ...task, groupId: newGroupId } : task),
            taskGroups: [...proj.taskGroups, newGroup]
        };
    });
    setSelectedTaskIds([]);
  }, [currentProject, selectedTaskIds, showNotification, updateAndSaveProjectData]);

  const handleSaveTask = useCallback(async (taskData: { id?: number; name: string; start: Date; end: Date; }) => {
    const updateResult = await updateAndSaveProjectData(proj => {
        let newTasks;
        if (taskData.id) {
            newTasks = proj.tasks.map(t => t.id === taskData.id ? { ...t, ...taskData } : t);
        } else {
            const newId = proj.tasks.length > 0 ? Math.max(...proj.tasks.map(t => t.id)) + 1 : 1;
            newTasks = [...proj.tasks, { id: newId, progress: 0, ...taskData }];
        }
        return { tasks: newTasks };
    });
    if (updateResult?.tasks) {
        checkForWarnings(updateResult.tasks);
        setIsTaskFormOpen(false);
    }
  }, [updateAndSaveProjectData, checkForWarnings]);

  const handleUngroupTask = useCallback(async (taskIdToUngroup: number) => {
    await updateAndSaveProjectData(proj => {
        const task = proj.tasks.find(t => t.id === taskIdToUngroup);
        if (!task || !task.groupId) return null;
        const groupId = task.groupId;
        const updatedGroups = proj.taskGroups.map(g => g.id === groupId ? { ...g, taskIds: g.taskIds.filter(id => id !== taskIdToUngroup) } : g);
        const shouldDissolve = updatedGroups.find(g => g.id === groupId)?.taskIds.length < 2;
        const finalGroups = shouldDissolve ? updatedGroups.filter(g => g.id !== groupId) : updatedGroups;
        const finalTasks = proj.tasks.map(t => (t.id === taskIdToUngroup || (shouldDissolve && t.groupId === groupId)) ? { ...t, groupId: undefined } : t);
        return { tasks: finalTasks, taskGroups: finalGroups };
    });
    setSelectedTaskIds(prev => prev.filter(id => id !== taskIdToUngroup));
  }, [updateAndSaveProjectData]);

  const openTaskFormWithDates = (start: Date, end: Date) => {
    setTaskToEdit(null);
    setNewTaskDefaultDates({ start, end });
    setIsTaskFormOpen(true);
  }
  
  const handleUpdateGroup = useCallback(async (groupId: string, updates: Partial<Pick<TaskGroup, 'name' | 'taskIds'>>) => {
      await updateAndSaveProjectData(proj => ({
          taskGroups: proj.taskGroups.map(g => g.id === groupId ? { ...g, ...updates } : g)
      }));
  }, [updateAndSaveProjectData]);

  const handleUpdateTaskInterval = useCallback(async (groupId: string, previousTaskId: number, taskToShiftId: number, newInterval: number) => {
    const updateResult = await updateAndSaveProjectData(proj => {
        const prevTask = proj.tasks.find(t => t.id === previousTaskId);
        const taskToShift = proj.tasks.find(t => t.id === taskToShiftId);
        if (!prevTask || !taskToShift) return null;
        const newStartDate = addDays(prevTask.end, newInterval);
        const delta = differenceInDays(newStartDate, taskToShift.start);
        if (delta === 0) return null;
        const group = proj.taskGroups.find(g => g.id === groupId);
        if (!group) return null;
        const groupTasks = group.taskIds.map(id => proj.tasks.find(t => t.id === id)!).filter(Boolean).sort((a,b) => a.start.getTime() - b.start.getTime());
        const startIndex = groupTasks.findIndex(t => t.id === taskToShiftId);
        const idsToShift = new Set(groupTasks.slice(startIndex).map(t => t.id));
        const newTasks = proj.tasks.map(t => idsToShift.has(t.id) ? { ...t, start: addDays(t.start, delta), end: addDays(t.end, delta) } : t);
        return { tasks: newTasks };
    });
    if (updateResult?.tasks) checkForWarnings(updateResult.tasks);
  }, [updateAndSaveProjectData, checkForWarnings]);

  const handleReorderGroupTasks = useCallback(async (groupId: string, newOrderedTaskIds: number[]) => {
      await handleUpdateGroup(groupId, { taskIds: newOrderedTaskIds });
      const updateResult = await updateAndSaveProjectData(proj => {
          const groupTasks = newOrderedTaskIds.map(id => proj.tasks.find(t => t.id === id)!);
          const taskUpdates = new Map<number, {start: Date, end: Date}>();
          let lastEndDate: Date | null = null;
          groupTasks.forEach((task, i) => {
              if (i === 0) {
                  lastEndDate = task.end;
                  return;
              }
              const newStart = addDays(lastEndDate!, 1);
              const newEnd = addDays(newStart, differenceInDays(task.end, task.start));
              taskUpdates.set(task.id, { start: newStart, end: newEnd });
              lastEndDate = newEnd;
          });
          return taskUpdates.size > 0 ? { tasks: proj.tasks.map(t => taskUpdates.has(t.id) ? { ...t, ...taskUpdates.get(t.id)! } : t) } : {};
      });
      if (updateResult?.tasks) checkForWarnings(updateResult.tasks);
  }, [handleUpdateGroup, checkForWarnings, updateAndSaveProjectData]);

  const handleDeleteGroup = useCallback(async (groupId: string) => {
    if (window.confirm('您確定要刪除這個關聯群組嗎？')) {
      await updateAndSaveProjectData(proj => ({
          taskGroups: proj.taskGroups.filter(g => g.id !== groupId),
          tasks: proj.tasks.map(t => t.groupId === groupId ? { ...t, groupId: undefined } : t)
      }));
      showNotification('群組已刪除', 'info');
    }
  }, [showNotification, updateAndSaveProjectData]);

  const handleSaveNewProject = async (name: string, startDate: Date, endDate: Date) => {
    const newProject: Project = { id: `proj-${Date.now()}`, name, startDate, endDate, tasks: [], taskGroups: [], executingUnits: [] };
    try {
        await db.saveProject(newProject);
        setProjects(prev => [...prev, newProject]);
        setCurrentProjectId(newProject.id);
        setIsProjectFormOpen(false);
        showNotification(`專案 "${name}" 已建立`, 'success');
    } catch (error) {
        console.error("建立新專案失敗:", error);
        showNotification("建立新專案失敗。", "error");
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (window.confirm('您確定要刪除這個專案嗎？此操作無法復原。')) {
      try {
        await db.deleteProject(projectId);
        setProjects(prev => {
            const remaining = prev.filter(p => p.id !== projectId);
            if (currentProjectId === projectId) {
                setCurrentProjectId(remaining.length > 0 ? remaining[0].id : null);
            }
            return remaining;
        });
        showNotification('專案已刪除', 'info');
      } catch(error) {
        console.error("刪除專案失敗:", error);
        showNotification("刪除專案失敗。", "error");
      }
    }
  };

  const handleExportProject = (projectId: string) => {
      const project = projects.find(p => p.id === projectId);
      if (project) {
          const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(JSON.stringify(project, null, 2));
          const linkElement = document.createElement('a');
          linkElement.setAttribute('href', dataUri);
          linkElement.setAttribute('download', `${project.name}.json`);
          linkElement.click();
      }
  };

  const handleSaveExecutingUnits = async (newUnits: ExecutingUnit[]) => {
      if (!currentProject) return;
      const deletedUnitIds = new Set(currentProject.executingUnits.filter(old => !newUnits.some(n => n.id === old.id)).map(u => u.id));
      await updateAndSaveProjectData(proj => ({
          executingUnits: newUnits,
          tasks: deletedUnitIds.size > 0 ? proj.tasks.map(t => deletedUnitIds.has(t.unitId || '') ? { ...t, unitId: undefined } : t) : proj.tasks,
      }));
      setIsExecutingUnitModalOpen(false);
      showNotification('執行單位已更新', 'success');
  };

  const handleBatchAssignUnit = async (unitId: string | null) => {
      if (!currentProject || selectedTaskIds.length === 0) return;
      await updateAndSaveProjectData(proj => ({
          tasks: proj.tasks.map(t => selectedTaskIds.includes(t.id) ? { ...t, unitId: unitId ?? undefined } : t)
      }));
      const unit = currentProject.executingUnits.find(u => u.id === unitId);
      const message = unitId === null ? '已取消指派' : `已指派給 "${unit?.name}"`;
      showNotification(`${selectedTaskIds.length} 個任務 ${message}`, 'success');
      setSelectedTaskIds([]);
  };

  const renderWorkspace = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center items-center h-96">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500"></div>
          <p className="ml-4 text-lg text-slate-600">正在從資料庫載入專案...</p>
        </div>
      );
    }
    if (!currentProject) return null;
    const { tasks, taskGroups, executingUnits } = currentProject;
    if (tasks.length === 0) {
      return (
        <div className="text-center py-20 bg-white rounded-lg shadow-md">
          <h2 className="text-2xl font-bold mb-4 text-slate-700">歡迎來到您的專案</h2>
          <p className="text-slate-500">點擊上方的「匯入」或「新增任務」按鈕來開始。</p>
        </div>
      );
    }
    // ... switch statement for views
    switch (viewMode) {
      case ViewMode.Gantt:
        return <GanttChartView tasks={tasks} warnings={warnings} onDragTask={handleDragTask} taskGroups={taskGroups} onEditTask={(t) => {setTaskToEdit(t); setIsTaskFormOpen(true);}} onResizeTask={handleResizeTask} onDeleteTask={handleDeleteTask} executingUnits={executingUnits}/>;
      case ViewMode.Calendar:
        return <CalendarView tasks={tasks} warnings={warnings} onDragTask={handleDragTask} selectedTaskIds={selectedTaskIds} onSelectTask={handleSelectTask} onCreateGroup={handleCreateGroup} onOpenAddTaskModal={() => {setTaskToEdit(null); setNewTaskDefaultDates(null); setIsTaskFormOpen(true);}} onOpenAddTaskForRange={openTaskFormWithDates} onUngroupTask={handleUngroupTask} taskGroups={taskGroups} onEditTask={(t) => {setTaskToEdit(t); setIsTaskFormOpen(true);}} onResizeTask={handleResizeTask} onDeleteTask={handleDeleteTask} executingUnits={executingUnits}/>;
      case ViewMode.Group:
        return <GroupRelationshipView tasks={tasks} taskGroups={taskGroups} onUpdateGroup={handleUpdateGroup} onUpdateTaskInterval={handleUpdateTaskInterval} onReorderTasks={handleReorderGroupTasks} onDeleteGroup={handleDeleteGroup} onUngroupTask={handleUngroupTask}/>;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen font-sans text-slate-800">
      {notification && <Notification message={notification.message} type={notification.type} onClose={() => setNotification(null)} />}
      <Header 
        project={currentProject}
        onFileImport={handleFileImport}
        onMdFileImport={handleMdFileImport}
        viewMode={viewMode}
        onSetViewMode={setViewMode}
        onBackToProjects={() => setCurrentProjectId(null)}
        onAddTask={() => {setTaskToEdit(null); setNewTaskDefaultDates(null); setIsTaskFormOpen(true);}}
        onOpenExecutingUnitModal={() => setIsExecutingUnitModalOpen(true)}
      />
      <main className="p-4 sm:p-6 lg:p-8">
        {isLoading && !currentProject ? (
           <div className="flex justify-center items-center h-96">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500"></div>
              <p className="ml-4 text-lg text-slate-600">正在連接資料庫...</p>
           </div>
        ) : currentProjectId ? (
            renderWorkspace()
        ) : (
            <ProjectListView 
                projects={projects}
                onSelectProject={setCurrentProjectId}
                onCreateProject={() => setIsProjectFormOpen(true)}
                onDeleteProject={handleDeleteProject}
                onExportProject={handleExportProject}
            />
        )}
      </main>
      {currentProject && warnings.length > 0 && (
        <div className="fixed bottom-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg shadow-lg max-w-sm z-50">
          <strong className="font-bold">排程警示!</strong>
          <ul className="mt-2 list-disc list-inside">{warnings.map(w => <li key={w.taskId}>{w.message}</li>)}</ul>
        </div>
      )}
      <TaskFormModal isOpen={isTaskFormOpen} onClose={() => {setIsTaskFormOpen(false); setTaskToEdit(null); setNewTaskDefaultDates(null);}} onSave={handleSaveTask} taskToEdit={taskToEdit} defaultDates={newTaskDefaultDates} />
      <ProjectFormModal isOpen={isProjectFormOpen} onClose={() => setIsProjectFormOpen(false)} onSave={handleSaveNewProject}/>
      <ConfirmationModal isOpen={isConfirmModalOpen} onClose={() => setIsConfirmModalOpen(false)} onConfirm={confirmDeleteTask} title="確認刪除任務"
          message={<>您確定要刪除任務 "<strong>{currentProject?.tasks.find(t => t.id === taskToDeleteId)?.name}</strong>" 嗎？<br/>此操作無法復原。</>}
      />
      {currentProject && (
        <ExecutingUnitModal isOpen={isExecutingUnitModalOpen} onClose={() => setIsExecutingUnitModalOpen(false)} units={currentProject.executingUnits} onSave={handleSaveExecutingUnits} />
      )}
      {currentProject && (
        <BatchTaskToolbar selectedTaskCount={selectedTaskIds.length} units={currentProject.executingUnits} onAssign={handleBatchAssignUnit} />
      )}
    </div>
  );
};

export default App;