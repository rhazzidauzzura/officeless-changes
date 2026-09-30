## Ringkasan perubahan
<!-- Apa yang diubah dan kenapa. Link tiket/CR jika ada. -->

## Resource Officeless yang terdampak
| Tipe | Nama | ID | Project |
|---|---|---|---|
| workflow / form / table / page / custom element | | | |

## Jenis perubahan
- [ ] Logic / JavaScript workflow
- [ ] Field / relasi form
- [ ] Skema table (kolom baru/ubah tipe) — **cek data existing**
- [ ] UI (page / custom element)
- [ ] Trigger / scheduler / `is_active` berubah

## Cara tes (di Dev)
<!-- Langkah tes + link Run History / screenshot -->

## Checklist
- [ ] `python3 tools/officeless_sync.py check` lulus
- [ ] Tidak ada secret literal (pakai `_variableProjectSecret.*`)
- [ ] Sudah di-apply & dites di **Dev**
- [ ] Rencana rollback jelas (revert PR ini lalu apply ulang)
- [ ] Setelah Publish ke Prod: link Run History ditempel di komentar
