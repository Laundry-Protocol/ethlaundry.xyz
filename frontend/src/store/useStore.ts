import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Note, Network, Transaction, RelayerInfo } from '@/types';
import { getActiveNetworks } from '@/types';

// Get default network based on environment
const getDefaultNetwork = (): Network => {
  const activeNetworks = getActiveNetworks();
  return activeNetworks[0];
};

interface AppState {
  // Active tab
  activeTab: 'deposit' | 'withdraw' | 'swap';
  setActiveTab: (tab: 'deposit' | 'withdraw' | 'swap') => void;

  // Network selection
  selectedNetwork: Network;
  setSelectedNetwork: (network: Network) => void;

  // Amount selection
  selectedAmount: string;
  setSelectedAmount: (amount: string) => void;

  // Notes management
  notes: Note[];
  addNote: (note: Note) => void;
  updateNote: (id: string, updates: Partial<Note>) => void;
  removeNote: (id: string) => void;
  clearNotes: () => void;

  // Transactions
  transactions: Transaction[];
  addTransaction: (tx: Transaction) => void;
  updateTransaction: (id: string, updates: Partial<Transaction>) => void;

  // Relayer
  selectedRelayer: RelayerInfo | null;
  setSelectedRelayer: (relayer: RelayerInfo | null) => void;

  // UI State
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;

  // Modal states
  showNoteModal: boolean;
  setShowNoteModal: (show: boolean) => void;
  currentNote: Note | null;
  setCurrentNote: (note: Note | null) => void;

  // Compliance mode
  complianceMode: boolean;
  setComplianceMode: (enabled: boolean) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      // Active tab
      activeTab: 'deposit',
      setActiveTab: (tab) => set({ activeTab: tab }),

      // Network - default based on environment
      selectedNetwork: getDefaultNetwork(),
      setSelectedNetwork: (network) => set({ selectedNetwork: network }),

      // Amount
      selectedAmount: '1',
      setSelectedAmount: (amount) => set({ selectedAmount: amount }),

      // Notes
      notes: [],
      addNote: (note) => set((state) => ({ notes: [...state.notes, note] })),
      updateNote: (id, updates) =>
        set((state) => ({
          notes: state.notes.map((n) => (n.id === id ? { ...n, ...updates } : n)),
        })),
      removeNote: (id) =>
        set((state) => ({
          notes: state.notes.filter((n) => n.id !== id),
        })),
      clearNotes: () => set({ notes: [] }),

      // Transactions
      transactions: [],
      addTransaction: (tx) =>
        set((state) => ({ transactions: [tx, ...state.transactions] })),
      updateTransaction: (id, updates) =>
        set((state) => ({
          transactions: state.transactions.map((t) =>
            t.id === id ? { ...t, ...updates } : t
          ),
        })),

      // Relayer
      selectedRelayer: null,
      setSelectedRelayer: (relayer) => set({ selectedRelayer: relayer }),

      // UI
      isLoading: false,
      setIsLoading: (loading) => set({ isLoading: loading }),

      // Modal
      showNoteModal: false,
      setShowNoteModal: (show) => set({ showNoteModal: show }),
      currentNote: null,
      setCurrentNote: (note) => set({ currentNote: note }),

      // Compliance
      complianceMode: false,
      setComplianceMode: (enabled) => set({ complianceMode: enabled }),
    }),
    {
      name: 'laundry-v1-mainnet',
      partialize: (state) => ({
        notes: state.notes,
        transactions: state.transactions,
        selectedNetwork: state.selectedNetwork,
        complianceMode: state.complianceMode,
      }),
    }
  )
);
