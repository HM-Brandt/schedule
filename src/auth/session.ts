import { useAuthStore } from '../stores/authStore'

export const HOME_URL = 'https://ckarlosdev.github.io/HMBrandt/'
export const LOGIN_URL = 'https://ckarlosdev.github.io/login/'

export function goToLogin() {
  useAuthStore.getState().logout()
  window.location.assign(LOGIN_URL)
}
