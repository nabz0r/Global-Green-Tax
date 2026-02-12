'use client';

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  type DeploymentConfig,
  DEFAULT_CONFIG,
  generateDockerCompose,
  generateEnvFile,
  generateDeployScript,
  generateNginxConfig,
} from '@/lib/deploy-generator';

// ─── Icons (inline SVG for Lucide-style) ──────────────────────────────
function CloudIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
    </svg>
  );
}
function ServerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="8" x="2" y="2" rx="2" ry="2" /><rect width="20" height="8" x="2" y="14" rx="2" ry="2" />
      <line x1="6" x2="6.01" y1="6" y2="6" /><line x1="6" x2="6.01" y1="18" y2="18" />
    </svg>
  );
}
function DatabaseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5V19A9 3 0 0 0 21 19V5" /><path d="M3 12A9 3 0 0 0 21 12" />
    </svg>
  );
}
function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
function KeyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4" />
      <path d="m21 2-9.6 9.6" /><circle cx="7.5" cy="15.5" r="5.5" />
    </svg>
  );
}
function RocketIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" /><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  );
}
function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" />
    </svg>
  );
}
function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}
function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" /><circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
      <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
      <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
      <path d="m2 2 20 20" />
    </svg>
  );
}

// ─── Types ────────────────────────────────────────────────────────────
const STEPS = [
  { id: 'type', label: 'Deployment', icon: RocketIcon, desc: 'Cloud or On-Prem' },
  { id: 'infra', label: 'Infrastructure', icon: ServerIcon, desc: 'DB, Cache, Proxy' },
  { id: 'creds', label: 'Credentials', icon: KeyIcon, desc: 'Secrets & Keys' },
  { id: 'app', label: 'Application', icon: SettingsIcon, desc: 'Auth & Domain' },
  { id: 'review', label: 'Generate', icon: DownloadIcon, desc: 'Review & Export' },
] as const;

type StepId = (typeof STEPS)[number]['id'];

const PROVIDERS = [
  { id: 'aws', name: 'AWS', desc: 'Amazon Web Services', color: 'from-orange-500 to-orange-600' },
  { id: 'gcp', name: 'GCP', desc: 'Google Cloud Platform', color: 'from-blue-500 to-blue-600' },
  { id: 'azure', name: 'Azure', desc: 'Microsoft Azure', color: 'from-cyan-500 to-cyan-600' },
  { id: 'hetzner', name: 'Hetzner', desc: 'EU Cloud / Dedicated', color: 'from-red-500 to-red-600' },
  { id: 'ovh', name: 'OVH', desc: 'European Cloud', color: 'from-indigo-500 to-indigo-600' },
  { id: 'custom', name: 'Custom', desc: 'Self-managed VPS', color: 'from-gray-500 to-gray-600' },
] as const;

// ─── Reusable Components ──────────────────────────────────────────────

function SecretInput({
  label,
  value,
  onChange,
  placeholder,
  helper,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  helper?: string;
  required?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-foreground">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      <div className="relative">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-10 w-full rounded-lg border border-border bg-background px-3 pr-10 text-sm font-mono placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        >
          {visible ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
        </button>
      </div>
      {helper && <p className="mt-1 text-xs text-muted-foreground">{helper}</p>}
    </div>
  );
}

function FormInput({
  label,
  value,
  onChange,
  placeholder,
  helper,
  required,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  helper?: string;
  required?: boolean;
  mono?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-foreground">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`h-10 w-full rounded-lg border border-border bg-background px-3 text-sm placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all ${mono ? 'font-mono' : ''}`}
      />
      {helper && <p className="mt-1 text-xs text-muted-foreground">{helper}</p>}
    </div>
  );
}

function FormSelect({
  label,
  value,
  onChange,
  options,
  helper,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  helper?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-foreground">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all appearance-none cursor-pointer"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {helper && <p className="mt-1 text-xs text-muted-foreground">{helper}</p>}
    </div>
  );
}

function ToggleRow({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      className="flex items-center justify-between rounded-lg border border-border p-4 cursor-pointer hover:bg-muted/30 transition-colors"
      onClick={() => onChange(!checked)}
    >
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
      <div className={`relative h-6 w-11 rounded-full transition-colors ${checked ? 'bg-emerald-500' : 'bg-muted-foreground/20'}`}>
        <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
      </div>
    </div>
  );
}

function CodeBlock({ code, filename, onCopy }: { code: string; filename: string; onCopy: () => void }) {
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="flex items-center justify-between bg-muted/50 border-b border-border px-4 py-2">
        <span className="text-xs font-mono text-muted-foreground">{filename}</span>
        <button
          onClick={onCopy}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <CopyIcon className="h-3.5 w-3.5" />
          Copy
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-xs font-mono leading-relaxed text-foreground/80 bg-card max-h-[400px]">
        <code>{code}</code>
      </pre>
    </div>
  );
}

