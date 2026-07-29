import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Boxes, Pencil, Plus } from 'lucide-react'
import type { CreateMoldRequest, Mold, UpdateMoldRequest } from '@mold-tracker/shared'
import { useAuth } from '../auth/authContextValue'
import { api } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { MoldTrackingBadge } from '../../components/ui/Badge'
import { SidePanel } from '../../components/ui/SidePanel'
import { TableSkeleton } from '../../components/ui/Skeleton'
import { TextField, TextAreaField, FieldGroup } from '../../components/ui/FormField'
import { useToast } from '../../components/ui/Toast'
import { errorMessage } from '../../lib/errorMessage'
import { optionalNumber, optionalText } from '../../lib/form'

type FormState = {
  kodeMold: string
  namaProduk: string
  cavity: string
  tonaseTon: string
  deskripsi: string
  planMaterialUtama: string
  estimasiKg: string
  targetOutput: string
}

const emptyForm: FormState = {
  kodeMold: '',
  namaProduk: '',
  cavity: '',
  tonaseTon: '',
  deskripsi: '',
  planMaterialUtama: '',
  estimasiKg: '',
  targetOutput: '',
}

const formFromMold = (mold: Mold): FormState => ({
  kodeMold: mold.kodeMold,
  namaProduk: mold.namaProduk,
  cavity: String(mold.cavity),
  tonaseTon: String(mold.tonaseTon),
  deskripsi: mold.deskripsi ?? '',
  planMaterialUtama: mold.planMaterialUtama ?? '',
  estimasiKg: mold.estimasiKg != null ? String(mold.estimasiKg) : '',
  targetOutput: mold.targetOutput != null ? String(mold.targetOutput) : '',
})

// Cetakan (Mold) - CRUD milik Manager Penyewa. Cetakan baru berstatus PLANNING;
// transisi tracking dilakukan sisi Sundaya, bukan di sini.
export function MoldsPage() {
  const { accessToken } = useAuth()
  const toast = useToast()

  const [molds, setMolds] = useState<Mold[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [panel, setPanel] = useState<{ mode: 'create' } | { mode: 'edit'; mold: Mold } | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      setMolds(await api.listMolds(accessToken))
    } catch (caught) {
      toast.error(errorMessage(caught, 'Gagal memuat cetakan'))
    } finally {
      setIsLoading(false)
    }
  }, [accessToken, toast])

  useEffect(() => {
    void load()
  }, [load])

  const columns: Column<Mold>[] = [
    { header: 'Kode', cell: (m) => <span className="font-semibold text-slate-900">{m.kodeMold}</span> },
    { header: 'Produk', cell: (m) => m.namaProduk },
    { header: 'Cavity', cell: (m) => m.cavity },
    { header: 'Tonase', cell: (m) => `${m.tonaseTon} ton` },
    { header: 'Material rencana', cell: (m) => m.planMaterialUtama ?? <span className="text-slate-400">-</span> },
    { header: 'Status', cell: (m) => <MoldTrackingBadge status={m.trackingStatus} /> },
    {
      header: '',
      className: 'text-right',
      cell: (m) => (
        <Button size="sm" variant="secondary" onClick={() => setPanel({ mode: 'edit', mold: m })}>
          <Pencil className="h-3.5 w-3.5" /> Edit
        </Button>
      ),
    },
  ]

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Cetakan</h1>
          <p className="mt-1 text-sm text-slate-500">
            Master cetakan (mold) perusahaan Anda beserta rencana material dan target.
          </p>
        </div>
        <Button onClick={() => setPanel({ mode: 'create' })}>
          <Plus className="h-4 w-4" /> Tambah cetakan
        </Button>
      </div>

      <Card>
        {isLoading ? (
          <TableSkeleton rows={5} columns={6} />
        ) : molds.length === 0 ? (
          <div className="grid place-items-center py-14 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand-700">
              <Boxes className="h-6 w-6" />
            </span>
            <p className="mt-3 text-sm font-semibold text-slate-800">Belum ada cetakan</p>
            <p className="mt-1 text-sm text-slate-500">Tambahkan cetakan pertama untuk mulai booking.</p>
          </div>
        ) : (
          <DataTable columns={columns} rows={molds} rowKey={(m) => m.id} />
        )}
      </Card>

      {panel ? (
        <MoldFormPanel
          key={panel.mode === 'edit' ? panel.mold.id : 'create'}
          initial={panel.mode === 'edit' ? formFromMold(panel.mold) : emptyForm}
          isEdit={panel.mode === 'edit'}
          onClose={() => setPanel(null)}
          onSaved={() => {
            setPanel(null)
            void load()
          }}
          save={async (form) => {
            if (panel.mode === 'edit') {
              const body: UpdateMoldRequest = {
                namaProduk: form.namaProduk,
                cavity: Number(form.cavity),
                tonaseTon: Number(form.tonaseTon),
                deskripsi: optionalText(form.deskripsi),
                planMaterialUtama: optionalText(form.planMaterialUtama),
                estimasiKg: optionalNumber(form.estimasiKg),
                targetOutput: optionalNumber(form.targetOutput),
              }
              await api.updateMold(accessToken, panel.mold.id, body)
            } else {
              const body: CreateMoldRequest = {
                kodeMold: form.kodeMold.trim(),
                namaProduk: form.namaProduk,
                cavity: Number(form.cavity),
                tonaseTon: Number(form.tonaseTon),
                deskripsi: optionalText(form.deskripsi),
                planMaterialUtama: optionalText(form.planMaterialUtama),
                estimasiKg: optionalNumber(form.estimasiKg),
                targetOutput: optionalNumber(form.targetOutput),
              }
              await api.createMold(accessToken, body)
            }
          }}
        />
      ) : null}
    </div>
  )
}

