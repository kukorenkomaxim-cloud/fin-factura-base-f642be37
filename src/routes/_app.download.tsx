import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Apple, Monitor } from "lucide-react";
import { useLocale } from "@/hooks/use-locale";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const WIN_URL = `${SUPABASE_URL}/storage/v1/object/public/downloads/FinCraft-Windows_v8.zip`;
const MAC_URL = `${SUPABASE_URL}/storage/v1/object/public/downloads/FinCraft-macOS_v8.zip`;

export const Route = createFileRoute("/_app/download")({
  component: DownloadPage,
});

function DownloadPage() {
  const { lang } = useLocale();
  const isRu = lang === "ru" || lang === "uk";

  const t = isRu
    ? {
        title: "Десктоп-приложение",
        subtitle:
          "Установите FinCraft на свой компьютер для быстрого доступа без браузера.",
        win: "Скачать для Windows",
        mac: "Скачать для macOS",
        winHint: "Распакуйте архив и запустите FinCraft.exe",
        macHint: "Распакуйте архив и перетащите FinCraft.app в Applications",
      }
    : {
        title: "Desktop application",
        subtitle: "Install FinCraft on your computer for quick access without a browser.",
        win: "Download for Windows",
        mac: "Download for macOS",
        winHint: "Unzip the archive and run FinCraft.exe",
        macHint: "Unzip the archive and drag FinCraft.app to Applications",
      };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t.title}</h1>
        <p className="mt-1 text-muted-foreground">{t.subtitle}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5" /> Windows
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{t.winHint}</p>
            <Button asChild className="w-full">
              <a href={WIN_URL} download>
                <Download className="mr-2 h-4 w-4" />
                {t.win}
              </a>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Apple className="h-5 w-5" /> macOS
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{t.macHint}</p>
            <Button asChild className="w-full">
              <a href={MAC_URL} download>
                <Download className="mr-2 h-4 w-4" />
                {t.mac}
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
