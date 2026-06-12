# Distro Manager for Acode

Manage and install multiple Linux distributions in Acode without disturbing the default Alpine installation.

## Features

- **Multiple Distro Support**: Install and manage multiple Linux distributions side-by-side on separate ports.
- **Interactive Shell Features**: Fully-configured shell sessions with color-themed `PS1` prompts, a Welcome Message (MOTD) banner, and proper `$HOME` directory management.
- **Built-in `acode` CLI tool**: Type `acode <file>` inside guest shells to open files/folders directly in Acode.
- **Available Distros**:
  - 🏔️ **Alpine Linux (3.21)**: Lightweight, musl-based (~3MB download)
  - 🌀 **Debian (trixie)**: Stable and reliable (~35MB download)
  - 🟠 **Ubuntu (25.10 Questing)**: Popular glibc-based distro (~58MB download)
  - 🔵 **Arch Linux**: Rolling release for power users (~160MB download)
  - 🎩 **Fedora (43)**: Cutting-edge packages (~38MB download)
  - ⚫ **Void Linux**: Independent distro with runit (~51MB download)
  - 🦎 **openSUSE Tumbleweed**: Stable rolling release (~44MB download)
  - 🟢 **Manjaro**: User-friendly Arch-based distro (~141MB download)

- **Non-Destructive**: Does not modify or interfere with Acode's built-in Alpine sandbox terminal.
- **Command Palette Integration**: All actions available via command palette.

## Usage

### Commands

Open the command palette (`Ctrl/Cmd + Shift + P`) and search for:

| Command | Description |
|---------|-------------|
| `Distro Manager: Install Distribution` | Download and install a new distro |
| `Distro Manager: Uninstall Distribution` | Remove an installed distro |
| `Distro Manager: Open Shell` | Launch a shell in an installed distro |
| `Distro Manager: List Distributions` | Show installed and available distros |
| `Distro Manager: Distribution Info` | View details about a distro |

### Installing a Distribution

1. Run `Distro Manager: Install Distribution`
2. Select a distribution from the list
3. Confirm the installation
4. Wait for download and setup to complete

### Opening a Shell

1. Run `Distro Manager: Open Shell`
2. Select an installed distribution
3. A terminal will open with the selected distro

## How It Works

This plugin uses the same proot infrastructure as the built-in terminal but installs distributions to a separate `distros/` directory:

```
$PREFIX/
├── alpine/           ← Default (untouched)
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

- Acode with Terminal plugin installed
- Working proot binaries (auto-handled by Terminal plugin)
- Internet connection for downloading distros
- Sufficient storage space (varies by distro)

## Package Managers by Distro

| Distro | Package Manager | Example |
|--------|-----------------|---------|
| Alpine | apk | `apk add nodejs` |
| Ubuntu/Debian | apt | `apt install nodejs` |
| Arch | pacman | `pacman -S nodejs` |
| Fedora | dnf | `dnf install nodejs` |
| Void | xbps | `xbps-install nodejs` |
| openSUSE | zypper | `zypper install nodejs` |

## Storage Usage

| Distro | Base Size (Download) | Installed Size |
|--------|----------------------|----------------|
| Alpine | ~3MB | ~10MB |
| Debian | ~35MB | ~100MB |
| Ubuntu | ~58MB | ~170MB |
| Arch | ~160MB | ~480MB |
| Fedora | ~38MB | ~120MB |
| Void | ~51MB | ~160MB |
| openSUSE | ~44MB | ~130MB |
| Manjaro | ~141MB | ~430MB |

## License

MIT
