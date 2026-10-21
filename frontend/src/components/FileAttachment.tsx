import { useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { supabase } from "../lib/supabase";

export interface AttachmentResult {
  url: string;
  path: string;
  size: number;
  mimeType: string;
  originalName: string;
}

interface FileAttachmentProps {
  /** Called when a file has been uploaded successfully. */
  onUploaded: (result: AttachmentResult) => void;
  /** Optionally restrict accepted MIME types, e.g. "image/*,application/pdf" */
  accept?: string;
  /** Human-readable label shown on the button. Defaults to "Attach file". */
  label?: string;
}

const API_BASE = (import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");

export function FileAttachment({ onUploaded, accept, label = "Attach file" }: FileAttachmentProps) {
  const { session } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !session) return;

    setError(null);
    setUploading(true);

    try {
      let uploadedResult: AttachmentResult | null = null;

      // Strategy 1: Pre-signed upload URL from backend -> direct upload to Supabase Storage CDN.
      // This completely bypasses Vercel 4.5MB serverless body limit and avoids 413 Content Too Large.
      try {
        const signedRes = await fetch(`${API_BASE}/storage/signed-upload-url`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ originalName: file.name, mimeType: file.type }),
        });

        if (signedRes.ok) {
          const signedData = (await signedRes.json()) as {
            signedUrl: string;
            token: string;
            path: string;
            storagePath: string;
            publicUrl: string;
          };

          const { error: uploadError } = await supabase.storage
            .from("attachments")
            .uploadToSignedUrl(signedData.storagePath, signedData.token, file, {
              contentType: file.type || "application/octet-stream",
            });

          if (!uploadError) {
            uploadedResult = {
              url: signedData.publicUrl,
              path: signedData.storagePath,
              size: file.size,
              mimeType: file.type || "application/octet-stream",
              originalName: file.name,
            };
          } else {
            // Direct PUT fallback on signedUrl
            const putRes = await fetch(signedData.signedUrl, {
              method: "PUT",
              headers: { "Content-Type": file.type || "application/octet-stream" },
              body: file,
            });
            if (putRes.ok) {
              uploadedResult = {
                url: signedData.publicUrl,
                path: signedData.storagePath,
                size: file.size,
                mimeType: file.type || "application/octet-stream",
                originalName: file.name,
              };
            }
          }
        }
      } catch (signedErr) {
        console.warn("Signed upload URL attempt failed, trying direct Supabase upload", signedErr);
      }

      // Strategy 2: Direct Supabase client upload
      if (!uploadedResult) {
        try {
          const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
          const storagePath = `${Date.now()}-${Math.random().toString(36).slice(2)}-${sanitizedName}`;

          const { data, error: directError } = await supabase.storage
            .from("attachments")
            .upload(storagePath, file, {
              contentType: file.type || "application/octet-stream",
              upsert: false,
            });

          if (!directError && data) {
            const { data: publicData } = supabase.storage.from("attachments").getPublicUrl(data.path);
            uploadedResult = {
              url: publicData.publicUrl,
              path: data.path,
              size: file.size,
              mimeType: file.type || "application/octet-stream",
              originalName: file.name,
            };
          }
        } catch (directErr) {
          console.warn("Direct Supabase storage upload failed, falling back to server endpoint", directErr);
        }
      }

      // Strategy 3: Server proxy fallback
      if (!uploadedResult) {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch(`${API_BASE}/storage/upload`, {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: formData,
        });

        const json = await response.json();
        if (!response.ok) {
          throw new Error((json as { error?: string }).error ?? `Upload failed: ${response.status}`);
        }

        uploadedResult = json as AttachmentResult;
      }

      if (uploadedResult) {
        onUploaded(uploadedResult);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={handleChange}
        disabled={uploading}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {uploading ? (
          <>
            <svg className="h-4 w-4 animate-spin text-zinc-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Uploading…
          </>
        ) : (
          <>
            <svg
              className="h-4 w-4 text-zinc-400"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z"
              />
            </svg>
            {label}
          </>
        )}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

/** Read-only display of an already-uploaded attachment. */
export function AttachmentLink({ attachment }: { attachment: AttachmentResult }) {
  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-sm text-brand hover:underline"
    >
      <svg
        className="h-4 w-4 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 002.112 2.13"
        />
      </svg>
      {attachment.originalName}
    </a>
  );
}
