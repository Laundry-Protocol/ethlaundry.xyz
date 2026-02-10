'use client';

import React, { useState } from 'react';
import { useStore } from '@/store/useStore';
import { decodeNote, isValidNote } from '@/lib/crypto';
import { IconShield, IconCheck, IconClose, IconDownload, IconInfo } from './Icons';

export default function CompliancePanel() {
  const { complianceMode, setComplianceMode, notes } = useStore();
  const [noteInput, setNoteInput] = useState('');
  const [verificationResult, setVerificationResult] = useState<{
    valid: boolean;
    info?: ReturnType<typeof decodeNote>;
  } | null>(null);

  const handleVerifyNote = () => {
    if (!noteInput) return;
    const isValid = isValidNote(noteInput);
    const info = isValid ? decodeNote(noteInput) : null;
    setVerificationResult({ valid: isValid, info: info || undefined });
  };

  return (
    <div className="space-y-6">
      {/* Compliance Mode Toggle */}
      <div className="bg-surface-tertiary border border-white/[0.04] p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <IconShield size={16} className="text-accent" />
              <span className="font-display text-[11px] tracking-tech text-white uppercase">Compliance Mode</span>
            </div>
            <p className="font-display text-[10px] tracking-wide text-zinc-600 leading-relaxed uppercase">
              Generate proofs of source for regulatory requirements while maintaining privacy.
            </p>
          </div>
          <button
            onClick={() => setComplianceMode(!complianceMode)}
            className={`
              w-12 h-6 relative transition-colors flex-shrink-0
              ${complianceMode ? 'bg-accent/20' : 'bg-surface-primary'}
              border ${complianceMode ? 'border-accent/30' : 'border-white/[0.06]'}
            `}
          >
            <div
              className={`
                absolute top-1 w-4 h-4 transition-transform
                ${complianceMode ? 'translate-x-6 bg-accent' : 'translate-x-1 bg-zinc-600'}
              `}
            />
          </button>
        </div>
      </div>

      {/* Note Verification */}
      <div>
        <label className="label">Verify Note</label>
        <textarea
          value={noteInput}
          onChange={(e) => {
            setNoteInput(e.target.value);
            setVerificationResult(null);
          }}
          placeholder="Paste note to verify..."
          rows={3}
          className="input input-mono resize-none"
        />
        <button
          onClick={handleVerifyNote}
          disabled={!noteInput}
          className="w-full btn-secondary mt-3"
        >
          Verify Note Authenticity
        </button>

        {verificationResult && (
          <div
            className={`
              mt-4 p-4 border
              ${verificationResult.valid
                ? 'bg-accent/5 border-accent/20'
                : 'bg-red-500/5 border-red-500/20'
              }
            `}
          >
            <div className="flex items-center gap-3 mb-4">
              {verificationResult.valid ? (
                <>
                  <div className="w-5 h-5 bg-accent flex items-center justify-center">
                    <IconCheck size={12} className="text-black" />
                  </div>
                  <span className="font-display text-[11px] tracking-tech text-accent uppercase">Valid Note</span>
                </>
              ) : (
                <>
                  <div className="w-5 h-5 bg-red-500 flex items-center justify-center">
                    <IconClose size={12} className="text-white" />
                  </div>
                  <span className="font-display text-[11px] tracking-tech text-red-400 uppercase">Invalid Note</span>
                </>
              )}
            </div>

            {verificationResult.info && (
              <div className="space-y-3">
                <div className="flex justify-between font-display text-[10px] tracking-wide">
                  <span className="text-zinc-600 uppercase">Network</span>
                  <span className="text-white uppercase">{verificationResult.info.network}</span>
                </div>
                <div className="flex justify-between font-display text-[10px] tracking-wide">
                  <span className="text-zinc-600 uppercase">Amount</span>
                  <span className="font-mono text-white">{verificationResult.info.amount} ETH</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Your Notes */}
      <div>
        <label className="label">Your Notes</label>
        {notes.length === 0 ? (
          <div className="bg-surface-tertiary border border-white/[0.04] p-8 text-center">
            <div className="w-12 h-12 mx-auto flex items-center justify-center border border-white/[0.06] mb-4">
              <IconShield size={20} className="text-zinc-600" />
            </div>
            <p className="font-display text-[11px] tracking-tech text-zinc-600 uppercase">No notes yet</p>
            <p className="font-display text-[9px] tracking-wide text-zinc-700 mt-2 uppercase">Make a deposit to create your first note</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notes.map((note) => (
              <div
                key={note.id}
                className="bg-surface-tertiary border border-white/[0.04] p-4 hover:border-accent/20 transition-all"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 ${
                      note.status === 'deposited' ? 'bg-accent' :
                      note.status === 'spent' ? 'bg-zinc-600' : 'bg-yellow-500'
                    }`} />
                    <span className="font-mono text-sm text-white">{note.amount} ETH</span>
                  </div>
                  <span className="font-mono text-[10px] text-zinc-600">
                    {new Date(note.timestamp).toLocaleDateString()}
                  </span>
                </div>
                <div className="font-mono text-[9px] text-zinc-700 truncate">
                  {note.commitment}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Export */}
      {notes.length > 0 && (
        <button
          onClick={() => {
            const data = JSON.stringify(notes, null, 2);
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'compliance-report.json';
            a.click();
          }}
          className="w-full btn-secondary flex items-center justify-center gap-3"
        >
          <IconDownload size={16} />
          Export Compliance Report
        </button>
      )}

      {/* Info */}
      <div className="bg-surface-tertiary border border-white/[0.04] p-4">
        <div className="flex gap-3">
          <IconInfo size={16} className="text-zinc-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-2">
            <p className="font-display text-[10px] tracking-wide text-zinc-500 uppercase">Generate proof of source for regulatory requirements</p>
            <p className="font-display text-[10px] tracking-wide text-zinc-500 uppercase">Selective disclosure - reveal only what&apos;s necessary</p>
            <p className="font-display text-[10px] tracking-wide text-zinc-500 uppercase">Zero-knowledge proofs maintain your privacy</p>
          </div>
        </div>
      </div>
    </div>
  );
}
