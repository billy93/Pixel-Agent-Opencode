'use client';

import { useRef, useCallback, useEffect } from 'react';
import { MessageSquare, Cpu, Layout, FolderOpen } from 'lucide-react';

interface MobileControlsProps {
  onDirectionChange: (direction: string | null) => void;
  onAction: (action: 'chat' | 'model' | 'openFilteredKanban' | 'openWorkspaceKanban' | 'openWorkspaceFiles') => void;
  showActionButtons: boolean;
  showWorkspaceAction?: boolean;
  agentName?: string;
}

export default function MobileControls({
  onDirectionChange,
  onAction,
  showActionButtons,
  showWorkspaceAction,
  agentName,
}: MobileControlsProps) {
  const joystickRef = useRef<HTMLDivElement>(null);
  const activeDirectionRef = useRef<string | null>(null);
  const touchIdRef = useRef<number | null>(null);

  const getDirection = useCallback((touchX: number, touchY: number): string | null => {
    const el = joystickRef.current;
    if (!el) return null;

    const rect = el.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = touchX - centerX;
    const dy = touchY - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Dead zone — ignore very small movements
    if (dist < 15) return null;

    const angle = Math.atan2(dy, dx) * (180 / Math.PI);

    // 8-directional mapping
    if (angle >= -22.5 && angle < 22.5) return 'right';
    if (angle >= 22.5 && angle < 67.5) return 'down-right';
    if (angle >= 67.5 && angle < 112.5) return 'down';
    if (angle >= 112.5 && angle < 157.5) return 'down-left';
    if (angle >= 157.5 || angle < -157.5) return 'left';
    if (angle >= -157.5 && angle < -112.5) return 'up-left';
    if (angle >= -112.5 && angle < -67.5) return 'up';
    if (angle >= -67.5 && angle < -22.5) return 'up-right';

    return null;
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (touchIdRef.current !== null) return; // Already tracking a touch
    const touch = e.changedTouches[0];
    touchIdRef.current = touch.identifier;
    const dir = getDirection(touch.clientX, touch.clientY);
    activeDirectionRef.current = dir;
    onDirectionChange(dir);
  }, [getDirection, onDirectionChange]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === touchIdRef.current) {
        const dir = getDirection(touch.clientX, touch.clientY);
        if (dir !== activeDirectionRef.current) {
          activeDirectionRef.current = dir;
          onDirectionChange(dir);
        }
        break;
      }
    }
  }, [getDirection, onDirectionChange]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === touchIdRef.current) {
        touchIdRef.current = null;
        activeDirectionRef.current = null;
        onDirectionChange(null);
        break;
      }
    }
  }, [onDirectionChange]);

  // Prevent default on joystick area to avoid scrolling
  useEffect(() => {
    const el = joystickRef.current;
    if (!el) return;
    const prevent = (e: TouchEvent) => e.preventDefault();
    el.addEventListener('touchmove', prevent, { passive: false });
    return () => el.removeEventListener('touchmove', prevent);
  }, []);

  return (
    <>
      {/* Virtual Joystick — Bottom Left */}
      <div
        ref={joystickRef}
        className="fixed z-[99990] select-none"
        style={{
          bottom: '24px',
          left: '24px',
          width: '140px',
          height: '140px',
          touchAction: 'none',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        {/* Outer ring */}
        <div className="w-full h-full rounded-full bg-black/30 backdrop-blur-sm border border-white/10 flex items-center justify-center">
          {/* D-pad arrows */}
          <div className="relative w-[100px] h-[100px]">
            {/* Up */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-8 flex items-center justify-center">
              <div className={`w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-b-[14px] transition-colors ${
                activeDirectionRef.current?.includes('up') ? 'border-b-white' : 'border-b-white/40'
              }`} />
            </div>
            {/* Down */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-8 flex items-center justify-center">
              <div className={`w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[14px] transition-colors ${
                activeDirectionRef.current?.includes('down') ? 'border-t-white' : 'border-t-white/40'
              }`} />
            </div>
            {/* Left */}
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center">
              <div className={`w-0 h-0 border-t-[10px] border-t-transparent border-b-[10px] border-b-transparent border-r-[14px] transition-colors ${
                activeDirectionRef.current?.includes('left') ? 'border-r-white' : 'border-r-white/40'
              }`} />
            </div>
            {/* Right */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center">
              <div className={`w-0 h-0 border-t-[10px] border-t-transparent border-b-[10px] border-b-transparent border-l-[14px] transition-colors ${
                activeDirectionRef.current?.includes('right') ? 'border-l-white' : 'border-l-white/40'
              }`} />
            </div>
            {/* Center dot */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white/20" />
          </div>
        </div>
      </div>

      {/* Action Buttons — Bottom Right (only when near an agent or inside workspace) */}
      {(showActionButtons || showWorkspaceAction) && (
        <div
          className="fixed z-[99990] select-none flex flex-col gap-3 items-center"
          style={{
            bottom: '24px',
            right: '24px',
            touchAction: 'none',
          }}
        >
          {/* Workspace Kanban button (only when in workspace and NOT near agent) */}
          {showWorkspaceAction && !showActionButtons && (
        <div className="flex flex-col gap-3">
          <button
            onTouchStart={(e) => {
              e.preventDefault();
              onAction('openWorkspaceKanban');
            }}
            className="w-14 h-14 rounded-full bg-blue-500/80 backdrop-blur-sm border border-blue-400/50 flex items-center justify-center shadow-lg shadow-blue-500/30 active:scale-90 transition-transform"
          >
            <Layout size={22} className="text-white" />
          </button>
          
          <button
            onTouchStart={(e) => {
              e.preventDefault();
              onAction('openWorkspaceFiles');
            }}
            className="w-14 h-14 rounded-full bg-amber-500/80 backdrop-blur-sm border border-amber-400/50 flex items-center justify-center shadow-lg shadow-amber-500/30 active:scale-90 transition-transform"
          >
            <FolderOpen size={22} className="text-white" />
          </button>
        </div>
      )}

          {/* Agent Action Buttons */}
          {showActionButtons && (
            <>
              {/* Kanban button */}
              <button
                onTouchStart={(e) => {
                  e.preventDefault();
                  onAction('openFilteredKanban');
                }}
                className="w-14 h-14 rounded-full bg-emerald-500/80 backdrop-blur-sm border border-emerald-400/50 flex items-center justify-center shadow-lg shadow-emerald-500/30 active:scale-90 transition-transform"
              >
                <Layout size={22} className="text-white" />
              </button>

              {/* Chat button */}
              <button
                onTouchStart={(e) => {
                  e.preventDefault();
                  onAction('chat');
                }}
                className="w-14 h-14 rounded-full bg-indigo-500/80 backdrop-blur-sm border border-indigo-400/50 flex items-center justify-center shadow-lg shadow-indigo-500/30 active:scale-90 transition-transform"
              >
                <MessageSquare size={22} className="text-white" />
              </button>

              {/* Model button */}
              <button
                onTouchStart={(e) => {
                  e.preventDefault();
                  onAction('model');
                }}
                className="w-14 h-14 rounded-full bg-purple-500/80 backdrop-blur-sm border border-purple-400/50 flex items-center justify-center shadow-lg shadow-purple-500/30 active:scale-90 transition-transform"
              >
                <Cpu size={22} className="text-white" />
              </button>

              {/* Agent name label */}
              {agentName && (
                <div className="text-center">
                  <span className="text-[10px] text-white/70 bg-black/40 px-2 py-1 rounded-full backdrop-blur-sm">
                    {agentName}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
