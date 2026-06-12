import { h, render } from "preact";
import plugin from "../plugin.json";
import DistroManager from "./DistroManager.js";
import DISTROS from "./distros.js";
import Sidebar from "./components/Sidebar.jsx";
import sidebarStyles from "./components/Sidebar.css";

const confirm = acode.require("confirm");
const alert = acode.require("alert");
const select = acode.require("select");
const createLoader = acode.require("loader");


const DEFAULT_PORT = 43130;
const INIT_SCRIPT_VERSION = 8;

function shellQuote(value) {
	return `'${String(value).replace(/'/g, "'\\''")}'`;
}

class DistroManagerPlugin {
	constructor() {
		this.manager = null;
		this.baseUrl = "";
		this.filesDir = "";
		this.listeners = [];
		this.installStates = {};
		this.sidebarId = "distro-manager";
		this.$style = null;
	}

	async init() {
		this.filesDir = await new Promise((resolve, reject) => {
			system.getFilesDir(resolve, reject);
		});

		this.manager = new DistroManager(this.filesDir);
		await this.manager.init();

		this.initSidebar();
	}

	initSidebar() {
		const sideBarApps = acode.require("sidebarApps");
		if (!sideBarApps) {
			console.warn("[DistroManager] sidebarApps API not available");
			return;
		}

		// Register custom icon using plugin icon
		acode.addIcon("distro-manager-icon", `${this.baseUrl}icon.png`);

		// Define style tag and append it to head
		this.$style = document.createElement("style");
		this.$style.innerHTML = sidebarStyles;
		document.head.appendChild(this.$style);

		sideBarApps.add(
			"distro-manager-icon",
			this.sidebarId,
			"Distro Manager",
			(container) => {
				container.classList.add("scroll");
				container.style.maxHeight = "100%";
				container.style.overflowY = "auto";
				render(<Sidebar plugin={this} />, container);
			},
			false,
			() => {
				this.notifyListeners();
			}
		);
	}

	// Observer pattern methods for UI reactivity
	addListener(cb) {
		this.listeners.push(cb);
	}

	removeListener(cb) {
		this.listeners = this.listeners.filter((l) => l !== cb);
	}

	notifyListeners() {
		this.listeners.forEach((cb) => {
			try {
				cb();
			} catch (e) {
				console.error("[DistroManager] Listener notify error:", e);
			}
		});
	}


	async installDistro(distroId) {
		const distro = DISTROS[distroId];
		if (!distro) return;

		this.installStates[distroId] = {
			status: "installing",
			logs: [`🏔️ Initializing ${distro.name} installation...`],
		};
		this.notifyListeners();

		const logger = (msg) => {
			if (this.installStates[distroId]) {
				this.installStates[distroId].logs.push(msg);
				if (this.installStates[distroId].logs.length > 50) {
					this.installStates[distroId].logs.shift();
				}
				this.notifyListeners();
			}
			console.log(`[DistroManager] ${msg}`);
		};

		try {
			await this.manager.install(distroId, logger);
			await this.createDistroInitScript(distroId, { force: true });

			this.installStates[distroId] = {
				status: "success",
				logs: [...this.installStates[distroId].logs, `✓ Installed successfully!`],
			};
			this.notifyListeners();

			setTimeout(() => {
				delete this.installStates[distroId];
				this.notifyListeners();
			}, 3000);
		} catch (error) {
			console.error("[DistroManager] Installation failed:", error);
			this.installStates[distroId] = {
				status: "error",
				error: error.message || String(error),
				logs: this.installStates[distroId] ? this.installStates[distroId].logs : [],
			};
			this.notifyListeners();
		}
	}

	async uninstallDistro(distroId) {
		const distro = DISTROS[distroId];
		if (!distro) return;

		this.installStates[distroId] = {
			status: "uninstalling",
			logs: [`🗑️ Preparing to remove ${distro.name}...`],
		};
		this.notifyListeners();

		const logger = (msg) => {
			if (this.installStates[distroId]) {
				this.installStates[distroId].logs.push(msg);
				this.notifyListeners();
			}
			console.log(`[DistroManager] ${msg}`);
		};

		try {
			await this.manager.uninstall(distroId, logger);

			this.installStates[distroId] = {
				status: "success",
				logs: [...this.installStates[distroId].logs, `✓ Removed successfully!`],
			};
			this.notifyListeners();

			setTimeout(() => {
				delete this.installStates[distroId];
				this.notifyListeners();
			}, 3000);
		} catch (error) {
			console.error("[DistroManager] Uninstallation failed:", error);
			this.installStates[distroId] = {
				status: "error",
				error: error.message || String(error),
				logs: this.installStates[distroId] ? this.installStates[distroId].logs : [],
			};
			this.notifyListeners();
		}
	}

