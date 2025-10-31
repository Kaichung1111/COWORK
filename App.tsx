import React, { useState, useCallback, useEffect } from 'react';
import { Task, ViewMode, Warning, TaskGroup, Project } from './types';
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
// FIX: The 'startOfDay' function was not found in the main 'date-fns' export.
// It is now imported directly from its submodule to ensure it is resolved correctly.
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
  taskGroups: project.taskGroups || [], // Ensure taskGroups exists
});


const App: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Calendar);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  const [selectedTaskIds, setSelectedTaskIds] = useState<number[]>([]);
  
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [isProjectFormOpen, setIsProjectFormOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [notification, setNotification] = useState<NotificationState | null>(null);
  
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [taskToDeleteId, setTaskToDeleteId] = useState<number | null>(null);

  // Load projects from localStorage on initial render
  useEffect(() => {
    setIsLoading(true);
    try {
      const savedProjects = localStorage.getItem('ganttProjects');
      if (savedProjects) {
        const parsedProjects = JSON.parse(savedProjects).map(reviveDates);
        setProjects(parsedProjects);
      } else {
        // Create a sample project if no data exists
        const today = startOfDay(new Date());
        const sampleProject: Project = {
            id: `proj-${Date.now()}`,
            name: '範例專案',
            startDate: today,
            endDate: addDays(today, 60),
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
            taskGroups: []
        };
        setProjects([sampleProject]);
      }
    } catch (error) {
        console.error("無法從 localStorage 載入專案:", error);
        setProjects([]);
    } finally {
        setIsLoading(false);
    }
  }, []);

  // Save projects to localStorage whenever they change
  useEffect(() => {
    if (!isLoading) { // Avoid saving during initial load
        localStorage.setItem('ganttProjects', JSON.stringify(projects));
    }
  }, [projects, isLoading]);

  const currentProject = projects.find(p => p.id === currentProjectId);
  
  const showNotification = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    const timer = setTimeout(() => {
        setNotification(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, []);
  
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

  const updateCurrentProject = (updater: (project: Project) => Partial<Project>) => {
    setProjects(prevProjects =>
      prevProjects.map(p =>
        p.id === currentProjectId ? { ...p, ...updater(p) } : p
      )
    );
  };
  
  const handleFileImport = async (file: File) => {
    if (!currentProject) return;
    setIsLoading(true);
    try {
      const parsedTasks = await parseMppFile(file);
      updateCurrentProject(proj => ({ ...proj, tasks: parsedTasks, name: proj.name || file.name }));
      checkForWarnings(parsedTasks);
    } catch (error) {
      console.error("檔案解析失敗:", error);
      showNotification("無法解析此檔案。請確認格式是否正確。", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMdFileImport = async (files: FileList) => {
    if (!currentProject) return;
    setIsLoading(true);
    try {
      const parsedTasksData = await parseMdFiles(Array.from(files));

      if (parsedTasksData.length === 0) {
        showNotification("未找到可匯入的有效任務。", "info");
        return;
      }
      
      updateCurrentProject(proj => {
          const { tasks } = proj;
          let maxId = tasks.length > 0 ? Math.max(...tasks.map(t => t.id)) : 0;
          const newTasks: Task[] = parsedTasksData.map(data => ({
              ...data,
              id: ++maxId,
          }));
          
          const allTasks = [...tasks, ...newTasks];
          checkForWarnings(allTasks);
          return { tasks: allTasks };
      });

      showNotification(`${parsedTasksData.length} 個任務已成功匯入。`, 'success');
    } catch (error) {
      console.error("MD 檔案解析失敗:", error);
      showNotification("無法解析 Markdown 檔案。請確認格式是否正確。", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragTask = useCallback((taskId: number, newStartDate: Date) => {
    if (!currentProject) return;
    const { tasks, taskGroups } = currentProject;

    const taskToMove = tasks.find(t => t.id === taskId);
    if (!taskToMove) return;

    const deltaDays = differenceInDays(newStartDate, taskToMove.start);
    if (deltaDays === 0) return;

    let updatedTasks = [...tasks];
    if (taskToMove.groupId) {
        const group = taskGroups.find(g => g.id === taskToMove.groupId);
        if (group) {
            const groupTaskIds = new Set(group.taskIds);
            updatedTasks = updatedTasks.map(task => {
                if (groupTaskIds.has(task.id)) {
                    const duration = differenceInBusinessDays(task.end, task.start);
                    const newStart = addDays(task.start, deltaDays);
                    const newEnd = addDays(newStart, duration);
                    return { ...task, start: newStart, end: newEnd };
                }
                return task;
            });
        }
    } else {
        const duration = differenceInBusinessDays(taskToMove.end, taskToMove.start);
        const newEndDate = addDays(newStartDate, duration);
        updatedTasks = tasks.map(task =>
            task.id === taskId ? { ...task, start: newStartDate, end: newEndDate } : task
        );
    }
    
    checkForWarnings(updatedTasks);
    updateCurrentProject(() => ({ tasks: updatedTasks }));
  }, [currentProject, checkForWarnings]);

  const handleResizeTask = useCallback((taskId: number, newDates: { start: Date; end: Date }) => {
    if (!currentProject) return;
    updateCurrentProject(proj => {
      const newTasks = proj.tasks.map(t => t.id === taskId ? { ...t, start: newDates.start, end: newDates.end } : t);
      checkForWarnings(newTasks);
      return { tasks: newTasks };
    });
  }, [currentProject, checkForWarnings]);
  
  const confirmDeleteTask = useCallback(() => {
    if (!currentProject || taskToDeleteId === null) return;
    const taskToDelete = currentProject.tasks.find(t => t.id === taskToDeleteId);
    if (!taskToDelete) return;

    let finalTasks: Task[];
    let newGroups: TaskGroup[];

    // Calculate new state within a temporary scope
    {
      const proj = currentProject;
      const taskId = taskToDeleteId;
      const remainingTasks = proj.tasks.filter(t => t.id !== taskId);
      const newTasks = remainingTasks.map(t => 
        t.predecessorId === taskId ? { ...t, predecessorId: undefined } : t
      );
      newGroups = proj.taskGroups.map(g => ({
        ...g,
        taskIds: g.taskIds.filter(id => id !== taskId)
      })).filter(g => g.taskIds.length > 1);
      const dissolvedGroupIds = new Set(proj.taskGroups.filter(g => !newGroups.find(ng => ng.id === g.id)).map(g => g.id));
      finalTasks = newTasks.map(t => dissolvedGroupIds.has(t.groupId || '') ? { ...t, groupId: undefined } : t);
    }
    
    updateCurrentProject(() => ({
      tasks: finalTasks,
      taskGroups: newGroups
    }));

    checkForWarnings(finalTasks);
    showNotification(`任務 "${taskToDelete.name}" 已刪除`, 'info');

  }, [currentProject, taskToDeleteId, showNotification, checkForWarnings]);

  const handleDeleteTask = useCallback((taskId: number) => {
    setTaskToDeleteId(taskId);
    setIsConfirmModalOpen(true);
  }, []);

  const handleSelectTask = useCallback((taskId: number, isCtrlOrMetaKey: boolean) => {
    if (isCtrlOrMetaKey) {
        setSelectedTaskIds(prev => 
            prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
        );
    } else {
        setSelectedTaskIds([taskId]);
    }
  }, []);

  const handleCreateGroup = useCallback(() => {
    if (!currentProject || selectedTaskIds.length < 2) return;
    const { tasks, taskGroups } = currentProject;

    const isDuplicate = selectedTaskIds.some(id => {
        const task = tasks.find(t => t.id === id);
        return task && task.groupId;
    });

    if (isDuplicate) {
        showNotification('選取的任務中，有任務已被關聯，無法重複關聯。', 'error');
        return;
    }

    const newGroupId = `group-${Date.now()}`;
    const colors = ['#f87171', '#fb923c', '#fbbf24', '#a3e635', '#4ade80', '#34d399', '#22d3ee', '#60a5fa', '#818cf8', '#c084fc'];
    const randomColor = colors[taskGroups.length % colors.length];

    const newGroup: TaskGroup = { id: newGroupId, taskIds: selectedTaskIds, color: randomColor };
    const newGroups = [...taskGroups, newGroup];
    const newTasks = tasks.map(task => 
        selectedTaskIds.includes(task.id) ? { ...task, groupId: newGroupId } : task
    );

    updateCurrentProject(() => ({ tasks: newTasks, taskGroups: newGroups }));
    setSelectedTaskIds([]);
  }, [currentProject, selectedTaskIds, showNotification]);

  const handleSaveTask = useCallback((taskData: { id?: number; name: string; start: Date; end: Date; }) => {
    if (!currentProject) return;
    
    updateCurrentProject(proj => {
        const { tasks } = proj;
        let newTasks;
        if (taskData.id) { // Update
            newTasks = tasks.map(task =>
                task.id === taskData.id
                    ? { ...task, name: taskData.name, start: taskData.start, end: taskData.end }
                    : task
            );
        } else { // Create
            const newId = tasks.length > 0 ? Math.max(...tasks.map(t => t.id)) + 1 : 1;
            const newTask: Task = {
                id: newId,
                name: taskData.name,
                start: taskData.start,
                end: taskData.end,
                progress: 0,
            };
            newTasks = [...tasks, newTask];
        }
        checkForWarnings(newTasks);
        return { tasks: newTasks };
    });
    setIsTaskFormOpen(false);
  }, [currentProject, checkForWarnings]);

  const handleUngroupTask = useCallback((taskIdToUngroup: number) => {
    if (!currentProject) return;
    updateCurrentProject(proj => {
        const { tasks, taskGroups } = proj;
        const taskToUngroup = tasks.find(t => t.id === taskIdToUngroup);
        if (!taskToUngroup || !taskToUngroup.groupId) return {};

        const groupId = taskToUngroup.groupId;
        const updatedGroups = taskGroups.map(group => 
            group.id === groupId 
            ? { ...group, taskIds: group.taskIds.filter(id => id !== taskIdToUngroup) } 
            : group
        );

        const targetGroup = updatedGroups.find(g => g.id === groupId);
        const shouldDissolveGroup = targetGroup && targetGroup.taskIds.length < 2;

        const finalGroups = shouldDissolveGroup ? updatedGroups.filter(g => g.id !== groupId) : updatedGroups;
        const finalTasks = tasks.map(task => {
            if (task.id === taskIdToUngroup || (shouldDissolveGroup && task.groupId === groupId)) {
                return { ...task, groupId: undefined };
            }
            return task;
        });

        setSelectedTaskIds(prev => prev.filter(id => id !== taskIdToUngroup));
        return { tasks: finalTasks, taskGroups: finalGroups };
    });
  }, [currentProject]);

  const openTaskFormForCreate = () => { setTaskToEdit(null); setIsTaskFormOpen(true); };
  const openTaskFormForEdit = (task: Task) => { setTaskToEdit(task); setIsTaskFormOpen(true); };
  
  const handleUpdateGroup = useCallback((groupId: string, updates: Partial<Pick<TaskGroup, 'name' | 'taskIds'>>) => {
      updateCurrentProject(proj => ({
          taskGroups: proj.taskGroups.map(g => g.id === groupId ? { ...g, ...updates } : g)
      }));
  }, [currentProjectId]);

  const handleUpdateTaskInterval = useCallback((groupId: string, previousTaskId: number, taskToShiftId: number, newInterval: number) => {
    if (!currentProject) return;
    updateCurrentProject(proj => {
        const { tasks, taskGroups } = proj;
        const previousTask = tasks.find(t => t.id === previousTaskId);
        const taskToShift = tasks.find(t => t.id === taskToShiftId);
        if (!previousTask || !taskToShift) return {};

        const newStartDate = addDays(previousTask.end, newInterval);
        const delta = differenceInDays(newStartDate, taskToShift.start);
        if (delta === 0) return {};

        const group = taskGroups.find(g => g.id === groupId);
        if (!group) return {};

        const groupTasks = group.taskIds
            .map(id => tasks.find(t => t.id === id)!)
            .filter(Boolean)
            .sort((a, b) => a.start.getTime() - b.start.getTime());
        
        const startIndex = groupTasks.findIndex(t => t.id === taskToShiftId);
        const idsToShift = new Set(groupTasks.slice(startIndex).map(t => t.id));

        const newTasks = tasks.map(task => {
            if (idsToShift.has(task.id)) {
                const duration = differenceInDays(task.end, task.start);
                const newStart = addDays(task.start, delta);
                const newEnd = addDays(newStart, duration);
                return { ...task, start: newStart, end: newEnd };
            }
            return task;
        });
        
        checkForWarnings(newTasks);
        return { tasks: newTasks };
    });
  }, [currentProject, checkForWarnings]);

  const handleReorderGroupTasks = useCallback((groupId: string, newOrderedTaskIds: number[]) => {
      handleUpdateGroup(groupId, { taskIds: newOrderedTaskIds });

      updateCurrentProject(proj => {
          const { tasks } = proj;
          const groupTasks = newOrderedTaskIds.map(id => tasks.find(t => t.id === id)!);
          const durationMap = new Map(groupTasks.map(t => [t.id, differenceInDays(t.end, t.start)]));

          const taskUpdates = new Map<number, {start: Date, end: Date}>();
          let lastEndDate: Date | null = groupTasks.length > 0 ? groupTasks[0].end : null;
          
          if (groupTasks.length > 0) {
            taskUpdates.set(groupTasks[0].id, { start: groupTasks[0].start, end: groupTasks[0].end });
          }

          for (let i = 1; i < groupTasks.length; i++) {
              const task = groupTasks[i];
              if (!lastEndDate) continue;
              const newStart = addDays(lastEndDate, 1); // Default 1 day interval
              const duration = durationMap.get(task.id)!;
              const newEnd = addDays(newStart, duration);
              taskUpdates.set(task.id, { start: newStart, end: newEnd });
              lastEndDate = newEnd;
          }

          if (taskUpdates.size > 0) {
              const newTasks = tasks.map(t => taskUpdates.has(t.id) ? { ...t, ...taskUpdates.get(t.id) } : t);
              checkForWarnings(newTasks);
              return { tasks: newTasks };
          }
          return {};
      });
  }, [handleUpdateGroup, checkForWarnings, currentProjectId]);

  const handleDeleteGroup = useCallback((groupId: string) => {
    if (window.confirm('您確定要刪除這個關聯群組嗎？群組內的任務將會保留，但其關聯性會被移除。')) {
      updateCurrentProject(proj => ({
          taskGroups: proj.taskGroups.filter(g => g.id !== groupId),
          tasks: proj.tasks.map(t => t.groupId === groupId ? { ...t, groupId: undefined } : t)
      }));
      showNotification('群組已刪除', 'info');
    }
  }, [currentProjectId, showNotification]);

  // Project Management Handlers
  const handleSelectProject = (projectId: string) => setCurrentProjectId(projectId);
  const handleBackToProjects = () => setCurrentProjectId(null);

  const handleSaveNewProject = (name: string, startDate: Date, endDate: Date) => {
      const newProject: Project = {
          id: `proj-${Date.now()}`,
          name,
          startDate,
          endDate,
          tasks: [],
          taskGroups: [],
      };
      setProjects(prev => [...prev, newProject]);
      setIsProjectFormOpen(false);
      showNotification(`專案 "${name}" 已建立`, 'success');
  };

  const handleDeleteProject = (projectId: string) => {
      if (window.confirm('您確定要刪除這個專案嗎？此操作無法復原。')) {
          setProjects(prev => prev.filter(p => p.id !== projectId));
          showNotification('專案已刪除', 'info');
      }
  };

  const handleExportProject = (projectId: string) => {
      const projectToExport = projects.find(p => p.id === projectId);
      if (projectToExport) {
          const dataStr = JSON.stringify(projectToExport, null, 2);
          const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
          const exportFileDefaultName = `${projectToExport.name}.json`;
          const linkElement = document.createElement('a');
          linkElement.setAttribute('href', dataUri);
          linkElement.setAttribute('download', exportFileDefaultName);
          linkElement.click();
      }
  };

  const renderWorkspace = () => {
    if (!currentProject) return null;
    const { tasks, taskGroups } = currentProject;

    if (isLoading) {
      return (
        <div className="flex justify-center items-center h-96">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500"></div>
          <p className="ml-4 text-lg text-slate-600">正在載入專案資料...</p>
        </div>
      );
    }
    if (tasks.length === 0) {
      return (
        <div className="text-center py-20 bg-white rounded-lg shadow-md">
          <h2 className="text-2xl font-bold mb-4 text-slate-700">歡迎來到您的新專案</h2>
          <p className="text-slate-500">點擊上方的「匯入 MPP 檔案」或「新增任務」按鈕來開始。</p>
        </div>
      );
    }
    switch (viewMode) {
      case ViewMode.Gantt:
        return <GanttChartView tasks={tasks} warnings={warnings} onDragTask={handleDragTask} taskGroups={taskGroups} onEditTask={openTaskFormForEdit} onResizeTask={handleResizeTask} onDeleteTask={handleDeleteTask}/>;
      case ViewMode.Calendar:
        return <CalendarView tasks={tasks} warnings={warnings} onDragTask={handleDragTask} selectedTaskIds={selectedTaskIds} onSelectTask={handleSelectTask} onCreateGroup={handleCreateGroup} onOpenAddTaskModal={openTaskFormForCreate} onUngroupTask={handleUngroupTask} taskGroups={taskGroups} onEditTask={openTaskFormForEdit} onResizeTask={handleResizeTask} onDeleteTask={handleDeleteTask}/>;
      case ViewMode.Group:
        return <GroupRelationshipView 
                    tasks={tasks} 
                    taskGroups={taskGroups}
                    onUpdateGroup={handleUpdateGroup}
                    onUpdateTaskInterval={handleUpdateTaskInterval}
                    onReorderTasks={handleReorderGroupTasks}
                    onDeleteGroup={handleDeleteGroup}
                    onUngroupTask={handleUngroupTask}
                />;
      default:
        return null;
    }
  };

  const taskNameForModal = currentProject?.tasks.find(t => t.id === taskToDeleteId)?.name;

  return (
    <div className="min-h-screen font-sans text-slate-800">
      {notification && <Notification message={notification.message} type={notification.type} onClose={() => setNotification(null)} />}
      <Header 
        project={currentProject}
        onFileImport={handleFileImport}
        onMdFileImport={handleMdFileImport}
        viewMode={viewMode}
        onSetViewMode={setViewMode}
        onBackToProjects={handleBackToProjects}
        onAddTask={openTaskFormForCreate}
      />
      <main className="p-4 sm:p-6 lg:p-8">
        {currentProjectId ? (
            renderWorkspace()
        ) : (
            <ProjectListView 
                projects={projects}
                onSelectProject={handleSelectProject}
                onCreateProject={() => setIsProjectFormOpen(true)}
                onDeleteProject={handleDeleteProject}
                onExportProject={handleExportProject}
            />
        )}
      </main>
       {currentProject && warnings.length > 0 && (
          <div className="fixed bottom-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg shadow-lg max-w-sm z-50">
            <strong className="font-bold">排程警示!</strong>
            <ul className="mt-2 list-disc list-inside">
              {warnings.map(w => <li key={w.taskId}>{w.message}</li>)}
            </ul>
          </div>
        )}
        <TaskFormModal 
            isOpen={isTaskFormOpen}
            onClose={() => setIsTaskFormOpen(false)}
            onSave={handleSaveTask}
            taskToEdit={taskToEdit}
        />
        <ProjectFormModal
            isOpen={isProjectFormOpen}
            onClose={() => setIsProjectFormOpen(false)}
            onSave={handleSaveNewProject}
        />
        <ConfirmationModal
            isOpen={isConfirmModalOpen}
            onClose={() => {
                setIsConfirmModalOpen(false);
                setTaskToDeleteId(null);
            }}
            onConfirm={confirmDeleteTask}
            title="確認刪除任務"
            message={
                <>
                您確定要刪除任務 "<strong>{taskNameForModal}</strong>" 嗎？
                <br />
                此操作無法復原。
                </>
            }
        />
    </div>
  );
};

export default App;