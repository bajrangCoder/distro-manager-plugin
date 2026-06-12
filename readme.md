# Distro Manager for Acode

Manage and install multiple Linux distributions in Acode easily through a beautiful, native-looking sidebar app.

## Features

- **Sidebar Control Panel**: Fully integrated Preact UI sidebar app panel mapping to Acode's active theme colors automatically.
- **Multiple Distro Support**: Install and manage multiple Linux distributions side-by-side on separate PTY ports.
- **Intelligent Split Launch Button**:
  - Launch with one click using your default terminal type.
  - Click the arrow dropdown to open Acode's native terminal selector and set/switch your default terminal preference (persists across restarts).
  - Integrates with both **AcodeX** and Acode's **Built-in Terminal**. (If AcodeX is not installed, it cleanly falls back to a single Launch using the Built-in Terminal).
- **Live Console Logs**: View active installation or deletion command logs in real-time in a console window directly inside the distro card.
- **Progressive Shell Fallbacks**: If the guest distro's default shell is missing from the rootfs, the plugin progressively tries `/bin/bash` → `/usr/bin/bash` → `/bin/sh` → `/usr/bin/sh` to make sure it starts.
- **Built-in `acode` CLI tool**: Type `acode <file>` inside guest shells to open files/folders directly in Acode.
- **Available Distros**:
  - 🌀 **Debian (trixie)**
  - 🟠 **Ubuntu (25.10 Questing)**
  - 🔵 **Arch Linux**
  - 🎩 **Fedora (43)**
  - ⚫ **Void Linux**
  - 🦎 **openSUSE Tumbleweed**
  - 🟢 **Manjaro**
  - 🐉 **Kali Linux**

## How to Access

1. Open Acode's sidebar panel (typically by tapping the menu icon in the top-left or pressing `Ctrl + B`).
2. Click the **Distro Manager** icon.
3. The control dashboard will open showing all available and installed distributions.

## How It Works

This plugin uses the same proot infrastructure as the built-in terminal but installs distributions to a separate `distros/` directory inside your app's data files:

```
$FILES_DIR/
├── distros/          ← Plugin-managed
│   ├── ubuntu/
│   │   └── rootfs/
│   ├── debian/
│   │   └── rootfs/
│   └── arch/
│       └── rootfs/
└── distro-manager.json  ← Plugin config
```

## Requirements

- Acode editor.
- Working proot binaries (handled by Acode Terminal).
- Internet connection for downloading distros.
- Sufficient storage space (varies by distro).

## Package Managers by Distro

| Distro | Package Manager | Example |
|--------|-----------------|---------|
| Ubuntu/Debian/Kali | apt | `apt update && apt install nodejs` |
| Arch/Manjaro | pacman | `pacman -S nodejs` |
| Fedora | dnf | `dnf install nodejs` |
| Void | xbps | `xbps-install nodejs` |
| openSUSE | zypper | `zypper install nodejs` |

## Storage Usage

| Distro | Base Size (Download) | Installed Size |
|--------|----------------------|----------------|
| Debian | ~35MB | ~100MB |
| Ubuntu | ~58MB | ~170MB |
| Arch | ~160MB | ~480MB |
| Fedora | ~38MB | ~120MB |
| Void | ~51MB | ~160MB |
| openSUSE | ~44MB | ~130MB |
| Manjaro | ~141MB | ~430MB |
| Kali | ~150MB | ~400MB |

## License

MIT
