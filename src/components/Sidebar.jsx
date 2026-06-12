import { h, Fragment } from "preact";
import { useState, useEffect, useRef } from "preact/hooks";

export default function Sidebar({ plugin }) {
  const [distros, setDistros] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [installStates, setInstallStates] = useState({});
  const [runningPorts, setRunningPorts] = useState({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [defaultTerminal, setDefaultTerminal] = useState(() => {
    return localStorage.getItem("distro-manager-default-terminal") || "builtin";
  });
  
  const logRefs = useRef({});

  // Detect if AcodeX terminal plugin is installed
  const hasAcodeX = typeof acode !== "undefined" && !!acode.require("acodex");

  // Fetch data and register observer
  useEffect(() => {
    const update = () => {
      setDistros(plugin.manager.getAvailableDistros());
      setInstallStates({ ...plugin.installStates });
    };

    plugin.addListener(update);
    update();
    checkActiveServers();

    return () => {
      plugin.removeListener(update);
    };
  }, [plugin]);

  // Scroll to bottom of logs when they update
  useEffect(() => {
    Object.keys(installStates).forEach((id) => {
      const ref = logRefs.current[id];
      if (ref) {
        ref.scrollTop = ref.scrollHeight;
      }
    });
  }, [installStates]);

  const checkActiveServers = async () => {
    setIsRefreshing(true);
    const available = plugin.manager.getAvailableDistros();
    const statuses = {};
    const DEFAULT_PORT = 43130;
    
    // Get all distro IDs from DISTROS import (keys)
    const distroIds = Object.keys(plugin.manager.getAvailableDistros().reduce((acc, d) => {
      acc[d.id] = d;
      return acc;
    }, {}));

    for (const d of available) {
      if (d.installed) {
        // Calculate port using index in DISTROS object
        const index = distroIds.indexOf(d.id);
        const port = DEFAULT_PORT + (index >= 0 ? index : 0);
        const isRunning = await plugin.checkServerRunning(port);
        if (isRunning) {
          statuses[d.id] = port;
        }
      }
    }
    setRunningPorts(statuses);
    setIsRefreshing(false);
  };

  const handleRefresh = () => {
    checkActiveServers();
    setDistros(plugin.manager.getAvailableDistros());
  };

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleInstall = async (id) => {
    setExpandedId(id);
    await plugin.installDistro(id);
    handleRefresh();
  };

  const handleUninstall = async (id) => {
    const distro = distros.find((d) => d.id === id);
    if (!distro) return;

    const confirmMsg = `Are you sure you want to permanently delete ${distro.name}? All packages and files in this distribution will be lost.`;
    const confirm = acode.require("confirm");
    const isConfirm = await confirm("Uninstall Distribution", confirmMsg, true);

    if (isConfirm) {
      setExpandedId(id);
      await plugin.uninstallDistro(id);
      handleRefresh();
    }
  };

  const triggerLaunch = async (distroId, type) => {
    const DEFAULT_PORT = 43130;
    const available = plugin.manager.getAvailableDistros();
    const distroIds = available.map((d) => d.id);
    const port = DEFAULT_PORT + distroIds.indexOf(distroId);

    try {
      if (type === "acodex" || type === "builtin") {
        await plugin.launchTerminal(distroId, type, port);
        // Refresh server status
        setTimeout(checkActiveServers, 1500);
      }
    } catch (err) {
      acode.alert("Error", `Failed to launch shell: ${err.message || err}`);
    }
  };

  // Open native Acode select dialog for launch options
  const handleLaunchArrowClick = async (e, distro) => {
    e.stopPropagation();

    const options = [
      ["builtin", "Launch with Built-in Terminal", "Use Acode terminal UI directly"],
      ["acodex", "Launch with AcodeX Terminal", "Connect using AcodeX plugin"]
    ];

    const select = acode.require("select");
    const selected = await select(`${distro.name} Terminal`, options, {
      textTransform: false,
      default: defaultTerminal
    });

    if (selected) {
      setDefaultTerminal(selected);
      localStorage.setItem("distro-manager-default-terminal", selected);
      triggerLaunch(distro.id, selected);
    }
  };

  const filteredDistros = distros.filter((d) =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="distro-sidebar scroll">
      {/* Header */}
      <div className="sidebar-header">
        <div className="sidebar-title-container">
          <h3>Distro Manager</h3>
          <span className="arch-tag">Arch: {plugin.manager.arch || "loading..."}</span>
        </div>
        <button 
          className="btn-refresh" 
          onClick={handleRefresh}
          title="Refresh statuses"
          disabled={isRefreshing}
          style={isRefreshing ? "animation: rotate 1s linear infinite;" : ""}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
          </svg>
        </button>
      </div>

      {/* Search Bar */}
      <div className="sidebar-search">
        <input
          type="text"
          placeholder="Filter distributions..."
          value={searchQuery}
          onInput={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Distro List */}
      <div className="distro-list">
        {filteredDistros.length > 0 ? (
          filteredDistros.map((d) => {
            const isExpanded = expandedId === d.id;
            const state = installStates[d.id];
            const isBusy = state && (state.status === "installing" || state.status === "uninstalling");
            const isRunning = !!runningPorts[d.id];
            const isInstalled = d.installed;
            
            let statusText = "Not Installed";
            let statusClass = "not-installed";

            if (isBusy) {
              statusText = state.status === "installing" ? "Installing..." : "Removing...";
              statusClass = "busy";
            } else if (isRunning) {
              statusText = `Active (:${runningPorts[d.id]})`;
              statusClass = "active";
            } else if (isInstalled) {
              statusText = "Installed";
              statusClass = "installed";
            }

            return (
              <div className={`distro-card ${isRunning ? "active-distro" : ""}`} key={d.id}>
                {/* Accordion Header */}
                <div className="distro-card-header" onClick={() => toggleExpand(d.id)}>
                  <div className="distro-meta">
                    <div className="distro-emoji">{d.icon}</div>
                    <div className="distro-name-ver">
                      <span className="distro-name">{d.name}</span>
                      <span className="distro-ver">v{d.version}</span>
                    </div>
                  </div>
                  
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span className={`status-badge ${statusClass}`}>{statusText}</span>
                    <svg 
                      width="16" 
                      height="16" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      stroke-width="2.5" 
                      style={`transition: transform 0.2s; ${isExpanded ? "transform: rotate(180deg);" : ""}`}
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </div>
                </div>

                {/* Accordion Body */}
                {isExpanded && (
                  <div className="distro-card-body">
                    <p className="distro-desc">{d.description}</p>
                    
                    <div className="distro-details-grid">
                      <div className="detail-row">
                        <span className="detail-label">Size</span>
                        <span className="detail-value">{d.size}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Package Manager</span>
                        <span className="detail-value">{d.pkgManager}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Shell</span>
                        <span className="detail-value">{d.shell}</span>
                      </div>
                      {isInstalled && (
                        <div className="detail-row">
                          <span className="detail-label">Path</span>
                          <span className="detail-value path-value" title={`${plugin.manager.distrosPath}/${d.id}`}>
                            {d.id}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Busy/Progress Console */}
                    {isBusy && state.logs && (
                      <Fragment>
                        <div className="console-title">Process Logs</div>
                        <div className="console-logs" ref={(el) => (logRefs.current[d.id] = el)}>
                          {state.logs.map((log, i) => (
                            <div className="console-line" key={i}>{log}</div>
                          ))}
                        </div>
                      </Fragment>
                    )}

                    {/* Error Display */}
                    {state && state.status === "error" && (
                      <Fragment>
                        <div className="console-title" style="color: #f44336;">Error Output</div>
                        <div className="console-logs" style="border-color: rgba(244, 67, 54, 0.3);">
                          <div className="console-line error">{state.error}</div>
                          {state.logs && state.logs.slice(-5).map((log, i) => (
                            <div className="console-line" key={i} style="opacity: 0.7;">{log}</div>
                          ))}
                        </div>
                      </Fragment>
                    )}

                    {/* Actions bar */}
                    <div className="actions-container" style="margin-top: 10px;">
                      {isBusy ? (
                        <button className="btn btn-secondary" disabled>
                          <svg className="spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="animation: spin 1s linear infinite; margin-right: 4px;">
                            <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="10"/>
                          </svg>
                          Working...
                        </button>
                      ) : isInstalled ? (
                        <Fragment>
                          {hasAcodeX ? (
                            <div className="btn-group">
                              <button 
                                className="btn btn-primary btn-launch-main" 
                                onClick={() => triggerLaunch(d.id, defaultTerminal)}
                                title={`Launch shell in ${defaultTerminal === 'acodex' ? 'AcodeX' : 'Built-in Terminal'}`}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                  <polygon points="5 3 19 12 5 21 5 3"/>
                                </svg>
                                Launch ({defaultTerminal === "acodex" ? "AcodeX" : "Built-in"})
                              </button>
                              <button 
                                className="btn btn-primary btn-launch-arrow"
                                onClick={(e) => handleLaunchArrowClick(e, d)}
                                title="Select terminal type"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                                  <path d="M6 9l6 6 6-6" />
                                </svg>
                              </button>
                            </div>
                          ) : (
                            <button 
                              className="btn btn-primary" 
                              onClick={() => triggerLaunch(d.id, "builtin")}
                              title="Launch shell in Built-in Terminal"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <polygon points="5 3 19 12 5 21 5 3"/>
                              </svg>
                              Launch
                            </button>
                          )}
                          <button 
                            className="btn btn-secondary btn-icon-only" 
                            onClick={() => plugin.showLaunchLog(d.id)}
                            title="View last launch log"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                              <polyline points="14 2 14 8 20 8"/>
                              <line x1="16" y1="13" x2="8" y2="13"/>
                              <line x1="16" y1="17" x2="8" y2="17"/>
                              <polyline points="10 9 9 9 8 9"/>
                            </svg>
                          </button>
                          <button 
                            className="btn btn-danger btn-icon-only" 
                            onClick={() => handleUninstall(d.id)}
                            title="Uninstall distribution"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                              <polyline points="3 6 5 6 21 6"/>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                              <line x1="10" y1="11" x2="10" y2="17"/>
                              <line x1="14" y1="11" x2="14" y2="17"/>
                            </svg>
                          </button>
                        </Fragment>
                      ) : (
                        <button 
                          className="btn btn-primary" 
                          onClick={() => handleInstall(d.id)}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="7 10 12 15 17 10"/>
                            <line x1="12" y1="15" x2="12" y2="3"/>
                          </svg>
                          Install
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="no-results">No distributions found.</div>
        )}
      </div>

      {/* Spinner and Rotate styles */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes rotate {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
