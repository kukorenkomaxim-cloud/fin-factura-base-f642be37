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
  const [copied, setCopied] = useState(false);

  const XATTR_CMD = "xattr -cr /Applications/FinCraft.app";

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(XATTR_CMD);
      setCopied(true);
      toast.success(isRu ? "Скопировано" : "Copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(isRu ? "Не удалось скопировать" : "Copy failed");
    }
  }

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
        macNoteTitle: "Важно для пользователей macOS",
        macNoteIntro:
          "При первом запуске macOS может показать сообщение «Приложение „FinCraft“ повреждено, и его не удаётся открыть». Это стандартная защита Gatekeeper для приложений, не подписанных в Apple. Файл цел — нужно один раз снять с него карантин.",
        macStepsTitle: "Что сделать:",
        macStep1: "Перетащите FinCraft.app в папку «Программы» (Applications).",
        macStep2: "Откройте «Терминал» (Finder → Программы → Утилиты → Терминал).",
        macStep3: "Скопируйте команду ниже, вставьте её в Терминал и нажмите Enter.",
        macStep4: "Запустите FinCraft обычным двойным кликом.",
        copy: "Скопировать команду",
        copied: "Скопировано",
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
        macNoteTitle: "Important for macOS users",
        macNoteIntro:
          "On first launch macOS may show \u201CFinCraft is damaged and can\u2019t be opened\u201D. This is the standard Gatekeeper warning for apps not signed with an Apple Developer ID. The file is fine \u2014 you just need to remove the quarantine flag once.",
        macStepsTitle: "What to do:",
        macStep1: "Drag FinCraft.app into the Applications folder.",
        macStep2: "Open Terminal (Finder \u2192 Applications \u2192 Utilities \u2192 Terminal).",
        macStep3: "Copy the command below, paste it into Terminal and press Enter.",
        macStep4: "Launch FinCraft with a normal double-click.",
        copy: "Copy command",
        copied: "Copied",
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

      <Card className="border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
            <AlertTriangle className="h-5 w-5" />
            {t.macNoteTitle}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-amber-900 dark:text-amber-100">
          <p>{t.macNoteIntro}</p>
          <div>
            <p className="font-medium">{t.macStepsTitle}</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>{t.macStep1}</li>
              <li>{t.macStep2}</li>
              <li>{t.macStep3}</li>
              <li>{t.macStep4}</li>
            </ol>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="flex-1 select-all rounded-md bg-background px-3 py-2 font-mono text-xs text-foreground border">
              {XATTR_CMD}
            </code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="shrink-0"
            >
              {copied ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  {t.copied}
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" />
                  {t.copy}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

