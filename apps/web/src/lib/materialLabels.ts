import { MaterialType } from '@mold-tracker/shared'

// Nama kimia lengkap tiap material, ditampilkan berdampingan dengan singkatannya
// di dropdown pemilihan supaya jelas bagi yang belum hafal singkatannya.
export const materialTypeLabel: Record<MaterialType, string> = {
  [MaterialType.PP]: 'PP (Polypropylene)',
  [MaterialType.PE]: 'PE (Polyethylene)',
  [MaterialType.PS]: 'PS (Polystyrene)',
  [MaterialType.ABS]: 'ABS (Acrylonitrile Butadiene Styrene)',
  [MaterialType.PVC]: 'PVC (Polyvinyl Chloride)',
  [MaterialType.PC]: 'PC (Polycarbonate)',
  [MaterialType.POM]: 'POM (Polyoxymethylene)',
  [MaterialType.PA]: 'PA (Polyamide / Nylon)',
  [MaterialType.PET]: 'PET (Polyethylene Terephthalate)',
  [MaterialType.SAN]: 'SAN (Styrene Acrylonitrile)',
}

export const materialTypeOptions = Object.values(MaterialType).map((value) => ({
  value,
  label: materialTypeLabel[value],
}))
