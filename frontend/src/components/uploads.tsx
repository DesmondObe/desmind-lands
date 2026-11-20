"use client";

import { useRef, useState } from "react";
import { type FileKind, uploadFile } from "@/lib/api";
import { toast } from "./toast";
import { Button, cx, Icon, icons } from "./ui";

/** A drop zone that uploads each chosen file in turn, saying how it went. */
export function UploadZone({
  target,
  kind,
  accept,
  multiple,
  label,
  hint,
  onDone,
  compact,
}: {
  target: { listingId?: string; dealId?: string };
  kind: FileKind;
  accept: string;
  multiple?: boolean;
  label: string;
  hint?: string;
  onDone: (ids: string[]) => void;
  compact?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [over, setOver] = useState(false);

  async function send(files: FileList | null) {
    if (!files?.length) return;
    const ids: string[] = [];
    for (const [i, file] of [...files].entries()) {
      setBusy(files.length > 1 ? `Uploading ${i + 1} of ${files.length}…` : "Uploading…");
      try {
        ids.push(await uploadFile(file, { ...target, kind }));
      } catch (err) {
        toast(`${file.name}: ${(err as Error).message}`, "error");
      }
    }
    setBusy(null);
    if (ids.length) {
      toast(ids.length > 1 ? `${ids.length} files added` : "File added");
      onDone(ids);
    }
    if (input.current) input.current.value = "";
  }

  if (compact)
    return (
      <>
        <input
          ref={input}
          type="file"
          accept={accept}
          multiple={multiple}
          hidden
          onChange={(e) => send(e.target.files)}
        />
        <Button type="button" variant="secondary" size="sm" busy={!!busy} onClick={() => input.current?.click()}>
          <Icon d={icons.upload} className="size-4" />
          {busy ?? label}
        </Button>
      </>
    );

  return (
    <button
      type="button"
      onClick={() => input.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        void send(e.dataTransfer.files);
      }}
      disabled={!!busy}
      className={cx(
        "survey-grid flex w-full flex-col items-center gap-2 rounded-3xl border-2 border-dashed px-6 py-10 text-center transition",
        over ? "border-earth-500 bg-earth-50" : "border-line-strong hover:border-earth-400",
      )}
    >
      <input
        ref={input}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={(e) => send(e.target.files)}
      />
      <span className="grid size-12 place-items-center rounded-2xl bg-earth-100 text-earth-700">
        <Icon d={icons.upload} className="size-6" />
      </span>
      <span className="font-semibold text-ink">{busy ?? label}</span>
      {hint && <span className="text-sm text-ink-faint">{hint}</span>}
    </button>
  );
}
