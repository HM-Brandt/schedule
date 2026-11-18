import { useDroppable } from '@dnd-kit/react'
import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useJobs } from '../../api/queries'
import { ACCEPTS } from '../../dnd/dropResolution'
import { useAcceptsDrag } from '../../dnd/useAcceptsDrag'
import { filterJobs } from '../../lib/jobs'
import { CatalogJob } from '../CatalogJob'
import styles from './JobCatalog.module.css'

export function JobCatalog({ counts }: { counts: Map<number, number> }) {
  const [search, setSearch] = useState('')
  const jobs = useJobs()
  const visible = useMemo(() => filterJobs(jobs.data ?? [], search), [jobs.data, search])
  const { ref, isDropTarget } = useDroppable({ id: 'catalog', type: 'catalog', accept: ACCEPTS.catalog, data: { kind: 'catalog' } })
  const accepting = useAcceptsDrag('catalog')

  return (
    <section
      ref={ref}
      className={[styles.catalog, accepting && styles.accepting, isDropTarget && styles.over].filter(Boolean).join(' ')}
    >
      <h2 className={styles.title}>Jobs</h2>
      <div className={styles.searchBox}>
        <Search />
        <input
          className={styles.search}
          type="search"
          aria-label="Search jobs"
          placeholder="Search jobs"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      {jobs.error && (
        <p role="alert" className={styles.error}>
          Couldn't load jobs. {jobs.error.message}
        </p>
      )}
      {jobs.data && visible.length === 0 && <p className={styles.empty}>No jobs found</p>}
      <ul className={styles.list}>
        {visible.map((job) => (
          <CatalogJob key={job.jobsId} job={job} count={counts.get(job.jobsId) ?? 0} />
        ))}
      </ul>
    </section>
  )
}
