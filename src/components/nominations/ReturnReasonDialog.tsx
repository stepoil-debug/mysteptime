import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { validateReturnReason } from "@/lib/nomination-return";

export function ReturnReasonField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-2">
      <Label htmlFor="nomination-return-reason">Motivo da devolução / o que corrigir *</Label>
      <Textarea id="nomination-return-reason" value={value} onChange={(event) => onChange(event.target.value)} placeholder="Descreva o que precisa ser alterado para corrigir" rows={3} required />
    </div>
  );
}

export function ReturnReasonDialog({ targetLabel, initialReason = "", pending, onConfirm, onClose }: {
  targetLabel: string;
  initialReason?: string;
  pending: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState(initialReason);
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !pending) onClose(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Devolver para {targetLabel}</DialogTitle></DialogHeader>
        <ReturnReasonField value={reason} onChange={setReason} />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={pending}>Cancelar</Button>
          <Button disabled={!!validateReturnReason(reason) || pending} loading={pending} onClick={() => { if (!validateReturnReason(reason)) onConfirm(reason.trim()); }}>Confirmar devolução</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}