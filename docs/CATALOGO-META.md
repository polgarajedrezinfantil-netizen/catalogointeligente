# Catálogo dinámico de Meta (Facebook/Instagram)

Convierte el catálogo de una tienda en un **catálogo dinámico** de Meta: un feed
de productos en vivo + el píxel para retargeting. No hace falta Google Sheets ni
subir archivos — el feed se genera solo desde Supabase y refleja el stock actual.

## 1. El feed (URL que pegas en Meta)

Cada tienda expone su feed en su propio subdominio y slug:

```
https://<tienda>.myelplay.com/<slug>/feed          → CSV  (por defecto)
https://<tienda>.myelplay.com/<slug>/feed?format=xml → XML (RSS 2.0)
```

Para **Mamielina**:

```
https://mamielina.myelplay.com/mamielina/feed
```

Trae los campos **obligatorios** de Meta (id, title, description, availability,
condition, price, link, image_link, brand) y los **opcionales** útiles para ropa
infantil: `sale_price`, `gender`, `age_group`, `product_type`,
`custom_label_0` (la colección / Nido), `color`, `size` y `additional_image_link`.

Reglas que ya cumple el feed:
- **id** = el uuid del producto (único y estable; no cambia entre actualizaciones,
  así Meta no duplica).
- **price** = número + moneda de la tienda, p. ej. `120.00 MXN`.
- **link** = la página del producto (`/p/<id>`), no el catálogo general.
- **image_link** = URL directa de la primera foto (Storage público).
- **availability** = `in stock` si el producto está *disponible*; si está apartado,
  vendido o agotado → `out of stock`.
- Se **omiten** del feed los productos ocultos, sin foto o sin precio (para no
  disparar errores de campos faltantes en Meta).

### Conectarlo en Meta
1. **Commerce Manager** → tu **Catálogo** → **Fuentes de datos** → **Agregar
   productos** → **Feed de datos** → **Programar feed**.
2. Pega la URL del feed. Frecuencia recomendada: **diaria** (o cada hora si el
   stock cambia mucho).
3. Moneda por defecto: **MXN**. País: México.

## 2. El píxel (para que sea *dinámico* de verdad)

Para retargeting (mostrarle a alguien el mismo producto que vio), el
`content_id` de los eventos del píxel debe coincidir con el `id` del feed. Ya
está cableado así:

- **PageView** en el catálogo y en cada producto.
- **ViewContent** al abrir un producto (`/p/<id>`), con `content_ids=[id]`.
- **AddToCart** al **apartar** un producto, con `content_ids=[id]`.

### Activarlo por tienda
1. **Meta Events Manager** → tu **píxel** → copia su **ID** (numérico).
2. En el panel de la tienda: **Configuración → Contacto y redes → Píxel de Meta**,
   pega el ID y guarda.
3. Listo: el catálogo empieza a mandar los eventos. Verifícalo con la extensión
   **Meta Pixel Helper** (Chrome) abriendo el catálogo y un producto.

## 3. Errores comunes de Meta (y cómo los evitamos)
- **IDs duplicados** → usamos el uuid estable del producto.
- **Campos obligatorios faltantes** → el feed omite productos sin foto/precio.
- **Precio sin moneda** → siempre `precio + MXN`.
- **image_link roto (404)** → apuntamos a Storage público; si un producto no tiene
  foto, no entra al feed.
- **Píxel sin coincidencia** → `content_ids` = `id` del feed en todos los eventos.

## Notas de implementación
- Feed: `app/[tienda]/feed/route.ts` (lee de Supabase con service-role, solo lectura).
- Píxel: `components/MetaPixel.tsx` (+ helpers `trackViewContent`, `trackAddToCart`).
- Campo por tienda: migración `supabase/migrations/0031_meta_pixel.sql`
  (`tiendas.meta_pixel_id`). Aplícala con `supabase db push` antes de usar el píxel.
