import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ImageLibraryTab } from "@/components/admin/ImageLibraryTab";
import { PdfLibraryTab } from "@/components/admin/PdfLibraryTab";

export function BibliotecaTab() {
  return (
    <Tabs defaultValue="imagens">
      <TabsList>
        <TabsTrigger value="imagens">Imagens</TabsTrigger>
        <TabsTrigger value="pdfs">PDFs</TabsTrigger>
      </TabsList>
      <TabsContent value="imagens" className="mt-4"><ImageLibraryTab /></TabsContent>
      <TabsContent value="pdfs" className="mt-4"><PdfLibraryTab /></TabsContent>
    </Tabs>
  );
}
