"use client";

import { useCallback, useState } from "react";
import { Upload, FileCode2 } from "lucide-react";
import { cn } from "@/lib/utils";

type XmlImportZoneProps = {
  onImport: (files: FileList) => Promise<void>;
  loading?: boolean;
  className?: string;
};

export default function XmlImportZone({ onImport, loading, className }: XmlImportZoneProps) {
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files?.length || loading) return;
      await onImport(files);
    },
    [onImport, loading]
  );

  return (
    <div
      className={cn(
        "border-2 border-dashed rounded-xl p-8 text-center transition-colors",
        dragOver ? "border-brand-navy bg-brand-gray-50" : "border-muted-foreground/25",
        className
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
      }}
    >
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-brand-green-pale flex items-center justify-center">
          <FileCode2 className="w-6 h-6 text-brand-green" />
        </div>
        <div>
          <p className="text-sm font-semibold">Importar XML de compras</p>
          <p className="text-xs text-muted-foreground mt-1">
            Arrastra archivos .xml aquí o selecciónalos desde tu equipo
          </p>
        </div>
        <label className="inline-flex items-center gap-2 px-3 py-2 border rounded-md text-sm font-medium cursor-pointer hover:bg-muted disabled:opacity-50">
          <input
            type="file"
            accept=".xml,text/xml,application/xml"
            multiple
            className="hidden"
            disabled={loading}
            onChange={(e) => handleFiles(e.target.files)}
          />
          <Upload className="w-4 h-4" />
          {loading ? "Importando..." : "Seleccionar archivos XML"}
        </label>
      </div>
    </div>
  );
}
