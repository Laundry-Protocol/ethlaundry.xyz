'use client';

import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import { IconCopy, IconDownload, IconQR, IconCheck } from './Icons';

interface NoteDisplayProps {
  note: string;
}

export default function NoteDisplay({ note }: NoteDisplayProps) {
  const [showQR, setShowQR] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(note);
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const downloadNote = () => {
    const blob = new Blob([note], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `laundry-note-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Note downloaded');
  };

  return (
    <div className="bg-surface-tertiary border border-white/[0.04] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04] bg-surface-card">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-accent animate-pulse" />
          <span className="font-display text-[10px] tracking-tech text-zinc-500 uppercase">
            Cryptographic Note
          </span>
        </div>
        <button
          onClick={() => setShowQR(!showQR)}
          className={`
            p-2 border transition-all duration-100
            ${showQR
              ? 'bg-accent/10 border-accent/30 text-accent'
              : 'border-white/[0.04] text-zinc-600 hover:text-zinc-400 hover:border-accent/20'
            }
          `}
        >
          <IconQR size={14} />
        </button>
      </div>

      {/* QR Code */}
      {showQR && (
        <div className="flex justify-center p-8 border-b border-white/[0.04] bg-surface-primary">
          <div className="relative p-4 bg-white">
            {/* Corner brackets */}
            <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-accent" />
            <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-accent" />
            <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-accent" />
            <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-accent" />
            <QRCodeSVG
              value={note}
              size={140}
              level="M"
              includeMargin={false}
              fgColor="#000000"
              bgColor="#ffffff"
            />
          </div>
        </div>
      )}

      {/* Note Text */}
      <div className="p-4">
        <div
          onClick={copyToClipboard}
          className="note-container group"
        >
          {note}
        </div>
      </div>

      {/* Actions */}
      <div className="flex border-t border-white/[0.04]">
        <button
          onClick={copyToClipboard}
          className="flex-1 py-4 flex items-center justify-center gap-3 font-display text-[10px] tracking-tech uppercase text-zinc-500 hover:text-accent hover:bg-accent/5 transition-all border-r border-white/[0.04]"
        >
          {copied ? (
            <>
              <IconCheck size={14} className="text-accent" />
              <span className="text-accent">Copied</span>
            </>
          ) : (
            <>
              <IconCopy size={14} />
              <span>Copy Note</span>
            </>
          )}
        </button>
        <button
          onClick={downloadNote}
          className="flex-1 py-4 flex items-center justify-center gap-3 font-display text-[10px] tracking-tech uppercase text-zinc-500 hover:text-accent hover:bg-accent/5 transition-all"
        >
          <IconDownload size={14} />
          <span>Download</span>
        </button>
      </div>
    </div>
  );
}
