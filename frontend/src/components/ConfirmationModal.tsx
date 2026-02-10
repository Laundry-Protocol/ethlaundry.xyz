'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { formatGasPrice, formatEstimatedCost } from '@/lib/gas';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  type: 'deposit' | 'withdraw' | 'swap';
  details: {
    amount: string;
    recipient?: string;
    network: string;
    symbol?: string;
    estimatedGas?: bigint;
    maxFeePerGas?: bigint;
    protocolFee?: string;
    relayerFee?: string;
  };
  isLoading?: boolean;
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  type,
  details,
  isLoading = false,
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  const estimatedCost = details.estimatedGas && details.maxFeePerGas
    ? details.estimatedGas * details.maxFeePerGas
    : null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
          >
            <div className="bg-surface-card border border-white/[0.04] max-w-md w-full relative">
              {/* Top accent line */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent" />

              {/* Header */}
              <div className="p-5 border-b border-white/[0.04]">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-[12px] tracking-tech text-accent uppercase">{title}</h3>
                  <button
                    onClick={onClose}
                    disabled={isLoading}
                    className="p-1.5 hover:bg-white/[0.04] transition-colors disabled:opacity-50"
                  >
                    <svg className="w-4 h-4 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="p-5 space-y-5">
                {/* Type Icon */}
                <div className="flex justify-center">
                  <div className={`w-14 h-14 border flex items-center justify-center ${
                    type === 'deposit' ? 'border-accent/30 bg-accent/[0.06]' :
                    type === 'withdraw' ? 'border-accent/30 bg-accent/[0.06]' :
                    'border-accent/30 bg-accent/[0.06]'
                  }`}>
                    {type === 'deposit' && (
                      <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                    )}
                    {type === 'withdraw' && (
                      <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                      </svg>
                    )}
                    {type === 'swap' && (
                      <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                    )}
                  </div>
                </div>

                {/* Amount */}
                <div className="text-center">
                  <p className="font-mono text-3xl font-bold text-white">{details.amount} <span className="font-display text-sm tracking-tech text-zinc-500">{details.symbol || 'ETH'}</span></p>
                  <p className="font-display text-[10px] tracking-tech text-zinc-600 uppercase mt-2">on {details.network}</p>
                </div>

                {/* Details */}
                <div className="bg-surface-primary border border-white/[0.04] p-4 space-y-0">
                  {details.recipient && (
                    <div className="data-row">
                      <span className="data-label">Recipient</span>
                      <span className="font-mono text-xs text-white">
                        {details.recipient.slice(0, 6)}...{details.recipient.slice(-4)}
                      </span>
                    </div>
                  )}

                  {details.protocolFee && (
                    <div className="data-row">
                      <span className="data-label">Protocol Fee</span>
                      <span className="font-mono text-xs text-zinc-400">{details.protocolFee}</span>
                    </div>
                  )}

                  {details.relayerFee && (
                    <div className="data-row">
                      <span className="data-label">Relayer Fee</span>
                      <span className="font-mono text-xs text-zinc-400">{details.relayerFee}</span>
                    </div>
                  )}

                  {details.maxFeePerGas && (
                    <div className="data-row">
                      <span className="data-label">Max Gas Price</span>
                      <span className="font-mono text-xs text-zinc-400">{formatGasPrice(details.maxFeePerGas)}</span>
                    </div>
                  )}

                  {estimatedCost && (
                    <div className="data-row border-t border-white/[0.04]">
                      <span className="data-label">Est. Gas Cost</span>
                      <span className="font-mono text-xs text-zinc-400">{formatEstimatedCost(estimatedCost)}</span>
                    </div>
                  )}
                </div>

                {/* Warning */}
                <div className="bg-[#1a1a00] border border-yellow-500/20 p-4">
                  <div className="flex gap-3">
                    <svg className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                      <p className="font-display text-[11px] tracking-wide text-yellow-200/90 uppercase">Review Carefully</p>
                      <p className="font-display text-[10px] tracking-wide text-yellow-200/50 mt-1 leading-relaxed">
                        {type === 'deposit' && 'This action cannot be undone. Make sure to save your note after depositing.'}
                        {type === 'withdraw' && 'Verify the recipient address is correct. Funds sent to wrong address cannot be recovered.'}
                        {type === 'swap' && 'Cross-chain swaps are time-locked. Ensure you can complete the swap within the timelock period.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-5 border-t border-white/[0.04] flex gap-3">
                <button
                  onClick={onClose}
                  disabled={isLoading}
                  className="btn-secondary flex-1 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={onConfirm}
                  disabled={isLoading}
                  className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <div className="spinner" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>Confirm {type.charAt(0).toUpperCase() + type.slice(1)}</>
                  )}
                </button>
              </div>

              {/* Bottom accent line */}
              <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent/20 to-transparent" />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default ConfirmationModal;
