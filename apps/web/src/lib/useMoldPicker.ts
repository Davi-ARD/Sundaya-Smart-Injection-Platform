import { useState } from 'react'
import type { Job } from '@mold-tracker/shared'

// Pemilih booking + cetakan untuk form Log Pengiriman dan Log Penerimaan. Satu booking
// memuat beberapa cetakan, jadi item MOLD harus menyebut cetakan mana; ganti booking
// berarti cetakan lama tidak relevan lagi.
export function useMoldPicker(jobs: Job[]) {
  const [jobId, setJobId] = useState(jobs[0]?.id ?? '')
  const molds = jobs.find((j) => j.id === jobId)?.molds ?? []
  const [moldId, setMoldId] = useState(molds[0]?.moldId ?? '')

  const pilihJob = (nextJobId: string) => {
    setJobId(nextJobId)
    setMoldId(jobs.find((j) => j.id === nextJobId)?.molds[0]?.moldId ?? '')
  }

  return {
    jobId,
    moldId,
    setMoldId,
    pilihJob,
    jobOptions: jobs.map((j) => ({ value: j.id, label: j.jobNumber })),
    moldOptions: molds.map((m) => ({ value: m.moldId, label: `${m.kodeMold} - ${m.namaProduk}` })),
  }
}
