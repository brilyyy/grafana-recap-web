export interface Application {
  id: number
  app_name: string
  db_name?: string | null
  raw_table_name?: string | null
  created_at?: Date | string
  updated_at?: Date | string
}

export interface ApiResponse<T = any> {
  success: boolean
  message?: string
  data?: T
}

export interface DictionaryEntry {
  jenis_transaksi: string
  rc: string
  error_type: 'S' | 'N' | 'Sukses'
}

export interface SuccessRateEntry {
  id?: number
  tanggal_transaksi: string // WAJIB, tidak boleh null
  bulan: string // WAJIB, tidak boleh null
  tahun: number // WAJIB, tidak boleh null
  jenis_transaksi: string // WAJIB, tidak boleh null
  rc: string | null // BOLEH null
  rc_description: string | null // BOLEH null
  total_transaksi: number | null // BOLEH null
  total_nominal: number | null // BOLEH null
  total_biaya_admin: number | null // BOLEH null
  status_transaksi: string | null // VARCHAR, boleh null atau value apapun
  error_type: 'S' | 'N' | 'Sukses' | null // BOLEH null
  id_app_identifier: number
  created_at?: Date | string
  updated_at?: Date | string
}

export interface UnmappedRC {
  id: number
  id_app_identifier: number
  app_name?: string
  jenis_transaksi: string | null
  rc: string | null
  rc_description: string | null
  status_transaksi: string | null // VARCHAR, boleh null atau value apapun
  error_type: 'S' | 'N' | 'Sukses' | null
  created_at?: Date | string
}

export interface DictionaryViewEntry {
  id: number
  id_app_identifier: number
  app_name: string
  jenis_transaksi: string | null
  rc: string
  rc_description: string | null
  error_type: 'S' | 'N' | 'Sukses'
}

