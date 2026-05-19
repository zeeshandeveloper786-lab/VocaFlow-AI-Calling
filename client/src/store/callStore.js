import { create } from 'zustand'

const useCallStore = create((set, get) => ({
  activeCallId: null,
  activeCall: null,
  activeCalls: [],
  callStatus: 'idle',
  setActiveCall: (call) => set({ activeCall: call, activeCallId: call?.id || null }),
  addActiveCall: (call) => set((s) => ({ activeCalls: [...s.activeCalls, call] })),
  removeActiveCall: (callId) => set((s) => ({ activeCalls: s.activeCalls.filter(c => c.id !== callId) })),
  clearCalls: () => set({ activeCallId: null, activeCall: null, activeCalls: [], callStatus: 'idle' })
}))

export default useCallStore
