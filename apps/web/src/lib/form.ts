// Field opsional pada form: kirim hanya bila diisi, selain itu undefined agar
// server memperlakukannya sebagai tidak diubah/tidak diisi.
export const optionalText = (value: string) => (value.trim() === '' ? undefined : value.trim())

export const optionalNumber = (value: string) => (value.trim() === '' ? undefined : Number(value))
