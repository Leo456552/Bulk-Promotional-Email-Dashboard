import { readFile } from "fs/promises";
import path from "path";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { contactLists, contacts, importSessions } from "@/db/schema";
import { CSV_MAX_ROWS } from "@/lib/constants/csv-import";
import { parseCsvRecords } from "@/lib/import/parse-csv";
import { isValidEmail, normalizeEmail } from "@/lib/validation/email";

export type CsvColumnMap = {
  emailHeader: string;
  nameHeader?: string | null;
  phoneHeader?: string | null;
};

export type CommitCsvImportInput = {
  sessionId: string;
  listName: string;
  columnMap: CsvColumnMap;
};

export type CommitCsvImportResult = {
  contactListId: number;
  listName: string;
  inserted: number;
  skippedInvalid: number;
  skippedDuplicateInFile: number;
  skippedAlreadyInDatabase: number;
  malformedEmailsSample: string[];
};

const MALFORMED_SAMPLE_CAP = 20;

function buildCustomFieldsJson(
  row: Record<string, string>,
  columnMap: CsvColumnMap,
): string | null {
  const used = new Set<string>(
    [
      columnMap.emailHeader,
      columnMap.nameHeader ?? undefined,
      columnMap.phoneHeader ?? undefined,
    ].filter(Boolean) as string[],
  );

  const extras: Record<string, string> = {};
  for (const [key, val] of Object.entries(row)) {
    if (used.has(key)) continue;
    const v = val?.trim();
    if (v) extras[key] = v;
  }

  if (Object.keys(extras).length === 0) return null;
  return JSON.stringify(extras);
}

async function findEmailsAlreadyInDatabase(
  emails: string[],
): Promise<Set<string>> {
  if (emails.length === 0) return new Set();
  const found = new Set<string>();
  const chunkSize = 400;
  for (let i = 0; i < emails.length; i += chunkSize) {
    const chunk = emails.slice(i, i + chunkSize);
    const rows = await db
      .select({ email: contacts.email })
      .from(contacts)
      .where(inArray(contacts.email, chunk));
    for (const r of rows) found.add(r.email);
  }
  return found;
}

export async function commitCsvImport(
  input: CommitCsvImportInput,
): Promise<CommitCsvImportResult> {
  const { sessionId, listName, columnMap } = input;
  const name = listName.trim();
  if (!name) {
    throw new Error("List name is required");
  }
  if (!columnMap.emailHeader?.trim()) {
    throw new Error("Email column is required");
  }

  const [session] = await db
    .select()
    .from(importSessions)
    .where(eq(importSessions.id, sessionId))
    .limit(1);

  if (!session) {
    throw new Error("Import session not found or expired");
  }

  if (session.expiresAt.getTime() < Date.now()) {
    throw new Error("Import session expired");
  }

  const absPath = path.isAbsolute(session.storedPath)
    ? session.storedPath
    : path.join(process.cwd(), session.storedPath.replace(/\//g, path.sep));

  const raw = await readFile(absPath, "utf8");
  const { headers, rows } = parseCsvRecords(raw);

  if (!headers.length || !rows.length) {
    throw new Error("CSV has no data rows");
  }

  if (rows.length > CSV_MAX_ROWS) {
    throw new Error(`CSV exceeds maximum of ${CSV_MAX_ROWS} rows`);
  }

  if (!headers.includes(columnMap.emailHeader)) {
    throw new Error("Email column not present in CSV headers");
  }

  const emailHeader = columnMap.emailHeader;
  const nameHeader = columnMap.nameHeader?.trim() || null;
  const phoneHeader = columnMap.phoneHeader?.trim() || null;

  const plannedEmails: string[] = [];
  for (const row of rows) {
    const rawEmail = row[emailHeader]?.trim() ?? "";
    if (!rawEmail || !isValidEmail(rawEmail)) continue;
    plannedEmails.push(normalizeEmail(rawEmail));
  }

  const uniquePlanned = [...new Set(plannedEmails)];
  const alreadyInDb = await findEmailsAlreadyInDatabase(uniquePlanned);

  let skippedInvalid = 0;
  let skippedDuplicateInFile = 0;
  let skippedAlreadyInDatabase = 0;
  const malformedSample: string[] = [];
  const seenInFile = new Set<string>();

  const batch: {
    contactListId: number;
    email: string;
    name: string | null;
    customFieldsJson: string | null;
    status: string;
  }[] = [];

  let inserted = 0;
  let contactListIdResult = 0;

  await db.transaction(async (tx) => {
    const [listRow] = await tx
      .insert(contactLists)
      .values({ name, source: "csv" })
      .returning({ id: contactLists.id });

    const contactListId = listRow.id;

    const flush = async () => {
      if (batch.length === 0) return;
      await tx.insert(contacts).values(batch);
      inserted += batch.length;
      batch.length = 0;
    };

    for (const row of rows) {
      const rawEmail = row[emailHeader]?.trim() ?? "";
      if (!rawEmail) {
        skippedInvalid++;
        continue;
      }
      if (!isValidEmail(rawEmail)) {
        skippedInvalid++;
        if (malformedSample.length < MALFORMED_SAMPLE_CAP) {
          malformedSample.push(rawEmail);
        }
        continue;
      }

      const email = normalizeEmail(rawEmail);
      if (seenInFile.has(email)) {
        skippedDuplicateInFile++;
        continue;
      }
      if (alreadyInDb.has(email)) {
        skippedAlreadyInDatabase++;
        continue;
      }

      seenInFile.add(email);

      const displayName = nameHeader
        ? row[nameHeader]?.trim() || null
        : null;
      const customJson = buildCustomFieldsJson(row, {
        emailHeader,
        nameHeader,
        phoneHeader,
      });

      batch.push({
        contactListId,
        email,
        name: displayName,
        customFieldsJson: customJson,
        status: "active",
      });

      if (batch.length >= 400) await flush();
    }

    await flush();

    if (inserted === 0) {
      throw new Error("No valid contacts to import");
    }
    contactListIdResult = contactListId;
  });

  await db.delete(importSessions).where(eq(importSessions.id, sessionId));
  try {
    const fs = await import("fs/promises");
    await fs.unlink(absPath);
  } catch {
    /* ignore */
  }

  return {
    contactListId: contactListIdResult,
    listName: name,
    inserted,
    skippedInvalid,
    skippedDuplicateInFile,
    skippedAlreadyInDatabase,
    malformedEmailsSample: malformedSample,
  };
}
