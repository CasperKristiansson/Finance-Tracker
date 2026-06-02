import { NotebookText, Pencil } from "lucide-react";
import React, { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { EmptyState } from "@/components/composed/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { VentureCompanyDetail } from "@/features/ventures/venturesSlice";
import { formatVentureDate } from "@/pages/ventures/utils/format";

type RecentNotesCardProps = {
  detail: VentureCompanyDetail;
  onEditNote?: (note: VentureCompanyDetail["notes"][number]) => void;
};

export const RecentNotesCard: React.FC<RecentNotesCardProps> = ({
  detail,
  onEditNote,
}) => {
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
                {onEditNote ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label={`Edit note ${note.title}`}
                    onClick={() => onEditNote(note)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
              </div>
              <div className="mt-2 line-clamp-3 text-sm leading-5 text-slate-600">
                {note.body_markdown.trim() ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {note.body_markdown}
                  </ReactMarkdown>
                ) : (
                  "No note body."
                )}
              </div>
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
