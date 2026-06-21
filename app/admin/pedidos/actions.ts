"use server";

import { revalidatePath } from "next/cache";
import { getPerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Ejecuta una RPC de pedido (la propia RPC valida que administres la tienda).
async function rpcPedido(rpc: string, formData: FormData) {
  const perfil = await getPerfil();
  if (!perfil || !perfil.tienda_id) throw new Error("No autorizado");
  const supabase = await createClient();
  const { error } = await supabase.rpc(rpc, {
    p_pedido: String(formData.get("pedido_id")),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/pedidos");
  revalidatePath("/admin");
  revalidatePath("/admin/productos");
}

// Confirma el pago: las prendas del pedido quedan VENDIDAS.
export async function confirmarPedido(formData: FormData) {
  await rpcPedido("confirmar_pedido", formData);
}

// Cancela el pedido: libera las prendas (vuelven a estar disponibles).
export async function cancelarPedido(formData: FormData) {
  await rpcPedido("cancelar_pedido", formData);
}
