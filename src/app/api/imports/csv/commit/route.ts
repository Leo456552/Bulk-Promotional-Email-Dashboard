import { NextResponse } from "next/server";
import {
  commitCsvImport,
  type CsvColumnMap,
} from "@/lib/import/commit-csv-import";
import { cleanupExpiredImportSessions } from "@/lib/import/cleanup-expired-sessions";

export const runtime = "nodejs";

type CommitBody = {
  sessionId?: string;
  listName?: string;
  columnMap?: CsvColumnMap;
};

export async function POST(request: Request) {
  await cleanupExpiredImportSessions();

  let body: CommitBody;
  try {
    body = (await request.json()) as CommitBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const sessionId = body.sessionId?.trim();
  const listName = body.listName?.trim();
  const columnMap = body.columnMap;

  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }
  if (!listName) {
    return NextResponse.json({ error: "listName is required" }, { status: 400 });
  }
  if (!columnMap?.emailHeader?.trim()) {
    return NextResponse.json(
      { error: "columnMap.emailHeader is required" },
      { status: 400 },
    );
  }

  try {
    const result = await commitCsvImport({
      sessionId,
      listName,
      columnMap: {
        emailHeader: columnMap.emailHeader.trim(),
        nameHeader: columnMap.nameHeader?.trim() || null,
        phoneHeader: columnMap.phoneHeader?.trim() || null,
      },
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Commit failed";
    const status =
      message.includes("not found") || message.includes("expired")
        ? 404
        : message.includes("No valid")
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
