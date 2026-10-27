# Minecraft Anti-AFK

Bot Minecraft berbasis Node.js dengan konfigurasi `settings.json`, aksi anti-AFK, reconnect otomatis, dan dashboard status. Build default dan runner Vercel mendukung Java Edition. Bedrock hanya dapat dijalankan lokal setelah dependency native-nya disiapkan manual.

## Persiapan

1. Pasang Node.js 20 atau lebih baru.
2. Dari folder proyek, jalankan `npm install`.
3. Edit `settings.json`: isi alamat server dan nama bot.
4. Untuk instalasi standar atau Vercel, gunakan `"server": { "edition": "java" }`.
5. Jalankan `npm start`.

Build standar memasang dependency untuk Java Edition. Dependency Bedrock tidak dipasang otomatis karena `bedrock-protocol` membawa `raknet-native`, yang membutuhkan native build tools dan gagal pada build Vercel. Untuk Bedrock, install `bedrock-protocol` secara manual hanya di lingkungan lokal yang sudah memiliki persyaratan native build; Bedrock tidak tersedia pada deployment Vercel ini.

## Menggunakan server Aternos Java

Jika server Aternos Anda mengizinkan pemain bajakan/cracked, server Java tersebut menggunakan autentikasi offline. Bot sudah dikonfigurasi untuk autentikasi offline, jadi Anda tidak perlu memasukkan password atau token akun.

1. Pastikan server Aternos sudah dinyalakan dan pengaturan cracked/offline di Aternos aktif.
2. Dari halaman server Aternos, salin alamat server dan port yang ditampilkan.
3. Masukkan nilai tersebut ke `settings.json`. Jangan gunakan `127.0.0.1` untuk server Aternos.
4. Jalankan bot dari komputer Anda dengan `npm start` saat server Aternos aktif.

Contoh `settings.json` Aternos (ganti alamat, nama, dan port sesuai panel Anda):

```json
{
  "name": "Minecraft AFK BOT",
  "bot-account": {
    "username": "AntiAfkBot",
    "password": "",
    "type": "offline"
  },
  "server": {
    "edition": "java",
    "ip": "alamat-server-anda.aternos.me",
    "port": 25565,
    "version": "1.20.4"
  },
  "utils": {
    "anti-afk": {
      "enabled": true,
      "sneak": true,
      "intervalSeconds": 300
    }
  },
  "modules": {
    "chat": true,
    "console-commands": true
  }
}
```

Port default Java adalah `25565`, sedangkan Bedrock `19132`. Isi `server.port` sesuai nilai di panel Aternos dan ubah `server.version` bila diperlukan.

`bot-account.type` dikunci ke `"offline"` dan dipakai sebagai mode autentikasi Mineflayer. Server yang mewajibkan autentikasi Microsoft/Xbox Live tidak didukung oleh konfigurasi ini. Ikuti aturan Aternos dan server Anda; bot tidak menjamin server tetap online atau bahwa kebijakan AFK server dapat dilewati.

## UI React dan deployment ke Vercel

UI dibuat dengan React + Vite. Jalankan `npm install` lalu `npm run dev` untuk development lokal, atau `npm run build` untuk menghasilkan UI produksi di `dist/`.

1. Pastikan `settings.json` berisi alamat Aternos dan nama bot yang benar, lalu push project ke GitHub.
2. Import repository ke Vercel. `vercel.json` mengatur build React dengan Vite, output ke `dist/`, dan menyertakan `settings.json` ke function status.
3. Buka URL deployment. Dashboard React meminta `GET /api/status`; endpoint menginisialisasi Mineflayer pada runtime function dan mengembalikan status koneksi bot.
4. Lihat Vercel Runtime Logs jika status tidak berubah ke `Online`.

Untuk memakai dashboard, tambahkan environment variable `DASHBOARD_TOKEN` di pengaturan project Vercel (gunakan token acak minimal 32 karakter), lalu redeploy. Saat membuka UI, masukkan token tersebut. Token hanya disimpan di `sessionStorage` tab browser dan tidak dimasukkan ke `settings.json`. API menolak token yang lebih pendek.

Bagian **Minecraft Console** mengirim teks ke chat sebagai akun bot; input yang diawali `/` meneruskan perintah chat Minecraft jika `modules.console-commands` aktif. Ini bukan shell OS dan tidak menjalankan command pada sistem Vercel. Log koneksi, error, aktivitas anti-AFK, serta chat server masuk akan terlihat di panel log. Log disimpan sementara di memori runtime; runtime Vercel yang berbeda dapat memiliki riwayat berbeda.

Dashboard juga menampilkan pemain yang ada di tab list Minecraft yang diterima bot. Fitur **Bot aktif** dapat menambah atau menghapus bot offline dari dashboard; batasnya 3 bot total, termasuk bot utama. Nama bot tambahan harus unik dan mengikuti format username Minecraft (3–16 huruf/angka/underscore). Bot tambahan hanya disimpan di memori runtime, bukan database; jika Vercel mengganti instance, bot tambahan dan daftar log instance tersebut hilang. Nama yang disamarkan server (misalnya plugin vanish) tidak dapat diketahui dari tab list.

Vercel dapat mendaur ulang function instance atau membuat instance baru. Status dalam dashboard mencerminkan instance yang sedang melayani request, bukan jaminan proses tunggal selalu hidup tanpa putus; setelah cold start/deploy, bot akan dimulai lagi ketika endpoint status dipanggil. Dashboard melakukan polling berkala agar status tetap diperbarui. Jika deployment Anda tidak mempertahankan sesi seperti yang diharapkan, jalankan bot sebagai worker persisten atau gunakan konfigurasi runtime lain yang telah Anda verifikasi.

Deployment Vercel menjalankan Java Edition. `bedrock-protocol` sengaja tidak ada di dependency manifest, sehingga sekalipun Vercel memakai perintah `npm install` default, ia tidak akan mencoba membangun `raknet-native`.

Jika deployment yang sudah ada masih menampilkan error `raknet-native`, pastikan perubahan terbaru pada `package.json` sudah di-push ke branch yang terhubung ke Vercel, lalu pilih **Redeploy without cache**. Jika project mempunyai `package-lock.json`, push juga lockfile yang diperbarui bersama manifest.

Jangan menyimpan password akun Microsoft atau token login di `settings.json`. Runner Vercel ini memakai autentikasi offline.

## Pemeriksaan

Jalankan `npm run check` untuk memeriksa sintaks JavaScript dan membangun UI React.

Bot tidak menjamin lolos dari setiap kebijakan atau sistem AFK server. Ikuti aturan server dan hentikan bot dengan `Ctrl+C`.
