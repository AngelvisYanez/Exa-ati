'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import Dialog from '@/components/ui/Dialog';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { 
  DownloadCloud, 
  RefreshCw, 
  User, 
  KeyRound, 
  Calendar, 

  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Inbox,
  Ban,
  History,
  Trash2,
  ArrowUpDown,
  FileText,
  Send,
  CornerDownRight,

  Terminal,
  X,
} from 'lucide-react';

interface MassDownloadModalProps {
  open: boolean;
  onClose: () => void;
}

type JobStatus = 'COMPLETED' | 'ERROR' | 'PROCESSING' | 'CANCELLED' | 'PENDING';

const statusConfig: Record<JobStatus, { label: string; icon: typeof Loader2; color: string; bg: string }> = {
  COMPLETED: { label: 'Completado', icon: CheckCircle2, color: 'text-success', bg: 'bg-success-pale border-success-light' },
  ERROR: { label: 'Error', icon: XCircle, color: 'text-brand-red', bg: 'bg-brand-red-pale border-brand-red-light' },
  PROCESSING: { label: 'Procesando', icon: Loader2, color: 'text-brand-amber', bg: 'bg-brand-amber-pale border-brand-amber' },
  CANCELLED: { label: 'Cancelado', icon: Ban, color: 'text-brand-gray-400', bg: 'bg-brand-gray-50 border-brand-gray-200' },
  PENDING: { label: 'Pendiente', icon: Clock, color: 'text-brand-navy', bg: 'bg-brand-red-pale border-brand-red-light' },
};

type Direction = 'recibidos' | 'emitidos' | 'ambos';

const directionMeta: Record<Direction, { icon: typeof FileText; label: string; desc: string }> = {
  recibidos: { icon: CornerDownRight, label: 'Recibidos', desc: 'Comprobantes que te emitieron' },
  emitidos: { icon: Send, label: 'Emitidos', desc: 'Comprobantes que emitiste' },
  ambos: { icon: ArrowUpDown, label: 'Ambos', desc: 'Recibidos y emitidos secuencialmente' },
};

const tipoOptions = [
  { value: '1', label: 'Factura' },
  { value: '2', label: 'Liquidación de compra' },
  { value: '3', label: 'Nota de Crédito' },
  { value: '4', label: 'Nota de Débito' },
  { value: '6', label: 'Comprobante de Retención' },
];

