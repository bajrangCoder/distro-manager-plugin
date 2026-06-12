import plugin from "../plugin.json";
import DistroManager from "./DistroManager.js";
import DISTROS from "./distros.js";

const confirm = acode.require("confirm");
const alert = acode.require("alert");
const select = acode.require("select");
const createLoader = acode.require("loader");

const COMMANDS = {
	INSTALL: "distro-manager.install",
	UNINSTALL: "distro-manager.uninstall",
	OPEN_SHELL: "distro-manager.shell",
	LIST: "distro-manager.list",
	INFO: "distro-manager.info",
};

const DEFAULT_PORT = 43130;
const INIT_SCRIPT_VERSION = 3;

function shellQuote(value) {
	return `'${String(value).replace(/'/g, "'\\''")}'`;
}

class DistroManagerPlugin {
	constructor() {
		this.manager = null;
		this.baseUrl = "";
		this.filesDir = "";
	}

	async init() {
		this.filesDir = await new Promise((resolve, reject) => {
			system.getFilesDir(resolve, reject);
		});

		this.manager = new DistroManager(this.filesDir);
		await this.manager.init();

		this.registerCommands();
	}

	registerCommands() {
		const { commands } = editorManager.editor;

		commands.addCommand({
			name: COMMANDS.INSTALL,
			description: "Distro Manager: Install Distribution",
			exec: () => this.showInstallMenu(),
		});

		commands.addCommand({
			name: COMMANDS.UNINSTALL,
			description: "Distro Manager: Uninstall Distribution",
			exec: () => this.showUninstallMenu(),
		});

		commands.addCommand({
			name: COMMANDS.OPEN_SHELL,
			description: "Distro Manager: Open Shell",
			exec: () => this.showShellMenu(),
		});

		commands.addCommand({
			name: COMMANDS.LIST,
			description: "Distro Manager: List Distributions",
			exec: () => this.showDistroList(),
		});

		commands.addCommand({
			name: COMMANDS.INFO,
			description: "Distro Manager: Distribution Info",
			exec: () => this.showDistroInfo(),
		});
	}

	async showInstallMenu() {
		const distros = this.manager
			.getAvailableDistros()
			.filter((d) => !d.installed);

		if (distros.length === 0) {
			alert(
				"Distro Manager",
				"All available distributions are already installed! 🎉",
			);
			return;
		}

		const options = distros.map((d) => [
			d.id,
			`${d.icon} ${d.name} ${d.version}`,
			`${d.description} (${d.size})`,
		]);

		const selected = await select("Select Distribution to Install", options, {
			textTransform: false,
		});

		if (!selected) return;

		await this.installDistro(selected);
	}

