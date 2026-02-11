// Cross-platform job scheduler

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { exec as execCallback } from 'node:child_process';
import { promisify } from 'node:util';
import type {
  Platform,
  ScheduleEntry,
  ScheduleRegistry,
  ScheduleStatus,
} from './types.js';
import { ScheduleRegistrySchema, ScheduleEntrySchema } from './types.js';

const exec = promisify(execCallback);

/**
 * Scheduler manager
 */
export class Scheduler {
  private registryPath: string;
  private registry: ScheduleRegistry | null = null;
  private platform: Platform;

  constructor(workspaceDir: string) {
    this.registryPath = path.join(workspaceDir, 'schedules.json');
    this.platform = process.platform as Platform;

    if (!['darwin', 'win32', 'linux'].includes(this.platform)) {
      throw new Error(`Unsupported platform: ${this.platform}`);
    }
  }

  /**
   * Load schedule registry from disk
   */
  async load(): Promise<ScheduleRegistry> {
    if (this.registry) return this.registry;

    try {
      const data = await fs.readFile(this.registryPath, 'utf-8');
      this.registry = ScheduleRegistrySchema.parse(JSON.parse(data));
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        // Initialize empty registry
        this.registry = { version: '1.0.0', schedules: [] };
        await this.save();
      } else {
        throw err;
      }
    }

