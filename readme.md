# Distro Manager for Acode

Manage and install multiple Linux distributions in Acode without disturbing the default Alpine installation.

## Features

- **Multiple Distro Support**: Install and manage multiple Linux distributions side by side
- **Available Distros**:
  - 🏔️ Alpine Linux (3.21) - Lightweight, musl-based (~3MB)
  - 🟠 Ubuntu (24.04) - Popular, glibc-based (~30MB)
  - 🌀 Debian (bookworm) - Stable and reliable (~140MB)
  - 🔵 Arch Linux - Rolling release (~400MB)
  - 🎩 Fedora (41) - Cutting edge (~300MB)
  - ⚫ Void Linux - Independent with runit (~150MB)
  - 🦎 openSUSE Tumbleweed - Rolling release (~200MB)

- **Non-Destructive**: Does not modify or interfere with the default Alpine terminal
- **Command Palette Integration**: All actions available via command palette

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

| Distro | Base Size | With Dev Tools |
|--------|-----------|----------------|
| Alpine | ~10MB | ~100MB |
| Ubuntu | ~80MB | ~400MB |
| Debian | ~150MB | ~500MB |
| Arch | ~450MB | ~700MB |
| Fedora | ~350MB | ~600MB |

## License

MIT
