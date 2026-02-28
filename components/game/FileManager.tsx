'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  X, FolderGit2, Folder, FolderOpen, File, FileCode, FileText,
  FileImage, ChevronRight, ChevronDown, Plus, FolderPlus, FilePlus,
  Trash2, Upload, RefreshCw, Home, Loader2, AlertTriangle,
  MoreVertical, Edit3, Check, XCircle, FileJson, FileType,
  Image, Music, Video, Archive, Database, Settings, Code,
} from 'lucide-react';

interface FileEntry {
  name: string;
  relativePath: string;
  isDirectory: boolean;
  size: number;
  modified: number;
  extension: string | null;
}

interface FileManagerProps {
  workspaceId: string;
  workspaceName: string;
  workspacePath: string;
  workspaceColor: string;
  onClose: () => void;
  isMobile?: boolean;
}

// Get icon for file extension
function getFileIcon(ext: string | null, isDirectory: boolean) {
  if (isDirectory) return null; // handled separately
  switch (ext) {
    case '.ts': case '.tsx': case '.js': case '.jsx':
      return <FileCode size={14} className="text-yellow-400" />;
    case '.json':
      return <FileJson size={14} className="text-yellow-300" />;
    case '.html': case '.htm':
      return <FileCode size={14} className="text-orange-400" />;
    case '.css': case '.scss': case '.less':
      return <FileCode size={14} className="text-blue-400" />;
    case '.py':
      return <FileCode size={14} className="text-green-400" />;
    case '.rs': case '.go': case '.java': case '.c': case '.cpp': case '.h':
      return <Code size={14} className="text-cyan-400" />;
    case '.md': case '.txt': case '.log':
      return <FileText size={14} className="text-slate-400" />;
    case '.png': case '.jpg': case '.jpeg': case '.gif': case '.svg': case '.webp': case '.ico':
      return <Image size={14} className="text-pink-400" />;
    case '.mp3': case '.wav': case '.ogg':
      return <Music size={14} className="text-purple-400" />;
    case '.mp4': case '.webm': case '.mov':
      return <Video size={14} className="text-red-400" />;
    case '.zip': case '.tar': case '.gz': case '.rar':
      return <Archive size={14} className="text-amber-400" />;
    case '.db': case '.sqlite': case '.sql':
      return <Database size={14} className="text-emerald-400" />;
    case '.yml': case '.yaml': case '.toml': case '.ini': case '.env':
      return <Settings size={14} className="text-slate-400" />;
    case '.prisma':
      return <Database size={14} className="text-indigo-400" />;
    default:
      return <File size={14} className="text-slate-500" />;
  }
}

