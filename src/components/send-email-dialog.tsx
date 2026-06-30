import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Mail, Send, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { listEmailAccounts, sendDocumentByGmail, logMailtoSend } from "@/lib/email.functions";
import { buildPdfBase64 } from "@/lib/pdf";
import type { PdfDocInput } from "@/lib/pdf";

interface AccountRow {
  id: string;
  provider: string;
  email: string;
  is_default: boolean;
}

export interface SendEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  defaultRecipient: string;
  defaultSubject: string;
  defaultBody: string;
  pdfInput: PdfDocInput;
  onSent?: () => void;
}

export function SendEmailDialog(props: SendEmailDialogProps) {
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [selectedSender, setSelectedSender] = useState<string>("mailto");
  const [to, setTo] = useState(props.defaultRecipient);
  const [subject, setSubject] = useState(props.defaultSubject);
  const [body, setBody] = useState(props.defaultBody);
  const [sending, setSending] = useState(false);
  const [mailtoOpened, setMailtoOpened] = useState(false);

  const listFn = useServerFn(listEmailAccounts);
  const sendGmailFn = useServerFn(sendDocumentByGmail);
  const logMailtoFn = useServerFn(logMailtoSend);

  useEffect(() => {
    if (!props.open) return;
    setTo(props.defaultRecipient);
    setSubject(props.defaultSubject);
    setBody(props.defaultBody);
    setMailtoOpened(false);
    (async () => {
      try {
        const res = await listFn();
        const accs = (res.accounts ?? []) as AccountRow[];
        setAccounts(accs);
        const def = accs.find((a) => a.is_default) ?? accs[0];
        setSelectedSender(def ? def.id : "mailto");
      } catch {
        setAccounts([]);
        setSelectedSender("mailto");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open]);

  async function handleSend() {
    if (!to.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim())) {
      toast.error("Неверный email получателя");
      return;
    }
    setSending(true);
    try {
      if (selectedSender === "mailto") {
        // Generate PDF and trigger download so user can attach it manually
        const { default: jsAuto } = await import("jspdf");
        void jsAuto;
        const { base64, filename } = await buildPdfBase64(props.pdfInput);
        // Trigger download
        const blob = b64ToBlob(base64, "application/pdf");
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);

        // Open mailto link
        const mailto = `mailto:${encodeURIComponent(to.trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.location.href = mailto;
        setMailtoOpened(true);
      } else {
        const { base64, filename } = await buildPdfBase64(props.pdfInput);
        await sendGmailFn({
          data: {
            documentId: props.documentId,
            accountId: selectedSender,
            to: to.trim(),
            subject,
            body,
            pdfBase64: base64,
            pdfFilename: filename,
          },
        });
        toast.success(`Письмо отправлено на ${to.trim()}`);
        props.onSent?.();
        props.onOpenChange(false);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка отправки");
    } finally {
      setSending(false);
    }
  }

  async function confirmMailtoSent() {
    try {
      await logMailtoFn({
        data: { documentId: props.documentId, to: to.trim(), subject, body },
      });
      toast.success("Отметка «Отправлено» сохранена");
      props.onSent?.();
      props.onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Отправить документ по email</DialogTitle>
          <DialogDescription>
            PDF документа будет прикреплён к письму автоматически (для Gmail) или скачается на ваш компьютер (для mailto).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Через</Label>
            <Select value={selectedSender} onValueChange={setSelectedSender}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    <span className="inline-flex items-center gap-2">
                      <Mail className="h-3 w-3" />
                      {a.email} {a.is_default && "(основной)"}
                    </span>
                  </SelectItem>
                ))}
                <SelectItem value="mailto">
                  <span className="inline-flex items-center gap-2">
                    <ExternalLink className="h-3 w-3" />
                    Открыть в моём почтовом клиенте (mailto)
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            {selectedSender === "mailto" && (
              <p className="text-xs text-muted-foreground">
                PDF скачается, откроется ваш почтовый клиент с заполненным письмом — приложите PDF вручную и отправьте.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Кому</Label>
            <Input type="email" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Тема</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Текст письма</Label>
            <Textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          {mailtoOpened && selectedSender === "mailto" ? (
            <>
              <Button variant="ghost" onClick={() => props.onOpenChange(false)}>Закрыть</Button>
              <Button onClick={confirmMailtoSent}>Да, я отправил письмо</Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => props.onOpenChange(false)} disabled={sending}>
                Отмена
              </Button>
              <Button onClick={handleSend} disabled={sending}>
                {sending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Отправка…</>
                ) : (
                  <><Send className="mr-2 h-4 w-4" /> {selectedSender === "mailto" ? "Открыть почтовый клиент" : "Отправить"}</>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function b64ToBlob(b64: string, type: string): Blob {
  const bin = atob(b64);
  const len = bin.length;
  const buf = new Uint8Array(len);
  for (let i = 0; i < len; i++) buf[i] = bin.charCodeAt(i);
  return new Blob([buf], { type });
}

// Default subject/body builders (4 languages).
export function buildDefaultEmailContent(opts: {
  lang: "ru" | "en" | "es" | "uk";
  docType: "proforma" | "factura";
  number: string;
  issuerName: string;
  clientName: string;
}): { subject: string; body: string } {
  const docName: Record<string, { proforma: string; factura: string }> = {
    ru: { proforma: "Счёт (Factura Proforma)", factura: "Фактура" },
    en: { proforma: "Invoice (Proforma)", factura: "Invoice" },
    es: { proforma: "Factura Proforma", factura: "Factura" },
    uk: { proforma: "Рахунок (Factura Proforma)", factura: "Фактура" },
  };
  const d = docName[opts.lang][opts.docType];

  const tpl = {
    ru: {
      subject: `${d} ${opts.number} от ${opts.issuerName}`,
      body: `Здравствуйте${opts.clientName ? `, ${opts.clientName}` : ""}!\n\nВо вложении ${d.toLowerCase()} ${opts.number}.\n\nС уважением,\n${opts.issuerName}`,
    },
    en: {
      subject: `${d} ${opts.number} from ${opts.issuerName}`,
      body: `Hello${opts.clientName ? `, ${opts.clientName}` : ""},\n\nPlease find attached ${d.toLowerCase()} ${opts.number}.\n\nBest regards,\n${opts.issuerName}`,
    },
    es: {
      subject: `${d} ${opts.number} de ${opts.issuerName}`,
      body: `Hola${opts.clientName ? `, ${opts.clientName}` : ""},\n\nAdjunto encontrará ${d.toLowerCase()} ${opts.number}.\n\nUn saludo,\n${opts.issuerName}`,
    },
    uk: {
      subject: `${d} ${opts.number} від ${opts.issuerName}`,
      body: `Вітаю${opts.clientName ? `, ${opts.clientName}` : ""}!\n\nУ вкладенні ${d.toLowerCase()} ${opts.number}.\n\nЗ повагою,\n${opts.issuerName}`,
    },
  };
  return tpl[opts.lang];
}
