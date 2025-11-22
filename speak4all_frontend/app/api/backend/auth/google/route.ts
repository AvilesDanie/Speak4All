import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();

    // Aquí llamamos a tu backend FastAPI
    const res = await fetch("http://localhost:8000/auth/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await res.text();

    // Si FastAPI no responde 2xx devolvemos ese status y body
    if (!res.ok) {
      console.error("Error desde FastAPI /auth/google:", text);
      return new NextResponse(text || "Error en FastAPI", {
        status: res.status,
      });
    }

    const data = JSON.parse(text);
    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    console.error("Error en API Next /backend/auth/google:", err);
    return NextResponse.json(
      { detail: "Error interno al llamar a FastAPI" },
      { status: 500 }
    );
  }
}