	async ensureDistroInitScript(distroId) {
		const installed = this.manager.config.installed[distroId];
		const initScriptPath = `${this.manager.distrosPath}/${distroId}/init-distro.sh`;
		const rootfsPath = `${this.manager.distrosPath}/${distroId}/rootfs`;
		const initrcPath = `${rootfsPath}/etc/acode-initrc`;

		if (
			installed?.initScriptVersion === INIT_SCRIPT_VERSION &&
			(await this.manager.fileExists(initScriptPath)) &&
			(await this.manager.fileExists(initrcPath))
		) {
			return initScriptPath;
		}

		return this.createDistroInitScript(distroId, { force: true });
	}

	async createDistroInitScript(distroId, { force = false } = {}) {
		const distro = DISTROS[distroId];
		const rootfsPath = `${this.manager.distrosPath}/${distroId}/rootfs`;
		const distroPath = `${this.manager.distrosPath}/${distroId}`;
		const initScriptPath = `${this.manager.distrosPath}/${distroId}/init-distro.sh`;
		const initrcPath = `${rootfsPath}/etc/acode-initrc`;
		const logPath = `${distroPath}/last-launch.log`;

		if (!force && (await this.manager.fileExists(initScriptPath))) {
			return initScriptPath;
		}

		const distroName = distro.name.toLowerCase().replace(/\s+/g, "");

		const bashrc = `# Acode ${distro.name} Shell Configuration
export HOME=/root
export PATH=/bin:/sbin:/usr/bin:/usr/sbin:/usr/local/bin:/usr/local/sbin:/system/bin
export TERM=xterm-256color
export LANG=C.UTF-8
export SHELL=${distro.shell}

# Source system profiles if they exist
[ -f /etc/profile ] && . /etc/profile
[ -f /etc/bash.bashrc ] && . /etc/bash.bashrc
[ -f ~/.bashrc ] && . ~/.bashrc

# Unset PROMPT_COMMAND to prevent it overriding our prompt
unset PROMPT_COMMAND

# Color prompt: user@distro:path$
if [ -n "$BASH_VERSION" ]; then
  PS1='\\[\\033[1;32m\\]\\u\\[\\033[0m\\]@\\[\\033[1;35m\\]${distroName}\\[\\033[0m\\]:\\[\\033[1;34m\\]\\w\\[\\033[0m\\]\\$ '
else
  # POSIX sh
  PS1='\\033[1;32m\$(whoami 2>/dev/null || echo root)\\033[0m@\\033[1;35m${distroName}\\033[0m:\\033[1;34m\$PWD\\033[0m# '
fi

# Show welcome message
if [ -z "$ACODE_MOTD_SHOWN" ]; then
  export ACODE_MOTD_SHOWN=1
  printf "\\033[1;35m  🚀 ${distro.name} environment loaded successfully.\\033[0m\\n"
  printf "\\033[1;30m  ──────────────────────────────────────────\\033[0m\\n"
  printf "   \\033[1;32m• Package Manager :\\033[0m \\033[1;36m${distro.pkgManager}\\033[0m\\n"
  printf "   \\033[1;32m• Home Directory  :\\033[0m \\033[1;36m\\$HOME\\033[0m\\n"
  printf "   \\033[1;32m• Quick Editor    :\\033[0m Run \\033[1;33macode <file>\\033[0m to edit\\n"
  printf "\\033[1;30m  ──────────────────────────────────────────\\033[0m\\n\\n"
fi

cd "$HOME" 2>/dev/null || cd /root 2>/dev/null || cd /
`;

		// Configure /etc/profile in rootfs to ensure all login shells load our env and prompt
		const profilePath = `${rootfsPath}/etc/profile`;
		try {
			let profileContent = "";
			const exists = await this.manager.fileExists(profilePath);
			if (exists) {
				profileContent = await Executor.BackgroundExecutor.execute(`cat "${profilePath}"`);
			}
			const markerStart = "# >>> Acode Distro Init Start >>>";
			const markerEnd = "# <<< Acode Distro Init End <<<";
			const startIndex = profileContent.indexOf(markerStart);
			const endIndex = profileContent.indexOf(markerEnd);

			if (startIndex !== -1 && endIndex !== -1) {
				profileContent = profileContent.slice(0, startIndex) + profileContent.slice(endIndex + markerEnd.length);
			}

			const profileConfig = `
${markerStart}
# Acode ${distro.name} Shell Configuration
export HOME=/root
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/system/bin
export TERM=xterm-256color
export LANG=C.UTF-8
export SHELL=${distro.shell}

# Unset PROMPT_COMMAND to prevent it overriding our prompt
unset PROMPT_COMMAND

if [ -n "$BASH_VERSION" ]; then
  PS1='\\[\\033[1;32m\\]\\u\\[\\033[0m\\]@\\[\\033[1;35m\\]${distroName}\\[\\033[0m\\]:\\[\\033[1;34m\\]\\w\\[\\033[0m\\]\\$ '
else
  PS1='\\033[1;32m\$(whoami 2>/dev/null || echo root)\\033[0m@\\033[1;35m${distroName}\\033[0m:\\033[1;34m\$PWD\\033[0m# '
fi

if [ -z "$ACODE_MOTD_SHOWN" ]; then
  export ACODE_MOTD_SHOWN=1
  printf "\\033[1;35m  🚀 ${distro.name} environment loaded successfully.\\033[0m\\n"
  printf "\\033[1;30m  ──────────────────────────────────────────\\033[0m\\n"
  printf "   \\033[1;32m• Package Manager :\\033[0m \\033[1;36m${distro.pkgManager}\\033[0m\\n"
  printf "   \\033[1;32m• Home Directory  :\\033[0m \\033[1;36m\\$HOME\\033[0m\\n"
  printf "   \\033[1;32m• Quick Editor    :\\033[0m Run \\033[1;33macode <file>\\033[0m to edit\\n"
  printf "\\033[1;30m  ──────────────────────────────────────────\\033[0m\\n\\n"
fi

cd "\\$HOME" 2>/dev/null || cd /root 2>/dev/null || cd /
${markerEnd}
`;

			profileContent = profileContent.trim() + "\n" + profileConfig;
			await new Promise((resolve, reject) => {
				system.writeText(profilePath, profileContent, resolve, reject);
			});
		} catch (e) {
			console.warn("[DistroManager] Failed to update /etc/profile:", e);
		}

		const initScript = `#!/bin/sh
export LD_LIBRARY_PATH=$PREFIX
export PROOT_TMP_DIR=$PREFIX/tmp
export ENV=/etc/acode-initrc
LOG_FILE="${logPath}"

log() {
  printf '%s %s\\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >> "$LOG_FILE"
}

: > "$LOG_FILE"
log "starting ${distro.name} launcher"
log "PREFIX=$PREFIX"
log "NATIVE_DIR=$NATIVE_DIR"
log "FDROID=$FDROID"

mkdir -p "$PREFIX/tmp"
mkdir -p "$PREFIX/public"
mkdir -p "${rootfsPath}/tmp"

if [ -f "$NATIVE_DIR/libproot.so" ]; then
  export PROOT_LOADER="$NATIVE_DIR/libproot.so"
fi
if [ -f "$NATIVE_DIR/libproot32.so" ]; then
  export PROOT_LOADER32="$NATIVE_DIR/libproot32.so"
fi

if [ "$FDROID" = "true" ]; then
  export PROOT="$PREFIX/libproot-xed.so"
  chmod +x $PREFIX/*
else
  if [ -e "$PREFIX/libtalloc.so.2" ] || [ -L "$PREFIX/libtalloc.so.2" ]; then
    rm -f "$PREFIX/libtalloc.so.2"
  fi
  ln -sf "$NATIVE_DIR/libtalloc.so" "$PREFIX/libtalloc.so.2"
  export PROOT="$NATIVE_DIR/libproot-xed.so"
fi

log "PROOT=$PROOT"
log "PROOT_LOADER=$PROOT_LOADER"
log "PROOT_LOADER32=$PROOT_LOADER32"

ARGS="--kill-on-exit"

for mnt in /apex /odm /product /system /system_ext /vendor /linkerconfig/ld.config.txt /linkerconfig/com.android.art/ld.config.txt /plat_property_contexts /property_contexts; do
  [ -e "$mnt" ] && ARGS="$ARGS -b $(realpath $mnt)"
done

ARGS="$ARGS -b /sdcard"
ARGS="$ARGS -b /storage"
ARGS="$ARGS -b /dev"
ARGS="$ARGS -b /data"
ARGS="$ARGS -b /dev/urandom:/dev/random"
ARGS="$ARGS -b /proc"
ARGS="$ARGS -b /sys"
ARGS="$ARGS -b $PREFIX"
ARGS="$ARGS -b $PREFIX/public:/public"
ARGS="$ARGS -b $PREFIX/public:/home"
ARGS="$ARGS -b $PREFIX/public:/root"
ARGS="$ARGS -b ${rootfsPath}/tmp:/dev/shm"

[ -e "/proc/self/fd" ] && ARGS="$ARGS -b /proc/self/fd:/dev/fd"
[ -e "/proc/self/fd/0" ] && ARGS="$ARGS -b /proc/self/fd/0:/dev/stdin"
[ -e "/proc/self/fd/1" ] && ARGS="$ARGS -b /proc/self/fd/1:/dev/stdout"
[ -e "/proc/self/fd/2" ] && ARGS="$ARGS -b /proc/self/fd/2:/dev/stderr"

ARGS="$ARGS -r ${rootfsPath}"
ARGS="$ARGS -0"
ARGS="$ARGS --link2symlink"
ARGS="$ARGS --sysvipc"
ARGS="$ARGS -L"
ARGS="$ARGS -w /root"

DISTRO_SHELL="${distro.shell}"
SHELL_ARGS="-l"

if [ ! -e "${rootfsPath}$DISTRO_SHELL" ] && [ -e "${rootfsPath}/usr/bin/bash" ]; then
  DISTRO_SHELL="/usr/bin/bash"
fi

case "$DISTRO_SHELL" in
  */bash)
    SHELL_ARGS="--rcfile /etc/acode-initrc -i"
    ;;
esac

if [ ! -x "$PROOT" ]; then
  echo "proot executable is missing or not executable: $PROOT" >&2
  exit 126
fi

if [ ! -e "${rootfsPath}$DISTRO_SHELL" ]; then
  echo "shell not found in rootfs: $DISTRO_SHELL" >&2
  log "shell not found in rootfs: $DISTRO_SHELL"
  exit 127
fi

log "DISTRO_SHELL=$DISTRO_SHELL"
log "SHELL_ARGS=$SHELL_ARGS"
log "ARGS=$ARGS"
log "executing proot"

exec $PROOT $ARGS "$DISTRO_SHELL" $SHELL_ARGS
`;

		await new Promise((resolve, reject) => {
			system.writeText(initrcPath, bashrc, resolve, reject);
		});
		await new Promise((resolve, reject) => {
			system.writeText(initScriptPath, initScript, resolve, reject);
		});

		const binDir = `${rootfsPath}/usr/local/bin`;
		const binDirExists = await this.manager.fileExists(binDir);
		if (!binDirExists) {
			await new Promise((resolve, reject) => {
				system.mkdirs(binDir, resolve, reject);
			});
		}

		const acodeCliContent = `#!/bin/sh
# acode - Open files/folders in Acode editor from inside distro
if [ \$# -eq 0 ]; then
  printf '\\e]7777;open;folder;.\\a'
  exit 0
fi
for arg in "\$@"; do
  if [ -d "\$arg" ]; then
    printf '\\e]7777;open;folder;%s\\a' "\$(realpath "\$arg")"
  else
    printf '\\e]7777;open;file;%s\\a' "\$(realpath "\$arg")"
  fi
done
`;
		await new Promise((resolve, reject) => {
			system.writeText(`${binDir}/acode`, acodeCliContent, resolve, reject);
		});
		await new Promise((resolve, reject) => {
			system.setExec(`${binDir}/acode`, true, resolve, reject);
		});

		await new Promise((resolve, reject) => {
			system.setExec(initScriptPath, true, resolve, reject);
		});

		if (this.manager.config.installed[distroId]) {
			this.manager.config.installed[distroId].initScriptVersion =
				INIT_SCRIPT_VERSION;
			await this.manager.saveConfig();
		}

		return initScriptPath;
	}

