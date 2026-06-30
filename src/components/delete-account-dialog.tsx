import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Trash2 } from "lucide-react";
import { useLocale } from "@/hooks/use-locale";
import { useAuth } from "@/hooks/use-auth";
import { deleteMyAccount } from "@/lib/account.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const CONFIRM_WORD = "DELETE";

export function DeleteAccountDialog() {
  const { t } = useLocale();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const runDelete = useServerFn(deleteMyAccount);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    setBusy(true);
    try {
      await runDelete();
      toast.success(t.deleteAccountSuccess);
      await signOut();
      navigate({ to: "/login" });
    } catch (e) {
      toast.error(t.deleteAccountError, {
        description: e instanceof Error ? e.message : undefined,
      });
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); setConfirm(""); }}>
      <DialogTrigger asChild>
        <Button variant="destructive">
          <Trash2 className="mr-2 h-4 w-4" />
          {t.deleteAccountBtn}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.deleteAccountConfirmTitle}</DialogTitle>
          <DialogDescription>{t.deleteAccountConfirmDesc}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="confirm-delete">{t.deleteAccountConfirmLabel}</Label>
          <Input
            id="confirm-delete"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={CONFIRM_WORD}
            autoComplete="off"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            {t.cancel}
          </Button>
          <Button
            variant="destructive"
            disabled={confirm.trim() !== CONFIRM_WORD || busy}
            onClick={handleDelete}
          >
            {busy ? t.deleting : t.deleteAccountBtn}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
