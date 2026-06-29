"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Server, Plus, RefreshCw, Trash2, Search, Globe } from "lucide-react";

export default function ProxyConfigPanel() {
  const [proxies, setProxies] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, available: 0, inUse: 0 });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [discoverCountry, setDiscoverCountry] = useState("EC");

  // Add Proxy Form
  const [host, setHost] = useState("");
  const [port, setPort] = useState("");
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [pais, setPais] = useState("US");

  const loadProxies = async () => {
    try {
      const res = await fetch("/api/admin/proxies");
      const data = await res.json();
      if (data.success) {
        setProxies(data.proxies);
        setStats(data.stats);
      } else {
        toast.error("Error al cargar proxies: " + data.error);
      }
    } catch (err: any) {
      toast.error("Error de red al cargar proxies");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProxies();
  }, []);

  const handleAddProxy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!host || !port) return toast.error("Host y Puerto son requeridos");
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/proxies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add",
          proxy_host: host,
          proxy_port: Number(port),
          proxy_user: user || undefined,
          proxy_pass: pass || undefined,
          pais,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Proxy agregado correctamente");
        setHost("");
        setPort("");
        setUser("");
        setPass("");
        setPais("US");
        loadProxies();
      } else {
        toast.error("Error: " + data.error);
      }
    } catch (err) {
      toast.error("Error al agregar proxy");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveProxy = async (id: number) => {
    if (!confirm("¿Seguro que deseas eliminar este proxy?")) return;
    try {
      const res = await fetch("/api/admin/proxies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", proxy_id: id }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Proxy eliminado");
        loadProxies();
      } else {
        toast.error("Error al eliminar");
      }
    } catch (err) {
      toast.error("Error de red");
    }
  };

  const handleToggleProxy = async (id: number, current: boolean) => {
    try {
      const res = await fetch("/api/admin/proxies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle", proxy_id: id, activo: !current }),
      });
      const data = await res.json();
      if (data.success) {
        loadProxies();
      } else {
        toast.error("Error al cambiar estado");
      }
    } catch (err) {
      toast.error("Error de red");
    }
  };

  const handleRotateProxies = async () => {
    setRotating(true);
    try {
      const res = await fetch("/api/admin/proxies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "releaseAll" }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Proxies rotados (liberados) exitosamente");
        loadProxies();
      } else {
        toast.error("Error: " + data.error);
      }
    } catch (err) {
      toast.error("Error al rotar proxies");
    } finally {
      setRotating(false);
    }
  };

  const handleDiscoverProxies = async () => {
    setDiscovering(true);
    try {
      const res = await fetch("/api/admin/proxies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "discover", country: discoverCountry }),
      });
      const data = await res.json();
      if (data.success) {
        const r = data.result;
        toast.success(
          `${r.country || discoverCountry}: ${r.alive} vivos, ${r.new} nuevos en el pool`
        );
        loadProxies();
      } else {
        toast.error("Error: " + data.error);
      }
    } catch (err) {
      toast.error("Error al descubrir proxies");
    } finally {
      setDiscovering(false);
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Cargando proxies...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Server className="w-5 h-5 text-brand-navy" />
          <h2 className="text-lg font-bold text-brand-gray-800">Gestión de Proxies</h2>
        </div>
        <div className="flex gap-2 items-center">
          <div className="flex items-center gap-1.5 bg-brand-gray-50 border border-brand-gray-200 rounded-lg px-2.5 py-1.5">
            <Globe className="w-3.5 h-3.5 text-brand-gray-500" />
            <select
              value={discoverCountry}
              onChange={e => setDiscoverCountry(e.target.value)}
              className="text-xs font-medium bg-transparent border-none outline-none text-brand-gray-700 cursor-pointer"
            >
              <option value="EC">Ecuador</option>
              <option value="AR">Argentina</option>
              <option value="BO">Bolivia</option>
              <option value="BR">Brazil</option>
              <option value="CL">Chile</option>
              <option value="CO">Colombia</option>
              <option value="CR">Costa Rica</option>
              <option value="CU">Cuba</option>
              <option value="DO">Dominicana</option>
              <option value="ES">España</option>
              <option value="FR">Francia</option>
              <option value="GB">Reino Unido</option>
              <option value="GT">Guatemala</option>
              <option value="IT">Italia</option>
              <option value="MX">México</option>
              <option value="PA">Panamá</option>
              <option value="PE">Perú</option>
              <option value="PY">Paraguay</option>
              <option value="US">USA</option>
              <option value="UY">Uruguay</option>
              <option value="VE">Venezuela</option>
            </select>
          </div>
          <Button onClick={handleDiscoverProxies} disabled={discovering} variant="outline" className="gap-2">
            <Search className={`w-4 h-4 ${discovering ? "animate-pulse" : ""}`} />
            {discovering ? "Descubriendo..." : "Enlistar Nuevos"}
          </Button>
          <Button onClick={handleRotateProxies} disabled={rotating} variant="outline" className="gap-2">
            <RefreshCw className={`w-4 h-4 ${rotating ? "animate-spin" : ""}`} />
            {rotating ? "Rotando..." : "Rotar Proxies"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-brand-gray-50 border border-brand-gray-200 rounded-lg p-4">
          <p className="text-xs font-semibold text-brand-gray-500 uppercase tracking-wide">Total Proxies</p>
          <p className="text-2xl font-bold text-brand-navy mt-1">{stats.total}</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
          <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Disponibles</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{stats.available}</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">En Uso</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">{stats.inUse}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Agregar Nuevo Proxy</CardTitle>
          <CardDescription>
            Agrega un proxy HTTP/HTTPS al pool para ser usado en el scraping del SRI.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddProxy} className="flex gap-3 flex-wrap items-end">
            <div className="space-y-1.5 flex-1 min-w-[150px]">
              <Label className="text-xs">Host / IP</Label>
              <Input required value={host} onChange={e => setHost(e.target.value)} placeholder="192.168.1.1" className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5 w-[100px]">
              <Label className="text-xs">Puerto</Label>
              <Input required type="number" value={port} onChange={e => setPort(e.target.value)} placeholder="8080" className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5 flex-1 min-w-[120px]">
              <Label className="text-xs">Usuario (Opcional)</Label>
              <Input value={user} onChange={e => setUser(e.target.value)} placeholder="user" className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5 flex-1 min-w-[120px]">
              <Label className="text-xs">Contraseña (Opcional)</Label>
              <Input type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="****" className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5 w-[80px]">
              <Label className="text-xs">País</Label>
              <Input value={pais} onChange={e => setPais(e.target.value)} placeholder="US" className="h-9 text-sm" />
            </div>
            <Button type="submit" disabled={submitting} className="h-9 px-4 gap-1.5 text-xs">
              <Plus className="w-3.5 h-3.5" />
              {submitting ? "Agregando..." : "Agregar"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lista de Proxies en Pool</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-brand-gray-100 bg-brand-gray-50/50">
                  <th className="px-5 py-3 font-semibold text-brand-gray-600 text-xs uppercase tracking-wide">Proxy</th>
                  <th className="px-5 py-3 font-semibold text-brand-gray-600 text-xs uppercase tracking-wide">País</th>
                  <th className="px-5 py-3 font-semibold text-brand-gray-600 text-xs uppercase tracking-wide">Estado</th>
                  <th className="px-5 py-3 font-semibold text-brand-gray-600 text-xs uppercase tracking-wide">Uso</th>
                  <th className="px-5 py-3 font-semibold text-brand-gray-600 text-xs uppercase tracking-wide text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-gray-100">
                {proxies.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-6 text-center text-brand-gray-500">
                      No hay proxies registrados.
                    </td>
                  </tr>
                ) : (
                  proxies.map(p => (
                    <tr key={p.id} className="hover:bg-brand-gray-50/50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="font-mono text-xs font-semibold text-brand-gray-800">
                          {p.proxy_host}:{p.proxy_port}
                        </div>
                        {p.proxy_user && <div className="text-[10px] text-brand-gray-400 mt-0.5">Auth: {p.proxy_user}</div>}
                      </td>
                      <td className="px-5 py-3 font-medium text-brand-gray-600">{p.pais}</td>
                      <td className="px-5 py-3">
                        <button
                          onClick={() => handleToggleProxy(p.id, Boolean(p.activo))}
                          className={`relative w-9 h-5 rounded-full transition-colors shrink-0 cursor-pointer ${p.activo ? "bg-emerald-500" : "bg-brand-gray-200"}`}
                        >
                          <div
                            className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${
                              p.activo ? "left-[18px]" : "left-0.5"
                            }`}
                          />
                        </button>
                      </td>
                      <td className="px-5 py-3">
                        {p.en_uso ? (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
                            En Uso
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                            Libre
                          </Badge>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveProxy(p.id)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8"
                          title="Eliminar Proxy"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
