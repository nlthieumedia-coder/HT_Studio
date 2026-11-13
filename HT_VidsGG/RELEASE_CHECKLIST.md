# HT Vids Studio release checklist

## 1. Clean verification

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run desktop:setup
npm.cmd run release:verify
```

The release verifier checks the installer, bundled video tools, installer size, SHA-256 and Authenticode status.

## 2. Code signing

Electron Builder uses the standard signing environment variables:

```powershell
$env:CSC_LINK = "C:\secure\ht-studio-code-signing.pfx"
$env:CSC_KEY_PASSWORD = "<certificate password>"
$env:REQUIRE_SIGNING = "1"
npm.cmd run desktop:setup
```

Keep the certificate and password outside the repository. `REQUIRE_SIGNING=1` makes the release fail if the installer or the HT Studio watermark executable is not signed successfully.

## 3. Clean-machine matrix

- Windows 10 x64 and Windows 11 x64.
- Chrome stable only, then Edge stable only.
- Defender enabled; do not add exclusions.
- Windows user name and output path containing Vietnamese characters.
- Standard, Pro, Ultra and Domain Google accounts.
- 5, 10, 15 and 20 seconds; 720p and 1080p; portrait and landscape.
- No image and 1–3 reference images.
- Watermark removal enabled and disabled.
- Slow network, interrupted network and low disk-space cases.

Run **Kiểm tra hệ thống** before the matrix. When a case fails, use **Xuất chẩn đoán** and attach the ZIP to the private issue without adding credentials or browser profiles.

## 4. Publish

1. Copy the previous installer from `dist/latest` to `dist/old`.
2. Update `README.md`, `HUONG_DAN_SU_DUNG.md` and `update-info.json` with the verified SHA-256.
3. Commit only the public distribution files and documentation.
4. Create the signed Git tag and GitHub Release.
5. Upload the exact verified installer; never rebuild after calculating SHA-256.
6. Test both the GitHub Release URL and the in-app background updater.

The public repository intentionally excludes source code. Use a private source repository/runner if CI packaging is required; do not remove the source exclusions from `.gitignore` merely to enable a public workflow.
