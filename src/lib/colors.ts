export function jobHue(jobId: number): number {
  return (Math.abs(jobId) % 8) + 1
}

export function employeeHue(employeeId: number): number {
  return (Math.abs(employeeId) % 8) + 1
}
