import { useDraggable } from '@dnd-kit/react'
import type { Job } from '../../api/types'
import { jobHue } from '../../lib/colors'
import styles from './CatalogJob.module.css'

export function CatalogJob({ job, count }: { job: Job; count: number }) {
  const { ref } = useDraggable({ id: `job-${job.jobsId}`, type: 'catalog-job', data: { kind: 'catalog-job', job } })

  return (
    <li ref={ref} role="listitem" title={`${job.number} ${job.name}${job.address ? `\n${job.address}` : ''}`} className={count > 0 ? `${styles.job} ${styles.inUse}` : styles.job} data-in-use={count > 0 ? 'true' : undefined} data-hue={jobHue(job.jobsId)}>
      <span className={styles.number}>{job.number}</span>
      <span className={styles.name}>{job.name}</span>
      {count > 0 && <span className={styles.count}>{`x${count}`}</span>}
      {job.address && <span className={styles.address}>{job.address}</span>}
    </li>
  )
}
