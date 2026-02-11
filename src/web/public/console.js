// Matrioshka Brain Management Console

const API_BASE = '';

// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const tabName = tab.dataset.tab;
    
    // Update tabs
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    
    // Update content
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');
    
    // Load data for the tab
    loadTabData(tabName);
  });
});

// Load initial dashboard
loadTabData('dashboard');

function loadTabData(tabName) {
  switch (tabName) {
    case 'dashboard':
      loadDashboard();
      break;
    case 'plugins':
      loadPlugins();
      break;
    case 'schedules':
      loadSchedules();
      break;
    case 'memory':
      loadMemoryStats();
      break;
    case 'telegram':
      loadTelegramPairs();
      break;
    case 'audit':
      loadAuditLog();
      break;
  }
}

// ============================================
// Dashboard
// ============================================

async function loadDashboard() {
  try {
    const response = await fetch(`${API_BASE}/api/status`);
    const data = await response.json();
    
    document.getElementById('telegram-status').innerHTML = 
      data.telegram.running 
        ? '<span class="badge success">Running</span>' 
        : '<span class="badge error">Stopped</span>';
    
    document.getElementById('plugins-status').textContent = 
      `${data.plugins.enabled} / ${data.plugins.installed} enabled`;
    
    document.getElementById('schedules-status').textContent = 
      `${data.scheduler.enabled} / ${data.scheduler.tasks} enabled`;
    
    document.getElementById('heartbeat-status').innerHTML = 
      data.heartbeat.enabled 
        ? `<span class="badge success">Enabled</span><br><small>${data.heartbeat.interval / 60000}min interval</small>` 
        : '<span class="badge error">Disabled</span>';
  } catch (error) {
    console.error('Failed to load dashboard:', error);
  }
}

// ============================================
// Plugins
// ============================================

document.getElementById('refresh-plugins').addEventListener('click', loadPlugins);

async function loadPlugins() {
  const container = document.getElementById('plugins-list');
  container.innerHTML = '<div class="list-item">Loading...</div>';
  
  try {
    const response = await fetch(`${API_BASE}/api/plugins`);
    const data = await response.json();
    
    if (data.plugins.length === 0) {
      container.innerHTML = '<div class="list-item">No plugins installed</div>';
      return;
    }
    
    container.innerHTML = data.plugins.map(plugin => `
      <div class="list-item">
        <div>
          <div class="list-item-title">${plugin.name}</div>
          <div class="list-item-meta">
            ${plugin.enabled ? '<span class="badge success">Enabled</span>' : '<span class="badge">Disabled</span>'}
            ${plugin.configured ? '<span class="badge info">Configured</span>' : '<span class="badge warning">Not Configured</span>'}
            ${plugin.errors ? `<span class="badge error">${plugin.errors.join(', ')}</span>` : ''}
          </div>
        </div>
        <div class="list-item-actions">
          <button class="btn" onclick="togglePlugin('${plugin.name}', ${!plugin.enabled})">
            ${plugin.enabled ? 'Disable' : 'Enable'}
          </button>
          <button class="btn danger" onclick="removePlugin('${plugin.name}')">Remove</button>
        </div>
      </div>
    `).join('');
  } catch (error) {
    container.innerHTML = `<div class="list-item">Error: ${error.message}</div>`;
  }
}

