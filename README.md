# ATI-EXA PRD — Asistente Tributario Inteligente
**Versión:** 1.0  
**Fecha:** 2025-06-12  
**Responsable:** Equipo ATI-EXA  
**Estado:** Borrador de alcance y requisitos

---

## 1. Visión del producto
ATI-EXA es una plataforma inteligente que automatiza la preparación, validación y presentación de obligaciones tributarias en Ecuador, minimizando errores humanos, reduciendo tiempos de gestión y garantizando cumplimiento normativo de forma proactiva.

---

## 2. Modelado del sistema

### 2.1 Actores y roles
| Actor | Descripción |
|-------|--------------|
| **Contribuyente** | Persona natural o jurídica que declara impuestos y consulta obligaciones. |
| **Contador / Asesor tributario** | Gestiona obligaciones en nombre del contribuyente y repite fallos de auditoría. |
| **Administrador interno** | Gestiona usuarios, roles, parámetros del sistema y alertas. |
| **SRI (Servicio de Rentas Internas)** | Entidad tributaria ecuatoriana; fuente de normativa, catálogos y validaciones. |
| **Sistema ATI-EXA (IA)** | Motor de clasificación, cálculo y auditoría predictiva. |
| **Pasarela API** | Orquesta seguridad, rate limiting, logging y comunicación entre frontend y microservicios. |

---

### 2.2 Dominios y macroprocesos
| Dominio | Responsabilidad |
|---------|-----------------|
| **Gobernanza y seguridad** | Autenticación, autorización, OAuth 2.0, 2FA, cifrado, auditoría, respaldos. |
| **Gestión de identidad** | Perfiles, roles, permisos, expediente digital del usuario. |
| **Catalogación tributaria** | Catálogos SRI, formularios, plazos, alícuotas, retenciones. |
| **Ingesta y clasificación** | Captura de documentos, extracción OCR, clasificación IA, etiquetado automático. |
| **Cálculo y determinación** | Motor de liquidación de impuestos (ej. IVA, IR, ICE). |
| **Prevalidación y auditoría** | Revisión de inconsistencias, alertas, reglas de negocio. |
| **Presentación y trazabilidad** | Envío XML firmado al SRI, seguimiento de estado, notificaciones. |
| **Analítica y reportes** | Dashboard, indicadores, exportaciones, comparativas. |
| **Integración SRI** | Puente entre capa REST interna y servicios SOAP/legacy del SRI (XAdES-BES, XML). |

---

### 2.3 Requisitos de información (datos relevantes)
- **Contribuyente:** RUC, razón social, actividad económica, régimen, representante legal.
- **Documento tributario:** tipo, fecha, número, emisor, receptor, base imponible, impuestos.
- **Obligación:** periodo, tipo de impuesto, formulario, fecha límite, estado.
- **Catálogo SRI:** códigos de actividad, tipos de comprobante, alícuotas vigentes, agencias de retención.
- **Auditoría:** regla aplicada, severidad, observación, estado de corrección.
- **Operación:** usuario, fecha/hora, IP, payload, respuesta SRI, firma electrónica utilizada.

---

## 3. Requisitos funcionales

### 3.1 Autenticación y seguridad
- Registro y onboarding guiado.
- Login con contraseña + TOTP / WebAuthn (2FA).
- Tokens de acceso y refresco con OAuth 2.0 / OpenID Connect.
- Política de contraseñas, bloqueo por intentos fallidos, logging de eventos sensibles.
- Cifrado en tránsito (TLS 1.3) y en reposo (AES-256 en reposo para datos sensibles).

### 3.2 Gestión documental
- Carga masiva o unitaria de comprobantes (imágenes, PDF, XML).
- Vista previa, descarga, etiquetado y clasificación automática.
- Almacenamiento en bucket privado con control de versiones.
- Vinculación a periodo tributario y tipo de impuesto.

### 3.3 Cálculo tributario
- Selección de regimenes fiscales válidos para el contribuyente.
- Parametrización de alícuotas yretenciones por categoría y periodo.
- Cálculo automático de bases imponibles, créditos tributarios y saldos.
- Comparativa entre declaraciones de periodos anteriores.

### 3.4 Prevalidación y auditoría
- Motor de reglas compuesto por:
  - Reglas nativas del sistema (campos nulos, comprobantes duplicados, montos inconsistentes).
  - Reglas normativas SRI (fechas de caducidad, validez de autorizaciones, cruce de información).
- Panel de resolución de conflictos con sugerencias automáticas de corrección.
- Historial de auditoría inmutable de los cambios realizados en las declaraciones.

### 3.5 Integración SRI (Web Services)
- Conexión vía SOAP a los entornos de Pruebas (`celcer`) y Producción (`cel`).
- Tolerancia a fallos: Sistema de reintentos exponenciales y bypass de firewalls/bloqueos regionales mediante Proxy Inverso.
- Manejo de firma electrónica (XAdES-BES) requerida para la transmisión de comprobantes.
- Sincronización en segundo plano de documentos recibidos y emitidos.

## 4. Stack Tecnológico

| Capa | Tecnología |
|------|------------|
| **Framework** | Next.js (App Router) |
| **Lenguaje** | TypeScript |
| **Estilos & UI** | Tailwind CSS v4, shadcn/ui, Lucide Icons |
| **Autenticación** | Next-Auth (Auth.js) |
| **Integración SOAP** | `soap` (Node.js) con soporte para endpoints dinámicos |
| **Base de Datos** | PostgreSQL / MySQL |
| **Criptografía/Firma** | `xadesjs`, `node-forge`, `@peculiar/webcrypto` |

## 5. Puesta en marcha (Desarrollo)

### Requisitos previos
- Node.js >= 20
- (Opcional) Proxy Inverso si se despliega en la nube para evadir geobloqueos del SRI.

### Instalación
1. Clonar el repositorio.
2. Copiar `.env.example` a `.env.local` y configurar variables (especialmente `SRI_PROXY_HOST` para desarrollo fuera de Ecuador).
3. Instalar dependencias:
   ```bash
   npm install
   ```
4. Iniciar el servidor local:
   ```bash
   npm run dev
   ```
El proyecto estará disponible en el puerto indicado por Next.js (usualmente `http://localhost:3000` o `3002`).