	async installDistro(distroId) {
		const distro = DISTROS[distroId];
		if (!distro) return;

		const confirmMsg = `
      <div style="text-align: left;">
        <p><strong>${distro.icon} ${distro.name} ${distro.version}</strong></p>
        <br>
        <p>📦 <strong>Size:</strong> ${distro.size}</p>
        <p>📋 <strong>Package Manager:</strong> ${distro.pkgManager}</p>
        <br>
        <p style="color: #888;">This may take a few minutes depending on your connection.</p>
      </div>
    `;

		const isConfirm = await confirm("Install Distribution", confirmMsg, true);

		if (!isConfirm) return;

		const installLoader = createLoader.create("Installing...", "", {
			timeout: 0,
		});

		const logs = [];
		const logger = (msg) => {
			logs.push(msg);
			installLoader.setMessage(msg);
			console.log(`[DistroManager] ${msg}`);
		};

		try {
			await this.manager.install(distroId, logger);
			await this.createDistroInitScript(distroId, { force: true });
			installLoader.destroy();

			const successMsg = `
        <div style="text-align: center;">
          <p style="font-size: 1.2em;">${distro.icon} <strong>${distro.name}</strong></p>
          <p style="color: #4CAF50;">✓ Installed successfully!</p>
          <br>
          <p style="color: #888; font-size: 0.9em;">
            Use <strong>"Distro Manager: Open Shell"</strong><br>from the command palette to start.
          </p>
        </div>
      `;
			alert("Installation Complete", successMsg);
		} catch (error) {
			installLoader.destroy();
			const errorMsg = error.message || String(error);
			const failMsg = `
        <div style="text-align: left;">
          <p style="color: #F44336;">❌ Failed to install ${distro.name}</p>
          <br>
          <p><strong>Error:</strong></p>
          <p style="font-family: monospace; font-size: 0.85em; color: #888;">${errorMsg}</p>
          <br>
          <p><strong>Recent logs:</strong></p>
          <pre style="font-size: 0.8em; color: #666; overflow-x: auto;">${logs.slice(-5).join("<br>")}</pre>
        </div>
      `;
			alert("Installation Failed", failMsg);
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

# Color prompt: user@distro:path$
PS1='\\[\\033[1;32m\\]\\u\\[\\033[0m\\]@\\[\\033[1;35m\\]${distroName}\\[\\033[0m\\]:\\[\\033[1;34m\\]\\w\\[\\033[0m\\]\\$ '

# Show welcome message
if [ ! -f /tmp/.motd_shown ]; then
  echo ""
  echo -e "\\033[1;36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\033[0m"
  echo -e "  \\033[1;33m${distro.icon} Welcome to ${distro.name} in Acode!\\033[0m"
  echo -e "\\033[1;36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\033[0m"
  echo ""
  echo -e "  Package Manager: \\033[1;32m${distro.pkgManager}\\033[0m"
  echo ""
  touch /tmp/.motd_shown
fi

cd ~
`;

		const initScript = `#!/bin/sh
export LD_LIBRARY_PATH=$PREFIX
export PROOT_TMP_DIR=$PREFIX/tmp
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
SHELL_ARGS="-i"

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

exec $PROOT $ARGS "$DISTRO_SHELL" $SHELL_ARGS 2>> "$LOG_FILE"
`;

		system.writeText(initrcPath, bashrc);
		system.writeText(initScriptPath, initScript);
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

	async showUninstallMenu() {
		const distros = this.manager
			.getAvailableDistros()
			.filter((d) => d.installed);

		if (distros.length === 0) {
			alert("Distro Manager", "No distributions installed yet.");
			return;
		}

		const options = await Promise.all(
			distros.map(async (d) => {
				const size = await this.manager.getInstalledSize(d.id);
				return [d.id, `${d.icon} ${d.name}`, `Size: ${size}`];
			}),
		);

		const selected = await select("Select Distribution to Uninstall", options, {
			textTransform: false,
		});

		if (!selected) return;

		const distro = DISTROS[selected];
		const confirmMsg = `
      <div style="text-align: left;">
        <p>⚠️ <strong>Uninstall ${distro.name}?</strong></p>
        <br>
        <p style="color: #F44336;">This will permanently delete all data in this distribution including:</p>
        <ul style="color: #888; margin-left: 1em;">
          <li>Installed packages</li>
          <li>User files and configurations</li>
          <li>All custom modifications</li>
        </ul>
      </div>
    `;

		const isConfirm = await confirm("Uninstall Distribution", confirmMsg, true);

		if (!isConfirm) return;

		const uninstallLoader = createLoader.create("Uninstalling...", "", {
			timeout: 0,
		});

		try {
			await this.manager.uninstall(selected, (msg) =>
				uninstallLoader.setMessage(msg),
			);
			uninstallLoader.destroy();
			alert("Uninstalled", `${distro.icon} ${distro.name} has been removed.`);
		} catch (error) {
			uninstallLoader.destroy();
			alert("Error", `Failed to uninstall: ${error.message || error}`);
		}
	}

	async showShellMenu() {
		const distros = this.manager
			.getAvailableDistros()
			.filter((d) => d.installed);

		if (distros.length === 0) {
			const msg = `
        <div style="text-align: center;">
          <p>📦 No distributions installed</p>
          <br>
          <p style="color: #888; font-size: 0.9em;">
            Use <strong>"Distro Manager: Install Distribution"</strong><br>
            from the command palette to get started.
          </p>
        </div>
      `;
			alert("No Distributions", msg);
			return;
		}

		const options = distros.map((d) => [
			d.id,
			`${d.icon} ${d.name} ${d.version}`,
			d.active ? "🟢 active" : "",
		]);

		const selected = await select("Select Distribution", options, {
			textTransform: false,
		});

		if (!selected) return;

		await this.openTerminal(selected);
	}

	async openTerminal(distroId) {
		const distro = DISTROS[distroId];
		if (!distro) return;

		try {
			await this.ensureDistroInitScript(distroId);

			const port = await this.startDistroServer(distroId);
			if (!port) {
				console.warn("[DistroManager] Failed to start PTY server");
			}
		} catch (error) {
			console.error("[DistroManager] Failed to open terminal:", error);
			acode.alert("Error", `Failed to start shell: ${error.message || error}`);
		}
	}

	async startDistroServer(distroId) {
		const initScriptPath = await this.ensureDistroInitScript(distroId);
		const port = DEFAULT_PORT + Object.keys(DISTROS).indexOf(distroId);

		try {
			const isRunning = await this.checkServerRunning(port);
			if (isRunning) {
				console.log(`[DistroManager] Server already running on port ${port}`);
				await this.showTerminalOptions(distroId, port);
				return port;
			}

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
				acode.alert("AXS Not Found", msg);
				return null;
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

			await new Promise((resolve) => setTimeout(resolve, 3000));

			const running = await this.checkServerRunning(port);
			if (running) {
				this.manager.config.activeDistro = distroId;
				await this.manager.saveConfig();
				await this.showTerminalOptions(distroId, port);
				return port;
			}

			console.warn("[DistroManager] Server may not have started correctly");
			await this.showTerminalOptions(distroId, port);
			return port;
		} catch (error) {
			console.error("[DistroManager] Failed to start server:", error);
			throw error;
		}
	}

	async showTerminalOptions(distroId, port) {
		const distro = DISTROS[distroId];
		const acodex = acode.require("acodex");
		const terminal = acode.require("terminal");

		const options = [
			[
				"acodex",
				"🖥️ Open in AcodeX Terminal",
				"Connect using AcodeX plugin (recommended)",
			],
			[
				"builtin",
				"📟 Open in Built-in Terminal",
				"Use Acode terminal UI directly",
			],
			["log", "📄 Show Launch Log", "View the last distro startup log"],
			["info", "ℹ️ Show Server Info", "View connection details only"],
		];

		if (!acodex) {
			options[0][2] = "⚠️ AcodeX plugin not installed";
		}
		if (!terminal) {
			options[1][2] = "⚠️ Built-in terminal not available";
		}

		const selected = await select("Terminal Option", options, {
			textTransform: false,
		});

		if (!selected) return;

		if (selected === "acodex") {
			if (!acodex) {
				const msg = `
          <div style="text-align: left;">
            <p>⚠️ <strong>AcodeX Not Found</strong></p>
            <br>
            <p style="color: #888;">
              The AcodeX terminal plugin is not installed.<br><br>
              Please install AcodeX from the plugin store to use this feature.
            </p>
            <br>
            <p style="font-size: 0.9em;">
              <strong>Server is still running on port:</strong> <code>${port}</code>
            </p>
          </div>
        `;
				acode.alert("AcodeX Not Found", msg);
				return;
			}

			try {
				if (acodex.isTerminalOpened()) {
					acodex.closeTerminal();
					await new Promise((r) => setTimeout(r, 300));
				}
				await acodex.openTerminal(270, port);
			} catch (error) {
				console.error("[DistroManager] Failed to open AcodeX:", error);
				acode.alert(
					"Error",
					`Failed to connect AcodeX: ${error.message || error}`,
				);
			}
		} else if (selected === "builtin") {
			if (!terminal) {
				acode.alert("Error", "Built-in terminal is not available.");
				return;
			}

			try {
				const pid = await this.createDistroSession(port);
				await terminal.create({
					name: `${distro.icon} ${distro.name}`,
					port,
					pid,
				});

				this.manager.config.activeDistro = distroId;
				await this.manager.saveConfig();
			} catch (error) {
				console.error("[DistroManager] Built-in terminal failed:", error);
				acode.alert(
					"Error",
					`Failed to open built-in terminal: ${error.message || error}`,
				);
			}
		} else if (selected === "log") {
			await this.showLaunchLog(distroId);
		} else {
			const serverMsg = `
        <div style="text-align: left;">
          <p>${distro.icon} <strong>${distro.name}</strong> PTY server running</p>
          <br>
          <p><strong>Port:</strong> <code>${port}</code></p>
          <br>
          <p><strong>Connect using:</strong></p>
          <ul style="margin-left: 1em; color: #888;">
            <li>AcodeX terminal plugin (recommended)</li>
            <li>Any WebSocket terminal client</li>
          </ul>
          <br>
          <p style="font-size: 0.85em; color: #666;">
            <strong>WebSocket:</strong> <code>ws://localhost:${port}/terminals/&lt;pid&gt;</code><br>
            <strong>Create session:</strong> <code>POST http://localhost:${port}/terminals</code>
          </p>
        </div>
      `;
			acode.alert(`${distro.icon} Server Running`, serverMsg);
		}
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

	async showDistroList() {
		const distros = this.manager.getAvailableDistros();

		const installed = distros.filter((d) => d.installed);
		const available = distros.filter((d) => !d.installed);

		let html = '<div style="text-align: left;">';

		html += "<p><strong>📦 Installed:</strong></p>";
		if (installed.length > 0) {
			html += '<ul style="margin-left: 1em; margin-bottom: 1em;">';
			for (const d of installed) {
				const size = await this.manager.getInstalledSize(d.id);
				html += `<li>${d.icon} ${d.name} ${d.version} <span style="color: #888;">(${size})</span></li>`;
			}
			html += "</ul>";
		} else {
			html += '<p style="color: #888; margin-left: 1em;">None</p><br>';
		}

		html += "<p><strong>📥 Available:</strong></p>";
		html += '<ul style="margin-left: 1em;">';
		for (const d of available) {
			html += `<li>${d.icon} ${d.name} ${d.version} <span style="color: #888;">(${d.size})</span></li>`;
		}
		html += "</ul></div>";

		alert("Distributions", html);
	}

	async showDistroInfo() {
		const distros = this.manager.getAvailableDistros();

		const options = distros.map((d) => [
			d.id,
			`${d.icon} ${d.name}`,
			d.installed ? "✓ Installed" : "Not installed",
		]);

		const selected = await select("Select Distribution", options, {
			textTransform: false,
		});

		if (!selected) return;

		const distro = this.manager.getDistroInfo(selected);
		let size = "N/A";

		if (distro.installed) {
			size = await this.manager.getInstalledSize(selected);
		}

		const statusColor = distro.installed ? "#4CAF50" : "#888";
		const statusText = distro.installed
			? `✅ Installed (${size})`
			: "❌ Not installed";

		const html = `
      <div style="text-align: left;">
        <p style="font-size: 1.2em;">${distro.icon} <strong>${distro.name}</strong> ${distro.version}</p>
        <p style="color: #888; margin-bottom: 1em;">${distro.description}</p>
        
        <table style="width: 100%; font-size: 0.9em;">
          <tr><td style="color: #888;">Package Manager</td><td><strong>${distro.pkgManager}</strong></td></tr>
          <tr><td style="color: #888;">Download Size</td><td>${distro.size}</td></tr>
          <tr><td style="color: #888;">Status</td><td style="color: ${statusColor};">${statusText}</td></tr>
          ${distro.active ? '<tr><td style="color: #888;">State</td><td style="color: #4CAF50;">🟢 Active</td></tr>' : ""}
        </table>
        
        <p style="margin-top: 1em; font-size: 0.8em; color: #666;">
          <strong>Path:</strong> ${distro.installPath}
        </p>
      </div>
    `;

		alert("Distribution Info", html);
	}

	destroy() {
		const { commands } = editorManager.editor;

		Object.values(COMMANDS).forEach((cmd) => {
			commands.removeCommand(cmd);
		});
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
