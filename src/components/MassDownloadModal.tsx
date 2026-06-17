'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Dialog from '@/components/ui/Dialog';
import { useToast } from '@/contexts/ToastContext';
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
  Inbox
} from 'lucide-react';

interface MassDownloadModalProps {
  open: boolean;
  onClose: () => void;
}

export default function MassDownloadModal({ open, onClose }: MassDownloadModalProps) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    ruc: '',
    clave_sri: '',
    fecha_desde: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    fecha_hasta: new Date().toISOString().split('T')[0],
    tipo_comprobante: 'todos',
  });

  const [jobs, setJobs] = useState<any[]>([]);
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
      const res = await fetch('/api/sri/scraping');
      const data = await res.json();
      if (data.success && data.jobs) {
        setJobs(data.jobs);
      }
    } catch (e) {
      console.error(e);
      if (manual) toast.error('Error al actualizar los trabajos');
    } finally {
      if (manual) setTimeout(() => setIsRefreshing(false), 500);
    }
  }, [toast, open]);

  useEffect(() => {
    if (open) {
      fetchJobs();
      const interval = setInterval(() => fetchJobs(), 10000);
      return () => clearInterval(interval);
    }
  }, [fetchJobs, open]);

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
      const response = await fetch('/api/sri/scraping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message || 'Trabajo de descarga iniciado');
      } else {
        toast.error(data.error || 'Error al iniciar la descarga');
      }
    } catch (error) {
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
      case 'todos': return 'Todos';
      default: return 'Desconocido';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-600 text-white"><CheckCircle2 /> Completado</Badge>;
      case 'ERROR':
        return <Badge variant="destructive"><XCircle /> Error</Badge>;
      case 'PROCESSING':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-200"><Loader2 className="animate-spin" /> Procesando</Badge>;
      default:
        return <Badge variant="outline" className="text-gray-500"><Clock /> {status}</Badge>;
    }
  };

  return (
    <Dialog open={open} onClose={onClose} size="2xl" showClose>
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-brand-gray-900 flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <DownloadCloud className="w-6 h-6 text-primary" />
            </div>
            Descarga Masiva SRI
          </h2>
          <p className="text-brand-gray-500 mt-2 text-sm max-w-2xl">
            Sincroniza tus comprobantes electrónicos directamente desde el portal del SRI de forma segura.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Form Column */}
          <div className="lg:col-span-5 space-y-6">
            <Card className="border-brand-gray-200 shadow-sm transition-all duration-300">
              <CardHeader className="bg-gradient-to-br from-brand-gray-50 to-white border-b border-brand-gray-100 rounded-t-xl py-4">
                <CardTitle className="text-lg">Configurar Sincronización</CardTitle>
                <CardDescription className="text-xs">
                  Ingresa las credenciales del portal web del SRI.
                </CardDescription>
              </CardHeader>
              
              <form onSubmit={handleSubmit}>
                <CardContent className="space-y-4 pt-5 pb-5">
                  <div className="space-y-1.5 group">
                    <Label htmlFor="ruc_modal" className="text-xs group-focus-within:text-primary transition-colors">RUC del Contribuyente</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-2.5 h-4 w-4 text-brand-gray-400 group-focus-within:text-primary transition-colors" />
                      <Input 
                        id="ruc_modal" 
                        name="ruc" 
                        placeholder="1790000000001" 
                        value={formData.ruc}
                        onChange={handleChange}
                        autoComplete="off"
                        className="pl-9 h-9 transition-all border-brand-gray-200 focus:border-primary focus:ring-primary/20 text-sm"
                        required 
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-1.5 group">
                    <Label htmlFor="clave_sri_modal" className="text-xs group-focus-within:text-primary transition-colors">Clave de Acceso</Label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-brand-gray-400 group-focus-within:text-primary transition-colors" />
                      <Input 
                        id="clave_sri_modal" 
                        name="clave_sri" 
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••" 
                        value={formData.clave_sri}
                        onChange={handleChange}
                        autoComplete="off"
                        className="pl-9 pr-10 h-9 transition-all border-brand-gray-200 focus:border-primary focus:ring-primary/20 text-sm"
                        required 
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-2.5 text-brand-gray-400 hover:text-brand-gray-600 transition-colors"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5 group">
                    <Label htmlFor="tipo_comprobante_modal" className="text-xs group-focus-within:text-primary transition-colors">Tipo de Comprobante</Label>
                    <select
                      id="tipo_comprobante_modal"
                      name="tipo_comprobante"
                      value={formData.tipo_comprobante}
                      onChange={handleChange}
                      className="w-full h-9 px-3 rounded-md border border-brand-gray-200 bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-all border-brand-gray-200 focus:border-primary focus:ring-primary/20 text-brand-gray-800"
                      required
                    >
                      <option value="todos">Todos los comprobantes</option>
                      <option value="1">Factura</option>
                      <option value="2">Liquidación de compra</option>
                      <option value="3">Nota de Crédito</option>
                      <option value="4">Nota de Débito</option>
                      <option value="6">Comprobante de Retención</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5 group">
                      <Label htmlFor="fecha_desde_modal" className="text-xs group-focus-within:text-primary transition-colors">Fecha Desde</Label>
                      <div className="relative">
                        <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-brand-gray-400 group-focus-within:text-primary transition-colors pointer-events-none" />
                        <Input 
                          id="fecha_desde_modal" 
                          name="fecha_desde" 
                          type="date" 
                          value={formData.fecha_desde}
                          onChange={handleChange}
                          className="pl-8 h-9 transition-all border-brand-gray-200 focus:border-primary focus:ring-primary/20 text-brand-gray-800 text-xs"
                          required 
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5 group">
                      <Label htmlFor="fecha_hasta_modal" className="text-xs group-focus-within:text-primary transition-colors">Fecha Hasta</Label>
                      <div className="relative">
                        <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-brand-gray-400 group-focus-within:text-primary transition-colors pointer-events-none" />
                        <Input 
                          id="fecha_hasta_modal" 
                          name="fecha_hasta" 
                          type="date" 
                          value={formData.fecha_hasta}
                          onChange={handleChange}
                          min={formData.fecha_desde}
                          className="pl-8 h-9 transition-all border-brand-gray-200 focus:border-primary focus:ring-primary/20 text-brand-gray-800 text-xs"
                          required 
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
                
                <CardFooter className="bg-brand-gray-50 border-t border-brand-gray-100 rounded-b-xl py-4 flex flex-col gap-2">
                  <Button 
                    type="submit" 
                    disabled={loading} 
                    className="w-full bg-primary hover:bg-primary/90 text-white shadow-sm transition-all"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Iniciando Proceso...
                      </>
                    ) : (
                      <>
                        <DownloadCloud className="mr-2 h-4 w-4" />
                        Iniciar Descarga
                      </>
                    )}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </div>

          {/* Jobs Column */}
          <div className="lg:col-span-7">
            <Card className="h-full border-brand-gray-200 shadow-sm flex flex-col min-h-[400px]">
              <CardHeader className="flex flex-row items-center justify-between border-b border-brand-gray-100 bg-white rounded-t-xl pb-3 py-3">
                <div>
                  <CardTitle className="text-lg">Historial de Tareas</CardTitle>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => fetchJobs(true)}
                  disabled={isRefreshing}
                  className="gap-2 transition-all hover:bg-brand-gray-50 h-8 text-xs"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-primary' : 'text-brand-gray-500'}`} />
                  <span className="hidden sm:inline font-medium">Actualizar</span>
                </Button>
              </CardHeader>
              <CardContent className="p-0 flex-1 relative">
                {jobs.length === 0 ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-brand-gray-400 animate-in fade-in zoom-in-95 duration-500">
                    <div className="bg-brand-gray-50 p-3 rounded-full mb-3 shadow-sm border border-brand-gray-100">
                      <Inbox className="h-8 w-8 text-brand-gray-300" />
                    </div>
                    <h3 className="text-base font-medium text-brand-gray-900 mb-1">Sin historial de descargas</h3>
                    <p className="text-xs max-w-sm leading-relaxed text-brand-gray-500">
                      Inicia tu primera descarga usando el formulario de la izquierda.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto h-[350px] overflow-y-auto rounded-b-xl">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-brand-gray-50 text-brand-gray-500 font-semibold uppercase tracking-wider sticky top-0 z-10 shadow-sm">
                        <tr>
                          <th className="px-4 py-2.5">Estado</th>
                          <th className="px-4 py-2.5">Período</th>
                          <th className="px-4 py-2.5">Tipo</th>
                          <th className="px-4 py-2.5">Detalle</th>
                          <th className="px-4 py-2.5 text-right">Fecha</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-brand-gray-100">
                        {jobs.map((job, index) => (
                          <tr 
                            key={job.id} 
                            className="hover:bg-brand-gray-50/50 transition-colors bg-white animate-in fade-in slide-in-from-bottom-2"
                            style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}
                          >
                            <td className="px-4 py-3 whitespace-nowrap">
                              {getStatusBadge(job.status)}
                            </td>
                            <td className="px-4 py-3 font-medium text-brand-gray-900 whitespace-nowrap">
                              {job.fecha_desde 
                                ? `${new Date(job.fecha_desde).toLocaleDateString()} al ${new Date(job.fecha_hasta).toLocaleDateString()}` 
                                : `${job.mes?.toString().padStart(2, '0')}/${job.anio}`}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-brand-gray-600 font-medium">
                              {getTipoLabel(job.tipo_comprobante)}
                            </td>
                            <td className="px-4 py-3 min-w-[180px]">
                              <div className="flex flex-col gap-1">
                                {job.status === 'PROCESSING' && (
                                  <div className="w-24 h-1 bg-brand-gray-100 rounded-full overflow-hidden shrink-0">
                                    <div className="h-full bg-blue-500 animate-pulse rounded-full w-2/3"></div>
                                  </div>
                                )}
                                <span className="text-brand-gray-600 truncate max-w-[200px] text-[11px] leading-tight" title={job.progress_message || ''}>
                                  {job.progress_message || 'Iniciando...'}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-brand-gray-500 text-right whitespace-nowrap text-[10px]">
                              {new Date(job.created_at).toLocaleString(undefined, {
                                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                              })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
