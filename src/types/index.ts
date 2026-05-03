export type AppRole = 'user' | 'admin' | 'super_admin'

export interface ApiResponse<T> {
  data: T | null
  error: string | null
}
