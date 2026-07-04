import { urlFoto } from "@/lib/fotos";
import { tiendaPorHost } from "@/lib/marca-host";
import LoginCliente, { type MarcaLogin } from "./LoginCliente";

// En <tienda>.myelplay.com el login viste la marca de esa tienda (logo,
// nombre, paleta); en el dominio del producto (agentes.*), en localhost o en
// dominios técnicos queda el diseño neutro "MyelPlay Agentes".
export default async function LoginPage() {
  const tienda = await tiendaPorHost();
  const marca: MarcaLogin = tienda
    ? {
        slug: tienda.slug,
        nombre: tienda.nombre,
        logoUrl: tienda.logo_url ? urlFoto(tienda.logo_url) : null,
        tema: tienda.tema,
      }
    : null;
  return <LoginCliente marca={marca} />;
}