async function togglePlugin(name, enabled) {
  try {
    await fetch(`${API_BASE}/api/plugins/${name}/configure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    loadPlugins();
  } catch (error) {
    alert(`Failed to toggle plugin: ${error.message}`);
  }
}

async function removePlugin(name) {
  if (!confirm(`Remove plugin "${name}"?`)) return;
  
  try {
    await fetch(`${API_BASE}/api/plugins/${name}`, { method: 'DELETE' });
    loadPlugins();
  } catch (error) {
    alert(`Failed to remove plugin: ${error.message}`);
  }
}

// ============================================
// Schedules
// ============================================

document.getElementById('refresh-schedules').addEventListener('click', loadSchedules);

async function loadSchedules() {
  const container = document.getElementById('schedules-list');
  container.innerHTML = '<div class="list-item">Loading...</div>';
  
  try {
    const response = await fetch(`${API_BASE}/api/schedules`);
    const data = await response.json();
    
    if (data.schedules.length === 0) {
      container.innerHTML = '<div class="list-item">No scheduled tasks</div>';
      return;
    }
    
    container.innerHTML = data.schedules.map(schedule => `
      <div class="list-item">
        <div>
          <div class="list-item-title">${schedule.name}</div>
          <div class="list-item-meta">
            ${schedule.enabled ? '<span class="badge success">Enabled</span>' : '<span class="badge">Disabled</span>'}
            Schedule: ${schedule.schedule}
          </div>
        </div>
        <div class="list-item-actions">
          <button class="btn" onclick="toggleSchedule('${schedule.id}', ${!schedule.enabled})">
            ${schedule.enabled ? 'Disable' : 'Enable'}
          </button>
          <button class="btn danger" onclick="removeSchedule('${schedule.id}')">Remove</button>
        </div>
      </div>
    `).join('');
  } catch (error) {
    container.innerHTML = `<div class="list-item">Error: ${error.message}</div>`;
  }
}

async function toggleSchedule(id, enabled) {
  try {
    await fetch(`${API_BASE}/api/schedules/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    loadSchedules();
  } catch (error) {
    alert(`Failed to toggle schedule: ${error.message}`);
  }
}

async function removeSchedule(id) {
  if (!confirm('Remove this scheduled task?')) return;
  
  try {
    await fetch(`${API_BASE}/api/schedules/${id}`, { method: 'DELETE' });
    loadSchedules();
  } catch (error) {
    alert(`Failed to remove schedule: ${error.message}`);
  }
}

// ============================================
// Memory
// ============================================

document.getElementById('memory-search-btn').addEventListener('click', searchMemory);
document.getElementById('memory-search').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') searchMemory();
});

async function loadMemoryStats() {
  const container = document.getElementById('memory-stats');
  container.innerHTML = 'Loading...';
  
  try {
    const response = await fetch(`${API_BASE}/api/memory/stats`);
    const data = await response.json();
    
    container.innerHTML = `
      <div class="stat">
        <div class="stat-label">Total Memories</div>
        <div class="stat-value">${data.count || 0}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Database Size</div>
        <div class="stat-value">${formatBytes(data.size || 0)}</div>
      </div>
    `;
  } catch (error) {
    container.innerHTML = `Error: ${error.message}`;
  }
}

