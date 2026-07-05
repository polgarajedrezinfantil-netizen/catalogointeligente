# Onboarding de un cliente nuevo — escalón "Catálogo"

Guía operativa para dar de alta una tienda nueva (sin agente IA; el agente es
add-on aparte). Tiempo estimado: 30–60 min de operador + 1 sesión con el cliente.

---

## 1. Qué entrega el cliente (pedir ANTES del alta)

| Entregable | Detalle |
|---|---|
| Nombre de la tienda | Como quiere que aparezca en el catálogo y el login |
| Subdominio deseado | `<cliente>.myelplay.com` — minúsculas, sin acentos |
| Logo | PNG/JPG cuadrado, fondo transparente de preferencia (se usa en login y catálogo) |
| Número de WhatsApp | A donde llegan los pedidos de sus clientas (con lada, ej. `52656…`) |
| Correo del administrador | La cuenta con la que entrará al panel |
| Catálogo inicial | Fotos + nombre + precio (mínimo). Si trae Excel/lista, se captura en la primera sesión |
| Datos de pago | Texto libre que ve la clienta al apartar (transferencia, CLABE, etc.) → campo `datos_pago` |

## 2. Alta (operador, con cuenta superadmin)

1. **Verificar el subdominio contra el registro de subdominios** de
   `myelplay.com` (POLGAR y Nicómaco comparten el dominio; evitar colisiones).
2. **Crear la tienda** en `agentes.myelplay.com/admin/tiendas` → "Nueva tienda":
   nombre + plan; marcar **sembrar líneas demo** para que el panel no arranque
   vacío (el cliente las renombra después).
3. **DNS (Cloudflare, zona myelplay.com):** CNAME `<cliente>` →
   `cname.vercel-dns.com`, modo **DNS only** (nube gris).
4. **Vercel:** proyecto `catalogointeligente` (team POLGAR) → Settings →
   Domains → agregar `<cliente>.myelplay.com`. Esperar el ✓ de emisión de
   certificado.
5. **Crear el usuario admin del cliente** en `/admin/tiendas` → Invitar:
   - Modo **contraseña temporal** (hoy): se genera una clave `Nido-…` para
     compartir por WhatsApp; el cliente la cambia al entrar.
   - Modo **correo** (cuando el SMTP de Resend esté conectado en Supabase):
     invitación por email, sin compartir claves.
6. **Configuración inicial de la tienda** (como superadmin o junto al cliente):
   logo, WhatsApp de pedidos, `datos_pago`, horas de apartado (`hold_horas`,
   default 6), moneda. Vive en el panel → Configuración / Apariencia.
7. **Smoke test:** abrir `https://<cliente>.myelplay.com` → debe redirigir al
   catálogo con la marca del cliente; login en `/admin/login` debe mostrar su
   logo/nombre (branding por host).

## 3. Primera sesión con el cliente (30 min)

1. Entra al panel, cambia su contraseña.
2. Renombra las líneas de venta demo a sus categorías reales y ajusta los
   campos por línea (el modelo es form-builder; ocultar los que no apliquen).
3. Sube 3–5 productos con foto para aprender el flujo.
4. **Prueba el flujo completo como clienta final:** ver producto → apartar →
   generar pedido con folio → llega el WhatsApp a su número → confirmar pago
   en el panel.
5. Entregar: URL del catálogo, URL del panel, y a quién escribir por soporte.

## 4. Baja de una tienda (o limpieza de una prueba)

1. Apagar primero: `/admin/tiendas` → desactivar (`activa = false`) — apaga
   catálogo y login sin borrar datos.
2. Borrado definitivo: eliminar la fila en `tiendas` — **todas** las tablas
   cascadan (`on delete cascade`, verificado 2026-07-05 sin afectar a las demás
   tiendas). Aparte, borrar manualmente:
   - las **fotos** del bucket `fotos` bajo la carpeta `<tienda_id>/` (Storage
     no tiene FK, no cascada), y
   - los **usuarios** de esa tienda (Auth → borrar; su perfil ya cascadó).
3. Quitar el dominio en Vercel y el CNAME en Cloudflare.

## 5. Si contrata el agente IA (add-on)

Alta adicional: fila en `agente_config`, conexión de Mercado Pago por OAuth
(la tienda DEBE conectar su cuenta propia) y canales Meta (WhatsApp/IG) — ver
roadmap de Tech Provider. Con la fila en `agente_config`, el grupo "Agente"
aparece solo en el panel.
