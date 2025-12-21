import { ArrowDownToLine, RefreshCcw, UploadCloud } from "lucide-react";
import React, { useEffect, useMemo } from "react";
import { MotionPage } from "@/components/motion-presets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useImportsApi } from "@/hooks/use-api";
import { formatDateTime } from "@/lib/format";
import type { ImportFileRead } from "@/types/api";

const bankLabel = (value: ImportFileRead["bank_import_type"]) => {
  switch (value) {
    case "swedbank":
      return "Swedbank";
    case "seb":
      return "SEB";
    case "circle_k_mastercard":
      return "Circle K Mastercard";
    default:
      return "None";
  }
};

const formatSize = (size?: number | null) => {
  if (!size || size <= 0) return "—";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
};

export const ImportFiles: React.FC = () => {
  const {
    storedFiles,
    storedFilesLoading,
    storedFilesError,
    fetchStoredFiles,
    downloadImportFile,
  } = useImportsApi();

  useEffect(() => {
    fetchStoredFiles();
  }, [fetchStoredFiles]);

  const hasData = storedFiles.length > 0;
  const lastUploaded = useMemo(
    () =>
      storedFiles
        .map((file) => file.uploaded_at)
        .sort()
        .reverse()[0],
    [storedFiles],
  );

  return (
    <MotionPage className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Imported files
          </h1>
          <p className="text-sm text-slate-600">
            Review stored upload history and download your original statements.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastUploaded ? (
            <Badge variant="outline" className="text-xs text-slate-600">
              Last upload {formatDateTime(lastUploaded)}
            </Badge>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchStoredFiles()}
            disabled={storedFilesLoading}
            className="gap-2"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>Upload archive</CardTitle>
            <CardDescription>
              Files saved after completing the imports flow.
            </CardDescription>
          </div>
          <Badge variant="secondary" className="text-xs">
            {storedFiles.length} files
          </Badge>
        </CardHeader>
        <CardContent>
          {storedFilesError ? (
            <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              {storedFilesError}
            </div>
          ) : null}
          {!hasData && !storedFilesLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-200 p-10 text-center">
              <UploadCloud className="h-10 w-10 text-slate-300" />
              <div>
                <p className="text-base font-medium text-slate-900">
                  No stored files yet
                </p>
                <p className="text-sm text-slate-600">
                  Upload statements through the imports flow to see them here.
                </p>
              </div>
              <Button variant="outline" onClick={() => fetchStoredFiles()}>
                Refresh
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Filename</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Bank format</TableHead>
                    <TableHead>Uploaded</TableHead>
                    <TableHead className="text-right">Rows</TableHead>
                    <TableHead className="text-right">Transactions</TableHead>
                    <TableHead className="text-right">Size</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {storedFiles.map((file) => (
                    <TableRow key={file.id}>
                      <TableCell className="font-medium text-slate-900">
                        {file.filename}
                        <div className="text-xs text-slate-500">
                          Batch {file.import_batch_id.slice(0, 8)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {file.account_name ? (
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-900">
                              {file.account_name}
                            </span>
                            <span className="text-xs text-slate-500">
                              {file.account_id}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {bankLabel(file.bank_import_type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-slate-700">
                        {formatDateTime(file.uploaded_at)}
                      </TableCell>
                      <TableCell className="text-right text-sm text-slate-700">
                        {file.row_count}
                      </TableCell>
                      <TableCell className="text-right text-sm text-slate-700">
                        {file.transaction_ids?.length ?? 0}
                      </TableCell>
                      <TableCell className="text-right text-sm text-slate-700">
                        {formatSize(file.size_bytes)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-2"
                          onClick={() => downloadImportFile(file.id)}
                          disabled={storedFilesLoading}
                        >
                          <ArrowDownToLine className="h-4 w-4" />
                          Download
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {storedFilesLoading && (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-center text-sm text-slate-500"
                      >
                        Loading…
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </MotionPage>
  );
};