async function searchMemory() {
  const query = document.getElementById('memory-search').value;
  if (!query.trim()) return;
  
  const container = document.getElementById('memory-results');
  container.innerHTML = '<div class="list-item">Searching...</div>';
  
  try {
    const response = await fetch(`${API_BASE}/api/memory/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit: 20 }),
    });
    const data = await response.json();
    
    if (data.results && data.results.length === 0) {
      container.innerHTML = '<div class="list-item">No results found</div>';
      return;
    }
    
    container.innerHTML = (data.results || []).map(memory => `
      <div class="list-item">
        <div>
          <div class="list-item-title">${escapeHtml(memory.content.substring(0, 100))}...</div>
          <div class="list-item-meta">
            ${memory.tags ? memory.tags.map(t => `<span class="badge info">${t}</span>`).join(' ') : ''}
            <br>Score: ${(memory.score * 100).toFixed(1)}%
          </div>
        </div>
        <div class="list-item-actions">
          <button class="btn danger" onclick="deleteMemory('${memory.id}')">Delete</button>
        </div>
      </div>
    `).join('');
  } catch (error) {
    container.innerHTML = `<div class="list-item">Error: ${error.message}</div>`;
  }
}

async function deleteMemory(id) {
  if (!confirm('Delete this memory?')) return;
  
  try {
    await fetch(`${API_BASE}/api/memory/${id}`, { method: 'DELETE' });
    searchMemory(); // Refresh results
  } catch (error) {
    alert(`Failed to delete memory: ${error.message}`);
  }
}

// ============================================
// Soul Files
// ============================================

document.getElementById('load-soul-file').addEventListener('click', loadSoulFile);
document.getElementById('save-soul-file').addEventListener('click', saveSoulFile);

async function loadSoulFile() {
  const filename = document.getElementById('soul-file-select').value;
  const editor = document.getElementById('soul-editor');
  
  try {
    const response = await fetch(`${API_BASE}/api/soul/${filename}`);
    const data = await response.json();
    editor.value = data.content;
  } catch (error) {
    alert(`Failed to load file: ${error.message}`);
  }
}

async function saveSoulFile() {
  const filename = document.getElementById('soul-file-select').value;
  const content = document.getElementById('soul-editor').value;
  
  try {
    await fetch(`${API_BASE}/api/soul/${filename}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    alert('File saved successfully');
  } catch (error) {
    alert(`Failed to save file: ${error.message}`);
  }
}

// ============================================
// Telegram
// ============================================

document.getElementById('refresh-telegram').addEventListener('click', loadTelegramPairs);

async function loadTelegramPairs() {
  const container = document.getElementById('telegram-pairs');
  container.innerHTML = '<div class="list-item">Loading...</div>';
  
  try {
    const response = await fetch(`${API_BASE}/api/telegram/pairs`);
    const data = await response.json();
    
    if (!data.pending || data.pending.length === 0) {
      container.innerHTML = '<div class="list-item">No pending pairing requests</div>';
      return;
    }
    
    container.innerHTML = data.pending.map(pair => `
      <div class="list-item">
        <div>
          <div class="list-item-title">${pair.first_name || 'Unknown'} (@${pair.username || 'no-username'})</div>
          <div class="list-item-meta">User ID: ${pair.user_id}</div>
        </div>
        <div class="list-item-actions">
          <button class="btn primary" onclick="approvePairing(${pair.user_id})">Approve</button>
          <button class="btn danger" onclick="denyPairing(${pair.user_id})">Deny</button>
        </div>
      </div>
    `).join('');
  } catch (error) {
    container.innerHTML = `<div class="list-item">Error: ${error.message}</div>`;
  }
}

async function approvePairing(userId) {
  try {
    await fetch(`${API_BASE}/api/telegram/pairs/${userId}/approve`, { method: 'POST' });
    loadTelegramPairs();
  } catch (error) {
    alert(`Failed to approve pairing: ${error.message}`);
  }
}

async function denyPairing(userId) {
  try {
    await fetch(`${API_BASE}/api/telegram/pairs/${userId}/deny`, { method: 'POST' });
    loadTelegramPairs();
  } catch (error) {
    alert(`Failed to deny pairing: ${error.message}`);
  }
}

// ============================================
// Audit Log
// ============================================

document.getElementById('refresh-audit').addEventListener('click', loadAuditLog);

async function loadAuditLog() {
  const container = document.getElementById('audit-log');
  container.innerHTML = '<div class="list-item">Loading...</div>';
  
  try {
    const response = await fetch(`${API_BASE}/api/audit`);
    const data = await response.json();
    
    if (data.logs.length === 0) {
      container.innerHTML = '<div class="list-item">No audit logs</div>';
      return;
    }
    
    container.innerHTML = data.logs.map(log => `
      <div class="list-item">
        <div>
          <div class="list-item-title">${log.action || 'Unknown Action'}</div>
          <div class="list-item-meta">
            ${new Date(log.timestamp).toLocaleString()}
            ${log.details ? `<br>${escapeHtml(JSON.stringify(log.details))}` : ''}
          </div>
        </div>
      </div>
    `).join('');
  } catch (error) {
    container.innerHTML = `<div class="list-item">Error: ${error.message}</div>`;
  }
}

// ============================================
// Utilities
// ============================================

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
