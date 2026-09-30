# Officeless Change Control

Repo ini adalah **sumber kebenaran (source of truth)** untuk konfigurasi Officeless Studio: workflow (termasuk JavaScript-nya), form, table, page, dan custom element. Semua perubahan lewat **Pull Request**, sehingga setiap perubahan punya diff, reviewer, dan riwayat.

> Officeless belum punya versioning/diff bawaan untuk kode. Repo ini mengisi celah itu.

## Struktur

```
projects/
  testing-mcp/                      # 1 folder per project Officeless
    workflows/<nama>__<id>/
      workflow.json                 # konfigurasi workflow; blok JS ditulis "@file:NN-xxx.js"
      01-<nama-blok>.js             # kode tiap blok JavaScript, bisa di-diff baris per baris
    forms/<nama>__<id>.json
    tables/<nama>__<id>.json        # skema kolom saja (tanpa data record)
    pages/<nama>__<id>/
      page.json
      custom_layout.json
      custom_elements/<nama>__<id>/{element.json,index.html,style.css,script.js}
tools/officeless_sync.py            # explode / assemble / check
```

Yang **sengaja tidak disimpan**: `updated_at`, `updated_by`, `edited_by`, dan seluruh nilai **Environment Variables** (global & project). Kredensial tetap di Officeless (Env Var tipe *Secret*), bukan di Git.

## Alur kerja (PR)

```
 main  ─────●──────────────●──────────────●────►   = kondisi Prod yang disetujui
             \            /
  feature/xxx ●──●──●────●   PR → review → CI hijau → merge
                         │
                         └─► apply ke Studio (Dev) → tes → Publish ke Prod
```

1. **Buat branch** dari `main`: `feature/<tiket>-<ringkas>` atau `fix/...`.
2. **Ubah file** (mis. `02-fetch-....js`). Jangan ubah ID atau `@file:` reference kecuali memang disengaja.
3. **Jalankan cek lokal**: `python3 tools/officeless_sync.py check`
4. **Buka PR** — isi template (resource yang diubah, cara tes, dampak). CI menjalankan `check` otomatis.
5. **Review**: minimal 1 approval dari CODEOWNERS. Reviewer fokus ke diff `.js` dan perubahan field/relasi.
6. **Apply ke Dev** setelah approve (sebelum/sesudah merge sesuai kesepakatan tim):
   - Rakit payload: `python3 tools/officeless_sync.py assemble workflow projects/testing-mcp/workflows/<folder> > payload.json`
   - Terapkan lewat Claude + konektor Officeless (`studio_update_workflow` / `studio_update_form` / `studio_update_custom_element`) atau manual di Studio.
7. **Tes di Dev** → **Publish ke Prod** → merge PR (kalau belum). Tulis link Run History di komentar PR.

## Pelacakan perubahan & drift

Snapshot ulang dari Studio (lewat Claude + konektor Officeless) lalu bandingkan dengan `main`:

- Hasil **sama** → Studio sesuai repo.
- Ada **diff** → seseorang mengubah langsung di Studio tanpa PR (*drift*). Snapshot di-commit ke branch `drift/<tanggal>` dan dibuka sebagai PR supaya bisa di-review: diterima (merge) atau dikembalikan (apply ulang versi `main`).

Snapshot ini bisa dijadwalkan harian.

## Aturan tim (disarankan)

- Tidak ada edit langsung di Studio **Prod**. Hotfix darurat boleh, tapi wajib PR "backfill" di hari yang sama.
- Satu PR = satu perubahan logis.
- Jangan pernah menulis secret literal di kode. Gunakan `_variableProjectSecret.*`.
- Workflow `is_active` berubah = sebutkan jelas di PR (efeknya langsung ke scheduler/API).

## Perintah

| Perintah | Fungsi |
|---|---|
| `python3 tools/officeless_sync.py explode workflows raw.json --project testing-mcp` | Response API → file repo |
| `python3 tools/officeless_sync.py explode form raw.json --project testing-mcp` | idem untuk form (juga `tables`, `page`, `custom_layout`, `custom_element --page-id <id>`) |
| `python3 tools/officeless_sync.py assemble workflow <dir>` | File repo → payload update workflow |
| `python3 tools/officeless_sync.py assemble custom_element <dir>` | File repo → payload update custom element |
| `python3 tools/officeless_sync.py check` | Validasi JSON, sintaks JS, `@file:` reference, dan deteksi secret |
