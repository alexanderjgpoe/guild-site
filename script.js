const SUPABASE_URL = "https://elqopjkcfuvtbpafnfet.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVscW9wamtjZnV2dGJwYWZuZmV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc4NTI0NDcsImV4cCI6MjA3MzQyODQ0N30.H7WitHdiONiOkK1FICXMtNhiHFG8ThzKT6h2CRsFEPs";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Regex for loot and attendance formats
const lootRegex = /^([^,]+),\s*(\d{2}-\d{2}-\d{4}),\s*\[([^\]]+)\],\s*(Heroic|Normal),\s*(MS|OS)$/i;
const attendanceRegex = /^([^,]+),\s*(\d{2}-\d{2}-\d{4})$/;

async function submitData() {
  const statusEl = document.getElementById("status");
  const input = document.getElementById("data-input").value.trim();
  if (!input) {
    statusEl.innerText = "No input provided.";
    return;
  }

  statusEl.innerText = "Validating...";

  const lines = input.split("\n").map(line => line.trim()).filter(l => l.length > 0);

  let validRows = [];
  let invalidRows = [];
  let duplicateRows = [];

  // Remove duplicates from pasted input
  const uniqueLines = [...new Set(lines)];

  for (const line of uniqueLines) {
    if (lootRegex.test(line) || attendanceRegex.test(line)) {
      validRows.push({ raw_text: line });
    } else {
      invalidRows.push(line);
    }
  }

  if (validRows.length === 0) {
    statusEl.innerText = "No valid loot/attendance lines found.";
    return;
  }

  // Check for duplicates in DB
  const { data: existing, error: fetchError } = await supabase
    .from("import_raw")
    .select("raw_text")
    .in("raw_text", validRows.map(r => r.raw_text));

  if (fetchError) {
    statusEl.innerText = "Error checking duplicates: " + fetchError.message;
    return;
  }

  // Remove lines that already exist in the DB
  const existingSet = new Set(existing.map(r => r.raw_text));
  const newRows = validRows.filter(r => !existingSet.has(r.raw_text));
  duplicateRows = validRows.filter(r => existingSet.has(r.raw_text));

  if (newRows.length === 0) {
    statusEl.innerText = "All lines were already imported. Nothing new added.";
    return;
  }

  statusEl.innerText = "Importing...";
  const { error } = await supabase.from("import_raw").insert(newRows);

  if (error) {
    statusEl.innerText = "Error inserting rows: " + error.message;
    return;
  }

  // Call the Supabase function to process rows
  const { error: rpcError } = await supabase.rpc("process_import_raw");

  if (rpcError) {
    statusEl.innerText = "Processing error: " + rpcError.message;
    return;
  }

  let msg = `✅ Import successful! Added ${newRows.length} new line(s).`;
  if (duplicateRows.length > 0) {
    msg += ` Skipped ${duplicateRows.length} duplicate(s).`;
  }
  if (invalidRows.length > 0) {
    msg += ` Skipped ${invalidRows.length} invalid line(s).`;
  }

  statusEl.innerText = msg;
  document.getElementById("data-input").value = "";
}

// Hook up the form submit
document.getElementById("import-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  await submitData();
});
