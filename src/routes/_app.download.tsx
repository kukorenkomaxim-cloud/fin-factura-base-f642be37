import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Apple, Monitor, Cpu, AlertTriangle, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { useLocale } from "@/hooks/use-locale";

const WIN_URL =
  "https://github.com/kukorenkomaxim-cloud/fin-factura-base-f642be37/releases/download/v9/FinCraft-win32-x64.zip";
const MAC_INTEL_URL =
  "https://github.com/kukorenkomaxim-cloud/fin-factura-base-f642be37/releases/download/v9/FinCraft-darwin-x64.zip";
const MAC_ARM_URL =
  "https://github.com/kukorenkomaxim-cloud/fin-factura-base-f642be37/releases/download/v9/FinCraft-darwin-arm64.zip";

const WIN_FILENAME = "FinCraft-Windows_v9.zip";
const MAC_INTEL_FILENAME = "FinCraft-macOS-Intel_v9.zip";
const MAC_ARM_FILENAME = "FinCraft-macOS-AppleSilicon_v9.zip";

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
          "Установите FinCraft на свой компьютер для быстрого доступа без браузера. Сертификат электронной подписи сохраняется в приложении и применяется автоматически при отправке фактур в AEAT.",
        win: "Скачать для Windows",
        macIntel: "Скачать для macOS (Intel)",
        macArm: "Скачать для macOS (Apple Silicon M1/M2/M3)",
        winHint: "Распакуйте архив и запустите FinCraft.exe",
        macIntelHint:
          "Для Mac с процессором Intel. Распакуйте архив и перетащите FinCraft.app в Applications.",
        macArmHint:
          "Для Mac с процессором Apple Silicon (M1, M2, M3). Распакуйте архив и перетащите FinCraft.app в Applications.",
      }
    : {
        title: "Desktop application",
        subtitle:
          "Install FinCraft on your computer for quick access without a browser. Your e-signature certificate is stored inside the app and applied automatically when sending invoices to AEAT.",
        win: "Download for Windows",
        macIntel: "Download for macOS (Intel)",
        macArm: "Download for macOS (Apple Silicon M1/M2/M3)",
        winHint: "Unzip the archive and run FinCraft.exe",
        macIntelHint:
          "For Macs with Intel CPUs. Unzip the archive and drag FinCraft.app to Applications.",
        macArmHint:
          "For Macs with Apple Silicon (M1, M2, M3). Unzip the archive and drag FinCraft.app to Applications.",
      };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t.title}</h1>
        <p className="mt-1 text-muted-foreground">{t.subtitle}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5" /> Windows
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{t.winHint}</p>
            <p className="text-xs font-mono text-muted-foreground">
              {WIN_FILENAME}
            </p>
            <Button asChild className="w-full">
              <a href={WIN_URL} download={WIN_FILENAME}>
                <Download className="mr-2 h-4 w-4" />
                {t.win}
              </a>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Apple className="h-5 w-5" /> macOS (Intel)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{t.macIntelHint}</p>
            <p className="text-xs font-mono text-muted-foreground">
              {MAC_INTEL_FILENAME}
            </p>
            <Button asChild className="w-full">
              <a href={MAC_INTEL_URL} download={MAC_INTEL_FILENAME}>
                <Download className="mr-2 h-4 w-4" />
                {t.macIntel}
              </a>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="h-5 w-5" /> macOS (Apple Silicon)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{t.macArmHint}</p>
            <p className="text-xs font-mono text-muted-foreground">
              {MAC_ARM_FILENAME}
            </p>
            <Button asChild className="w-full">
              <a href={MAC_ARM_URL} download={MAC_ARM_FILENAME}>
                <Download className="mr-2 h-4 w-4" />
                {t.macArm}
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

