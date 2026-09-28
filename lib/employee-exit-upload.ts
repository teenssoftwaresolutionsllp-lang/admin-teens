import { createClient } from "@/lib/supabase-browser";
export async function uploadExitDocument(
  file: File,
  employeeId: string
): Promise<{
  path: string;
  name: string;
}> {
  const supabase = createClient();

  const extension = file.name.split(".").pop() || "pdf";

  const fileName = `${crypto.randomUUID()}.${extension}`;

  const filePath = `${employeeId}/${fileName}`;

  const { error } = await supabase.storage
    .from("employee-exit-documents")
    .upload(filePath, file, {
      upsert: false,
      contentType: file.type,
    });

  if (error) {
    throw new Error(error.message);
  }

  return {
    path: filePath,
    name: file.name,
  };
}