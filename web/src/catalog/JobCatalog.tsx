import { useState } from 'react'
import { useJobs } from '../api/queries'
import styles from './JobCatalog.module.css'

export function JobCatalog({ counts }: { counts: Map<number, number> }) {
  const [search, setSearch] = useState('')
  const jobs = useJobs(search)

  return (
    <section className={styles.catalog}>
      <h2 className={styles.title}>Jobs</h2>
      <input
        className={styles.search}
        type="search"
        aria-label="Search jobs"
        placeholder="Search jobs"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {jobs.error && (
        <p role="alert" className={styles.error}>
          Couldn't load jobs. {jobs.error.message}
        </p>
      )}
      {jobs.data?.length === 0 && <p className={styles.empty}>No jobs found</p>}
      <ul className={styles.list}>
        {jobs.data?.map((job) => {
          const count = counts.get(job.id) ?? 0
          return (
            <li key={job.id} className={count > 0 ? `${styles.job} ${styles.inUse}` : styles.job} data-in-use={count > 0 ? 'true' : undefined}>
              <span className={styles.number}>{job.number}</span>
              <span className={styles.name}>{job.name}</span>
              {count > 0 && <span className={styles.count}>{`x${count}`}</span>}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