export default function MassDownloadModal({ open, onClose }: MassDownloadModalProps) {
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [direction, setDirection] = useState<Direction>('ambos');
  const logEndRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    ruc: '',
    clave_sri: '',
    fecha_desde: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    fecha_hasta: new Date().toISOString().split('T')[0],
    tipo_comprobante: '1',
  });

  const [dateMode, setDateMode] = useState<'range' | 'month'>('range');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  useEffect(() => {
    if (dateMode === 'month') {
      const yearStr = String(selectedYear);
      const monthStr = String(selectedMonth).padStart(2, '0');
      const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
      setFormData(prev => ({
        ...prev,
        fecha_desde: `${yearStr}-${monthStr}-01`,
        fecha_hasta: `${yearStr}-${monthStr}-${String(lastDay).padStart(2, '0')}`
      }));
    }
  }, [dateMode, selectedMonth, selectedYear]);

  const [jobs, setJobs] = useState<any[]>([]);
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [logs, setLogs] = useState<{ id: number; level: string; message: string; created_at: string }[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [emisores, setEmisores] = useState<{ ruc: string; razonSocial: string; tieneCredenciales: boolean }[]>([]);
  const [selectedRuc, setSelectedRuc] = useState('');
  const [hasCredentials, setHasCredentials] = useState(false);
  const { hasSriLinked, activeRuc } = useAuth();

  useEffect(() => {
    if (open && hasSriLinked) {
      import('@/lib/sriClient').then(({ sriClient }) => {
        sriClient.getEmisores().then((res: any) => {
          if (res.success && res.emisores?.length) {
            setEmisores(res.emisores);
            const preferred = activeRuc && res.emisores.some((e: any) => e.ruc === activeRuc)
              ? activeRuc : res.emisores[0].ruc;
            setSelectedRuc(preferred);
            setFormData(prev => ({ ...prev, ruc: preferred }));
            const emisor = res.emisores.find((e: any) => e.ruc === preferred);
            setHasCredentials(Boolean(emisor?.tieneCredenciales));
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
    } catch {
      setLogsError('Error de red al cargar logs');
    }
    finally { setLogsLoading(false); }
  }, []);

  useEffect(() => {
    if (selectedJob?.status === 'PROCESSING') {
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

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

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
      toast.error('Error de red');
    }
  };

  const deleteJob = async (jobId: string) => {
    if (!confirm('¿Eliminar esta tarea del historial?')) return;
    try {
      const token = localStorage.getItem('sri_access_token');
      const res = await fetch('/api/sri/scraping', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ jobId }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'Tarea eliminada');
        if (selectedJob?.id === jobId) { setSelectedJob(null); setLogs([]); }
        fetchJobs(true);
      } else {
        toast.error(data.error || 'Error al eliminar');
      }
    } catch {
      toast.error('Error de red');
    }
  };

  const deleteAllJobs = async () => {
    if (!confirm('¿Eliminar todo el historial?')) return;
    try {
      const token = localStorage.getItem('sri_access_token');
      const res = await fetch('/api/sri/scraping', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ deleteAll: true }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'Historial eliminado');
        setSelectedJob(null);
        setLogs([]);
        fetchJobs(true);
      } else {
        toast.error(data.error || 'Error al eliminar');
      }
    } catch {
      toast.error('Error de red');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const getActionType = (dir: Direction): string => {
    if (dir === 'recibidos') return 'DOWNLOAD_RECEIVED';
    if (dir === 'emitidos') return 'DOWNLOAD_EMITTED';
    return 'DOWNLOAD_BOTH';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.fecha_desde > formData.fecha_hasta) {
      toast.error('La fecha "Desde" no puede ser mayor que "Hasta".');
      return;
    }
    setLoading(true);
    try {
      const token = localStorage.getItem('sri_access_token');
      const payload: Record<string, unknown> = {
        ruc: formData.ruc,
        fecha_desde: formData.fecha_desde,
        fecha_hasta: formData.fecha_hasta,
        tipo_comprobante: formData.tipo_comprobante,
        action_type: getActionType(direction),
        options: { connection_mode: 'playwright' },
      };
      if (!hasCredentials && formData.clave_sri) {
        payload.clave_sri = formData.clave_sri;
      }

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
        toast.success('Descarga encolada correctamente');
        fetch('/api/sri/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId: data.jobId }),
        }).catch(err => console.error('[Sync]', err));
      } else {
        toast.error(data.error || 'Error al iniciar');
      }
    } catch {
      toast.error('Error de red al comunicarse con el servidor');
    } finally {
      setLoading(false);
      fetchJobs(true);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} size="2xl" showClose={false}>
      <div className="flex flex-col">
        {/* ─── Header ─── */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-brand-navy to-brand-navy-mid px-4 py-3 mb-5">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-40" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/20">
                <DownloadCloud className="h-4 w-4 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white leading-tight">Descarga Masiva SRI</h2>
                <p className="text-[10px] text-white/60">Sincroniza comprobantes desde el portal SRI</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="h-7 w-7 flex items-center justify-center rounded-lg bg-white/10 text-white/60 hover:bg-white/20 hover:text-white transition-all cursor-pointer"
              aria-label="Cerrar"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-brand-gray-200">
          {/* ─── Form ─── */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="lg:col-span-5 pr-0 lg:pr-5 space-y-4"
          >
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold text-brand-gray-600">RUC</Label>
                {emisores.length > 1 ? (
                  <div className="grid grid-cols-1 gap-1.5">
                    {emisores.map((e) => {
                      const isActive = selectedRuc === e.ruc;
                      return (
                        <button
                          key={e.ruc}
                          type="button"
                          onClick={() => {
                            setSelectedRuc(e.ruc);
                            setFormData(prev => ({ ...prev, ruc: e.ruc }));
                            setHasCredentials(Boolean(e.tieneCredenciales));
                          }}
                          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition-all duration-150 cursor-pointer ${
                            isActive
                              ? 'border-brand-navy bg-brand-red-pale shadow-xs'
                              : 'border-brand-gray-200 bg-white hover:border-brand-gray-300'
                          }`}
                        >
                          <div className={`p-1 rounded-md transition-colors ${
                            isActive ? 'bg-brand-navy text-white' : 'bg-brand-gray-100 text-brand-gray-400'
                          }`}>
                            <User className="h-3.5 w-3.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-medium truncate ${
                              isActive ? 'text-brand-navy' : 'text-brand-gray-700'
                            }`}>
                              {e.ruc}
                            </div>
                            {e.razonSocial && (
                              <div className="text-[10px] text-brand-gray-400 truncate">{e.razonSocial}</div>
                            )}
                          </div>
                          {e.tieneCredenciales && (
                            <span className={`shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${
                              isActive
                                ? 'bg-success-pale text-success border-success-light'
                                : 'bg-brand-gray-50 text-brand-gray-400 border-brand-gray-200'
                            }`}>
                              {isActive ? 'Seleccionado' : 'Conectado'}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5 px-3 h-9 rounded-lg border border-brand-gray-200 bg-brand-gray-50 text-sm text-brand-gray-700 font-medium">
                    <User className="h-4 w-4 text-brand-gray-400 shrink-0" />
                    {formData.ruc || 'No hay RUC disponible'}
                  </div>
                )}
              </div>

              {hasCredentials ? (
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold text-brand-gray-600">Clave de acceso</Label>
                  <div className="flex items-center gap-2.5 px-3 h-9 rounded-lg border border-success-light bg-success-pale text-sm text-success font-medium">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    Usando credenciales guardadas
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="clave_sri_modal" className="text-[11px] font-semibold text-brand-gray-600">Clave de acceso</Label>
                  <div className="relative group">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-gray-400 group-focus-within:text-brand-navy transition-colors duration-200">
                      <KeyRound className="h-4 w-4" />
                    </div>
                    <Input
                      id="clave_sri_modal"
                      name="clave_sri"
                      type="password"
                      placeholder="Ingrese la clave"
                      value={formData.clave_sri}
                      onChange={handleChange}
                      autoComplete="off"
                      className="pl-9 h-9 text-sm border-brand-gray-200 bg-brand-gray-50/50 focus:bg-white focus:border-brand-navy transition-all duration-200"
                      required
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="tipo_comprobante_modal" className="text-[11px] font-semibold text-brand-gray-600">Tipo de comprobante</Label>
                <select
                  id="tipo_comprobante_modal"
                  name="tipo_comprobante"
                  value={formData.tipo_comprobante}
                  onChange={handleChange}
                  className="w-full h-9 px-3 rounded-lg border border-brand-gray-200 bg-brand-gray-50/50 text-sm focus:bg-white focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15 outline-none transition-all duration-200"
                  required
                >
                  {tipoOptions.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold text-brand-gray-600">Período</Label>
                <div className="flex gap-1.5 p-1 rounded-lg bg-brand-gray-100">
                  {(['range', 'month'] as const).map(mode => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setDateMode(mode)}
                      className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all duration-200 cursor-pointer ${
                        dateMode === mode
                          ? 'bg-white text-brand-gray-800 shadow-xs'
                          : 'text-brand-gray-400 hover:text-brand-gray-600'
                      }`}
                    >
                      {mode === 'range' ? 'Rango' : 'Mes completo'}
                    </button>
                  ))}
                </div>
              </div>

              <AnimatePresence mode="wait">
                {dateMode === 'month' ? (
                  <motion.div
                    key="month"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="grid grid-cols-2 gap-3 overflow-hidden"
                  >
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-semibold text-brand-gray-600">Mes</Label>
                      <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(Number(e.target.value))}
                        className="w-full h-9 px-3 rounded-lg border border-brand-gray-200 bg-brand-gray-50/50 text-sm focus:bg-white focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15 outline-none transition-all duration-200"
                      >
                        {['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'].map((m, i) => (
                          <option key={i + 1} value={i + 1}>{m}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-semibold text-brand-gray-600">Año</Label>
                      <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="w-full h-9 px-3 rounded-lg border border-brand-gray-200 bg-brand-gray-50/50 text-sm focus:bg-white focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15 outline-none transition-all duration-200"
                      >
                        {Array.from({ length: 5 }, (_, i) => {
                          const year = new Date().getFullYear() - i;
                          return <option key={year} value={year}>{year}</option>;
                        })}
                      </select>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="range"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="grid grid-cols-2 gap-3 overflow-hidden"
                  >
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-semibold text-brand-gray-600">Desde</Label>
                      <div className="relative group">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-gray-400 group-focus-within:text-brand-navy transition-colors duration-200 pointer-events-none" />
                        <Input
                          name="fecha_desde"
                          type="date"
                          value={formData.fecha_desde}
                          onChange={handleChange}
                          className="pl-9 h-9 text-xs border-brand-gray-200 bg-brand-gray-50/50 focus:bg-white focus:border-brand-navy transition-all duration-200"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-semibold text-brand-gray-600">Hasta</Label>
                      <div className="relative group">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-gray-400 group-focus-within:text-brand-navy transition-colors duration-200 pointer-events-none" />
                        <Input
                          name="fecha_hasta"
                          type="date"
                          value={formData.fecha_hasta}
                          onChange={handleChange}
                          min={formData.fecha_desde}
                          className="pl-9 h-9 text-xs border-brand-gray-200 bg-brand-gray-50/50 focus:bg-white focus:border-brand-navy transition-all duration-200"
                          required
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ─── Dirección ─── */}
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold text-brand-gray-600">Dirección</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.entries(directionMeta) as [Direction, typeof directionMeta['recibidos']][]).map(([key, meta]) => {
                    const DirIcon = meta.icon;
                    const isActive = direction === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setDirection(key)}
                        className={`relative flex flex-col items-center gap-1.5 px-2 py-2.5 rounded-xl border-2 transition-all duration-200 cursor-pointer ${
                          isActive
                            ? 'border-brand-navy bg-brand-red-pale shadow-xs'
                            : 'border-brand-gray-200 bg-white hover:border-brand-navy/30 hover:bg-brand-gray-50'
                        }`}
                      >
                        <div className={`p-1.5 rounded-lg transition-colors duration-200 ${
                          isActive ? 'bg-brand-navy text-white' : 'bg-brand-gray-100 text-brand-gray-400'
                        }`}>
                          <DirIcon className="w-4 h-4" />
                        </div>
                        <span className={`text-[11px] font-semibold leading-tight ${
                          isActive ? 'text-brand-navy' : 'text-brand-gray-400'
                        }`}>
                          {meta.label}
                        </span>
                        {isActive && (
                          <motion.div
                            layoutId="directionDot"
                            className="absolute -top-1 -right-1 w-3 h-3 bg-brand-navy rounded-full ring-2 ring-white"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-brand-gray-400 leading-relaxed">
                  {directionMeta[direction].desc}
                </p>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="relative w-full h-9 mt-2 overflow-hidden rounded-xl bg-brand-navy text-white text-sm font-semibold hover:bg-brand-navy-light active:scale-[0.98] transition-all duration-150 cursor-pointer shadow-md shadow-brand-navy/20"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Iniciando...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <DownloadCloud className="h-4 w-4" />
                    Iniciar Descarga
                  </span>
                )}
              </Button>
            </form>
          </motion.div>

          {/* ─── Jobs ─── */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut', delay: 0.1 }}
            className="lg:col-span-7 pt-5 lg:pt-0 lg:pl-5 flex flex-col min-h-[480px]"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-brand-gray-400 uppercase tracking-wider flex items-center gap-2">
                <History className="w-3.5 h-3.5" />
                Historial
              </h3>
              <div className="flex items-center gap-1">
                {jobs.length > 0 && (
                  <button
                    onClick={deleteAllJobs}
                    className="h-7 w-7 flex items-center justify-center rounded-md text-brand-gray-400 hover:text-brand-red hover:bg-brand-red-pale transition-all duration-150 cursor-pointer"
                    title="Eliminar todo"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  onClick={() => fetchJobs(true)}
                  disabled={isRefreshing}
                  className="h-7 w-7 flex items-center justify-center rounded-md text-brand-gray-400 hover:text-brand-gray-600 hover:bg-brand-gray-100 transition-all duration-150 cursor-pointer"
                  title="Actualizar"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-brand-navy' : ''}`} />
                </button>
              </div>
            </div>

            <div className="flex-1 flex flex-col min-h-0">
              {jobs.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-gray-100 ring-1 ring-brand-gray-200">
                    <Inbox className="h-7 w-7 text-brand-gray-400" />
                  </div>
                  <h4 className="text-sm font-semibold text-brand-gray-700 mb-1">Sin descargas aún</h4>
                  <p className="text-xs text-brand-gray-400 max-w-xs leading-relaxed">
                    Completa el formulario para iniciar tu primera sincronización.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto flex-1">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-brand-gray-100">
                        <th className="px-3 py-2 text-left text-[10px] font-semibold text-brand-gray-400 uppercase tracking-wider">Estado</th>
                        <th className="px-3 py-2 text-left text-[10px] font-semibold text-brand-gray-400 uppercase tracking-wider">Período</th>
                        <th className="px-3 py-2 text-left text-[10px] font-semibold text-brand-gray-400 uppercase tracking-wider hidden sm:table-cell">Dir.</th>
                        <th className="px-3 py-2 text-left text-[10px] font-semibold text-brand-gray-400 uppercase tracking-wider">Detalle</th>
                        <th className="px-3 py-2 text-right w-16"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-gray-100">
                      {jobs.map((job, i) => {
                        const status = job.status as JobStatus;
                        const cfg = statusConfig[status] || statusConfig.PENDING;
                        const Icon = cfg.icon;
                        const isSelected = selectedJob?.id === job.id;
                        return (
                          <motion.tr
                            key={job.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.03, duration: 0.2 }}
                            onClick={() => {
                              setSelectedJob(isSelected ? null : job);
                              if (!isSelected) fetchLogs(job);
                            }}
                            className={`group transition-all duration-150 cursor-pointer ${
                              isSelected
                                ? 'bg-brand-gray-50 ring-1 ring-inset ring-brand-gray-200'
                                : 'hover:bg-brand-gray-50/50'
                            }`}
                          >
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-[10px] font-semibold ${cfg.bg} ${cfg.color}`}>
                                <Icon className={`w-3 h-3 ${status === 'PROCESSING' ? 'animate-spin' : ''}`} />
                                {cfg.label}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              <span className="font-medium text-brand-gray-700 text-[11px]">
                                {job.fecha_desde
                                  ? `${new Date(job.fecha_desde).toLocaleDateString('es-EC', { day: '2-digit', month: 'short' })} - ${new Date(job.fecha_hasta).toLocaleDateString('es-EC', { day: '2-digit', month: 'short' })}`
                                  : `${job.mes?.toString().padStart(2, '0')}/${job.anio}`}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 hidden sm:table-cell">
                              <span className="text-[10px] font-medium text-brand-gray-400">
                                {job.action_type === 'DOWNLOAD_BOTH' ? 'Rec+Emi' :
                                 job.action_type === 'DOWNLOAD_EMITTED' ? 'Emitidos' :
                                 job.action_type === 'DOWNLOAD_RECEIVED' ? 'Recibidos' : '-'}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 min-w-0 max-w-[140px]">
                              <span className="block truncate text-[10px] text-brand-gray-400 leading-tight" title={job.progress_message || ''}>
                                {job.progress_message || (status === 'PENDING' ? '—' : '')}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                                {(status === 'PENDING' || status === 'PROCESSING') && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); cancelJob(job.id); }}
                                    className="h-7 w-7 flex items-center justify-center rounded-md text-brand-gray-400 hover:text-brand-red hover:bg-brand-red-pale transition-all duration-150 cursor-pointer"
                                    title="Cancelar"
                                  >
                                    <Ban className="h-3.5 w-3.5" />
                                  </button>
                                )}
                                <button
                                  onClick={(e) => { e.stopPropagation(); deleteJob(job.id); }}
                                  className="h-7 w-7 flex items-center justify-center rounded-md text-brand-gray-400 hover:text-brand-red hover:bg-brand-red-pale transition-all duration-150 cursor-pointer"
                                  title="Eliminar"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ─── Logs ─── */}
              <AnimatePresence>
                {selectedJob && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border-t border-brand-gray-200 overflow-hidden"
                  >
                    <div className="flex items-center justify-between px-4 py-2 bg-brand-gray-50">
                      <h4 className="text-[10px] font-semibold text-brand-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Terminal className="w-3 h-3" />
                        Logs
                        {selectedJob.status === 'PROCESSING' && (
                          <span className="inline-flex items-center gap-1 ml-1 text-[8px] font-medium text-brand-amber bg-brand-amber-pale px-1.5 py-0.5 rounded-full border border-brand-amber">
                            <span className="w-1.5 h-1.5 bg-brand-amber rounded-full animate-pulse" />
                            vivo
                          </span>
                        )}
                      </h4>
                      <button
                        onClick={() => { setSelectedJob(null); setLogs([]); setLogsError(null); }}
                        className="text-[10px] text-brand-gray-400 hover:text-brand-gray-600 transition-colors duration-150 cursor-pointer"
                      >
                        cerrar
                      </button>
                    </div>
                    <div className="max-h-[180px] overflow-y-auto bg-[#0d1117]">
                      {logsLoading && logs.length === 0 ? (
                        <div className="flex items-center gap-2 p-3 text-[#8b949e] text-[11px]">
                          <span className="w-1.5 h-1.5 bg-[#8b949e] rounded-full animate-pulse" />
                          Cargando logs...
                        </div>
                      ) : logsError ? (
                        <div className="p-3 text-[#f85149] text-[10px]">{logsError}</div>
                      ) : logs.length === 0 ? (
                        <div className="p-3 text-[#8b949e] text-[10px] italic">Sin registros.</div>
                      ) : (
                        <div className="divide-y divide-[#21262d]">
                          {logs.map((log) => (
                            <div key={log.id} className="flex gap-2.5 px-3 py-1.5 hover:bg-[#161b22] transition-colors duration-100">
                              <span className="text-[#484f58] text-[10px] whitespace-nowrap w-16 shrink-0 font-mono">
                                {new Date(log.created_at).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </span>
                              <span className={`text-[9px] font-semibold uppercase w-14 shrink-0 ${
                                log.level === 'error' ? 'text-[#f85149]' :
                                log.level === 'success' ? 'text-[#3fb950]' :
                                log.level === 'warn' ? 'text-[#d29922]' :
                                'text-[#58a6ff]'
                              }`}>
                                {log.level}
                              </span>
                              <span className="text-[#e6edf3] text-[11px] leading-relaxed break-words">{log.message}</span>
                            </div>
                          ))}
                          <div ref={logEndRef} />
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </div>
    </Dialog>
  );
}
