import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import sundayaIcon from '../assets/icon-sundaya.png'

// Halaman info statis (footer landing). Konten placeholder jujur, tanpa kontak
// atau klausul legal fiktif, sampai materi resminya tersedia dari Sundaya.
function InfoPage({ title, children }: { title: string; children: string }) {
  return (
    <div className="min-h-screen bg-surface">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
        <Link to="/" className="flex items-center gap-2 text-sm font-bold tracking-wide text-slate-800">
          <img src={sundayaIcon} alt="Sundaya" className="h-6 w-6 object-contain" /> Sundaya Smart Injection Platform
        </Link>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-800"
        >
          <ArrowLeft className="h-5 w-5" /> Kembali ke beranda
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-2xl font-bold tracking-tight text-slate-800">{title}</h1>
        <p className="mt-4 text-sm leading-normal text-slate-600">{children}</p>
      </main>
    </div>
  )
}

export const KontakPage = () => (
  <InfoPage title="Kontak">
    Halaman kontak resmi sedang disiapkan. Untuk saat ini, hubungi tim Sundaya melalui kanal
    komunikasi yang sudah berjalan dengan perusahaan Anda.
  </InfoPage>
)

export const FaqPage = () => (
  <InfoPage title="Pertanyaan yang Sering Diajukan">
    Daftar FAQ sedang disusun. Untuk pertanyaan seputar SSIP, hubungi tim Sundaya melalui kanal
    komunikasi yang sudah berjalan dengan perusahaan Anda.
  </InfoPage>
)

export const SyaratKetentuanPage = () => (
  <InfoPage title="Syarat & Ketentuan">
    Dokumen syarat dan ketentuan resmi akan diterbitkan di halaman ini. Untuk detail kontraktual
    saat ini, hubungi tim Sundaya melalui kanal komunikasi yang sudah berjalan dengan perusahaan
    Anda.
  </InfoPage>
)
