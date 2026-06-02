import { NotebookText } from "lucide-react";
import React, { useMemo } from "react";
import { EmptyState } from "@/components/composed/empty-state";
import { Badge } from "@/components/ui/badge";
import type { VentureCompanyDetail } from "@/features/ventures/venturesSlice";
import { formatVentureDate } from "@/pages/ventures/utils/format";

type RecentNotesCardProps = {
  detail: VentureCompanyDetail;
};

const notePreview = (body: string) =>
  body.replace(/\s+/g, " ").trim().slice(0, 150);

export const RecentNotesCard: React.FC<RecentNotesCardProps> = ({ detail }) => {
  const notes = useMemo(
    () =>
      [...detail.notes]
        .sort((left, right) => {
          if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
          return right.note_date.localeCompare(left.note_date);
        })
        .slice(0, 3),
    [detail.notes],
  );

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <NotebookText className="h-4 w-4 text-teal-700" />
          <h2 className="text-base font-semibold text-slate-950">
            Recent notes
          </h2>
        </div>
        <span className="text-xs text-slate-500">
          {detail.notes.length} total
        </span>
      </div>

      {notes.length ? (
        <div className="space-y-3">
          {notes.map((note) => (
            <article
              key={note.id}
              className="rounded-md border border-slate-100 bg-slate-50/60 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-950">
                    {note.title}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatVentureDate(note.note_date)}
                  </p>
                </div>
                {note.pinned ? (
                  <Badge
                    variant="outline"
                    className="border-amber-200 bg-amber-50 text-amber-800"
                  >
                    Pinned
                  </Badge>
                ) : null}
              </div>
              <p className="mt-2 line-clamp-2 text-sm leading-5 text-slate-600">
                {notePreview(note.body_markdown) || "No note body."}
              </p>
              {note.tags.length ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {note.tags.slice(0, 4).map((tag) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="border-slate-200 bg-white text-slate-600"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No notes yet"
          description="Notes and tags will summarize company context here."
          icon={<NotebookText className="h-5 w-5" />}
        />
      )}
    </section>
  );
};