	async launchTerminal(distroId, type, port) {
		const distro = DISTROS[distroId];
		if (!distro) return;

		try {
			await this.ensureDistroInitScript(distroId);
			const running = await this.checkServerRunning(port);
			
			if (!running) {
				const started = await this.startDistroServerBackground(distroId, port);
				if (!started) {
					throw new Error("PTY server failed to launch");
				}
			}

			if (type === "acodex") {
				const acodex = acode.require("acodex");
				if (!acodex) {
					alert("AcodeX Not Found", "Please install AcodeX from the plugin store to use this terminal.");
					return;
				}
				if (acodex.isTerminalOpened()) {
					acodex.closeTerminal();
					await new Promise((r) => setTimeout(r, 300));
				}
				await acodex.openTerminal(270, port);
			} else if (type === "builtin") {
				const terminal = acode.require("terminal");
				if (!terminal) {
					alert("Built-in Terminal Error", "Built-in terminal is not available in your Acode version.");
					return;
				}
				const pid = await this.createDistroSession(port);
				await terminal.create({
					name: `${distro.icon} ${distro.name}`,
					port,
					pid,
				});

				this.manager.config.activeDistro = distroId;
				await this.manager.saveConfig();
			}
		} catch (error) {
			console.error("[DistroManager] Failed to launch terminal:", error);
			alert("Error", `Failed to start shell: ${error.message || error}`);
		}
	}

