import { NextResponse } from "next/server";
import { getPerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Envía un correo a un cliente vía Resend (opcional). Si no está configurado,
// responde indicándolo. Registra el envío en la bitácora `mensajes`.
export async function POST(req: Request) {
  const perfil = await getPerfil();
  if (!perfil || !perfil.tienda_id) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }
  const { correo, celular, asunto, cuerpo } = (await req.json()) as {
    correo: string;
    celular?: string;
    asunto: string;
    cuerpo: string;
  };

  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) {
    return NextResponse.json({
      ok: false,
      error: "Correo no configurado (define RESEND_API_KEY y EMAIL_FROM).",
    });
  }

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: correo, subject: asunto, text: cuerpo }),
    });
    if (!r.ok) {
      const t = await r.text();
      return NextResponse.json({ ok: false, error: t }, { status: 502 });
    }
    // Bitácora
    const supabase = await createClient();
    await supabase.from("mensajes").insert({
      tienda_id: perfil.tienda_id,
      celular: celular ?? null,
      canal: "correo",
      cuerpo: `[${asunto}] ${cuerpo}`,
      enviado_por: perfil.id,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const detalle = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ ok: false, error: detalle }, { status: 500 });
  }
}
