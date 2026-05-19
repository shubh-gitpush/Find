"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ImageOff,
  Loader2,
  Pencil,
  Play,
  RefreshCw,
  Shield,
  Users,
  X,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ImagePreviewModal,
  type PreviewMedia,
} from "@/components/image-preview-modal";
import {
  getPeople,
  getPersonImages,
  type PersonItem,
  triggerFaceClustering,
  updatePersonName,
} from "@/lib/api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ─── Person Card Component ────────────────────────────────────────────────────

function PersonCard({
  person,
  onClick,
  onNameSaved,
}: {
  person: PersonItem;
  onClick: () => void;
  onNameSaved: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [nameInput, setNameInput] = useState(person.name ?? "");

  // Sync input state if name changes or editing gets cancelled
  useEffect(() => {
    if (!isEditing) {
      setNameInput(person.name ?? "");
    }
  }, [person.name, isEditing]);

  const submitName = () => {
    const trimmed = nameInput.trim();
    if (!trimmed) {
      toast.error("Name cannot be empty");
      return;
    }
    nameMutation.mutate(trimmed);
  };

  const nameMutation = useMutation({
    mutationFn: (name: string) => updatePersonName(person.id, name),
    onSuccess: () => {
      toast.success("Name saved!");
      setIsEditing(false);
      onNameSaved();
    },
    onError: () => {
      toast.error("Failed to save name");
    },
  });

  return (
    <article className="frost-panel card-hover flex h-full flex-col justify-between rounded-3xl p-5 bg-card text-card-foreground border border-border">
      <div>
        {/* Sample face thumbnails — Fixed 4-slot grid layout schema */}
        <button
          type="button"
          className="mb-4 grid aspect-square w-full cursor-pointer grid-cols-2 gap-2 text-left overflow-hidden rounded-2xl"
          onClick={onClick}
          onKeyDown={(e) => {
            if (e.key === "Enter") onClick();
          }}
          aria-label={`View photos of ${person.name?.trim() || "unknown person"}`}
        >
          {[0, 1, 2, 3].map((index) => {
            const mediaId = person.sample_media_ids[index];
            return (
              <div
                key={mediaId ? mediaId : `empty-${person.id}-${index}`}
                className="relative h-full w-full overflow-hidden rounded-xl border border-border bg-muted/40"
              >
                {mediaId ? (
                  <Image
                    src={`${API_BASE_URL}/api/image/${mediaId}/thumbnail`}
                    alt="Person photo"
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 25vw, 10vw"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground/40">
                    <ImageOff className="h-4 w-4" />
                  </div>
                )}
              </div>
            );
          })}
        </button>

        {/* Person name + edit input tracking row */}
        <div className="mb-3 flex min-h-[2.25rem] items-center gap-2 min-w-0">
          {isEditing ? (
            <div className="flex flex-1 items-center gap-1.5 w-full overflow-hidden">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitName();
                  if (e.key === "Escape") setIsEditing(false);
                }}
                placeholder="Enter a name..."
                className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={submitName}
                disabled={nameMutation.isPending}
                className="icon-button shrink-0"
                aria-label="Save name"
              >
                {nameMutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Check className="h-3 w-3" />
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setNameInput(person.name ?? "");
                  setIsEditing(false);
                }}
                className="icon-button shrink-0"
                aria-label="Cancel"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <>
              <p className="flex-1 truncate text-base font-medium text-foreground">
                {person.name?.trim() ? (
                  person.name
                ) : (
                  <span className="text-muted-foreground font-normal">
                    Unknown person
                  </span>
                )}
              </p>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="icon-button shrink-0"
                aria-label="Edit name"
              >
                <Pencil className="h-3 w-3" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Face count edge alignment row */}
      <div className="mt-auto flex items-center justify-between pt-2 border-t border-border/40">
        <span className="accent-badge text-xs text-muted-foreground">
          {person.face_count} {person.face_count === 1 ? "photo" : "photos"}
        </span>
        <button
          type="button"
          onClick={onClick}
          className="frost-button px-3 py-1.5 text-xs font-medium"
        >
          View photos
        </button>
      </div>
    </article>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PeoplePage() {
  const queryClient = useQueryClient();
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null);
  const [previewMedia, setPreviewMedia] = useState<PreviewMedia | null>(null);

  const {
    data: people,
    isLoading,
    error,
    isFetching,
  } = useQuery({
    queryKey: ["people"],
    queryFn: getPeople,
    refetchInterval: 15000,
  });

  const selectedPersonQuery = useQuery({
    queryKey: ["person-images", selectedPersonId],
    queryFn: () => getPersonImages(selectedPersonId as number),
    enabled: selectedPersonId !== null,
  });

  const clusterMutation = useMutation({
    mutationFn: triggerFaceClustering,
    onSuccess: () => {
      toast.success("Face clustering complete!");
      queryClient.invalidateQueries({ queryKey: ["people"] });
    },
    onError: () => {
      toast.error("Face clustering failed");
    },
  });

  return (
    <div className="page-shell bg-background text-foreground">
      <div className="container-shell py-10 md:py-14">
        {/* Page header */}
        <div className="page-enter mb-10 flex flex-col gap-6 border-b border-border pb-8 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <h1 className="section-heading mb-4 text-5xl font-medium md:text-6xl text-foreground">
              People
            </h1>
            <p className="muted-copy text-sm leading-6 text-muted-foreground">
              Photos grouped by person, detected and clustered entirely on your
              device.
            </p>
            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-border bg-muted/30 px-4 py-3">
              <Shield className="h-4 w-4 shrink-0 text-primary" />
              <p className="text-xs text-muted-foreground">
                All face data is processed and stored locally on your device. No
                images or face data are ever sent to any external service.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() =>
                queryClient.invalidateQueries({ queryKey: ["people"] })
              }
              className="frost-button px-5 py-2.5 text-sm font-medium"
            >
              <RefreshCw
                className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => clusterMutation.mutate()}
              disabled={clusterMutation.isPending}
              className="white-pill px-5 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            >
              {clusterMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Re-cluster faces
            </button>
          </div>
        </div>

        {/* Loading state rendering layout */}
        {isLoading && (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="frost-panel mx-auto max-w-md rounded-3xl px-8 py-14 text-center border border-destructive/50 bg-destructive/5">
            <p className="text-destructive font-medium">
              Failed to load people
            </p>
          </div>
        )}

        {/* Empty state container dashboard */}
        {people && people.length === 0 && (
          <div className="frost-panel mx-auto max-w-md rounded-3xl px-8 py-14 text-center border border-border bg-card">
            <Users className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
            <p className="mb-2 text-foreground font-medium">
              No people found yet
            </p>
            <p className="mb-6 text-sm leading-6 text-muted-foreground">
              Upload photos with faces, then run face clustering.
            </p>
            <button
              type="button"
              onClick={() => clusterMutation.mutate()}
              disabled={clusterMutation.isPending}
              className="white-pill px-5 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Play className="h-4 w-4" />
              Run face clustering
            </button>
          </div>
        )}

        {/* People dashboard visualization matrix */}
        {people && people.length > 0 && (
          <div className="page-enter">
            <div className="mb-8 grid gap-3 sm:grid-cols-2">
              <div className="frost-panel rounded-2xl p-4 border border-border bg-card">
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                  People found
                </p>
                <p className="mt-2 text-3xl font-light text-foreground">
                  {people.length}
                </p>
              </div>
              <div className="frost-panel rounded-2xl p-4 border border-border bg-card">
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                  Total faces
                </p>
                <p className="mt-2 text-3xl font-light text-foreground">
                  {people.reduce((sum, p) => sum + p.face_count, 0)}
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {people.map((person) => (
                <PersonCard
                  key={person.id}
                  person={person}
                  onClick={() => setSelectedPersonId(person.id)}
                  onNameSaved={() =>
                    queryClient.invalidateQueries({ queryKey: ["people"] })
                  }
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Person detail sub-gallery display modal */}
      {selectedPersonId !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-labelledby="person-modal-title"
        >
          <div className="frost-panel page-enter relative max-h-[90dvh] w-full max-w-6xl overflow-hidden rounded-3xl bg-card border border-border shadow-2xl">
            <button
              type="button"
              onClick={() => setSelectedPersonId(null)}
              className="icon-button absolute right-4 top-4 z-20 bg-background/80 border border-border hover:bg-accent text-foreground"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="border-b border-border px-6 py-5 bg-muted/20">
              <h2
                id="person-modal-title"
                className="text-xl font-medium text-foreground"
              >
                {selectedPersonQuery.data?.person_name?.trim() ||
                  "Unknown person"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                All photos containing this person.
              </p>
            </div>

            <div className="max-h-[calc(90dvh-88px)] overflow-y-auto p-6 bg-background">
              {selectedPersonQuery.isLoading && (
                <div className="flex items-center justify-center py-24">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              )}

              {selectedPersonQuery.isError && (
                <div className="py-16 text-center text-destructive font-medium">
                  Failed to load photos.
                </div>
              )}

              {selectedPersonQuery.data && (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                  {selectedPersonQuery.data.images.map((img) => (
                    <button
                      key={img.media_id}
                      type="button"
                      onClick={() =>
                        setPreviewMedia({
                          id: img.media_id,
                          filename: `Photo ${img.media_id}`,
                        })
                      }
                      className="frost-panel card-hover overflow-hidden rounded-3xl text-left bg-card border border-border group"
                      aria-label={`Preview photo ${img.media_id}`}
                    >
                      <div className="relative aspect-square bg-muted/40 overflow-hidden">
                        <Image
                          src={`${API_BASE_URL}/api/image/${img.media_id}/thumbnail`}
                          alt="Photo"
                          fill
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                          sizes="(max-width: 768px) 50vw, 25vw"
                          unoptimized
                        />
                      </div>
                      <div className="p-3 bg-muted/10 border-t border-border/40">
                        <p className="text-xs text-muted-foreground">
                          {img.faces.length}{" "}
                          {img.faces.length === 1 ? "face" : "faces"} detected
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Linked Image Preview Modal Context Integration */}
      {previewMedia && (
        <ImagePreviewModal
          media={previewMedia}
          onClose={() => setPreviewMedia(null)}
          onDeleted={(mediaId) => {
            if (previewMedia.id === mediaId) {
              setPreviewMedia(null);
            }
          }}
        />
      )}
    </div>
  );
}