	async startDistroServerBackground(distroId, port) {
		const initScriptPath = await this.ensureDistroInitScript(distroId);
		const axsPath = `${this.filesDir}/axs`;
		const axsExists = await this.manager.fileExists(axsPath);

		if (!axsExists) {
			const msg = `
				<div style="text-align: left;">
					<p>⚠️ <strong>AXS Server Not Found</strong></p>
					<br>
					<p style="color: #888;">
						The PTY server binary is not installed.<br><br>
						Please open Acode's built-in terminal first to install the required components.
					</p>
				</div>
			`;
			alert("AXS Not Found", msg);
			return false;
		}

		await new Promise((resolve, reject) => {
			system.setExec(axsPath, true, resolve, reject);
		});
		await new Promise((resolve, reject) => {
			system.setExec(initScriptPath, true, resolve, reject);
		});

		const uuid = await Executor.start("sh", (type, data) => {
			console.log(`[DistroManager AXS] ${type}: ${data}`);
		});

		const quotedInitScriptPath = shellQuote(initScriptPath);
		const axsCmd = `
chmod +x "$PREFIX/axs" ${quotedInitScriptPath}
LINKER="/system/bin/linker64"
ARCH="$(uname -m)"
if [ "$ARCH" != "aarch64" ] && [ "$ARCH" != "x86_64" ]; then
  LINKER="/system/bin/linker"
fi
exec "$LINKER" "$PREFIX/axs" -p ${port} -c "sh ${initScriptPath}"
`;
		await Executor.write(uuid, `${axsCmd}\n`);

		// Wait up to 3 seconds for server to start, checking every 500ms
		for (let i = 0; i < 6; i++) {
			await new Promise((resolve) => setTimeout(resolve, 500));
			const running = await this.checkServerRunning(port);
			if (running) {
				this.manager.config.activeDistro = distroId;
				await this.manager.saveConfig();
				return true;
			}
		}

		console.warn("[DistroManager] Server failed to start in time");
		return false;
	}

