import type { Metadata } from "next";
import "./globals.css";
import { ProveedorPlanner } from "@/lib/estado";

export const metadata: Metadata = {
  title: "Jimmy's Planner",
  description: "Agenda y pendientes — datos al 17/07",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <ProveedorPlanner>{children}</ProveedorPlanner>
      </body>
    </html>
  );
}
