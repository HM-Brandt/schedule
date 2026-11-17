import { House, LogOut } from 'lucide-react'
import { useMe } from '../../api/queries'
import logo from '../../assets/hmbLogo.png'
import { goToLogin, HOME_URL } from '../../auth/session'
import { useAuthStore } from '../../stores/authStore'
import styles from './AppHeader.module.css'

function initials(fullName: string) {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
}

export function AppHeader() {
  useMe()
  const user = useAuthStore((state) => state.user)

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <a href={HOME_URL}>
          <img src={logo} alt="HM Brandt Demolition" className={styles.logo} />
        </a>
        <h1 className={styles.title}>Weekly schedule</h1>
      </div>
      <div className={styles.actions}>
        <a href={HOME_URL} aria-label="Home" className={styles.link}>
          <House size={16} />
          <span className={styles.linkText}>Home</span>
        </a>
        {user && (
          <span className={styles.user}>
            <span className={styles.avatar}>{initials(user.fullName)}</span>
            {user.fullName}
          </span>
        )}
        <button
          type="button"
          aria-label="Logout"
          title="Logout"
          className={styles.iconButton}
          onClick={goToLogin}
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  )
}
