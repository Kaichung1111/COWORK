import React, { useRef } from 'react';
import { ViewMode, Project } from '../types';

interface HeaderProps {
  project: Project | null | undefined;
  onFileImport: (file: File) => void;
  onMdFileImport: (files: FileList) => void;
  viewMode: ViewMode;
  onSetViewMode: (mode: ViewMode) => void;
  onBackToProjects: () => void;
  onAddTask: () => void;
  onOpenExecutingUnitModal: () => void;
}

const BackIcon: React.FC = () => (
    <svg xmlns="http://www.w.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z" />
    </svg>
);

const FileImportIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
);

const MdImportIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
);

const AddIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const UnitIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
);


const GanttIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18M3 6h18"/></svg>
);

const CalendarIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
);

const GroupIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" /></svg>
);

const Header: React.FC<HeaderProps> = ({ project, onFileImport, onMdFileImport, viewMode, onSetViewMode, onBackToProjects, onAddTask, onOpenExecutingUnitModal }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mdFileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileImport(file);
    }
     if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleMdFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      onMdFileImport(files);
    }
    if (mdFileInputRef.current) {
      mdFileInputRef.current.value = '';
    }
  };

  const handleImportClick = () => fileInputRef.current?.click();
  const handleMdImportClick = () => mdFileInputRef.current?.click();

  return (
    <header className="bg-white shadow-md sticky top-0 z-40">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-4">
            {project ? (
               <>
                <button onClick={onBackToProjects} className="flex items-center text-slate-500 hover:text-blue-600 transition duration-300 p-2 -ml-2 rounded-full">
                    <BackIcon />
                </button>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-800 truncate">{project.name}</h1>
                <div className="hidden md:flex items-center space-x-2 bg-slate-100 px-3 py-1 rounded-full">
                    <span className="text-xs bg-slate-200 text-slate-600 font-semibold px-2 py-0.5 rounded-full">{project.tasks.length} 項任務</span>
                </div>
               </>
            ) : (
                <h1 className="text-xl sm:text-2xl font-bold text-blue-600">專案管理</h1>
            )}
          </div>
          {project && (
            <div className="flex items-center space-x-2 sm:space-x-4">
                <button onClick={onOpenExecutingUnitModal} className="flex items-center bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 px-4 rounded-lg transition duration-300">
                    <UnitIcon />
                    <span className="hidden sm:inline">管理單位</span>
                </button>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".mpp" />
                <button onClick={handleImportClick} className="flex items-center bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 px-4 rounded-lg transition duration-300">
                    <FileImportIcon />
                    <span className="hidden sm:inline">匯入 MPP</span>
                </button>
                <input type="file" ref={mdFileInputRef} onChange={handleMdFileChange} className="hidden" accept=".md,.markdown,.txt" multiple />
                <button onClick={handleMdImportClick} className="flex items-center bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 px-4 rounded-lg transition duration-300">
                    <MdImportIcon />
                    <span className="hidden sm:inline">匯入 MD</span>
                </button>
                 <button onClick={onAddTask} className="flex items-center bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition duration-300">
                    <AddIcon />
                    <span className="hidden sm:inline">新增任務</span>
                </button>

                <div className="bg-slate-200 p-1 rounded-lg flex space-x-1">
                    <button onClick={() => onSetViewMode(ViewMode.Gantt)} className={`flex items-center px-3 py-1 rounded-md text-sm font-semibold transition ${viewMode === ViewMode.Gantt ? 'bg-white text-blue-600 shadow' : 'bg-transparent text-slate-600'}`}>
                        <GanttIcon />甘特圖
                    </button>
                    <button onClick={() => onSetViewMode(ViewMode.Calendar)} className={`flex items-center px-3 py-1 rounded-md text-sm font-semibold transition ${viewMode === ViewMode.Calendar ? 'bg-white text-blue-600 shadow' : 'bg-transparent text-slate-600'}`}>
                        <CalendarIcon />月曆
                    </button>
                    <button onClick={() => onSetViewMode(ViewMode.Group)} className={`flex items-center px-3 py-1 rounded-md text-sm font-semibold transition ${viewMode === ViewMode.Group ? 'bg-white text-blue-600 shadow' : 'bg-transparent text-slate-600'}`}>
                        <GroupIcon />群組檢視
                    </button>
                </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;