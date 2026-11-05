import { useState } from 'react'
import { useJobs } from '../../api/queries'
import { CatalogJob } from '../CatalogJob'
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
        {jobs.data?.map((job) => (
          <CatalogJob key={job.id} job={job} count={counts.get(job.id) ?? 0} />
        ))}
      </ul>
    </section>
  )
}
