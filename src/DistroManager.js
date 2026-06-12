import DISTROS from "./distros.js";

const DISTROS_DIR = "distros";
const CONFIG_FILE = "distro-manager.json";

function shellQuote(value) {
	return `'${String(value).replace(/'/g, "'\\''")}'`;
}

class DistroManager {
	constructor(filesDir) {
		this.filesDir = filesDir;
		this.distrosPath = `${filesDir}/${DISTROS_DIR}`;
		this.configPath = `${filesDir}/${CONFIG_FILE}`;
		this.arch = null;
		this.config = { installed: {}, activeDistro: null };
	}

	async init() {
		this.arch = await new Promise((resolve, reject) => {
			system.getArch(resolve, reject);
		});

		await this.ensureDistrosDir();
		await this.loadConfig();
	}

	async ensureDistrosDir() {
		const exists = await this.fileExists(this.distrosPath);
		if (!exists) {
			await new Promise((resolve, reject) => {
				system.mkdirs(this.distrosPath, resolve, reject);
			});
		}
	}

	async loadConfig() {
		try {
			const exists = await this.fileExists(this.configPath);
			if (exists) {
				const content = await Executor.BackgroundExecutor.execute(
					`cat "${this.configPath}"`,
				);
				this.config = JSON.parse(content);
			}
		} catch (e) {
			console.warn("Failed to load config, using defaults:", e);
		}
	}

	async saveConfig() {
		const content = JSON.stringify(this.config, null, 2);
		await new Promise((resolve, reject) => {
			system.writeText(this.configPath, content, resolve, reject);
		});
	}

	fileExists(path) {
		return new Promise((resolve, reject) => {
			system.fileExists(
				path,
				false,
				(result) => {
					resolve(result === 1);
				},
				reject,
			);
		});
	}

	getAvailableDistros() {
		return Object.entries(DISTROS)
			.filter(([_, distro]) => distro.urls[this.arch])
			.map(([id, distro]) => ({
				id,
				...distro,
				installed: !!this.config.installed[id],
				active: this.config.activeDistro === id,
			}));
	}

	getDistroInfo(distroId) {
		const distro = DISTROS[distroId];
		if (!distro) return null;

		return {
			id: distroId,
			...distro,
			installed: !!this.config.installed[distroId],
			active: this.config.activeDistro === distroId,
			installPath: `${this.distrosPath}/${distroId}`,
		};
	}

	async install(distroId, logger = console.log) {
		const distro = DISTROS[distroId];
		if (!distro) {
			throw new Error(`Unknown distro: ${distroId}`);
		}

		const url = distro.urls[this.arch];
		if (!url) {
			throw new Error(`Distro ${distroId} not available for ${this.arch}`);
		}

		const distroPath = `${this.distrosPath}/${distroId}`;
		const rootfsPath = `${distroPath}/rootfs`;
		const isXz = distro.isXz || url.endsWith(".xz");
		const tarFileName = `${distroId}.tar${isXz ? ".xz" : ".gz"}`;
		const tarFilePath = `${this.filesDir}/${tarFileName}`;
		const decompressedTarPath = `${this.filesDir}/${distroId}.tar`;

		try {
			logger(`${distro.icon} Installing ${distro.name} ${distro.version}...`);
			logger(`📦 Size: ${distro.size}`);

			if (await this.fileExists(distroPath)) {
				logger("🧹 Removing existing installation...");
				await Executor.execute(`rm -rf "${distroPath}"`);
			}

			await new Promise((resolve, reject) => {
				system.mkdirs(rootfsPath, resolve, reject);
			});

			logger("⬇️ Downloading rootfs...");
			await new Promise((resolve, reject) => {
				cordova.plugin.http.downloadFile(
					url,
					{},
					{},
					cordova.file.dataDirectory + tarFileName,
					resolve,
					(err) => {
						console.error("Download error:", err);
						reject(new Error(`Download failed: ${JSON.stringify(err)}`));
					},
				);
			});

			logger("📂 Extracting rootfs...");

			if (isXz) {
				logger("   → Installing xz-utils...");
				await Executor.execute(
					`sh -c ${shellQuote("apk add --quiet xz 2>/dev/null || true")}`,
					true,
				);

				logger(
					"   → Decompressing xz archive (this may take a few minutes)...",
				);

				// Decompress in Alpine where xz is available, then extract from Android
				// shell to avoid proot fd-binding warnings breaking tar extraction.
				await Executor.execute(
					`sh -c ${shellQuote(`rm -f "${decompressedTarPath}" && xz -dc "${tarFilePath}" > "${decompressedTarPath}"`)}`,
					true,
				);

				const tarFile = decompressedTarPath;
				const tarExists = await Executor.BackgroundExecutor.execute(
					`test -f "${tarFile}" && echo "yes" || echo "no"`,
				);

				if (tarExists.trim() !== "yes") {
					throw new Error(
						"Failed to decompress xz archive. The downloaded file may be incomplete or corrupted.",
					);
				}

				logger("   → Extracting tar archive...");
				await Executor.execute(
					`tar --no-same-owner -xf "${tarFile}" -C "${rootfsPath}" 2>&1`,
					true,
				);
				await Executor.execute(`rm -f "${tarFile}" "${tarFilePath}"`, true);

				// Verify extraction worked
				const fileCount = await Executor.BackgroundExecutor.execute(
					`ls "${rootfsPath}" 2>/dev/null | wc -l`,
					true,
				);
				if (Number.parseInt(fileCount.trim(), 10) === 0) {
					throw new Error(
						"Extraction produced no files. The archive may be corrupted or xz decompression failed.",
					);
				}
			} else {
				logger("   → Extracting gzip archive...");
				await Executor.execute(
					`tar --no-same-owner -xzf "${tarFilePath}" -C "${rootfsPath}" 2>&1`,
					true,
				);
				await Executor.execute(`rm -f "${tarFilePath}"`, true);
			}

			if (distro.isProotDistro) {
				const lsResult = await Executor.BackgroundExecutor.execute(
					`ls "${rootfsPath}" 2>/dev/null || echo ""`,
				);
				const innerDirs = lsResult.trim().split("\n").filter(Boolean);
				const standardDirs = [
					"bin",
					"etc",
					"lib",
					"lib64",
					"usr",
					"var",
					"root",
					"home",
					"tmp",
					"dev",
					"proc",
					"sys",
					"run",
					"opt",
					"srv",
					"mnt",
					"media",
					"sbin",
					"boot",
				];

				if (innerDirs.length === 1 && !standardDirs.includes(innerDirs[0])) {
					logger("📁 Fixing rootfs structure...");
					const nestedDir = innerDirs[0];
					await Executor.execute(
						`cd "${rootfsPath}" && mv "${nestedDir}"/* . 2>/dev/null; rmdir "${nestedDir}" 2>/dev/null || true`,
					);
				}
			}

			logger("⚙️ Configuring DNS...");
			await new Promise((resolve, reject) => {
				system.writeText(
					`${rootfsPath}/etc/resolv.conf`,
					"nameserver 8.8.8.8\nnameserver 8.8.4.4",
					resolve,
					reject,
				);
			});

			this.config.installed[distroId] = {
				installedAt: new Date().toISOString(),
				version: distro.version,
			};
			await this.saveConfig();

			logger(`✅ ${distro.name} installed successfully!`);
			return true;
		} catch (error) {
			logger(`❌ Installation failed: ${error.message || error}`);
			await Executor.execute(`rm -rf "${distroPath}" 2>/dev/null || true`);
			await Executor.execute(
				`rm -f "${tarFilePath}" "${decompressedTarPath}" 2>/dev/null || true`,
			);
			throw error;
		}
	}