    return this.registry;
  }

  /**
   * Save schedule registry to disk
   */
  async save(): Promise<void> {
    if (!this.registry) {
      throw new Error('Registry not loaded');
    }

    await fs.writeFile(
      this.registryPath,
      JSON.stringify(this.registry, null, 2),
      'utf-8'
    );
  }

  /**
   * List all schedules
   */
  async list(): Promise<ScheduleEntry[]> {
    const registry = await this.load();
    return registry.schedules.filter((s: ScheduleEntry) => s.platform === this.platform);
  }

  /**
   * Get schedule status
   */
  async status(id: string): Promise<ScheduleStatus | null> {
    const registry = await this.load();
    const schedule = registry.schedules.find((s: ScheduleEntry) => s.id === id);

    if (!schedule) return null;

    const installed = await this.isInstalled(schedule);

    return {
      id: schedule.id,
      name: schedule.name,
      enabled: schedule.enabled,
      installed,
      platform: schedule.platform,
    };
  }

  /**
   * Add a schedule
   */
  async add(entry: Omit<ScheduleEntry, 'id' | 'createdAt' | 'platform'>): Promise<ScheduleEntry> {
    const registry = await this.load();

    const schedule: ScheduleEntry = {
      ...entry,
      id: `schedule-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      createdAt: new Date().toISOString(),
      platform: this.platform,
    };

    ScheduleEntrySchema.parse(schedule);

    registry.schedules.push(schedule);
    await this.save();

    // Install the schedule
    if (schedule.enabled) {
      await this.install(schedule);
    }

    return schedule;
  }

  /**
   * Remove a schedule
   */
  async remove(id: string): Promise<void> {
    const registry = await this.load();
    const schedule = registry.schedules.find((s: ScheduleEntry) => s.id === id);

    if (!schedule) {
      throw new Error(`Schedule not found: ${id}`);
    }

    // Uninstall first
    await this.uninstall(schedule);

    // Remove from registry
    registry.schedules = registry.schedules.filter((s: ScheduleEntry) => s.id !== id);
    await this.save();
  }

  /**
   * Enable/disable a schedule
   */
  async toggle(id: string, enabled: boolean): Promise<void> {
    const registry = await this.load();
    const schedule = registry.schedules.find((s: ScheduleEntry) => s.id === id);

    if (!schedule) {
      throw new Error(`Schedule not found: ${id}`);
    }

    if (enabled && !schedule.enabled) {
      await this.install(schedule);
      schedule.enabled = true;
    } else if (!enabled && schedule.enabled) {
      await this.uninstall(schedule);
      schedule.enabled = false;
    }

    await this.save();
  }

  /**
   * Check if a schedule is installed on the OS
   */
  private async isInstalled(schedule: ScheduleEntry): Promise<boolean> {
    switch (this.platform) {
      case 'darwin':
        return this.isInstalledDarwin(schedule);
      case 'win32':
        return this.isInstalledWindows(schedule);
      case 'linux':
        return this.isInstalledLinux(schedule);
      default:
        return false;
    }
  }

  /**
   * Install a schedule on the OS
   */
  private async install(schedule: ScheduleEntry): Promise<void> {
    switch (this.platform) {
      case 'darwin':
        await this.installDarwin(schedule);
        break;
      case 'win32':
        await this.installWindows(schedule);
        break;
      case 'linux':
        await this.installLinux(schedule);
        break;
    }
  }

  /**
   * Uninstall a schedule from the OS
   */
  private async uninstall(schedule: ScheduleEntry): Promise<void> {
    switch (this.platform) {
      case 'darwin':
        await this.uninstallDarwin(schedule);
        break;
      case 'win32':
        await this.uninstallWindows(schedule);
        break;
      case 'linux':
        await this.uninstallLinux(schedule);
        break;
    }
  }

  // ========================================
  // macOS (launchd) implementation
  // ========================================

  private getLaunchdLabel(schedule: ScheduleEntry): string {
    return `com.matrioshka-brain.${schedule.id}`;
  }

  private getLaunchdPlistPath(schedule: ScheduleEntry): string {
    const label = this.getLaunchdLabel(schedule);
    return path.join(os.homedir(), 'Library', 'LaunchAgents', `${label}.plist`);
  }

  private generateLaunchdPlist(schedule: ScheduleEntry): string {
    const label = this.getLaunchdLabel(schedule);
    const workdir = schedule.workdir || os.homedir();

    // Parse schedule (simple format: "HH:MM" for daily, or "*/N * * * *" for cron)
    const startCalendarInterval = this.parseScheduleToDarwin(schedule.schedule);

    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${label}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/sh</string>
    <string>-c</string>
    <string>${schedule.command}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${workdir}</string>
  ${startCalendarInterval}
  <key>StandardOutPath</key>
  <string>${path.join(workdir, '.matrioshka-brain', 'logs', `${schedule.id}.log`)}</string>
  <key>StandardErrorPath</key>
  <string>${path.join(workdir, '.matrioshka-brain', 'logs', `${schedule.id}.err`)}</string>
</dict>
</plist>`;
  }

  private parseScheduleToDarwin(schedule: string): string {
    // Simple time format: "09:00" → daily at 9 AM
    const timeMatch = schedule.match(/^(\d{2}):(\d{2})$/);
    if (timeMatch) {
      const [, hour, minute] = timeMatch;
      return `  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>${parseInt(hour, 10)}</integer>
    <key>Minute</key>
    <integer>${parseInt(minute, 10)}</integer>
  </dict>`;
    }

    // Interval format: "every N minutes" → StartInterval
    const intervalMatch = schedule.match(/^every\s+(\d+)\s+minutes?$/i);
    if (intervalMatch) {
      const minutes = parseInt(intervalMatch[1], 10);
      return `  <key>StartInterval</key>
  <integer>${minutes * 60}</integer>`;
    }

    // Default: run every hour
    return `  <key>StartInterval</key>
  <integer>3600</integer>`;
  }

  private async installDarwin(schedule: ScheduleEntry): Promise<void> {
    const plistPath = this.getLaunchdPlistPath(schedule);
    const plist = this.generateLaunchdPlist(schedule);

    // Ensure LaunchAgents directory exists
    const launchAgentsDir = path.dirname(plistPath);
    await fs.mkdir(launchAgentsDir, { recursive: true });

    // Ensure log directory exists
    const logDir = path.join(schedule.workdir || os.homedir(), '.matrioshka-brain', 'logs');
    await fs.mkdir(logDir, { recursive: true });

    // Write plist
    await fs.writeFile(plistPath, plist, 'utf-8');

    // Load with launchctl
    const label = this.getLaunchdLabel(schedule);
    try {
      await exec(`launchctl unload ${plistPath} 2>/dev/null || true`);
      await exec(`launchctl load ${plistPath}`);
    } catch (err: any) {
      throw new Error(`Failed to load launchd job: ${err.message}`);
    }
  }

  private async uninstallDarwin(schedule: ScheduleEntry): Promise<void> {
    const plistPath = this.getLaunchdPlistPath(schedule);
    const label = this.getLaunchdLabel(schedule);

    try {
      await exec(`launchctl unload ${plistPath} 2>/dev/null || true`);
      await fs.unlink(plistPath).catch(() => {});
    } catch (err: any) {
      // Non-fatal
    }
  }

  private async isInstalledDarwin(schedule: ScheduleEntry): Promise<boolean> {
    const plistPath = this.getLaunchdPlistPath(schedule);
    try {
      await fs.access(plistPath);
      return true;
    } catch {
      return false;
    }
  }

  // ========================================
  // Windows (Task Scheduler) implementation
  // ========================================

  private getTaskName(schedule: ScheduleEntry): string {
    return `MatrioshkaBrain_${schedule.id}`;
  }

  private async installWindows(schedule: ScheduleEntry): Promise<void> {
    const taskName = this.getTaskName(schedule);
    const workdir = schedule.workdir || os.homedir();

    // Generate XML for task
    const xml = this.generateWindowsTaskXml(schedule);
    const xmlPath = path.join(os.tmpdir(), `${taskName}.xml`);
    await fs.writeFile(xmlPath, xml, 'utf-8');

    // Create task with schtasks
    try {
      await exec(`schtasks /create /tn "${taskName}" /xml "${xmlPath}" /f`);
      await fs.unlink(xmlPath);
    } catch (err: any) {
      throw new Error(`Failed to create Windows task: ${err.message}`);
    }
  }

  private generateWindowsTaskXml(schedule: ScheduleEntry): string {
    const workdir = schedule.workdir || os.homedir();
    const trigger = this.parseScheduleToWindows(schedule.schedule);

    return `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>${schedule.description || schedule.name}</Description>
  </RegistrationInfo>
  <Triggers>
    ${trigger}
  </Triggers>
  <Principals>
    <Principal>
      <LogonType>InteractiveToken</LogonType>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <WakeToRun>false</WakeToRun>
    <ExecutionTimeLimit>PT1H</ExecutionTimeLimit>
    <Priority>7</Priority>
  </Settings>
  <Actions>
    <Exec>
      <Command>cmd.exe</Command>
      <Arguments>/c "${schedule.command}"</Arguments>
      <WorkingDirectory>${workdir}</WorkingDirectory>
    </Exec>
  </Actions>
</Task>`;
  }

  private parseScheduleToWindows(schedule: string): string {
    // Simple time format: "09:00" → daily at 9 AM
    const timeMatch = schedule.match(/^(\d{2}):(\d{2})$/);
    if (timeMatch) {
      const [, hour, minute] = timeMatch;
      return `<CalendarTrigger>
      <StartBoundary>2024-01-01T${hour}:${minute}:00</StartBoundary>
      <ScheduleByDay>
        <DaysInterval>1</DaysInterval>
      </ScheduleByDay>
    </CalendarTrigger>`;
    }

    // Interval format
    const intervalMatch = schedule.match(/^every\s+(\d+)\s+minutes?$/i);
    if (intervalMatch) {
      const minutes = intervalMatch[1];
      return `<TimeTrigger>
      <Repetition>
        <Interval>PT${minutes}M</Interval>
      </Repetition>
      <StartBoundary>2024-01-01T00:00:00</StartBoundary>
    </TimeTrigger>`;
    }

    // Default: daily at noon
    return `<CalendarTrigger>
      <StartBoundary>2024-01-01T12:00:00</StartBoundary>
      <ScheduleByDay>
        <DaysInterval>1</DaysInterval>
      </ScheduleByDay>
    </CalendarTrigger>`;
  }

  private async uninstallWindows(schedule: ScheduleEntry): Promise<void> {
    const taskName = this.getTaskName(schedule);
    try {
      await exec(`schtasks /delete /tn "${taskName}" /f`);
    } catch {
      // Non-fatal
    }
  }

  private async isInstalledWindows(schedule: ScheduleEntry): Promise<boolean> {
    const taskName = this.getTaskName(schedule);
    try {
      await exec(`schtasks /query /tn "${taskName}"`);
      return true;
    } catch {
      return false;
    }
  }

  // ========================================
  // Linux (cron) implementation
  // ========================================

  private getCronEntry(schedule: ScheduleEntry): string {
    const cronSchedule = this.parseScheduleToCron(schedule.schedule);
    return `${cronSchedule} ${schedule.command} # matrioshka-brain:${schedule.id}`;
  }

  private parseScheduleToCron(schedule: string): string {
    // Time format: "09:00" → "0 9 * * *"
    const timeMatch = schedule.match(/^(\d{2}):(\d{2})$/);
    if (timeMatch) {
      const [, hour, minute] = timeMatch;
      return `${parseInt(minute, 10)} ${parseInt(hour, 10)} * * *`;
    }

    // Interval format: "every N minutes" → "*/N * * * *"
    const intervalMatch = schedule.match(/^every\s+(\d+)\s+minutes?$/i);
    if (intervalMatch) {
      return `*/${intervalMatch[1]} * * * *`;
    }

    // Default: hourly
    return '0 * * * *';
  }

  private async installLinux(schedule: ScheduleEntry): Promise<void> {
    // Read existing crontab
    let crontab = '';
    try {
      const result = await exec('crontab -l 2>/dev/null || true');
      crontab = result.stdout;
    } catch {
      // No existing crontab
    }

    // Add new entry
    const entry = this.getCronEntry(schedule);
    crontab += `\n${entry}\n`;

    // Write back
    const tmpFile = path.join(os.tmpdir(), `crontab-${Date.now()}`);
    await fs.writeFile(tmpFile, crontab, 'utf-8');

    try {
      await exec(`crontab ${tmpFile}`);
      await fs.unlink(tmpFile);
    } catch (err: any) {
      throw new Error(`Failed to install crontab: ${err.message}`);
    }
  }

  private async uninstallLinux(schedule: ScheduleEntry): Promise<void> {
    // Read existing crontab
    let crontab = '';
    try {
      const result = await exec('crontab -l 2>/dev/null || true');
      crontab = result.stdout;
    } catch {
      return; // No crontab
    }

    // Remove entry
    const lines = crontab.split('\n');
    const filtered = lines.filter(
      (line) => !line.includes(`# matrioshka-brain:${schedule.id}`)
    );

    // Write back
    const tmpFile = path.join(os.tmpdir(), `crontab-${Date.now()}`);
    await fs.writeFile(tmpFile, filtered.join('\n'), 'utf-8');

    try {
      await exec(`crontab ${tmpFile}`);
      await fs.unlink(tmpFile);
    } catch (err: any) {
      throw new Error(`Failed to update crontab: ${err.message}`);
    }
  }

  private async isInstalledLinux(schedule: ScheduleEntry): Promise<boolean> {
    try {
      const result = await exec('crontab -l 2>/dev/null || true');
      return result.stdout.includes(`# matrioshka-brain:${schedule.id}`);
    } catch {
      return false;
    }
  }
}
