const DISTROS = {

	debian: {
		name: "Debian",
		version: "trixie",
		description: "Stable and reliable, the universal operating system",
		icon: "🌀",
		pkgManager: "apt",
		urls: {
			"arm64-v8a":
				"https://github.com/termux/proot-distro/releases/download/v4.29.0/debian-trixie-aarch64-pd-v4.29.0.tar.xz",
			"armeabi-v7a":
				"https://github.com/termux/proot-distro/releases/download/v4.29.0/debian-trixie-arm-pd-v4.29.0.tar.xz",
			x86_64:
				"https://github.com/termux/proot-distro/releases/download/v4.29.0/debian-trixie-x86_64-pd-v4.29.0.tar.xz",
		},
		size: "~35MB",
		shell: "/bin/bash",
		isXz: true,
		isProotDistro: true,
	},

	ubuntu: {
		name: "Ubuntu",
		version: "25.10 (Questing)",
		description: "Popular Debian-based distro with apt package manager",
		icon: "🟠",
		pkgManager: "apt",
		urls: {
			"arm64-v8a":
				"https://easycli.sh/proot-distro/ubuntu-questing-aarch64-pd-v4.37.0.tar.xz",
			"armeabi-v7a":
				"https://easycli.sh/proot-distro/ubuntu-questing-arm-pd-v4.37.0.tar.xz",
			x86_64:
				"https://easycli.sh/proot-distro/ubuntu-questing-x86_64-pd-v4.37.0.tar.xz",
		},
		size: "~58MB",
		shell: "/bin/bash",
		isXz: true,
		isProotDistro: true,
	},

	arch: {
		name: "Arch Linux",
		version: "latest",
		description: "Rolling release with pacman, for power users",
		icon: "🔵",
		pkgManager: "pacman",
		urls: {
			"arm64-v8a":
				"https://github.com/termux/proot-distro/releases/download/v4.34.2/archlinux-aarch64-pd-v4.34.2.tar.xz",
			"armeabi-v7a":
				"https://github.com/termux/proot-distro/releases/download/v4.34.2/archlinux-arm-pd-v4.34.2.tar.xz",
			x86_64:
				"https://github.com/termux/proot-distro/releases/download/v4.34.2/archlinux-x86_64-pd-v4.34.2.tar.xz",
		},
		size: "~160MB",
		shell: "/bin/bash",
		isXz: true,
		isProotDistro: true,
	},

	fedora: {
		name: "Fedora",
		version: "43",
		description: "Cutting-edge features with dnf package manager",
		icon: "🎩",
		pkgManager: "dnf",
		urls: {
			"arm64-v8a":
				"https://github.com/termux/proot-distro/releases/download/v4.31.0/fedora-aarch64-pd-v4.31.0.tar.xz",
			x86_64:
				"https://github.com/termux/proot-distro/releases/download/v4.31.0/fedora-x86_64-pd-v4.31.0.tar.xz",
		},
		size: "~38MB",
		shell: "/bin/bash",
		isXz: true,
		isProotDistro: true,
	},

	void: {
		name: "Void Linux",
		version: "latest",
		description: "Independent distro with runit and xbps",
		icon: "⚫",
		pkgManager: "xbps-install",
		urls: {
			"arm64-v8a":
				"https://github.com/termux/proot-distro/releases/download/v4.29.0/void-aarch64-pd-v4.29.0.tar.xz",
			"armeabi-v7a":
				"https://github.com/termux/proot-distro/releases/download/v4.29.0/void-arm-pd-v4.29.0.tar.xz",
			x86_64:
				"https://github.com/termux/proot-distro/releases/download/v4.29.0/void-x86_64-pd-v4.29.0.tar.xz",
		},
		size: "~51MB",
		shell: "/bin/bash",
		isXz: true,
		isProotDistro: true,
	},

	opensuse: {
		name: "openSUSE",
		version: "tumbleweed",
		description: "Rolling release with zypper package manager",
		icon: "🦎",
		pkgManager: "zypper",
		urls: {
			"arm64-v8a":
				"https://github.com/termux/proot-distro/releases/download/v4.34.2/opensuse-aarch64-pd-v4.34.2.tar.xz",
			x86_64:
				"https://github.com/termux/proot-distro/releases/download/v4.34.2/opensuse-x86_64-pd-v4.34.2.tar.xz",
		},
		size: "~44MB",
		shell: "/bin/bash",
		isXz: true,
		isProotDistro: true,
	},

	manjaro: {
		name: "Manjaro",
		version: "latest",
		description: "User-friendly Arch-based with pacman",
		icon: "🟢",
		pkgManager: "pacman",
		urls: {
			"arm64-v8a":
				"https://github.com/termux/proot-distro/releases/download/v4.34.2/manjaro-aarch64-pd-v4.34.2.tar.xz",
		},
		size: "~141MB",
		shell: "/bin/bash",
		isXz: true,
		isProotDistro: true,
	},
};

export default DISTROS;
