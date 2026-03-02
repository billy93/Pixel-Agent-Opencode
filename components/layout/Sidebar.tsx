'use client';

import { useState } from 'react';
import { Users, ChevronRight, ChevronDown, Database, Menu, X } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onSelectMenu: (menu: string) => void;
  activeMenu: string | null;
  showToggle?: boolean;
}

export default function Sidebar({ isOpen, onToggle, onSelectMenu, activeMenu, showToggle = true }: SidebarProps) {
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['master-data']);

  const toggleMenu = (menuId: string) => {
    setExpandedMenus(prev => 
      prev.includes(menuId) 
        ? prev.filter(id => id !== menuId) 
        : [...prev, menuId]
    );
  };

  return (
    <>
      {/* Sidebar Panel */}
      <div 
        className={`fixed top-0 left-0 h-full z-[100000] bg-slate-900/95 backdrop-blur-md border-r border-slate-700 transition-all duration-300 shadow-2xl ${
          isOpen ? 'w-64 translate-x-0' : 'w-64 -translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-4 border-b border-slate-700 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
              Pixel Agent
            </h2>
            <button onClick={onToggle} className="text-slate-400 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>

          {/* Menu Items */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {/* Master Data Group */}
            <div>
              <button 
                onClick={() => toggleMenu('master-data')}
                className="w-full flex items-center justify-between px-3 py-2 text-slate-300 hover:bg-slate-800 rounded-lg transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-1.5 bg-blue-500/10 rounded-md text-blue-400 group-hover:bg-blue-500/20 group-hover:text-blue-300 transition-colors">
                    <Database size={18} />
                  </div>
                  <span className="font-medium">Master Data</span>
                </div>
                {expandedMenus.includes('master-data') ? (
                  <ChevronDown size={16} className="text-slate-500" />
                ) : (
                  <ChevronRight size={16} className="text-slate-500" />
                )}
              </button>
              
              {expandedMenus.includes('master-data') && (
                <div className="ml-4 mt-1 space-y-1 border-l border-slate-700/50 pl-2 animate-in slide-in-from-top-2 duration-200">
                  <button
                    onClick={() => onSelectMenu('users')}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                      activeMenu === 'users' 
                        ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30' 
                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <Users size={16} />
                    <span>Users</span>
                  </button>
                </div>
              )}
            </div>
          </div>
          
          {/* Footer */}
          <div className="p-4 border-t border-slate-700 bg-slate-900/50">
            <div className="text-xs text-slate-500 text-center">
              Pixel Agent v0.1.0
            </div>
          </div>
        </div>
      </div>
      
      {/* Toggle Button (External) - Only visible when closed and user is logged in */}
      {!isOpen && showToggle && (
        <button
          onClick={onToggle}
          className="fixed top-4 left-4 z-[99999] p-2.5 bg-slate-800/90 backdrop-blur-md border border-slate-600/50 rounded-xl text-white shadow-lg shadow-black/20 hover:bg-slate-700 hover:scale-105 active:scale-95 transition-all group"
          title="Open Menu"
        >
          <Menu size={20} className="text-slate-300 group-hover:text-white" />
        </button>
      )}
    </>
  );
}
