import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Boxes, Eye, Pencil, Plus } from 'lucide-react'
import {
  type CreateMoldRequest,
  type Mold,
  type MoldPlanRow,
  type UpdateMoldRequest,
} from '@mold-tracker/shared'
import { useAuth } from '../auth/authContextValue'
import { api } from '../../lib/api'
import { PageHeader } from '../../components/PageHeader'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { MoldTrackingBadge } from '../../components/ui/Badge'
import { MaterialCombobox } from '../../components/ui/MaterialCombobox'
import { Modal } from '../../components/ui/Modal'
import { SidePanel } from '../../components/ui/SidePanel'
import { TableSkeleton } from '../../components/ui/Skeleton'
import { TextField, TextAreaField, FieldGroup } from '../../components/ui/FormField'
import { useToast } from '../../components/ui/Toast'
import { errorMessage } from '../../lib/errorMessage'
import { optionalNumber, optionalText } from '../../lib/form'
import { formatNumber } from '../../lib/format'
import { MoldPlanDetail } from './MoldPlanDetail'

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

// Cetakan (Mold) - CRUD milik Manager Penyewa. Cetakan baru berstatus PLANNING dan
// bergerak sendiri mengikuti event domain. Satu-satunya tombol status di sini adalah
// konfirmasi cetakan sudah diterima kembali: itu approval milik penyewa, ditekan per
// cetakan, dan cetakan terakhir yang dikonfirmasi sekaligus menutup booking-nya.
export function MoldsPage() {
  const { accessToken } = useAuth()
  const toast = useToast()

  const [molds, setMolds] = useState<Mold[]>([])
  const [plan, setPlan] = useState<MoldPlanRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [panel, setPanel] = useState<{ mode: 'create' } | { mode: 'edit'; mold: Mold } | null>(null)
  const [detailMoldId, setDetailMoldId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      // Plan berisi realisasi material dan produksi; master mold tetap dari /molds.
      const [moldList, planList] = await Promise.all([
        api.listMolds(accessToken),
        api.getMoldPlan(accessToken),
      ])
      setMolds(moldList)
      setPlan(planList)
    } catch (caught) {
      toast.error(errorMessage(caught, 'Gagal memuat cetakan'))
    } finally {
      setIsLoading(false)
    }
  }, [accessToken, toast])

  useEffect(() => {
    void load()
  }, [load])

  const planByMoldId = useMemo(() => new Map(plan.map((row) => [row.moldId, row])), [plan])
  const detailRow = detailMoldId ? planByMoldId.get(detailMoldId) : undefined
  const columns: Column<Mold>[] = [
    { header: 'Kode', cell: (m) => <span className="font-semibold text-slate-800">{m.kodeMold}</span> },
    { header: 'Produk', cell: (m) => m.namaProduk },
    { header: 'Cavity', cell: (m) => m.cavity },
    { header: 'Tonase', cell: (m) => `${m.tonaseTon} ton` },
    { header: 'Material rencana', cell: (m) => m.planMaterialUtama ?? <span className="text-slate-400">-</span> },
    {
      header: 'Estimasi material',
      cell: (m) => (m.estimasiKg != null ? `${formatNumber(m.estimasiKg)} kg` : <span className="text-slate-400">-</span>),
    },
    {
      header: 'Sisa material',
      cell: (m) => {
        const row = planByMoldId.get(m.id)
        if (!row) return <span className="text-slate-400">-</span>
        const sisa = row.materialRemainingKg ?? row.estimasiKg
        return sisa != null ? `${formatNumber(sisa)} kg` : <span className="text-slate-400">-</span>
      },
    },
    {
      header: 'Target output',
      cell: (m) => (m.targetOutput != null ? formatNumber(m.targetOutput) : <span className="text-slate-400">-</span>),
    },
    { header: 'Status', cell: (m) => <MoldTrackingBadge status={m.trackingStatus} /> },
    {
      header: '',
      className: 'text-right',
      cell: (m) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={() => setDetailMoldId(m.id)}>
            <Eye className="h-4 w-4" /> Detail
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setPanel({ mode: 'edit', mold: m })}>
            <Pencil className="h-4 w-4" /> Edit
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="mx-auto max-w-screen-2xl">
      <PageHeader
        breadcrumb={[{ label: 'Beranda', to: '/manager' }, { label: 'Cetakan' }]}
        title="Cetakan"
        description="Master cetakan (mold) perusahaan Anda beserta rencana material dan target."
        actions={
          <Button onClick={() => setPanel({ mode: 'create' })}>
            <Plus className="h-5 w-5" /> Tambah cetakan
          </Button>
        }
      />

      <Card>
        {isLoading ? (
          <TableSkeleton rows={5} columns={6} />
        ) : molds.length === 0 ? (
          <div className="grid place-items-center py-14 text-center">
            <span className="grid h-12 w-12 place-items-center text-brand-700">
              <Boxes className="h-7 w-7" />
            </span>
            <p className="mt-3 text-sm font-semibold text-slate-800">Belum ada cetakan</p>
            <p className="mt-1 text-sm text-slate-500">Tambahkan cetakan pertama untuk mulai booking.</p>
          </div>
        ) : (
          <DataTable columns={columns} rows={molds} rowKey={(m) => m.id} />
        )}
      </Card>

      {detailRow ? (
        <Modal
          title={`Detail cetakan ${detailRow.kodeMold}`}
          onClose={() => setDetailMoldId(null)}
          size="lg"
        >
          <p className="mb-4 text-sm text-slate-500">
            {detailRow.namaProduk} - {detailRow.cavity} cavity - {detailRow.tonaseTon} ton
          </p>
          <MoldPlanDetail row={detailRow} />
        </Modal>
      ) : null}

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
                planMaterialUtama: form.planMaterialUtama || undefined,
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
                planMaterialUtama: form.planMaterialUtama || undefined,
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
        <MaterialCombobox
          label="Material utama (rencana)"
          value={form.planMaterialUtama}
          onChange={(value) => setForm((f) => ({ ...f, planMaterialUtama: value }))}
        />
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
