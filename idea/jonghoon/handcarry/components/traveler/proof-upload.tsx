"use client";

import { useRef, useState } from "react";
import { ErrorNotice, ProofPhotos } from "@/components/order/order-parts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, inputClass } from "@/components/ui/field";
import type { Order } from "@/lib/domain/types";
import { useT } from "@/lib/i18n/use-t";
import { nowIso, useDispatch } from "@/lib/store/react";
import type { DispatchResult } from "@/lib/store/state";

const MAX_EDGE = 800;

// Downscale before storing: photos live in localStorage, which holds only a few MB.
async function toSmallDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.7);
}

const todaySeoul = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());

export function ProofUpload({ order }: { order: Order }) {
  const { t } = useT();
  const dispatch = useDispatch();
  const fileInput = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [receiptDate, setReceiptDate] = useState(todaySeoul);
  const [result, setResult] = useState<DispatchResult | null>(null);

  const addFiles = async (files: FileList | null) => {
    if (!files) return;
    const urls = await Promise.all([...files].map(toSmallDataUrl));
    setPhotos((prev) => [...prev, ...urls]);
  };

  return (
    <Card className="space-y-4 p-4" aria-label={t.traveler.uploadTitle}>
      <div className="space-y-1">
        <h2 className="font-display text-[17px] font-semibold">{t.traveler.uploadTitle}</h2>
        <p className="text-sm text-ink-2">{t.traveler.buyNow}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setPhotos((prev) => [...prev.filter((p) => !p.startsWith("sample:")), "sample:receipt", "sample:item"])}
        >
          {t.traveler.attachSample}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => fileInput.current?.click()}>
          {t.traveler.chooseFile}
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          aria-label={t.traveler.chooseFile}
          onChange={(e) => void addFiles(e.target.files)}
        />
      </div>
      {photos.length > 0 && (
        <>
          <p className="text-[12px] font-semibold text-ink-2">{t.traveler.photoCount(photos.length)}</p>
          <ProofPhotos photos={photos} />
        </>
      )}
      <Field id="receipt-date" label={t.traveler.receiptDate}>
        <input id="receipt-date" type="date" className={inputClass} value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} />
      </Field>
      <Button
        size="lg"
        block
        disabled={photos.length === 0}
        onClick={() =>
          setResult(
            dispatch({ type: "orderEvent", orderId: order.id, event: { type: "uploadProof", proof: { photos, receiptDate, uploadedAt: nowIso() } } }),
          )
        }
      >
        {t.traveler.submitProof}
      </Button>
      <ErrorNotice result={result} />
    </Card>
  );
}
