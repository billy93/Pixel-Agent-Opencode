'use client';

import { useState } from 'react';
import { AlertTriangle, Terminal, ExternalLink, RefreshCw, X, Copy, Check } from 'lucide-react';
import { OpenCodeServerStatus } from '@/lib/opencode/use-opencode-server';

interface OpenCodeServerWarningProps {
  serverStatus: OpenCodeServerStatus;
  onRetry: () => void;
  onDismiss?: () => void;
}

export default function OpenCodeServerWarning({
  serverStatus,
  onRetry,
  onDismiss,
}: OpenCodeServerWarningProps) {
  const [copiedCommand, setCopiedCommand] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  const handleCopyCommand = async () => {
    try {
      await navigator.clipboard.writeText('opencode serve');
      setCopiedCommand(true);
      setTimeout(() => setCopiedCommand(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    await onRetry();
    setTimeout(() => setIsRetrying(false), 1000);
  };

  if (serverStatus.status === 'connected' || serverStatus.status === 'checking') {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-red-500/30 rounded-2xl shadow-2xl w-[500px] max-w-[90vw] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-red-500/10 border-b border-red-500/20 px-6 py-4 flex items-center gap-3">
          <div className="p-2 bg-red-500/20 rounded-xl">
            <AlertTriangle className="w-6 h-6 text-red-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-white">OpenCode Server Not Running</h2>
            <p className="text-sm text-red-300/80">Connection required for AI agents to work</p>
          </div>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-5">
          {/* Error Message */}
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <p className="text-sm text-slate-300">
              <span className="text-red-400 font-medium">Error:</span> {serverStatus.message || 'Cannot connect to OpenCode server'}
            </p>
            {serverStatus.serverUrl && (
              <p className="text-xs text-slate-500 mt-2">
                Trying to connect to: <code className="bg-slate-700/50 px-1.5 py-0.5 rounded">{serverStatus.serverUrl}</code>
              </p>
            )}
          </div>

          {/* Instructions */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Terminal size={16} className="text-emerald-400" />
              How to Start OpenCode Server
            </h3>
            
            <div className="space-y-2 text-sm text-slate-400">
              <p>1. Open a terminal in your project directory</p>
              <p>2. Run the following command:</p>
            </div>

            {/* Command Box */}
            <div className="bg-slate-950 rounded-xl p-3 flex items-center justify-between border border-slate-700/50 group">
              <code className="text-emerald-400 font-mono text-sm">opencode serve</code>
              <button
                onClick={handleCopyCommand}
                className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
                title="Copy command"
              >
                {copiedCommand ? (
                  <Check size={16} className="text-emerald-400" />
                ) : (
                  <Copy size={16} />
                )}
              </button>
            </div>

            <p className="text-sm text-slate-400">
              3. Wait for the server to start, then click <span className="text-white font-medium">Retry Connection</span> below
            </p>
          </div>

          {/* Need Help */}
          <div className="bg-indigo-500/10 rounded-xl p-4 border border-indigo-500/20">
            <p className="text-sm text-slate-300 mb-2">
              Need help? Visit the OpenCode documentation for installation instructions and troubleshooting.
            </p>
            <a
              href="https://opencode.ai/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              <ExternalLink size={14} />
              Open OpenCode Documentation
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-800/30 border-t border-slate-700/50 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            {serverStatus.lastChecked && (
              <>Last checked: {serverStatus.lastChecked.toLocaleTimeString()}</>
            )}
          </p>
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white font-medium rounded-xl transition-colors"
          >
            <RefreshCw size={16} className={isRetrying ? 'animate-spin' : ''} />
            {isRetrying ? 'Checking...' : 'Retry Connection'}
          </button>
        </div>
      </div>
    </div>
  );
}