	async uninstall(distroId, logger = console.log) {
		const distro = DISTROS[distroId];
		if (!distro) {
			throw new Error(`Unknown distro: ${distroId}`);
		}

		const distroPath = `${this.distrosPath}/${distroId}`;

		logger(`🗑️ Uninstalling ${distro.name}...`);

		if (this.config.activeDistro === distroId) {
			this.config.activeDistro = null;
		}

		await Executor.execute(`rm -rf "${distroPath}"`);
		delete this.config.installed[distroId];
		await this.saveConfig();

		logger(`✅ ${distro.name} uninstalled`);
	}

	async execInDistro(distroId, command) {
		const distro = DISTROS[distroId];
		if (!distro) {
			throw new Error(`Unknown distro: ${distroId}`);
		}

		const rootfsPath = `${this.distrosPath}/${distroId}/rootfs`;
		const script = this.generateProotScript(rootfsPath, command, distro.shell);
		return await Executor.execute(script);
	}

	async startShell(distroId, onData) {
		const distro = DISTROS[distroId];
		if (!distro) {
			throw new Error(`Unknown distro: ${distroId}`);
		}

		if (!this.config.installed[distroId]) {
			throw new Error(`${distro.name} is not installed`);
		}

		const rootfsPath = `${this.distrosPath}/${distroId}/rootfs`;
		const script = this.generateProotScript(
			rootfsPath,
			distro.shell,
			distro.shell,
		);

		this.config.activeDistro = distroId;
		await this.saveConfig();

		const pid = await Executor.start("sh", onData, false);
		await Executor.write(pid, `${script}\n`);

		return pid;
	}

	generateProotScript(rootfsPath, command, shell = "/bin/sh") {
		return `
export LD_LIBRARY_PATH=$PREFIX
export PROOT_TMP_DIR=$PREFIX/tmp

mkdir -p "$PREFIX/tmp"

if [ -f "$NATIVE_DIR/libproot.so" ]; then
  export PROOT_LOADER="$NATIVE_DIR/libproot.so"
fi
if [ -f "$NATIVE_DIR/libproot32.so" ]; then
  export PROOT_LOADER32="$NATIVE_DIR/libproot32.so"
fi
export PROOT="$NATIVE_DIR/libproot-xed.so"

ARGS="--kill-on-exit"

for mnt in /apex /odm /product /system /system_ext /vendor /linkerconfig/ld.config.txt; do
  [ -e "$mnt" ] && ARGS="$ARGS -b $(realpath $mnt)"
done

ARGS="$ARGS -b /sdcard -b /storage -b /dev -b /data -b /proc -b /sys"
ARGS="$ARGS -b /dev/urandom:/dev/random"
ARGS="$ARGS -b $PREFIX/public:/public"
ARGS="$ARGS -b $PREFIX/public:/home"
ARGS="$ARGS -b $PREFIX/public:/root"
ARGS="$ARGS -r ${rootfsPath}"
ARGS="$ARGS -0 --link2symlink --sysvipc -L"
ARGS="$ARGS -w /root"

$PROOT $ARGS ${shell} -c "${command.replace(/"/g, '\\"')}"
`;
	}

	async getInstalledSize(distroId) {
		const distroPath = `${this.distrosPath}/${distroId}`;
		try {
			const result = await Executor.BackgroundExecutor.execute(
				`du -sh "${distroPath}" 2>/dev/null | cut -f1`,
			);
			return result.trim() || "Unknown";
		} catch {
			return "Unknown";
		}
	}
}

export default DistroManager;
