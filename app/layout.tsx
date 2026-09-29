import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Owen's Fitness · Gestión", description: "Agenda, atletas, entrenamientos, finanzas y tienda.", icons: { icon: "/favicon.svg" } };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="es"><body>{children}</body></html>; }
