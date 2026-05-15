import { mkdir, writeFile } from "fs/promises";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { importSessions } from "@/db/schema";
import {
  CSV_INFER_SAMPLE_CAP,
  CSV_MAX_FILE_BYTES,
  CSV_MAX_ROWS,
  CSV_PREVIEW_ROW_CAP,
  CSV_SESSION_TTL_MS,
} from "@/lib/constants/csv-import";
import { cleanupExpiredImportSessions } from "@/lib/import/cleanup-expired-sessions";
import { inferEmailColumn } from "@/lib/import/infer-email-column";
import { parseCsvRecords } from "@/lib/import/parse-csv";
import { isValidEmail } from "@/lib/validation/email";
import {
  getSessionAbsolutePath,
  getSessionStoredPath,
  getUploadsDir,
} from "@/lib/import/staging-path";

export const runtime = "nodejs";

export async function POST(request: Request) {
  await cleanupExpiredImportSessions();

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "Expected multipart/form-data" },
      { status: 400 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "Missing file field" }, { status: 400 });
  }

  const filename =
    typeof (file as File).name === "string"
      ? (file as File).name || "upload.csv"
      : "upload.csv";

  if (!filename.toLowerCase().endsWith(".csv")) {
    return NextResponse.json(
      { error: "Please upload a .csv file" },
      { status: 400 },
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length === 0) {
    return NextResponse.json({ error: "Empty file" }, { status: 400 });
  }
  if (buf.length > CSV_MAX_FILE_BYTES) {
    return NextResponse.json(
      {
        error: `File exceeds maximum size of ${CSV_MAX_FILE_BYTES} bytes`,
      },
      { status: 413 },
    );
  }

  const text = buf.toString("utf8");
  const { headers, rows } = parseCsvRecords(text);

  if (headers.length === 0) {
    return NextResponse.json(
      { error: "Could not read CSV headers" },
      { status: 400 },
    );
  }

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "CSV contains no data rows" },
      { status: 400 },
    );
  }

  if (rows.length > CSV_MAX_ROWS) {
    return NextResponse.json(
      { error: `CSV exceeds maximum of ${CSV_MAX_ROWS} data rows` },
      { status: 400 },
    );
  }

  const inferSample = rows.slice(0, CSV_INFER_SAMPLE_CAP);
  const suggestedEmailHeader = inferEmailColumn(headers, inferSample);

  const previewRows = rows.slice(0, CSV_PREVIEW_ROW_CAP);
  let malformedInSample = 0;
  const sampleForStats = rows.slice(0, CSV_INFER_SAMPLE_CAP);
  if (suggestedEmailHeader) {
    for (const row of sampleForStats) {
      const v = row[suggestedEmailHeader]?.trim() ?? "";
      if (v && !isValidEmail(v)) malformedInSample++;
    }
  }

  const sessionId = randomUUID();
  const storedPath = getSessionStoredPath(sessionId);
  const absPath = getSessionAbsolutePath(sessionId);

  await mkdir(getUploadsDir(), { recursive: true });
  await writeFile(absPath, buf);

  const now = new Date();
  const expiresAt = new Date(now.getTime() + CSV_SESSION_TTL_MS);

  await db.insert(importSessions).values({
    id: sessionId,
    originalFilename: filename,
    storedPath,
    createdAt: now,
    expiresAt,
  });

  return NextResponse.json({
    sessionId,
    originalFilename: filename,
    headers,
    previewRows,
    suggestedColumnMap: {
      emailHeader: suggestedEmailHeader,
      nameHeader: null as string | null,
      phoneHeader: null as string | null,
    },
    stats: {
      totalRows: rows.length,
      previewRowCount: previewRows.length,
      malformedInSample,
    },
    expiresAt: expiresAt.toISOString(),
  });
}
