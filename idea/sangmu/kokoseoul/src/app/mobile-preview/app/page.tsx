import { notFound } from "next/navigation";
import Home from "@/app/page";

export default function MobilePreviewApp() {
  if (process.env.NODE_ENV !== "development" && process.env.APP_ENV !== "preview") notFound();
  return <Home />;
}
