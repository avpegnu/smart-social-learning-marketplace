# Phase 6.3 — CI/CD Troubleshooting: Debug SSH Authentication Failed

> Tài liệu tổng hợp quá trình debug lỗi `ssh: handshake failed` khi GitHub Actions deploy SSLM lên production server, và quy trình fix sạch từ đầu khi quên SSH key.
>
> **Ngày xử lý:** 2026-05-19
> **Server:** Ubuntu 24.04 LTS @ 180.93.42.176
> **Workflow:** `.github/workflows/deploy.yml` (sử dụng `appleboy/ssh-action@v1`)

---

## Mục lục

1. [Triệu chứng & Error log](#1-triệu-chứng--error-log)
2. [Mô hình SSH Key Authentication](#2-mô-hình-ssh-key-authentication)
3. [Các nguyên nhân đã phát hiện](#3-các-nguyên-nhân-đã-phát-hiện)
4. [Quy trình debug — Diagnostic Flow](#4-quy-trình-debug--diagnostic-flow)
5. [Quy trình fix sạch — 4 Phase](#5-quy-trình-fix-sạch--4-phase)
6. [Lệnh tham khảo & giải thích từng flag](#6-lệnh-tham-khảo--giải-thích-từng-flag)
7. [Lessons Learned & Best Practices](#7-lessons-learned--best-practices)
8. [Troubleshooting Checklist](#8-troubleshooting-checklist)

---

## 1. Triệu chứng & Error log

### Log GitHub Actions

```
Run appleboy/ssh-action@v1
Downloading drone-ssh-1.8.2-linux-amd64 from https://github.com/appleboy/drone-ssh/releases/download/v1.8.2
======= CLI Version Information =======
Drone SSH version 1.8.2
========================================
2026/05/18 04:53:15 ssh: handshake failed: ssh: unable to authenticate,
attempted methods [none], no supported methods remain
Error: Process completed with exit code 1.
```

### Ý nghĩa error

| Cụm từ | Ý nghĩa |
|--------|---------|
| `handshake failed` | SSH connection tới server thiết lập được, nhưng giai đoạn authenticate fail |
| `attempted methods [none]` | Client không thử được phương thức auth nào (key parse fail hoặc bị từ chối ngay) |
| `no supported methods remain` | Hết phương thức để fallback (vì action chỉ có key, không có password) |

→ Đây KHÔNG phải lỗi network/firewall. Connection tới port 22 OK. Vấn đề nằm ở **layer authentication**.

### Workflow file liên quan

```yaml
# .github/workflows/deploy.yml
- name: Deploy via SSH
  uses: appleboy/ssh-action@v1
  with:
    host: ${{ secrets.SERVER_HOST }}      # IP server
    username: ${{ secrets.SERVER_USER }}  # User SSH
    key: ${{ secrets.SERVER_SSH_KEY }}    # Private key
    script: ~/deploy.sh
```

3 GitHub Secrets cần đúng đồng thời:
- `SERVER_HOST` = `180.93.42.176`
- `SERVER_USER` = `vanh`
- `SERVER_SSH_KEY` = nội dung private key matching với public key trong `authorized_keys` của user `vanh`

---

## 2. Mô hình SSH Key Authentication

### Cách hoạt động

```
┌──────────────────┐                    ┌──────────────────┐
│  GitHub Actions   │                    │   Production     │
│   (Ubuntu VM)     │  ─── SSH ────►     │     Server       │
│                   │                    │   (180.93.42.176)│
│ SERVER_SSH_KEY    │                    │ ~/.ssh/          │
│  = private key    │  ◄── verify ────   │   authorized_keys│
│                   │                    │   = public keys  │
└──────────────────┘                    └──────────────────┘
```

### 3 điều kiện BẮT BUỘC để auth thành công

| # | Điều kiện | Verify bằng |
|---|-----------|-------------|
| 1 | **Private key trên client** và **public key trên server** phải là **MỘT CẶP** (matching pair) | So fingerprint |
| 2 | **`sshd_config` cho phép** `PubkeyAuthentication yes` | `sudo sshd -T \| grep pubkey` |
| 3 | **Permissions** của `~`, `~/.ssh`, `~/.ssh/authorized_keys` phải đúng (không quá lỏng) | `ls -ld` |

Thiếu 1 trong 3 → server từ chối publickey → client fallback hoặc fail.

### Fingerprint concept

Mỗi keypair có **fingerprint duy nhất** = SHA256 của public key. Dùng để verify 2 file (private vs public) có phải cùng cặp.

```bash
ssh-keygen -lf ~/.ssh/sslm_deploy        # Fingerprint của private key
ssh-keygen -lf ~/.ssh/sslm_deploy.pub    # Fingerprint của public key
ssh-keygen -lf ~/.ssh/authorized_keys    # Fingerprint của các public key trong authorized_keys
```

→ **3 lệnh này phải ra cùng 1 fingerprint** (giả định cùng 1 key) → đảm bảo cặp khớp.

---

## 3. Các nguyên nhân đã phát hiện

Quá trình debug phát hiện **3 nguyên nhân riêng biệt** xảy ra cùng lúc.

### 🐛 Nguyên nhân #1 — Cặp key trên server bị "lệch" (mismatched pair)

Server có sẵn 2 cặp key cũ trong `~/.ssh/`:

```
deploy_key            (private, 399 bytes)
deploy_key.pub        (public, 88 bytes)
github_deploy         (private, 411 bytes)
github_deploy.pub     (public, 103 bytes)
```

Khi diagnostic:

```bash
ssh-keygen -lf ~/.ssh/deploy_key.pub
# → SHA256:Mbza8GlD4RLag9rEg5ZLbHBQ2OBEFq0LMJRHxdcUm3g
```

Nhưng SSH client lúc connect lại offer:

```
debug1: Will attempt key: ... SHA256:PdmAe+w5cw3dIiM1AHT4D8jdCxu3AARF1+KaVpMfB5M
```

→ **Fingerprint khác hoàn toàn**: file `deploy_key` (private) và `deploy_key.pub` (public) trên server **không phải 1 cặp**. Có thể 1 trong 2 file đã bị overwrite trước đó mà không tạo lại cái còn lại.

**Bài học:** Khi quên/mất key, đừng đoán mò file nào ghép với file nào — tạo cặp mới từ đầu.

### 🐛 Nguyên nhân #2 — Local Windows làm hỏng file private key

Sau khi scp key về `C:\Users\Vanh\.ssh\sslm_deploy`:

```powershell
ssh-keygen -lf $HOME\.ssh\sslm_deploy
# → SHA256:PdmAe...   (KHÔNG match server)

# Trong khi server cùng file đó:
ssh-keygen -lf ~/.ssh/sslm_deploy
# → SHA256:tZFChUdHd...
```

Cùng tên file, scp xong, **fingerprint local KHÁC server** — nghĩa là nội dung file thực tế bị thay đổi sau khi scp.

**Nghi phạm:**
- OneDrive backup folder `C:\Users\Vanh\` đang sync và revert file
- Windows Defender quarantine private key
- Antivirus chặn

**Cách bypass:** Lưu key vào ổ khác, ngoài `C:\Users\` (vd: `D:\ssh-keys\`) — chỗ không bị sync.

```powershell
New-Item -ItemType Directory -Force D:\ssh-keys | Out-Null
scp vanh@180.93.42.176:~/.ssh/sslm_deploy D:\ssh-keys\sslm_deploy
ssh-keygen -lf D:\ssh-keys\sslm_deploy
# → Bây giờ match server: SHA256:tZFChUdHd...
```

### 🐛 Nguyên nhân #3 — `PubkeyAuthentication no` trong sshd_config

**Đây là nguyên nhân CHÍNH** — kể cả 2 vấn đề trên fix xong, server vẫn từ chối publickey.

Diagnostic:

```bash
sudo sshd -T | grep -Ei "pubkey|password"
# pubkeyauthentication no             ← THỦ PHẠM!
# passwordauthentication yes
```

Tìm file đang set:

```bash
sudo grep -rln "PubkeyAuthentication no" /etc/ssh/
# /etc/ssh/sshd_config
# /etc/ssh/sshd_config.d/99-cloud-init.conf
```

Cả 2 file đều set `no` (cloud-init template + sshd_config chính). SSH client offer key đúng đến đâu cũng vô ích vì sshd không nhận publickey method.

**Triệu chứng dễ nhận biết:** trong `ssh -v` log, server response ngay từ đầu:
```
debug1: Authentications that can continue: password
```
(chỉ có `password`, không có `publickey` trong danh sách)

---

## 4. Quy trình debug — Diagnostic Flow

Khi gặp lỗi tương tự, làm theo thứ tự dưới đây.

### Step 1 — Đọc workflow file để xác định secrets cần

```bash
cat .github/workflows/deploy.yml
```

Ghi nhớ tên các secret được dùng (vd: `SERVER_HOST`, `SERVER_USER`, `SERVER_SSH_KEY`).

⚠️ **GitHub không cho xem giá trị secret sau khi save** — chỉ có thể Update (ghi đè) hoặc Delete. Không có cách nào recover giá trị cũ.

### Step 2 — Đọc deployment docs để biết giá trị mong đợi

```bash
cat docs/phase6-deployment/02-cicd-guide.md | grep -A 5 "Secret Name"
```

Nếu trong docs có ghi giá trị (vd: IP server, username), confirm match với hiện trạng.

### Step 3 — Verify cặp key trên server

SSH vào server bằng password, kiểm tra `~/.ssh/`:

```bash
ls -la ~/.ssh/
```

Nếu có nhiều file `*_key` / `*.pub` không rõ:

```bash
# Fingerprint của tất cả file
for f in ~/.ssh/*; do
  echo "--- $f ---"
  ssh-keygen -lf "$f" 2>/dev/null
done

# Fingerprint authorized_keys
ssh-keygen -lf ~/.ssh/authorized_keys
```

**So fingerprint:** Public key trong `authorized_keys` phải có 1 dòng match với private key bạn định dùng. Nếu không match → cặp lệch → tạo cặp mới.

### Step 4 — Verify sshd config cho phép publickey

```bash
sudo sshd -T | grep -Ei "pubkey|password|authorizedkeys"
```

Output mong đợi:
```
pubkeyauthentication yes              ← BẮT BUỘC
passwordauthentication yes (hoặc no, không quan trọng cho GH Actions)
authorizedkeysfile .ssh/authorized_keys .ssh/authorized_keys2
```

Nếu `pubkeyauthentication no` → đây là vấn đề. Xem [Step 6](#step-6--fix-sshd-config-nếu-tắt-publickey).

### Step 5 — Verify permissions

```bash
ls -ld ~ ~/.ssh ~/.ssh/authorized_keys
```

Output đúng:
```
drwx------ ... /home/vanh                       (700)
drwx------ ... /home/vanh/.ssh                  (700)
-rw-------  1 vanh vanh ... authorized_keys     (600)
```

Sai → fix:
```bash
chmod 700 ~ ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

### Step 6 — Fix sshd config nếu tắt publickey

```bash
# Tìm file nào set "no"
sudo grep -rln "PubkeyAuthentication no" /etc/ssh/

# Sửa tất cả file đó (replace "no" → "yes")
sudo sed -i 's/PubkeyAuthentication no/PubkeyAuthentication yes/' \
  /etc/ssh/sshd_config \
  /etc/ssh/sshd_config.d/99-cloud-init.conf

# Test config trước khi reload
sudo sshd -t
# Không in gì = OK. In lỗi = đừng reload, fix lỗi trước.

# Reload sshd
sudo systemctl reload ssh

# Verify effective config
sudo sshd -T | grep pubkeyauth
# pubkeyauthentication yes  ← phải có "yes"
```

⚠️ **Không đóng SSH session hiện tại** trước khi confirm SSH publickey hoạt động. Nếu reload sshd làm gì đó hỏng, session đang mở vẫn vào được để recover.

### Step 7 — Test SSH publickey từ máy local

Trên PowerShell máy local (KHÔNG dùng path trong `C:\Users\` để tránh OneDrive sync):

```powershell
# Test SSH với verbose
ssh -i D:\ssh-keys\sslm_deploy -v vanh@180.93.42.176
```

Tìm 2 dòng quan trọng trong output:

✅ **Pass:**
```
debug1: Will attempt key: ... SHA256:<fingerprint> explicit
...
Authenticated to 180.93.42.176 ([180.93.42.176]:22) using "publickey"
```

❌ **Fail:**
```
debug1: Authentications that can continue: password
debug1: Next authentication method: password
vanh@180.93.42.176's password:
```

Nếu fail mặc dù mọi thứ đúng → check log sshd trên server lúc thử SSH:

```bash
sudo tail -f /var/log/auth.log
```

Tìm dòng có `Failed`, `error:`, hoặc `Accepted publickey` để biết lý do chính xác.

---

## 5. Quy trình fix sạch — 4 Phase

Khi đã chắc cần làm lại từ đầu (vd: quên hết key, không rõ key nào dùng cho gì).

### Phase 1 — Dọn sạch server

SSH vào server (bằng password). **Giữ session này mở suốt 4 phase** để tránh bị khóa.

```bash
# 1. Backup authorized_keys
cp ~/.ssh/authorized_keys ~/.ssh/authorized_keys.bak

# 2. Xóa tất cả file key cũ (tránh lẫn lộn)
rm -f ~/.ssh/deploy_key ~/.ssh/deploy_key.pub
rm -f ~/.ssh/github_deploy ~/.ssh/github_deploy.pub
rm -f ~/.ssh/sslm_deploy ~/.ssh/sslm_deploy.pub
# (Liệt kê thêm các file key khác nếu có)

# 3. Reset authorized_keys về rỗng (sẽ thêm key mới ở Phase 2)
> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# 4. Verify
ls -la ~/.ssh/
cat ~/.ssh/authorized_keys   # phải rỗng
```

### Phase 2 — Tạo cặp key mới trên server

```bash
# 1. Generate ed25519 keypair
ssh-keygen -t ed25519 -C "sslm-deploy" -f ~/.ssh/sslm_deploy -N ""

# 2. Append public key vào authorized_keys
cat ~/.ssh/sslm_deploy.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# 3. Verify — 3 fingerprint phải GIỐNG NHAU
echo "=== Private key ==="
ssh-keygen -lf ~/.ssh/sslm_deploy
echo "=== Public key ==="
ssh-keygen -lf ~/.ssh/sslm_deploy.pub
echo "=== authorized_keys ==="
ssh-keygen -lf ~/.ssh/authorized_keys
echo "=== Derived from private seed (must match .pub) ==="
ssh-keygen -y -f ~/.ssh/sslm_deploy
```

Ghi nhớ fingerprint mới (gọi là `FP_NEW`).

### Phase 3 — Test SSH từ máy local

Mở PowerShell **trên máy local** (KHÔNG đóng SSH session trên server):

```powershell
# 1. Tạo folder ngoài C:\Users\ để tránh OneDrive sync
New-Item -ItemType Directory -Force D:\ssh-keys | Out-Null

# 2. Tải private key về D:\
scp vanh@180.93.42.176:~/.ssh/sslm_deploy D:\ssh-keys\sslm_deploy

# 3. Set permission đúng cho file trên Windows
icacls D:\ssh-keys\sslm_deploy /inheritance:r /grant:r "${env:USERNAME}:F"

# 4. Verify fingerprint local KHỚP với FP_NEW từ server
ssh-keygen -lf D:\ssh-keys\sslm_deploy
# → phải ra fingerprint đã ghi nhớ ở Phase 2

# 5. Test SSH với verbose
ssh -i D:\ssh-keys\sslm_deploy -v vanh@180.93.42.176
```

Tiêu chí pass:
- Bước 4: fingerprint match `FP_NEW`
- Bước 5: cuối log có `Authenticated to 180.93.42.176 ([180.93.42.176]:22) using "publickey"`
- Vào được shell không hỏi password

❌ Nếu vẫn fail → quay lại [Step 4-6](#step-4--verify-sshd-config-cho-phép-publickey) check sshd config.

### Phase 4 — Đẩy private key lên GitHub Secret

#### Cách reliable nhất — `gh` CLI trên server (recommend)

Pipe trực tiếp từ file, **không qua clipboard** → không lo line ending, BOM, whitespace.

```bash
# 1. Cài gh nếu chưa có
which gh || (sudo apt update && sudo apt install gh -y)

# 2. Login (chỉ làm 1 lần đầu)
gh auth login
# Chọn: GitHub.com → HTTPS → Y → Login with web browser
# Copy 8-digit code, paste vào browser, authorize

# 3. Set secret từ file
gh secret set SERVER_SSH_KEY < ~/.ssh/sslm_deploy \
  --repo avpegnu/smart-social-learning-marketplace

# 4. Verify
gh secret list --repo avpegnu/smart-social-learning-marketplace
# SERVER_SSH_KEY phải có "Updated <thời gian gần đây>"
```

#### Cách thủ công — copy/paste (nếu không muốn cài gh)

```bash
# Trên server, in nội dung key
cat ~/.ssh/sslm_deploy
```

Bôi đen từ dòng `-----BEGIN OPENSSH PRIVATE KEY-----` đến hết `-----END OPENSSH PRIVATE KEY-----` → copy.

Vào GitHub → repo → **Settings → Secrets and variables → Actions** → `SERVER_SSH_KEY` → bút chì **Update**:
1. Click vào ô **Value** → **Ctrl+A → Delete** (xóa hoàn toàn)
2. **Ctrl+V** paste
3. Ấn **End** → **Enter** 1 lần (đảm bảo có newline cuối)
4. Bấm **Update secret**

⚠️ Cách này thường fail do clipboard Windows convert `\n` → `\r\n` hoặc thêm BOM. Nếu deploy vẫn fail với `attempted methods [none]` sau khi paste → switch sang `gh` CLI.

#### Trigger deploy

```powershell
# Trên local
git commit --allow-empty -m "chore: trigger deploy"
git push
```

Vào tab **Actions** → run mới phải pass step `Deploy via SSH`.

### Phase 5 (Optional) — Cleanup sau khi xác nhận chạy được

```bash
# Trên server, xóa backup (nếu không cần)
rm ~/.ssh/authorized_keys.bak
```

Bật lại `PasswordAuthentication no` nếu muốn tăng bảo mật (chỉ cho phép publickey):

```bash
# Chỉ làm sau khi 100% chắc publickey hoạt động
sudo sed -i 's/^PasswordAuthentication yes/PasswordAuthentication no/' \
  /etc/ssh/sshd_config /etc/ssh/sshd_config.d/*.conf
sudo sshd -t && sudo systemctl reload ssh
```

---

## 6. Lệnh tham khảo & giải thích từng flag

### `ssh-keygen` — Tạo và inspect keys

```bash
ssh-keygen -t ed25519 -C "sslm-deploy" -f ~/.ssh/sslm_deploy -N ""
```

| Flag | Ý nghĩa |
|------|---------|
| `-t ed25519` | Thuật toán Ed25519 — hiện đại, ngắn (32 bytes), nhanh, an toàn hơn RSA |
| `-C "sslm-deploy"` | Comment/label gắn vào key, để nhận biết khi có nhiều key |
| `-f <path>` | Đường dẫn lưu file. Tạo 2 file: `<path>` (private) + `<path>.pub` (public) |
| `-N ""` | Passphrase rỗng — BẮT BUỘC cho automation (GitHub Actions không thể nhập passphrase) |
| `-y -f <private>` | Derive public key từ private seed (verify cặp key khớp) |
| `-lf <file>` | List fingerprint của key (private/public/authorized_keys đều dùng được) |

### `ssh` — Connect và debug

```bash
ssh -i D:\ssh-keys\sslm_deploy -v vanh@180.93.42.176
```

| Flag | Ý nghĩa |
|------|---------|
| `-i <path>` | Chỉ định private key cụ thể (không dùng default `~/.ssh/id_*`) |
| `-v` | Verbose — in chi tiết quá trình kết nối + auth |
| `-vv`, `-vvv` | Verbose level 2, 3 — chi tiết hơn nữa |
| `-o PreferredAuthentications=publickey` | Ép chỉ thử publickey, không fallback password |
| `-o IdentitiesOnly=yes` | Chỉ dùng key được chỉ định, không thử các key khác |

### `scp` — Copy file qua SSH

```bash
scp vanh@180.93.42.176:~/.ssh/sslm_deploy D:\ssh-keys\sslm_deploy
```

- Format: `scp <source> <destination>`
- Có thể remote → local hoặc ngược lại
- Mặc định dùng port 22 và SSH key chuẩn

### `icacls` — Set permission file trên Windows

```powershell
icacls D:\ssh-keys\sslm_deploy /inheritance:r /grant:r "${env:USERNAME}:F"
```

| Flag | Ý nghĩa |
|------|---------|
| `/inheritance:r` | Remove inherited permissions (chỉ giữ explicit perm) |
| `/grant:r <user>:F` | Replace permissions, grant Full control cho user hiện tại |

OpenSSH trên Windows từ chối dùng private key nếu file readable bởi user khác → lệnh này bắt buộc.

### `sshd -T` — Show effective sshd config

```bash
sudo sshd -T | grep -Ei "pubkey|password|authorizedkeys"
```

- `-T` = Test mode + dump effective config (sau khi merge tất cả `Include`, `Match` blocks)
- Khác với `cat /etc/ssh/sshd_config` — chỉ thấy file đơn lẻ, không thấy override

### `sshd -t` — Test sshd config syntax

```bash
sudo sshd -t
```

- `-t` = Test only, không reload
- Không in gì = config hợp lệ. In lỗi = config sai, ĐỪNG reload sshd kẻo bị khóa.

### `systemctl reload ssh` — Reload sshd

```bash
sudo systemctl reload ssh
```

- `reload` = re-read config mà KHÔNG đóng connection hiện tại (an toàn)
- `restart` = kill và start lại sshd, đóng tất cả connection (NGUY HIỂM nếu config sai)

### `gh secret set` — Set GitHub Secret từ file

```bash
gh secret set SERVER_SSH_KEY < ~/.ssh/sslm_deploy \
  --repo owner/repo
```

- `<` = redirect file content vào stdin
- `gh` đọc stdin và post lên GitHub API (sử dụng libsodium để mã hóa)
- Bảo toàn byte-by-byte → tránh các vấn đề về clipboard/line ending

### `sed -i` — In-place edit file

```bash
sudo sed -i 's/PubkeyAuthentication no/PubkeyAuthentication yes/' /etc/ssh/sshd_config
```

| Phần | Ý nghĩa |
|------|---------|
| `-i` | In-place (sửa trực tiếp file, không cần redirect) |
| `s/<old>/<new>/` | Substitute — thay `old` bằng `new` |
| Có thể chỉ định nhiều file | Sed xử lý lần lượt từng file |

---

## 7. Lessons Learned & Best Practices

### 🎯 Khi setup SSH key cho CI/CD

1. **Đặt tên key rõ ràng** (`-C "sslm-deploy-github-actions"`) để biết key dùng cho mục đích gì khi sau này nhìn lại.
2. **Document fingerprint của key** vào nội bộ (vd: encrypted vault, password manager) → tra cứu khi nghi ngờ.
3. **Mỗi service / use case → 1 cặp key riêng**. Không tái sử dụng key của personal SSH cho GitHub Actions.
4. **Backup private key offline** (USB encrypted, password manager) ngay sau khi tạo → khỏi mất.

### 🎯 Khi đẩy private key lên GitHub Secret

1. **Ưu tiên `gh secret set < file`** thay vì copy-paste qua clipboard. Reliable hơn nhiều.
2. **Nếu phải paste**, dùng terminal trên Linux server để `cat` (line ending `\n`), tránh PowerShell/Notepad trên Windows.
3. **Đảm bảo có newline cuối** sau `-----END...-----`.
4. **Xóa hết nội dung cũ** trước khi paste lại — đừng append.

### 🎯 Bảo mật key

1. **Đừng paste private key vào chat/IM** — coi như đã lộ, phải regenerate ngay.
2. **Đừng để private key trên server** (`~/.ssh/` thường chỉ chứa public hoặc client-side private key). Server thường chỉ cần `authorized_keys` (public).
3. **Bật `PasswordAuthentication no`** sau khi confirm publickey hoạt động → ngăn brute force.
4. **Rotate key định kỳ** (vd: 6 tháng) — đặc biệt sau khi member rời team.

### 🎯 Khi debug

1. **Đọc workflow file TRƯỚC** — biết secret nào, action nào, version nào.
2. **Đọc deployment docs** — giá trị secret mong đợi thường có ghi.
3. **`ssh -v` luôn hơn đoán** — log verbose cho biết chính xác client offer key nào, server từ chối ở step nào.
4. **`sudo sshd -T`** thay vì đọc `sshd_config` raw — thấy effective config sau merge tất cả Include/Match.
5. **`tail -f /var/log/auth.log`** trong session khác lúc thử SSH — server-side log cho biết lý do từ chối.
6. **Test local trước khi push lên GitHub** — nếu local SSH bằng key đó vào được, thì GitHub Actions cũng vào được.

### 🎯 Tránh vấn đề OneDrive/Sync trên Windows

- Không lưu SSH key trong `C:\Users\<user>\` (default OneDrive backup paths: Desktop, Documents, Pictures, sometimes whole profile).
- Lưu key ở ổ riêng (`D:\ssh-keys\`) hoặc folder ngoài OneDrive scope.
- Disable OneDrive backup cho folder `.ssh` nếu phải dùng default location.

### 🎯 Workflow `appleboy/ssh-action` specifics

- Action tự download binary `drone-ssh` rồi chạy.
- Đọc secret `key` qua ENV variable → write to temp file → use as SSH identity.
- Strict về format key: thiếu `-----BEGIN/END-----`, thiếu newline cuối, hoặc có `\r\n` → parse fail → `attempted methods [none]`.
- Bật `debug: true` trong workflow để xem chi tiết hơn lúc action chạy.

---

## 8. Troubleshooting Checklist

Khi gặp lỗi `ssh: handshake failed`, đi theo checklist sau:

```
[ ] 1. Đọc workflow file, xác định tên các secret được dùng
[ ] 2. Kiểm tra GitHub Secrets có đủ các name đó không (Settings → Secrets)
[ ] 3. SSH vào server bằng password, vào ~/.ssh/

[ ] 4. So fingerprint giữa các file:
        ssh-keygen -lf ~/.ssh/<private_key>
        ssh-keygen -lf ~/.ssh/<private_key>.pub
        ssh-keygen -lf ~/.ssh/authorized_keys
      → 3 fingerprint phải có ÍT NHẤT 1 dòng match

[ ] 5. Check sshd config:
        sudo sshd -T | grep -Ei "pubkey|password|authorizedkeys"
      → pubkeyauthentication YES (bắt buộc)
      → authorizedkeysfile có chứa .ssh/authorized_keys

[ ] 6. Check permissions:
        ls -ld ~ ~/.ssh ~/.ssh/authorized_keys
      → 700 700 600

[ ] 7. Test local SSH bằng đúng key đó:
        ssh -i <path> -v <user>@<host>
      → cuối log: "Authenticated ... using publickey"

[ ] 8. Nếu local SSH pass → push key lên GitHub Secret:
        gh secret set SERVER_SSH_KEY < <path> --repo <owner/repo>

[ ] 9. Re-run workflow:
        git commit --allow-empty -m "test deploy" && git push

[ ] 10. Nếu vẫn fail → bật debug: true trong workflow + xem log chi tiết
```

### Mapping error → nguyên nhân

| Error log | Nguyên nhân | Fix |
|-----------|-------------|-----|
| `attempted methods [none]` + server chỉ offer `password` | sshd tắt PubkeyAuthentication | [Step 6](#step-6--fix-sshd-config-nếu-tắt-publickey) |
| `attempted methods [publickey]` + `Permission denied` | Public key không có trong authorized_keys | Append `cat .pub >> authorized_keys` |
| `Authentications that can continue: publickey,password` rồi fail | Key parse fail / format sai | Re-paste secret cẩn thận, hoặc dùng `gh secret set` |
| `bad ownership or modes` trong `/var/log/auth.log` | Permission sai | `chmod 700 ~ ~/.ssh; chmod 600 ~/.ssh/authorized_keys` |
| `Connection refused` / `timeout` | Network/firewall, không phải auth | Check `SERVER_HOST`, firewall, sshd có chạy không |

---

## Tham khảo

- [01-deployment-guide.md](01-deployment-guide.md) — Setup ban đầu Ubuntu server + Nginx + SSL
- [02-cicd-guide.md](02-cicd-guide.md) — CI/CD pipeline với GitHub Actions
- [appleboy/ssh-action](https://github.com/appleboy/ssh-action) — Action used in deploy workflow
- [OpenSSH sshd_config man page](https://man.openbsd.org/sshd_config)
- [SSH key fingerprint format](https://en.wikipedia.org/wiki/Public_key_fingerprint)
