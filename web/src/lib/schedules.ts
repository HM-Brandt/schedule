import type { Job, Schedule, ScheduleResponse } from '../api/types'

export function toSchedule({ jobsId: _jobsId, ...response }: ScheduleResponse, job: Job): Schedule {
  return { ...response, job }
}

export function unknownJob(jobsId: number): Job {
  return {
    jobsId,
    number: `#${jobsId}`,
    type: '',
    name: 'Unknown job',
    address: '',
    contractor: '',
    contact: '',
    status: '',
    user: '',
  }
}
