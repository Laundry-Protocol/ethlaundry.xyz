'use client';

import React, { useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { encodeNote } from '@/lib/crypto';
import NoteDisplay from './NoteDisplay';
import { IconClose, IconWarning, IconCheck } from './Icons';

export default function NoteModal() {
  const { showNoteModal, setShowNoteModal, currentNote, setCurrentNote } = useStore();

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowNoteModal(false);
        setCurrentNote(null);
      }
    };

    if (showNoteModal) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [showNoteModal, setShowNoteModal, setCurrentNote]);

  const handleClose = () => {
    setShowNoteModal(false);
    setCurrentNote(null);
  };

  if (!currentNote || !showNoteModal) return null;

  const encodedNote = encodeNote(currentNote);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        onClick={handleClose}
        className="absolute inset-0 bg-black/90 backdrop-blur-sm"
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-surface-card border border-white/[0.04] overflow-hidden">
        {/* Top accent line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-accent" />

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/[0.04]">
          <div>
            <h2 className="font-display text-sm tracking-tech text-white uppercase">Backup Required</h2>
            <p className="font-display text-[9px] tracking-wide text-zinc-600 mt-1 uppercase">Save this note to withdraw funds</p>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center text-zinc-600 hover:text-accent border border-white/[0.04] hover:border-accent/30 transition-all"
          >
            <IconClose size={14} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          {/* Amount */}
          <div className="text-center py-6 border border-white/[0.04] bg-surface-tertiary">
            <span className="font-mono text-4xl font-bold text-white">{currentNote.amount}</span>
            <span className="font-display text-sm tracking-tech text-zinc-600 ml-3 uppercase">ETH</span>
          </div>

          {/* Note Display */}
          <NoteDisplay note={encodedNote} />

          {/* Checklist */}
          <div className="bg-[#1a1a00] border border-yellow-500/20 p-4">
            <div className="flex items-center gap-3 mb-4">
              <IconWarning size={16} className="text-yellow-500" />
              <span className="font-display text-[10px] tracking-tech text-yellow-200/90 uppercase">Verification Checklist</span>
            </div>
            <div className="space-y-3">
              <CheckItem>I have saved my note in a secure location</CheckItem>
              <CheckItem>I understand this note is required to withdraw</CheckItem>
              <CheckItem>I will not share this note with anyone</CheckItem>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-white/[0.04]">
          <button
            onClick={handleClose}
            className="w-full btn-primary"
          >
            Confirm Backup Complete
          </button>
        </div>
      </div>
    </div>
  );
}

function CheckItem({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 font-display text-[10px] tracking-wide text-yellow-200/60">
      <div className="w-4 h-4 border border-yellow-500/30 flex items-center justify-center flex-shrink-0">
        <IconCheck size={10} className="text-yellow-500" />
      </div>
      {children}
    </div>
  );
}
