"use client";

import React, { useState } from "react";
import {
  FileCode2,
  FileText,
  FileJson,
  FileImage,
  FolderClosed,
  FolderOpen,
  ChevronRight,
  Package,
  Settings,
  Folder,
} from "lucide-react";

export interface FileTreeFile {
  path: string;
  content: string;
}

interface Props {
  files: FileTreeFile[];
  selectedFile: string;
  onSelectFile: (path: string) => void;
  projectName?: string;
}

function fileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  const size = 14;
  switch (ext) {
    case "html":
    case "htm":
      return <FileCode2 size={size} className="text-orange-500 shrink-0" />;
    case "css":
      return <FileCode2 size={size} className="text-blue-500 shrink-0" />;
    case "js":
    case "jsx":
      return <FileCode2 size={size} className="text-yellow-500 shrink-0" />;
    case "ts":
    case "tsx":
      return <FileCode2 size={size} className="text-sky-500 shrink-0" />;
    case "json":
      return <FileJson size={size} className="text-neutral-400 shrink-0" />;
    case "md":
      return <FileText size={size} className="text-blue-400 shrink-0" />;
    case "svg":
    case "png":
    case "jpg":
    case "gif":
      return <FileImage size={size} className="text-purple-400 shrink-0" />;
    case "vue":
      return <FileCode2 size={size} className="text-emerald-500 shrink-0" />;
    case "py":
      return <FileCode2 size={size} className="text-amber-500 shrink-0" />;
    case "lock":
      return <Settings size={size} className="text-neutral-400 shrink-0" />;
    default:
      if (name === "package.json") return <Package size={size} className="text-red-500 shrink-0" />;
      return <FileText size={size} className="text-neutral-400 shrink-0" />;
  }
}

interface TreeNode {
  name: string;
  path: string | null;
  children: TreeNode[];
  isExpanded: boolean;
}

function buildTree(files: FileTreeFile[]): TreeNode[] {
  const root: TreeNode[] = [];

  for (const file of files) {
    const parts = file.path.split("/").filter(Boolean);
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;
      const existing = current.find((n) => n.name === part);

      if (existing) {
        if (isFile) existing.path = file.path;
        current = existing.children;
      } else {
        const node: TreeNode = {
          name: part,
          path: isFile ? file.path : null,
          children: [],
          isExpanded: i < parts.length - 1,
        };
        current.push(node);
        if (!isFile) current = node.children;
      }
    }
  }

  return root;
}

function TreeItem({
  node,
  depth,
  selectedFile,
  onSelectFile,
  onToggleExpand,
}: {
  node: TreeNode;
  depth: number;
  selectedFile: string;
  onSelectFile: (path: string) => void;
  onToggleExpand: (path: string) => void;
}) {
  const isFile = node.path !== null;
  const isSelected = node.path === selectedFile;

  return (
    <div className="select-none">
      <div
        onClick={() => {
          if (isFile && node.path) {
            onSelectFile(node.path);
          } else {
            onToggleExpand(node.path || node.name);
          }
        }}
        style={{ paddingLeft: depth * 14 + 6 }}
        className={`flex items-center gap-1.5 py-1 px-2 rounded-lg cursor-pointer transition-colors text-xs font-mono truncate ${
          isSelected
            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold"
            : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
        }`}
      >
        {isFile ? (
          <span className="w-3.5 flex items-center justify-center shrink-0">
            {fileIcon(node.name)}
          </span>
        ) : (
          <span
            className={`w-3.5 flex items-center justify-center text-neutral-400 shrink-0 transition-transform ${
              node.isExpanded ? "rotate-90" : ""
            }`}
          >
            <ChevronRight size={12} />
          </span>
        )}

        {!isFile && (
          <span className="shrink-0">
            {node.isExpanded ? (
              <FolderOpen size={14} className="text-amber-500" />
            ) : (
              <FolderClosed size={14} className="text-amber-500" />
            )}
          </span>
        )}

        <span className="truncate">{node.name}</span>
      </div>

      {!isFile && node.isExpanded && node.children.length > 0 && (
        <div className="ml-2 border-l border-neutral-200/80 dark:border-neutral-800/80 pl-1 space-y-0.5 mt-0.5">
          {node.children.map((child) => (
            <TreeItem
              key={child.path || child.name}
              node={child}
              depth={depth + 1}
              selectedFile={selectedFile}
              onSelectFile={onSelectFile}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FileTree({ files, selectedFile, onSelectFile, projectName }: Props) {
  const [projectFolderOpen, setProjectFolderOpen] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const tree = React.useMemo(() => buildTree(files), [files]);

  React.useEffect(() => {
    const folders = new Set<string>();
    function walk(nodes: TreeNode[], prefix: string) {
      for (const n of nodes) {
        if (n.path === null) {
          const full = prefix ? `${prefix}/${n.name}` : n.name;
          folders.add(full);
          walk(n.children, full);
        }
      }
    }
    walk(tree, "");
    setExpandedFolders(folders);
  }, [tree]);

  const toggleExpand = React.useCallback((path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const syncedTree = React.useMemo(() => {
    function sync(nodes: TreeNode[]): TreeNode[] {
      return nodes.map((n) => ({
        ...n,
        isExpanded: n.path === null ? expandedFolders.has(n.name) || n.isExpanded : n.isExpanded,
        children: sync(n.children),
      }));
    }
    return sync(tree);
  }, [tree, expandedFolders]);

  const rootFolderName = projectName
    ? projectName.toLowerCase().replace(/[^a-z0-9_-]+/g, "-")
    : "project-root";

  return (
    <div className="flex flex-col h-full overflow-hidden select-none font-sans text-xs">
      {/* Top Header */}
      <div className="px-3 py-2.5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-[11px] font-semibold text-neutral-400 uppercase tracking-wider bg-neutral-50/50 dark:bg-neutral-900/50">
        <span>Files</span>
        <span className="text-[10px] font-mono lowercase px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
          {files.length} {files.length === 1 ? "file" : "files"}
        </span>
      </div>

      {/* Main Folder & Tree View */}
      <div className="flex-1 overflow-y-auto p-2">
        {files.length > 0 ? (
          <div className="space-y-1">
            {/* Root Project Name Folder */}
            <div
              onClick={() => setProjectFolderOpen((prev) => !prev)}
              className="flex items-center gap-1.5 py-1.5 px-2 rounded-lg cursor-pointer transition-colors text-xs font-semibold text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
            >
              <span
                className={`transition-transform duration-150 text-neutral-400 ${
                  projectFolderOpen ? "rotate-90" : ""
                }`}
              >
                <ChevronRight size={13} />
              </span>
              {projectFolderOpen ? (
                <FolderOpen size={15} className="text-amber-500 fill-amber-500/20 shrink-0" />
              ) : (
                <FolderClosed size={15} className="text-amber-500 fill-amber-500/20 shrink-0" />
              )}
              <span className="truncate font-mono text-[12px]">{rootFolderName}</span>
            </div>

            {/* Tree of files nested inside root project folder */}
            {projectFolderOpen && (
              <div className="ml-3 pl-2 border-l border-neutral-200 dark:border-neutral-800 space-y-0.5 mt-0.5">
                {syncedTree.map((node) => (
                  <TreeItem
                    key={node.path || node.name}
                    node={node}
                    depth={0}
                    selectedFile={selectedFile}
                    onSelectFile={onSelectFile}
                    onToggleExpand={toggleExpand}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 text-center text-neutral-400 text-xs">No files in project</div>
        )}
      </div>
    </div>
  );
}