	async showLaunchLog(distroId) {
		const distro = DISTROS[distroId];
		const logPath = `${this.manager.distrosPath}/${distroId}/last-launch.log`;
		let content = "";

		try {
			const exists = await this.manager.fileExists(logPath);
			content = exists
				? await Executor.BackgroundExecutor.execute(`cat "${logPath}"`)
				: "No launch log has been written yet.";
		} catch (error) {
			content = `Failed to read launch log: ${error.message || error}`;
		}

		const escaped = String(content)
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;");

		alert(
			`${distro.icon} ${distro.name} Launch Log`,
			`<pre style="text-align:left; white-space:pre-wrap; font-size:0.8em; max-height:60vh; overflow:auto;">${escaped}</pre>`,
		);
	}

	async createDistroSession(port) {
		const response = await new Promise((resolve, reject) => {
			cordova.plugin.http.sendRequest(
				`http://localhost:${port}/terminals`,
				{
					method: "POST",
					responseType: "text",
					serializer: "json",
					data: {
						cols: 80,
						rows: 24,
					},
				},
				resolve,
				(err) => reject(new Error(err.error || "Failed to create session")),
			);
		});

		if (response.status < 200 || response.status >= 300) {
			throw new Error(`Failed to create session: HTTP ${response.status}`);
		}

		return response.data.trim();
	}

	async checkServerRunning(port) {
		try {
			const response = await fetch(`http://localhost:${port}/`, {
				method: "GET",
				signal: AbortSignal.timeout(1000),
			});
			return response.ok;
		} catch {
			return false;
		}
	}

	destroy() {
		const sideBarApps = acode.require("sidebarApps");
		if (sideBarApps && this.sidebarId) {
			sideBarApps.remove(this.sidebarId);
		}

		if (this.$style) {
			this.$style.remove();
		}
	}
}

if (window.acode) {
	const distroManager = new DistroManagerPlugin();

	acode.setPluginInit(plugin.id, async (baseUrl) => {
		if (!baseUrl.endsWith("/")) {
			baseUrl += "/";
		}
		distroManager.baseUrl = baseUrl;
		await distroManager.init();
	});

	acode.setPluginUnmount(plugin.id, () => {
		distroManager.destroy();
	});
}