// ─── Step Components ──────────────────────────────────────────────────

function StepDeploymentType({
  config,
  setConfig,
}: {
  config: DeploymentConfig;
  setConfig: (c: DeploymentConfig) => void;
}) {
  return (
    <div className="space-y-8">
      {/* Type Selection */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-1">Choose your deployment model</h3>
        <p className="text-sm text-muted-foreground mb-5">Select how you want to deploy Global Green Tax</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            {
              type: 'cloud' as const,
              icon: CloudIcon,
              title: 'Cloud Deployment',
              desc: 'Deploy on managed cloud infrastructure with automatic scaling, SSL, and backups.',
              features: ['Auto-scaling', 'Managed SSL', 'CDN integration', '99.9% SLA'],
              color: 'emerald',
            },
            {
              type: 'on-premise' as const,
              icon: ServerIcon,
              title: 'On-Premise',
              desc: 'Full control on your own infrastructure. Ideal for data sovereignty requirements.',
              features: ['Full control', 'Data sovereignty', 'Custom networking', 'Air-gapped option'],
              color: 'blue',
            },
          ].map((opt) => {
            const selected = config.deploymentType === opt.type;
            return (
              <motion.button
                key={opt.type}
                onClick={() => setConfig({ ...config, deploymentType: opt.type })}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className={`group relative flex flex-col items-start rounded-xl border-2 p-6 text-left transition-all duration-200 ${
                  selected
                    ? `border-${opt.color}-500 bg-${opt.color}-500/5 shadow-lg shadow-${opt.color}-500/10`
                    : 'border-border hover:border-muted-foreground/30 bg-card'
                }`}
              >
                {selected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className={`absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-${opt.color}-500`}
                  >
                    <CheckIcon className="h-3.5 w-3.5 text-white" />
                  </motion.div>
                )}

                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${selected ? `bg-${opt.color}-500/10` : 'bg-muted'} transition-colors`}>
                  <opt.icon className={`h-6 w-6 ${selected ? `text-${opt.color}-500` : 'text-muted-foreground'}`} />
                </div>

                <h4 className="mt-4 text-base font-semibold text-foreground">{opt.title}</h4>
                <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{opt.desc}</p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {opt.features.map((f) => (
                    <span
                      key={f}
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        selected
                          ? `bg-${opt.color}-500/10 text-${opt.color}-600 dark:text-${opt.color}-400`
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Provider Selection (Cloud) */}
      {config.deploymentType === 'cloud' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          <h3 className="text-lg font-semibold text-foreground mb-1">Cloud Provider</h3>
          <p className="text-sm text-muted-foreground mb-5">Select your preferred cloud provider</p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {PROVIDERS.map((p) => {
              const selected = config.provider === p.id;
              return (
                <motion.button
                  key={p.id}
                  onClick={() => setConfig({ ...config, provider: p.id as DeploymentConfig['provider'] })}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`relative flex flex-col items-center rounded-xl border-2 p-4 transition-all ${
                    selected
                      ? 'border-primary bg-primary/5 shadow-md'
                      : 'border-border hover:border-muted-foreground/30 bg-card'
                  }`}
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${p.color}`}>
                    <span className="text-sm font-bold text-white">{p.name.slice(0, 2)}</span>
                  </div>
                  <span className="mt-2 text-sm font-semibold text-foreground">{p.name}</span>
                  <span className="text-xs text-muted-foreground">{p.desc}</span>
                  {selected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary"
                    >
                      <CheckIcon className="h-3 w-3 text-primary-foreground" />
                    </motion.div>
                  )}
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* On-Prem Requirements */}
      {config.deploymentType === 'on-premise' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
          <h4 className="text-sm font-semibold text-amber-600 dark:text-amber-400 mb-3">On-Premise Requirements</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { label: 'CPU', value: '4 vCPU minimum, 8 recommended' },
              { label: 'RAM', value: '8 GB minimum, 16 GB recommended' },
              { label: 'Storage', value: '50 GB SSD (PostgreSQL + Docker)' },
              { label: 'OS', value: 'Ubuntu 22.04+ / Debian 12+' },
              { label: 'Docker', value: 'Docker 24+ with Compose v2' },
              { label: 'Network', value: 'Ports 80, 443 open (inbound)' },
            ].map((req) => (
              <div key={req.label} className="flex gap-3 rounded-lg bg-card/50 p-3">
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase w-16 shrink-0">{req.label}</span>
                <span className="text-xs text-foreground">{req.value}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}

function StepInfrastructure({
  config,
  setConfig,
}: {
  config: DeploymentConfig;
  setConfig: (c: DeploymentConfig) => void;
}) {
  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-1">Domain & Network</h3>
        <p className="text-sm text-muted-foreground mb-5">Configure your domain and networking layer</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormInput
            label="Primary Domain"
            value={config.domain}
            onChange={(v) => setConfig({ ...config, domain: v })}
            placeholder="global-green-tax.com"
            required
            helper="Your main domain for the web application"
          />
          <FormInput
            label="API Subdomain"
            value={config.apiSubdomain}
            onChange={(v) => setConfig({ ...config, apiSubdomain: v })}
            placeholder="api"
            helper={`API will be at ${config.apiSubdomain}.${config.domain}`}
          />
        </div>

        {/* Domain Preview */}
        <div className="mt-4 rounded-lg bg-muted/30 border border-border p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">URL Preview</p>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-mono text-emerald-600 dark:text-emerald-400">WEB</span>
              <span className="text-sm font-mono text-foreground">https://{config.domain}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-xs font-mono text-blue-600 dark:text-blue-400">API</span>
              <span className="text-sm font-mono text-foreground">https://{config.apiSubdomain}.{config.domain}</span>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-foreground mb-1">Database & Cache</h3>
        <p className="text-sm text-muted-foreground mb-5">Configure PostgreSQL and Redis</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormSelect
            label="PostgreSQL Version"
            value={config.postgresVersion}
            onChange={(v) => setConfig({ ...config, postgresVersion: v as DeploymentConfig['postgresVersion'] })}
            options={[
              { value: '16', label: 'PostgreSQL 16 (Recommended)' },
              { value: '15', label: 'PostgreSQL 15' },
              { value: '14', label: 'PostgreSQL 14' },
            ]}
          />
          <FormSelect
            label="Redis Max Memory"
            value={config.redisMaxMemory}
            onChange={(v) => setConfig({ ...config, redisMaxMemory: v as DeploymentConfig['redisMaxMemory'] })}
            options={[
              { value: '256', label: '256 MB (Default)' },
              { value: '512', label: '512 MB (Medium)' },
              { value: '1024', label: '1 GB (High Volume)' },
            ]}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <FormInput
            label="DB Port"
            value={config.dbPort}
            onChange={(v) => setConfig({ ...config, dbPort: v })}
            placeholder="5432"
            mono
          />
          <FormInput
            label="Redis Port"
            value={config.redisPort}
            onChange={(v) => setConfig({ ...config, redisPort: v })}
            placeholder="6379"
            mono
          />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-foreground mb-1">Services & Options</h3>
        <p className="text-sm text-muted-foreground mb-5">Toggle optional services</p>

        <div className="space-y-3">
          <ToggleRow
            label="Traefik Reverse Proxy"
            desc="Automatic SSL via Let's Encrypt, HTTP→HTTPS redirect, load balancing"
            checked={config.enableTraefik}
            onChange={(v) => setConfig({ ...config, enableTraefik: v })}
          />
          <ToggleRow
            label="Automated Backups"
            desc="Daily PostgreSQL backups with 7-day/4-week/6-month retention"
            checked={config.enableBackups}
            onChange={(v) => setConfig({ ...config, enableBackups: v })}
          />
          <ToggleRow
            label="Monitoring Stack"
            desc="Prometheus + Grafana for metrics, alerts, and dashboards"
            checked={config.enableMonitoring}
            onChange={(v) => setConfig({ ...config, enableMonitoring: v })}
          />
        </div>
      </div>

      {config.replicaCount > 1 || config.deploymentType === 'cloud' ? (
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-1">Scaling</h3>
          <div className="flex items-center gap-4 rounded-lg border border-border p-4">
            <label className="text-sm font-medium text-foreground whitespace-nowrap">API Replicas</label>
            <input
              type="range"
              min={1}
              max={8}
              value={config.replicaCount}
              onChange={(e) => setConfig({ ...config, replicaCount: parseInt(e.target.value) })}
              className="flex-1 accent-emerald-500"
            />
            <span className="w-8 text-center text-sm font-bold text-primary">{config.replicaCount}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StepCredentials({
  config,
  setConfig,
}: {
  config: DeploymentConfig;
  setConfig: (c: DeploymentConfig) => void;
}) {
  const genPassword = useCallback((length = 32) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*';
    let result = '';
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    for (let i = 0; i < length; i++) {
      result += chars[array[i] % chars.length];
    }
    return result;
  }, []);

  return (
    <div className="space-y-8">
      {/* Security Notice */}
      <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
        <ShieldIcon className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
        <div>
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Secrets are never stored or transmitted</p>
          <p className="mt-0.5 text-xs text-emerald-600/80 dark:text-emerald-400/60">All credentials stay in your browser. Generated files are created client-side only.</p>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-foreground mb-1">Database Credentials</h3>
        <p className="text-sm text-muted-foreground mb-5">PostgreSQL authentication</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormInput
            label="Database Name"
            value={config.dbName}
            onChange={(v) => setConfig({ ...config, dbName: v })}
            placeholder="global_green_tax"
            mono
          />
          <FormInput
            label="Database User"
            value={config.dbUser}
            onChange={(v) => setConfig({ ...config, dbUser: v })}
            placeholder="ggt_user"
            mono
          />
        </div>

        <div className="mt-4">
          <SecretInput
            label="Database Password"
            value={config.dbPassword}
            onChange={(v) => setConfig({ ...config, dbPassword: v })}
            placeholder="Enter a secure password..."
            required
          />
          <button
            onClick={() => setConfig({ ...config, dbPassword: genPassword() })}
            className="mt-2 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            Generate Secure Password
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-foreground mb-1">Redis Credentials</h3>
        <p className="text-sm text-muted-foreground mb-5">Optional — leave empty for no auth</p>

        <SecretInput
          label="Redis Password"
          value={config.redisPassword}
          onChange={(v) => setConfig({ ...config, redisPassword: v })}
          placeholder="Optional redis password..."
          helper="Recommended for production. Leave empty for development."
        />
        <button
          onClick={() => setConfig({ ...config, redisPassword: genPassword(24) })}
          className="mt-2 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          Generate Password
        </button>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-foreground mb-1">Clerk Authentication</h3>
        <p className="text-sm text-muted-foreground mb-5">Get these from your <a href="https://dashboard.clerk.com" target="_blank" rel="noopener" className="text-primary underline underline-offset-2 hover:text-primary/80">Clerk Dashboard</a></p>

        <div className="space-y-4">
          <SecretInput
            label="Clerk Publishable Key"
            value={config.clerkPublishableKey}
            onChange={(v) => setConfig({ ...config, clerkPublishableKey: v })}
            placeholder="pk_test_..."
            required
            helper="Found in Clerk Dashboard → API Keys"
          />
          <SecretInput
            label="Clerk Secret Key"
            value={config.clerkSecretKey}
            onChange={(v) => setConfig({ ...config, clerkSecretKey: v })}
            placeholder="sk_test_..."
            required
            helper="Found in Clerk Dashboard → API Keys"
          />
        </div>
      </div>
    </div>
  );
}

function StepApplication({
  config,
  setConfig,
}: {
  config: DeploymentConfig;
  setConfig: (c: DeploymentConfig) => void;
}) {
  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-1">Application Settings</h3>
        <p className="text-sm text-muted-foreground mb-5">Ports, environment, and admin configuration</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormInput
            label="API Port"
            value={config.apiPort}
            onChange={(v) => setConfig({ ...config, apiPort: v })}
            placeholder="4000"
            mono
          />
          <FormInput
            label="Web Port"
            value={config.webPort}
            onChange={(v) => setConfig({ ...config, webPort: v })}
            placeholder="3000"
            mono
          />
          <FormSelect
            label="Environment"
            value={config.nodeEnv}
            onChange={(v) => setConfig({ ...config, nodeEnv: v as 'production' | 'staging' })}
            options={[
              { value: 'production', label: 'Production' },
              { value: 'staging', label: 'Staging' },
            ]}
          />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-foreground mb-1">Administration</h3>
        <p className="text-sm text-muted-foreground mb-5">Admin and SSL contact emails</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormInput
            label="Admin Email"
            value={config.adminEmail}
            onChange={(v) => setConfig({ ...config, adminEmail: v })}
            placeholder="admin@your-domain.com"
            required
          />
          <FormInput
            label="SSL Certificate Email"
            value={config.sslEmail}
            onChange={(v) => setConfig({ ...config, sslEmail: v })}
            placeholder="admin@your-domain.com"
            helper="Let's Encrypt will email you about cert expiry"
          />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-foreground mb-1">Observability</h3>
        <p className="text-sm text-muted-foreground mb-5">Logging and error tracking</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormSelect
            label="Log Level"
            value={config.logLevel}
            onChange={(v) => setConfig({ ...config, logLevel: v as DeploymentConfig['logLevel'] })}
            options={[
              { value: 'debug', label: 'Debug (Verbose)' },
              { value: 'info', label: 'Info (Default)' },
              { value: 'warn', label: 'Warning' },
              { value: 'error', label: 'Error Only' },
            ]}
          />
          <SecretInput
            label="Sentry DSN"
            value={config.sentryDsn}
            onChange={(v) => setConfig({ ...config, sentryDsn: v })}
            placeholder="https://xxxxx@sentry.io/xxxxx"
            helper="Optional — for error tracking"
          />
        </div>
      </div>

      {/* Config Summary Card */}
      <div className="rounded-xl border border-border bg-muted/20 p-5">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">Configuration Summary</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Type', value: config.deploymentType === 'cloud' ? 'Cloud' : 'On-Prem' },
            { label: 'Provider', value: config.provider?.toUpperCase() || 'N/A' },
            { label: 'PostgreSQL', value: `v${config.postgresVersion}` },
            { label: 'Redis', value: `${config.redisMaxMemory} MB` },
            { label: 'Traefik', value: config.enableTraefik ? 'Yes' : 'No' },
            { label: 'Backups', value: config.enableBackups ? 'Daily' : 'Off' },
            { label: 'Monitoring', value: config.enableMonitoring ? 'Yes' : 'No' },
            { label: 'Replicas', value: config.replicaCount.toString() },
          ].map((item) => (
            <div key={item.label}>
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="text-sm font-semibold text-foreground">{item.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StepReview({ config }: { config: DeploymentConfig }) {
  const [activeTab, setActiveTab] = useState<'compose' | 'env' | 'script' | 'nginx'>('compose');
  const [copied, setCopied] = useState<string | null>(null);

  const files = useMemo(
    () => ({
      compose: generateDockerCompose(config),
      env: generateEnvFile(config),
      script: generateDeployScript(config),
      nginx: generateNginxConfig(config),
    }),
    [config],
  );

  const copyToClipboard = useCallback((content: string, label: string) => {
    navigator.clipboard.writeText(content);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  const downloadFile = useCallback((content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const downloadAll = useCallback(() => {
    downloadFile(files.compose, 'docker-compose.yml');
    setTimeout(() => downloadFile(files.env, '.env'), 100);
    setTimeout(() => downloadFile(files.script, 'deploy.sh'), 200);
    if (config.deploymentType === 'on-premise' && !config.enableTraefik) {
      setTimeout(() => downloadFile(files.nginx, 'nginx.conf'), 300);
    }
  }, [files, config, downloadFile]);

  const tabs = [
    { id: 'compose' as const, label: 'docker-compose.yml', icon: DatabaseIcon },
    { id: 'env' as const, label: '.env', icon: KeyIcon },
    { id: 'script' as const, label: 'deploy.sh', icon: RocketIcon },
    ...(config.deploymentType === 'on-premise' && !config.enableTraefik
      ? [{ id: 'nginx' as const, label: 'nginx.conf', icon: ServerIcon }]
      : []),
  ];

  return (
    <div className="space-y-6">
      {/* Success Banner */}
      <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
          <CheckIcon className="h-4 w-4 text-emerald-500" />
        </div>
        <div>
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Configuration complete</p>
          <p className="mt-0.5 text-xs text-emerald-600/80 dark:text-emerald-400/60">
            Your deployment files are ready. Download them and follow the deploy script to get started.
          </p>
        </div>
      </div>

      {/* Download All */}
      <button
        onClick={downloadAll}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
      >
        <DownloadIcon className="h-4 w-4" />
        Download All Files
      </button>

      {/* File Tabs */}
      <div className="flex gap-1 rounded-lg bg-muted/50 p-1 border border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <tab.icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* File Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
        >
          <CodeBlock
            code={files[activeTab]}
            filename={tabs.find((t) => t.id === activeTab)?.label || ''}
            onCopy={() =>
              copyToClipboard(files[activeTab], tabs.find((t) => t.id === activeTab)?.label || '')
            }
          />
        </motion.div>
      </AnimatePresence>

      {copied && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background shadow-xl"
        >
          <CheckIcon className="h-4 w-4 text-emerald-400" />
          Copied {copied}
        </motion.div>
      )}

      {/* Quick Start */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h4 className="text-sm font-semibold text-foreground mb-3">Quick Start Commands</h4>
        <div className="space-y-2 font-mono text-xs">
          {[
            '# 1. Place files in your project root',
            `cp docker-compose.yml .env deploy.sh /path/to/${config.domain}/`,
            '',
            '# 2. Make deploy script executable',
            'chmod +x deploy.sh',
            '',
            '# 3. Run deployment',
            './deploy.sh',
          ].map((line, i) => (
            <div key={i} className={line.startsWith('#') ? 'text-muted-foreground' : 'text-foreground'}>
              {line || '\u00A0'}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Wizard ──────────────────────────────────────────────────────

export default function DeployWizardPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [config, setConfig] = useState<DeploymentConfig>({ ...DEFAULT_CONFIG });

  const step = STEPS[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === STEPS.length - 1;

  const canProceed = useMemo(() => {
    switch (currentStep) {
      case 0:
        return true; // type always selected
      case 1:
        return config.domain.length > 0;
      case 2:
        return config.dbPassword.length >= 8 && config.clerkPublishableKey.length > 0 && config.clerkSecretKey.length > 0;
      case 3:
        return config.adminEmail.includes('@');
      case 4:
        return true;
      default:
        return true;
    }
  }, [currentStep, config]);

  return (
    <div className="mx-auto max-w-4xl pb-12">
      {/* Header */}
      <div className="mb-8">
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl font-bold text-foreground"
        >
          Deployment Wizard
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mt-1 text-sm text-muted-foreground"
        >
          Configure and generate your full deployment stack in minutes
        </motion.p>
      </div>

      {/* Step Progress */}
      <div className="mb-8">
        <div className="flex items-center gap-0">
          {STEPS.map((s, i) => {
            const isActive = i === currentStep;
            const isComplete = i < currentStep;
            return (
              <div key={s.id} className="flex flex-1 items-center">
                <button
                  onClick={() => i <= currentStep && setCurrentStep(i)}
                  className={`group flex flex-1 flex-col items-center gap-1.5 ${
                    i <= currentStep ? 'cursor-pointer' : 'cursor-default'
                  }`}
                >
                  {/* Step Circle */}
                  <div className="relative flex items-center w-full">
                    {i > 0 && (
                      <div
                        className={`h-[2px] flex-1 transition-colors duration-300 ${
                          isComplete || isActive ? 'bg-primary' : 'bg-border'
                        }`}
                      />
                    )}
                    <motion.div
                      animate={{
                        scale: isActive ? 1 : 0.85,
                        backgroundColor: isComplete
                          ? 'hsl(160, 84%, 39%)'
                          : isActive
                            ? 'hsl(160, 84%, 39%)'
                            : 'transparent',
                      }}
                      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                      className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                        isComplete || isActive
                          ? 'border-primary'
                          : 'border-border'
                      }`}
                    >
                      {isComplete ? (
                        <CheckIcon className="h-4 w-4 text-primary-foreground" />
                      ) : (
                        <s.icon
                          className={`h-4 w-4 ${
                            isActive ? 'text-primary-foreground' : 'text-muted-foreground'
                          }`}
                        />
                      )}
                    </motion.div>
                    {i < STEPS.length - 1 && (
                      <div
                        className={`h-[2px] flex-1 transition-colors duration-300 ${
                          isComplete ? 'bg-primary' : 'bg-border'
                        }`}
                      />
                    )}
                  </div>

                  {/* Label */}
                  <div className="text-center">
                    <p
                      className={`text-xs font-medium transition-colors ${
                        isActive ? 'text-primary' : isComplete ? 'text-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      {s.label}
                    </p>
                    <p className="text-[10px] text-muted-foreground hidden sm:block">{s.desc}</p>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {currentStep === 0 && <StepDeploymentType config={config} setConfig={setConfig} />}
            {currentStep === 1 && <StepInfrastructure config={config} setConfig={setConfig} />}
            {currentStep === 2 && <StepCredentials config={config} setConfig={setConfig} />}
            {currentStep === 3 && <StepApplication config={config} setConfig={setConfig} />}
            {currentStep === 4 && <StepReview config={config} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="mt-6 flex items-center justify-between">
        <button
          onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
          disabled={isFirst}
          className={`flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
            isFirst
              ? 'text-muted-foreground/40 cursor-not-allowed'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <ChevronLeftIcon className="h-4 w-4" />
          Back
        </button>

        <div className="flex items-center gap-2">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === currentStep ? 'w-6 bg-primary' : i < currentStep ? 'w-1.5 bg-primary/50' : 'w-1.5 bg-border'
              }`}
            />
          ))}
        </div>

        {!isLast && (
          <button
            onClick={() => canProceed && setCurrentStep(Math.min(STEPS.length - 1, currentStep + 1))}
            disabled={!canProceed}
            className={`flex items-center gap-1.5 rounded-lg px-5 py-2.5 text-sm font-semibold transition-all ${
              canProceed
                ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            }`}
          >
            Next
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        )}

        {isLast && (
          <div className="w-[72px]" /> /* spacer */
        )}
      </div>
    </div>
  );
}