function MoldFormPanel({
  initial,
  isEdit,
  onClose,
  onSaved,
  save,
}: {
  initial: FormState
  isEdit: boolean
  onClose: () => void
  onSaved: () => void
  save: (form: FormState) => Promise<void>
}) {
  const toast = useToast()
  const [form, setForm] = useState<FormState>(initial)
  const [isSaving, setIsSaving] = useState(false)

  const set = (key: keyof FormState) => (value: string) => setForm((f) => ({ ...f, [key]: value }))

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setIsSaving(true)
    try {
      await save(form)
      toast.success(isEdit ? 'Cetakan diperbarui' : 'Cetakan ditambahkan')
      onSaved()
    } catch (caught) {
      toast.error(errorMessage(caught, 'Gagal menyimpan cetakan'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <SidePanel
      title={isEdit ? 'Edit cetakan' : 'Tambah cetakan'}
      subtitle={isEdit ? 'Kode cetakan tidak dapat diubah.' : 'Cetakan baru berstatus Planning.'}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {!isEdit ? (
          <TextField label="Kode cetakan" value={form.kodeMold} onChange={set('kodeMold')} />
        ) : null}
        <TextField label="Nama produk" value={form.namaProduk} onChange={set('namaProduk')} />
        <FieldGroup>
          <TextField label="Cavity" type="number" min={1} value={form.cavity} onChange={set('cavity')} />
          <TextField label="Tonase (ton)" type="number" min={1} value={form.tonaseTon} onChange={set('tonaseTon')} />
        </FieldGroup>
        <FieldGroup>
          <TextField label="Estimasi material (kg)" type="number" min={0} step="0.1" required={false} value={form.estimasiKg} onChange={set('estimasiKg')} />
          <TextField label="Target output" type="number" min={0} required={false} value={form.targetOutput} onChange={set('targetOutput')} />
        </FieldGroup>
        <TextField label="Material utama (rencana)" required={false} value={form.planMaterialUtama} onChange={set('planMaterialUtama')} />
        <TextAreaField label="Deskripsi" value={form.deskripsi} onChange={set('deskripsi')} />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? 'Menyimpan...' : 'Simpan'}
          </Button>
        </div>
      </form>
    </SidePanel>
  )
}
