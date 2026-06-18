'use client';

import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Dialog from '@/components/ui/Dialog';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { 
  DownloadCloud, 
  RefreshCw, 
  User, 
  KeyRound, 
  Calendar, 
  Eye, 
  EyeOff,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Inbox,
  Ban,
  ArrowRight,
  History,
  Settings,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface MassDownloadModalProps {
  open: boolean;
  onClose: () => void;
}

type JobStatus = 'COMPLETED' | 'ERROR' | 'PROCESSING' | 'CANCELLED' | 'PENDING';

const statusConfig: Record<JobStatus, { label: string; icon: typeof Loader2; className: string }> = {
  COMPLETED: { label: 'Completado', icon: CheckCircle2, className: 'bg-success-pale text-success border-success/30' },
  ERROR: { label: 'Error', icon: XCircle, className: 'bg-destructive/15 text-destructive border-destructive/30' },
  PROCESSING: { label: 'Procesando', icon: Loader2, className: 'bg-amber-50 text-amber-700 border-amber-300' },
  CANCELLED: { label: 'Cancelado', icon: Ban, className: 'bg-brand-gray-100 text-brand-gray-600 border-brand-gray-300' },
  PENDING: { label: 'Pendiente', icon: Clock, className: 'bg-brand-gray-100 text-brand-gray-700 border-brand-gray-300' },
};

export default function MassDownloadModal({ open, onClose }: MassDownloadModalProps) {
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showDevOptions, setShowDevOptions] = useState(false);
  const [isDevMode, setIsDevMode] = useState(false);

  const [devOptions, setDevOptions] = useState({
    connection_mode: 'http' as 'cdp' | 'new_browser' | 'headless_separate' | 'http',
    captcha_strategy: 'auto' as 'auto' | 'anticaptcha' | 'buster' | 'manual',
    debug_screenshots: false,
    verbose_logging: false,
    dom_dump_on_error: true,
    use_listado_txt: true,
    parallel_days: 1,
    soap_sync_limit: 30,
    http_retry_count: 3,
  });

  useEffect(() => {
    setIsDevMode(
      process.env.NODE_ENV === 'development' ||
      (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('dev') === 'true')
    );
  }, []);

  const isHttpMode = devOptions.connection_mode === 'http';
  
  const [formData, setFormData] = useState({
    ruc: '',
    clave_sri: '',
    fecha_desde: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    fecha_hasta: new Date().toISOString().split('T')[0],
    tipo_comprobante: '1',
  });

  const [jobs, setJobs] = useState<any[]>([]);
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [logs, setLogs] = useState<{ id: number; level: string; message: string; created_at: string }[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);
  const { hasSriLinked } = useAuth();

  useEffect(() => {
    if (open && hasSriLinked) {
      import('@/lib/sriClient').then(({ sriClient }) => {
        sriClient.getEmisor().then((res) => {
          if (res.success && res.emisor?.ruc) {
            setFormData(prev => ({ ...prev, ruc: res.emisor.ruc }));
          }
        }).catch(() => {});
      });
    }
  }, [hasSriLinked, open]);

  const fetchJobs = useCallback(async (manual = false) => {
    if (!open) return;
    if (manual) setIsRefreshing(true);
    try {
      const token = localStorage.getItem('sri_access_token');
      const res = await fetch('/api/sri/scraping', {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      });
      const data = await res.json();
      if (data.success && data.jobs) setJobs(data.jobs);
    } catch (e) {
      console.error(e);
      if (manual) toast.error('Error al actualizar los trabajos');
    } finally {
      if (manual) setTimeout(() => setIsRefreshing(false), 500);
    }
  }, [open]);

  const fetchLogs = useCallback(async (job: any) => {
    if (!job?.id) return;
    setLogsLoading(true);
    setLogsError(null);
    try {
      const token = localStorage.getItem('sri_access_token');
      const res = await fetch(`/api/sri/scraping/${job.id}/logs`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      });
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs);
      } else {
        setLogsError(data.error || 'Error al cargar logs');
      }
    } catch (e) {
      setLogsError('Error de red al cargar logs');
    }
    finally { setLogsLoading(false); }
  }, []);

  useEffect(() => {
    if (selectedJob && selectedJob.status === 'PROCESSING') {
      const interval = setInterval(() => fetchLogs(selectedJob), 3000);
      return () => clearInterval(interval);
    }
  }, [selectedJob, fetchLogs]);

  useEffect(() => {
    if (open) {
      fetchJobs();
      const interval = setInterval(() => fetchJobs(), 10000);
      return () => clearInterval(interval);
    }
  }, [fetchJobs, open]);

  const cancelJob = async (jobId: string) => {
    try {
      const token = localStorage.getItem('sri_access_token');
      const res = await fetch('/api/sri/scraping', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ jobId }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'Trabajo cancelado');
        fetchJobs(true);
      } else {
        toast.error(data.error || 'Error al cancelar');
      }
    } catch {
      toast.error('Error de red al cancelar el trabajo');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.fecha_desde > formData.fecha_hasta) {
      toast.error('La fecha "Desde" no puede ser mayor que la fecha "Hasta".');
      return;
    }
    
    setLoading(true);
    try {
      const token = localStorage.getItem('sri_access_token');
      const payload = isDevMode ? { ...formData, options: devOptions } : formData;
      const response = await fetch('/api/sri/scraping', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok && data.jobId) {
        toast.success(data.message || 'Trabajo de descarga iniciado');
        fetch('/api/sri/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId: data.jobId }),
        }).catch(err => console.error('[Sync] Error:', err));
      } else {
        toast.error(data.error || 'Error al iniciar la descarga');
      }
    } catch {
      toast.error('Error de red al intentar comunicarse con el servidor');
    } finally {
      setLoading(false);
      fetchJobs(true);
    }
  };

  const getTipoLabel = (tipo: string) => {
    switch (tipo) {
      case '1': return 'Factura';
      case '2': return 'Liquidación de compra';
      case '3': return 'Nota de Crédito';
      case '4': return 'Nota de Débito';
      case '6': return 'Retención';
      default: return tipo;
    }
  };

  return (
    <Dialog open={open} onClose={onClose} size="2xl" showClose>
      <div className="flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center gap-3 pb-2 border-b border-border">
          <div className="p-2 rounded-lg bg-brand-navy text-white shadow-sm">
            <DownloadCloud className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Descarga Masiva SRI</h2>
            <p className="text-xs text-muted-foreground">Sincroniza comprobantes desde el portal SRI</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Form */}
          <div className="lg:col-span-5 space-y-4 order-2 lg:order-1">
            <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
              <div className="px-4 py-3 bg-muted/50 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-brand-navy" />
                  Credenciales SRI
                </h3>
              </div>
              
              <form onSubmit={handleSubmit} className="p-4 space-y-3.5">
                <div className="space-y-1">
                  <Label htmlFor="ruc_modal" className="text-xs font-medium text-muted-foreground">RUC</Label>
                  <div className="relative">
                    <User className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input id="ruc_modal" name="ruc" placeholder="1790000000001" value={formData.ruc} onChange={handleChange} autoComplete="off" className="pl-8 h-9 text-sm" required />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="clave_sri_modal" className="text-xs font-medium text-muted-foreground">Clave de acceso</Label>
                  <div className="relative">
                    <KeyRound className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input id="clave_sri_modal" name="clave_sri" type={showPassword ? "text" : "password"} placeholder="••••••••" value={formData.clave_sri} onChange={handleChange} autoComplete="off" className="pl-8 pr-9 h-9 text-sm" required />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer" tabIndex={-1}>
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="tipo_comprobante_modal" className="text-xs font-medium text-muted-foreground">Tipo de comprobante</Label>
                  <select id="tipo_comprobante_modal" name="tipo_comprobante" value={formData.tipo_comprobante} onChange={handleChange} className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" required>
                    <option value="1">Factura</option>
                    <option value="2">Liquidación de compra</option>
                    <option value="3">Nota de Crédito</option>
                    <option value="4">Nota de Débito</option>
                    <option value="6">Comprobante de Retención</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="fecha_desde_modal" className="text-xs font-medium text-muted-foreground">Desde</Label>
                    <div className="relative">
                      <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input id="fecha_desde_modal" name="fecha_desde" type="date" value={formData.fecha_desde} onChange={handleChange} className="pl-8 h-9 text-xs" required />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="fecha_hasta_modal" className="text-xs font-medium text-muted-foreground">Hasta</Label>
                    <div className="relative">
                      <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input id="fecha_hasta_modal" name="fecha_hasta" type="date" value={formData.fecha_hasta} onChange={handleChange} min={formData.fecha_desde} className="pl-8 h-9 text-xs" required />
                    </div>
                  </div>
                </div>

                {/* ─── Selector rápido de scraper ─── */}
                <div className="grid grid-cols-2 gap-2">
                  {(['http', 'cdp'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => isDevMode && setDevOptions(prev => ({ ...prev, connection_mode: mode }))}
                      className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all cursor-pointer ${
                        devOptions.connection_mode === mode
                          ? 'border-brand-navy bg-brand-navy/5 shadow-xs'
                          : 'border-border bg-card hover:border-muted-foreground/30'
                      } ${!isDevMode && devOptions.connection_mode !== mode ? 'opacity-60' : ''}`}
                      title={!isDevMode && mode === 'http' ? 'HTTP es el único modo disponible en producción' : undefined}
                    >
                      <div className={`p-1.5 rounded-lg ${devOptions.connection_mode === mode ? 'bg-brand-navy text-white' : 'bg-muted text-muted-foreground'}`}>
                        {mode === 'http' ? (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        )}
                      </div>
                      <span className={`text-[11px] font-semibold leading-tight text-center ${devOptions.connection_mode === mode ? 'text-brand-navy' : 'text-muted-foreground'}`}>
                        {mode === 'http' ? 'HTTP directo' : 'Puppeteer + Chrome'}
                      </span>
                      <span className={`text-[9px] leading-tight text-center ${devOptions.connection_mode === mode ? 'text-brand-navy/70' : 'text-muted-foreground/60'}`}>
                        {mode === 'http' ? 'Sin navegador' : 'Con navegador real'}
                      </span>
                      {devOptions.connection_mode === mode && (
                        <div className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-brand-navy rounded-full" />
                      )}
                      {!isDevMode && mode === 'http' && (
                        <span className="text-[8px] font-medium text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full mt-0.5">recomendado</span>
                      )}
                    </button>
                  ))}
                </div>

                {/* ─── Opciones específicas por scraper ─── */}
                <div className="border border-dashed border-amber-300 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowDevOptions(!showDevOptions)}
                    className="w-full flex items-center justify-between px-3 py-2 bg-amber-50 hover:bg-amber-100 transition-colors cursor-pointer"
                  >
                    <span className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
                      <Settings className="w-3.5 h-3.5" />
                      Configuración avanzada
                    </span>
                    {showDevOptions ? <ChevronUp className="w-3.5 h-3.5 text-amber-700" /> : <ChevronDown className="w-3.5 h-3.5 text-amber-700" />}
                  </button>

                  {showDevOptions && (
                    <div className="p-3 space-y-3 bg-amber-50/50">

                      {/* HTTP-specific options */}
                      {isHttpMode && (
                        <>
                          <div className="space-y-1">
                            <Label className="text-[10px] font-semibold text-amber-800 uppercase tracking-wider">Optimización HTTP</Label>

                            <label className="flex items-center gap-2 py-0.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={devOptions.use_listado_txt}
                                onChange={() => setDevOptions(prev => ({ ...prev, use_listado_txt: !prev.use_listado_txt }))}
                                className="accent-amber-600"
                              />
                              <span className="text-[11px] text-amber-900">
                                Usar listado TXT (más rápido){' '}
                                <span className="text-amber-600/70">— descarga lista de claves en vez de página HTML</span>
                              </span>
                            </label>

                            <div className="flex items-center gap-2 py-0.5">
                              <span className="text-[11px] text-amber-900 min-w-[90px]">Días en paralelo:</span>
                              <div className="flex items-center gap-1">
                                {[1, 2, 3, 5].map(n => (
                                  <button
                                    key={n}
                                    type="button"
                                    onClick={() => setDevOptions(prev => ({ ...prev, parallel_days: n }))}
                                    className={`px-2 py-0.5 text-[10px] font-medium rounded border cursor-pointer transition-colors ${
                                      devOptions.parallel_days === n
                                        ? 'bg-amber-200 text-amber-900 border-amber-400'
                                        : 'bg-white text-amber-800 border-amber-200 hover:bg-amber-100'
                                    }`}
                                  >
                                    {n}
                                  </button>
                                ))}
                                <span className="text-[9px] text-amber-600/70 ml-1">(max días simultáneos)</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 py-0.5">
                              <span className="text-[11px] text-amber-900 min-w-[90px]">Reintentos HTTP:</span>
                              <div className="flex items-center gap-1">
                                {[1, 2, 3, 5].map(n => (
                                  <button
                                    key={n}
                                    type="button"
                                    onClick={() => setDevOptions(prev => ({ ...prev, http_retry_count: n }))}
                                    className={`px-2 py-0.5 text-[10px] font-medium rounded border cursor-pointer transition-colors ${
                                      devOptions.http_retry_count === n
                                        ? 'bg-amber-200 text-amber-900 border-amber-400'
                                        : 'bg-white text-amber-800 border-amber-200 hover:bg-amber-100'
                                    }`}
                                  >
                                    {n}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          <span className="block border-t border-amber-200" />
                        </>
                      )}

                      {/* Browser-specific options */}
                      {!isHttpMode && (
                        <>
                          <div className="space-y-1">
                            <Label className="text-[10px] font-semibold text-amber-800 uppercase tracking-wider">Modo de conexión</Label>
                            {(['cdp', 'new_browser', 'headless_separate'] as const).map((mode) => (
                              <label key={mode} className="flex items-center gap-2 py-0.5 cursor-pointer">
                                <input
                                  type="radio"
                                  name="connection_mode_browser"
                                  checked={devOptions.connection_mode === mode}
                                  onChange={() => setDevOptions(prev => ({ ...prev, connection_mode: mode }))}
                                  className="accent-amber-600"
                                />
                                <span className="text-[11px] text-amber-900">
                                  {mode === 'cdp' && 'CDP (misma ventana Chrome, prof. ./browser_session/)'}
                                  {mode === 'new_browser' && 'Ventana separada (perfil nuevo)'}
                                  {mode === 'headless_separate' && 'Headless aislado (./browser_session/)'}
                                </span>
                              </label>
                            ))}
                          </div>

                          <span className="block border-t border-amber-200" />
                        </>
                      )}

                      {/* CAPTCHA (common to both) */}
                      <div className="space-y-1">
                        <Label className="text-[10px] font-semibold text-amber-800 uppercase tracking-wider">Estrategia CAPTCHA</Label>
                        {(['auto', 'anticaptcha', 'buster', 'manual'] as const).map((strategy) => (
                          <label key={strategy} className="flex items-center gap-2 py-0.5 cursor-pointer">
                            <input
                              type="radio"
                              name="captcha_strategy"
                              checked={devOptions.captcha_strategy === strategy}
                              onChange={() => setDevOptions(prev => ({ ...prev, captcha_strategy: strategy }))}
                              className="accent-amber-600"
                            />
                            <span className="text-[11px] text-amber-900">
                              {strategy === 'auto' && `Auto ${isHttpMode ? '(Anti-Captcha → 2captcha)' : '(Anti-Captcha → Buster)'}`}
                              {strategy === 'anticaptcha' && 'Solo Anti-Captcha'}
                              {strategy === 'buster' && `Solo Buster ${isHttpMode ? '(no disponible en HTTP)' : ''}`}
                              {strategy === 'manual' && `Manual ${isHttpMode ? '(no aplica en HTTP)' : '(modo visible)'}`}
                            </span>
                          </label>
                        ))}
                      </div>

                      <span className="block border-t border-amber-200" />

                      {/* Post-scrape SOAP sync */}
                      <div className="space-y-1">
                        <Label className="text-[10px] font-semibold text-amber-800 uppercase tracking-wider">Post-procesamiento SOAP</Label>
                        <div className="flex items-center gap-2 py-0.5">
                          <span className="text-[11px] text-amber-900 min-w-[70px]">Sync límite:</span>
                          <div className="flex items-center gap-1">
                            {[0, 10, 30, 50, 100].map(n => (
                              <button
                                key={n}
                                type="button"
                                onClick={() => setDevOptions(prev => ({ ...prev, soap_sync_limit: n }))}
                                className={`px-2 py-0.5 text-[10px] font-medium rounded border cursor-pointer transition-colors ${
                                  devOptions.soap_sync_limit === n
                                    ? 'bg-amber-200 text-amber-900 border-amber-400'
                                    : 'bg-white text-amber-800 border-amber-200 hover:bg-amber-100'
                                }`}
                              >
                                {n === 0 ? 'Off' : n}
                              </button>
                            ))}
                            <span className="text-[9px] text-amber-600/70 ml-1">(comprobantes vía SOAP después del scrape)</span>
                          </div>
                        </div>
                      </div>

                      <span className="block border-t border-amber-200" />

                      {/* Debug toggles */}
                      <div className="flex flex-wrap gap-3 pt-1">
                        {([
                          { key: 'debug_screenshots' as const, label: 'Debug screenshots' },
                          { key: 'verbose_logging' as const, label: 'Verbose logging' },
                          { key: 'dom_dump_on_error' as const, label: 'DOM dump on error' },
                        ]).map(opt => (
                          <label key={opt.key} className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={devOptions[opt.key]}
                              onChange={() => setDevOptions(prev => ({ ...prev, [opt.key]: !prev[opt.key] }))}
                              className="accent-amber-600"
                            />
                            <span className="text-[10px] text-amber-800">{opt.label}</span>
                          </label>
                        ))}
                      </div>

                      <span className="block border-t border-amber-200 my-1" />

                      {/* Restart Chrome */}
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const res = await fetch('/api/system/restart-chrome', { method: 'POST' });
                            const data = await res.json();
                            if (data.success) {
                              toast.success(data.message);
                            } else {
                              toast.error(data.error || 'Error al reiniciar Chrome');
                            }
                          } catch {
                            toast.error('Error de red al intentar reiniciar Chrome');
                          }
                        }}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-emerald-800 bg-emerald-100 hover:bg-emerald-200 rounded-md transition-colors cursor-pointer"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Reiniciar Chrome con debug port (usa tu sesión SRI activa)
                      </button>
                    </div>
                  )}
                </div>

                <Button type="submit" disabled={loading} className="w-full mt-2 cursor-pointer">
                  {loading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Iniciando...</>
                  ) : (
                    <><DownloadCloud className="mr-2 h-4 w-4" /> Iniciar Descarga</>
                  )}
                </Button>
              </form>
            </div>
          </div>

          {/* Jobs */}
          <div className="lg:col-span-7 order-1 lg:order-2">
            <div className="rounded-xl border border-border bg-card shadow-xs flex flex-col min-h-[400px] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <History className="w-4 h-4 text-brand-navy" />
                  Historial de Tareas
                </h3>
                <Button variant="outline" size="sm" onClick={() => fetchJobs(true)} disabled={isRefreshing} className="gap-1.5 h-8 text-xs cursor-pointer">
                  <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-brand-navy' : ''}`} />
                  <span className="hidden sm:inline">Actualizar</span>
                </Button>
              </div>

              <div className="flex-1 relative">
                {jobs.length === 0 ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                    <div className="p-3 rounded-full bg-muted mb-3">
                      <Inbox className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h4 className="text-sm font-semibold text-foreground mb-1">Sin descargas aún</h4>
                    <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                      Completa el formulario de la izquierda para iniciar tu primera sincronización.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-[40vh] md:max-h-[400px] overflow-y-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-muted/50 text-muted-foreground font-semibold uppercase tracking-wider sticky top-0 z-10">
                        <tr>
                          <th className="px-3 py-2.5">Estado</th>
                          <th className="px-3 py-2.5">RUC</th>
                          <th className="px-3 py-2.5">Período</th>
                          <th className="px-3 py-2.5 hidden sm:table-cell">Tipo</th>
                          <th className="px-3 py-2.5">Detalle</th>
                          <th className="px-3 py-2.5 text-right hidden sm:table-cell">Fecha</th>
                          <th className="px-3 py-2.5 text-center w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {jobs.map((job, i) => {
                          const status = job.status as JobStatus;
                          const cfg = statusConfig[status] || statusConfig.PENDING;
                          const Icon = cfg.icon;
                          return (
                            <tr key={job.id} onClick={() => { setSelectedJob(selectedJob?.id === job.id ? null : job); fetchLogs(job); }} className={`hover:bg-accent/50 transition-colors cursor-pointer ${selectedJob?.id === job.id ? 'bg-accent/70 ring-1 ring-inset ring-brand-navy/20' : ''}`} style={{ animationDelay: `${i * 30}ms`, animationFillMode: 'both' }}>
                              <td className="px-3 py-2.5 whitespace-nowrap">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${cfg.className} ${status === 'PROCESSING' ? 'animate-pulse' : ''}`}>
                                  <Icon className={`w-3 h-3 ${status === 'PROCESSING' ? 'animate-spin' : ''}`} />
                                  {cfg.label}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 font-mono text-muted-foreground text-[10px]">{job.ruc}</td>
                              <td className="px-3 py-2.5 font-medium text-foreground whitespace-nowrap text-[11px]">
                                {job.fecha_desde
                                  ? `${new Date(job.fecha_desde).toLocaleDateString()} - ${new Date(job.fecha_hasta).toLocaleDateString()}`
                                  : `${job.mes?.toString().padStart(2, '0')}/${job.anio}`}
                              </td>
                              <td className="px-3 py-2.5 text-muted-foreground hidden sm:table-cell text-[11px]">{getTipoLabel(job.tipo_comprobante)}</td>
                              <td className="px-3 py-2.5 min-w-[140px]">
                                <div className="flex flex-col gap-1">
                                  {status === 'PROCESSING' && (
                                    <div className="w-20 h-1 bg-border rounded-full overflow-hidden">
                                      <div className="h-full bg-brand-navy-light rounded-full w-2/3 animate-pulse" />
                                    </div>
                                  )}
                                  <span className="text-muted-foreground truncate max-w-[160px] text-[10px] leading-tight" title={job.progress_message || ''}>
                                    {job.progress_message || (status === 'PENDING' ? 'Esperando inicio...' : '')}
                                  </span>
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-muted-foreground text-right whitespace-nowrap text-[10px] hidden sm:table-cell">
                                {new Date(job.created_at).toLocaleDateString()}
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                {(status === 'PENDING' || status === 'PROCESSING') && (
                                  <Button variant="ghost" size="sm" onClick={() => cancelJob(job.id)} className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer" title="Cancelar">
                                    <Ban className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* ─── Log Viewer ─── */}
                {selectedJob && (
                  <div className="border-t border-border mt-0">
                    <div className="flex items-center justify-between px-4 py-2 bg-muted/30">
                      <h4 className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h12" />
                        </svg>
                        Logs — {selectedJob.ruc}
                        {selectedJob.status === 'PROCESSING' && (
                          <span className="inline-flex items-center gap-1 ml-1 text-[9px] font-medium text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                            en vivo
                          </span>
                        )}
                      </h4>
                      <button
                        type="button"
                        onClick={() => { setSelectedJob(null); setLogs([]); setLogsError(null); }}
                        className="text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      >
                        cerrar
                      </button>
                    </div>
                    <div className="max-h-[180px] overflow-y-auto bg-[#0d1117] font-mono text-[10px] leading-relaxed">
                      {logsLoading && logs.length === 0 ? (
                        <div className="flex items-center gap-2 p-3 text-[#8b949e]">
                          <span className="w-2 h-2 bg-[#8b949e] rounded-full animate-pulse" />
                          Cargando logs...
                        </div>
                      ) : logsError ? (
                        <div className="p-3 text-[#f85149] text-[10px]">
                          {logsError}
                        </div>
                      ) : logs.length === 0 ? (
                        <div className="p-3 text-[#8b949e] italic">
                          Sin registros de log disponibles.
                        </div>
                      ) : (
                        <div className="divide-y divide-[#21262d]">
                          {logs.map((log) => (
                            <div key={log.id} className="flex gap-2 px-3 py-1 hover:bg-[#161b22]">
                              <span className="text-[#484f58] whitespace-nowrap shrink-0 w-[68px]">
                                {new Date(log.created_at).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </span>
                              <span className={`shrink-0 w-[52px] text-[9px] font-semibold uppercase tracking-wider ${
                                log.level === 'error' ? 'text-[#f85149]' :
                                log.level === 'success' ? 'text-[#3fb950]' :
                                log.level === 'warn' ? 'text-[#d29922]' :
                                'text-[#58a6ff]'
                              }`}>
                                {log.level}
                              </span>
                              <span className="text-[#e6edf3] break-words">{log.message}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