// Format file size
function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// TreeNode component for recursive file tree
function TreeNode({
  entry,
  workspaceId,
  depth,
  onRefresh,
  onDelete,
  onFileSelect,
  selectedFile,
}: {
  entry: FileEntry;
  workspaceId: string;
  depth: number;
  onRefresh: () => void;
  onDelete: (path: string, name: string, isDir: boolean) => void;
  onFileSelect: (entry: FileEntry) => void;
  selectedFile: string | null;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [children, setChildren] = useState<FileEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showActions, setShowActions] = useState(false);

  const loadChildren = useCallback(async () => {
    if (!entry.isDirectory) return;
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/files?path=${encodeURIComponent(entry.relativePath)}`
      );
      if (res.ok) {
        const data = await res.json();
        setChildren(data.files || []);
      }
    } catch (err) {
      console.error('Failed to load directory:', err);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, entry.relativePath, entry.isDirectory]);

  const handleToggle = async () => {
    if (!entry.isDirectory) {
      onFileSelect(entry);
      return;
    }
    if (!isOpen) {
      await loadChildren();
    }
    setIsOpen(!isOpen);
  };

  const isSelected = selectedFile === entry.relativePath;

  return (
    <div>
      <div
        className={`group flex items-center gap-1 py-1 px-2 cursor-pointer rounded-md transition-colors ${
          isSelected
            ? 'bg-indigo-500/20 text-white'
            : 'hover:bg-slate-700/50 text-slate-300'
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleToggle}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >
        {/* Expand/collapse arrow for directories */}
        {entry.isDirectory ? (
          <span className="w-4 h-4 flex items-center justify-center shrink-0">
            {isLoading ? (
              <Loader2 size={12} className="animate-spin text-slate-500" />
            ) : isOpen ? (
              <ChevronDown size={12} className="text-slate-500" />
            ) : (
              <ChevronRight size={12} className="text-slate-500" />
            )}
          </span>
        ) : (
          <span className="w-4 h-4 shrink-0" />
        )}

        {/* Icon */}
        <span className="shrink-0">
          {entry.isDirectory ? (
            isOpen ? (
              <FolderOpen size={14} className="text-amber-400" />
            ) : (
              <Folder size={14} className="text-amber-400" />
            )
          ) : (
            getFileIcon(entry.extension, false)
          )}
        </span>

        {/* Name */}
        <span className="flex-1 truncate text-xs font-mono">
          {entry.name}
        </span>

        {/* Size for files */}
        {!entry.isDirectory && (
          <span className="text-[10px] text-slate-600 shrink-0 mr-1">
            {formatSize(entry.size)}
          </span>
        )}

        {/* Delete action */}
        {showActions && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(entry.relativePath, entry.name, entry.isDirectory);
            }}
            className="p-0.5 hover:bg-red-500/20 rounded text-slate-500 hover:text-red-400 transition-colors shrink-0"
            title="Delete"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>

      {/* Children */}
      {isOpen && entry.isDirectory && (
        <div>
          {children.length === 0 && !isLoading && (
            <div
              className="text-[10px] text-slate-600 italic py-1"
              style={{ paddingLeft: `${(depth + 1) * 16 + 28}px` }}
            >
              Empty folder
            </div>
          )}
          {children.map((child) => (
            <TreeNode
              key={child.relativePath}
              entry={child}
              workspaceId={workspaceId}
              depth={depth + 1}
              onRefresh={onRefresh}
              onDelete={onDelete}
              onFileSelect={onFileSelect}
              selectedFile={selectedFile}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FileManager({
  workspaceId,
  workspaceName,
  workspacePath,
  workspaceColor,
  onClose,
  isMobile,
}: FileManagerProps) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [isLoadingContent, setIsLoadingContent] = useState(false);

  // Create file/folder state
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [createMode, setCreateMode] = useState<'file' | 'folder' | null>(null);
  const [createName, setCreateName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<{
    path: string;
    name: string;
    isDir: boolean;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch root files
  const fetchFiles = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/files?path=.`);
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files || []);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to load files');
      }
    } catch {
      setError('Network error');
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // Load file content
  const handleFileSelect = async (entry: FileEntry) => {
    if (entry.isDirectory) return;
    setSelectedFile(entry.relativePath);
    setIsLoadingContent(true);
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/files?path=${encodeURIComponent(entry.relativePath)}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.isBinary) {
          setFileContent('[Binary file - cannot display]');
        } else {
          setFileContent(data.content || '');
        }
      }
    } catch {
      setFileContent('[Error loading file]');
    } finally {
      setIsLoadingContent(false);
    }
  };

  // Create file or folder
  const handleCreate = async () => {
    if (!createName.trim() || !createMode) return;
    setIsCreating(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: createMode === 'file' ? 'createFile' : 'createFolder',
          name: createName.trim(),
          content: '',
        }),
      });
      if (res.ok) {
        setCreateMode(null);
        setCreateName('');
        await fetchFiles();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to create');
      }
    } catch {
      setError('Network error');
    } finally {
      setIsCreating(false);
    }
  };

  // Upload file
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadFiles = e.target.files;
    if (!uploadFiles || uploadFiles.length === 0) return;

    setIsUploading(true);
    let uploaded = 0;

    for (let i = 0; i < uploadFiles.length; i++) {
      const file = uploadFiles[i];
      setUploadProgress(`Uploading ${file.name} (${i + 1}/${uploadFiles.length})...`);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('path', '.');

      try {
        const res = await fetch(`/api/workspaces/${workspaceId}/files`, {
          method: 'POST',
          body: formData,
        });
        if (res.ok) {
          uploaded++;
        }
      } catch {
        // continue with next file
      }
    }

    setUploadProgress(null);
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    await fetchFiles();
  };

  // Delete file/folder
  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setIsDeleting(true);
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/files?path=${encodeURIComponent(deleteConfirm.path)}`,
        { method: 'DELETE' }
      );
      if (res.ok) {
        setDeleteConfirm(null);
        // Clear selection if deleted file was selected
        if (selectedFile === deleteConfirm.path) {
          setSelectedFile(null);
          setFileContent(null);
        }
        await fetchFiles();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to delete');
      }
    } catch {
      setError('Network error');
    } finally {
      setIsDeleting(false);
    }
  };

  const requestDelete = (filePath: string, name: string, isDir: boolean) => {
    setDeleteConfirm({ path: filePath, name, isDir });
  };

  return (
    <div className={`bg-slate-800/95 backdrop-blur-xl shadow-2xl border border-slate-600/40 flex flex-col overflow-hidden ${
      isMobile 
        ? 'w-full h-full rounded-none border-0' 
        : 'rounded-2xl w-[480px] h-[600px]'
    }`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700/50 bg-slate-800/50 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg"
            style={{
              backgroundColor: `${workspaceColor}20`,
              border: `2px solid ${workspaceColor}40`,
            }}
          >
            <FolderGit2 size={18} style={{ color: workspaceColor }} />
          </div>
          <div>
            <h3 className="font-bold text-sm text-white">{workspaceName}</h3>
            <p className="text-[10px] text-slate-500 truncate max-w-[280px] font-mono">
              {workspacePath}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Toolbar */}
      <div className="px-3 py-2 border-b border-slate-700/30 flex items-center gap-1.5 shrink-0">
        <button
          onClick={fetchFiles}
          disabled={isLoading}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
          title="Refresh"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
        </button>

        <div className="w-px h-5 bg-slate-700/50 mx-1" />

        {/* Create file */}
        <button
          onClick={() => {
            setCreateMode('file');
            setCreateName('');
            setShowCreateMenu(false);
          }}
          className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
          title="New File"
        >
          <FilePlus size={14} />
        </button>

        {/* Create folder */}
        <button
          onClick={() => {
            setCreateMode('folder');
            setCreateName('');
            setShowCreateMenu(false);
          }}
          className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
          title="New Folder"
        >
          <FolderPlus size={14} />
        </button>

        <div className="w-px h-5 bg-slate-700/50 mx-1" />

        {/* Upload */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="flex items-center gap-1.5 px-2 py-1 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors text-xs"
          title="Upload Files"
        >
          <Upload size={14} />
          <span>Upload</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleUpload}
          className="hidden"
        />

        {/* Upload progress */}
        {uploadProgress && (
          <span className="text-[10px] text-blue-400 flex items-center gap-1 ml-auto">
            <Loader2 size={10} className="animate-spin" />
            {uploadProgress}
          </span>
        )}
      </div>

      {/* Create file/folder inline form */}
      {createMode && (
        <div className="px-3 py-2 border-b border-slate-700/30 bg-slate-700/20 flex items-center gap-2 shrink-0">
          {createMode === 'file' ? (
            <FilePlus size={14} className="text-emerald-400 shrink-0" />
          ) : (
            <FolderPlus size={14} className="text-amber-400 shrink-0" />
          )}
          <input
            type="text"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
              if (e.key === 'Escape') {
                setCreateMode(null);
                setCreateName('');
              }
            }}
            placeholder={createMode === 'file' ? 'filename.ext' : 'folder-name'}
            className="flex-1 px-2 py-1 bg-slate-800/80 text-white text-xs rounded border border-slate-600/50 focus:outline-none focus:border-indigo-500 font-mono placeholder:text-slate-600"
            autoFocus
          />
          <button
            onClick={handleCreate}
            disabled={!createName.trim() || isCreating}
            className="p-1 text-emerald-400 hover:bg-emerald-500/20 rounded transition-colors disabled:opacity-30"
          >
            {isCreating ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          </button>
          <button
            onClick={() => {
              setCreateMode(null);
              setCreateName('');
            }}
            className="p-1 text-slate-500 hover:text-slate-300 hover:bg-slate-700/50 rounded transition-colors"
          >
            <XCircle size={14} />
          </button>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="px-3 py-2 border-b border-red-500/30 bg-red-500/10 flex items-center gap-2 shrink-0">
          <AlertTriangle size={14} className="text-red-400 shrink-0" />
          <span className="text-xs text-red-300 flex-1">
            Delete <span className="font-mono font-bold">{deleteConfirm.name}</span>
            {deleteConfirm.isDir ? ' and all contents' : ''}?
          </span>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white text-xs rounded-lg transition-colors flex items-center gap-1"
          >
            {isDeleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            Delete
          </button>
          <button
            onClick={() => setDeleteConfirm(null)}
            className="px-2 py-1 bg-slate-600 hover:bg-slate-500 text-white text-xs rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Tree view */}
        <div className={`${selectedFile ? (isMobile ? 'w-[140px]' : 'w-[200px]') : 'flex-1'} ${selectedFile ? 'border-r border-slate-700/30' : ''} overflow-y-auto custom-scrollbar py-1`}>
          {/* Error */}
          {error && (
            <div className="px-3 py-2 text-xs text-red-400 flex items-center gap-2">
              <AlertTriangle size={12} />
              {error}
              <button onClick={() => setError(null)} className="ml-auto text-slate-500 hover:text-slate-300">
                <XCircle size={12} />
              </button>
            </div>
          )}

          {/* Loading */}
          {isLoading && files.length === 0 && (
            <div className="flex items-center justify-center h-32">
              <Loader2 size={20} className="animate-spin text-slate-500" />
            </div>
          )}

          {/* Empty */}
          {!isLoading && files.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center h-32 text-center px-6">
              <Folder size={24} className="text-slate-600 mb-2" />
              <p className="text-xs text-slate-500">Empty workspace</p>
              <p className="text-[10px] text-slate-600 mt-1">
                Create a file or upload one to get started
              </p>
            </div>
          )}

          {/* File tree */}
          {files.map((entry) => (
            <TreeNode
              key={entry.relativePath}
              entry={entry}
              workspaceId={workspaceId}
              depth={0}
              onRefresh={fetchFiles}
              onDelete={requestDelete}
              onFileSelect={handleFileSelect}
              selectedFile={selectedFile}
            />
          ))}
        </div>

        {/* File preview panel */}
        {selectedFile && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* File info header */}
            <div className="px-3 py-2 border-b border-slate-700/30 flex items-center gap-2 shrink-0 bg-slate-800/30">
              {getFileIcon(
                selectedFile.includes('.') ? '.' + selectedFile.split('.').pop() : null,
                false
              )}
              <span className="text-xs text-white font-mono truncate flex-1">
                {selectedFile}
              </span>
              <button
                onClick={() => {
                  setSelectedFile(null);
                  setFileContent(null);
                }}
                className="p-1 text-slate-500 hover:text-slate-300 rounded transition-colors"
              >
                <X size={12} />
              </button>
            </div>

            {/* File content */}
            <div className="flex-1 overflow-auto custom-scrollbar p-3">
              {isLoadingContent ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 size={16} className="animate-spin text-slate-500" />
                </div>
              ) : (
                <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap break-all leading-relaxed">
                  {fileContent || ''}
                </pre>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="px-3 py-1.5 border-t border-slate-700/30 bg-slate-800/30 flex items-center justify-between shrink-0">
        <span className="text-[10px] text-slate-600">
          {files.length} items in root
        </span>
        {selectedFile && (
          <span className="text-[10px] text-slate-500 font-mono truncate max-w-[250px]">
            {selectedFile}
          </span>
        )}
      </div>
    </div>
  );
}
