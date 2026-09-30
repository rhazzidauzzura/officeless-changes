# Auto-snapshot + analisis perubahan (dijalankan oleh tugas terjadwal Claude)

Dokumen ini adalah instruksi yang diikuti Claude di setiap run terjadwal.
Engineer tidak perlu melakukan apa pun. Mereka cukup kerja di Studio Dev.

## Langkah setiap run

1. `git checkout main && git pull`.
2. Untuk setiap project di `projects/` (saat ini: `testing-mcp` = Officeless project `wGki1P0fpJch`):
   - Tarik lewat konektor Officeless: `studio_list_workflows` (limit 100, semua halaman), `studio_list_tables`,
     `studio_list_form` lalu `studio_get_form` per form, `studio_list_pages` lalu `studio_get_custom_layout`
     dan `studio_get_custom_element` per page.
   - Simpan setiap response mentah ke `raw/` (di-ignore git), lalu jalankan
     `python3 tools/officeless_sync.py explode <kind> raw/<file>.json --project <slug>`.
   - Catat `updated_by` dan `updated_at` dari response mentah untuk setiap resource yang berubah.
     Nilai ini TIDAK disimpan di file repo, hanya ditulis di deskripsi PR.
3. `python3 tools/officeless_sync.py changes`. Kalau hasilnya kosong, selesai (tidak ada PR).
4. `python3 tools/officeless_sync.py check`. Kalau gagal, tetap buat PR dan tulis masalahnya di bagian Risiko.
5. Cek apakah sudah ada PR terbuka berlabel `auto-snapshot` untuk project yang sama:
   - Ada: checkout branch-nya, commit perubahan baru di atasnya, lalu perbarui deskripsi PR.
   - Tidak ada: buat branch `auto/<project>-<YYYYMMDD-HHmm>` (WIB), commit, push, lalu buka PR ke `main`
     dengan label `auto-snapshot`. Reviewer ditentukan oleh CODEOWNERS.
6. Tulis deskripsi PR dengan format di bawah, berdasarkan `git diff main -- projects/`.

## Format deskripsi PR

```markdown
> 🤖 PR otomatis dari snapshot Studio pukul <HH:mm WIB>. Bagian "Kemungkinan alasan" adalah
> **analisis Claude dari kode**, bukan keterangan engineer. Reviewer: konfirmasi ke pengubah bila ragu.

## Ringkasan
<1–2 kalimat: apa yang berubah dan efek bisnis utamanya>

## Resource yang berubah
| Tipe | Nama | ID | Status | Diubah oleh (user_company_id) | Waktu (WIB) |
|---|---|---|---|---|---|

## Analisis per resource
### <Nama resource>
**Apa yang berubah**
- <perubahan konkret; sebut nilai lama → baru, nama blok/field>

**Kemungkinan alasan** (dugaan, tingkat keyakinan: tinggi / sedang / rendah)
- <alasan paling masuk akal berdasarkan kode, komentar, deskripsi workflow, nama tiket bila ada>

**Dampak & risiko**
- <siapa/data apa yang terdampak; perubahan trigger/jadwal/is_active; potensi bug>

**Saran tes**
- <langkah tes spesifik di Dev>

## Checklist reviewer
- [ ] Alasan perubahan sudah dikonfirmasi ke pengubah
- [ ] Sudah dites di Dev
- [ ] Aman untuk di-Publish ke Prod
```

## Aturan analisis

- Bedakan **fakta** (terlihat di diff) dan **dugaan** (alasan). Jangan pernah menulis dugaan sebagai fakta.
- Kalau alasan tidak bisa ditebak, tulis "Tidak jelas dari kode, perlu konfirmasi ke pengubah".
- Selalu tandai dengan ⚠️: perubahan `is_active`, jadwal scheduler, URL API, relasi/primary key form,
  penghapusan kolom atau resource, dan panggilan API eksternal baru.
- Jangan menyalin nilai secret, token, email, atau data pribadi ke deskripsi PR.
- Sumber petunjuk alasan (urut prioritas): komentar di kode (`// CHANGE: ...`), field `description` workflow,
  nama blok, pola perubahan.

## Tips untuk engineer (opsional, supaya analisis lebih akurat)

Tulis satu baris komentar di blok JS yang diubah, misalnya:

```js
// CHANGE: OPS-123 syarat hari kerja jadi 22 sesuai kebijakan HR baru
```

Claude akan memakainya sebagai alasan utama (keyakinan: tinggi).
