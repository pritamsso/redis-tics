# Redis Tics 📊

A powerful, open-source Redis analytics and monitoring dashboard built with **Tauri**, **React**, and **Rust**. Monitor multiple Redis servers in real-time, analyze memory usage, track commands by IP, and diagnose performance issues.

![Redis Tics Dashboard](docs/screenshot.png)

## ✨ Features

### 🖥️ Multi-Server Management
- Connect and monitor multiple Redis servers simultaneously
- Persistent connection configurations
- Quick connect/disconnect with visual status indicators

### 📡 Real-time Monitoring
- Live command monitoring using Redis MONITOR
- Track commands by IP address
- Filter by command type or client IP
- Visual traffic pattern analysis with charts

### 💾 Memory Analytics
- **MEMORY STATS** - Total allocation, peak usage, dataset size
- **MEMORY DOCTOR** - Automated health recommendations
- Fragmentation ratio tracking
- Keys count and average size per key

### ⚡ Command Statistics
- Top commands by call count
- Slowest commands by average latency (μs/call)
- Rejected and failed call tracking
- Command distribution visualization

### 🐢 Slow Log Analysis
- View slow queries with **SLOWLOG GET**
- Color-coded severity badges
- Client information and execution duration
- Timestamp tracking

### 🔄 Cluster Support
- **CLUSTER INFO** - State, slots, node count
- **CLUSTER NODES** - Node list with roles and slot assignments
- Cluster health monitoring

### 💿 Persistence Status
- **RDB** - Last save time, changes since save, BGSAVE status
- **AOF** - Enabled state, current/base size, rewrite status
- Background save progress tracking

### 🔍 Diagnostics
- **LATENCY DOCTOR** - Automated latency analysis
- Error statistics tracking
- CPU usage monitoring

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://www.rust-lang.org/tools/install)
- [Tauri CLI](https://tauri.app/v1/guides/getting-started/prerequisites)

### Installation

```bash
# Clone the repository
git clone https://github.com/pritamsso/redis-tics.git
cd redis-tics

# Install dependencies
npm install

# Run in development mode
cargo tauri dev

# Build for production
cargo tauri build
```

### Download Pre-built Binaries
Download the latest release for your platform from the [Releases](https://github.com/pritamsso/redis-tics/releases) page.

#### macOS Installation Note ⚠️

Since the app is not signed with an Apple Developer certificate, macOS Gatekeeper may show **"Redis Tics is damaged and can't be opened"** error.

**To fix this, run one of these commands in Terminal:**

```bash
# If you installed to Applications:
xattr -cr /Applications/Redis\ Tics.app

# Or for the downloaded DMG file:
xattr -cr ~/Downloads/Redis\ Tics*.dmg
```

Then open the app normally. This removes the quarantine attribute that macOS adds to downloaded files.

**Alternative method:**
1. Right-click (or Control-click) the app
2. Select "Open" from the context menu
3. Click "Open" in the dialog that appears

#### Linux Installation

```bash
# For .deb (Ubuntu/Debian):
sudo dpkg -i redis-tics_*.deb

# For .AppImage:
chmod +x Redis_Tics*.AppImage
./Redis_Tics*.AppImage
```

#### Windows Installation

Run the `.msi` installer or the `.exe` (NSIS installer). If Windows SmartScreen appears, click "More info" → "Run anyway".

## 🖼️ Screenshots

<details>
<summary>Server Info Panel</summary>

View comprehensive server information including version, memory, stats, keyspace, and replication status.
</details>

<details>
<summary>Real-time Monitor</summary>

Watch live Redis commands with IP tracking and command distribution charts.
</details>

<details>
<summary>Advanced Analytics</summary>

Deep dive into memory stats, command performance, slow logs, and cluster information.
</details>

## 🛠️ Tech Stack

- **Frontend**: React + TypeScript + Vite + TailwindCSS v4 + Recharts
- **Backend**: Rust + Tauri v2 + Redis crate (async)
- **UI Components**: Custom components with shadcn/ui patterns

## 📖 Usage

1. **Add a Server**: Click the `+` button in the sidebar to add a new Redis server
2. **Connect**: Click the plug icon to connect to a server
3. **Explore Tabs**:
   - **Server Info**: View server details and statistics
   - **Clients**: See connected clients and top IPs
   - **Monitor**: Real-time command monitoring
   - **Analytics**: Advanced memory, command, and performance analytics
4. **Monitor Traffic**: Start monitoring to see live commands by IP

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the Apache License 2.0 with additional attribution requirements - see the [LICENSE](LICENSE) file for details.

**Important**: The credits and attribution to the original developer must not be removed or modified. See the LICENSE file for full terms.

## 👨‍💻 Author

**Pritam** ([@pritamsso](https://github.com/pritamsso))

Made with ❤️ by [@pritamsso](https://github.com/pritamsso)

## 🌟 Star History

If you find this project useful, please consider giving it a ⭐️!

## 📬 Support

- 🐛 [Report a Bug](https://github.com/pritamsso/redis-tics/issues/new?template=bug_report.md)
- 💡 [Request a Feature](https://github.com/pritamsso/redis-tics/issues/new?template=feature_request.md)
- 💬 [Discussions](https://github.com/pritamsso/redis-tics/discussions)

---

<p align="center">
  <sub>Built with ❤️ by <a href="https://github.com/pritamsso">@pritamsso</a></sub>
</p>
