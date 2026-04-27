import { create } from 'zustand'

interface AppStore {
  orgId: string
  userId: string
  userRole: string
  setOrgId: (id: string) => void
  setUserId: (id: string) => void
  setUserRole: (role: string) => void
}

export const useAppStore = create<AppStore>((set) => ({
  orgId: '00000000-0000-0000-0000-000000000001',
  userId: '',
  userRole: 'staff',
  setOrgId: (id) => set({ orgId: id }),
  setUserId: (id) => set({ userId: id }),
  setUserRole: (role) => set({ userRole: role }),
}))
