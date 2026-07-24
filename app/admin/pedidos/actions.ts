"use server";

import { revalidatePath } from "next/cache";
import { getPerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Ejecuta una RPC de pedido (la propia RPC valida que administres la tienda
// y que el pedido esté en el estado correcto para esa acción).
async function rpcPedido(rpc: string, formData: FormData, conMotivo = false) {
  const perfil = await getPerfil();
  if (!perfil || !perfil.tienda_id) throw new Error("No autorizado");
  const supabase = await createClient();

  const args: Record<string, string | null> = { p_pedido: String(formData.get("pedido_id")) };
  if (conMotivo) {
    args.p_motivo = String(formData.get("motivo") ?? "").trim() || null;
  }

  const { error } = await supabase.rpc(rpc, args);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/pedidos");
  revalidatePath("/admin");
  revalidatePath("/admin/productos");
  revalidatePath("/admin/clientes/[celular]", "page");
}

// Confirma el pago: las prendas del pedido quedan VENDIDAS.
export async function confirmarPedido(formData: FormData) {
  await rpcPedido("confirmar_pedido", formData);
}

// Cancela un pedido pendiente: libera las prendas (vuelven a estar disponibles).
export async function cancelarPedido(formData: FormData) {
  await rpcPedido("cancelar_pedido", formData, true);
}

// "Confirmé el pago por error": el pedido vuelve a pendiente y sus prendas
// siguen reservadas para el mismo cliente.
export async function revertirPago(formData: FormData) {
  await rpcPedido("revertir_pago_pedido", formData, true);
}

// Devolución: la venta deja de contar y las prendas regresan al catálogo.
export async function devolverPedido(formData: FormData) {
  await rpcPedido("devolver_pedido", formData, true);
}
